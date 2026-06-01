import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "../../../lib/supabase";
import EventManageButtons from "./EventManageButtons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_EMAILS = ["mbsproinc@gmail.com"];

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
      .select("id, owner_id")
      .eq("id", id)
      .maybeSingle();

    if (!user || !targetEvent) {
      redirect("/business-events");
    }

    const isOwner = targetEvent.owner_id === user.id;
    const isAdmin = ADMIN_EMAILS.includes(user.email || "");

    if (!isOwner && !isAdmin) {
      redirect(`/business-events/${id}`);
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
          <p className="font-bold text-gray-500">
            이벤트를 찾을 수 없습니다.
          </p>
          <p className="mt-2 text-xs text-gray-400">ID: {id}</p>
        </div>
      </main>
    );
  }

  const isOwner = !!user && event.owner_id === user.id;
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);
  const canManage = isOwner || isAdmin;

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5 pb-28 text-[#172033]">
      <div className="mb-5 flex items-center justify-between gap-3">
	  
        <Link
          href="/business-events"
          className="rounded-full bg-white px-4 py-2 text-sm font-black shadow"
        >
          ← Back
        </Link>

        <EventManageButtons
  eventId={event.id}
  ownerId={event.owner_id}
/>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="h-64 w-full bg-white">
          <img
            src={event.image_url || "/event.png"}
            alt={event.title || "Business Event"}
            className="h-full w-full object-contain"
          />
        </div>

        <div className="p-5">
          <p className="text-sm font-bold text-[#C4483A]">
            {event.event_date || "Coming Soon"}
          </p>

          <h1 className="mt-2 text-2xl font-black">
            {event.title}
          </h1>

          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-700">
            {event.description || "No description"}
          </p>

          {(event.location || event.address) && (
            <p className="mt-4 text-sm font-bold">
              📍 {event.location || event.address}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}