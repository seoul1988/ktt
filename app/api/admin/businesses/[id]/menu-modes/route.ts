import { NextRequest, NextResponse } from "next/server";
import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Context = { params: Promise<{ id: string }> };
const fields = ["restaurant_menu_menu_enabled", "restaurant_menu_pickup_enabled", "restaurant_menu_delivery_enabled"] as const;
const selectFields = fields.join(",");
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function normalize(row: Record<string, unknown>) {
  const modes = {
    restaurant_menu_menu_enabled: row.restaurant_menu_menu_enabled !== false,
    restaurant_menu_pickup_enabled: row.restaurant_menu_pickup_enabled === true,
    restaurant_menu_delivery_enabled: row.restaurant_menu_delivery_enabled === true,
  };
  if (!Object.values(modes).some(Boolean)) modes.restaurant_menu_menu_enabled = true;
  return modes;
}
async function access(context: Context) {
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) return { response: json({ error: "잘못된 업소 번호입니다." }, 400), id };
  const result = await requireBusinessApiAccess(id);
  return { id, response: result.ok ? null : result.response };
}
export async function GET(_request: NextRequest, context: Context) {
  const allowed = await access(context);
  if (allowed.response) return allowed.response;
  const { data, error } = await supabaseAdmin.from("businesses").select(selectFields).eq("id", allowed.id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "업소를 찾을 수 없습니다." }, 404);
  return json({ modes: normalize(data as unknown as Record<string, unknown>) });
}
export async function PUT(request: NextRequest, context: Context) {
  const allowed = await access(context);
  if (allowed.response) return allowed.response;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "잘못된 요청입니다." }, 400); }
  if (!body || fields.some(field => typeof body[field] !== "boolean")) return json({ error: "주문 방식은 true/false 값이어야 합니다." }, 400);
  if (!fields.some(field => body[field] === true)) return json({ error: "한 가지 이상 선택해 주세요." }, 400);
  const modes = normalize(body);
  const { data: existing, error: readError } = await supabaseAdmin.from("businesses").select("id").eq("id", allowed.id).maybeSingle();
  if (readError) return json({ error: readError.message }, 500);
  if (!existing) return json({ error: "업소를 찾을 수 없습니다." }, 404);
  // Keep the checkout settings consistent with the business order-mode switches.
  const { error: settingsError } = await supabaseAdmin.from("restaurant_order_settings").upsert({
    business_id: allowed.id,
    pickup_enabled: modes.restaurant_menu_pickup_enabled,
    delivery_enabled: modes.restaurant_menu_delivery_enabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: "business_id" });
  if (settingsError) return json({ error: settingsError.message }, 500);
  const { error } = await supabaseAdmin.from("businesses").update(modes).eq("id", allowed.id);
  if (error) return json({ error: error.message }, 500);
  return json({ success: true, modes });
}
