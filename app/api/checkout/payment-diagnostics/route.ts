import { NextRequest, NextResponse } from "next/server";

// Only fixed, non-sensitive diagnostic fields are accepted.
const stages = new Set(["sdk_init", "card_init", "tokenize", "payment_request", "payment_unknown"]);
const methods = new Set(["card", "apple", "google", "unknown"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const stage = String(body?.stage || "");
    const method = String(body?.method || "");
    const businessId = Number(body?.businessId);
    const orderId = Number(body?.orderId);
    const code = String(body?.code || "UNKNOWN");
    if (!stages.has(stage) || !methods.has(method) ||
        !Number.isSafeInteger(businessId) || businessId <= 0 ||
        !Number.isSafeInteger(orderId) || orderId <= 0 ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(code)) {
      return NextResponse.json({ error: "Invalid diagnostic event" }, { status: 400 });
    }
    console.error("CHECKOUT_CLIENT_PAYMENT_ERROR", { stage, method, businessId, orderId, code });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid diagnostic event" }, { status: 400 });
  }
}
