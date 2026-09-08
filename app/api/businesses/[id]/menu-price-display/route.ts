import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PriceSource = "menu" | "pickup" | "delivery";

function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeSource(
  value: unknown,
  fallback: PriceSource,
): PriceSource {
  return value === "menu" ||
    value === "pickup" ||
    value === "delivery"
    ? value
    : fallback;
}

export async function GET(
  _request: Request,
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

    const db = adminClient();

    const { data, error } = await db
      .from("business_menu_price_display")
      .select(
        "menu_item_id,menu_source,pickup_source,delivery_source",
      )
      .eq("business_id", businessId);

    if (error) throw error;

    return NextResponse.json(
      {
        items: (data || []).map((row) => ({
          menuItemId: Number(row.menu_item_id),
          menuSource: normalizeSource(row.menu_source, "menu"),
          pickupSource: normalizeSource(row.pickup_source, "pickup"),
          deliverySource: normalizeSource(
            row.delivery_source,
            "delivery",
          ),
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[public menu-price-display GET]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Price display settings could not be loaded.",
      },
      { status: 500 },
    );
  }
}
