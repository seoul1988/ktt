import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "business-website-media";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 30 * 1024 * 1024;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function verifyAdmin(request: NextRequest) {
  const expected =
    process.env.WEBSITE_BUILDER_ADMIN_KEY ||
    process.env.ADMIN_API_KEY ||
    process.env.CRON_SECRET ||
    "";

  // 프로젝트에서 관리자 키를 사용하는 경우에만 검사합니다.
  if (!expected) return true;
  return request.headers.get("x-admin-key") === expected;
}

function safeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-100);
}

async function ensureBucket(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (data && !error) return;

  const created = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_PDF_BYTES,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ],
  });

  if (created.error && !/already exists/i.test(created.error.message)) {
    throw created.error;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!verifyAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const businessId = Number(id);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json({ error: "잘못된 business id입니다." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") || "website-image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "업로드할 파일이 없습니다." }, { status: 400 });
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      return NextResponse.json({ error: "이미지 또는 PDF만 업로드할 수 있습니다." }, { status: 415 });
    }

    const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: isPdf ? "PDF는 30MB 이하여야 합니다." : "이미지는 8MB 이하여야 합니다." },
        { status: 413 },
      );
    }

    const supabase = getSupabaseAdmin();
    await ensureBucket(supabase);

    const ext = isPdf
      ? "pdf"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/png"
          ? "png"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";
    const originalBase = safeName(file.name.replace(/\.[^.]+$/, "")) || "file";
    const folder = isPdf ? "pdf" : kind === "link-page-image" ? "link-pages" : "images";
    const path = `${businessId}/${folder}/${Date.now()}-${crypto.randomUUID()}-${originalBase}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: isPdf ? "application/pdf" : file.type || `image/${ext}`,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!data.publicUrl) throw new Error("공개 URL을 만들지 못했습니다.");

    return NextResponse.json({
      url: data.publicUrl,
      publicUrl: data.publicUrl,
      bucket: BUCKET,
      path,
      size: file.size,
      contentType: file.type,
    });
  } catch (error) {
    console.error("website media upload error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "파일 업로드에 실패했습니다." },
      { status: 500 },
    );
  }
}
