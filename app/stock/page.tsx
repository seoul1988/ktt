"use client";

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
  }, [connectWebSocket]);

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

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-slate-900">My Stock Monitor</h1>
          <p className="mt-1 text-sm text-slate-500">
            최대 5종목 · 실시간 분석 신호는 투자 조언이나 주문이 아닙니다.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 text-sm font-extrabold text-slate-900">
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
                className="h-9 w-[86px] rounded-md border border-slate-300 bg-white px-2 text-sm font-bold uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            ))}

            <button
              onClick={() => void saveTickerInputs()}
              disabled={busy}
              className="h-9 rounded-md bg-blue-600 px-5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy ? "저장 중..." : symbols.length ? "등록 / 수정" : "등록"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              현재 저장:
            </span>

            {symbols.length ? (
              symbols.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => void removeSymbol(symbol)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-red-50 hover:text-red-600"
                  title="이 종목 삭제"
                >
                  {symbol} ×
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-400">
                등록된 종목이 없습니다.
              </span>
            )}

            <span className="ml-auto text-xs text-slate-500">
              {status}
              {userId ? ` · USER ${userId.slice(0, 8)}` : ""}
            </span>
          </div>
        </section>

        <section className="mt-4 space-y-3">
          {symbols.map((symbol) => {
            const item = snapshots[symbol];
            const isOpen = openSymbol === symbol;
            const signalClass = signalStyle(item?.action, item?.down_risk, item?.fast_drop);

            return (
              <article
                key={symbol}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  onClick={() => setOpenSymbol(isOpen ? "" : symbol)}
                  className="grid w-full grid-cols-[24px_1fr_auto] items-center gap-2 px-4 py-4 text-left"
                >
                  <span className="text-slate-400">{isOpen ? "▼" : "▶"}</span>
                  <span>
                    <span className="block text-lg font-extrabold text-slate-900">{symbol}</span>
                    <span className={`block text-xs font-extrabold ${signalClass}`}>
                      {item?.action || "DATA WAIT"} · Score {item?.score ?? "-"} · Risk {fmt(item?.down_risk, 0)}%
                    </span>
                  </span>
                  <span className="text-right text-lg font-extrabold text-slate-900">
                    {item?.price ? `$${fmt(item.price)}` : "기본 정보 보기"}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    {!item ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                        이 종목은 등록되었습니다. 제2 PC 분석 서버에서 데이터가 들어오면
                        Price, Action, Score, Down Risk, VWAP, EMA, Support/Resistance,
                        Buy60/Sell60, ML/DL, Options/0DTE가 이곳에 자동으로 표시됩니다.
                      </div>
                    ) : item?.error ? (
                      <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{item.error}</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <Metric label="1m Trend" value={`${item?.trend_1m || "-"} (${item?.trend_score ?? 0})`} />
                          <Metric label="Buy60 / Sell60" value={`${item?.buy60 ?? 0} / ${item?.sell60 ?? 0}`} />
                          <Metric label="VWAP" value={fmt(item?.vwap)} />
                          <Metric label="EMA 9 / 20" value={`${fmt(item?.ema9)} / ${fmt(item?.ema20)}`} />
                          <Metric label="Local Support" value={fmt(item?.local_support)} />
                          <Metric label="Resistance" value={fmt(item?.resistance)} />
                          <Metric
                            label="Fast Drop"
                            value={`${item?.fast_drop || "-"} · 1m ${fmt(item?.fast_drop_1m)}% · 2m ${fmt(item?.fast_drop_2m)}%`}
                          />
                          <Metric label="ML / DL 5m" value={`${fmt(item?.ml_up5, 0)}% / ${fmt(item?.dl_up5, 0)}%`} />
                          <Metric label="DL 10m / 15m" value={`${fmt(item?.dl_up10, 0)}% / ${fmt(item?.dl_up15, 0)}%`} />
                          <Metric label="Sector" value={item?.sector || "-"} />
                          <Metric label="Options" value={`${item?.option_bias || "-"} (${item?.option_score ?? 0})`} />
                          <Metric label="0DTE Key" value={item?.zero_dte_key || item?.zero_dte_label || "-"} />
                          <Metric label="Bid / Ask" value={`${fmt(item?.bid)} / ${fmt(item?.ask)}`} />
                        </div>

                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                          {item?.reason || "분석 데이터를 기다리는 중입니다."}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold text-slate-400">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}
