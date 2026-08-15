import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TrafficShot = {
  name: string;
  src: string;
};

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

function parseTrafficFilename(filename: string): number {
  // Example:
  // KTown-Triangle-08-14-2026_10_08_PM.jpg
  const match = filename.match(
    /KTown-Triangle-(\d{2})-(\d{2})-(\d{4})_(\d{1,2})_(\d{2})_(AM|PM)\.(?:png|jpg|jpeg)$/i,
  );

  if (!match) return Number.MAX_SAFE_INTEGER;

  const [, monthText, dayText, yearText, hourText, minuteText, ampmText] = match;

  const month = Number(monthText);
  const day = Number(dayText);
  const year = Number(yearText);
  let hour = Number(hourText);
  const minute = Number(minuteText);
  const ampm = ampmText.toUpperCase();

  if (ampm === "AM") {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function getTrafficScreenshots(): TrafficShot[] {
  const directory = path.join(process.cwd(), "public", "traffic");

  try {
    if (!fs.existsSync(directory)) return [];

    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .filter((entry) => IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => ({
        name: entry.name,
        src: `/traffic/${encodeURIComponent(entry.name)}`,
      }))
      .sort((a, b) => {
        const aTime = parseTrafficFilename(a.name);
        const bTime = parseTrafficFilename(b.name);

        if (aTime !== bTime) return aTime - bTime;

        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    console.error("traffic screenshots error:", error);
    return [];
  }
}

function displayName(filename: string) {
  const match = filename.match(
    /KTown-Triangle-(\d{2})-(\d{2})-(\d{4})_(\d{1,2})_(\d{2})_(AM|PM)\.(?:png|jpg|jpeg)$/i,
  );

  if (!match) {
    return filename.replace(/\.(?:png|jpg|jpeg)$/i, "").replace(/[_-]+/g, " ").trim();
  }

  const [, month, day, year, hour, minute, ampm] = match;

  return `${month}/${day}/${year} ${hour}:${minute} ${ampm.toUpperCase()}`;
}

export default function CommunityTrafficPage() {
  const screenshots = getTrafficScreenshots();

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-xl px-5 pb-16 pt-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C4483A]">
              TRAFFIC PROOF
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">
              KTown Triangle 방문 현황
            </h1>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#6B6257]">
              실제 관리자 통계 화면을 캡처한 이미지입니다.
            </p>
          </div>

          <Link
            href="/community"
            className="shrink-0 rounded-full border border-[#E5DCCF] bg-white px-3 py-2 text-xs font-black shadow-sm"
          >
            ← 돌아가기
          </Link>
        </div>

        {screenshots.length > 0 ? (
          <div className="space-y-5">
            {screenshots.map((shot, index) => (
              <article
                key={shot.name}
                className="overflow-hidden rounded-3xl border border-[#E8DED1] bg-white shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-[#EFE7DC] px-4 py-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#C4483A]">
                      {index === screenshots.length - 1 ? "LATEST CAPTURE" : "CAPTURE"}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-[#6B6257]">
                      {displayName(shot.name)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[9px] font-black text-[#9A5A00]">
                    ORIGINAL SCREENSHOT
                  </span>
                </div>

                <a
                  href={shot.src}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-[#F3EEE7] p-2"
                  aria-label={`${displayName(shot.name)} 원본 이미지 크게 보기`}
                >
                  <img
                    src={shot.src}
                    alt={`KTown Triangle 방문자 통계 실제 캡처 - ${displayName(shot.name)}`}
                    className="h-auto w-full rounded-2xl bg-white object-contain"
                  />
                </a>

                <p className="px-4 py-3 text-center text-[10px] font-semibold text-[#7C746A]">
                  이미지를 누르면 원본 크기로 확인할 수 있습니다.
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[#D8C9B5] bg-white px-6 py-12 text-center shadow-sm">
            <div className="text-4xl">📸</div>
            <h2 className="mt-4 text-lg font-black">아직 등록된 통계 캡처가 없습니다.</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#6B6257]">
              public/traffic 폴더에 PNG 또는 JPG 캡처 이미지를 넣으면 파일명의 촬영 시간 기준으로 오래된 이미지부터 자동으로 표시됩니다.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}