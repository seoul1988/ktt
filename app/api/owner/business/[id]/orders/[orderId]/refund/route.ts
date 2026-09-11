import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SQUARE_VERSION = "2026-08-19";

function getAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ")
    ? value.slice(7).trim()
    : "";
}

async function requireBusinessAccess(
  request: Request,
  businessId: number,
) {
  const accessToken = bearer(request);

  if (!accessToken) {
    return {
      ok: false as const,
      status: 401,
      error: "로그인이 필요합니다.",
    };
  }

  const db = getAdminClient();

  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(accessToken);

  if (authError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: "로그인 세션이 올바르지 않습니다.",
    };
  }

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (String(profile?.role || "").toLowerCase() === "admin") {
    return { ok: true as const, db };
  }

  const { data: owner, error: ownerError } = await db
    .from("business_owners")
    .select("business_id,status")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerError) throw ownerError;

  const ownerStatus = String(owner?.status || "").toLowerCase();
  if (!owner || !["approved", "active"].includes(ownerStatus)) {
    return {
      ok: false as const,
      status: 403,
      error: "이 비즈니스를 관리할 권한이 없습니다.",
    };
  }

  return { ok: true as const, db };
}

function squareErrorDetail(payload: any, fallback: string) {
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    return payload.errors
      .map(
        (item: any) =>
          item?.detail ||
          item?.code ||
          "Square refund error",
      )
      .filter(Boolean)
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

    const access = await requireBusinessAccess(request, businessId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const db = access.db;

    const [
      { data: order, error: orderError },
      { data: privateSettings, error: privateError },
    ] = await Promise.all([
      db
        .from("restaurant_orders")
        .select(
          "id,business_id,order_number,total,payment_status,order_status,square_payment_id",
        )
        .eq("id", ktownOrderId)
        .eq("business_id", businessId)
        .maybeSingle(),

      db
        .from("restaurant_order_private_settings")
        .select(
          "payment_provider,square_access_token,square_location_id",
        )
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    if (orderError) throw orderError;
    if (privateError) throw privateError;

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 },
      );
    }

    const currentPaymentStatus = String(
      order.payment_status || "",
    ).toLowerCase();

    if (currentPaymentStatus === "refunded") {
      return NextResponse.json({
        ok: true,
        alreadyRefunded: true,
        refundStatus: "COMPLETED",
        orderStatus: "cancelled",
        paymentStatus: "refunded",
        orderNumber: order.order_number,
      });
    }

    if (currentPaymentStatus === "refund_pending") {
      return NextResponse.json({
        ok: true,
        alreadyPending: true,
        refundStatus: "PENDING",
        orderStatus: "cancelled",
        paymentStatus: "refund_pending",
        orderNumber: order.order_number,
      });
    }

    const squarePaymentId = String(
      order.square_payment_id || "",
    ).trim();

    if (
      currentPaymentStatus !== "paid" ||
      !squarePaymentId
    ) {
      return NextResponse.json(
        {
          error:
            "Only a paid Square order with a Square payment ID can be refunded.",
        },
        { status: 400 },
      );
    }

    if (
      privateSettings?.payment_provider !== "square" ||
      !String(privateSettings?.square_access_token || "").trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Square payment is not configured for this restaurant.",
        },
        { status: 400 },
      );
    }

    const amountCents = Math.round(
      Number(order.total || 0) * 100,
    );

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { error: "Invalid refund amount." },
        { status: 400 },
      );
    }

    const squareResponse = await fetch(
      "https://connect.squareup.com/v2/refunds",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${privateSettings.square_access_token}`,
          "Content-Type": "application/json",
          "Square-Version": SQUARE_VERSION,
        },
        body: JSON.stringify({
          idempotency_key:
            `ktown-admin-refund-${businessId}-${ktownOrderId}`,
          amount_money: {
            amount: amountCents,
            currency: "USD",
          },
          payment_id: squarePaymentId,
          reason: `KTown admin cancelled order #${order.order_number}`.slice(
            0,
            192,
          ),
        }),
        cache: "no-store",
      },
    );

    const squarePayload = await squareResponse
      .json()
      .catch(() => ({}));

    if (!squareResponse.ok) {
      return NextResponse.json(
        {
          error: squareErrorDetail(
            squarePayload,
            `Square refund failed (HTTP ${squareResponse.status}).`,
          ),
        },
        { status: 400 },
      );
    }

    const refund = squarePayload?.refund;
    const refundId = String(refund?.id || "").trim();
    const refundStatus = String(
      refund?.status || "",
    ).toUpperCase();

    if (!refundId) {
      return NextResponse.json(
        { error: "Square did not return a refund ID." },
        { status: 502 },
      );
    }

    // A Square refund can be completed immediately or remain pending.
    // Do not claim completion until Square says COMPLETED.
    if (refundStatus === "COMPLETED") {
      const { error: saveError } = await db
        .from("restaurant_orders")
        .update({
          order_status: "cancelled",
          payment_status: "refunded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ktownOrderId)
        .eq("business_id", businessId);

      if (saveError) throw saveError;

      return NextResponse.json({
        ok: true,
        refundId,
        refundStatus,
        orderStatus: "cancelled",
        paymentStatus: "refunded",
        orderNumber: order.order_number,
      });
    }

    if (refundStatus === "PENDING") {
      const { error: saveError } = await db
        .from("restaurant_orders")
        .update({
          order_status: "cancelled",
          payment_status: "refund_pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ktownOrderId)
        .eq("business_id", businessId);

      if (saveError) throw saveError;

      return NextResponse.json({
        ok: true,
        refundId,
        refundStatus,
        orderStatus: "cancelled",
        paymentStatus: "refund_pending",
        orderNumber: order.order_number,
      });
    }

    return NextResponse.json(
      {
        error:
          `Square refund was not accepted. Status: ${refundStatus || "UNKNOWN"}.`,
        refundId,
        refundStatus,
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("OWNER SQUARE REFUND ERROR", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Refund could not be completed.",
      },
      { status: 500 },
    );
  }
}
