import Link from "next/link";
import CommunityBottomNav from "../components/CommunityBottomNav";
import { supabase } from "../../lib/supabase";

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
      <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-red-600 px-2 text-sm font-black text-white">
        {count}
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-3xl font-black text-[#172033]">
          Admin Dashboard
        </h1>

        <div className="space-y-4">
          <Link
            href="/admin/owner-requests"
            className="flex items-center justify-between rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            <span>👤 Owner Requests</span>
            <Badge count={ownerRequestCount} />
          </Link>

          <Link
            href="/admin/owner-business-matching"
            className="block rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            🔗 Link Owner to Business
          </Link>

          <Link
            href="/admin/event-requests"
            className="flex items-center justify-between rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            <span>🎉 Event Requests</span>
            <Badge count={eventRequestCount} />
          </Link>

          <Link
            href="/admin/coupon-requests"
            className="flex items-center justify-between rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            <span>🎟 Coupon Requests</span>
            <Badge count={couponRequestCount} />
          </Link>

          <Link
            href="/admin/ads"
            className="flex items-center justify-between rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            <span>📢 Ad Management</span>
            <Badge count={adRequestCount} />
          </Link>

          <Link
            href="/admin/businesses"
            className="block rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            🏪 Businesses
          </Link>

          <Link
            href="/admin/categories"
            className="block rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            🏷 Categories
          </Link>

          <Link
            href="/admin/users"
            className="block rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            👥 Member Management
          </Link>
        </div>
      </div>

      <CommunityBottomNav activeNav="admin" />
    </main>
  );
}