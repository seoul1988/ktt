import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SQUARE_VERSION = "2026-08-19";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("SERVER_CONFIG");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function bearer(request: NextRequest) {
  const value = request.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    const supabase = getSupabaseAdmin();
    const token = bearer(request);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      const { data: owner } = await supabase.from("business_owners").select("status").eq("business_id", businessId).eq("user_id", user.id).maybeSingle();
      if (!owner || owner.status !== "approved") return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { data: current, error: readError } = await supabase
      .from("restaurant_order_private_settings")
      .select("square_access_token")
      .eq("business_id", businessId)
      .maybeSingle();
    if (readError) throw readError;

    const accessToken = String(current?.square_access_token || "");
    const applicationId = process.env.SQUARE_APPLICATION_ID || "";
    const applicationSecret = process.env.SQUARE_APPLICATION_SECRET || "";
    const sandbox = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase() === "sandbox";
    if (accessToken && applicationId && applicationSecret) {
      const base = sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
      await fetch(`${base}/oauth2/revoke`, {
        method: "POST",
        headers: {
          Authorization: `Client ${applicationSecret}`,
          "Content-Type": "application/json",
          "Square-Version": SQUARE_VERSION,
        },
        body: JSON.stringify({ client_id: applicationId, access_token: accessToken, revoke_only_access_token: false }),
        cache: "no-store",
      }).catch(() => null);
    }

    const { error: updateError } = await supabase
      .from("restaurant_order_private_settings")
      .update({
        square_merchant_id: null,
        square_merchant_name: null,
        square_location_id: null,
        square_location_name: null,
        square_access_token: null,
        square_refresh_token: null,
        square_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("SQUARE DISCONNECT ERROR", error);
    return NextResponse.json({ error: "Square 연결 해제에 실패했습니다." }, { status: 500 });
  }
}
