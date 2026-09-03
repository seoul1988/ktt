import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WEBHOOK_URL =
  "https://www.ktowntriangle.com/api/square/webhook";

function verifySquareSignature(
  rawBody: string,
  signatureHeader: string,
  signatureKey: string,
  notificationUrl: string,
) {
  const expected = createHmac("sha256", signatureKey)
    .update(notificationUrl + rawBody, "utf8")
    .digest("base64");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signatureHeader || "", "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "square-webhook",
  });
}

export async function POST(request: Request) {
  const signatureKey =
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "";

  const notificationUrl =
    process.env.SQUARE_WEBHOOK_URL ||
    DEFAULT_WEBHOOK_URL;

  if (!signatureKey) {
    console.error(
      "SQUARE WEBHOOK ERROR: SQUARE_WEBHOOK_SIGNATURE_KEY is missing.",
    );
    return NextResponse.json(
      { error: "Square webhook signature key is not configured." },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const signature =
    request.headers.get("x-square-hmacsha256-signature") || "";

  const valid = verifySquareSignature(
    rawBody,
    signature,
    signatureKey,
    notificationUrl,
  );

  if (!valid) {
    console.error("SQUARE WEBHOOK ERROR: invalid signature");
    return NextResponse.json(
      { error: "Invalid Square webhook signature." },
      { status: 403 },
    );
  }

  let event: any;

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON." },
      { status: 400 },
    );
  }

  if (
    event?.type !== "payment.created" &&
    event?.type !== "payment.updated"
  ) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const payment = event?.data?.object?.payment;

  if (!payment?.id || !payment?.order_id) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "Payment does not contain an order_id.",
    });
  }

  if (payment.status !== "COMPLETED") {
    return NextResponse.json({
      ok: true,
      ignored: true,
      paymentStatus: payment.status || "UNKNOWN",
    });
  }

  const db = getOrderAdmin();

  const { data: matchedOrder, error: findError } = await db
    .from("restaurant_orders")
    .select("id,business_id,order_number,payment_status")
    .eq("square_order_id", String(payment.order_id))
    .maybeSingle();

  if (findError) {
    console.error("SQUARE WEBHOOK LOOKUP ERROR", findError);
    return NextResponse.json(
      { error: findError.message },
      { status: 500 },
    );
  }

  if (!matchedOrder) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "No matching KTown order.",
    });
  }

  if (matchedOrder.payment_status === "paid") {
    return NextResponse.json({
      ok: true,
      alreadyPaid: true,
      orderId: matchedOrder.id,
    });
  }

  const { error: updateError } = await db
    .from("restaurant_orders")
    .update({
      payment_status: "paid",
      square_payment_id: String(payment.id),
    })
    .eq("id", matchedOrder.id);

  if (updateError) {
    console.error("SQUARE WEBHOOK UPDATE ERROR", updateError);
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 },
    );
  }

  console.log(
    "SQUARE PAYMENT COMPLETED",
    matchedOrder.id,
    matchedOrder.order_number,
    payment.id,
  );

  return NextResponse.json({
    ok: true,
    paid: true,
    orderId: matchedOrder.id,
    orderNumber: matchedOrder.order_number,
  });
}
