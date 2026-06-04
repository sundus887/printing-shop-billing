import React, { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import InvoiceEditor from './pages/InvoiceEditor'
import Expenses from './pages/Expenses'
import Ledger from './pages/Ledger'
import Reports from './pages/Reports'
import CreditBook from './pages/CreditBook'
import MachineId from './pages/MachineId'
import Products from './pages/Products'
import DataMigration from './pages/DataMigration'
import ActivationScreen from './pages/ActivationScreen'
import Branding from './pages/Branding'

// Theme-aligned minimal SVG icons (use currentColor for navy)
function IconDashboard(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IconUsers(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconReceipt(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3h16v18l-3-2-3 2-3-2-3 2-4-2V3z"/>
      <path d="M8 8h8"/>
      <path d="M8 12h8"/>
    </svg>
  );
}
function IconCard(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20"/>
    </svg>
  );
}
function IconLedger(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v15.5z"/>
      <path d="M8 7h8"/>
      <path d="M8 11h8"/>
      <path d="M8 15h6"/>
    </svg>
  );
}
function IconChart(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/>
      <path d="M7 15l5-5 4 4 5-6"/>
    </svg>
  );
}
function IconKey(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5"/>
      <path d="M21 2l-9.6 9.6"/>
      <path d="M15.5 7.5l3 3L22 7l-3-3"/>
    </svg>
  );
}
function IconBox(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/>
      <path d="M12 22V12"/>
    </svg>
  );
}
function IconTransfer(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <path d="M7 23l-4-4 4-4"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}
function IconBranding(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  );
}

