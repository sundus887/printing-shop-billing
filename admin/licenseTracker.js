#!/usr/bin/env node
/**
 * License Tracker - Automatically records every license generated
 * Saves to: admin/license-records.json
 */

const fs = require('fs');
const path = require('path');

const RECORDS_FILE = path.join(__dirname, 'license-records.json');

function loadRecords() {
  try {
    if (fs.existsSync(RECORDS_FILE)) {
      return JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
    }
  } catch {}
  return { licenses: [] };
}

function saveRecords(records) {
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

function addLicenseRecord({ shopName, machineId, validTill, planMonths, mode }) {
  const records = loadRecords();
  
  const record = {
    shopName: shopName || 'Unknown',
    machineId: machineId || '',
    licenseKey: '',  // Will be set by caller
    validFrom: new Date().toISOString().slice(0, 10),
    validTill: validTill ? validTill.slice(0, 10) : '',
    planMonths: planMonths || 12,
    mode: mode || 'new',
    amount: 0,       // User can update later
    phone: '',       // User can update later
    notes: '',
    status: 'active', // active, expired, renewed
    createdAt: new Date().toISOString(),
  };

  records.licenses.push(record);
  saveRecords(records);
  
  return record;
}

function listLicenses() {
  const records = loadRecords();
  if (records.licenses.length === 0) {
    console.log('\n📋 No licenses recorded yet.\n');
    return;
  }

  const today = new Date();
  
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('  📋 LICENSE RECORDS (' + records.licenses.length + ' total)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Sort by date (newest first)
  const sorted = [...records.licenses].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  sorted.forEach((lic, idx) => {
    const expiryDate = new Date(lic.validTill);
    const daysLeft = Math.ceil((expiryDate - today) / (24 * 60 * 60 * 1000));
    
    let statusIcon = '✅';
    let statusText = 'Active';
    if (daysLeft <= 0) {
      statusIcon = '❌';
      statusText = 'EXPIRED';
    } else if (daysLeft <= 30) {
      statusIcon = '⚠️';
      statusText = `Expiring in ${daysLeft} days`;
    } else {
      statusText = `${daysLeft} days left`;
    }

    console.log(`  ${idx + 1}. ${lic.shopName}`);
    console.log(`     Machine ID:  ${lic.machineId.substring(0, 20)}...`);
    console.log(`     Valid:       ${lic.validFrom} → ${lic.validTill}`);
    console.log(`     Duration:    ${lic.planMonths} months`);
    console.log(`     Status:      ${statusIcon} ${statusText}`);
    if (lic.phone) console.log(`     Phone:       ${lic.phone}`);
    if (lic.amount) console.log(`     Amount:      PKR ${Number(lic.amount).toLocaleString()}`);
    if (lic.notes) console.log(`     Notes:       ${lic.notes}`);
    console.log('');
  });

  // Summary
  const active = records.licenses.filter(l => new Date(l.validTill) > today).length;
  const expiring30 = records.licenses.filter(l => {
    const days = Math.ceil((new Date(l.validTill) - today) / (24*60*60*1000));
    return days > 0 && days <= 30;
  }).length;
  const expired = records.licenses.filter(l => new Date(l.validTill) <= today).length;

  console.log('─────────────────────────────────────────────────────────────────────');
  console.log(`  ✅ Active: ${active}  |  ⚠️ Expiring Soon: ${expiring30}  |  ❌ Expired: ${expired}`);
  console.log('─────────────────────────────────────────────────────────────────────\n');
}

function showExpiring() {
  const records = loadRecords();
  const today = new Date();
  
  const expiring = records.licenses.filter(l => {
    const days = Math.ceil((new Date(l.validTill) - today) / (24*60*60*1000));
    return days > 0 && days <= 30;
  });

  if (expiring.length === 0) {
    console.log('\n✅ No licenses expiring in next 30 days!\n');
    return;
  }

  console.log('\n⚠️  LICENSES EXPIRING IN NEXT 30 DAYS:\n');
  expiring.forEach(l => {
    const days = Math.ceil((new Date(l.validTill) - today) / (24*60*60*1000));
    console.log(`  ${l.shopName} → Expires: ${l.validTill} (${days} days left)`);
    if (l.phone) console.log(`    Phone: ${l.phone}`);
  });
  console.log('');
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0] || 'list';

switch (command) {
  case 'list':
    listLicenses();
    break;
  case 'expiring':
    showExpiring();
    break;
  case 'add':
    // Called from licenseGenerator.js
    const data = JSON.parse(args[1] || '{}');
    const record = addLicenseRecord(data);
    console.log(`\n📝 License recorded for: ${record.shopName}`);
    console.log(`   Valid till: ${record.validTill}\n`);
    break;
  default:
    console.log(`
Usage:
  node licenseTracker.js list       - Show all licenses
  node licenseTracker.js expiring   - Show licenses expiring soon
  node licenseTracker.js add '{json}' - Add a record manually
`);
}

module.exports = { addLicenseRecord, loadRecords, saveRecords };
