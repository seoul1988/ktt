import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ALLOWED_SERVICES = new Set(["menu", "pickup", "delivery"]);

const BOT_USER_AGENT_PATTERN =
  /bot\b|crawler|spider|slurp|archiver|facebookexternalhit|facebot|twitterbot|linkedinbot|pinterestbot|whatsapp|telegrambot|discordbot|slackbot|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|cohere-ai|headlesschrome|phantomjs|selenium|playwright|puppeteer|lighthouse|pagespeed|pingdom|uptimerobot|statuscake|newrelicpinger|curl\/|wget\/|python-requests|python\/|aiohttp|axios\/|postmanruntime/i;

function isAutomatedRequest(request: NextRequest) {
  const userAgent = request.headers.get("user-agent")?.trim() || "";
  const purpose = [
    request.headers.get("purpose"),
    request.headers.get("sec-purpose"),
    request.headers.get("x-purpose"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    !userAgent ||
    purpose.includes("prefetch") ||
    purpose.includes("preview") ||
    BOT_USER_AGENT_PATTERN.test(userAgent)
  );
}

function easternDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  try {
    if (isAutomatedRequest(request)) {
      return new NextResponse(null, { status: 204 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const businessId = Number(body.businessId);
    const menuItemId = Number(body.menuItemId);
    const categoryId = Number(body.categoryId);
    const visitorId = cleanText(body.visitorId, 200);
    const menuItemName = cleanText(body.menuItemName, 200);
    const categoryName = cleanText(body.categoryName, 200);
    const requestedService = cleanText(body.service, 20);
    const service = ALLOWED_SERVICES.has(requestedService)
      ? requestedService
      : "menu";

    if (
      !Number.isInteger(businessId) ||
      businessId <= 0 ||
      !Number.isInteger(menuItemId) ||
      menuItemId <= 0 ||
      visitorId.length < 10 ||
      !menuItemName
    ) {
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

    const { error } = await supabase.rpc("record_business_menu_click", {
      p_business_id: businessId,
      p_click_date: easternDate(),
      p_visitor_hash: visitorHash,
      p_menu_item_id: menuItemId,
      p_menu_item_name: menuItemName,
      p_category_id:
        Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
      p_category_name: categoryName || null,
      p_service: service,
    });

    if (error) {
      console.error("메뉴 클릭 기록 실패", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
