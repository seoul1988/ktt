import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      {
        error:
          "Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended) or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      },
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          "X-Client-Info": "ktowntriangle-visitor-stats",
        },
      },
    });

    const { count, error } = await supabase
      .from("visitor_logs")
      .select("id", {
        count: "exact",
        head: true,
      });

    if (error) {
      console.error("visitor_logs count query failed:", error);

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

    if (typeof count !== "number") {
      return NextResponse.json(
        {
          error: "Supabase did not return an exact visitor count.",
        },
        {
          status: 500,
          headers: noStoreHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        totalVisits: count,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      },
    );
  } catch (error) {
    console.error("Failed to load visitor statistics:", error);

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