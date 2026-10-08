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

function getSquarePaymentMethod(payment: any) {
  const walletType = String(
    payment?.card_details?.card?.digital_wallet_type || "",
  )
    .trim()
    .toUpperCase();

  if (walletType === "APPLE_PAY") return "apple_pay";
  if (walletType === "GOOGLE_PAY") return "google_pay";

  const sourceType = String(payment?.source_type || "")
    .trim()
    .toUpperCase();

  if (sourceType === "CARD" || payment?.card_details) {
    return "card";
  }

  return null;
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

  const squareStatus = String(payment.status || "").toUpperCase();
  const squarePaymentMethod = getSquarePaymentMethod(payment);

  const db = getOrderAdmin();

  const { data: matchedOrder, error: findError } = await db
    .from("restaurant_orders")
    .select("id,business_id,order_number,payment_status,square_payment_id")
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

  if (squareStatus === "COMPLETED") {
    const completedUpdate: Record<string, string> = {
      payment_status: "paid",
      square_payment_id: String(payment.id),
      paid_at:
        payment.updated_at ||
        payment.created_at ||
        new Date().toISOString(),
    };

    if (squarePaymentMethod) {
      completedUpdate.payment_method = squarePaymentMethod;
      completedUpdate.payment_method_type = squarePaymentMethod;
    }

    const { error: updateError } = await db
      .from("restaurant_orders")
      .update(completedUpdate)
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
      squarePaymentMethod || "method-unavailable",
    );

    return NextResponse.json({
      ok: true,
      paid: true,
      orderId: matchedOrder.id,
      orderNumber: matchedOrder.order_number,
      paymentMethod: squarePaymentMethod,
    });
  }

  const ktownPaymentStatus =
    squareStatus === "CANCELED"
      ? "cancelled"
      : squareStatus === "FAILED"
        ? "failed"
        : squareStatus === "APPROVED"
          ? "approved"
          : squareStatus === "PENDING"
            ? "pending"
            : null;

  if (!ktownPaymentStatus) {
    console.log(
      "SQUARE WEBHOOK UNKNOWN PAYMENT STATUS",
      matchedOrder.id,
      matchedOrder.order_number,
      squareStatus || "UNKNOWN",
      payment.id,
    );

    return NextResponse.json({
      ok: true,
      ignored: true,
      paymentStatus: squareStatus || "UNKNOWN",
    });
  }

  if (
    matchedOrder.payment_status === "paid" ||
    matchedOrder.payment_status === "refunded" ||
    matchedOrder.payment_status === "refund_pending"
  ) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "KTown order already has a completed/refund payment state.",
      paymentStatus: matchedOrder.payment_status,
    });
  }

  // IMPORTANT: APPROVED is already an authorized Square payment. Save the
  // actual Square tender here too, so a webhook arriving before square-pay
  // cannot leave payment_method/payment_method_type NULL.
  const statusUpdate: Record<string, string> = {
    payment_status: ktownPaymentStatus,
    square_payment_id: String(payment.id),
  };

  if (squareStatus === "APPROVED" && squarePaymentMethod) {
    statusUpdate.payment_method = squarePaymentMethod;
    statusUpdate.payment_method_type = squarePaymentMethod;
  }

  const { error: statusUpdateError } = await db
    .from("restaurant_orders")
    .update(statusUpdate)
    .eq("id", matchedOrder.id);

  if (statusUpdateError) {
    console.error(
      "SQUARE WEBHOOK NON-COMPLETED STATUS UPDATE ERROR",
      statusUpdateError,
    );
    return NextResponse.json(
      { error: statusUpdateError.message },
      { status: 500 },
    );
  }

  console.log(
    "SQUARE PAYMENT STATUS",
    matchedOrder.id,
    matchedOrder.order_number,
    squareStatus,
    payment.id,
    squarePaymentMethod || "method-unavailable",
  );

  return NextResponse.json({
    ok: true,
    paid: false,
    orderId: matchedOrder.id,
    orderNumber: matchedOrder.order_number,
    paymentStatus: ktownPaymentStatus,
    squarePaymentStatus: squareStatus,
    paymentMethod: squarePaymentMethod,
  });
}
