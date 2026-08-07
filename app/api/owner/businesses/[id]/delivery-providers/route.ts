import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("business_delivery_providers")
      .select("id,provider_key,name,url,display_order")
      .eq("business_id", businessId)
      .eq("is_enabled", true)
      .neq("url", "")
      .order("display_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;

    return NextResponse.json(
      { providers: data || [] },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delivery providers load failed" },
      { status: 500 },
    );
  }
}