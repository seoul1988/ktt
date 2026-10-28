import { NextResponse } from "next/server";
import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isTemplateDocument } from "@/lib/website/template-document";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const headers = { "Cache-Control": "no-store" };
export async function GET(_request: Request, context: { params: Promise<{ id: string; templateId: string }> }) {
  const { id, templateId } = await context.params;
  const businessId = Number(id);
  if (!Number.isSafeInteger(businessId) || businessId <= 0 || !/^restaurant-[123]$/.test(templateId)) {
    return NextResponse.json({ error: "Invalid template request." }, { status: 400, headers });
  }
  const access = await requireBusinessApiAccess(businessId);
  if (!access.ok) return access.response;
  try {
    const active = await supabaseAdmin.from("restaurant_template_active").select("version").eq("template_id", templateId).maybeSingle();
    if (active.error) return NextResponse.json({ error: "Template storage unavailable." }, { status: 503, headers });
    if (!active.data) return NextResponse.json({ error: "Template not installed." }, { status: 404, headers });
    const result = await supabaseAdmin.from("restaurant_template_versions").select("version,document").eq("template_id", templateId).eq("version", active.data.version).single();
    if (result.error || !result.data || !isTemplateDocument(result.data.document)) {
      return NextResponse.json({ error: "Template version unavailable or invalid." }, { status: 503, headers });
    }
    return NextResponse.json({ template_id: templateId, version: result.data.version, document: result.data.document }, { headers });
  } catch {
    return NextResponse.json({ error: "Template storage unavailable." }, { status: 503, headers });
  }
}
