import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ContactPayload = {
  businessId?: number | string;
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  website?: string;
  pageUrl?: string;
};

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "서버의 Supabase 환경변수가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as ContactPayload;

    // Honeypot: 사람에게 보이지 않는 필드가 채워졌으면 조용히 성공 처리
    if (clean(body.website, 200)) {
      return NextResponse.json({ ok: true });
    }

    const businessId = Number(body.businessId);
    const name = clean(body.name, 120);
    const email = clean(body.email, 240);
    const phone = clean(body.phone, 80);
    const subject = clean(body.subject, 200);
    const message = clean(body.message, 5000);
    const pageUrl = clean(body.pageUrl, 1000);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "올바른 비즈니스 정보가 아닙니다." },
        { status: 400 },
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "문의 내용을 입력해주세요." },
        { status: 400 },
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "올바른 이메일 주소를 입력해주세요." },
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id,name")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: "비즈니스를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const ipAddress = forwardedFor.split(",")[0]?.trim() || null;
    const userAgent = clean(request.headers.get("user-agent"), 500) || null;

    // 동일 IP의 최근 전송 횟수 제한: 10분에 5회
    if (ipAddress) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("ip_address", ipAddress)
        .gte("created_at", tenMinutesAgo);

      if ((count || 0) >= 5) {
        return NextResponse.json(
          { error: "잠시 후 다시 시도해주세요." },
          { status: 429 },
        );
      }
    }

    const { data: insertedMessage, error: insertError } = await supabase
      .from("contact_messages")
      .insert({
        business_id: businessId,
        sender_name: name || null,
        sender_email: email || null,
        sender_phone: phone || null,
        subject: subject || null,
        message,
        page_url: pageUrl || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        status: "new",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("contact_messages insert error:", insertError);
      return NextResponse.json(
        { error: "문의 저장에 실패했습니다." },
        { status: 500 },
      );
    }

    const { data: ownerRows, error: ownerError } = await supabase
      .from("business_owners")
      .select("user_id")
      .eq("business_id", businessId);

    if (ownerError) {
      console.error("business_owners lookup error:", ownerError);
    }

    const ownerEmails: string[] = [];

    for (const row of ownerRows || []) {
      const userId = String(row.user_id || "").trim();
      if (!userId) continue;

      const { data: userResult, error: userError } =
        await supabase.auth.admin.getUserById(userId);

      if (userError) {
        console.error("owner auth lookup error:", userError);
        continue;
      }

      const ownerEmail = String(userResult.user?.email || "")
        .trim()
        .toLowerCase();

      if (ownerEmail && !ownerEmails.includes(ownerEmail)) {
        ownerEmails.push(ownerEmail);
      }
    }

    let emailSent = false;
    let emailErrorText = "";

    const resendApiKey = process.env.RESEND_API_KEY;

    // CONTACT_FROM_EMAIL에는 주소만 넣어도 되고,
    // "KTown Triangle <noreply@ktowntriangle.com>"처럼 이름과 주소를 함께 넣어도 됩니다.
    const configuredFromEmail =
      process.env.CONTACT_FROM_EMAIL ||
      "KTown Triangle <onboarding@resend.dev>";

    if (resendApiKey && ownerEmails.length > 0) {
      const businessName = String(business.name || "Business").trim();
      const safeBusinessName = escapeHtml(businessName);
      const replyTo = email || undefined;
      const emailSubject = `[${businessName}] ${
        subject || "새 문의가 도착했습니다"
      }`;

      // 발신 주소는 인증된 KTown Triangle 주소를 그대로 사용하고,
      // 표시 이름만 비즈니스 이름으로 바꿉니다.
      //
      // 예:
      // CONTACT_FROM_EMAIL=KTown Triangle <noreply@ktowntriangle.com>
      // 실제 표시: Buns Burgers via KTown Triangle <noreply@ktowntriangle.com>
      const emailAddressMatch = configuredFromEmail.match(/<([^>]+)>/);
      const verifiedEmailAddress = (
        emailAddressMatch?.[1] || configuredFromEmail
      ).trim();

      const dynamicFrom = `${businessName} via KTown Triangle <${verifiedEmailAddress}>`;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: dynamicFrom,
          to: ownerEmails,
          reply_to: replyTo,
          subject: emailSubject,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#111827">
              <h2 style="margin-bottom:8px">${safeBusinessName} 새 문의</h2>
              <p style="color:#6b7280;margin-top:0">웹사이트 문의 폼에서 접수되었습니다.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:20px">
                <tr><td style="padding:10px;border:1px solid #e5e7eb;font-weight:700;width:120px">이름</td><td style="padding:10px;border:1px solid #e5e7eb">${escapeHtml(name || "-")}</td></tr>
                <tr><td style="padding:10px;border:1px solid #e5e7eb;font-weight:700">이메일</td><td style="padding:10px;border:1px solid #e5e7eb">${escapeHtml(email || "-")}</td></tr>
                <tr><td style="padding:10px;border:1px solid #e5e7eb;font-weight:700">전화번호</td><td style="padding:10px;border:1px solid #e5e7eb">${escapeHtml(phone || "-")}</td></tr>
                <tr><td style="padding:10px;border:1px solid #e5e7eb;font-weight:700">제목</td><td style="padding:10px;border:1px solid #e5e7eb">${escapeHtml(subject || "-")}</td></tr>
              </table>
              <div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:12px;white-space:pre-wrap;line-height:1.7">${escapeHtml(message)}</div>
              ${
                email
                  ? `<p style="margin-top:18px;padding:12px 14px;background:#eff6ff;border-radius:10px;color:#1e3a8a;font-size:13px;font-weight:700">이 메일에서 답장을 누르면 문의한 고객(${escapeHtml(email)})에게 바로 전송됩니다.</p>`
                  : ""
              }
              ${pageUrl ? `<p style="margin-top:18px;color:#6b7280;font-size:12px">페이지: ${escapeHtml(pageUrl)}</p>` : ""}
            </div>
          `,
        }),
      });

      if (response.ok) {
        emailSent = true;
      } else {
        emailErrorText = await response.text();
        console.error("Resend error:", emailErrorText);
      }
    }

    await supabase
      .from("contact_messages")
      .update({
        email_sent: emailSent,
        email_sent_at: emailSent ? new Date().toISOString() : null,
        email_error:
          !emailSent && emailErrorText ? emailErrorText.slice(0, 1000) : null,
      })
      .eq("id", insertedMessage.id);

    return NextResponse.json({
      ok: true,
      messageId: insertedMessage.id,
      emailSent,
      ownerEmailFound: ownerEmails.length > 0,
    });
  } catch (error) {
    console.error("business-contact route error:", error);
    return NextResponse.json(
      { error: "문의 전송 중 서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}