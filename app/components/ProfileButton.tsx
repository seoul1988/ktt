"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type ProfileRole = "user" | "owner" | "admin";

export default function ProfileButton() {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<ProfileRole>("user");
  const [open, setOpen] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let currentUser = session?.user ?? null;

      if (!currentUser) {
        const {
          data: { user: fetchedUser },
        } = await supabase.auth.getUser();

        currentUser = fetchedUser ?? null;
      }

      if (!mountedRef.current) return;

      // 중요: 세션 복구 중 잠깐 null이 나와도 기존 로그인 상태를 바로 지우지 않음
      if (!currentUser) {
        setChecking(false);
        return;
      }

      setUser(currentUser);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (error) {
        console.error("Profile role error:", error);
        setRole("user");
        setChecking(false);
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
      // 중요: 에러가 나도 기존 user/open 상태를 지우지 않음
    } finally {
      if (mountedRef.current) {
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refreshUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setRole("user");
        setOpen(false);
        setChecking(false);
        return;
      }

      setTimeout(refreshUser, 100);
      setTimeout(refreshUser, 700);
    });

    const wakeUp = () => {
      // 중요: 앱 복귀 때 checking=true로 바꾸지 않음. 그래야 버튼 클릭 가능.
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
      mountedRef.current = false;
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

  // 첫 로딩이고 기존 user가 없을 때만 로딩 표시
  if (checking && !user) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          refreshUser();
        }}
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
        onClick={() => {
          setOpen((prev) => !prev);
          refreshUser();
        }}
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
