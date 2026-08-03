import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function normalizeImageUrls(value: unknown): string[] {
  let values: unknown[] = [];

  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      values = Array.isArray(parsed) ? parsed : [trimmed];
    } catch {
      values = [trimmed];
    }
  }

  return Array.from(
    new Set(
      values
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }

          if (item && typeof item === "object" && !Array.isArray(item)) {
            const imageObject = item as {
              url?: unknown;
              image_url?: unknown;
              public_url?: unknown;
            };

            return String(
              imageObject.url ??
                imageObject.image_url ??
                imageObject.public_url ??
                "",
            ).trim();
          }

          return "";
        })
        .filter((url) => /^https?:\/\//i.test(url)),
    ),
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return json({ error: "잘못된 business ID입니다." }, 400);
  }

  const access = await requireBusinessApiAccess(businessId);
  if (!access.ok) return access.response;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return json(
      {
        error:
          "Supabase 환경변수가 없습니다. " +
          "NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.",
      },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: business, error } = await supabase
      .from("businesses")
      .select("id, image_urls")
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      return json(
        { error: `업체 이미지 조회 실패: ${error.message}` },
        500,
      );
    }

    if (!business) {
      return json({ error: "업체를 찾을 수 없습니다." }, 404);
    }

    const urls = normalizeImageUrls(business.image_urls);

    return json({
      images: urls.map((url, index) => ({
        id: `${businessId}-${index + 1}`,
        url,
        image_url: url,
      })),
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "저장된 이미지를 불러오지 못했습니다.",
      },
      500,
    );
  }
}
