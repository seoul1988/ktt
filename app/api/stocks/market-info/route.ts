import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type EarningsItem = {
  symbol: string;
  company: string;
  date: string;
  time: string;
  estimate: string | number | null;
  marketCap: number;
  logoUrl: string;
};

function cleanSymbols(value: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ""))
    .filter(Boolean)
    .slice(0, 5);
}

function easternTodayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function nextFiveWeekdays() {
  const [y, m, d] = easternTodayKey().split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const result: string[] = [];

  while (result.length < 5) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      result.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}


function parseMarketCap(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const raw = String(value || "")
    .trim()
    .replace(/[$,\s]/g, "")
    .toUpperCase();

  if (!raw) return 0;

  const match = raw.match(/^(-?\d+(?:\.\d+)?)([KMBT])?$/);
  if (!match) {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const base = Number(match[1]);
  const unit = match[2] || "";
  const mult =
    unit === "T"
      ? 1e12
      : unit === "B"
        ? 1e9
        : unit === "M"
          ? 1e6
          : unit === "K"
            ? 1e3
            : 1;

  return base * mult;
}

function normalizeTime(value: unknown) {
  const text = String(value || "").trim();
  const v = text.toLowerCase();

  if (
    v.includes("pre-market") ||
    v.includes("before") ||
    v.includes("bmo") ||
    v.includes("morning")
  ) {
    return "Before Open";
  }

  if (
    v.includes("after-hours") ||
    v.includes("after") ||
    v.includes("amc") ||
    v.includes("close")
  ) {
    return "After Close";
  }

  return text || "TBD";
}

async function fetchNasdaqEarnings(date: string): Promise<EarningsItem[]> {
  const url = `https://api.nasdaq.com/api/calendar/earnings?date=${encodeURIComponent(date)}`;

  const response = await fetch(url, {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
      referer: "https://www.nasdaq.com/",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Nasdaq earnings HTTP ${response.status}`);
  }

  const payload = await response.json().catch(() => ({}));
  const rows = Array.isArray(payload?.data?.rows)
    ? payload.data.rows
    : Array.isArray(payload?.rows)
      ? payload.rows
      : [];

  // 해당 날짜의 어닝 회사를 모두 읽은 뒤 시가총액을 계산합니다.
  // 이후 시가총액 내림차순으로 정렬하고 최대 10개만 반환합니다.
  // 예: 8개면 8개 전부, 13개면 시총 상위 10개.
  return rows
    .map((row: Record<string, unknown>) => {
      const symbol = String(
        row.symbol || row.ticker || row.Symbol || "",
      )
        .trim()
        .toUpperCase();

      const company = String(
        row.name ||
          row.companyName ||
          row.company ||
          row.Name ||
          symbol,
      ).trim();

      const estimate =
        row.epsForecast ??
        row.consensusEPSForecast ??
        row.estimate ??
        row.epsEstimate ??
        null;

      const rawTime =
        row.time ||
        row.marketTime ||
        row.releaseTime ||
        row.when ||
        row.timeOfDay ||
        "";

      const marketCap = parseMarketCap(
        row.marketCap ??
          row.marketcap ??
          row.market_cap ??
          row.marketCapitalization ??
          0,
      );

      return {
        symbol,
        company,
        date: String(row.reportDate || row.date || date).slice(0, 10),
        time: normalizeTime(rawTime),
        estimate:
          estimate == null || String(estimate).trim() === ""
            ? null
            : String(estimate),
        marketCap,
        logoUrl: symbol
          ? `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(symbol)}.png`
          : "",
      };
    })
    .filter((item: EarningsItem) => Boolean(item.symbol))
    .sort((a: EarningsItem, b: EarningsItem) => b.marketCap - a.marketCap)
    .slice(0, 10);
}

async function fetchMarketEvents() {
  const apiBase = (process.env.KTOWN_STOCK_API_URL || "").replace(/\/+$/, "");
  const serverSecret = process.env.KTOWN_STOCK_SERVER_SECRET || "";

  if (!apiBase || !serverSecret) {
    return {
      events: [] as unknown[],
      warning: "PC #2 market-events 환경변수 미연결",
    };
  }

  try {
    const response = await fetch(`${apiBase}/internal/market-events`, {
      headers: { "x-ktown-secret": serverSecret },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        events: [] as unknown[],
        warning:
          data?.detail ||
          data?.error ||
          `PC #2 market-events HTTP ${response.status}`,
      };
    }

    return {
      events: Array.isArray(data?.events) ? data.events : [],
      warning: String(data?.warning || ""),
    };
  } catch (error) {
    return {
      events: [] as unknown[],
      warning:
        error instanceof Error
          ? `PC #2 market-events: ${error.message}`
          : "PC #2 market-events 연결 실패",
    };
  }
}

export async function GET(request: NextRequest) {
  const symbols = cleanSymbols(request.nextUrl.searchParams.get("symbols"));
  const dates = nextFiveWeekdays();

  const [eventResult, ...earningsResults] = await Promise.all([
    fetchMarketEvents(),
    ...dates.map(async (date) => {
      try {
        return {
          date,
          data: await fetchNasdaqEarnings(date),
          warning: "",
        };
      } catch (error) {
        return {
          date,
          data: [] as EarningsItem[],
          warning:
            error instanceof Error ? error.message : "Nasdaq earnings 연결 실패",
        };
      }
    }),
  ]);

  const earnings = earningsResults.flatMap((result) => result.data);
  const earningsWarnings = earningsResults
    .map((result) => result.warning)
    .filter(Boolean);

  const warnings = [eventResult.warning, ...earningsWarnings].filter(Boolean);

  // IMPORTANT:
  // Earnings are independent of PC #2.  Therefore a missing PC #2 environment
  // variable must NOT make the entire Market Dashboard return HTTP 503.
  return NextResponse.json(
    {
      symbols,
      events: eventResult.events,
      earnings,
      news: [],
      earningsDates: dates,
      updatedAt: new Date().toISOString(),
      source: "Nasdaq Earnings Calendar + KTown PC #2 events",
      warning: warnings.join(" · "),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
