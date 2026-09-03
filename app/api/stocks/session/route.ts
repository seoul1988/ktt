import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const MAX_SYMBOLS = 5;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
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

function makeWsUrl(userId: string) {
  const publicWsBase = (
    process.env.NEXT_PUBLIC_KTOWN_STOCK_WS_URL || ""
  ).replace(/\/+$/, "");
  const secret = process.env.KTOWN_STOCK_SESSION_SECRET || "";

  if (!publicWsBase || !secret) return null;

  const payload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + 5 * 60,
  };

  const payloadPart = b64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(payloadPart)
    .digest();

  const token = `${payloadPart}.${b64url(signature)}`;

  return `${publicWsBase}/ws/${encodeURIComponent(
    userId,
  )}?token=${encodeURIComponent(token)}`;
}

async function requireUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return { user: null, error: "로그인이 필요합니다.", status: 401 };
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

async function syncPc2(userId: string, symbols: string[]) {
  const apiBase = (process.env.KTOWN_STOCK_API_URL || "").replace(/\/+$/, "");
  const serverSecret = process.env.KTOWN_STOCK_SERVER_SECRET || "";

  if (!apiBase || !serverSecret) {
    return {
      ok: false,
      warning: "분석 서버 환경변수가 아직 설정되지 않았습니다.",
    };
  }

  try {
    const response = await fetch(`${apiBase}/internal/watchlist`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ktown-secret": serverSecret,
      },
      body: JSON.stringify({
        user_id: userId,
        symbols,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        warning: `분석 서버 연결 실패: ${response.status} ${detail}`.trim(),
      };
    }

    return { ok: true, warning: "" };
  } catch (error) {
    return {
      ok: false,
      warning:
        error instanceof Error
          ? `분석 서버 연결 실패: ${error.message}`
          : "분석 서버 연결 실패",
    };
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

    const symbols = normalizeSymbols(data?.symbols || []);
    const wsUrl = makeWsUrl(auth.user.id);

    return NextResponse.json({
      ok: true,
      symbols,
      userId: auth.user.id,
      wsUrl,
      expiresIn: wsUrl ? 300 : 0,
      warning: wsUrl
        ? ""
        : "실시간 분석 서버 연결 설정을 기다리는 중입니다.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
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

    // Save first. PC2 being offline must not prevent watchlist persistence.
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

    const sync = await syncPc2(auth.user.id, symbols);
    const wsUrl = makeWsUrl(auth.user.id);

    return NextResponse.json({
      ok: true,
      saved: true,
      symbols,
      userId: auth.user.id,
      wsUrl,
      expiresIn: wsUrl ? 300 : 0,
      pc2Synced: sync.ok,
      warning: sync.warning || (!wsUrl
        ? "실시간 분석 서버 WebSocket 설정을 기다리는 중입니다."
        : ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
