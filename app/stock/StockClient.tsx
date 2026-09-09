"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CommunityBottomNav from "../components/CommunityBottomNav";
import ProfileButton from "../components/ProfileButton";
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
  source?: string;
  url?: string;
};

type EarningsItem = {
  symbol?: string;
  company?: string;
  date?: string;
  time?: string;
  estimate?: string | number;
  marketCap?: number;
  logoUrl?: string;
};

type NewsItem = {
  id?: string;
  symbol?: string;
  title?: string;
  source?: string;
  publishedAt?: string;
  url?: string;
  imageUrl?: string;
  description?: string;
  shared?: boolean;
};

type MarketInfoPayload = {
  events?: MarketEvent[];
  earnings?: EarningsItem[];
  news?: NewsItem[];
  updatedAt?: string;
  source?: string;
  warning?: string;
  error?: string;
};

const MAX_SYMBOLS = 5;


function cleanSymbol(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "")
    .slice(0, 12);
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


function earningsDateKey(value?: string) {
  if (!value) return "TBD";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function earningsDayLabel(value: string) {
  if (value === "TBD") return { dow: "TBD", day: "—", date: "Date TBD" };
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { dow: "", day: value, date: value };
  }
  return {
    dow: parsed.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    day: String(parsed.getDate()),
    date: parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function earningsTimeLabel(value?: string) {
  const v = String(value || "").toLowerCase();
  if (!v) return "";
  if (
    v.includes("before") ||
    v.includes("bmo") ||
    v.includes("pre") ||
    v.includes("morning")
  ) return "Before Open";
  if (
    v.includes("after") ||
    v.includes("amc") ||
    v.includes("post") ||
    v.includes("close")
  ) return "After Close";
  return value || "";
}

export default function StockMonitorPage() {
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const renewRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [symbols, setSymbols] = useState<string[]>([]);
  const [tickerInputs, setTickerInputs] = useState<string[]>(["", "", "", "", ""]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [openSymbol, setOpenSymbol] = useState("");
  const [status, setStatus] = useState("로그인 확인 중...");
  const [busy, setBusy] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [userId, setUserId] = useState("");
  const [marketInfo, setMarketInfo] = useState<MarketInfoPayload>({
    events: [],
    earnings: [],
    news: [],
  });
  const [marketInfoStatus, setMarketInfoStatus] = useState("연결 대기");
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [sharedNews, setSharedNews] = useState<NewsItem[]>([]);
  const [stockNews, setStockNews] = useState<NewsItem[]>([]);


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

  const loadSharedNews = useCallback(async () => {
    // 공유 뉴스는 로그인 여부와 관계없이 전체 최신 항목을 불러옵니다.
    const { data, error } = await supabase
      .from("shared_news")
      .select("id,title,url,source,description,image_url,published_at,created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("shared_news load error:", error);
      return;
    }

    setSharedNews(
      (data || []).map((row) => ({
        id: String(row.id),
        title: row.title || "공유 뉴스",
        url: row.url || undefined,
        source: row.source || "Shared",
        publishedAt: row.published_at || row.created_at || undefined,
        imageUrl: row.image_url || undefined,
        description: row.description || undefined,
        shared: true,
      })),
    );
  }, []);

  const loadStockNews = useCallback(async () => {
    const { data, error } = await supabase
      .from("stock_news")
      .select("id,symbol,title,url,source,published_at,created_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("stock_news load error:", error);
      return;
    }

    setStockNews(
      (data || []).map((row) => ({
        id: `cron-${row.id}`,
        symbol: row.symbol || undefined,
        title: row.title || "주식 속보",
        url: row.url || undefined,
        source: row.source || undefined,
        publishedAt: row.published_at || row.created_at || undefined,
      })),
    );
  }, []);

  const connectWebSocket = useCallback((wsUrl?: string | null) => {
    if (!wsUrl) {
      setStatus("종목은 저장되었습니다. 분석 서버 연결을 기다리는 중입니다.");
      return;
    }

    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (error) {
      console.error("Invalid WebSocket URL:", error);
      setIsLive(false);
      setStatus("분석 서버 주소가 올바르지 않습니다.");
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      setIsLive(true);
      setStatus("실시간 분석 서버 연결됨 · 데이터 수신 중");
    };
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const list: Snapshot[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : payload?.symbol
              ? [payload]
              : payload?.snapshot?.symbol
                ? [payload.snapshot]
                : [];
        setSnapshots((prev) => {
          const next = { ...prev };
          for (const item of list) {
            if (item?.symbol) next[item.symbol] = item;
          }
          return next;
        });
      } catch (error) {
        console.error("Stock WebSocket message error:", error);
      }
    };
    ws.onerror = () => {
      setIsLive(false);
      setStatus("분석 서버 연결 오류 · 서버 실행 상태를 확인하세요.");
    };
    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        setIsLive(false);
        setStatus("분석 서버 연결이 끊어졌습니다.");
      }
    };
  }, []);


  const loadMarketInfo = useCallback(async (watchSymbols: string[]) => {
    try {
      setMarketInfoStatus("업데이트 중");
      const query = watchSymbols.length
        ? `?symbols=${encodeURIComponent(watchSymbols.join(","))}`
        : "";
      const response = await fetch(`/api/stocks/market-info${query}`, {
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMarketInfo({ events: [], earnings: [], news: [] });
        setMarketInfoStatus(data?.error || `이벤트 서버 HTTP ${response.status}`);
        return;
      }

      const events: MarketEvent[] = Array.isArray(data?.events)
        ? data.events.map((event: Record<string, unknown>, index: number) => {
            const rawImportance = event.importance ?? event.risk;
            const importanceText = String(rawImportance || "").toLowerCase();
            const importance: MarketEvent["importance"] =
              importanceText === "3" || importanceText.includes("high")
                ? "high"
                : importanceText === "2" || importanceText.includes("med")
                  ? "medium"
                  : "low";

            return {
              id: String(event.id || `event-${index}`),
              time: String(event.time || "TBD"),
              title: String(event.title || event.name || "-"),
              importance,
              symbol: event.symbol ? String(event.symbol) : undefined,
            };
          })
        : [];

      setMarketInfo({
        events,
        earnings: Array.isArray(data?.earnings) ? data.earnings : [],
        news: Array.isArray(data?.news) ? data.news : [],
        updatedAt: data?.updatedAt,
        source: data?.source,
        warning: data?.warning,
      });
      const updated = data?.updatedAt
        ? new Date(data.updatedAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "방금";
      setMarketInfoStatus(
        data?.warning ? `일부 연결 경고 · ${updated}` : `업데이트 ${updated}`,
      );
    } catch (error) {
      setMarketInfo({ events: [], earnings: [], news: [] });
      setMarketInfoStatus(
        error instanceof Error ? error.message : "이벤트 서버 연결 실패",
      );
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      void loadMarketInfo(symbols);
      void loadSharedNews();
      void loadStockNews();
    };
    const timer = window.setInterval(refresh, 15 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadMarketInfo, loadSharedNews, loadStockNews, symbols]);

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
    void loadSharedNews();
    void loadStockNews();

    setStatus(loaded.length ? "종목 준비 완료 · START를 누르세요." : "종목을 등록하세요.");
  }, [connectWebSocket, loadMarketInfo, loadSharedNews, loadStockNews]);

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

      // /api/stocks/session은 GET 전용이므로 저장할 때 POST하지 않습니다.
      // 실시간 연결은 사용자가 START를 누를 때 시작합니다.
      setStatus("종목 저장 완료 · START를 누르세요.");
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


  async function startLive() {
    const nextSymbols: string[] = [];

    for (const raw of tickerInputs) {
      const symbol = cleanSymbol(raw);
      if (symbol && !nextSymbols.includes(symbol)) {
        nextSymbols.push(symbol);
      }
    }

    const finalSymbols = nextSymbols.slice(0, MAX_SYMBOLS);

    if (!finalSymbols.length) {
      setStatus("먼저 종목을 1개 이상 등록하세요.");
      return;
    }

    // 입력창의 내용이 현재 저장된 종목과 다르면 먼저 저장합니다.
    const changed =
      finalSymbols.length !== symbols.length ||
      finalSymbols.some((symbol, index) => symbol !== symbols[index]);

    if (changed) await saveWatchlist(finalSymbols);

    // 다른 페이지로 이동하지 않고 이 화면에서 분석 서버 세션을 시작합니다.
    setBusy(true);
    setIsLive(false);
    setStatus("분석 서버 연결 요청 중...");

    try {
      const token = await getAccessToken();
      if (!token) {
        setStatus("로그인이 필요합니다.");
        return;
      }

      const response = await fetch("/api/stocks/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ symbols: finalSymbols }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${data?.error || data?.message || "분석 서버 응답 오류"}`,
        );
      }

      if (!data?.wsUrl) {
        throw new Error(data?.serverWarning || "분석 서버의 wsUrl이 없습니다.");
      }

      connectWebSocket(data.wsUrl);
      void loadMarketInfo(finalSymbols);
    } catch (error) {
      console.error("START error:", error);
      setStatus(error instanceof Error ? `START 실패: ${error.message}` : "START 실패");
    } finally {
      setBusy(false);
    }
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

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="relative mx-auto flex h-14 max-w-[1600px] items-center justify-between px-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-black text-slate-800 shadow-sm active:scale-95"
            aria-label="뒤로가기"
          >
            ←
          </button>

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-black text-slate-950 sm:text-xl">
            My Stock Monitor
          </h1>

          <div className="z-10 flex h-10 w-10 items-center justify-center">
            <ProfileButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] px-3 py-4">
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
              type="button"
              onClick={() => void startLive()}
              disabled={busy}
              className={`h-8 rounded border px-5 text-xs font-black text-white disabled:opacity-40 ${
                isLive
                  ? "border-orange-500 bg-orange-500 ring-2 ring-orange-200"
                  : "border-emerald-500 bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {busy ? "CONNECTING..." : isLive ? "RUNNING" : "START"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (wsRef.current) {
                  try { wsRef.current.close(); } catch {}
                  wsRef.current = null;
                }
                setIsLive(false);
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
              subtitle="CPI · Fed/FOMC · 고용 · GDP · 대통령 주요 발표"
              accent="amber"
            >
              <button
                type="button"
                onClick={() => setEventsModalOpen(true)}
                className="block w-full rounded-xl text-left transition hover:bg-amber-50/50 active:bg-amber-50"
                aria-label="오늘의 주요 시장 이벤트 전체보기"
              >
                {marketInfo.events?.length ? (
                  <div className="space-y-1">
                    {marketInfo.events.slice(0, 6).map((event, index) => (
                      <div
                        key={event.id || `${event.title}-${index}`}
                        className="flex gap-3 border-b border-slate-100 px-2 py-2 last:border-0"
                      >
                        <div className="w-[72px] shrink-0 text-xs font-black text-slate-600">
                          {event.time || "TBD"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900">
                            {event.title || "-"}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {[event.source, event.importance ? `중요도 ${event.importance}` : ""]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                        <div className="shrink-0 self-center text-sm font-black text-amber-600">
                          →
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[112px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs font-semibold text-slate-500">
                    오늘 예정된 중·고위험 시장 이벤트 없음 · {marketInfoStatus}
                    <span className="ml-2 font-black text-amber-600">보기 →</span>
                  </div>
                )}
              </button>
            </DashboardCard>

            <DashboardCard
              icon="💵"
              title="EARNINGS SCHEDULE"
              subtitle="날짜별 예정 실적 발표 회사"
              accent="emerald"
            >
              {marketInfo.earnings?.length ? (
                <EarningsCalendar items={marketInfo.earnings} />
              ) : (
                <EmptyBlock text={`어닝 데이터 ${marketInfoStatus}`} />
              )}
            </DashboardCard>

            <DashboardCard
              icon="📰"
              title="LATEST NEWS"
              subtitle="자동 수집 주식 속보 · 10분마다 업데이트"
              accent="rose"
            >
              {stockNews.length ? (
                <div className="space-y-2">
                  {stockNews.slice(0, 10).map((news, index) => {
                    const content = (
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold leading-5 text-slate-900">
                          {news.title || "-"}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">
                          {news.publishedAt
                            ? new Date(news.publishedAt).toLocaleString("ko-KR", {
                                year: "numeric",
                                month: "numeric",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : ""}
                        </div>
                      </div>
                    );

                    return news.url ? (
                      <a
                        key={news.id || `${news.title}-${index}`}
                        href={news.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
                      >
                        {content}
                      </a>
                    ) : (
                      <div
                        key={news.id || `${news.title}-${index}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyBlock text="자동 수집된 주식 속보가 아직 없습니다." />
              )}
            </DashboardCard>
          </div>
        </section>

       
      </div>
      {eventsModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setEventsModalOpen(false)}
        >
          <div
            className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <div className="text-base font-black text-slate-950">TODAY'S EVENTS</div>
                <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  CPI · Fed/FOMC · 고용 · GDP · 대통령 주요 발표
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEventsModalOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-lg font-black text-slate-600 hover:bg-slate-50"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto px-4 py-3">
              {marketInfo.events?.length ? (
                <div className="divide-y divide-slate-100">
                  {marketInfo.events.map((event, index) => {
                    const content = (
                      <div className="flex gap-3 py-3">
                        <div className="w-[78px] shrink-0 text-xs font-black text-slate-600">
                          {event.time || "TBD"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-black leading-5 text-slate-900">
                            {event.title || "-"}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {[event.source, event.importance ? `중요도 ${event.importance}` : ""]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                        {event.url ? (
                          <div className="shrink-0 self-center text-sm font-black text-amber-600">
                            →
                          </div>
                        ) : null}
                      </div>
                    );

                    return event.url ? (
                      <a
                        key={event.id || `${event.title}-${index}`}
                        href={event.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg hover:bg-amber-50"
                      >
                        {content}
                      </a>
                    ) : (
                      <div key={event.id || `${event.title}-${index}`}>{content}</div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[190px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                  <div>
                    <div className="text-sm font-black text-slate-700">
                      오늘 예정된 중·고위험 시장 이벤트가 없습니다.
                    </div>
                    <div className="mt-2 text-xs font-semibold text-slate-500">
                      {marketInfoStatus}
                    </div>
                    <div className="mt-4 text-[11px] leading-5 text-slate-500">
                      CPI · Fed/FOMC · 고용 · GDP · 대통령 주요 발표가 확인되면 여기에 표시됩니다.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}




function EarningsCalendar({ items }: { items: EarningsItem[] }) {
  const grouped = items.reduce<Record<string, EarningsItem[]>>((acc, item) => {
    const key = earningsDateKey(item.date);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const dates = Object.keys(grouped)
    .sort((a, b) => {
      if (a === "TBD") return 1;
      if (b === "TBD") return -1;
      return a.localeCompare(b);
    })
    .slice(0, 5);

  return (
    <div
      className="w-full max-w-full overflow-x-auto overscroll-x-contain pb-3 md:overflow-x-visible"
      style={{
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-x pinch-zoom",
      }}
    >
      <div
        className="grid w-[900px] grid-cols-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 md:w-full"
      >
        {dates.map((date, dateIndex) => {
          const label = earningsDayLabel(date);

          // 날짜별 전체 어닝 회사 중 시가총액 큰 순서 → 최대 10개만 표시
          const dayItems = [...(grouped[date] || [])]
            .sort(
              (a, b) =>
                Number(b.marketCap || 0) - Number(a.marketCap || 0),
            )
            .slice(0, 10);

          return (
            <div
              key={date}
              className={dateIndex ? "border-l border-slate-200" : ""}
            >
              <div className="border-b border-slate-200 bg-slate-100 px-2 py-2 text-center">
                <div className="text-[9px] font-black tracking-wider text-slate-500">
                  {label.dow}
                </div>
                <div className="text-lg font-black leading-5 text-slate-900">
                  {label.day}
                </div>
                <div className="mt-0.5 text-[9px] font-bold text-slate-400">
                  {label.date}
                </div>
              </div>

              <div className="bg-slate-50 p-2">
                <div className="space-y-2">
                  {dayItems.map((item, index) => {
                    const symbol = String(item.symbol || "?").toUpperCase();
                    const timing = earningsTimeLabel(item.time);

                    return (
                      <div
                        key={`${symbol}-${date}-${index}`}
                        className="flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm"
                        title={item.company || symbol}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-white">
                          <img
                            src={
                              item.logoUrl ||
                              `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(symbol)}.png`
                            }
                            alt={`${symbol} logo`}
                            loading="lazy"
                            className="h-7 w-7 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-black text-slate-950">
                            {symbol}
                          </div>

                          <div className="truncate text-[8px] font-semibold text-slate-500">
                            {timing || "Time TBD"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!dayItems.length ? (
                  <div className="flex min-h-[250px] items-center justify-center text-[10px] font-bold text-slate-400">
                    No earnings
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-[10px] font-semibold text-slate-400">
        날짜별 시가총액 상위 10개 · 실적 발표 시점만 표시
      </div>
    </div>
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
