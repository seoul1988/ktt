"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Section = "summary" | "payments" | "items" | "refunds" | "reports";
type Item = { id: number; item_name: string; quantity: number; line_total: number };
type Order = { id: number; order_number: string; created_at: string; fulfillment_type: string; customer_name: string; payment_method: string | null; payment_method_type: string | null; payment_status: string; order_status: string; subtotal: number; tax: number; tip: number; total: number; restaurant_order_items: Item[] };
const amount = (x: unknown) => Number(x || 0);
const money = (x: number) => new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(x);
const et = (s: string) => new Intl.DateTimeFormat("en-CA", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(s));
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const blob = new Blob(["\uFEFF" + [header,...rows].map(row => row.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function paymentLabel(o: Order) {
  const raw = `${o.payment_method_type || ""} ${o.payment_method || ""}`.toLowerCase();
  if (/apple[ _-]?pay/.test(raw)) return "Apple Pay";
  if (/google[ _-]?pay|gpay/.test(raw)) return "Google Pay";
  if (/mastercard|master card/.test(raw)) return "Mastercard";
  if (/american express|amex/.test(raw)) return "American Express";
  if (/discover/.test(raw)) return "Discover";
  if (/\bvisa\b/.test(raw)) return "Visa";
  return "Unknown / Other";
}
const sectionNames: Record<Section,string>={summary:"판매 집계 · Sales Summary",payments:"결제수단별 매출 · Payment Methods",items:"메뉴별 판매 · Menu Sales",refunds:"취소 및 환불 · Refunds",reports:"보고서 다운로드 · Reports"};
export default function SalesReport({section}:{section:Section}) {
  const {id}=useParams<{id:string}>();
  const [orders,setOrders]=useState<Order[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const [from,setFrom]=useState("");const [to,setTo]=useState("");const [applied,setApplied]=useState({from:"",to:""});const [dateError,setDateError]=useState("");
  useEffect(()=>{let active=true;(async()=>{try{setLoading(true);setError("");const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("Please log in to view sales.");const response=await fetch(`/api/owner/business/${id}/sales`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});const json=await response.json();if(!response.ok)throw new Error(json.error || "Unable to load sales");if(active)setOrders(json.orders || []);}catch(e){if(active)setError(e instanceof Error?e.message:"Unable to load sales");}finally{if(active)setLoading(false);}})();return()=>{active=false};},[id]);
  const filtered=useMemo(()=>orders.filter(o=>{const d=et(o.created_at);return (!applied.from||d>=applied.from)&&(!applied.to||d<=applied.to)}),[orders,applied]);
  const data=useMemo(()=>{
    const valid=filtered.filter(o=>!["cancelled","refunded","refund_pending"].includes(String(o.order_status).toLowerCase())&&!["refunded","refund_pending","failed","cancelled"].includes(String(o.payment_status).toLowerCase()));
    const days=new Map<string,{date:string;orders:number;total:number}>();const items=new Map<string,{name:string;quantity:number;total:number}>();const payments=new Map<string,{name:string;orders:number;total:number}>();
    for(const o of valid){const day=et(o.created_at);const d=days.get(day)||{date:day,orders:0,total:0};d.orders++;d.total+=amount(o.total);days.set(day,d);
      const method=paymentLabel(o);const p=payments.get(method)||{name:method,orders:0,total:0};p.orders++;p.total+=amount(o.total);payments.set(method,p);
      for(const item of o.restaurant_order_items||[]){const name=item.item_name||"Unknown item";const i=items.get(name)||{name,quantity:0,total:0};i.quantity+=amount(item.quantity);i.total+=amount(item.line_total);items.set(name,i);}}
    const exceptions=filtered.filter(o=>["refunded","refund_pending"].includes(String(o.payment_status).toLowerCase())||String(o.order_status).toLowerCase()==="cancelled");
    return {valid,days:[...days.values()].sort((a,b)=>b.date.localeCompare(a.date)),items:[...items.values()].sort((a,b)=>b.quantity-a.quantity),payments:[...payments.values()].sort((a,b)=>b.total-a.total),exceptions,total:valid.reduce((sum,o)=>sum+amount(o.total),0)};
  },[filtered]);
  const period=`${applied.from||"all"}_${applied.to||"all"}`;
  const exportOrders=()=>downloadCsv(`ktown-orders-${period}.csv`,["Date ET","Order","Customer","Fulfillment","Payment method","Payment status","Order status","Total"],filtered.map(o=>[et(o.created_at),o.order_number,o.customer_name,o.fulfillment_type,paymentLabel(o),o.payment_status,o.order_status,amount(o.total)]));
  const exportDaily=()=>downloadCsv(`ktown-daily-${period}.csv`,["Date ET","Orders","Sales"],data.days.map(d=>[d.date,d.orders,d.total]));
  const exportItems=()=>downloadCsv(`ktown-menu-${period}.csv`,["Menu item","Quantity","Sales"],data.items.map(i=>[i.name,i.quantity,i.total]));
  const exportPayments=()=>downloadCsv(`ktown-payment-methods-${period}.csv`,["Payment method","Orders","Sales"],data.payments.map(p=>[p.name,p.orders,p.total]));
  const th="px-4 py-3 text-left font-semibold";const td="border-t px-4 py-3";
  return <main className="mx-auto max-w-6xl px-4 py-7 pb-24">
    <Link href={`/owner/business/${id}/sales`} className="text-sm font-semibold text-gray-600">← Sales & Reports 메뉴</Link>
    <h1 className="mt-3 text-2xl font-black text-slate-900">{sectionNames[section]}</h1>
    <p className="mt-1 text-xs text-gray-500">KTown online orders only · Eastern Time</p>
    <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border bg-gray-50 p-4">
      <label className="text-sm font-semibold">From<input type="date" className="mt-1 block rounded-lg border bg-white p-2" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label className="text-sm font-semibold">To<input type="date" className="mt-1 block rounded-lg border bg-white p-2" value={to} onChange={e=>setTo(e.target.value)}/></label>
      <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white" onClick={()=>{if(from&&to&&from>to){setDateError("From date must be before To date.");return}setDateError("");setApplied({from,to})}}>Apply</button>
      <button type="button" className="rounded-lg border bg-white px-4 py-2 text-sm font-bold" onClick={()=>{setFrom("");setTo("");setApplied({from:"",to:""});setDateError("")}}>All dates</button>
    </div>
    {dateError&&<p role="alert" className="mt-2 text-sm text-red-600">{dateError}</p>}
    <p className="mt-2 text-xs text-gray-500">Applied period: {applied.from||"Any date"} – {applied.to||"Any date"}</p>
    {loading&&<p className="mt-5">Loading sales data…</p>}{error&&<p className="mt-5 text-red-600">{error}</p>}
    {!loading&&!error&&<>
      {section==="summary"&&<><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Sales",money(data.total)],["Orders",String(data.valid.length)],["Average order",money(data.valid.length?data.total/data.valid.length:0)]].map(([label,value])=><div key={label} className="rounded-2xl border p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>)}</div><div className="mt-5 overflow-x-auto rounded-2xl border"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className={th}>Date (ET)</th><th className={th}>Orders</th><th className={th}>Sales</th></tr></thead><tbody>{data.days.map(d=><tr key={d.date}><td className={td}>{d.date}</td><td className={td}>{d.orders}</td><td className={td}>{money(d.total)}</td></tr>)}</tbody></table></div></>}
      {section==="payments"&&<><p className="mt-4 text-sm text-gray-600">Wallet payments are not counted again under Visa/Mastercard. Unknown means the stored order does not identify a reliable method.</p><div className="mt-4 overflow-x-auto rounded-2xl border"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className={th}>Payment method</th><th className={th}>Orders</th><th className={th}>Sales</th></tr></thead><tbody>{data.payments.map(p=><tr key={p.name}><td className={td}>{p.name}</td><td className={td}>{p.orders}</td><td className={td}>{money(p.total)}</td></tr>)}</tbody></table></div></>}
      {section==="items"&&<div className="mt-5 overflow-x-auto rounded-2xl border"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className={th}>Menu item</th><th className={th}>Quantity</th><th className={th}>Sales</th></tr></thead><tbody>{data.items.map(i=><tr key={i.name}><td className={td}>{i.name}</td><td className={td}>{i.quantity}</td><td className={td}>{money(i.total)}</td></tr>)}</tbody></table></div>}
      {section==="refunds"&&<><p className="mt-4 text-xs text-gray-500">Order statuses only. These are not verified Square refund amounts.</p><div className="mt-3 overflow-x-auto rounded-2xl border"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className={th}>Date</th><th className={th}>Order</th><th className={th}>Payment status</th><th className={th}>Order status</th><th className={th}>Order total</th></tr></thead><tbody>{data.exceptions.map(o=><tr key={o.id}><td className={td}>{et(o.created_at)}</td><td className={td}>{o.order_number}</td><td className={td}>{o.payment_status}</td><td className={td}>{o.order_status}</td><td className={td}>{money(amount(o.total))}</td></tr>)}</tbody></table></div></>}
      {section==="reports"&&<div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">{[{label:"Orders CSV",fn:exportOrders},{label:"Daily Sales CSV",fn:exportDaily},{label:"Menu Sales CSV",fn:exportItems},{label:"Payment Methods CSV",fn:exportPayments}].map(x=><button key={x.label} onClick={x.fn} className="rounded-xl border bg-white p-4 text-left font-bold hover:bg-gray-50">📥 {x.label}</button>)}</div>}
      {section!=="reports"&&<p className="mt-5 text-xs text-gray-500">Sales exclude cancelled, refunded and refund-pending orders. Pay-at-store orders may be included. This report does not reconcile Square payouts or POS sales.</p>}
    </>}
  </main>;
}
