import crypto from "node:crypto";

const DOORDASH_BASE_URL = "https://openapi.doordash.com";

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createDoorDashJwt() {
  const developerId = String(process.env.DOORDASH_DEVELOPER_ID || "").trim();
  const keyId = String(process.env.DOORDASH_KEY_ID || "").trim();
  const signingSecret = String(process.env.DOORDASH_SIGNING_SECRET || "").trim();

  if (!developerId || !keyId || !signingSecret) {
    throw new Error(
      "DoorDash 환경변수(DOORDASH_DEVELOPER_ID / DOORDASH_KEY_ID / DOORDASH_SIGNING_SECRET)가 없습니다.",
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "HS256",
    typ: "JWT",
    "dd-ver": "DD-JWT-V1",
  };

  const payload = {
    aud: "doordash",
    iss: developerId,
    kid: keyId,
    iat: now,
    exp: now + 300,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload),
  )}`;

  const secret = Buffer.from(signingSecret, "base64");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(unsigned)
    .digest();

  return `${unsigned}.${base64url(signature)}`;
}

function fullDropoffAddress(address: any) {
  const parts = [
    String(address?.address1 || "").trim(),
    String(address?.address2 || "").trim(),
    String(address?.city || "").trim(),
    String(address?.state || "").trim(),
    String(address?.postalCode || "").trim(),
  ].filter(Boolean);

  return parts.join(", ");
}

function errorDetail(payload: any, fallback: string) {
  if (!payload) return fallback;

  if (typeof payload === "string") return payload;

  return (
    payload?.message ||
    payload?.error ||
    payload?.detail ||
    payload?.code ||
    JSON.stringify(payload)
  );
}

export async function createDoorDashQuote(args: {
  privateSettings: any;
  dropoffAddress: any;
  orderSubtotal: number;
}) {
  const externalBusinessId = String(
    args.privateSettings?.doordash_external_business_id || "",
  ).trim();

  const externalStoreId = String(
    args.privateSettings?.doordash_external_store_id || "",
  ).trim();

  if (
    args.privateSettings?.doordash_enabled !== true ||
    !externalBusinessId ||
    !externalStoreId
  ) {
    throw new Error("DoorDash가 이 식당에 연결되어 있지 않습니다.");
  }

  const externalDeliveryId =
    `ktown-quote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const body = {
    external_delivery_id: externalDeliveryId,
    locale: "en-US",
    order_fulfillment_method: "standard",
    pickup_external_business_id: externalBusinessId,
    pickup_external_store_id: externalStoreId,
    dropoff_address: fullDropoffAddress(args.dropoffAddress),
    order_value: Math.max(
      0,
      Math.round(Number(args.orderSubtotal || 0) * 100),
    ),
  };

  const response = await fetch(`${DOORDASH_BASE_URL}/drive/v2/quotes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${createDoorDashJwt()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      errorDetail(
        payload,
        `DoorDash quote failed (HTTP ${response.status}).`,
      ),
    );
  }

  const feeCents = Math.max(0, Math.round(Number(payload?.fee || 0)));

  return {
    id: String(payload?.external_delivery_id || externalDeliveryId),
    feeCents,
    currency: String(payload?.currency || "USD"),
    pickupTimeEstimated: payload?.pickup_time_estimated || null,
    dropoffTimeEstimated: payload?.dropoff_time_estimated || null,
    dropoffTimeEstimatedLowerBound:
      payload?.dropoff_time_estimated_lower_bound || null,
    dropoffTimeEstimatedUpperBound:
      payload?.dropoff_time_estimated_upper_bound || null,
    deliveryStatus: payload?.delivery_status || "quote",
    raw: payload,
  };
}
