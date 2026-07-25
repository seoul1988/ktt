import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET_NAME = "business-news";
const THUMBNAIL_SIZE = 480;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type NewsRow = {
  id: number;
  title: string | null;
  image_url: string | null;
  images: string[] | null;
  thumbnail_url: string | null;
};

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.",
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function getRepresentativeImage(
  row: NewsRow,
) {
  const imageUrl =
    String(row.image_url || "").trim();

  if (imageUrl) {
    return imageUrl;
  }

  if (
    Array.isArray(row.images) &&
    row.images.length > 0
  ) {
    return String(row.images[0] || "").trim();
  }

  return "";
}

function isConvertibleImageUrl(url: string) {
  if (!url) return false;

  if (url.startsWith("/")) {
    return false;
  }

  return /^https?:\/\//i.test(url);
}

async function downloadImage(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept:
        "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "User-Agent":
        "KTownTriangle-News-Thumbnail-Backfill/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `원본 이미지 다운로드 실패: ${response.status}`,
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (
    !contentType.toLowerCase().startsWith("image/")
  ) {
    throw new Error(
      `이미지 형식이 아닙니다: ${contentType || "unknown"}`,
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

async function makeThumbnail(
  originalBuffer: Buffer,
) {
  return sharp(originalBuffer)
    .rotate()
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: true,
    })
    .webp({
      quality: 80,
      effort: 4,
    })
    .toBuffer();
}

function parseLimit(request: NextRequest) {
  const value = Number(
    request.nextUrl.searchParams.get("limit") ||
      DEFAULT_LIMIT,
  );

  if (!Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(
    1,
    Math.min(MAX_LIMIT, Math.floor(value)),
  );
}

export async function GET(
  request: NextRequest,
) {
  const configuredSecret =
    process.env.NEWS_THUMBNAIL_SECRET;

  const suppliedSecret =
    request.nextUrl.searchParams.get("secret");

  if (!configuredSecret) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "NEWS_THUMBNAIL_SECRET 환경변수가 설정되지 않았습니다.",
      },
      { status: 500 },
    );
  }

  if (
    !suppliedSecret ||
    suppliedSecret !== configuredSecret
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  const limit = parseLimit(request);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("business_news")
    .select(
      "id, title, image_url, images, thumbnail_url",
    )
    .or(
      "thumbnail_url.is.null,thumbnail_url.eq.",
    )
    .order("id", {
      ascending: true,
    })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 500 },
    );
  }

  const rows = (data || []) as NewsRow[];

  const results: Array<{
    id: number;
    title: string;
    status:
      | "created"
      | "skipped"
      | "failed";
    thumbnail_url?: string;
    reason?: string;
  }> = [];

  for (const row of rows) {
    const title =
      String(row.title || "").trim() ||
      `News #${row.id}`;

    const representativeImage =
      getRepresentativeImage(row);

    if (!representativeImage) {
      results.push({
        id: row.id,
        title,
        status: "skipped",
        reason: "대표 이미지 없음",
      });

      continue;
    }

    if (
      !isConvertibleImageUrl(
        representativeImage,
      )
    ) {
      results.push({
        id: row.id,
        title,
        status: "skipped",
        reason:
          "외부에서 다운로드할 수 없는 로컬 이미지 경로",
      });

      continue;
    }

    try {
      const originalBuffer =
        await downloadImage(
          representativeImage,
        );

      const thumbnailBuffer =
        await makeThumbnail(
          originalBuffer,
        );

      const storagePath =
        `thumbnails/news-${row.id}-${Date.now()}.webp`;

      const { error: uploadError } =
        await supabase.storage
          .from(BUCKET_NAME)
          .upload(
            storagePath,
            thumbnailBuffer,
            {
              contentType: "image/webp",
              cacheControl: "31536000",
              upsert: false,
            },
          );

      if (uploadError) {
        throw new Error(
          `썸네일 업로드 실패: ${uploadError.message}`,
        );
      }

      const { data: publicUrlData } =
        supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(storagePath);

      const thumbnailUrl =
        publicUrlData.publicUrl;

      const { error: updateError } =
        await supabase
          .from("business_news")
          .update({
            thumbnail_url:
              thumbnailUrl,
          })
          .eq("id", row.id);

      if (updateError) {
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([storagePath]);

        throw new Error(
          `DB 업데이트 실패: ${updateError.message}`,
        );
      }

      results.push({
        id: row.id,
        title,
        status: "created",
        thumbnail_url:
          thumbnailUrl,
      });
    } catch (error) {
      results.push({
        id: row.id,
        title,
        status: "failed",
        reason:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류",
      });
    }
  }

  const created = results.filter(
    (item) => item.status === "created",
  ).length;

  const skipped = results.filter(
    (item) => item.status === "skipped",
  ).length;

  const failed = results.filter(
    (item) => item.status === "failed",
  ).length;

  return NextResponse.json({
    ok: failed === 0,
    requested_limit: limit,
    found: rows.length,
    created,
    skipped,
    failed,
    has_more:
      rows.length === limit,
    results,
    next:
      rows.length === limit
        ? "같은 주소를 다시 실행하면 다음 뉴스들을 처리합니다."
        : "모든 기존 뉴스 처리가 완료되었습니다.",
  });
}