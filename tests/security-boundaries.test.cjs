// Isolated source tests: no app bootstrap, dotenv, database, sockets or network.
// Every runtime import of the code under test must be explicitly supplied below.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const mongoose = require('mongoose');

function load(relative, dependencies = {}) {
  const filename = path.join(__dirname, '..', relative);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module, exports: module.exports,
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error(`Unmocked dependency: ${name}`);
      return dependencies[name];
    },
    process: { env: {}, cwd: () => path.resolve('/isolated-backend') },
    console: { log() {}, warn() {}, error() {} }, Buffer, URL,
    setInterval: () => ({ unref() {} }),
    setImmediate: () => { throw new Error('Unexpected background task'); },
  }, { filename });
  return module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
function response(auth) {
  return {
    locals: { auth }, statusCode: 200, headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
const nextError = error => { if (error) throw error; };
function chain(value) {
  const result = { then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
  for (const name of ['select', 'populate', 'sort', 'skip', 'limit']) result[name] = () => result;
  return result;
}
function storageHarness(realPath) {
  const calls = [];
  const disk = {
    existsSync: file => { calls.push(['exists', file]); return true; },
    mkdirSync: file => { calls.push(['mkdir', file]); },
    realpathSync: file => realPath ? realPath(file) : file,
    statSync: () => ({ size: 5, isFile: () => true }),
    createReadStream: file => { calls.push(['read', file]); return 'mock-stream'; },
    writeFileSync: file => { calls.push(['write', file]); },
    unlinkSync: file => { calls.push(['unlink', file]); },
  };
  const storage = load('src/services/storageService.ts', {
    fs: disk, path, stream: {},
    '@aws-sdk/client-s3': {
      S3Client: class { async send(command) { calls.push(['s3', command]); return {}; } },
      GetObjectCommand: class { constructor(input) { Object.assign(this, input); } },
      PutObjectCommand: class { constructor(input) { Object.assign(this, input); } },
      DeleteObjectCommand: class { constructor(input) { Object.assign(this, input); } },
    },
  });
  calls.length = 0;
  return { storage, calls };
}

for (const key of ['../outside.txt', 'media/../../outside.txt', '/absolute.txt', 'C:\\outside.txt', 'media\\..\\outside.txt', '%2e%2e/outside.txt', 'media/..', 'media/file:stream', 'media/file.']) {
  test(`storage rejects unsafe key ${key} before remote or disk access`, async () => {
    const { storage, calls } = storageHarness();
    assert.equal(await storage.getFileFromStorage(key), null);
    assert.equal(await storage.deleteFromStorage(key), false);
    assert.equal(calls.length, 0);
  });
}
test('storage serves an ordinary local fallback', async () => {
  const { storage, calls } = storageHarness();
  const result = await storage.getFileFromStorage('media/valid-file.png');
  assert.equal(result.stream, 'mock-stream');
  assert.ok(calls.some(([operation]) => operation === 'read'));
});
test('storage rejects a symlink escape in the local fallback', async () => {
  const root = path.resolve('/isolated-backend/public/uploads');
  const { storage, calls } = storageHarness(file => file === root ? root : path.resolve('/outside/file.png'));
  assert.equal(await storage.getFileFromStorage('media/file.png'), null);
  assert.ok(!calls.some(([operation]) => operation === 'read'));
});
test('upload rejects an escaping folder before writes or remote calls', async () => {
  const { storage, calls } = storageHarness();
  await assert.rejects(storage.uploadToStorage({ originalname: 'file.txt', buffer: Buffer.from('safe') }, '../outside'));
  assert.equal(calls.length, 0);
});

test('private preview cannot populate or consume a public cache entry', () => {
  const { cacheRoute } = load('src/services/cacheService.ts');
  const middleware = cacheRoute(60, 'blogs');
  const req = { method: 'GET', originalUrl: '/blogs/slug/draft', headers: {} };
  const privateRes = response({ userId: 'author' });
  middleware(req, privateRes, () => privateRes.json({ content: 'private draft' }));
  assert.match(privateRes.getHeader('Cache-Control'), /no-store/);
  const anonymousRes = response();
  let reachedController = false;
  middleware(req, anonymousRes, () => { reachedController = true; anonymousRes.status(404).json({}); });
  assert.equal(reachedController, true);
  assert.equal(anonymousRes.statusCode, 404);
});
test('cache respects controller no-store and still caches public responses', () => {
  const { cacheRoute, memoryCache } = load('src/services/cacheService.ts');
  const req = { method: 'GET', originalUrl: '/leaderboard', headers: {} };
  const privateRes = response();
  cacheRoute()(req, privateRes, () => { privateRes.setHeader('Cache-Control', 'private, no-store'); privateRes.json({}); });
  assert.equal(memoryCache.stats().size, 0);
  const publicRes = response();
  cacheRoute()(req, publicRes, () => publicRes.json({ public: true }));
  const hit = response();
  cacheRoute()(req, hit, () => assert.fail('public cache should hit'));
  assert.equal(hit.body.public, true);
});

const dto = () => load('src/Utils/userDto.ts', {
  crypto, '../config/auth': { getPublicProfileKeySecret: () => 'synthetic-test-key' },
});
function usersHarness(user) {
  const filters = [];
  const User = {
    find: filter => { filters.push(filter); return chain([]); },
    countDocuments: filter => { filters.push(filter); return Promise.resolve(0); },
    findById: () => chain(user), findOne: () => chain(user),
  };
  const controller = load('src/controllers/usersController.ts', {
    crypto, mongoose, bcryptjs: {}, '../models/UserModel': { User },
    '../models/LeaderboardModel': { Leaderboard: { findOne: () => chain({ leetcodeUsername: 'synthetic-user', acSubmissionList: [{ id: '1' }] }) } },
    '../models/PositionModel': { Position: {} }, '../Utils/userDto': dto(),
    '../middlewares/auth': { PRESIDENT_POSITION: 'CHUNHIEM', VICE_PRESIDENT_POSITION: 'PHOCHUNHIEM' },
  });
  return { controller, filters };
}
for (const filter of [{ $or: [{ email: 'private@example.invalid' }] }, { gen: { $gt: 1 } }, { nickname: 'hidden' }, { email: 'private@example.invalid' }, { 'profileVisibility.email': true }, []]) {
  test(`public member filters reject unsafe input ${JSON.stringify(filter)}`, async () => {
    const { controller, filters } = usersHarness();
    const res = response();
    await controller.getAllUsers({ query: { filter: JSON.stringify(filter) } }, res, nextError);
    assert.equal(res.statusCode, 400);
    assert.equal(filters.length, 0);
  });
}
test('member list supports frontend scalar filters and generation alias', async () => {
  const { controller, filters } = usersHarness();
  const id = '000000000000000000000001';
  const res = response({ isAdmin: true });
  await controller.getAllUsers({ query: { filter: JSON.stringify({ positionId: id, majorId: '', departments: `${id},000000000000000000000002`, kGeneration: '8', isLeader: false }) } }, res, nextError);
  assert.equal(res.statusCode, 200);
  assert.equal(filters[0].gen, 8);
  assert.equal(filters[0].isLeader, false);
  assert.equal(filters[0].departments.$in.length, 2);
  assert.ok(!Object.hasOwn(filters[0], 'kGeneration'));
});
test('public search never predicates on hidden nicknames', async () => {
  const { controller, filters } = usersHarness();
  await controller.getAllUsers({ query: { search: 'hidden' } }, response(), nextError);
  assert.ok(!filters[0].$or.some(condition => Object.hasOwn(condition, 'nickname')));
});
test('optional public fields require explicit opt-in', () => {
  const publicDto = dto().toPublicUserDto({ _id: 'user', email: 'private@example.invalid', nickname: 'hidden', description: 'hidden', workplace: 'hidden' });
  for (const key of ['email', 'nickname', 'description', 'workplace']) assert.ok(!Object.hasOwn(publicDto, key));
});
test('LeetCode preference persists in the user schema and defaults private', () => {
  const isolatedMongoose = new mongoose.Mongoose();
  const { User } = load('src/models/UserModel.ts', {
    mongoose: isolatedMongoose, bcryptjs: {}, '../Utils/generateSlug': { generateUniqueSlug: () => 'test' },
    '../Utils/userDto': { toPublicProfileKey: () => 'p_synthetic-test-key' },
  });
  const optedIn = new User({ profileVisibility: { leetcode: true } });
  assert.equal(optedIn.profileVisibility.leetcode, true);
  assert.equal(new User().profileVisibility.leetcode, false);
});
for (const visibility of [undefined, false, true]) {
  test(`profile LeetCode disclosure respects opt-in ${visibility}`, async () => {
    const user = { _id: '000000000000000000000001', profileVisibility: { leetcode: visibility } };
    const { controller } = usersHarness(user);
    const res = response();
    await controller.getUserById({ params: { userId: 'test-member' } }, res, nextError);
    assert.equal(res.body.data.leetcodeUsername, visibility === true ? 'synthetic-user' : null);
    assert.equal(res.body.data.acSubmissionList.length, visibility === true ? 1 : 0);
  });
}
test('owner can still view private LeetCode data', async () => {
  const user = { _id: 'owner', profileVisibility: { leetcode: false } };
  const { controller } = usersHarness(user);
  const res = response({ userId: 'owner' });
  await controller.getUserById({ params: { userId: 'test-member' } }, res, nextError);
  assert.equal(res.body.data.leetcodeUsername, 'synthetic-user');
});
test('leaderboard excludes opted-out, legacy and deleted users and is not cacheable', async () => {
  const entries = [true, false, undefined].map((visibility, i) => ({
    leetcodeUsername: `synthetic-${i}`, acSubmissionList: [], userId: { _id: String(i), profileVisibility: { leetcode: visibility } },
  }));
  entries.push({ leetcodeUsername: 'deleted', userId: null });
  const { getLeaderBoard } = load('src/controllers/leetcodeController.ts', {
    jsonwebtoken: {}, axios: {}, '../models/LeaderboardModel': { Leaderboard: { find: () => chain(entries) } },
    '../models/UserModel': { User: {} }, '../Utils/userDto': dto(), '../services/cacheService': { invalidateCache() {} },
  });
  const res = response();
  await getLeaderBoard({}, res, nextError);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].leetcodeUsername, 'synthetic-0');
  assert.match(res.getHeader('Cache-Control'), /no-store/);
});

test('CORS allows exact owned/configured origins and rejects hostile hosting tenants', () => {
  const { createCorsOptions } = load('src/config/cors.ts');
  const options = createCorsOptions('https://approved-preview.example.invalid');
  for (const [origin, allowed] of [[undefined, true], ['https://client.fudever.com', true], ['http://localhost:3002', true], ['https://approved-preview.example.invalid', true], ['https://evilfudever.com', false], ['https://unowned.vercel.app', false], ['https://unowned.workers.dev', false], ['null', false]]) {
    options.origin(origin, (error, actual) => { assert.equal(error, null); assert.equal(actual, allowed, origin); });
  }
});

function routerHarness(dependencies) {
  const routes = {};
  const Router = { route(url) {
    const route = {};
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) route[method] = (...handlers) => { routes[`${method} ${url}`] = handlers; return route; };
    return route;
  } };
  return { routes, dependencies: { express: { Router: () => Router }, ...dependencies } };
}
async function execute(handlers, req, res) {
  let index = 0;
  async function next(error) { if (error) throw error; const handler = handlers[index++]; if (handler) return handler(req, res, next); }
  await next();
}
test('verification route returns private account DTO for a valid bearer session', async () => {
  const user = { _id: 'member', firstname: 'Synthetic', password: 'synthetic-hash' };
  const { verifyToken } = load('src/controllers/tokenController.ts', {
    '../models/UserModel': { User: { findById: () => chain(user) } },
    '../models/PositionModel': { Position: {} },
    '../Utils/userDto': dto(),
    '../config/auth': { getJwtSecret: () => 'synthetic-test-secret' },
    jsonwebtoken: { verify: () => ({ userId: 'member' }) },
    lodash: {},
  });
  const res = response();
  await verifyToken({ method: 'POST', body: {}, headers: { authorization: 'Bearer synthetic-test' }, header(name) { return this.headers[name.toLowerCase()]; } }, res, nextError);
  assert.equal(res.body?.data?._id, 'member');
  assert.ok(!Object.hasOwn(res.body.data, 'password'));
  assert.match(res.getHeader('Cache-Control'), /no-store/);
});
