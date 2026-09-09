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
  prev_close?: number;
  day_change_pct?: number;
  candles_1m?: SeedCandle[];
};

const SYMBOLS = ["NVDA", "TSLA", "AAPL"] as const;
type SymbolName = (typeof SYMBOLS)[number];

const CANDLE_STORAGE_KEY = "ktown-community-live-candles-v1";

function fmt(value: unknown, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toFixed(digits) : "-";
}

function dayChangePct(item?: Snapshot): number | null {
  const direct = Number(item?.day_change_pct);
  if (Number.isFinite(direct)) return direct;

  const price = Number(item?.price);
  const prev = Number(item?.prev_close);
  if (!Number.isFinite(price) || !Number.isFinite(prev) || prev <= 0) return null;

  return ((price - prev) / prev) * 100;
}

function DayChangeLine({ item }: { item?: Snapshot }) {
  const pct = dayChangePct(item);

  if (pct == null) {
    return <div className="mt-1 text-[10px] font-bold text-slate-400">전일 대비 -</div>;
  }

  const up = pct > 0;
  const down = pct < 0;

  return (
    <div
      className={`mt-1 text-[11px] font-black ${
        up ? "text-emerald-600" : down ? "text-red-600" : "text-slate-500"
      }`}
    >
      {up ? "▲" : down ? "▼" : "—"} {Math.abs(pct).toFixed(2)}%
    </div>
  );
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
  const risk = Number(item?.down_risk);

  if (Number.isFinite(risk) && risk >= 75) {
    return { text: "고위험", cls: "bg-red-50 text-red-700" };
  }
  if (Number.isFinite(risk) && risk >= 60) {
    return { text: "하락 위험", cls: "bg-red-50 text-red-600" };
  }
  if (Number.isFinite(risk) && risk >= 45) {
    return { text: "위험 관찰", cls: "bg-amber-50 text-amber-700" };
  }

  return { text: "", cls: "" };
}

function loadStoredCandles(): Record<string, LiveCandle[]> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.sessionStorage.getItem(CANDLE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const result: Record<string, LiveCandle[]> = {};

    for (const symbol of SYMBOLS) {
      const rows = Array.isArray(parsed[symbol]) ? parsed[symbol] : [];
      result[symbol] = rows
        .filter(
          (c: LiveCandle) =>
            Number.isFinite(Number(c?.minute)) &&
            Number.isFinite(Number(c?.open)) &&
            Number.isFinite(Number(c?.high)) &&
            Number.isFinite(Number(c?.low)) &&
            Number.isFinite(Number(c?.close)),
        )
        .slice(-3)
        .map((c: LiveCandle) => ({
          minute: Number(c.minute),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
        }));
    }

    return result;
  } catch {
    return {};
  }
}

function saveStoredCandles(candles: Record<string, LiveCandle[]>) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(CANDLE_STORAGE_KEY, JSON.stringify(candles));
  } catch {}
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

  // PC #2의 실제 최근 1분봉 3개가 있으면 그것을 우선 사용합니다.
  // 페이지 새로고침/재연결/컴포넌트 리마운트 후에도 회색 placeholder로
  // 다시 시작하지 않고 실제 최근 봉을 즉시 복원합니다.
  if (Array.isArray(item.candles_1m) && item.candles_1m.length) {
    const serverCandles = item.candles_1m
      .slice(-3)
      .map((c, index, arr) => ({
        minute: minute - (arr.length - 1 - index),
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

    if (serverCandles.length) {
      next = serverCandles;
    }
  }

  const current = next[next.length - 1];

  // 새 1분이 시작되면 기존 LIVE 봉을 지우지 않고 완료 봉으로 남긴 뒤
  // 새 LIVE 봉 하나만 오른쪽에 추가합니다.
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
  const [candles, setCandles] = useState<Record<string, LiveCandle[]>>(() => loadStoredCandles());
  const [status, setStatus] = useState("CONNECTING");

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
          saveStoredCandles(next);
          return next;
        });
      } catch {}
    };

    ws.onerror = () => setStatus("RECONNECT");
    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        setStatus("RECONNECT");
        retryRef.current = setTimeout(() => void start(), 3000);
      }
    };
  }, []);

  const start = useCallback(async () => {
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

  useEffect(() => {
    void start();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [start]);

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
              <DayChangeLine item={item} />

              <div className="mt-2 flex h-[16px] items-center justify-center">
                {action.text ? (
                  <div className={`w-fit rounded-full px-2 py-0.5 text-[7px] font-black ${action.cls}`}>
                    {action.text}
                  </div>
                ) : null}
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