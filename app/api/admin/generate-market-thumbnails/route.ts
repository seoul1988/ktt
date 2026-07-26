import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_HEIGHT = 360;
const THUMBNAIL_BUCKET = "market-thumbnails";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function getSupabaseAdmin() {
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

function getFirstImage(images: unknown): string {
  if (!Array.isArray(images)) return "";

  const first = images.find(
    (value) => typeof value === "string" && value.trim(),
  );

  return typeof first === "string" ? first.trim() : "";
}

async function createThumbnail(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`원본 이미지 요청 실패: ${response.status}`);
  }

  const sourceBuffer = Buffer.from(await response.arrayBuffer());

  return sharp(sourceBuffer)
    .rotate()
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .webp({
      quality: 76,
    })
    .toBuffer();
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const expectedSecret = process.env.ADMIN_CRON_SECRET || "";

    if (
      expectedSecret &&
      authHeader !== `Bearer ${expectedSecret}`
    ) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: noStoreHeaders(),
        },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: items, error: loadError } = await supabase
      .from("market_items")
      .select("id,title,images,thumbnail_url")
      .not("images", "is", null)
      .order("id", { ascending: true });

    if (loadError) {
      throw loadError;
    }

    const results: Array<{
      id: number;
      title: string;
      status: "created" | "skipped" | "failed";
      message?: string;
      thumbnail_url?: string;
    }> = [];

    for (const item of items || []) {
      const sourceUrl = getFirstImage(item.images);

      if (!sourceUrl) {
        results.push({
          id: Number(item.id),
          title: String(item.title || ""),
          status: "skipped",
          message: "첫 번째 이미지가 없습니다.",
        });
        continue;
      }

      try {
        const thumbnailBuffer = await createThumbnail(sourceUrl);
        const storagePath = `market-${item.id}/thumbnail.webp`;

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
          .from("market_items")
          .update({
            thumbnail_url: thumbnailUrl,
          })
          .eq("id", item.id);

        if (updateError) {
          throw updateError;
        }

        results.push({
          id: Number(item.id),
          title: String(item.title || ""),
          status: "created",
          thumbnail_url: thumbnailUrl,
        });
      } catch (error) {
        results.push({
          id: Number(item.id),
          title: String(item.title || ""),
          status: "failed",
          message:
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

    return NextResponse.json(
      {
        ok: failed === 0,
        total: results.length,
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
        error:
          error instanceof Error
            ? error.message
            : "마켓 썸네일 생성 오류",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      },
    );
  }
}