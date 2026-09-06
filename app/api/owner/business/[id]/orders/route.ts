import { NextResponse } from "next/server";
import {
  getOrderAdmin,
  requireOrderOwner,
} from "@/lib/restaurant-order/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const businessId = Number((await context.params).id);

    const access = await requireOrderOwner(
      request,
      businessId,
    );

    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const db = getOrderAdmin();

    const { data, error } = await db
      .from("restaurant_orders")
      .select(
        "id,order_number,fulfillment_type,customer_name,customer_phone,requested_time,payment_method,payment_method_type,payment_status,order_status,subtotal,tax,tip,total,delivery_address,square_payment_id,created_at,restaurant_order_items(id,item_name,quantity,unit_price,line_total,instructions)",
      )
      .eq("business_id", businessId)
      .not("square_payment_id", "is", null)
      .neq("square_payment_id", "")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      orders: data || [],
    });
  } catch (e) {
    console.error("OWNER ORDERS GET ERROR", e);

    return NextResponse.json(
      { error: "주문을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

