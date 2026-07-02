"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  owner_status: string | null;
  requested_business_name: string | null;
};

type Business = {
  id: number;
  name: string | null;
  address: string | null;
  phone: string | null;
  category: string | null;
};

export default function OwnerBusinessMatchingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (myProfile?.role !== "admin") {
      window.location.href = "/";
      return;
    }

    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        email,
        full_name,
        phone,
        role,
        owner_status,
        requested_business_name
      `
      )
      .in("owner_status", ["pending", "approved"])
      .order("full_name", { ascending: true });

    if (userError) {
      alert(userError.message);
      setLoading(false);
      return;
    }

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select(
        `
        id,
        name,
        address,
        phone,
        category
      `
      )
      .order("name", { ascending: true });

    if (businessError) {
      alert(businessError.message);
      setLoading(false);
      return;
    }

    setUsers((userData || []) as UserProfile[]);
    setBusinesses((businessData || []) as Business[]);
    setLoading(false);
  }

  async function approveAndLink() {
    if (!selectedUserId) {
      alert("Please select an owner/user.");
      return;
    }

    if (!selectedBusinessId) {
      alert("Please select a business.");
      return;
    }

    const businessId = Number(selectedBusinessId);

    if (!businessId) {
      alert("Invalid business ID.");
      return;
    }

    const ok = confirm("Approve this owner and link to this business?");
    if (!ok) return;

    setSaving(true);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: "owner",
        owner_status: "approved",
      })
      .eq("id", selectedUserId);

    if (profileError) {
      setSaving(false);
      alert(profileError.message);
      return;
    }

    const { error: linkError } = await supabase.from("business_owners").upsert(
      {
        user_id: selectedUserId,
        business_id: businessId,
        status: "approved",
      },
      {
        onConflict: "user_id,business_id",
      }
    );

    setSaving(false);

    if (linkError) {
      alert(linkError.message);
      return;
    }

    alert("Owner approved and business linked.");

    setSelectedUserId("");
    setSelectedBusinessId("");
    loadData();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] text-[#172033]">
        <p className="font-bold">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => {
              window.location.href = "/admin";
            }}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
          >
            ← Back
          </button>

          <h1 className="text-3xl font-black">Link Owner to Business</h1>
        </div>

        <p className="mb-6 text-sm font-bold text-gray-500">
          Select an owner request and connect it to an existing business.
        </p>

        <div className="rounded-3xl bg-white p-5 shadow">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-gray-700">
              Select Owner / User
            </span>

            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 font-bold outline-none"
            >
              <option value="">Choose owner/user</option>

              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || "No name"} / {u.email || "No email"} /{" "}
                  {u.owner_status || "none"} / Requested:{" "}
                  {u.requested_business_name || "None"}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-black text-gray-700">
              Select Business
            </span>

            <select
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 font-bold outline-none"
            >
              <option value="">Choose business</option>

              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  ID {b.id} / {b.name || "No name"} /{" "}
                  {b.address || "No address"}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={approveAndLink}
            disabled={saving}
            className="mt-6 w-full rounded-2xl bg-[#172033] py-4 text-lg font-extrabold text-white shadow-lg disabled:opacity-60"
          >
            {saving ? "Linking..." : "Approve & Link Business"}
          </button>
        </div>
      </div>
    </main>
  );
}