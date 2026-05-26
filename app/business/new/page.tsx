"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function NewBusinessPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string>("user");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const currentRole = String(profile?.role || "user").toLowerCase();
    setRole(currentRole);

    if (currentRole !== "owner" && currentRole !== "admin") {
      alert("Only approved owners can register a business.");
      window.location.href = "/profile";
      return;
    }

    setLoading(false);
  }

  async function saveBusiness() {
    if (!userId) return;

    if (!name.trim()) {
      alert("Please enter business name.");
      return;
    }

    if (!address.trim()) {
      alert("Please enter address.");
      return;
    }

    setSaving(true);

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .insert({
        name,
        address,
        phone,
        category,
        hours,
        description,
      })
      .select("id")
      .single();

    if (businessError) {
      setSaving(false);
      alert(businessError.message);
      return;
    }

    if (business?.id) {
      const { error: ownerError } = await supabase
        .from("business_owners")
        .insert({
          user_id: userId,
          business_id: business.id,
          status: "approved",
          approved_at: new Date().toISOString(),
        });

      if (ownerError) {
        setSaving(false);
        alert(ownerError.message);
        return;
      }
    }

    setSaving(false);
    alert("Business registered.");
    window.location.href = "/owner";
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
        <button
          onClick={() => {
            window.location.href = role === "admin" ? "/map" : "/owner";
          }}
          className="mb-5 rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
        >
          ← Back
        </button>

        <div className="rounded-[32px] bg-white p-6 shadow-2xl">
          <h1 className="text-3xl font-black">Register Business</h1>

          <div className="mt-6 space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Business name"
              className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
            />

            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address"
              className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
            />

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
            />

            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
            />

            <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Hours"
              className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
            />

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={5}
              className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
            />

            <button
              onClick={saveBusiness}
              disabled={saving}
              className="w-full rounded-2xl bg-[#172033] py-4 text-lg font-extrabold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Register Business"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}