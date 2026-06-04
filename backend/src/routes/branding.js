const express = require("express");
const { getBranding, updateBranding } = require("../services/brandingService.js");
const licenseGuard = require("../security/licenseGuard.js");
 
const router = express.Router();
 
router.get("/:shopId", licenseGuard, getBranding);
router.put("/:shopId", licenseGuard, updateBranding);
 
module.exports = router;
 