const { app, BrowserWindow, ipcMain, dialog } = require('electron');
let autoUpdater; try { ({ autoUpdater } = require('electron-updater')); } catch {}
const { spawn } = require('child_process');

const IS_PROD = app.isPackaged;

console.log("=== ELECTRON MAIN PROCESS STARTING ===");
console.log("IS_PROD:", IS_PROD);
console.log("Process args:", process.argv);
console.log("Node version:", process.version);
console.log("Electron version:", process.versions.electron);

function daysBetween(nowMs, futureISOString){
  try { const t = Date.parse(String(futureISOString||'')); if (!t) return null; return Math.ceil((t - nowMs)/ (24*60*60*1000)); } catch { return null; }
}
async function checkOnlineSubscription(cfg){
  const mid = getMachineIdCached(cfg);
  const sid = cfg.shopId || getOrCreateShopId(cfg);
  const key = cfg.licenseKey || '';
  try {
    const url = `${LICENSE_SERVER}/license/status?key=${encodeURIComponent(key)}&machineId=${encodeURIComponent(mid)}&shopId=${encodeURIComponent(sid)}`;
    const res = await fetch(url, { method:'GET' });
    if (!res.ok) throw new Error('HTTP_'+res.status);
    const json = await res.json();
    const valid = !!json.valid;
    const plan = json.plan || cfg.plan || 'monthly';
    const expiresAt = json.expiresAt || cfg.expiresAt || null;
    cfg.plan = plan;
    cfg.expiresAt = expiresAt;
    cfg.licenseValid = valid;
    cfg.lastOnlineStatusAt = new Date().toISOString();
    if (json.signature){
      const meta = { licenseKey: key, shopId: sid, machineId: mid, expiresAt, signature: json.signature };
      if (verifySignature(meta)) { await licenseWriteEncrypted(meta); logLicenseAttempt({ event:'store', ok:true, source:'status' }); }
    }
    await writeConfig(cfg);
    return { ok:true, valid, plan, expiresAt, suspended: !!json.suspended };
  } catch (err) {
    return { ok:false, error: String(err && err.message || err) };
  }
}
function isWithinGrace(cfg){
  const graceDays = Number(cfg.graceDays || 7);
  const last = cfg.lastOnlineStatusAt ? Date.parse(cfg.lastOnlineStatusAt) : 0;
  if (!last) return false;
  return (Date.now() - last) <= graceDays*24*60*60*1000;
}
function calcRemainingDays(expiresAt){
  const d = daysBetween(Date.now(), expiresAt);
  return d==null?null:Math.max(d, 0);
}
function getOrCreateShopId(cfg){
  if (cfg && cfg.shopId) return cfg.shopId;
  // Try to find existing shop directory before creating new one
  try {
    const shopsRoot = path.join(getUserDataDir(), 'shops');
    if (fs.existsSync(shopsRoot)) {
      const shops = fs.readdirSync(shopsRoot).filter(f => {
        const stat = fs.statSync(path.join(shopsRoot, f));
        return stat.isDirectory();
      });
      if (shops.length > 0) {
        // Use the first existing shop directory
        console.log('[ShopId] Found existing shop:', shops[0]);
        return shops[0];
      }
    }
  } catch (e) {
    console.error('[ShopId] Error finding existing shop:', e);
  }
  // Only create new if no existing shop found
  const sid = (crypto.randomUUID ? crypto.randomUUID() : ('shop_' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  console.log('[ShopId] Created new shop ID:', sid);
  return sid;
}
async function ensureNotLocked() {
  if (SOFTWARE_LOCKED) {
    throw new Error('SUBSCRIPTION_EXPIRED');
  }
}

const path = require('path');
const fs = require('fs');
const DB = require('./db');
const crypto = require('crypto');
let keytar; try { keytar = require('keytar'); } catch {}

const LICENSE_SERVER = process.env.LICENSE_SERVER || 'http://localhost:3000';
function getUserDataDir(){ try { return app.getPath('userData'); } catch { return process.cwd(); } }
function getConfigPath(){ return path.join(getUserDataDir(), 'config.json'); }
function getKeyFile(){ return path.join(getUserDataDir(), '.key'); }
function getLicenseEncPath(){ return path.join(getUserDataDir(), 'license.enc'); }
function getLicenseAuditPath(){ return path.join(getUserDataDir(), 'license_audit.log'); }
function getBackendDataDir(){ return path.join(getUserDataDir(), 'backend_data'); }
function getShopProfilePath(){ return path.join(getBackendDataDir(), 'data', 'shopProfile.json'); }
function getShopAssetsDir(){ return path.join(getBackendDataDir(), 'assets'); }
async function ensureKey(){
  const service = 'PrintShopBilling';
  const account = 'app-encryption-key';
  try {
    if (keytar && keytar.getPassword){
      const v = await keytar.getPassword(service, account);
      if (v) return Buffer.from(v, 'base64');
      const k = crypto.randomBytes(32);
      await keytar.setPassword(service, account, k.toString('base64'));
      return k;
    }
  } catch {}
  try {
    const f = getKeyFile();
    if (fs.existsSync(f)){
      const b = fs.readFileSync(f);
      return Buffer.from(b.toString(), 'base64');
    }
    const k = crypto.randomBytes(32);
    try { fs.writeFileSync(f, k.toString('base64'), 'utf-8'); } catch {}
    return k;
  } catch { return crypto.randomBytes(32); }
}
function ensureDir(p){ try { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); } catch {} }
function safeJsonRead(file){
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch { return null; }
}
function safeJsonWrite(file, obj){
  try {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf-8');
    return { success:true };
  } catch (e) { return { error: String(e && e.message || e) }; }
}
function readShopProfile(){
  const p = getShopProfilePath();
  return safeJsonRead(p);
}
function saveShopProfile({ shopName, logoSourcePath }){
  const now = new Date().toISOString();
  const existing = readShopProfile() || {};
  let logoPath = existing.logoPath || '';
  try {
    const src = String(logoSourcePath || '').trim();
    if (src) {
      ensureDir(getShopAssetsDir());
      const ext = path.extname(src) || '.png';
      const dest = path.join(getShopAssetsDir(), 'shop-logo' + ext);
      try { fs.copyFileSync(src, dest); logoPath = dest; } catch {}
    }
  } catch {}
  const out = {
    shopName: String(shopName || '').trim(),
    logoPath: String(logoPath || ''),
    invoiceTheme: existing.invoiceTheme || 'default',
    createdAt: existing.createdAt || now,
  };
  const res = safeJsonWrite(getShopProfilePath(), out);
  if (res && res.error) return res;
  return { success:true, profile: out };
}

async function showSetupShopWindow(){
  return new Promise((resolve)=>{
    try {
      const w = new BrowserWindow({
        width: 640, height: 520, resizable: false, modal: true, parent: null,
        webPreferences: {
          contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !IS_PROD,
          preload: app.isPackaged
            ? path.join(process.resourcesPath, 'electron', 'setupShopPreload.js')
            : path.join(__dirname, 'setupShopPreload.js'),
        },
      });
      if (IS_PROD) { w.webContents.on('devtools-opened', () => { w.webContents.closeDevTools(); }); }
      w.loadFile(app.isPackaged
        ? path.join(process.resourcesPath, 'electron', 'setupShop.html')
        : path.join(__dirname, 'setupShop.html'));
      w.on('closed', ()=> resolve());
    } catch { resolve(); }
  });
}

async function backupNow(){
  await ensureNotLocked();
  try {
    const src = DB.getStorePath();
    const docs = app.getPath('documents');
    const backupDir = path.join(docs, 'PrintShopBackups');
    ensureDir(backupDir);
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const name = `backup-${yyyy}-${mm}-${dd}.db`;
    const dest = path.join(backupDir, name);
    fs.copyFileSync(src, dest);
    const cfg = readConfig();
    cfg.lastBackupAt = new Date().toISOString();
    writeConfig(cfg);
    const all = BrowserWindow.getAllWindows();
    for (const w of all){ try { w.webContents.send('backup:success', { path: dest }); } catch {} }
    return { ok:true, dest };
  } catch (e) {
    return { ok:false, error: String(e && e.message || e) };
  }
}

function getBackendSystemPath(){
  try {
    const backendDataDir = path.join(app.getPath('userData'), 'backend_data');
    return path.join(backendDataDir, 'data', 'system.json');
  } catch { return null; }
}
function readBackendSystem(){
  try {
    const p = getBackendSystemPath();
    if (!p || !fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf-8');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

const DISABLE_BACKUP_REMINDER = true;

function isBackupOlderThanDays(lastBackupAt, days){
  const msPerDay = 24*60*60*1000;
  const last = lastBackupAt ? Date.parse(lastBackupAt) : 0;
  if (!last || !Number.isFinite(last)) return true;
  return (Date.now() - last) >= (days * msPerDay);
}

async function maybeShowBackupReminder(){
  try {
    const sys = readBackendSystem();
    const lastBackupAt = sys && sys.lastBackupAt ? String(sys.lastBackupAt) : null;
    if (isBackupOlderThanDays(lastBackupAt, 3)){
      await dialog.showMessageBox({ type:'warning', title:'Backup Reminder', message:'You have not backed up your data in 3 days. Please create a backup.' });
    }
  } catch {}
}

async function getLocalLicenseStatus(){
  try {
    const res = await fetch('http://localhost:3000/api/license/status', { method: 'GET' });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json && json.success === true) return { ok: true, license: json.license };
    return { ok: false, reason: json && (json.reason || json.error), license: json && json.license };
  } catch { return { ok: false, reason: 'UNREACHABLE' }; }
}

async function renewSubscriptionWithKey(key){
  try {
    const res = await fetch('http://localhost:3000/api/license/renew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license: String(key || '') }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json && (json.error || json.details) };
    return { ok: json && json.success === true, license: json && json.license };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
}

async function openRenewalWindow(){
  return await new Promise((resolve) => {
    let renewalWin;
    const cleanup = () => {
      try { ipcMain.removeHandler('renewal:getStatus'); } catch {}
      try { ipcMain.removeHandler('renewal:renew'); } catch {}
      try { ipcMain.removeHandler('renewal:pickFile'); } catch {}
      try { if (renewalWin && !renewalWin.isDestroyed()) renewalWin.close(); } catch {}
    };
    ipcMain.handle('renewal:getStatus', async () => { return await getLocalLicenseStatus(); });
    ipcMain.handle('renewal:renew', async (e, key) => {
      await ensureNotLocked();
      const r = await renewSubscriptionWithKey(key);
      if (r.ok){ cleanup(); resolve(true); return { ok: true }; }
      return { ok: false, error: r.error || 'RENEW_FAILED' };
    });
    ipcMain.handle('renewal:pickFile', async () => {
      await ensureNotLocked();
      try {
        const res = await dialog.showOpenDialog(renewalWin, {
          title: 'Select License File', properties: ['openFile'],
          filters: [{ name: 'License', extensions: ['enc','json'] }, { name: 'All Files', extensions: ['*'] }],
        });
        if (res.canceled || !res.filePaths || !res.filePaths[0]) return { ok: false, error: 'CANCELED' };
        const raw = fs.readFileSync(res.filePaths[0], 'utf-8');
        const r2 = await fetch('http://localhost:3000/api/license/importEnc', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseEnc: raw }),
        });
        const json = await r2.json().catch(() => ({}));
        if (!r2.ok) return { ok: false, error: json && (json.error || json.details || 'IMPORT_FAILED') };
        cleanup(); resolve(true); return { ok: true };
      } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
    });
    renewalWin = new BrowserWindow({
      width: 620, height: 560, resizable: false, minimizable: false, maximizable: false, show: true, modal: true,
      webPreferences: {
        contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !IS_PROD,
        preload: app.isPackaged
          ? path.join(process.resourcesPath, 'electron', 'renewalPreload.js')
          : path.join(__dirname, 'renewalPreload.js'),
      },
    });
    if (IS_PROD) { renewalWin.webContents.on('devtools-opened', () => { renewalWin.webContents.closeDevTools(); }); }
    renewalWin.on('closed', () => { cleanup(); resolve(false); });
    try {
      renewalWin.loadFile(app.isPackaged
        ? path.join(process.resourcesPath, 'electron', 'renewal.html')
        : path.join(__dirname, 'renewal.html'));
    } catch { cleanup(); resolve(false); }
  });
}

async function readConfig(){
  try {
    const file = getConfigPath();
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, 'utf-8');
    const k = await ensureKey();
    try { return dec(raw, k); } catch { try { return JSON.parse(raw); } catch { return {}; } }
  } catch { return {}; }
}
async function writeConfig(cfg){
  try {
    const k = await ensureKey();
    fs.writeFileSync(getConfigPath(), enc(cfg || {}, k), 'utf-8');
  } catch {}
}
function getMachineIdCached(cfg){
  // Always regenerate to ensure consistency with backend
  // MUST match backend/licenseService.js getMachineId() EXACTLY
  const osMod = require('os');
  const { execSync } = require('child_process');
  const cryptoMod = require('crypto');
  const platform = osMod.platform();
  const arch = osMod.arch();
  const clean = (s) => String(s || '').replace(/\u0000/g, '').replace(/\r?\n/g, ' ').trim();
  const wmicValue = (args) => {
    try {
      const out = execSync(`wmic ${args}`, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).toString('utf-8');
      const lines = out.split(/\r?\n/).map((l) => clean(l)).filter(Boolean);
      if (lines.length <= 1) return '';
      return clean(lines[1]);
    } catch { return ''; }
  };
  const winMachineGuid = () => {
    try {
      const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).toString('utf-8');
      const m = out.match(/MachineGuid\s+REG_\w+\s+([A-Fa-f0-9-]+)/);
      return clean(m && m[1]);
    } catch { return ''; }
  };
  const mbSerial = (platform === 'win32') ? wmicValue('baseboard get SerialNumber') : '';
  const cpuId = (platform === 'win32') ? wmicValue('cpu get ProcessorId') : '';
  const osId = (platform === 'win32') ? winMachineGuid() : '';
  const hostname = osMod.hostname();
  const cpuModel = osMod.cpus()?.[0]?.model || '';
  const raw = [platform, arch, mbSerial || 'NO_MB_SERIAL', cpuId || 'NO_CPU_ID', osId || 'NO_OS_ID', hostname, cpuModel].join('|');
  return cryptoMod.createHash('sha256').update(raw, 'utf-8').digest('hex');
}
async function verifyLicense(key, machineId){
  if (!key) return { valid:false };
  try {
    const url = `${LICENSE_SERVER}/license/status?key=${encodeURIComponent(key)}&machineId=${encodeURIComponent(machineId||'')}&shopId=${encodeURIComponent('' + (await (async()=>{ try { const c = await readConfig(); return c.shopId||''; } catch { return '' } })()))}`;
    const res = await fetch(url, { method:'GET' });
    if (!res.ok) return { valid:false };
    const json = await res.json();
    return { valid: !!json.valid, expiresAt: json.expiresAt, reason: json.reason, plan: json.plan, suspended: !!json.suspended, signature: json.signature };
  } catch { return { valid:false }; }
}

