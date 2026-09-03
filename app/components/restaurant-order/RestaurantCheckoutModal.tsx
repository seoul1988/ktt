"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type CheckoutCartItem = {
  cartItemId: string;
  businessId: number;
  menuItemId: number;
  name: string;
  quantity: number;
  instructions: string;
  selections: unknown;
  unitPrice: number;
  totalPrice: number;
  imageUrl: string;
  fulfillmentType?: "pickup" | "delivery";
};

type PublicSettings = {
  businessId: number;
  businessName: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  onlinePaymentEnabled: boolean;
  payAtPickupEnabled: boolean;
  smsEnabled: boolean;
  pickupPrepMinutes: number;
  deliveryPrepMinutes: number;
  taxRate: number;
  tipPresets: number[];
};

type Props = {
  businessId: number;
  fulfillmentType: "pickup" | "delivery";
  cartItems: CheckoutCartItem[];
  onClose: () => void;
  onOrderPlaced: () => void;
};

const CUSTOMER_KEY = "restaurant-order-customer";

function money(value: number) {
  return `$${Math.max(0, value).toFixed(2)}`;
}

export default function RestaurantCheckoutModal({
  businessId,
  fulfillmentType,
  cartItems,
  onClose,
  onOrderPlaced,
}: Props) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [pickupTime, setPickupTime] = useState("asap");
  const [customTime, setCustomTime] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [customHour, setCustomHour] = useState("12");
  const [customMinute, setCustomMinute] = useState("00");
  const [customPeriod, setCustomPeriod] = useState<"AM" | "PM">("PM");
  const [paymentMethod, setPaymentMethod] = useState<"online" | "pay_at_pickup">("online");
  const [tipPercent, setTipPercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Math.max(0, Number(item.totalPrice) || 0), 0),
    [cartItems],
  );
  const tax = subtotal * Math.max(0, Number(settings?.taxRate || 0));
  const tip = subtotal * (tipPercent / 100);
  const estimatedTotal = subtotal + tax + tip;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CUSTOMER_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setName(String(saved?.name || ""));
        setPhone(String(saved?.phone || ""));
      }
    } catch {}

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/businesses/${businessId}/order-settings`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "주문 설정을 불러오지 못했습니다.");
        if (!cancelled) {
          setSettings(payload);
          if (fulfillmentType === "pickup" && payload.payAtPickupEnabled) {
            setPaymentMethod("pay_at_pickup");
          } else if (payload.onlinePaymentEnabled) {
            setPaymentMethod("online");
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "주문 설정을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [businessId]);

  async function submitOrder() {
    setError("");
    if (!name.trim()) return setError("Please enter your name.");
    if (!phone.trim()) return setError("Please enter your phone number.");
    if (fulfillmentType === "delivery") {
      if (!address1.trim() || !city.trim() || !stateCode.trim() || !postalCode.trim()) {
        return setError("Please enter the complete delivery address.");
      }
    }
    if (pickupTime === "custom" && !customDate) return setError("Please select a date.");
    if (pickupTime === "custom") {
      let hour = Number(customHour);
      if (customPeriod === "AM" && hour === 12) hour = 0;
      if (customPeriod === "PM" && hour !== 12) hour += 12;
      const nextCustomTime = `${customDate}T${String(hour).padStart(2, "0")}:${customMinute}`;
      setCustomTime(nextCustomTime);
    }

    setSubmitting(true);
    try {
      window.localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: name.trim(), phone: phone.trim() }));
      const response = await fetch(`/api/businesses/${businessId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentType,
          customer: { name: name.trim(), phone: phone.trim() },
          deliveryAddress: fulfillmentType === "delivery" ? {
            address1: address1.trim(), address2: address2.trim(), city: city.trim(),
            state: stateCode.trim(), postalCode: postalCode.trim(), note: deliveryNote.trim(),
          } : null,
          requestedTime: pickupTime === "custom"
            ? (() => {
                let hour = Number(customHour);
                if (customPeriod === "AM" && hour === 12) hour = 0;
                if (customPeriod === "PM" && hour !== 12) hour += 12;
                return `${customDate}T${String(hour).padStart(2, "0")}:${customMinute}`;
              })()
            : pickupTime,
          paymentMethod,
          tipPercent,
          items: cartItems.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            instructions: item.instructions,
            selections: item.selections,
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "주문을 완료하지 못했습니다.");

      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      onOrderPlaced();
      alert(`Order #${payload.orderNumber} received.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "주문을 완료하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[13000] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white text-gray-950 shadow-2xl sm:max-w-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-gray-400">CHECKOUT</p><h2 className="text-xl font-black">{fulfillmentType === "delivery" ? "Delivery" : "Pickup"}</h2></div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full bg-gray-100 text-lg font-black">×</button>
        </div>

        <div className="space-y-5 p-5">
          {error ? <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
          {loading ? <div className="py-10 text-center text-sm font-bold text-gray-500">Loading…</div> : null}

          {!loading && settings ? <>
            <section className="rounded-2xl border p-4">
              <h3 className="font-black">Customer Information</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" className="rounded-xl border px-3 py-3 text-sm" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone *" inputMode="tel" className="rounded-xl border px-3 py-3 text-sm" />
              </div>
            </section>

            {fulfillmentType === "delivery" ? <section className="rounded-2xl border p-4">
              <h3 className="font-black">Delivery Address</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input value={address1} onChange={(e) => setAddress1(e.target.value)} placeholder="Street address *" className="sm:col-span-2 rounded-xl border px-3 py-3 text-sm" />
                <input value={address2} onChange={(e) => setAddress2(e.target.value)} placeholder="Apt / Suite" className="sm:col-span-2 rounded-xl border px-3 py-3 text-sm" />
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City *" className="rounded-xl border px-3 py-3 text-sm" />
                <input value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="State *" className="rounded-xl border px-3 py-3 text-sm" />
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="ZIP *" className="rounded-xl border px-3 py-3 text-sm" />
                <input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="Gate code / delivery note" className="rounded-xl border px-3 py-3 text-sm" />
              </div>
            </section> : null}

            <section className="rounded-2xl border p-4">
              <h3 className="font-black">{fulfillmentType === "delivery" ? "Delivery Time" : "Pickup Time"}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {["asap", "15", "30", "45", "60", "custom"].map((v) => <button key={v} type="button" onClick={() => setPickupTime(v)} className={`rounded-full border px-3 py-2 text-xs font-black ${pickupTime === v ? "bg-gray-950 text-white" : "bg-white"}`}>{v === "asap" ? "ASAP" : v === "custom" ? "Select Time" : `${v} min`}</button>)}
              </div>
              {pickupTime === "custom" ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr]">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-black uppercase text-gray-500">Select Date</span>
                    <input
                      type="date"
                      lang="en-US"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full rounded-xl border px-3 py-3 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-black uppercase text-gray-500">Hour</span>
                    <select value={customHour} onChange={(e) => setCustomHour(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-3 text-sm">
                      {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-black uppercase text-gray-500">Minute</span>
                    <select value={customMinute} onChange={(e) => setCustomMinute(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-3 text-sm">
                      {["00", "15", "30", "45"].map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-black uppercase text-gray-500">AM / PM</span>
                    <select value={customPeriod} onChange={(e) => setCustomPeriod(e.target.value as "AM" | "PM")} className="w-full rounded-xl border bg-white px-3 py-3 text-sm">
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border p-4">
              <h3 className="font-black">Tip</h3>
              <div className="mt-3 flex flex-wrap gap-2">{[0, ...(settings.tipPresets || [])].map((p) => <button key={p} type="button" onClick={() => setTipPercent(Number(p))} className={`rounded-full border px-3 py-2 text-xs font-black ${tipPercent === Number(p) ? "bg-gray-950 text-white" : "bg-white"}`}>{p === 0 ? "No tip" : `${p}%`}</button>)}</div>
            </section>

            <section className="rounded-2xl border p-4">
              <h3 className="font-black">Payment</h3>

              {fulfillmentType === "pickup" ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${
                      paymentMethod === "pay_at_pickup"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "pay_at_pickup"}
                      onChange={() => setPaymentMethod("pay_at_pickup")}
                      className="mt-1 h-4 w-4 accent-blue-600"
                    />
                    <span>
                      <b className="block text-sm">Pay at Store</b>
                      <span className="mt-1 block text-xs text-gray-500">
                        Pay when you pick up your order.
                      </span>
                    </span>
                  </label>

                  <label
                    className={`flex items-start gap-3 rounded-2xl border-2 p-4 transition ${
                      settings.onlinePaymentEnabled
                        ? "cursor-pointer"
                        : "cursor-not-allowed opacity-50"
                    } ${
                      paymentMethod === "online" && settings.onlinePaymentEnabled
                        ? "border-emerald-600 bg-emerald-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "online"}
                      disabled={!settings.onlinePaymentEnabled}
                      onChange={() => setPaymentMethod("online")}
                      className="mt-1 h-4 w-4 accent-emerald-600"
                    />
                    <span>
                      <b className="block text-sm">Pay Now</b>
                      <span className="mt-1 block text-xs text-gray-500">
                        Apple Pay · Google Pay · Card
                      </span>
                      {!settings.onlinePaymentEnabled ? (
                        <span className="mt-1 block text-[10px] font-bold text-red-500">
                          Online payment is not configured yet.
                        </span>
                      ) : null}
                    </span>
                  </label>
                </div>
              ) : (
                <div className="mt-3">
                  <label
                    className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${
                      settings.onlinePaymentEnabled
                        ? "cursor-pointer border-emerald-600 bg-emerald-50"
                        : "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "online"}
                      disabled={!settings.onlinePaymentEnabled}
                      onChange={() => setPaymentMethod("online")}
                      className="mt-1 h-4 w-4 accent-emerald-600"
                    />
                    <span>
                      <b className="block text-sm">Pay Now</b>
                      <span className="mt-1 block text-xs text-gray-500">
                        Apple Pay · Google Pay · Card
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-gray-50 p-4 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><b>{money(subtotal)}</b></div>
              <div className="mt-2 flex justify-between"><span>Estimated tax</span><b>{money(tax)}</b></div>
              <div className="mt-2 flex justify-between"><span>Tip</span><b>{money(tip)}</b></div>
              <div className="mt-3 flex justify-between border-t pt-3 text-lg"><b>Estimated total</b><b>{money(estimatedTotal)}</b></div>
              <p className="mt-2 text-[10px] text-gray-500">Final total is recalculated securely on the server from the current menu prices.</p>
            </section>

            <button type="button" disabled={submitting || !cartItems.length} onClick={submitOrder} className="w-full rounded-2xl bg-gray-950 px-4 py-4 text-sm font-black text-white disabled:opacity-50">{submitting ? "PROCESSING…" : paymentMethod === "online" ? "PAY NOW" : "PLACE ORDER · PAY AT STORE"}</button>
          </> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
