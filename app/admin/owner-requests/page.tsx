"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";

type OwnerRequestRow = {
  id: string;
  email: string | null;
  role: string | null;
  owner_status: string | null;
  requested_business_name: string | null;
  business_name: string | null;
  full_name: string | null;
  phone: string | null;
  business_id: number | null;
  approved_at: string | null;
  created_at: string | null;
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
        full_name,
        phone,
        business_id,
        approved_at,
        created_at
      `)
      .not("owner_status", "is", null)
      .order("created_at", {
        ascending: false,
        nullsFirst: false,
      });

    if (error) {
      console.error("Owner requests error:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const sortedRows = ((data || []) as OwnerRequestRow[]).sort((a, b) => {
      const statusA = (a.owner_status || "").toLowerCase();
      const statusB = (b.owner_status || "").toLowerCase();

      const priority: Record<string, number> = {
        pending: 0,
        approved: 1,
        rejected: 2,
      };

      const priorityA = priority[statusA] ?? 3;
      const priorityB = priority[statusB] ?? 3;

      // Pending을 가장 위로 표시
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // 같은 상태에서는 최신 등록 순
      const dateA = a.created_at
        ? new Date(a.created_at).getTime()
        : 0;

      const dateB = b.created_at
        ? new Date(b.created_at).getTime()
        : 0;

      return dateB - dateA;
    });

    setRows(sortedRows);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(row: OwnerRequestRow) {
    const ok = window.confirm("Approve this owner request?");

    if (!ok) {
      return;
    }

    const { error } = await supabase.rpc(
      "approve_owner_request",
      {
        target_user_id: row.id,
      },
    );

    if (error) {
      window.alert(error.message);
      return;
    }

    await load();
  }

  async function reject(id: string) {
    const ok = window.confirm("Reject this owner request?");

    if (!ok) {
      return;
    }

    const { error } = await supabase.rpc(
      "reject_owner_request",
      {
        target_user_id: id,
      },
    );

    if (error) {
      window.alert(error.message);
      return;
    }

    await load();
  }

  function statusLabel(status: string | null) {
    const normalizedStatus = (status || "").toLowerCase();

    if (normalizedStatus === "approved") {
      return "Approved";
    }

    if (normalizedStatus === "rejected") {
      return "Rejected";
    }

    if (normalizedStatus === "pending") {
      return "Pending";
    }

    return "Unknown";
  }

  function statusClass(status: string | null) {
    const normalizedStatus = (status || "").toLowerCase();

    if (normalizedStatus === "approved") {
      return "bg-green-100 text-green-700";
    }

    if (normalizedStatus === "rejected") {
      return "bg-red-100 text-red-700";
    }

    return "bg-yellow-100 text-yellow-700";
  }

  function formatDate(value: string | null) {
    if (!value) {
      return "Date unavailable";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
      <div className="mx-auto w-full max-w-2xl">
        <div className="relative mb-6 flex h-10 items-center border-b border-[#E8DED1] pb-3">
          <BackButton />

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-2xl font-black text-[#172033]">
            Owner Requests
          </h1>

          <div className="ml-auto">
            <ProfileButton />
          </div>
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

            {rows.map((row) => {
              const status = (
                row.owner_status || ""
              ).toLowerCase();

              const isPending = status === "pending";

              return (
                <div
                  key={row.id}
                  className={`rounded-3xl bg-white p-5 shadow ${
                    isPending
                      ? "border-2 border-yellow-300"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-bold">
                        {row.email || "No email"}
                      </p>

                      <p className="mt-1 text-sm text-gray-600">
                        Business:{" "}
                        {row.requested_business_name ||
                          row.business_name ||
                          "Not entered"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${statusClass(
                        row.owner_status,
                      )}`}
                    >
                      {statusLabel(row.owner_status)}
                    </span>
                  </div>

                  {row.full_name && (
                    <p className="mt-2 text-sm text-gray-600">
                      Name: {row.full_name}
                    </p>
                  )}

                  {row.phone && (
                    <p className="mt-1 text-sm text-gray-600">
                      Phone: {row.phone}
                    </p>
                  )}

                  <p className="mt-2 text-xs font-medium text-gray-500">
                    Requested: {formatDate(row.created_at)}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Business ID:{" "}
                    {row.business_id || "Not connected"}
                  </p>

                  <p className="mt-1 break-all text-xs text-gray-400">
                    User ID: {row.id}
                  </p>

                  {isPending ? (
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => approve(row)}
                        className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-bold text-white transition active:scale-[0.97]"
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        onClick={() => reject(row.id)}
                        className="flex-1 rounded-xl bg-red-500 px-4 py-3 font-bold text-white transition active:scale-[0.97]"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-700">
                      Status: {statusLabel(row.owner_status)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CommunityBottomNav activeNav="admin" />
    </main>
  );
}