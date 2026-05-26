"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type OwnerRequestRow = {
  id: string;
  email: string | null;
  role: string | null;
  owner_status: string | null;
  requested_business_name: string | null;
  business_name: string | null;
  phone: string | null;
  business_id: number | null;
  approved_at: string | null;
};

export default function OwnerRequestsPage() {
  const [rows, setRows] = useState<OwnerRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        role,
        owner_status,
        requested_business_name,
        business_name,
        phone,
        business_id,
        approved_at
      `)
      .order("email", { ascending: true });

    if (error) {
      console.log("Owner requests error:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const pending = (data || []).filter(
      (r) => (r.owner_status || "").trim().toLowerCase() === "pending"
    );

    setRows(pending as OwnerRequestRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(row: OwnerRequestRow) {
    const ok = window.confirm("Approve this owner request?");
    if (!ok) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("profiles")
      .update({
        role: "owner",
        owner_status: "approved",
        approved_at: now,
      })
      .eq("id", row.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (row.business_id) {
      const { error: ownerError } = await supabase
        .from("business_owners")
        .insert({
          user_id: row.id,
          business_id: row.business_id,
          status: "approved",
          approved_at: now,
        });

      if (ownerError) {
        console.log("business_owners insert error:", ownerError);
        alert(
          "Owner approved, but business connection failed. Check business_owners table."
        );
      }
    }

    await load();
  }

  async function reject(id: string) {
    const ok = window.confirm("Reject this owner request?");
    if (!ok) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        owner_status: "rejected",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await load();
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
      <div className="mx-auto max-w-md">
        <button
          onClick={() => {
            window.location.href = "/map";
          }}
          className="mb-5 rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
        >
          ← Back
        </button>

        <h1 className="mb-6 text-3xl font-black">Owner Requests</h1>

        {loading ? (
          <p className="rounded-3xl bg-white p-5 font-bold shadow">
            Loading...
          </p>
        ) : (
          <div className="space-y-4">
            {rows.length === 0 && (
              <p className="rounded-3xl bg-white p-5 font-bold shadow">
                No pending owner requests.
              </p>
            )}

            {rows.map((r) => (
              <div key={r.id} className="rounded-3xl bg-white p-5 shadow">
                <p className="font-bold">{r.email || "No email"}</p>

                <p className="mt-1 text-sm text-gray-600">
                  Business:{" "}
                  {r.requested_business_name ||
                    r.business_name ||
                    "Not entered"}
                </p>

                {r.phone && (
                  <p className="mt-1 text-sm text-gray-600">
                    Phone: {r.phone}
                  </p>
                )}

                <p className="mt-1 text-xs text-gray-400">
                  Business ID: {r.business_id || "Not connected"}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  User ID: {r.id}
                </p>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => approve(r)}
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
          </div>
        )}
      </div>
    </main>
  );
}