import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Supabase environment variables are missing. NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY를 확인하세요.",
        },
        { status: 500, headers: noStoreHeaders() },
      );
    }

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401, headers: noStoreHeaders() },
      );
    }

    // First verify that the caller has a valid Supabase login session.
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "유효하지 않은 로그인 세션입니다." },
        { status: 401, headers: noStoreHeaders() },
      );
    }

    // Service role bypasses RLS so the admin Deal screen receives every business.
    // Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await admin
      .from("businesses")
      .select("*")
      .order("name", { ascending: true })
      .range(0, 4999);

    if (error) {
      console.error("businesses API query error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: noStoreHeaders() },
      );
    }

    const businesses = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name ?? null,
      address: row.address ?? null,
      street_address: row.street_address ?? null,
      address1: row.address1 ?? null,
      address2: row.address2 ?? null,
      city: row.city ?? null,
      zip: row.zip ?? null,
      zipcode: row.zipcode ?? null,
      postal_code: row.postal_code ?? null,
    }));

    return NextResponse.json(
      {
        businesses,
        count: businesses.length,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error: any) {
    console.error("businesses API error:", error);

    return NextResponse.json(
      { error: error?.message || "Unknown Error" },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}