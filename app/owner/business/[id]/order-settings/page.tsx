"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OrderSettingsPage() {
  const params = useParams<{ id: string }>();
  const businessId = Number(params.id);
  const [form, setForm] = useState<any>(null);
  const [name, setName] = useState("Restaurant");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function token() { const { data:{session} } = await supabase.auth.getSession(); if (!session?.access_token) throw new Error("로그인이 필요합니다."); return session.access_token; }
  async function load() { const t=await token(); const r=await fetch(`/api/owner/business/${businessId}/order-settings`,{headers:{Authorization:`Bearer ${t}`},cache:"no-store"}); const j=await r.json(); if(!r.ok) throw new Error(j.error); setName(j.business?.name||"Restaurant"); setForm(j.settings); }
  useEffect(()=>{ void load().catch(e=>setMessage(e.message)); },[businessId]);
  async function save(){ setSaving(true); setMessage(""); try{ const t=await token(); const r=await fetch(`/api/owner/business/${businessId}/order-settings`,{method:"PATCH",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify(form)}); const j=await r.json(); if(!r.ok) throw new Error(j.error); setMessage("저장되었습니다."); await load(); }catch(e:any){setMessage(e.message)}finally{setSaving(false)} }
  if(!form) return <div className="p-6">Loading… {message}</div>;
  const field=(label:string,key:string,type="text")=><label className="block"><span className="mb-1 block text-xs font-black">{label}</span><input type={type} value={form[key]??""} onChange={e=>setForm({...form,[key]: type==="number"?Number(e.target.value):e.target.value})} className="w-full rounded-xl border px-3 py-3"/></label>;
  const check=(label:string,key:string)=><label className="flex items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={!!form[key]} onChange={e=>setForm({...form,[key]:e.target.checked})}/><b>{label}</b></label>;
  return <main className="mx-auto max-w-3xl space-y-5 p-5">
    <div><p className="text-xs font-black text-gray-400">ONLINE ORDERING</p><h1 className="text-2xl font-black">{name}</h1></div>
    {message?<div className="rounded-xl bg-gray-100 p-3 text-sm font-bold">{message}</div>:null}
    <section className="rounded-2xl border p-5"><h2 className="font-black">Order Options</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{check("Pickup","pickupEnabled")}{check("Delivery","deliveryEnabled")}{check("Pay at Pickup","payAtPickupEnabled")}{check("SMS Notification","smsEnabled")}{field("Pickup prep minutes","pickupPrepMinutes","number")}{field("Delivery prep minutes","deliveryPrepMinutes","number")}{field("Sales tax %","taxRatePercent","number")}</div></section>
    <section className="rounded-2xl border p-5"><h2 className="font-black">Twilio SMS</h2><p className="mt-1 text-xs text-gray-500">Each restaurant uses its own Twilio account and pays its own SMS charges.</p><div className="mt-3 grid gap-3">{field("Account SID","twilioAccountSid")}{field("Auth Token","twilioAuthToken","password")}{field("Twilio Phone Number","twilioPhoneNumber")}</div></section>
    <section className="rounded-2xl border p-5"><h2 className="font-black">Online Payment · Stripe</h2><p className="mt-1 text-xs text-gray-500">Stripe Checkout can show Apple Pay, Google Pay and cards when eligible. Money goes to the restaurant's Stripe account.</p><div className="mt-3 grid gap-3">{field("Stripe Secret Key","stripeSecretKey","password")}{field("Stripe Webhook Secret","stripeWebhookSecret","password")}</div></section>
    <button disabled={saving} onClick={save} className="w-full rounded-2xl bg-gray-950 py-4 font-black text-white">{saving?"SAVING…":"SAVE ORDER SETTINGS"}</button>
  </main>;
}
