export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";

function GrandOpeningMedia({ item }: { item: any }) {
  const imageUrl =
    Array.isArray(item.images) && item.images.length > 0
      ? item.images[0]
      : item.image_url || "/event.png";

  return (
    <div className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden bg-white p-2">
      <img
        src={imageUrl}
        alt={
          item.business_name ||
          item.title ||
          "Grand Opening"
        }
        loading="lazy"
        decoding="async"
        className="block h-full w-full object-contain"
      />
    </div>
  );
}

function formatOpeningDate(dateValue: string | null | undefined) {
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
  const { data: grandOpenings, error } = await supabase
    .from("grand_openings")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  return (
    <main className="safe-screen bg-[#F8F3EC] px-5 pb-[calc(7rem+var(--app-safe-bottom))] pt-[calc(var(--app-safe-top)+1.5rem)] text-[#172033]">
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
        ) : !grandOpenings || grandOpenings.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <p className="font-bold">No grand openings yet.</p>

            <p className="mt-2 text-sm text-gray-500">
              New grand openings will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {grandOpenings.map((item: any) => (
              <Link
                key={item.id}
                href={`/grand-openings/${item.id}`}
                className="block overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
              >
                <div className="w-full overflow-hidden bg-white">
                  <GrandOpeningMedia item={item} />
                </div>

                <div className="relative border-t border-gray-100 bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-wide text-[#C4483A]">
                    {formatOpeningDate(item.opening_date)}
                  </p>

                  <h2 className="mt-1 break-words text-xl font-black leading-tight text-[#172033]">
                    {item.business_name || "Grand Opening"}
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
            ))}
          </div>
        )}
      </div>

      <BottomNav activeNav="home" />
    </main>
  );
}