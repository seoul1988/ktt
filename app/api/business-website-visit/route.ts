import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ALLOWED_SOURCES = new Set([
  "direct",
  "google",
  "instagram",
  "ktowntriangle",
  "facebook",
  "internal",
  "other",
]);

function getEasternDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const businessId = Number(body.businessId);
    const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
    const requestedSource = typeof body.source === "string" ? body.source : "other";
    const source = ALLOWED_SOURCES.has(requestedSource) ? requestedSource : "other";
    const path = typeof body.path === "string" ? body.path.slice(0, 500) : null;

    if (!Number.isInteger(businessId) || businessId <= 0 || visitorId.length < 10) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const hashSecret = process.env.VISITOR_HASH_SECRET || serviceRoleKey;

    if (!supabaseUrl || !serviceRoleKey || !hashSecret) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const visitorHash = createHash("sha256")
      .update(`${hashSecret}:${businessId}:${visitorId}`)
      .digest("hex");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from("business_website_visits").upsert(
      {
        business_id: businessId,
        visit_date: getEasternDate(),
        visitor_hash: visitorHash,
        source,
        landing_path: path,
      },
      {
        onConflict: "business_id,visit_date,visitor_hash",
        ignoreDuplicates: true,
      },
    );

    if (error) {
      console.error("방문자 기록 실패", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
