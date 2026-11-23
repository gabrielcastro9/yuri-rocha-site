import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlitePath = path.join(root, "data", "yuri.db");

const TABLES = [
  `CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL,
    data TEXT NOT NULL,
    resumo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    conteudo2 TEXT DEFAULT '',
    imagem TEXT DEFAULT '',
    propaganda TEXT DEFAULT '',
    propaganda_tipo TEXT DEFAULT 'imagem',
    galeria TEXT DEFAULT '[]',
    status TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS map_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    lon REAL NOT NULL,
    lat REAL NOT NULL,
    label_dx REAL DEFAULT 0,
    label_dy REAL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS map_deliveries (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    value REAL DEFAULT 0,
    status TEXT NOT NULL,
    date TEXT DEFAULT '',
    image TEXT DEFAULT '',
    video TEXT DEFAULT '',
    photos TEXT DEFAULT '[]',
    demo INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS ouvidoria (
    id TEXT PRIMARY KEY,
    protocol TEXT NOT NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    bairro TEXT DEFAULT '',
    tipo TEXT NOT NULL,
    assunto TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`
];

let sqliteDb = null;
let pgSql = null;
let migrated = false;

function postgresUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || "";
}

export function dbDriver() {
  return postgresUrl() ? "postgres" : "sqlite";
}

export function dbReady() {
  return dbDriver() === "postgres" || !process.env.VERCEL;
}

export function dbLabel() {
  return dbDriver() === "postgres" ? "PostgreSQL (Neon)" : "SQLite";
}

function toPg(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function rowsOf(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

async function pgClient() {
  if (!pgSql) {
    const { neon } = await import("@neondatabase/serverless");
    pgSql = neon(postgresUrl());
  }
  return pgSql;
}

async function sqliteClient() {
  if (!sqliteDb) {
    const { DatabaseSync } = await import("node:sqlite");
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    sqliteDb = new DatabaseSync(sqlitePath);
    sqliteDb.exec("PRAGMA foreign_keys = ON;");
    sqliteDb.exec("PRAGMA journal_mode = WAL;");
  }
  return sqliteDb;
}

export async function all(sql, params = []) {
  await migrate();
  if (dbDriver() === "postgres") {
    const sqlFn = await pgClient();
    if (typeof sqlFn.query === "function") return rowsOf(await sqlFn.query(toPg(sql), params));
    return rowsOf(await sqlFn(toPg(sql), params));
  }
  const db = await sqliteClient();
  return db.prepare(sql).all(...params);
}

export async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

export async function run(sql, params = []) {
  await migrate();
  if (dbDriver() === "postgres") {
    const sqlFn = await pgClient();
    if (typeof sqlFn.query === "function") {
      await sqlFn.query(toPg(sql), params);
      return;
    }
    await sqlFn(toPg(sql), params);
    return;
  }
  const db = await sqliteClient();
  db.prepare(sql).run(...params);
}

async function migrate() {
  if (migrated) return;
  if (!dbReady()) {
    throw new Error("Configure DATABASE_URL (Neon Postgres) na Vercel para o banco de dados.");
  }
  if (dbDriver() === "postgres") {
    const sqlFn = await pgClient();
    for (const statement of TABLES) {
      if (typeof sqlFn.query === "function") await sqlFn.query(statement);
      else await sqlFn(statement);
    }
  } else {
    const db = await sqliteClient();
    db.exec(TABLES.join(";") + ";");
  }
  await ensureArticleColumns();
  migrated = true;
}

async function ensureArticleColumns() {
  const columns = [
    ["conteudo2", "TEXT DEFAULT ''"],
    ["propaganda", "TEXT DEFAULT ''"],
    ["propaganda_tipo", "TEXT DEFAULT 'imagem'"]
  ];
  if (dbDriver() === "postgres") {
    const sqlFn = await pgClient();
    for (const [name, def] of columns) {
      const statement = `ALTER TABLE articles ADD COLUMN IF NOT EXISTS ${name} ${def}`;
      if (typeof sqlFn.query === "function") await sqlFn.query(statement);
      else await sqlFn(statement);
    }
    return;
  }
  const db = await sqliteClient();
  for (const [name, def] of columns) {
    try { db.exec(`ALTER TABLE articles ADD COLUMN ${name} ${def}`); } catch { /* coluna já existe */ }
  }
}

export async function getMeta(key) {
  const row = await get("SELECT value FROM app_meta WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setMeta(key, value) {
  await run(
    "INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, String(value)]
  );
}
