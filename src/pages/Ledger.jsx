import React, { useEffect, useMemo, useState } from 'react';

export default function Ledger(){
  const [customers, setCustomers] = useState([]);
  const [customerCategory, setCustomerCategory] = useState(''); // Walk-in | Individual | Business
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [ledger, setLedger] = useState(null); // { rows, total_billed, total_paid, total_due }

  // Payment modal state
  const [payModal, setPayModal] = useState({ open: false, customer: null });
  const [payForm, setPayForm] = useState({ amount: '', date: new Date().toISOString().slice(0,10), method: 'Cash', notes: '' });
  const [paySaving, setPaySaving] = useState(false);

  useEffect(()=>{ window.api.getCustomers().then(setCustomers); }, []);

  const filteredCustomers = useMemo(()=>{
    if (!customerCategory || customerCategory==='Walk-in') return [];
    return customers.filter(c=> (c.category||'').toLowerCase() === customerCategory.toLowerCase());
  }, [customers, customerCategory]);

  const loadLedger = async (cid = selectedCustomer, p = period) => {
    if (!cid && customerCategory!=='Walk-in') { setLedger(null); return; }
    const idToUse = (customerCategory==='Walk-in') ? 'walkin' : parseInt(cid,10);
    const res = await window.api.getLedger(idToUse, p.from || null, p.to || null);
    setLedger(res);
  };

  // Load all customer summaries (and allow reload)
  const [summaries, setSummaries] = useState([]);
  const [summariesVersion, setSummariesVersion] = useState(0);
  const reloadSummaries = () => setSummariesVersion(v => v + 1);

  useEffect(()=>{
    (async () => {
      const arr = [];
      for (const c of customers) {
        const l = await window.api.getLedger(c.id, null, null);
        const prevBalance = Number(c.previous_balance) || 0;
        const billed = l.total_billed || 0;
        const paid = l.total_paid || 0;
        const due = prevBalance + billed - paid;
        arr.push({
          id: c.id,
          name: c.name,
          category: c.category || '',
          billed: billed,
          paid: paid,
          due: due,
          previousBalance: prevBalance,
          transactions: (l.rows||[]).length,
        });
      }
      // Sort by due descending so customers with outstanding balances appear first
      arr.sort((a,b) => b.due - a.due);
      setSummaries(arr);
    })();
  }, [customers, summariesVersion]);

  // Open payment modal for a customer
  const openPayModal = (customer) => {
    setPayModal({ open: true, customer });
    setPayForm({ amount: '', date: new Date().toISOString().slice(0,10), method: 'Cash', notes: '' });
  };
  const closePayModal = () => setPayModal({ open: false, customer: null });

  // Save payment
  const handleSavePayment = async () => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    setPaySaving(true);
    try {
      await window.api.addPayment({
        customer_id: payModal.customer.id,
        invoice_id: null,
        amount: amt,
        date: payForm.date,
        method: payForm.method,
        notes: payForm.notes || '',
      });
      // Reload everything so due/paid updates everywhere
      reloadSummaries();
      if (selectedCustomer) loadLedger();
      closePayModal();
    } catch (err) {
      alert('Failed to save payment: ' + (err.message || err));
    } finally {
      setPaySaving(false);
    }
  };

  // Click customer summary -> select that customer for detailed view
  const handleSummaryClick = (s) => {
    // Find category of this customer
    const cust = customers.find(c => c.id === s.id);
    if (!cust) return;
    setCustomerCategory(cust.category || 'Individual');
    setSelectedCustomer(String(s.id));
  };

  const exportPDF = () => {
    if (!selectedCustomer) { alert('Please select a customer first.'); return; }
    if (!ledger || !Array.isArray(ledger.rows) || ledger.rows.length === 0){ alert('No data to export for this selection.'); return; }
    const cust = customerCategory==='Walk-in' ? null : customers.find(c=> String(c.id)===String(selectedCustomer));
    const custName = customerCategory==='Walk-in' ? 'Walk-in' : (cust?.name || 'Customer');
    const custPhone = cust?.phone || '';
    const rangeText = (period.from||period.to) ? `${period.from||'Start'} → ${period.to||'End'}` : 'Full history';
    const today = new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });
    const prevBal = ledger.previous_balance || 0;

    const rowsHtml = ledger.rows.map(r=>`
      <tr>
        <td>${r.date||''}</td>
        <td>${(r.type||'').toUpperCase()}</td>
        <td>${r.ref||''}</td>
        <td style="text-align:right;">${Number(r.debit||0).toLocaleString()}</td>
        <td style="text-align:right;">${Number(r.credit||0).toLocaleString()}</td>
        <td style="text-align:right; font-weight:600;">${Number(r.balance||0).toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `<!doctype html>
    <html><head><meta charset="utf-8"/>
    <title>Ledger - ${custName}</title>
    <style>
      :root{ --accent:#1f3a8a; --light:#f0f4ff; --text:#0f172a; }
      body{ font-family: Arial, sans-serif; color:var(--text); background:#fff; padding:24px; }
      .paper{ width:210mm; min-height:297mm; margin:0 auto; background:#fff; padding:14mm 16mm; }
      .header{ border-bottom:3px solid var(--accent); padding-bottom:8mm; margin-bottom:8mm; }
      .title-ledger{ font-size:22pt; font-weight:800; color:var(--accent); letter-spacing:.5px; }
      .subtitle{ font-size:10pt; color:#666; margin-top:2px; }
      .info-grid{ display:flex; justify-content:space-between; margin-bottom:8mm; gap:10mm; }
      .info-grid .left > div, .info-grid .right > div{ margin:2mm 0; font-size:12px; }
      .kpis{ display:flex; gap:10px; margin-bottom:8mm; flex-wrap:wrap; }
      .k{ border:1px solid #ddd; padding:10px 14px; border-radius:8px; flex:1; min-width:120px; }
      .k .label{ font-size:10px; color:#666; text-transform:uppercase; letter-spacing:.5px; }
      .k .value{ font-size:16px; font-weight:700; margin-top:2px; }
      .k.highlight{ border:2px solid var(--accent); background:var(--light); }
      .red{ color:#d32f2f; }
      .green{ color:#2e7d32; }
      table{ width:100%; border-collapse:collapse; margin-top:4mm; }
      th{ background:var(--accent); color:#fff; padding:10px 8px; font-size:11px; text-align:left; text-transform:uppercase; letter-spacing:.3px; }
      td{ border-bottom:1px solid #e5e7eb; padding:9px 8px; font-size:12px; }
      tr:nth-child(even){ background:#f9fafb; }
      .right{ text-align:right; }
      .footer{ margin-top:12mm; padding-top:6mm; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:10px; color:#888; }
      .stamp{ text-align:right; margin-top:16mm; }
      .stamp-line{ border-top:1px solid #333; width:140px; display:inline-block; padding-top:4px; font-size:11px; color:#555; }
      .no-print{ }
      @page { size: A4; margin: 0; }
      @media print{
        body{ margin:0; padding:0; background:#fff; }
        html, body { width:210mm; height:297mm; }
        .paper{ width:210mm; height:297mm; margin:0 !important; padding:14mm !important; }
        .no-print{ display:none !important; }
      }
    </style>
    </head><body>
      <div class="paper">
        <div class="header">
          <div class="title-ledger">CLIENT LEDGER</div>
          <div class="subtitle">Account Transaction Statement</div>
        </div>

        <div class="info-grid">
          <div class="left">
            <div><strong>Client:</strong> ${custName}</div>
            ${custPhone ? `<div><strong>Phone:</strong> ${custPhone}</div>` : ''}
            <div><strong>Period:</strong> ${rangeText}</div>
          </div>
          <div class="right">
            <div><strong>Date:</strong> ${today}</div>
            <div><strong>Transactions:</strong> ${ledger.rows.length}</div>
          </div>
        </div>

        <div class="kpis">
          <div class="k">
            <div class="label">Total Billed</div>
            <div class="value">PKR ${Number(ledger.total_billed||0).toLocaleString()}</div>
          </div>
          ${prevBal > 0 ? `
          <div class="k">
            <div class="label">Previous Balance</div>
            <div class="value red">PKR ${Number(prevBal).toLocaleString()}</div>
          </div>` : ''}
          <div class="k">
            <div class="label">Total Received</div>
            <div class="value green">PKR ${Number(ledger.total_paid||0).toLocaleString()}</div>
          </div>
          <div class="k highlight">
            <div class="label">Balance Due</div>
            <div class="value ${ledger.total_due > 0 ? 'red' : 'green'}">PKR ${Number(ledger.total_due||0).toLocaleString()}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Reference</th><th class="right">Debit (Bill)</th><th class="right">Credit (Paid)</th><th class="right">Balance</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <div class="stamp">
          <div class="stamp-line">Authorized Signature</div>
        </div>

        <div class="footer">
          <div>This is a computer-generated ledger statement.</div>
          <div>Generated on ${today}</div>
        </div>

        <div class="no-print" style="text-align:center; margin-top:10mm; display:flex; gap:10px; justify-content:center;">
          <button id="downloadBtn" type="button" style="padding:10px 24px; font-size:14px; border-radius:8px; border:1px solid rgba(31,58,138,0.25); background:#1f3a8a; color:#fff; cursor:pointer;">📥 Download PDF</button>
          <button id="printBtn" type="button" style="padding:10px 24px; font-size:14px; border-radius:8px; border:1px solid rgba(31,58,138,0.25); background:#fff; color:#1f3a8a; cursor:pointer;">🖨️ Print</button>
        </div>
      </div>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups to export.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(()=>{
      try{
        win.focus();
        const dlBtn = win.document.getElementById('downloadBtn');
        if (dlBtn) dlBtn.addEventListener('click', async (e)=>{
          e.preventDefault();
          try{
            const res = await window.api.savePDF(`${html}`, `ledger_${custName.replace(/[^a-z0-9_-]+/gi,'_')}.pdf`);
            if (res?.error) alert('Failed to save PDF: '+res.error);
          }catch(err){ alert('Failed to save PDF'); }
        });
        const prBtn = win.document.getElementById('printBtn');
        if (prBtn) prBtn.addEventListener('click', (e) => {
          e.preventDefault();
          win.print();
        });
      }catch{}
    }, 300);
  };

  useEffect(()=>{ if (customerCategory==='Walk-in' || selectedCustomer) loadLedger(); }, [customerCategory, selectedCustomer, period.from, period.to]);

  const kpis = useMemo(()=>{
    if (!ledger) return { revenue: 0, paid: 0, pending: 0, overdue: 0 };
    const revenue = ledger.total_billed || 0;
    const paid = ledger.total_paid || 0;
    // Include previous_balance if a specific customer is selected
    let prevBal = 0;
    if (selectedCustomer && customerCategory !== 'Walk-in') {
      const cust = customers.find(c => String(c.id) === String(selectedCustomer));
      prevBal = Number(cust?.previous_balance) || 0;
    }
    const pending = prevBal + revenue - paid;
    const overdue = pending;
    return { revenue, paid, pending, overdue };
  }, [ledger, selectedCustomer, customers, customerCategory]);

  const exportCSV = () => {
    if (!selectedCustomer) { alert('Please select a customer first.'); return; }
    if (!ledger || !Array.isArray(ledger.rows) || ledger.rows.length === 0){ alert('No data to export for this selection.'); return; }
    const custName = (customers.find(c=> String(c.id)===String(selectedCustomer))||{}).name || 'Customer';
    const headers = ['Date','Type','Reference','Debit','Credit','Balance'];
    const lines = [headers].concat(ledger.rows.map(r=>[
      r.date || '',
      r.type || '',
      r.ref || '',
      r.debit ?? 0,
      r.credit ?? 0,
      r.balance ?? 0,
    ]));
    const esc = (v)=> '"' + String(v).replace(/"/g,'""') + '"';
    const csv = lines.map(row=> row.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${custName.replace(/[^a-z0-9_-]+/gi,'_')}_ledger.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Generate customer summary receipt PDF
  const generateReceipt = (s) => {
    const cust = customers.find(c => c.id === s.id);
    const custName = s.name || 'Customer';
    const custPhone = cust?.phone || '';
    const custCategory = s.category || '';
    const today = new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });
    const receiptNo = `RCP-${Date.now().toString(36).toUpperCase()}`;

    const html = `<!doctype html>
    <html><head><meta charset="utf-8"/>
    <title>Receipt - ${custName}</title>
    <style>
      :root{ --accent:#1f3a8a; --light:#f0f4ff; --text:#0f172a; }
      body{ font-family: Arial, sans-serif; color:var(--text); background:#fff; padding:24px; }
      .paper{ width:210mm; min-height:297mm; margin:0 auto; background:#fff; padding:14mm 16mm; }
      .header{ border-bottom:3px solid var(--accent); padding-bottom:8mm; margin-bottom:8mm; }
      .title-receipt{ font-size:22pt; font-weight:800; color:var(--accent); letter-spacing:.5px; }
      .subtitle{ font-size:10pt; color:#666; margin-top:2px; }
      .info-grid{ display:flex; justify-content:space-between; margin-bottom:8mm; gap:10mm; }
      .info-grid .left > div, .info-grid .right > div{ margin:2mm 0; font-size:12px; }
      .panel{ border:1px solid #e5e7eb; border-radius:8px; padding:8mm; margin:8mm 0; }
      .panel-title{ font-size:14pt; font-weight:700; color:var(--accent); margin-bottom:6mm; padding-bottom:3mm; border-bottom:2px solid rgba(31,58,138,0.15); }
      .summary-grid{ display:grid; grid-template-columns:1fr 1fr; gap:6mm; }
      .summary-item{ border:1px solid #ddd; border-radius:8px; padding:12px 14px; background:#fafbfc; }
      .summary-item .label{ font-size:10px; color:#666; text-transform:uppercase; letter-spacing:.5px; margin-bottom:2px; }
      .summary-item .value{ font-size:16px; font-weight:700; }
      .total-row{ grid-column:1/-1; background:var(--light); border:2px solid var(--accent); border-radius:8px; padding:14px; }
      .total-row .label{ font-size:12px; color:#666; text-transform:uppercase; letter-spacing:.5px; }
      .total-row .value{ font-size:22px; font-weight:800; }
      .red{ color:#d32f2f; }
      .green{ color:#2e7d32; }
      .blue{ color:var(--accent); }
      .alert-box{ border-radius:8px; padding:12px 16px; margin-top:6mm; font-size:13px; }
      .alert-pending{ background:rgba(211,47,47,0.08); border:1px solid rgba(211,47,47,0.25); }
      .alert-clear{ background:rgba(46,125,50,0.08); border:1px solid rgba(46,125,50,0.25); }
      .footer{ margin-top:12mm; padding-top:6mm; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:10px; color:#888; }
      .stamp{ text-align:right; margin-top:16mm; }
      .stamp-line{ border-top:1px solid #333; width:140px; display:inline-block; padding-top:4px; font-size:11px; color:#555; }
      .no-print{ }
      @page { size: A4; margin: 0; }
      @media print{
        body{ margin:0; padding:0; background:#fff; }
        html, body { width:210mm; height:297mm; }
        .paper{ width:210mm; height:297mm; margin:0 !important; padding:14mm !important; }
        .no-print{ display:none !important; }
      }
    </style>
    </head><body>
      <div class="paper">
        <div class="header">
          <div class="title-receipt">CUSTOMER RECEIPT</div>
          <div class="subtitle">Account Summary Statement</div>
        </div>

        <div class="info-grid">
          <div class="left">
            <div><strong>Customer:</strong> ${custName}</div>
            ${custPhone ? `<div><strong>Phone:</strong> ${custPhone}</div>` : ''}
            <div><strong>Category:</strong> ${custCategory}</div>
          </div>
          <div class="right">
            <div><strong>Receipt #:</strong> ${receiptNo}</div>
            <div><strong>Date:</strong> ${today}</div>
            <div><strong>Transactions:</strong> ${s.transactions}</div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Account Summary</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="label">Total Billed</div>
              <div class="value blue">PKR ${s.billed.toLocaleString()}</div>
            </div>
            <div class="summary-item">
              <div class="label">Total Received</div>
              <div class="value green">PKR ${s.paid.toLocaleString()}</div>
            </div>
            ${s.previousBalance > 0 ? `
            <div class="summary-item">
              <div class="label">Previous Balance</div>
              <div class="value red">PKR ${s.previousBalance.toLocaleString()}</div>
            </div>` : ''}
            <div class="summary-item total-row">
              <div class="label">Pending / Due Amount</div>
              <div class="value ${s.due > 0 ? 'red' : 'green'}">PKR ${s.due.toLocaleString()}</div>
            </div>
          </div>
        </div>

        ${s.due > 0 ? `
        <div class="alert-box alert-pending">
          <strong style="color:#d32f2f;">⚠️ Payment Reminder:</strong>
          <span> An amount of <strong>PKR ${s.due.toLocaleString()}</strong> is still pending against this account.</span>
        </div>` : `
        <div class="alert-box alert-clear">
          <strong style="color:#2e7d32;">✅ Account Clear:</strong>
          <span> All dues have been settled. Thank you!</span>
        </div>`}

        <div class="stamp">
          <div class="stamp-line">Authorized Signature</div>
        </div>

        <div class="footer">
          <div>This is a computer-generated receipt. For any queries, please contact the shop admin.</div>
          <div>Generated on ${today}</div>
        </div>

        <div class="no-print" style="text-align:center; margin-top:10mm; display:flex; gap:10px; justify-content:center;">
          <button id="downloadBtn" type="button" style="padding:10px 24px; font-size:14px; border-radius:8px; border:1px solid rgba(31,58,138,0.25); background:#1f3a8a; color:#fff; cursor:pointer;">📥 Download PDF</button>
          <button id="printBtn" type="button" style="padding:10px 24px; font-size:14px; border-radius:8px; border:1px solid rgba(31,58,138,0.25); background:#fff; color:#1f3a8a; cursor:pointer;">🖨️ Print</button>
        </div>
      </div>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups to generate receipt.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(()=>{
      try {
        win.focus();
        const dlBtn = win.document.getElementById('downloadBtn');
        if (dlBtn) dlBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            const res = await window.api.savePDF(html, `receipt_${custName.replace(/[^a-z0-9_-]+/gi,'_')}_${receiptNo}.pdf`);
            if (res?.error) alert('Failed to save PDF: ' + res.error);
          } catch (err) { alert('Failed to save PDF'); }
        });
        const prBtn = win.document.getElementById('printBtn');
        if (prBtn) prBtn.addEventListener('click', (e) => {
          e.preventDefault();
          win.print();
        });
      } catch {}
    }, 400);
  };

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold section-accent">Client Ledger</div>
          <div className="opacity-70 text-sm">Customer transaction history</div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card neon-red">
          <div className="text-xs opacity-70">Total Revenue</div>
          <div className="text-2xl font-semibold">PKR {kpis.revenue.toLocaleString()}</div>
          <div className="text-[11px] opacity-70">All transactions</div>
        </div>
        <div className="card neon-red">
          <div className="text-xs opacity-70">Paid Amount</div>
          <div className="text-2xl font-semibold">PKR {kpis.paid.toLocaleString()}</div>
          <div className="text-[11px] opacity-70">Collected revenue</div>
        </div>
        <div className="card neon-red">
          <div className="text-xs opacity-70">Pending</div>
          <div className="text-2xl font-semibold">PKR {kpis.pending.toLocaleString()}</div>
          <div className="text-[11px] opacity-70">Awaiting payment</div>
        </div>
        <div className="card neon-red">
          <div className="text-xs opacity-70">Overdue</div>
          <div className="text-2xl font-semibold">PKR {kpis.overdue.toLocaleString()}</div>
          <div className="text-[11px] opacity-70">Action required</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="text-sm opacity-80 mb-1 block">Select Customer</label>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex gap-2">
                {['Walk-in','Individual','Business'].map(cat=> (
                  <button key={cat} className={`chip ${customerCategory===cat? 'tab-active':''}`} onClick={()=>{ setCustomerCategory(cat); setSelectedCustomer(''); setLedger(null); }}>
                    {cat}
                  </button>
                ))}
              </div>
              {customerCategory==='Walk-in' ? (
                <div className="chip self-end">Walk-in</div>
              ) : (
                <select className="input flex-1 min-w-[240px] self-end" value={selectedCustomer} onChange={e=>setSelectedCustomer(e.target.value)} disabled={!customerCategory}>
                  {(!selectedCustomer) ? <option value="" disabled hidden>Choose a customer…</option> : null}
                  {filteredCustomers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            {!customerCategory && (
              <div className="text-xs opacity-70 mt-1">Please select a category first.</div>
            )}
          </div>
          <div>
            <label className="text-sm opacity-80">From</label>
            <input type="date" className="input" value={period.from} onChange={e=>setPeriod(p=>({...p,from:e.target.value}))} />
          </div>
          <div>
            <label className="text-sm opacity-80">To</label>
            <input type="date" className="input" value={period.to} onChange={e=>setPeriod(p=>({...p,to:e.target.value}))} />
          </div>
        </div>
      </div>

      {/* Customer Summary grid */}
      {summaries.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="title">Customer Summary</div>
            <span className="chip">{summaries.length} Customers</span>
          </div>
          {summaries.length === 0 ? (
            <div className="text-sm opacity-70">No customers yet. Add customers to see their balances here.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {summaries.map(s => (
                <div key={s.id} className="list-item cursor-pointer hover:shadow-md transition" onClick={() => handleSummaryClick(s)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="badge badge-blue">{(s.name||'?').toUpperCase().slice(0,1)}</span>
                        <span className="font-medium">{s.name}</span>
                      </div>
                      <div className="text-xs opacity-70 mt-1">Transactions: {s.transactions}</div>
                    </div>
                    <div className="text-right text-xs space-y-0.5">
                      <div>
                        <span className="opacity-70">Total Bill:</span>
                        <span className="font-semibold ml-1">PKR {s.billed.toLocaleString()}</span>
                      </div>
                      {s.previousBalance > 0 && (
                        <div>
                          <span className="opacity-70">Previous Balance:</span>
                          <span className="font-semibold ml-1 text-[#d32f2f]">PKR {s.previousBalance.toLocaleString()}</span>
                        </div>
                      )}
                      <div>
                        <span className="opacity-70">Total Received:</span>
                        <span className="font-semibold ml-1" style={{color: '#2e7d32'}}>PKR {s.paid.toLocaleString()}</span>
                      </div>
                      <div className="pt-1 border-t border-[rgba(31,58,138,0.10)]">
                        <span className="opacity-70">Pending Amount:</span>
                        <span className="font-bold ml-1" style={{color: s.due > 0 ? '#d32f2f' : '#2e7d32'}}>
                          PKR {s.due.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Record Payment button */}
                  {s.due > 0 && (
                    <button
                      className="btn btn-green w-full mt-3 text-xs py-1"
                      onClick={(e) => { e.stopPropagation(); openPayModal({ id: s.id, name: s.name, due: s.due }); }}
                    >
                      💰 Record Payment
                    </button>
                  )}
                  {/* Generate Receipt button */}
                  <button
                    className="btn w-full mt-2 text-xs py-1"
                    style={{ background: 'rgba(31,58,138,0.08)', border: '1px solid rgba(31,58,138,0.25)', color: '#1f3a8a' }}
                    onClick={(e) => { e.stopPropagation(); generateReceipt(s); }}
                  >
                    🧾 Generate Receipt
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transaction History */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="title">Transaction History {ledger?.rows ? `(${ledger.rows.length})` : ''}</div>
          <button className="btn" onClick={exportPDF}>Export PDF</button>
        </div>
        {!selectedCustomer ? (
          <div className="text-sm opacity-70">Select a customer to view detailed transaction history.</div>
        ) : !ledger ? (
          <div className="text-sm opacity-70">Loading…</div>
        ) : (
          <div className="space-y-3">
            {ledger.rows.map((r, idx) => (
              <div key={idx} className="list-item">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${r.type==='invoice' ? 'badge-red' : 'badge-green'}`}>{r.type.toUpperCase()}</span>
                      <span className="text-xs opacity-70">{r.date}</span>
                    </div>
                    <div className="text-xs opacity-70 mt-1">Ref: {r.ref}</div>
                  </div>
                  <div className="text-right">
                    {r.type==='invoice' ? (
                      <>
                        <div className="text-xs opacity-70">Debit</div>
                        <div className="title">PKR {Number(r.debit||r.amount||0).toLocaleString()}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs opacity-70">Credit</div>
                        <div className="title">PKR {Number(r.credit||r.amount||0).toLocaleString()}</div>
                      </>
                    )}
                    <div className="text-xs opacity-70">Balance: PKR {Number(r.balance||0).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {payModal.open && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md text-[#1f3a8a] border border-[rgba(31,58,138,0.15)]">
            <div className="text-lg font-semibold mb-1">💰 Record Payment</div>
            <div className="text-sm opacity-70 mb-4">
              Customer: <strong>{payModal.customer?.name}</strong>
              {payModal.customer?.due > 0 && (
                <span className="ml-2 text-[#d32f2f] font-semibold">
                  (Due: PKR {Number(payModal.customer.due).toLocaleString()})
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm opacity-80 block mb-1">Amount (PKR) *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input w-full"
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="Enter amount paid"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm opacity-80 block mb-1">Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={payForm.date}
                  onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm opacity-80 block mb-1">Payment Method</label>
                <select
                  className="input w-full"
                  value={payForm.method}
                  onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="EasyPaisa">EasyPaisa</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm opacity-80 block mb-1">Notes (optional)</label>
                <input
                  type="text"
                  className="input w-full"
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g., Paid for invoice INV-001"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={closePayModal}
                className="px-4 py-2 rounded-lg border border-[rgba(31,58,138,0.25)] hover:bg-[rgba(31,58,138,0.06)]"
                disabled={paySaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePayment}
                className="btn btn-green"
                disabled={paySaving}
              >
                {paySaving ? '⏳ Saving...' : '✅ Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
