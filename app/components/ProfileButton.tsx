"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = {
  role: string | null;
};

function timeout<T>(promise: PromiseLike<T>, ms = 5000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), ms)
    ),
  ]);
}

export default function ProfileButton() {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const canManage = isOwner || isAdmin;

  async function loadUser() {
    try {
      setChecking(true);

      const sessionResult = await timeout(supabase.auth.getSession(), 5000);
      const user = sessionResult.data.session?.user || null;

      if (!user) {
        setUserId(null);
        setRole(null);
        setOpen(false);
        return;
      }

      setUserId(user.id);

      try {
        const { data } = await timeout(
          supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle<Profile>(),
          5000
        );

        setRole(data?.role || "user");
      } catch {
        setRole("user");
      }
    } catch {
      setUserId(null);
      setRole(null);
      setOpen(false);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function safeLoad() {
      if (!alive) return;
      await loadUser();
    }

    safeLoad();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      safeLoad();
    });

    window.addEventListener("online", safeLoad);
    window.addEventListener("focus", safeLoad);
    window.addEventListener("pageshow", safeLoad);

    return () => {
      alive = false;
      subscription.unsubscribe();
      window.removeEventListener("online", safeLoad);
      window.removeEventListener("focus", safeLoad);
      window.removeEventListener("pageshow", safeLoad);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  async function logout() {
    try {
      await supabase.auth.signOut();
    } finally {
      setUserId(null);
      setRole(null);
      setOpen(false);
      window.location.href = "/";
    }
  }

  if (checking || !userId) {
    return (
      <Link
        href="/login"
        className="relative z-[99999] inline-flex h-8 items-center justify-center rounded-lg border border-[#E8DED1] bg-white px-3 text-xs font-black text-[#172033] shadow-sm"
      >
        Login
      </Link>
    );
  }

  return (
    <div ref={menuRef} className="relative z-[99999]">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="relative z-[99999] flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8DED1] bg-white text-[#172033] shadow-sm active:scale-95"
        aria-label="Open profile menu"
      >
        <span className="flex flex-col items-center justify-center gap-[2px]">
          <span className="h-[3px] w-[3px] rounded-full bg-[#172033]" />
          <span className="h-[3px] w-[3px] rounded-full bg-[#172033]" />
          <span className="h-[3px] w-[3px] rounded-full bg-[#172033]" />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-[999999] w-56 overflow-hidden rounded-2xl border border-[#E8DED1] bg-white text-sm font-bold text-[#172033] shadow-xl">
          <Link
            href="/profile"
            className="block px-4 py-3 hover:bg-[#F8F3EC]"
            onClick={() => setOpen(false)}
          >
            Edit Profile
          </Link>

          <Link
            href="/my-coupons"
            className="block px-4 py-3 hover:bg-[#F8F3EC]"
            onClick={() => setOpen(false)}
          >
            My Coupons
          </Link>

          {canManage && (
            <>
              <div className="border-t border-[#EFE5D8]" />

              <Link
                href="/owner"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() => setOpen(false)}
              >
                My Business
              </Link>

              <Link
	  href="/grand-opening/new"
	  className="block px-4 py-3 hover:bg-[#F8F3EC]"
	  onClick={() => setOpen(false)}
	>
	  🎉 Grand Opening
	</Link>
 <Link href="/business/new" className="block px-4 py-3 hover:bg-[#F8F3EC]" onClick={() => setOpen(false)}>
                Register Business
              </Link>


              <Link
                href="/events/new"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() => setOpen(false)}
              >
                Create Event
              </Link>

              <Link
                href="/deals/new"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() => setOpen(false)}
              >
                Create Deal
              </Link>

              <Link
                href="/coupons/new"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() => setOpen(false)}
              >
                Register Coupon
              </Link>
            </>
          )}

          {isAdmin && (
            <>
              <div className="border-t border-[#EFE5D8]" />

              <Link
                href="/admin/owner-requests"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() => setOpen(false)}
              >
                Owner Requests
              </Link>

              

              <Link
                href="/admin/event-requests"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() => setOpen(false)}
              >
                Event Requests
              </Link>
            </>
          )}

          <div className="border-t border-[#EFE5D8]" />

          <button
            type="button"
            onClick={logout}
            className="block w-full px-4 py-3 text-left text-red-600 hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}