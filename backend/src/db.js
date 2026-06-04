const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
 
const BASE_DIR = process.env.DATA_DIR || process.cwd();
const DB_PATH = path.join(BASE_DIR, "data", "app.db");
 
let db;
 
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};
 
const initSchema = (database) => {
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      name TEXT,
      createdAt TEXT
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY,
      shopId TEXT,
      invoiceNumber TEXT,
      customerName TEXT,
      total REAL,
      createdAt TEXT
    );
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY,
      invoiceId INTEGER,
      name TEXT,
      qty REAL,
      rate REAL,
      amount REAL
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_shopId ON invoices(shopId);
    CREATE INDEX IF NOT EXISTS idx_items_invoiceId ON invoice_items(invoiceId);
  `);
};
 
const getDb = () => {
  if (db) return db;
  ensureDir(path.dirname(DB_PATH));
  db = new Database(DB_PATH);
  initSchema(db);
  return db;
};
 
const getDbPath = () => DB_PATH;
 
module.exports = { getDb, getDbPath };
 