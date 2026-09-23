/**
 * Nightly backup of the FU-DEVER MongoDB database to local disk.
 *
 * - Reads connection string from dever-backend/.env (DB_URI). No secrets in code.
 * - Dumps every user collection to EJSON-lines files + manifest.json (counts).
 * - Keeps the newest --retain backups (default 7), deletes older ones.
 * - Prints summary only, never credentials.
 *
 * Usage:
 *   node scripts/backup-database.js [--out DIR] [--retain N]
 *
 * Intended to run via Windows Task Scheduler daily (see task DEVER-DB-Backup).
 */
const fs = require('fs');
const path = require('path');
const { MongoClient, BSON } = require('../node_modules/mongodb');
const EJSON = BSON.EJSON;

function redact(s) {
  return String(s).replace(/(\/\/[^:/\s?#]+:)[^@\s?#]+(@)/g, '$1***$2');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { root: null, retain: 7 };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--out') out.root = args[++i];
    else if (args[i] === '--retain') out.retain = Math.max(1, parseInt(args[++i], 10) || 7);
  }
  return out;
}

function loadDbUri() {
  const envPath = path.join(__dirname, '..', '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  const line = content.split('\n').find((l) => l.startsWith('DB_URI='));
  if (!line) throw new Error('DB_URI missing in backend .env');
  return line.slice('DB_URI='.length).trim();
}

async function resolveAppDb(client) {
  const candidates = [];
  try {
    const def = client.db().databaseName;
    if (def) candidates.push(def);
  } catch { /* ignore */ }
  try {
    const { databases } = await client.db().admin().listDatabases();
    for (const d of databases) {
      if (!['admin', 'local', 'config'].includes(d.name) && !candidates.includes(d.name)) {
        candidates.push(d.name);
      }
    }
  } catch { /* insufficient privileges; use candidates */ }
  for (const name of candidates) {
    try {
      const cols = await client.db(name).listCollections().toArray();
      if (cols.some((c) => c.name === 'users')) return name;
    } catch { /* ignore */ }
  }
  return candidates[0];
}

async function main() {
  const { root, retain } = parseArgs();
  const backupRoot = root || 'C:\\Users\\ADMIN\\Backups\\dever-db';
  fs.mkdirSync(backupRoot, { recursive: true });

  const uri = loadDbUri();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 30000 });
  await client.connect();
  console.log('BACKUP_SRC_CONNECTED');

  const dbName = await resolveAppDb(client);
  const db = client.db(dbName);
  const cols = (await db.listCollections().toArray()).filter((c) => !c.name.startsWith('system.'));

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
  const dir = path.join(backupRoot, `dever-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });

  const manifest = { date: new Date().toISOString(), db: dbName, collections: {} };
  for (const c of cols) {
    const cursor = db.collection(c.name).find({});
    const file = path.join(dir, `${c.name}.ejsonl`);
    let n = 0;
    const lines = [];
    for await (const doc of cursor) {
      lines.push(EJSON.stringify(doc));
      n += 1;
      if (lines.length >= 1000) {
        fs.appendFileSync(file, lines.splice(0).join('\n') + '\n');
      }
    }
    if (lines.length) fs.appendFileSync(file, lines.join('\n') + '\n');
    else fs.writeFileSync(file, '');
    manifest.collections[c.name] = n;
    console.log(`  dumped ${c.name}: ${n}`);
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await client.close();

  // Retention: keep newest `retain` dated dirs.
  const dirs = fs.readdirSync(backupRoot)
    .filter((d) => d.startsWith('dever-') && fs.statSync(path.join(backupRoot, d)).isDirectory())
    .sort();
  while (dirs.length > retain) {
    const old = dirs.shift();
    fs.rmSync(path.join(backupRoot, old), { recursive: true, force: true });
    console.log(`  pruned ${old}`);
  }
  console.log(`BACKUP_OK dir=${dir}`);
}

main().catch((e) => { console.error('BACKUP_FAIL: ' + redact(e.message)); process.exit(1); });
