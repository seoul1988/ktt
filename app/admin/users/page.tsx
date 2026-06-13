"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";
import CommunityBottomNav from "../../components/CommunityBottomNav";

type UserProfile = {
  id: string;
  email: string | null;
  role: string | null;
  owner_status: string | null;
  business_name: string | null;
  phone: string | null;
  created_at?: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,role,owner_status,business_name,phone,created_at")
      .neq("owner_status", "disabled")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setUsers((data || []) as UserProfile[]);
    setLoading(false);
  }

  async function changeRole(id: string, role: "user" | "owner" | "admin") {
    const ok = window.confirm(`Change this member role to ${role}?`);
    if (!ok) return;

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setUsers((prev) =>
      prev.map((user) => (user.id === id ? { ...user, role } : user))
    );
  }

  async function disableProfile(id: string, email: string | null) {
    const ok = window.confirm(
      `Disable this member?\n\n${
        email || id
      }\n\nThis will hide this member from the admin list.`
    );

    if (!ok) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        role: "user",
        owner_status: "disabled",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setUsers((prev) => prev.filter((user) => user.id !== id));
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 pb-28 pt-8 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/admin"
            className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
          >
            ← Back
          </Link>

          <h1 className="flex-1 text-center text-3xl font-black">
            Members
          </h1>

          <ProfileButton />
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-5 font-bold shadow">
            Loading...
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-3xl bg-white p-5 font-bold shadow">
            No members found.
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((user) => {
              const role = String(user.role || "user").toLowerCase();

              return (
                <div key={user.id} className="rounded-3xl bg-white p-5 shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-black">
                        {user.email || "No email"}
                      </h2>

                      <p className="mt-1 break-all text-xs text-gray-400">
                        ID: {user.id}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#172033] px-3 py-1 text-xs font-black text-white">
                      {role}
                    </span>
                  </div>

                  {user.business_name && (
                    <p className="mt-2 text-sm text-gray-600">
                      Business: {user.business_name}
                    </p>
                  )}

                  {user.phone && (
                    <p className="mt-1 text-sm text-gray-600">
                      Phone: {user.phone}
                    </p>
                  )}

                  {user.owner_status && (
                    <p className="mt-1 text-sm text-gray-600">
                      Owner Status: {user.owner_status}
                    </p>
                  )}

                  {user.created_at && (
                    <p className="mt-1 text-xs text-gray-400">
                      Joined: {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      disabled={role === "user"}
                      onClick={() => changeRole(user.id, "user")}
                      className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      User
                    </button>

                    <button
                      disabled={role === "owner"}
                      onClick={() => changeRole(user.id, "owner")}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Owner
                    </button>

                    <button
                      disabled={role === "admin"}
                      onClick={() => changeRole(user.id, "admin")}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Admin
                    </button>

                    <button
                      onClick={() => disableProfile(user.id, user.email)}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Disable
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CommunityBottomNav />
    </main>
  );
}