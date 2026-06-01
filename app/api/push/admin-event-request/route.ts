import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "../../../../lib/supabase";

export async function POST(req: Request) {
  try {
    const publicKey =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:mbsproinc@gmail.com";

    if (!publicKey || !privateKey) {
      return NextResponse.json(
        {
          error:
            "VAPID 키가 없습니다. Vercel Environment Variables를 확인하세요.",
        },
        { status: 500 }
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const body = await req.json();

    const eventId = body.eventId;
    const title = body.title || "새 이벤트";

    const { data: admins, error: adminError } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (adminError) {
      return NextResponse.json(
        { error: adminError.message },
        { status: 500 }
      );
    }

    const adminIds = admins?.map((admin) => admin.id) || [];

    if (adminIds.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        message: "admin 사용자가 없습니다.",
      });
    }

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", adminIds);

    if (subError) {
      return NextResponse.json(
        { error: subError.message },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        message: "푸시알림을 허용한 admin 기기가 없습니다.",
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

        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase
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
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message || "관리자 푸시알림 발송 실패",
      },
      { status: 500 }
    );
  }
}