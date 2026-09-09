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
  actualSource?: string | null;
};

type SurpriseRow = {
  fiscalQtrEnd?: string;
  dateReported?: string;
  eps?: string | number | null;
  consensusForecast?: string | number | null;
  percentageSurprise?: string | number | null;
};

type MarketEvent = {
  id: string;
  time: string;
  dateTime?: string;
  title: string;
  name?: string;
  importance: "high" | "medium" | "low";
  importanceNumber: number;
  risk?: string;
  source?: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  url?: string;
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


function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&minus;/gi, "-")
    .replace(/&#x2212;/gi, "-")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoneyNumber(value: string): number | null {
  const cleaned = decodeHtml(value)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.+-]/g, "")
    .trim();

  if (!cleaned || cleaned === "-" || cleaned === "+") return null;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

type BenzingaResult = {
  symbol: string;
  estimate: number | null;
  actual: number | null;
  surprisePct: number | null;
};

async function fetchBenzingaTodayResults(): Promise<
  Map<string, BenzingaResult>
> {
  const result = new Map<string, BenzingaResult>();

  try {
    const response = await fetch("https://www.benzinga.com/earnings", {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Benzinga earnings HTTP ${response.status}`);
      return result;
    }

    const html = await response.text();
    const rowMatches =
      html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];

    for (const rowHtml of rowMatches) {
      const cells = [
        ...rowHtml.matchAll(
          /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi,
        ),
      ]
        .map((match) => decodeHtml(match[1]))
        .filter(Boolean);

      if (cells.length < 7) continue;

      const symbol = String(cells[0] || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9.\-]/g, "");

      if (!symbol || symbol.length > 12) continue;

      const estimate = parseMoneyNumber(cells[4] || "");
      const actual = parseMoneyNumber(cells[5] || "");
      const surprisePct = parseMoneyNumber(cells[6] || "");

      if (actual == null) continue;

      result.set(symbol, {
        symbol,
        estimate,
        actual,
        surprisePct,
      });
    }
  } catch (error) {
    console.error("Benzinga earnings fallback failed:", error);
  }

  return result;
}


function longEnglishDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dt);
}

type BenzingaSymbolResult = {
  estimate: number | null;
  actual: number | null;
  surprisePct: number | null;
};

async function fetchBenzingaSymbolResult(
  symbol: string,
  date: string,
): Promise<BenzingaSymbolResult | null> {
  try {
    const url = `https://www.benzinga.com/quote/${encodeURIComponent(
      symbol,
    )}/earnings-forecasts`;

    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        `Benzinga symbol earnings HTTP ${response.status} for ${symbol}`,
      );
      return null;
    }

    const html = await response.text();

    // Make the server-rendered page searchable as plain text.
    const plain = decodeHtml(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " "),
    );

    const targetDate = longEnglishDate(date); // ex: Sep 8, 2026
    const dateIndex = plain.indexOf(targetDate);

    if (dateIndex < 0) {
      console.error(
        `Benzinga ${symbol}: report date ${targetDate} not found`,
      );
      return null;
    }

    // The first dated EPS row on Benzinga is:
    // Q1 | Sep 8, 2026 | $7.37 | $6.77 | 8.86 %
    // Read only a short region after the exact report date so revenue values
    // farther down the page cannot be mistaken for EPS.
    const segment = plain.slice(
      dateIndex + targetDate.length,
      dateIndex + targetDate.length + 240,
    );

    const moneyMatches = [
      ...segment.matchAll(/\$?\s*(-?\d+(?:\.\d+)?)/g),
    ].map((m) => Number(m[1]));

    // Need at least Actual EPS and Estimated EPS.
    if (moneyMatches.length < 2) {
      console.error(
        `Benzinga ${symbol}: EPS numbers not found after ${targetDate}`,
      );
      return null;
    }

    const actual = Number.isFinite(moneyMatches[0])
      ? moneyMatches[0]
      : null;
    const estimate = Number.isFinite(moneyMatches[1])
      ? moneyMatches[1]
      : null;

    // Find the first percentage after the two EPS values.
    const pctMatch = segment.match(/(-?\d+(?:\.\d+)?)\s*%/);
    const surprisePct = pctMatch ? Number(pctMatch[1]) : null;

    if (actual == null) return null;

    return {
      estimate,
      actual,
      surprisePct:
        surprisePct != null && Number.isFinite(surprisePct)
          ? surprisePct
          : estimate != null && estimate !== 0
            ? ((actual - estimate) / Math.abs(estimate)) * 100
            : null,
    };
  } catch (error) {
    console.error(
      `Benzinga symbol earnings failed for ${symbol}:`,
      error,
    );
    return null;
  }
}

async function enrichTodayWithActuals(
  items: EarningsItem[],
  date: string,
): Promise<EarningsItem[]> {
  const today = easternTodayKey();

  // Only today's schedule can have same-day actuals.
  if (date !== today || !items.length) return items;

  // First fetch the Benzinga daily earnings table once.  The previous route
  // already had this parser but did not use it, so actual EPS could remain null
  // even after the company had reported.
  const benzingaToday = await fetchBenzingaTodayResults();

  return Promise.all(
    items.map(async (item) => {
      // 1) Fast same-day result table.
      const daily = benzingaToday.get(item.symbol.toUpperCase());

      if (daily?.actual != null) {
        return {
          ...item,
          estimate:
            daily.estimate != null
              ? daily.estimate
              : item.estimate,
          actualEps: daily.actual,
          surprise:
            daily.surprisePct != null
              ? `${daily.surprisePct >= 0 ? "+" : ""}${daily.surprisePct.toFixed(2)}%`
              : daily.estimate != null && daily.estimate !== 0
                ? `${(((daily.actual - daily.estimate) / Math.abs(daily.estimate)) * 100) >= 0 ? "+" : ""}${(((daily.actual - daily.estimate) / Math.abs(daily.estimate)) * 100).toFixed(2)}%`
                : null,
          actualSource: "Benzinga earnings calendar",
        };
      }

      // 2) Company-specific Benzinga page, exact same-day report.
      const bz = await fetchBenzingaSymbolResult(item.symbol, date);

      if (bz?.actual != null) {
        return {
          ...item,
          estimate:
            bz.estimate != null
              ? bz.estimate
              : item.estimate,
          actualEps: bz.actual,
          surprise:
            bz.surprisePct != null
              ? `${bz.surprisePct >= 0 ? "+" : ""}${bz.surprisePct.toFixed(2)}%`
              : null,
          actualSource: "Benzinga company earnings",
        };
      }

      // 3) Nasdaq earnings-surprise fallback.
      try {
        const rows = await fetchNasdaqEarningsSurprise(item.symbol);
        if (!rows.length) return item;

        let reported = rows.find(
          (row) => toDateKey(row.dateReported) === date,
        );

        // Some Nasdaq responses can lag by a date boundary.  Permit only the
        // closest row within one day, and only when it actually has an EPS value.
        if (!reported) {
          const candidate = rows.find((row) => {
            const key = toDateKey(row.dateReported);
            if (!key || toNumber(row.eps) == null) return false;

            const rowDate = new Date(`${key}T12:00:00Z`);
            const targetDate = new Date(`${date}T12:00:00Z`);
            const diffDays = Math.abs(
              (rowDate.getTime() - targetDate.getTime()) / 86_400_000,
            );
            return diffDays <= 1;
          });

          if (candidate) reported = candidate;
        }

        if (!reported) return item;

        const actual = toNumber(reported.eps);
        if (actual == null) return item;

        const consensus = toNumber(reported.consensusForecast);
        const surprise = toNumber(reported.percentageSurprise);

        const priorYear = rows.find((row) =>
          sameFiscalQuarterPreviousYear(
            reported?.fiscalQtrEnd,
            row.fiscalQtrEnd,
          ),
        );

        const priorYearEps = priorYear
          ? toNumber(priorYear.eps)
          : null;

        return {
          ...item,
          estimate:
            consensus != null
              ? consensus
              : item.estimate,
          actualEps: actual,
          priorYearEps:
            priorYearEps != null
              ? priorYearEps
              : null,
          surprise:
            surprise != null
              ? `${surprise >= 0 ? "+" : ""}${surprise.toFixed(2)}%`
              : consensus != null && consensus !== 0
                ? `${(((actual - consensus) / Math.abs(consensus)) * 100) >= 0 ? "+" : ""}${(((actual - consensus) / Math.abs(consensus)) * 100).toFixed(2)}%`
                : null,
          actualSource: "Nasdaq earnings surprise",
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


function normalizeMarketEvent(
  event: Record<string, unknown>,
  index: number,
): MarketEvent {
  const rawImportance =
    event.importanceNumber ??
    event.importance ??
    event.risk ??
    1;

  const importanceText = String(rawImportance).toLowerCase();

  let importanceNumber = Number(event.importanceNumber);

  if (!Number.isFinite(importanceNumber) || importanceNumber <= 0) {
    if (
      importanceText === "3" ||
      importanceText.includes("high") ||
      importanceText.includes("critical")
    ) {
      importanceNumber = 3;
    } else if (
      importanceText === "2" ||
      importanceText.includes("medium") ||
      importanceText.includes("watch")
    ) {
      importanceNumber = 2;
    } else {
      importanceNumber = 1;
    }
  }

  const importance: MarketEvent["importance"] =
    importanceNumber >= 3
      ? "high"
      : importanceNumber === 2
        ? "medium"
        : "low";

  const title = String(event.title || event.name || "-").trim();
  const source = String(event.source || "").trim();
  const url = String(event.url || "").trim();

  return {
    id: String(event.id || `market-event-${index}`),
    time: String(event.time || "TBD"),
    dateTime:
      event.dateTime != null && String(event.dateTime).trim()
        ? String(event.dateTime)
        : undefined,
    title,
    name:
      event.name != null && String(event.name).trim()
        ? String(event.name)
        : title,
    importance,
    importanceNumber,
    risk:
      event.risk != null && String(event.risk).trim()
        ? String(event.risk)
        : undefined,
    source: source || undefined,
    actual:
      event.actual != null
        ? String(event.actual)
        : "",
    forecast:
      event.forecast != null
        ? String(event.forecast)
        : "",
    previous:
      event.previous != null
        ? String(event.previous)
        : "",
    url: url || undefined,
  };
}

async function fetchMarketEvents(): Promise<{
  events: MarketEvent[];
  warning: string;
  updatedAt?: string;
  source?: string;
  bridge?: boolean;
  bridgeFile?: string;
  engineFile?: string;
  pc2EventCount?: number;
}> {
  const apiBase = (process.env.KTOWN_STOCK_API_URL || "").replace(/\/+$/, "");
  const serverSecret = process.env.KTOWN_STOCK_SERVER_SECRET || "";

  if (!apiBase || !serverSecret) {
    return {
      events: [],
      warning: "PC #2 market-events 환경변수 미연결",
      pc2EventCount: 0,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`${apiBase}/internal/market-events`, {
      method: "GET",
      headers: {
        "x-ktown-secret": serverSecret,
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const rawText = await response.text();

    let data: Record<string, any> = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      return {
        events: [],
        warning: `PC #2 market-events JSON 파싱 실패 · HTTP ${response.status}`,
        pc2EventCount: 0,
      };
    }

    if (!response.ok) {
      return {
        events: [],
        warning:
          String(data?.detail || data?.error || "") ||
          `PC #2 market-events HTTP ${response.status}`,
        updatedAt: data?.updatedAt ? String(data.updatedAt) : undefined,
        source: data?.source ? String(data.source) : undefined,
        bridge: Boolean(data?.bridge),
        bridgeFile: data?.bridgeFile ? String(data.bridgeFile) : undefined,
        engineFile: data?.engineFile ? String(data.engineFile) : undefined,
        pc2EventCount: Array.isArray(data?.events) ? data.events.length : 0,
      };
    }

    const rawEvents = Array.isArray(data?.events) ? data.events : [];

    // IMPORTANT:
    // PC #2 writes ktown_market_events.json and FastAPI returns that JSON.
    // Do not filter by importance and do not reorder here.
    // The website should mirror exactly what PC #2 saved.
    const events: MarketEvent[] = rawEvents.map(
      (event: Record<string, unknown>, index: number) =>
        normalizeMarketEvent(event, index),
    );

    const bridgeFile = data?.bridgeFile ? String(data.bridgeFile) : "";
    const bridge = Boolean(data?.bridge);
    const baseWarning = String(data?.warning || "");

    const warning =
      rawEvents.length === 0
        ? [
            baseWarning,
            bridge ? "PC #2 JSON 브리지 응답은 왔지만 events가 0개입니다." : "PC #2 JSON 브리지 응답이 아닙니다.",
            bridgeFile ? `bridgeFile=${bridgeFile}` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : baseWarning;

    return {
      events,
      warning,
      updatedAt: data?.updatedAt ? String(data.updatedAt) : undefined,
      source: data?.source ? String(data.source) : undefined,
      bridge,
      bridgeFile: bridgeFile || undefined,
      engineFile: data?.engineFile ? String(data.engineFile) : undefined,
      pc2EventCount: rawEvents.length,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "PC #2 market-events 요청 시간 초과"
          : `PC #2 market-events: ${error.message}`
        : "PC #2 market-events 연결 실패";

    return {
      events: [],
      warning: message,
      pc2EventCount: 0,
    };
  } finally {
    clearTimeout(timeout);
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
      updatedAt: eventResult.updatedAt || new Date().toISOString(),
      source:
        eventResult.source ||
        "Nasdaq Earnings Calendar + Benzinga Company Results + Nasdaq Earnings Surprise + KTown PC #2 events",
      warning: warnings.join(" · "),
      marketEventsBridge: eventResult.bridge ?? false,
      marketEventsBridgeFile: eventResult.bridgeFile || "",
      marketEventsEngineFile: eventResult.engineFile || "",
      marketEventsPc2Count: eventResult.pc2EventCount ?? eventResult.events.length,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
