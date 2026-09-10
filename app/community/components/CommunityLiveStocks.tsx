

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type SeedCandle = {
  minute?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  live?: boolean;
};

type LiveCandle = SeedCandle & {
  minute: number;
};

type Snapshot = {
  symbol: string;
  ts?: number;
  price?: number;
  bid?: number;
  ask?: number;
  action?: string;
  forecast?: string;
  score?: number;
  down_risk?: number;
  buy60?: number;
  sell60?: number;
  vol_ratio?: number;
  vwap?: number;
  ema9?: number;
  ema20?: number;
  local_support?: number;
  support?: number;
  candles_1m?: SeedCandle[];
};

type MarketNews = {
  id: number | string;
  title: string;
  url?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  importance?: number | null;
};

const SYMBOLS = ["NVDA", "TSLA", "AAPL"] as const;
type SymbolName = (typeof SYMBOLS)[number];

function fmt(value: unknown, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toFixed(digits) : "-";
}

function compactFlow(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function buyShare(item?: Snapshot) {
  if (!item) return null;
  const buy = Number(item.buy60 || 0);
  const sell = Number(item.sell60 || 0);
  const total = buy + sell;
  return total > 0 ? (buy / total) * 100 : null;
}

function candleColor(candle: LiveCandle | undefined) {
  if (!candle) return "bg-slate-300";
  return candle.close >= candle.open ? "bg-[#16A34A]" : "bg-[#DC2626]";
}

function wickColor(candle: LiveCandle | undefined) {
  if (!candle) return "bg-slate-300";
  return candle.close >= candle.open ? "bg-[#16A34A]" : "bg-[#DC2626]";
}

function actionText(item?: Snapshot) {
  const raw = String(item?.action || item?.forecast || "WAIT").toUpperCase();
  if (raw.includes("SELL") || raw.includes("DOWN") || Number(item?.down_risk) >= 65) {
    return { text: "DOWN RISK", cls: "bg-red-50 text-red-600" };
  }
  if (raw.includes("BUY")) {
    return { text: "BUY WATCH", cls: "bg-emerald-50 text-emerald-700" };
  }
  return { text: "WAIT", cls: "bg-amber-50 text-amber-700" };
}

function mergeLiveCandle(
  previous: LiveCandle[] | undefined,
  item: Snapshot,
): LiveCandle[] {
  const price = Number(item.price);
  const tsMs = Number(item.ts || Date.now() / 1000) * 1000;
  const minute = Math.floor(tsMs / 60000);

  // PC #2 is the source of truth for the mini 1-minute chart.
  // This makes browser reloads and WebSocket reconnects immediately restore
  // the last 3 candles instead of starting the chart over.
  if (Array.isArray(item.candles_1m) && item.candles_1m.length) {
    const serverCandles = item.candles_1m
      .slice(-3)
      .map((c, index, arr) => ({
        minute:
          Number.isFinite(Number(c.minute))
            ? Number(c.minute)
            : minute - (arr.length - 1 - index),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }))
      .filter(
        (c) =>
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close),
      );

    if (serverCandles.length) return serverCandles;
  }

  // Fallback only if an older server does not send candles_1m.
  if (!Number.isFinite(price) || price <= 0) return previous || [];

  let next = [...(previous || [])];
  const current = next[next.length - 1];

  if (!current || current.minute < minute) {
    next.push({
      minute,
      open: price,
      high: price,
      low: price,
      close: price,
    });
  } else if (current.minute === minute) {
    next[next.length - 1] = {
      ...current,
      high: Math.max(current.high, price),
      low: Math.min(current.low, price),
      close: price,
    };
  }

  return next.slice(-3);
}

