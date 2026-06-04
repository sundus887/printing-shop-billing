const express = require("express");
const { getInvoices, addInvoice } = require("../services/invoiceService.js");
const licenseGuard = require("../security/licenseGuard.js");
const { generateInvoicePDF } = require("../utils/pdfGenerator.js");
 
const router = express.Router();
 
// GET all invoices
router.get("/:shopId", licenseGuard, (req, res) => {
  const { shopId } = req.params;
  res.json(getInvoices(shopId));
});
 
// CREATE invoice + PDF
router.post("/:shopId", licenseGuard, (req, res) => {
  const { shopId } = req.params;
  const invoice = addInvoice(shopId, req.body);
  const pdf = generateInvoicePDF(invoice, shopId);
  res.json({
    message: "Invoice created successfully",
    invoice,
    pdfUrl: `/api/invoices/${shopId}/download/${pdf.fileName}`,
  });
});
 
// DOWNLOAD PDF
router.get("/:shopId/download/:fileName", licenseGuard, (req, res) => {
  const { shopId, fileName } = req.params;
  const filePath = `invoices/${shopId}/${fileName}`;
  res.download(filePath);
});
 
module.exports = router;
 