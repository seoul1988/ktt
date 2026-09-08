import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const MAX_SYMBOLS = 5;
const PYTHON_TIMEOUT_MS = 8000;

function getAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase 환경변수를 확인하세요.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getBearerToken(request: Request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

function normalizeSymbols(input: unknown) {
  if (!Array.isArray(input)) return [];

  const out: string[] = [];
  for (const raw of input) {
    const symbol = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9.\-]/g, "")
      .slice(0, 12);

    if (symbol && !out.includes(symbol)) out.push(symbol);
    if (out.length >= MAX_SYMBOLS) break;
  }
  return out;
}

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createSessionToken(userId: string) {
  const secret = process.env.KTOWN_STOCK_SESSION_SECRET;
  if (!secret) {
    throw new Error("KTOWN_STOCK_SESSION_SECRET가 없습니다.");
  }

  const payload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + 5 * 60,
  };

  const payloadPart = b64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(payloadPart)
    .digest();

  return `${payloadPart}.${b64url(signature)}`;
}

async function requireUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      user: null,
      error: "로그인이 필요합니다.",
      status: 401,
    };
  }

  const supabase = getAdminClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      error: "로그인 정보를 확인할 수 없습니다.",
      status: 401,
    };
  }

  return { user, error: "", status: 200 };
}

function stockServerConfig() {
  const apiBase = (process.env.KTOWN_STOCK_API_URL || "")
    .trim()
    .replace(/\/+$/, "");

  const serverSecret =
    (process.env.KTOWN_STOCK_SERVER_SECRET || "").trim();

  const publicWsBase =
    (process.env.NEXT_PUBLIC_KTOWN_STOCK_WS_URL || "")
      .trim()
      .replace(/\/+$/, "");

  return {
    apiBase,
    serverSecret,
    publicWsBase,
    apiReady: Boolean(apiBase && serverSecret),
    wsReady: Boolean(publicWsBase),
  };
}

