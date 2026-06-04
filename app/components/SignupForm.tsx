"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"user" | "owner">("user");

  async function createAccount() {
    if (!email || !password || !confirm) {
      alert("Please fill all fields.");
      return;
    }

    if (password !== confirm) {
      alert("Passwords do not match.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email,
        role,
      });
    }

    alert("Account created. Please verify your email.");
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fff7ed] via-white to-[#fdf2f8] px-5 py-10 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-center gap-4">
          <img
            src="/logo.png"
            alt="KTown Triangle"
            className="h-20 w-20 object-contain"
          />

          <div>
            <h1 className="text-3xl font-black text-[#172033]">
              Create Account
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Join KTown Triangle
            </p>
          </div>
        </div>

        <div className="rounded-[32px] bg-white p-6 shadow-2xl">
          <div className="space-y-4">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
            />

            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm Password"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
            />

            <div>
              <p className="mb-2 text-sm font-bold text-[#172033]">
                Account Type
              </p>

              <div className="grid grid-cols-2 gap-3">
       <button
  type="button"
  onClick={() => setRole("user")}
  className={`rounded-2xl border p-4 font-semibold transition ${
    role === "user"
      ? "border-[#2563EB] bg-[#2563EB] text-white"
      : "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]"
  }`}
>
  Member
</button>

<button
  type="button"
  onClick={() => setRole("owner")}
  className={`rounded-2xl border p-4 font-semibold transition ${
    role === "owner"
      ? "border-[#D4A017] bg-[#D4A017] text-white"
      : "border-[#D4A017] bg-[#FFF8E1] text-[#B8860B]"
  }`}
>
  Business Owner
</button>
              </div>
            </div>

            <button
              type="button"
              onClick={createAccount}
              className="w-full rounded-2xl bg-[#172033] py-4 font-black text-white active:scale-[0.99]"
            >
              Create Account
            </button>

            <a
              href="/login"
              className="block text-center text-sm font-semibold text-[#2453A6]"
            >
              Already have an account? Login
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}