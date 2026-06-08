import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from "react-router-dom";

function num(n){ const v = parseFloat(n); return isNaN(v) ? 0 : v; }

function normalizeColor(c) {
  let s = String(c || "").trim();
  if (!s) return "#111111";
  if (!s.startsWith("#")) s = "#" + s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) return s;
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  return "#111111";
}

export default function InvoiceEditor(){
  const location = useLocation();
  const navigate = useNavigate();
  const editInvoiceId = useMemo(() => {
    const p = new URLSearchParams(location.search);
    const v = p.get("edit");
    return v ? Number(v) : null;
  }, [location.search]);

  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerCategory, setCustomerCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [received, setReceived] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [items, setItems] = useState([]);
  const [iSearch, setISearch] = useState("");
  const [pageSize, setPageSize] = useState("A4");
  const [quickItems, setQuickItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [qi, setQi] = useState({ name: "", unit: "pcs", note: "" });
  const [editQi, setEditQi] = useState({ id: null, name: "", unit: "pcs", note: "" });
  const [qSearch, setQSearch] = useState("");
  const [qFilterCat, setQFilterCat] = useState("All");
  const [prevDue, setPrevDue] = useState(0);
  const [loadingDue, setLoadingDue] = useState(false);
  const [branding, setBranding] = useState({
    shopName: "", header: "", footer: "", logoPath: "", logoSize: 90,
    shopNameSize: 18, shopNameColor: "#111111", shopNameFont: "Arial, sans-serif"
  });
  const [highlightId, setHighlightId] = useState(null);
const itemRefs = useRef({});

  const loadQuickItems = async () => {
    const list = await window.api.getQuickItems();
    setQuickItems(list || []);
  };

  const loadBranding = async () => {
    try {
      const b = await window.api.brandingGet();
      const cfg = b?.config || {};
      let logoPath = "";
      if (b?.hasLogo) {
        const logoRes = await window.api.brandingGetLogo?.();
        if (logoRes?.ok && logoRes.path) logoPath = logoRes.path;
      }
      const data = {
        shopName: cfg.shopName || "",
        header: cfg.header || "",
        footer: cfg.footer || "",
        logoPath,
        logoSize: cfg.logoSize || 90,
        shopNameSize: cfg.shopNameSize || 18,
        shopNameColor: normalizeColor(cfg.shopNameColor || "#111111"),
        shopNameFont: cfg.shopNameFont || "Arial, sans-serif",
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
    setCustomerId("");
    setCustomerCategory("");
    setNotes("");
    setReceived("0");
    setPaymentMethod("cash");
    setItems([]);
    setISearch("");
    setPrevDue(0);
  };

  // Load invoice for editing
  useEffect(() => {
    if (!editInvoiceId) return;
    window.api.getInvoice(editInvoiceId).then(res => {
      if (!res || !res.invoice) return;
      const inv = res.invoice;
      const its = res.items || [];
      if (inv.customer_id) {
        setCustomerCategory("Individual");
        setCustomerId(String(inv.customer_id));
      } else {
        setCustomerCategory("Walk-in");
      }
      setNotes(inv.notes || "");
      setItems(its.map((it, i) => ({
        id: Date.now() + i,
        name: it.name || "",
        unit: it.unit_type || "pcs",
        length: String(it.length || ""),
        width: String(it.width || ""),
        qty: String(it.qty || 1),
        rate: String(it.unit_rate || 0),
        amount: it.line_total || 0,
        note: it.note || "",
      })));
    });
  }, [editInvoiceId]);

  useEffect(() => {
    window.api.getCustomers().then(setCustomers);
    loadQuickItems();
    loadProducts();
    loadBranding();
  }, []);

  useEffect(() => {
    const onMsg = (ev) => {
      const data = ev?.data || {};
      if (data && data.type === "invoice:exported") {
        resetInvoiceForm();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (!customerId){ setPrevDue(0); return; }
    setLoadingDue(true);
    window.api.getLedger(Number(customerId))
      .then(res => {
        const ledgerDue = Math.max(0, Number(res?.total_due || 0));
        setPrevDue(ledgerDue);
      })
      .finally(() => setLoadingDue(false));
  }, [customerId, customers]);

  const filteredCustomers = useMemo(() => {
    const infer = (c) => {
      if (c.category) return c.category;
      const n = (c.name || "").toLowerCase();
      if (n.includes("walk")) return "Walk-in";
      if (n.includes("ltd") || n.includes("company") || n.includes("co ")) return "Business";
      return "Individual";
    };
    if (!customerCategory) return [];
    return (customers || []).filter(c => infer(c) === customerCategory);
  }, [customers, customerCategory]);

  const categories = useMemo(() => {
    const set = new Set();
    (quickItems || []).forEach(it => set.add(it.category || "General"));
    (products || []).forEach(it => set.add(it.category || "General"));
    return ["All", ...Array.from(set).sort()];
  }, [quickItems, products]);

  const filteredQuickItems = useMemo(() => {
    const q = (qSearch || "").toLowerCase();
    const allItems = [
      ...(quickItems || []).map(it => ({ ...it, _source: "quick" })),
      ...(products || []).map(it => ({ ...it, _source: "product", rate: it.sellingPrice || 0, note: it.note || it.name }))
    ];
    return allItems.filter(it => {
      const inCat = qFilterCat === "All" ? true : (it.category || "General") === qFilterCat;
      const inText = !q ? true : ((it.name || "").toLowerCase().includes(q));
      return inCat && inText;
    });
  }, [quickItems, products, qSearch, qFilterCat]);

  const calcAmount = (r) => {
    const q = num(r.qty);
    const rt = num(r.rate);
    if ((r.unit || "pcs") === "feet") {
      const l = num(r.length);
      const w = num(r.width);
      if (!l || l <= 0 || !w || w <= 0 || !q || q <= 0 || !rt || rt <= 0) return 0;
      return Math.round((l * w * q * rt) * 100) / 100;
    }
    if (!q || q <= 0 || !rt || rt <= 0) return 0;
    return Math.round((q * rt) * 100) / 100;
  };

  const missingFields = (r) => {
    const miss = [];
    if ((r.unit || "pcs") === "feet") {
      if (!(num(r.length) > 0)) miss.push("Length");
      if (!(num(r.width) > 0)) miss.push("Width");
    }
    if (!(num(r.qty) > 0)) miss.push("Qty");
    if (!(num(r.rate) > 0)) miss.push("Rate");
    return miss;
  };

  const addRow = (preset) => {
    const id = Date.now() + Math.random();
    const unit = preset?.unit || 'pcs';
    const defaultRate = preset?.sellingPrice || preset?.rate || '';
    const row = preset
      ? { 
          id, 
          name: preset.name, 
          unit: preset.unit, 
          length: '', 
          width: '', 
          qty: '1', 
          rate: defaultRate,
          amount: 0, 
          note: preset.note || '' 
        }
      : { id, name: '', unit: 'pcs', length: '', width: '', qty: '1', rate: '', amount: 0 };
    row.amount = calcAmount(row);
    setItems((p) => [row, ...p]);

    // Scroll to new item and highlight it
    setHighlightId(id);
    setTimeout(() => {
      if (itemRefs.current[id]) {
        itemRefs.current[id].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      // Remove highlight after 1.5 seconds
      setTimeout(() => setHighlightId(null), 1500);
    }, 100);
  };
  const updateRow = (id, patch) => {
    setItems((p) => p.map(r => {
      if (r.id !== id) return r;
      const n = { ...r, ...patch };
      n.amount = calcAmount(n);
      return n;
    }));
  };

  const removeRow = (id) => setItems((p) => p.filter(r => r.id !== id));

  const subtotal = useMemo(() => items.reduce((s, r) => s + num(r.amount), 0), [items]);
  const total = Math.round((subtotal) * 100) / 100;
  const grandTotal = useMemo(() => Math.round((subtotal + prevDue) * 100) / 100, [subtotal, prevDue]);
  const pendingAfterPayment = useMemo(() => Math.max(0, grandTotal - num(received)), [grandTotal, received]);
  const visibleItems = useMemo(() => items, [items]);

  const generateInvoicePDF = async (meta = {}, selectedPageSize = "A4") => {
    const freshBranding = await loadBranding();
    if (!customerId && customerCategory !== "Walk-in") { alert("Please select a customer"); return; }
    if (items.length === 0) { alert("Add at least one item"); return; }
    const cust = customerCategory === "Walk-in" ? null : customers.find(c => String(c.id) === String(customerId));
    const custName = customerCategory === "Walk-in" ? "Walk-in" : (cust?.name || "Customer");
    const custPhone = customerCategory === "Walk-in" ? "" : (cust?.phone || "");
    const invNo = meta.invoice_no || "";
    const invDate = meta.date || new Date().toISOString().slice(0, 10);
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = [...items].reverse().map((it, idx) => {
      const l = Number(it.length || 0);
      const w = Number(it.width || 0);
      const size = l && w ? l + "ft x " + w + "ft" : "-";
      const sqft = (l && w) ? (l * w).toFixed(2) + " ft" : "";
      const qty = Number(it.qty || 0);
      const rate = Number(it.rate || 0);
      const amount = Number(it.amount || 0);
      const note = String(it.note || "").trim();
      const name = String(it.name || "").trim();
      const showNote = note && note.toLowerCase() !== name.toLowerCase();
      return "<tr><td class='c'>" + (idx+1) + "</td><td><div class='pname'>" + esc(it.name||"") + "</div>" + (showNote ? "<div class='sub'>" + esc(note) + "</div>" : "") + "</td><td class='c'>" + esc(size) + "</td><td class='r'>" + qty + "</td><td class='r'>" + sqft + "</td><td class='r'>" + rate.toFixed(2) + "</td><td class='r'>" + amount.toFixed(2) + "</td></tr>";
    }).join("");
    const totalBill = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    const prev = Number(prevDue || 0);
    const recv = Number(received || 0);
    const balance = totalBill + prev - recv;
    const shopName = (freshBranding.shopName || "").trim();
    const logoPath = freshBranding.logoPath || "";
    const logoSize = freshBranding.logoSize || 90;
    const logoBase64Res = await window.api.brandingGetLogoBase64?.();
    const logoSrc = logoBase64Res?.ok ? logoBase64Res.base64 : (logoPath ? ('file:///' + logoPath.replace(/\\/g, '/')) : '');
    const headerText = freshBranding.header || "";
    const footerText = freshBranding.footer || "";
    const shopNameSize = freshBranding.shopNameSize || 18;
    const shopNameColor = normalizeColor(freshBranding.shopNameColor || "#111111");
    const shopNameFont = freshBranding.shopNameFont || "Arial, sans-serif";
    const html = "<!doctype html><html><head><meta charset='utf-8'/><title>Invoice</title><style>:root{--sky:#38bdf8;--black:#111;--light:#e0f2fe;--text:#0f172a;--accent:#1f3a8a;}body{font-family:Arial,sans-serif;color:var(--text);background:#fff;padding:24px;}" + (selectedPageSize==="A3"?".paper{width:297mm;min-height:420mm;":selectedPageSize==="A5"?".paper{width:148mm;min-height:210mm;":selectedPageSize==="Legal"?".paper{width:216mm;min-height:356mm;":selectedPageSize==="Letter"?".paper{width:216mm;min-height:279mm;":".paper{width:210mm;min-height:297mm;") + "margin:0 auto;background:#fff;border:1px solid #e5e7eb;padding:0 14mm 16mm;position:relative;overflow:hidden;}.top-bar{height:8px;background:var(--sky);width:100%;position:absolute;top:0;left:0;}.inv-header{display:flex;justify-content:space-between;align-items:flex-start;padding-top:18px;margin-bottom:10px;}.inv-center{flex:1;text-align:center;padding-top:8px;}.shop-name{font-weight:800;}.header-text{font-size:10px;color:#555;margin-top:4px;}.inv-logo-wrap{text-align:right;min-width:140px;}.inv-logo{object-fit:contain;display:block;margin-left:auto;}.header-grid{display:flex;justify-content:space-between;color:#0f172a;margin:8mm 0 6mm;gap:10mm;}.header-grid .left>div{margin:1.5mm 0;}.header-grid .right{text-align:right;}.badge{padding:4px 8px;border:1px solid rgba(31,58,138,.35);border-radius:8px;font-weight:600;background:var(--light);color:var(--accent);}.panel{background:#fff;border-radius:6mm;padding:6mm;margin:8mm 0 10mm;border:1px solid #e0e0e0;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #d0d0d0;padding:8px;font-size:12px;}th{background:var(--light);color:#0f1e44;}.r{text-align:right;}.c{text-align:center;}.sub{font-size:10px;opacity:.7;margin-top:2px;}.pname{font-weight:700;}.summary{margin-top:8mm;display:flex;justify-content:flex-end;}.box{width:360px;border:1px solid #d0d0d0;border-radius:10px;overflow:hidden;background:#f8f9fa;}.box table{border-collapse:collapse;width:100%;}.box td{border:1px solid #d0d0d0;padding:8px;font-size:12px;}.inv-footer{margin-top:12mm;padding-top:6mm;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#666;}@page{size:" + selectedPageSize + ";margin:0;}@media print{body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.paper{margin:0!important;padding:14mm!important;}}</style></head><body><div class='paper'><div class='top-bar'></div><div class='inv-header'><div style='width:140px'></div><div class='inv-center'>" + (shopName ? "<div class='shop-name' style='font-size:" + shopNameSize + "pt;color:" + shopNameColor + ";font-family:" + shopNameFont + ";'>" + esc(shopName) + "</div>" : "") + (headerText ? "<div class='header-text'>" + esc(headerText) + "</div>" : "") + "</div><div class='inv-logo-wrap'>" + (logoSrc ? "<img class='inv-logo' src='" + logoSrc + "' style='height:" + logoSize + "px;max-width:" + (logoSize+40) + "px;'/>" : "") + "</div></div><div class='header-grid'><div class='left'><div><strong>Invoice #:</strong> <span class='badge'>" + esc(invNo) + "</span></div><div><strong>Customer:</strong> " + esc(custName) + "</div><div><strong>Mobile:</strong> " + esc(custPhone||"-") + "</div></div><div class='right'><div><strong>Date</strong> " + esc(invDate) + "</div></div></div><div class='panel'><table><thead><tr><th style='width:50px' class='c'>SNo.</th><th>Particulars</th><th style='width:120px' class='c'>Size</th><th style='width:60px' class='r'>Qty</th><th style='width:80px' class='r'>SqFt</th><th style='width:80px' class='r'>Rate</th><th style='width:100px' class='r'>Amount</th></tr></thead><tbody>" + rows + "</tbody></table><div style='margin-top:8px;font-weight:600;color:#0f1e44;'>Total Items: " + items.length + "</div>" + (notes ? "<div style='margin-top:8px;font-size:12px'><strong>Notes:</strong> " + esc(notes) + "</div>" : "") + "<div class='summary'><div class='box'><table><tr><td><strong>Total Bill:</strong></td><td class='r'>Rs " + totalBill.toFixed(2) + "</td></tr><tr><td>Previous Balance</td><td class='r'>Rs " + prev.toFixed(2) + "</td></tr><tr><td>Total Received</td><td class='r'>Rs " + recv.toFixed(2) + "</td></tr><tr><td><strong>Pending</strong></td><td class='r'><strong>Rs " + balance.toFixed(2) + "</strong></td></tr></table></div></div></div>" + (footerText ? "<div class='inv-footer'>" + esc(footerText) + "</div>" : "") + "<div class='no-print' style='text-align:right;margin-top:12px'><button id='downloadBtn' type='button'>Download PDF</button></div></div></body></html>";
   // Directly save PDF without opening preview window
try {
  const res = await window.api.savePDF(html, (invNo || "invoice") + ".pdf");
  if (res?.error) alert("Failed to save PDF: " + res.error);
} catch(err) {
  alert("Failed to save PDF");
}
return;
   
  };

  const saveInvoice = async () => {
    if (!customerId && customerCategory !== "Walk-in") return alert("Please select a customer");
    if (items.length === 0) return alert("Add at least one item");
    for (const it of items) {
      const miss = missingFields(it);
      if (miss.length) { alert("Please fill " + miss.join(", ") + " for: " + (it.name || "Item")); return; }
    }
    const recv = Number(received || 0);
    if (Number.isNaN(recv)) return alert("Please enter Amount Received");
    const payload = {
      customer_id: customerCategory === "Walk-in" ? null : parseInt(customerId, 10),
      date: new Date().toISOString().slice(0, 10),
      subtotal, tax: 0, discount: 0, total, notes,
      status: recv >= grandTotal ? "paid" : "pending",
      items: [...items].reverse().map(it => ({ name: it.name, unit_type: it.unit, length: num(it.length), width: num(it.width), qty: num(it.qty), unit_rate: num(it.rate), line_total: calcAmount(it), note: it.note || "" }))
    };
    if (editInvoiceId) {
      const res = await window.api.updateInvoice(editInvoiceId, payload);
      if (res?.success) {
        const invData = await window.api.getInvoice(editInvoiceId);
        const invNo = invData?.invoice?.invoice_no || ("INV-" + editInvoiceId);
        const invDate = invData?.invoice?.date || new Date().toISOString().slice(0,10);
        await generateInvoicePDF({ invoice_no: invNo, date: invDate }, pageSize);
        navigate("/invoice-list");
      } else alert("Update failed!");
      return;
    }
    const res = await window.api.createInvoice(payload);
    if (res?.id) {
      const recvAmt = Number(received || 0);
      if (recvAmt > 0) {
        await window.api.addPayment({ invoice_id: res.id, customer_id: (customerCategory === "Walk-in" ? null : parseInt(customerId, 10)), date: payload.date, amount: recvAmt, method: paymentMethod, notes: "Invoice payment" });
      }
      try {
        const led = await window.api.getLedger(Number(customerId));
        setPrevDue(Math.max(0, Number(led?.total_due || 0)));
      } catch {}
      resetInvoiceForm();
      await generateInvoicePDF({ invoice_no: res.invoice_no, date: payload.date }, pageSize);
    }
  };

  const renderItemDetail = (it, idx) => (
    <div
      key={it.id}
      ref={el => itemRefs.current[it.id] = el}
      className="card card-red"
      style={{
        borderLeft: highlightId === it.id ? '4px solid #38bdf8' : '4px solid #1f3a8a',
        boxShadow: highlightId === it.id ? '0 0 0 2px #38bdf8' : undefined,
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-[#1f3a8a] text-sm">#{idx + 1} - {it.name || "New Item"}</div>
        <button type="button" className="btn btn-red text-xs px-3 py-1" onClick={() => removeRow(it.id)}>Remove</button>
      </div>
      {(it.unit || "pcs") === "feet" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 items-end">
            <div><label className="text-xs opacity-80 block mb-1">Length (ft)</label><input type="number" min="0" step="0.01" className="input text-sm w-full" value={it.length ?? ""} onChange={e => updateRow(it.id, {length: e.target.value})} /></div>
            <div><label className="text-xs opacity-80 block mb-1">Width (ft)</label><input type="number" min="0" step="0.01" className="input text-sm w-full" value={it.width ?? ""} onChange={e => updateRow(it.id, {width: e.target.value})} /></div>
            <div><label className="text-xs opacity-80 block mb-1">Qty</label><input type="number" min="0" step="any" className="input text-sm w-full" value={it.qty ?? ""} onChange={e => updateRow(it.id, {qty: e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2 items-end">
            <div><label className="text-xs opacity-80 block mb-1">Rate/ft</label><input className="input text-sm w-full" value={it.rate ?? ""} onChange={e => updateRow(it.id, {rate: e.target.value})} /></div>
            <div><label className="text-xs opacity-80 block mb-1">SqFt</label>{(() => { const l = parseFloat(it.length||0)||0; const w = parseFloat(it.width||0)||0; const q = Math.max(1,parseFloat(it.qty||1)||1); const sqft = l>0&&w>0?l*w*q:0; return <div className="input text-sm text-center bg-gray-50 w-full">{sqft>0?sqft.toFixed(2):"0"}</div>; })()}</div>
            <div><label className="text-xs opacity-80 block mb-1">Amount</label><div className="input text-sm text-right font-bold bg-blue-50 text-[#1f3a8a] w-full">PKR {Number(it.amount||0).toFixed(2)}</div></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4"><label className="text-xs opacity-80 block mb-1">Quantity (Pcs)</label><input type="number" min="0" step="any" className="input text-sm" value={it.qty ?? ""} onChange={e => updateRow(it.id, {qty: e.target.value})} /></div>
          <div className="col-span-4"><label className="text-xs opacity-80 block mb-1">Rate (per piece)</label><input className="input text-sm" value={it.rate ?? ""} onChange={e => updateRow(it.id, {rate: e.target.value})} /></div>
          <div className="col-span-4"><label className="text-xs opacity-80 block mb-1">Amount</label><div className="input text-sm text-right font-bold bg-blue-50 text-[#1f3a8a]">PKR {Number(it.amount||0).toFixed(2)}</div></div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col" style={{minHeight: 0}}>
      <div className="shrink-0 px-5 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-2xl font-semibold section-accent">{editInvoiceId ? "Edit Invoice" : "Create Invoice"}</div>
            <div className="opacity-70 text-sm">{editInvoiceId ? "Update existing invoice" : "Create professional invoices"}</div>
          </div>
          {editInvoiceId && (
            <button className="btn text-sm" onClick={() => navigate("/invoice-list")}>Back to List</button>
          )}
        </div>
        <div className="card card-red mb-3">
          <div className="title mb-2">Customer Selection</div>
          <div className="flex items-center gap-2 flex-wrap">
            {["Walk-in","Individual","Business"].map(cat => (
              <button key={cat} className={"chip " + (customerCategory===cat?"tab-active":"")} onClick={() => { setCustomerCategory(cat); setCustomerId(""); }}>{cat}</button>
            ))}
            {customerCategory && customerCategory !== "Walk-in" && filteredCustomers.length > 0 && (
              <select className="input w-48" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                {(!customerId) ? <option value="" disabled hidden>Choose customer...</option> : null}
                {filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {customerCategory === "Walk-in" && <span className="chip">Walk-in Customer</span>}
            {customerCategory && customerCategory !== "Walk-in" && filteredCustomers.length === 0 && (
              <span className="text-sm opacity-70">No customers in {customerCategory}.</span>
            )}
            {customerId && (
              <span className="text-sm">Previous: {loadingDue ? "Loading..." : <span className="chip">PKR {prevDue.toFixed(2)}</span>}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 px-5 pb-4">
        <div className="flex gap-4">
          <div className="flex flex-col min-h-0" style={{width: "42%", minWidth: 0}}>
            <div className="card card-red flex flex-col">
              <div className="shrink-0 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="title">Available Items</div>
                  <button className="btn text-sm" onClick={() => setShowQuickForm(v => !v)}>{showQuickForm ? "Close" : "+ Quick Add"}</button>
                </div>
                <input className="input w-full" placeholder="Search items..." value={qSearch} onChange={e => setQSearch(e.target.value)} />
                <div className="text-xs opacity-60 mt-1">{filteredQuickItems.length} item(s)</div>
              </div>
              {showQuickForm && (
                <div className="shrink-0 list-item list-item-red mb-3">
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="col-span-2"><label className="text-xs opacity-80">Name</label><input className="input" value={qi.name} onChange={e => setQi({...qi, name: e.target.value})} placeholder="Product name" /></div>
                    <div><label className="text-xs opacity-80">Unit</label><select className="input" value={qi.unit} onChange={e => setQi({...qi, unit: e.target.value})}><option value="pcs">Pcs</option><option value="feet">Feet</option></select></div>
                    <div className="flex gap-2">
                      <button className="btn text-xs" onClick={() => setQi({ name: "", unit: "pcs", note: "" })}>Reset</button>
                      <button className="btn btn-red text-xs" onClick={async () => { if(!qi.name) return alert("Name required"); await window.api.addQuickItem({ name: qi.name, unit: qi.unit, rate: 0, note: qi.note||qi.name }); setQi({ name: "", unit: "pcs", note: "" }); setShowQuickForm(false); loadQuickItems(); }}>Save</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="overflow-y-auto pr-1">
                {filteredQuickItems.length === 0 ? (
                  <div className="text-sm opacity-70">No items. Add products or click Quick Add.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredQuickItems.map((q) => (
                      <div key={q._source + "-" + q.id} className="list-item list-item-red cursor-pointer hover:bg-[rgba(31,58,138,0.06)] transition-colors" onClick={() => addRow(q)}>
                        <div className="flex items-center justify-between gap-1">
                          <div className="font-medium text-[#1f3a8a] text-sm truncate">{q.name}</div>
                          {q._source === "quick" && (
                            <button className="text-xs opacity-50 hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); if (!confirm("Delete " + q.name + "?")) return; window.api.removeQuickItem(q.id); loadQuickItems(); }}>&times;</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col min-h-0" style={{width: "58%", minWidth: 0}}>
            <div className="card card-red flex flex-col">
              {items.length === 0 ? (
                <div className="text-center py-10 opacity-60 text-sm flex-1 flex flex-col items-center justify-center">
                  <div className="text-3xl mb-2">🧾</div>
                  Click items from left to add them here
                </div>
              ) : (
                <>
                  <div className="shrink-0 mb-3"><div className="font-semibold text-[#1f3a8a] mb-2">Selected Items ({items.length})</div></div>
                  <div className="overflow-y-auto pr-1 space-y-2" style={{maxHeight: "420px"}}>
  {visibleItems.map((it, idx) => renderItemDetail(it, visibleItems.length - 1 - idx))}
</div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 grid grid-cols-2 gap-3">
          <div className="card card-red">
            <div className="title mb-3">Billing Summary</div>
            <div className="flex items-center justify-between text-sm mb-1"><span className="opacity-70">Subtotal</span><span className="font-semibold">PKR {subtotal.toFixed(2)}</span></div>
            <div className="flex items-center justify-between text-sm mb-1"><span className="opacity-70">Previous Pending</span><span className="font-semibold">PKR {prevDue.toFixed(2)}</span></div>
            <div className="flex items-center justify-between text-lg font-bold text-[#1f3a8a] border-t pt-2 mt-2"><span>Total</span><span>PKR {grandTotal.toFixed(2)}</span></div>
          </div>
          <div className="card card-red">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs opacity-80">Amount Received (PKR)</label><input className="input text-sm" value={received} onChange={e => setReceived(e.target.value)} /></div>
              <div><label className="text-xs opacity-80">Pending After Payment</label><div className="input text-sm text-right font-bold" style={{backgroundColor: "#fef2f2", color: "#dc2626"}}>PKR {pendingAfterPayment.toFixed(2)}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div><label className="text-xs opacity-80">Page Size</label><select className="input text-sm w-full" value={pageSize} onChange={e => setPageSize(e.target.value)}><option value="A4">A4</option><option value="A3">A3</option><option value="A5">A5</option><option value="Letter">Letter</option><option value="Legal">Legal</option></select></div>
            </div>
            <div className="flex gap-2 mt-3">
              {editInvoiceId && (
                <button className="btn w-full text-base" onClick={async () => {
                  const invData = await window.api.getInvoice(editInvoiceId);
                  const invNo = invData?.invoice?.invoice_no || ("INV-" + editInvoiceId);
                  const invDate = invData?.invoice?.date || new Date().toISOString().slice(0,10);
                  await generateInvoicePDF({ invoice_no: invNo, date: invDate }, pageSize);
                }}>Generate PDF</button>
              )}
              <button className="btn btn-red w-full text-base" onClick={saveInvoice}>{editInvoiceId ? "Update Invoice" : "Generate Invoice"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}















