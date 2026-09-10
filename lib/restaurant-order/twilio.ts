import "server-only";

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

function normalizePhone(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) {
    const digits = raw.replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

function twilioError(payload: any, fallback: string) {
  return (
    payload?.message ||
    payload?.detail ||
    payload?.error ||
    payload?.code ||
    fallback
  );
}

export function centralTwilioConfig(): TwilioConfig | null {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const fromNumber = normalizePhone(process.env.TWILIO_PHONE_NUMBER);

  if (!accountSid || !authToken || !fromNumber) return null;

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
    throw new Error("Customer phone number is invalid for SMS.");
  }

  const accountSid = String(config.accountSid || "").trim();
  const authToken = String(config.authToken || "").trim();
  const fromNumber = normalizePhone(config.fromNumber);

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio credentials are incomplete.");
  }

  const params = new URLSearchParams({
    To: destination,
    From: fromNumber,
    Body: String(body || "").slice(0, 1500),
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      accountSid,
    )}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params.toString(),
      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      twilioError(
        payload,
        `Twilio SMS failed (HTTP ${response.status}).`,
      ),
    );
  }

  return {
    sid: String(payload?.sid || ""),
    status: String(payload?.status || ""),
    to: String(payload?.to || destination),
  };
}
