import "server-only";

type SupabaseAdmin = any;

type DirectAddress = {
  street_address: string[];
  city: string;
  state: string;
  zip_code: string;
  country: string;
};

type UberQuote = {
  id: string;
  fee: number;
  currency?: string;
  currency_type?: string;
  expires?: string;
  duration?: number;
  pickup_duration?: number;
  dropoff_eta?: string;
  dropoff_deadline?: string;
};

let cachedToken:
  | {
      value: string;
      expiresAt: number;
    }
  | null = null;

function env(name: string) {
  return String(process.env[name] || "").trim();
}

function normalizePhone(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) {
    const digits = raw.replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function businessAddress(business: any): DirectAddress {
  const street1 = stringValue(
    business?.address1,
    business?.street_address,
    business?.address,
  );
  const street2 = stringValue(business?.address2);
  const city = stringValue(business?.city);
  const state = stringValue(business?.state);
  const zip = stringValue(
    business?.zip,
    business?.zipcode,
    business?.postal_code,
  );

  if (!street1 || !city || !state || !zip) {
    throw new Error(
      "Restaurant pickup address is incomplete. Please complete the business address first.",
    );
  }

  return {
    street_address: [street1, street2].filter(Boolean),
    city,
    state,
    zip_code: zip,
    country: "US",
  };
}

function deliveryAddress(address: any): DirectAddress {
  const street1 = stringValue(address?.address1);
  const street2 = stringValue(address?.address2);
  const city = stringValue(address?.city);
  const state = stringValue(address?.state);
  const zip = stringValue(address?.postalCode);

  if (!street1 || !city || !state || !zip) {
    throw new Error("A complete delivery address is required.");
  }

  return {
    street_address: [street1, street2].filter(Boolean),
    city,
    state,
    zip_code: zip,
    country: "US",
  };
}

function directAddressJson(address: DirectAddress) {
  return JSON.stringify(address);
}

async function getAccessToken() {
  const now = Date.now();

  if (
    cachedToken &&
    cachedToken.value &&
    cachedToken.expiresAt > now + 60_000
  ) {
    return cachedToken.value;
  }

  const clientId = env("UBER_DIRECT_CLIENT_ID");
  const clientSecret = env("UBER_DIRECT_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      "Uber Direct credentials are not configured.",
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "eats.deliveries",
  });

  const response = await fetch(
    "https://auth.uber.com/oauth/v2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.access_token) {
    throw new Error(
      payload?.error_description ||
        payload?.error ||
        `Uber Direct authentication failed (HTTP ${response.status}).`,
    );
  }

  cachedToken = {
    value: String(payload.access_token),
    expiresAt:
      now +
      Math.max(
        300,
        Number(payload.expires_in || 3600) - 120,
      ) *
        1000,
  };

  return cachedToken.value;
}

function getCustomerId(privateSettings: any) {
  const customerId = stringValue(
    privateSettings?.uber_direct_customer_id,
    env("UBER_DIRECT_CUSTOMER_ID"),
  );

  if (!customerId) {
    throw new Error(
      "Uber Direct Customer ID is not configured.",
    );
  }

  return customerId;
}

function errorDetail(payload: any, fallback: string) {
  return (
    payload?.message ||
    payload?.error?.message ||
    payload?.error ||
    payload?.code ||
    fallback
  );
}

export function isUberDirectEnabled(privateSettings: any) {
  return (
    privateSettings?.delivery_provider === "uber_direct" &&
    privateSettings?.uber_direct_enabled === true
  );
}

