import { supabase } from "../../../lib/supabase";
import BusinessPhotoSlider from "../../components/BusinessPhotoSlider";

function timeToMinutes(time?: string | null) {
  if (!time) return null;

  const parts = String(time).split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1] || 0);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return hour * 60 + minute;
}

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: spot, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single();

  if (!spot || error) {
    return <div>Not found</div>;
  }

  const images = [
    spot.image_url,
    spot.image_url_2,
    spot.image_url_3,
  ].filter(Boolean);

  const now = new Date();

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  }).format(now);

  const currentTime = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  }).format(now);

  const currentMinutes = timeToMinutes(currentTime);
  const openMinutes = timeToMinutes(spot.open_time);
  const closeMinutes = timeToMinutes(spot.close_time);

  const isClosedDay =
    spot.closed_days &&
    String(spot.closed_days).toLowerCase().includes(today.toLowerCase());

  const isOpenNow =
    !isClosedDay &&
    currentMinutes !== null &&
    openMinutes !== null &&
    closeMinutes !== null &&
    currentMinutes >= openMinutes &&
    currentMinutes < closeMinutes;

  return (
    <main className="min-h-screen bg-white text-[#172033]">
      <div className="relative">
        <BusinessPhotoSlider images={images} name={spot.name} />

        <a
          href="/"
          className="absolute left-5 top-5 rounded-full bg-white/90 px-4 py-2 text-sm font-bold shadow"
        >
          ← Back
        </a>
      </div>

      <section className="px-5 py-5">
        <h1 className="text-3xl font-extrabold">{spot.name}</h1>

        <p className="mt-1 text-sm text-gray-600">
          {spot.category} · {spot.city} ·{" "}
          <span
            className={
              isOpenNow
                ? "font-bold text-green-600"
                : "font-bold text-red-500"
            }
          >
            {isOpenNow ? "Open" : "Closed"}
          </span>
        </p>

        <div className="mt-6 grid grid-cols-4 text-center text-xs font-semibold text-gray-700">
          <a href={spot.phone ? `tel:${spot.phone}` : "#"}>
            <div className="text-3xl">☎</div>
            Call
          </a>

          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              spot.address || `${spot.name} ${spot.city} NC`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="text-3xl">↱</div>
            Directions
          </a>

          <a
            href={`sms:?&body=${encodeURIComponent(
              `${spot.name} - ${spot.address || spot.city || "Triangle Area"} ${
                spot.website_url || ""
              }`
            )}`}
          >
            <div className="text-3xl">⌲</div>
            Share
          </a>

          <div>
            <div className="text-3xl">♡</div>
            Save
          </div>
        </div>

        <hr className="my-5 border-gray-200" />

        <div className="space-y-2 text-[15px] leading-5">
          <p>
            <span className="font-semibold">Address: </span>
            {spot.address || "Address not available"}
          </p>

          <p>
            <span className="font-semibold">Hours: </span>
            {spot.open_time && spot.close_time
              ? `${spot.open_time} – ${spot.close_time}`
              : "Hours not available"}
          </p>

          {spot.break_start && spot.break_end && (
            <p>
              <span className="font-semibold">Break Time: </span>
              {spot.break_start} – {spot.break_end}
            </p>
          )}

          {spot.closed_days && (
            <p>
              <span className="font-semibold">Closed: </span>
              Every {spot.closed_days}
            </p>
          )}

          <p>
            <span className="font-semibold">Phone: </span>
            {spot.phone || "Not available"}
          </p>

          {spot.website_url && (
            <p>
              <span className="font-semibold">Website: </span>
              <a
                href={spot.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words text-[#2453A6] underline"
              >
                {spot.website_url}
              </a>
            </p>
          )}

          {spot.instagram_url && (
            <p>
              <span className="font-semibold">Instagram: </span>
              <a
                href={spot.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words text-[#2453A6] underline"
              >
                {spot.instagram_url}
              </a>
            </p>
          )}
        </div>

        <hr className="my-5 border-gray-200" />

        <section>
          <h2 className="mb-3 text-xl font-extrabold">Menu</h2>

          <div className="space-y-1 text-[15px] leading-6">
            {spot.menu_item_1 && (
              <p>
                {spot.menu_item_1} -{" "}
                {spot.menu_price_1 || "Price not listed"}
              </p>
            )}

            {spot.menu_item_2 && (
              <p>
                {spot.menu_item_2} -{" "}
                {spot.menu_price_2 || "Price not listed"}
              </p>
            )}

            {spot.menu_item_3 && (
              <p>
                {spot.menu_item_3} -{" "}
                {spot.menu_price_3 || "Price not listed"}
              </p>
            )}

            {!spot.menu_item_1 && !spot.menu_item_2 && !spot.menu_item_3 && (
              <p className="text-gray-600">
                Menu information is not available yet.
              </p>
            )}
          </div>

          {spot.menu_url && (
            <a
              href={spot.menu_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block font-bold text-[#C4483A] underline"
            >
              View Full Menu
            </a>
          )}
        </section>

        <hr className="my-5 border-gray-200" />

        <section>
          <h2 className="mb-3 text-xl font-extrabold">About</h2>

          <p className="leading-7 text-gray-700">
            {spot.description || "No description yet."}
          </p>
        </section>
      </section>
    </main>
  );
}