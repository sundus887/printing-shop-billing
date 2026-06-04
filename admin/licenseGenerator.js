#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

function ask(q){
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve)=> rl.question(q, (ans)=>{ rl.close(); resolve(String(ans||'').trim()); }));
}

function mustEnv(name){
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return String(v);
}

function optEnv(name){
  const v = process.env[name];
  return v ? String(v) : '';
}

function addMonthsIso(months){
  const m = Number(months||0);
  if (!Number.isFinite(m) || m <= 0) throw new Error('durationMonths must be a positive number');
  const d = new Date();
  const out = new Date(d.getTime());
  out.setMonth(out.getMonth() + m);
  out.setHours(23,59,59,999);
  return out.toISOString();
}

function addMonthsToIso(baseIso, months){
  const m = Number(months||0);
  if (!Number.isFinite(m) || m <= 0) throw new Error('durationMonths must be a positive number');
  const base = new Date(String(baseIso||''));
  if (!Number.isFinite(base.getTime())) throw new Error('oldValidTill must be a valid ISO date');
  const out = new Date(base.getTime());
  out.setMonth(out.getMonth() + m);
  out.setHours(23,59,59,999);
  return out.toISOString();
}

function canonicalPayload(payload){
  return {
    shopName: String(payload.shopName || '').trim(),
    machineId: String(payload.machineId || '').trim(),
    validTill: String(payload.validTill || '').trim(),
    planMonths: Number(payload.planMonths || 0) || 0,
  };
}

function loadPrivateKey(){
  const inline = optEnv('LICENSE_PRIVATE_KEY');
  if (inline) return inline;
  const p = optEnv('LICENSE_PRIVATE_KEY_PATH');
  if (p) return fs.readFileSync(p, 'utf-8');
  throw new Error('Missing private key. Set LICENSE_PRIVATE_KEY or LICENSE_PRIVATE_KEY_PATH');
}

function rsaSignLicensePayload(payload, privateKeyPem){
  const msg = JSON.stringify(canonicalPayload(payload));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(msg, 'utf-8'), {
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  });
  return sig.toString('base64');
}

function generateRsaKeyPair(){
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

function getEncKey(encSecret){
  return crypto.createHash('sha256').update(encSecret, 'utf-8').digest();
}

function encryptJsonAes256Cbc(obj, encSecret){
  const iv = crypto.randomBytes(16);
  const key = getEncKey(encSecret);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf-8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { v: 1, iv: iv.toString('base64'), data: encrypted.toString('base64') };
}

async function main(){
  const args = process.argv.slice(2);
  if (args.includes('--gen-keys')) {
    const outDir = path.join(process.cwd(), 'output');
    fs.mkdirSync(outDir, { recursive: true });
    const { publicKey, privateKey } = generateRsaKeyPair();
    const pubPath = path.join(outDir, 'license_public.pem');
    const privPath = path.join(outDir, 'license_private.pem');
    fs.writeFileSync(pubPath, publicKey, 'utf-8');
    fs.writeFileSync(privPath, privateKey, 'utf-8');
    process.stdout.write(`\nGenerated RSA keys:\n- Public:  ${pubPath}\n- Private: ${privPath}\n`);
    process.stdout.write('\nIMPORTANT: Keep the private key secret. Do NOT include it in the client app.\n');
    return;
  }

  const modeIn = (await ask('Mode (new/renew): ')).toLowerCase();
  const mode = (modeIn === 'renew') ? 'renew' : 'new';

  const shopName = await ask('Shop Name: ');
  const machineId = await ask('Machine ID: ');
  const durationMonthsStr = await ask('Duration Months: ');

  if (!shopName) throw new Error('shopName is required');
  if (!machineId) throw new Error('machineId is required');

  const durationMonths = Number(durationMonthsStr);
  let validTill;
  if (mode === 'renew') {
    const oldValidTill = await ask('Old validTill (ISO): ');
    validTill = addMonthsToIso(oldValidTill, durationMonths);
  } else {
    validTill = addMonthsIso(durationMonths);
  }

  const LICENSE_ENC_SECRET = mustEnv('LICENSE_ENC_SECRET');
  const PRIVATE_KEY_PEM = loadPrivateKey();

  const payload = { shopName, machineId, validTill, planMonths: durationMonths };
  const signature = rsaSignLicensePayload(payload, PRIVATE_KEY_PEM);
  const license = { ...payload, signature };

  const encObj = encryptJsonAes256Cbc({
    type: 'subscription',
    shopName: license.shopName,
    machineId: license.machineId,
    validTill: license.validTill,
    planMonths: license.planMonths,
    activatedAt: new Date().toISOString(),
    signature: license.signature,
  }, LICENSE_ENC_SECRET);

  const outDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `license-${machineId}.enc`);
  fs.writeFileSync(outFile, JSON.stringify(encObj, null, 2), 'utf-8');

  const base64 = Buffer.from(JSON.stringify(license), 'utf-8').toString('base64');

  // Auto-save license record to tracker
  try {
    const { addLicenseRecord } = require('./licenseTracker');
    addLicenseRecord({ shopName, machineId, validTill, planMonths: durationMonths, mode });
  } catch (e) {
    process.stderr.write(`Warning: Could not save license record: ${e.message}\n`);
  }

  process.stdout.write(`\nGenerated license (${mode}) (paste into app activation / renewal):\n`);
  process.stdout.write(JSON.stringify(license, null, 2) + '\n');
  process.stdout.write(`\nBase64 (same JSON):\n${base64}\n`);
  process.stdout.write(`\nEncrypted license file written:\n${outFile}\n`);
}

main().catch((e)=>{
  process.stderr.write(String(e && e.message || e) + '\n');
  process.exit(1);
});
