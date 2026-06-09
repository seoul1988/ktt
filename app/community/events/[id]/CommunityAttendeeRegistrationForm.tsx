"use client";

import { useState } from "react";
import { supabase } from "../../../../lib/supabase";

type CommunityAttendeeRegistrationFormProps = {
  eventId: string | number;
  eventTitle: string;
  raffleEnabled?: boolean;
  allowCompanions?: boolean;
};

export default function CommunityAttendeeRegistrationForm({
  eventId,
  eventTitle,
  raffleEnabled = false,
  allowCompanions = true,
}: CommunityAttendeeRegistrationFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companions, setCompanions] = useState("0");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const canUseCompanions = !raffleEnabled && allowCompanions;

  async function submitRegistration() {
    if (!name.trim()) {
      alert("Please enter your name.");
      return;
    }

    if (!phone.trim()) {
      alert("Please enter your phone number.");
      return;
    }

    setSaving(true);

    const companionCount = canUseCompanions
      ? Math.max(0, Number(companions || 0))
      : 0;

    const totalCount = raffleEnabled ? 1 : companionCount + 1;

    const { error } = await supabase.from("community_event_attendees").insert({
      event_id: eventId,
      name: name.trim(),
      phone: phone.trim(),
      companions: companionCount,
      total_count: totalCount,
    });

    setSaving(false);

    if (error) {
      alert("Registration failed: " + error.message);
      return;
    }

    setDone(true);
    setName("");
    setPhone("");
    setCompanions("0");
  }

  if (done) {
    return (
      <div className="mt-4 rounded-3xl bg-green-100 p-5 text-sm font-black text-green-800 shadow-sm">
        You are registered for {eventTitle}.
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-3xl bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-full bg-[#C4483A] px-5 py-4 text-sm font-black text-white shadow"
      >
        {open ? "Close Registration" : raffleEnabled ? "Join Drawing" : "Join Event"}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-black text-[#6B6257]">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-[#6B6257]">
              Phone Number
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              inputMode="tel"
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none"
            />
          </div>

          {canUseCompanions && (
            <div>
              <label className="mb-1 block text-xs font-black text-[#6B6257]">
                Guests
              </label>
              <input
                value={companions}
                onChange={(e) => setCompanions(e.target.value)}
                type="number"
                min={0}
                placeholder="0"
                className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none"
              />
            </div>
          )}

          {raffleEnabled && (
            <p className="rounded-2xl bg-yellow-50 p-3 text-xs font-bold leading-5 text-yellow-900">
              This is a prize drawing. Guests cannot be added. Only the person
              who registers directly with their name and phone number is eligible.
            </p>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={submitRegistration}
            className="w-full rounded-full bg-[#172033] py-4 text-sm font-black text-white disabled:bg-gray-400"
          >
            {saving ? "Submitting..." : "Submit Registration"}
          </button>
        </div>
      )}
    </div>
  );
}
