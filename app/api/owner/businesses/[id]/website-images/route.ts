import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "business-images";
const TYPES = new Set(["hero", "slider", "scroll", "gallery"]);
type ImageType = "hero" | "slider" | "scroll" | "gallery";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function parseType(value: unknown): ImageType | null {
  const v = String(value || "").trim();
  return TYPES.has(v) ? (v as ImageType) : null;
}

async function requireAccess(businessId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role === "admin") return { ok: true as const, userId: user.id };

  const { data: owner } = await supabase.from("business_owners").select("business_id").eq("business_id", businessId).eq("user_id", user.id).eq("status", "approved").maybeSingle();
  if (!owner) return { ok: false as const, response: NextResponse.json({ error: "이 비즈니스를 관리할 권한이 없습니다." }, { status: 403 }) };

  return { ok: true as const, userId: user.id };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    if (!Number.isInteger(businessId) || businessId <= 0) return NextResponse.json({ error: "잘못된 비즈니스 ID입니다." }, { status: 400 });

    const access = await requireAccess(businessId);
    if (!access.ok) return access.response;

    const type = parseType(new URL(request.url).searchParams.get("type"));
    if (!type) return NextResponse.json({ error: "type이 올바르지 않습니다." }, { status: 400 });

    const admin = getAdmin();
    const { data, error } = await admin.from("business_website_images")
      .select("id,business_id,image_type,image_url,thumbnail_url,storage_path,title,display_order,is_active,created_at")
      .eq("business_id", businessId).eq("image_type", type).eq("is_active", true)
      .order("display_order", { ascending: true }).order("id", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ images: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "이미지를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    if (!Number.isInteger(businessId) || businessId <= 0) return NextResponse.json({ error: "잘못된 비즈니스 ID입니다." }, { status: 400 });

    const access = await requireAccess(businessId);
    if (!access.ok) return access.response;

    const formData = await request.formData();
    const file = formData.get("file");
    const type = parseType(formData.get("type"));
    if (!(file instanceof File) || !type) return NextResponse.json({ error: "파일 또는 이미지 용도가 올바르지 않습니다." }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "이미지 파일만 등록할 수 있습니다." }, { status: 415 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "이미지는 10MB 이하여야 합니다." }, { status: 413 });

    const admin = getAdmin();
    const max = type === "gallery" ? 12 : 10;
    const { count, error: countError } = await admin.from("business_website_images")
      .select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("image_type", type).eq("is_active", true);
    if (countError) throw countError;
    if ((count || 0) >= max) return NextResponse.json({ error: `최대 ${max}장까지 등록할 수 있습니다.` }, { status: 409 });

    const { data: last } = await admin.from("business_website_images").select("display_order")
      .eq("business_id", businessId).eq("image_type", type).order("display_order", { ascending: false }).limit(1).maybeSingle();

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
    const storagePath = `website/${businessId}/${type}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type || `image/${ext}`, cacheControl: "31536000", upsert: false,
    });
    if (uploadError) throw uploadError;

    const imageUrl = admin.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
    const { data: inserted, error: insertError } = await admin.from("business_website_images").insert({
      business_id: businessId, image_type: type, image_url: imageUrl, thumbnail_url: imageUrl,
      storage_path: storagePath, title: null, display_order: Number(last?.display_order || 0) + 1,
      is_active: true, created_by: access.userId,
    }).select("id,business_id,image_type,image_url,thumbnail_url,storage_path,title,display_order,is_active,created_at").single();

    if (insertError) {
      await admin.storage.from(BUCKET).remove([storagePath]);
      throw insertError;
    }

    return NextResponse.json({ success: true, image: inserted });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "이미지를 등록하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    const access = await requireAccess(businessId);
    if (!access.ok) return access.response;

    const body = await request.json();
    const admin = getAdmin();

    if (body?.action === "reorder") {
      const type = parseType(body.type);
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((v: number) => Number.isInteger(v) && v > 0) : [];
      if (!type || !ids.length) return NextResponse.json({ error: "순서 정보가 올바르지 않습니다." }, { status: 400 });

      for (let i = 0; i < ids.length; i++) {
        const { error } = await admin.from("business_website_images").update({ display_order: i + 1, updated_at: new Date().toISOString() })
          .eq("id", ids[i]).eq("business_id", businessId).eq("image_type", type);
        if (error) throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (body?.action === "update") {
      const imageId = Number(body.id);
      const { error } = await admin.from("business_website_images")
        .update({ title: String(body.title || "").trim() || null, updated_at: new Date().toISOString() })
        .eq("id", imageId).eq("business_id", businessId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "수정하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    const access = await requireAccess(businessId);
    if (!access.ok) return access.response;

    const imageId = Number(new URL(request.url).searchParams.get("id"));
    const admin = getAdmin();
    const { data: image, error: loadError } = await admin.from("business_website_images")
      .select("id,storage_path").eq("id", imageId).eq("business_id", businessId).maybeSingle();
    if (loadError) throw loadError;
    if (!image) return NextResponse.json({ error: "이미지를 찾을 수 없습니다." }, { status: 404 });

    const { error: deleteError } = await admin.from("business_website_images").delete().eq("id", imageId).eq("business_id", businessId);
    if (deleteError) throw deleteError;
    if (image.storage_path) await admin.storage.from(BUCKET).remove([image.storage_path]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "삭제하지 못했습니다." }, { status: 500 });
  }
}