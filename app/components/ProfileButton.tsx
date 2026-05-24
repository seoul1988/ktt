"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type ProfileRole = "user" | "owner" | "admin";

export default function ProfileButton() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<ProfileRole>("user");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email,
          role: "user",
        });

        setRole("user");
        return;
      }

      setRole((profile.role || "user") as ProfileRole);
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

  if (role === "owner" || role === "admin") {
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