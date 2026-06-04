const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

const clean = (s) => String(s || '').replace(/\u0000/g, '').replace(/\r?\n/g, ' ').trim();

const wmicValue = (args) => {
  try {
    const out = execSync('wmic ' + args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf-8');
    const lines = out.split(/\r?\n/).map(l => clean(l)).filter(Boolean);
    if (lines.length <= 1) return '';
    return clean(lines[1]);
  } catch { return ''; }
};

const winMachineGuid = () => {
  try {
    const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf-8');
    const m = out.match(/MachineGuid\s+REG_\w+\s+([A-Fa-f0-9-]+)/);
    return clean(m && m[1]);
  } catch { return ''; }
};

const mbSerial = wmicValue('baseboard get SerialNumber');
const cpuId = wmicValue('cpu get ProcessorId');
const osId = winMachineGuid();
const hostname = os.hostname();
const cpuModel = os.cpus()?.[0]?.model || '';

const raw = ['win32', 'x64', mbSerial || 'NO_MB_SERIAL', cpuId || 'NO_CPU_ID', osId || 'NO_OS_ID', hostname, cpuModel].join('|');
const machineId = crypto.createHash('sha256').update(raw, 'utf-8').digest('hex');

console.log('Machine ID:', machineId);