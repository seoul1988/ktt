import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function cleanEnv(value: string) {
  return value.replace(/→/g, "").replace(/\s/g, "").trim();
}

function hasBadChar(value: string) {
  return [...value].some((char) => char.charCodeAt(0) > 255);
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
    const publicKey = cleanEnv(process.env.VAPID_PUBLIC_KEY || "");
    const privateKey = cleanEnv(process.env.VAPID_PRIVATE_KEY || "");
    const subject = cleanEnv(
      process.env.VAPID_SUBJECT || "mailto:fcbs2023@gmail.com"
    );

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUPABASE_URL이 없습니다." },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY가 없습니다." },
        { status: 500 }
      );
    }

    if (!publicKey) {
      return NextResponse.json(
        { error: "VAPID_PUBLIC_KEY가 없습니다." },
        { status: 500 }
      );
    }

    if (!privateKey) {
      return NextResponse.json(
        { error: "VAPID_PRIVATE_KEY가 없습니다." },
        { status: 500 }
      );
    }

    if (
      hasBadChar(supabaseUrl) ||
      hasBadChar(serviceRoleKey) ||
      hasBadChar(publicKey) ||
      hasBadChar(privateKey) ||
      hasBadChar(subject)
    ) {
      return NextResponse.json(
        { error: "환경변수 안에 잘못된 문자가 있습니다." },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const body = await req.json();

    const eventId = body.eventId;
    const title = body.title || "새 이벤트";

    const { data: admins, error: adminError } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (adminError) {
      return NextResponse.json(
        { error: adminError.message, step: "admin_select" },
        { status: 500 }
      );
    }

    const adminIds = admins?.map((admin) => admin.id) || [];

    if (adminIds.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        failed: 0,
        reason: "관리자 role=admin 계정이 없습니다.",
      });
    }

    const { data: subscriptions, error: subError } = await adminSupabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", adminIds);

    if (subError) {
      return NextResponse.json(
        { error: subError.message, step: "subscription_select" },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        failed: 0,
        adminCount: adminIds.length,
        reason: "관리자 푸시 구독 정보가 없습니다.",
      });
    }

    const payload = JSON.stringify({
      title: "새 이벤트 승인 요청",
      body: `"${title}" 이벤트가 등록되었습니다. 승인해 주세요.`,
      url: "/admin/event-requests",
      eventId,
    });

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );

        sent++;
      } catch (err: any) {
        failed++;
        errors.push(err?.message || String(err));

        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await adminSupabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      adminCount: adminIds.length,
      subscriptionCount: subscriptions.length,
      errors,
    });
  } catch (err: any) {
    console.error("ADMIN EVENT PUSH ERROR:", err);

    return NextResponse.json(
      {
        error: err?.message || "관리자 푸시알림 발송 실패",
        details: err?.stack || "",
      },
      { status: 500 }
    );
  }
}