function MiniCandle({
  candle,
  live,
}: {
  candle?: LiveCandle;
  live?: boolean;
}) {
  if (!candle) {
    return (
      <div className="relative flex h-11 w-5 items-center justify-center">
        <span className="h-4 w-2 rounded-[1px] bg-slate-200" />
      </div>
    );
  }

  const range = Math.max(candle.high - candle.low, 0.0001);
  const bodyTop = Math.max(candle.open, candle.close);
  const bodyBottom = Math.min(candle.open, candle.close);
  const body = Math.max(bodyTop - bodyBottom, range * 0.14);

  const wickHeight = Math.max(16, Math.min(38, 20 + range * 180));
  const bodyHeight = Math.max(5, Math.min(22, (body / range) * wickHeight));
  const highToBody = Math.max(0, candle.high - bodyTop);
  const topOffset = Math.max(0, Math.min(wickHeight - bodyHeight, (highToBody / range) * wickHeight));

  return (
    <div className="relative flex h-11 w-5 justify-center">
      <span
        className={`absolute top-1 w-px ${wickColor(candle)}`}
        style={{ height: `${wickHeight}px` }}
      />
      <span
        className={`absolute w-3 rounded-[1px] ${candleColor(candle)}`}
        style={{ height: `${bodyHeight}px`, top: `${4 + topOffset}px` }}
      />
      {live ? (
        <span className="absolute -bottom-1 text-[6px] font-black leading-none text-[#DC2626]">
          LIVE
        </span>
      ) : null}
    </div>
  );
}


type MarketState = {
  code: "OPEN" | "CLOSED" | "WEEKEND" | "HOLIDAY";
  label: string;
  detail: string;
};

function easternParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month, 0));
  return last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7);
}

