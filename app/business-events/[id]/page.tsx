import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "../../../lib/supabase";
import BusinessMediaViewer from "../../components/BusinessMediaViewer";
import BottomNav from "../../components/BottomNav";
import AttendeeRegistrationForm from "./AttendeeRegistrationForm";
import AttendeeList from "./AttendeeList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  if (error || !event) {
    return (
      <main className="min-h-screen bg-[#F8F5F0] pb-24">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-black text-[#172033]">
              Event not found
            </h1>

            <p className="mt-2 text-sm font-bold text-[#6B6257]">
              ID: {id}
            </p>

            <Link
              href="/business-events"
              className="mt-4 inline-block font-black text-[#C4483A]"
            >
              ← Back to Events
            </Link>
          </div>
        </div>

        <BottomNav />
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

  async function deleteEvent() {
    "use server";

    await supabase
      .from("business_events")
      .delete()
      .eq("id", id);

    revalidatePath("/business-events");
    revalidatePath(`/business-events/${id}`);

    redirect("/business-events");
  }

  const raffleEnabled = event.raffle_enabled === true;

  const raffleDrawAt = event.raffle_draw_at
    ? new Date(event.raffle_draw_at).getTime()
    : null;

  const registrationDeadlineAt = event.registration_deadline
    ? new Date(event.registration_deadline).getTime()
    : null;

  const hasInvalidRaffleSchedule =
    raffleEnabled &&
    raffleDrawAt !== null &&
    registrationDeadlineAt !== null &&
    raffleDrawAt < registrationDeadlineAt;

  const registrationClosed =
    registrationDeadlineAt !== null &&
    Date.now() >= registrationDeadlineAt;

  const drawReady =
    raffleEnabled &&
    raffleDrawAt !== null &&
    Date.now() >= raffleDrawAt;

  const collectAttendees =
    event.collect_attendees === true ||
    raffleEnabled === true;

  const winnerCount = Math.max(
    1,
    Number(event.raffle_winner_count || 1),
  );

  const images = event.image_url
    ? [event.image_url]
    : [];

  const videos = event.video_url
    ? [event.video_url]
    : [];

  return (
    <main className="min-h-screen bg-[#F8F5F0] pb-24">
      <section className="mx-auto max-w-3xl px-4 py-6">
        {/* HEADER */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            href="/business-events"
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033] shadow-sm transition hover:bg-gray-50"
          >
            ← Back
          </Link>

          <span className="rounded-full bg-[#172033] px-3 py-1 text-[10px] font-black text-white">
            BUSINESS EVENT
          </span>
        </div>

        {/* MEDIA */}
        <div className="mb-5 overflow-hidden rounded-3xl bg-white shadow-sm">
          <BusinessMediaViewer
            images={
              images.length > 0
                ? images
                : ["/event.png"]
            }
            videos={videos}
            name={
              event.title ||
              "Business Event"
            }
          />
        </div>

        {/* TITLE + ADMIN CONTROLS */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-3xl font-black leading-tight text-[#172033]">
            {event.title}
          </h1>

          {isAdmin && (
            <div className="flex shrink-0 gap-2">
              <Link
                href={`/business-events/${event.id}/edit`}
                className="rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white shadow transition hover:bg-[#26324A] active:scale-[0.98]"
              >
                ✏️ Edit
              </Link>

              <form action={deleteEvent}>
                <button
                  type="submit"
                  className="rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white shadow transition hover:bg-red-700 active:scale-[0.98]"
                >
                  🗑 Delete
                </button>
              </form>
            </div>
          )}
        </div>

        {/* RAFFLE */}
        {raffleEnabled && (
          <div className="mt-4 rounded-2xl bg-yellow-100 px-4 py-4 text-xs font-black text-yellow-900">
            <div className="text-sm font-black">
              🎁 Prize Drawing Event
            </div>

            {event.registration_deadline && (
              <div className="mt-2">
                <span className="font-black">
                  ⏰ Registration Deadline:
                </span>

                <br />

                {new Date(
                  event.registration_deadline,
                ).toLocaleString()}
              </div>
            )}

            {event.raffle_draw_at && (
              <div className="mt-2">
                <span className="font-black">
                  🎯 Drawing Time:
                </span>

                <br />

                {new Date(
                  event.raffle_draw_at,
                ).toLocaleString()}
              </div>
            )}

            <div className="mt-2">
              <span className="font-black">
                🏆 Winners:
              </span>{" "}
              {winnerCount}
            </div>

            <div className="mt-3 rounded-xl bg-white/50 p-2 text-[11px] leading-5">
              추첨 이벤트는 본인 직접 등록자만 응모할 수 있습니다.
              <br />
              동반인은 추첨 대상에 포함되지 않습니다.
            </div>
          </div>
        )}

        {/* INVALID RAFFLE DATE */}
        {hasInvalidRaffleSchedule && (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-black text-red-700 shadow-sm">
            추첨일은 등록 마감일보다 빠를 수 없습니다.
            이벤트 수정 화면에서 날짜를 다시 설정해 주세요.
          </div>
        )}

        {/* REGISTRATION FORM */}
        {collectAttendees &&
          !registrationClosed &&
          !drawReady &&
          !hasInvalidRaffleSchedule && (
            <div className="mt-4">
              <AttendeeRegistrationForm
                eventId={event.id}
                eventTitle={
                  event.title ||
                  "Business Event"
                }
                raffleEnabled={raffleEnabled}
                allowCompanions={!raffleEnabled}
                buttonOnly
              />

              <AttendeeRegistrationForm
                eventId={event.id}
                eventTitle={
                  event.title ||
                  "Business Event"
                }
                raffleEnabled={raffleEnabled}
                allowCompanions={!raffleEnabled}
                formOnly
              />
            </div>
          )}

        {/* REGISTRATION CLOSED */}
        {collectAttendees &&
          (registrationClosed || drawReady) && (
            <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-black text-[#6B6257] shadow-sm">
              이벤트 등록 시간이 마감되었습니다.
            </div>
          )}

        {/* REGISTRATION DISABLED */}
        {!collectAttendees && (
          <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-[#6B6257] shadow-sm">
            Registration is not open for this event.
          </div>
        )}

        {/* EVENT DATE */}
        <p className="mt-5 text-sm font-bold text-[#6B6257]">
          {event.event_date
            ? new Date(
                event.event_date,
              ).toLocaleString()
            : "Date TBA"}
        </p>

        {/* EVENT LOCATION */}
        <p className="mt-2 text-sm font-bold text-[#6B6257]">
          {event.location ||
            "Location TBA"}
        </p>

        {/* DESCRIPTION */}
        {event.description && (
          <p className="mt-6 whitespace-pre-line text-base font-semibold leading-7 text-[#172033]">
            {event.description}
          </p>
        )}

        {/* EXTERNAL VIDEO */}
        {event.external_video_url && (
          <a
            href={event.external_video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 block rounded-2xl bg-[#172033] py-4 text-center text-sm font-black text-white transition hover:bg-[#26324A]"
          >
            ▶ Watch Video
          </a>
        )}

        {/* ACTION BUTTONS */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs font-black">
          <a
            href={
              event.contact_phone
                ? `tel:${event.contact_phone}`
                : "#"
            }
            className="rounded-2xl bg-white px-2 py-3 text-[#172033] shadow-sm"
          >
            <div className="text-xl">
              ☎
            </div>

            Call
          </a>

          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              event.location || "",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl bg-white px-2 py-3 text-[#172033] shadow-sm"
          >
            <div className="text-xl">
              ↱
            </div>

            Directions
          </a>

          <a
            href={`sms:?&body=${encodeURIComponent(
              `${event.title || ""}\n${
                event.location || ""
              }`,
            )}`}
            className="rounded-2xl bg-white px-2 py-3 text-[#172033] shadow-sm"
          >
            <div className="text-xl">
              ⌲
            </div>

            Share
          </a>
        </div>

        {/* ATTENDEE LIST */}
        {collectAttendees && (
          <AttendeeList
            eventId={event.id}
            ownerId={
              event.owner_id || null
            }
            raffleEnabled={
              raffleEnabled
            }
            drawReady={drawReady}
            winnerCount={
              winnerCount
            }
          />
        )}
      </section>

      <BottomNav />
    </main>
  );
}