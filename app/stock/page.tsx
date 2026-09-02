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
  const [draft, setDraft] = useState("");
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [openSymbol, setOpenSymbol] = useState("");
  const [status, setStatus] = useState("로그인 확인 중...");
  const [busy, setBusy] = useState(false);

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

  const connectWebSocket = useCallback((wsUrl: string) => {
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
    const token = await getAccessToken();
    if (!token) {
      setStatus("로그인 후 사용할 수 있습니다.");
      return;
    }

    const response = await fetch("/api/stocks/session", {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await response.json();
    if (!response.ok) {
      setStatus(data?.error || "Watchlist를 불러오지 못했습니다.");
      return;
    }

    const loaded = Array.isArray(data.symbols) ? data.symbols.slice(0, MAX_SYMBOLS) : [];
    setSymbols(loaded);
    connectWebSocket(data.wsUrl);

    if (renewRef.current) clearTimeout(renewRef.current);
    renewRef.current = setTimeout(() => {
      void openSession();
    }, 4 * 60 * 1000);
  }, [connectWebSocket, getAccessToken]);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
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
        void openSession();
      } else {
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
    const token = await getAccessToken();
    if (!token) {
      setStatus("로그인이 필요합니다.");
      return;
    }

    setBusy(true);
    setStatus("종목 저장 중...");

    try {
      const response = await fetch("/api/stocks/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ symbols: nextSymbols }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "저장 실패");

      setSymbols(data.symbols || []);
      connectWebSocket(data.wsUrl);
      setStatus("저장 완료 · 실시간 분석 연결 중...");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  async function addSymbol() {
    const symbol = cleanSymbol(draft);
    if (!symbol) return;
    if (symbols.includes(symbol)) {
      setDraft("");
      return;
    }
    if (symbols.length >= MAX_SYMBOLS) {
      setStatus("최대 5종목까지 등록할 수 있습니다.");
      return;
    }

    setDraft("");
    await saveWatchlist([...symbols, symbol]);
  }

  async function removeSymbol(symbol: string) {
    const next = symbols.filter((item) => item !== symbol);
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
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(cleanSymbol(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addSymbol();
              }}
              placeholder="예: TSLA"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold uppercase outline-none focus:border-blue-500"
              maxLength={12}
              disabled={busy || symbols.length >= MAX_SYMBOLS}
            />
            <button
              onClick={() => void addSymbol()}
              disabled={busy || symbols.length >= MAX_SYMBOLS}
              className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-40"
            >
              추가
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {symbols.map((symbol) => (
              <button
                key={symbol}
                onClick={() => void removeSymbol(symbol)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700"
                title="삭제"
              >
                {symbol} ×
              </button>
            ))}
            {!symbols.length && (
              <span className="text-sm text-slate-400">등록된 종목이 없습니다.</span>
            )}
          </div>

          <div className="mt-3 text-xs text-slate-500">{status}</div>
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
                      {item?.action || "WAITING"} · Score {item?.score ?? "-"} · Risk {fmt(item?.down_risk, 0)}%
                    </span>
                  </span>
                  <span className="text-right text-lg font-extrabold text-slate-900">
                    {item?.price ? `$${fmt(item.price)}` : "-"}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    {item?.error ? (
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
