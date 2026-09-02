import { createHmac } from "crypto";
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
  if (!secret) throw new Error("KTOWN_STOCK_SESSION_SECRET가 없습니다.");

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
    return { user: null, error: "로그인이 필요합니다.", status: 401 };
  }

  const supabase = getAdminClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: "로그인 정보를 확인할 수 없습니다.", status: 401 };
  }

  return { user, error: "", status: 200 };
}

function pythonConfig() {
  const apiBase = (process.env.KTOWN_STOCK_API_URL || "").replace(/\/+$/, "");
  const serverSecret = process.env.KTOWN_STOCK_SERVER_SECRET || "";
  const publicWsBase = (process.env.NEXT_PUBLIC_KTOWN_STOCK_WS_URL || "").replace(/\/+$/, "");

  if (!apiBase || !serverSecret || !publicWsBase) {
    throw new Error("KTown stock server 환경변수를 확인하세요.");
  }

  return { apiBase, serverSecret, publicWsBase };
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("stock_watchlists")
      .select("symbols")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error) throw error;

    const { publicWsBase } = pythonConfig();
    const sessionToken = createSessionToken(auth.user.id);

    return NextResponse.json({
      symbols: normalizeSymbols(data?.symbols || []),
      userId: auth.user.id,
      wsUrl: `${publicWsBase}/ws/${encodeURIComponent(auth.user.id)}?token=${encodeURIComponent(sessionToken)}`,
      expiresIn: 300,
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
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const symbols = normalizeSymbols(body?.symbols);

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

    const { apiBase, serverSecret, publicWsBase } = pythonConfig();

    const pythonResponse = await fetch(`${apiBase}/internal/watchlist`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ktown-secret": serverSecret,
      },
      body: JSON.stringify({
        user_id: auth.user.id,
        symbols,
      }),
      cache: "no-store",
    });

    if (!pythonResponse.ok) {
      const detail = await pythonResponse.text();
      throw new Error(`분석 서버 연결 실패: ${pythonResponse.status} ${detail}`);
    }

    const sessionToken = createSessionToken(auth.user.id);

    return NextResponse.json({
      ok: true,
      symbols,
      userId: auth.user.id,
      wsUrl: `${publicWsBase}/ws/${encodeURIComponent(auth.user.id)}?token=${encodeURIComponent(sessionToken)}`,
      expiresIn: 300,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
