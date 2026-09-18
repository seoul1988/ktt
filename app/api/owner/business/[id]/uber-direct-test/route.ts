import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";
import { dispatchUberDirectOrder } from "@/lib/delivery/uber-direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid business ID." },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const orderId = Number(body?.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Valid order ID is required." },
        { status: 400 },
      );
    }

    const db = getOrderAdmin();

    // 주문이 실제로 이 식당의 주문인지 먼저 확인
    const { data: order, error: orderError } = await db
      .from("restaurant_orders")
      .select(
        `
        id,
        business_id,
        order_number,
        fulfillment_type,
        payment_status,
        delivery_provider,
        delivery_quote_id,
        delivery_external_id,
        delivery_status,
        delivery_tracking_url,
        delivery_last_error
        `,
      )
      .eq("id", orderId)
      .eq("business_id", businessId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          ok: false,
          error: "Order not found.",
          detail: orderError?.message || null,
        },
        { status: 404 },
      );
    }

    if (order.fulfillment_type !== "delivery") {
      return NextResponse.json(
        {
          ok: false,
          error: "This is not a delivery order.",
          order,
        },
        { status: 400 },
      );
    }

    if (order.payment_status !== "paid") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "For safety, Uber TEST only accepts an existing PAID order.",
          order,
        },
        { status: 400 },
      );
    }

    // 이미 Uber Delivery가 만들어졌으면 중복 호출 금지
    if (order.delivery_external_id) {
      return NextResponse.json({
        ok: true,
        alreadyDispatched: true,
        message: "Uber Direct delivery already exists.",
        order,
      });
    }

    console.log("========== UBER DIRECT TEST START ==========");
    console.log("Business ID:", businessId);
    console.log("Order ID:", orderId);
    console.log("Order Number:", order.order_number);
    console.log("Payment Status:", order.payment_status);
    console.log("Existing Quote:", order.delivery_quote_id);
    console.log("Existing Delivery Status:", order.delivery_status);

    try {
      // Square / Receipt / SMS 호출 없음
      // Uber Direct만 직접 실행
      const result = await dispatchUberDirectOrder({
        db,
        businessId,
        orderId,
        prepMinutes: 15,
      });

      console.log("UBER DIRECT TEST RESULT:", result);
      console.log("========== UBER DIRECT TEST END ==========");

      const { data: updatedOrder } = await db
        .from("restaurant_orders")
        .select(
          `
          id,
          order_number,
          payment_status,
          delivery_provider,
          delivery_quote_id,
          delivery_external_id,
          delivery_status,
          delivery_tracking_url,
          delivery_last_error
          `,
        )
        .eq("id", orderId)
        .eq("business_id", businessId)
        .single();

      return NextResponse.json({
        ok: true,
        message: "Uber Direct test completed.",
        uberResult: result,
        order: updatedOrder || order,
      });
    } catch (uberError) {
      const message =
        uberError instanceof Error
          ? uberError.message
          : String(uberError);

      console.error("========== UBER DIRECT TEST FAILED ==========");
      console.error("Business ID:", businessId);
      console.error("Order ID:", orderId);
      console.error("ERROR:", message);

      const { data: failedOrder } = await db
        .from("restaurant_orders")
        .select(
          `
          id,
          order_number,
          payment_status,
          delivery_provider,
          delivery_quote_id,
          delivery_external_id,
          delivery_status,
          delivery_tracking_url,
          delivery_last_error
          `,
        )
        .eq("id", orderId)
        .eq("business_id", businessId)
        .single();

      return NextResponse.json(
        {
          ok: false,
          error: message,
          order: failedOrder || order,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("UBER DIRECT TEST ROUTE ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Uber Direct test failed.",
      },
      { status: 500 },
    );
  }
}