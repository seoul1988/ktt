import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";
import { createUberDirectQuote } from "@/lib/delivery/uber-direct";
import { createDoorDashQuote } from "@/lib/delivery/doordash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeliveryFeePolicyMode =
  | "customer_100"
  | "order_amount"
  | "restaurant_100"
  | "menu_price";

type DeliveryFeeShareRule = {
  maxSubtotal: number | null;
  customerPercent: number;
};

type PrivateSettingsRow = {
  delivery_provider?: string | null;
  uber_direct_enabled?: boolean | null;
  uber_direct_client_id?: string | null;
  uber_direct_client_secret?: string | null;
  uber_direct_customer_id?: string | null;
  doordash_enabled?: boolean | null;
  doordash_external_business_id?: string | null;
  doordash_external_store_id?: string | null;
  doordash_status?: string | null;
  delivery_fee_markup_cents?: number | null;
};

type OrderSettingsRow = {
  delivery_fee_policy_mode?: string | null;
  delivery_fee_share_rules?: unknown;
};

const DEFAULT_DELIVERY_FEE_SHARE_RULES: DeliveryFeeShareRule[] = [
  { maxSubtotal: 19.99, customerPercent: 100 },
  { maxSubtotal: 29.99, customerPercent: 70 },
  { maxSubtotal: 39.99, customerPercent: 50 },
  { maxSubtotal: 49.99, customerPercent: 30 },
  { maxSubtotal: null, customerPercent: 0 },
];

function normalizeDeliveryFeePolicyMode(
  value: unknown,
): DeliveryFeePolicyMode {
  return value === "customer_100" ||
    value === "restaurant_100" ||
    value === "menu_price"
    ? value
    : "order_amount";
}

function normalizeDeliveryFeeShareRules(
  value: unknown,
): DeliveryFeeShareRule[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_DELIVERY_FEE_SHARE_RULES;
  }

  return value.map((row: any, index: number) => ({
    maxSubtotal:
      index === value.length - 1
        ? null
        : Math.max(0, Number(row?.maxSubtotal) || 0),
    customerPercent: Math.max(
      0,
      Math.min(100, Number(row?.customerPercent) || 0),
    ),
  }));
}

function customerSharePercent(
  subtotal: number,
  rules: DeliveryFeeShareRule[],
) {
  for (const rule of rules) {
    if (
      rule.maxSubtotal == null ||
      subtotal <= Number(rule.maxSubtotal)
    ) {
      return Math.max(
        0,
        Math.min(100, Number(rule.customerPercent) || 0),
      );
    }
  }

  return 100;
}

