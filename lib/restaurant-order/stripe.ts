import "server-only";

export async function createStripeCheckoutSession(args: {
  secretKey: string; orderId: number; orderNumber: string; businessId: number;
  businessName: string; amountCents: number; customerName: string; customerPhone: string;
  origin: string;
}) {
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${args.origin}?order=${encodeURIComponent(args.orderNumber)}&payment=success`);
  form.set("cancel_url", `${args.origin}?order=${encodeURIComponent(args.orderNumber)}&payment=cancelled`);
  form.set("client_reference_id", String(args.orderId));
  form.set("metadata[order_id]", String(args.orderId));
  form.set("metadata[business_id]", String(args.businessId));
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(args.amountCents));
  form.set("line_items[0][price_data][product_data][name]", `${args.businessName} Order ${args.orderNumber}`);
  form.set("phone_number_collection[enabled]", "false");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${args.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.url) throw new Error(payload?.error?.message || "Stripe Checkout session failed");
  return { id: String(payload.id), url: String(payload.url) };
}
