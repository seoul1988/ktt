"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../../components/ProfileButton";


export default function NewGrandOpeningPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
    }

    loadUser();
  }, [router]);

  async function submitGrandOpening(e: React.FormEvent) {
    e.preventDefault();

    if (!userId) return alert("Please login first.");
    if (!businessName.trim()) return alert("Business name is required.");
    if (!title.trim()) return alert("Title is required.");

    setSaving(true);

    const { error } = await supabase.from("grand_openings").insert({
      user_id: userId,
      title: title.trim(),
      business_name: businessName.trim(),
      description: description.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      opening_date: openingDate || null,
      image_url: imageUrl.trim() || null,
      status: "pending",
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Grand Opening submitted for approval.");
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-xl px-5 pb-28 pt-6">
        <div className="mb-5 flex items-center justify-between border-b border-[#E8DED1] pb-3">
		  <Link href="/" className="text-sm font-black">
			← Back
		  </Link>

		  <h1 className="text-lg font-black">Grand Opening</h1>

		  <ProfileButton />
		</div>

        <form
          onSubmit={submitGrandOpening}
          className="space-y-4 rounded-3xl border border-[#E8DED1] bg-white p-5 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-black">
              Business Name *
            </label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
              placeholder="Example: Seoul BBQ"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
              placeholder="Grand Opening Special"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">
              Opening Date
            </label>
            <input
              type="date"
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
              placeholder="Business address"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
              placeholder="Phone number"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">Image URL</label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
              placeholder="Tell people about the grand opening, special offers, hours, etc."
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-[#172033] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? "Submitting..." : "Submit Grand Opening"}
          </button>
        </form>
      </section>
    </main>
  );
}