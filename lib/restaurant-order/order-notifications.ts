import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRestaurantSmsConfig, normalizeSmsPhone } from "@/lib/restaurant-order/sms-config";
import { sendTwilioSms, TwilioSmsError } from "@/lib/restaurant-order/twilio";
import { sendOrderConfirmationSms } from "@/lib/restaurant-order/order-confirmation-sms";

type Event = "confirmed" | "new" | "preparing" | "ready" | "completed" | "cancelled";
type Result = { queued: boolean; reason?: string; reconciliationRequired?: boolean };
type Args = { db: SupabaseClient; businessId: number; orderId: number; event: Event; cancelUrl?: string; trackingUrl?: string };
const clean = (value: unknown) => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();
const dollars = (value: unknown) => `$${Number(value || 0).toFixed(2)}`;

function optionLabels(raw: unknown): string[] {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return [clean(value)].filter(Boolean); }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const labels: string[] = [];
  for (const group of Object.values(value)) {
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;
    for (const [key, count] of Object.entries(group)) {
      const qty = Math.max(0, Math.floor(Number(count) || 0));
      const label = clean(key.includes(":") ? key.slice(key.indexOf(":") + 1) : key).replace(/^["']+|["']+$/g, "");
      if (qty && label) labels.push(qty > 1 ? `${label} x${qty}` : label);
    }
  }
  return labels;
}

// Each event/channel is claimed atomically in the DB. Unknown outcomes retain
// the claim; do not automatically resend after a timeout or process crash.
async function deliver({ db, businessId, orderId, event }: Args, channel: "email" | "sms", send: () => Promise<string>): Promise<Result> {
  const { data: claim, error } = await db.from("restaurant_order_notifications")
    .insert({ business_id: businessId, order_id: orderId, event, channel, status: "pending" })
    .select("id").single();
  if (error || !claim) return { queued: false, reason: error?.code === "23505" ? "already_claimed" : "notification_claim_failed" };
  let accepted = false;
  try {
    const providerId = await send();
    accepted = true;
    const { error: saveError } = await db.from("restaurant_order_notifications")
      .update({ status: "accepted", provider_id: providerId, accepted_at: new Date().toISOString() })
      .eq("id", claim.id).eq("business_id", businessId);
    return { queued: true, reconciliationRequired: Boolean(saveError) };
  } catch (error) {
    const rejected = !accepted && error instanceof TwilioSmsError && !error.acceptanceUnknown;
    // Record definite rejections without retrying on page refresh/status saves.
    // Pending claims must be reconciled with provider logs before any retry.
    try {
      await db.from("restaurant_order_notifications")
        .update({ status: rejected ? "rejected" : "unknown" })
        .eq("id", claim.id).eq("business_id", businessId);
    } catch { /* Keep original claim on bookkeeping failure. */ }
    console.error("ORDER_NOTIFICATION_FAILED", { businessId, orderId, event, channel, outcome: rejected ? "rejected" : "unknown" });
    return { queued: false, reason: "send_failed", reconciliationRequired: !rejected };
  }
}

export async function sendOrderNotifications(args: Args): Promise<{ email: Result; sms: Result }> {
  const result: { email: Result; sms: Result } = {
    email: { queued: false, reason: "not_selected" }, sms: { queued: false, reason: "not_selected" },
  };
  try {
    const { db, businessId, orderId, event } = args;
    const { data: order, error } = await db.from("restaurant_orders")
      .select("id,order_number,payment_status,order_status,fulfillment_type,customer_phone,customer_email,email_consent,sms_consent,subtotal,tax,tip,delivery_fee,total,requested_time,order_note")
      .eq("id", orderId).eq("business_id", businessId).single();
    if (error || !order) return { email: { queued: false, reason: "order_unavailable" }, sms: { queued: false, reason: "order_unavailable" } };
    if (event === "confirmed" && (order.payment_status !== "paid" || ["cancelled", "canceled", "refunded"].includes(order.order_status))) return result;
    const { data: business, error: businessError } = await db.from("businesses").select("name").eq("id", businessId).single();
    if (businessError || !clean(business?.name)) return { email: { queued: false, reason: "restaurant_unavailable" }, sms: { queued: false, reason: "restaurant_unavailable" } };
    const restaurant = clean(business.name).slice(0, 160);
    const number = clean(order.order_number);
    const label: Record<Event, string> = {
      confirmed: "Order Confirmation", new: "Order Received", preparing: "Your Order Is Being Prepared",
      ready: order.fulfillment_type === "delivery" ? "Your Order Is Ready for Delivery" : "Your Order Is Ready for Pickup",
      completed: "Order Completed", cancelled: "Order Cancelled",
    };
    const intro: Record<Event, string> = {
      confirmed: `Thank you for ordering from ${restaurant}! Your payment has been received and your order has been submitted.`,
      new: `${restaurant} has received your order.`, preparing: `${restaurant} is preparing your order.`,
      ready: `${restaurant}: Your order is ready${order.fulfillment_type === "delivery" ? " for delivery" : " for pickup"}.`,
      completed: `Your order from ${restaurant} has been marked completed. Thank you!`,
      cancelled: `Your order from ${restaurant} has been cancelled. Please contact the restaurant directly about any payment or refund questions.`,
    };
    const lines = [intro[event], "", `Order Number: #${number}`, `Order Type: ${order.fulfillment_type === "delivery" ? "Delivery" : "Pickup"}`];
    if (event === "confirmed") {
      const { data: items, error: itemsError } = await db.from("restaurant_order_items")
        .select("item_name,quantity,line_total,selections,instructions").eq("order_id", orderId).eq("business_id", businessId);
      if (itemsError || !items?.length) {
        result.email = { queued: false, reason: "items_unavailable" };
      } else {
        lines.push("", "Order Details:");
        for (const item of items) {
          lines.push(`${Number(item.quantity)} x ${clean(item.item_name)} - ${dollars(item.line_total)}`);
          const options = optionLabels(item.selections);
          if (options.length) lines.push(`  ${options.join(", ")}`);
          if (item.instructions) lines.push(`  Note: ${clean(item.instructions)}`);
        }
      }
      lines.push("", `Subtotal: ${dollars(order.subtotal)}`, `Tax: ${dollars(order.tax)}`, `Tip: ${dollars(order.tip)}`);
      if (Number(order.delivery_fee)) lines.push(`Delivery Fee: ${dollars(order.delivery_fee)}`);
      lines.push(`Total Paid: ${dollars(order.total)}`);
      if (order.requested_time) lines.push(`Requested Time: ${clean(order.requested_time)}`);
      if (order.order_note) lines.push(`Order Note: ${clean(order.order_note)}`);
      if (args.cancelUrl) lines.push("", "Cancel Order (within 3 minutes of payment):", args.cancelUrl);
      if (args.trackingUrl) lines.push("", "Delivery Tracking:", args.trackingUrl);
    }
    lines.push("", "This is an automated email. Please do not reply.", `For questions about your order, please contact ${restaurant} directly.`);
    const email = clean(order.customer_email);
    if (order.email_consent === true && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) && result.email.reason !== "items_unavailable") {
      const apiKey = process.env.RESEND_API_KEY?.trim();
      if (!apiKey) result.email = { queued: false, reason: "email_not_configured" };
      else result.email = await deliver(args, "email", async () => {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `order-${businessId}-${orderId}-${event}-email` },
          body: JSON.stringify({ from: `${JSON.stringify(restaurant)} <noreply@ktowntriangle.com>`, to: [email], subject: `${restaurant} — Order #${number}: ${label[event]}`, text: lines.join("\n") }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new TwilioSmsError("Email provider rejected the request.", !(response.status >= 400 && response.status < 500 && response.status !== 408));
        if (!payload || typeof payload.id !== "string" || !payload.id) throw new Error("Email acceptance unknown.");
        return payload.id;
      });
    }
    if (order.sms_consent === true) {
      try {
        const { data: settings, error: settingsError } = await db.from("restaurant_order_settings").select("sms_enabled").eq("business_id", businessId).maybeSingle();
        if (settingsError || settings?.sms_enabled !== true) result.sms = { queued: false, reason: "sms_disabled" };
        else if (event === "confirmed") {
          result.sms = await sendOrderConfirmationSms({ db, businessId, orderId, restaurantName: restaurant, cancelUrl: args.cancelUrl, trackingUrl: args.trackingUrl });
        } else {
          const config = await getRestaurantSmsConfig(db, businessId);
          const phone = normalizeSmsPhone(order.customer_phone);
          if (!config || !phone) result.sms = { queued: false, reason: "sms_unavailable" };
          else result.sms = await deliver(args, "sms", async () => {
            const sent = await sendTwilioSms(config, phone, `${restaurant}\nOrder #${number}\n${intro[event]}\nReply STOP to opt out or HELP for help.`);
            if (!sent.sid) throw new Error("SMS acceptance unknown.");
            return sent.sid;
          });
        }
      } catch { result.sms = { queued: false, reason: "sms_failed" }; }
    }
  } catch {
    console.error("ORDER_NOTIFICATION_PROCESS_FAILED", { businessId: args.businessId, orderId: args.orderId, event: args.event });
    if (!result.email.queued) result.email = { queued: false, reason: "notification_processing_failed" };
    if (!result.sms.queued) result.sms = { queued: false, reason: "notification_processing_failed" };
  }
  return result;
}
