"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import PushSubscribeButton from "../../components/PushSubscribeButton";
import BackButton from "@/app/components/BackButton";



export const dynamic = "force-dynamic";


type SourceType = "request" | "community_events" | "business_events";

type EventItem = {
  id: string;
  owner_id: string | null;
  business_id: number | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
  video_url?: string | null;
  external_video_url?: string | null;
  event_date: string | null;
  location: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: string | null;
  approved_type?: string | null;
  created_at: string;

  collect_attendees?: boolean | null;
  raffle_enabled?: boolean | null;
  attendee_required_name?: boolean | null;
  attendee_required_phone?: boolean | null;
  allow_companions?: boolean | null;
  raffle_draw_at?: string | null;
  raffle_winner_count?: number | null;

  source_type: SourceType;
  businesses?: {
    name: string | null;
  } | null;
};

export default function EventRequestsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);

    const [requestRes, communityRes, businessRes] = await Promise.all([
      supabase
        .from("event_requests")
        .select("*, businesses(name)")
        .not("status", "in", '("approved","deleted")')
        .order("created_at", { ascending: false }),

      supabase
        .from("community_events")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("business_events")
        .select("*, businesses(name)")
        .order("created_at", { ascending: false }),
    ]);

    if (requestRes.error) {
      alert("이벤트 요청 불러오기 실패: " + requestRes.error.message);
    }

    if (communityRes.error) {
      alert("커뮤니티 이벤트 불러오기 실패: " + communityRes.error.message);
    }

    if (businessRes.error) {
      alert("비즈니스 이벤트 불러오기 실패: " + businessRes.error.message);
    }

    const requestEvents: EventItem[] = (requestRes.data || []).map((e: any) => ({
      ...e,
      source_type: "request" as const,
    }));

    const communityEvents: EventItem[] = (communityRes.data || []).map((e: any) => ({
      ...e,
      location: e.location || e.address || null,
      approved_type: "community",
      source_type: "community_events" as const,
    }));

    const businessEvents: EventItem[] = (businessRes.data || []).map((e: any) => ({
      ...e,
      location: e.location || e.address || null,
      approved_type: "business",
      source_type: "business_events" as const,
    }));

    const merged = [...requestEvents, ...communityEvents, ...businessEvents].sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );

    setEvents(merged);
    setLoading(false);
  }

  function getStoragePathFromUrl(url: string | null | undefined) {
    if (!url) return null;

    try {
      const marker = "/storage/v1/object/public/";
      const index = url.indexOf(marker);

      if (index === -1) return null;

      const path = url.substring(index + marker.length);
      const [bucket, ...fileParts] = path.split("/");
      const filePath = fileParts.join("/");

      if (!bucket || !filePath) return null;

      return { bucket, filePath };
    } catch {
      return null;
    }
  }

  async function deleteStorageFile(url: string | null | undefined) {
    const parsed = getStoragePathFromUrl(url);
    if (!parsed) return;

    const { error } = await supabase.storage
      .from(parsed.bucket)
      .remove([parsed.filePath]);

    if (error) {
      console.error("Storage 삭제 실패:", error.message);
    }
  }

  async function deleteEventFiles(event: EventItem) {
    await deleteStorageFile(event.image_url);
    await deleteStorageFile(event.video_url);
  }

  async function deleteOriginalRequestByTitle(title: string | null) {
    if (!title) return;

    const { error } = await supabase
      .from("event_requests")
      .delete()
      .eq("title", title);

    if (error) {
      console.error("원본 event_requests 삭제 실패:", error.message);
    }
  }

  async function approveAsBusiness(event: EventItem) {
    if (event.source_type !== "request") {
      alert("이미 최종 이벤트 테이블에 등록된 이벤트입니다.");
      return;
    }

    const { error: insertError } = await supabase.from("business_events").insert({
      business_id: event.business_id || null,
      owner_id: event.owner_id || null,

      title: event.title,
      description: event.description,

      image_url: event.image_url,
      video_url: event.video_url || null,
      external_video_url: event.external_video_url || null,

      event_date: event.event_date,
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null,

      status: "approved",
      active: true,
    });

    if (insertError) {
      alert("Business Event 저장 실패: " + insertError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("event_requests")
      .delete()
      .eq("id", event.id);

    if (deleteError) {
      alert("요청 삭제 실패: " + deleteError.message);
      return;
    }

    loadEvents();
  }

  async function approveAsCommunity(event: EventItem) {
    if (event.source_type !== "request") {
      alert("이미 최종 이벤트 테이블에 등록된 이벤트입니다.");
      return;
    }

    const { error: insertError } = await supabase
      .from("community_events")
      .insert({
        owner_id: event.owner_id || null,

        title: event.title,
        description: event.description,

        image_url: event.image_url,
        video_url: event.video_url || null,
        external_video_url: event.external_video_url || null,

        event_date: event.event_date,

        address: event.address || event.location || null,
  

        latitude: event.latitude ?? null,
        longitude: event.longitude ?? null,

        collect_attendees: event.collect_attendees ?? false,
        raffle_enabled: event.raffle_enabled ?? false,
        attendee_required_name: event.attendee_required_name ?? true,
        attendee_required_phone: event.attendee_required_phone ?? true,
        allow_companions: event.allow_companions ?? true,
        raffle_draw_at: event.raffle_draw_at ?? null,
        raffle_winner_count: event.raffle_winner_count ?? null,

        status: "approved",
      });

    if (insertError) {
      alert("Community Event 저장 실패: " + insertError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("event_requests")
      .delete()
      .eq("id", event.id);

    if (deleteError) {
      alert("요청 삭제 실패: " + deleteError.message);
      return;
    }

    loadEvents();
  }

  async function reject(event: EventItem) {
    const table = getTableName(event.source_type);

    const { error } = await supabase
      .from(table)
      .update({ status: "rejected" })
      .eq("id", event.id);

    if (error) {
      alert(error.message);
      return;
    }

    loadEvents();
  }

  async function deleteEvent(event: EventItem) {
    if (!confirm("정말 삭제할까요? 이미지/동영상 파일도 같이 삭제됩니다.")) return;

    await deleteEventFiles(event);

    if (event.source_type === "request") {
      const { error } = await supabase
        .from("event_requests")
        .delete()
        .eq("id", event.id);

      if (error) {
        alert(error.message);
        return;
      }

      loadEvents();
      return;
    }

    if (event.source_type === "business_events") {
      const { error } = await supabase
        .from("business_events")
        .delete()
        .eq("id", event.id);

      if (error) {
        alert(error.message);
        return;
      }

      await deleteOriginalRequestByTitle(event.title);
      loadEvents();
      return;
    }

    if (event.source_type === "community_events") {
      const { error } = await supabase
        .from("community_events")
        .delete()
        .eq("id", event.id);

      if (error) {
        alert(error.message);
        return;
      }

      await deleteOriginalRequestByTitle(event.title);
      loadEvents();
      return;
    }
  }

  function getTableName(
    sourceType: SourceType
  ): "event_requests" | "community_events" | "business_events" {
    if (sourceType === "business_events") return "business_events";
    if (sourceType === "community_events") return "community_events";
    return "event_requests";
  }

  function sourceLabel(event: EventItem) {
    if (event.source_type === "business_events") return "Business Events 테이블";
    if (event.source_type === "community_events") return "Community Events 테이블";
    return "Event Request";
  }

  function sourceColor(event: EventItem) {
    if (event.source_type === "business_events") return "bg-purple-600";
    if (event.source_type === "community_events") return "bg-blue-600";
    return "bg-gray-800";
  }

  function statusColor(status: string | null) {
    if (status === "approved") return "bg-green-600";
    if (status === "rejected") return "bg-red-500";
    return "bg-gray-500";
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 pb-28">
      <div className="mx-auto w-full max-w-2xl">
        <div className="relative mb-6 flex h-10 items-center border-b border-[#E8DED1] pb-3">
  {/* 왼쪽 */}
  <BackButton />

  {/* 가운데 */}
  <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-2xl font-black text-[#172033]">
    Event Requests
  </h1>

  {/* 오른쪽 */}
  <div className="ml-auto">
    <ProfileButton />
  </div>
</div>

        <div className="mb-5">
          <PushSubscribeButton />
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-5 shadow">Loading...</div>
        ) : events.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow">
            <p className="text-sm font-bold text-gray-500">
              등록된 이벤트가 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={`${event.source_type}-${event.id}`}
                className="rounded-3xl bg-white p-5 shadow"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black text-white ${sourceColor(
                      event
                    )}`}
                  >
                    {sourceLabel(event)}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black text-white ${statusColor(
                      event.status
                    )}`}
                  >
                    {event.status || "pending"}
                  </span>
                </div>

                {event.image_url && (
                  <img
                    src={event.image_url}
                    alt={event.title || "Event"}
                    className="mb-3 h-40 w-full rounded-2xl object-cover"
                  />
                )}

                <h2 className="text-xl font-black text-[#172033]">
                  {event.title}
                </h2>

                {event.businesses?.name && (
                  <p className="mt-2 text-sm font-bold text-purple-700">
                    🏪 {event.businesses.name}
                  </p>
                )}

                <p className="mt-2 whitespace-pre-line text-sm text-gray-600">
                  {event.description || "설명 없음"}
                </p>

                <p className="mt-2 text-sm">
                  📍 {event.location || event.address || "장소 없음"}
                </p>

                <p className="mt-1 text-sm">
                  📅 {event.event_date || "날짜 없음"}
                </p>

                {event.video_url && (
                  <p className="mt-2 text-xs font-bold text-gray-500">
                    🎬 업로드 동영상 있음
                  </p>
                )}

                {event.external_video_url && (
                  <p className="mt-2 text-xs font-bold text-gray-500">
                    🔗 외부 동영상 링크 있음
                  </p>
                )}

                {event.approved_type && (
                  <p className="mt-2 text-xs font-black text-[#C4483A]">
                    Approved as: {event.approved_type}
                  </p>
                )}

                {event.source_type === "request" &&
                event.status !== "approved" &&
                event.status !== "rejected" ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => approveAsBusiness(event)}
                      className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-bold text-white"
                    >
                      Business로 승인
                    </button>

                    <button
                      type="button"
                      onClick={() => approveAsCommunity(event)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white"
                    >
                      Community로 승인
                    </button>

                    <button
                      type="button"
                      onClick={() => reject(event)}
                      className="rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white"
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteEvent(event)}
                      className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-bold text-white"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => reject(event)}
                      className="rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white"
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteEvent(event)}
                      className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-bold text-white"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

       <CommunityBottomNav activeNav="admin" />
    </main>
  );
}