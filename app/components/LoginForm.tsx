"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function login() {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      alert("Please enter your email and password.");
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        alert(error.message);
        return;
      }

      window.location.assign("/");
    } catch (error) {
      console.error("Email login error:", error);
      alert("An unexpected login error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loginWithGoogle() {
    try {
      setIsLoading(true);

      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
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
      console.error("Google login error:", error);
      alert("Google login could not be started.");
      setIsLoading(false);
    }
  }

  async function loginWithFacebook() {
    try {
      setIsLoading(true);

      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          redirectTo,
        },
      });

      if (error) {
        alert(error.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Facebook login error:", error);
      alert("Facebook login could not be started.");
      setIsLoading(false);
    }
  }

  async function loginWithKakao() {
    try {
      setIsLoading(true);

      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo,
        },
      });

      if (error) {
        alert(error.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Kakao login error:", error);
      alert("Kakao login could not be started.");
      setIsLoading(false);
    }
  }

  function handlePasswordKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter" && !isLoading) {
      login();
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fdf2f8] via-white to-[#fff7ed] px-5 py-8 text-[#172033]">
      <div className="mx-auto max-w-md rounded-[34px] bg-white px-6 py-9 shadow-2xl">
        <div className="mb-8 text-center">
          <p className="mt-5 text-2xl font-black text-[#172033]">
            Sign in to your account.
          </p>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-3 block text-base font-medium text-gray-500">
              Email
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              disabled={isLoading}
              className="w-full rounded-[22px] border border-gray-200 bg-gray-50 px-5 py-2 text-lg font-semibold outline-none focus:border-[#172033] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-3 block text-base font-medium text-gray-500">
              Password
            </span>

            <div className="relative">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={handlePasswordKeyDown}
                placeholder="Enter your password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                disabled={isLoading}
                className="w-full rounded-[22px] border border-gray-200 bg-gray-50 px-5 py-2 pr-14 text-lg font-semibold outline-none focus:border-[#172033] disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                disabled={isLoading}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
                className="absolute right-5 top-1/2 -translate-y-1/2 text-xl disabled:opacity-50"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          <button
            type="button"
            onClick={login}
            disabled={isLoading}
            className="mt-4 w-full rounded-[22px] bg-black py-2 text-xl font-black text-white shadow-lg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Please wait..." : "Login"}
          </button>
        </div>

        <div className="mt-6 text-center text-base font-semibold text-gray-500">
          <a href="/forgot-username" className="hover:text-[#172033]">
            Forgot Username
          </a>

          <span className="mx-3 text-gray-300">|</span>

          <a href="/forgot-password" className="hover:text-[#172033]">
            Forgot Password
          </a>
        </div>

        <a
          href="/signup"
          className="mt-8 block w-full rounded-[22px] border border-gray-200 bg-gray-50 py-2 text-center text-lg font-medium text-[#172033]"
        >
          Create an Account
        </a>

        <div className="my-9 flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-200" />

          <span className="text-base font-semibold text-gray-400">
            or continue with
          </span>

          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="flex items-center justify-center gap-6">
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
              className="h-[70px] w-[70px]"
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
              className="h-[70px] w-[70px]"
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
              className="h-[70px] w-[70px]"
            />
          </button>
        </div>

        <p className="mt-10 text-center text-sm leading-6 text-gray-400">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}