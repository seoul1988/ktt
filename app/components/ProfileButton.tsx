"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type ProfileRole = "user" | "owner" | "admin";

export default function ProfileButton() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<ProfileRole>("user");
  const [open, setOpen] = useState(false);

  const refreshUser = useCallback(async () => {
    setChecking(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const currentUser = session?.user ?? null;

    setUser(currentUser);

    if (!currentUser) {
      setRole("user");
      setOpen(false);
      setChecking(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    setRole((profile?.role || "user") as ProfileRole);
    setChecking(false);
  }, []);

  useEffect(() => {
    refreshUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshUser();
    });

    const handlePageShow = () => {
      refreshUser();
    };

    const handleFocus = () => {
      refreshUser();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshUser();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [refreshUser]);

  async function logout() {
    setOpen(false);
    setChecking(true);
    await supabase.auth.signOut();
    location.replace("/");
  }

  if (checking) {
    return (
      <div className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#172033] shadow">
        ...
      </div>
    );
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

  const isOwnerOrAdmin = role === "owner" || role === "admin";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full bg-white px-4 py-2 text-xl font-black text-[#172033] shadow"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[3000] w-52 overflow-hidden rounded-2xl bg-white text-sm font-bold text-[#172033] shadow-2xl">
          <a href="/profile" className="block px-4 py-3 hover:bg-gray-100">
            Edit Profile
          </a>

          {isOwnerOrAdmin && (
            <>
              <a
                href="/business/new"
                className="block px-4 py-3 hover:bg-gray-100"
              >
                Register Business
              </a>

              <a
                href="/events/new"
                className="block px-4 py-3 hover:bg-gray-100"
              >
                Create Event
              </a>

              <a
                href="/coupons/new"
                className="block px-4 py-3 hover:bg-gray-100"
              >
                Register Coupon
              </a>

              <a
                href="/admin/owner-requests"
                className="block px-4 py-3 hover:bg-gray-100"
              >
                Owner Requests
              </a>
            </>
          )}

          <button
            onClick={logout}
            className="block w-full px-4 py-3 text-left hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}