const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
let keytar; try { keytar = require('keytar'); } catch {}
let machine; try { machine = require('node-machine-id'); } catch {}

// Simple JSON-backed store to avoid native modules.
// File format: { customers:[], invoices:[], invoice_items:[], expenses:[], payments:[] }

let storePath;
let currentShopId;
let data;

function getSaltFile(dir){ return path.join(dir, '.salt'); }
function deriveKeys(dir){
  try {
    const devSecret = process.env.DEV_KDF_SECRET || process.env.LICENSE_HMAC_SECRET || '';
    let mid = '';
    try { if (machine && typeof machine.machineIdSync==='function') mid = machine.machineIdSync(true); } catch {}
    if (!mid) mid = 'NO-MACHINE';
    const saltPath = getSaltFile(dir);
    let salt;
    if (fs.existsSync(saltPath)) salt = Buffer.from(fs.readFileSync(saltPath).toString(), 'base64');
    else { salt = crypto.randomBytes(16); try { fs.writeFileSync(saltPath, salt.toString('base64'), 'utf-8'); } catch {} }
    const ikm = Buffer.from(String(mid) + ':' + String(devSecret), 'utf-8');
    const out = crypto.pbkdf2Sync(ikm, salt, 150000, 64, 'sha256');
    const encKey = out.subarray(0,32);
    const hmacKey = out.subarray(32,64);
    return { encKey, hmacKey };
  } catch {
    const encKey = crypto.randomBytes(32);
    const hmacKey = crypto.randomBytes(32);
    return { encKey, hmacKey };
  }
}
function ensureKey(dir){
  try { return Promise.resolve(deriveKeys(dir)); } catch { return Promise.resolve(deriveKeys(dir)); }
}
function encryptJSON(obj, keys){
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keys.encKey, iv);
  const pt = Buffer.from(JSON.stringify(obj), 'utf-8');
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  const body = Buffer.concat([iv, ct, tag]);
  const mac = crypto.createHmac('sha256', keys.hmacKey).update(body).digest('base64');
  return JSON.stringify({ v:2, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: tag.toString('base64'), hmac: mac });
}
function decryptJSON(str, keys){
  const o = JSON.parse(str);
  if (o && (o.v===1 || o.v===2) && o.iv && o.ct && o.tag){
    const iv = Buffer.from(o.iv, 'base64');
    const ct = Buffer.from(o.ct, 'base64');
    const tag = Buffer.from(o.tag, 'base64');
    if (o.v===2){
      const body = Buffer.concat([iv, ct, tag]);
      const mac = crypto.createHmac('sha256', keys.hmacKey).update(body).digest('base64');
      if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(String(o.hmac||'')))) throw new Error('HMAC_FAIL');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', keys.encKey, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(pt.toString('utf-8'));
  }
  return JSON.parse(str);
}
function saveEncrypted(keys){ 
  try {
    // Create backup before saving
    if (fs.existsSync(storePath)) {
      const backupPath = storePath + '.backup';
      fs.copyFileSync(storePath, backupPath);
    }
    fs.writeFileSync(storePath, encryptJSON(data, keys), 'utf-8'); 
  } catch (err) {
    console.error('[DB] Save error:', err);
    throw err;
  }
}
function save(){
  return ensureKey(path.dirname(storePath)).then(keys=>{ saveEncrypted(keys); return { success:true }; });
}
function nextId(arr){ return arr.length ? Math.max(...arr.map(x=>x.id||0)) + 1 : 1; }

