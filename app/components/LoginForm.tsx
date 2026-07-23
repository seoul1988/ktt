"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

import { supabase } from "../../lib/supabase";

const LOGIN_REDIRECT_KEY =
  "ktown_login_redirect";

type OAuthProvider =
  | "google"
  | "facebook"
  | "kakao";

function isSafeInternalPath(
  value: string | null | undefined,
): value is string {
  if (!value) {
    return false;
  }

  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/login") &&
    !value.startsWith("/auth/")
  );
}

export default function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [
    showPassword,
    setShowPassword,
  ] = useState(false);
  const [isLoading, setIsLoading] =
    useState(false);

  const [redirectPath, setRedirectPath] =
    useState("/");

  const queryRedirect =
    searchParams.get("redirect");

  const loginError =
    searchParams.get("error");

  /**
   * 로그인 버튼을 누르는 순간 돌아갈 주소를 다시 계산합니다.
   *
   * 1순위: /login?redirect=...
   * 2순위: sessionStorage
   * 3순위: 현재 state
   * 4순위: 홈
   */
  function resolveRedirectPath() {
    if (
      isSafeInternalPath(queryRedirect)
    ) {
      return queryRedirect;
    }

    if (
      typeof window !== "undefined"
    ) {
      const storedRedirect =
        sessionStorage.getItem(
          LOGIN_REDIRECT_KEY,
        );

      if (
        isSafeInternalPath(
          storedRedirect,
        )
      ) {
        return storedRedirect;
      }
    }

    if (
      isSafeInternalPath(
        redirectPath,
      )
    ) {
      return redirectPath;
    }

    return "/";
  }

  useEffect(() => {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    if (
      isSafeInternalPath(
        queryRedirect,
      )
    ) {
      setRedirectPath(
        queryRedirect,
      );

      sessionStorage.setItem(
        LOGIN_REDIRECT_KEY,
        queryRedirect,
      );

      return;
    }

    const storedRedirect =
      sessionStorage.getItem(
        LOGIN_REDIRECT_KEY,
      );

    if (
      isSafeInternalPath(
        storedRedirect,
      )
    ) {
      setRedirectPath(
        storedRedirect,
      );

      return;
    }

    setRedirectPath("/");
  }, [queryRedirect]);

  useEffect(() => {
    if (!loginError) {
      return;
    }

    console.error(
      "Login callback error:",
      loginError,
    );
  }, [loginError]);

  function completeLoginRedirect() {
    const finalRedirect =
      resolveRedirectPath();

    sessionStorage.removeItem(
      LOGIN_REDIRECT_KEY,
    );

    /*
     * router.push보다 location.replace를 사용하면
     * 로그인 전 페이지가 로그인 기록으로 남지 않습니다.
     */
    window.location.replace(
      finalRedirect,
    );
  }

  async function login() {
    const cleanEmail =
      email.trim();

    if (
      !cleanEmail ||
      !password
    ) {
      alert(
        "Please enter your email and password.",
      );

      return;
    }

    try {
      setIsLoading(true);

      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email: cleanEmail,
            password,
          },
        );

      if (error) {
        alert(error.message);
        return;
      }

      if (!data.session) {
        alert(
          "로그인 세션을 생성하지 못했습니다.",
        );

        return;
      }

      completeLoginRedirect();
    } catch (error) {
      console.error(
        "Email login error:",
        error,
      );

      alert(
        "An unexpected login error occurred.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function startOAuthLogin(
    provider: OAuthProvider,
  ) {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    try {
      setIsLoading(true);

      /*
       * OAuth 버튼을 누르는 그 순간
       * query와 sessionStorage를 다시 확인합니다.
       */
      const finalRedirect =
        resolveRedirectPath();

      sessionStorage.setItem(
        LOGIN_REDIRECT_KEY,
        finalRedirect,
      );

      const callbackUrl =
        new URL(
          "/auth/callback",
          window.location.origin,
        );

      callbackUrl.searchParams.set(
        "redirect",
        finalRedirect,
      );

      const options =
        provider === "google"
          ? {
              redirectTo:
                callbackUrl.toString(),
              queryParams: {
                prompt:
                  "select_account",
              },
            }
          : {
              redirectTo:
                callbackUrl.toString(),
            };

      const { error } =
        await supabase.auth.signInWithOAuth(
          {
            provider,
            options,
          },
        );

      if (error) {
        console.error(
          `${provider} OAuth error:`,
          error,
        );

        alert(error.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error(
        `${provider} login error:`,
        error,
      );

      const providerName =
        provider
          .charAt(0)
          .toUpperCase() +
        provider.slice(1);

      alert(
        `${providerName} login could not be started.`,
      );

      setIsLoading(false);
    }
  }

  function handlePasswordKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (
      event.key === "Enter" &&
      !isLoading
    ) {
      event.preventDefault();
      login();
    }
  }

  const safeRedirectPath =
    useMemo(() => {
      if (
        isSafeInternalPath(
          queryRedirect,
        )
      ) {
        return queryRedirect;
      }

      if (
        isSafeInternalPath(
          redirectPath,
        )
      ) {
        return redirectPath;
      }

      return "/";
    }, [
      queryRedirect,
      redirectPath,
    ]);

  const signupHref =
    safeRedirectPath === "/"
      ? "/signup"
      : `/signup?redirect=${encodeURIComponent(
          safeRedirectPath,
        )}`;

  const forgotPasswordHref =
    safeRedirectPath === "/"
      ? "/forgot-password"
      : `/forgot-password?redirect=${encodeURIComponent(
          safeRedirectPath,
        )}`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fdf2f8] via-white to-[#fff7ed] px-4 py-3 text-[#172033]">
      <div className="mx-auto w-full max-w-md rounded-[28px] bg-white px-5 py-4 shadow-2xl">
        <div className="mb-3 text-center">
          <p className="text-xl font-black text-[#172033]">
            Sign in to your account.
          </p>

          {safeRedirectPath !==
            "/" && (
            <p className="mt-1 text-xs font-medium text-gray-500">
              로그인 후 이전 페이지로
              돌아갑니다.
            </p>
          )}
        </div>

        {loginError && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600">
            {loginError}
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-500">
              Email
            </span>

            <input
              type="email"
              value={email}
              onChange={(
                event,
              ) =>
                setEmail(
                  event.target
                    .value,
                )
              }
              placeholder="Enter your email"
              autoComplete="email"
              disabled={isLoading}
              className="w-full rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-2 text-base font-semibold outline-none transition focus:border-[#172033] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-500">
              Password
            </span>

            <div className="relative">
              <input
                value={password}
                onChange={(
                  event,
                ) =>
                  setPassword(
                    event.target
                      .value,
                  )
                }
                onKeyDown={
                  handlePasswordKeyDown
                }
                placeholder="Enter your password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="current-password"
                disabled={isLoading}
                className="w-full rounded-[18px] border border-gray-200 bg-gray-50 px-4 py-2 pr-12 text-base font-semibold outline-none transition focus:border-[#172033] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current,
                  )
                }
                disabled={isLoading}
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-lg disabled:opacity-50"
              >
                {showPassword
                  ? "🙈"
                  : "👁️"}
              </button>
            </div>
          </label>

          <button
            type="button"
            onClick={login}
            disabled={isLoading}
            className="mt-1 w-full rounded-[18px] bg-black py-2 text-lg font-black text-white shadow-lg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading
              ? "Please wait..."
              : "Login"}
          </button>
        </div>

        <div className="mt-3 text-center text-sm font-semibold text-gray-500">
          <Link
            href="/forgot-username"
            className="hover:text-[#172033]"
          >
            Forgot Username
          </Link>

          <span className="mx-2 text-gray-300">
            |
          </span>

          <Link
            href={
              forgotPasswordHref
            }
            className="hover:text-[#172033]"
          >
            Forgot Password
          </Link>
        </div>

        <Link
          href={signupHref}
          className="mt-4 block w-full rounded-[18px] border border-gray-200 bg-gray-50 py-2 text-center text-base font-medium text-[#172033] transition hover:bg-gray-100"
        >
          Create an Account
        </Link>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />

          <span className="whitespace-nowrap text-sm font-semibold text-gray-400">
            or continue with
          </span>

          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() =>
              startOAuthLogin(
                "google",
              )
            }
            disabled={isLoading}
            aria-label="Continue with Google"
            className="rounded-full transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <img
              src="/icons/google.png"
              alt="Google Login"
              className="h-[52px] w-[52px]"
            />
          </button>

          <button
            type="button"
            onClick={() =>
              startOAuthLogin(
                "facebook",
              )
            }
            disabled={isLoading}
            aria-label="Continue with Facebook"
            className="rounded-full transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <img
              src="/icons/facebook.png"
              alt="Facebook Login"
              className="h-[52px] w-[52px]"
            />
          </button>

          <button
            type="button"
            onClick={() =>
              startOAuthLogin(
                "kakao",
              )
            }
            disabled={isLoading}
            aria-label="Continue with Kakao"
            className="rounded-full transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <img
              src="/icons/kakao.png"
              alt="Kakao Login"
              className="h-[52px] w-[52px]"
            />
          </button>
        </div>

        <div className="mt-5 border-t border-gray-100 pt-4 text-center">
          <p className="text-xs leading-5 text-gray-400">
            By signing in, you
            agree to our policies.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold">
            <Link
              href="/terms"
              className="text-gray-500 underline decoration-gray-300 underline-offset-2 transition hover:text-[#172033]"
            >
              Terms of Service
            </Link>

            <span
              aria-hidden="true"
              className="text-gray-300"
            >
              |
            </span>

            <Link
              href="/privacy"
              className="text-gray-500 underline decoration-gray-300 underline-offset-2 transition hover:text-[#172033]"
            >
              Privacy Policy
            </Link>

            <span
              aria-hidden="true"
              className="text-gray-300"
            >
              |
            </span>

            <Link
              href="/community-guidelines"
              className="text-gray-500 underline decoration-gray-300 underline-offset-2 transition hover:text-[#172033]"
            >
              Community Guidelines
            </Link>
          </div>

          <p className="mt-3 text-[11px] text-gray-300">
            © 2026
            KTownTriangle. All
            rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}