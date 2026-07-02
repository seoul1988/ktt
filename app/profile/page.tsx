"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import ProfileButton from "../components/ProfileButton";

type Profile = {
  id: string;
  email: string | null;
  role: string | null;
  full_name?: string | null;
  phone?: string | null;
  business_name?: string | null;
  owner_status?: string | null;
  requested_business_name?: string | null;
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select(
          `
          id,
          email,
          role,
          owner_status,
          requested_business_name,
          full_name,
          phone,
          business_name
        `
        )
        .eq("id", user.id)
        .maybeSingle();

      if (!data) {
        const newProfile = {
          id: user.id,
          email: user.email || null,
          role: "user",
          owner_status: "none",
          requested_business_name: "",
          full_name: "",
          phone: "",
          business_name: "",
        };

        await supabase.from("profiles").upsert(newProfile);

        setProfile(newProfile);
      } else {
        setProfile(data);
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setBusinessName(data.business_name || data.requested_business_name || "");
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  function validateRequiredFields() {
    if (!fullName.trim()) {
      alert("Please enter your full name.");
      return false;
    }

    if (!phone.trim()) {
      alert("Please enter your phone number.");
      return false;
    }

    if (!businessName.trim()) {
      alert("Please enter your business name.");
      return false;
    }

    return true;
  }

  async function sendOwnerRequestEmail() {
    if (!profile?.email) return;

    const res = await fetch("/api/send-owner-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: fullName.trim(),
        phone: phone.trim(),
        businessName: businessName.trim(),
        email: profile.email,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Failed to send owner request email.");
    }
  }

  async function applyOwner() {
    if (!profile) return;

    if (!validateRequiredFields()) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        owner_status: "pending",
        requested_business_name: businessName.trim(),
        business_name: businessName.trim(),
      })
      .eq("id", profile.id);

    if (error) {
      setSaving(false);
      alert(error.message);
      return;
    }

    try {
      await sendOwnerRequestEmail();
    } catch (emailError: any) {
      setSaving(false);
      alert(
        "Owner request was submitted, but the admin email failed to send: " +
          emailError.message
      );
      return;
    }

    setSaving(false);

    alert("Owner request submitted.");
    window.location.href = "/map";
  }

  async function saveProfile() {
    if (!profile) return;

    if (!validateRequiredFields()) return;

    setSaving(true);

    const { error } = await supabase.from("profiles").upsert(
      {
        id: profile.id,
        email: profile.email,
        role: profile.role || "user",
        owner_status: profile.owner_status || "none",
        requested_business_name: profile.requested_business_name || "",
        full_name: fullName.trim(),
        phone: phone.trim(),
        business_name: businessName.trim(),
      },
      {
        onConflict: "id",
      }
    );

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Profile saved.");

    setProfile({
      ...profile,
      full_name: fullName.trim(),
      phone: phone.trim(),
      business_name: businessName.trim(),
    });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] text-[#172033]">
        <p className="font-bold">Loading...</p>
      </main>
    );
  }

  const isPendingOwner =
    profile?.owner_status === "pending" && profile?.role === "user";

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 pb-28 py-8 text-[#172033]">
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

            <h1 className="text-3xl font-black">Profile</h1>
          </div>

          <ProfileButton />
        </div>

        <p className="mt-2 text-sm text-gray-500">
          Manage your account information.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-700">
              Email
            </span>

            <input
              value={profile?.email || ""}
              disabled
              className="w-full rounded-2xl bg-gray-100 px-5 py-4 text-gray-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-700">
              Account Type
            </span>

            <div className="w-full rounded-2xl bg-white px-5 py-4 font-bold">
              <span
                className={
                  profile?.role === "admin" ? "text-red-600" : "text-gray-300"
                }
              >
                Admin
              </span>

              <span className="mx-2 text-gray-300">|</span>

              <span
                className={
                  profile?.role === "owner" ? "text-red-600" : "text-gray-300"
                }
              >
                Owner
              </span>

              <span className="mx-2 text-gray-300">|</span>

              <span
                className={
                  profile?.role === "user" ? "text-red-600" : "text-gray-300"
                }
              >
                User
              </span>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-700">
              Full Name <span className="text-red-500">*</span>
            </span>

            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              disabled={isPendingOwner}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033] disabled:bg-gray-100 disabled:text-gray-400"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-700">
              Phone <span className="text-red-500">*</span>
            </span>

            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              disabled={isPendingOwner}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033] disabled:bg-gray-100 disabled:text-gray-400"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-700">
              Business Name <span className="text-red-500">*</span>
            </span>

            <input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              disabled={isPendingOwner}
              placeholder="Your business name"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033] disabled:bg-gray-100 disabled:text-gray-400"
            />
          </label>

          {profile?.role === "user" && !isPendingOwner && (
            <button
              onClick={applyOwner}
              disabled={saving}
              className="mb-4 w-full rounded-2xl bg-[#F6C343] py-4 font-extrabold text-[#172033] shadow-lg disabled:opacity-60"
            >
              {saving ? "Submitting..." : "Apply as Business Owner"}
            </button>
          )}

          {isPendingOwner && (
            <div className="mb-4 rounded-2xl bg-yellow-50 p-4 text-sm font-bold text-yellow-700">
              Owner application pending approval
            </div>
          )}

          {profile?.role === "owner" && (
            <a
              href="/owner"
              className="mb-4 block w-full rounded-2xl bg-[#C4483A] py-4 text-center font-extrabold text-white"
            >
              My Business
            </a>
          )}

          {profile?.role === "admin" && (
            <a
              href="/admin/owner-requests"
              className="mb-4 block w-full rounded-2xl bg-[#172033] py-4 text-center font-extrabold text-white"
            >
              Admin Dashboard
            </a>
          )}

          <button
            onClick={saveProfile}
            disabled={saving || isPendingOwner}
            className="w-full rounded-2xl bg-[#172033] py-4 text-lg font-extrabold text-white shadow-lg disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      <div className="fixed bottom-4 left-0 right-0 z-50 px-5">
        <div className="mx-auto flex max-w-md overflow-hidden rounded-full bg-[#172033] text-xs font-black text-white shadow-2xl">
          <a href="/" className="flex-1 py-4 text-center">
            Home
          </a>

          <a href="/map" className="flex-1 py-4 text-center">
            Map
          </a>

          <a href="/my-coupons" className="flex-1 py-4 text-center">
            Deals
          </a>

          <a href="/profile" className="flex-1 py-4 text-center text-[#F6C343]">
            Profile
          </a>

          {profile?.role === "admin" && (
            <a href="/admin" className="flex-1 py-4 text-center text-[#F6C343]">
              Admin
            </a>
          )}
        </div>
      </div>
    </main>
  );
}