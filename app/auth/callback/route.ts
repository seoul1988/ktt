import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const requestedRedirect =
    requestUrl.searchParams.get("redirect");

  const redirectPath =
    requestedRedirect &&
    requestedRedirect.startsWith("/") &&
    !requestedRedirect.startsWith("//") &&
    !requestedRedirect.startsWith("/login")
      ? requestedRedirect
      : "/";

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/login?redirect=${encodeURIComponent(redirectPath)}`,
        requestUrl.origin,
      ),
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error(
      "OAuth callback error:",
      error,
    );

    const loginUrl = new URL(
      "/login",
      requestUrl.origin,
    );

    loginUrl.searchParams.set(
      "redirect",
      redirectPath,
    );

    loginUrl.searchParams.set(
      "error",
      error.message,
    );

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(
    new URL(redirectPath, requestUrl.origin),
  );
}
}