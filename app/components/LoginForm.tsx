"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  async function signUp() {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${SITE_URL}/`,
      },
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email,
        role: "user",
      });
    }

    alert("Account created. Please check your email.");
  }

	  async function loginWithGoogle() {
	  const { error } = await supabase.auth.signInWithOAuth({
		provider: "google",

		options: {
		  redirectTo: `${SITE_URL}/auth/callback`,
		},
	  });

	  if (error) {
		alert(error.message);
	  }
	}

  async function loginWithApple() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${SITE_URL}/`,
      },
    });

    if (error) alert(error.message);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fff7ed] via-white to-[#fdf2f8] px-5 py-10 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#172033] text-4xl font-black text-white shadow-xl">
            K
          </div>

          <h1 className="text-3xl font-extrabold">KTown Triangle</h1>
          <p className="mt-2 text-sm text-gray-500">
            Korean food, deals, and local spots
          </p>
        </div>

        <div className="rounded-[32px] bg-white p-6 shadow-2xl">
          <div className="mb-6 text-center">
            <h2 className="text-4xl font-black">Login</h2>
            <p className="mt-3 text-gray-500">
              Sign in to like restaurants and manage your business.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-700">
                Email
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-base outline-none focus:border-[#172033]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-700">
                Password
              </span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-base outline-none focus:border-[#172033]"
              />
            </label>

            <button
              onClick={login}
              className="mt-2 w-full rounded-2xl bg-[#172033] py-4 text-lg font-extrabold text-white shadow-lg"
            >
              Login
            </button>

            <a
              href="/signup"
              className="block w-full rounded-2xl border-2 border-[#172033] py-4 text-center text-lg font-extrabold text-[#172033]"
            >
              Create Account
            </a>
          </div>

          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-sm font-semibold text-gray-400">
              or continue with
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={loginWithGoogle}
              className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-4 font-bold shadow-sm"
            >
              <span className="text-2xl">G</span>
              Google
            </button>

            <button
              onClick={loginWithApple}
              className="flex items-center justify-center gap-2 rounded-2xl bg-black py-4 font-bold text-white shadow-sm"
            >
              <span className="text-2xl"></span>
              Apple
            </button>
          </div>

          <p className="mt-8 text-center text-xs leading-5 text-gray-400">
            By logging in, you agree to our Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </main>
  );
}