"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

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
        .select(`
			id,
			email,
			role,
			owner_status,
			requested_business_name,
			full_name,
			phone,
			business_name
			`)
        .eq("id", user.id)
        .maybeSingle();

      if (!data) {
        const newProfile = {
          id: user.id,
          email: user.email || null,
          role: "user",
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
        setBusinessName(data.business_name || "");
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

			async function applyOwner() {
		  if (!profile) return;

		  if (!businessName.trim()) {
			alert("Please enter your business name.");
			return;
		  }

		  const { error } = await supabase
			.from("profiles")
			.update({
			  owner_status: "pending",
			  requested_business_name: businessName,
			})
			.eq("id", profile.id);

		  if (error) {
			alert(error.message);
			return;
		  }

		  alert("Owner request submitted");
		  window.location.reload();
		}

  async function saveProfile() {
    if (!profile) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        business_name: businessName,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setSaving(false);

if (error) {
  alert(error.message);
  return;
}

window.history.back();
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
      <div className="mx-auto max-w-md">
        <a
          href="/map"
          className="mb-5 inline-block rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
        >
          ← Back
        </a>

        <div className="rounded-[32px] bg-white p-6 shadow-2xl">
          <h1 className="text-3xl font-black">Edit Profile</h1>

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
              <input
                value={profile?.role || "user"}
                disabled
                className="w-full rounded-2xl bg-gray-100 px-5 py-4 text-gray-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-700">
                Full Name
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-700">
                Phone
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
              />
            </label>




<label className="block">
  <span className="mb-2 block text-sm font-bold text-gray-700">
    Business Name
  </span>

  <input
    value={businessName}
    onChange={(e) => setBusinessName(e.target.value)}
    placeholder="Your business name"
    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
  />
</label>

{profile?.role === "user" &&
 profile?.owner_status !== "pending" && (

  <button
    onClick={applyOwner}
    className="
      mb-4
      w-full
      rounded-2xl
      border-2
      border-[#172033]
      py-4
      font-extrabold
      text-[#172033]
    "
  >
    Apply as Business Owner
  </button>

)}

{profile?.owner_status === "pending" && (

  <div
    className="
      mb-4
      rounded-2xl
      bg-yellow-50
      p-4
      text-sm
      font-bold
      text-yellow-700
    "
  >
    Owner application pending approval
  </div>

)}

<button
  onClick={saveProfile}
  disabled={saving}
  className="
    w-full
    rounded-2xl
    bg-[#172033]
    py-4
    text-lg
    font-extrabold
    text-white
    shadow-lg
    disabled:opacity-60
  "
>
  {saving ? "Saving..." : "Save Profile"}
</button>
          </div>
        </div>
      </div>
    </main>
  );
}