const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Load only the requested source and explicitly allowed dependencies. Never load
// index.ts, dotenv, database connections, schedulers or real notification hooks.
function load(relative, mocks, env = {}) {
    const filename = path.resolve(__dirname, '..', relative);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const module = { exports: {} };
    const sandbox = { module, exports: module.exports, Buffer, console, setTimeout, clearTimeout,
        process: { env }, require(name) {
            if (Object.hasOwn(mocks, name)) return mocks[name];
            if (name === '../utils/notificationDto' || name === '../Utils/notificationDto') return load('src/Utils/notificationDto.ts', mocks, env);
            throw new Error(`Unexpected dependency: ${name}`);
        } };
    vm.runInNewContext(source, sandbox, { filename });
    return module.exports;
}
const A = '111111111111111111111111';
const B = '222222222222222222222222';
const N = '333333333333333333333333';
const plain = value => JSON.parse(JSON.stringify(value));
function response(userId = A, isAdmin = false) {
    return { locals: { auth: { userId, isAdmin } }, statusCode: 200,
        status(code) { this.statusCode = code; return this; }, json(body) { this.body = plain(body); return this; } };
}
function matches(doc, query) {
    return Object.entries(query).every(([key, value]) => {
        if (key === '$or') return value.some(q => matches(doc, q));
        if (key === '$and') return value.every(q => matches(doc, q));
        if (value && typeof value === 'object' && '$nin' in value) return !value.$nin.some(v => String(v) === String(doc[key]));
        if (value === null) return doc[key] == null;
        return String(doc[key]) === String(value);
    });
}
function chain(value) {
    return { sort() { return this; }, skip() { return this; }, limit() { return this; }, select() { return this; },
        lean() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}
function notifications(docs) {
    const receipts = [];
    const Notification = {
        find: query => chain(docs.filter(doc => matches(doc, query))),
        countDocuments: async query => docs.filter(doc => matches(doc, query)).length,
        findOne: async query => docs.find(doc => matches(doc, query)) || null,
        findByIdAndUpdate: async (id, update) => { const d = docs.find(d => d._id === id); if (d) Object.assign(d, update); return d; },
        findOneAndUpdate: async (query, update) => { const d = docs.find(d => matches(d, query)); if (d) Object.assign(d, update); return d; },
        updateMany: async (query, update) => docs.filter(d => matches(d, query)).forEach(d => Object.assign(d, update)),
    };
    const NotificationRead = {
        distinct: async (key, query) => receipts.filter(d => matches(d, query)).map(d => d[key]),
        updateOne: async query => { if (!receipts.some(d => matches(d, query))) receipts.push(query); },
        bulkWrite: async ops => { for (const op of ops) await NotificationRead.updateOne(op.updateOne.filter); },
    };
    return { api: load('src/controllers/notificationController.ts', {
        mongoose, '../models/NotificationModel': { Notification }, '../models/NotificationReadModel': { NotificationRead },
        '../services/telegramService': {},
    }), receipts };
}
const next = error => { throw error; };
test('mark-read cannot update or return another member notification', async () => {
    const doc = { _id: N, recipientId: B, recipientRole: 'member', isRead: false };
    const { api } = notifications([doc]);
    const res = response();
    await api.markNotificationAsRead({ params: { id: N } }, res, next);
    assert.equal(res.statusCode, 404);
    assert.equal(doc.isRead, false);
});
test('notification DTO removes historical embedded credentials and private records', async () => {
    const { api } = notifications([{ _id: N, recipientId: A, recipientRole: 'member', isRead: false,
        type: 'badge_unlocked', title: 'Badge', message: 'Earned', link: '/discover',
        meta: { user: { password: 'fixture-hash', email: 'private@example.invalid' }, project: { secret: 'private' } } }]);
    const res = response();
    await api.getMyNotifications({ query: {} }, res, next);
    assert.equal(res.body.data[0].title, 'Badge');
    assert.equal(res.body.data[0].meta, undefined);
    assert.equal(res.body.data[0].recipientId, undefined);
});
test('broadcast read state and unread count are private to each reader', async () => {
    const doc = { _id: N, recipientId: null, recipientRole: 'all', isRead: true, title: 'Broadcast' };
    const { api } = notifications([doc]);
    const before = response(B);
    await api.getMyNotifications({ query: {} }, before, next);
    assert.equal(before.body.unreadCount, 1, 'legacy global read flags must not affect a new reader');
    await api.markNotificationAsRead({ params: { id: N } }, response(A), next);
    const own = response(A), other = response(B);
    await api.getMyNotifications({ query: {} }, own, next);
    await api.getMyNotifications({ query: {} }, other, next);
    assert.equal(own.body.unreadCount, 0);
    assert.equal(own.body.data[0].isRead, true);
    assert.equal(other.body.unreadCount, 1);
    assert.equal(other.body.data[0].isRead, false);
});
test('read-all does not mark broadcasts globally or expose targeted role notifications', async () => {
    const docs = [ { _id: N, recipientId: null, recipientRole: 'all', isRead: false },
        { _id: '444444444444444444444444', recipientId: B, recipientRole: 'all', isRead: false },
        { _id: '555555555555555555555555', recipientId: null, recipientRole: 'admin', isRead: false } ];
    const { api } = notifications(docs);
    await api.markAllNotificationsAsRead({}, response(A), next);
    assert.ok(docs.every(d => !d.isRead));
    const res = response(A);
    await api.getMyNotifications({ query: {} }, res, next);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.unreadCount, 0);
});

