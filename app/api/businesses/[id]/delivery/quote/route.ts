import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";
import { createUberDirectQuote } from "@/lib/delivery/uber-direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeliveryFeeShareRule = {
  maxSubtotal: number | null;
  customerPercent: number;
};

type DeliveryFeePolicyMode =
  | "customer_100"
  | "order_amount"
  | "restaurant_100";

function normalizeDeliveryFeePolicyMode(value: unknown): DeliveryFeePolicyMode {
  return value === "customer_100" || value === "restaurant_100"
    ? value
    : "order_amount";
}

const DEFAULT_DELIVERY_FEE_SHARE_RULES: DeliveryFeeShareRule[] = [
  { maxSubtotal: 19.99, customerPercent: 100 },
  { maxSubtotal: 29.99, customerPercent: 70 },
  { maxSubtotal: 39.99, customerPercent: 50 },
  { maxSubtotal: 49.99, customerPercent: 30 },
  { maxSubtotal: null, customerPercent: 0 },
];

function normalizeDeliveryFeeShareRules(value: unknown): DeliveryFeeShareRule[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_DELIVERY_FEE_SHARE_RULES;
  }

  const normalized: DeliveryFeeShareRule[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index] as any;
    const isLast = index === value.length - 1;
    const customerPercent = Number(raw?.customerPercent);

    if (
      !Number.isFinite(customerPercent) ||
      customerPercent < 0 ||
      customerPercent > 100
    ) {
      return DEFAULT_DELIVERY_FEE_SHARE_RULES;
    }

    if (isLast) {
      normalized.push({
        maxSubtotal: null,
        customerPercent: Number(customerPercent.toFixed(2)),
      });
      continue;
    }

    const maxSubtotal = Number(raw?.maxSubtotal);

    if (!Number.isFinite(maxSubtotal) || maxSubtotal < 0) {
      return DEFAULT_DELIVERY_FEE_SHARE_RULES;
    }

    normalized.push({
      maxSubtotal: Number(maxSubtotal.toFixed(2)),
      customerPercent: Number(customerPercent.toFixed(2)),
    });
  }

  for (let index = 1; index < normalized.length - 1; index += 1) {
    const previous = normalized[index - 1].maxSubtotal;
    const current = normalized[index].maxSubtotal;

    if (previous == null || current == null || current <= previous) {
      return DEFAULT_DELIVERY_FEE_SHARE_RULES;
    }
  }

  return normalized;
}

function customerSharePercent(
  subtotal: number,
  rules: DeliveryFeeShareRule[],
) {
  for (const rule of rules) {
    if (rule.maxSubtotal == null || subtotal <= rule.maxSubtotal) {
      return Math.max(0, Math.min(100, Number(rule.customerPercent) || 0));
    }
  }

  return 100;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "Invalid business ID." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const dropoffAddress = body?.deliveryAddress || {};
    const orderSubtotal = Number(body?.orderSubtotal);

    if (
      !String(dropoffAddress?.address1 || "").trim() ||
      !String(dropoffAddress?.city || "").trim() ||
      !String(dropoffAddress?.state || "").trim() ||
      !String(dropoffAddress?.postalCode || "").trim()
    ) {
      return NextResponse.json(
        { error: "Please enter the complete delivery address." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(orderSubtotal) || orderSubtotal < 0) {
      return NextResponse.json(
        { error: "A valid order subtotal is required for the delivery quote." },
        { status: 400 },
      );
    }

    const db = getOrderAdmin();

    const [
      { data: business, error: businessError },
      { data: privateSettings, error: privateError },
      { data: orderSettings, error: orderSettingsError },
    ] = await Promise.all([
      db
        .from("businesses")
        .select("*")
        .eq("id", businessId)
        .single(),

      db
        .from("restaurant_order_private_settings")
        .select(
          "delivery_provider,uber_direct_enabled,uber_direct_customer_id,delivery_fee_markup_cents",
        )
        .eq("business_id", businessId)
        .maybeSingle(),

      db
        .from("restaurant_order_settings")
        .select("delivery_fee_policy_mode,delivery_fee_share_rules")
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    if (businessError) throw businessError;
    if (privateError) throw privateError;
    if (orderSettingsError) throw orderSettingsError;

    const quote = await createUberDirectQuote({
      business,
      privateSettings,
      dropoffAddress,
    });

    const feeShareRules = normalizeDeliveryFeeShareRules(
      orderSettings?.delivery_fee_share_rules,
    );
    const policyMode = normalizeDeliveryFeePolicyMode(
      orderSettings?.delivery_fee_policy_mode,
    );

    const sharePercent =
      policyMode === "customer_100"
        ? 100
        : policyMode === "restaurant_100"
          ? 0
          : customerSharePercent(orderSubtotal, feeShareRules);

    // quote.customerFeeCents is the full delivery quote amount used by KTown
    // before the restaurant subsidy is applied.
    const providerFeeCents = Math.max(
      0,
      Math.round(Number(quote.customerFeeCents || 0)),
    );
    const customerFeeCents = Math.max(
      0,
      Math.round(providerFeeCents * (sharePercent / 100)),
    );
    const restaurantFeeCents = Math.max(
      0,
      providerFeeCents - customerFeeCents,
    );

    return NextResponse.json({
      ok: true,
      provider: "uber_direct",
      quoteId: quote.id,

      // Keep feeCents for backwards compatibility with existing checkout code.
      feeCents: customerFeeCents,
      customerFeeCents,
      restaurantFeeCents,
      providerFeeCents,
      fullDeliveryFeeCents: providerFeeCents,

      deliveryFeePolicyMode: policyMode,
      customerSharePercent: sharePercent,
      restaurantSharePercent: Math.max(0, 100 - sharePercent),
      orderSubtotal: Number(orderSubtotal.toFixed(2)),
      feeShareRules,

      uberFeeCents: quote.uberFeeCents,
      markupCents: quote.markupCents,
      expiresAt: quote.expires || null,
      durationMinutes: quote.duration || null,
      pickupMinutes: quote.pickup_duration || null,
      dropoffEta: quote.dropoff_eta || null,
      currency: quote.currency_type || "USD",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Delivery quote could not be created.",
      },
      { status: 400 },
    );
  }
}
