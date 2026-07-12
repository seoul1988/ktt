export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";

function getYoutubeEmbedUrl(url: string | null | undefined) {
  if (!url) return null;

  const value = String(url).trim();

  if (value.includes("youtube.com/watch?v=")) {
    const id = value.split("v=")[1]?.split("&")[0];

    return id
      ? `https://www.youtube.com/embed/${id}`
      : null;
  }

  if (value.includes("youtu.be/")) {
    const id = value
      .split("youtu.be/")[1]
      ?.split("?")[0];

    return id
      ? `https://www.youtube.com/embed/${id}`
      : null;
  }

  if (value.includes("youtube.com/shorts/")) {
    const id = value
      .split("youtube.com/shorts/")[1]
      ?.split("?")[0];

    return id
      ? `https://www.youtube.com/embed/${id}`
      : null;
  }

  return null;
}

function GrandOpeningMedia({
  item,
}: {
  item: any;
}) {
  const youtubeUrl = getYoutubeEmbedUrl(item.video_url);

  const imageUrl =
    Array.isArray(item.images) && item.images.length > 0
      ? item.images[0]
      : item.image_url || "/event.png";

  if (youtubeUrl) {
    return (
      <div className="aspect-[3/2] w-full overflow-hidden bg-white">
        <iframe
          src={youtubeUrl}
          title={
            item.title ||
            item.business_name ||
            "Grand Opening"
          }
          className="block h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (item.video_url) {
    return (
      <div className="aspect-[3/2] w-full overflow-hidden bg-white">
        <video
          src={item.video_url}
          controls
          muted
          playsInline
          preload="metadata"
          className="block h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="aspect-[3/2] w-full overflow-hidden bg-white">
      <img
        src={imageUrl}
        alt={
          item.business_name ||
          item.title ||
          "Grand Opening"
        }
        className="block h-full w-full object-contain"
      />
    </div>
  );
}



function formatOpeningDate(
  dateValue: string | null | undefined,
) {
  if (!dateValue) return "Coming Soon";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function GrandOpeningsPage() {
  const {
    data: grandOpenings,
    error,
  } = await supabase
    .from("grand_openings")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 pb-28 pt-6 text-[#172033]">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link
            href="/"
            className="flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-black shadow-sm transition active:scale-95"
          >
            ← Back
          </Link>

          <h1 className="truncate text-center text-lg font-black tracking-wide">
            GRAND OPENINGS
          </h1>

          <Link
            href="/grand-openings/new"
            aria-label="Add grand opening"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C4483A] text-xl font-black text-white shadow-sm transition active:scale-95"
          >
            +
          </Link>
        </div>

        {error ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <p className="font-black text-red-600">
              Unable to load grand openings.
            </p>

            <p className="mt-2 text-sm text-gray-500">
              {error.message}
            </p>
          </div>
        ) : !grandOpenings ||
          grandOpenings.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <p className="font-bold">
              No grand openings yet.
            </p>

            <p className="mt-2 text-sm text-gray-500">
              New grand openings will appear
              here.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {grandOpenings.map(
              (item: any) => (
                <Link
                  key={item.id}
                  href={`/grand-openings/${item.id}`}
                  className="block overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="h-56 w-full overflow-hidden bg-gray-100 sm:h-64">
                    <GrandOpeningMedia
                      item={item}
                    />
                  </div>

                  <div className="relative bg-white p-5">
                    <p className="text-xs font-black uppercase tracking-wide text-[#C4483A]">
                      {formatOpeningDate(
                        item.opening_date,
                      )}
                    </p>

                    <h2 className="mt-1 break-words text-xl font-black leading-tight text-[#172033]">
                      {item.business_name ||
                        "Grand Opening"}
                    </h2>

                    {item.title && (
                      <p className="mt-2 break-words text-sm font-bold text-gray-700">
                        {item.title}
                      </p>
                    )}

                    {item.description && (
                      <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-gray-600">
                        {item.description}
                      </p>
                    )}

                    {item.location && (
                      <p className="mt-3 flex items-start gap-1 text-sm font-semibold text-gray-500">
                        <span>📍</span>

                        <span className="break-words">
                          {item.location}
                        </span>
                      </p>
                    )}
                  </div>
                </Link>
              ),
            )}
          </div>
        )}
      </div>

      <BottomNav activeNav="home" />
    </main>
  );
}