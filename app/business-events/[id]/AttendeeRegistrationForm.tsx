"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

type Props = {
  eventId: string;
  eventTitle: string;
  buttonOnly?: boolean;
  formOnly?: boolean;
};

export default function AttendeeRegistrationForm({
  eventId,
  eventTitle,
  buttonOnly = false,
  formOnly = false,
}: Props) {
  const storageKey = `attendee-form-open-${eventId}`;

  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(storageKey) === "true";
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companions, setCompanions] = useState("0");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function toggleOpen() {
    const next = !open;
    setOpen(next);

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, String(next));
      window.dispatchEvent(
        new CustomEvent("attendee-form-toggle", {
          detail: { eventId, open: next },
        })
      );
    }
  }

  if (typeof window !== "undefined") {
    window.onstorage = () => {
      setOpen(window.sessionStorage.getItem(storageKey) === "true");
    };

    window.addEventListener("attendee-form-toggle", ((event: CustomEvent) => {
      if (event.detail?.eventId === eventId) {
        setOpen(event.detail.open);
      }
    }) as EventListener);
  }

  async function submitAttendance() {
    if (!name.trim()) {
      alert("Please enter your name.");
      return;
    }

    if (!phone.trim()) {
      alert("Please enter your phone number.");
      return;
    }

    setSaving(true);

    const companionCount = Number(companions) || 0;

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

  if (buttonOnly) {
    return (
      <button
        type="button"
        onClick={toggleOpen}
        className="shrink-0 rounded-full bg-[#C46A2B] px-4 py-2 text-sm font-black text-white shadow"
      >
        {open ? "Close" : "Attend"}
      </button>
    );
  }

  if (formOnly && !open) {
    return null;
  }

  if (done) {
    return (
      <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-lg font-black text-green-700">
          Registration received!
        </p>
        <p className="mt-1 text-sm font-bold text-gray-600">
          Thank you for registering.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
      <h2 className="text-lg font-black text-[#172033]">
        Attend This Event
      </h2>

      <p className="mt-1 text-xs font-bold text-gray-500">
        No login required. Please enter your name, phone number, and guests.
      </p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your Name"
        className="mt-4 w-full rounded-2xl border px-4 py-3 text-sm font-bold"
      />

      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone Number"
        className="mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-bold"
      />

      <select
        value={companions}
        onChange={(e) => setCompanions(e.target.value)}
        className="mt-3 w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold"
      >
        <option value="0">No guest</option>
        <option value="1">1 guest</option>
        <option value="2">2 guests</option>
        <option value="3">3 guests</option>
        <option value="4">4 guests</option>
        <option value="5">5 guests</option>
      </select>

      <button
        type="button"
        disabled={saving}
        onClick={submitAttendance}
        className="mt-4 w-full rounded-full bg-[#C46A2B] py-4 text-sm font-black text-white disabled:bg-gray-400"
      >
        {saving ? "Submitting..." : "Register to Attend"}
      </button>
    </div>
  );
}
