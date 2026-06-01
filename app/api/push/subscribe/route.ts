import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const subscription = body.subscription;
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "userId가 없습니다." },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "관리자만 푸시알림을 등록할 수 있습니다." },
        { status: 403 }
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

    const { error } = await supabase.from("push_subscriptions").upsert(
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