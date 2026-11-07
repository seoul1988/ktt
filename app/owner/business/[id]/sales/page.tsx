"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Item = { id: number; item_name: string; quantity: number; line_total: number };
type Order = {
  id: number; order_number: string; created_at: string; fulfillment_type: string;
  customer_name: string; payment_method: string; payment_method_type: string;
  payment_status: string; order_status: string; subtotal: number; tax: number;
  tip: number; total: number; restaurant_order_items: Item[];
};
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const num = (v: unknown) => Number(v || 0);
const dateET = (s: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date(s));
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
function saveCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const content = "\uFEFF" + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function SalesPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState<"overview" | "items" | "refunds">("overview");

  async function load() {
    try {
      setLoading(true); setError("");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in to view sales.");
      const response = await fetch(`/api/owner/business/${id}/sales`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load report");
      setOrders(data.orders || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load report"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [id]);

  const filtered = useMemo(() => orders.filter(o => {
    const d = dateET(o.created_at);
    return (!from || d >= from) && (!to || d <= to);
  }), [orders, from, to]);
  const report = useMemo(() => {
    const sales = filtered.filter(o => !["cancelled", "refunded", "refund_pending"].includes(String(o.order_status).toLowerCase()) && !["refunded", "refund_pending", "failed", "cancelled"].includes(String(o.payment_status).toLowerCase()));
    const refunded = filtered.filter(o => ["refunded", "refund_pending"].includes(String(o.payment_status).toLowerCase()));
    const cancelled = filtered.filter(o => String(o.order_status).toLowerCase() === "cancelled");
    const total = sales.reduce((n, o) => n + num(o.total), 0);
    const subtotal = sales.reduce((n, o) => n + num(o.subtotal), 0);
    const tax = sales.reduce((n, o) => n + num(o.tax), 0);
    const tip = sales.reduce((n, o) => n + num(o.tip), 0);
    const byDay = new Map<string, { date: string; orders: number; sales: number }>();
    const byItem = new Map<string, { name: string; quantity: number; sales: number }>();
    for (const o of sales) {
      const d = dateET(o.created_at);
      const day = byDay.get(d) || { date: d, orders: 0, sales: 0 };
      day.orders++; day.sales += num(o.total); byDay.set(d, day);
      for (const item of o.restaurant_order_items || []) {
        const name = String(item.item_name || "Unknown item");
        const row = byItem.get(name) || { name, quantity: 0, sales: 0 };
        row.quantity += num(item.quantity); row.sales += num(item.line_total); byItem.set(name, row);
      }
    }
    return { sales, refunded, cancelled, total, subtotal, tax, tip,
      avg: sales.length ? total / sales.length : 0,
      days: [...byDay.values()].sort((a,b) => b.date.localeCompare(a.date)),
      items: [...byItem.values()].sort((a,b) => b.quantity - a.quantity),
      refundAmount: refunded.filter(o => String(o.payment_status).toLowerCase() === "refunded").reduce((n,o) => n + num(o.total),0)
    };
  }, [filtered]);
  const period = `${from || "all"}_${to || "all"}`;
  const exportOrders = () => saveCsv(`ktown-orders-${period}.csv`, ["Date (ET)","Order #","Customer","Type","Payment method","Payment status","Order status","Subtotal","Tax","Tip","Total"], filtered.map(o => [dateET(o.created_at),o.order_number,o.customer_name,o.fulfillment_type,o.payment_method_type || o.payment_method,o.payment_status,o.order_status,num(o.subtotal),num(o.tax),num(o.tip),num(o.total)]));
  const exportItems = () => saveCsv(`ktown-items-${period}.csv`, ["Menu item","Quantity","Sales"], report.items.map(i => [i.name,i.quantity,i.sales]));
  const exportDaily = () => saveCsv(`ktown-daily-${period}.csv`, ["Date (ET)","Orders","Sales"], report.days.map(d => [d.date,d.orders,d.sales]));
  return <main className="mx-auto max-w-6xl px-4 py-6 pb-24">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link href={`/owner/business/${id}/manage`} className="text-sm font-semibold text-gray-600">← Back to management</Link><h1 className="mt-2 text-2xl font-black">Sales & Reports</h1><p className="text-sm text-gray-500">KTown online orders only · Eastern Time</p></div>
      <div className="flex flex-wrap gap-2"><Link className="rounded-xl border px-4 py-2 text-sm font-bold" href={`/owner/business/${id}/orders`}>Order Management →</Link><button className="rounded-xl border px-4 py-2 text-sm font-bold" onClick={() => void load()} disabled={loading}>Refresh</button></div>
    </div>
    <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border bg-gray-50 p-4">
      <label className="text-sm font-semibold">From <input className="mt-1 block rounded-lg border bg-white p-2" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label className="text-sm font-semibold">To <input className="mt-1 block rounded-lg border bg-white p-2" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      <button className="rounded-lg border bg-white px-4 py-2 text-sm font-bold" onClick={()=>{setFrom("");setTo("");}}>All dates</button>
      <button className="rounded-lg border bg-white px-4 py-2 text-sm font-bold" onClick={exportOrders} disabled={loading || !!error}>Orders CSV</button>
      <button className="rounded-lg border bg-white px-4 py-2 text-sm font-bold" onClick={exportDaily} disabled={loading || !!error}>Daily CSV</button>
      <button className="rounded-lg border bg-white px-4 py-2 text-sm font-bold" onClick={exportItems} disabled={loading || !!error}>Menu CSV</button>
    </div>
    {loading && <p className="mt-5">Loading sales data…</p>}
    {error && <p className="mt-5 text-red-600">{error}</p>}
    {!loading && !error && <>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Sales",money(report.total)],["Orders",String(report.sales.length)],["Average order",money(report.avg)],["Refunded",money(report.refundAmount)],["Subtotal",money(report.subtotal)],["Tax",money(report.tax)],["Tips",money(report.tip)],["Cancelled",String(report.cancelled.length)]].map(([label,value]) => <div key={label} className="rounded-2xl border p-4"><div className="text-xs font-semibold text-gray-500">{label}</div><div className="mt-2 text-xl font-black">{value}</div></div>)}
      </div>
      <p className="mt-3 text-xs text-gray-500">Sales exclude cancelled, refunded and refund-pending orders. Refunded amount is an estimate based on order totals, not confirmed Square refund transactions. Fees, deposits and POS sales are not included. Pay-at-store orders are included unless cancelled.</p>
      <div className="mt-6 flex flex-wrap gap-2">{(["overview","items","refunds"] as const).map(t => <button key={t} className={`rounded-full border px-4 py-2 text-sm font-bold ${tab===t?"bg-gray-950 text-white":"bg-white"}`} onClick={()=>setTab(t)}>{t === "overview" ? "Daily Sales" : t === "items" ? "Menu Sales" : "Refunds & Cancellations"}</button>)}</div>
      {tab === "overview" && <div className="mt-4 overflow-x-auto rounded-2xl border"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="p-3">Date (ET)</th><th className="p-3">Orders</th><th className="p-3 text-right">Sales</th></tr></thead><tbody>{report.days.map(d=><tr className="border-t" key={d.date}><td className="p-3">{d.date}</td><td className="p-3">{d.orders}</td><td className="p-3 text-right">{money(d.sales)}</td></tr>)}</tbody></table>{report.days.length===0&&<p className="p-4 text-gray-500">No sales in this period.</p>}</div>}
      {tab === "items" && <div className="mt-4 overflow-x-auto rounded-2xl border"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="p-3">Menu item</th><th className="p-3">Quantity</th><th className="p-3 text-right">Sales</th></tr></thead><tbody>{report.items.map(i=><tr className="border-t" key={i.name}><td className="p-3">{i.name}</td><td className="p-3">{i.quantity}</td><td className="p-3 text-right">{money(i.sales)}</td></tr>)}</tbody></table>{report.items.length===0&&<p className="p-4 text-gray-500">No menu sales in this period.</p>}</div>}
      {tab === "refunds" && <div className="mt-4 overflow-x-auto rounded-2xl border"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="p-3">Date</th><th className="p-3">Order</th><th className="p-3">Payment</th><th className="p-3">Order status</th><th className="p-3 text-right">Order total</th></tr></thead><tbody>{filtered.filter(o=>["refunded","refund_pending"].includes(String(o.payment_status).toLowerCase()) || String(o.order_status).toLowerCase()==="cancelled").map(o=><tr className="border-t" key={o.id}><td className="p-3">{dateET(o.created_at)}</td><td className="p-3">#{o.order_number}</td><td className="p-3">{o.payment_status}</td><td className="p-3">{o.order_status}</td><td className="p-3 text-right">{money(num(o.total))}</td></tr>)}</tbody></table></div>}
    </>}
  </main>;
}
