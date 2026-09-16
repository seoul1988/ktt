"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TrackingOrder = {
  orderNumber: string;
  businessName: string;
  fulfillmentType: string;
  paymentStatus: string | null;
  orderStatus: string | null;
  requestedTime: string | null;
  paidAt: string | null;
  trackingExpiresAt: string;
  delivery: null | {
    provider: string | null;
    status: string | null;
    trackingUrl: string | null;
    courier: any;
    lastUpdatedAt: string | null;
  };
};

type TrackingResponse = {
  ok?: boolean;
  expired?: boolean;
  orderNumber?: string;
  order?: TrackingOrder;
  error?: string;
};

function prettyStatus(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^event\./i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function deliveryStep(value: unknown) {
  const status = String(value || "").toLowerCase();

  if (
    status.includes("delivered") ||
    status.includes("completed")
  ) return 5;

  if (
    status.includes("dropoff") ||
    status.includes("on_the_way") ||
    status.includes("en_route") ||
    status.includes("enroute")
  ) return 4;

  if (
    status.includes("picked_up") ||
    status.includes("pickup_complete") ||
    status.includes("courier_pickup")
  ) return 3;

  if (
    status.includes("courier") ||
    status.includes("driver") ||
    status.includes("assigned")
  ) return 2;

  if (
    status.includes("preparing") ||
    status.includes("accepted") ||
    status.includes("pending") ||
    status.includes("awaiting")
  ) return 1;

  return 0;
}

function orderStep(value: unknown) {
  const status = String(value || "").toLowerCase();

  if (
    status.includes("completed") ||
    status.includes("ready") ||
    status.includes("picked")
  ) return 2;

  if (
    status.includes("preparing") ||
    status.includes("accepted") ||
    status.includes("confirmed")
  ) return 1;

  return 0;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function OrderTrackingPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || "");

  const [data, setData] = useState<TrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function load() {
      try {
        const response = await fetch(
          `/api/orders/track/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );

        const payload: TrackingResponse = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load order tracking.");
        }

        if (!active) return;

        setData(payload);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load order tracking.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    const timer = window.setInterval(() => {
      load();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token]);

  const order = data?.order;

  const steps = useMemo(() => {
    if (!order) return [];

    if (order.fulfillmentType === "delivery") {
      const current = deliveryStep(order.delivery?.status);

      return [
        { label: "Order received", done: true, active: current === 0 },
        { label: "Preparing", done: current > 1, active: current === 1 },
        { label: "Driver assigned", done: current > 2, active: current === 2 },
        { label: "Picked up", done: current > 3, active: current === 3 },
        { label: "On the way", done: current > 4, active: current === 4 },
        { label: "Delivered", done: current >= 5, active: current === 5 },
      ];
    }

    const current = orderStep(order.orderStatus);

    return [
      { label: "Order received", done: true, active: current === 0 },
      { label: "Preparing", done: current > 1, active: current === 1 },
      { label: "Ready for pickup", done: current >= 2, active: current === 2 },
    ];
  }, [order]);

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.brand}>KTown Triangle</div>
          <h1 style={styles.title}>Loading your order...</h1>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.brand}>KTown Triangle</div>
          <h1 style={styles.title}>Order tracking</h1>
          <div style={styles.notice}>{error}</div>
        </section>
      </main>
    );
  }

  if (data?.expired) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.brand}>KTown Triangle</div>
          <h1 style={styles.title}>Tracking link expired</h1>
          {data.orderNumber ? (
            <div style={styles.orderNumber}>Order #{data.orderNumber}</div>
          ) : null}
          <p style={styles.muted}>
            This order tracking link is available for 1 hour after payment.
          </p>
        </section>
      </main>
    );
  }

  if (!order) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.notice}>Order information is unavailable.</div>
        </section>
      </main>
    );
  }

  const deliveryStatus = prettyStatus(order.delivery?.status);
  const courierName =
    order.delivery?.courier?.name ||
    order.delivery?.courier?.courier_name ||
    order.delivery?.courier?.display_name ||
    "";

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brand}>KTown Triangle</div>

        <h1 style={styles.restaurant}>{order.businessName}</h1>
        <div style={styles.orderNumber}>Order #{order.orderNumber}</div>

        {order.paymentStatus === "paid" ? (
          <div style={styles.paid}>✓ Payment completed</div>
        ) : null}

        <div style={styles.divider} />

        <div style={styles.sectionLabel}>ORDER STATUS</div>

        <div style={styles.timeline}>
          {steps.map((step, index) => (
            <div key={step.label} style={styles.step}>
              <div
                style={{
                  ...styles.dot,
                  ...(step.done || step.active ? styles.dotOn : {}),
                }}
              >
                {step.done ? "✓" : step.active ? "●" : ""}
              </div>

              <div style={styles.stepBody}>
                <div
                  style={{
                    ...styles.stepLabel,
                    ...(step.done || step.active ? styles.stepLabelOn : {}),
                  }}
                >
                  {step.label}
                </div>

                {index < steps.length - 1 ? (
                  <div
                    style={{
                      ...styles.line,
                      ...(step.done ? styles.lineOn : {}),
                    }}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {order.fulfillmentType === "delivery" && deliveryStatus ? (
          <div style={styles.infoBox}>
            <strong>Delivery status:</strong> {deliveryStatus}
            {courierName ? (
              <div style={styles.infoRow}>
                <strong>Driver:</strong> {courierName}
              </div>
            ) : null}
            {order.delivery?.lastUpdatedAt ? (
              <div style={styles.small}>
                Updated {formatTime(order.delivery.lastUpdatedAt)}
              </div>
            ) : null}
          </div>
        ) : null}

        {order.fulfillmentType === "pickup" && order.requestedTime ? (
          <div style={styles.infoBox}>
            <strong>Pickup:</strong>{" "}
            {order.requestedTime === "asap"
              ? "As soon as possible"
              : order.requestedTime}
          </div>
        ) : null}

        {order.delivery?.trackingUrl ? (
          <a
            href={order.delivery.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.button}
          >
            Track Delivery
          </a>
        ) : null}

        <p style={styles.refresh}>
          This page updates automatically every 15 seconds.
        </p>

        {order.trackingExpiresAt ? (
          <p style={styles.expires}>
            Tracking available until {formatTime(order.trackingExpiresAt)} ET
          </p>
        ) : null}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f6f8",
    padding: "24px 14px 60px",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 22,
    padding: "28px 22px",
    boxShadow: "0 10px 30px rgba(0,0,0,.08)",
    boxSizing: "border-box",
  },
  brand: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    opacity: 0.55,
    marginBottom: 18,
  },
  title: {
    margin: "0 0 14px",
    fontSize: 26,
  },
  restaurant: {
    margin: 0,
    fontSize: 27,
    lineHeight: 1.2,
  },
  orderNumber: {
    marginTop: 7,
    fontSize: 16,
    fontWeight: 700,
    opacity: 0.68,
  },
  paid: {
    marginTop: 18,
    padding: "11px 14px",
    background: "#f3f8f3",
    borderRadius: 12,
    fontWeight: 700,
  },
  divider: {
    height: 1,
    background: "#ececec",
    margin: "25px 0",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: ".1em",
    opacity: 0.5,
    marginBottom: 18,
  },
  timeline: {
    marginBottom: 22,
  },
  step: {
    display: "flex",
    alignItems: "flex-start",
    minHeight: 55,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "2px solid #d7d7d7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: 13,
    fontWeight: 900,
    background: "#fff",
  },
  dotOn: {
    borderColor: "#111",
    background: "#111",
    color: "#fff",
  },
  stepBody: {
    position: "relative",
    paddingLeft: 14,
    minHeight: 55,
    flex: 1,
  },
  stepLabel: {
    paddingTop: 4,
    fontSize: 16,
    fontWeight: 650,
    opacity: 0.38,
  },
  stepLabelOn: {
    opacity: 1,
  },
  line: {
    position: "absolute",
    left: -29,
    top: 28,
    width: 2,
    height: 29,
    background: "#dedede",
  },
  lineOn: {
    background: "#111",
  },
  infoBox: {
    padding: "15px",
    border: "1px solid #e7e7e7",
    borderRadius: 14,
    marginTop: 12,
    lineHeight: 1.5,
  },
  infoRow: {
    marginTop: 5,
  },
  small: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.55,
  },
  button: {
    display: "block",
    marginTop: 18,
    padding: "15px 18px",
    borderRadius: 14,
    background: "#111",
    color: "#fff",
    textDecoration: "none",
    textAlign: "center",
    fontWeight: 800,
  },
  refresh: {
    textAlign: "center",
    fontSize: 12,
    opacity: 0.5,
    margin: "20px 0 0",
  },
  expires: {
    textAlign: "center",
    fontSize: 11,
    opacity: 0.42,
    margin: "6px 0 0",
  },
  notice: {
    marginTop: 16,
    padding: 15,
    borderRadius: 12,
    background: "#f5f5f5",
    lineHeight: 1.5,
  },
  muted: {
    lineHeight: 1.6,
    opacity: 0.65,
  },
};
