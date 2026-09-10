"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type SeedCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
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

type ClosedNewsItem = {
  id: string;
  title: string;
  url?: string;
  source?: string;
  publishedAt?: string;
};

type MarketState = "OPEN" | "CLOSED" | "WEEKEND" | "HOLIDAY";

const MARKET_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03",
  "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07",
  "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26",
  "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06",
  "2027-11-25", "2027-12-24",
]);

function getMarketState(now = new Date()): MarketState {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return "WEEKEND";
  if (MARKET_HOLIDAYS.has(date)) return "HOLIDAY";
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return minutes >= 570 && minutes < 960 ? "OPEN" : "CLOSED";
}

function closedLabel(state: MarketState) {
  if (state === "HOLIDAY") return "미국 증시 휴일";
  if (state === "WEEKEND") return "주말 · 장 마감";
  return "장 마감";
}

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
  if (!Number.isFinite(price) || price <= 0) return previous || [];

  const tsMs = Number(item.ts || Date.now() / 1000) * 1000;
  const minute = Math.floor(tsMs / 60000);

  let next = [...(previous || [])];

  // On first live packet, use server's recent Schwab 1m bars as visual seeds.
  if (!next.length && Array.isArray(item.candles_1m)) {
    const seeds = item.candles_1m.slice(-3);
    const startMinute = minute - Math.max(0, seeds.length - 1);
    next = seeds.map((c, index) => ({
      minute: startMinute + index,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }));
  }

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

export default function CommunityLiveStocks() {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [candles, setCandles] = useState<Record<string, LiveCandle[]>>({});
  const [status, setStatus] = useState("CONNECTING");
  const [marketState, setMarketState] = useState<MarketState>(() => getMarketState());
  const marketStateRef = useRef<MarketState>(getMarketState());
  const [closedNews, setClosedNews] = useState<ClosedNewsItem[]>([]);

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
        if (marketStateRef.current === "OPEN") {
          setStatus("RECONNECT");
          retryRef.current = setTimeout(() => void start(), 3000);
        } else {
          setStatus("CLOSED");
        }
      }
    };
  }, []);

  const start = useCallback(async () => {
    if (marketStateRef.current !== "OPEN") {
      setStatus("CLOSED");
      return;
    }
    setStatus("CONNECTING");

    // Best for the public KTown page: set this Vercel env var to the FastAPI
    // websocket, e.g. wss://your-stock-server.example.com/ws
    const publicWsUrl = process.env.NEXT_PUBLIC_STOCK_WS_URL?.trim();
    if (publicWsUrl) {
      connectWebSocket(publicWsUrl);
      return;
    }

    // Fallback to the existing authenticated /api/stocks/session route.
    // This keeps the component compatible with the current /stock setup.
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setStatus("LOGIN");
        return;
      }

      const response = await fetch("/api/stocks/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ symbols: [...SYMBOLS] }),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.wsUrl) {
        connectWebSocket(data.wsUrl);
      } else {
        setStatus("WAIT");
      }
    } catch {
      setStatus("WAIT");
    }
  }, [connectWebSocket]);

  const loadClosedNews = useCallback(async () => {
    const { data, error } = await supabase
      .from("shared_news")
      .select("id,title,url,source,published_at,created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) {
      console.error("closed-market news load error:", error);
      return;
    }
    setClosedNews((data || []).map((row) => ({
      id: String(row.id),
      title: row.title || "최신 뉴스",
      url: row.url || undefined,
      source: row.source || undefined,
      publishedAt: row.published_at || row.created_at || undefined,
    })));
  }, []);

  useEffect(() => {
    const applyMarketState = () => {
      const next = getMarketState();
      marketStateRef.current = next;
      setMarketState(next);

      if (next === "OPEN") {
        if (!wsRef.current) void start();
      } else {
        if (retryRef.current) {
          clearTimeout(retryRef.current);
          retryRef.current = null;
        }
        if (wsRef.current) {
          const ws = wsRef.current;
          wsRef.current = null;
          try { ws.close(1000, "Market closed"); } catch {}
        }
        setStatus("CLOSED");
        void loadClosedNews();
      }
    };

    applyMarketState();
    const timer = window.setInterval(applyMarketState, 30_000);
    return () => {
      window.clearInterval(timer);
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [start, loadClosedNews]);

  if (marketState !== "OPEN") {
    return (
      <section className="mb-5 overflow-hidden rounded-[22px] border border-[#D9E2F1] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-black tracking-[-0.02em] text-[#172033]">📰 Latest News</h2>
            <p className="mt-0.5 text-[8px] font-semibold text-[#6B6257]">장 마감 중에는 최신 뉴스를 표시합니다</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-600">
            ● {closedLabel(marketState)}
          </span>
        </div>
        <div className="mt-3 divide-y divide-[#EEF0F3]">
          {closedNews.length ? closedNews.slice(0, 4).map((news) => {
            const body = (
              <div className="py-2.5">
                <div className="line-clamp-2 text-[11px] font-black leading-4 text-[#172033]">{news.title}</div>
                <div className="mt-1 text-[8px] font-semibold text-[#7C746A]">
                  {[news.source, news.publishedAt ? new Date(news.publishedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : ""].filter(Boolean).join(" · ")}
                </div>
              </div>
            );
            return news.url ? (
              <a key={news.id} href={news.url} target="_blank" rel="noreferrer" className="block hover:bg-slate-50">{body}</a>
            ) : <div key={news.id}>{body}</div>;
          }) : (
            <div className="py-8 text-center text-[10px] font-bold text-slate-400">최신 뉴스를 불러오는 중...</div>
          )}
        </div>
      </section>
    );
  }

  return (
    <Link
      href="/stock"
      className="mb-5 block overflow-hidden rounded-[22px] border border-[#D9E2F1] bg-white px-3 py-3 shadow-sm transition hover:shadow-md active:scale-[0.995]"
      aria-label="실시간 주식 정보 보기"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-[14px] font-black tracking-[-0.02em] text-[#172033]">
            📈 Live Stock Watch
          </h2>
          <p className="mt-0.5 text-[8px] font-semibold text-[#6B6257]">
            최근 1분봉 3개 · 마지막 봉 실시간
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black ${
            status === "LIVE"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          ● {status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-[#E5E7EB]">
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
  );
}
