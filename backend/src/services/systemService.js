import fs from "fs";
import path from "path";

const BASE_DIR = process.env.DATA_DIR || process.cwd();
const SYSTEM_PATH = path.join(BASE_DIR, "data", "system.json");

const safeReadJson = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8");
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const getSystem = () => {
  return safeReadJson(SYSTEM_PATH, {});
};

export const setLastBackupAt = (isoString) => {
  const system = getSystem();
  system.lastBackupAt = String(isoString || new Date().toISOString());

  ensureDir(path.dirname(SYSTEM_PATH));
  fs.writeFileSync(SYSTEM_PATH, JSON.stringify(system, null, 2));
  return system;
};

export const getLastBackupAt = () => {
  const system = getSystem();
  return system.lastBackupAt ? String(system.lastBackupAt) : null;
};

export const getLastRunDate = () => {
  const system = getSystem();
  return system.lastRunDate ? String(system.lastRunDate) : null;
};

export const setLastRunDate = (isoString) => {
  const system = getSystem();
  system.lastRunDate = String(isoString || new Date().toISOString());

  ensureDir(path.dirname(SYSTEM_PATH));
  fs.writeFileSync(SYSTEM_PATH, JSON.stringify(system, null, 2));
  return system;
};