let win;
let backendProcess;

async function waitForBackend({ url, timeoutMs, intervalMs }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json && json.status === 'ok') return true;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function startBackend() {
  try {
    const logPath = path.join(app.getPath('userData'), 'backend-debug.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const log = (msg) => {
      const line = `[${new Date().toISOString()}] ${msg}`;
      console.log(line);
      try { logStream.write(line + '\n'); } catch {}
    };
    log('=== BACKEND STARTUP BEGIN ===');
    log(`app.isPackaged: ${app.isPackaged}`);
    log(`process.resourcesPath: ${process.resourcesPath}`);
    log(`process.execPath: ${process.execPath}`);
    log(`userData: ${app.getPath('userData')}`);

    let backendPath;
    let backendRoot;
    if (app.isPackaged) {
      log('[Backend] Production mode');
      const p1 = path.join(process.resourcesPath, 'backend', 'src', 'index.js');
      log(`Checking path 1: ${p1} => exists: ${fs.existsSync(p1)}`);
      const p2 = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'src', 'index.js');
      log(`Checking path 2: ${p2} => exists: ${fs.existsSync(p2)}`);
      if (fs.existsSync(p1)) { backendPath = p1; backendRoot = path.join(process.resourcesPath, 'backend'); }
      else if (fs.existsSync(p2)) { backendPath = p2; backendRoot = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend'); }
      else { log('ERROR: backend/src/index.js not found!'); return; }
    } else {
      log('[Backend] Development mode');
      backendPath = path.join(__dirname, '..', 'backend', 'src', 'index.js');
      backendRoot = path.join(__dirname, '..', 'backend');
    }
    log(`Final backendPath: ${backendPath}`);
    log(`Final backendRoot: ${backendRoot}`);
    log(`backendPath exists: ${fs.existsSync(backendPath)}`);
    const nmPath = path.join(backendRoot, 'node_modules');
    log(`node_modules path: ${nmPath}`);
    log(`node_modules exists: ${fs.existsSync(nmPath)}`);
    log(`express exists: ${fs.existsSync(path.join(nmPath, 'express'))}`);
    log(`cors exists: ${fs.existsSync(path.join(nmPath, 'cors'))}`);
    log(`better-sqlite3 exists: ${fs.existsSync(path.join(nmPath, 'better-sqlite3'))}`);
    const dataDir = path.join(app.getPath('userData'), 'backend_data');
    log(`DATA_DIR: ${dataDir}`);
    const spawnEnv = {
      ...process.env,
      PORT: '3000',
      DATA_DIR: dataDir,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_PATH: nmPath,
      NODE_ENV: app.isPackaged ? 'production' : 'development',
    };
    log(`Spawning: ${process.execPath} ${backendPath}`);
    log(`cwd: ${backendRoot}`);
    const backend = spawn(process.execPath, [backendPath], { env: spawnEnv, cwd: backendRoot, stdio: 'pipe' });
    log(`Backend PID: ${backend.pid}`);
    backend.stdout.on('data', (data) => { log(`[BACKEND STDOUT] ${data.toString().trim()}`); });
    backend.stderr.on('data', (data) => { log(`[BACKEND STDERR] ${data.toString().trim()}`); });
    backend.on('exit', (code, signal) => {
      log(`[BACKEND EXIT] code=${code} signal=${signal}`);
      if (code !== 0) { log('Backend crashed â€” check STDERR above'); }
    });
    backend.on('error', (err) => { log(`[BACKEND SPAWN ERROR] ${err.message}`); });
    backendProcess = backend;
  } catch (err) { console.error('[Backend] Exception during startup:', err.message); }
}

