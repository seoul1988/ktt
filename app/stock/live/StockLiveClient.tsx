"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Snapshot = {
  symbol: string;
  price?: number;
  bid?: number;
  ask?: number;
  action?: string;
  reason?: string;
  forecast?: string;
  score?: number;
  down_risk?: number;
  pnl?: number;
  entry?: number;
  buy60?: number;
  sell60?: number;
  vwap?: number;
  ema9?: number;
  ema20?: number;
  resistance?: number;
  support?: number;
  local_support?: number;
  fast_drop?: string;
  trend_1m?: string;
  trend_score?: number;
  ml_up5?: number;
  dl_up5?: number;
  dl_up10?: number;
  dl_up15?: number;
  sector?: string;
  option_bias?: string;
  option_score?: number;
  vol_x?: number;
};

const MAX_SYMBOLS = 5;

function fmt(v: unknown, d = 2) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : "-";
}

function textTone(value?: string) {
  const v = (value || "").toUpperCase();
  if (v.includes("SELL") || v.includes("DOWN") || v.includes("CRITICAL")) {
    return "bg-red-100 text-red-800 font-black";
  }
  if (v.includes("BUY") || v.includes("UP") || v === "NONE") {
    return "bg-emerald-100 text-emerald-800 font-black";
  }
  if (v.includes("WAIT") || v.includes("WATCH") || v.includes("MIXED") || v.includes("WARNING")) {
    return "bg-amber-100 text-amber-800 font-black";
  }
  return "";
}

function riskTone(value?: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n >= 65) return "bg-red-100 text-red-800 font-black";
  if (n >= 45) return "bg-amber-100 text-amber-800 font-black";
  return "bg-emerald-100 text-emerald-800 font-black";
}

function scoreTone(value?: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n >= 60) return "bg-emerald-100 text-emerald-800 font-black";
  if (n >= 40) return "bg-amber-100 text-amber-800 font-black";
  return "bg-red-100 text-red-800 font-black";
}

