"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Snapshot = {
  symbol: string;
  ts?: number;
  price?: number;
  bid?: number;
  ask?: number;
  action?: string;
  reason?: string;
  forecast?: string;
  score?: number;
  down_risk?: number;
  fast_drop?: string;
  fast_drop_1m?: number;
  fast_drop_2m?: number;
  buy60?: number;
  sell60?: number;
  vwap?: number;
  ema9?: number;
  ema20?: number;
  local_support?: number;
  support?: number;
  resistance?: number;
  trend_1m?: string;
  trend_score?: number;
  ml_up5?: number;
  dl_up5?: number;
  dl_up10?: number;
  dl_up15?: number;
  sector?: string;
  option_bias?: string;
  option_score?: number;
  zero_dte_key?: string;
  zero_dte_label?: string;
  sell_risk?: number;
  pnl?: number;
  entry?: number;
  exp_5m?: string;
  samples?: number;
  vol_x?: number;
  error?: string;
};


type MarketEvent = {
  id?: string;
  time?: string;
  title?: string;
  importance?: "high" | "medium" | "low";
  symbol?: string;
};

type EarningsItem = {
  symbol?: string;
  company?: string;
  date?: string;
  time?: string;
  estimate?: string | number;
};

type NewsItem = {
  id?: string;
  symbol?: string;
  title?: string;
  source?: string;
  publishedAt?: string;
  url?: string;
};

type MarketInfoPayload = {
  events?: MarketEvent[];
  earnings?: EarningsItem[];
  news?: NewsItem[];
};

const MAX_SYMBOLS = 5;


function cleanSymbol(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "")
    .slice(0, 12);
}

