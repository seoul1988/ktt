import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
          <p className="mt-2 text-sm font-bold text-[#6B6257]">ID: {id}</p>

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    isAdmin = profile?.role === "admin";
  }

  const isOwner = user?.id === event.owner_id;
  const canManage = isAdmin || isOwner;

  async function deleteEvent() {
    "use server";

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const { data: currentEvent } = await supabase
      .from("community_events")
      .select("id, owner_id")
      .eq("id", id)
      .maybeSingle();

    if (!currentEvent) {
      redirect("/community");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const canDelete =
      profile?.role === "admin" || currentEvent.owner_id === user.id;

    if (!canDelete) {
      redirect(`/community/events/${id}`);
    }

    await supabase.from("community_events").delete().eq("id", id);

    revalidatePath("/community");
    revalidatePath(`/community/events/${id}`);

    redirect("/community");
  }

  const collectAttendees = event.collect_attendees === true;
  const raffleEnabled = event.raffle_enabled === true;
  const allowCompanions = raffleEnabled
    ? false
    : event.allow_companions !== false;

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-md px-5 pb-28 pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href="/community"
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033] shadow"
          >
            ← Back
          </Link>

          <span className="rounded-full bg-[#172033] px-3 py-1 text-[10px] font-black text-white">
            {event.category || "EVENT"}
          </span>
        </div>

        {event.image_url && (
          <div className="mb-5 overflow-hidden rounded-3xl bg-white shadow-sm">
            <img
              src={event.image_url}
              alt={event.title || "Community Event"}
              className="h-auto w-full object-contain"
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-3xl font-black leading-tight">
            {event.title}
          </h1>

          {canManage && (
            <div className="flex shrink-0 gap-2">
              <Link
                href={`/community/events/${event.id}/edit`}
                className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#172033] shadow"
              >
                수정
              </Link>

              <form action={deleteEvent}>
                <button
                  type="submit"
                  className="rounded-full bg-red-600 px-3 py-2 text-xs font-black text-white shadow"
                >
                  삭제
                </button>
              </form>
            </div>
          )}
        </div>

        {raffleEnabled && (
          <div className="mt-4 rounded-2xl bg-yellow-100 px-4 py-3 text-xs font-black text-yellow-900">
            <div>🎁 Prize Drawing Event</div>

            {event.raffle_draw_at && (
              <div className="mt-1 font-bold">
                Drawing: {new Date(event.raffle_draw_at).toLocaleString()}
              </div>
            )}

            {event.raffle_winner_count ? (
              <div className="mt-1 font-bold">
                Winners: {event.raffle_winner_count}
              </div>
            ) : null}

            <div className="mt-2 font-bold">
              Only the person who registers directly is eligible. Guests are not
              accepted for this drawing.
            </div>
          </div>
        )}

        {collectAttendees && (
          <CommunityAttendeeRegistrationForm
            eventId={event.id}
            eventTitle={event.title || "Community Event"}
            raffleEnabled={raffleEnabled}
            allowCompanions={allowCompanions}
          />
        )}

        {!collectAttendees && (
          <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-[#6B6257] shadow-sm">
            Registration is not open for this event.
          </div>
        )}

        <p className="mt-5 text-sm font-bold text-[#6B6257]">
          {event.event_date
            ? new Date(event.event_date).toLocaleString()
            : "Date TBA"}
        </p>

        <p className="mt-2 text-sm font-bold text-[#6B6257]">
          {event.address || event.location || "Location TBA"}
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

        {collectAttendees && (
          <CommunityAttendeeList
            eventId={event.id}
            ownerId={event.owner_id || null}
          />
        )}
      </section>

      <CommunityBottomNav  />
    </main>
  );
}