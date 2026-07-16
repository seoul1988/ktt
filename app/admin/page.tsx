import Link from "next/link";
import CommunityBottomNav from "../components/CommunityBottomNav";
import { supabase } from "../../lib/supabase";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const { count: ownerRequestCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("owner_status", "pending");

  const { count: eventRequestCount } = await supabase
    .from("event_requests")
    .select("*", { count: "exact", head: true })
    .not("status", "in", '("approved","deleted")');

  const { count: couponRequestCount } = await supabase
    .from("coupons")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: adRequestCount } = await supabase
    .from("ads")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const Badge = ({ count }: { count: number | null }) => {
    if (!count || count <= 0) return null;

    return (
      <span className="absolute right-2 top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-600 px-2 text-xs font-black text-white">
        {count}
      </span>
    );
  };

  const menuClass =
    "relative flex min-h-[92px] flex-col items-center justify-center rounded-2xl bg-[#3C465A] px-3 py-4 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#30394B]";

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