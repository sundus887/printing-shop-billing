const { getDb } = require("../db.js");
 
const cleanShopId = (shopId) => shopId.trim();
 
const parseInvNo = (invoiceNumber) => {
  try {
    const s = String(invoiceNumber || "");
    const m = s.match(/(\d+)/g);
    if (!m || !m.length) return 0;
    return Number(m[m.length - 1]) || 0;
  } catch { return 0; }
};
 
const getInvoices = (shopId) => {
  const db = getDb();
  const sid = cleanShopId(shopId);
  const invRows = db.prepare(
    `SELECT id, shopId, invoiceNumber, customerName, total, createdAt
     FROM invoices WHERE shopId = ? ORDER BY id DESC`
  ).all(sid);
 
  const itemRows = invRows.length ? db.prepare(
    `SELECT id, invoiceId, name, qty, rate, amount
     FROM invoice_items
     WHERE invoiceId IN (${invRows.map(() => "?").join(",")})`
  ).all(...invRows.map((r) => r.id)) : [];
 
  const byInvoice = new Map();
  for (const it of itemRows) {
    if (!byInvoice.has(it.invoiceId)) byInvoice.set(it.invoiceId, []);
    byInvoice.get(it.invoiceId).push({ id: it.id, name: it.name, qty: it.qty, rate: it.rate, amount: it.amount });
  }
 
  return invRows.map((r) => ({
    id: r.id, invoiceNumber: r.invoiceNumber, customerName: r.customerName,
    total: r.total, createdAt: r.createdAt, items: byInvoice.get(r.id) || [],
  }));
};
 
const addInvoice = (shopId, invoiceData) => {
  const db = getDb();
  const sid = cleanShopId(shopId);
  const maxRow = db.prepare(
    `SELECT invoiceNumber FROM invoices WHERE shopId = ? ORDER BY id DESC LIMIT 1`
  ).get(sid);
  const nextNumber = (maxRow ? parseInvNo(maxRow.invoiceNumber) : 0) + 1;
  const invoiceNumber = `INV-${String(nextNumber).padStart(3, "0")}`;
  const customerName = String(invoiceData?.customerName || "");
  const items = Array.isArray(invoiceData?.items) ? invoiceData.items : [];
  const total = Number(invoiceData?.total || 0);
  const createdAt = new Date().toISOString();
 
  const insertInvoice = db.prepare(
    `INSERT INTO invoices (shopId, invoiceNumber, customerName, total, createdAt) VALUES (?, ?, ?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO invoice_items (invoiceId, name, qty, rate, amount) VALUES (?, ?, ?, ?, ?)`
  );
 
  const tx = db.transaction(() => {
    const info = insertInvoice.run(sid, invoiceNumber, customerName, total, createdAt);
    const invoiceId = Number(info.lastInsertRowid);
    for (const it of items) {
      const name = String(it?.name || it?.itemName || "");
      const qty = Number(it?.qty ?? it?.quantity ?? 0);
      const rate = Number(it?.rate ?? it?.price ?? 0);
      const amount = Number(it?.amount ?? qty * rate);
      insertItem.run(invoiceId, name, qty, rate, amount);
    }
    return invoiceId;
  });
 
  const id = tx();
  return { id, invoiceNumber, customerName, items, total, createdAt };
};
 
module.exports = { getInvoices, addInvoice };
 