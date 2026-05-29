"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";
import CommunityBottomNav from "../../components/CommunityBottomNav";
export default function EventRequestsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);

    const { data, error } = await supabase
      .from("community_events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setEvents(data || []);
    setLoading(false);
  }

  async function approve(id: string) {
    const { error } = await supabase
      .from("community_events")
      .update({
        status: "approved",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadEvents();
  }

  async function reject(id: string) {
    const { error } = await supabase
      .from("community_events")
      .update({
        status: "rejected",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadEvents();
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                window.location.href = "/admin";
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
            >
              ← Back
            </button>

            <h1 className="text-3xl font-black text-[#172033]">
              Event Requests
            </h1>
          </div>

          <ProfileButton />
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-5 shadow">
            Loading...
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-3xl bg-white p-5 shadow"
              >
                <h2 className="text-xl font-black">
                  {event.title}
                </h2>

                <p className="mt-2 text-sm text-gray-600">
                  {event.description}
                </p>

                <p className="mt-2 text-sm">
                  📍 {event.address}
                </p>

                <p className="mt-1 text-sm">
                  📅 {event.event_date}
                </p>

             

                <div className="mt-4 flex gap-2">
				  {event.status === "approved" ? (
					<div className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white">
					  Approved
					</div>
				  ) : event.status === "rejected" ? (
					<div className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white">
					  Rejected
					</div>
				  ) : (
					<>
					  <button
						onClick={() => approve(event.id)}
						className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white"
					  >
						Approve
					  </button>

					  <button
						onClick={() => reject(event.id)}
						className="rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white"
					  >
						Reject
					  </button>
					</>
				  )}
				</div>
              </div>
            ))}
          </div>
        )}
      </div>
	   <CommunityBottomNav />
    </main>
  );
}