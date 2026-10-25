/**
 * Copy to: app/api/email-test/route.ts
 * Server environment variables (never use NEXT_PUBLIC_ for secrets):
 * EMAIL_TEST_ENABLED=true
 * EMAIL_TEST_TOKEN=<a private random password of at least 24 characters>
 * RESEND_API_KEY=<your Resend API key>
 * Recipient is entered in the password-protected test form.
 * Uses the existing sender: K-Town Triangle <noreply@ktowntriangle.com>
 *
 * Open /api/email-test, enter recipient email and EMAIL_TEST_TOKEN, then send.
 * Disable after testing: EMAIL_TEST_ENABLED=false
 * No extra npm dependency. This test does not change orders or customer data.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function page(message = "", status = 200) {
  return new Response(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ktown 이메일 테스트</title><style>
body{font-family:system-ui,sans-serif;background:#f3f4f6;color:#111827;margin:0;padding:28px}main{max-width:480px;margin:40px auto;background:white;padding:28px;border-radius:20px}h1{font-size:24px}p{line-height:1.7;overflow-wrap:anywhere}label{display:block;font-weight:700;margin-top:24px}input,button{box-sizing:border-box;width:100%;padding:14px;border-radius:10px;margin-top:10px}input{border:1px solid #d1d5db}button{background:#111827;color:white;border:0;font-size:16px;cursor:pointer}.result{background:#eef2ff;padding:16px;border-radius:12px;white-space:pre-wrap}
</style></head><body><main><h1>Ktown 이메일 발송 테스트</h1>
<p>아래에 입력한 이메일 주소로 테스트 메일 한 통을 보냅니다. 주문이나 고객 정보는 변경하지 않습니다.</p>
${message ? `<p class="result" role="status">${escapeHtml(message)}</p>` : ""}
<form method="post" action="/api/email-test">
<label for="to">받는 사람 이메일 주소</label>
<input id="to" name="to" type="email" required maxlength="254" placeholder="example@gmail.com" autocomplete="email">
<label for="token">테스트 비밀번호</label>
<input id="token" name="token" type="password" required minlength="24" maxlength="256" autocomplete="off">
<button type="submit">테스트 이메일 보내기</button></form>
<p>발송 접수 후 받은편지함과 스팸함에서 메일을 확인하세요.</p></main></body></html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}

function enabled() {
  return process.env.EMAIL_TEST_ENABLED === "true";
}

export async function GET() {
  if (!enabled()) return new Response("Not found", { status: 404 });
  return page();
}

export async function POST(request: Request) {
  if (!enabled()) return new Response("Not found", { status: 404 });
  const secret = process.env.EMAIL_TEST_TOKEN || "";
  if (secret.length < 24 || secret.length > 256) {
    return page("서버의 EMAIL_TEST_TOKEN을 24~256자로 설정하세요.", 503);
  }
  // The private test token below authorizes sending. Do not compare Origin
  // with request.url: proxies and browser privacy modes can rewrite/omit it.
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    return page("잘못된 요청입니다.", 415);
  }
  const raw = await request.text();
  if (raw.length > 2048) return page("요청이 너무 큽니다.", 413);
  const form = new URLSearchParams(raw);
  const token = form.get("token") || "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(token), digest(secret))) {
    return page("테스트 비밀번호가 올바르지 않습니다.", 401);
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = (form.get("to") || "").trim();
  const from = "K-Town Triangle <noreply@ktowntriangle.com>";
  if (to.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) {
    return page("받는 사람 이메일 주소를 정확히 입력하세요.", 400);
  }
  if (!apiKey) return page("서버의 RESEND_API_KEY 설정을 확인하세요.", 503);
  try {
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [to],
        subject: "[TEST] Ktown 주문 이메일 알림 테스트",
        text: "Ktown 주문 알림 이메일 테스트입니다.\n\n[테스트용 가상 주문]\n식당: Ktown Test Restaurant\n주문번호: TEST-001\n주문방식: Pickup\n상품: Test Menu x 1\n금액: $10.00 (예시)\n상태: 주문 접수 알림 예시\n\n실제 주문이나 결제는 생성되지 않았습니다.\n이 이메일이 보이면 테스트 메일 수신이 확인된 것입니다.",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const payload = await sent.json().catch(() => null);
    if (!sent.ok) {
      return page(`발송이 거절되었습니다 (HTTP ${sent.status}). Resend 대시보드에서 발신 도메인 인증, 수신 주소 제한 및 발송 로그를 확인하세요.`, 502);
    }
    if (!payload || typeof payload.id !== "string" || !payload.id) {
      return page("발송 응답을 확인할 수 없습니다. 재전송 전에 Resend 로그를 확인하세요.", 502);
    }
    return page(`발송 요청이 접수되었습니다.\n받는 주소: ${to}\n메일 ID: ${payload.id}\n\n아직 수신 완료를 뜻하지는 않습니다. 받은편지함과 스팸함을 확인하세요. 새로고침하면 재발송될 수 있습니다.`);
  } catch {
    return page("네트워크 오류 또는 시간 초과입니다. 이미 접수됐을 수 있으니 재전송 전에 받은편지함과 Resend 로그를 확인하세요.", 502);
  }
}
