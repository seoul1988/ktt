"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

type AttendeeRegistrationFormProps = {
  eventId: string;
  eventTitle: string;
};

export default function AttendeeRegistrationForm({
  eventId,
  eventTitle,
}: AttendeeRegistrationFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companions, setCompanions] = useState("0");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submitRegistration() {
    if (!name.trim()) {
      alert("Please enter your name.");
      return;
    }

    if (!phone.trim()) {
      alert("Please enter your phone number.");
      return;
    }

    const companionCount = Number(companions || 0);

    if (Number.isNaN(companionCount) || companionCount < 0) {
      alert("Please enter a valid number of guests.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("event_attendees").insert({
      event_id: eventId,
      event_type: "business",
      event_title: eventTitle,
      name: name.trim(),
      phone: phone.trim(),
      companions: companionCount,
      total_count: companionCount + 1,
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

  return (
    <div className="mt-5 rounded-3xl bg-white p-5 shadow-xl">
      <p className="text-lg font-black text-[#172033]">
        Attendee Registration
      </p>

      <p className="mt-1 text-xs font-bold text-gray-500">
        Please enter your information to attend this event. No login required.
      </p>

      {done && (
        <div className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
          Your registration has been submitted.
        </div>
      )}

      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none focus:border-[#C46A2B]"
        />

        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone Number"
          className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none focus:border-[#C46A2B]"
        />

        <select
          value={companions}
          onChange={(e) => setCompanions(e.target.value)}
          className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none focus:border-[#C46A2B]"
        >
          <option value="0">No guests</option>
          <option value="1">1 guest</option>
          <option value="2">2 guests</option>
          <option value="3">3 guests</option>
          <option value="4">4 guests</option>
          <option value="5">5 guests</option>
        </select>

        <button
          type="button"
          disabled={saving}
          onClick={submitRegistration}
          className="w-full rounded-full bg-[#C46A2B] py-4 text-sm font-black text-white disabled:bg-gray-400"
        >
          {saving ? "Submitting..." : "Submit Registration"}
        </button>
      </div>
    </div>
  );
}