function stopBackend() {
  try { if (backendProcess && !backendProcess.killed) { backendProcess.kill('SIGTERM'); } } catch {}
}

async function isLocalLicenseValid() {
  try {
    const res = await fetch('http://localhost:3000/api/license/status', { method: 'GET' });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json && json.success === true) return { ok: true, license: json.license };
    return { ok: false, reason: json && (json.reason || json.error) };
  } catch { return { ok: false, reason: 'UNREACHABLE' }; }
}

let SOFTWARE_LOCKED = false;
let SOFTWARE_LOCK_REASON = null;

async function lockSoftware(reason){
  SOFTWARE_LOCKED = true;
  SOFTWARE_LOCK_REASON = reason || 'SUBSCRIPTION_EXPIRED';
  try { await dialog.showMessageBox({ type:'error', title:'Subscription Expired', message:'Your subscription has expired. Please renew to continue.' }); } catch {}
  try {
    const ok = await openRenewalWindow();
    if (!ok) { try { stopBackend(); } catch {} app.quit(); return false; }
  } catch { try { stopBackend(); } catch {} app.quit(); return false; }
  const after = await isLocalLicenseValid();
  if (after && after.ok) { SOFTWARE_LOCKED = false; SOFTWARE_LOCK_REASON = null; return true; }
  try { stopBackend(); } catch {}
  app.quit();
  return false;
}

