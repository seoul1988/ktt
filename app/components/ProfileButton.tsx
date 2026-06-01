"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type ProfileRole = "user" | "owner" | "admin";

export default function ProfileButton() {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<ProfileRole>("user");
  const [open, setOpen] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser ?? null);

      if (!currentUser) {
        setRole("user");
        setOpen(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (error) {
        console.error("Profile role error:", error);
        setRole("user");
        return;
      }

      const cleanRole = String(profile?.role || "user")
        .trim()
        .toLowerCase();

      if (cleanRole === "admin") {
        setRole("admin");
      } else if (cleanRole === "owner") {
        setRole("owner");
      } else {
        setRole("user");
      }
    } catch (err) {
      console.error("Profile refresh error:", err);
      setRole("user");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(refreshUser, 100);
    });

    const wakeUp = () => {
      setChecking(true);
      refreshUser();
      setTimeout(refreshUser, 500);
      setTimeout(refreshUser, 1500);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        wakeUp();
      }
    };

    window.addEventListener("pageshow", wakeUp);
    window.addEventListener("focus", wakeUp);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pageshow", wakeUp);
      window.removeEventListener("focus", wakeUp);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshUser]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function logout() {
    setOpen(false);
    setChecking(true);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (checking) {
    return (
      <button
        type="button"
        onClick={refreshUser}
        className="rounded-full bg-white px-4 py-2 text-xl font-black text-[#172033] shadow"
      >
        ⋯
      </button>
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

  const isOwner = role === "owner";
  const isAdmin = role === "admin";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full bg-white px-4 py-2 text-xl font-black text-[#172033] shadow"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[99999] w-52 overflow-hidden rounded-2xl bg-white text-sm font-bold text-[#172033] shadow-2xl">
          <a href="/profile" className="block px-4 py-3 hover:bg-gray-100">
            Edit Profile
          </a>

          <a href="/my-coupons" className="block px-4 py-3 hover:bg-gray-100">
            My Coupons
          </a>

          {(isOwner || isAdmin) && (
            <>
              <a href="/owner" className="block px-4 py-3 hover:bg-gray-100">
                My Business
              </a>

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
            </>
          )}

          {isAdmin && (
            <>
              <a
                href="/admin/owner-requests"
                className="block px-4 py-3 hover:bg-gray-100"
              >
                Owner Requests
              </a>

              <a
                href="/admin/categories"
                className="block px-4 py-3 hover:bg-gray-100"
              >
                Categories
              </a>

              <a
                href="/admin/event-requests"
                className="block px-4 py-3 hover:bg-gray-100"
              >
                Event Requests
              </a>
            </>
          )}

          <button
            type="button"
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
