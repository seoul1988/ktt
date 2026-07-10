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
      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-600 px-2 text-xs font-black text-white">
        {count}
      </span>
    );
  };

  const menuClass =
    "flex items-center justify-between rounded-2xl bg-[#3C465A] px-5 py-3.5 font-bold text-white shadow-sm";

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5">
      <div className="mx-auto w-full max-w-xl">
        <div className="relative mb-6 flex h-10 items-center border-b border-[#E8DED1] pb-3">
  {/* 왼쪽 */}
  <BackButton />

  {/* 가운데 */}
  <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-2xl font-black text-[#172033]">
    Admin Dashboard
  </h1>

  {/* 오른쪽 */}
  <div className="ml-auto">
    <ProfileButton />
  </div>
</div>

        <div className="space-y-3">
          <Link href="/admin/owner-requests" className={menuClass}>
            <span>👤 Owner Requests</span>
            <Badge count={ownerRequestCount} />
          </Link>

          <Link href="/admin/owner-business-matching" className={menuClass}>
            <span>🔗 Link Owner to Business</span>
          </Link>

          <Link href="/admin/event-requests" className={menuClass}>
            <span>🎉 Event Requests</span>
            <Badge count={eventRequestCount} />
          </Link>

          <Link href="/admin/coupon-requests" className={menuClass}>
            <span>🎟 Coupon Requests</span>
            <Badge count={couponRequestCount} />
          </Link>

          <Link href="/admin/ads" className={menuClass}>
            <span>📢 Ad Management</span>
            <Badge count={adRequestCount} />
          </Link>

          <Link href="/admin/businesses" className={menuClass}>
            <span>🏪 Businesses</span>
          </Link>

          <Link href="/admin/categories" className={menuClass}>
            <span>🏷 Categories</span>
          </Link>

          <Link href="/admin/users" className={menuClass}>
            <span>👥 Member Management</span>
          </Link>

          <Link href="/admin/visitors" className={menuClass}>
            <span>📊 Visitor Statistics</span>
          </Link>
        </div>
      </div>

      <CommunityBottomNav activeNav="admin" />
    </main>
  );
}