export default function StockLiveClient() {
  const wsRef = useRef<WebSocket | null>(null);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [status, setStatus] = useState("페이지 로드됨 · 로그인 확인 중...");
  const [popupSymbol, setPopupSymbol] = useState("");
  const [mobileOpenSymbol, setMobileOpenSymbol] = useState("");

  const connect = useCallback((url?: string | null) => {
    if (!url) {
      setStatus("등록 종목 표시됨 · 분석 서버 연결 대기");
      return;
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setStatus("실시간 분석 서버 연결됨");
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const list: Snapshot[] = Array.isArray(payload?.data) ? payload.data : [];
        setSnapshots((prev) => {
          const next = { ...prev };
          for (const item of list) if (item?.symbol) next[item.symbol] = item;
          return next;
        });
      } catch {}
    };
    ws.onerror = () => setStatus("분석 서버 연결 오류");
    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        setStatus("분석 서버 연결 끊김");
      }
    };
  }, []);

  const load = useCallback(async () => {
    setStatus("로그인 및 등록 종목 확인 중...");
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setStatus(`로그인 확인 오류: ${sessionError.message}`);
      return;
    }
    if (!session?.user) {
      setSymbols([]);
      setStatus("로그인이 필요합니다.");
      return;
    }

    const { data, error } = await supabase
      .from("stock_watchlists")
      .select("symbols")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      setStatus(`등록 종목 불러오기 실패: ${error.message}`);
      return;
    }

    const list = Array.isArray(data?.symbols) ? data.symbols.slice(0, MAX_SYMBOLS) : [];
    setSymbols(list);
    if (!list.length) {
      setStatus("등록된 종목이 없습니다. Market Dashboard에서 종목을 등록하세요.");
      return;
    }

    try {
      const response = await fetch("/api/stocks/session", {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(`연결 실패: ${payload?.error || `HTTP ${response.status}`}`);
      } else if (payload?.wsUrl) {
        connect(payload.wsUrl);
      } else {
        setStatus(payload?.serverWarning || "등록 종목 표시됨 · 분석 서버 연결 대기");
      }
    } catch {
      setStatus("분석 서버 연결 요청 실패");
    }
  }, [connect]);

  const stopLive = useCallback(async () => {
    setStatus("실시간 분석 중지 중...");
    const { data: { session } } = await supabase.auth.getSession();

    try {
      if (session?.access_token) {
        const response = await fetch("/api/stocks/session", {
          method: "DELETE",
          headers: { authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || `HTTP ${response.status}`);
        }
      }

      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        try { ws.close(1000, "User stopped live analysis"); } catch {}
      }
      setStatus("실시간 분석 중지됨");
    } catch (error) {
      setStatus(error instanceof Error ? `STOP 실패: ${error.message}` : "STOP 실패");
    }
  }, []);

  useEffect(() => {
    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => void load());
    return () => {
      subscription.unsubscribe();
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, [load]);

  const rows = Array.from({ length: MAX_SYMBOLS }, (_, i) => {
    const symbol = symbols[i] || "";
    return { symbol, item: symbol ? snapshots[symbol] : undefined };
  });

  const popupItem = popupSymbol ? snapshots[popupSymbol] : undefined;

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-[1600px] px-3 py-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <Link href="/stock" className="text-xs font-black text-blue-600 hover:underline">← Market Dashboard</Link>
            <h1 className="mt-2 text-2xl font-black text-slate-950">LIVE STOCK DATA</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">{status}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700">재연결</button>
            <button
              type="button"
              onClick={() => void stopLive()}
              className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700"
            >
              STOP
            </button>
          </div>
        </div>

        <section className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-700">등록 종목:</span>
            {symbols.length ? symbols.map((symbol) => (
              <span key={symbol} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{symbol}</span>
            )) : <span className="text-xs font-semibold text-slate-400">없음</span>}
          </div>

          <div className="space-y-2 md:hidden">
            {symbols.map((symbol) => {
              const item = snapshots[symbol];
              const isOpen = mobileOpenSymbol === symbol;
              return (
                <div key={symbol} className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setMobileOpenSymbol(isOpen ? "" : symbol)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-lg font-black text-slate-950">{symbol}</div>
                      <div className="text-xl font-black text-blue-700">
                        {item?.price != null ? `$${fmt(item.price)}` : "-"}
                      </div>
                      <span className="text-sm font-black text-slate-400">{isOpen ? "▲" : "▼"}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                      <MobileValue label="ACTION" value={item?.action || "DATA WAIT"} tone={textTone(item?.action)} />
                      <MobileValue label="SCORE" value={item?.score ?? "-"} tone={scoreTone(item?.score)} />
                      <MobileValue label="RISK" value={item?.down_risk != null ? `${fmt(item.down_risk, 0)}%` : "-"} tone={riskTone(item?.down_risk)} />
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-slate-200 bg-slate-50 p-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <MobileDetail label="Forecast" value={item?.forecast || "-"} tone={textTone(item?.forecast)} />
                        <MobileDetail label="1m Trend" value={item?.trend_1m || "-"} tone={textTone(item?.trend_1m)} />
                        <MobileDetail label="Buy60" value={item?.buy60 ?? "-"} />
                        <MobileDetail label="Sell60" value={item?.sell60 ?? "-"} />
                        <MobileDetail label="VWAP" value={item ? fmt(item.vwap) : "-"} />
                        <MobileDetail label="EMA9 / EMA20" value={item ? `${fmt(item.ema9)} / ${fmt(item.ema20)}` : "-"} />
                        <MobileDetail label="Resistance" value={item ? fmt(item.resistance) : "-"} />
                        <MobileDetail label="Support" value={item ? fmt(item.local_support ?? item.support) : "-"} />
                        <MobileDetail label="Fast Drop" value={item?.fast_drop || "-"} tone={textTone(item?.fast_drop)} />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto border border-slate-300 md:block">
            <table className="w-full min-w-[1180px] border-collapse text-[11px]">
              <thead className="bg-slate-100"><tr>
                {["Ticker", "?", "Action", "Price", "Forecast", "Score", "Down Risk", "Buy60", "Sell60", "VWAP", "EMA9", "EMA20", "Resistance", "Support", "Fast Drop", "1m Trend"].map((head) => (
                  <th key={head} className="whitespace-nowrap border-b border-r border-slate-300 px-2 py-2 font-black text-slate-950">{head}</th>
                ))}
              </tr></thead>
              <tbody>
              {rows.map(({ symbol, item }, index) => {
                const isPopupOpen = Boolean(symbol) && popupSymbol === symbol;

                return (
                  <Fragment key={symbol || `empty-${index}`}>
                    <tr className="h-12">
                      <Cell strong>{symbol || "-"}</Cell>
                      <Cell>
                        {symbol ? (
                          <button
                            type="button"
                            onClick={() => setPopupSymbol(symbol)}
                            aria-label={`${symbol} 현재 판단 설명`}
                            aria-expanded={isPopupOpen}
                            className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md font-black text-white transition ${
                              isPopupOpen
                                ? "bg-slate-900"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                          >
                            ?
                          </button>
                        ) : (
                          "-"
                        )}
                      </Cell>
                      <Cell className={symbol ? textTone(item?.action) : ""}>
                        {symbol ? <b>{item?.action || "DATA WAIT"}</b> : "-"}
                      </Cell>
                      <Cell>{item?.price != null ? `$${fmt(item.price)}` : "-"}</Cell>
                      <Cell className={textTone(item?.forecast)}>{item?.forecast || "-"}</Cell>
                      <Cell className={scoreTone(item?.score)}>{item?.score ?? "-"}</Cell>
                      <Cell className={riskTone(item?.down_risk)}>
                        {item?.down_risk != null ? `${fmt(item.down_risk, 0)}%` : "-"}
                      </Cell>
                      <Cell>{item?.buy60 ?? "-"}</Cell>
                      <Cell>{item?.sell60 ?? "-"}</Cell>
                      <Cell>{item ? fmt(item.vwap) : "-"}</Cell>
                      <Cell>{item ? fmt(item.ema9) : "-"}</Cell>
                      <Cell>{item ? fmt(item.ema20) : "-"}</Cell>
                      <Cell>{item ? fmt(item.resistance) : "-"}</Cell>
                      <Cell>{item ? fmt(item.local_support ?? item.support) : "-"}</Cell>
                      <Cell className={textTone(item?.fast_drop)}>{item?.fast_drop || "-"}</Cell>
                      <Cell className={textTone(item?.trend_1m)}>{item?.trend_1m || "-"}</Cell>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            </table>
          </div>
        </section>
      </div>

        {popupSymbol ? (
          <StockWhyModal
            symbol={popupSymbol}
            item={popupItem}
            onClose={() => setPopupSymbol("")}
          />
        ) : null}
    </main>
  );
}


function signalSentence(item?: Snapshot) {
  const action = String(item?.action || "WAIT").toUpperCase();

  if (action.includes("SELL")) {
    return "🔴 현재는 매수보다 포지션 위험 관리가 우선인 신호입니다.";
  }
  if (action.includes("BUY")) {
    return "🟢 매수 조건이 상당 부분 충족된 상태입니다.";
  }
  if (action.includes("WARNING") || action.includes("DANGER")) {
    return "🟠 하락 위험 경고가 감지되었습니다. 신규 진입보다 확인이 우선입니다.";
  }
  return "🟡 WAIT: 일부 조건이 아직 동시에 맞지 않습니다.";
}

function formatK(v?: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));
}

function StockWhyModal({
  symbol,
  item,
  onClose,
}: {
  symbol: string;
  item?: Snapshot;
  onClose: () => void;
}) {
  const support = item?.local_support ?? item?.support;
  const buy = Number(item?.buy60);
  const sell = Number(item?.sell60);
  const totalFlow = buy + sell;
  const buyPct =
    Number.isFinite(totalFlow) && totalFlow > 0
      ? Math.round((buy / totalFlow) * 100)
      : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-[720px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-3">
          <div className="font-black text-slate-950">
            {symbol} — Why? / Current Situation
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-lg font-black text-slate-600 hover:bg-slate-50"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
          <h2 className="text-lg font-black text-slate-950">
            {symbol} 현재 판단 설명
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            실시간 계산값 기준
          </span>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-4 text-[15px] leading-7 text-slate-900">
          <div className="mb-4 text-base font-bold">{symbol} 현재 상황</div>

          <div>
            현재 호가:{" "}
            <b>
              {item?.bid != null ? `$${fmt(item.bid)}` : "-"}
              {" / "}
              {item?.ask != null ? `$${fmt(item.ask)}` : "-"}
            </b>
            {"  |  "}현재가:{" "}
            <b>{item?.price != null ? `$${fmt(item.price)}` : "-"}</b>
          </div>

          <div className="mb-4">
            현재 판단: <b>{item?.action || "WAIT"}</b>
            {"  |  "}Forecast <b>{item?.forecast || "-"}</b>
            {"  |  "}Score <b>{item?.score ?? "-"}</b>
          </div>

          <div className="space-y-1">
            <div>
              🔵 단기 추세: 현재 1분 추세 <b>{item?.trend_1m || "-"}</b>
              {item?.vwap != null && item?.price != null
                ? ` · Price ${item.price >= item.vwap ? "above" : "below"} VWAP $${fmt(item.vwap)}`
                : ""}
            </div>

            <div>
              🟠 EMA: EMA9 <b>{item?.ema9 != null ? `$${fmt(item.ema9)}` : "-"}</b>
              {"  |  "}EMA20 <b>{item?.ema20 != null ? `$${fmt(item.ema20)}` : "-"}</b>
            </div>

            <div>
              🟢 지지 / 저항: 지지{" "}
              <b>{support != null ? `$${fmt(support)}` : "-"}</b>
              {"  |  "}저항{" "}
              <b>{item?.resistance != null ? `$${fmt(item.resistance)}` : "-"}</b>
            </div>

            <div>
              🔴 Fast Drop: <b>{item?.fast_drop || "NONE"}</b>
            </div>

            <div>
              🟢 60초 수급: Buy <b>{formatK(item?.buy60)}</b> / Sell{" "}
              <b>{formatK(item?.sell60)}</b>
              {buyPct != null ? ` — 매수 비중 ${buyPct}%` : ""}
            </div>

            <div>
              ⚪ 거래량: 상대 거래량{" "}
              <b>{item?.vol_x != null ? `${Number(item.vol_x).toFixed(2)}x` : "-"}</b>
            </div>

            <div>
              🔴 조기 하락 경고: Down Risk{" "}
              <b>{item?.down_risk != null ? `${fmt(item.down_risk, 0)}%` : "-"}</b>
            </div>

            <div>
              🟣 모델: ML Up5{" "}
              <b>{item?.ml_up5 != null ? `${fmt(item.ml_up5, 0)}%` : "-"}</b>
              {item?.dl_up5 != null ? ` · DL Up5 ${fmt(item.dl_up5, 0)}%` : ""}
            </div>

            <div>
              Sector: <b>{item?.sector || "-"}</b>
            </div>

            <div>
              Options:{" "}
              <b>
                {item?.option_bias || "N/A"}
                {item?.option_score != null ? ` ${item.option_score >= 0 ? "+" : ""}${item.option_score}` : ""}
              </b>
            </div>
          </div>

          <div className="my-5 border-t border-slate-200" />

          <div className="font-bold">{signalSentence(item)}</div>

          <div className="mt-4">
            프로그램 판단 근거:{" "}
            <b>{item?.reason || "현재 서버가 전달한 판단 근거가 없습니다."}</b>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}


function Cell({ children, strong = false, className = "" }: { children: React.ReactNode; strong?: boolean; className?: string }) {
  return <td className={`whitespace-nowrap border-b border-r border-slate-300 px-2 py-2 text-center ${strong ? "font-black text-slate-950" : "font-medium text-slate-700"} ${className}`}>{children}</td>;
}

function DesktopDetail({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 p-3 ${tone || "bg-white"}`}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-black">{value}</div>
    </div>
  );
}

function MobileValue({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 px-2 py-2 ${tone || "bg-slate-50 text-slate-700"}`}>
      <div className="text-[9px] font-bold opacity-70">{label}</div>
      <div className="mt-0.5 truncate font-black">{value}</div>
    </div>
  );
}

function MobileDetail({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 p-2.5 ${tone || "bg-white"}`}>
      <div className="text-[10px] font-bold text-slate-500">{label}</div>
      <div className="mt-1 font-black">{value}</div>
    </div>
  );
}