function makeWsUrl(userId: string, publicWsBase: string) {
  if (!publicWsBase) return null;

  if (
    !publicWsBase.startsWith("ws://") &&
    !publicWsBase.startsWith("wss://")
  ) {
    throw new Error(
      "NEXT_PUBLIC_KTOWN_STOCK_WS_URL은 ws:// 또는 wss:// 로 시작해야 합니다.",
    );
  }

  const sessionToken = createSessionToken(userId);

  return (
    `${publicWsBase}/ws/${encodeURIComponent(userId)}` +
    `?token=${encodeURIComponent(sessionToken)}`
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = PYTHON_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);

    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("stock_watchlists")
      .select("symbols")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error) throw error;

    const config = stockServerConfig();

    let wsUrl: string | null = null;
    let serverWarning = "";

    if (config.wsReady) {
      wsUrl = makeWsUrl(auth.user.id, config.publicWsBase);
    } else {
      serverWarning =
        "NEXT_PUBLIC_KTOWN_STOCK_WS_URL 환경변수가 없습니다.";
    }

    return NextResponse.json({
      ok: true,
      symbols: normalizeSymbols(data?.symbols || []),
      userId: auth.user.id,
      wsUrl,
      expiresIn: wsUrl ? 300 : 0,
      serverWarning,
      config: {
        apiReady: config.apiReady,
        wsReady: config.wsReady,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "서버 오류";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);

    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbols = normalizeSymbols(body?.symbols);

    if (!symbols.length) {
      return NextResponse.json(
        { error: "START할 종목이 없습니다." },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();

    const { error: saveError } = await supabase
      .from("stock_watchlists")
      .upsert(
        {
          user_id: auth.user.id,
          symbols,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (saveError) throw saveError;

    const config = stockServerConfig();

    if (!config.apiReady) {
      return NextResponse.json(
        {
          ok: false,
          symbols,
          userId: auth.user.id,
          wsUrl: null,
          serverSynced: false,
          error:
            "분석 서버 환경변수가 없습니다. KTOWN_STOCK_API_URL / KTOWN_STOCK_SERVER_SECRET를 확인하세요.",
          config: {
            apiReady: config.apiReady,
            wsReady: config.wsReady,
          },
        },
        { status: 503 },
      );
    }

    let pythonResponse: Response;

    try {
      pythonResponse = await fetchWithTimeout(
        `${config.apiBase}/internal/watchlist`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-ktown-secret": config.serverSecret,
          },
          body: JSON.stringify({
            user_id: auth.user.id,
            symbols,
          }),
        },
      );
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.toLowerCase().includes("abort"));

      return NextResponse.json(
        {
          ok: false,
          symbols,
          userId: auth.user.id,
          wsUrl: null,
          serverSynced: false,
          error: timedOut
            ? `제2 PC 분석 서버가 ${PYTHON_TIMEOUT_MS / 1000}초 안에 응답하지 않았습니다.`
            : "제2 PC 분석 서버에 연결할 수 없습니다.",
          detail:
            error instanceof Error ? error.message : String(error),
          apiTarget: `${config.apiBase}/internal/watchlist`,
        },
        { status: 503 },
      );
    }

    const responseText = await pythonResponse.text();

    let pythonData: Record<string, unknown> = {};
    try {
      pythonData = responseText
        ? JSON.parse(responseText)
        : {};
    } catch {
      pythonData = {};
    }

    if (!pythonResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          symbols,
          userId: auth.user.id,
          wsUrl: null,
          serverSynced: false,
          error: `분석 서버가 HTTP ${pythonResponse.status}를 반환했습니다.`,
          detail:
            (pythonData?.detail as string) ||
            (pythonData?.error as string) ||
            responseText ||
            "응답 내용 없음",
          apiTarget: `${config.apiBase}/internal/watchlist`,
        },
        { status: 502 },
      );
    }

    if (!config.wsReady) {
      return NextResponse.json(
        {
          ok: false,
          symbols,
          userId: auth.user.id,
          wsUrl: null,
          serverSynced: true,
          error:
            "분석 서버에는 종목이 전달됐지만 NEXT_PUBLIC_KTOWN_STOCK_WS_URL이 없습니다.",
        },
        { status: 503 },
      );
    }

    const wsUrl = makeWsUrl(
      auth.user.id,
      config.publicWsBase,
    );

    return NextResponse.json({
      ok: true,
      symbols,
      userId: auth.user.id,
      wsUrl,
      expiresIn: 300,
      serverSynced: true,
      python: pythonData,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "서버 오류";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireUser(request);

    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const config = stockServerConfig();

    if (!config.apiReady) {
      return NextResponse.json(
        {
          error:
            "KTOWN_STOCK_API_URL / KTOWN_STOCK_SERVER_SECRET 환경변수를 확인하세요.",
        },
        { status: 503 },
      );
    }

    let pythonResponse: Response;

    try {
      pythonResponse = await fetchWithTimeout(
        `${config.apiBase}/internal/watchlist/${encodeURIComponent(
          auth.user.id,
        )}`,
        {
          method: "DELETE",
          headers: {
            "x-ktown-secret": config.serverSecret,
          },
        },
      );
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.toLowerCase().includes("abort"));

      return NextResponse.json(
        {
          error: timedOut
            ? `분석 서버가 ${PYTHON_TIMEOUT_MS / 1000}초 안에 응답하지 않았습니다.`
            : "분석 서버 STOP 연결 실패",
        },
        { status: 503 },
      );
    }

    const data = await pythonResponse.json().catch(() => ({}));

    if (!pythonResponse.ok) {
      return NextResponse.json(
        {
          error:
            data?.detail ||
            data?.error ||
            "분석 서버 STOP 실패",
        },
        { status: pythonResponse.status },
      );
    }

    // Supabase watchlist는 유지하고
    // PC #2의 실행 목록에서만 제거합니다.
    return NextResponse.json({
      ok: true,
      stopped: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "서버 오류";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
