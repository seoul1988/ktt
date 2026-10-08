import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  getOrderAdmin,
  moneyCents,
} from "@/lib/restaurant-order/server";
import { dispatchUberDirectOrder } from "@/lib/delivery/uber-direct";
import {
  centralTwilioConfig,
  isKtownSmsEnabled,
  sendTwilioSms,
} from "@/lib/restaurant-order/twilio";

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

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function publicBaseUrl(request: Request) {
  const configured = String(process.env.KTOWN_PUBLIC_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (configured) return configured;

  return new URL(request.url).origin;
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
    const requestedPaymentMethod = String(body?.paymentMethodType || "")
      .trim()
      .toLowerCase();
    const paymentMethodType =
      requestedPaymentMethod === "apple_pay" ||
      requestedPaymentMethod === "google_pay" ||
      requestedPaymentMethod === "card"
        ? requestedPaymentMethod
        : "card";
    const verificationToken = String(
      body?.verificationToken || "",
    ).trim();
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
      { data: business, error: businessError },
    ] = await Promise.all([
      db
        .from("restaurant_orders")
        .select(
          "id,business_id,order_number,total,fulfillment_type,customer_phone,payment_status,square_order_id,square_payment_id,sms_consent,sms_sent_at,cancel_expires_at",
        )
        .eq("id", ktownOrderId)
        .eq("business_id", businessId)
        .single(),

      db
        .from("restaurant_order_private_settings")
        .select(
          "payment_provider,square_access_token,square_location_id,delivery_provider,uber_direct_enabled,uber_direct_customer_id",
        )
        .eq("business_id", businessId)
        .maybeSingle(),

      db
        .from("businesses")
        .select("id,name")
        .eq("id", businessId)
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

    if (businessError) {
      throw businessError;
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
          // One KTown order always maps to one Square payment request.
          idempotency_key: `kt-pay-${businessId}-${ktownOrderId}`.slice(0, 45),
          amount_money: {
            amount: amountCents,
            currency: "USD",
          },
          order_id: order.square_order_id,
          location_id:
            privateSettings.square_location_id,
          autocomplete: true,
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
      const errorDetail = squareErrorDetail(
        squarePayload,
        `Square payment failed (HTTP ${squareResponse.status}).`,
      );

      const { error: failedSaveError } = await db
        .from("restaurant_orders")
        .update({
          payment_status: "failed",
        })
        .eq("id", ktownOrderId)
        .eq("business_id", businessId)
        .eq("payment_status", "pending");

      if (failedSaveError) {
        console.error("SQUARE PAYMENT FAILED STATUS SAVE ERROR", failedSaveError);
      }

      return NextResponse.json(
        {
          error: errorDetail,
          paymentStatus: "failed",
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

    // Square can occasionally return APPROVED even with autocomplete=true.
    // In that case, explicitly complete the already-authorized payment and use
    // the final Square payment object before deciding what to save locally.
    let finalPayment = payment;
    let finalStatus = status.toUpperCase();

    if (finalStatus === "APPROVED") {
      // Square has authorized the payment. Save the tender immediately so an
      // authorized payment never leaves payment_method fields NULL.
      const { error: approvedMethodSaveError } = await db
        .from("restaurant_orders")
        .update({
          payment_status: "approved",
          payment_method: paymentMethodType,
          payment_method_type: paymentMethodType,
          square_payment_id: paymentId,
        })
        .eq("id", ktownOrderId)
        .eq("business_id", businessId);

      if (approvedMethodSaveError) {
        console.error(
          "SQUARE APPROVED PAYMENT METHOD SAVE ERROR",
          approvedMethodSaveError,
        );
      }

      const completeResponse = await fetch(
        `https://connect.squareup.com/v2/payments/${encodeURIComponent(paymentId)}/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${privateSettings.square_access_token}`,
            "Content-Type": "application/json",
            "Square-Version": "2026-08-19",
          },
          cache: "no-store",
        },
      );

      const completeText = await completeResponse.text();
      let completePayload: any = {};

      try {
        completePayload = completeText ? JSON.parse(completeText) : {};
      } catch {
        throw new Error(
          `Square returned an invalid complete-payment response (HTTP ${completeResponse.status}).`,
        );
      }

      if (!completeResponse.ok) {
        const completeError = squareErrorDetail(
          completePayload,
          `Square could not complete the approved payment (HTTP ${completeResponse.status}).`,
        );

        // Do not mark an authorized payment as failed and do not encourage
        // another charge attempt. Keep its real Square state and payment ID.
        const { error: approvedSaveError } = await db
          .from("restaurant_orders")
          .update({
            payment_status: "approved",
            payment_method: paymentMethodType,
            payment_method_type: paymentMethodType,
            square_payment_id: paymentId,
          })
          .eq("id", ktownOrderId)
          .eq("business_id", businessId);

        if (approvedSaveError) {
          console.error("SQUARE APPROVED STATUS SAVE ERROR", approvedSaveError);
        }

        return NextResponse.json(
          {
            ok: false,
            error: completeError,
            paymentStatus: "approved",
            squarePaymentStatus: "APPROVED",
            paymentId,
            retryPayment: false,
          },
          { status: 409 },
        );
      }

      finalPayment = completePayload?.payment || payment;
      finalStatus = String(finalPayment?.status || "").toUpperCase();
    }

    if (finalStatus !== "COMPLETED") {
      const ktownPaymentStatus =
        finalStatus === "CANCELED"
          ? "cancelled"
          : finalStatus === "FAILED"
            ? "failed"
            : finalStatus === "APPROVED"
              ? "approved"
              : finalStatus === "PENDING"
                ? "pending"
                : "pending";

      const nonCompletedUpdate: Record<string, string> = {
        payment_status: ktownPaymentStatus,
        square_payment_id: paymentId,
      };

      if (ktownPaymentStatus === "approved") {
        nonCompletedUpdate.payment_method = paymentMethodType;
        nonCompletedUpdate.payment_method_type = paymentMethodType;
      }

      const { error: statusSaveError } = await db
        .from("restaurant_orders")
        .update(nonCompletedUpdate)
        .eq("id", ktownOrderId)
        .eq("business_id", businessId);

      if (statusSaveError) {
        console.error("SQUARE NON-COMPLETED STATUS SAVE ERROR", statusSaveError);
      }

      return NextResponse.json(
        {
          error: `Payment is ${finalStatus || "not completed"}.`,
          paymentStatus: ktownPaymentStatus,
          squarePaymentStatus: finalStatus || "UNKNOWN",
          paymentId,
        },
        { status: 400 },
      );
    }

    const paidAt = new Date();
    const cancelExpiresAt = new Date(paidAt.getTime() + 3 * 60 * 1000);
    const rawCancelToken = randomBytes(24).toString("base64url");
    const cancelTokenHash = tokenHash(rawCancelToken);

    const trackingExpiresAt = new Date(
      paidAt.getTime() + 60 * 60 * 1000,
    );
    const rawTrackingToken = randomBytes(32).toString("base64url");
    const trackingTokenHash = tokenHash(rawTrackingToken);

    // Square COMPLETED -> update the payment facts in one write.
    // Even if the webhook already marked this order paid, write again so the
    // actual checkout tender and paid_at are always completed.
    const { error: updateError } = await db
      .from("restaurant_orders")
      .update({
        payment_status: "paid",
        payment_method: paymentMethodType,
        payment_method_type: paymentMethodType,
        square_payment_id: paymentId,
        paid_at: paidAt.toISOString(),
      })
      .eq("id", ktownOrderId)
      .eq("business_id", businessId);

    if (updateError) {
      console.error("SQUARE COMPLETED PAYMENT SAVE ERROR", updateError);

      // Square already returned COMPLETED. Do not tell the customer that the
      // payment itself failed and encourage another payment attempt.
      return NextResponse.json({
        ok: true,
        paymentStatus: "paid",
        paymentMethodType,
        paymentId,
        orderNumber: order.order_number,
        paymentRecorded: false,
      });
    }

    // Payment is already safely recorded. Save cancellation/tracking tokens
    // separately so an optional token-write problem can never turn a successful
    // Square payment into a payment failure.
    const { error: tokenUpdateError } = await db
      .from("restaurant_orders")
      .update({
        cancel_token_hash: cancelTokenHash,
        cancel_expires_at: cancelExpiresAt.toISOString(),
        tracking_token_hash: trackingTokenHash,
        tracking_expires_at: trackingExpiresAt.toISOString(),
      })
      .eq("id", ktownOrderId)
      .eq("business_id", businessId);

    if (tokenUpdateError) {
      console.error("ORDER TOKEN SAVE ERROR", tokenUpdateError);
    }

    // PRODUCTION DELIVERY:
    // After Square confirms payment, automatically create the real Uber Direct
    // delivery for delivery orders. dispatchUberDirectOrder() itself safely
    // skips pickup orders, unpaid orders, disabled Uber Direct, and duplicate
    // deliveries. Restaurant full-address parsing is handled in
    // lib/delivery/uber-direct.ts.
    let delivery: any = null;

    try {
      delivery = await dispatchUberDirectOrder({
        db,
        businessId,
        orderId: ktownOrderId,
        prepMinutes: 15,
      });
    } catch (deliveryError) {
      console.error(
        "Uber Direct automatic dispatch failed:",
        deliveryError,
      );

      // Payment remains successful. The delivery failure is saved on the order
      // and can be retried without charging the customer again.
      delivery = {
        ok: false,
        error:
          deliveryError instanceof Error
            ? deliveryError.message
            : "Courier dispatch failed.",
      };
    }

    let sms: any = null;

    if (
      isKtownSmsEnabled() &&
      order.sms_consent === true &&
      !order.sms_sent_at
    ) {
      const twilio = centralTwilioConfig();

      if (twilio) {
        const cancelUrl =
          `${publicBaseUrl(request)}/c/${encodeURIComponent(rawCancelToken)}`;
        const restaurantName = String(
          business?.name || "Restaurant",
        ).trim();
        const fulfillmentLabel =
          order.fulfillment_type === "delivery" ? "Delivery" : "Pickup";

        const message = [
          ` ${restaurantName}`,
          `Order #${order.order_number} confirmed.`,
          `${fulfillmentLabel} · Total $${Number(order.total || 0).toFixed(2)}`,
          "",
          "Cancel Order (within 3 minutes):",
          cancelUrl,
          "",
          "Reply STOP to opt out or HELP for help.",
        ].join("\n");

        try {
          sms = await sendTwilioSms(
            twilio,
            String(order.customer_phone || ""),
            message,
          );

          const { error: smsSaveError } = await db
            .from("restaurant_orders")
            .update({
              sms_sent_at: new Date().toISOString(),
              sms_message_sid: sms.sid || null,
            })
            .eq("id", ktownOrderId)
            .eq("business_id", businessId);

          if (smsSaveError) {
            console.error("ORDER SMS SAVE ERROR", smsSaveError);
          }
        } catch (smsError) {
          console.error("ORDER SMS ERROR", smsError);
          // Payment and delivery remain successful even if SMS fails.
          sms = {
            ok: false,
            error:
              smsError instanceof Error
                ? smsError.message
                : "SMS failed.",
          };
        }
      }
    }

    const trackingUrl =
      `/orders/track/${encodeURIComponent(rawTrackingToken)}`;

    const response = NextResponse.json({
      ok: true,
      paymentStatus: "paid",
      paymentMethodType,
      paymentId,
      orderNumber: order.order_number,
      delivery,
      smsQueued: !!sms && sms?.ok !== false,
      cancelExpiresAt: cancelExpiresAt.toISOString(),
      trackingUrl:
        order.fulfillment_type === "delivery" ? trackingUrl : null,
      trackingExpiresAt:
        order.fulfillment_type === "delivery"
          ? trackingExpiresAt.toISOString()
          : null,
    });

    // 같은 브라우저에서 결제한 Delivery 고객에게만 1시간 동안 배송조회 버튼을 표시합니다.
    if (order.fulfillment_type === "delivery") {
      response.cookies.set(
        `ktown_delivery_tracking_${businessId}`,
        encodeURIComponent(
          JSON.stringify({
            url: trackingUrl,
            expiresAt: trackingExpiresAt.toISOString(),
          }),
        ),
        {
          maxAge: 60 * 60,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          httpOnly: false,
        },
      );
    }

    return response;
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
