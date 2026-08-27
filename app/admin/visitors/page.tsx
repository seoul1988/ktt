import Link from "next/link";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "@/app/components/ProfileButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StatItem = {
  label: string;
  count: number;
};

type DashboardStats = {
  todayVisits: number;
  todayUniqueVisitors: number;
  monthlyUniqueVisitors: number;
  allTimeUniqueVisitors: number;
  totalVisits: number;
  todayDeviceStats: StatItem[];
  deviceStats: StatItem[];
  languageStats: StatItem[];
  topPages: StatItem[];
};

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeStatItems(value: unknown): StatItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => ({
      label: String(item?.label ?? ""),
      count: toNumber(item?.count),
    }))
    .filter((item) => item.label && item.count > 0);
}

function normalizeDashboardStats(value: unknown): DashboardStats {
  const row =
    Array.isArray(value) && value.length > 0
      ? value[0]
      : value && typeof value === "object"
        ? value
        : {};

  const data = row as any;

  return {
    todayVisits: toNumber(data.today_visits ?? data.todayVisits),
    todayUniqueVisitors: toNumber(
      data.today_unique_visitors ?? data.todayUniqueVisitors,
    ),
    monthlyUniqueVisitors: toNumber(
      data.monthly_unique_visitors ?? data.monthlyUniqueVisitors,
    ),
    allTimeUniqueVisitors: toNumber(
      data.all_time_unique_visitors ?? data.allTimeUniqueVisitors,
    ),
    totalVisits: toNumber(data.total_visits ?? data.totalVisits),
    todayDeviceStats: normalizeStatItems(
      data.today_device_stats ?? data.todayDeviceStats,
    ),
    deviceStats: normalizeStatItems(
      data.device_stats ?? data.deviceStats,
    ),
    languageStats: normalizeStatItems(
      data.language_stats ?? data.languageStats,
    ),
    topPages: normalizeStatItems(
      data.top_pages ?? data.topPages,
    ),
  };
}

function getEasternDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function detectDevice(userAgent: string | null | undefined) {
  const ua = String(userAgent ?? "");

  if (/iPhone|iPad|iPod/i.test(ua)) {
    return "🍎 iPhone / iPad";
  }

  if (/Android/i.test(ua)) {
    return "🤖 Android";
  }

  if (/Windows/i.test(ua)) {
    return "🪟 Windows";
  }

  if (/Macintosh|Mac OS X/i.test(ua)) {
    return "🖥️ Mac";
  }

  if (/Linux/i.test(ua)) {
    return "🐧 Linux";
  }

  return "💻 Other / Unknown";
}

