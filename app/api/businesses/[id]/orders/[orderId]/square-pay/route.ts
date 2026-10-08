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
          "id,business_id,order_number,total,fulfillment_type,customer_phone,payment_status,payment_method,payment_method_type,paid_at,square_order_id,square_payment_id,sms_consent,sms_sent_at,cancel_expires_at",
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

    if (
      order.payment_status === "paid" &&
      order.square_payment_id
    ) {
      // A previous request may have charged successfully but failed while saving
      // the remaining payment metadata. Repair that partial row on retry without
      // creating another Square payment.
      const paidMetadataMissing =
        !String(order.payment_method || "").trim() ||
        !String(order.payment_method_type || "").trim() ||
        !order.paid_at;

      if (paidMetadataMissing) {
        const { error: repairError } = await db
          .from("restaurant_orders")
          .update({
            payment_method: paymentMethodType,
            payment_method_type: paymentMethodType,
            paid_at: order.paid_at || new Date().toISOString(),
          })
          .eq("id", ktownOrderId)
          .eq("business_id", businessId);

        if (repairError) {
          console.error("SQUARE PAID METADATA REPAIR ERROR", repairError);
        }
      }

      return NextResponse.json({
        ok: true,
        alreadyPaid: true,
        paymentStatus: "paid",
        paymentMethodType,
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

    if (status !== "COMPLETED") {
      const normalizedStatus = status.toUpperCase();
      const ktownPaymentStatus =
        normalizedStatus === "CANCELED"
          ? "cancelled"
          : normalizedStatus === "FAILED"
            ? "failed"
            : normalizedStatus === "APPROVED"
              ? "approved"
              : normalizedStatus === "PENDING"
                ? "pending"
                : "pending";

      const { error: statusSaveError } = await db
        .from("restaurant_orders")
        .update({
          payment_status: ktownPaymentStatus,
          square_payment_id: paymentId,
        })
        .eq("id", ktownOrderId)
        .eq("business_id", businessId);

      if (statusSaveError) {
        console.error("SQUARE NON-COMPLETED STATUS SAVE ERROR", statusSaveError);
      }

      return NextResponse.json(
        {
          error: `Payment is ${status || "not completed"}.`,
          paymentStatus: ktownPaymentStatus,
          squarePaymentStatus: status || "UNKNOWN",
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

    // Save the critical payment facts first. Do not mix optional
    // cancellation/tracking metadata into this write: a constraint on an
    // optional field must never turn a completed Square charge into a
    // customer-visible payment failure.
    const { error: paymentSaveError } = await db
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

    if (paymentSaveError) {
      // Square has already returned COMPLETED. Preserve at least the paid state
      // and Square payment ID, then return success so the customer is never
      // encouraged to pay again.
      console.error("SQUARE COMPLETED PAYMENT METADATA SAVE ERROR", paymentSaveError);

      const { error: fallbackSaveError } = await db
        .from("restaurant_orders")
        .update({
          payment_status: "paid",
          square_payment_id: paymentId,
        })
        .eq("id", ktownOrderId)
        .eq("business_id", businessId);

      if (fallbackSaveError) {
        console.error("SQUARE COMPLETED FALLBACK SAVE ERROR", fallbackSaveError);
      }
    }

    // Optional post-payment metadata is best-effort only.
    const { error: postPaymentMetadataError } = await db
      .from("restaurant_orders")
      .update({
        cancel_token_hash: cancelTokenHash,
        cancel_expires_at: cancelExpiresAt.toISOString(),
        tracking_token_hash: trackingTokenHash,
        tracking_expires_at: trackingExpiresAt.toISOString(),
      })
      .eq("id", ktownOrderId)
      .eq("business_id", businessId);

    if (postPaymentMetadataError) {
      console.error(
        "SQUARE POST-PAYMENT METADATA SAVE ERROR",
        postPaymentMetadataError,
      );
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
