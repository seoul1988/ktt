import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getOrderAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireOrderOwner(request: Request, businessId: number) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { ok: false as const, status: 401, error: "로그인이 필요합니다." };
  const db = getOrderAdmin();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return { ok: false as const, status: 401, error: "로그인 정보를 확인할 수 없습니다." };
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role === "admin") return { ok: true as const, userId: user.id, isAdmin: true };
  const { data: owner, error: ownerError } = await db.from("business_owners").select("business_id").eq("business_id", businessId).eq("user_id", user.id).eq("status", "approved").maybeSingle();
  if (ownerError) throw ownerError;
  if (!owner) return { ok: false as const, status: 403, error: "이 비즈니스를 관리할 권한이 없습니다." };
  return { ok: true as const, userId: user.id, isAdmin: false };
}

export function cleanPhone(value: unknown) {
  return String(value || "").replace(/[^0-9+]/g, "").slice(0, 20);
}

export function moneyCents(value: number) {
  return Math.max(0, Math.round(value * 100));
}