function fmt(value: unknown, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

function signalStyle(action?: string, risk?: number, fastDrop?: string) {
  const a = (action || "").toUpperCase();
  const f = (fastDrop || "").toUpperCase();
  if (a.includes("SELL") || f.includes("CRITICAL") || Number(risk) >= 65) {
    return "text-red-600";
  }
  if (a.includes("BUY")) return "text-emerald-600";
  if (a.includes("WARNING") || a.includes("WATCH") || Number(risk) >= 45) {
    return "text-amber-600";
  }
  return "text-slate-500";
}

export default function StockMonitorPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const renewRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [symbols, setSymbols] = useState<string[]>([]);
  const [tickerInputs, setTickerInputs] = useState<string[]>(["", "", "", "", ""]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [openSymbol, setOpenSymbol] = useState("");
  const [status, setStatus] = useState("로그인 확인 중...");
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState("");
  const [marketInfo, setMarketInfo] = useState<MarketInfoPayload>({
    events: [],
    earnings: [],
    news: [],
  });
  const [marketInfoStatus, setMarketInfoStatus] = useState("연결 대기");


  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Stock monitor session error:", error);
      return "";
    }

    return session?.access_token || "";
  }, []);

  const connectWebSocket = useCallback((wsUrl?: string | null) => {
    if (!wsUrl) {
      setStatus("종목은 저장되었습니다. 분석 서버 연결을 기다리는 중입니다.");
      return;
    }

    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus("실시간 분석 서버 연결됨");
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const list: Snapshot[] = Array.isArray(payload?.data) ? payload.data : [];
        setSnapshots((prev) => {
          const next = { ...prev };
          for (const item of list) {
            if (item?.symbol) next[item.symbol] = item;
          }
          return next;
        });
      } catch {}
    };
    ws.onerror = () => setStatus("분석 서버 연결 오류");
    ws.onclose = () => setStatus("분석 서버 연결이 끊어졌습니다.");
  }, []);


  const loadMarketInfo = useCallback(async (watchSymbols: string[]) => {
    if (!watchSymbols.length) {
      setMarketInfo({ events: [], earnings: [], news: [] });
      setMarketInfoStatus("종목 등록 필요");
      return;
    }

    try {
      setMarketInfoStatus("업데이트 중");
      const query = encodeURIComponent(watchSymbols.join(","));
      const response = await fetch(`/api/stocks/market-info?symbols=${query}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        setMarketInfoStatus("연결 대기");
        return;
      }

      const data = await response.json().catch(() => ({}));
      setMarketInfo({
        events: Array.isArray(data?.events) ? data.events : [],
        earnings: Array.isArray(data?.earnings) ? data.earnings : [],
        news: Array.isArray(data?.news) ? data.news : [],
      });
      setMarketInfoStatus(data?.updatedAt ? `업데이트 ${data.updatedAt}` : "업데이트 완료");
    } catch {
      setMarketInfoStatus("연결 대기");
    }
  }, []);

  const openSession = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      setStatus("로그인 후 사용할 수 있습니다.");
      return;
    }

    const uid = session.user.id;
    setUserId(uid);

    // 1) Watchlist는 Supabase에서 직접 읽습니다.
    //    분석 서버 환경변수가 없어도 등록/새로고침 저장이 유지됩니다.
    const { data: watchlistRow, error: watchlistError } = await supabase
      .from("stock_watchlists")
      .select("symbols")
      .eq("user_id", uid)
      .maybeSingle();

    if (watchlistError) {
      console.error("stock_watchlists load error:", watchlistError);
      setStatus(`Watchlist 불러오기 실패: ${watchlistError.message}`);
      return;
    }

    const loaded = Array.isArray(watchlistRow?.symbols)
      ? watchlistRow.symbols.slice(0, MAX_SYMBOLS)
      : [];

    setSymbols(loaded);
    setTickerInputs([
      loaded[0] || "",
      loaded[1] || "",
      loaded[2] || "",
      loaded[3] || "",
      loaded[4] || "",
    ]);

    void loadMarketInfo(loaded);

    // 2) 실시간 분석 연결은 별도 API로 시도합니다.
    //    실패해도 Watchlist 저장에는 영향을 주지 않습니다.
    try {
      const response = await fetch("/api/stocks/session", {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.wsUrl) {
        connectWebSocket(data.wsUrl);
      } else {
        setStatus(
          loaded.length
            ? "종목 저장됨 · 분석 서버 연결 대기"
            : "종목을 등록하세요."
        );
      }
    } catch {
      setStatus(
        loaded.length
          ? "종목 저장됨 · 분석 서버 연결 대기"
          : "종목을 등록하세요."
      );
    }

    if (renewRef.current) clearTimeout(renewRef.current);
    renewRef.current = setTimeout(() => {
      void openSession();
    }, 4 * 60 * 1000);
  }, [connectWebSocket, loadMarketInfo]);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        setUserId(session.user.id);
        void openSession();
      } else {
        setStatus("로그인 정보를 기다리는 중...");
      }
    }

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUserId(session.user.id);
        void openSession();
      } else {
        setUserId("");
        setStatus("로그인 후 사용할 수 있습니다.");
        setSymbols([]);
        setSnapshots({});
        if (wsRef.current) {
          try { wsRef.current.close(); } catch {}
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (renewRef.current) clearTimeout(renewRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [openSession]);

  async function saveWatchlist(nextSymbols: string[]) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      setStatus("로그인이 필요합니다.");
      return;
    }

    const uid = session.user.id;
    setUserId(uid);
    setBusy(true);
    setStatus("종목 저장 중...");

    try {
      // 핵심: 먼저 Supabase에 직접 저장.
      const { error: saveError } = await supabase
        .from("stock_watchlists")
        .upsert(
          {
            user_id: uid,
            symbols: nextSymbols,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (saveError) {
        throw new Error(`Watchlist 저장 실패: ${saveError.message}`);
      }

      // 저장 성공 즉시 화면 반영.
      setSymbols(nextSymbols);
      setTickerInputs([
        nextSymbols[0] || "",
        nextSymbols[1] || "",
        nextSymbols[2] || "",
        nextSymbols[3] || "",
        nextSymbols[4] || "",
      ]);

      void loadMarketInfo(nextSymbols);

      setStatus("종목 저장 완료 · 분석 서버 연결 중...");

      // 분석 서버 동기화는 best-effort.
      // 이 부분이 실패해도 Supabase 저장은 이미 완료되어 있습니다.
      try {
        const response = await fetch("/api/stocks/session", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ symbols: nextSymbols }),
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data?.wsUrl) {
          connectWebSocket(data.wsUrl);
          setStatus("종목 저장 완료 · 실시간 분석 서버 연결 중...");
        } else {
          setStatus("종목 저장 완료 · 분석 서버 연결 대기");
        }
      } catch {
        setStatus("종목 저장 완료 · 분석 서버 연결 대기");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  async function saveTickerInputs() {
    const nextSymbols: string[] = [];

    for (const raw of tickerInputs) {
      const symbol = cleanSymbol(raw);
      if (symbol && !nextSymbols.includes(symbol)) {
        nextSymbols.push(symbol);
      }
    }

    await saveWatchlist(nextSymbols.slice(0, MAX_SYMBOLS));
  }

  async function removeSymbol(symbol: string) {
    const next = symbols.filter((item) => item !== symbol);
    setTickerInputs([
      next[0] || "",
      next[1] || "",
      next[2] || "",
      next[3] || "",
      next[4] || "",
    ]);
    setSnapshots((prev) => {
      const copy = { ...prev };
      delete copy[symbol];
      return copy;
    });
    if (openSymbol === symbol) setOpenSymbol("");
    await saveWatchlist(next);
  }

  const rows = Array.from({ length: MAX_SYMBOLS }, (_, i) => {
    const symbol = symbols[i] || "";
    return {
      symbol,
      item: symbol ? snapshots[symbol] : undefined,
    };
  });

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-[1600px] px-3 py-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-950">My Stock Monitor</h1>
            <p className="mt-1 text-sm text-slate-500">
              최대 5종목 · 실시간 분석 신호는 투자 조언이나 주문이 아닙니다.
            </p>
          </div>
          <div className="text-xs font-black text-slate-700">
            KTown WEB · SCHWAB DATA · 1M / 5M ANALYSIS
          </div>
        </div>

        <section className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 text-sm font-black text-slate-950">
              1) TICKERS (max 5):
            </div>

            {tickerInputs.map((value, index) => (
              <input
                key={index}
                value={value}
                onChange={(e) => {
                  const next = [...tickerInputs];
                  next[index] = cleanSymbol(e.target.value);
                  setTickerInputs(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveTickerInputs();
                }}
                placeholder={index === 0 ? "NVDA" : ""}
                maxLength={12}
                disabled={busy}
                className="h-8 w-[84px] rounded border border-slate-300 bg-white px-2 text-sm font-bold uppercase text-slate-900 outline-none focus:border-blue-500"
              />
            ))}

            <button
              onClick={() => void saveTickerInputs()}
              disabled={busy}
              className="h-8 rounded bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy ? "저장 중..." : symbols.length ? "등록 / 수정" : "등록"}
            </button>

            <button
              onClick={() => void openSession()}
              className="h-8 rounded border border-emerald-500 bg-emerald-50 px-5 text-xs font-black text-emerald-700 hover:bg-emerald-100"
            >
              START
            </button>

            <button
              onClick={() => {
                if (wsRef.current) {
                  try { wsRef.current.close(); } catch {}
                  wsRef.current = null;
                }
                setStatus("Stopped");
              }}
              className="h-8 rounded border border-red-300 bg-red-50 px-5 text-xs font-black text-red-700 hover:bg-red-100"
            >
              STOP
            </button>

            <span className="ml-2 text-xs font-semibold text-slate-600">{status}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-500">현재 저장:</span>
            {symbols.length ? (
              symbols.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => void removeSymbol(symbol)}
                  className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700 hover:bg-red-50 hover:text-red-600"
                  title="이 종목 삭제"
                >
                  {symbol} ×
                </button>
              ))
            ) : (
              <span className="text-slate-400">등록된 종목이 없습니다.</span>
            )}
            {userId ? (
              <span className="ml-auto text-[11px] text-slate-400">
                USER {userId.slice(0, 8)}
              </span>
            ) : null}
          </div>
        </section>


        <section className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-slate-950">Market Dashboard</h2>
              <p className="text-xs text-slate-500">
                등록 종목의 실시간 데이터, 오늘의 주요 이벤트, 어닝 일정, 최신 뉴스를 한 화면에서 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadMarketInfo(symbols)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
            >
              새로고침
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Link
              href="/stock/live"
              className="group flex min-h-[112px] items-center gap-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">
                📈
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black tracking-wide text-slate-950">LIVE DATA</div>
                <div className="mt-1 text-xs text-slate-500">
                  등록 종목의 실시간 분석 화면 열기
                </div>
              </div>
              <div className="text-2xl font-black text-blue-600 transition group-hover:translate-x-1">→</div>
            </Link>

            <DashboardCard
              icon="📅"
              title="TODAY'S EVENTS"
              subtitle="시장에 영향을 줄 수 있는 오늘의 일정"
              accent="amber"
            >
              {marketInfo.events?.length ? (
                <div className="space-y-2">
                  {marketInfo.events.slice(0, 6).map((event, index) => (
                    <div key={event.id || `${event.title}-${index}`} className="flex gap-3 border-b border-slate-100 pb-2 last:border-0">
                      <div className="w-[62px] shrink-0 text-xs font-black text-slate-600">
                        {event.time || "-"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">{event.title || "-"}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {event.symbol ? `${event.symbol} · ` : ""}
                          {event.importance ? `중요도 ${event.importance}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock text={`이벤트 데이터 ${marketInfoStatus}`} />
              )}
            </DashboardCard>

            <DashboardCard
              icon="💵"
              title="EARNINGS SCHEDULE"
              subtitle="등록 종목의 예정된 실적 발표"
              accent="emerald"
            >
              {marketInfo.earnings?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="pb-2">Ticker</th>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Time</th>
                        <th className="pb-2 text-right">Estimate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketInfo.earnings.slice(0, 8).map((item, index) => (
                        <tr key={`${item.symbol}-${item.date}-${index}`} className="border-t border-slate-100">
                          <td className="py-2 font-black text-slate-950">{item.symbol || "-"}</td>
                          <td className="py-2">{item.date || "-"}</td>
                          <td className="py-2">{item.time || "-"}</td>
                          <td className="py-2 text-right">{item.estimate ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyBlock text={`어닝 데이터 ${marketInfoStatus}`} />
              )}
            </DashboardCard>

            <DashboardCard
              icon="📰"
              title="LATEST NEWS"
              subtitle="등록 종목 중심 최신 뉴스"
              accent="rose"
            >
              {marketInfo.news?.length ? (
                <div className="space-y-2">
                  {marketInfo.news.slice(0, 6).map((news, index) => {
                    const content = (
                      <>
                        <div className="text-sm font-bold leading-5 text-slate-900">{news.title || "-"}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {[news.symbol, news.source, news.publishedAt].filter(Boolean).join(" · ")}
                        </div>
                      </>
                    );

                    return news.url ? (
                      <a
                        key={news.id || `${news.title}-${index}`}
                        href={news.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                      >
                        {content}
                      </a>
                    ) : (
                      <div
                        key={news.id || `${news.title}-${index}`}
                        className="rounded-lg border border-slate-200 px-3 py-2"
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyBlock text={`뉴스 데이터 ${marketInfoStatus}`} />
              )}
            </DashboardCard>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 text-sm font-black text-slate-950">
              2) POSITION / HISTORY:
            </div>

            <select
              value={symbols[0] || ""}
              onChange={() => {}}
              className="h-8 min-w-[90px] rounded border border-slate-300 bg-white px-2 text-xs font-semibold"
            >
              {symbols.length ? (
                symbols.map((symbol) => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))
              ) : (
                <option value="">-</option>
              )}
            </select>

            {[
              "MARK BOUGHT",
              "CLEAR POSITION",
              "TODAY'S EVENTS",
            ].map((label) => (
              <button
                key={label}
                type="button"
                className={label === "TODAY'S EVENTS"
                  ? "h-8 rounded border-2 border-amber-600 bg-amber-400 px-3 text-[11px] font-black text-slate-950 shadow-sm hover:bg-amber-300"
                  : "h-8 rounded border border-slate-300 bg-slate-50 px-3 text-[11px] font-bold text-slate-700"}
                title="웹 버전 UI 자리 — 서버 기능 연결 시 활성화"
              >
                {label}
              </button>
            ))}
          </div>

          <p className="mt-2 text-[11px] leading-5 text-slate-600">
            Schwab 실시간/최근 시장 데이터와 핵심 단기 분석을 표시합니다. 서버 데이터가 없거나 장 종료 후에는 값이 “-”로 표시되며,
            등록된 종목 행은 그대로 유지됩니다.
          </p>

          <div className="mt-3 overflow-x-auto border border-slate-300">
            <table className="min-w-[1180px] w-full border-collapse bg-white text-[11px]">
              <thead className="bg-slate-100 text-slate-950">
                <tr>
                  {[
                    "Ticker", "?", "Action", "Price", "Forecast", "Score",
                    "Down Risk", "P/L", "Entry", "Buy60", "Sell60",
                    "VWAP", "EMA9", "EMA20", "Resistance", "Support",
                    "Fast Drop", "1m Trend"
                  ].map((head) => (
                    <th
                      key={head}
                      className="whitespace-nowrap border-b border-r border-slate-300 px-2 py-2 text-center font-black"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map(({ symbol, item }, index) => {
                  const actionClass = signalStyle(item?.action, item?.down_risk, item?.fast_drop);
                  return (
                    <tr key={symbol || `empty-${index}`} className="h-[48px]">
                      <Cell strong>{symbol || "-"}</Cell>
                      <Cell>
                        {symbol ? (
                          <button
                            type="button"
                            title="이 종목의 분석 항목 설명"
                            className="mx-auto flex h-7 w-7 items-center justify-center rounded-md border-2 border-blue-700 bg-blue-600 text-sm font-black text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          >
                            ?
                          </button>
                        ) : "-"}
                      </Cell>
                      <Cell>
                        {symbol ? (
                          <span className={`font-black ${actionClass}`}>
                            {item?.action || "DATA WAIT"}
                          </span>
                        ) : "-"}
                      </Cell>
                      <Cell>{symbol && item?.price != null ? `$${fmt(item.price)}` : "-"}</Cell>
                      <Cell>{symbol ? item?.forecast || "-" : "-"}</Cell>
                      <Cell>{symbol && item ? item.score ?? "-" : "-"}</Cell>
                      <Cell>{symbol && item ? `${fmt(item.down_risk, 0)}%` : "-"}</Cell>
                      <Cell>{symbol && item ? fmt(item.pnl) : "-"}</Cell>
                      <Cell>{symbol && item ? fmt(item.entry) : "-"}</Cell>
                      <Cell>{symbol && item ? item.buy60 ?? "-" : "-"}</Cell>
                      <Cell>{symbol && item ? item.sell60 ?? "-" : "-"}</Cell>
                      <Cell>{symbol && item ? fmt(item.vwap) : "-"}</Cell>
                      <Cell>{symbol && item ? fmt(item.ema9) : "-"}</Cell>
                      <Cell>{symbol && item ? fmt(item.ema20) : "-"}</Cell>
                      <Cell>{symbol && item ? fmt(item.resistance) : "-"}</Cell>
                      <Cell>{symbol && item ? fmt(item.local_support ?? item.support) : "-"}</Cell>
                      <Cell>{symbol ? item?.fast_drop || "-" : "-"}</Cell>
                      <Cell>{symbol ? item?.trend_1m || "-" : "-"}</Cell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_320px]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">
              <div className="mb-1 font-black text-slate-800">LEGEND</div>
              Action: BUY WATCH / BUY / HOLD / WATCH / SELL WATCH / SELL ·
              Forecast: 단기 예상 방향 · Score: 종합 신호 점수 · Down Risk: 하락 위험도 ·
              Buy60 / Sell60: 최근 매수/매도 흐름 · VWAP / EMA: 단기 기준선 ·
              Resistance / Support: 단기 저항/지지 · Fast Drop: 급락 경고
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-600">
              <div className="mb-1 font-black text-slate-800">STATUS</div>
              <div>• 서버: {status}</div>
              <div>• 등록 종목: {symbols.length} / 5</div>
              <div>• 데이터: {Object.keys(snapshots).length ? "수신 중" : "대기 중"}</div>
              <div>• 실시간 값이 없으면 “-” 표시</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}



function DashboardCard({
  icon,
  title,
  subtitle,
  accent,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  accent: "blue" | "amber" | "emerald" | "rose";
  children: React.ReactNode;
}) {
  const accentClass = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
  }[accent];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${accentClass}`}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-black tracking-wide text-slate-950">{title}</div>
          <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="flex min-h-[112px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs font-semibold text-slate-500">
      {text}
    </div>
  );
}

function Cell({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={`whitespace-nowrap border-b border-r border-slate-300 px-2 py-2 text-center ${
        strong ? "font-black text-slate-950" : "font-medium text-slate-700"
      }`}
    >
      {children}
    </td>
  );
}
