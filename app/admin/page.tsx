import Link from "next/link";
import CommunityBottomNav from "../components/CommunityBottomNav";
export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-3xl font-black text-[#172033]">
          Admin Dashboard
        </h1>

        <div className="space-y-4">

          <Link
            href="/admin/owner-requests"
            className="block rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            👤 Owner Requests
          </Link>

          <Link
            href="/admin/event-requests"
            className="block rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            🎉 Event Requests
          </Link>

          <Link
            href="/admin/coupon-requests"
            className="block rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            🎟 Coupon Requests
          </Link>

          <Link
            href="/admin/community-requests"
            className="block rounded-2xl bg-[#172033] p-5 font-bold text-white"
          >
            📅 Community Requests
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