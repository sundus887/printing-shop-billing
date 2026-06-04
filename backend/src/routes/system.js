const express = require("express");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { setLastBackupAt } = require("../services/systemService.js");
 
const router = express.Router();
 
const BASE_DIR = process.env.DATA_DIR || process.cwd();
const SHOPS_DIR = path.join(BASE_DIR, "data", "shops");
const BACKUPS_DIR = path.join(BASE_DIR, "backups");
 
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};
 
const pad2 = (n) => String(n).padStart(2, "0");
const backupFileName = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return `backup-${yyyy}-${mm}-${dd}-${hh}${min}.zip`;
};
 
router.post("/backup", (req, res) => {
  try {
    ensureDir(BACKUPS_DIR);
 
    if (!fs.existsSync(SHOPS_DIR)) {
      return res.status(404).json({ error: "data/shops directory not found" });
    }
 
    const fileName = backupFileName();
    const zipPath = path.join(BACKUPS_DIR, fileName);
 
    const zip = new AdmZip();
    zip.addLocalFolder(SHOPS_DIR, "shops");
    zip.writeZip(zipPath);
 
    try {
      setLastBackupAt(new Date().toISOString());
    } catch {}
 
    res.json({
      success: true,
      message: "Backup created successfully",
      filePath: zipPath,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Backup failed",
      details: error.message,
    });
  }
});
 
router.post("/restore", (req, res) => {
  try {
    const { filePath } = req.body || {};
 
    if (!filePath || typeof filePath !== "string") {
      return res.status(400).json({ error: "filePath is required" });
    }
 
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Backup zip file not found" });
    }
 
    if (path.extname(filePath).toLowerCase() !== ".zip") {
      return res.status(400).json({ error: "Invalid backup file (must be .zip)" });
    }
 
    ensureDir(BACKUPS_DIR);
 
    const tempDir = path.join(BACKUPS_DIR, `restore-temp-${Date.now()}`);
    ensureDir(tempDir);
 
    const zip = new AdmZip(filePath);
    zip.extractAllTo(tempDir, true);
 
    const extractedShopsDir = path.join(tempDir, "shops");
    if (!fs.existsSync(extractedShopsDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
      return res.status(400).json({ error: "Invalid backup structure (shops folder missing)" });
    }
 
    const shopsParentDir = path.dirname(SHOPS_DIR);
    ensureDir(shopsParentDir);
 
    const backupOldDir = path.join(
      shopsParentDir,
      `shops-old-${Date.now()}`
    );
 
    try {
      if (fs.existsSync(SHOPS_DIR)) {
        fs.renameSync(SHOPS_DIR, backupOldDir);
      }
    } catch (err) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
      return res.status(500).json({
        error: "Failed to prepare restore (cannot move existing shops folder)",
        details: err.message,
      });
    }
 
    try {
      fs.renameSync(extractedShopsDir, SHOPS_DIR);
    } catch (err) {
      try {
        if (!fs.existsSync(SHOPS_DIR) && fs.existsSync(backupOldDir)) {
          fs.renameSync(backupOldDir, SHOPS_DIR);
        }
      } catch {}
 
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
 
      return res.status(500).json({
        error: "Restore failed",
        details: err.message,
      });
    }
 
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
 
    res.json({
      success: true,
      message: "Restore completed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Restore failed",
      details: error.message,
    });
  }
});
 
module.exports = router;
 