module.exports = {
  init(app, shopId){
    currentShopId = shopId || 'default';
    const base = path.join(app.getPath('userData'), 'shops', currentShopId);
    console.log('[DB] Initializing shop:', currentShopId, 'at path:', base);
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
    try { if (process.platform !== 'win32') fs.chmodSync(base, 0o700); } catch {}
    if (process.platform === 'win32'){
      try { execFileSync('attrib', ['+h', '+s', base]); } catch {}
      try {
        execFileSync('icacls', [base, '/inheritance:r']);
        execFileSync('icacls', [base, '/grant', 'Administrators:(F)']);
        const user = process.env.USERNAME; if (user) execFileSync('icacls', [base, '/grant', `${user}:(F)`]);
      } catch {}
    }

    storePath = path.join(base, 'data.db');

    try {
      const oldDir = path.join(app.getPath('userData'), 'printing-billing');
      const oldFile = path.join(oldDir, 'data.json');
      const legacyWin = (process.platform==='win32') ? path.join((process.env.PROGRAMDATA || path.join(process.env.SYSTEMDRIVE||'C:', 'ProgramData')), 'PrintShopBilling', 'sysdata', 'app.db') : null;
      if (!fs.existsSync(storePath) && fs.existsSync(oldFile)){
        try { fs.renameSync(oldFile, storePath); }
        catch {
          try { fs.copyFileSync(oldFile, storePath); } catch {}
        }
      }
      if (!fs.existsSync(storePath) && legacyWin && fs.existsSync(legacyWin)){
        try { fs.renameSync(legacyWin, storePath); }
        catch { try { fs.copyFileSync(legacyWin, storePath); } catch {} }
      }
    } catch {}

    if (!fs.existsSync(storePath)){
      console.log('[DB] No data file found, creating new empty database at:', storePath);
      data = { customers: [], invoices: [], invoice_items: [], expenses: [], payments: [], quick_items: [], credit_entries: [], products: [] };
      return ensureKey(path.dirname(storePath)).then(keys=>{ saveEncrypted(keys); });
    } else {
      console.log('[DB] Loading existing data from:', storePath, 'size:', fs.statSync(storePath).size, 'bytes');
      const raw = fs.readFileSync(storePath, 'utf-8');
      return ensureKey(path.dirname(storePath)).then(keys=>{
        try { 
          data = decryptJSON(raw, keys);
          console.log('[DB] Data loaded successfully. Customers:', (data.customers||[]).length, 'Invoices:', (data.invoices||[]).length);
        } catch (decryptErr) { 
          console.error('[DB] Decryption failed, trying backup...', decryptErr);
          // Try to restore from backup
          const backupPath = storePath + '.backup';
          if (fs.existsSync(backupPath)) {
            try {
              const backupRaw = fs.readFileSync(backupPath, 'utf-8');
              data = decryptJSON(backupRaw, keys);
              console.log('[DB] Restored from backup successfully');
              // Save restored data back to main file
              saveEncrypted(keys);
            } catch (backupErr) {
              console.error('[DB] Backup also corrupted:', backupErr);
              data = { customers: [], invoices: [], invoice_items: [], expenses: [], payments: [], quick_items: [], credit_entries: [], products: [] };
            }
          } else {
            console.error('[DB] No backup available');
            try { 
              data = JSON.parse(raw); 
            } catch { 
              data = { customers: [], invoices: [], invoice_items: [], expenses: [], payments: [], quick_items: [], credit_entries: [], products: [] }; 
            }
          }
        }
        let migrated = false;
        if (!Array.isArray(data.customers)) { data.customers = []; migrated = true; }
        if (!Array.isArray(data.invoices)) { data.invoices = []; migrated = true; }
        if (!Array.isArray(data.expenses)) { data.expenses = []; migrated = true; }
        if (!Array.isArray(data.payments)) { data.payments = []; migrated = true; }
        if (!Array.isArray(data.invoice_items)) { data.invoice_items = []; migrated = true; }
        if (!Array.isArray(data.quick_items)) { data.quick_items = []; migrated = true; }
        if (!Array.isArray(data.credit_entries)) { data.credit_entries = []; migrated = true; }
        if (!Array.isArray(data.products)) { data.products = []; migrated = true; }
        if (Array.isArray(data.customers)){
          const before = data.customers.length;
          const dummyNames = new Set(['Walk-in Customer','Individual Customer','Business Customer']);
          data.customers = data.customers.filter(c=> !dummyNames.has((c.name||'').trim()));
          if (data.customers.length !== before) migrated = true;
          for (const c of data.customers){
            if (!('category' in c) || !c.category){
              const n = (c.name||'').toLowerCase();
              if (n.includes('walk')) c.category = 'Walk-in';
              else if (n.includes('ltd') || n.includes('company') || n.includes('co ')) c.category = 'Business';
              else c.category = 'Individual';
              migrated = true;
            }
          }
        }
        if (migrated) saveEncrypted(keys);
      });
    }
  },
  getStorePath(){ return storePath; },
  getStoreDir(){ return path.dirname(storePath); },
  getShopId(){ return currentShopId; },

  // Credit Book (Udhar)
  addCreditEntry(entry){
    if (!Array.isArray(data.credit_entries)) data.credit_entries = [];
    const id = nextId(data.credit_entries);
    const row = {
      id,
      person: String(entry.person||'').trim(),
      type: (entry.type === 'repay') ? 'repay' : 'borrow',
      amount: Number(entry.amount)||0,
      date: entry.date || new Date().toISOString().slice(0,10),
      note: entry.note || ''
    };
    return ensureKey(path.dirname(storePath)).then(keys=>{ data.credit_entries.push(row); saveEncrypted(keys); return { id }; });
  },
  getCreditPersons(){
    const map = new Map();
    for(const e of (data.credit_entries||[])){
      const key = (e.person||'').trim();
      if (!key) continue;
      const cur = map.get(key) || { name:key, borrowed:0, repaid:0 };
      if (e.type==='borrow') cur.borrowed += Number(e.amount)||0; else cur.repaid += Number(e.amount)||0;
      map.set(key, cur);
    }
    return Array.from(map.values()).map(r=> ({...r, balance: (r.borrowed||0) - (r.repaid||0)})).sort((a,b)=>a.name.localeCompare(b.name));
  },
  getCreditLedger(person, from, to){
    const name = String(person||'').trim();
    let rows = (data.credit_entries||[]).filter(e=> (e.person||'').trim()===name);
    if (from) rows = rows.filter(e=> e.date>=from);
    if (to) rows = rows.filter(e=> e.date<=to);
    rows = rows.sort((a,b)=> a.date.localeCompare(b.date));
    let balance = 0; const out = [];
    for(const r of rows){
      if (r.type==='borrow') balance += Number(r.amount)||0; else balance -= Number(r.amount)||0;
      out.push({ date:r.date, type:r.type, note:r.note||'', borrow: r.type==='borrow'?r.amount:0, repay: r.type==='repay'?r.amount:0, balance });
    }
    const borrowed = rows.filter(r=>r.type==='borrow').reduce((s,r)=>s+(Number(r.amount)||0),0);
    const repaid = rows.filter(r=>r.type==='repay').reduce((s,r)=>s+(Number(r.amount)||0),0);
    return { rows: out, borrowed, repaid, balance: borrowed-repaid };
  },

  

  // Customers
  getCustomers(){
    return [...data.customers].sort((a,b)=> a.name.localeCompare(b.name));
  },
  addCustomer(c){
    const id = nextId(data.customers);
    const row = { 
      id, 
      name: c.name, 
      phone: c.phone || '', 
      email: c.email || '', 
      address: c.address || '', 
      notes: c.notes || '', 
      created_at: new Date().toISOString().slice(0,10), 
      category: c.category || '',
      previous_balance: Number(c.previous_balance) || 0,
    };
    return ensureKey(path.dirname(storePath)).then(keys=>{ data.customers.push(row); saveEncrypted(keys); return { id }; });
  },
  updateCustomer(c){
    const idx = data.customers.findIndex(x=>x.id===c.id);
    if (idx>=0){ data.customers[idx] = { ...data.customers[idx], ...c }; }
    return ensureKey(path.dirname(storePath)).then(keys=>{ if (idx>=0) saveEncrypted(keys); return { success:true }; });
  },

  removeCustomer(id){
    const cid = Number(id);
    const before = data.customers.length;
    data.customers = data.customers.filter(c=> c.id !== cid);
    // Cascade: remove related invoices, invoice_items, payments
    const delInvIds = new Set((data.invoices||[]).filter(i=> i.customer_id===cid).map(i=> i.id));
    data.invoices = (data.invoices||[]).filter(i=> i.customer_id!==cid);
    data.invoice_items = (data.invoice_items||[]).filter(it=> !delInvIds.has(it.invoice_id));
    data.payments = (data.payments||[]).filter(p=> p.customer_id!==cid);
    return ensureKey(path.dirname(storePath)).then(keys=>{ if (data.customers.length !== before) saveEncrypted(keys); return { success:true }; });
  },

  // Invoices
  createInvoice(inv){
    const id = nextId(data.invoices);
    const invoice_no = inv.invoice_no || `INV-${id}`;
    const row = { id, invoice_no, customer_id: inv.customer_id, date: inv.date || new Date().toISOString().slice(0,10), subtotal: inv.subtotal||0, tax: inv.tax||0, discount: inv.discount||0, total: inv.total||0, status: inv.status||'paid', notes: inv.notes||'' };
    data.invoices.push(row);
    for (const it of inv.items||[]){
      const iid = nextId(data.invoice_items);
      data.invoice_items.push({ id: iid, invoice_id: id, name: it.name||'', unit_type: it.unit_type||'pcs', length: it.length??null, width: it.width??null, qty: it.qty??null, unit_rate: it.unit_rate||0, line_total: it.line_total||0, note: it.note||'' });
    }
    return ensureKey(path.dirname(storePath)).then(keys=>{ saveEncrypted(keys); return { id, invoice_no }; });
  },
  updateInvoice(id, inv){
    const idx = data.invoices.findIndex(i=> i.id === Number(id));
    if (idx < 0) return Promise.resolve({ success: false, error: 'Not found' });
    const old = data.invoices[idx];
    data.invoices[idx] = { ...old, customer_id: inv.customer_id, subtotal: inv.subtotal||0, tax: inv.tax||0, discount: inv.discount||0, total: inv.total||0, status: inv.status||old.status, notes: inv.notes||'' };
    data.invoice_items = data.invoice_items.filter(it=> it.invoice_id !== Number(id));
    for (const it of inv.items||[]){
      const iid = nextId(data.invoice_items);
      data.invoice_items.push({ id: iid, invoice_id: Number(id), name: it.name||'', unit_type: it.unit_type||'pcs', length: it.length??null, width: it.width??null, qty: it.qty??null, unit_rate: it.unit_rate||0, line_total: it.line_total||0, note: it.note||'' });
    }
    return ensureKey(path.dirname(storePath)).then(keys=>{ saveEncrypted(keys); return { success: true }; });
  },
  getAllInvoices(){
    return [...data.invoices]
      .sort((a,b)=> (a.date<b.date?1:-1))
      .slice(0,100)
      .map(i=>({
        ...i,
        customer_name: (i.customer_id==null)
          ? 'Walk-in'
          : ((data.customers.find(c=>c.id===i.customer_id)||{}).name || 'Unknown')
      }));
  },
  getInvoiceById(id){
    const invoice = data.invoices.find(i=>i.id===id);
    if (!invoice) return null;
    const items = data.invoice_items.filter(it=>it.invoice_id===id);
    const customer = data.customers.find(c=>c.id===invoice.customer_id) || null;
    return { invoice, items, customer };
  },

  // Expenses
  addExpense(exp){
    const id = nextId(data.expenses);
    data.expenses.push({ id, title:exp.title, amount:Number(exp.amount)||0, category:exp.category||'other', date: exp.date || new Date().toISOString().slice(0,10), notes: exp.notes||'' });
    return ensureKey(path.dirname(storePath)).then(keys=>{ saveEncrypted(keys); return { id }; });
  },
  getExpenses(filter){
    let arr = [...data.expenses];
    if (filter?.from) arr = arr.filter(e=> e.date >= filter.from);
    if (filter?.to) arr = arr.filter(e=> e.date <= filter.to);
    if (filter?.category) arr = arr.filter(e=> (e.category||'') === filter.category);
    return arr.sort((a,b)=> (a.date<b.date?1:-1));
  },

  // Payments
  addPayment(p){
    const id = nextId(data.payments);
    data.payments.push({ id, invoice_id: p.invoice_id||null, customer_id: p.customer_id||null, date: p.date||new Date().toISOString().slice(0,10), amount:Number(p.amount)||0, method:p.method||'', notes:p.notes||'' });
    return ensureKey(path.dirname(storePath)).then(keys=>{ saveEncrypted(keys); return { id }; });
  },

  // Quick Items (persistent list for Invoice quick add)
  getQuickItems(){
    return [...(data.quick_items||[])].sort((a,b)=> a.name.localeCompare(b.name));
  },
  addQuickItem(item){
    if (!Array.isArray(data.quick_items)) data.quick_items = [];
    const id = nextId(data.quick_items);
    const row = {
      id,
      name: item.name,
      unit: item.unit === 'feet' ? 'feet' : 'pcs',
      rate: Number(item.rate) || 0,
      category: item.category || 'General',
      note: item.note || '',
      created_at: new Date().toISOString().slice(0,10),
    };
    data.quick_items.push(row);
    return ensureKey(path.dirname(storePath)).then(keys=>{ saveEncrypted(keys); return { id }; });
  },
  updateQuickItem(item){
    if (!Array.isArray(data.quick_items)) data.quick_items = [];
    const idx = data.quick_items.findIndex(q=> q.id === Number(item.id));
    if (idx >= 0){
      const q = data.quick_items[idx];
      data.quick_items[idx] = {
        ...q,
        name: item.name ?? q.name,
        unit: (item.unit === 'feet' || item.unit === 'pcs') ? item.unit : q.unit,
        rate: (item.rate !== undefined ? Number(item.rate) : q.rate) || 0,
        category: item.category !== undefined ? (item.category || 'General') : q.category,
        note: item.note !== undefined ? item.note : q.note,
      };
    }
    return ensureKey(path.dirname(storePath)).then(k=>{ if (idx>=0) saveEncrypted(k); return { success:true }; });
  },
  removeQuickItem(id){
    if (!Array.isArray(data.quick_items)) data.quick_items = [];
    const before = data.quick_items.length;
    data.quick_items = data.quick_items.filter(q=> q.id !== Number(id));
    return ensureKey(path.dirname(storePath)).then(keys=>{ if (data.quick_items.length !== before) saveEncrypted(keys); return { success:true }; });
  },

  // Ledger
  getLedger(customerId, startDate, endDate){
    const isWalkin = customerId===null || customerId===undefined || String(customerId)==='walkin' || Number.isNaN(Number(customerId));
    const cid = isWalkin ? null : Number(customerId);
    const invs = (data.invoices||[]).filter(i=> i.customer_id===cid && (!startDate || i.date>=startDate) && (!endDate || i.date<=endDate));
    const pays = (data.payments||[]).filter(p=> p.customer_id===cid && (!startDate || p.date>=startDate) && (!endDate || p.date<=endDate));
    const invoices = invs.map(i=>({ date:i.date, type:'invoice', ref:i.invoice_no, amount:i.total }));
    const payments = pays.map(p=>({ date:p.date, type:'payment', ref:String(p.id), amount:p.amount }));
    const all = invoices.concat(payments).sort((a,b)=> a.date.localeCompare(b.date));
    // Include previous balance as starting balance
    let prevBalance = 0;
    if (cid !== null) {
      const cust = (data.customers||[]).find(c => c.id === cid);
      prevBalance = Number(cust?.previous_balance) || 0;
    }
    let balance = prevBalance;
    const rows = all.map(r=>{
      if (r.type==='invoice'){ balance += r.amount; return { date:r.date, type:r.type, ref:r.ref, debit:r.amount, credit:0, balance }; }
      balance -= r.amount; return { date:r.date, type:r.type, ref:r.ref, debit:0, credit:r.amount, balance };
    });
    const total_billed = invs.reduce((s,i)=>s+(i.total||0),0);
    const total_paid = pays.reduce((s,p)=>s+(p.amount||0),0);
    return { rows, total_billed, total_paid, total_due: Math.max(0, prevBalance + total_billed - total_paid), previous_balance: prevBalance };
  },

  // Dashboard summary
  getDashboardSummary(){
    const invoices = data.invoices || [];
    const expenses = data.expenses || [];
    const customers = data.customers || [];
    const payments = data.payments || [];

    const totalEarnings = invoices.reduce((s,i)=>s+(i.total||0),0);
    const totalExpenses = expenses.reduce((s,e)=>s+(e.amount||0),0);
    const totalClients = customers.length;
    const now = new Date();
    const months=[]; const earningsSeries=[]; const expensesSeries=[];
    for(let i=5;i>=0;i--){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months.push(d.toLocaleString(undefined,{month:'short'}));
      const earn = invoices.filter(x=>x.date && x.date.startsWith(ym)).reduce((s,x)=>s+(x.total||0),0);
      const exp = expenses.filter(x=>x.date && x.date.startsWith(ym)).reduce((s,x)=>s+(x.amount||0),0);
      earningsSeries.push(earn); expensesSeries.push(exp);
    }
    const monthEarnings = earningsSeries[earningsSeries.length-1]||0;
    const monthProfit = monthEarnings - (expensesSeries[expensesSeries.length-1]||0);
    const pendingCount = invoices.reduce((n,i)=>{
      const paid = payments.filter(p=> p.invoice_id===i.id).reduce((s,p)=>s+(p.amount||0),0);
      return n + (((i.total||0) - paid) > 0 ? 1 : 0);
    }, 0);
    const recent = [...invoices]
      .sort((a,b)=> (a.date<b.date?1:-1))
      .slice(0,10)
      .map(i=>{
        const paid = payments.filter(p=> p.invoice_id===i.id).reduce((s,p)=>s+(p.amount||0),0);
        const due = Math.max(0, (i.total||0) - paid);
        return {
          id: i.id,
          date: i.date,
          total: i.total,
          status: i.status,
          customer_name: (i.customer_id==null) ? 'Walk-in' : ((customers.find(c=>c.id===i.customer_id)||{}).name || 'Unknown'),
          invoice_no: i.invoice_no,
          paid,
          due,
        };
      });
    return { months, earningsSeries, expensesSeries, totalEarnings, totalExpenses, monthEarnings, monthProfit, totalClients, pendingCount, recent };
  },

  // Products (with cost price for P&L calculations)
  getProducts(){
    return [...(data.products||[])].sort((a,b)=> a.name.localeCompare(b.name));
  },
  addProduct(product){
    if (!Array.isArray(data.products)) data.products = [];
    const id = nextId(data.products);
    const row = {
      id,
      name: product.name,
      category: product.category || 'General',
      unit: product.unit || 'pcs',
      costPrice: Number(product.costPrice) || 0,  // Hidden from invoice
      sellingPrice: Number(product.sellingPrice) || 0,  // Shown on invoice
      note: product.note || '',
      created_at: new Date().toISOString().slice(0,10),
    };
    data.products.push(row);
    return ensureKey(path.dirname(storePath)).then(keys=>{ saveEncrypted(keys); return { id }; });
  },
  updateProduct(product){
    if (!Array.isArray(data.products)) data.products = [];
    const idx = data.products.findIndex(p=> p.id === Number(product.id));
    if (idx >= 0){
      const p = data.products[idx];
      data.products[idx] = {
        ...p,
        name: product.name ?? p.name,
        category: product.category !== undefined ? (product.category || 'General') : p.category,
        unit: product.unit !== undefined ? (product.unit || 'pcs') : p.unit,
        costPrice: product.costPrice !== undefined ? (Number(product.costPrice) || 0) : p.costPrice,
        sellingPrice: product.sellingPrice !== undefined ? (Number(product.sellingPrice) || 0) : p.sellingPrice,
        note: product.note !== undefined ? product.note : p.note,
      };
    }
    return ensureKey(path.dirname(storePath)).then(keys=>{ if (idx>=0) saveEncrypted(keys); return { success:true }; });
  },
  removeProduct(id){
    if (!Array.isArray(data.products)) data.products = [];
    const before = data.products.length;
    data.products = data.products.filter(p=> p.id !== Number(id));
    return ensureKey(path.dirname(storePath)).then(keys=>{ if (data.products.length !== before) saveEncrypted(keys); return { success:true }; });
  },

  // Export all shop data (for PC migration)
  exportShopData(){
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      shop_id: path.basename(path.dirname(storePath)),
      data: {
        customers: data.customers || [],
        invoices: data.invoices || [],
        invoice_items: data.invoice_items || [],
        expenses: data.expenses || [],
        payments: data.payments || [],
        quick_items: data.quick_items || [],
        products: data.products || [],
        credit_entries: data.credit_entries || [],
      },
      counts: {
        customers: (data.customers || []).length,
        invoices: (data.invoices || []).length,
        invoice_items: (data.invoice_items || []).length,
        expenses: (data.expenses || []).length,
        payments: (data.payments || []).length,
        quick_items: (data.quick_items || []).length,
        products: (data.products || []).length,
        credit_entries: (data.credit_entries || []).length,
      }
    };
    return exportData;
  },

  // Import shop data (for PC migration)
  importShopData(importData){
    try {
      if (!importData || !importData.data) {
        return { success: false, error: 'Invalid import data' };
      }

      const imported = importData.data;
      
      // Merge or replace data
      if (imported.customers && Array.isArray(imported.customers)) {
        data.customers = imported.customers;
      }
      if (imported.invoices && Array.isArray(imported.invoices)) {
        data.invoices = imported.invoices;
      }
      if (imported.invoice_items && Array.isArray(imported.invoice_items)) {
        data.invoice_items = imported.invoice_items;
      }
      if (imported.expenses && Array.isArray(imported.expenses)) {
        data.expenses = imported.expenses;
      }
      if (imported.payments && Array.isArray(imported.payments)) {
        data.payments = imported.payments;
      }
      if (imported.quick_items && Array.isArray(imported.quick_items)) {
        data.quick_items = imported.quick_items;
      }
      if (imported.products && Array.isArray(imported.products)) {
        data.products = imported.products;
      }
      if (imported.credit_entries && Array.isArray(imported.credit_entries)) {
        data.credit_entries = imported.credit_entries;
      }

      // Save imported data
      return ensureKey(path.dirname(storePath)).then(keys => {
        saveEncrypted(keys);
        return {
          success: true,
          message: 'Data imported successfully',
          counts: {
            customers: (data.customers || []).length,
            invoices: (data.invoices || []).length,
            invoice_items: (data.invoice_items || []).length,
            expenses: (data.expenses || []).length,
            payments: (data.payments || []).length,
            quick_items: (data.quick_items || []).length,
            products: (data.products || []).length,
            credit_entries: (data.credit_entries || []).length,
          }
        };
      });
    } catch (err) {
      console.error('[DB] Import error:', err);
      return { success: false, error: String(err.message || err) };
    }
  },
};

