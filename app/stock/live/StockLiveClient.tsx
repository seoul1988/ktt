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
  prev_close?: number;
  day_change_pct?: number;
};

const MAX_SYMBOLS = 5;

function fmt(v: unknown, d = 2) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : "-";
}

function dayChangePct(item?: Snapshot): number | null {
  const direct = Number(item?.day_change_pct);
  if (Number.isFinite(direct)) return direct;

  const price = Number(item?.price);
  const prev = Number(item?.prev_close);
  if (!Number.isFinite(price) || !Number.isFinite(prev) || prev <= 0) return null;

  return ((price - prev) / prev) * 100;
}

function DayChangeBadge({ item }: { item?: Snapshot }) {
  const pct = dayChangePct(item);

  if (pct == null) {
    return <span className="text-xs font-bold text-slate-400">전일 대비 -</span>;
  }

  const up = pct > 0;
  const down = pct < 0;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${
        up
          ? "bg-emerald-50 text-emerald-700"
          : down
            ? "bg-red-50 text-red-700"
            : "bg-slate-100 text-slate-600"
      }`}
    >
      {up ? "▲" : down ? "▼" : "—"} {Math.abs(pct).toFixed(2)}%
    </span>
  );
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

function publicRiskStatus(item?: Snapshot) {
  const risk = Number(item?.down_risk);
  const fastDrop = String(item?.fast_drop || "").toUpperCase();

  if (fastDrop.includes("CRITICAL") || (Number.isFinite(risk) && risk >= 75)) {
    return {
      label: "고위험",
      detail: "단기 하락 위험이 매우 높게 감지되었습니다.",
      tone: "bg-red-100 text-red-800 font-black",
    };
  }

  if (fastDrop.includes("WARNING") || (Number.isFinite(risk) && risk >= 60)) {
    return {
      label: "하락 위험",
      detail: "단기 하락 위험이 높게 감지되었습니다.",
      tone: "bg-red-100 text-red-800 font-black",
    };
  }

  if (fastDrop.includes("WATCH") || (Number.isFinite(risk) && risk >= 45)) {
    return {
      label: "위험 관찰",
      detail: "단기 하락 위험 신호를 관찰 중입니다.",
      tone: "bg-amber-100 text-amber-800 font-black",
    };
  }

  return {
    label: "",
    detail: "",
    tone: "",
  };
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
  holidays.set(
    `${goodFriday.getUTCFullYear()}-${String(goodFriday.getUTCMonth() + 1).padStart(2, "0")}-${String(goodFriday.getUTCDate()).padStart(2, "0")}`,
    "Good Friday",
  );

  holidays.set(`${year}-05-${String(lastWeekdayOfMonth(year, 5, 1)).padStart(2, "0")}`, "Memorial Day");
  holidays.set(observedFixedHoliday(year, 6, 19), "Juneteenth");
  holidays.set(observedFixedHoliday(year, 7, 4), "Independence Day");
  holidays.set(`${year}-09-${String(nthWeekdayOfMonth(year, 9, 1, 1)).padStart(2, "0")}`, "Labor Day");
  holidays.set(`${year}-11-${String(nthWeekdayOfMonth(year, 11, 4, 4)).padStart(2, "0")}`, "Thanksgiving Day");
  holidays.set(observedFixedHoliday(year, 12, 25), "Christmas Day");
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
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) {
    return { code: "OPEN", label: "LIVE", detail: "Regular market open" };
  }

  return {
    code: "CLOSED",
    label: et.hour >= 16 ? "장 마감" : "장 시작 전",
    detail: et.hour >= 16 ? "Regular market closed at 4:00 PM ET" : "Opens at 9:30 AM ET",
  };
}

export default function StockLiveClient() {
  const wsRef = useRef<WebSocket | null>(null);
  const bootstrappedRef = useRef(false);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [status, setStatus] = useState("페이지 로드됨 · 로그인 확인 중...");
  const [marketState, setMarketState] = useState<MarketState>(() => getMarketState());
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
    ws.onopen = () => setStatus("PC #2 직접 WebSocket 연결됨 · Vercel 실시간 폴링 없음");
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

    const currentMarket = getMarketState();
    setMarketState(currentMarket);
    if (currentMarket.code !== "OPEN") {
      setStatus(`${currentMarket.label} · ${currentMarket.detail} · 실시간 연결 안 함`);
      return;
    }

    try {
      // Vercel은 여기서 딱 한 번, 보안용 WebSocket URL/token 발급에만 사용합니다.
      // 이후 1초 실시간 데이터는 브라우저가 PC #2(stock.7pocker.us)에서 직접 받습니다.
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

  const stopLive = useCallback(() => {
    // Vercel API를 호출하지 않고 브라우저 ↔ PC #2 WebSocket만 종료합니다.
    // PC #2 서버는 WebSocket disconnect를 감지해 자체 정리합니다.
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      try { ws.close(1000, "User stopped live analysis"); } catch {}
    }
    setStatus("실시간 분석 중지됨 · PC #2 WebSocket 종료");
  }, []);

  useEffect(() => {
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      void load();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // 로그인 상태가 실제로 바뀐 경우에만 다시 bootstrap 합니다.
      if (!session?.user) {
        setSymbols([]);
        setSnapshots({});
        setStatus("로그인이 필요합니다.");
        if (wsRef.current) {
          try { wsRef.current.close(); } catch {}
          wsRef.current = null;
        }
        return;
      }

      if (!wsRef.current) {
        void load();
      }
    });

    return () => {
      subscription.unsubscribe();
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = getMarketState();
      setMarketState(next);

      if (next.code !== "OPEN") {
        if (wsRef.current) {
          const ws = wsRef.current;
          wsRef.current = null;
          try { ws.close(1000, "Market closed"); } catch {}
        }
        setStatus(`${next.label} · ${next.detail} · 실시간 연결 중지`);
        return;
      }

      // 페이지를 계속 켜둔 경우 다음 정상 거래일 9:30 AM ET에 자동 연결.
      if (!wsRef.current) {
        void load();
      }
    }, 30_000);

    return () => window.clearInterval(timer);
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
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
              ⚠️ 참고 자료용입니다. 본 페이지의 주가 데이터, 분석 신호, 예측 및 지표는
              투자 권유 또는 매수·매도 추천이 아닙니다. 실제 투자 결정은 본인의 판단과
              책임으로 하시기 바랍니다.
            </div>
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

                      <div className="ml-auto flex items-center gap-2">
                        <div className="text-xl font-black text-blue-700">
                          {item?.price != null ? `$${fmt(item.price)}` : "-"}
                        </div>
                        <DayChangeBadge item={item} />
                      </div>

                      <span className="text-sm font-black text-slate-400">{isOpen ? "▲" : "▼"}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                      <MobileValue
                        label="위험 신호"
                        value={publicRiskStatus(item).label || "-"}
                        tone={publicRiskStatus(item).tone}
                      />
                      <MobileValue
                        label="하락 위험"
                        value={item?.down_risk != null ? `${fmt(item.down_risk, 0)}%` : "-"}
                        tone={riskTone(item?.down_risk)}
                      />
                      <MobileValue label="분석 점수" value={item?.score ?? "-"} tone={scoreTone(item?.score)} />
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-slate-200 bg-slate-50 p-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <MobileDetail label="1m Trend" value={item?.trend_1m || "-"} tone={textTone(item?.trend_1m)} />
                        <MobileDetail
                          label="위험 상태"
                          value={publicRiskStatus(item).label || "-"}
                          tone={publicRiskStatus(item).tone}
                        />
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
                {["Ticker", "?", "위험 신호", "Price", "전일 대비", "Score", "Down Risk", "VWAP", "EMA9", "EMA20", "Resistance", "Support", "Fast Drop", "1m Trend"].map((head) => (
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
                            aria-label={`${symbol} 위험 정보 설명`}
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
                      <Cell className={symbol ? publicRiskStatus(item).tone : ""}>
                        {symbol ? <b>{publicRiskStatus(item).label || "-"}</b> : "-"}
                      </Cell>
                      <Cell>{item?.price != null ? `$${fmt(item.price)}` : "-"}</Cell>
                      <Cell>
                        {symbol ? <DayChangeBadge item={item} /> : "-"}
                      </Cell>
                      <Cell className={scoreTone(item?.score)}>{item?.score ?? "-"}</Cell>
                      <Cell className={riskTone(item?.down_risk)}>
                        {item?.down_risk != null ? `${fmt(item.down_risk, 0)}%` : "-"}
                      </Cell>
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
  const risk = publicRiskStatus(item);

  if (risk.label) {
    return `⚠️ ${risk.detail}`;
  }

  return "현재 공개 화면에 표시할 수준의 단기 하락 위험 경고는 없습니다.";
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
            {symbol} — Risk Information
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
            {symbol} 위험 정보
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
            {"  |  "}전일 대비:{" "}
            <DayChangeBadge item={item} />
          </div>

          <div className="mb-4">
            위험 상태: <b>{publicRiskStatus(item).label || "특이 위험 없음"}</b>
            {"  |  "}하락 위험 <b>{item?.down_risk != null ? `${fmt(item.down_risk, 0)}%` : "-"}</b>
            {"  |  "}분석 점수 <b>{item?.score ?? "-"}</b>
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
            위험 안내:{" "}
            <b>{publicRiskStatus(item).detail || "현재 공개 화면에 표시할 수준의 단기 하락 위험 경고는 없습니다."}</b>
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
