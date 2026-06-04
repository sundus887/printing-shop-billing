import React, { useEffect, useMemo, useState } from 'react';

export default function Customers(){
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [activeTab, setActiveTab] = useState('walkin'); // walkin | individual | business
  const [pending, setPending] = useState(0);

  const [form, setForm] = useState({
    name: '', // full or business name
    phone: '',
    email: '',
    address: '',
    notes: '',
    contact: '', // for business
    previous_balance: '', // optional previous balance
  });

  const load = async () => {
    const list = await window.api.getCustomers();
    setCustomers(list || []);
    try{
      const invs = await window.api.getInvoices();
      setInvoices(invs || []);
    }catch{}
  };

  useEffect(()=>{ load(); }, []);

  const counts = useMemo(()=>{
    let business=0, individual=0, walkin=0;
    const infer = (c)=>{
      if (c.category) return c.category; // use saved category when present
      const n = (c.name||'').toLowerCase();
      if(n.includes('walk')) return 'Walk-in';
      if(n.includes('ltd') || n.includes('company') || n.includes('co ')) return 'Business';
      return 'Individual';
    };
    for(const c of customers){
      const cat = infer(c);
      if(cat==='Business') business++;
      else if(cat==='Walk-in') walkin++;
      else individual++;
    }
    return { business, individual, walkin };
  }, [customers]);

  const onSubmit = async () => {
    if(!form.name) return alert('Name is required');
    const category = activeTab==='walkin' ? 'Walk-in' : (activeTab==='business' ? 'Business' : 'Individual');
    await window.api.addCustomer({
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
      category,
      previous_balance: parseFloat(form.previous_balance) || 0,
    });
    setForm({ name:'', phone:'', email:'', address:'', notes:'', contact:'', previous_balance:'' });
    load();
  };

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold section-accent">Add Customer</div>
          <div className="opacity-70 text-sm">Professional printing business management system</div>
        </div>
        <div className="flex items-center gap-2"></div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card neon-green">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-70">Walk-in Customers</div>
              <div className="text-2xl font-semibold">{counts.walkin}</div>
              <div className="text-[11px] opacity-70">Quick service clients</div>
            </div>
            <div className="badge badge-green">WALK IN</div>
          </div>
        </div>
        <div className="card neon-blue">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-70">Individual</div>
              <div className="text-2xl font-semibold">{counts.individual}</div>
              <div className="text-[11px] opacity-70">Personal accounts</div>
            </div>
            <div className="badge badge-blue">INDIVIDUAL</div>
          </div>
        </div>
        <div className="card neon-red">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-70">Business</div>
              <div className="text-2xl font-semibold">{counts.business}</div>
              <div className="text-[11px] opacity-70">Corporate clients</div>
            </div>
            <div className="badge badge-red">BUSINESS</div>
          </div>
        </div>
      </div>

      {/* Add New Customer */}
      <div className="card card-red">
        <div className="flex items-center justify-between mb-3">
          <div className="title">Add New Customer</div>
          
        </div>
        <div className="tabs mb-4">
          <button className={`tab ${activeTab==='walkin' ? 'tab-active' : ''}`} onClick={()=>setActiveTab('walkin')}>Walk-in Customer</button>
          <button className={`tab ${activeTab==='individual' ? 'tab-active' : ''}`} onClick={()=>setActiveTab('individual')}>Individual Customer</button>
          <button className={`tab ${activeTab==='business' ? 'tab-active' : ''}`} onClick={()=>setActiveTab('business')}>Business Customer</button>
        </div>

        {/* Form Fields */}
        {activeTab === 'walkin' ? (
          <div className="p-3 text-sm opacity-80">
            You don't need to add Walk-in customers here. On the Invoice page, select <span className="chip">Walk-in</span> and create invoices directly.
          </div>
        ) : activeTab !== 'business' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm opacity-80">Full Name *</label>
              <input className="input" placeholder="Enter full name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
            </div>
            <div>
              <label className="text-sm opacity-80">Phone Number *</label>
              <input className="input" placeholder="+92 300 1234567" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm opacity-80">Address (optional)</label>
              <input className="input" placeholder="Street, City" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
            </div>
            <div>
              <label className="text-sm opacity-80">Previous Balance (optional)</label>
              <input type="number" className="input" placeholder="0" value={form.previous_balance} onChange={e=>setForm({...form, previous_balance:e.target.value})} />
              <div className="text-[11px] opacity-60 mt-1">Unpaid amount from before</div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm opacity-80">Notes (optional)</label>
              <textarea className="input textarea" placeholder="Notes" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}></textarea>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button className="btn btn-red" onClick={onSubmit}>Add Customer</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm opacity-80">Business Name *</label>
              <input className="input" placeholder="Company/Business name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
            </div>
            <div>
              <label className="text-sm opacity-80">Contact Person *</label>
              <input className="input" placeholder="Contact person name" value={form.contact} onChange={e=>setForm({...form, contact:e.target.value})} />
            </div>
            <div>
              <label className="text-sm opacity-80">Phone Number *</label>
              <input className="input" placeholder="+92 300 1234567" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
            </div>
            <div>
              <label className="text-sm opacity-80">Email (optional)</label>
              <input className="input" placeholder="email@company.com" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm opacity-80">Address (optional)</label>
              <input className="input" placeholder="Address" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
            </div>
            <div>
              <label className="text-sm opacity-80">Previous Balance (optional)</label>
              <input type="number" className="input" placeholder="0" value={form.previous_balance} onChange={e=>setForm({...form, previous_balance:e.target.value})} />
              <div className="text-[11px] opacity-60 mt-1">Unpaid amount from before</div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm opacity-80">Notes (optional)</label>
              <textarea className="input textarea" placeholder="Notes" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}></textarea>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button className="btn btn-red" onClick={onSubmit}>Add Customer</button>
            </div>
          </div>
        )}
      </div>

      {/* Customer List */}
      <div className="card card-red">
        <div className="flex items-center justify-between mb-3">
          <div className="title">Customer List</div>
          <span className="chip chip-blue">{customers.length} customers</span>
        </div>
        <div className="space-y-3">
          {customers.map((c) => (
            <div key={c.id} className="list-item list-item-red">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs opacity-70">{c.phone || 'No phone'} {c.email ? `• ${c.email}` : ''}</div>
                  <div className="text-[11px] opacity-70 mt-1">Category: {c.category || ((c.name||'').toLowerCase().includes('walk') ? 'Walk-in' : ((c.name||'').toLowerCase().includes('ltd') || (c.name||'').toLowerCase().includes('company') || (c.name||'').toLowerCase().includes('co ')) ? 'Business' : 'Individual')}</div>
                  {c.previous_balance > 0 && (
                    <div className="text-xs text-[#d32f2f] font-semibold mt-1">
                      Previous Balance: PKR {Number(c.previous_balance).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="chip">{c.created_at}</div>
                  <button className="btn" onClick={async ()=>{
                    if(!confirm(`Delete customer "${c.name}"? This will remove their invoices and payments too.`)) return;
                    await window.api.removeCustomer(c.id);
                    load();
                  }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
