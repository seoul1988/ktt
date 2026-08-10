import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BUCKET = "ktowntriangle-banner-images";
const LOCATIONS = new Set(["home", "community", "events"]);

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

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return supabase.storage
    .from(BUCKET)
    .getPublicUrl(path).data.publicUrl;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedLocation = String(
      url.searchParams.get("location") || "",
    )
      .trim()
      .toLowerCase();

    if (!LOCATIONS.has(requestedLocation)) {
      return NextResponse.json(
        {
          error:
            "location은 home, community, events 중 하나여야 합니다.",
        },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("ktowntriangle_banners")
      .select("*")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      // 서버에서 위치를 확실하게 제한합니다.
      .in("display_location", ["all", requestedLocation])
      .order("display_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("PUBLIC BANNERS GET ERROR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    const banners = (data || []).map((row) => ({
      ...row,
      image_url: getImageUrl(supabase, row.image_path),
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
      },
      { status: 500 },
    );
  }
}