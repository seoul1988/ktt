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
  is_winner?: boolean | null;
  won_at?: string | null;
};

export default function CommunityAttendeeList({
  eventId,
  ownerId,
  raffleEnabled = false,
  drawReady = false,
  winnerCount = 1,
}: {
  eventId: string;
  ownerId: string | null;
  raffleEnabled?: boolean;
  drawReady?: boolean;
  winnerCount?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const [rows, setRows] = useState<Attendee[]>([]);
  const [error, setError] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [rollingName, setRollingName] = useState("");

  useEffect(() => {
    load();
  }, [eventId, ownerId]);

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
      .from("community_event_attendees")
      .select(
        "id, name, phone, companions, total_count, created_at, is_winner, won_at"
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setRows(data || []);
    }

    setLoading(false);
  }

  function maskPhone(phone: string | null) {
    if (!phone) return "No Phone";

    const digits = phone.replace(/\D/g, "");

    if (digits.length <= 4) return "****";

    return digits.slice(0, -4) + "****";
  }

  function getTotalPeople() {
    if (raffleEnabled) return rows.length;

    return rows.reduce((sum, row) => {
      const total = Number(row.total_count);
      return sum + (Number.isFinite(total) && total > 0 ? total : 1);
    }, 0);
  }

  function getRowTotal(row: Attendee) {
    const total = Number(row.total_count);
    return Number.isFinite(total) && total > 0 ? total : 1;
  }

  function pickRandomWinners(list: Attendee[], count: number) {
    const pool = [...list];

    for (let i = pool.length - 1; i > 0; i--) {
      const randomArray = new Uint32Array(1);
      window.crypto.getRandomValues(randomArray);
      const j = randomArray[0] % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, Math.min(count, pool.length));
  }

  async function drawWinners() {
    if (!raffleEnabled || !drawReady) return;

    const existingWinners = rows.filter((row) => row.is_winner);

    if (existingWinners.length > 0) {
      alert("이미 추첨이 완료되었습니다.");
      return;
    }

    if (rows.length === 0) {
      alert("등록된 참가자가 없습니다.");
      return;
    }

    setDrawing(true);

    setTimeout(() => {
      let rollCount = 0;

      const interval = window.setInterval(async () => {
        const random = rows[Math.floor(Math.random() * rows.length)];
        setRollingName(random?.name || "Drawing...");

        rollCount += 1;

        if (rollCount >= 25) {
          window.clearInterval(interval);

          const winners = pickRandomWinners(rows, winnerCount);
          const winnerIds = winners.map((winner) => winner.id);

          const { error } = await supabase
            .from("community_event_attendees")
            .update({
              is_winner: true,
              won_at: new Date().toISOString(),
            })
            .in("id", winnerIds);

          if (error) {
            alert("Winner 저장 실패: " + error.message);
            setDrawing(false);
            return;
          }

          setRollingName("");
          setDrawing(false);
          await load();
        }
      }, 100);
    }, 2000);
  }

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
    const header = raffleEnabled
      ? ["No", "Name", "Phone", "Winner", "Registered At"]
      : ["No", "Name", "Phone", "Guests", "Total People", "Registered At"];

    const csvRows = rows.map((row, index) => {
      if (raffleEnabled) {
        return [
          index + 1,
          row.name || "",
          row.phone || "",
          row.is_winner ? "WINNER" : "",
          row.created_at ? new Date(row.created_at).toLocaleString() : "",
        ];
      }

      return [
        index + 1,
        row.name || "",
        row.phone || "",
        Number(row.companions) || 0,
        getRowTotal(row),
        row.created_at ? new Date(row.created_at).toLocaleString() : "",
      ];
    });

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
    const totalPeople = getTotalPeople();

    const tableRows = rows
      .map((row, index) => {
        if (raffleEnabled) {
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${row.name || ""}</td>
              <td>${row.phone || ""}</td>
              <td>${row.is_winner ? "WINNER" : ""}</td>
              <td>${row.created_at ? new Date(row.created_at).toLocaleString() : ""}</td>
            </tr>
          `;
        }

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${row.name || ""}</td>
            <td>${row.phone || ""}</td>
            <td>${Number(row.companions) || 0}</td>
            <td>${getRowTotal(row)}</td>
            <td>${row.created_at ? new Date(row.created_at).toLocaleString() : ""}</td>
          </tr>
        `;
      })
      .join("");

    const header = raffleEnabled
      ? `<tr><th>No</th><th>Name</th><th>Phone</th><th>Winner</th><th>Registered At</th></tr>`
      : `<tr><th>No</th><th>Name</th><th>Phone</th><th>Guests</th><th>Total People</th><th>Registered At</th></tr>`;

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${raffleEnabled ? "Drawing Entries" : "Attendee List"}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 22px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #999; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f0f0f0; }
          </style>
        </head>
        <body>
          <h1>${raffleEnabled ? "Drawing Entries" : "Attendee List"}</h1>
          <p><strong>${raffleEnabled ? "Entries" : "Total People"}:</strong> ${totalPeople}</p>
          <table>
            <thead>${header}</thead>
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

  const totalPeople = getTotalPeople();
  const winners = rows.filter((row) => row.is_winner);
  const alreadyDrawn = winners.length > 0;

  return (
    <div className="mt-5 rounded-3xl bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">
            {raffleEnabled ? "Drawing Entries" : "Attendee List"}
          </h2>
          <p className="mt-1 text-xs font-bold text-gray-500">
            Visible only to the event owner and admins.
          </p>
        </div>

        <div className="rounded-2xl bg-[#F8F3EC] px-4 py-3 text-center">
          <p className="text-2xl font-black text-[#C46A2B]">{totalPeople}</p>
          <p className="text-[10px] font-black text-gray-500">
            {raffleEnabled ? "ENTRIES" : "PEOPLE"}
          </p>
        </div>
      </div>

      {raffleEnabled && drawReady && (
        <div className="mt-4 rounded-2xl bg-yellow-50 p-4 text-xs font-bold leading-5 text-yellow-900">
          추첨을 시작하기 전에 휴대폰 화면 녹화를 켜 주세요.
          녹화가 시작되면 아래 버튼을 눌러 추첨을 진행하세요.
        </div>
      )}

      {raffleEnabled && drawReady && (
        <button
          type="button"
          onClick={drawWinners}
          disabled={drawing || rows.length === 0 || alreadyDrawn}
          className="mt-4 w-full rounded-full bg-yellow-500 px-4 py-4 text-sm font-black text-white disabled:bg-gray-300"
        >
          {alreadyDrawn ? "Winner Selected" : drawing ? "Drawing..." : "Draw Winner"}
        </button>
      )}

      {drawing && (
        <div className="mt-4 rounded-3xl bg-[#172033] p-6 text-center text-white">
          <p className="text-xs font-black text-white/60">Drawing...</p>
          <p className="mt-3 text-2xl font-black">{rollingName || "Ready..."}</p>
        </div>
      )}

      {winners.length > 0 && (
        <div className="mt-5 rounded-3xl bg-green-50 p-4">
          <h3 className="text-lg font-black text-green-800">🎉 Winners</h3>

          <div className="mt-3 space-y-2">
            {winners.map((winner, index) => (
              <div
                key={winner.id}
                className="rounded-2xl bg-white p-3 text-sm font-bold text-green-900 shadow-sm"
              >
                {index + 1}. {winner.name || "No Name"}{" "}
                {winner.phone ? `(${maskPhone(winner.phone)})` : ""}
              </div>
            ))}
          </div>
        </div>
      )}

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
            <div
              key={attendee.id}
              className={`rounded-2xl border p-4 ${
                attendee.is_winner ? "border-green-400 bg-green-50" : "bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">
                    {index + 1}. {attendee.name || "No Name"}{" "}
                    {attendee.is_winner && (
                      <span className="ml-1 text-green-700">WINNER</span>
                    )}
                  </p>

                  <a
                    href={attendee.phone ? `tel:${attendee.phone}` : "#"}
                    className="mt-1 block text-sm font-bold text-[#C46A2B]"
                  >
                    {maskPhone(attendee.phone)}
                  </a>
                </div>

                {!raffleEnabled && (
                  <div className="text-right text-xs font-black text-gray-500">
                    <p>Guests: {Number(attendee.companions) || 0}</p>
                    <p>Total: {getRowTotal(attendee)}</p>
                  </div>
                )}
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
