import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  const redirectPath =
    requestUrl.searchParams.get("redirect") || "/";

  const redirectUrl = new URL(
    redirectPath,
    requestUrl.origin,
  );

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "인증 코드가 없습니다.",
        )}`,
        requestUrl.origin,
      ),
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { error } =
    await supabase.auth.exchangeCodeForSession(
      code,
    );

  if (error) {
    console.error(
      "OAuth callback error:",
      error,
    );

    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          error.message,
        )}`,
        requestUrl.origin,
      ),
    );
  }

  return NextResponse.redirect(
    redirectUrl,
  );
}