import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function hasBadByteStringChar(value: string) {
  return [...value].some((char) => char.charCodeAt(0) > 255);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const subscription = body.subscription;
    const userId = body.userId;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUPABASE_URL이 없습니다." },
        { status: 500 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY가 없습니다." },
        { status: 500 }
      );
    }

    if (!userId) {
      return NextResponse.json({ error: "userId가 없습니다." }, { status: 401 });
    }

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return NextResponse.json(
        { error: "푸시 구독 정보가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const endpoint = String(subscription.endpoint).trim();
    const p256dh = String(subscription.keys.p256dh).trim();
    const auth = String(subscription.keys.auth).trim();
    const userAgent = req.headers.get("user-agent") || "";

    console.log("PUSH ENDPOINT:", endpoint);
    console.log("PUSH P256DH:", p256dh);
    console.log("PUSH AUTH:", auth);
    console.log("PUSH USER_AGENT:", userAgent);

    if (
      hasBadByteStringChar(endpoint) ||
      hasBadByteStringChar(p256dh) ||
      hasBadByteStringChar(auth) ||
      hasBadByteStringChar(userAgent)
    ) {
      return NextResponse.json(
        {
          error:
            "푸시 구독 데이터 안에 잘못된 문자가 있습니다. 기존 Service Worker/구독을 삭제하고 다시 시도하세요.",
        },
        { status: 400 }
      );
    }

    const { error } = await adminSupabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
      },
      {
        onConflict: "endpoint",
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("PUSH SUBSCRIBE API ERROR:", err);

    return NextResponse.json(
      { error: err?.message || "푸시 구독 저장 실패" },
      { status: 500 }
    );
  }
}