"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.ktowntriangle.com";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/";
  }

  async function loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${SITE_URL}/auth/callback`,
      },
    });

    if (error) alert(error.message);
  }

  async function loginWithFacebook() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${SITE_URL}/auth/callback`,
      },
    });

    if (error) alert(error.message);
  }

  async function loginWithKakao() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${SITE_URL}/auth/callback`,
      },
    });

    if (error) alert(error.message);
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
              Username or Email
            </span>

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your username or email"
              className="w-full rounded-[22px] border border-gray-200 bg-gray-50 px-5 py-2 text-lg font-semibold outline-none focus:border-[#172033]"
            />
          </label>

          <label className="block">
            <span className="mb-3 block text-base font-medium text-gray-500">
              Password
            </span>

            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                type={showPassword ? "text" : "password"}
                className="w-full rounded-[22px] border border-gray-200 bg-gray-50 px-5 py-2 text-lg font-semibold outline-none focus:border-[#172033]"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-xl"
              >
                👁️
              </button>
            </div>
          </label>

          <button
            type="button"
            onClick={login}
            className="mt-4 w-full rounded-[22px] bg-black py-2 text-xl font-black text-white shadow-lg active:scale-[0.99]"
          >
            Login
          </button>
        </div>

        <div className="mt-6 text-center text-base font-semibold text-gray-500">
          Forgot Username
          <span className="mx-3 text-gray-300">|</span>
          Forgot Password
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
          <button type="button" onClick={loginWithGoogle}>
            <img
              src="/icons/google.png"
              alt="Google Login"
              className="h-[70px] w-[70px]"
            />
          </button>

          <button type="button" onClick={loginWithFacebook}>
            <img
              src="/icons/facebook.png"
              alt="Facebook Login"
              className="h-[70px] w-[70px]"
            />
          </button>

          <button type="button" onClick={loginWithKakao}>
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