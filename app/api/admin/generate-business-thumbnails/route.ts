import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const THUMBNAIL_BUCKET = "business-thumbnails";
const DEFAULT_BATCH_LIMIT = 10;
const MAX_BATCH_LIMIT = 25;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 25_000;

type BusinessRow = {
  id: number;
  name: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
};

type ProcessResult = {
  id: number;
  name: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  originalBytes?: number;
  thumbnailBytes?: number;
  thumbnailUrl?: string;
};

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLimit(value: unknown) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_BATCH_LIMIT;
  }

  return Math.min(parsed, MAX_BATCH_LIMIT);
}

function isValidBusinessId(value: unknown) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0;
}

async function generateThumbnailForBusiness(
  supabase: SupabaseClient,
  business: BusinessRow,
  overwrite: boolean,
): Promise<ProcessResult> {
  const businessId = Number(business.id);
  const businessName = cleanText(business.name) || `Business ${businessId}`;
  const originalImageUrl = cleanText(business.image_url);
  const existingThumbnailUrl = cleanText(business.thumbnail_url);

  if (!originalImageUrl) {
    return {
      id: businessId,
      name: businessName,
      ok: false,
      error: "image_url is empty.",
    };
  }

  if (existingThumbnailUrl && !overwrite) {
    return {
      id: businessId,
      name: businessName,
      ok: true,
      skipped: true,
      thumbnailUrl: existingThumbnailUrl,
    };
  }

  try {
    const imageResponse = await fetch(originalImageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS),
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
        "User-Agent": "KTownTriangle-Thumbnail-Generator/2.0",
      },
    });

    if (!imageResponse.ok) {
      return {
        id: businessId,
        name: businessName,
        ok: false,
        error:
          `Image download failed: ` +
          `${imageResponse.status} ${imageResponse.statusText}`,
      };
    }

    const contentType =
      imageResponse.headers.get("content-type")?.toLowerCase() || "";

    if (contentType && !contentType.startsWith("image/")) {
      return {
        id: businessId,
        name: businessName,
        ok: false,
        error: `Source did not return an image: ${contentType}`,
      };
    }

    const sourceArrayBuffer = await imageResponse.arrayBuffer();
    const sourceBuffer = Buffer.from(sourceArrayBuffer);

    if (sourceBuffer.length === 0) {
      return {
        id: businessId,
        name: businessName,
        ok: false,
        error: "Downloaded image was empty.",
      };
    }

    const thumbnailBuffer = await sharp(sourceBuffer, {
      animated: false,
      failOn: "none",
    })
      .rotate()
      .resize(480, 360, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: false,
      })
      .webp({
        quality: 76,
        effort: 4,
      })
      .toBuffer();

    const storagePath = `business-${businessId}/thumbnail.webp`;

    const { error: uploadError } = await supabase.storage
      .from(THUMBNAIL_BUCKET)
      .upload(storagePath, thumbnailBuffer, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      return {
        id: businessId,
        name: businessName,
        ok: false,
        error: `Storage upload failed: ${uploadError.message}`,
      };
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from(THUMBNAIL_BUCKET)
      .getPublicUrl(storagePath);

    /*
     * 저장되는 URL에는 매번 변경되는 ?v= 값을 붙이지 않습니다.
     * 파일명은 항상 같지만 cacheControl을 길게 사용하므로,
     * overwrite 때만 새로운 버전값을 붙입니다.
     */
    const thumbnailUrl = overwrite
      ? `${publicUrl}?v=${Date.now()}`
      : publicUrl;

    const { error: updateError } = await supabase
      .from("businesses")
      .update({
        thumbnail_url: thumbnailUrl,
      })
      .eq("id", businessId);

    if (updateError) {
      /*
       * DB 업데이트 실패 시 기존 원본 데이터에는 영향이 없습니다.
       * 업로드된 썸네일 파일만 정리합니다.
       */
      await supabase.storage
        .from(THUMBNAIL_BUCKET)
        .remove([storagePath]);

      return {
        id: businessId,
        name: businessName,
        ok: false,
        error: `Database update failed: ${updateError.message}`,
      };
    }

    return {
      id: businessId,
      name: businessName,
      ok: true,
      originalBytes: sourceBuffer.length,
      thumbnailBytes: thumbnailBuffer.length,
      thumbnailUrl,
    };
  } catch (error) {
    return {
      id: businessId,
      name: businessName,
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown thumbnail generation error.",
    };
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const expectedSecret = cleanText(
      process.env.THUMBNAIL_ADMIN_SECRET,
    );

    const suppliedSecret = cleanText(
      request.headers.get("x-thumbnail-secret"),
    );

    if (!expectedSecret) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "THUMBNAIL_ADMIN_SECRET environment variable is missing.",
        },
        {
          status: 500,
          headers: noStoreHeaders(),
        },
      );
    }

    if (!suppliedSecret || suppliedSecret !== expectedSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
          headers: noStoreHeaders(),
        },
      );
    }

    const supabaseUrl = cleanText(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );

    const serviceRoleKey = cleanText(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "NEXT_PUBLIC_SUPABASE_URL or " +
            "SUPABASE_SERVICE_ROLE_KEY is missing.",
        },
        {
          status: 500,
          headers: noStoreHeaders(),
        },
      );
    }

    const body = await request.json().catch(() => ({}));

    const overwrite = body?.overwrite === true;
    const requestedBusinessId = body?.businessId;
    const limit = normalizeLimit(body?.limit);

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    /*
     * businessId가 전달되면 해당 업체 1개만 처리합니다.
     * 전달되지 않으면 thumbnail_url이 비어 있는 업체를
     * limit 개수만큼 처리합니다.
     */
    let businesses: BusinessRow[] = [];

    if (isValidBusinessId(requestedBusinessId)) {
      const businessId = Number(requestedBusinessId);

      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, image_url, thumbnail_url")
        .eq("id", businessId)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          {
            status: 500,
            headers: noStoreHeaders(),
          },
        );
      }

      if (!data) {
        return NextResponse.json(
          {
            ok: false,
            error: `Business ${businessId} was not found.`,
          },
          {
            status: 404,
            headers: noStoreHeaders(),
          },
        );
      }

      businesses = [data as BusinessRow];
    } else {
      let query = supabase
        .from("businesses")
        .select("id, name, image_url, thumbnail_url")
        .not("image_url", "is", null)
        .neq("image_url", "")
        .order("id", {
          ascending: true,
        })
        .limit(limit);

      if (!overwrite) {
        query = query.or(
          "thumbnail_url.is.null,thumbnail_url.eq.",
        );
      }

      const { data, error } = await query;

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          {
            status: 500,
            headers: noStoreHeaders(),
          },
        );
      }

      businesses = (data || []) as BusinessRow[];
    }

    if (businesses.length === 0) {
      const { count: remainingCount } = await supabase
        .from("businesses")
        .select("id", {
          count: "exact",
          head: true,
        })
        .not("image_url", "is", null)
        .neq("image_url", "")
        .or("thumbnail_url.is.null,thumbnail_url.eq.");

      return NextResponse.json(
        {
          ok: true,
          completed: true,
          message:
            "No businesses are waiting for thumbnail generation.",
          processed: 0,
          succeeded: 0,
          failed: 0,
          skipped: 0,
          remaining: remainingCount ?? 0,
          durationMs: Date.now() - startedAt,
          results: [],
        },
        {
          status: 200,
          headers: noStoreHeaders(),
        },
      );
    }

    const results: ProcessResult[] = [];

    /*
     * 한꺼번에 병렬 처리하지 않고 순차적으로 처리합니다.
     * 외부 이미지 다운로드와 Sharp 메모리 사용량을 안정적으로
     * 유지하기 위한 방식입니다.
     */
    for (const business of businesses) {
      const result = await generateThumbnailForBusiness(
        supabase,
        business,
        overwrite,
      );

      results.push(result);
    }

    const succeeded = results.filter(
      (item) => item.ok && !item.skipped,
    ).length;

    const skipped = results.filter(
      (item) => item.skipped,
    ).length;

    const failed = results.filter(
      (item) => !item.ok,
    ).length;

    const { count: remainingCount, error: countError } =
      await supabase
        .from("businesses")
        .select("id", {
          count: "exact",
          head: true,
        })
        .not("image_url", "is", null)
        .neq("image_url", "")
        .or("thumbnail_url.is.null,thumbnail_url.eq.");

    return NextResponse.json(
      {
        ok: failed === 0,
        completed: (remainingCount ?? 0) === 0,
        processed: results.length,
        succeeded,
        failed,
        skipped,
        remaining: countError ? null : remainingCount ?? 0,
        durationMs: Date.now() - startedAt,
        results,
      },
      {
        status: failed === results.length ? 500 : 200,
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
            : "Unknown batch thumbnail generation error.",
        durationMs: Date.now() - startedAt,
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      },
    );
  }
}