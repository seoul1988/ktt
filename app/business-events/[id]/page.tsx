import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import BusinessMediaViewer from "../../components/BusinessMediaViewer";
import BottomNav from "../../components/BottomNav";
import AttendeeRegistrationForm from "./AttendeeRegistrationForm";
import AttendeeList from "./AttendeeList";
import BackButton from "@/app/components/BackButton";
import ProfileButton from "../../components/ProfileButton";
import BusinessEventManageButtons from "./BusinessEventManageButtons";
import BusinessEventActionButtons from "./BusinessEventActionButtons";
import BusinessPdfPreview from "./BusinessPdfPreview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeExternalUrl(value: string | null | undefined) {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function formatEasternDateTime(
  value: string | null | undefined,
) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

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
      <main className="min-h-screen bg-[#F8F3EC] px-5 py-10 text-[#172033]">
        <div className="mx-auto w-full max-w-xl">
          <h1 className="text-2xl font-black">
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

        <BottomNav />
      </main>
    );
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

  const pdfUrl = normalizeExternalUrl(event.pdf_url);

  const pdfName =
    String(event.pdf_name || "").trim() ||
    `${String(event.title || "event").trim() || "event"}.pdf`;

  const registrationUrl =
    normalizeExternalUrl(event.registration_url);

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto w-full max-w-xl px-4 pb-28 pt-5">
        {/* HEADER */}
        <div className="relative mb-4 flex min-h-10 items-center justify-center">
          <div className="absolute left-0">
            <BackButton />
          </div>

          <h2 className="text-xl font-black text-[#172033]">
            EVENT
          </h2>

          <div className="absolute right-0">
            <ProfileButton />
          </div>
        </div>

        {/* PDF OR MEDIA */}
        {pdfUrl ? (
          <div className="mb-5 overflow-hidden rounded-[26px] border border-[#E3DDD5] bg-white p-1.5 shadow-sm">
            <div className="overflow-hidden rounded-[20px] bg-[#ECE8E2]">
              <BusinessPdfPreview
                pdfUrl={pdfUrl}
                title={event.title || "Business Event"}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 p-2 pt-3">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-center rounded-2xl bg-[#172033] px-3 py-3 text-center text-sm font-black text-white"
              >
                View Original PDF
              </a>

              <a
                href={pdfUrl}
                download={pdfName}
                className="flex min-h-12 items-center justify-center rounded-2xl bg-[#C46A2B] px-3 py-3 text-center text-sm font-black text-white"
              >
                Download PDF
              </a>
            </div>

            <p className="truncate px-3 pb-3 text-center text-xs font-bold text-[#6B6257]">
              {pdfName}
            </p>
          </div>
        ) : (
          <div className="mb-5 overflow-hidden rounded-[26px] border border-[#E3DDD5] bg-white p-1.5 shadow-sm">
            <div className="overflow-hidden rounded-[20px]">
              <BusinessMediaViewer
                images={
                  images.length > 0
                    ? images
                    : ["/event.png"]
                }
                videos={videos}
                name={event.title || "Business Event"}
              />
            </div>
          </div>
        )}

        {/* TITLE + MANAGE */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-3xl font-black leading-tight">
            {event.title}
          </h1>

          <BusinessEventManageButtons
            eventId={event.id}
            ownerId={event.owner_id || null}
          />
        </div>

        {/* RAFFLE */}
        {raffleEnabled && (
          <div className="mt-4 rounded-2xl bg-yellow-100 px-4 py-4 text-xs font-black text-yellow-900">
            <div className="text-sm font-black">
              🎁 Prize Drawing Event
            </div>

            {event.raffle_draw_at && (
              <div className="mt-2">
                <span className="font-black">
                  🎯 Drawing Time:
                </span>
                <br />
                {formatEasternDateTime(event.raffle_draw_at)}
              </div>
            )}

            {event.registration_deadline && (
              <div className="mt-2">
                <span className="font-black">
                  ⏰ Registration Deadline:
                </span>
                <br />
                {formatEasternDateTime(
                  event.registration_deadline,
                )}
              </div>
            )}

            <div className="mt-2">
              <span className="font-black">
                🏆 Winners:
              </span>{" "}
              {winnerCount}
            </div>

            <div className="mt-3 rounded-xl bg-white/50 p-2 text-[11px] leading-5">
              Only participants who register themselves are eligible for the prize drawing.
              <br />
              Guests are not eligible for the prize drawing.
            </div>
          </div>
        )}

        {hasInvalidRaffleSchedule && (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-black text-red-700 shadow-sm">
            추첨일은 등록 마감일보다 빠를 수 없습니다.
            이벤트 수정 화면에서 날짜를 다시 설정해 주세요.
          </div>
        )}

        {/* REGISTRATION */}
        {collectAttendees &&
          !registrationClosed &&
          !drawReady &&
          !hasInvalidRaffleSchedule && (
            <div className="mt-4">
              <AttendeeRegistrationForm
                eventId={event.id}
                eventTitle={event.title || "Business Event"}
                raffleEnabled={raffleEnabled}
                allowCompanions={!raffleEnabled}
                buttonOnly
              />

              <AttendeeRegistrationForm
                eventId={event.id}
                eventTitle={event.title || "Business Event"}
                raffleEnabled={raffleEnabled}
                allowCompanions={!raffleEnabled}
                formOnly
              />
            </div>
          )}

        {collectAttendees &&
          (registrationClosed || drawReady) && (
            <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-black text-[#6B6257] shadow-sm">
              Registration is closed.
            </div>
          )}

        {!collectAttendees && (
          <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-[#6B6257] shadow-sm">
            Registration is not open for this event.
          </div>
        )}

        {/* EVENT INFO */}
        <div className="mt-5 rounded-[24px] border border-[#E2E4E7] bg-[#F1F2F4] px-5 py-5 shadow-sm">
          <p className="text-sm font-bold text-[#6B6257]">
            {event.event_date
              ? formatEasternDateTime(event.event_date)
              : "Date TBA"}
          </p>

          <p className="mt-2 text-sm font-bold text-[#6B6257]">
            {event.location || "Location TBA"}
          </p>

          {event.description && (
            <p className="mt-6 whitespace-pre-line text-base font-semibold leading-7 text-[#172033]">
              {event.description}
            </p>
          )}
        </div>

        {/* EXTERNAL VIDEO */}
        {event.external_video_url && (
          <a
            href={event.external_video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-[#172033] px-4 py-3 text-center text-sm font-black text-white"
          >
            ▶ Watch Video
          </a>
        )}

        {/* COMMUNITY-LIKE ACTION BUTTONS */}
        <BusinessEventActionButtons
          eventTitle={event.title || "Business Event"}
          phone={event.contact_phone || null}
          address={event.location || null}
          latitude={event.latitude ?? null}
          longitude={event.longitude ?? null}
          registrationUrl={registrationUrl || null}
        />

        {/* ATTENDEES */}
        {collectAttendees && (
          <AttendeeList
            eventId={event.id}
            ownerId={event.owner_id || null}
            raffleEnabled={raffleEnabled}
            drawReady={drawReady}
            winnerCount={winnerCount}
          />
        )}
      </section>

      <BottomNav />
    </main>
  );
}