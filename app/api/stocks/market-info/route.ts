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
  actualEps?: string | number | null;
  priorYearEps?: string | number | null;
  surprise?: string | number | null;
};

type SurpriseRow = {
  fiscalQtrEnd?: string;
  dateReported?: string;
  eps?: string | number | null;
  consensusForecast?: string | number | null;
  percentageSurprise?: string | number | null;
};

const NASDAQ_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
  referer: "https://www.nasdaq.com/",
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

function toDateKey(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // Already YYYY-MM-DD.
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Nasdaq commonly returns MM/DD/YYYY.
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return `${us[3]}-${String(Number(us[1])).padStart(2, "0")}-${String(
      Number(us[2]),
    ).padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).trim().replace(/[$,%\s,]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function sameFiscalQuarterPreviousYear(
  currentFiscalQtrEnd: unknown,
  candidateFiscalQtrEnd: unknown,
) {
  const current = toDateKey(currentFiscalQtrEnd);
  const candidate = toDateKey(candidateFiscalQtrEnd);
  if (!current || !candidate) return false;

  const [cy, cm] = current.split("-").map(Number);
  const [py, pm] = candidate.split("-").map(Number);
  return py === cy - 1 && pm === cm;
}

async function fetchNasdaqEarnings(date: string): Promise<EarningsItem[]> {
  const url = `https://api.nasdaq.com/api/calendar/earnings?date=${encodeURIComponent(
    date,
  )}`;

  const response = await fetch(url, {
    headers: NASDAQ_HEADERS,
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

  // 해당 날짜의 전체 어닝 회사를 읽고 시총 순으로 최대 10개.
  // 8개면 8개, 13개면 시총 상위 10개.
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
          ? `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(
              symbol,
            )}.png`
          : "",
        actualEps: null,
        priorYearEps: null,
        surprise: null,
      };
    })
    .filter((item: EarningsItem) => Boolean(item.symbol))
    .sort((a: EarningsItem, b: EarningsItem) => b.marketCap - a.marketCap)
    .slice(0, 10);
}

async function fetchNasdaqEarningsSurprise(symbol: string): Promise<SurpriseRow[]> {
  const url = `https://api.nasdaq.com/api/company/${encodeURIComponent(
    symbol.toLowerCase(),
  )}/earnings-surprise`;

  const response = await fetch(url, {
    headers: {
      ...NASDAQ_HEADERS,
      referer: `https://www.nasdaq.com/market-activity/stocks/${symbol.toLowerCase()}/earnings`,
    },
    cache: "no-store",
  });

  if (!response.ok) return [];

  const payload = await response.json().catch(() => ({}));
  const rows = payload?.data?.earningsSurpriseTable?.rows;
  return Array.isArray(rows) ? rows : [];
}

async function enrichTodayWithActuals(
  items: EarningsItem[],
  date: string,
): Promise<EarningsItem[]> {
  const today = easternTodayKey();

  // 미래 날짜는 실제 EPS를 조회할 이유가 없습니다.
  if (date !== today || !items.length) return items;

  return Promise.all(
    items.map(async (item) => {
      try {
        const rows = await fetchNasdaqEarningsSurprise(item.symbol);
        if (!rows.length) return item;

        // 오늘 실제 발표된 행을 찾습니다.
        const reported = rows.find(
          (row) => toDateKey(row.dateReported) === date,
        );

        if (!reported) return item;

        const actual = toNumber(reported.eps);
        const consensus = toNumber(reported.consensusForecast);
        const surprise = toNumber(reported.percentageSurprise);

        const priorYear = rows.find((row) =>
          sameFiscalQuarterPreviousYear(
            reported.fiscalQtrEnd,
            row.fiscalQtrEnd,
          ),
        );
        const priorYearEps = priorYear ? toNumber(priorYear.eps) : null;

        return {
          ...item,
          // 발표 후에는 surprise feed의 consensus를 우선 사용.
          estimate:
            consensus != null
              ? consensus
              : item.estimate,
          actualEps:
            actual != null
              ? actual
              : null,
          priorYearEps:
            priorYearEps != null
              ? priorYearEps
              : null,
          surprise:
            surprise != null
              ? `${surprise >= 0 ? "+" : ""}${surprise.toFixed(2)}%`
              : null,
        };
      } catch (error) {
        console.error(
          `Nasdaq earnings surprise failed for ${item.symbol}:`,
          error,
        );
        return item;
      }
    }),
  );
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
        const scheduled = await fetchNasdaqEarnings(date);
        const data = await enrichTodayWithActuals(scheduled, date);

        return {
          date,
          data,
          warning: "",
        };
      } catch (error) {
        return {
          date,
          data: [] as EarningsItem[],
          warning:
            error instanceof Error
              ? error.message
              : "Nasdaq earnings 연결 실패",
        };
      }
    }),
  ]);

  const earnings = earningsResults.flatMap((result) => result.data);
  const earningsWarnings = earningsResults
    .map((result) => result.warning)
    .filter(Boolean);

  const warnings = [eventResult.warning, ...earningsWarnings].filter(Boolean);

  return NextResponse.json(
    {
      symbols,
      events: eventResult.events,
      earnings,
      news: [],
      earningsDates: dates,
      updatedAt: new Date().toISOString(),
      source:
        "Nasdaq Earnings Calendar + Nasdaq Earnings Surprise + KTown PC #2 events",
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
