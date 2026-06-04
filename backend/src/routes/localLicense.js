const express = require("express");
const {
  activateLocalLicense,
  importEncryptedLicense,
  renewLocalLicense,
  verifyLocalLicense,
  getLicensePath,
} = require("../services/licenseService.js");
 
const router = express.Router();
 
router.post("/activate", (req, res) => {
  try {
    const body = req.body || {};
    const licensePayload = body.license ?? body.key ?? body.payload;
    const result = activateLocalLicense(licensePayload);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({
      success: true,
      message: "License activated successfully",
      license: result.license,
      filePath: getLicensePath(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "License activation failed",
      details: error.message,
    });
  }
});
 
router.post("/importEnc", (req, res) => {
  try {
    const body = req.body || {};
    const payload = body.licenseEnc ?? body.payload ?? body.license;
    const result = importEncryptedLicense(payload);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      message: "License imported successfully",
      license: result.license,
      filePath: getLicensePath(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "License import failed",
      details: error.message,
    });
  }
});
 
router.get("/status", (req, res) => {
  try {
    const result = verifyLocalLicense();
    if (!result.ok) {
      return res.status(403).json({ success: false, reason: result.reason, license: result.license });
    }
    res.json({ success: true, license: result.license });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to read license",
      details: error.message,
    });
  }
});
 
router.post("/renew", (req, res) => {
  try {
    const { expiry, plan, key, license, licenseEnc } = req.body || {};
    if (licenseEnc) {
      const imp = importEncryptedLicense(licenseEnc);
      if (!imp.ok) return res.status(400).json({ success: false, error: imp.error });
      return res.json({
        success: true,
        message: "Subscription renewed successfully",
        license: imp.license,
        filePath: getLicensePath(),
      });
    }
    const result = renewLocalLicense({ expiry, plan, key, license });
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({
      success: true,
      message: "Subscription renewed successfully",
      license: result.license,
      filePath: getLicensePath(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Subscription renewal failed",
      details: error.message,
    });
  }
});
 
module.exports = router;
 