function sockets(user) {
    class Server {
        constructor() { this.middleware = []; }
        use(fn) { this.middleware.push(fn); }
        on(event, fn) { if (event === 'connection') this.connect = fn; }
    }
    const api = load('src/socket.ts', { 'socket.io': { Server }, jsonwebtoken: jwt,
        './config/auth': { getJwtSecret: () => 'isolated-test-secret' },
        './models/UserModel': { User: { findById: () => chain(user) } },
    });
    api.socketServer.init({}); api.socketServer.onConnection();
    const io = api.socketServer.getInstance().io;
    return { io, async connect(token) {
        const socket = { handshake: { auth: token === undefined ? {} : { token }, headers: {} }, data: {}, rooms: new Set(), handlers: {},
            join(room) { this.rooms.add(room); }, on(event, fn) { this.handlers[event] = fn; },
            disconnect() {}, leave(room) { this.rooms.delete(room); } };
        for (const middleware of io.middleware) {
            await new Promise((resolve, reject) => middleware(socket, err => err ? reject(err) : resolve()));
        }
        io.connect(socket); return socket;
    } };
}
test('anonymous, forged and expired socket credentials are rejected', async () => {
    const { connect } = sockets({ _id: A, isAdmin: false });
    await assert.rejects(connect());
    await assert.rejects(connect('forged'));
    await assert.rejects(connect(jwt.sign({ userId: A }, 'isolated-test-secret', { expiresIn: -1 })));
});
test('socket rooms use verified identity and current database role', async () => {
    const { connect } = sockets({ _id: A, isAdmin: false });
    const socket = await connect(jwt.sign({ userId: A, isAdmin: true }, 'isolated-test-secret', { expiresIn: '1h' }));
    await socket.handlers['join:user']?.(B);
    await socket.handlers['join:admin']?.();
    assert.ok(socket.rooms.has(`user_${A}`));
    assert.ok(!socket.rooms.has(`user_${B}`));
    assert.ok(!socket.rooms.has('admin_channel'));
});
test('current admins join admin room and deleted users are rejected', async () => {
    const token = jwt.sign({ userId: A }, 'isolated-test-secret', { expiresIn: '1h' });
    const socket = await sockets({ _id: A, isAdmin: true }).connect(token);
    await socket.handlers['join:admin']?.();
    assert.ok(socket.rooms.has('admin_channel'));
    await assert.rejects(sockets(null).connect(token));
});

function telegram(env = {}) {
    const effects = [];
    const author = { firstname: 'Test', lastname: 'Author', password: 'fixture-hash', email: 'private@example.invalid',
        save: async () => {} };
    const project = { _id: N, authorId: A, title: 'Project', isPublished: false, save: async () => {} };
    const api = load('src/controllers/telegramWebhookController.ts', {
        crypto: require('node:crypto'), axios: { post: async () => effects.push('reply') },
        '../services/observabilityService': { observabilityService: {} },
        '../services/cacheService': { invalidateCache: () => effects.push('cache'), memoryCache: { clear: () => effects.push('cache') } },
        '../models/OpenSourceProjectModel': { OpenSourceProject: { findById: async () => { effects.push('project'); return project; } } },
        '../models/UserModel': { User: { findById: () => chain(author) } },
        '../services/notificationService': { createNotification: async payload => effects.push(plain(payload)) },
        '../services/telegramService': { TELEGRAM_ADMIN_CHAT_ID: '123', TELEGRAM_BOT_TOKEN: 'fake',
            answerCallbackQuery: async () => effects.push('answer'), editTelegramMessageText: async () => {} },
    }, env);
    return { api, effects };
}
const request = (body, secret) => ({ body, get: () => secret, headers: { 'x-telegram-bot-api-secret-token': secret } });
test('webhook fails closed without configured secret or valid header before effects', async () => {
    for (const [env, header, status] of [[{}, undefined, 503], [{ TELEGRAM_WEBHOOK_SECRET: 'test-secret' }, undefined, 401],
        [{ TELEGRAM_WEBHOOK_SECRET: 'test-secret' }, 'wrong-secret', 401]]) {
        const { api, effects } = telegram(env), res = response();
        await api.handleTelegramWebhook(request({ message: { chat: { id: 123 }, text: '/clearcache' } }, header), res, next);
        assert.equal(res.statusCode, status);
        assert.equal(effects.length, 0);
    }
});
test('authenticated webhook and direct polling retain their command contract', async () => {
    const { api, effects } = telegram({ TELEGRAM_WEBHOOK_SECRET: 'test-secret' }), res = response();
    await api.handleTelegramWebhook(request({ message: { chat: { id: 123 }, text: '/clearcache' } }, 'test-secret'), res, next);
    assert.equal(res.statusCode, 200);
    assert.ok(effects.includes('cache'));
    const polling = telegram();
    await polling.api.processTelegramMessage(123, '/clearcache');
    assert.ok(polling.effects.includes('cache'));
});
test('Telegram approval never stores full author or project in notification metadata', async () => {
    const { api, effects } = telegram();
    await api.processTelegramCallbackQuery({ id: 'callback', data: `approve_project:${N}`, message: { chat: { id: 123 } } });
    const payload = effects.find(v => typeof v === 'object');
    assert.ok(payload);
    assert.equal(payload.meta.user, undefined);
    assert.equal(payload.meta.project, undefined);
    assert.ok(!JSON.stringify(payload).includes('fixture-hash'));
});
