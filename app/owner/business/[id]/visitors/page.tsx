import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import CommunityBottomNav from "@/app/components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import { requireBusinessManagementAccess } from "@/lib/requireBusinessManagementAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

type VisitRow = {
  visit_date: string;
  source: string;
};

const SOURCE_LABELS: Record<string, string> = {
  direct: "주소 직접 입력",
  google: "Google",
  instagram: "Instagram",
  ktowntriangle: "KTownTriangle",
  facebook: "Facebook",
  internal: "사이트 내부 이동",
  other: "기타",
};

const SOURCE_COLORS: Record<string, string> = {
  direct: "bg-slate-700",
  google: "bg-blue-500",
  instagram: "bg-pink-500",
  ktowntriangle: "bg-orange-500",
  facebook: "bg-indigo-600",
  internal: "bg-emerald-500",
  other: "bg-gray-400",
};

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase 환경변수가 설정되어 있지 않습니다.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function easternDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateText: string, amount: number) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function shortDate(dateText: string) {
  const [, month, day] = dateText.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export default async function BusinessVisitorsPage({ params }: PageProps) {
  const { id } = await params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) notFound();

  await requireBusinessManagementAccess(businessId);

  const supabase = getServerSupabase();
  const today = easternDate();
  const yesterday = addDays(today, -1);
  const sevenDaysAgo = addDays(today, -6);
  const thirtyDaysAgo = addDays(today, -29);

  const [businessResult, visitsResult] = await Promise.all([
    supabase.from("businesses").select("name").eq("id", businessId).maybeSingle(),
    supabase
      .from("business_website_visits")
      .select("visit_date,source")
      .eq("business_id", businessId)
      .gte("visit_date", thirtyDaysAgo)
      .lte("visit_date", today)
      .order("visit_date", { ascending: true }),
  ]);

  if (businessResult.error) throw new Error(businessResult.error.message);
  if (!businessResult.data) notFound();
  if (visitsResult.error) throw new Error(visitsResult.error.message);

  const businessName = businessResult.data.name?.trim() || `Business #${businessId}`;
  const visits = (visitsResult.data || []) as VisitRow[];
  const todayCount = visits.filter((visit) => visit.visit_date === today).length;
  const yesterdayCount = visits.filter((visit) => visit.visit_date === yesterday).length;
  const sevenDayCount = visits.filter((visit) => visit.visit_date >= sevenDaysAgo).length;
  const thirtyDayCount = visits.length;

  const dailyCounts = Array.from({ length: 30 }, (_, index) => {
    const date = addDays(thirtyDaysAgo, index);
    return {
      date,
      count: visits.filter((visit) => visit.visit_date === date).length,
    };
  });

  const sourceCounts = Object.entries(
    visits.reduce<Record<string, number>>((counts, visit) => {
      const source = SOURCE_LABELS[visit.source] ? visit.source : "other";
      counts[source] = (counts[source] || 0) + 1;
      return counts;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const maxDailyCount = Math.max(1, ...dailyCounts.map((item) => item.count));

  return (
    <>
      <main className="min-h-screen bg-[#F8F5F0] px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link
              href={`/owner/business/${businessId}/manage`}
              className="text-sm font-black text-[#B64032]"
            >
              ← 관리 메뉴
            </Link>
            <ProfileButton />
          </div>

          <div className="mb-7">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#B64032]">
              Website Analytics
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#172033]">방문자 통계</h1>
            <p className="mt-2 text-sm font-medium text-[#667085]">
              {businessName} · 미국 동부시간 기준 · 같은 브라우저는 하루 한 번만 집계
            </p>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["오늘", todayCount],
              ["어제", yesterdayCount],
              ["최근 7일", sevenDayCount],
              ["최근 30일", thirtyDayCount],
            ].map(([label, count]) => (
              <div key={String(label)} className="rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
                <p className="text-sm font-bold text-[#667085]">{label}</p>
                <p className="mt-2 text-4xl font-black text-[#172033]">{count}</p>
                <p className="mt-1 text-xs font-bold text-[#98A2B3]">순방문</p>
              </div>
            ))}
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-black text-[#172033]">최근 30일 일일 방문자</h2>
              <div className="mt-6 flex h-52 items-end gap-1">
                {dailyCounts.map((item, index) => (
                  <div key={item.date} className="group flex min-w-0 flex-1 flex-col items-center justify-end">
                    <span className="mb-1 hidden text-[10px] font-black text-[#667085] group-hover:block">
                      {item.count}
                    </span>
                    <div
                      title={`${item.date}: ${item.count}명`}
                      className="w-full min-h-[3px] rounded-t bg-[#B64032] transition hover:bg-[#8F2E24]"
                      style={{ height: `${Math.max(2, (item.count / maxDailyCount) * 170)}px` }}
                    />
                    {(index % 5 === 0 || index === 29) && (
                      <span className="mt-2 whitespace-nowrap text-[9px] font-bold text-[#98A2B3]">
                        {shortDate(item.date)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-black text-[#172033]">최근 30일 유입경로</h2>
              {sourceCounts.length === 0 ? (
                <div className="mt-8 rounded-2xl bg-[#F8F5F0] p-6 text-center text-sm font-bold text-[#667085]">
                  아직 기록된 방문자가 없습니다.
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  {sourceCounts.map(([source, count]) => {
                    const percentage = thirtyDayCount > 0 ? Math.round((count / thirtyDayCount) * 100) : 0;
                    return (
                      <div key={source}>
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black">
                          <span className="text-[#172033]">{SOURCE_LABELS[source] || "기타"}</span>
                          <span className="text-[#667085]">{count}명 · {percentage}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#EEE8E0]">
                          <div
                            className={`h-full rounded-full ${SOURCE_COLORS[source] || SOURCE_COLORS.other}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <CommunityBottomNav />
    </>
  );
}
