import fs from "fs";
import path from "path";
import { getDb } from "./db.js";

const BASE_DIR = process.env.DATA_DIR || process.cwd();
const SHOPS_ROOT = path.join(BASE_DIR, "data", "shops");

const safeReadJson = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8");
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const toNumber = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const migrateShopInvoices = (db, shopId, invoices) => {
  const insertInvoice = db.prepare(
    `INSERT INTO invoices (shopId, invoiceNumber, customerName, total, createdAt)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO invoice_items (invoiceId, name, qty, rate, amount)
     VALUES (?, ?, ?, ?, ?)`
  );
  const findInvoice = db.prepare(
    `SELECT id FROM invoices WHERE shopId = ? AND invoiceNumber = ? LIMIT 1`
  );

  const tx = db.transaction(() => {
    for (const inv of invoices) {
      const invoiceNumber = String(inv?.invoiceNumber || "");
      if (!invoiceNumber) continue;

      const exists = findInvoice.get(shopId, invoiceNumber);
      if (exists && exists.id) continue;

      const customerName = String(inv?.customerName || "");
      const total = toNumber(inv?.total, 0);
      const createdAt = String(inv?.createdAt || new Date().toISOString());

      const info = insertInvoice.run(shopId, invoiceNumber, customerName, total, createdAt);
      const invoiceId = Number(info.lastInsertRowid);

      const items = Array.isArray(inv?.items) ? inv.items : [];
      for (const it of items) {
        const name = String(it?.name || it?.itemName || "");
        const qty = toNumber(it?.qty ?? it?.quantity, 0);
        const rate = toNumber(it?.rate ?? it?.price, 0);
        const amount = toNumber(it?.amount, qty * rate);
        insertItem.run(invoiceId, name, qty, rate, amount);
      }
    }
  });

  tx();
};

const migrate = () => {
  const db = getDb();

  if (!fs.existsSync(SHOPS_ROOT)) {
    console.log("No data/shops directory found. Nothing to migrate.");
    return;
  }

  const insertShop = db.prepare(
    `INSERT OR IGNORE INTO shops (id, name, createdAt) VALUES (?, ?, ?)`
  );

  const entries = fs.readdirSync(SHOPS_ROOT, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;

    const shopId = ent.name;
    const shopDir = path.join(SHOPS_ROOT, shopId);

    const shopJson = safeReadJson(path.join(shopDir, "shop.json"), {});
    const name = String(shopJson.shopName || shopJson.name || shopId);
    const createdAt = String(shopJson.createdAt || new Date().toISOString());
    insertShop.run(shopId, name, createdAt);

    const invoices = safeReadJson(path.join(shopDir, "invoices.json"), []);
    if (Array.isArray(invoices) && invoices.length) {
      migrateShopInvoices(db, shopId, invoices);
      console.log(`Migrated invoices for ${shopId}: ${invoices.length}`);
    }
  }

  console.log("Migration complete.");
};

migrate();
