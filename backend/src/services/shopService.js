const { getDb } = require("../db.js");
 
const DEFAULT_SHOP_ID = "shop_001";
 
const getShop = () => {
  const db = getDb();
  const row = db
    .prepare(`SELECT id, name, createdAt FROM shops WHERE id = ? LIMIT 1`)
    .get(DEFAULT_SHOP_ID);
  if (!row) return {};
  return { shopId: row.id, shopName: row.name, createdAt: row.createdAt };
};
 
const updateShop = (updatedData) => {
  const db = getDb();
  const shopName = String(updatedData?.shopName || updatedData?.name || "");
  const createdAt = String(updatedData?.createdAt || new Date().toISOString());
  db.prepare(
    `INSERT INTO shops (id, name, createdAt)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       createdAt = excluded.createdAt`
  ).run(DEFAULT_SHOP_ID, shopName, createdAt);
  return { shopId: DEFAULT_SHOP_ID, shopName, createdAt };
};
 
module.exports = { getShop, updateShop };
 