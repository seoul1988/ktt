import "server-only";

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

export class TwilioSmsError extends Error {
  readonly acceptanceUnknown: boolean;

  constructor(message: string, acceptanceUnknown = true) {
    super(message);
    this.name = "TwilioSmsError";
    this.acceptanceUnknown = acceptanceUnknown;
  }
}

function normalizePhone(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) {
    const digits = raw.replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return digits ? `+${digits}` : "";
}

type TwilioPayload = {
  sid?: unknown;
  status?: unknown;
  to?: unknown;
  message?: unknown;
  detail?: unknown;
  error?: unknown;
  code?: unknown;
};

function twilioError(
  payload: TwilioPayload,
  fallback: string,
): string {
  const value =
    payload.message ||
    payload.detail ||
    payload.error ||
    payload.code;

  return value ? String(value) : fallback;
}

export function centralTwilioConfig(): TwilioConfig | null {
  const accountSid = String(
    process.env.TWILIO_ACCOUNT_SID || "",
  ).trim();

  const authToken = String(
    process.env.TWILIO_AUTH_TOKEN || "",
  ).trim();

  const fromNumber = normalizePhone(
    process.env.TWILIO_PHONE_NUMBER,
  );

  if (!accountSid || !authToken || !fromNumber) {
    return null;
  }

  return {
    accountSid,
    authToken,
    fromNumber,
  };
}

export function isKtownSmsEnabled() {
  return (
    process.env.NEXT_PUBLIC_TWILIO_SMS_ENABLED === "true" &&
    !!centralTwilioConfig()
  );
}

export async function sendTwilioSms(
  config: TwilioConfig,
  to: string,
  body: string,
) {
  const destination = normalizePhone(to);

  if (!destination) {
    throw new TwilioSmsError(
      "Customer phone number is invalid for SMS.",
      false,
    );
  }

  const accountSid = String(config.accountSid || "").trim();
  const authToken = String(config.authToken || "").trim();
  const fromNumber = normalizePhone(config.fromNumber);

  if (!accountSid || !authToken || !fromNumber) {
    throw new TwilioSmsError(
      "Twilio credentials are incomplete.",
      false,
    );
  }

  const message = String(body || "");

  if (!message.trim()) {
    throw new TwilioSmsError(
      "SMS message body is empty.",
      false,
    );
  }

  // 길이를 초과하는 본문을 조용히 잘라 보내지 않습니다.
  if (message.length > 1600) {
    throw new TwilioSmsError(
      "SMS message body exceeds 1600 characters.",
      false,
    );
  }

  const params = new URLSearchParams({
    To: destination,
    From: fromNumber,
    Body: message,
  });

  let response: Response;

  try {
    response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
        accountSid,
      )}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${accountSid}:${authToken}`,
            ).toString("base64"),
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: params.toString(),
        cache: "no-store",
      },
    );
  } catch {
    // 네트워크 오류여도 Twilio가 이미 접수했을 수 있습니다.
    // 자동 재발송으로 중복 문자가 발생하지 않게 합니다.
    throw new TwilioSmsError(
      "Twilio SMS request failed. Acceptance is unknown.",
      true,
    );
  }

  let payload: TwilioPayload = {};

  try {
    const parsed: unknown = await response.json();

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      payload = parsed as TwilioPayload;
    }
  } catch {
    // 아래에서 HTTP 상태와 SID를 확인합니다.
  }

  if (!response.ok) {
    // 4xx 거절은 접수되지 않은 것으로 처리합니다.
    // HTTP 408 및 기타 응답은 접수 여부가 불확실합니다.
    const definiteRejection =
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 408;

    throw new TwilioSmsError(
      twilioError(
        payload,
        `Twilio SMS failed (HTTP ${response.status}).`,
      ),
      !definiteRejection,
    );
  }

  const sid = String(payload.sid || "").trim();

  if (!sid) {
    throw new TwilioSmsError(
      "Twilio returned success without a message SID. Acceptance is unknown.",
      true,
    );
  }

  return {
    sid,
    status: String(payload.status || ""),
    to: String(payload.to || destination),
  };
}