async function getTodayUniqueDeviceStats(): Promise<StatItem[]> {
  const now = new Date();
  const todayEastern = getEasternDateKey(now);
  const from = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("visitor_logs")
    .select("visitor_key,user_id,ip_address,user_agent,created_at,is_bot")
    .gte("created_at", from)
    .lte("created_at", now.toISOString());

  if (error) {
    console.error("today unique device stats error:", error);
    return [];
  }

  const deviceVisitors = new Map<string, Set<string>>();

  for (const row of data ?? []) {
    if (row.is_bot === true) continue;
    if (!row.created_at) continue;

    const createdAt = new Date(row.created_at);

    if (getEasternDateKey(createdAt) !== todayEastern) {
      continue;
    }

    const dedupKey =
      String(row.visitor_key ?? "").trim() ||
      String(row.user_id ?? "").trim() ||
      String(row.ip_address ?? "").trim();

    if (!dedupKey) continue;

    const device = detectDevice(row.user_agent);

    if (!deviceVisitors.has(device)) {
      deviceVisitors.set(device, new Set<string>());
    }

    deviceVisitors.get(device)!.add(dedupKey);
  }

  return Array.from(deviceVisitors.entries())
    .map(([label, visitors]) => ({
      label,
      count: visitors.size,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

export default async function AdminVisitorsPage() {
  const [{ data, error }, todayUniqueDeviceStats] = await Promise.all([
    supabase.rpc("get_visitor_dashboard_stats"),
    getTodayUniqueDeviceStats(),
  ]);

  if (error) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 pb-32 text-[#172033]">
        <div className="mx-auto w-full max-w-2xl">
          <div className="relative mb-6 flex h-10 items-center border-b border-[#E8DED1] pb-3">
            <Link
              href="/admin"
              className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033] shadow"
            >
              ← Back
            </Link>

            <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xl font-black">
              Visitor Statistics
            </h1>

            <div className="ml-auto">
              <ProfileButton />
            </div>
          </div>

          <div className="rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
            <p className="font-black text-red-600">
              방문자 통계를 불러오지 못했습니다.
            </p>

            <p className="mt-2 break-words text-sm font-semibold text-gray-600">
              {error.message}
            </p>

            <p className="mt-3 text-xs font-bold leading-5 text-gray-500">
              Supabase SQL Editor에서 visitor_stats_optimization.sql을 먼저
              실행했는지 확인하세요.
            </p>
          </div>
        </div>

        <CommunityBottomNav activeNav="admin" />
      </main>
    );
  }

  const stats = normalizeDashboardStats(data);
  stats.todayDeviceStats = todayUniqueDeviceStats;

  const cardClass =
    "rounded-3xl border border-gray-100 bg-white p-5 shadow-sm";

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5 pb-32">
      <div className="mx-auto w-full max-w-2xl">
        <div className="relative mb-6 flex h-10 items-center border-b border-[#E8DED1] pb-3">
          <Link
            href="/admin"
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033] shadow"
          >
            ← Back
          </Link>

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xl font-black text-[#172033]">
            Visitor Statistics
          </h1>

          <div className="ml-auto">
            <ProfileButton />
          </div>
        </div>

        <div className="space-y-4">
          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">
              Today
            </h2>

            <div className="space-y-3">
              <StatRow
                label="👤 중복 제외 방문자"
                value={stats.todayUniqueVisitors}
              />

              <StatRow
                label="👣 전체 접속 수"
                value={stats.todayVisits}
              />
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">
              All Time
            </h2>

            <div className="space-y-3">
              <StatRow
                label="👤 이번 달 중복 제외 방문자"
                value={stats.monthlyUniqueVisitors}
              />

              <StatRow
                label="👤 Since 07/12/26 : 총 중복 제외 방문자 수"
                value={stats.allTimeUniqueVisitors}
              />

              <StatRow
                label="👣 전체 접속 수"
                value={stats.totalVisits}
              />
            </div>
          </div>

          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-xl font-black text-[#172033]">
                📱 Today&apos;s Devices
              </h2>
              <p className="mt-1 text-[11px] font-bold text-[#7C746A]">
                중복 제외 방문자 기준
              </p>
            </div>

            <StatsList
              stats={stats.todayDeviceStats}
              emptyText="No device data today."
            />
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">
              📱 Device / Operating System
            </h2>

            <StatsList
              stats={stats.deviceStats}
              emptyText="No device data yet."
            />
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">
              🌐 Browser Language
            </h2>

            <StatsList
              stats={stats.languageStats}
              emptyText="No language data yet."
            />
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">
              Top Pages
            </h2>

            <div className="space-y-3">
              {stats.topPages.length === 0 ? (
                <p className="text-sm font-bold text-gray-500">
                  No visitor data yet.
                </p>
              ) : (
                stats.topPages.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-b-0"
                  >
                    <span className="min-w-0 truncate text-sm font-bold text-gray-700">
                      {item.label}
                    </span>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-black text-[#172033]">
                      {item.count.toLocaleString()}
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

function StatsList({
  stats,
  emptyText,
}: {
  stats: StatItem[];
  emptyText: string;
}) {
  if (stats.length === 0) {
    return <p className="text-sm font-bold text-gray-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {stats.map((item) => (
        <StatRow
          key={item.label}
          label={item.label}
          value={item.count}
        />
      ))}
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[#F8F3EC] px-4 py-3">
      <span className="font-bold text-gray-700">{label}</span>

      <span className="text-xl font-black text-[#172033]">
        {value.toLocaleString()}
      </span>
    </div>
  );
}