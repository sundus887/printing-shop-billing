const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execSync } = require("child_process");
const { getLastRunDate, setLastRunDate } = require("./systemService.js");
 
const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAytVTA5kztgM9s0tSzNnr
HoAkCTo/CnYflGuOjTxeR2GsrkwxjWd9GdhjSR0plTpbGW7Ih/oNucK3FFzuiiZB
KTAkso/u5qpbD4W8PQPEYCpN+L5y05OnHgotMsYc3BQ8byGVURGdK8JX96DcGlnC
0qhOEBlNJeddMX0RCznrgLGxDfPmTVstlA7J4jgsGbSqUd0v12OQLanrigQf1Ju5
R4mdvJ5LTx5bQWA+ylwNL+1cyBmeVVZ/J0C3V9fx6xb0WmCGbQdYnyeyyp26L+dH
x0YHmcRBfNQWwEDniA7tkiF0dZ6xbP37bQtu5453x+qm+1d62aelg3M/TC7R4vae
T56nUaqCeAykH31YQ4EgPoUnDBh9XNePKDAlMp9ib25zrM15/C8ZpI3w2Yn5WJ07
nirgd31BA1CHasWczvr4pHxLvUubwXYz2xzyObVgKtT2qq7oV4sr6iRWX//bRo50
YKuijW+NrC6Vzl0WplFjmvZnFSAvJTMObU0fPcd69ZuTpM5LdHqCcujD3FIzRFZB
qGKRqtMKrlfTkwjXFOwLmB3Wt/9fcW74eJnYc9WAtNW7+n+/mhZPPNMYaC/2yoSN
e6W4xqJE3VtEObbmcH3/Kc2gxuyleomfyAysbbTboLRfgTtYY6v8AdzDqqUze/jT
JLPvFfXNIRqMAj922qLwz2MCAwEAAQ==
-----END PUBLIC KEY-----`;
const BASE_DIR = path.join(
  process.env.APPDATA,
  'printing-shop-billing',
  'backend_data'
);
const LICENSE_PATH = path.join(BASE_DIR, "data", "license.json");
const OLD_LICENSE_PATH = path.join(BASE_DIR, "data", "license.json");
 
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};
 
const getMachineId = () => {
  const platform = os.platform();
  const arch = os.arch();
  const clean = (s) => String(s || "").replace(/\u0000/g, "").replace(/\r?\n/g, " ").trim();
  const wmicValue = (args) => {
    try {
      const out = execSync(`wmic ${args}`, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf-8");
      const lines = out.split(/\r?\n/).map((l) => clean(l)).filter(Boolean);
      if (lines.length <= 1) return "";
      return clean(lines[1]);
    } catch { return ""; }
  };
  const winMachineGuid = () => {
    try {
      const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { stdio: ["ignore", "pipe", "ignore"] }).toString("utf-8");
      const m = out.match(/MachineGuid\s+REG_\w+\s+([A-Fa-f0-9-]+)/);
      return clean(m && m[1]);
    } catch { return ""; }
  };
  const mbSerial = (platform === "win32") ? wmicValue("baseboard get SerialNumber") : "";
  const cpuId = (platform === "win32") ? wmicValue("cpu get ProcessorId") : "";
  const osId = (platform === "win32") ? winMachineGuid() : "";
  const hostname = os.hostname();
  const cpuModel = os.cpus()?.[0]?.model || "";
  const raw = [platform, arch, mbSerial || "NO_MB_SERIAL", cpuId || "NO_CPU_ID", osId || "NO_OS_ID", hostname, cpuModel].join("|");
  return crypto.createHash("sha256").update(raw, "utf-8").digest("hex");
};
 
const validateKeyFormat = (key) => {
  if (!key || typeof key !== "string") return false;
  return /^[A-Z0-9]{4}(-[A-Z0-9]{4}){2}$/.test(key.trim().toUpperCase());
};
 
const canonicalPayload = (lic) => ({
  shopName: String(lic && lic.shopName || "").trim(),
  machineId: String(lic && lic.machineId || "").trim(),
  validTill: String(lic && (lic.validTill || lic.expiry) || "").trim(),
  planMonths: Number(lic && lic.planMonths || 0) || 0,
});
 
const verifyRsaSignature = (payloadObj, signatureBase64) => {
  if (!signatureBase64) return false;
  try {
    const msg = JSON.stringify(canonicalPayload(payloadObj));
    const sig = Buffer.from(String(signatureBase64), "base64");
    return crypto.verify("RSA-SHA256", Buffer.from(msg, "utf-8"), { key: LICENSE_PUBLIC_KEY_PEM, padding: crypto.constants.RSA_PKCS1_PADDING }, sig);
  } catch { return false; }
};
 
const parseIncomingLicense = (input) => {
  if (!input) return null;
  if (typeof input === "object") return input;
  const s = String(input || "").trim();
  if (!s) return null;
  return JSON.parse(s);
};
 
const normalizeLicense = (lic) => {
  if (!lic || typeof lic !== "object") return null;
  return {
    shopName: String(lic.shopName || "").trim(),
    machineId: String(lic.machineId || "").trim(),
    validTill: String(lic.validTill || "").trim(),
    planMonths: Number(lic.planMonths || 0) || 0,
  };
};
 
const readLocalLicense = () => {
  try {
    if (!fs.existsSync(LICENSE_PATH)) {
      if (fs.existsSync(OLD_LICENSE_PATH)) {
        const rawOld = fs.readFileSync(OLD_LICENSE_PATH, "utf-8");
        const oldParsed = JSON.parse(rawOld);
        if (!oldParsed || typeof oldParsed !== "object") throw new Error("LICENSE_CORRUPTED");
        try {
          writeLocalLicense(oldParsed);
          try { fs.rmSync(OLD_LICENSE_PATH, { force: true }); } catch {}
        } catch { throw new Error("LICENSE_CORRUPTED"); }
      } else { return null; }
    }
    const raw = fs.readFileSync(LICENSE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch { throw new Error("LICENSE_CORRUPTED"); }
};
 
const writeLocalLicense = (license) => {
  ensureDir(path.dirname(LICENSE_PATH));
  fs.writeFileSync(LICENSE_PATH, JSON.stringify(license, null, 2));
  return license;
};
 
const parseIsoDateMs = (iso) => {
  const ms = Date.parse(String(iso || ""));
  return Number.isFinite(ms) ? ms : NaN;
};
 
const importEncryptedLicense = (encryptedJsonOrObj) => {
  let lic;
  try {
    if (!encryptedJsonOrObj) return { ok: false, error: "INVALID_LICENSE_FILE" };
    if (typeof encryptedJsonOrObj === "object") lic = encryptedJsonOrObj;
    else lic = JSON.parse(String(encryptedJsonOrObj || "").trim());
  } catch { return { ok: false, error: "INVALID_LICENSE_FILE" }; }
  if (!lic || typeof lic !== "object") return { ok: false, error: "LICENSE_CORRUPTED" };
  if (!lic.validTill && lic.expiry) lic.validTill = String(lic.expiry);
  const machineId = getMachineId();
  if (!lic.machineId || String(lic.machineId) !== String(machineId)) return { ok: false, error: "MACHINE_ID_MISMATCH" };
  const validTillMs = parseIsoDateMs(lic.validTill);
  if (!Number.isFinite(validTillMs)) return { ok: false, error: "INVALID_VALID_TILL" };
  if (validTillMs < Date.now()) return { ok: false, error: "SUBSCRIPTION_EXPIRED" };
  if (!lic.signature) return { ok: false, error: "UNSIGNED_LICENSE" };
  if (!verifyRsaSignature(lic, lic.signature)) {
    try { fs.rmSync(LICENSE_PATH, { force: true }); } catch {}
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }
  const licenseToStore = {
    type: "subscription", shopName: String(lic.shopName || ""), machineId: String(lic.machineId || ""),
    validTill: new Date(validTillMs).toISOString(), planMonths: Number(lic.planMonths || 0) || 0,
    activatedAt: String(lic.activatedAt || new Date().toISOString()), signature: String(lic.signature || ""),
  };
  try { setLastRunDate(new Date().toISOString()); } catch {}
  writeLocalLicense(licenseToStore);
  return { ok: true, license: licenseToStore };
};
 
const activateLocalLicense = (licenseJsonOrObj) => {
  let incoming;
  try { incoming = parseIncomingLicense(licenseJsonOrObj); } catch { return { ok: false, error: "INVALID_LICENSE_JSON" }; }
  const signature = incoming && typeof incoming === "object" ? String(incoming.signature || "") : "";
  const payload = normalizeLicense(incoming);
  if (!payload) return { ok: false, error: "INVALID_LICENSE_JSON" };
  if (!payload.shopName) return { ok: false, error: "SHOP_NAME_REQUIRED" };
  if (!payload.machineId) return { ok: false, error: "MACHINE_ID_REQUIRED" };
  if (!payload.validTill) return { ok: false, error: "VALID_TILL_REQUIRED" };
  const localMachineId = getMachineId();
  if (payload.machineId !== localMachineId) return { ok: false, error: "MACHINE_ID_MISMATCH" };
  const validTillMs = parseIsoDateMs(payload.validTill);
  if (!Number.isFinite(validTillMs)) return { ok: false, error: "INVALID_VALID_TILL" };
  if (validTillMs < Date.now()) return { ok: false, error: "SUBSCRIPTION_EXPIRED" };
  if (!signature) return { ok: false, error: "UNSIGNED_LICENSE" };
  if (!verifyRsaSignature(payload, signature)) {
    try { fs.rmSync(LICENSE_PATH, { force: true }); } catch {}
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }
  const license = {
    type: "subscription", shopName: payload.shopName, machineId: payload.machineId,
    validTill: new Date(validTillMs).toISOString(), planMonths: payload.planMonths,
    activatedAt: new Date().toISOString(), signature,
  };
  try { setLastRunDate(new Date().toISOString()); } catch {}
  writeLocalLicense(license);
  return { ok: true, license };
};
 
const ensureExpiryIso = (license) => {
  const activatedMs = parseIsoDateMs(license && license.activatedAt);
  const baseMs = Number.isFinite(activatedMs) ? activatedMs : Date.now();
  const expiryMs = parseIsoDateMs((license && (license.validTill || license.expiry)) || "");
  if (Number.isFinite(expiryMs)) return { changed: false, license };
  const regen = new Date(baseMs + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { changed: true, license: { ...(license || {}), activatedAt: Number.isFinite(activatedMs) ? String(license.activatedAt) : new Date(baseMs).toISOString(), validTill: regen, expiry: regen } };
};
 
const parseRenewalKey = (key) => {
  const k = String(key || "").trim().toUpperCase();
  const m = k.match(/^REN-(\d{8})-([A-Z0-9_-]{3,20})$/);
  if (!m) return null;
  const y = Number(m[1].slice(0, 4)), mo = Number(m[1].slice(4, 6)), d = Number(m[1].slice(6, 8));
  if (!y || !mo || !d) return null;
  const expiry = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
  if (!Number.isFinite(expiry.getTime())) return null;
  return { expiry: expiry.toISOString(), plan: m[2].toLowerCase() };
};
 
const renewLocalLicense = ({ expiry, plan, key, license: signedLicense }) => {
  let license;
  try { license = readLocalLicense(); } catch { return { ok: false, error: "LICENSE_CORRUPTED" }; }
  if (!license) return { ok: false, error: "LICENSE_NOT_FOUND" };
  const machineId = getMachineId();
  if (!license.machineId || license.machineId !== machineId) return { ok: false, error: "MACHINE_ID_MISMATCH" };
  if (signedLicense) {
    let incoming;
    try { incoming = parseIncomingLicense(signedLicense); } catch { return { ok: false, error: "INVALID_LICENSE_JSON" }; }
    const signature = incoming && typeof incoming === "object" ? String(incoming.signature || "") : "";
    const payload = normalizeLicense(incoming);
    if (!payload) return { ok: false, error: "INVALID_LICENSE_JSON" };
    if (payload.machineId !== machineId) return { ok: false, error: "MACHINE_ID_MISMATCH" };
    const validTillMs = parseIsoDateMs(payload.validTill);
    if (!Number.isFinite(validTillMs)) return { ok: false, error: "INVALID_VALID_TILL" };
    if (!signature) return { ok: false, error: "UNSIGNED_LICENSE" };
    if (!verifyRsaSignature(payload, signature)) {
      try { fs.rmSync(LICENSE_PATH, { force: true }); } catch {}
      return { ok: false, reason: "INVALID_SIGNATURE" };
    }
    const updated = { type: "subscription", shopName: payload.shopName || String(license.shopName || ""), machineId, validTill: new Date(validTillMs).toISOString(), planMonths: payload.planMonths, activatedAt: String(license.activatedAt || new Date().toISOString()), signature };
    writeLocalLicense(updated);
    return { ok: true, license: updated };
  }
  if (license.signature) return { ok: false, error: "RENEWAL_REQUIRES_SIGNED_LICENSE" };
  let resolvedExpiry = expiry, resolvedPlan = plan;
  if ((!resolvedExpiry || !resolvedPlan) && key) {
    const parsed = parseRenewalKey(key);
    if (!parsed) return { ok: false, error: "INVALID_RENEWAL_KEY" };
    resolvedExpiry = parsed.expiry; resolvedPlan = parsed.plan;
  }
  const newExpiryMs = parseIsoDateMs(resolvedExpiry);
  if (!Number.isFinite(newExpiryMs)) return { ok: false, error: "INVALID_EXPIRY_DATE" };
  const currentExpiryMs = parseIsoDateMs(license.validTill || license.expiry);
  if (Number.isFinite(currentExpiryMs) && newExpiryMs < currentExpiryMs) return { ok: false, error: "EXPIRY_CANNOT_DECREASE" };
  const updated = { type: "subscription", machineId, shopName: String(license.shopName || ""), activatedAt: String(license.activatedAt || new Date().toISOString()), validTill: new Date(newExpiryMs).toISOString(), planMonths: Number(license.planMonths || 0) || 0, signature: String(license.signature || "") };
  writeLocalLicense(updated);
  return { ok: true, license: updated };
};
 
const verifyLocalLicense = () => {
  let license;
  try { license = readLocalLicense(); } catch { return { ok: false, reason: "LICENSE_CORRUPTED" }; }
  if (!license) return { ok: false, reason: "LICENSE_NOT_FOUND" };
  const machineId = getMachineId();
  if (!license.machineId || license.machineId !== machineId) {
    try { fs.rmSync(LICENSE_PATH, { force: true }); } catch {}
    return { ok: false, reason: "LICENSE_NOT_FOUND" };
  }
  if (license.type !== "subscription") return { ok: false, reason: "INVALID_LICENSE_TYPE" };
  if (!license.validTill && license.expiry) license.validTill = String(license.expiry);
  if (!license.signature || !verifyRsaSignature(license, license.signature)) {
    try { fs.rmSync(LICENSE_PATH, { force: true }); } catch {}
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }
  try {
    const healed = ensureExpiryIso(license);
    if (healed.changed) { license = healed.license; try { writeLocalLicense(license); } catch { return { ok: false, reason: "LICENSE_CORRUPTED" }; } }
  } catch {}
  const nowMs = Date.now();
  const lastRunIso = getLastRunDate();
  const lastRunMs = lastRunIso ? parseIsoDateMs(lastRunIso) : NaN;
  if (Number.isFinite(lastRunMs) && nowMs < lastRunMs) return { ok: false, reason: "DATE_TAMPER_DETECTED" };
  const expiryMs = parseIsoDateMs(license.validTill || license.expiry);
  if (!Number.isFinite(expiryMs)) return { ok: false, reason: "INVALID_EXPIRY_DATE" };
  const msPerDay = 24 * 60 * 60 * 1000;
  const gracePeriodEndMs = expiryMs + (3 * msPerDay);
  if (nowMs <= expiryMs) {
    const daysRemaining = Math.ceil((expiryMs - nowMs) / msPerDay);
    return { ok: true, license: { ...license, expiry: license.validTill || license.expiry, daysRemaining, daysExpired: 0, inGrace: false } };
  } else if (nowMs <= gracePeriodEndMs) {
    const daysExpired = Math.ceil((nowMs - expiryMs) / msPerDay);
    return { ok: true, license: { ...license, expiry: license.validTill || license.expiry, daysRemaining: 0, daysExpired, inGrace: true } };
  } else {
    const daysExpired = Math.ceil((nowMs - expiryMs) / msPerDay);
    return { ok: false, reason: "SUBSCRIPTION_EXPIRED", license: { expiry: license.validTill || license.expiry, daysRemaining: 0, daysExpired, inGrace: false } };
  }
};
 
const getLicensePath = () => LICENSE_PATH;
 
module.exports = { getMachineId, validateKeyFormat, readLocalLicense, writeLocalLicense, importEncryptedLicense, activateLocalLicense, renewLocalLicense, verifyLocalLicense, getLicensePath };
 