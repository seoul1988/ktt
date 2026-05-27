import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import BusinessPhotoSlider from "../../components/BusinessPhotoSlider";
import ProfileButton from "../../components/ProfileButton";
import ClaimCouponButton from "@/app/components/ClaimCouponButton";

function timeTextToMinutes(timeText?: string | null) {
  if (!timeText) return null;

  const match = timeText.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);

  if (match[3].toUpperCase() === "PM" && hour !== 12) {
    hour += 12;
  }

  if (match[3].toUpperCase() === "AM" && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minute;
}

function getOpenStatus(hours?: string | null) {
  if (!hours) {
    return {
      open: false,
      text: "Hours not available",
    };
  }

  const now = new Date();

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  }).format(now);

  const currentMinutes =
    now
      .toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/New_York",
      })
      .split(":")
      .map(Number)
      .reduce((a, b) => a * 60 + b);

  const line = hours
    .split("\n")
    .find((v) => v.startsWith(today));

  if (!line) {
    return {
      open: false,
      text: "Closed",
    };
  }

  if (line.includes("Closed")) {
    return {
      open: false,
      text: "Closed Today",
    };
  }

  const main = line
    .split("/ Break")[0]
    .replace(today, "")
    .trim();

  const [openText, closeText] =
    main.split(" - ");

  const open =
    timeTextToMinutes(openText);

  const close =
    timeTextToMinutes(closeText);

  const isOpen =
    open !== null &&
    close !== null &&
    currentMinutes >= open &&
    currentMinutes < close;

  return {
    open: isOpen,
    text: isOpen ? "Open" : "Closed",
  };
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

const { data: coupons } = await supabase
  .from("coupons")
  .select("*")
  .eq("business_id", business.id)
  .eq("active", true);
  
  
  if (!spot || error) {
    return <div>Not found</div>;
  }

  const images = [
    spot.image_url,
    spot.image_url_2,
    spot.image_url_3,
  ].filter(Boolean);

  const now = new Date();

const status = getOpenStatus(spot.hours);

  return (
    <main className="min-h-screen bg-white text-[#172033]">
      <div className="relative">
        <BusinessPhotoSlider images={images} name={spot.name} />

        <Link
          href="/map"
          className="absolute left-5 top-5 z-50 rounded-full bg-white/90 px-4 py-2 text-sm font-bold shadow"
        >
          ← Back
        </Link>
      </div>

      <section className="px-5 pt-5 pb-32">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-extrabold leading-tight">
            {spot.name}
          </h1>

          <div className="shrink-0">
            <ProfileButton />
          </div>
        </div>

        <p className="mt-1 text-sm text-gray-600">
          {spot.category} · {spot.city} ·{" "}
          <span
            className={
               status.open
                ? "font-bold text-green-600"
                : "font-bold text-red-500"
            }
          >
            {status.text}
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

          <div>
		  <span className="font-semibold">Hours: </span>
		  <div className="mt-1 whitespace-pre-wrap font-sans">
			{spot.hours || "Hours not available"}
		  </div>
		</div>

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
		
		<div className="mt-6">
  <h2 className="font-bold text-lg">
    Coupons
  </h2>

  <div className="space-y-3">

    {coupons?.map((coupon) => (
      <div
        key={coupon.id}
        className="
          rounded-xl
          border
          p-4
        "
      >
        <div className="font-semibold">
          {coupon.title}
        </div>

        <div className="text-sm text-gray-500">
          {coupon.description}
        </div>

        <ClaimCouponButton
          couponId={coupon.id}
        />

      </div>
    ))}

  </div>
</div>
		
		
		
		
		
      </section>

      <nav className="fixed bottom-4 left-1/2 z-[1000] flex w-[90%] max-w-md -translate-x-1/2 justify-around rounded-3xl bg-[#172033] px-4 py-3 text-xs font-semibold text-white shadow-2xl">
        <a href="/">Home</a>

        <a href="/map" className="text-[#F7B955]">
          Map
        </a>

        <a href="/deals">Deals</a>

        <a href="/community">Community</a>
      </nav>
    </main>
	
  );
}