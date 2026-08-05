import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "../../../../lib/supabase";
import CommunityBottomNav from "../../../components/CommunityBottomNav";
import CommunityAttendeeRegistrationForm from "./CommunityAttendeeRegistrationForm";
import CommunityAttendeeList from "./CommunityAttendeeList";
import ImageModal from "../../../components/ImageModal";
import CommunityEventManageButtons from "./CommunityEventManageButtons";
import BackButton from "@/app/components/BackButton";
import ProfileButton from "../../../components/ProfileButton";
import CommunityEventActionButtons from "./CommunityEventActionButtons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE_URL = "https://www.ktowntriangle.com";
const DEFAULT_EVENT_IMAGE = `${SITE_URL}/event.png`;

function normalizeExternalUrl(value: string | null | undefined) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getAbsoluteImageUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return DEFAULT_EVENT_IMAGE;
  }

  if (
    imageUrl.startsWith("https://") ||
    imageUrl.startsWith("http://")
  ) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    return `${SITE_URL}${imageUrl}`;
  }

  return `${SITE_URL}/${imageUrl}`;
}

function cleanDescription(
  description: string | null | undefined,
) {
  if (!description) {
    return "KTownTriangle 커뮤니티 이벤트 안내";
  }

  return description
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;

  const { data: event } = await supabase
    .from("community_events")
    .select(
      `
        id,
        title,
        description,
        image_url,
        event_date,
        address
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    return {
      title: "Event Not Found | KTownTriangle",
      description: "요청하신 이벤트를 찾을 수 없습니다.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const eventTitle =
    event.title?.trim() || "Community Event";

  const pageUrl = `${SITE_URL}/community/events/${event.id}`;
  const imageUrl = getAbsoluteImageUrl(event.image_url);
  const description = cleanDescription(event.description);

  return {
    metadataBase: new URL(SITE_URL),

    title: `${eventTitle} | KTownTriangle`,
    description,

    alternates: {
      canonical: pageUrl,
    },

    openGraph: {
      type: "article",
      locale: "ko_KR",
      siteName: "KTownTriangle",
      url: pageUrl,
      title: eventTitle,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: eventTitle,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title: eventTitle,
      description,
      images: [imageUrl],
    },

    other: {
      "og:image:secure_url": imageUrl,
    },
  };
}

export default async function CommunityEventDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const { data: event, error } = await supabase
    .from("community_events")
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

    await supabase
      .from("community_events")
      .delete()
      .eq("id", id);

    revalidatePath("/community");
    revalidatePath(`/community/events/${id}`);

    redirect("/community");
  }

  const raffleEnabled = event.raffle_enabled === true;

  const raffleDrawAt = event.raffle_draw_at
    ? new Date(event.raffle_draw_at).getTime()
    : null;

  const registrationDeadlineAt = event.registration_deadline
    ? new Date(event.registration_deadline).getTime()
    : null;

  const drawReady =
    raffleEnabled &&
    raffleDrawAt !== null &&
    Date.now() >= raffleDrawAt;

  const registrationClosed =
    raffleEnabled &&
    registrationDeadlineAt !== null &&
    Date.now() >= registrationDeadlineAt;

  const collectAttendees =
    event.collect_attendees === true ||
    raffleEnabled === true;

  const allowCompanions = raffleEnabled
    ? false
    : event.allow_companions !== false;

  const winnerCount = Math.max(
    1,
    Number(event.raffle_winner_count || 1),
  );

  const registrationUrl = normalizeExternalUrl(
    event.registration_url,
  );

  const pdfUrl = normalizeExternalUrl(event.pdf_url);
  const pdfName =
    String(event.pdf_name || "").trim() ||
    `${String(event.title || "event").trim() || "event"}.pdf`;

  const pdfPreviewUrl = pdfUrl
    ? `${pdfUrl}#page=1&view=FitH&toolbar=0&navpanes=0`
    : "";

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto w-full max-w-xl px-4 pb-28 pt-5">
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

        {pdfUrl ? (
          <div className="mb-5 overflow-hidden rounded-[26px] border border-[#E3DDD5] bg-white p-1.5 shadow-sm">
            <div className="overflow-hidden rounded-[20px] bg-[#ECE8E2]">
              <iframe
                src={pdfPreviewUrl}
                title={`${event.title || "Community Event"} PDF preview`}
                className="h-[68vh] min-h-[520px] w-full bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 p-2 pt-3">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-center rounded-2xl bg-[#172033] px-3 py-3 text-center text-sm font-black text-white"
              >
                원본 PDF 보기
              </a>

              <a
                href={pdfUrl}
                download={pdfName}
                className="flex min-h-12 items-center justify-center rounded-2xl bg-[#C46A2B] px-3 py-3 text-center text-sm font-black text-white"
              >
                PDF 다운로드
              </a>
            </div>

            <p className="truncate px-3 pb-3 text-center text-xs font-bold text-[#6B6257]">
              {pdfName}
            </p>
          </div>
        ) : event.image_url ? (
          <div className="mb-5 overflow-hidden rounded-[26px] border border-[#E3DDD5] bg-white p-1.5 shadow-sm">
            <div className="overflow-hidden rounded-[20px]">
              <ImageModal
                src={event.image_url}
                alt={event.title || "Community Event"}
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-3xl font-black leading-tight">
            {event.title}
          </h1>

          <CommunityEventManageButtons
            eventId={event.id}
            ownerId={event.owner_id || null}
          />
        </div>

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
                {formatEasternDateTime(event.registration_deadline)}
              </div>
            )}

            {event.raffle_winner_count ? (
              <div className="mt-2">
                <span className="font-black">
                  🏆 Winners:
                </span>{" "}
                {event.raffle_winner_count}
              </div>
            ) : null}

            <div className="mt-3 rounded-xl bg-white/50 p-2 text-[11px] leading-5">
              추첨 이벤트는 본인 직접 등록자만 응모할 수
              있습니다.
              <br />
              동반인은 추첨 대상에 포함되지 않습니다.
            </div>
          </div>
        )}

        {collectAttendees && !registrationClosed && !drawReady && (
          <CommunityAttendeeRegistrationForm
            eventId={event.id}
            eventTitle={
              event.title || "Community Event"
            }
            raffleEnabled={raffleEnabled}
            allowCompanions={allowCompanions}
          />
        )}

        {collectAttendees && (registrationClosed || drawReady) && (
          <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-black text-[#6B6257] shadow-sm">
            참가 신청이 마감되었습니다.
          </div>
        )}

        {!collectAttendees && (
          <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-[#6B6257] shadow-sm">
            Registration is not open for this event.
          </div>
        )}

        <div className="mt-5 rounded-[24px] border border-[#E2E4E7] bg-[#F1F2F4] px-5 py-5 shadow-sm">
          <p className="text-sm font-bold text-[#6B6257]">
            {event.event_date
              ? formatEasternDateTime(event.event_date)
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
        </div>

        <CommunityEventActionButtons
          eventTitle={event.title || "Community Event"}
          phone={event.contact_phone || null}
          address={event.address || event.location || null}
          latitude={event.latitude ?? null}
          longitude={event.longitude ?? null}
          registrationUrl={registrationUrl || null}
        />

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