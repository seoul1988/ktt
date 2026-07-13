"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [isLoading, setIsLoading] =
    useState(false);

  /*
    로그인 페이지 주소 예:
    /login?redirect=/market/new

    redirect 값이 없거나 외부 주소이면 홈으로 이동합니다.
  */
  function getSafeRedirectPath() {
    const requestedPath =
      searchParams.get("redirect");

    if (
      requestedPath &&
      requestedPath.startsWith("/") &&
      !requestedPath.startsWith("//") &&
      !requestedPath.startsWith("/login")
    ) {
      return requestedPath;
    }

    return "/";
  }

  async function login() {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      alert(
        "Please enter your email and password.",
      );
      return;
    }

    try {
      setIsLoading(true);

      const { error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        alert(error.message);
        return;
      }

      const redirectPath =
        getSafeRedirectPath();

      window.location.replace(redirectPath);
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

  async function loginWithGoogle() {
    try {
      setIsLoading(true);

      const redirectPath =
        getSafeRedirectPath();

      const callbackUrl =
        `${window.location.origin}/auth/callback` +
        `?redirect=${encodeURIComponent(
          redirectPath,
        )}`;

      const { error } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: callbackUrl,
            queryParams: {
              prompt: "select_account",
            },
          },
        });

      if (error) {
        alert(error.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error(
        "Google login error:",
        error,
      );

      alert(
        "Google login could not be started.",
      );

      setIsLoading(false);
    }
  }

  async function loginWithFacebook() {
    try {
      setIsLoading(true);

      const redirectPath =
        getSafeRedirectPath();

      const callbackUrl =
        `${window.location.origin}/auth/callback` +
        `?redirect=${encodeURIComponent(
          redirectPath,
        )}`;

      const { error } =
        await supabase.auth.signInWithOAuth({
          provider: "facebook",
          options: {
            redirectTo: callbackUrl,
          },
        });

      if (error) {
        alert(error.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error(
        "Facebook login error:",
        error,
      );

      alert(
        "Facebook login could not be started.",
      );

      setIsLoading(false);
    }
  }

  async function loginWithKakao() {
    try {
      setIsLoading(true);

      const redirectPath =
        getSafeRedirectPath();

      const callbackUrl =
        `${window.location.origin}/auth/callback` +
        `?redirect=${encodeURIComponent(
          redirectPath,
        )}`;

      const { error } =
        await supabase.auth.signInWithOAuth({
          provider: "kakao",
          options: {
            redirectTo: callbackUrl,
          },
        });

      if (error) {
        alert(error.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error(
        "Kakao login error:",
        error,
      );

      alert(
        "Kakao login could not be started.",
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
      login();
    }
  }

  const redirectPath =
    getSafeRedirectPath();

  const signupHref =
    redirectPath === "/"
      ? "/signup"
      : `/signup?redirect=${encodeURIComponent(
          redirectPath,
        )}`;

  const forgotPasswordHref =
    redirectPath === "/"
      ? "/forgot-password"
      : `/forgot-password?redirect=${encodeURIComponent(
          redirectPath,
        )}`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fdf2f8] via-white to-[#fff7ed] px-4 py-3 text-[#172033]">
      <div className="mx-auto w-full max-w-md rounded-[28px] bg-white px-5 py-4 shadow-2xl">
        {/* 제목 */}
        <div className="mb-3 text-center">
          <p className="text-xl font-black text-[#172033]">
            Sign in to your account.
          </p>

          {redirectPath !== "/" && (
            <p className="mt-1 text-xs font-medium text-gray-500">
              로그인 후 이전 페이지로 돌아갑니다.
            </p>
          )}
        </div>

        {/* 로그인 입력 */}
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-500">
              Email
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
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
                onChange={(event) =>
                  setPassword(
                    event.target.value,
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
                    (current) => !current,
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

        {/* 아이디 / 비밀번호 찾기 */}
        <div className="mt-3 text-center text-sm font-semibold text-gray-500">
          <a
            href="/forgot-username"
            className="hover:text-[#172033]"
          >
            Forgot Username
          </a>

          <span className="mx-2 text-gray-300">
            |
          </span>

          <a
            href={forgotPasswordHref}
            className="hover:text-[#172033]"
          >
            Forgot Password
          </a>
        </div>

        {/* 회원가입 */}
        <a
          href={signupHref}
          className="mt-4 block w-full rounded-[18px] border border-gray-200 bg-gray-50 py-2 text-center text-base font-medium text-[#172033] transition hover:bg-gray-100"
        >
          Create an Account
        </a>

        {/* 구분선 */}
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />

          <span className="whitespace-nowrap text-sm font-semibold text-gray-400">
            or continue with
          </span>

          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* 소셜 로그인 */}
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={loginWithGoogle}
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
            onClick={loginWithFacebook}
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
            onClick={loginWithKakao}
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

        {/* 약관 */}
        <p className="mt-4 text-center text-xs leading-4 text-gray-400">
          By signing in, you agree to our
          Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}