export async function createUberDirectQuote(args: {
  business: any;
  privateSettings: any;
  dropoffAddress: any;
}) {
  if (!isUberDirectEnabled(args.privateSettings)) {
    throw new Error(
      "Uber Direct delivery is not enabled for this restaurant.",
    );
  }

  const token = await getAccessToken();
  const customerId = getCustomerId(args.privateSettings);

  const pickup = businessAddress(args.business);
  const dropoff = deliveryAddress(args.dropoffAddress);

  const response = await fetch(
    `https://api.uber.com/v1/customers/${encodeURIComponent(
      customerId,
    )}/delivery_quotes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pickup_address: directAddressJson(pickup),
        dropoff_address: directAddressJson(dropoff),
      }),
      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      errorDetail(
        payload,
        `Uber Direct quote failed (HTTP ${response.status}).`,
      ),
    );
  }

  const quote: UberQuote = {
    id: String(payload?.id || ""),
    fee: Number(payload?.fee || 0),
    currency: String(
      payload?.currency_type || payload?.currency || "USD",
    ),
    currency_type: String(payload?.currency_type || "USD"),
    expires: payload?.expires
      ? String(payload.expires)
      : undefined,
    duration: Number(payload?.duration || 0),
    pickup_duration: Number(payload?.pickup_duration || 0),
    dropoff_eta: payload?.dropoff_eta
      ? String(payload.dropoff_eta)
      : undefined,
    dropoff_deadline: payload?.dropoff_deadline
      ? String(payload.dropoff_deadline)
      : undefined,
  };

  if (!quote.id || !Number.isFinite(quote.fee) || quote.fee < 0) {
    throw new Error("Uber Direct returned an invalid quote.");
  }

  const markupCents = Math.max(
    0,
    Math.round(
      Number(
        args.privateSettings?.delivery_fee_markup_cents || 0,
      ),
    ),
  );

  return {
    ...quote,
    uberFeeCents: Math.round(quote.fee),
    markupCents,
    customerFeeCents: Math.round(quote.fee) + markupCents,
  };
}

export async function dispatchUberDirectOrder(args: {
  db: SupabaseAdmin;
  businessId: number;
  orderId: number;
}) {
  const { db, businessId, orderId } = args;

  const [
    { data: order, error: orderError },
    { data: business, error: businessError },
    { data: privateSettings, error: privateError },
    { data: items, error: itemsError },
  ] = await Promise.all([
    db
      .from("restaurant_orders")
      .select(
        "id,business_id,order_number,fulfillment_type,customer_name,customer_phone,delivery_address,payment_status,delivery_provider,delivery_quote_id,delivery_quote_expires_at,delivery_external_id,delivery_status,delivery_tracking_url,subtotal,tax,tip,total",
      )
      .eq("id", orderId)
      .eq("business_id", businessId)
      .single(),

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
      .from("restaurant_order_items")
      .select(
        "item_name,quantity,unit_price,instructions,selections",
      )
      .eq("order_id", orderId)
      .eq("business_id", businessId),
  ]);

  if (orderError) throw orderError;
  if (businessError) throw businessError;
  if (privateError) throw privateError;
  if (itemsError) throw itemsError;

  if (!order) throw new Error("Order not found.");

  if (order.fulfillment_type !== "delivery") {
    return { skipped: true, reason: "not_delivery" };
  }

  if (order.payment_status !== "paid") {
    return { skipped: true, reason: "not_paid" };
  }

  if (!isUberDirectEnabled(privateSettings)) {
    return { skipped: true, reason: "uber_direct_disabled" };
  }

  if (order.delivery_external_id) {
    return {
      ok: true,
      alreadyDispatched: true,
      deliveryId: order.delivery_external_id,
      trackingUrl: order.delivery_tracking_url || null,
    };
  }

  let quoteId = String(order.delivery_quote_id || "");
  const expiryMs = order.delivery_quote_expires_at
    ? new Date(order.delivery_quote_expires_at).getTime()
    : 0;

  if (!quoteId || !expiryMs || expiryMs <= Date.now() + 15_000) {
    const freshQuote = await createUberDirectQuote({
      business,
      privateSettings,
      dropoffAddress: order.delivery_address,
    });

    quoteId = freshQuote.id;

    await db
      .from("restaurant_orders")
      .update({
        delivery_quote_id: freshQuote.id,
        delivery_quote_expires_at:
          freshQuote.expires || null,
      })
      .eq("id", orderId)
      .eq("business_id", businessId);
  }

  const token = await getAccessToken();
  const customerId = getCustomerId(privateSettings);
  const pickup = businessAddress(business);
  const dropoff = deliveryAddress(order.delivery_address);

  const pickupPhone = normalizePhone(
    privateSettings?.pickup_phone_override ||
      business?.phone ||
      business?.phone_number ||
      business?.telephone,
  );

  if (!pickupPhone) {
    throw new Error(
      "Restaurant pickup phone number is missing.",
    );
  }

  const dropoffPhone = normalizePhone(order.customer_phone);
  if (!dropoffPhone) {
    throw new Error("Customer phone number is invalid.");
  }

  const manifestItems = (items || []).map((item: any) => ({
    name: String(item.item_name || "Food").slice(0, 100),
    quantity: Math.max(1, Number(item.quantity || 1)),
    size: "small",
    price: Math.max(
      0,
      Math.round(Number(item.unit_price || 0) * 100),
    ),
  }));

  const response = await fetch(
    `https://api.uber.com/v1/customers/${encodeURIComponent(
      customerId,
    )}/deliveries`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quote_id: quoteId,
        pickup_name: String(
          business?.name || "KTown Restaurant",
        ).slice(0, 100),
        pickup_address: directAddressJson(pickup),
        pickup_phone_number: pickupPhone,
        pickup_notes: `KTown order #${order.order_number}`.slice(
          0,
          280,
        ),
        dropoff_name: String(order.customer_name || "Customer").slice(
          0,
          100,
        ),
        dropoff_address: directAddressJson(dropoff),
        dropoff_phone_number: dropoffPhone,
        dropoff_notes: String(
          order.delivery_address?.note || "",
        ).slice(0, 280),
        manifest_reference: `KTOWN-${order.order_number}`.slice(
          0,
          64,
        ),
        manifest_items:
          manifestItems.length > 0
            ? manifestItems
            : [
                {
                  name: "Restaurant order",
                  quantity: 1,
                  size: "small",
                },
              ],
      }),
      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = errorDetail(
      payload,
      `Uber Direct dispatch failed (HTTP ${response.status}).`,
    );

    await db
      .from("restaurant_orders")
      .update({
        delivery_status: "dispatch_failed",
        delivery_last_error: String(detail).slice(0, 1000),
      })
      .eq("id", orderId)
      .eq("business_id", businessId);

    throw new Error(detail);
  }

  const deliveryId = String(payload?.id || "");
  if (!deliveryId) {
    throw new Error("Uber Direct did not return a delivery ID.");
  }

  const trackingUrl = String(payload?.tracking_url || "");
  const status = String(payload?.status || "pending");

  const { error: saveError } = await db
    .from("restaurant_orders")
    .update({
      delivery_provider: "uber_direct",
      delivery_external_id: deliveryId,
      delivery_status: status,
      delivery_tracking_url: trackingUrl || null,
      delivery_dispatched_at: new Date().toISOString(),
      delivery_last_error: null,
    })
    .eq("id", orderId)
    .eq("business_id", businessId);

  if (saveError) throw saveError;

  return {
    ok: true,
    deliveryId,
    status,
    trackingUrl: trackingUrl || null,
    feeCents: Number(payload?.fee || 0),
  };
}
