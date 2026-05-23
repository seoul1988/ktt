"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ProfileButton() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("user");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        setRole(profile?.role || "user");
      }
    }

    loadUser();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#172033] shadow"
      >
        Login
      </a>
    );
  }

  if (role === "owner") {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-full bg-white px-4 py-2 text-xl font-black text-[#172033] shadow"
        >
          ⋯
        </button>

        {open && (
          <div className="absolute right-0 top-12 z-[2000] w-48 overflow-hidden rounded-2xl bg-white text-sm font-bold text-[#172033] shadow-2xl">
            <a href="/business/new" className="block px-4 py-3 hover:bg-gray-100">
              상점등록
            </a>

            <a href="/events/new" className="block px-4 py-3 hover:bg-gray-100">
              이벤트등록
            </a>

            <button
              onClick={logout}
              className="block w-full px-4 py-3 text-left hover:bg-gray-100"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={logout}
      className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#172033] shadow"
    >
      Logout
    </button>
  );
}