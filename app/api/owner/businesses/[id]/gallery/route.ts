import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireBusinessManagementAccess } from "@/lib/requireBusinessManagementAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "business-website-media";
const MAX_DETAIL_BYTES = 4 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 1 * 1024 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase 서버 환경변수가 없습니다.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function safeWebpName(prefix: "detail" | "thumb") {
  return `${Date.now()}-${crypto.randomUUID()}-${prefix}.webp`;
}

async function getBusinessId(context: RouteContext) {
  const { id } = await context.params;
  const businessId = Number(id);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    throw new Error("잘못된 비즈니스 ID입니다.");
  }
  await requireBusinessManagementAccess(businessId);
  return businessId;
}

const selectColumns =
  "id, business_id, image_url, thumbnail_url, storage_path, thumbnail_storage_path, file_name, alt_text, display_order, is_visible, created_at";

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const businessId = await getBusinessId(context);
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("business_gallery_images")
      .select(selectColumns)
      .eq("business_id", businessId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ images: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("갤러리 이미지 조회 오류:", cause);
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "갤러리를 불러오지 못했습니다." },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const uploadedPaths: string[] = [];

  try {
    const businessId = await getBusinessId(context);
    const formData = await request.formData();
    const detailFile = formData.get("image");
    const thumbnailFile = formData.get("thumbnail");
    const originalName = String(formData.get("originalName") || "gallery-image").slice(0, 255);

    if (!(detailFile instanceof File) || !(thumbnailFile instanceof File)) {
      return NextResponse.json({ error: "축소 이미지와 썸네일 파일이 모두 필요합니다." }, { status: 400 });
    }

    if (detailFile.type !== "image/webp" || thumbnailFile.type !== "image/webp") {
      return NextResponse.json({ error: "갤러리 이미지는 WebP 형식으로 축소해서 등록해야 합니다." }, { status: 400 });
    }

    if (detailFile.size > MAX_DETAIL_BYTES || thumbnailFile.size > MAX_THUMBNAIL_BYTES) {
      return NextResponse.json({ error: "축소된 이미지 파일 크기가 너무 큽니다." }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const detailPath = `gallery/${businessId}/detail/${safeWebpName("detail")}`;
    const thumbnailPath = `gallery/${businessId}/thumbnail/${safeWebpName("thumb")}`;

    for (const [path, file] of [
      [detailPath, detailFile],
      [thumbnailPath, thumbnailFile],
    ] as const) {
      const { error } = await supabase.storage.from(BUCKET).upload(
        path,
        new Uint8Array(await file.arrayBuffer()),
        { contentType: "image/webp", upsert: false, cacheControl: "31536000" },
      );
      if (error) throw error;
      uploadedPaths.push(path);
    }

    const detailUrl = supabase.storage.from(BUCKET).getPublicUrl(detailPath).data.publicUrl;
    const thumbnailUrl = supabase.storage.from(BUCKET).getPublicUrl(thumbnailPath).data.publicUrl;

    const { data: maxOrderRow } = await supabase
      .from("business_gallery_images")
      .select("display_order")
      .eq("business_id", businessId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error: insertError } = await supabase
      .from("business_gallery_images")
      .insert({
        business_id: businessId,
        image_url: detailUrl,
        thumbnail_url: thumbnailUrl,
        storage_path: detailPath,
        thumbnail_storage_path: thumbnailPath,
        file_name: originalName,
        display_order: Number(maxOrderRow?.display_order ?? -1) + 1,
        is_visible: true,
      })
      .select(selectColumns)
      .single();

    if (insertError) throw insertError;
    return NextResponse.json({ image: data }, { status: 201 });
  } catch (cause) {
    console.error("갤러리 이미지 업로드 오류:", cause);
    if (uploadedPaths.length) {
      try {
        await getServerSupabase().storage.from(BUCKET).remove(uploadedPaths);
      } catch (cleanupError) {
        console.error("업로드 실패 파일 정리 오류:", cleanupError);
      }
    }
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "이미지 업로드에 실패했습니다." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const businessId = await getBusinessId(context);
    const imageId = Number(request.nextUrl.searchParams.get("imageId"));
    if (!Number.isInteger(imageId) || imageId <= 0) {
      return NextResponse.json({ error: "잘못된 이미지 ID입니다." }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: image, error: findError } = await supabase
      .from("business_gallery_images")
      .select("id, storage_path, thumbnail_storage_path")
      .eq("id", imageId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (findError) throw findError;
    if (!image) return NextResponse.json({ error: "이미지를 찾을 수 없습니다." }, { status: 404 });

    const paths = Array.from(
      new Set([image.storage_path, image.thumbnail_storage_path].filter((value): value is string => Boolean(value))),
    );

    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
      if (storageError) throw new Error(`스토리지 이미지 삭제 실패: ${storageError.message}`);
    }

    const { error: deleteError } = await supabase
      .from("business_gallery_images")
      .delete()
      .eq("id", imageId)
      .eq("business_id", businessId);
    if (deleteError) throw deleteError;

    const { data: remaining, error: verifyError } = await supabase
      .from("business_gallery_images")
      .select("id")
      .eq("id", imageId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (verifyError) throw verifyError;
    if (remaining) throw new Error("DB에서 이미지 정보가 완전히 삭제되지 않았습니다.");

    return NextResponse.json({ success: true });
  } catch (cause) {
    console.error("갤러리 이미지 삭제 오류:", cause);
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "이미지 삭제에 실패했습니다." },
      { status: 400 },
    );
  }
}
