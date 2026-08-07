import "server-only";

type TwilioConfig = { accountSid: string; authToken: string; fromNumber: string };

export async function sendTwilioSms(config: TwilioConfig, to: string, body: string) {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
  const form = new URLSearchParams({ To: to, From: config.fromNumber, Body: body });
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Twilio SMS failed");
  return payload;
}
