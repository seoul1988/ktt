"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type OrderState = {
  ok: boolean;
  orderNumber: string;
  businessName: string;
  fulfillmentType: "pickup" | "delivery";
  total: number;
  paymentStatus: string;
  orderStatus: string;
  cancelExpiresAt: string | null;
  secondsRemaining: number;
  cancelled: boolean;
  cancellable: boolean;
};

function money(value: number) {
  return `$${Math.max(0, Number(value) || 0).toFixed(2)}`;
}

function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(s / 60);
  const remainder = s % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function CancelOrderPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || "");

  const [order, setOrder] = useState<OrderState | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/cancel/${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to load this order.",
        );
      }

      setOrder(payload);
      setRemaining(
        Math.max(0, Number(payload?.secondsRemaining || 0)),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load this order.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!order || order.cancelled || remaining <= 0) return;

    const timer = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [order, remaining > 0]);

  const canCancel = useMemo(
    () =>
      !!order &&
      !order.cancelled &&
      order.paymentStatus === "paid" &&
      remaining > 0 &&
      !cancelling,
    [order, remaining, cancelling],
  );

  async function cancelOrder() {
    if (!canCancel || !token) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel this order? Your full payment will be submitted for refund.",
    );
    if (!confirmed) return;

    setCancelling(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/cancel/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || "Cancellation could not be completed.",
        );
      }

      setSuccess(
        payload?.deliveryCancellationWarning
          ? `Order cancelled and refund requested. ${payload.deliveryCancellationWarning}`
          : "Order cancelled. Your full refund has been submitted to your original payment method.",
      );

      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Cancellation could not be completed.",
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-950">
      <div className="mx-auto max-w-lg rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[.16em] text-gray-400">
          KTown Triangle
        </p>
        <h1 className="mt-1 text-2xl font-black">Cancel Order</h1>

        {loading ? (
          <p className="mt-8 text-sm text-gray-500">Loading order…</p>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-800">
            {success}
          </div>
        ) : null}

        {!loading && order ? (
          <>
            <div className="mt-6 space-y-2 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-500">Restaurant</span>
                <b className="text-right">{order.businessName}</b>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-500">Order</span>
                <b>#{order.orderNumber}</b>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-500">Type</span>
                <b className="capitalize">{order.fulfillmentType}</b>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-500">Total</span>
                <b>{money(order.total)}</b>
              </div>
            </div>

            {order.cancelled ? (
              <div className="mt-6 rounded-2xl bg-gray-100 p-5 text-center">
                <p className="text-lg font-black">Order Cancelled</p>
                <p className="mt-1 text-sm text-gray-600">
                  This cancellation link has already been used.
                </p>
              </div>
            ) : remaining > 0 ? (
              <div className="mt-6 text-center">
                <p className="text-sm font-bold text-gray-600">
                  Cancellation available for
                </p>
                <p className="mt-1 text-4xl font-black tabular-nums">
                  {clock(remaining)}
                </p>
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Orders can be cancelled online only during the first
                  3 minutes after payment.
                </p>

                <button
                  type="button"
                  onClick={cancelOrder}
                  disabled={!canCancel}
                  className="mt-6 w-full rounded-2xl bg-red-600 px-5 py-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {cancelling ? "CANCELLING…" : "CANCEL ORDER"}
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-center text-amber-900">
                <p className="font-black">Cancellation period expired</p>
                <p className="mt-1 text-sm">
                  Please contact the restaurant directly for assistance.
                </p>
              </div>
            )}

            {order.fulfillmentType === "delivery" ? (
              <p className="mt-5 text-[11px] leading-5 text-gray-500">
                If a courier has already accepted or started the delivery,
                the restaurant may incur a delivery cancellation fee.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
