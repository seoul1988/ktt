import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "../../../../lib/supabase";
import CommunityBottomNav from "../../../components/CommunityBottomNav";
import CommunityAttendeeRegistrationForm from "./CommunityAttendeeRegistrationForm";
import CommunityAttendeeList from "./CommunityAttendeeList";
import ImageModal from "../../../components/ImageModal";

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

        <CommunityBottomNav activeNav="community" />
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

    const { data: currentEvent } = await supabase
      .from("community_events")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (!currentEvent) {
      redirect("/community");
    }

    await supabase.from("community_events").delete().eq("id", id);

    revalidatePath("/community");
    revalidatePath(`/community/events/${id}`);

    redirect("/community");
  }

  const raffleEnabled = event.raffle_enabled === true;

  const raffleDrawAt = event.raffle_draw_at
    ? new Date(event.raffle_draw_at).getTime()
    : null;

  const drawReady =
    raffleEnabled && raffleDrawAt !== null && Date.now() >= raffleDrawAt;

  const collectAttendees =
    event.collect_attendees === true || raffleEnabled === true;

  const allowCompanions = raffleEnabled
    ? false
    : event.allow_companions !== false;

  const winnerCount = Math.max(1, Number(event.raffle_winner_count || 1));

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
            <ImageModal
              src={event.image_url}
              alt={event.title || "Community Event"}
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-3xl font-black leading-tight">
            {event.title}
          </h1>

       {canManage && (
  <div className="flex shrink-0 items-center gap-1">
    <Link
      href={`/community/events/${event.id}/edit`}
      className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-[#172033] shadow-sm"
    >
      Edit
    </Link>

    <form action={deleteEvent}>
      <button
        type="submit"
        className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-black text-white shadow-sm"
      >
        Delete
      </button>
    </form>
  </div>
)}
        </div>

        {raffleEnabled && (
          <div className="mt-4 rounded-2xl bg-yellow-100 px-4 py-4 text-xs font-black text-yellow-900">
            <div className="text-sm font-black">🎁 Prize Drawing Event</div>

            {event.raffle_draw_at && (
              <div className="mt-2">
                <span className="font-black">🎯 Drawing Time:</span>
                <br />
                {new Date(event.raffle_draw_at).toLocaleString()}
              </div>
            )}

            {event.raffle_draw_at && (
              <div className="mt-2">
                <span className="font-black">⏰ Registration Deadline:</span>
                <br />
                {new Date(event.raffle_draw_at).toLocaleString()}
              </div>
            )}

            {event.raffle_winner_count ? (
              <div className="mt-2">
                <span className="font-black">🏆 Winners:</span>{" "}
                {event.raffle_winner_count}
              </div>
            ) : null}

            <div className="mt-3 rounded-xl bg-white/50 p-2 text-[11px] leading-5">
              추첨 이벤트는 본인 직접 등록자만 응모할 수 있습니다.
              <br />
              동반인은 추첨 대상에 포함되지 않습니다.
            </div>
          </div>
        )}

        {collectAttendees && !drawReady && (
          <CommunityAttendeeRegistrationForm
            eventId={event.id}
            eventTitle={event.title || "Community Event"}
            raffleEnabled={raffleEnabled}
            allowCompanions={allowCompanions}
          />
        )}

        {collectAttendees && drawReady && (
          <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-black text-[#6B6257] shadow-sm">
            추첨 등록 시간이 마감되었습니다.
          </div>
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

        {collectAttendees && (
          <CommunityAttendeeList
            eventId={event.id}
            ownerId={event.owner_id || null}
            raffleEnabled={raffleEnabled}
            drawReady={drawReady}
            winnerCount={winnerCount}
          />
        )}
      </section>

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}