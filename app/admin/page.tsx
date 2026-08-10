"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CommunityBottomNav from "../components/CommunityBottomNav";
import { supabase } from "../../lib/supabase";
import ProfileButton from "@/app/components/ProfileButton";

export default function AdminPage() {
  const [ownerRequestCount, setOwnerRequestCount] = useState(0);
  const [eventRequestCount, setEventRequestCount] = useState(0);
  const [couponRequestCount, setCouponRequestCount] = useState(0);
  const [adRequestCount, setAdRequestCount] = useState(0);

  useEffect(() => {
    loadCounts();
  }, []);

  async function loadCounts() {
    const [ownerResult, eventResult, couponResult, adResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("owner_status", "pending"),

        supabase
          .from("event_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        supabase
          .from("coupons")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        supabase
          .from("ads")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

    if (ownerResult.error) {
      console.error("Owner count error:", ownerResult.error);
    }

    if (eventResult.error) {
      console.error("Event count error:", eventResult.error);
    }

    if (couponResult.error) {
      console.error("Coupon count error:", couponResult.error);
    }

    if (adResult.error) {
      console.error("Ad count error:", adResult.error);
    }

    setOwnerRequestCount(ownerResult.count ?? 0);
    setEventRequestCount(eventResult.count ?? 0);
    setCouponRequestCount(couponResult.count ?? 0);
    setAdRequestCount(adResult.count ?? 0);
  }

  const Badge = ({ count }: { count: number }) => {
    if (count <= 0) return null;

    return (
      <span className="absolute right-2 top-2 z-20 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-black text-white shadow-md">
        {count > 99 ? "99+" : count}
      </span>
    );
  };

  const menuClass =
    "group relative flex min-h-[92px] touch-manipulation flex-col items-center justify-center overflow-visible rounded-2xl bg-[#3C465A] px-3 py-4 text-center text-sm font-bold text-white shadow-sm outline-none transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] [-webkit-tap-highlight-color:transparent] hover:bg-[#30394B] focus-visible:ring-2 focus-visible:ring-[#172033] focus-visible:ring-offset-2 active:-translate-y-0.5 active:scale-[1.03] active:bg-[#30394B] active:shadow-md";

  const iconClass =
    "text-2xl will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-active:-translate-y-0.5 group-active:scale-[1.16]";

  const labelClass =
    "mt-2 will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-active:scale-[1.04]";

  return (
    <main className="min-h-screen bg-[#F5F2EC] pb-28">
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        {/* HEADER */}
        <div className="relative mb-5 flex min-h-[48px] items-center">
          <Link
            href="/"
            className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#172033] shadow-sm transition hover:bg-gray-50 active:scale-[0.98]"
          >
            ← Back
          </Link>

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-2xl font-black text-[#172033]">
            Admin Dashboard
          </h1>

          <div className="ml-auto">
            <ProfileButton />
          </div>
        </div>

        {/* ADMIN MENU */}
        <div className="grid grid-cols-2 gap-3">
          {/* OWNER REQUESTS */}
          <Link href="/admin/owner-requests" className={menuClass}>
            <span className={iconClass}>👤</span>

            <span className={labelClass}>
              Owner Requests
            </span>

            <Badge count={ownerRequestCount} />
          </Link>

          {/* LINK OWNER */}
          <Link
            href="/admin/owner-business-matching"
            className={menuClass}
          >
            <span className={iconClass}>🔗</span>

            <span className={labelClass}>
              Link Owner
            </span>
          </Link>

          {/* EVENT REQUESTS */}
          <Link
            href="/admin/event-requests"
            className={menuClass}
          >
            <span className={iconClass}>🎉</span>

            <span className={labelClass}>
              Event Requests
            </span>

            <Badge count={eventRequestCount} />
          </Link>

          {/* COUPON REQUESTS */}
          <Link
            href="/admin/coupon-requests"
            className={menuClass}
          >
            <span className={iconClass}>🎟️</span>

            <span className={labelClass}>
              Coupon Requests
            </span>

            <Badge count={couponRequestCount} />
          </Link>

          {/* BUSINESSES */}
          <Link
            href="/admin/businesses"
            className={menuClass}
          >
            <span className={iconClass}>🏪</span>

            <span className={labelClass}>
              Businesses
            </span>
          </Link>

          {/* BANNER MANAGEMENT */}
          <Link
            href="/admin/banners"
            className={menuClass}
          >
            <span className={iconClass}>🖼️</span>

            <span className={labelClass}>
              Banner Management
            </span>
          </Link>

          {/* CATEGORIES */}
          <Link
            href="/admin/categories"
            className={menuClass}
          >
            <span className={iconClass}>🏷️</span>

            <span className={labelClass}>
              Categories
            </span>
          </Link>

          {/* MEMBERS */}
          <Link
            href="/admin/users"
            className={menuClass}
          >
            <span className={iconClass}>👥</span>

            <span className={labelClass}>
              Members
            </span>
          </Link>

          {/* VISITOR STATISTICS */}
          <Link
            href="/admin/visitors"
            className={menuClass}
          >
            <span className={iconClass}>📊</span>

            <span className={labelClass}>
              Visitor Statistics
            </span>
          </Link>

          {/* AD MANAGEMENT */}
          <Link
            href="/admin/community/ads/magazines"
            className={`${menuClass} bg-[#B83A2F] hover:bg-[#9E3027] active:bg-[#9E3027]`}
          >
            <span className={iconClass}>📢</span>

            <span className={labelClass}>
              광고 관리
            </span>

            <Badge count={adRequestCount} />
          </Link>
        </div>
      </div>

      <CommunityBottomNav activeNav="admin" />
    </main>
  );
}