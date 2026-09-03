import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function cleanSymbols(raw: string | null) {
  if (!raw) return [];

  const out: string[] = [];

  for (const value of raw.split(",")) {
    const symbol = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9.\-]/g, "")
      .slice(0, 12);

    if (symbol && !out.includes(symbol)) out.push(symbol);
    if (out.length >= 5) break;
  }

  return out;
}

async function getQuote(symbol: string) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1m&range=1d&includePrePost=true`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0 KTownTriangle/1.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Quote HTTP ${response.status}`);
  }

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta || {};

  const price = Number(
    meta.regularMarketPrice ??
    meta.postMarketPrice ??
    meta.preMarketPrice
  );

  const previousClose = Number(
    meta.previousClose ??
    meta.chartPreviousClose
  );

  const validPrice = Number.isFinite(price) ? price : null;
  const validPrev = Number.isFinite(previousClose) ? previousClose : null;

  const change =
    validPrice != null && validPrev != null
      ? validPrice - validPrev
      : null;

  const changePct =
    change != null && validPrev
      ? (change / validPrev) * 100
      : null;

  return {
    symbol,
    price: validPrice,
    previous_close: validPrev,
    change,
    change_pct: changePct,
    market_state: meta.marketState || null,
    currency: meta.currency || "USD",
    exchange: meta.exchangeName || null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = cleanSymbols(searchParams.get("symbols"));

  if (!symbols.length) {
    return NextResponse.json({ quotes: [] });
  }

  const results = await Promise.allSettled(symbols.map(getQuote));

  const quotes = results
    .filter((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof getQuote>>> =>
      item.status === "fulfilled"
    )
    .map((item) => item.value);

  return NextResponse.json({
    quotes,
    updatedAt: new Date().toISOString(),
    source: "basic-fallback",
  });
}
