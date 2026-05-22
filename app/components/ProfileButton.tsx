"use client";

import { useAuth } from "./AuthProvider";
import { supabase } from "../../lib/supabase";

export default function ProfileButton() {
  const { user, loading } = useAuth();

  async function logout() {
    await supabase.auth.signOut();

    window.location.href = "/";
  }

  if (loading) {
    return (
      <div
        className="
          rounded-full
          bg-white
          px-4
          py-2
          shadow
          text-sm
        "
      >
        ...
      </div>
    );
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="
          rounded-full
          bg-white
          px-4
          py-2
          shadow
          font-semibold
        "
      >
        Login
      </a>
    );
  }

  return (
    <div
      className="
        flex
        items-center
        gap-2
      "
    >
      <a
        href="/profile"
        className="
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-full
          bg-[#172033]
          text-white
          font-bold
          shadow
        "
      >
        {user.email?.[0]?.toUpperCase()}
      </a>

      <button
        onClick={logout}
        className="
          rounded-xl
          border
          bg-white
          px-3
          py-2
          text-sm
          shadow-sm
        "
      >
        Logout
      </button>
    </div>
  );
}