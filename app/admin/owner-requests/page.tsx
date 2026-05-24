"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function OwnerRequestsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<any[]>([]);
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
        phone
      `);

    if (error) {
      console.log("Owner requests error:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const pending = (data || []).filter(
      (r) =>
        (r.owner_status || "")
          .trim()
          .toLowerCase() === "pending"
    );

    setRows(pending);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    const { error } = await supabase
      .from("profiles")
      .update({
        role: "owner",
        owner_status: "approved",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    load();
  }

  async function reject(id: string) {
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

    load();
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

        <h1 className="mb-6 text-3xl font-black">
          Owner Requests
        </h1>

        {loading && (
          <p className="rounded-3xl bg-white p-5 font-bold shadow">
            Loading...
          </p>
        )}

        {!loading && (
          <div className="space-y-4">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-3xl bg-white p-5 shadow"
              >
                <p className="font-bold">{r.email}</p>

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
        )}
      </div>
    </main>
  );
}