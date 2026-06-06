"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Attendee = {
  id: string;
  name: string | null;
  phone: string | null;
  companions: number | null;
  total_count: number | null;
  created_at: string | null;
};

export default function AttendeeList({
  eventId,
  ownerId,
}: {
  eventId: string;
  ownerId: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const [rows, setRows] = useState<Attendee[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const allowed = ownerId === user.id || profile?.role === "admin";
      setCanView(allowed);

      if (!allowed) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("event_attendees")
        .select("id, name, phone, companions, total_count, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setRows(data || []);
      }

      setLoading(false);
    }

    load();
  }, [eventId, ownerId]);

  if (loading) return null;
  if (!canView) return null;

  const totalPeople = rows.reduce(
    (sum, row) => sum + (Number(row.total_count) || 1),
    0
  );

  return (
    <div className="mt-5 rounded-3xl bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Attendee List</h2>
          <p className="mt-1 text-xs font-bold text-gray-500">
            Visible only to the event owner and admins.
          </p>
        </div>

        <div className="rounded-2xl bg-[#F8F3EC] px-4 py-3 text-center">
          <p className="text-2xl font-black text-[#C46A2B]">{totalPeople}</p>
          <p className="text-[10px] font-black text-gray-500">PEOPLE</p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600">
          Attendee load error: {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm font-bold text-gray-500">
          No attendees yet.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((attendee, index) => (
            <div key={attendee.id} className="rounded-2xl border bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">
                    {index + 1}. {attendee.name || "No Name"}
                  </p>

                  <a
                    href={attendee.phone ? `tel:${attendee.phone}` : "#"}
                    className="mt-1 block text-sm font-bold text-[#C46A2B]"
                  >
                    {attendee.phone || "No Phone"}
                  </a>
                </div>

                <div className="text-right text-xs font-black text-gray-500">
                  <p>Guests: {Number(attendee.companions) || 0}</p>
                  <p>Total: {Number(attendee.total_count) || 1}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}