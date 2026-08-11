import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

export async function GET() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      {
        error:
          "Supabase environment variables are missing.",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      },
    );
  }

  try {
    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            "X-Client-Info":
              "ktowntriangle-visitor-stats",
          },
        },
      },
    );

    /*
     * visitor_logs의 실제 전체 행 개수를 셉니다.
     *
     * 중복 제거 안 함
     * 같은 visitor_key가 여러 번 방문해도 모두 카운트
     * 10,000개 제한 없음
     *
     * 2026-07-14 미국 동부시간 00:00부터 계산
     * 07/14/2026은 EDT이므로 UTC 04:00
     */
    const { count, error } = await supabase
      .from("visitor_logs")
      .select("visitor_key", {
        count: "exact",
        head: true,
      })
      .gte(
        "created_at",
        "2026-07-14T04:00:00.000Z",
      );

    if (error) {
      console.error(
        "visitor_logs total count failed:",
        error,
      );

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
          headers: noStoreHeaders(),
        },
      );
    }

    const totalVisits = Number(count ?? 0);

    if (
      !Number.isFinite(totalVisits) ||
      totalVisits < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Supabase returned an invalid visitor count.",
        },
        {
          status: 500,
          headers: noStoreHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        totalVisits,
        since: "07/14/26",
        countingMethod:
          "Total visitor_logs rows including repeat visits",
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      },
    );
  } catch (error) {
    console.error(
      "Failed to load visitor statistics:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load visitor statistics.",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      },
    );
  }
}