async function ensureNotLocked(){
  if (!SOFTWARE_LOCKED) return true;
  const st = await isLocalLicenseValid();
  if (st && st.ok) { SOFTWARE_LOCKED = false; SOFTWARE_LOCK_REASON = null; return true; }
  throw new Error(SOFTWARE_LOCK_REASON || 'SUBSCRIPTION_EXPIRED');
}

function calcDaysRemainingFromIso(expiryIso){
  const ms = Date.parse(String(expiryIso || ''));
  if (!Number.isFinite(ms)) return null;
  return Math.ceil((ms - Date.now()) / (24*60*60*1000));
}

async function showSubscriptionWarningsIfNeeded(license){
  try {
    const days = (license && typeof license.daysRemaining === 'number')
      ? license.daysRemaining
      : calcDaysRemainingFromIso(license && license.expiry);
    if (typeof days !== 'number' || !Number.isFinite(days)) return;
    if (days <= 3){ await dialog.showMessageBox({ type:'warning', title:'Subscription Expiring', message:'Your subscription will expire in 3 days. Please renew.' }); return; }
    if (days <= 7){ await dialog.showMessageBox({ type:'warning', title:'Subscription Reminder', message:'Your subscription will expire in 7 days. Please renew.' }); }
  } catch {}
}

async function activateLocalLicense(licensePayload) {
  try {
    const res = await fetch('http://localhost:3000/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license: licensePayload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json && (json.error || json.details) };
    return { ok: json && json.success === true, error: json && json.error };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
}

async function promptAndActivateLocalLicense() {
  // Get machine ID to show on the activation screen
  let mid = '';
  try {
    const cfg = await readConfig();
    mid = getMachineIdCached(cfg);
  } catch {}

  return await new Promise((resolve) => {
    let modal;
    const cleanup = () => {
      try { ipcMain.removeHandler('localLicense:submit'); } catch {}
      try { ipcMain.removeHandler('localLicense:cancel'); } catch {}
      try { if (modal && !modal.isDestroyed()) modal.close(); } catch {}
    };
    ipcMain.handle('localLicense:submit', async (e, payload) => {
      await ensureNotLocked();
      const result = await activateLocalLicense(payload);
      if (result.ok) { cleanup(); resolve(true); return { ok: true }; }
      return { ok: false, error: result.error || 'ACTIVATION_FAILED' };
    });
    ipcMain.handle('localLicense:cancel', async () => { cleanup(); resolve(false); return { ok: true }; });
    modal = new BrowserWindow({
      width: 720, height: 680, resizable: true, minimizable: false, maximizable: false, modal: false, show: true,
      webPreferences: {
        contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !IS_PROD,
        preload: app.isPackaged
          ? path.join(process.resourcesPath, 'electron', 'licensePreload.js')
          : path.join(__dirname, 'licensePreload.js'),
      },
    });
    if (IS_PROD) { modal.webContents.on('devtools-opened', () => { modal.webContents.closeDevTools(); }); }
    modal.on('closed', () => { cleanup(); resolve(false); });
    const html = `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>License Activation</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:linear-gradient(135deg,#1f3a8a,#0f1e4d);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:16px;padding:32px;max-width:580px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.icon{width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#1f3a8a,#2d4fa0);display:grid;place-items:center;font-size:32px;margin:0 auto 16px}
h1{text-align:center;color:#1f3a8a;font-size:24px;margin-bottom:4px}
.sub{text-align:center;color:#d32f2f;font-size:14px;font-weight:600;margin-bottom:20px}
.mid-label{font-size:13px;font-weight:600;color:#1f3a8a;margin-bottom:6px;display:block}
.mid-box{background:#f8f9fa;border:2px solid rgba(31,58,138,0.2);border-radius:12px;padding:14px;font-family:monospace;font-size:13px;color:#1f3a8a;word-break:break-all;margin-bottom:8px;min-height:44px;display:flex;align-items:center}
.copy-btn{width:100%;padding:12px;border-radius:10px;background:#1f3a8a;color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:20px}
.copy-btn:hover{background:#2d4fa0}
.steps{background:rgba(31,58,138,0.05);border:1px solid rgba(31,58,138,0.15);border-radius:12px;padding:14px;margin-bottom:20px}
.steps p{font-size:13px;color:#1f3a8a;font-weight:600;margin-bottom:6px}
.steps ol{font-size:12px;color:rgba(31,58,138,0.7);padding-left:20px}
.steps li{margin-bottom:3px}
.key-label{font-size:13px;font-weight:600;color:#1f3a8a;margin-bottom:6px;display:block}
textarea{width:100%;min-height:100px;padding:12px;border-radius:10px;border:2px solid rgba(31,58,138,0.2);font-size:12px;font-family:monospace;outline:none;resize:vertical}
textarea:focus{border-color:#1f3a8a}
.row{display:flex;gap:10px;margin-top:14px}
button{flex:1;padding:14px;border-radius:10px;border:none;font-size:15px;font-weight:700;cursor:pointer}
.cancel{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}
.activate{background:linear-gradient(135deg,#2e7d32,#388e3c);color:#fff}
.error{margin-top:12px;color:#d32f2f;font-size:12px;min-height:16px;text-align:center}
.footer{text-align:center;font-size:11px;color:rgba(31,58,138,0.5);margin-top:16px}
</style></head><body>
<div class="card">
<div class="icon">ðŸ–¨ï¸</div>
<h1>PrintShop Billing</h1>
<div class="sub">Software Not Activated</div>

<label class="mid-label">Your Machine ID:</label>
<div class="mid-box"><span id="midText">${mid}</span></div>
<button class="copy-btn" id="copyBtn">Copy Machine ID</button>

<div class="steps">
<p>Next Steps:</p>
<ol>
<li>Copy the Machine ID above</li>
<li>Send it to your software provider via WhatsApp</li>
<li>Provider will give you a license key</li>
<li>Paste the license key below</li>
<li>Click "Activate" button</li>
</ol>
</div>

<label class="key-label">Paste License Key (JSON):</label>
<textarea id="key" placeholder='{"shopName":"...","machineId":"...","validTill":"...","planMonths":12,"signature":"..."}'></textarea>
<div class="row">
<button class="cancel" id="cancel">Cancel</button>
<button class="activate" id="activate">Activate Software</button>
</div>
<div class="error" id="err"></div>
<div class="footer">Contact: WhatsApp +92 300 1234567</div>
</div>
<script>
const keyEl=document.getElementById('key');
const errEl=document.getElementById('err');
const copyBtn=document.getElementById('copyBtn');
const midText=document.getElementById('midText');

copyBtn.addEventListener('click',async()=>{
  try{
    await navigator.clipboard.writeText(midText.textContent);
    copyBtn.textContent='Copied!';
    setTimeout(()=>{copyBtn.textContent='Copy Machine ID';},2000);
  }catch{}
});

document.getElementById('cancel').addEventListener('click',()=>window.license.cancel());

async function submit(){
  errEl.textContent='';
  const r=await window.license.submit(keyEl.value);
  if(!r||!r.ok){errEl.textContent=(r&&r.error)?String(r.error):'Activation failed';}
}
document.getElementById('activate').addEventListener('click',submit);
keyEl.addEventListener('keydown',(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit();}});
</script></body></html>`;
    modal.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  });
}

// â”€â”€â”€ CREATE WINDOW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createWindow() {
  const logPath = path.join(app.getPath('userData'), 'backend-debug.log');
  fs.appendFileSync(logPath, `[WINDOW CREATE] Starting window creation\n`);
  
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: !app.isPackaged,  // Only enable DevTools in development
      preload: app.isPackaged
        ? path.join(process.resourcesPath, 'electron', 'preload.js')
        : path.join(__dirname, 'preload.js'),
    },
  });

  fs.appendFileSync(logPath, `[WINDOW CREATE] Window created successfully\n`);

  // Open DevTools automatically only in development mode
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }

  // TEMP: Disabled auto-close for debugging
  // if (IS_PROD) {
  //   win.webContents.on('devtools-opened', () => { win.webContents.closeDevTools(); });
  // }

  win.webContents.on('did-finish-load', () => {
    fs.appendFileSync(logPath, `[LOAD SUCCESS] index.html loaded successfully\n`);
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    fs.appendFileSync(logPath, `[LOAD FAIL] code=${errorCode} desc=${errorDescription} url=${validatedURL}\n`);
  });

  win.webContents.on('console-message', (event, level, message) => {
    fs.appendFileSync(logPath, `[CONSOLE L${level}] ${message}\n`);
  });

  if (!app.isPackaged) {
    setTimeout(() => { win.loadURL('http://localhost:5173'); }, 5000);
  } else {
    const indexPath = path.join(process.resourcesPath, 'dist', 'index.html');
    fs.appendFileSync(logPath, `[LOAD ATTEMPT] ${indexPath} exists=${fs.existsSync(indexPath)}\n`);
    fs.appendFileSync(logPath, `[LOAD ATTEMPT] preload path: ${app.isPackaged ? path.join(process.resourcesPath, 'electron', 'preload.js') : path.join(__dirname, 'preload.js')}\n`);
    win.loadFile(indexPath);
  }
}

