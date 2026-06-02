// app/map/page.tsx

import { supabase } from "../../lib/supabase";
import MapWrapper from "../components/MapWrapper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{
  view?: string;
}>;

export default async function MapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const view = params?.view || "";
  const today = new Date().toISOString().slice(0, 10);

  if (view === "deals") {
    const { data: deals, error } = await supabase
      .from("deals")
      .select(`
        id,
        title,
        description,
        image_url,
        start_date,
        end_date,
        business_id,
        businesses (*)
      `)
      .eq("status", "approved")
      .eq("active", true)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order("created_at", { ascending: false });

    if (error) {
      return (
        <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
          <p className="font-bold text-red-600">
            DEAL 지도 불러오기 실패: {error.message}
          </p>
        </main>
      );
    }

    const spots =
      deals
        ?.map((deal: any) => {
          const business = Array.isArray(deal.businesses)
            ? deal.businesses[0]
            : deal.businesses;

          if (!business) return null;

          return {
            ...business,
            deal_id: deal.id,
            deal_title: deal.title,
            deal_description: deal.description,
            deal_image_url: deal.image_url,
            deal_start_date: deal.start_date,
            deal_end_date: deal.end_date,
            has_deal: true,
            source_type: "deal",
          };
        })
        .filter(Boolean) || [];

    return (
      <MapWrapper
        spots={spots}
        showAllOnLoad={true}
        activeNav="deals"
      />
    );
  }
if (view === "events") {
  const { data: events, error } = await supabase
    .from("business_events")
    .select(`
      id,
      title,
      description,
      event_date,
      image_url,
      business_id,
      businesses (*)
    `)
    .eq("status", "approved")
    .eq("active", true)
    .or(`event_date.is.null,event_date.gte.${today}`)
    .not("business_id", "is", null)
    .order("event_date", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          EVENT 지도 불러오기 실패: {error.message}
        </p>
      </main>
    );
  }

  const spots =
    events
      ?.map((event: any) => {
        const business = Array.isArray(event.businesses)
          ? event.businesses[0]
          : event.businesses;

        if (!business) return null;

        return {
          ...business,
          event_id: event.id,
          event_title: event.title,
          event_description: event.description,
          event_image_url: event.image_url,
          event_date: event.event_date,
          has_event: true,
          source_type: "event",
        };
      })
      .filter(Boolean) || [];

  return (
    <MapWrapper
      spots={spots}
      showAllOnLoad={true}
      activeNav="events"
    />
  );
}
  const { data: spots, error } = await supabase
    .from("businesses")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          지도 불러오기 실패: {error.message}
        </p>
      </main>
    );
  }

  return (
    <MapWrapper
      spots={spots || []}
      showAllOnLoad={false}
      activeNav="map"
    />
  );
}