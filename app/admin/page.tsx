"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CommunityBottomNav from "../components/CommunityBottomNav";
import { supabase } from "../../lib/supabase";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";

export default function AdminPage() {
  const [ownerRequestCount, setOwnerRequestCount] = useState(0);
  const [eventRequestCount, setEventRequestCount] = useState(0);
  const [couponRequestCount, setCouponRequestCount] = useState(0);
  const [adRequestCount, setAdRequestCount] = useState(0);

  useEffect(() => {
    loadCounts();
  }, []);

  async function loadCounts() {
    const [
      ownerResult,
      eventResult,
      couponResult,
      adResult,
    ] = await Promise.all([
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
    "relative flex min-h-[92px] flex-col items-center justify-center overflow-visible rounded-2xl bg-[#3C465A] px-3 py-4 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#30394B]";

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5 pb-28">
      <div className="mx-auto w-full max-w-xl">
        <div className="relative mb-6 flex h-10 items-center border-b border-[#E8DED1] pb-3">
          <BackButton />

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-2xl font-black text-[#172033]">
            Admin Dashboard
          </h1>

          <div className="ml-auto">
            <ProfileButton />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/admin/owner-requests" className={menuClass}>
            <span className="text-2xl">👤</span>
            <span className="mt-2">Owner Requests</span>
            <Badge count={ownerRequestCount} />
          </Link>

          <Link
            href="/admin/owner-business-matching"
            className={menuClass}
          >
            <span className="text-2xl">🔗</span>
            <span className="mt-2">Link Owner</span>
          </Link>

          <Link href="/admin/event-requests" className={menuClass}>
            <span className="text-2xl">🎉</span>
            <span className="mt-2">Event Requests</span>
            <Badge count={eventRequestCount} />
          </Link>

          <Link href="/admin/coupon-requests" className={menuClass}>
            <span className="text-2xl">🎟️</span>
            <span className="mt-2">Coupon Requests</span>
            <Badge count={couponRequestCount} />
          </Link>

          <Link href="/admin/businesses" className={menuClass}>
            <span className="text-2xl">🏪</span>
            <span className="mt-2">Businesses</span>
          </Link>

          <Link href="/admin/categories" className={menuClass}>
            <span className="text-2xl">🏷️</span>
            <span className="mt-2">Categories</span>
          </Link>

          <Link href="/admin/users" className={menuClass}>
            <span className="text-2xl">👥</span>
            <span className="mt-2">Members</span>
          </Link>

          <Link href="/admin/visitors" className={menuClass}>
            <span className="text-2xl">📊</span>
            <span className="mt-2">Visitor Statistics</span>
          </Link>

          <Link
            href="/admin/community/ads/magazines"
            className={`${menuClass} col-span-2 bg-[#B83A2F] hover:bg-[#9E3027]`}
          >
            <span className="text-2xl">📢</span>
            <span className="mt-2">광고 관리</span>
            <Badge count={adRequestCount} />
          </Link>
        </div>
      </div>

      <CommunityBottomNav activeNav="admin" />
    </main>
  );
}