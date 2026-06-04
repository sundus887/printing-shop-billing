import React, { useEffect, useMemo, useState } from 'react';

export default function CreditBook(){
  const [persons, setPersons] = useState([]);
  const [form, setForm] = useState({ person:'', type:'borrow', amount:'', date: new Date().toISOString().slice(0,10), note:'' });
  const [selected, setSelected] = useState('');
  const [range, setRange] = useState({ from:'', to:'' });
  const [ledger, setLedger] = useState(null);

  const loadPersons = async ()=>{ const list = await window.api.creditPersons(); setPersons(list||[]); };
  const loadLedger = async (p = selected)=>{
    if (!p) { setLedger(null); return; }
    const res = await window.api.creditLedger(p, range.from||null, range.to||null);
    setLedger(res);
  };
  useEffect(()=>{ loadPersons(); }, []);
  useEffect(()=>{ if (selected) loadLedger(selected); }, [selected, range.from, range.to]);

  const submit = async ()=>{
    if (!form.person || !form.amount || !form.date) { alert('Name, Amount and Date are required'); return; }
    await window.api.addCredit({ person: form.person, type: form.type, amount: parseFloat(form.amount)||0, date: form.date, note: form.note });
    setForm({ person:'', type:'borrow', amount:'', date:new Date().toISOString().slice(0,10), note:'' });
    await loadPersons();
    if (selected) await loadLedger(selected);
  };

  const total = useMemo(()=>{
    if (!ledger) return { borrowed:0, repaid:0, balance:0 };
    return { borrowed: ledger.borrowed||0, repaid: ledger.repaid||0, balance: ledger.balance||0 };
  }, [ledger]);

  const overview = useMemo(()=>{
    const list = persons || [];
    const borrowed = list.reduce((s,p)=> s + (Number(p.borrowed)||0), 0);
    const repaid = list.reduce((s,p)=> s + (Number(p.repaid)||0), 0);
    const balance = list.reduce((s,p)=> s + (Number(p.balance)||0), 0);
    return { count: list.length, borrowed, repaid, balance };
  }, [persons]);

  const exportPDF = () => {
    if (!selected || !ledger || !Array.isArray(ledger.rows) || ledger.rows.length===0) { alert('Select a person and load ledger first'); return; }
    const rowsHtml = (ledger.rows||[]).map(r=>`
      <tr>
        <td>${r.date||''}</td>
        <td>${(r.type||'').toUpperCase()}</td>
        <td>${r.note||''}</td>
        <td style="text-align:right;">${Number(r.borrow||0).toLocaleString()}</td>
        <td style="text-align:right;">${Number(r.repay||0).toLocaleString()}</td>
        <td style="text-align:right;">${Number(r.balance||0).toLocaleString()}</td>
      </tr>
    `).join('');
    const rangeText = (range.from||range.to) ? `${range.from||'Start'} → ${range.to||'End'}` : 'Full history';
    const today = new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = `<!doctype html>
    <html><head><meta charset="utf-8"/>
    <title>Credit Ledger - ${selected}</title>
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
      .red{ color:#d32f2f; }
      .green{ color:#2e7d32; }
      .blue{ color:var(--accent); }
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
          <div class="title-ledger">CREDIT LEDGER</div>
          <div class="subtitle">Borrow & Repayment Statement</div>
        </div>
        <div class="info-grid">
          <div class="left">
            <div><strong>Person:</strong> ${selected}</div>
            <div><strong>Period:</strong> ${rangeText}</div>
          </div>
          <div class="right">
            <div><strong>Date:</strong> ${today}</div>
            <div><strong>Transactions:</strong> ${(ledger.rows||[]).length}</div>
          </div>
        </div>
        <div class="kpis">
          <div class="k"><div class="label">Total Borrowed</div><div class="value red">PKR ${Number(total.borrowed).toLocaleString()}</div></div>
          <div class="k"><div class="label">Total Repaid</div><div class="value green">PKR ${Number(total.repaid).toLocaleString()}</div></div>
          <div class="k" style="border:2px solid var(--accent); background:var(--light);"><div class="label">Balance Due</div><div class="value ${total.balance > 0 ? 'red' : 'green'}">PKR ${Number(total.balance).toLocaleString()}</div></div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Note</th><th class="right">Borrow</th><th class="right">Repay</th><th class="right">Balance</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="stamp"><div class="stamp-line">Authorized Signature</div></div>
        <div class="footer">
          <div>This is a computer-generated credit ledger statement.</div>
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
    win.document.open(); win.document.write(html); win.document.close();
    setTimeout(()=>{
      try{
        win.focus();
        const dlBtn = win.document.getElementById('downloadBtn');
        if (dlBtn) dlBtn.addEventListener('click', async (e)=>{
          e.preventDefault();
          try{
            const res = await window.api.savePDF(`${html}`, `credit_ledger_${selected.replace(/[^a-z0-9_-]+/gi,'_')}.pdf`);
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

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold section-accent">Credit Book</div>
          <div className="opacity-70 text-sm">Track borrow and repayments per person</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card neon-blue">
          <div className="text-xs opacity-70">People</div>
          <div className="text-2xl font-semibold">{overview.count}</div>
          <div className="text-[11px] opacity-70">Active records</div>
        </div>
        <div className="card neon-green">
          <div className="text-xs opacity-70">Total Borrowed</div>
          <div className="text-2xl font-semibold">PKR {Number(overview.borrowed).toLocaleString()}</div>
        </div>
        <div className="card neon-red">
          <div className="text-xs opacity-70">Total Repaid</div>
          <div className="text-2xl font-semibold">PKR {Number(overview.repaid).toLocaleString()}</div>
        </div>
        <div className="card neon-blue">
          <div className="text-xs opacity-70">Total Balance</div>
          <div className="text-2xl font-semibold">PKR {Number(overview.balance).toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="title mb-3">Add Entry</div>
          <div className="space-y-3">
            <div>
              <label className="text-sm opacity-80">Person Name *</label>
              <input className="input w-full" value={form.person} onChange={e=>setForm({...form, person:e.target.value})} placeholder="e.g., Ali" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-80">Type</label>
                <select className="input w-full" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}>
                  <option value="borrow">Borrow (Udhar)</option>
                  <option value="repay">Repay (Wapsi)</option>
                </select>
              </div>
              <div>
                <label className="text-sm opacity-80">Amount (PKR) *</label>
                <input className="input w-full" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-80">Date *</label>
                <input type="date" className="input w-full" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
              </div>
              <div>
                <label className="text-sm opacity-80">Note</label>
                <input className="input w-full" value={form.note} onChange={e=>setForm({...form, note:e.target.value})} placeholder="Optional" />
              </div>
            </div>
            <div className="flex justify-end"><button className="btn" onClick={submit}>Save</button></div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="title">People</div>
            <span className="chip chip-blue">{persons.length} total</span>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <input className="input flex-1 min-w-[180px]" placeholder="Search name" onChange={e=>setSelected(e.target.value)} value={selected} />
              <button className="btn" onClick={()=>loadLedger(selected)}>View</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-auto">
              {persons.map(p=> (
                <div key={p.name} className={`list-item flex items-center justify-between ${selected===p.name? 'bg-[rgba(31,58,138,0.04)]':''}`} onClick={()=>setSelected(p.name)} style={{cursor:'pointer'}}>
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs opacity-70">Borrowed: PKR {Number(p.borrowed||0).toLocaleString()} • Repaid: PKR {Number(p.repaid||0).toLocaleString()}</div>
                  </div>
                  <div className="chip">Balance: PKR {Number(p.balance||0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="title">Ledger {selected?`• ${selected}`:''}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" className="input min-w-[140px]" value={range.from} onChange={e=>setRange(r=>({...r,from:e.target.value}))} />
              <input type="date" className="input min-w-[140px]" value={range.to} onChange={e=>setRange(r=>({...r,to:e.target.value}))} />
              <button className="btn" onClick={exportPDF} disabled={!ledger || !selected}>Export PDF</button>
            </div>
          </div>
          {!selected ? (
            <div className="text-sm opacity-70">Select a person to view ledger.</div>
          ) : !ledger ? (
            <div className="text-sm opacity-70">Loading…</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="card neon-green"><div className="text-xs opacity-70">Total Borrowed</div><div className="text-2xl font-semibold">PKR {Number(total.borrowed).toLocaleString()}</div></div>
                <div className="card neon-red"><div className="text-xs opacity-70">Total Repaid</div><div className="text-2xl font-semibold">PKR {Number(total.repaid).toLocaleString()}</div></div>
                <div className="card neon-blue"><div className="text-xs opacity-70">Balance (Due)</div><div className="text-2xl font-semibold">PKR {Number(total.balance).toLocaleString()}</div></div>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Note</th>
                      <th className="text-right p-2">Borrow</th>
                      <th className="text-right p-2">Repay</th>
                      <th className="text-right p-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.rows.map((r,idx)=> (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{r.date}</td>
                        <td className="p-2">
                          <span className={`badge ${r.type==='borrow' ? 'badge-red' : 'badge-green'}`}>{r.type==='borrow' ? 'Borrow' : 'Repay'}</span>
                        </td>
                        <td className="p-2">{r.note||''}</td>
                        <td className="p-2 text-right">{Number(r.borrow||0).toLocaleString()}</td>
                        <td className="p-2 text-right">{Number(r.repay||0).toLocaleString()}</td>
                        <td className="p-2 text-right">{Number(r.balance||0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
