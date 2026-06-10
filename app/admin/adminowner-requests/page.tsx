"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
export const dynamic = "force-dynamic";



export default function OwnerRequests() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("owner_status", "pending");

    setRows(data || []);
  }

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
    <main className="p-6">

      <h1 className="mb-6 text-3xl font-black">
        Owner Requests
      </h1>

      <div className="space-y-4">

        {rows.map((r) => (

          <div
            key={r.id}
            className="rounded-3xl bg-white p-5 shadow"
          >

            <div>{r.email}</div>

            <div>
              {r.requested_business_name}
            </div>

            <div className="mt-4 flex gap-3">

              <button
                onClick={() => approve(r.id)}
                className="rounded bg-green-600 px-4 py-2 text-white"
              >
                Approve
              </button>

              <button
                onClick={() => reject(r.id)}
                className="rounded bg-red-500 px-4 py-2 text-white"
              >
                Reject
              </button>

            </div>

          </div>

        ))}

      </div>

    </main>
  );
}