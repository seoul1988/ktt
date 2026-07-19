import CommunityBottomNav from "../../components/CommunityBottomNav";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type VisitorLogRow = {
  visitor_key?: string | null;
  page?: string | null;
  browser_language?: string | null;
  device_os?: string | null;
  user_agent?: string | null;
  created_at?: string | null;
};

function getEasternStartOfTodayIso() {
  const now = new Date();

  const easternDateText = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return new Date(`${easternDateText}T00:00:00-04:00`).toISOString();
}

function normalizeDeviceLabel(row: VisitorLogRow) {
  const savedOS = String(row.device_os || "")
    .trim()
    .toLowerCase();

  const userAgent = String(row.user_agent || "")
    .trim()
    .toLowerCase();

  const source = `${savedOS} ${userAgent}`;

  if (
    source.includes("iphone") ||
    source.includes("ipad") ||
    source.includes("ipod") ||
    savedOS === "ios"
  ) {
    return "🍎 iPhone / iPad";
  }

  if (
    source.includes("android") ||
    savedOS === "android"
  ) {
    return "🤖 Android";
  }

  if (
    source.includes("windows") ||
    savedOS === "windows"
  ) {
    return "🪟 Windows";
  }

  if (
    source.includes("macintosh") ||
    source.includes("mac os") ||
    savedOS === "macos" ||
    savedOS === "mac"
  ) {
    return "🖥️ Mac";
  }

  if (
    source.includes("linux") ||
    savedOS === "linux"
  ) {
    return "🐧 Linux";
  }

  return "💻 Other / Unknown";
}

function normalizeLanguageLabel(language?: string | null) {
  const lang = String(language || "")
    .trim()
    .toLowerCase();

  if (lang.startsWith("ko")) {
    return "🇰🇷 Korean";
  }

  if (lang.startsWith("en")) {
    return "🇺🇸 English";
  }

  if (lang.startsWith("es")) {
    return "🇪🇸 Spanish";
  }

  if (lang.startsWith("zh")) {
    return "🇨🇳 Chinese";
  }

  if (lang.startsWith("ja")) {
    return "🇯🇵 Japanese";
  }

  return "🌍 Other / Unknown";
}

export default async function AdminVisitorsPage() {
  const todayIso = getEasternStartOfTodayIso();

  /*
   * select("*")를 사용하면 현재 visitor_logs 테이블에
   * device_os 또는 user_agent 컬럼이 아직 없어도 페이지가 동작합니다.
   *
   * 컬럼이 추가된 후 새 로그부터 자동으로 기기 통계에 반영됩니다.
   */
  const { data, error } = await supabase
    .from("visitor_logs")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 pb-32 text-[#172033]">
        <div className="mx-auto w-full max-w-xl">
          <div className="relative mb-6 flex h-10 items-center border-b border-[#E8DED1] pb-3">
            <BackButton />

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
          </div>
        </div>

        <CommunityBottomNav activeNav="admin" />
      </main>
    );
  }

  const logs = (data || []) as VisitorLogRow[];

  const todayLogs = logs.filter((row) => {
    if (!row.created_at) return false;

    const createdAt = new Date(row.created_at);

    if (Number.isNaN(createdAt.getTime())) {
      return false;
    }

    return createdAt.getTime() >= new Date(todayIso).getTime();
  });

  const totalVisits = logs.length;
  const todayVisits = todayLogs.length;

  const allUniqueVisitors = new Set(
    logs
      .map((row) => row.visitor_key)
      .filter(Boolean),
  ).size;

  const todayUniqueVisitors = new Set(
    todayLogs
      .map((row) => row.visitor_key)
      .filter(Boolean),
  ).size;

  const pageCounts = new Map<string, number>();

  logs.forEach((item) => {
    const page = item.page || "/";
    pageCounts.set(
      page,
      (pageCounts.get(page) || 0) + 1,
    );
  });

  const topPages = Array.from(
    pageCounts.entries(),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const languageCounts =
    new Map<string, number>();

  logs.forEach((item) => {
    const label =
      normalizeLanguageLabel(
        item.browser_language,
      );

    languageCounts.set(
      label,
      (languageCounts.get(label) || 0) + 1,
    );
  });

  const languageStats = Array.from(
    languageCounts.entries(),
  ).sort((a, b) => b[1] - a[1]);

  const deviceCounts =
    new Map<string, number>();

  logs.forEach((item) => {
    const label =
      normalizeDeviceLabel(item);

    deviceCounts.set(
      label,
      (deviceCounts.get(label) || 0) + 1,
    );
  });

  const deviceStats = Array.from(
    deviceCounts.entries(),
  ).sort((a, b) => b[1] - a[1]);

  const todayDeviceCounts =
    new Map<string, number>();

  todayLogs.forEach((item) => {
    const label =
      normalizeDeviceLabel(item);

    todayDeviceCounts.set(
      label,
      (todayDeviceCounts.get(label) || 0) + 1,
    );
  });

  const todayDeviceStats = Array.from(
    todayDeviceCounts.entries(),
  ).sort((a, b) => b[1] - a[1]);

  const cardClass =
    "rounded-3xl border border-gray-100 bg-white p-5 shadow-sm";

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5 pb-32">
      <div className="mx-auto w-full max-w-xl">
        <div className="relative mb-6 flex h-10 items-center border-b border-[#E8DED1] pb-3">
          <BackButton />

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
                value={todayUniqueVisitors}
              />

              <StatRow
                label="👣 전체 접속 수"
                value={todayVisits}
              />
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">
              All Time
            </h2>

            <div className="space-y-3">
              <StatRow
                label="👤 중복 제외 방문자"
                value={allUniqueVisitors}
              />

              <StatRow
                label="👣 전체 접속 수"
                value={totalVisits}
              />
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">
              📱 Today&apos;s Devices
            </h2>

            <StatsList
              stats={todayDeviceStats}
              emptyText="No device data today."
            />
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">
              📱 Device / Operating System
            </h2>

            <StatsList
              stats={deviceStats}
              emptyText="No device data yet."
            />
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-black text-[#172033]">
              🌐 Browser Language
            </h2>

            <StatsList
              stats={languageStats}
              emptyText="No language data yet."
            />
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
                topPages.map(
                  ([page, count]) => (
                    <div
                      key={page}
                      className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-b-0"
                    >
                      <span className="min-w-0 truncate text-sm font-bold text-gray-700">
                        {page}
                      </span>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-black text-[#172033]">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ),
                )
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
  stats: [string, number][];
  emptyText: string;
}) {
  if (stats.length === 0) {
    return (
      <p className="text-sm font-bold text-gray-500">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {stats.map(([label, count]) => (
        <StatRow
          key={label}
          label={label}
          value={count}
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
      <span className="font-bold text-gray-700">
        {label}
      </span>

      <span className="text-xl font-black text-[#172033]">
        {value.toLocaleString()}
      </span>
    </div>
  );
}