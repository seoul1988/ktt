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

function getUserStatus(user: UserProfile) {
  if (user.owner_status === "pending") {
    return {
      label: "Pending",
      className: "bg-amber-100 text-amber-700",
    };
  }

  if (user.owner_status === "approved" || user.role === "owner") {
    return {
      label: "Owner",
      className: "bg-green-100 text-green-700",
    };
  }

  if (user.owner_status === "rejected") {
    return {
      label: "Rejected",
      className: "bg-red-100 text-red-700",
    };
  }

  if (user.role === "admin") {
    return {
      label: "Admin",
      className: "bg-purple-100 text-purple-700",
    };
  }

  return {
    label: "Member",
    className: "bg-gray-100 text-gray-600",
  };
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

  const selectedUser = useMemo(() => {
    return users.find((user) => user.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  const selectedBusiness = useMemo(() => {
    return (
      businesses.find(
        (business) => String(business.id) === selectedBusinessId,
      ) || null
    );
  }, [businesses, selectedBusinessId]);

  const filteredUsers = useMemo(() => {
    const keyword = normalizeSearch(ownerSearch);

    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      const searchableText = [
        user.full_name,
        user.email,
        user.phone,
        user.requested_business_name,
        user.owner_status,
        user.role,
      ]
        .map(normalizeSearch)
        .join(" ");

      return searchableText.includes(keyword);
    });
  }, [users, ownerSearch]);

  const filteredBusinesses = useMemo(() => {
    const keyword = normalizeSearch(businessSearch);

    if (!keyword) {
      return businesses;
    }

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
  }, [businesses, businessSearch]);

  async function loadData() {
    setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        alert(authError.message);
        return;
      }

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: myProfile, error: profileCheckError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileCheckError) {
        alert(profileCheckError.message);
        return;
      }

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
        `,
        )
        .order("full_name", {
          ascending: true,
          nullsFirst: false,
        });

      if (userError) {
        alert(userError.message);
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
        `,
        )
        .order("name", {
          ascending: true,
          nullsFirst: false,
        });

      if (businessError) {
        alert(businessError.message);
        return;
      }

      setUsers((userData || []) as UserProfile[]);
      setBusinesses((businessData || []) as Business[]);
    } catch (error) {
      console.error("Failed to load owner matching data:", error);
      alert("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  function selectUser(user: UserProfile) {
    setSelectedUserId(user.id);
  }

  function clearSelectedUser() {
    setSelectedUserId("");
    setOwnerSearch("");
  }

  function selectBusiness(business: Business) {
    setSelectedBusinessId(String(business.id));
  }

  function clearSelectedBusiness() {
    setSelectedBusinessId("");
    setBusinessSearch("");
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

    if (!Number.isInteger(businessId) || businessId <= 0) {
      alert("Invalid business ID.");
      return;
    }

    const userName =
      selectedUser?.full_name ||
      selectedUser?.email ||
      "the selected member";

    const businessName =
      selectedBusiness?.name || `Business #${selectedBusinessId}`;

    const ok = window.confirm(
      `Approve ${userName} as an owner and link them to ${businessName}?`,
    );

    if (!ok) return;

    setSaving(true);

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          role: "owner",
          owner_status: "approved",
        })
        .eq("id", selectedUserId);

      if (profileError) {
        alert(profileError.message);
        return;
      }

      const { error: linkError } = await supabase
        .from("business_owners")
        .upsert(
          {
            user_id: selectedUserId,
            business_id: businessId,
            status: "approved",
          },
          {
            onConflict: "user_id,business_id",
          },
        );

      if (linkError) {
        alert(linkError.message);
        return;
      }

      alert("Owner approved and business linked.");

      setSelectedUserId("");
      setSelectedBusinessId("");
      setOwnerSearch("");
      setBusinessSearch("");

      await loadData();
    } catch (error) {
      console.error("Failed to link owner:", error);
      alert("Failed to link this owner to the business.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] text-[#172033]">
        <p className="font-bold">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-3 py-6 pb-28 text-[#172033] sm:px-5 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="relative mb-5 flex h-11 items-center border-b border-[#E8DED1] pb-3">
          <BackButton />

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[17px] font-black text-[#172033] sm:text-lg">
            Link Owner to Business
          </h1>

          <div className="ml-auto">
            <ProfileButton />
          </div>
        </div>

        <p className="mb-5 text-sm font-medium leading-6 text-gray-500">
          Search any registered member by name, email, phone number, role, or
          requested business. Owner application is not required.
        </p>

        <div className="space-y-6">
          {/* Member selection */}
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            <div
              className={`p-4 sm:p-5 ${
                selectedUser ? "" : "border-b border-gray-100"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-black text-[#172033]">
                    1. Select Member
                  </h2>

                  <p className="mt-1 text-xs font-medium text-gray-500">
                    All registered members are searchable.
                  </p>
                </div>

                {!selectedUser && (
                  <span className="rounded-full bg-[#EEF2F7] px-3 py-1 text-xs font-extrabold text-[#172033]">
                    {filteredUsers.length} results
                  </span>
                )}
              </div>

              {!selectedUser && (
                <div className="relative mt-4">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>

                  <input
                    type="search"
                    value={ownerSearch}
                    onChange={(event) => {
                      setOwnerSearch(event.target.value);
                      setSelectedUserId("");
                    }}
                    placeholder="Search name, email, phone, business..."
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-11 text-sm font-semibold outline-none transition focus:border-[#172033] focus:bg-white"
                  />

                  {ownerSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setOwnerSearch("");
                        setSelectedUserId("");
                      }}
                      aria-label="Clear member search"
                      className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-sm font-black text-gray-600 hover:bg-gray-300"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>

            {selectedUser ? (
              <div className="border-t border-green-200 bg-green-50 px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">
                        Selected member
                      </p>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                          getUserStatus(selectedUser).className
                        }`}
                      >
                        {getUserStatus(selectedUser).label}
                      </span>
                    </div>

                    <p className="mt-2 truncate text-base font-black text-[#172033]">
                      {selectedUser.full_name || "No Name"}
                    </p>

                    <p className="mt-1 break-all text-sm font-medium text-gray-600">
                      {selectedUser.email || "No email"}
                    </p>

                    <div className="mt-3 grid grid-cols-[90px_1fr] gap-x-2 gap-y-1.5 text-xs">
                      <span className="font-bold text-gray-400">Business</span>
                      <span className="break-words font-semibold text-gray-700">
                        {selectedUser.requested_business_name || "—"}
                      </span>

                      <span className="font-bold text-gray-400">Phone</span>
                      <span className="font-semibold text-gray-700">
                        {selectedUser.phone || "—"}
                      </span>

                      <span className="font-bold text-gray-400">Role</span>
                      <span className="font-semibold capitalize text-gray-700">
                        {selectedUser.role || "member"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={clearSelectedUser}
                    className="shrink-0 rounded-full border border-green-300 bg-white px-3 py-1.5 text-xs font-extrabold text-green-700 transition hover:bg-green-100"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-[minmax(150px,1fr)_minmax(220px,1.4fr)_minmax(170px,1fr)_100px] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-gray-500 md:grid">
                  <div>Name</div>
                  <div>Email</div>
                  <div>Requested business</div>
                  <div className="text-center">Status</div>
                </div>

                <div className="max-h-[430px] overflow-y-auto">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => {
                      const status = getUserStatus(user);

                      return (
                        <button
                          type="button"
                          key={user.id}
                          onClick={() => selectUser(user)}
                          className="block w-full border-b border-gray-100 bg-white px-4 py-4 text-left transition last:border-b-0 hover:bg-gray-50 sm:px-5"
                        >
                          <div className="hidden grid-cols-[minmax(150px,1fr)_minmax(220px,1.4fr)_minmax(170px,1fr)_100px] items-center gap-4 md:grid">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-extrabold text-[#172033]">
                                {user.full_name || "No Name"}
                              </p>

                              {user.phone && (
                                <p className="mt-1 truncate text-xs font-medium text-gray-500">
                                  {user.phone}
                                </p>
                              )}
                            </div>

                            <p className="min-w-0 break-all text-sm font-semibold text-gray-700">
                              {user.email || "No email"}
                            </p>

                            <p className="min-w-0 break-words text-sm font-semibold text-gray-700">
                              {user.requested_business_name || "—"}
                            </p>

                            <div className="text-center">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${status.className}`}
                              >
                                {status.label}
                              </span>
                            </div>
                          </div>

                          <div className="md:hidden">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black text-[#172033]">
                                  {user.full_name || "No Name"}
                                </p>

                                <p className="mt-1 break-all text-[13px] font-semibold text-gray-700">
                                  {user.email || "No email"}
                                </p>
                              </div>

                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${status.className}`}
                              >
                                {status.label}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-[88px_1fr] gap-x-2 gap-y-1 text-xs">
                              <span className="font-bold text-gray-400">
                                Business
                              </span>

                              <span className="min-w-0 break-words font-semibold text-gray-700">
                                {user.requested_business_name || "—"}
                              </span>

                              <span className="font-bold text-gray-400">
                                Phone
                              </span>

                              <span className="font-semibold text-gray-700">
                                {user.phone || "—"}
                              </span>

                              <span className="font-bold text-gray-400">
                                Role
                              </span>

                              <span className="font-semibold capitalize text-gray-700">
                                {user.role || "member"}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-5 py-10 text-center">
                      <p className="text-sm font-extrabold text-red-500">
                        No matching member found.
                      </p>

                      <p className="mt-1 text-xs font-medium text-gray-400">
                        Try searching with part of the name or email address.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Business selection */}
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            <div
              className={`p-4 sm:p-5 ${
                selectedBusiness ? "" : "border-b border-gray-100"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-black text-[#172033]">
                    2. Select Business
                  </h2>

                  <p className="mt-1 text-xs font-medium text-gray-500">
                    Search by business name, ID, address, phone, or category.
                  </p>
                </div>

                {!selectedBusiness && (
                  <span className="rounded-full bg-[#EEF2F7] px-3 py-1 text-xs font-extrabold text-[#172033]">
                    {filteredBusinesses.length} results
                  </span>
                )}
              </div>

              {!selectedBusiness && (
                <div className="relative mt-4">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>

                  <input
                    type="search"
                    value={businessSearch}
                    onChange={(event) => {
                      setBusinessSearch(event.target.value);
                      setSelectedBusinessId("");
                    }}
                    placeholder="Search business name, ID, address..."
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-11 text-sm font-semibold outline-none transition focus:border-[#172033] focus:bg-white"
                  />

                  {businessSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setBusinessSearch("");
                        setSelectedBusinessId("");
                      }}
                      aria-label="Clear business search"
                      className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-sm font-black text-gray-600 hover:bg-gray-300"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>

            {selectedBusiness ? (
              <div className="border-t border-blue-200 bg-blue-50 px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-blue-700">
                      Selected business
                    </p>

                    <p className="mt-2 text-base font-black text-[#172033]">
                      #{selectedBusiness.id} ·{" "}
                      {selectedBusiness.name || "No Name"}
                    </p>

                    <div className="mt-3 grid grid-cols-[90px_1fr] gap-x-2 gap-y-1.5 text-xs">
                      <span className="font-bold text-gray-400">
                        Category
                      </span>

                      <span className="font-semibold text-gray-700">
                        {selectedBusiness.category || "—"}
                      </span>

                      <span className="font-bold text-gray-400">Address</span>

                      <span className="break-words font-semibold text-gray-700">
                        {selectedBusiness.address || "—"}
                      </span>

                      <span className="font-bold text-gray-400">Phone</span>

                      <span className="font-semibold text-gray-700">
                        {selectedBusiness.phone || "—"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={clearSelectedBusiness}
                    className="shrink-0 rounded-full border border-blue-300 bg-white px-3 py-1.5 text-xs font-extrabold text-blue-700 transition hover:bg-blue-100"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-[80px_minmax(180px,1fr)_140px_minmax(220px,1.5fr)] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-gray-500 md:grid">
                  <div>ID</div>
                  <div>Business name</div>
                  <div>Category</div>
                  <div>Address</div>
                </div>

                <div className="max-h-[430px] overflow-y-auto">
                  {filteredBusinesses.length > 0 ? (
                    filteredBusinesses.map((business) => (
                      <button
                        type="button"
                        key={business.id}
                        onClick={() => selectBusiness(business)}
                        className="block w-full border-b border-gray-100 bg-white px-4 py-4 text-left transition last:border-b-0 hover:bg-gray-50 sm:px-5"
                      >
                        <div className="hidden grid-cols-[80px_minmax(180px,1fr)_140px_minmax(220px,1.5fr)] items-center gap-4 md:grid">
                          <p className="text-sm font-black text-[#172033]">
                            #{business.id}
                          </p>

                          <p className="min-w-0 truncate text-sm font-extrabold text-[#172033]">
                            {business.name || "No Name"}
                          </p>

                          <p className="min-w-0 truncate text-sm font-semibold text-gray-600">
                            {business.category || "—"}
                          </p>

                          <p className="min-w-0 text-sm font-medium text-gray-600">
                            {business.address || "—"}
                          </p>
                        </div>

                        <div className="md:hidden">
                          <div className="flex items-start gap-3">
                            <span className="shrink-0 rounded-lg bg-[#172033] px-2 py-1 text-[11px] font-black text-white">
                              #{business.id}
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-[#172033]">
                                {business.name || "No Name"}
                              </p>

                              <p className="mt-1 text-xs font-bold text-gray-500">
                                {business.category || "No category"}
                              </p>

                              <p className="mt-2 text-xs font-medium leading-5 text-gray-600">
                                {business.address || "No address"}
                              </p>

                              {business.phone && (
                                <p className="mt-1 text-xs font-semibold text-gray-500">
                                  {business.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-5 py-10 text-center">
                      <p className="text-sm font-extrabold text-red-500">
                        No matching business found.
                      </p>

                      <p className="mt-1 text-xs font-medium text-gray-400">
                        Try searching with part of the business name or ID.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Summary and action */}
          <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
            <h2 className="text-base font-black text-[#172033]">
              3. Confirm & Link
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div
                className={`rounded-2xl border p-4 ${
                  selectedUser
                    ? "border-green-200 bg-green-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wide text-gray-500">
                  Member
                </p>

                <p className="mt-2 text-sm font-black text-[#172033]">
                  {selectedUser?.full_name || "Not selected"}
                </p>

                <p className="mt-1 break-all text-xs font-medium text-gray-600">
                  {selectedUser?.email ||
                    "Select a member from the list above."}
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  selectedBusiness
                    ? "border-blue-200 bg-blue-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wide text-gray-500">
                  Business
                </p>

                <p className="mt-2 text-sm font-black text-[#172033]">
                  {selectedBusiness
                    ? `#${selectedBusiness.id} · ${
                        selectedBusiness.name || "No Name"
                      }`
                    : "Not selected"}
                </p>

                <p className="mt-1 text-xs font-medium text-gray-600">
                  {selectedBusiness?.address ||
                    "Select a business from the list above."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={approveAndLink}
              disabled={saving || !selectedUserId || !selectedBusinessId}
              className="mt-5 w-full rounded-2xl bg-[#172033] py-4 text-base font-extrabold text-white shadow-lg transition hover:bg-[#253652] disabled:cursor-not-allowed disabled:opacity-40 sm:text-lg"
            >
              {saving ? "Linking..." : "Approve & Link Business"}
            </button>
          </section>
        </div>
      </div>

      <CommunityBottomNav activeNav="admin" />
    </main>
  );
}