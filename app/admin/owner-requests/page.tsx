"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function OwnerRequestsPage() {
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("owner_status", "pending");

    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    await supabase
      .from("profiles")
      .update({
        role: "owner",
        owner_status: "approved",
      })
      .eq("id", id);

    load();
  }

  async function reject(id: string) {
    await supabase
      .from("profiles")
      .update({
        owner_status: "rejected",
      })
      .eq("id", id);

    load();
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
      <h1 className="mb-6 text-3xl font-black">Owner Requests</h1>

      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.id} className="rounded-3xl bg-white p-5 shadow">
            <p className="font-bold">{r.email}</p>
            <p className="text-sm text-gray-600">
              Business: {r.requested_business_name || "Not entered"}
            </p>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => approve(r.id)}
                className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white"
              >
                Approve
              </button>

              <button
                onClick={() => reject(r.id)}
                className="rounded-xl bg-red-500 px-4 py-2 font-bold text-white"
              >
                Reject
              </button>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="rounded-3xl bg-white p-5 font-bold shadow">
            No pending owner requests.
          </p>
        )}
      </div>
    </main>
  );
}