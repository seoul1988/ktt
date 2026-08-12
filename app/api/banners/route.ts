import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BUCKET = "ktowntriangle-banner-images";

function getSupabaseServerClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getImageUrl(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  imagePath: unknown,
) {
  const path = String(imagePath || "").trim();

  if (!path) return null;

  if (
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }

  return supabase.storage
    .from(BUCKET)
    .getPublicUrl(path).data.publicUrl;
}

function normalizeRequestedLocation(value: string) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  const lower = raw.toLowerCase();

  // 기존 호출 호환
  if (lower === "home") return "home";
  if (lower === "community") return "community";
  if (lower === "events") return "events";
  if (lower === "all") return "all";

  // 실제 URL 경로도 허용
  if (raw === "/") return "/";

  const withSlash = raw.startsWith("/")
    ? raw
    : `/${raw}`;

  return withSlash.length > 1
    ? withSlash.replace(/\/+$/, "")
    : withSlash;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    /*
     * location은 선택사항입니다.
     *
     * location 없음:
     *   활성 배너 전체 반환
     *   → KTownPopupBanner가 현재 pathname과 정확히 비교
     *
     * location 있음:
     *   기존 home/community/events 호출도 계속 지원
     *   실제 경로(/community/manual)도 지원
     */
    const requestedLocation =
      normalizeRequestedLocation(
        url.searchParams.get("location") || "",
      );

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    let query = supabase
      .from("ktowntriangle_banners")
      .select("*")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gt.${now}`);

    /*
     * location 파라미터가 있을 때만 서버에서 위치 필터링합니다.
     * all 배너는 어느 위치 요청에서도 포함합니다.
     *
     * location이 없으면 모든 활성 배너를 반환합니다.
     */
    if (requestedLocation && requestedLocation !== "all") {
      query = query.in(
        "display_location",
        ["all", requestedLocation],
      );
    }

    const { data, error } = await query
      .order("display_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error(
        "PUBLIC BANNERS GET ERROR:",
        error,
      );

      return NextResponse.json(
        { error: error.message },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, max-age=0",
          },
        },
      );
    }

    const banners = (data || []).map((row) => ({
      ...row,
      image_url: getImageUrl(
        supabase,
        row.image_path,
      ),
    }));

    return NextResponse.json(
      {
        location: requestedLocation || null,
        banners,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error(
      "PUBLIC BANNERS GET ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "팝업을 불러오지 못했습니다.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  }
}