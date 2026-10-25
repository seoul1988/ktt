import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRestaurantSmsConfig, normalizeSmsPhone } from "@/lib/restaurant-order/sms-config";
import { sendTwilioSms, TwilioSmsError } from "@/lib/restaurant-order/twilio";

type Order = {
  id: number; business_id: number; order_number: string; payment_status: string;
  order_status: string; fulfillment_type: string; customer_phone: string;
  sms_consent: boolean; sms_sent_at: string | null; sms_message_sid: string | null;
  subtotal: number; tax: number; tip: number; delivery_fee: number; total: number;
  requested_time: string | null; order_note: string | null;
};
type Item = { item_name: string; quantity: number; line_total: number; selections: unknown; instructions: string | null };
const dollars = (value: unknown) => `$${Number(value || 0).toFixed(2)}`;
const lineText = (value: unknown) => String(value || "").replace(/[\r\n\t]+/g, " ").trim();

function optionLabels(raw: unknown): string[] {
  let value: any = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return value.trim() ? [lineText(value)] : []; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const result: string[] = [];
  for (const group of Object.values(value)) {
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;
    for (const [key, count] of Object.entries(group)) {
      const qty = Math.max(0, Math.floor(Number(count) || 0));
      if (!qty) continue;
      const colon = key.indexOf(":");
      const label = lineText(colon >= 0 ? key.slice(colon + 1) : key).replace(/^["']+|["']+$/g, "");
      if (label) result.push(qty > 1 ? `${label} x${qty}` : label);
    }
  }
  return result;
}

// Split without dropping text or cutting surrogate pairs. Each payload leaves
// ample room for its part number and stays under Twilio's 1600-character cap.
export function confirmationMessages(order: Order, items: Item[], restaurantName: string, links: { cancelUrl?: string; trackingUrl?: string } = {}) {
  const header = `${lineText(restaurantName) || "Restaurant"}\nOrder #${lineText(order.order_number)}\nPayment received. Order submitted.\n${order.fulfillment_type === "delivery" ? "Delivery" : "Pickup"}`;
  const lines = [header, "", "Order details:"];
  for (const item of items) {
    lines.push(`${Number(item.quantity)} x ${lineText(item.item_name)} - ${dollars(item.line_total)}`);
    const options = optionLabels(item.selections);
    if (options.length) lines.push(`  ${options.join(", ")}`);
    if (item.instructions) lines.push(`  Note: ${lineText(item.instructions)}`);
  }
  lines.push("", `Subtotal: ${dollars(order.subtotal)}`, `Tax: ${dollars(order.tax)}`, `Tip: ${dollars(order.tip)}`);
  if (Number(order.delivery_fee)) lines.push(`Delivery fee: ${dollars(order.delivery_fee)}`);
  // Total is the server's captured total, including any promotion adjustment.
  lines.push(`Total paid: ${dollars(order.total)}`);
  if (order.requested_time) lines.push(`Requested time: ${lineText(order.requested_time)}`);
  if (order.order_note) lines.push(`Order note: ${lineText(order.order_note)}`);
  if (links.cancelUrl) lines.push("", "Cancel link (within 3 minutes of payment):", links.cancelUrl);
  if (links.trackingUrl) lines.push("", "Delivery tracking:", links.trackingUrl);
  lines.push("", "Reply STOP to opt out or HELP for help.");
  const text = lines.join("\n");
  const parts: string[] = [];
  let buffer = "";
  for (const char of text) {
    if (buffer.length + char.length > 1400) { parts.push(buffer); buffer = ""; }
    buffer += char;
  }
  if (buffer) parts.push(buffer);
  return parts.length > 1 ? parts.map((part, i) => `Order #${lineText(order.order_number).slice(0, 80)} (${i + 1}/${parts.length})\n${part}`) : parts;
}

export async function sendOrderConfirmationSms({ db, businessId, orderId, restaurantName, cancelUrl, trackingUrl }: {
  db: SupabaseClient; businessId: number; orderId: number; restaurantName: string;
  cancelUrl?: string; trackingUrl?: string;
}) {
  let claim = "";
  let attempted = false;
  const acceptedSids: string[] = [];
  try {
    const { data: row, error: orderError } = await db.from("restaurant_orders")
      .select("id,business_id,order_number,payment_status,order_status,fulfillment_type,customer_phone,sms_consent,sms_sent_at,sms_message_sid,subtotal,tax,tip,delivery_fee,total,requested_time,order_note")
      .eq("id", orderId).eq("business_id", businessId).single();
    if (orderError || !row) return { queued: false, reason: "order_unavailable" };
    const order = row as Order;
    if (order.payment_status !== "paid" || order.sms_consent !== true || ["cancelled", "canceled", "refunded"].includes(order.order_status)) return { queued: false, reason: "not_eligible" };
    if (order.sms_sent_at || order.sms_message_sid) return { queued: false, reason: "already_sent_or_claimed" };
    const destination = normalizeSmsPhone(order.customer_phone);
    if (!destination) return { queued: false, reason: "invalid_phone" };
    const config = await getRestaurantSmsConfig(db, businessId);
    if (!config) return { queued: false, reason: "sms_not_configured" };
    const { data: items, error: itemsError } = await db.from("restaurant_order_items")
      .select("item_name,quantity,line_total,selections,instructions").eq("order_id", orderId).eq("business_id", businessId);
    if (itemsError || !items?.length) return { queued: false, reason: "items_unavailable" };
    const messages = confirmationMessages(order, items as Item[], restaurantName, { cancelUrl, trackingUrl });
    // Use the existing text column as an atomic reservation. No schema change.
    // Never automatically expire this claim: timeout may mean Twilio accepted
    // the message. Reconcile pending claims with Twilio logs before retrying.
    claim = `pending:${randomUUID()}`;
    const { data: claimed, error: claimError } = await db.from("restaurant_orders")
      .update({ sms_message_sid: claim }).eq("id", orderId).eq("business_id", businessId)
      .eq("payment_status", "paid").eq("sms_consent", true)
      .is("sms_sent_at", null).is("sms_message_sid", null).select("id").maybeSingle();
    if (claimError || !claimed) return { queued: false, reason: "already_claimed_or_unavailable" };
    for (const message of messages) {
      attempted = true;
      const sent = await sendTwilioSms(config, destination, message);
      acceptedSids.push(sent.sid);
    }
    const { error: saveError } = await db.from("restaurant_orders")
      .update({ sms_sent_at: new Date().toISOString(), sms_message_sid: acceptedSids[0] })
      .eq("id", orderId).eq("business_id", businessId).eq("sms_message_sid", claim);
    if (saveError) console.error("ORDER_SMS_RECORD_REQUIRES_RECONCILIATION", { orderId, acceptedSids });
    return { queued: true, messageCount: acceptedSids.length, reconciliationRequired: Boolean(saveError) };
  } catch (error) {
    // Only release a definitely rejected attempt if no part was accepted.
    // A network timeout or partial send retains the claim to prevent duplicates.
    const definiteRejection = error instanceof TwilioSmsError && !error.acceptanceUnknown;
    if (claim && acceptedSids.length === 0 && (!attempted || definiteRejection)) {
      try {
        await db.from("restaurant_orders").update({ sms_message_sid: null })
          .eq("id", orderId).eq("business_id", businessId).eq("sms_message_sid", claim).is("sms_sent_at", null);
      } catch { /* Payment success is independent of SMS bookkeeping. */ }
    }
    console.error("ORDER_CONFIRMATION_SMS_FAILED", { orderId, acceptedCount: acceptedSids.length, reconciliationRequired: attempted && !definiteRejection });
    return { queued: false, reason: "sms_failed", reconciliationRequired: attempted && (!definiteRejection || acceptedSids.length > 0) };
  }
}