function Sidebar({ expired, onNavBlocked }){
  const { pathname } = useLocation();
  const nav = [
    { path:'/dashboard', label:'Dashboard', icon:<IconDashboard/> },
    { path:'/customers', label:'Add Customer', icon:<IconUsers/> },
    { path:'/invoice', label:'Create Invoice', icon:<IconReceipt/> },
    { path:'/products', label:'Add Product', icon:<IconBox/> },
    { path:'/expenses', label:'Expenses', icon:<IconCard/> },
    { path:'/ledger', label:'Client Ledger', icon:<IconLedger/> },
    { path:'/reports', label:'Profit & Loss', icon:<IconChart/> },
    { path:'/credit', label:'Credit Book', icon:<IconCard/> },
    { path:'/migration', label:'Data Migration', icon:<IconTransfer/> },
    { path:'/branding', label:'Shop Branding', icon:<IconBranding/> },
     { path:'/machine-id',  label:'Machine ID',     icon:<IconKey/>       },
  ];
  return (
    <aside className="w-72 p-4 border-r border-[rgba(31,58,138,0.12)] bg-[linear-gradient(180deg,#ffffff,#f6f8ff)] text-[#1f3a8a]">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl grid place-items-center text-2xl bg-[rgba(31,58,138,0.08)] border border-[rgba(31,58,138,0.20)] shadow-[0_0_16px_rgba(31,58,138,0.18)]">🖨️</div>
        <div>
          <div className="text-lg font-semibold">PrintShop Billing</div>
          <div className="text-[11px] opacity-70">Ultimate Desktop Edition</div>
          <div className="text-[11px] opacity-70">System Status: Active</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-2">
        {nav.map(item=>{
          const active = pathname.startsWith(item.path);
          const disabled = !!expired;
          const clsBase = active ? 'bg-[rgba(31,58,138,0.10)] border-[rgba(31,58,138,0.35)] shadow-[0_0_12px_rgba(31,58,138,0.18)]' : 'bg-[rgba(31,58,138,0.04)] border-[rgba(31,58,138,0.12)] hover:bg-[rgba(31,58,138,0.06)]';
          const clsDisabled = disabled ? 'opacity-60 pointer-events-auto' : '';
          const onClick = disabled ? (e)=>{ e.preventDefault(); onNavBlocked && onNavBlocked(); } : undefined;
          return (
            <Link key={item.path} to={disabled ? '#' : item.path} onClick={onClick} aria-disabled={disabled} className={`group relative flex items-center px-3 py-3 rounded-xl border transition ${clsBase} ${clsDisabled}`}>
                <span className="flex items-center gap-3">
                  <span className={`w-8 h-8 grid place-items-center rounded-lg ${active ? 'bg-[rgba(31,58,138,0.18)]' : 'bg-[rgba(31,58,138,0.08)]'}`}>
                    <span className="text-[var(--accent-600)]">{item.icon}</span>
                  </span>
                  <span className="font-medium">{item.label}</span>
                </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  );
}

export default function App() {
  const [appState, setAppState] = useState('loading'); // 'loading', 'no_license', 'valid_license', 'expired_license'
  const [lic, setLic] = useState({ valid: false, expiresAt: null });
  const [showExpired, setShowExpired] = useState(false);
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);
  const [expiringDays, setExpiringDays] = useState(0);
  const [showGrace, setShowGrace] = useState(false);
  const [graceDaysExpired, setGraceDaysExpired] = useState(0);
  const [toast, setToast] = useState(false);
  const expired = useMemo(()=>{
    if (!lic) return false;
    if (lic.expiresAt){
      const today = new Date();
      const exp = new Date(lic.expiresAt);
      if (isFinite(exp.getTime())){
        if (exp.setHours(23,59,59,999) < today.getTime()) return true;
      }
    }
    return !lic.valid;
  }, [lic]);
  const expiredDateText = useMemo(()=>{
    if (!lic?.expiresAt) return '';
    try {
      const d = new Date(lic.expiresAt);
      if (!isFinite(d.getTime())) return '';
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  }, [lic]);

  useEffect(()=>{
    let mounted = true;

    const maybeShowExpiryWarning = (days) => {
      const n = Number(days);
      if (!Number.isFinite(n)) return;
      if (n <= 0 || n > 7) return;
      try {
        const today = new Date().toISOString().slice(0, 10);
        const last = localStorage.getItem('lastWarningShown');
        if (last === today) return;
        localStorage.setItem('lastWarningShown', today);
      } catch {}
      setExpiringDays(n);
      setShowExpiringSoon(true);
    };

    const maybeShowGraceWarning = (daysExpired) => {
      const n = Number(daysExpired);
      if (!Number.isFinite(n)) return;
      if (n <= 0 || n > 3) return;
      try {
        const today = new Date().toISOString().slice(0, 10);
        const last = localStorage.getItem('lastGraceWarningShown');
        if (last === today) return;
        localStorage.setItem('lastGraceWarningShown', today);
      } catch {}
      setGraceDaysExpired(n);
      setShowGrace(true);
    };

    const load = async () => {
      try {
        const res = await window.api.licenseGet();
        const isValid = !!res.valid;
        const expiresAt = res.expiresAt || null;
        
        setLic({ valid: isValid, expiresAt });
        
        // Determine app state based on license status
        if (!isValid) {
          setAppState('no_license');
        } else if (expiresAt) {
          const today = new Date();
          const exp = new Date(expiresAt);
          if (isFinite(exp.getTime()) && exp.setHours(23,59,59,999) < today.getTime()) {
            setAppState('expired_license');
          } else {
            setAppState('valid_license');
          }
        } else {
          setAppState('valid_license');
        }
      } catch {
        setAppState('no_license');
      }

      try {
        const st = await window.api.licenseStatus?.();
        if (st && st.ok && st.license && typeof st.license.daysRemaining !== 'undefined') {
          maybeShowExpiryWarning(st.license.daysRemaining);
        }
        if (st && st.ok && st.license && st.license.inGrace === true) {
          maybeShowGraceWarning(st.license.daysExpired);
        }
      } catch {}
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(()=>{
    setShowExpired(!!expired);
  }, [expired]);

  useEffect(()=>{
    if (!expired) return;
    const id = setInterval(async ()=>{
      try {
        const res = await window.api.licenseCheck();
        setLic({ valid: !!res.valid, expiresAt: res.expiresAt || null });
      } catch {}
    }, 15000);
    return () => clearInterval(id);
  }, [expired]);

  const recheck = async ()=>{
    try {
      const res = await window.api.licenseCheck();
      const isValid = !!res.valid;
      const expiresAt = res.expiresAt || null;
      
      setLic({ valid: isValid, expiresAt });
      
      // Update app state
      if (!isValid) {
        setAppState('no_license');
      } else if (expiresAt) {
        const today = new Date();
        const exp = new Date(expiresAt);
        if (isFinite(exp.getTime()) && exp.setHours(23,59,59,999) < today.getTime()) {
          setAppState('expired_license');
        } else {
          setAppState('valid_license');
        }
      } else {
        setAppState('valid_license');
      }
    } catch {
      setAppState('no_license');
    }

    try {
      const st = await window.api.licenseStatus?.();
      if (st && st.ok && st.license && typeof st.license.daysRemaining !== 'undefined') {
        const n = Number(st.license.daysRemaining);
        if (Number.isFinite(n) && n > 0 && n <= 7) {
          try {
            const today = new Date().toISOString().slice(0, 10);
            const last = localStorage.getItem('lastWarningShown');
            if (last !== today) {
              localStorage.setItem('lastWarningShown', today);
              setExpiringDays(n);
              setShowExpiringSoon(true);
            }
          } catch {}
        }
      }

      if (st && st.ok && st.license && st.license.inGrace === true) {
        const n2 = Number(st.license.daysExpired);
        if (Number.isFinite(n2) && n2 > 0 && n2 <= 3) {
          try {
            const today = new Date().toISOString().slice(0, 10);
            const last = localStorage.getItem('lastGraceWarningShown');
            if (last !== today) {
              localStorage.setItem('lastGraceWarningShown', today);
              setGraceDaysExpired(n2);
              setShowGrace(true);
            }
          } catch {}
        }
      }
    } catch {}
  };

  const onNavBlocked = ()=>{ setShowExpired(true); };

  const onActivated = () => {
    setAppState('valid_license');
    setLic({ valid: true, expiresAt: null });
  };

  useEffect(()=>{
    const off = window.api.onBackupSuccess?.(()=>{
      setToast(true);
      setTimeout(()=> setToast(false), 3000);
    });
    return ()=>{ if (typeof off === 'function') off(); };
  }, []);

  // STATE 1: NO LICENSE - Show Activation Screen
  if (appState === 'no_license') {
    return <ActivationScreen onActivated={onActivated} />;
  }

  // Loading state
  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ffffff] text-[#1f3a8a]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-[#1f3a8a] border-t-transparent"></div>
          <p className="mt-4 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // STATE 2 & 3: VALID or EXPIRED LICENSE - Show main app with appropriate overlays
  return (
    <div className="min-h-screen flex bg-[#ffffff] text-[#1f3a8a]">
      <Sidebar expired={expired} onNavBlocked={onNavBlocked} />
      <main className="flex-1 p-6 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/invoice" element={<InvoiceEditor />} />
          <Route path="/products" element={<Products />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/credit" element={<CreditBook />} />
          <Route path="/migration" element={<DataMigration />} />
          <Route path="/branding" element={<Branding />} />
          <Route path="/machine-id" element={<MachineId />} />
        </Routes>
      </main>

      {/* STATE 3: EXPIRED LICENSE - Show renewal modal */}
      {showExpired && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md text-[#1f3a8a] border border-[rgba(31,58,138,0.15)]">
            <div className="text-lg font-semibold mb-2">⚠️ Subscription Expired</div>
            <div className="mb-4">
              {expiredDateText
                ? `Your subscription expired on ${expiredDateText}. Please renew to continue.`
                : 'Your subscription has expired or is invalid. Please renew or recheck to continue.'}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={recheck} className="px-4 py-2 rounded-lg border border-[rgba(31,58,138,0.25)] hover:bg-[rgba(31,58,138,0.06)]">Recheck</button>
            </div>
          </div>
        </div>
      )}

      {showGrace && !showExpired && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md text-[#1f3a8a] border border-[rgba(31,58,138,0.15)]">
            <div className="text-lg font-semibold mb-2">Subscription Expired</div>
            <div className="mb-4">
              {`Your subscription expired ${Number(graceDaysExpired || 0)} days ago. Grace period active.`}
            </div>
            <div className="mb-4 opacity-80">
              Please contact admin for renewal.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=> setShowGrace(false)} className="px-4 py-2 rounded-lg border border-[rgba(31,58,138,0.25)] hover:bg-[rgba(31,58,138,0.06)]">OK</button>
            </div>
          </div>
        </div>
      )}

      {showExpiringSoon && !showExpired && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md text-[#1f3a8a] border border-[rgba(31,58,138,0.15)]">
            <div className="text-lg font-semibold mb-2">Subscription Expiring Soon</div>
            <div className="mb-4">
              {`Your subscription will expire in ${Number(expiringDays || 0)} days. Please contact admin for renewal.`}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=> setShowExpiringSoon(false)} className="px-4 py-2 rounded-lg border border-[rgba(31,58,138,0.25)] hover:bg-[rgba(31,58,138,0.06)]">OK</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[rgba(31,58,138,0.95)] text-white px-4 py-3 rounded-lg shadow-lg z-50">
          Backup created successfully.
        </div>
      )}
    </div>
  );
}
