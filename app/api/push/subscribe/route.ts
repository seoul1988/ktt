import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

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
      return NextResponse.json(
        { error: "userId가 없습니다." },
        { status: 401 }
      );
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

    const { error } = await adminSupabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: req.headers.get("user-agent"),
      },
      {
        onConflict: "endpoint",
      }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "푸시 구독 저장 실패" },
      { status: 500 }
    );
  }
}