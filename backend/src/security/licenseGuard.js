const { verifyLocalLicense } = require("../services/licenseService.js");

function licenseGuard(req, res, next) {
  try {
    const st = verifyLocalLicense();
    if (!st || !st.ok) {
      return res.status(403).json({
        success: false,
        reason: (st && st.reason) ? st.reason : "LICENSE_REQUIRED",
      });
    }
    return next();
  } catch {
    return res.status(403).json({ success: false, reason: "LICENSE_REQUIRED" });
  }
}

module.exports = licenseGuard;