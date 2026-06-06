"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

type Attendee = {
  id: string;
  name: string | null;
  phone: string | null;
  companions: number | null;
  total_count: number | null;
  created_at: string | null;
};

export default function CommunityAttendeeList({
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
      setError("");

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
        .eq("event_type", "community")
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

  function safeFileName(value: string) {
    return value
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80);
  }

  function downloadBlob(content: BlobPart, fileName: string, type: string) {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    a.remove();
    window.URL.revokeObjectURL(url);
  }

  function exportToExcelCsv() {
    const header = [
      "No",
      "Name",
      "Phone",
      "Guests",
      "Total People",
      "Registered At",
    ];

    const csvRows = rows.map((row, index) => [
      index + 1,
      row.name || "",
      row.phone || "",
      Number(row.companions) || 0,
      Number(row.total_count) || 1,
      row.created_at ? new Date(row.created_at).toLocaleString() : "",
    ]);

    const csv = [header, ...csvRows]
      .map((line) =>
        line
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    downloadBlob(
      "\ufeff" + csv,
      `community-attendees-${safeFileName(eventId)}.csv`,
      "text/csv;charset=utf-8;"
    );
  }

  function exportToWordDoc() {
    const totalPeople = rows.reduce(
      (sum, row) => sum + (Number(row.total_count) || 1),
      0
    );

    const tableRows = rows
      .map(
        (row, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${row.name || ""}</td>
            <td>${row.phone || ""}</td>
            <td>${Number(row.companions) || 0}</td>
            <td>${Number(row.total_count) || 1}</td>
            <td>${
              row.created_at ? new Date(row.created_at).toLocaleString() : ""
            }</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Community Attendee List</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 22px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #999; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f0f0f0; }
          </style>
        </head>
        <body>
          <h1>Community Attendee List</h1>
          <p><strong>Total People:</strong> ${totalPeople}</p>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Guests</th>
                <th>Total People</th>
                <th>Registered At</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `;

    downloadBlob(
      html,
      `community-attendees-${safeFileName(eventId)}.doc`,
      "application/msword;charset=utf-8;"
    );
  }

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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={exportToExcelCsv}
          disabled={rows.length === 0}
          className="rounded-full bg-[#172033] px-4 py-3 text-xs font-black text-white disabled:bg-gray-300"
        >
          Download Excel
        </button>

        <button
          type="button"
          onClick={exportToWordDoc}
          disabled={rows.length === 0}
          className="rounded-full bg-[#C46A2B] px-4 py-3 text-xs font-black text-white disabled:bg-gray-300"
        >
          Download Word
        </button>
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

              {attendee.created_at && (
                <p className="mt-2 text-[11px] font-bold text-gray-400">
                  {new Date(attendee.created_at).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
