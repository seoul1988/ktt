import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import BusinessMediaViewer from "../../components/BusinessMediaViewer";
import BottomNav from "../../components/BottomNav";
import AttendeeRegistrationForm from "./AttendeeRegistrationForm";
import AttendeeList from "./AttendeeList";
import BusinessEventManageMenu from "./BusinessEventManageMenu";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EventAttendee = {
  id: string;
  name: string | null;
  phone: string | null;
  companions: number | null;
  total_count: number | null;
  created_at: string | null;
};

export default async function BusinessEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: event, error } = await supabase
    .from("business_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          Supabase error: {error.message}
        </p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <Link
          href="/business-events"
          className="mb-5 inline-block rounded-full bg-white px-4 py-2 text-sm font-black shadow"
        >
          ← Back
        </Link>

        <div className="rounded-3xl bg-white p-8 text-center shadow">
          <p className="font-bold text-gray-500">Event not found.</p>
          <p className="mt-2 text-xs text-gray-400">ID: {id}</p>
        </div>

        <BottomNav />
      </main>
    );
  }

  await (event.collect_attendees
    ? supabase
        .from("event_attendees")
        .select("id, name, phone, companions, total_count, created_at")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [] as EventAttendee[] }));

  const images = event.image_url ? [event.image_url] : [];
  const videos = event.video_url ? [event.video_url] : [];

  return (
    <main className="min-h-screen bg-[#F8F3EC] pb-28 text-[#172033]">
      <section className="mx-auto max-w-xl px-5 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/business-events"
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033] shadow"
          >
            ← Back
          </Link>

          <h1 className="text-lg font-black">Event Detail</h1>

          <BusinessEventManageMenu
            event={{
              id: event.id,
              owner_id: event.owner_id || null,
              image_url: event.image_url || null,
              video_url: event.video_url || null,
            }}
            mode="menu"
          />
        </div>

        <div className="overflow-hidden rounded-3xl shadow-xl">
          <BusinessMediaViewer
            images={images.length > 0 ? images : ["/event.png"]}
            videos={videos}
            name={event.title || "Business Event"}
          />
        </div>
      </section>

      <section className="px-5 pt-5">
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <p className="pt-1 text-sm font-bold text-[#C4483A]">
                {event.event_date || "Coming Soon"}
              </p>

              <BusinessEventManageMenu
                event={{
                  id: event.id,
                  owner_id: event.owner_id || null,
                  image_url: event.image_url || null,
                  video_url: event.video_url || null,
                }}
                mode="buttons"
              />
            </div>

            <div className="mt-2 flex items-start justify-between gap-3">
              <h1 className="flex-1 text-2xl font-black leading-tight">
                {event.title}
              </h1>

              {event.collect_attendees && (
                <AttendeeRegistrationForm
                  eventId={event.id}
                  eventTitle={event.title || "Business Event"}
                  buttonOnly
                />
              )}
            </div>

            {event.collect_attendees && (
              <AttendeeRegistrationForm
                eventId={event.id}
                eventTitle={event.title || "Business Event"}
                formOnly
              />
            )}

            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-700">
              {event.description || "No description"}
            </p>

            {event.external_video_url && (
              <a
                href={event.external_video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block rounded-2xl bg-[#172033] px-4 py-3 text-center text-sm font-black text-white"
              >
                ▶ Watch Video
              </a>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-black">
              <a
                href={event.contact_phone ? `tel:${event.contact_phone}` : "#"}
                className="rounded-2xl px-2 py-3 text-[#172033]"
              >
                <div className="text-xl">☎</div>
                Call
              </a>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  event.location || ""
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl px-2 py-3 text-[#172033]"
              >
                <div className="text-xl">↱</div>
                Directions
              </a>

              <a
                href={`sms:?&body=${encodeURIComponent(
                  `${event.title || ""}\n${event.location || ""}`
                )}`}
                className="rounded-2xl px-2 py-3 text-[#172033]"
              >
                <div className="text-xl">⌲</div>
                Share
              </a>
            </div>

            {event.location && (
              <p className="mt-4 text-sm font-bold">📍 {event.location}</p>
            )}
          </div>

          {event.collect_attendees && (
            <AttendeeList eventId={event.id} ownerId={event.owner_id} />
          )}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}