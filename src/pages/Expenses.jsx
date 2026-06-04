import React, { useEffect, useMemo, useState } from 'react';

export default function Expenses(){
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: '',
    date: new Date().toISOString().slice(0,10),
    vendor: '',
    method: 'Cash',
    notes: '',
  });

  const load = async () => {
    const list = await window.api.getExpenses({});
    setExpenses(list || []);
  };
  useEffect(()=>{ load(); }, []);

  const total = useMemo(()=> expenses.reduce((s,e)=> s + (parseFloat(e.amount)||0), 0), [expenses]);
  const thisMonth = useMemo(()=>{
    const ym = new Date().toISOString().slice(0,7);
    return expenses.filter(e => (e.date||'').startsWith(ym)).reduce((s,e)=>s+(parseFloat(e.amount)||0),0)
  }, [expenses]);
  const avg = useMemo(()=> expenses.length ? Math.round((total/expenses.length)*100)/100 : 0, [total, expenses.length]);

  const byCategory = useMemo(()=>{
    const map = {};
    for(const e of expenses){
      const raw = (e.category||'').trim();
      const cat = raw.toLowerCase() === 'other' ? '' : raw;
      if (!cat) continue; // ignore uncategorized or legacy 'other'
      map[cat] = (map[cat]||0)+(parseFloat(e.amount)||0);
    }
    return Object.entries(map).map(([k,v])=>({ name:k, amount:v })).sort((a,b)=>b.amount-a.amount);
  }, [expenses]);

  const submit = async () => {
    if (!form.title || !form.amount || !form.date) return alert('Title, Amount and Date are required');
    await window.api.addExpense({
      title: form.title,
      amount: parseFloat(form.amount)||0,
      date: form.date,
      category: '',
      notes: form.notes ? `${form.notes}${form.vendor?` | Vendor: ${form.vendor}`:''}${form.method?` | Method: ${form.method}`:''}` : `${form.vendor?`Vendor: ${form.vendor}`:''} ${form.method?`| Method: ${form.method}`:''}`.trim(),
    });
    setForm({ title:'', amount:'', category:'', date:new Date().toISOString().slice(0,10), vendor:'', method:'Cash', notes:'' });
    load();
  };

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold section-accent">Expenses</div>
          <div className="opacity-70 text-sm">Professional printing business management system</div>
        </div>
        <div className="flex items-center gap-2"></div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card neon-red">
          <div className="text-xs opacity-70">Total Expenses</div>
          <div className="text-2xl font-semibold">PKR {total.toLocaleString()}</div>
          <div className="text-[11px] opacity-70">All categories</div>
        </div>
        <div className="card neon-blue">
          <div className="text-xs opacity-70">Total Records</div>
          <div className="text-2xl font-semibold">{expenses.length}</div>
          <div className="text-[11px] opacity-70">Expense entries</div>
        </div>
        <div className="card neon-green">
          <div className="text-xs opacity-70">This Month</div>
          <div className="text-2xl font-semibold">PKR {thisMonth.toLocaleString()}</div>
          <div className="text-[11px] opacity-70">{new Date().toLocaleString(undefined,{ month:'long', year:'numeric' })}</div>
        </div>
        <div className="card neon-red">
          <div className="text-xs opacity-70">Average</div>
          <div className="text-2xl font-semibold">PKR {avg.toLocaleString()}</div>
          <div className="text-[11px] opacity-70">Per expense</div>
        </div>
      </div>

      {/* Add New Expense */}
      <div className="card card-red">
        <div className="flex items-center justify-between mb-4">
          <div className="title">Add New Expense</div>
          <span className="chip">Create Mode</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm opacity-80">Expense Title *</label>
            <input className="input" placeholder="e.g., Office supplies purchase" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} />
          </div>
          <div>
            <label className="text-sm opacity-80">Amount (PKR) *</label>
            <input className="input" placeholder="0" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} />
          </div>
          
          <div>
            <label className="text-sm opacity-80">Payment Method</label>
            <select className="input" value={form.method} onChange={e=>setForm({...form,method:e.target.value})}>
              <option>Cash</option>
              <option>Card</option>
              <option>Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="text-sm opacity-80">Date *</label>
            <input type="date" className="input" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
          </div>
          <div>
            <label className="text-sm opacity-80">Vendor/Supplier</label>
            <input className="input" placeholder="e.g., Office Supplies Store" value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm opacity-80">Description (Optional)</label>
            <textarea className="input textarea" placeholder="Additional details about this expense..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}></textarea>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn btn-red" onClick={submit}>Add Expense</button>
          </div>
        </div>
      </div>

      {/* Category breakdown (hidden if all entries are uncategorized) */}
      {byCategory.length > 0 && (
        <div className="card card-red">
          <div className="flex items-center justify-between mb-3">
            <div className="title">Category Breakdown</div>
            <span className="chip">Summary View</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {byCategory.map((c)=> (
              <div key={c.name} className="list-item flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs opacity-70">{expenses.filter(e=> (e.category||'').trim()===c.name).length} items</div>
                </div>
                <div className="title">PKR {c.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All expenses list */}
      <div className="card card-red">
        <div className="flex items-center justify-between mb-3">
          <div className="title">All Expenses ({expenses.length})</div>
          <div className="chip">PKR {total.toLocaleString()}</div>
        </div>
        <div className="space-y-3">
          {expenses.map((e)=> (
            <div key={e.id} className="list-item">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {(e.category && String(e.category).toLowerCase()!=='other') ? <span className="badge badge-blue">{String(e.category).toUpperCase()}</span> : null}
                    <span className="font-medium">{e.title}</span>
                  </div>
                  {e.notes ? <div className="text-xs opacity-70 mt-1">{e.notes}</div> : null}
                  <div className="text-xs opacity-70">Date: {e.date}</div>
                </div>
                <div className="text-right">
                  <div className="title">PKR {Number(e.amount||0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
