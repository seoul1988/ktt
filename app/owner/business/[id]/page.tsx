"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

type Business = {
  id: number;
  name: string | null;
  address: string | null;
  phone: string | null;
  category: string | null;
  hours: string | null;
  description: string | null;
};

export default function OwnerBusinessEditPage({
  params,
}: {
  params: { id: string };
}) {
  const businessId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [business, setBusiness] = useState<Business | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    loadBusiness();
  }, []);

  async function loadBusiness() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: ownerRow, error: ownerError } = await supabase
      .from("business_owners")
      .select("id")
      .eq("user_id", user.id)
      .eq("business_id", businessId)
      .eq("status", "approved")
      .maybeSingle();

    if (ownerError || !ownerRow) {
      alert("You do not have permission to edit this business.");
      window.location.href = "/owner";
      return;
    }

    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, address, phone, category, hours, description")
      .eq("id", businessId)
      .maybeSingle();

    if (error || !data) {
      alert("Business not found.");
      window.location.href = "/owner";
      return;
    }

    setBusiness(data as Business);
    setName(data.name || "");
    setAddress(data.address || "");
    setPhone(data.phone || "");
    setCategory(data.category || "");
    setHours(data.hours || "");
    setDescription(data.description || "");

    setLoading(false);
  }

  async function saveBusiness() {
    if (!business) return;

    if (!name.trim()) {
      alert("Please enter business name.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("businesses")
      .update({
        name,
        address,
        phone,
        category,
        hours,
        description,
      })
      .eq("id", business.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Business updated.");
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
            window.location.href = "/owner";
          }}
          className="mb-5 rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
        >
          ← Back
        </button>

        <div className="rounded-[32px] bg-white p-6 shadow-2xl">
          <h1 className="text-3xl font-black">Edit Business</h1>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-700">
                Business Name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-700">
                Address
              </span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-700">
                Category
              </span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Restaurant, Cafe, Market..."
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-700">
                Hours
              </span>
              <input
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="Mon-Sun 11:00 AM - 9:00 PM"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-700">
                Description
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
              />
            </label>

            <button
              onClick={saveBusiness}
              disabled={saving}
              className="w-full rounded-2xl bg-[#172033] py-4 text-lg font-extrabold text-white shadow-lg disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Business"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}