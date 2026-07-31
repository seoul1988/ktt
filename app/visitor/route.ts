import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type VisitorRequestBody = {
  visitorKey?: string;
  userId?: string | null;
  page?: string;
  browserLanguage?: string;
  deviceOs?: string;
};

const BOT_PATTERN =
  /bot|crawler|spider|crawl|slurp|headless|lighthouse|preview|facebookexternalhit|googlebot|bingbot|gptbot|chatgpt-user|claudebot|anthropic|bytespider|yandex|duckduckbot|baiduspider|semrush|ahrefs|mj12bot|petalbot|uptimerobot|curl|wget|python-requests|axios|postmanruntime/i;

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getClientIp(request: NextRequest) {
  const forwardedFor =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-vercel-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function cleanText(
  value: unknown,
  maxLength: number,
  fallback = "",
) {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim().slice(0, maxLength);
}

function isValidVisitorKey(visitorKey: string) {
  return (
    /^guest_[a-zA-Z0-9_-]{8,180}$/.test(visitorKey) ||
    /^user_[a-zA-Z0-9_-]{8,180}$/.test(visitorKey)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VisitorRequestBody;

    const visitorKey = cleanText(body.visitorKey, 200);
    const userId = cleanText(body.userId, 100) || null;
    const page = cleanText(body.page, 500, "/") || "/";
    const browserLanguage = cleanText(
      body.browserLanguage,
      50,
      "unknown",
    );
    const deviceOs = cleanText(
      body.deviceOs,
      50,
      "unknown",
    );

    if (!visitorKey || !isValidVisitorKey(visitorKey)) {
      return NextResponse.json(
        { error: "Invalid visitor key." },
        { status: 400 },
      );
    }

    const userAgent = cleanText(
      request.headers.get("user-agent"),
      1000,
      "unknown",
    );

    const referer = cleanText(
      request.headers.get("referer"),
      1000,
    );

    const ipAddress = getClientIp(request);

    const country =
      cleanText(
        request.headers.get("x-vercel-ip-country"),
        10,
      ).toUpperCase() || null;

    if (BOT_PATTERN.test(userAgent)) {
      return NextResponse.json({
        ok: true,
        recorded: false,
        reason: "bot",
      });
    }

    const supabase = getServerSupabase();

    const oneHourAgo = new Date(
      Date.now() - 60 * 60 * 1000,
    ).toISOString();

    const { data: recentVisitor, error: visitorCheckError } =
      await supabase
        .from("visitor_logs")
        .select("id")
        .eq("visitor_key", visitorKey)
        .gte("created_at", oneHourAgo)
        .limit(1)
        .maybeSingle();

    if (visitorCheckError) {
      console.error(
        "Visitor duplicate check error:",
        visitorCheckError.message,
      );

      return NextResponse.json(
        { error: "Unable to check visitor." },
        { status: 500 },
      );
    }

    if (recentVisitor) {
      return NextResponse.json({
        ok: true,
        recorded: false,
        reason: "same-visitor-within-one-hour",
      });
    }

    if (ipAddress !== "unknown" && userAgent !== "unknown") {
      const { data: recentEnvironment, error: environmentCheckError } =
        await supabase
          .from("visitor_logs")
          .select("id")
          .eq("ip_address", ipAddress)
          .eq("user_agent", userAgent)
          .gte("created_at", oneHourAgo)
          .limit(1)
          .maybeSingle();

      if (environmentCheckError) {
        console.error(
          "Visitor environment check error:",
          environmentCheckError.message,
        );

        return NextResponse.json(
          { error: "Unable to check visitor environment." },
          { status: 500 },
        );
      }

      if (recentEnvironment) {
        return NextResponse.json({
          ok: true,
          recorded: false,
          reason: "same-ip-browser-within-one-hour",
        });
      }
    }

    const { error: insertError } = await supabase
      .from("visitor_logs")
      .insert({
        visitor_key: visitorKey,
        user_id: userId,
        page,
        user_agent: userAgent,
        browser_language: browserLanguage,
        device_os: deviceOs,
        ip_address: ipAddress,
        referer: referer || null,
        country,
        is_bot: false,
      });

    if (insertError) {
      console.error(
        "Visitor insert error:",
        insertError.message,
      );

      return NextResponse.json(
        { error: "Unable to save visitor." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      recorded: true,
    });
  } catch (error) {
    console.error("Visitor API error:", error);

    return NextResponse.json(
      { error: "Unexpected visitor tracking error." },
      { status: 500 },
    );
  }
}