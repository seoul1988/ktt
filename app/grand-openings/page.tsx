export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabase } from "../../lib/supabase";

import BottomNav from "../components/BottomNav";




function getYoutubeEmbedUrl(url: string | null | undefined) {
  if (!url) return null;

  const value = String(url);

  if (value.includes("youtube.com/watch?v=")) {
    const id = value.split("v=")[1]?.split("&")[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (value.includes("youtu.be/")) {
    const id = value.split("youtu.be/")[1]?.split("?")[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  return null;
}

function GrandOpeningMedia({
  item,
  className,
}: {
  item: any;
  className: string;
}) {
  const youtubeUrl = getYoutubeEmbedUrl(item.video_url);
  const imageUrl = item.images?.[0] || item.image_url || "/event.png";

  if (youtubeUrl) {
    return (
      <iframe
        src={youtubeUrl}
        title={item.title || "Grand Opening"}
        className={className}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (item.video_url) {
    return (
      <video
        src={item.video_url}
        controls
        muted
        playsInline
        className={`${className} bg-black object-cover`}
      />
    );
  }

  return (
    <img
      src={imageUrl}
      alt={item.title || "Grand Opening"}
      className={`${className} object-cover`}
    />
  );
}

export default async function GrandOpeningsPage() {
  const { data: grandOpenings } = await supabase
    .from("grand_openings")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 pb-24 pt-6 text-[#172033]">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/"
            className="rounded-full bg-white px-4 py-2 text-sm font-black shadow"
          >
            ← Back
          </Link>

          <h1 className="text-lg font-black tracking-wide">GRAND OPENINGS</h1>

          <Link
            href="/grand-openings/new"
            className="rounded-full bg-[#C4483A] px-4 py-2 text-sm font-black text-white shadow"
          >
            +
          </Link>
        </div>

        {!grandOpenings || grandOpenings.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <p className="font-bold">No grand openings yet.</p>
            <p className="mt-2 text-sm text-gray-500">
              New grand openings will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grandOpenings.map((item: any) => (
              <Link
                key={item.id}
                href={`/grand-openings/${item.id}`}
                className="block overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <div className="h-56 w-full bg-white">
                  <GrandOpeningMedia item={item} className="h-full w-full" />
                </div>

                <div className="p-5">
                  <p className="text-xs font-bold text-[#C4483A]">
                    {item.opening_date || "Coming Soon"}
                  </p>

                  <h2 className="mt-1 text-lg font-black">
                    {item.business_name || "Grand Opening"}
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-gray-600">
                    {item.title}
                  </p>

                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                    {item.description}
                  </p>
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