import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";
import { createUberDirectQuote } from "@/lib/delivery/uber-direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "Invalid business ID." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const dropoffAddress = body?.deliveryAddress || {};

    if (
      !String(dropoffAddress?.address1 || "").trim() ||
      !String(dropoffAddress?.city || "").trim() ||
      !String(dropoffAddress?.state || "").trim() ||
      !String(dropoffAddress?.postalCode || "").trim()
    ) {
      return NextResponse.json(
        { error: "Please enter the complete delivery address." },
        { status: 400 },
      );
    }

    const db = getOrderAdmin();

    const [
      { data: business, error: businessError },
      { data: privateSettings, error: privateError },
    ] = await Promise.all([
      db
        .from("businesses")
        .select("*")
        .eq("id", businessId)
        .single(),

      db
        .from("restaurant_order_private_settings")
        .select(
          "delivery_provider,uber_direct_enabled,uber_direct_customer_id,delivery_fee_markup_cents",
        )
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    if (businessError) throw businessError;
    if (privateError) throw privateError;

    const quote = await createUberDirectQuote({
      business,
      privateSettings,
      dropoffAddress,
    });

    return NextResponse.json({
      ok: true,
      provider: "uber_direct",
      quoteId: quote.id,
      feeCents: quote.customerFeeCents,
      uberFeeCents: quote.uberFeeCents,
      markupCents: quote.markupCents,
      expiresAt: quote.expires || null,
      durationMinutes: quote.duration || null,
      pickupMinutes: quote.pickup_duration || null,
      dropoffEta: quote.dropoff_eta || null,
      currency: quote.currency_type || "USD",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Delivery quote could not be created.",
      },
      { status: 400 },
    );
  }
}
