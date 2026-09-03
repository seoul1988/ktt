import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const apiBase = (process.env.KTOWN_STOCK_API_URL || "").replace(/\/+$/, "");
  const serverSecret = process.env.KTOWN_STOCK_SERVER_SECRET || "";

  if (!apiBase || !serverSecret) {
    return NextResponse.json(
      {
        events: [],
        earnings: [],
        news: [],
        error: "KTown stock 분석 서버 환경변수가 연결되지 않았습니다.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${apiBase}/internal/market-events`, {
      headers: { "x-ktown-secret": serverSecret },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          events: [],
          earnings: [],
          news: [],
          error: data?.detail || data?.error || `분석 서버 HTTP ${response.status}`,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      events: Array.isArray(data?.events) ? data.events : [],
      earnings: [],
      news: [],
      updatedAt: new Date().toISOString(),
      source: data?.source || "official government calendars",
      warning: data?.warning || "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        events: [],
        earnings: [],
        news: [],
        error: error instanceof Error ? error.message : "시장 일정 연결 실패",
      },
      { status: 502 },
    );
  }
}
