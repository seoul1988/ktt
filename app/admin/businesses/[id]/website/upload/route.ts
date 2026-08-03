import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "business-website-media";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/webm",
];

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function safeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-100);
}

async function ensureBucket(
  supabase: ReturnType<typeof getSupabaseAdmin>,
) {
  const { data, error } =
    await supabase.storage.getBucket(BUCKET);

  if (data && !error) {
    /*
     * 예전에 이미지/PDF 전용으로 만든 버킷이라도
     * MP4/WebM을 받을 수 있도록 허용 MIME과 최대 크기를 갱신합니다.
     */
    const { error: updateError } =
      await supabase.storage.updateBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_VIDEO_BYTES,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });

    if (updateError) {
      throw new Error(
        `Storage 버킷 설정 갱신 실패: ${updateError.message}`,
      );
    }

    return;
  }

  const created = await supabase.storage.createBucket(
    BUCKET,
    {
      public: true,
      fileSizeLimit: MAX_VIDEO_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    },
  );

  if (
    created.error &&
    !/already exists/i.test(created.error.message)
  ) {
    throw created.error;
  }
}

function detectFileKind(file: File) {
  const lowerName = file.name.toLowerCase();

  const isPdf =
    file.type === "application/pdf" ||
    lowerName.endsWith(".pdf");

  const isVideo =
    file.type === "video/mp4" ||
    file.type === "video/webm" ||
    lowerName.endsWith(".mp4") ||
    lowerName.endsWith(".webm");

  const isImage =
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif)$/i.test(lowerName);

  return {
    isPdf,
    isVideo,
    isImage,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (
      !Number.isInteger(businessId) ||
      businessId <= 0
    ) {
      return NextResponse.json(
        { error: "잘못된 business id입니다." },
        { status: 400 },
      );
    }

    const access =
      await requireBusinessApiAccess(businessId);

    if (!access.ok) return access.response;

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(
      formData.get("kind") || "website-image",
    );

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "업로드할 파일이 없습니다." },
        { status: 400 },
      );
    }

    const { isPdf, isVideo, isImage } =
      detectFileKind(file);

    if (!isPdf && !isVideo && !isImage) {
      return NextResponse.json(
        {
          error:
            "이미지, PDF, MP4 또는 WebM만 업로드할 수 있습니다.",
        },
        { status: 415 },
      );
    }

    const maxBytes = isVideo
      ? MAX_VIDEO_BYTES
      : isPdf
        ? MAX_PDF_BYTES
        : MAX_IMAGE_BYTES;

    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: isVideo
            ? "동영상은 50MB 이하여야 합니다."
            : isPdf
              ? "PDF는 30MB 이하여야 합니다."
              : "이미지는 8MB 이하여야 합니다.",
        },
        { status: 413 },
      );
    }

    const supabase = getSupabaseAdmin();
    await ensureBucket(supabase);

    const ext = isVideo
      ? file.type === "video/webm" ||
        file.name.toLowerCase().endsWith(".webm")
        ? "webm"
        : "mp4"
      : isPdf
        ? "pdf"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/png"
            ? "png"
            : file.type === "image/gif"
              ? "gif"
              : "jpg";

    const contentType = isVideo
      ? ext === "webm"
        ? "video/webm"
        : "video/mp4"
      : isPdf
        ? "application/pdf"
        : file.type || `image/${ext}`;

    const originalBase =
      safeName(
        file.name.replace(/\.[^.]+$/, ""),
      ) || "file";

    const folder = isVideo
      ? "videos"
      : isPdf
        ? "pdf"
        : kind === "link-page-image"
          ? "link-pages"
          : "images";

    const path =
      `${businessId}/${folder}/${Date.now()}-` +
      `${crypto.randomUUID()}-${originalBase}.${ext}`;

    const bytes =
      new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } =
      await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, {
          contentType,
          cacheControl: "31536000",
          upsert: false,
        });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    if (!data.publicUrl) {
      throw new Error(
        "공개 URL을 만들지 못했습니다.",
      );
    }

    return NextResponse.json({
      ok: true,
      url: data.publicUrl,
      publicUrl: data.publicUrl,
      bucket: BUCKET,
      path,
      folder,
      kind: isVideo
        ? "video"
        : isPdf
          ? "pdf"
          : "image",
      size: file.size,
      contentType,
    });
  } catch (error) {
    console.error(
      "website media upload error",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "파일 업로드에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