function observedFixedHoliday(year: number, month: number, day: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
  if (dow === 0) d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function marketHolidayName(year: number, month: number, day: number): string | null {
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const holidays = new Map<string, string>();

  holidays.set(observedFixedHoliday(year, 1, 1), "New Year's Day");
  holidays.set(`${year}-01-${String(nthWeekdayOfMonth(year, 1, 1, 3)).padStart(2, "0")}`, "Martin Luther King Jr. Day");
  holidays.set(`${year}-02-${String(nthWeekdayOfMonth(year, 2, 1, 3)).padStart(2, "0")}`, "Presidents Day");

  const goodFriday = easterSunday(year);
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  holidays.set(`${goodFriday.getUTCFullYear()}-${String(goodFriday.getUTCMonth() + 1).padStart(2, "0")}-${String(goodFriday.getUTCDate()).padStart(2, "0")}`, "Good Friday");

  holidays.set(`${year}-05-${String(lastWeekdayOfMonth(year, 5, 1)).padStart(2, "0")}`, "Memorial Day");
  holidays.set(observedFixedHoliday(year, 6, 19), "Juneteenth");
  holidays.set(observedFixedHoliday(year, 7, 4), "Independence Day");
  holidays.set(`${year}-09-${String(nthWeekdayOfMonth(year, 9, 1, 1)).padStart(2, "0")}`, "Labor Day");
  holidays.set(`${year}-11-${String(nthWeekdayOfMonth(year, 11, 4, 4)).padStart(2, "0")}`, "Thanksgiving Day");
  holidays.set(observedFixedHoliday(year, 12, 25), "Christmas Day");

  // New Year's Day can be observed on Dec 31 of the previous year.
  holidays.set(observedFixedHoliday(year + 1, 1, 1), "New Year's Day");

  return holidays.get(key) || null;
}

function getMarketState(now = new Date()): MarketState {
  const et = easternParts(now);

  if (et.weekday === "Sat" || et.weekday === "Sun") {
    return { code: "WEEKEND", label: "주말 휴장", detail: "U.S. market closed" };
  }

  const holiday = marketHolidayName(et.year, et.month, et.day);
  if (holiday) {
    return { code: "HOLIDAY", label: "휴일", detail: holiday };
  }

  const minutes = et.hour * 60 + et.minute;
  const open = 9 * 60 + 30;
  const close = 16 * 60;

  if (minutes >= open && minutes < close) {
    return { code: "OPEN", label: "LIVE", detail: "Regular market open" };
  }

  return {
    code: "CLOSED",
    label: et.hour >= 16 ? "장 마감" : "장 시작 전",
    detail: et.hour >= 16 ? "Regular market closed at 4:00 PM ET" : "Opens at 9:30 AM ET",
  };
}

export default function CommunityLiveStocks() {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [candles, setCandles] = useState<Record<string, LiveCandle[]>>({});
  const [status, setStatus] = useState("CONNECTING");
  const [marketState, setMarketState] = useState<MarketState>(() => getMarketState());
  const [latestNews, setLatestNews] = useState<MarketNews[]>([]);

  const loadLatestNews = useCallback(async () => {
    const { data, error } = await supabase
      .from("stock_news")
      .select("id,title,url,published_at,created_at,importance")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(4);

    if (error) {
      console.error("stock_news load error:", error);
      return;
    }

    setLatestNews((data || []) as MarketNews[]);
  }, []);

  const connectWebSocket = useCallback((url: string) => {
    if (!url) return;

    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus("LIVE");

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const list: Snapshot[] = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : payload?.symbol
              ? [payload]
              : [];

        const wanted = list.filter((item) =>
          SYMBOLS.includes(String(item?.symbol || "").toUpperCase() as SymbolName),
        );

        setSnapshots((prev) => {
          const next = { ...prev };
          wanted.forEach((item) => {
            const symbol = String(item.symbol).toUpperCase();
            next[symbol] = item;
          });
          return next;
        });

        setCandles((prev) => {
          const next = { ...prev };
          wanted.forEach((item) => {
            const symbol = String(item.symbol).toUpperCase();
            next[symbol] = mergeLiveCandle(next[symbol], item);
          });
          return next;
        });
      } catch {}
    };

    ws.onerror = () => setStatus("RECONNECT");
    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        const state = getMarketState();
        setMarketState(state);
        if (state.code === "OPEN") {
          setStatus("RECONNECT");
          retryRef.current = setTimeout(() => void start(), 3000);
        } else {
          setStatus(state.label);
        }
      }
    };
  }, []);

  const start = useCallback(async () => {
    const state = getMarketState();
    setMarketState(state);

    // Community live feed is only needed during the regular U.S. market session.
    if (state.code !== "OPEN") {
      setStatus(state.label);
      return;
    }

    setStatus("CONNECTING");

    // Public homepage feed: no Supabase login required.
    // Vercel Environment Variable:
    // NEXT_PUBLIC_STOCK_PUBLIC_WS_URL=wss://YOUR-CLOUDFLARE-DOMAIN/ws/public
    const rawUrl =
      process.env.NEXT_PUBLIC_STOCK_PUBLIC_WS_URL?.trim() ||
      process.env.NEXT_PUBLIC_STOCK_WS_URL?.trim() ||
      "wss://stock.7pocker.us/ws/public";

    if (!rawUrl) {
      setStatus("NO URL");
      return;
    }

    let wsUrl = rawUrl;
    try {
      const parsed = new URL(rawUrl);
      if (!parsed.pathname || parsed.pathname === "/") {
        parsed.pathname = "/ws/public";
        wsUrl = parsed.toString();
      }
    } catch {}

    connectWebSocket(wsUrl);
  }, [connectWebSocket]);

  useEffect(() => {
    void start();
    void loadLatestNews();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        try { ws.close(1000, "Community stock component unmounted"); } catch {}
      }
    };
  }, [loadLatestNews, start]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = getMarketState();
      setMarketState(next);

      if (next.code !== "OPEN") {
        if (retryRef.current) {
          clearTimeout(retryRef.current);
          retryRef.current = null;
        }
        if (wsRef.current) {
          const ws = wsRef.current;
          wsRef.current = null;
          try { ws.close(1000, "Market closed"); } catch {}
        }
        setStatus(next.label);
      } else if (!wsRef.current) {
        void start();
      }
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [start]);

  useEffect(() => {
    if (marketState.code === "OPEN") return;

    void loadLatestNews();
    const timer = window.setInterval(() => {
      void loadLatestNews();
    }, 10 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [loadLatestNews, marketState.code]);

  return (
    <div
      className="mb-5 block overflow-hidden rounded-[22px] border border-[#D9E2F1] bg-white px-3 py-3 shadow-sm"
      aria-label="주식 정보"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="text-[14px] font-black tracking-[-0.02em] text-[#172033]">
            📈 Live Stock Watch
          </h2>
          <p className="mt-0.5 text-[8px] font-semibold text-[#6B6257]">
            {marketState.code === "OPEN"
              ? "최근 1분봉 3개 · 마지막 봉 실시간"
              : marketState.detail}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {marketState.code !== "OPEN" ? (
            <Link
              href="/stock"
              className="text-[9px] font-black text-[#2563EB] hover:underline"
            >
              더보기 →
            </Link>
          ) : null}

          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black ${
              marketState.code === "OPEN" && status === "LIVE"
                ? "bg-emerald-50 text-emerald-700"
                : marketState.code === "HOLIDAY"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            ● {marketState.code === "OPEN" ? status : marketState.label}
          </span>
        </div>
      </div>

      {marketState.code === "OPEN" ? (
        <Link
          href="/stock"
          className="mt-3 block transition active:scale-[0.995]"
          aria-label="실시간 주식 정보 상세보기"
        >
          <div className="grid grid-cols-3 divide-x divide-[#E5E7EB]">
            {SYMBOLS.map((symbol) => {
              const item = snapshots[symbol];
              const stockCandles = candles[symbol] || [];
              const lastThree = [
                stockCandles[stockCandles.length - 3],
                stockCandles[stockCandles.length - 2],
                stockCandles[stockCandles.length - 1],
              ];
              const share = buyShare(item);
              const action = actionText(item);

              return (
                <div key={symbol} className="min-w-0 px-2 text-center">
                  <div className="flex h-12 items-center justify-center gap-1.5">
                    {lastThree.map((candle, index) => (
                      <MiniCandle
                        key={`${symbol}-${index}`}
                        candle={candle}
                        live={index === 2 && Boolean(candle)}
                      />
                    ))}
                  </div>

                  <p className="mt-1 text-[10px] font-black text-[#172033]">
                    {symbol}
                  </p>
                  <p className="mt-0.5 text-[16px] font-black leading-none text-[#172033]">
                    ${fmt(item?.price)}
                  </p>

                  <div className={`mx-auto mt-2 w-fit rounded-full px-2 py-0.5 text-[7px] font-black ${action.cls}`}>
                    {action.text}
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1 border-t border-[#EEF0F3] pt-2">
                    <div>
                      <p className="text-[6px] font-bold text-[#6B6257]">Buy60</p>
                      <p className="mt-0.5 text-[9px] font-black text-[#16A34A]">
                        {share == null ? "-" : `${share.toFixed(0)}%`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[6px] font-bold text-[#6B6257]">Risk</p>
                      <p
                        className={`mt-0.5 text-[9px] font-black ${
                          Number(item?.down_risk) >= 65
                            ? "text-[#DC2626]"
                            : Number(item?.down_risk) >= 45
                              ? "text-[#F59E0B]"
                              : "text-[#16A34A]"
                        }`}
                      >
                        {Number.isFinite(Number(item?.down_risk))
                          ? `${Math.round(Number(item?.down_risk))}%`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[6px] font-bold text-[#6B6257]">Vol</p>
                      <p className="mt-0.5 text-[9px] font-black text-[#2563EB]">
                        {Number.isFinite(Number(item?.vol_ratio))
                          ? `${Number(item?.vol_ratio).toFixed(1)}x`
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 border-t border-[#EEF0F3] pt-2 text-[8px] font-bold text-[#7C746A]">
            <span>Schwab live data</span>
            <span>·</span>
            <span className="font-black text-[#C4483A]">상세보기 →</span>
          </div>
        </Link>
      ) : (
        <div className="mt-3 border-t border-[#EEF0F3] pt-2">
          {latestNews.length ? (
            <div className="divide-y divide-[#EEF0F3]">
              {latestNews.slice(0, 4).map((news) => {
                const newsTime = news.published_at || news.created_at;
                return (
                  <a
                    key={news.id}
                    href={news.url || "/stock"}
                    target={news.url ? "_blank" : undefined}
                    rel={news.url ? "noreferrer" : undefined}
                    className="flex min-w-0 items-center gap-2 py-1.5 hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-[#172033]">
                      {news.title}
                    </span>
                    <span className="shrink-0 text-[8px] font-semibold text-[#8B8175]">
                      {newsTime
                        ? new Date(newsTime).toLocaleTimeString("ko-KR", {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="py-5 text-center text-[9px] font-semibold text-[#8B8175]">
              최신 주식 뉴스를 불러오는 중입니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
