import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_HEIGHT = 360;
const THUMBNAIL_QUALITY = 76;
const THUMBNAIL_BUCKET = "ads-thumbnails";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function normalizeImageUrl(value: unknown) {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();

  if (!/^https?:\/\//i.test(trimmed)) {
    return "";
  }

  return trimmed;
}

async function downloadImage(imageUrl: string) {
  const response = await fetch(imageUrl, {
    cache: "no-store",
    headers: {
      "User-Agent": "KTownTriangle-Ad-Thumbnail-Generator/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `원본 이미지 다운로드 실패: ${response.status} ${response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.startsWith("image/")) {
    throw new Error(`이미지 파일이 아닙니다: ${contentType || "unknown"}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

async function createThumbnail(imageBuffer: Buffer) {
  return sharp(imageBuffer)
    .rotate()
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .webp({
      quality: THUMBNAIL_QUALITY,
      effort: 4,
    })
    .toBuffer();
}

async function generateAdThumbnail(
  supabase: ReturnType<typeof createAdminClient>,
  ad: {
    id: number;
    images: unknown;
  },
) {
  const images = Array.isArray(ad.images) ? ad.images : [];

  const firstImageUrl =
    images
      .map(normalizeImageUrl)
      .find(Boolean) || "";

  if (!firstImageUrl) {
    const { error: clearError } = await supabase
      .from("ads")
      .update({
        thumbnail_url: null,
      })
      .eq("id", ad.id);

    if (clearError) {
      throw clearError;
    }

    return {
      id: ad.id,
      status: "skipped",
      reason: "등록된 이미지 없음",
    };
  }

  const sourceBuffer = await downloadImage(firstImageUrl);
  const thumbnailBuffer = await createThumbnail(sourceBuffer);

  const storagePath = `ad-${ad.id}/thumbnail.webp`;

  const { error: uploadError } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .upload(storagePath, thumbnailBuffer, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from(THUMBNAIL_BUCKET)
    .getPublicUrl(storagePath);

  const thumbnailUrl =
    `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("ads")
    .update({
      thumbnail_url: thumbnailUrl,
    })
    .eq("id", ad.id);

  if (updateError) {
    throw updateError;
  }

  return {
    id: ad.id,
    status: "created",
    thumbnail_url: thumbnailUrl,
  };
}

export async function POST() {
  try {
    const supabase = createAdminClient();

    const { data: ads, error: loadError } = await supabase
      .from("ads")
      .select("id, images")
      .order("id", {
        ascending: true,
      });

    if (loadError) {
      throw loadError;
    }

    const results: Array<Record<string, unknown>> = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const ad of ads || []) {
      try {
        const result = await generateAdThumbnail(supabase, {
          id: Number(ad.id),
          images: ad.images,
        });

        results.push(result);

        if (result.status === "created") {
          created += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        failed += 1;

        results.push({
          id: ad.id,
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류",
        });
      }
    }

    return NextResponse.json(
      {
        ok: failed === 0,
        total: ads?.length || 0,
        created,
        skipped,
        failed,
        results,
      },
      {
        headers: noStoreHeaders(),
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "광고 썸네일 생성 중 오류가 발생했습니다.",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message:
        "기존 광고 썸네일을 생성하려면 이 주소로 POST 요청을 보내세요.",
      endpoint: "/api/admin/generate-ad-thumbnails",
    },
    {
      headers: noStoreHeaders(),
    },
  );
}