function normalizeBusinessPickupAddress(business: any) {
  if (!business || typeof business !== "object") {
    return business;
  }

  const currentStreet = String(
    business?.address1 ||
      business?.street_address ||
      "",
  ).trim();
  const currentCity = String(business?.city || "").trim();
  const currentState = String(business?.state || "").trim();
  const currentZip = String(
    business?.zip ||
      business?.zipcode ||
      business?.postal_code ||
      "",
  ).trim();

  // If the DB already has separate address fields, keep them exactly as-is.
  if (currentStreet && currentCity && currentState && currentZip) {
    return business;
  }

  const fullAddress = String(business?.address || "")
    .replace(/\s+(?:미국|USA|US|United States)\s*$/i, "")
    .trim();

  if (!fullAddress) {
    return business;
  }

  // Example supported by the current businesses table:
  // "107 N Columbia St, Chapel Hill, NC 27514 미국"
  const match = fullAddress.match(
    /^(.*),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/,
  );

  if (!match) {
    return business;
  }

  const [, street, city, state, zip] = match;

  return {
    ...business,
    address1: currentStreet || street.trim(),
    city: currentCity || city.trim(),
    state: currentState || state.trim().toUpperCase(),
    zip: currentZip || zip.trim(),
  };
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
    const orderSubtotal = Math.max(
      0,
      Number(body?.orderSubtotal) || 0,
    );

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

    const db = getOrderAdmin();

    const [
      { data: business, error: businessError },
      { data: privateSettingsRaw, error: privateError },
      { data: orderSettingsRaw, error: orderSettingsError },
    ] = await Promise.all([
      db
        .from("businesses")
        .select("*")
        .eq("id", businessId)
        .single(),

      db
        .from("restaurant_order_private_settings")
        .select(
          "delivery_provider,uber_direct_enabled,uber_direct_client_id,uber_direct_client_secret,uber_direct_customer_id,doordash_enabled,doordash_external_business_id,doordash_external_store_id,doordash_status,delivery_fee_markup_cents",
        )
        .eq("business_id", businessId)
        .maybeSingle(),

      db
        .from("restaurant_order_settings")
        .select(
          "delivery_fee_policy_mode,delivery_fee_share_rules",
        )
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    if (businessError) throw businessError;
    if (privateError) throw privateError;
    if (orderSettingsError) throw orderSettingsError;

    const privateSettings =
      (privateSettingsRaw ?? null) as PrivateSettingsRow | null;

    const orderSettings =
      (orderSettingsRaw ?? null) as OrderSettingsRow | null;

    const useDoorDash =
      privateSettings?.doordash_enabled === true &&
      Boolean(privateSettings?.doordash_external_business_id) &&
      Boolean(privateSettings?.doordash_external_store_id);

    const policyMode = normalizeDeliveryFeePolicyMode(
      orderSettings?.delivery_fee_policy_mode,
    );

    const feeShareRules = normalizeDeliveryFeeShareRules(
      orderSettings?.delivery_fee_share_rules,
    );

    let provider = "";
    let quoteId = "";
    let providerFeeCents = 0;
    let markupCents = Math.max(
      0,
      Math.round(Number(privateSettings?.delivery_fee_markup_cents || 0)),
    );
    let expiresAt: string | null = null;
    let pickupTimeEstimated: string | null = null;
    let dropoffTimeEstimated: string | null = null;
    let dropoffTimeEstimatedLowerBound: string | null = null;
    let dropoffTimeEstimatedUpperBound: string | null = null;

    if (useDoorDash) {
      const quote = await createDoorDashQuote({
        privateSettings,
        dropoffAddress,
        orderSubtotal,
      });

      provider = "doordash";
      quoteId = quote.id;
      providerFeeCents = Math.max(
        0,
        Math.round(Number(quote.feeCents || 0) + markupCents),
      );

      pickupTimeEstimated = quote.pickupTimeEstimated;
      dropoffTimeEstimated = quote.dropoffTimeEstimated;
      dropoffTimeEstimatedLowerBound =
        quote.dropoffTimeEstimatedLowerBound;
      dropoffTimeEstimatedUpperBound =
        quote.dropoffTimeEstimatedUpperBound;
    } else {
      const uberBusiness = normalizeBusinessPickupAddress(business);

      const quote = await createUberDirectQuote({
        business: uberBusiness,
        privateSettings,
        dropoffAddress,
      });

      provider = "uber_direct";
      quoteId = quote.id;
      providerFeeCents = Math.max(
        0,
        Math.round(Number(quote.customerFeeCents || 0)),
      );
      markupCents = Math.max(
        0,
        Math.round(Number(quote.markupCents || 0)),
      );
      expiresAt = quote.expires || null;
      dropoffTimeEstimated = quote.dropoff_eta || null;
    }

    const customerPercent =
      policyMode === "customer_100"
        ? 100
        : policyMode === "restaurant_100" ||
            policyMode === "menu_price"
          ? 0
          : customerSharePercent(orderSubtotal, feeShareRules);

    const customerFeeCents = Math.max(
      0,
      Math.round(
        providerFeeCents * (customerPercent / 100),
      ),
    );

    const restaurantFeeCents = Math.max(
      0,
      providerFeeCents - customerFeeCents,
    );

    return NextResponse.json({
      ok: true,
      provider,
      quoteId,
      feeCents: customerFeeCents,
      customerFeeCents,
      providerFeeCents,
      restaurantFeeCents,
      markupCents,
      expiresAt,
      pickupTimeEstimated,
      dropoffTimeEstimated,
      dropoffTimeEstimatedLowerBound,
      dropoffTimeEstimatedUpperBound,
      currency: "USD",
      deliveryFeePolicyMode: policyMode,
      customerSharePercent: customerPercent,
      restaurantSharePercent: Math.max(
        0,
        100 - customerPercent,
      ),
      orderSubtotal,
      feeShareRules,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : JSON.stringify(error),
      },
      { status: 400 },
    );
  }
}