// â”€â”€â”€ IPC HANDLERS (outside createWindow) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// License IPC
ipcMain.handle('license:get', async () => {
  try {
    const st = await getLocalLicenseStatus();
    const expiry = st && st.license && st.license.expiry ? String(st.license.expiry) : null;
    return { key: '', valid: !!st.ok, expiresAt: expiry, shopId: null, reason: st.reason || null };
  } catch { return { key: '', valid: false, expiresAt: null, shopId: null, reason: 'UNREACHABLE' }; }
});
ipcMain.handle('license:set', async (e, key) => {
  await ensureNotLocked();
  const cfg = await readConfig();
  cfg.licenseKey = String(key || '');
  await writeConfig(cfg);
  const mid = getMachineIdCached(cfg);
  if (cfg.machineId !== mid){ cfg.machineId = mid; await writeConfig(cfg); }
  const res = await verifyLicense(cfg.licenseKey, mid);
  cfg.licenseValid = !!res.valid;
  cfg.expiresAt = res.expiresAt || null;
  await writeConfig(cfg);
  return { valid: cfg.licenseValid, expiresAt: cfg.expiresAt, reason: res.reason };
});
ipcMain.handle('license:check', async () => {
  try {
    const st = await getLocalLicenseStatus();
    const expiry = st && st.license && st.license.expiry ? String(st.license.expiry) : null;
    return { valid: !!st.ok, expiresAt: expiry, reason: st.reason || null };
  } catch { return { valid: false, expiresAt: null, reason: 'UNREACHABLE' }; }
});
ipcMain.handle('license:status', async () => {
  try { return await getLocalLicenseStatus(); } catch { return { ok: false, reason: 'UNREACHABLE' }; }
});

// Subscription IPC
ipcMain.handle('subscription:status', async () => {
  const cfg = await readConfig();
  const remainingDays = calcRemainingDays(cfg.expiresAt);
  return { valid: !!cfg.licenseValid, plan: cfg.plan || 'monthly', expiresAt: cfg.expiresAt || null, remainingDays, inGrace: isWithinGrace(cfg), lastOnlineStatusAt: cfg.lastOnlineStatusAt || null };
});
ipcMain.handle('subscription:checkNow', async () => {
  await ensureNotLocked();
  const cfg = await readConfig();
  return await checkOnlineSubscription(cfg);
});

// Credit Book IPC
ipcMain.handle('credit:add', async (e, entry) => { await ensureNotLocked(); return DB.addCreditEntry(entry); });
ipcMain.handle('credit:persons', async () => { await ensureNotLocked(); return DB.getCreditPersons(); });
ipcMain.handle('credit:ledger', async (e, person, from, to) => { await ensureNotLocked(); return DB.getCreditLedger(person, from, to); });

