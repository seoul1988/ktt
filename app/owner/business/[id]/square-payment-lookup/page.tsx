"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SquarePaymentLookupPage() {
  const params = useParams<{ id: string }>();
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function inspect() {
    setLoading(true); setError(""); setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in first.");
      const r = await fetch(`/api/owner/business/${encodeURIComponent(params.id)}/square-payment-lookup?orderNumber=${encodeURIComponent(orderNumber.trim())}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
      });
      const data = await r.json();
      setResult(data);
      if (!r.ok) setError(data.error || "Lookup failed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Lookup failed."); }
    finally { setLoading(false); }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-5">
      <h1 className="text-2xl font-bold">Square Payment Lookup</h1>
      <p className="text-sm text-gray-600">Read-only Square payment lookup. No payment or order will be changed.</p>
      <form onSubmit={(e) => { e.preventDefault(); void inspect(); }} className="flex gap-2">
        <input aria-label="KTown order number" className="min-w-0 flex-1 rounded border p-3" placeholder="KTown order number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} inputMode="numeric" required />
        <button disabled={loading} className="rounded bg-black px-4 py-3 text-white disabled:opacity-50">{loading ? "Checking..." : "Check Square"}</button>
      </form>
      {error && <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {result?.order && <section className="rounded border p-4 space-y-2"><h2 className="font-bold">KTown Order #{result.order.order_number}</h2><p>KTown status: {result.order.payment_status || "Unknown"}</p><p>Payment method: {result.order.payment_method_type || "Unknown"}</p><p>Square payment ID: {result.order.square_payment_id || "Not saved"}</p></section>}
      {result?.square && <section className="rounded border p-4 space-y-2"><h2 className="font-bold">Square Result</h2><dl className="grid grid-cols-2 gap-2 text-sm">{Object.entries(result.square).map(([key, value]) => <div key={key} className="col-span-2 grid grid-cols-2 border-b py-2"><dt className="font-semibold break-words">{key}</dt><dd className="break-words">{value == null ? "—" : String(value)}</dd></div>)}</dl></section>}
      {result?.squareErrors?.length > 0 && <section className="rounded border p-4"><h2 className="font-bold">Square API errors (HTTP {result.squareHttpStatus})</h2><pre className="mt-2 whitespace-pre-wrap break-words text-sm">{JSON.stringify(result.squareErrors, null, 2)}</pre></section>}
      {result?.explanation && <p className="text-sm text-gray-600">{result.explanation}</p>}
    </main>
  );
}
