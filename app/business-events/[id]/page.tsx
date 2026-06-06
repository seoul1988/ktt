import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "../../../lib/supabase";
import EventManageButtons from "./EventManageButtons";
import BusinessMediaViewer from "../../components/BusinessMediaViewer";
import BottomNav from "../../components/BottomNav";
import AttendeeRegistrationForm from "./AttendeeRegistrationForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getStoragePathFromPublicUrl(url: string | null) {
  if (!url) return null;

  const marker = "/storage/v1/object/public/";
  const index = url.indexOf(marker);

  if (index === -1) return null;

  const fullPath = url.substring(index + marker.length);
  const parts = fullPath.split("/");

  const bucket = parts.shift();
  const path = parts.join("/");

  if (!bucket || !path) return null;

  return {
    bucket,
    path: decodeURIComponent(path),
  };
}

export default async function BusinessEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event, error } = await supabase
    .from("business_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  async function deleteEvent() {
    "use server";

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: targetEvent } = await supabase
      .from("business_events")
      .select("id, owner_id, image_url, video_url")
      .eq("id", id)
      .maybeSingle();

    if (!user || !targetEvent) {
      redirect("/business-events");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isOwner = targetEvent.owner_id === user.id;
    const isAdmin = profile?.role === "admin";

    if (!isOwner && !isAdmin) {
      redirect(`/business-events/${id}`);
    }

    const imageFile = getStoragePathFromPublicUrl(targetEvent.image_url);

    if (imageFile) {
      await supabase.storage.from(imageFile.bucket).remove([imageFile.path]);
    }

    const videoFile = getStoragePathFromPublicUrl(targetEvent.video_url);

    if (videoFile) {
      await supabase.storage.from(videoFile.bucket).remove([videoFile.path]);
    }

    await supabase.from("business_events").delete().eq("id", id);

    revalidatePath("/business-events");
    redirect("/business-events");
  }

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

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const isOwner = !!user && event.owner_id === user.id;
  const isAdmin = profile?.role === "admin";
  const canManage = isOwner || isAdmin;

  const images = event.image_url ? [event.image_url] : [];
  const videos = event.video_url ? [event.video_url] : [];

  return (
    <main className="min-h-screen bg-[#F8F3EC] pb-28 text-[#172033]">
      <div className="px-5 pt-5">
        <div className="relative mx-auto max-w-xl overflow-hidden rounded-3xl shadow-xl">
          <BusinessMediaViewer
            images={images.length > 0 ? images : ["/event.png"]}
            videos={videos}
            name={event.title || "Business Event"}
          />

          <div className="absolute left-4 top-4 z-50">
            <Link
              href="/business-events"
              className="rounded-full bg-white/90 px-4 py-2 text-sm font-black shadow"
            >
              ← Back
            </Link>
          </div>

          {canManage && (
            <div className="absolute right-4 top-4 z-50">
              <EventManageButtons eventId={event.id} ownerId={event.owner_id} />
            </div>
          )}
        </div>
      </div>

      <section className="px-5 pt-5">
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-sm font-bold text-[#C4483A]">
              {event.event_date || "Coming Soon"}
            </p>

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
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
