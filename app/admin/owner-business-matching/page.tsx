"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";
import CommunityBottomNav from "../../components/CommunityBottomNav";

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

function normalizeSearch(value: string | number | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export default function OwnerBusinessMatchingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState("");

  const [ownerSearch, setOwnerSearch] = useState("");
  const [businessSearch, setBusinessSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    if (selectedUserId) {
      return users.filter((user) => user.id === selectedUserId);
    }

    const keyword = normalizeSearch(ownerSearch);

    if (!keyword) return users;

    return users.filter((user) => {
      const searchableText = [
        user.full_name,
        user.email,
        user.phone,
        user.requested_business_name,
        user.owner_status,
      ]
        .map(normalizeSearch)
        .join(" ");

      return searchableText.includes(keyword);
    });
  }, [users, ownerSearch, selectedUserId]);

  const filteredBusinesses = useMemo(() => {
    if (selectedBusinessId) {
      return businesses.filter(
        (business) => String(business.id) === selectedBusinessId
      );
    }

    const keyword = normalizeSearch(businessSearch);

    if (!keyword) return businesses;

    return businesses.filter((business) => {
      const searchableText = [
        business.id,
        business.name,
        business.address,
        business.phone,
        business.category,
      ]
        .map(normalizeSearch)
        .join(" ");

      return searchableText.includes(keyword);
    });
  }, [businesses, businessSearch, selectedBusinessId]);

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
    setOwnerSearch("");
    setBusinessSearch("");
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
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 pb-28 text-[#172033]">
      <div className="mx-auto max-w-2xl">
        <div className="relative mb-6 flex h-10 items-center border-b border-[#E8DED1] pb-3">
          <BackButton />

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-black text-[#172033]">
            Link Owner to Business
          </h1>

          <div className="ml-auto">
            <ProfileButton />
          </div>
        </div>

        <p className="mb-6 text-sm font-bold text-gray-500">
          Type a name, email, phone number, business name, address, category, or
          business ID to quickly narrow the list.
        </p>

        <div className="rounded-3xl bg-white p-5 shadow">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-gray-700">
              Search Owner
            </span>

            <input
              type="text"
              value={ownerSearch}
              onChange={(e) => {
                setOwnerSearch(e.target.value);
                setSelectedUserId("");
              }}
              placeholder="Name, email, phone, requested business..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 font-bold outline-none focus:border-[#172033]"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-2 block text-sm font-black text-gray-700">
              Select Owner ({filteredUsers.length})
            </span>

            <select
              value={selectedUserId}
              onChange={(e) => {
                const userId = e.target.value;
                setSelectedUserId(userId);

                if (!userId) return;

                const selectedUser = users.find((user) => user.id === userId);
                if (!selectedUser) return;

                setOwnerSearch(
                  [
                    selectedUser.full_name || "No Name",
                    selectedUser.email,
                    selectedUser.requested_business_name,
                  ]
                    .filter(Boolean)
                    .join(" | ")
                );
              }}
              size={Math.min(Math.max(filteredUsers.length + 1, 2), 6)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-bold outline-none"
            >
              <option value="">Choose owner</option>

              {filteredUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name || "No Name"}
                  {user.email ? ` | ${user.email}` : ""}
                  {user.requested_business_name
                    ? ` | ${user.requested_business_name}`
                    : ""}
                </option>
              ))}
            </select>

            {ownerSearch && !selectedUserId && filteredUsers.length === 0 && (
              <p className="mt-2 text-sm font-bold text-red-500">
                No matching owner found.
              </p>
            )}
          </label>

          <div className="my-6 border-t border-gray-200" />

          <label className="block">
            <span className="mb-2 block text-sm font-black text-gray-700">
              Search Business
            </span>

            <input
              type="text"
              value={businessSearch}
              onChange={(e) => {
                setBusinessSearch(e.target.value);
                setSelectedBusinessId("");
              }}
              placeholder="Business name, ID, address, phone, category..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 font-bold outline-none focus:border-[#172033]"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-2 block text-sm font-black text-gray-700">
              Select Business ({filteredBusinesses.length})
            </span>

            <select
              value={selectedBusinessId}
              onChange={(e) => {
                const businessId = e.target.value;
                setSelectedBusinessId(businessId);

                if (!businessId) return;

                const selectedBusiness = businesses.find(
                  (business) => String(business.id) === businessId
                );
                if (!selectedBusiness) return;

                setBusinessSearch(
                  `#${selectedBusiness.id} | ${
                    selectedBusiness.name || "No Name"
                  }`
                );
              }}
              size={Math.min(Math.max(filteredBusinesses.length + 1, 2), 7)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-bold outline-none"
            >
              <option value="">Choose business</option>

              {filteredBusinesses.map((business) => (
                <option key={business.id} value={business.id}>
                  #{business.id} | {business.name || "No Name"}
                  {business.category ? ` | ${business.category}` : ""}
                  {business.address ? ` | ${business.address}` : ""}
                </option>
              ))}
            </select>

            {businessSearch &&
              !selectedBusinessId &&
              filteredBusinesses.length === 0 && (
              <p className="mt-2 text-sm font-bold text-red-500">
                No matching business found.
              </p>
            )}
          </label>

          <button
            onClick={approveAndLink}
            disabled={saving || !selectedUserId || !selectedBusinessId}
            className="mt-6 w-full rounded-2xl bg-[#172033] py-4 text-lg font-extrabold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Linking..." : "Approve & Link Business"}
          </button>
        </div>
      </div>

      <CommunityBottomNav activeNav="admin" />
    </main>
  );
}