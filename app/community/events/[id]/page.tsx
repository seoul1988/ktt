import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import CommunityBottomNav from "../../../components/CommunityBottomNav";
import CommunityAttendeeRegistrationForm from "./CommunityAttendeeRegistrationForm";
import CommunityAttendeeList from "./CommunityAttendeeList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: event, error } = await supabase
    .from("community_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !event) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-5 py-10 text-[#172033]">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-black">Event not found</h1>

          <p className="mt-2 text-sm font-bold text-[#6B6257]">
            ID: {id}
          </p>

          <Link
            href="/community"
            className="mt-4 inline-block font-black text-[#C4483A]"
          >
            ← Back to Community
          </Link>
        </div>

        <CommunityBottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      {event.image_url && (
        <div className="mx-auto max-w-md bg-[#F8F3EC] pt-4">
          <img
            src={event.image_url}
            alt={event.title || "Community Event"}
            className="w-full rounded-3xl object-contain"
          />
        </div>
      )}

      <section className="mx-auto max-w-md px-5 pb-28 pt-5">
        <Link
          href="/community"
          className="mb-4 inline-block text-sm font-black text-[#C4483A]"
        >
          ← Back
        </Link>

        <div className="mb-3">
          <span className="rounded-full bg-[#172033] px-3 py-1 text-[10px] font-black text-white">
            {event.category || "EVENT"}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <h1 className="flex-1 text-3xl font-black leading-tight">
            {event.title}
          </h1>

          {event.collect_attendees && (
            <CommunityAttendeeRegistrationForm
              eventId={event.id}
              eventTitle={event.title || "Community Event"}
              buttonOnly
            />
          )}
        </div>

        {event.collect_attendees && (
          <CommunityAttendeeRegistrationForm
            eventId={event.id}
            eventTitle={event.title || "Community Event"}
            formOnly
          />
        )}

        <p className="mt-3 text-sm font-bold text-[#6B6257]">
          {event.event_date
            ? new Date(event.event_date).toLocaleString()
            : "Date TBA"}
        </p>

        <p className="mt-2 text-sm font-bold text-[#6B6257]">
          {event.address || "Location TBA"}
        </p>

        {event.description && (
          <p className="mt-6 whitespace-pre-line text-base font-semibold leading-7 text-[#172033]">
            {event.description}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {event.website && (
            <a
              href={event.website}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl bg-[#172033] py-4 text-center text-sm font-black text-white"
            >
              Website
            </a>
          )}

          {event.instagram && (
            <a
              href={event.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl bg-[#C4483A] py-4 text-center text-sm font-black text-white"
            >
              Instagram
            </a>
          )}
        </div>

        {event.collect_attendees && (
          <CommunityAttendeeList
            eventId={event.id}
            ownerId={event.owner_id || null}
          />
        )}
      </section>

      <CommunityBottomNav />
    </main>
  );
}
