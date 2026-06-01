"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";
import CommunityBottomNav from "../../components/CommunityBottomNav";

type SourceType =
  | "request"
  | "community_events"
  | "business_events";

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
  location: event.location,
  latitude: event.latitude ?? null,
  longitude: event.longitude ?? null,
  status: "approved",
  active: true,
});

  if (insertError) {
    alert("Business Event 저장 실패: " + insertError.message);
    return;
  }

  const { error: updateError } = await supabase
    .from("event_requests")
    .update({
      status: "approved",
      approved_type: "business",
    })
    .eq("id", event.id);

  if (updateError) {
    alert("요청 상태 변경 실패: " + updateError.message);
    return;
  }

  loadEvents();
}

  async function approveAsCommunity(event: EventItem) {
    if (event.source_type !== "request") {
      alert("이미 최종 이벤트 테이블에 등록된 이벤트입니다.");
      return;
    }

    const { error: insertError } = await supabase.from("community_events").insert({
      title: event.title,
      description: event.description,
      image_url: event.image_url,
      event_date: event.event_date,
      address: event.location,
      status: "approved",
    });

    if (insertError) {
      alert("Community Event 저장 실패: " + insertError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("event_requests")
      .update({
        status: "approved",
        approved_type: "community",
      })
      .eq("id", event.id);

    if (updateError) {
      alert("요청 상태 변경 실패: " + updateError.message);
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
  if (!confirm("정말 삭제할까요?")) return;

  // event_requests 에서 삭제한 경우
  if (event.source_type === "request") {
    const { error } = await supabase
      .from("event_requests")
      .update({
        status: "deleted",
      })
      .eq("id", event.id);

    if (error) {
      alert(error.message);
      return;
    }

    loadEvents();
    return;
  }

  // business_events 삭제
  if (event.source_type === "business_events") {
    await supabase
      .from("business_events")
      .delete()
      .eq("id", event.id);

    await supabase
      .from("event_requests")
      .update({
        status: "deleted",
      })
      .eq("title", event.title);

    loadEvents();
    return;
  }

  // community_events 삭제
  if (event.source_type === "community_events") {
    await supabase
      .from("community_events")
      .delete()
      .eq("id", event.id);

    await supabase
      .from("event_requests")
      .update({
        status: "deleted",
      })
      .eq("title", event.title);

    loadEvents();
    return;
  }
}

  function getTableName(sourceType: SourceType): "event_requests" | "community_events" | "business_events" {
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
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/admin";
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
            >
              ← Back
            </button>

            <h1 className="text-2xl font-black text-[#172033]">
              Event Requests
            </h1>
          </div>

          <ProfileButton />
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

                {event.approved_type && (
                  <p className="mt-2 text-xs font-black text-[#C4483A]">
                    Approved as: {event.approved_type}
                  </p>
                )}

                {event.source_type === "request" && event.status !== "approved" && event.status !== "rejected" ? (
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

      <CommunityBottomNav />
    </main>
  );
}
