import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function cleanSymbols(value: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ""))
    .filter(Boolean)
    .slice(0, 5);
}

export async function GET(request: NextRequest) {
  const symbols = cleanSymbols(request.nextUrl.searchParams.get("symbols"));

  /*
    IMPORTANT:
    This route intentionally does NOT invent events, earnings, or news.

    Next step:
    Connect this route to the market/news provider or to PC #2 and return:
      {
        events: [{ time, title, importance, symbol }],
        earnings: [{ symbol, company, date, time, estimate }],
        news: [{ id, symbol, title, source, publishedAt, url }],
        updatedAt: "..."
      }

    Until then, the web page renders "연결 대기" placeholders while
    LIVE DATA continues to come from the existing Schwab WebSocket.
  */

  return NextResponse.json(
    {
      symbols,
      events: [],
      earnings: [],
      news: [],
      updatedAt: null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
