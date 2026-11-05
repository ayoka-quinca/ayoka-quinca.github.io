/**
 * Serveur de synchronisation Ayoka Quinca.
 * - Zéro dépendance : Node.js ≥ 22.13 (module intégré node:sqlite).
 * - Stocke chaque enregistrement (produit, vente, mouvement…) avec un numéro d'ordre (seq).
 * - Fusion « le plus récent gagne » sur updatedAt. Les mouvements de stock étant immuables,
 *   le stock calculé est toujours la somme exacte de tout ce qui a été saisi, sur tous les appareils.
 * - Sert aussi l'application (dossier ../app/dist) : une seule adresse à retenir.
 * - Sauvegarde automatique quotidienne de la base (30 jours conservés).
 *
 * Variables : PORT (8080), SHOP_TOKEN (obligatoire), DATA_DIR (./data), STATIC_DIR (../app/dist)
 */
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);
const TOKEN = process.env.SHOP_TOKEN ?? '';
const DATA = process.env.DATA_DIR ?? join(here, 'data');
const STATIC = process.env.STATIC_DIR ?? join(here, '..', 'app', 'dist');
const TABLES = new Set(['locations', 'categories', 'products', 'movements', 'sales', 'payments', 'clients', 'suppliers', 'purchases', 'inventories', 'users', 'audit', 'quotes']);

if (TOKEN.length < 16) {
  console.error('SHOP_TOKEN manquant ou trop court (16 caractères minimum).');
  process.exit(1);
}
mkdirSync(join(DATA, 'backups'), { recursive: true });
const db = new DatabaseSync(join(DATA, 'ayoka.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS records (
    tbl TEXT NOT NULL, id TEXT NOT NULL, updated_at INTEGER NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY (tbl, id)
  );
  CREATE INDEX IF NOT EXISTS records_seq ON records(seq);
  CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER);
  INSERT OR IGNORE INTO meta VALUES ('seq', 0);
`);
const nextSeq = db.prepare(`UPDATE meta SET v = v + 1 WHERE k = 'seq' RETURNING v`);
const getRec = db.prepare(`SELECT updated_at FROM records WHERE tbl = ? AND id = ?`);
const upsert = db.prepare(`INSERT INTO records (tbl, id, updated_at, seq, data) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(tbl, id) DO UPDATE SET updated_at = excluded.updated_at, seq = excluded.seq, data = excluded.data`);
const pull = db.prepare(`SELECT tbl, id, seq, data FROM records WHERE seq > ? ORDER BY seq LIMIT 500`);

function authOk(req) {
  const h = req.headers.authorization ?? '';
  const given = Buffer.from(h.replace(/^Bearer /, ''));
  const want = Buffer.from(TOKEN);
  return given.length === want.length && timingSafeEqual(given, want);
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readJson(req, limit = 5_000_000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('trop gros');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

function serveStatic(req, res) {
  if (!existsSync(STATIC)) return send(res, 404, { error: 'introuvable' });
  const url = new URL(req.url, 'http://x');
  let p = normalize(join(STATIC, decodeURIComponent(url.pathname)));
  if (!p.startsWith(STATIC)) return send(res, 403, { error: 'interdit' });
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(STATIC, 'index.html');
  const ext = extname(p);
  const cache = p.includes(`${'/'}assets${'/'}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': cache });
  res.end(readFileSync(p));
}

const CORS = { 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    if (url.pathname === '/health') return send(res, 200, { ok: true, seq: db.prepare(`SELECT v FROM meta WHERE k='seq'`).get().v }, CORS);
    if (url.pathname.startsWith('/sync/')) {
      if (!authOk(req)) return send(res, 401, { error: 'clé invalide' }, CORS);
      if (url.pathname === '/sync/push' && req.method === 'POST') {
        const { records } = await readJson(req);
        let accepted = 0;
        db.exec('BEGIN');
        try {
          for (const r of records ?? []) {
            if (!TABLES.has(r.table) || typeof r.id !== 'string' || typeof r.data !== 'object') continue;
            const updatedAt = Number(r.data.updatedAt ?? 0);
            const cur = getRec.get(r.table, r.id);
            if (cur && cur.updated_at > updatedAt) continue; // la version du serveur est plus récente
            upsert.run(r.table, r.id, updatedAt, nextSeq.get().v, JSON.stringify(r.data));
            accepted++;
          }
          db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; }
        return send(res, 200, { accepted }, CORS);
      }
      if (url.pathname === '/sync/pull' && req.method === 'GET') {
        const since = Number(url.searchParams.get('since') ?? 0);
        const rows = pull.all(since);
        return send(res, 200, {
          records: rows.map((r) => ({ table: r.tbl, id: r.id, data: JSON.parse(r.data) })),
          cursor: rows.length ? rows[rows.length - 1].seq : since,
          more: rows.length === 500,
        }, CORS);
      }
      return send(res, 404, { error: 'introuvable' }, CORS);
    }
    if (req.method === 'GET') return serveStatic(req, res);
    send(res, 405, { error: 'méthode non permise' });
  } catch (e) {
    console.error(new Date().toISOString(), e);
    send(res, 500, { error: 'erreur serveur' }, CORS);
  }
});

function backup() {
  const day = new Date().toISOString().slice(0, 10);
  const file = join(DATA, 'backups', `ayoka-${day}.db`);
  if (!existsSync(file)) {
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    console.log('Sauvegarde', file);
  }
  const files = readdirSync(join(DATA, 'backups')).filter((f) => f.endsWith('.db')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 30))) rmSync(join(DATA, 'backups', f));
}
backup();
setInterval(backup, 3600_000);

server.listen(PORT, () => console.log(`Ayoka Quinca : http://localhost:${PORT}`));
