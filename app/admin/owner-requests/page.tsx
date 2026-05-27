"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";

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
      .not("owner_status", "is", null)
      .order("owner_status", { ascending: false });

    if (error) {
      console.log("Owner requests error:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data || []) as OwnerRequestRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(row: OwnerRequestRow) {
  const ok = window.confirm("Approve this owner request?");
  if (!ok) return;

  const { error } = await supabase.rpc("approve_owner_request", {
    target_user_id: row.id,
  });

  if (error) {
    alert(error.message);
    return;
  }

  await load();
}

  async function reject(id: string) {
  const ok = window.confirm("Reject this owner request?");
  if (!ok) return;

  const { error } = await supabase.rpc("reject_owner_request", {
    target_user_id: id,
  });

  if (error) {
    alert(error.message);
    return;
  }

  await load();
}

  function statusLabel(status: string | null) {
    const s = (status || "").toLowerCase();

    if (s === "approved") return "Approved";
    if (s === "rejected") return "Rejected";
    if (s === "pending") return "Pending";

    return "Unknown";
  }

  function statusClass(status: string | null) {
    const s = (status || "").toLowerCase();

    if (s === "approved") {
      return "bg-green-100 text-green-700";
    }

    if (s === "rejected") {
      return "bg-red-100 text-red-700";
    }

    return "bg-yellow-100 text-yellow-700";
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <button
      onClick={() => {
        window.location.href = "/map";
      }}
      className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
    >
      ← Back
    </button>

    <h1 className="text-3xl font-black">
      Owner Requests
    </h1>
  </div>

  <ProfileButton />
</div>

        {loading ? (
          <p className="rounded-3xl bg-white p-5 font-bold shadow">
            Loading...
          </p>
        ) : (
          <div className="space-y-4">
            {rows.length === 0 && (
              <p className="rounded-3xl bg-white p-5 font-bold shadow">
                No owner requests.
              </p>
            )}

            {rows.map((r) => {
              const status = (r.owner_status || "").toLowerCase();
              const isPending = status === "pending";

              return (
                <div key={r.id} className="rounded-3xl bg-white p-5 shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{r.email || "No email"}</p>

                      <p className="mt-1 text-sm text-gray-600">
                        Business:{" "}
                        {r.requested_business_name ||
                          r.business_name ||
                          "Not entered"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                        r.owner_status
                      )}`}
                    >
                      {statusLabel(r.owner_status)}
                    </span>
                  </div>

                  {r.phone && (
                    <p className="mt-2 text-sm text-gray-600">
                      Phone: {r.phone}
                    </p>
                  )}

                  <p className="mt-2 text-xs text-gray-400">
                    Business ID: {r.business_id || "Not connected"}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">User ID: {r.id}</p>

                  {isPending ? (
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
                  ) : (
                    <p className="mt-4 rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-700">
                      Status: {statusLabel(r.owner_status)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
	  
	  <div className="fixed bottom-4 left-0 right-0 z-50 px-5">
  <div className="mx-auto flex max-w-md overflow-hidden rounded-full bg-[#172033] text-xs font-black text-white shadow-2xl">
    <a href="/" className="flex-1 py-4 text-center">
      Home
    </a>

    <a href="/map" className="flex-1 py-4 text-center">
      Map
    </a>

    <a
      href="/admin/owner-requests"
      className="flex-1 py-4 text-center text-[#F6C343]"
    >
      Admin
    </a>

    <a href="/community" className="flex-1 py-4 text-center">
      Community
    </a>
  </div>
</div>
    </main>
  );
}