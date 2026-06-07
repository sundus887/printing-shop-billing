import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function InvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    window.api.getInvoices()
      .then(data => setInvoices(data || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase();
    return (
      String(inv.invoice_no || "").toLowerCase().includes(q) ||
      String(inv.customer_name || "").toLowerCase().includes(q) ||
      String(inv.date || "").includes(q)
    );
  });

  return (
    <div className="p-5 space-y-4">
      <div>
        <div className="text-2xl font-semibold section-accent">Invoice List</div>
        <div className="opacity-70 text-sm">View and manage all invoices</div>
      </div>
      <div className="card">
        <input
          className="input w-full mb-4"
          placeholder="Search by invoice no, customer or date..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {loading ? (
          <div className="text-center py-8 opacity-60">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 opacity-60">No invoices found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(31,58,138,0.15)]">
                  <th className="text-left py-2 px-3 opacity-70">Invoice #</th>
                  <th className="text-left py-2 px-3 opacity-70">Customer</th>
                  <th className="text-left py-2 px-3 opacity-70">Date</th>
                  <th className="text-right py-2 px-3 opacity-70">Total</th>
                  <th className="text-center py-2 px-3 opacity-70">Status</th>
                  <th className="text-center py-2 px-3 opacity-70">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b border-[rgba(31,58,138,0.08)] hover:bg-[rgba(31,58,138,0.03)]">
                    <td className="py-2 px-3 font-semibold text-[#1f3a8a]">{inv.invoice_no || "INV-" + inv.id}</td>
                    <td className="py-2 px-3">{inv.customer_name || "Walk-in"}</td>
                    <td className="py-2 px-3 opacity-70">{inv.date || "-"}</td>
                    <td className="py-2 px-3 text-right font-semibold">PKR {Number(inv.total || 0).toFixed(2)}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={"chip text-xs " + (inv.status === "paid" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                        {inv.status || "pending"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        className="btn text-xs px-3 py-1"
                        onClick={() => navigate("/invoice?edit=" + inv.id)}
                      >
                        View / Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
