import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const cleanShopId = (shopId) => shopId.trim();

const BASE_DIR = process.env.DATA_DIR || process.cwd();

const getShopDir = (shopId) =>
  path.join(BASE_DIR, "data", "shops", cleanShopId(shopId));

const getInvoicePdfDir = (shopId) =>
  path.join(getShopDir(shopId), "invoices");

export const generateInvoicePDF = (shopId, invoice) => {
  const pdfDir = getInvoicePdfDir(shopId);

  // ✅ ensure folders exist (recursive = parent bhi bana dega)
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
  }

  const fileName = `invoice-${invoice.invoiceNumber}.pdf`;
  const filePath = path.join(pdfDir, fileName);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(filePath));

  // ===== PDF CONTENT =====
  doc.fontSize(20).text("INVOICE", { align: "center" });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`);
  doc.text(`Customer Name: ${invoice.customerName}`);
  doc.text(`Total Amount: Rs ${invoice.total}`);
  doc.text(
    `Date: ${new Date(invoice.createdAt).toLocaleDateString("en-GB")}`
  );

  doc.moveDown(2);
  doc.text("Thank you for your business ❤️", { align: "center" });

  doc.end();

  return filePath;
};
