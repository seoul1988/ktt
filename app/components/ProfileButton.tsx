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

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      console.log("Profile role error:", error);
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

	  setTimeout(() => {
		refreshUser();
	  }, 300);
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
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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

  const isOwner = role === "owner";
  const isAdmin = role === "admin";

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
			<a
			  href="/my-coupons"
			  className="block px-4 py-3 hover:bg-gray-100"
			>
			  My Coupons
			</a>
          {isOwner && (
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
      href="/owner"
      className="block px-4 py-3 hover:bg-gray-100"
    >
      My Business
    </a>

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