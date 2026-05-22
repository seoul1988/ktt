"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [role, setRole] =
    useState<"user" | "owner">("user");

  async function createAccount() {
    if (!email || !password) {
      alert("Fill all fields");
      return;
    }

    if (password !== confirm) {
      alert("Passwords do not match");
      return;
    }

    const { data, error } =
      await supabase.auth.signUp({
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

    alert(
      "Account created. Please verify your email."
    );

    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fff7ed] via-white to-[#fdf2f8] px-5 py-10">

      <div className="mx-auto max-w-md">

        <div className="mb-8 text-center">

          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#172033] text-4xl font-black text-white">
            K
          </div>

          <h1 className="text-3xl font-black">
            Create Account
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Join KTown Triangle
          </p>

        </div>

        <div className="rounded-[32px] bg-white p-6 shadow-2xl">

          <div className="space-y-4">

            <input
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="Email"
              className="w-full rounded-2xl border px-5 py-4"
            />

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Password"
              className="w-full rounded-2xl border px-5 py-4"
            />

            <input
              type="password"
              value={confirm}
              onChange={(e) =>
                setConfirm(e.target.value)
              }
              placeholder="Confirm Password"
              className="w-full rounded-2xl border px-5 py-4"
            />

            <div>

              <p className="mb-2 text-sm font-bold">
                Account Type
              </p>

              <div className="grid grid-cols-2 gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setRole("user")
                  }
                  className={`rounded-2xl border p-4 ${
                    role === "user"
                      ? "bg-[#172033] text-white"
                      : ""
                  }`}
                >
                  Member
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setRole("owner")
                  }
                  className={`rounded-2xl border p-4 ${
                    role === "owner"
                      ? "bg-[#172033] text-white"
                      : ""
                  }`}
                >
                  Business Owner
                </button>

              </div>

            </div>

            <button
              onClick={createAccount}
              className="w-full rounded-2xl bg-[#172033] py-4 font-black text-white"
            >
              Create Account
            </button>

            <a
              href="/login"
              className="block text-center text-sm text-[#2453A6]"
            >
              Already have an account?
            </a>

          </div>

        </div>

      </div>

    </main>
  );
}