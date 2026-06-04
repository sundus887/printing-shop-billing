import React, { useEffect, useMemo, useState } from 'react';

function num(n){ const v = parseFloat(n); return isNaN(v) ? 0 : v; }

export default function InvoiceEditor(){
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customerCategory, setCustomerCategory] = useState(''); // Walk-in | Individual | Business
  const [notes, setNotes] = useState('');
  const [received, setReceived] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [items, setItems] = useState([]);
  const [iSearch, setISearch] = useState('');

  // Quick items (persistent)
  const [quickItems, setQuickItems] = useState([]);
  const [products, setProducts] = useState([]);  // Products from Add Product page
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [qi, setQi] = useState({ name: '', unit: 'pcs', note: '' });
  const [editId, setEditId] = useState(null);
  const [editQi, setEditQi] = useState({ id: null, name: '', unit: 'pcs', note: '' });
  const [qSearch, setQSearch] = useState('');
  const [qFilterCat, setQFilterCat] = useState('All');
  const [prevDue, setPrevDue] = useState(0);
  const [loadingDue, setLoadingDue] = useState(false);

  const [shopProfile, setShopProfile] = useState({ shopName: '', logoPath: '' });

  const loadQuickItems = async () => {
    const list = await window.api.getQuickItems();
    setQuickItems(list || []);
  };

  const loadProducts = async () => {
    const list = await window.api.getProducts?.();
    setProducts(list || []);
  };

  const resetInvoiceForm = () => {
    setCustomerId('');
    setCustomerCategory('');
    setNotes('');
    setReceived('0');
    setPaymentMethod('cash');
    setItems([]);
    setISearch('');
    setPrevDue(0);
  };

  const generateInvoicePDF = (meta={}) => {
    if (!customerId && customerCategory !== 'Walk-in') { alert('Please select a customer'); return; }
    if (items.length === 0) { alert('Add at least one item'); return; }
    const cust = customerCategory === 'Walk-in' ? null : customers.find(c=> String(c.id)===String(customerId));
    const custName = customerCategory === 'Walk-in' ? 'Walk-in' : (cust?.name || 'Customer');
    const custPhone = customerCategory === 'Walk-in' ? '' : (cust?.phone || '');
    const invNo = meta.invoice_no || '';
    const invDate = meta.date || new Date().toISOString().slice(0,10);

    const esc = (s)=> String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const rows = items.map((it, idx)=>{
      const l = Number(it.length||0);
      const w = Number(it.width||0);
      const size = `${l||0}ft × ${w||0}ft`;
      const sqft = (l&&w) ? (l*w).toFixed(2)+ ' ft' : '';
      const qty = Number(it.qty||0);
      const rate = Number(it.rate||0);
      const amount = Number(it.amount||0);
      const note = String(it.note||'').trim();
      const name = String(it.name||'').trim();
      const showNote = note && note.toLowerCase() !== name.toLowerCase();
      return `
        <tr>
          <td class="c">${idx+1}</td>
          <td>
            <div class="pname">${esc(it.name||'')}</div>
            ${showNote ? `<div class="sub">${esc(note)}</div>` : ''}
          </td>
          <td class="c">${esc(size)}</td>
          <td class="r">${qty}</td>
          <td class="r">${sqft}</td>
          <td class="r">${rate.toFixed(2)}</td>
          <td class="r">${amount.toFixed(2)}</td>
        </tr>`;
    }).join('');

    const totalBill = items.reduce((s,it)=> s + (Number(it.amount)||0), 0);
    const prev = Number(prevDue||0);
    const recv = Number(received||0);
    const balance = totalBill + prev - recv;

    const shopName = (shopProfile && shopProfile.shopName) ? String(shopProfile.shopName) : 'Shop';
    const logoPath = (shopProfile && shopProfile.logoPath) ? String(shopProfile.logoPath) : '';
    const logoSrc = logoPath ? ('file:///' + logoPath.replace(/\\/g,'/')) : '';

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Invoice - ${esc(custName)}</title>
      <style>
        :root{ --accent:#1f3a8a; --accent-2:#2f56c0; --light:#eef2ff; --text:#0f172a; }
        body{ font-family: Arial, sans-serif; color:var(--text); background:#fff; padding:24px; }
        /* A4 layout: 210mm x 297mm */
        .paper{ width:210mm; min-height:297mm; margin:0 auto; background:#ffffff; border:2px solid #e0e0e0; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,.18); padding:16mm 14mm 16mm; position:relative; }
        .banner{ background:var(--accent); color:#fff; border-radius:12mm; padding:10mm 8mm 6mm; text-align:center; }
        .logo-space{ height:14mm; margin-bottom:4mm; display:flex; align-items:center; justify-content:center; gap:10px; }
        .logo-img{ height:14mm; max-width:55mm; object-fit:contain; background:rgba(255,255,255,0.92); border-radius:10px; padding:4px 8px; }
        .shop-name{ font-weight:800; letter-spacing:.6px; }
        .title-invoice{ font-size:22pt; font-weight:800; letter-spacing:1px; }
        .header-grid{ display:flex; justify-content:space-between; color:#0f172a; margin:8mm 0 6mm; gap:10mm; }
        .header-grid .left > div{ margin:1.5mm 0; }
        .header-grid .right{ text-align:right; }
        .header-grid .right > div{ margin:1.5mm 0; }
        .badge{ padding:4px 8px; border:1px solid rgba(31,58,138,.35); border-radius:8px; font-weight:600; background:var(--light); color:var(--accent); }
        .panel{ background:#fff; border-radius:6mm; padding:6mm; margin:8mm 0 10mm; position:relative; z-index:2; border:1px solid #e0e0e0; }
        table{ width:100%; border-collapse:collapse; }
        th,td{ border:1px solid #d0d0d0; padding:8px; font-size:12px; }
        th{ background:var(--light); color:#0f1e44; }
        .r{ text-align:right; }
        .c{ text-align:center; }
        .sub{ font-size:10px; opacity:.7; margin-top:2px; }
        .pname{ font-weight:700; letter-spacing:.3px; }
        .foot{ margin-top:6mm; font-weight:600; color:#0f1e44; }
        .summary{ margin-top:8mm; display:flex; justify-content:flex-end; }
        .box{ width:360px; border:1px solid #d0d0d0; border-radius:10px; overflow:hidden; background:#f8f9fa; }
        .box table{ border-collapse:collapse; width:100%; }
        .box td{ border:1px solid #d0d0d0; padding:8px; font-size:12px; }
        @page { size: A4; margin: 0; }
        @media print {
          .no-print{ display:none }
          body{
            margin:0; padding:0;
            background:#fff;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          html, body { width:210mm; height:297mm; }
          .paper{
            width:210mm; height:297mm; margin:0 !important;
            box-shadow:none; border-radius:0 !important; /* avoid viewer clipping */
            padding:14mm !important;
          }
          .banner{ border-radius:0 !important; }
        }
      </style></head><body>
      <div class="paper">
        <div class="banner">
          <div class="logo-space">
            ${logoSrc ? `<img class="logo-img" src="${logoSrc}" alt="Logo" />` : ''}
            <div class="shop-name">${esc(shopName)}</div>
          </div>
          <div class="title-invoice">INVOICE</div>
        </div>

      <div class="header-grid">
        <div class="left">
          <div><strong>Invoice #:</strong> <span class="badge">${esc(invNo||'')}</span></div>
          <div><strong>Customer:</strong> ${esc(custName)}</div>
          <div><strong>Mobile:</strong> ${esc(custPhone || '-')}</div>
        </div>
        <div class="right">
          <div><strong>Date</strong> ${esc(invDate)}</div>
        </div>
      </div>

      <div class="panel">
      <table>
        <thead>
          <tr>
            <th style="width:50px" class="c">SNo.</th>
            <th>Particulars</th>
            <th style="width:120px" class="c">Size</th>
            <th style="width:60px" class="r">Qty</th>
            <th style="width:80px" class="r">SqFt</th>
            <th style="width:80px" class="r">Rate</th>
            <th style="width:100px" class="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="foot">Total Item(s): ${items.length}</div>

      ${notes ? `<div style="margin-top:8px; font-size:12px"><strong>Notes:</strong> ${esc(notes)}</div>` : ''}

      <div class="summary">
        <div class="box">
          <table>
            <tr><td><strong>Total Bill:</strong></td><td class="r">Rs ${totalBill.toFixed(2)}</td></tr>
            <tr><td>Previous Balance</td><td class="r">Rs ${prev.toFixed(2)}</td></tr>
            <tr><td>Total Receive Amount</td><td class="r">Rs ${recv.toFixed(2)}</td></tr>
            <tr><td><strong>Pending Amount</strong></td><td class="r"><strong>Rs ${balance.toFixed(2)}</strong></td></tr>
          </table>
        </div>
      </div>
      </div>

      <div class="no-print" style="text-align:right; margin-top:12px">
        <button id="downloadBtn" type="button">Download PDF</button>
      </div>
      </div>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups to export.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Wire up a download button inside the new window to call Electron printToPDF (no print dialog)
    setTimeout(()=>{
      try{
        const btn = win.document.getElementById('downloadBtn');
        if (btn) btn.addEventListener('click', async (e)=>{
          e.preventDefault();
          try{
            const res = await window.api.savePDF(`${html}`, `${invNo||'invoice'}.pdf`);
            if (res?.error) alert('Failed to save PDF: '+res.error);
            if (!res?.canceled) {
              try {
                if (window.opener && window.opener.postMessage) {
                  window.opener.postMessage({ type: 'invoice:exported' }, '*');
                }
              } catch {}
              try { window.close(); } catch {}
            }
          }catch(err){ alert('Failed to save PDF'); }
        });
        win.focus();
      }catch{}
    }, 200);
  };

  useEffect(()=>{
    window.api.getCustomers().then(setCustomers);
    loadQuickItems();
    loadProducts();  // Load products from Add Product page
    try {
      window.api.shopProfileGet().then((p)=>{ if (p) setShopProfile({ shopName: p.shopName||'', logoPath: p.logoPath||'' }); });
    } catch {}
  }, []);

  // Reset the form when PDF export completes (message from preview window)
  useEffect(()=>{
    const onMsg = (ev)=>{
      const data = ev?.data || {};
      if (data && data.type === 'invoice:exported') {
        resetInvoiceForm();
      }
    };
    window.addEventListener('message', onMsg);
    return ()=> window.removeEventListener('message', onMsg);
  }, []);

  // Load previous balance when customer changes
  useEffect(()=>{
    if (!customerId){ setPrevDue(0); return; }
    setLoadingDue(true);
    
    // Get customer's stored previous balance
    const customer = customers.find(c => String(c.id) === String(customerId));
    const storedPrevBalance = customer?.previous_balance || 0;
    
    // Also get ledger balance (unpaid invoices)
    window.api.getLedger(Number(customerId))
      .then(res => {
        const ledgerDue = Math.max(0, Number(res?.total_due || 0));
        // Total previous due = stored balance + unpaid invoices
        setPrevDue(storedPrevBalance + ledgerDue);
      })
      .finally(()=> setLoadingDue(false));
  }, [customerId, customers]);

  // Filter customers by selected category
  const filteredCustomers = useMemo(()=>{
    const infer = (c)=>{
      if (c.category) return c.category;
      const n = (c.name||'').toLowerCase();
      if (n.includes('walk')) return 'Walk-in';
      if (n.includes('ltd') || n.includes('company') || n.includes('co ')) return 'Business';
      return 'Individual';
    };
    if (!customerCategory) return [];
    return (customers||[]).filter(c=> infer(c) === customerCategory);
  }, [customers, customerCategory]);

  const categories = useMemo(()=>{
    const set = new Set();
    (quickItems||[]).forEach(it=> set.add(it.category || 'General'));
    (products||[]).forEach(it=> set.add(it.category || 'General'));
    return ['All', ...Array.from(set).sort()];
  }, [quickItems, products]);

  const filteredQuickItems = useMemo(()=>{
    const q = (qSearch||'').toLowerCase();
    
    // Merge quick items and products
    const allItems = [
      ...(quickItems||[]).map(it => ({ ...it, _source: 'quick' })),
      ...(products||[]).map(it => ({ 
        ...it, 
        _source: 'product',
        rate: it.sellingPrice || 0,  // Use selling price from products
        note: it.note || it.name
      }))
    ];
    
    return allItems.filter(it=>{
      const inCat = qFilterCat==='All' ? true : (it.category||'General')===qFilterCat;
      const inText = !q ? true : ((it.name||'').toLowerCase().includes(q));
      return inCat && inText;
    });
  }, [quickItems, products, qSearch, qFilterCat]);

  const handleQuickFormKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if(!qi.name) return alert('Name is required');
      (async ()=>{
        await window.api.addQuickItem({ name: qi.name, unit: qi.unit, rate: 0, note: qi.note||qi.name });
        setQi({ name:'', unit:'pcs', note:'' });
        setShowQuickForm(false);
        loadQuickItems();
      })();
    }
  };

  const calcAmount = (r) => {
    const q = num(r.qty);
    const rt = num(r.rate);
    
    // For feet-based products: calculate area (length × width)
    if ((r.unit||'pcs') === 'feet') {
      const l = num(r.length);
      const w = num(r.width);
      if (!l || l <= 0) return 0;
      if (!w || w <= 0) return 0;
      if (!q || q <= 0) return 0;
      if (!rt || rt <= 0) return 0;
      return Math.round((l * w * q * rt) * 100) / 100;
    }
    
    // For pcs-based products: just quantity × rate
    if (!q || q <= 0) return 0;
    if (!rt || rt <= 0) return 0;
    return Math.round((q * rt) * 100) / 100;
  };

  const missingFields = (r) => {
    const miss = [];
    // Only require length/width for feet-based products
    if ((r.unit||'pcs') === 'feet') {
      if (!(num(r.length) > 0)) miss.push('Length');
      if (!(num(r.width) > 0)) miss.push('Width');
    }
    if (!(num(r.qty) > 0)) miss.push('Qty');
    if (!(num(r.rate) > 0)) miss.push('Rate');
    return miss;
  };

  const addRow = (preset) => {
    const id = Date.now() + Math.random();
    // If item with same name+unit exists: increment qty (for Pcs) instead of adding duplicate
    if (preset) {
      const idx = items.findIndex(it => (it.name||'')===preset.name && (it.unit||'')===preset.unit);
      if (idx >= 0){
        setItems((prev)=>{
          const arr = [...prev];
          const ex = { ...arr[idx] };
          if ((ex.unit||'pcs') !== 'feet'){
            const q = parseFloat(ex.qty||'1') || 1;
            ex.qty = String(q + 1);
          }
          ex.amount = calcAmount(ex);
          arr[idx] = ex;
          return arr;
        });
        return;
      }
    }
    // Create new row based on unit type
    const unit = preset?.unit || 'pcs';
    const defaultRate = preset?.sellingPrice || preset?.rate || '';  // Use selling price from products
    const row = preset
      ? { 
          id, 
          name: preset.name, 
          unit: preset.unit, 
          length: unit === 'feet' ? '0' : '', 
          width: unit === 'feet' ? '0' : '', 
          qty: '1', 
          rate: defaultRate,  // Auto-fill rate from product selling price
          amount: 0, 
          note: preset.note || '' 
        }
      : { id, name: '', unit: 'pcs', length: '', width: '', qty: '1', rate: '', amount: 0 };
    row.amount = calcAmount(row);
    setItems((p)=>[...p,row]);
  };

  const updateRow = (id, patch) => {
    setItems((p)=>p.map(r=>{
      if (r.id!==id) return r;
      const n = { ...r, ...patch };
      n.amount = calcAmount(n);
      return n;
    }));
  };
  const removeRow = (id) => setItems((p)=>p.filter(r=>r.id!==id));

  const subtotal = useMemo(()=> items.reduce((s,r)=> s + num(r.amount), 0), [items]);
  const discount = 0, tax = 0;
  const total = Math.round((subtotal + tax - discount)*100)/100;
  const pendingAfter = useMemo(()=> Math.max(0, prevDue + total - num(received)), [prevDue, total, received]);

  // Items to render (no filtering now)
  const visibleItems = useMemo(()=> items, [items]);

  // Save then auto-generate PDF
  const saveInvoice = async () => {
    if (!customerId && customerCategory !== 'Walk-in') return alert('Please select a customer');
    if (items.length === 0) return alert('Add at least one item');

    // Ensure each item has all fields > 0
    for (const it of items){
      const miss = missingFields(it);
      if (miss.length){
        alert(`Please fill ${miss.join(', ')} for item: ${it.name||'Item'}`);
        return;
      }
    }

    const recv = Number(received||0);
    if (Number.isNaN(recv)) return alert('Please enter Amount Received (number)');

    const payload = {
      customer_id: customerCategory === 'Walk-in' ? null : parseInt(customerId,10),
      date: new Date().toISOString().slice(0,10),
      subtotal, tax, discount, total, notes,
      status: recv >= total ? 'paid' : 'pending',
      items: items.map(it=>({
        name: it.name,
        unit_type: it.unit,
        length: num(it.length),
        width: num(it.width),
        qty: num(it.qty),
        unit_rate: num(it.rate),
        line_total: calcAmount(it),
        note: it.note||'',
      }))
    };
    const res = await window.api.createInvoice(payload);
    if (res?.id){
      // Record received payment so future 'Previous Pending Amount' is correct
      const recvAmt = Number(received||0);
      if (recvAmt > 0){
        await window.api.addPayment({ invoice_id: res.id, customer_id: (customerCategory==='Walk-in'? null : parseInt(customerId,10)), date: payload.date, amount: recvAmt, method: paymentMethod, notes: 'Invoice payment' });
      }
      // Refresh cached pending amount for the selected customer
      try {
        const led = await window.api.getLedger(Number(customerId));
        setPrevDue(Math.max(0, Number(led?.total_due||0)));
      } catch {}

      generateInvoicePDF({ invoice_no: res.invoice_no, date: payload.date });
      // Requirement: Even if user doesn't download the PDF, reset the invoice page after generation
      resetInvoiceForm();
    }
  };

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold section-accent">Create Invoice</div>
          <div className="opacity-70 text-sm">Create professional invoices</div>
        </div>
      </div>

      {/* POS banner */}
      <div className="card neon-red">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">Point of Sale System</div>
            <div className="opacity-70 text-sm">Professional Invoice & Receipt Generation with Enhanced PDF</div>
            <div className="mt-2 flex gap-2">
              <span className="badge badge-green">Ultimate Edition</span>
              <span className="badge badge-blue">Premium Features</span>
            </div>
          </div>
          <div className="text-right">
            <div className="chip">{new Date().toLocaleDateString()}</div>
            <div className="mt-2 chip">#POS - {new Date().toISOString().slice(2,10).replace(/-/g,'')}-{String(Math.floor(Math.random()*900)+100)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Main content (will appear first) */}
        <div className="space-y-4">
          <div className="card card-red">
            <div className="title mb-3">Customer Selection</div>
            <div className="mb-2 text-sm opacity-80">Choose Category</div>
            <div className="flex items-center gap-2 mb-3">
              {['Walk-in','Individual','Business'].map(cat=> (
                <button key={cat} className={`chip ${customerCategory===cat?'tab-active':''}`} onClick={()=>{ setCustomerCategory(cat); setCustomerId(''); }}>
                  {cat}
                </button>
              ))}
            </div>
            {customerCategory ? (
              customerCategory === 'Walk-in' ? (
                <div className="text-sm opacity-80">Creating invoice for <span className="chip">Walk-in</span>. No selection needed.</div>
              ) : filteredCustomers.length > 0 ? (
                <>
                  <label className="text-sm opacity-80 mb-1 block">Select Customer ({customerCategory})</label>
                  <select className="input" value={customerId} onChange={e=>setCustomerId(e.target.value)}>
                    {(!customerId) ? <option value="" disabled hidden>Choose a customer…</option> : null}
                    {filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {customerId ? (
                    <div className="text-sm mt-2">
                      Previous Pending Amount: {loadingDue ? 'Loading…' : <span className="chip">PKR {prevDue.toFixed(2)}</span>}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-sm opacity-70">No customers in {customerCategory}. Add one from the Add Customer page.</div>
              )
            ) : (
              <div className="text-sm opacity-70">Please select a category to list customers.</div>
            )}
          </div>

          <div className="card card-red">
            <div className="mb-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="title shrink-0">Quick Add Items</div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <select className="input w-32 md:w-40" value={qFilterCat} onChange={e=>setQFilterCat(e.target.value)}>
                    {categories.map(c=> <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button className="btn w-full md:w-auto" onClick={()=>setShowQuickForm(v=>!v)}>
                    {showQuickForm ? 'Close' : '+ Add Quick Product'}
                  </button>
                </div>
              </div>
            </div>

            {showQuickForm && (
              <div className="list-item list-item-red mb-3">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                  <div className="md:col-span-2">
                    <label className="text-sm opacity-80">Product Name</label>
                    <input className="input" value={qi.name} onChange={e=>setQi({...qi, name:e.target.value})} onKeyDown={handleQuickFormKey} placeholder="e.g. A4 Flyers (500)" />
                  </div>
                  <div>
                    <label className="text-sm opacity-80">Unit</label>
                    <select className="input" value={qi.unit} onChange={e=>setQi({...qi, unit:e.target.value})} onKeyDown={handleQuickFormKey}>
                      <option value="pcs">Pcs</option>
                      <option value="feet">Feet</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm opacity-80">Note</label>
                    <input className="input" value={qi.note} onChange={e=>setQi({...qi, note:e.target.value})} onKeyDown={handleQuickFormKey} placeholder="Type or auto-filled from name" />
                  </div>
                  <div className="md:col-span-1 flex gap-2">
                    <button className="btn" onClick={()=>{ setQi({ name:'', unit:'pcs', note:'' }); }}>Reset</button>
                    <button className="btn btn-red" onClick={async ()=>{
                      if(!qi.name) return alert('Name is required');
                      await window.api.addQuickItem({ name: qi.name, unit: qi.unit, rate: 0, note: qi.note||qi.name });
                      setQi({ name:'', unit:'pcs', note:'' });
                      setShowQuickForm(false);
                      loadQuickItems();
                    }}>Save</button>
                  </div>
                </div>
              </div>
            )}

            {/* Available list moved to Items section below */}
          </div>

          <div className="card card-red">
            {/* Available Items (All products) */}
            <div className="mb-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="title">Items</div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <input className="input w-full md:w-56" placeholder="Search available items" value={qSearch} onChange={e=>setQSearch(e.target.value)} />
                  <select className="input w-32 md:w-40" value={qFilterCat} onChange={e=>setQFilterCat(e.target.value)}>
                    {categories.map(c=> <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Available Items</div>
              <div className="text-sm opacity-80">{filteredQuickItems.length} item(s)</div>
            </div>
            {filteredQuickItems.length === 0 ? (
              <div className="text-sm opacity-70">No items yet. Add products from "Add Product" page or click "+ Add Quick Product".</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {filteredQuickItems.map((q)=> (
                  <div key={`${q._source}-${q.id}`} className="list-item list-item-red cursor-pointer hover:bg-[rgba(31,58,138,0.03)]" onClick={()=>addRow(q)}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {q.name}
                          {q._source === 'product' && (
                            <span className="chip chip-blue text-[10px]">Product</span>
                          )}
                          {q._source === 'quick' && (
                            <span className="chip text-[10px]">Quick Add</span>
                          )}
                        </div>
                        <div className="text-xs opacity-70">
                          {q.unit === 'feet' ? 'Feet' : 'Pcs'} • {String((q.note && q.note.trim()) || q.category || '').slice(0,60)}
                          {q._source === 'product' && q.sellingPrice > 0 && (
                            <span className="ml-2 font-semibold">• PKR {Number(q.sellingPrice).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e)=>e.stopPropagation()}>
                        <div className={`chip ${q._source === 'product' ? 'chip-blue' : 'chip-red'}`}>
                          {q._source === 'product' ? 'In Stock' : 'Available'}
                        </div>
                        {q._source === 'quick' && (
                          <button className="btn" onClick={async ()=>{
                            if (!confirm(`Delete item "${q.name}" from catalog?`)) return;
                            await window.api.removeQuickItem(q.id);
                            loadQuickItems();
                          }}>Delete</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Invoice Items (selected from Available Items) */}
            {items.length > 0 && (
              <>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-medium">Invoice Items</div>
                </div>
                <div className="space-y-3">
                  {visibleItems.map((it)=> (
                    <div key={it.id} className="list-item list-item-red">
                      <div className="grid grid-cols-1 gap-3">
                        {/* Row 1: Name • Unit • Qty */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          <div className="md:col-span-6">
                            <label className="text-sm opacity-80">Item Name</label>
                            <input className="input" value={it.name} onChange={e=>updateRow(it.id,{name:e.target.value})} />
                            {it.note ? <div className="text-[11px] opacity-70 mt-1">{it.note}</div> : null}
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-sm opacity-80">Unit</label>
                            <select className="input" value={it.unit} onChange={e=>{
                              const u = e.target.value;
                              const patch = { unit: u };
                              if (u === 'feet'){
                                if (!it.length) patch.length = '1';
                                if (!it.width) patch.width = '1';
                              } else {
                                if (!it.qty) patch.qty = '1';
                              }
                              updateRow(it.id, patch);
                            }}>
                              <option value="pcs">Pcs</option>
                              <option value="feet">Feet</option>
                            </select>
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-sm opacity-80">Qty</label>
                            <input 
                              type="number" 
                              min="0" 
                              step="any"
                              className="input" 
                              value={it.qty ?? ''} 
                              onChange={e => updateRow(it.id, {qty: e.target.value})} 
                              placeholder="1"
                            />
                          </div>
                        </div>

                        {/* Row 2: Length • Width • Rate • Amount/Remove */}
                        {(it.unit||'pcs') === 'feet' && (
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                            <div className="md:col-span-3">
                              <label className="text-sm opacity-80">Length</label>
                              <input type="number" min="0" step="0.01" className="input" value={it.length ?? ''} onChange={e=>updateRow(it.id,{length:e.target.value})} />
                            </div>
                            <div className="md:col-span-3">
                              <label className="text-sm opacity-80">Width</label>
                              <input type="number" min="0" step="0.01" className="input" value={it.width ?? ''} onChange={e=>updateRow(it.id,{width:e.target.value})} />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-sm opacity-80">Rate</label>
                              <input className="input" value={it.rate ?? ''} onChange={e=>updateRow(it.id,{rate:e.target.value})} placeholder="Enter price" />
                              {(() => {
                                const l = parseFloat(it.length||0)||0;
                                const w = parseFloat(it.width||0)||0;
                                const q = Math.max(1, parseFloat(it.qty||1)||1);
                                const amt = parseFloat(it.amount||0)||0;
                                const sqft = l>0 && w>0 ? l*w*q : 0;
                                const per = sqft>0 && amt>0 ? (amt / sqft) : 0;
                                return (sqft>0 && amt>0) ? (
                                  <div className="text-[11px] opacity-70 mt-1">Per SqFt: PKR {per.toFixed(2)}</div>
                                ) : null;
                              })()}
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-sm opacity-80">Amount</label>
                              <div className="input text-right font-semibold" style={{backgroundColor: '#f8f9fa'}}>
                                PKR {it.amount?.toFixed ? it.amount.toFixed(2) : Number(it.amount||0).toFixed(2)}
                              </div>
                            </div>
                            <div className="md:col-span-1 flex items-end">
                              <button type="button" className="btn btn-red w-full" onClick={()=>removeRow(it.id)}>Remove</button>
                            </div>
                          </div>
                        )}
                        
                        {/* For pcs-based products: Show Rate and Amount only (no length/width) */}
                        {(it.unit||'pcs') !== 'feet' && (
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                            <div className="md:col-span-5">
                              <label className="text-sm opacity-80">Rate (per piece)</label>
                              <input className="input" value={it.rate ?? ''} onChange={e=>updateRow(it.id,{rate:e.target.value})} placeholder="Enter price per piece" />
                              {(() => {
                                const q = Math.max(1, parseFloat(it.qty||1)||1);
                                const rt = parseFloat(it.rate||0)||0;
                                return (q>0 && rt>0) ? (
                                  <div className="text-[11px] opacity-70 mt-1">Total: {q} × PKR {rt.toFixed(2)} = PKR {(q*rt).toLocaleString()}</div>
                                ) : null;
                              })()}
                            </div>
                            <div className="md:col-span-5">
                              <label className="text-sm opacity-80">Amount</label>
                              <div className="input text-right font-semibold" style={{backgroundColor: '#f8f9fa'}}>
                                PKR {it.amount?.toFixed ? it.amount.toFixed(2) : Number(it.amount||0).toFixed(2)}
                              </div>
                            </div>
                            <div className="md:col-span-2 flex items-end">
                              <button type="button" className="btn btn-red w-full" onClick={()=>removeRow(it.id)}>Remove</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Summary & Payment (moved below) */}
        <div className="space-y-4">
          <div className="card card-red">
            <div className="title mb-2">Order Summary</div>
            <div className="text-sm opacity-70 mb-3">Subtotal</div>
            <div className="title">PKR {subtotal.toFixed(2)}</div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm opacity-70">Total Amount</div>
              <div className="chip">PKR {total.toFixed(2)}</div>
            </div>
          </div>

          <div className="card card-red">
            <div className="title mb-2">Payment Processing</div>
            <label className="text-sm opacity-80">Amount Received (PKR)</label>
            <input className="input" value={received} onChange={e=>setReceived(e.target.value)} />
            <label className="text-sm opacity-80 mt-3">Additional Notes</label>
            <textarea className="input textarea" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any special instructions or notes..."></textarea>
            <button className="btn btn-red mt-4 w-full" onClick={saveInvoice}>Generate Invoice</button>
          </div>

        </div>
      </div>
    </div>
  );
}
