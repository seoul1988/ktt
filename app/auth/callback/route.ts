import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSafeRedirectPath(value: string | null) {
  if (
    value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/login") &&
    !value.startsWith("/auth/")
  ) {
    return value;
  }

  return "/";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");

  const redirectPath = getSafeRedirectPath(
    requestUrl.searchParams.get("redirect"),
  );

  if (!code) {
    const loginUrl = new URL("/login", requestUrl.origin);

    loginUrl.searchParams.set(
      "error",
      "인증 코드가 없습니다.",
    );

    loginUrl.searchParams.set(
      "redirect",
      redirectPath,
    );

    return NextResponse.redirect(loginUrl);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value, options }) => {
              cookieStore.set(
                name,
                value,
                options,
              );
            },
          );
        },
      },
    },
  );

  const { data, error } =
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
      "error",
      error.message,
    );

    loginUrl.searchParams.set(
      "redirect",
      redirectPath,
    );

    return NextResponse.redirect(loginUrl);
  }

  if (!data.session) {
    console.error(
      "OAuth callback succeeded but no session was created.",
    );

    const loginUrl = new URL(
      "/login",
      requestUrl.origin,
    );

    loginUrl.searchParams.set(
      "error",
      "로그인 세션을 생성하지 못했습니다.",
    );

    loginUrl.searchParams.set(
      "redirect",
      redirectPath,
    );

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(
    new URL(redirectPath, requestUrl.origin),
  );
}