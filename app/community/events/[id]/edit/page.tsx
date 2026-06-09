import { redirect } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import EditCommunityEventForm from "./EditCommunityEventForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditCommunityEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: event } = await supabase
    .from("community_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    redirect("/community");
  }

  return <EditCommunityEventForm event={event} />;
}