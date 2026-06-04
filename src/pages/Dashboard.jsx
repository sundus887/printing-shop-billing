import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const CURRENCY = 'PKR';

function StatCard({ title, value, sub, color = 'red', icon }) {
  const neonClass = 'neon-red';
  const badgeBg = 'bg-[rgba(31,58,138,0.12)] border border-[rgba(31,58,138,0.25)]';
  return (
    <div className={`card ${neonClass}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${badgeBg} rounded-lg grid place-items-center text-xl`}>{icon}</div>
        <div>
          <div className="text-xs opacity-80">{title}</div>
          <div className="text-2xl font-semibold">{value}</div>
          {sub && <div className="text-[11px] opacity-70 mt-1">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const loadSummary = async () => {
    setLoadError(null);
    try {
      const res = await window.api.getDashboardSummary();
      const chart = res.months.map((m, i) => ({
        month: m,
        earnings: res.earningsSeries[i] || 0,
        expenses: res.expensesSeries[i] || 0,
        profit: (res.earningsSeries[i] || 0) - (res.expensesSeries[i] || 0),
      }));
      setData({ summary: res, chart });
    } catch (e) {
      console.error('[Dashboard] Failed to load summary:', e);
      setLoadError(e.message || 'Failed to load dashboard data');
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const pieData = useMemo(() => {
    if (!data) return [];
    const counts = { Business: 0, Individual: 0, WalkIn: 0 };
    for (const r of data.summary.recent) {
      if ((r.customer_name || '').toLowerCase().includes('ltd')) counts.Business += 1;
      else if ((r.customer_name || '').toLowerCase().includes('walk')) counts.WalkIn += 1;
      else counts.Individual += 1;
    }
    return [
      { name: 'Business', value: counts.Business || 5 },
      { name: 'Individual', value: counts.Individual || 3 },
      { name: 'Walk-in', value: counts.WalkIn || 1 },
    ];
  }, [data]);

  if (!data) {
    return (
      <div className="p-6">
        {loadError ? (
          <div className="card card-red max-w-md mx-auto mt-16 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <div className="title mb-2">Dashboard Load Error</div>
            <p className="text-sm opacity-80 mb-4">{loadError}</p>
            <button className="btn" onClick={loadSummary}>🔄 Retry</button>
          </div>
        ) : (
          <div className="chip inline-block">Loading dashboard…</div>
        )}
      </div>
    );
  }

  const fmt = (n) => `${CURRENCY} ${Number(n || 0).toLocaleString()}`;

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold section-accent">Dashboard</div>
          <div className="opacity-70 text-sm">Professional printing business management system</div>
        </div>
        <button className="btn" onClick={async ()=>{
          if (!confirm('This will delete all saved data (customers, invoices, items, payments, expenses). Continue?')) return;
          const res = await window.api.clearStore();
          if (res?.error) { alert('Failed to clear data: '+res.error); return; }
          await loadSummary();
        }}>Reset Data</button>
      </div>

      {/* First row: KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard title="Total Earnings" value={fmt(data.summary.totalEarnings)} sub="All time revenue" icon={<span>💵</span>} />
        <StatCard title="Net Profit" value={fmt(Math.max(0, data.summary.monthProfit))} sub="Current month" icon={<span>📈</span>} />
        <StatCard title="Loss" value={fmt(Math.max(0, -data.summary.monthProfit))} sub="Current month" icon={<span>📉</span>} />
        <StatCard title="Total Clients" value={data.summary.totalClients} sub="Active customers" icon={<span>👥</span>} />
        <StatCard title="Total Invoices" value={data.summary.recent.length} sub="Recent activity" icon={<span>🧾</span>} />
      </div>

      {/* Second row: quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card neon-red">
          <div className="title">{fmt(data.summary.monthEarnings)}</div>
          <div className="text-xs opacity-70">This Month • Earnings</div>
        </div>
        <div className="card neon-red">
          <div className="title">{fmt(data.summary.totalExpenses)}</div>
          <div className="text-xs opacity-70">All-time Expenses</div>
        </div>
        <div className="card neon-red">
          <div className="title">{data.summary.pendingCount ?? Math.max(0, (data.summary.recent || []).filter((r) => r.status !== 'paid').length)}</div>
          <div className="text-xs opacity-70">Pending Invoices</div>
        </div>
        <div className="card neon-red">
          <div className="title">{fmt(Math.max(0, data.summary.monthProfit))}</div>
          <div className="text-xs opacity-70">Monthly Profit</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card card-red lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="title">Business Performance Trend</div>
            <span className="chip">Last 6 months</span>
          </div>
          {data && data.chart ? (
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={data.chart} margin={{ left: 8, right: 16, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="earnings" name="Earnings" stroke="#2f56c0" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#5e7fe6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="#1f3a8a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ width: '100%', height: 320 }} className="grid place-items-center text-sm opacity-70">
              Loading chart...
            </div>
          )}
        </div>

        <div className="card card-red">
          <div className="flex items-center justify-between mb-3">
            <div className="title">Customer Types</div>
            <span className="chip">Overview</span>
          </div>
          {data && data.summary ? (
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                    {pieData.map((entry, index) => (
                      <Cell key={`c-${index}`} fill={["#2f56c0", "#5e7fe6", "#1f3a8a"][index % 3]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(v) => v} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ width: '100%', height: 320 }} className="grid place-items-center text-sm opacity-70">
              Loading chart...
            </div>
          )}
        </div>
      </div>

      {/* Lists row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card card-red">
          <div className="flex items-center justify-between mb-2">
            <div className="title">Recent Invoices</div>
            <span className="chip chip-red">Live Feed</span>
          </div>
          <div className="space-y-3">
            {(data.summary.recent || []).map((r) => (
              <div key={r.id} className="list-item list-item-red flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[rgba(31,58,138,0.12)] border border-[rgba(31,58,138,0.25)] grid place-items-center">🧾</div>
                  <div>
                    <div className="font-medium">{r.customer_name || 'Customer'}</div>
                    <div className="text-xs opacity-70">{r.invoice_no} • {r.date}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{fmt(r.status==='paid' ? r.total : (r.due ?? r.total))}</div>
                  <div className={`chip text-[10px] mt-1 ${r.status==='paid' ? 'chip-green' : r.status==='pending' ? 'chip-blue' : 'chip-red'}`}>{(r.status||'paid').toUpperCase()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-red">
          <div className="flex items-center justify-between mb-2">
            <div className="title">Today's Activities</div>
            <span className="chip chip-blue">Live</span>
          </div>
          <div className="space-y-3">
            {(data.summary.recent || []).slice(0, 6).map((r, idx) => (
              <div key={`a-${r.id}`} className="list-item list-item-red flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[rgba(31,58,138,0.12)] border border-[rgba(31,58,138,0.25)] grid place-items-center text-[10px]">{String(11+idx).padStart(2,'0')}</div>
                  <div>
                    <div className="text-sm">Invoice Generated • {r.customer_name}</div>
                    <div className="text-xs opacity-70">{r.invoice_no} — {r.date}</div>
                  </div>
                </div>
                <div className="font-medium">{fmt(r.total)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