// Branding IPC
function getBrandingPaths(shopId){
  const root = path.join(getUserDataDir(), 'shops', shopId, 'branding');
  ensureDir(root);
  return {
    root,
    logo: path.join(root, 'logo.png'),
    templateHtml: path.join(root, 'invoice_template.html'),
    templateJson: path.join(root, 'invoice_template.json'),
    config: path.join(root, 'branding.json'),
  };
}
async function getActiveShopId(){ const cfg = await readConfig(); return cfg.shopId || getOrCreateShopId(cfg); }
ipcMain.handle('branding:get', async ()=>{
  await ensureNotLocked();
  const sid = await getActiveShopId();
  const p = getBrandingPaths(sid);
  const out = { shopId: sid, hasLogo: false, hasTemplateHtml: false, hasTemplateJson: false, config: {} };
  try { if (fs.existsSync(p.logo)) out.hasLogo = true; } catch {}
  try { if (fs.existsSync(p.templateHtml)) out.hasTemplateHtml = true; } catch {}
  try { if (fs.existsSync(p.templateJson)) out.hasTemplateJson = true; } catch {}
  try { if (fs.existsSync(p.config)) out.config = JSON.parse(fs.readFileSync(p.config,'utf-8')); } catch {}
  return out;
});
ipcMain.handle('branding:saveLogo', async (e, payload)=>{
  await ensureNotLocked();
  const sid = await getActiveShopId();
  const p = getBrandingPaths(sid);
  try {
    const dataUrl = String(payload||'');
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    fs.writeFileSync(p.logo, Buffer.from(base64, 'base64'));
    return { success:true };
  } catch (err) { return { error: String(err&&err.message||err) }; }
});
ipcMain.handle('branding:saveTemplate', async (e, payload)=>{
  await ensureNotLocked();
  const sid = await getActiveShopId();
  const p = getBrandingPaths(sid);
  try {
    if (payload && payload.type === 'html'){ fs.writeFileSync(p.templateHtml, String(payload.content||''), 'utf-8'); }
    else if (payload && payload.type === 'json'){ fs.writeFileSync(p.templateJson, JSON.stringify(payload.content||{}, null, 2), 'utf-8'); }
    return { success:true };
  } catch (err) { return { error: String(err&&err.message||err) }; }
});
ipcMain.handle('branding:saveConfig', async (e, cfgObj)=>{
  await ensureNotLocked();
  const sid = await getActiveShopId();
  const p = getBrandingPaths(sid);
  try { fs.writeFileSync(p.config, JSON.stringify(cfgObj||{}, null, 2), 'utf-8'); return { success:true }; }
  catch (err) { return { error: String(err&&err.message||err) }; }
});
ipcMain.handle('branding:getLogoBase64', async () => {
  try {
    const brandingDir = path.join(app.getPath('userData'), 'shops', DB.getShopId(), 'branding');
    const logoPath = path.join(brandingDir, 'logo.png');
    if (!require('fs').existsSync(logoPath)) return { ok: false };
    const data = require('fs').readFileSync(logoPath);
    const base64 = data.toString('base64');
    return { ok: true, base64: 'data:image/png;base64,' + base64 };
  } catch { return { ok: false }; }
});
ipcMain.handle('branding:getLogo', async ()=>{
  await ensureNotLocked();
  const sid = await getActiveShopId();
  const p = getBrandingPaths(sid);
  try { if (fs.existsSync(p.logo)) return { ok:true, path: p.logo }; } catch {}
  return { ok:false };
});
ipcMain.handle('branding:buildPreview', async (e, sampleData)=>{
  await ensureNotLocked();
  const sid = await getActiveShopId();
  const p = getBrandingPaths(sid);
  let html = '';
  try { if (fs.existsSync(p.templateHtml)) html = fs.readFileSync(p.templateHtml,'utf-8'); } catch {}
  if (!html){
    html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui;padding:24px}</style></head><body><div style="display:flex;align-items:center;gap:16px;"><img id="logo" style="height:60px" /><h1 style="margin:0">Invoice Preview</h1></div><div id="content"></div></body></html>`;
  }
  let logoDataUrl = '';
  try { if (fs.existsSync(p.logo)){ const b64 = fs.readFileSync(p.logo).toString('base64'); logoDataUrl = `data:image/png;base64,${b64}`; } } catch {}
  const injected = html.replace('id="logo"', `id="logo" src="${logoDataUrl}"`).replace('<div id="content"></div>', `<pre id="content" style="white-space:pre-wrap">${(sampleData?JSON.stringify(sampleData,null,2):'')}</pre>`);
  return { html: injected };
});

// Settings IPC
function getShopSettingsPaths(shopId){
  const root = path.join(getUserDataDir(), 'shops', shopId);
  ensureDir(root);
  return { root, settings: path.join(root, 'settings.json') };
}
function computeChangedKeys(oldObj, newObj){
  const keys = new Set([...Object.keys(oldObj||{}), ...Object.keys(newObj||{})]);
  const changed=[]; for (const k of keys){ if (JSON.stringify(oldObj?.[k]) !== JSON.stringify(newObj?.[k])) changed.push(k); }
  return changed;
}
ipcMain.handle('settings:get', async ()=>{
  await ensureNotLocked();
  const sid = await getActiveShopId();
  const p = getShopSettingsPaths(sid);
  try { if (fs.existsSync(p.settings)) return { shopId: sid, settings: JSON.parse(fs.readFileSync(p.settings,'utf-8')) }; } catch {}
  return { shopId: sid, settings: {} };
});
ipcMain.handle('settings:save', async (e, newSettings)=>{
  await ensureNotLocked();
  const sid = await getActiveShopId();
  const p = getShopSettingsPaths(sid);
  let prev={}; try { if (fs.existsSync(p.settings)) prev = JSON.parse(fs.readFileSync(p.settings,'utf-8')); } catch {}
  const changedKeys = computeChangedKeys(prev, newSettings||{});
  try { fs.writeFileSync(p.settings, JSON.stringify(newSettings||{}, null, 2), 'utf-8'); } catch (err) { return { error: String(err&&err.message||err) }; }
  const pathOk = p.settings.includes(path.join('shops', sid));
  return { success:true, shopId: sid, changedKeys, path: p.settings, pathOk };
});
ipcMain.handle('settings:verify', async (e, proposed)=>{
  await ensureNotLocked();
  const sid = await getActiveShopId();
  const p = getShopSettingsPaths(sid);
  let prev={}; try { if (fs.existsSync(p.settings)) prev = JSON.parse(fs.readFileSync(p.settings,'utf-8')); } catch {}
  const changedKeys = computeChangedKeys(prev, proposed||{});
  const pathOk = p.settings.includes(path.join('shops', sid));
  return { shopId: sid, changedKeys, path: p.settings, pathOk };
});

// Admin IPC
function getAdminConfigPath(){ const dir = path.join(getUserDataDir(), 'app_config'); ensureDir(dir); return path.join(dir, 'config.json'); }
function hasDevAccess(secret){ const expected = process.env.DEV_CONFIG_SECRET || ''; return secret && expected && secret === expected; }
ipcMain.handle('admin:setConfig', async (e, payload)=>{
  const { secret, config } = payload||{};
  if (!hasDevAccess(secret)) return { error: 'UNAUTHORIZED' };
  await ensureNotLocked();
  try { fs.writeFileSync(getAdminConfigPath(), JSON.stringify(config||{}, null, 2), 'utf-8'); return { success:true }; }
  catch (err) { return { error: String(err&&err.message||err) } }
});
ipcMain.handle('admin:getConfig', async (e, secret)=>{
  if (!hasDevAccess(secret)) return { error: 'UNAUTHORIZED' };
  try { if (fs.existsSync(getAdminConfigPath())) return { config: JSON.parse(fs.readFileSync(getAdminConfigPath(),'utf-8')) }; }
  catch (err) { return { error: String(err&&err.message||err) } }
  return { config: {} };
});

// Shop Profile IPC
ipcMain.handle('shopProfile:get', async ()=>{
  const p = readShopProfile();
  return p || { shopName:'', logoPath:'', invoiceTheme:'default', createdAt:'' };
});
ipcMain.handle('shopProfile:save', async (e, payload)=>{
  await ensureNotLocked();
  const name = payload && payload.shopName;
  if (!name || !String(name).trim()) return { error: 'Shop name is required.' };
  return saveShopProfile({ shopName: String(name).trim(), logoSourcePath: payload && payload.logoSourcePath });
});

// Machine ID IPC
ipcMain.handle('system:getMachineId', async () => {
  try {
    const cfg = await readConfig();
    // Add timeout to prevent hanging
    const idPromise = Promise.resolve(getMachineIdCached(cfg));
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
    const machineId = await Promise.race([idPromise, timeoutPromise]);
    // Cache it for next time
    if (cfg.machineId !== machineId) { cfg.machineId = machineId; await writeConfig(cfg); }
    return { success: true, machineId };
  } catch (err) { return { success: false, error: String(err && err.message || err) }; }
});

// Dashboard IPC
ipcMain.handle('dashboard:summary', async () => { await ensureNotLocked(); return DB.getDashboardSummary(); });

// Customers IPC
ipcMain.handle('customers:getAll', async () => { await ensureNotLocked(); return DB.getCustomers(); });
ipcMain.handle('customers:add', async (e, c) => { await ensureNotLocked(); return DB.addCustomer(c); });
ipcMain.handle('customers:update', async (e, c) => { await ensureNotLocked(); return DB.updateCustomer(c); });
ipcMain.handle('customers:remove', async (e, id) => { await ensureNotLocked(); return DB.removeCustomer(id); });

// Invoices IPC
ipcMain.handle('invoices:create', async (e, inv) => { await ensureNotLocked(); return DB.createInvoice(inv); });
ipcMain.handle('invoices:getAll', async () => { await ensureNotLocked(); return DB.getAllInvoices(); });
ipcMain.handle('invoices:update', async (e, id, payload) => { await ensureNotLocked(); return DB.updateInvoice(id, payload); });
ipcMain.handle('invoices:get', async (e, id) => { await ensureNotLocked(); return DB.getInvoiceById(id); });

// Expenses IPC
ipcMain.handle('expenses:add', async (e, exp) => { await ensureNotLocked(); return DB.addExpense(exp); });
ipcMain.handle('expenses:getAll', async (e, filter) => { await ensureNotLocked(); return DB.getExpenses(filter); });

// Payments IPC
ipcMain.handle('payments:add', async (e, p) => { await ensureNotLocked(); return DB.addPayment(p); });

// Ledger IPC
ipcMain.handle('ledger:get', async (e, customerId, startDate, endDate) => { await ensureNotLocked(); return DB.getLedger(customerId, startDate, endDate); });

// Quick Items IPC
ipcMain.handle('quick:getAll', async () => { await ensureNotLocked(); return DB.getQuickItems(); });
ipcMain.handle('quick:add', async (e, item) => { await ensureNotLocked(); return DB.addQuickItem(item); });
ipcMain.handle('quick:update', async (e, item) => { await ensureNotLocked(); return DB.updateQuickItem(item); });
ipcMain.handle('quick:remove', async (e, id) => { await ensureNotLocked(); return DB.removeQuickItem(id); });

// Products IPC (with cost price for P&L)
ipcMain.handle('products:getAll', async () => { await ensureNotLocked(); return DB.getProducts(); });
ipcMain.handle('products:add', async (e, product) => { await ensureNotLocked(); return DB.addProduct(product); });
ipcMain.handle('products:update', async (e, product) => { await ensureNotLocked(); return DB.updateProduct(product); });
ipcMain.handle('products:remove', async (e, id) => { await ensureNotLocked(); return DB.removeProduct(id); });

// Data Export/Import IPC (for PC migration)
ipcMain.handle('shop:export', async () => {
  await ensureNotLocked();
  const exportData = DB.exportShopData();
  return { success: true, data: exportData };
});

ipcMain.handle('shop:import', async (e, importData) => {
  await ensureNotLocked();
  const result = await DB.importShopData(importData);
  return result;
});

// PDF IPC
ipcMain.handle('pdf:save', async (e, payload) => {
  await ensureNotLocked();
  const html = payload?.html || '';
  const filename = payload?.filename || 'invoice.pdf';
  if (!html) return { error: 'NO_HTML' };
  
  let bw = null;
  try {
    bw = new BrowserWindow({ 
      show: false, 
      backgroundColor: '#0f1e44', 
      webPreferences: { 
        contextIsolation: true, 
        nodeIntegration: false, 
        sandbox: true, 
        devTools: !IS_PROD 
      } 
    });
    
    if (IS_PROD) { 
      bw.webContents.on('devtools-opened', () => { bw.webContents.closeDevTools(); }); 
    }
    
    let finalHtml = html;
    if (payload && payload.branding === true){
      try {
        const cfg = await readConfig();
        const sid = cfg.shopId || getOrCreateShopId(cfg);
        const bPaths = (()=>{ const root = path.join(getUserDataDir(), 'shops', sid, 'branding'); ensureDir(root); return { logo: path.join(root, 'logo.png'), templateHtml: path.join(root, 'invoice_template.html') }; })();
        if (fs.existsSync(bPaths.templateHtml)){ finalHtml = fs.readFileSync(bPaths.templateHtml, 'utf-8'); }
        if (fs.existsSync(bPaths.logo)){
          const dataUrl = `data:image/png;base64,${fs.readFileSync(bPaths.logo).toString('base64')}`;
          if (finalHtml.includes('id="logo"')){ finalHtml = finalHtml.replace('id="logo"', `id="logo" src="${dataUrl}"`); }
          else { finalHtml = finalHtml.replace('<body', `<body><img src="${dataUrl}" style="height:60px" />`); }
        }
      } catch (brandingErr) {
        console.error('[PDF] Branding error:', brandingErr);
      }
    }
    
    const tmpFile = path.join(require('os').tmpdir(), `invoice-${Date.now()}.html`);
fs.writeFileSync(tmpFile, finalHtml, 'utf-8');
await bw.loadFile(tmpFile);
    try { 
      await bw.webContents.executeJavaScript(`new Promise(resolve => { 
        const done = () => setTimeout(resolve, 200); 
        if (document.fonts && document.fonts.ready) { 
          document.fonts.ready.then(done).catch(done); 
        } else { 
          done(); 
        } 
      });`, true); 
    } catch (jsErr) {
      console.error('[PDF] JS execution error:', jsErr);
    }
    
    await new Promise(r=>setTimeout(r, 800));
    const pdf = await bw.webContents.printToPDF({ 
      printBackground: true, 
      marginsType: 0, 
      preferCSSPageSize: true, 
      landscape: false 
    });
    
    const { filePath, canceled } = await dialog.showSaveDialog({ 
      defaultPath: filename, 
      filters: [{ name: 'PDF', extensions: ['pdf'] }] 
    });
    
    if (canceled || !filePath) {
      return { canceled: true };
    }
    
    fs.writeFileSync(filePath, pdf);
    return { filePath };
    
  } catch (err) { 
    console.error('[PDF] Generation error:', err);
    return { error: String(err && err.message || err) }; 
  } finally { 
    // Destroy the hidden window safely
    if (bw && !bw.isDestroyed()) {
      try {
        bw.destroy();
      } catch (destroyErr) {
        console.error('[PDF] Window destroy error:', destroyErr);
      }
    }
  }
});

// Store Clear IPC
ipcMain.handle('store:clear', async () => {
  try {
    await ensureNotLocked();
    const file = DB.getStorePath();
    const empty = { customers: [], invoices: [], invoice_items: [], expenses: [], payments: [], quick_items: [], credit_entries: [] };
    const k = await ensureKey();
    fs.writeFileSync(file, enc(empty, k), 'utf-8');
    const cfg = await readConfig();
    const sid = cfg.shopId || getOrCreateShopId(cfg);
    await DB.init(app, sid);
    return { success: true };
  } catch (err) { return { error: String(err && err.message || err) }; }
});

// â”€â”€â”€ APP LIFECYCLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.whenReady().then(async () => {
  console.log("=== Electron App Starting ===");
  console.log("App packaged:", app.isPackaged);
  console.log("Resources path:", process.resourcesPath);

  try {
    const logPath = path.join(app.getPath('userData'), 'backend-debug.log');
    const debugInfo = `=== APP START: ${new Date().toISOString()} ===\nPackaged: ${app.isPackaged}\nresourcesPath: ${process.resourcesPath}\nexecPath: ${process.execPath}\n`;
    fs.writeFileSync(logPath, debugInfo, 'utf-8');
  } catch (e) { console.log('Failed to write debug file:', e); }

  console.log("Starting backend...");
  startBackend();

  console.log("Waiting for backend health check...");
  const backendReady = await waitForBackend({ url: 'http://localhost:3000/health', timeoutMs: 30000, intervalMs: 500 });

  console.log("Backend ready result:", backendReady);
  if (!backendReady) {
    try { await dialog.showMessageBox({ type:'error', title:'Backend Startup Failed', message:'Backend server did not start in time. Please restart the application.' }); } catch {}
    try { stopBackend(); } catch {}
    await new Promise(resolve => setTimeout(resolve, 10000));
    app.quit();
    return;
  }

  const localValid = await isLocalLicenseValid();
  if (!localValid.ok) {
    if (localValid.reason === 'SUBSCRIPTION_EXPIRED') {
      const unlocked = await lockSoftware(localValid.reason);
      if (!unlocked) return;
    } else if (localValid.reason === 'LICENSE_CORRUPTED') {
      try { await dialog.showMessageBox({ type:'error', title:'License Error', message:'License file corrupted or invalid.' }); } catch {}
      try { stopBackend(); } catch {}
      app.quit(); return;
    } else if (localValid.reason === 'DATE_TAMPER_DETECTED') {
      try { await dialog.showMessageBox({ type:'error', title:'System Date Error', message:'System date appears to have been changed backwards. Please correct your system date to continue.' }); } catch {}
      try { stopBackend(); } catch {}
      app.quit(); return;
    } else if (localValid.reason && localValid.reason !== 'LICENSE_NOT_FOUND') {
      try { await dialog.showMessageBox({ type:'error', title:'License Invalid', message:'License is not valid for this computer.' }); } catch {}
      try { stopBackend(); } catch {}
      app.quit(); return;
    } else if (localValid.reason === 'LICENSE_NOT_FOUND') {
      const activated = await promptAndActivateLocalLicense();
      if (!activated) {
        try { await dialog.showMessageBox({ type:'error', title:'License Required', message:'A valid license is required to start the application.' }); } catch {}
        try { stopBackend(); } catch {}
        app.quit(); return;
      }
      const afterActivation = await isLocalLicenseValid();
      if (!afterActivation.ok) { const unlocked = await lockSoftware(afterActivation.reason); if (!unlocked) return; }
      try { await showSubscriptionWarningsIfNeeded(afterActivation.license); } catch {}
    }
  } else {
    try { await showSubscriptionWarningsIfNeeded(localValid.license); } catch {}
  }

  const cfg = await readConfig();
  const machineId = getMachineIdCached(cfg);
  const shopId = getOrCreateShopId(cfg);
  if (cfg.machineId !== machineId){ cfg.machineId = machineId; }
  if (cfg.shopId !== shopId){ cfg.shopId = shopId; }
  await writeConfig(cfg);

  try {
    let prof = readShopProfile();
    if (!prof || !prof.shopName) {
      await showSetupShopWindow();
      prof = readShopProfile();
      if (!prof || !prof.shopName) {
        try { stopBackend(); } catch {}
        app.quit(); return;
      }
    }
  } catch {}

  await DB.init(app, shopId);

  const postInitStatus = await isLocalLicenseValid();
  if (!postInitStatus.ok) {
    const unlocked = await lockSoftware(postInitStatus.reason);
    if (!unlocked) return;
  }

  createWindow();

  try {
    const shopsRoot = path.join(getUserDataDir(), 'shops');
    const curShopDir = path.join(shopsRoot, shopId);
    console.log('[shop]', { shopsRoot, curShopDir });
  } catch {}

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  if (!DISABLE_BACKUP_REMINDER) { await maybeShowBackupReminder(); }

  try {
    if (app.isPackaged && autoUpdater){
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on('error', ()=>{});
      autoUpdater.on('update-available', async ()=>{
        try {
          const res = await dialog.showMessageBox(win, { type:'info', title:'Update Available', message:'New update available. Download now?', buttons:['Yes','Later'], defaultId:0, cancelId:1 });
          if (res.response === 0){ autoUpdater.downloadUpdate(); }
        } catch {}
      });
      autoUpdater.on('update-downloaded', async ()=>{
        try {
          const res = await dialog.showMessageBox(win, { type:'info', title:'Update Ready', message:'Update downloaded. Install and restart now?', buttons:['Install & Restart','Later'], defaultId:0, cancelId:1 });
          if (res.response === 0){ setImmediate(()=> autoUpdater.quitAndInstall()); }
        } catch {}
      });
      try { await autoUpdater.checkForUpdates(); } catch {}
    }
  } catch {}
});

app.on('window-all-closed', () => {
  // Don't quit when only the main window is closed on macOS
  // Also prevent quitting when hidden utility windows (like PDF generation) are destroyed
  // Use setTimeout to allow window destruction to complete before checking
  setTimeout(() => {
    const allWindows = BrowserWindow.getAllWindows();
    const visibleWindows = allWindows.filter(w => !w.isDestroyed() && w.isVisible());
    
    // Only quit if no visible windows remain (main window was closed)
    if (process.platform !== 'darwin' && visibleWindows.length === 0) {
      app.quit();
    }
  }, 100);
});

app.on('before-quit', () => {
  stopBackend();
});



