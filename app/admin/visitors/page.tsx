import Link from "next/link";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import { supabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminVisitorsPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayIso = today.toISOString();

  const { count: totalVisits } = await supabase
    .from("visitor_logs")
    .select("*", { count: "exact", head: true });

  const { count: todayVisits } = await supabase
    .from("visitor_logs")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayIso);

  const { data: allUniqueData } = await supabase
    .from("visitor_logs")
    .select("visitor_key");

  const { data: todayUniqueData } = await supabase
    .from("visitor_logs")
    .select("visitor_key")
    .gte("created_at", todayIso);

  const { data: pageData } = await supabase
    .from("visitor_logs")
    .select("page");

  const allUniqueVisitors = new Set(
    (allUniqueData || []).map((v) => v.visitor_key)
  ).size;

  const todayUniqueVisitors = new Set(
    (todayUniqueData || []).map((v) => v.visitor_key)
  ).size;

  const pageCounts = new Map<string, number>();

  (pageData || []).forEach((item) => {
    const page = item.page || "/";
    pageCounts.set(page, (pageCounts.get(page) || 0) + 1);
  });

  const topPages = Array.from(pageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const cardClass =
    "rounded-3xl bg-white p-5 shadow-sm border border-gray-100";

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5 pb-32">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black text-[#172033]">
            Visitor Statistics
          </h1>

          <Link
            href="/admin"
            className="rounded-full bg-[#3C465A] px-4 py-2 text-sm font-bold text-white"
          >
            Back
          </Link>
        </div>

        <div className="space-y-4">
          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">Today</h2>

            <div className="space-y-3">
              <StatRow label="👤 Unique Visitors" value={todayUniqueVisitors} />
              <StatRow label="👣 Total Visits" value={todayVisits || 0} />
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">All Time</h2>

            <div className="space-y-3">
              <StatRow label="👤 Unique Visitors" value={allUniqueVisitors} />
              <StatRow label="👣 Total Visits" value={totalVisits || 0} />
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">
              Top Pages
            </h2>

            <div className="space-y-3">
              {topPages.length === 0 ? (
                <p className="text-sm font-bold text-gray-500">
                  No visitor data yet.
                </p>
              ) : (
                topPages.map(([page, count]) => (
                  <div
                    key={page}
                    className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-b-0"
                  >
                    <span className="min-w-0 truncate text-sm font-bold text-gray-700">
                      {page}
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-black text-[#172033]">
                      {count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <CommunityBottomNav activeNav="admin" />
    </main>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[#F8F3EC] px-4 py-3">
      <span className="font-bold text-gray-700">{label}</span>
      <span className="text-xl font-black text-[#172033]">
        {value.toLocaleString()}
      </span>
    </div>
  );
}