import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const MAX_SYMBOLS = 5;

function getAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase 환경변수를 확인하세요.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBearerToken(request: Request) {
  const auth =
    request.headers.get("authorization") || "";

  return auth.startsWith("Bearer ")
    ? auth.slice(7).trim()
    : "";
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

    if (symbol && !out.includes(symbol)) {
      out.push(symbol);
    }

    if (out.length >= MAX_SYMBOLS) {
      break;
    }
  }

  return out;
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

  return {
    user,
    error: "",
    status: 200,
  };
}

function getPublicWsUrl() {
  const envUrl = (
    process.env.NEXT_PUBLIC_KTOWN_STOCK_WS_URL ||
    ""
  ).trim();

  const wsUrl =
    envUrl ||
    "wss://stock.7pocker.us/ws/public";

  if (
    !wsUrl.startsWith("ws://") &&
    !wsUrl.startsWith("wss://")
  ) {
    throw new Error(
      "NEXT_PUBLIC_KTOWN_STOCK_WS_URL은 ws:// 또는 wss:// 로 시작해야 합니다.",
    );
  }

  return wsUrl;
}

/*
  PUBLIC STOCK SERVER MODE

  Python 서버:
    HTTPS  https://stock.7pocker.us/
    WS     wss://stock.7pocker.us/ws/public

  이 route는 더 이상 다음을 사용하지 않습니다:
    - KTOWN_STOCK_API_URL
    - KTOWN_STOCK_SERVER_SECRET
    - KTOWN_STOCK_SESSION_SECRET
    - /internal/watchlist
    - /ws/{userId}?token=...

  역할:
    1) 로그인 확인
    2) Supabase stock_watchlists 저장/로드
    3) 브라우저에 public websocket 주소 반환
*/

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

    if (error) {
      throw error;
    }

    const wsUrl = getPublicWsUrl();

    return NextResponse.json({
      ok: true,
      symbols: normalizeSymbols(data?.symbols || []),
      userId: auth.user.id,
      wsUrl,
      expiresIn: 0,
      mode: "public",
      serverSynced: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "서버 오류";

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

    const body =
      await request.json().catch(() => ({}));

    const symbols =
      normalizeSymbols(body?.symbols);

    if (!symbols.length) {
      return NextResponse.json(
        {
          error:
            "START할 종목이 없습니다. 종목을 1개 이상 등록하세요.",
        },
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
        {
          onConflict: "user_id",
        },
      );

    if (saveError) {
      throw saveError;
    }

    /*
      중요:
      예전처럼 Python 서버의
      /internal/watchlist 로 POST하지 않습니다.

      public WebSocket에 브라우저가 바로 연결합니다.
    */
    const wsUrl = getPublicWsUrl();

    return NextResponse.json({
      ok: true,
      symbols,
      userId: auth.user.id,
      wsUrl,
      expiresIn: 0,
      mode: "public",
      serverSynced: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "서버 오류";

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

    /*
      PUBLIC WebSocket 모드에서는
      서버측 watchlist 세션을 삭제할 필요가 없습니다.

      STOP 버튼에서 브라우저 WebSocket만 close하면 됩니다.
      Supabase에 저장된 종목은 그대로 유지합니다.
    */
    return NextResponse.json({
      ok: true,
      stopped: true,
      mode: "public",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "서버 오류";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
