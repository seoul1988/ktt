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

  // Home DB 값은 literal "home"
  if (lower === "home" || raw === "/") return "home";
  if (lower === "community") return "/community";
  if (lower === "events") return "/events";
  if (lower === "all") return "all";

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

    const requestedLocation =
      normalizeRequestedLocation(
        url.searchParams.get("location") || "",
      );

    /*
     * 중요:
     * 위치 없는 요청으로 모든 배너를 반환하지 않습니다.
     * 이게 빈 display_location + 클라이언트 fallback과 결합되면
     * 모든 페이지에 배너가 노출될 수 있습니다.
     */
    if (!requestedLocation) {
      return NextResponse.json(
        {
          error:
            'location이 필요합니다. 예: "/", "/community", "/community/manual"',
          banners: [],
        },
        {
          status: 400,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, max-age=0",
          },
        },
      );
    }

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    let query = supabase
      .from("ktowntriangle_banners")
      .select("*")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gt.${now}`);

    if (requestedLocation === "all") {
      query = query.eq("display_location", "all");
    } else {
      /*
       * 현재 실제 URL과 정확히 일치하는 배너 +
       * 명시적으로 all인 배너만 반환합니다.
       *
       * NULL / "" 값은 포함하지 않습니다.
       */
      query = query.in(
        "display_location",
        [requestedLocation, "all"],
      );
    }

    const { data, error } = await query
      .order("display_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("PUBLIC BANNERS GET ERROR:", error);

      return NextResponse.json(
        { error: error.message, banners: [] },
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
        location: requestedLocation,
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
    console.error("PUBLIC BANNERS GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "팝업을 불러오지 못했습니다.",
        banners: [],
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