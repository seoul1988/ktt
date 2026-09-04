import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  getOrderAdmin,
  moneyCents,
} from "@/lib/restaurant-order/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function squareErrorDetail(payload: any, fallback: string) {
  if (
    Array.isArray(payload?.errors) &&
    payload.errors.length
  ) {
    return payload.errors
      .map(
        (item: any) =>
          item?.detail ||
          item?.code ||
          "Square payment error",
      )
      .join(" / ");
  }
  return fallback;
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
      orderId: string;
    }>;
  },
) {
  try {
    const { id, orderId } = await context.params;
    const businessId = Number(id);
    const ktownOrderId = Number(orderId);

    if (
      !Number.isInteger(businessId) ||
      businessId <= 0 ||
      !Number.isInteger(ktownOrderId) ||
      ktownOrderId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid order." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const sourceId = String(body?.sourceId || "").trim();
    const verificationToken = String(
      body?.verificationToken || "",
    ).trim();
    const attemptId = String(
      body?.attemptId || randomUUID(),
    )
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 80);

    const buyerEmailAddress = String(
      body?.buyerEmailAddress || "",
    )
      .trim()
      .toLowerCase()
      .slice(0, 254);

    const buyerPhoneNumber = String(
      body?.buyerPhoneNumber || "",
    )
      .trim()
      .slice(0, 40);

    if (
      buyerEmailAddress &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        buyerEmailAddress,
      )
    ) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    if (!sourceId) {
      return NextResponse.json(
        { error: "Payment token is required." },
        { status: 400 },
      );
    }

    const db = getOrderAdmin();

    const [
      { data: order, error: orderError },
      { data: privateSettings, error: privateError },
    ] = await Promise.all([
      db
        .from("restaurant_orders")
        .select(
          "id,business_id,order_number,total,payment_status,square_order_id,square_payment_id",
        )
        .eq("id", ktownOrderId)
        .eq("business_id", businessId)
        .single(),

      db
        .from("restaurant_order_private_settings")
        .select(
          "payment_provider,square_access_token,square_location_id",
        )
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 },
      );
    }

    if (privateError) {
      throw privateError;
    }

    if (
      privateSettings?.payment_provider !== "square" ||
      !privateSettings?.square_access_token ||
      !privateSettings?.square_location_id
    ) {
      return NextResponse.json(
        {
          error:
            "Square payment is not configured for this restaurant.",
        },
        { status: 400 },
      );
    }

    if (!order.square_order_id) {
      return NextResponse.json(
        {
          error:
            "This order has not been prepared in Square.",
        },
        { status: 400 },
      );
    }

    if (
      order.payment_status === "paid" &&
      order.square_payment_id
    ) {
      return NextResponse.json({
        ok: true,
        alreadyPaid: true,
        paymentStatus: "paid",
        paymentId: order.square_payment_id,
        orderNumber: order.order_number,
      });
    }

    const amountCents = moneyCents(
      Number(order.total || 0),
    );

    if (amountCents <= 0) {
      return NextResponse.json(
        { error: "Invalid payment total." },
        { status: 400 },
      );
    }

    const squareResponse = await fetch(
      "https://connect.squareup.com/v2/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${privateSettings.square_access_token}`,
          "Content-Type": "application/json",
          "Square-Version": "2026-08-19",
        },
        body: JSON.stringify({
          source_id: sourceId,
          idempotency_key:
            `ktown-${ktownOrderId}-${attemptId || randomUUID()}`,
          amount_money: {
            amount: amountCents,
            currency: "USD",
          },
          order_id: order.square_order_id,
          location_id:
            privateSettings.square_location_id,
          autocomplete: true,
          ...(buyerEmailAddress
            ? {
                buyer_email_address:
                  buyerEmailAddress,
              }
            : {}),
          ...(buyerPhoneNumber
            ? {
                buyer_phone_number:
                  buyerPhoneNumber,
              }
            : {}),
          customer_details: {
            customer_initiated: true,
            seller_keyed_in: false,
          },
          ...(verificationToken
            ? {
                verification_token:
                  verificationToken,
              }
            : {}),
          note: `KTown order #${order.order_number}`,
        }),
        cache: "no-store",
      },
    );

    const squareText = await squareResponse.text();
    let squarePayload: any = {};

    try {
      squarePayload = squareText
        ? JSON.parse(squareText)
        : {};
    } catch {
      throw new Error(
        `Square returned an invalid payment response (HTTP ${squareResponse.status}).`,
      );
    }

    if (!squareResponse.ok) {
      return NextResponse.json(
        {
          error: squareErrorDetail(
            squarePayload,
            `Square payment failed (HTTP ${squareResponse.status}).`,
          ),
        },
        { status: 400 },
      );
    }

    const payment = squarePayload?.payment;
    const paymentId = String(payment?.id || "");
    const status = String(payment?.status || "");

    if (!paymentId) {
      return NextResponse.json(
        {
          error:
            "Square did not return a payment ID.",
        },
        { status: 502 },
      );
    }

    if (status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: `Payment is ${status || "not completed"}.`,
          paymentStatus: status,
        },
        { status: 400 },
      );
    }

    const { error: updateError } = await db
      .from("restaurant_orders")
      .update({
        payment_status: "paid",
        square_payment_id: paymentId,
      })
      .eq("id", ktownOrderId)
      .eq("business_id", businessId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      ok: true,
      paymentStatus: "paid",
      paymentId,
      orderNumber: order.order_number,
    });
  } catch (error) {
    console.error("Square direct payment error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Payment could not be completed.",
      },
      { status: 500 },
    );
  }
}
