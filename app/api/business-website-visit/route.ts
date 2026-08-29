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

/*
 * 검색엔진, SNS 링크 미리보기, SEO 도구, 모니터링 및
 * 일반적인 자동화 프로그램의 방문은 통계에 포함하지 않습니다.
 * 브라우저에서 전달되는 User-Agent를 서버에서 검사하므로
 * 클라이언트가 bot 여부를 임의로 바꿀 수 없습니다.
 */
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

  /* User-Agent가 전혀 없는 요청은 정상 브라우저 방문으로 보지 않습니다. */
  if (!userAgent) return true;

  /* 브라우저나 서비스의 페이지 사전 불러오기도 실제 방문에서 제외합니다. */
  if (purpose.includes("prefetch") || purpose.includes("preview")) return true;

  return BOT_USER_AGENT_PATTERN.test(userAgent);
}

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
    if (isAutomatedRequest(request)) {
      return new NextResponse(null, { status: 204 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const businessId = Number(body.businessId);
    const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
    const requestedSource = typeof body.source === "string" ? body.source : "other";
    const source = ALLOWED_SOURCES.has(requestedSource) ? requestedSource : "other";
    const sourceDetail =
      typeof body.sourceDetail === "string"
        ? body.sourceDetail.trim().toLowerCase().slice(0, 200)
        : null;
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
        referrer_domain: sourceDetail || null,
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
