import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import BusinessMediaViewer from "../../components/BusinessMediaViewer";
import ProfileButton from "../../components/ProfileButton";
import BottomNav from "../../components/BottomNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageParams = Promise<{
  id: string;
}>;

async function deleteGrandOpening(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");

  if (id) {
    await supabase.from("grand_openings").delete().eq("id", id);
  }

  redirect("/grand-openings");
}

export default async function GrandOpeningDetailPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;

  const { data: item, error } = await supabase
    .from("grand_openings")
    .select("*")
    .eq("id", id)
    .single();

  if (!item || error) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
        <p>Grand Opening 정보를 찾을 수 없습니다.</p>

        <Link
          href="/grand-openings"
          className="mt-4 inline-block rounded-full bg-black px-4 py-2 text-sm font-bold text-white"
        >
          ← Back
        </Link>

        <BottomNav activeNav="map" />
      </main>
    );
  }

  const images = Array.isArray(item.images)
    ? item.images.filter(Boolean)
    : [];

  const videos = item.video_url ? [item.video_url] : [];

  const title = item.title || item.business_name || "Grand Opening";
  const mapQuery = item.address || item.location || title;

  return (
    <main className="min-h-screen bg-[#F8F3EC] pb-28 text-[#172033]">
      <div className="mx-auto max-w-xl">
        <header className="sticky top-0 z-50 bg-[#F8F3EC]/95 shadow-sm backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link
              href="/grand-openings"
              className="shrink-0 text-sm font-extrabold text-[#172033]"
            >
              ← Back
            </Link>

            <h1 className="min-w-0 flex-1 truncate text-center text-lg font-extrabold">
              GRAND OPENING
            </h1>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              <ProfileButton />
            </div>
          </div>
        </header>

        <BusinessMediaViewer images={images} videos={videos} name={title} />

        <section className="px-5 pb-32 pt-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-black leading-tight">{title}</h2>

              {item.business_name && (
                <p className="mt-2 text-base font-bold text-[#8A5A20]">
                  {item.business_name}
                </p>
              )}
            </div>

            <div className="flex shrink-0 gap-2 pt-1">
              <Link
                href={`/grand-openings/${id}/edit`}
                className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700"
              >
                수정
              </Link>

              <form action={deleteGrandOpening}>
                <input type="hidden" name="id" value={id} />
                <button
                  type="submit"
                  className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600"
                >
                  삭제
                </button>
              </form>
            </div>
          </div>

          {item.description && (
            <>
              <hr className="my-5 border-gray-200" />

              <p className="whitespace-pre-line text-[15px] leading-7 text-gray-700">
                {item.description}
              </p>
            </>
          )}

          <hr className="my-5 border-gray-200" />

          <div className="space-y-3 text-[15px] leading-6">
            {item.link_url && (
              <p>
                <span className="font-semibold">Website: </span>
                <a
                  href={item.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words text-[#2453A6] underline"
                >
                  {item.link_url}
                </a>
              </p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {item.phone && (
              <a
                href={`tel:${item.phone}`}
                className="rounded-2xl bg-black px-4 py-3 text-center text-sm font-extrabold text-white"
              >
                ☎ Call
              </a>
            )}

            {mapQuery && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  mapQuery
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl bg-[#8A5A20] px-4 py-3 text-center text-sm font-extrabold text-white"
              >
                ↱ Directions
              </a>
            )}
          </div>
        </section>
      </div>

      <BottomNav activeNav="map" />
    </main>
  );
}