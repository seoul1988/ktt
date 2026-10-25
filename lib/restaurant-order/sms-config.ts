import { createDecipheriv, hkdfSync } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// SERVER ONLY. Install: lib/restaurant-order/sms-config.ts
// Matches encryption used by api/owner/business/[id]/sms-settings/route.ts.
export type RestaurantSmsConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  messagingServiceSid: string;
};

function decryptToken(value: string, businessId: number) {
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Invalid token format");
  const secret = process.env.TWILIO_SETTINGS_ENCRYPTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing encryption secret");
  const key = Buffer.from(hkdfSync("sha256", secret, "ktown-twilio-settings-v1", "auth-token", 32));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "base64"));
  decipher.setAAD(Buffer.from(String(businessId)));
  decipher.setAuthTag(Buffer.from(parts[2], "base64"));
  return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64")), decipher.final()]).toString("utf8");
}

export function normalizeSmsPhone(value: unknown): string | null {
  const raw = String(value || "").trim();
  // Accept formatting characters, but never concatenate extensions or letters.
  if (!raw || /[^+\d\s().-]/.test(raw) || (raw.includes("+") && !/^\+[^+]+$/.test(raw))) return null;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  if (/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return `+1${digits}`;
  if (/^1[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return `+${digits}`;
  return null;
}

export async function getRestaurantSmsConfig(
  db: SupabaseClient,
  businessId: number,
): Promise<RestaurantSmsConfig | null> {
  // Explicit false remains an emergency/program opt-out switch. For new
  // per-business configuration, enabling SMS in the owner panel is sufficient.
  if (process.env.NEXT_PUBLIC_TWILIO_SMS_ENABLED === "false") return null;
  try {
    const { data: settings, error: settingsError } = await db.from("restaurant_order_settings")
      .select("sms_enabled").eq("business_id", businessId).maybeSingle();
    if (settingsError || settings?.sms_enabled !== true) return null;
    const { data: row, error } = await db.from("restaurant_sms_private_settings")
      .select("account_sid,auth_token_encrypted,from_number,messaging_service_sid")
      .eq("business_id", businessId).maybeSingle();
    if (error) {
      // Only a not-yet-installed table may use the legacy path. Fail closed for
      // network/auth/database errors. Never log credential values.
      if (!["42P01", "PGRST205"].includes(error.code)) return null;
    }
    if (row) {
      const accountSid = String(row.account_sid || "").trim();
      const fromNumber = String(row.from_number || "").trim();
      const messagingServiceSid = String(row.messaging_service_sid || "").trim();
      if (!/^AC[0-9a-f]{32}$/i.test(accountSid) || !row.auth_token_encrypted) return null;
      if (!normalizeSmsPhone(fromNumber) && !/^MG[0-9a-f]{32}$/i.test(messagingServiceSid)) return null;
      const authToken = decryptToken(String(row.auth_token_encrypted), businessId);
      if (!/^[0-9a-f]{32}$/i.test(authToken)) return null;
      return { accountSid, authToken, fromNumber: normalizeSmsPhone(fromNumber) || "", messagingServiceSid };
    }
    // Preserve the existing approval switch for legacy credentials.
    if (process.env.NEXT_PUBLIC_TWILIO_SMS_ENABLED !== "true") return null;
    const { data: legacy, error: legacyError } = await db.from("restaurant_order_private_settings")
      .select("twilio_account_sid,twilio_auth_token,twilio_phone_number")
      .eq("business_id", businessId).maybeSingle();
    if (legacyError) return null;
    const accountSid = String(legacy?.twilio_account_sid || "").trim();
    const authToken = String(legacy?.twilio_auth_token || "").trim();
    const fromNumber = normalizeSmsPhone(legacy?.twilio_phone_number);
    if (!/^AC[0-9a-f]{32}$/i.test(accountSid) || !/^[0-9a-f]{32}$/i.test(authToken) || !fromNumber) return null;
    return { accountSid, authToken, fromNumber, messagingServiceSid: "" };
  } catch { return null; }
}
