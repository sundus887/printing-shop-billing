import React, { useEffect, useMemo, useState } from 'react';

function num(n){ const v = parseFloat(n); return isNaN(v) ? 0 : v; }

function normalizeColor(c) {
  let s = String(c || '').trim();
  if (!s) return '#111111';
  if (!s.startsWith('#')) s = '#' + s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) return s;
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  return '#111111';
}

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

  const [branding, setBranding] = useState({
    shopName: '', header: '', footer: '', logoPath: '', logoSize: 90,
    shopNameSize: 18, shopNameColor: '#111111', shopNameFont: 'Arial, sans-serif'
  });

  const loadQuickItems = async () => {
    const list = await window.api.getQuickItems();
    setQuickItems(list || []);
  };
  const loadBranding = async () => {
    try {
      const b = await window.api.brandingGet();
      const cfg = b?.config || {};
      let logoPath = '';
      if (b?.hasLogo) {
        const logoRes = await window.api.brandingGetLogo?.();
        if (logoRes?.ok && logoRes.path) logoPath = logoRes.path;
      }
      const data = {
        shopName: cfg.shopName || '',
        header: cfg.header || '',
        footer: cfg.footer || '',
        logoPath,
        logoSize: cfg.logoSize || 90,
        shopNameSize: cfg.shopNameSize || 18,
        shopNameColor: normalizeColor(cfg.shopNameColor || '#111111'),
        shopNameFont: cfg.shopNameFont || 'Arial, sans-serif',
      };
      setBranding(data);
      return data;
    } catch {
      return branding;
    }
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

  const generateInvoicePDF = async (meta={}) => {
    const freshBranding = await loadBranding();
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

    const shopName = (freshBranding.shopName || '').trim();
    const showShopName = shopName.length > 0;
    const logoPath = freshBranding.logoPath || '';
    const logoSize = freshBranding.logoSize || 90;
    const logoSrc = logoPath ? ('file:///' + logoPath.replace(/\\/g,'/')) : '';
    const headerText = freshBranding.header || '';
    const footerText = freshBranding.footer || '';
    const shopNameSize = freshBranding.shopNameSize || 18;
    const shopNameColor = normalizeColor(freshBranding.shopNameColor || '#111111');
    const shopNameFont = freshBranding.shopNameFont || 'Arial, sans-serif';

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Invoice - ${esc(custName)}</title>
      <style>
              :root{ --sky:#38bdf8; --black:#111; --light:#e0f2fe; --text:#0f172a; --accent:#1f3a8a; }
               body{ font-family: Arial, sans-serif; color:var(--text); background:#fff; padding:24px; }
               .paper{ width:210mm; min-height:297mm; margin:0 auto; background:#fff; border:1px solid #e5e7eb; padding:0 14mm 16mm; position:relative; overflow:hidden; }
        .top-bar{ height:8px; background:var(--sky); width:100%; position:absolute; top:0; left:0; }
        .geo-wrap{ position:relative; height:55px; margin-bottom:8px; }
        .geo-black{ position:absolute; top:8px; left:-14mm; width:80px; height:45px; background:var(--black); clip-path:polygon(0 0, 70% 0, 100% 100%, 0 100%); }
        .geo-sky{ position:absolute; top:8px; left:45px; width:70px; height:45px; background:var(--sky); clip-path:polygon(0 0, 100% 0, 60% 100%, 0 100%); }
        .inv-header{ display:flex; justify-content:space-between; align-items:flex-start; padding-top:18px; margin-bottom:10px; }
        .inv-center{ flex:1; text-align:center; padding-top:8px; }
        .shop-name{ font-weight:800; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .header-text{ font-size:10px; color:#555; margin-top:4px; }
        .inv-logo-wrap{ text-align:right; min-width:140px; }
        .inv-logo{ object-fit:contain; display:block; margin-left:auto; }
        .logo-line{ height:3px; background:var(--sky); margin-top:6px; }
        .inv-footer{ margin-top:12mm; padding-top:6mm; border-top:1px solid #e5e7eb; text-align:center; font-size:11px; color:#666; }
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
  }
      </style></head><body>
      <div class="paper">
         <div class="top-bar"></div>
        <div class="geo-wrap">
          <div class="geo-black"></div>
          <div class="geo-sky"></div>
        </div>

        <div class="inv-header">
          <div style="width:140px"></div>
          <div class="inv-center">
          ${showShopName ? `<div class="shop-name" style="font-size:${shopNameSize}pt; color:${shopNameColor}; font-family:${shopNameFont};">${esc(shopName)}</div>` : ''}
            ${headerText ? `<div class="header-text">${esc(headerText)}</div>` : ''}
          </div>
          <div class="inv-logo-wrap">
            ${logoSrc ? `<img class="inv-logo" src="${logoSrc}" alt="Logo" style="height:${logoSize}px; max-width:${logoSize + 40}px;" />` : ''}
            <div class="logo-line"></div>
          </div>
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

      ${footerText ? `<div class="inv-footer">${esc(footerText)}</div>` : ''}

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
    loadProducts();
    loadBranding();
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
    
    // getLedger() already includes previous_balance in total_due
    window.api.getLedger(Number(customerId))
      .then(res => {
        const ledgerDue = Math.max(0, Number(res?.total_due || 0));
        setPrevDue(ledgerDue);
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
    // Always add a new row so same product can be added multiple times with different sizes
    // Create new row based on unit type
    const unit = preset?.unit || 'pcs';
    const defaultRate = preset?.sellingPrice || preset?.rate || '';  // Use selling price from products
    const row = preset
      ? { 
          id, 
          name: preset.name, 
          unit: preset.unit, 
          length: unit === 'feet' ? '' : '', 
          width: unit === 'feet' ? '' : '', 
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
  const grandTotal = useMemo(()=> Math.round((subtotal + prevDue)*100)/100, [subtotal, prevDue]);
  const pendingAfterPayment = useMemo(()=> Math.max(0, grandTotal - num(received)), [grandTotal, received]);

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
      status: recv >= grandTotal ? 'paid' : 'pending',
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

      await generateInvoicePDF({ invoice_no: res.invoice_no, date: payload.date });
      // Requirement: Even if user doesn't download the PDF, reset the invoice page after generation
      resetInvoiceForm();
    }
  };

  const renderItemDetail = (it, idx) => (
    <div key={it.id} className="card card-red" style={{borderLeft: '4px solid #1f3a8a'}}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-[#1f3a8a] text-sm">#{idx + 1} - {it.name || 'New Item'}</div>
        <button type="button" className="btn btn-red text-xs px-3 py-1" onClick={()=>removeRow(it.id)}>Remove</button>
      </div>

      {(it.unit||'pcs') === 'feet' ? (
  <div className="space-y-2">
    {/* Row 1: Length, Width, Qty */}
    <div className="grid grid-cols-3 gap-2 items-end">
      <div>
        <label className="text-xs opacity-80 block mb-1">Length (ft)</label>
        <input type="number" min="0" step="0.01" className="input text-sm w-full" value={it.length ?? ''} onChange={e=>updateRow(it.id,{length:e.target.value})} />
      </div>
      <div>
        <label className="text-xs opacity-80 block mb-1">Width (ft)</label>
        <input type="number" min="0" step="0.01" className="input text-sm w-full" value={it.width ?? ''} onChange={e=>updateRow(it.id,{width:e.target.value})} />
      </div>
      <div>
        <label className="text-xs opacity-80 block mb-1">Qty</label>
        <input type="number" min="0" step="any" className="input text-sm w-full" value={it.qty ?? ''} onChange={e=>updateRow(it.id, {qty: e.target.value})} />
      </div>
    </div>
    {/* Row 2: Rate, SqFt, Amount */}
    <div className="grid grid-cols-3 gap-2 items-end">
      <div>
        <label className="text-xs opacity-80 block mb-1">Rate/ft</label>
        <input className="input text-sm w-full" value={it.rate ?? ''} onChange={e=>updateRow(it.id,{rate:e.target.value})} placeholder="Per ft" />
      </div>
      <div>
        <label className="text-xs opacity-80 block mb-1">SqFt</label>
        {(() => {
          const l = parseFloat(it.length||0)||0;
          const w = parseFloat(it.width||0)||0;
          const q = Math.max(1, parseFloat(it.qty||1)||1);
          const sqft = l>0 && w>0 ? l*w*q : 0;
          return <div className="input text-sm text-center bg-gray-50 w-full">{sqft > 0 ? sqft.toFixed(2) : '0'}</div>;
        })()}
      </div>
      <div>
        <label className="text-xs opacity-80 block mb-1">Amount</label>
        <div className="input text-sm text-right font-bold bg-blue-50 text-[#1f3a8a] w-full">
          PKR {Number(it.amount||0).toFixed(2)}
        </div>
      </div>
    </div>
  </div>
      ) : (
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <label className="text-xs opacity-80 block mb-1">Quantity (Pcs)</label>
            <input type="number" min="0" step="any" className="input text-sm" value={it.qty ?? ''} onChange={e=>updateRow(it.id, {qty: e.target.value})} />
          </div>
          <div className="col-span-4">
            <label className="text-xs opacity-80 block mb-1">Rate (per piece)</label>
            <input className="input text-sm" value={it.rate ?? ''} onChange={e=>updateRow(it.id,{rate:e.target.value})} placeholder="Price per piece" />
          </div>
          <div className="col-span-4">
            <label className="text-xs opacity-80 block mb-1">Amount</label>
            <div className="input text-sm text-right font-bold bg-blue-50 text-[#1f3a8a]">
              PKR {Number(it.amount||0).toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col" style={{height: 'calc(100vh - 48px)'}}>
      {/* Header */}
      <div className="shrink-0 px-5 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-2xl font-semibold section-accent">Create Invoice</div>
            <div className="opacity-70 text-sm">Create professional invoices</div>
          </div>
        </div>

        {/* Customer Selection - compact */}
        <div className="card card-red mb-3">
          <div className="title mb-2">Customer Selection</div>
          <div className="flex items-center gap-2 flex-wrap">
            {['Walk-in','Individual','Business'].map(cat=> (
              <button key={cat} className={`chip ${customerCategory===cat?'tab-active':''}`} onClick={()=>{ setCustomerCategory(cat); setCustomerId(''); }}>
                {cat}
              </button>
            ))}
            {customerCategory && customerCategory !== 'Walk-in' && filteredCustomers.length > 0 && (
              <select className="input w-48" value={customerId} onChange={e=>setCustomerId(e.target.value)}>
                {(!customerId) ? <option value="" disabled hidden>Choose customer…</option> : null}
                {filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {customerCategory === 'Walk-in' && <span className="chip">Walk-in Customer</span>}
            {customerCategory && customerCategory !== 'Walk-in' && filteredCustomers.length === 0 && (
              <span className="text-sm opacity-70">No customers in {customerCategory}.</span>
            )}
            {customerId && (
              <span className="text-sm">Previous: {loadingDue ? 'Loading…' : <span className="chip">PKR {prevDue.toFixed(2)}</span>}</span>
            )}
          </div>
        </div>
      </div>

            {/* Main area */}
            <div className="flex-1 flex flex-col gap-3 px-5 pb-4 min-h-0">

{/* Top row: Available Items (left) + Selected Items (right) */}
<div className="flex-1 flex gap-4 min-h-0">

  {/* LEFT - Available Items */}
  <div className="flex flex-col min-h-0" style={{width: '42%', minWidth: 0}}>
    <div className="card card-red flex-1 flex flex-col min-h-0">
      <div className="shrink-0 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="title">Available Items</div>
          <button className="btn text-sm" onClick={()=>setShowQuickForm(v=>!v)}>
            {showQuickForm ? 'Close' : '+ Quick Add'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input className="input flex-1" placeholder="Search items..." value={qSearch} onChange={e=>setQSearch(e.target.value)} />
          <select className="input w-28" value={qFilterCat} onChange={e=>setQFilterCat(e.target.value)}>
            {categories.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="text-xs opacity-60 mt-1">{filteredQuickItems.length} item(s)</div>
      </div>

      {showQuickForm && (
        <div className="shrink-0 list-item list-item-red mb-3">
          <div className="grid grid-cols-2 gap-2 items-end">
            <div className="col-span-2">
              <label className="text-xs opacity-80">Name</label>
              <input className="input" value={qi.name} onChange={e=>setQi({...qi, name:e.target.value})} onKeyDown={handleQuickFormKey} placeholder="Product name" />
            </div>
            <div>
              <label className="text-xs opacity-80">Unit</label>
              <select className="input" value={qi.unit} onChange={e=>setQi({...qi, unit:e.target.value})}>
                <option value="pcs">Pcs</option>
                <option value="feet">Feet</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button className="btn text-xs" onClick={()=>setQi({ name:'', unit:'pcs', note:'' })}>Reset</button>
              <button className="btn btn-red text-xs" onClick={async ()=>{
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

      <div className="flex-1 overflow-y-auto pr-1">
        {filteredQuickItems.length === 0 ? (
          <div className="text-sm opacity-70">No items. Add products or click "+ Quick Add".</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredQuickItems.map((q)=> (
              <div key={`${q._source}-${q.id}`} className="list-item list-item-red cursor-pointer hover:bg-[rgba(31,58,138,0.06)] transition-colors" onClick={()=>addRow(q)}>
                <div className="flex items-center justify-between gap-1">
                  <div className="font-medium text-[#1f3a8a] text-sm truncate">{q.name}</div>
                  {q._source === 'quick' && (
                    <button className="text-xs opacity-50 hover:opacity-100 shrink-0" onClick={(e)=>{e.stopPropagation(); if (!confirm(`Delete "${q.name}"?`)) return; window.api.removeQuickItem(q.id); loadQuickItems();}}>&times;</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>

  {/* RIGHT - Selected Items */}
  <div className="flex flex-col min-h-0" style={{width: '58%', minWidth: 0}}>
    <div className="card card-red flex-1 flex flex-col min-h-0">
      {items.length === 0 ? (
        <div className="text-center py-10 opacity-60 text-sm flex-1 flex flex-col items-center justify-center">
          <div className="text-3xl mb-2">🧾</div>
          Click items from left to add them here
        </div>
      ) : (
        <>
          <div className="shrink-0 mb-3">
            <div className="font-semibold text-[#1f3a8a] mb-2">Selected Items ({items.length})</div>
            <div className="flex flex-wrap gap-1">
              {visibleItems.map((it)=> (
                <span key={it.id} className="chip text-xs flex items-center gap-1">
                  {it.name}
                  <button type="button" className="opacity-60 hover:opacity-100" onClick={()=>removeRow(it.id)}>&times;</button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {visibleItems.map((it, idx)=> renderItemDetail(it, idx))}
          </div>
        </>
      )}
    </div>
  </div>
</div>

{/* BOTTOM - Billing Summary + Payment */}
<div className="shrink-0 grid grid-cols-2 gap-3">
  <div className="card card-red">
    <div className="title mb-3">Billing Summary</div>
    <div className="flex items-center justify-between text-sm mb-1">
      <span className="opacity-70">Subtotal</span>
      <span className="font-semibold">PKR {subtotal.toFixed(2)}</span>
    </div>
    <div className="flex items-center justify-between text-sm mb-1">
      <span className="opacity-70">Previous Pending</span>
      <span className="font-semibold">PKR {prevDue.toFixed(2)}</span>
    </div>
    <div className="flex items-center justify-between text-lg font-bold text-[#1f3a8a] border-t pt-2 mt-2">
      <span>Total</span>
      <span>PKR {grandTotal.toFixed(2)}</span>
    </div>
  </div>

  <div className="card card-red">
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="text-xs opacity-80">Amount Received (PKR)</label>
        <input className="input text-sm" value={received} onChange={e=>setReceived(e.target.value)} />
      </div>
      <div>
        <label className="text-xs opacity-80">Pending After Payment</label>
        <div className="input text-sm text-right font-bold" style={{backgroundColor: '#fef2f2', color: '#dc2626'}}>
          PKR {pendingAfterPayment.toFixed(2)}
        </div>
      </div>
    </div>
    <button className="btn btn-red mt-3 w-full text-base" onClick={saveInvoice}>Generate Invoice</button>
  </div>
</div>
</div>
    </div>
  );
}
