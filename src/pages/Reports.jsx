import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CURRENCY = 'PKR';

export default function Reports(){
  const [data, setData] = useState(null);

  useEffect(()=>{
    let mounted = true;
    (async () => {
      const s = await window.api.getDashboardSummary();
      if (!mounted) return;
      const chart = s.months.map((m,i)=>({
        month: m,
        earnings: s.earningsSeries[i] || 0,
        expenses: s.expensesSeries[i] || 0,
        profit: (s.earningsSeries[i]||0) - (s.expensesSeries[i]||0),
      }));
      setData({ summary:s, chart });
    })();
    return ()=>{ mounted = false };
  }, []);

  const totals = useMemo(()=>{
    if(!data) return { earnings:0, expenses:0, profit:0 };
    const earnings = data.chart.reduce((s,r)=>s + r.earnings, 0);
    const expenses = data.chart.reduce((s,r)=>s + r.expenses, 0);
    const profit = earnings - expenses;
    return { earnings, expenses, profit };
  }, [data]);

  const fmt = (n) => `${CURRENCY} ${Number(n||0).toLocaleString()}`;

  if (!data) {
    return <div className="p-6"><div className="chip inline-block">Loading…</div></div>;
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold section-accent">Profit & Loss</div>
          <div className="opacity-70 text-sm">Professional printing business management system</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card neon-green">
          <div className="text-xs opacity-70">Total Earnings (YTD)</div>
          <div className="text-2xl font-semibold">{fmt(totals.earnings)}</div>
        </div>
        <div className="card neon-red">
          <div className="text-xs opacity-70">Total Expenses (YTD)</div>
          <div className="text-2xl font-semibold">{fmt(totals.expenses)}</div>
        </div>
        <div className="card neon-blue">
          <div className="text-xs opacity-70">Net Profit (YTD)</div>
          <div className="text-2xl font-semibold">{fmt(Math.max(0, totals.profit))}</div>
        </div>
        <div className="card neon-blue">
          <div className="text-xs opacity-70">Loss (YTD)</div>
          <div className="text-2xl font-semibold">{fmt(Math.max(0, -totals.profit))}</div>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="title">Monthly Profit Trend</div>
          <span className="chip">{new Date().getFullYear()}</span>
        </div>
        {data && data.chart && data.chart.length > 0 ? (
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer>
              <LineChart data={data.chart} margin={{ left: 8, right: 16, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v)=>fmt(v)} />
                <Legend />
                <Line type="monotone" dataKey="earnings" name="Earnings" stroke="#3ddc84" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ff4d4d" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#4fa3ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ width: '100%', height: 360 }} className="grid place-items-center text-sm opacity-70">
            No data available
          </div>
        )}
      </div>

      {/* Monthly breakdown list */}
      <div className="card">
        <div className="title mb-3">Monthly Breakdown - {new Date().getFullYear()}</div>
        <div className="space-y-2">
          {data.chart.map((m) => (
            <div key={m.month} className="list-item flex items-center justify-between">
              <div>
                <div className="font-medium">{m.month}</div>
                <div className="text-xs opacity-70">Earnings: {fmt(m.earnings)} • Expenses: {fmt(m.expenses)}</div>
              </div>
              <div className="chip">{m.profit >= 0 ? `Profit: ${fmt(m.profit)}` : `Loss: ${fmt(-m.profit)}`}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
