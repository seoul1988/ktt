import Link from "next/link";
import CommunityBottomNav from "../components/CommunityBottomNav";
export const dynamic = "force-dynamic";
export const revalidate = 0;



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
			<a
			  href="/admin/owner-business-matching"
			  className="block rounded-2xl bg-[#172033] p-5 font-bold text-white"
			>
			  🔗 Link Owner to Business
			</a>
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
		  href="/admin/ads"
		  className="block rounded-2xl bg-[#172033] p-5 font-bold text-white"
		>
		  📢 Ad Management
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