"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";

type Business = {
  id: number;
  name: string | null;
  address: string | null;
  phone?: string | null;
  category?: string | null;
};

type BusinessOwnerRow = {
  business_id: number;
  status: string | null;
  businesses: Business | Business[] | null;
};

export default function OwnerPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BusinessOwnerRow[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadMyBusinesses();
  }, []);

  async function loadMyBusinesses() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = String(profile?.role || "user").trim().toLowerCase();
    const isOwner = role === "owner";
    const adminUser = role === "admin";

    setIsAdmin(adminUser);

    if (!isOwner && !adminUser) {
      window.location.href = "/profile";
      return;
    }

    let query = supabase
      .from("business_owners")
      .select(`
        business_id,
        status,
        businesses (
          id,
          name,
          address,
          phone,
          category
        )
      `)
      .eq("status", "approved");

    if (isOwner && !adminUser) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.log("Owner businesses error:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data || []) as unknown as BusinessOwnerRow[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] text-[#172033]">
        <p className="font-bold">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between gap-3">
   <button
  onClick={() => {
    const from = document.referrer;

    if (from.includes("/map")) {
      window.location.href = "/map";
    } else {
      window.location.href = "/";
    }
  }}
  className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
>
  ← Back
</button>
          <h1 className="flex-1 text-center text-3xl font-black">
            My Business
          </h1>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 w-14 items-center justify-center rounded-full bg-white text-2xl font-black shadow"
            >
              ⋯
            </button>

            {menuOpen && (
  <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl bg-white text-sm font-bold shadow-xl">

    <button
      onClick={() => {
        window.location.href = "/profile";
      }}
      className="block w-full px-4 py-3 text-left hover:bg-gray-100"
    >
      Edit Profile
    </button>

    <button
      onClick={() => {
        window.location.href = "/my-coupons";
      }}
      className="block w-full px-4 py-3 text-left hover:bg-gray-100"
    >
      My Coupons
    </button>

    <button
      onClick={() => {
        window.location.href = "/owner";
      }}
      className="block w-full px-4 py-3 text-left hover:bg-gray-100"
    >
      My Business
    </button>

    {isAdmin && (
      <>
        <button
          onClick={() => {
            window.location.href = "/admin";
          }}
          className="block w-full px-4 py-3 text-left hover:bg-gray-100"
        >
          Admin Dashboard
        </button>

        <button
          onClick={() => {
            window.location.href = "/admin/community/events";
          }}
          className="block w-full px-4 py-3 text-left hover:bg-gray-100"
        >
          Manage Events
        </button>

        <button
          onClick={() => {
            window.location.href = "/admin/categories";
          }}
          className="block w-full px-4 py-3 text-left hover:bg-gray-100"
        >
          Manage Categories
        </button>
      </>
    )}

    <button
      onClick={() => {
        window.location.href = "/business/new";
      }}
      className="block w-full px-4 py-3 text-left hover:bg-gray-100"
    >
      Add Business
    </button>

    <button
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }}
      className="block w-full px-4 py-3 text-left hover:bg-gray-100"
    >
      Logout
    </button>
  </div>
)}
			
			
			
			
			
			
          </div>
        </div>

        {rows.length === 0 && (
          <div className="rounded-3xl bg-white p-5 font-bold shadow">
            No approved business connected yet.
          </div>
        )}

        <div className="space-y-4">
          {rows.map((row) => {
            const business = Array.isArray(row.businesses)
              ? row.businesses[0]
              : row.businesses;

            return (
              <div
                key={row.business_id}
                className="rounded-3xl bg-white p-5 shadow"
              >
                <h2 className="text-xl font-black">
                  {business?.name || "No business name"}
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  {business?.address || "No address"}
                </p>

                {business?.category && (
                  <p className="mt-1 text-sm text-gray-600">
                    Category: {business.category}
                  </p>
                )}

                {business?.phone && (
                  <p className="mt-1 text-sm text-gray-600">
                    Phone: {business.phone}
                  </p>
                )}

                <a
                  href={`/business/${row.business_id}/edit`}
                  className="mt-4 block rounded-2xl bg-[#172033] py-3 text-center font-extrabold text-white"
                >
                  Edit Business
                </a>
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}