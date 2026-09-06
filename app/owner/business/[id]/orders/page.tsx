"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CommunityBottomNav from "@/app/components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import { supabase } from "@/lib/supabase";

function raleighDateTime(value: unknown) {
  if (!value) return { date: "—", time: "—", isoDate: "" };

  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    return { date: "—", time: "—", isoDate: "" };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";

  return {
    date: `${month}/${day}/${year}`,
    time: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d),
    isoDate: `${year}-${month}-${day}`,
  };
}

function paymentLabel(order: any) {
  const type = String(order.payment_method_type || "").toLowerCase();

  if (type === "apple_pay") return "Apple Pay";
  if (type === "google_pay") return "Google Pay";
  if (type === "card") return "Card";
  if (type === "pay_at_store") return "Pay at Store";

  const method = String(order.payment_method || "").toLowerCase();
  if (method === "online") return "Online";
  if (method === "card") return "Card";
  if (method === "cash") return "Cash";

  return order.payment_method_type || order.payment_method || "—";
}

export default function OwnerOrdersPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const businessId = Number(params.id);

  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [dateFilter, setDateFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  async function token() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("로그인이 필요합니다.");
    }

    return session.access_token;
  }

  async function load() {
    try {
      setError("");
      const t = await token();

      const r = await fetch(
        `/api/owner/business/${businessId}/orders`,
        {
          headers: { Authorization: `Bearer ${t}` },
          cache: "no-store",
        },
      );

      const j = await r.json();

      if (!r.ok) {
        throw new Error(j.error);
      }

      setOrders(j.orders || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();

    const timer = setInterval(() => void load(), 30000);

    return () => clearInterval(timer);
  }, [businessId]);

  async function status(orderId: number, next: string) {
    const t = await token();

    const r = await fetch(
      `/api/owner/business/${businessId}/orders/${orderId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: next }),
      },
    );

    const j = await r.json();

    if (!r.ok) {
      return alert(j.error || "Failed");
    }

    await load();
  }

  const visibleOrders = useMemo(() => {
    return orders.filter((o) => {
      // Square에서 실제 결제 ID가 생성된 주문만 표시합니다.
      if (!String(o.square_payment_id || "").trim()) {
        return false;
      }

      // payment pending 주문은 조회 목록에서 제외합니다.
      if (
        String(o.payment_status || "")
          .trim()
          .toLowerCase() === "pending"
      ) {
        return false;
      }

      const dt = raleighDateTime(o.created_at);

      if (dateFilter && dt.isoDate !== dateFilter) {
        return false;
      }

      if (
        nameFilter.trim() &&
        !String(o.customer_name || "")
          .toLowerCase()
          .includes(nameFilter.trim().toLowerCase())
      ) {
        return false;
      }

      if (
        fulfillmentFilter &&
        String(o.fulfillment_type || "").toLowerCase() !==
          fulfillmentFilter
      ) {
        return false;
      }

      if (paymentFilter) {
        const type = String(
          o.payment_method_type || o.payment_method || "",
        ).toLowerCase();

        if (type !== paymentFilter) {
          return false;
        }
      }

      return true;
    });
  }, [
    orders,
    dateFilter,
    nameFilter,
    fulfillmentFilter,
    paymentFilter,
  ]);

  return (
    <main className="mx-auto max-w-5xl p-5 pb-28">
      <header className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full border bg-white text-2xl font-black shadow-sm"
        >
          ←
        </button>

        <div className="min-w-0 text-center">
          <p className="text-[10px] font-black tracking-wider text-gray-400">
            ONLINE ORDERS
          </p>
          <h1 className="truncate text-xl font-black">Orders</h1>
        </div>

        <div className="flex h-11 w-11 items-center justify-center">
          <ProfileButton />
        </div>
      </header>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border px-4 py-2 text-xs font-black"
        >
          REFRESH
        </button>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-black text-gray-500">
            DATE
          </span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-bold"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-black text-gray-500">
            CUSTOMER NAME
          </span>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Search name"
            className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-bold"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-black text-gray-500">
            PICKUP / DELIVERY
          </span>
          <select
            value={fulfillmentFilter}
            onChange={(e) => setFulfillmentFilter(e.target.value)}
            className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-bold"
          >
            <option value="">ALL</option>
            <option value="pickup">PICKUP</option>
            <option value="delivery">DELIVERY</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-black text-gray-500">
            PAYMENT
          </span>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-bold"
          >
            <option value="">ALL</option>
            <option value="apple_pay">APPLE PAY</option>
            <option value="google_pay">GOOGLE PAY</option>
            <option value="card">CARD</option>
            <option value="pay_at_store">PAY AT STORE</option>
          </select>
        </label>

        <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between gap-3">
          <p className="text-xs font-black text-gray-500">
            {visibleOrders.length} ORDERS · RALEIGH TIME · PAID SQUARE ORDERS ONLY
          </p>

          <button
            type="button"
            onClick={() => {
              setDateFilter("");
              setNameFilter("");
              setFulfillmentFilter("");
              setPaymentFilter("");
            }}
            className="rounded-lg border bg-white px-3 py-2 text-xs font-black"
          >
            CLEAR FILTERS
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-red-600">{error}</p>
      ) : null}

      {loading ? <p className="mt-6">Loading…</p> : null}

      <div className="mt-5 space-y-4">
        {visibleOrders.map((o) => {
          const dt = raleighDateTime(o.created_at);

          return (
            <article
              key={o.id}
              className="rounded-2xl border p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black text-gray-400">
                    #{o.order_number} ·{" "}
                    {String(o.fulfillment_type).toUpperCase()}
                  </div>

                  <h2 className="text-lg font-black">
                    {o.customer_name}
                  </h2>

                  <p className="text-sm text-gray-600">
                    {o.customer_phone} ·{" "}
                    {o.requested_time || "ASAP"}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-700">
                      {dt.date} · {dt.time}
                    </span>

                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                        String(o.fulfillment_type).toLowerCase() ===
                        "delivery"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {String(
                        o.fulfillment_type || "—",
                      ).toUpperCase()}
                    </span>

                    <span className="rounded-lg bg-green-100 px-2.5 py-1 text-xs font-black text-green-800">
                      {paymentLabel(o)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-black">
                    ${Number(o.total || 0).toFixed(2)}
                  </div>

                  <div className="text-xs font-bold">
                    {o.payment_status}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {(o.restaurant_order_items || []).map((i: any) => (
                  <div
                    key={i.id}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      <b>{i.quantity}×</b> {i.item_name}
                    </span>
                    <span>
                      ${Number(i.line_total || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "new",
                  "preparing",
                  "ready",
                  "completed",
                  "cancelled",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => void status(o.id, s)}
                    className={`rounded-full border px-3 py-2 text-xs font-black ${
                      o.order_status === s
                        ? "bg-gray-950 text-white"
                        : ""
                    }`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </article>
          );
        })}

        {!loading && visibleOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm font-bold text-gray-500">
            No orders found.
          </div>
        ) : null}
      </div>
      <CommunityBottomNav />
    </main>
  );
}
