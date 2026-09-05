"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  orderingOpen?: boolean;
  orderingHoursEnforced?: boolean;
  orderingClosedReason?: string;
  orderingClosesAt?: string | null;
  orderingCutoffAt?: string | null;
  orderCutoffMinutes?: number;
  deliveryProvider?: "manual" | "uber_direct" | "doordash_drive" | "auto";
  deliveryDispatchEnabled?: boolean;
};

type Props = {
  businessId: number;
  fulfillmentType: "pickup" | "delivery";
  cartItems: CheckoutCartItem[];
  onClose: () => void;
  onOrderPlaced: () => void;
};

const CUSTOMER_KEY = "restaurant-order-customer";

type SquarePreparedPayment = {
  orderId: number;
  orderNumber: string;
  applicationId: string;
  locationId: string;
  amount: string;
  amountCents: number;
  currencyCode: string;
};

let squareSdkPromise: Promise<void> | null = null;

function loadSquareSdk() {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).Square) return Promise.resolve();
  if (squareSdkPromise) return squareSdkPromise;

  squareSdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-ktown-square-web-payments="1"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Square payment library could not be loaded.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://web.squarecdn.com/v1/square.js";
    script.async = true;
    script.dataset.ktownSquareWebPayments = "1";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Square payment library could not be loaded."));
    document.head.appendChild(script);
  });

  return squareSdkPromise;
}

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
  const [isIPhone, setIsIPhone] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || "";
    setIsIPhone(/iPhone/i.test(ua));
  }, []);

  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryQuote, setDeliveryQuote] = useState<{
    quoteId: string;
    feeCents: number;
    expiresAt?: string | null;
    durationMinutes?: number | null;
    pickupMinutes?: number | null;
    dropoffEta?: string | null;
  } | null>(null);
  const [deliveryQuoteLoading, setDeliveryQuoteLoading] = useState(false);
  const [deliveryQuoteError, setDeliveryQuoteError] = useState("");
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
  const [squarePrepared, setSquarePrepared] =
    useState<SquarePreparedPayment | null>(null);
  const [squareMethodsLoading, setSquareMethodsLoading] = useState(false);
  const [squareCardReady, setSquareCardReady] = useState(false);
  const [squareGoogleReady, setSquareGoogleReady] = useState(false);
  const [squareAppleReady, setSquareAppleReady] = useState(false);
  const [squareAppleError, setSquareAppleError] = useState("");
  const [squarePaying, setSquarePaying] = useState(false);

  const squarePaymentsRef = useRef<any>(null);
  const squareCardRef = useRef<any>(null);
  const squareGoogleRef = useRef<any>(null);
  const squareAppleRef = useRef<any>(null);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Math.max(0, Number(item.totalPrice) || 0), 0),
    [cartItems],
  );
  const tax = subtotal * Math.max(0, Number(settings?.taxRate || 0));
  const tip = subtotal * (tipPercent / 100);
  const deliveryFee =
    fulfillmentType === "delivery"
      ? Math.max(0, Number(deliveryQuote?.feeCents || 0)) / 100
      : 0;
  const estimatedTotal = subtotal + tax + tip + deliveryFee;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CUSTOMER_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setName(String(saved?.name || ""));
        setPhone(String(saved?.phone || ""));
        setEmail(String(saved?.email || ""));
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
          // Pay at Store is temporarily disabled.
          // All orders must use online payment.
          setPaymentMethod("online");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "주문 설정을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [businessId]);

  useEffect(() => {
    if (
      fulfillmentType !== "delivery" ||
      !settings?.deliveryDispatchEnabled
    ) {
      setDeliveryQuote(null);
      setDeliveryQuoteError("");
      return;
    }

    const complete =
      address1.trim() &&
      city.trim() &&
      stateCode.trim() &&
      postalCode.trim();

    if (!complete) {
      setDeliveryQuote(null);
      setDeliveryQuoteError("");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setDeliveryQuoteLoading(true);
      setDeliveryQuoteError("");

      try {
        const response = await fetch(
          `/api/businesses/${businessId}/delivery/quote`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deliveryAddress: {
                address1: address1.trim(),
                address2: address2.trim(),
                city: city.trim(),
                state: stateCode.trim(),
                postalCode: postalCode.trim(),
              },
            }),
          },
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error || "Delivery quote could not be created.",
          );
        }

        if (!cancelled) {
          setDeliveryQuote({
            quoteId: String(payload.quoteId || ""),
            feeCents: Number(payload.feeCents || 0),
            expiresAt: payload.expiresAt || null,
            durationMinutes:
              payload.durationMinutes == null
                ? null
                : Number(payload.durationMinutes),
            pickupMinutes:
              payload.pickupMinutes == null
                ? null
                : Number(payload.pickupMinutes),
            dropoffEta: payload.dropoffEta || null,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setDeliveryQuote(null);
          setDeliveryQuoteError(
            e instanceof Error
              ? e.message
              : "Delivery quote could not be created.",
          );
        }
      } finally {
        if (!cancelled) setDeliveryQuoteLoading(false);
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    fulfillmentType,
    settings?.deliveryDispatchEnabled,
    businessId,
    address1,
    address2,
    city,
    stateCode,
    postalCode,
  ]);

  useEffect(() => {
    if (!squarePrepared) return;

    let cancelled = false;

    setSquareMethodsLoading(true);
    setSquareCardReady(false);
    setSquareGoogleReady(false);
    setSquareAppleReady(false);
    setSquareAppleError("");
    setError("");

    (async () => {
      try {
        await loadSquareSdk();
        if (cancelled) return;

        const Square = (window as any).Square;
        if (!Square) {
          throw new Error("Square payment library is unavailable.");
        }

        const payments = Square.payments(
          squarePrepared.applicationId,
          squarePrepared.locationId,
        );
        squarePaymentsRef.current = payments;

        const paymentRequest = payments.paymentRequest({
          countryCode: "US",
          currencyCode: squarePrepared.currencyCode || "USD",
          total: {
            amount: squarePrepared.amount,
            label: "KTown Order",
          },
        });

        try {
          const card = await payments.card();
          if (!cancelled) {
            squareCardRef.current = card;
            await card.attach("#ktown-square-card");
            if (!cancelled) setSquareCardReady(true);
          }
        } catch (cardError) {
          console.error("Square card init:", cardError);
        }

        try {
          const googlePay = await payments.googlePay(paymentRequest);
          if (!cancelled) {
            squareGoogleRef.current = googlePay;
            await googlePay.attach("#ktown-square-google-pay", {
              buttonColor: "default",
              buttonType: "long",
            });
            if (!cancelled) setSquareGoogleReady(true);
          }
        } catch {
          // Google Pay is only shown on supported devices/browsers.
        }

        try {
          const applePay = await payments.applePay(paymentRequest);

          if (!cancelled) {
            squareAppleRef.current = applePay;
            setSquareAppleReady(true);
            setSquareAppleError("");
          }
        } catch (applePayError) {
          console.error("Square Apple Pay init:", applePayError);

          // Retry once because Safari / Apple Pay capability can finish
          // initializing slightly after the Square SDK is ready.
          try {
            await new Promise((resolve) =>
              window.setTimeout(resolve, 500),
            );

            if (cancelled) return;

            const applePay =
              await payments.applePay(paymentRequest);

            if (!cancelled) {
              squareAppleRef.current = applePay;
              setSquareAppleReady(true);
              setSquareAppleError("");
            }
          } catch (retryError) {
            console.error(
              "Square Apple Pay init retry:",
              retryError,
            );

            if (!cancelled) {
              const rawMessage =
                retryError instanceof Error
                  ? retryError.message
                  : applePayError instanceof Error
                    ? applePayError.message
                    : "Apple Pay is unavailable on this device or browser.";

              setSquareAppleReady(false);
              setSquareAppleError(
                rawMessage ||
                  "Apple Pay is unavailable on this device or browser.",
              );
            }
          }
        }

        if (
          !cancelled &&
          !squareCardRef.current &&
          !squareGoogleRef.current &&
          !squareAppleRef.current
        ) {
          throw new Error(
            "No supported Square payment method is available on this device.",
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Payment form could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setSquareMethodsLoading(false);
      }
    })();

    return () => {
      cancelled = true;

      for (const ref of [
        squareCardRef,
        squareGoogleRef,
        squareAppleRef,
      ]) {
        try {
          ref.current?.destroy?.();
        } catch {}
        ref.current = null;
      }

      squarePaymentsRef.current = null;
    };
  }, [squarePrepared]);

  function billingContact() {
    return {
      givenName: name.trim(),
      phone: phone.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
      countryCode: "US",
      ...(fulfillmentType === "delivery"
        ? {
            addressLines: [
              address1.trim(),
              address2.trim(),
            ].filter(Boolean),
            city: city.trim(),
            state: stateCode.trim(),
            postalCode: postalCode.trim(),
          }
        : {}),
    };
  }

  async function finishSquarePayment(
    method: "card" | "google" | "apple",
  ) {
    if (!squarePrepared || squarePaying) return;

    setSquarePaying(true);
    setError("");

    try {
      const amount = squarePrepared.amount;
      const currencyCode =
        squarePrepared.currencyCode || "USD";

      let tokenResult: any;
      let verificationToken = "";

      if (method === "card") {
        if (!squareCardRef.current) {
          throw new Error("Card payment is not ready.");
        }

        tokenResult = await squareCardRef.current.tokenize({
          amount,
          currencyCode,
          intent: "CHARGE",
          billingContact: billingContact(),
          customerInitiated: true,
          sellerKeyedIn: false,
        });
      } else if (method === "google") {
        if (!squareGoogleRef.current) {
          throw new Error("Google Pay is not available.");
        }
        tokenResult = await squareGoogleRef.current.tokenize();
      } else {
        if (!squareAppleRef.current) {
          throw new Error("Apple Pay is not available.");
        }
        tokenResult = await squareAppleRef.current.tokenize();
      }

      if (tokenResult?.status !== "OK" || !tokenResult?.token) {
        const detail = Array.isArray(tokenResult?.errors)
          ? tokenResult.errors
              .map((item: any) => item?.message || item?.detail || item?.code)
              .filter(Boolean)
              .join(" / ")
          : "";
        throw new Error(detail || "Payment information could not be verified.");
      }

      if (
        method !== "card" &&
        squarePaymentsRef.current?.verifyBuyer
      ) {
        const verification = await squarePaymentsRef.current.verifyBuyer(
          tokenResult.token,
          {
            amount,
            currencyCode,
            intent: "CHARGE",
            billingContact: billingContact(),
          },
        );
        verificationToken = String(verification?.token || "");
      }

      const attemptId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const response = await fetch(
        `/api/businesses/${businessId}/orders/${squarePrepared.orderId}/square-pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: tokenResult.token,
            verificationToken,
            attemptId,
            buyerEmailAddress: email.trim(),
            buyerPhoneNumber: phone.trim(),
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || "Payment could not be completed.",
        );
      }

      onOrderPlaced();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Payment could not be completed.",
      );
    } finally {
      setSquarePaying(false);
    }
  }

  async function submitOrder() {
    setError("");

    if (
      settings?.orderingHoursEnforced &&
      settings?.orderingOpen === false
    ) {
      return setError(
        settings.orderingClosedReason ||
          "Online ordering is currently closed.",
      );
    }
    if (!name.trim()) return setError("Please enter your name.");
    if (!phone.trim()) return setError("Please enter your phone number.");
    if (
      email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return setError("Please enter a valid email address.");
    }
    if (fulfillmentType === "delivery") {
      if (!address1.trim() || !city.trim() || !stateCode.trim() || !postalCode.trim()) {
        return setError("Please enter the complete delivery address.");
      }
      if (settings?.deliveryDispatchEnabled && deliveryQuoteLoading) {
        return setError("Please wait for the delivery fee.");
      }
      if (settings?.deliveryDispatchEnabled && !deliveryQuote) {
        return setError(
          deliveryQuoteError ||
            "A delivery quote is required before placing the order.",
        );
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
      window.localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() }));
      const response = await fetch(`/api/businesses/${businessId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentType,
          customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
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
          deliveryQuote:
            fulfillmentType === "delivery" && deliveryQuote
              ? {
                  quoteId: deliveryQuote.quoteId,
                  feeCents: deliveryQuote.feeCents,
                  expiresAt: deliveryQuote.expiresAt || null,
                }
              : null,
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

      if (
        payload?.paymentProvider === "square" &&
        payload?.paymentRequired &&
        payload?.squarePayment
      ) {
        setSquarePrepared({
          orderId: Number(payload.orderId),
          orderNumber: String(payload.orderNumber || ""),
          applicationId: String(payload.squarePayment.applicationId || ""),
          locationId: String(payload.squarePayment.locationId || ""),
          amount: String(payload.squarePayment.amount || "0.00"),
          amountCents: Number(payload.squarePayment.amountCents || 0),
          currencyCode: String(payload.squarePayment.currencyCode || "USD"),
        });
        return;
      }

      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      onOrderPlaced();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "주문을 완료하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={
        isIPhone
          ? "fixed inset-0 z-[13000] flex items-start justify-center bg-black/60 px-2 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2"
          : "fixed inset-0 z-[13000] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      }
      onClick={onClose}
    >
      <div className={
            isIPhone
              ? "max-h-[95dvh] w-[calc(100%-1rem)] max-w-[350px] overflow-y-auto rounded-2xl bg-white text-gray-950 shadow-2xl"
              : "max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white text-gray-950 shadow-2xl sm:max-w-2xl sm:rounded-3xl"
          } onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-gray-400">CHECKOUT</p><h2 className="text-xl font-black">{fulfillmentType === "delivery" ? "Delivery" : "Pickup"}</h2></div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full bg-gray-100 text-lg font-black">×</button>
        </div>

        <div className="space-y-5 p-5">
          {settings?.orderingHoursEnforced === true && settings?.orderingOpen === false ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {settings.orderingClosedReason || "Online ordering is currently closed."}
            </div>
          ) : null}
          {error ? <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
          {loading ? <div className="py-10 text-center text-sm font-bold text-gray-500">Loading…</div> : null}

          {!loading && settings ? <>
            {squarePrepared ? (
              <>
                <section className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.16em] text-gray-400">
                        SECURE PAYMENT
                      </p>
                      <h3 className="mt-1 text-lg font-black">
                        Order #{squarePrepared.orderNumber}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        Your name and phone were already received by KTown. No duplicate contact form.
                      </p>
                    </div>
                    <b className="shrink-0 whitespace-nowrap text-xl">{money(Number(squarePrepared.amount))}</b>
                  </div>
                </section>

                {error ? (
                  <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
                    {error}
                  </div>
                ) : null}

                <section className="rounded-2xl border p-4">
                  <h3 className="font-black">Payment</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Apple Pay · Google Pay · Credit / Debit Card
                  </p>

                  {squareMethodsLoading ? (
                    <div className="py-6 text-center text-sm font-bold text-gray-500">
                      Loading secure payment…
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        id="ktown-apple-pay-button"
                        type="button"
                        aria-label="Pay with Apple Pay"
                        onClick={() => finishSquarePayment("apple")}
                        disabled={!squareAppleReady || squarePaying}
                        className={`h-12 min-w-0 w-full overflow-hidden rounded-xl ${
                          squareAppleReady ? "block" : "hidden"
                        }`}
                      />

                      <div
                        id="ktown-square-google-pay"
                        onClick={() => {
                          if (squareGoogleReady && !squarePaying) {
                            finishSquarePayment("google");
                          }
                        }}
                        className={
                          squareGoogleReady
                            ? "h-12 min-w-0 w-full overflow-hidden rounded-xl"
                            : "hidden"
                        }
                      />
                    </div>

                    <style jsx>{`
                      #ktown-apple-pay-button {
                        -webkit-appearance: -apple-pay-button;
                        -apple-pay-button-type: pay;
                        -apple-pay-button-style: black;
                      }

                      #ktown-square-google-pay {
                        height: 48px;
                      }

                      #ktown-square-google-pay > * {
                        width: 100% !important;
                        height: 48px !important;
                        max-width: none !important;
                      }
                    `}</style>

                    {!squareMethodsLoading &&
                    !squareAppleReady &&
                    squareAppleError ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
                        Apple Pay unavailable: {squareAppleError}
                      </div>
                    ) : null}

                    <div
                      className={`rounded-xl border p-3 ${
                        squareCardReady ? "" : "hidden"
                      }`}
                    >
                      <div id="ktown-square-card" />
                      <button
                        type="button"
                        onClick={() => finishSquarePayment("card")}
                        disabled={!squareCardReady || squarePaying}
                        className="mt-3 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                      >
                        {squarePaying
                          ? "PROCESSING…"
                          : `PAY ${money(Number(squarePrepared.amount))}`}
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-[10px] text-gray-500">
                    Payment is securely processed by Square. KTown does not store card numbers.
                  </p>
                </section>
              </>
            ) : (
              <>
            <section className="rounded-2xl border p-4">
              <h3 className="font-black">Customer Information</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" className="rounded-xl border px-3 py-3 text-sm" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone *" inputMode="tel" className="rounded-xl border px-3 py-3 text-sm" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email for receipt (optional)"
                  inputMode="email"
                  autoComplete="email"
                  className="rounded-xl border px-3 py-3 text-sm sm:col-span-2"
                />
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

            {fulfillmentType === "delivery" &&
            settings?.deliveryDispatchEnabled ? (
              <section className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black">Delivery</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Uber Direct courier will be requested automatically after payment.
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {deliveryQuoteLoading ? (
                      <b className="text-sm">Checking…</b>
                    ) : deliveryQuote ? (
                      <>
                        <b className="whitespace-nowrap text-lg">
                          {money(deliveryFee)}
                        </b>
                        {deliveryQuote.durationMinutes ? (
                          <p className="text-[10px] text-gray-500">
                            about {deliveryQuote.durationMinutes} min
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <b className="text-sm text-gray-400">Enter address</b>
                    )}
                  </div>
                </div>
                {deliveryQuoteError ? (
                  <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
                    {deliveryQuoteError}
                  </div>
                ) : null}
              </section>
            ) : null}

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
                    {!settings.onlinePaymentEnabled ? (
                      <span className="mt-1 block text-[10px] font-bold text-red-500">
                        Online payment is not configured yet.
                      </span>
                    ) : null}
                  </span>
                </label>
              </div>
            </section>

            <section className="rounded-2xl bg-gray-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="min-w-0">Subtotal</span><b className="shrink-0 whitespace-nowrap">{money(subtotal)}</b></div>
              <div className="mt-2 flex items-center justify-between gap-3"><span className="min-w-0">Estimated tax</span><b className="shrink-0 whitespace-nowrap">{money(tax)}</b></div>
              <div className="mt-2 flex items-center justify-between gap-3"><span className="min-w-0">Tip</span><b className="shrink-0 whitespace-nowrap">{money(tip)}</b></div>
              {fulfillmentType === "delivery" ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="min-w-0">Delivery fee</span>
                  <b className="shrink-0 whitespace-nowrap">
                    {deliveryQuoteLoading
                      ? "Checking…"
                      : deliveryQuote
                        ? money(deliveryFee)
                        : "—"}
                  </b>
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-lg"><b className="min-w-0 whitespace-nowrap">Estimated total</b><b className="shrink-0 whitespace-nowrap">{money(estimatedTotal)}</b></div>
              <p className="mt-2 text-[10px] text-gray-500">Final total is recalculated securely on the server from the current menu prices.</p>
            </section>

            <button type="button" disabled={
              submitting ||
              !cartItems.length ||
              (settings?.orderingHoursEnforced === true &&
                settings?.orderingOpen === false) ||
              !settings?.onlinePaymentEnabled ||
              (fulfillmentType === "delivery" &&
                settings?.deliveryDispatchEnabled === true &&
                (deliveryQuoteLoading || !deliveryQuote))
            } onClick={submitOrder} className="w-full rounded-2xl bg-gray-950 px-4 py-4 text-sm font-black text-white disabled:opacity-50">{submitting ? "PROCESSING…" : "PAY NOW"}</button>
              </>
            )}
          </> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
