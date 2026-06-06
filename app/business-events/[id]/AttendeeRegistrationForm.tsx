"use client";

import { useEffect, useState } from "react";
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

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companions, setCompanions] = useState("0");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(storageKey);
    setOpen(saved === "true");

    function handleToggle(event: Event) {
      const customEvent = event as CustomEvent<{
        eventId: string;
        open: boolean;
      }>;

      if (customEvent.detail?.eventId === eventId) {
        setOpen(customEvent.detail.open);
      }
    }

    window.addEventListener("attendee-form-toggle", handleToggle);

    return () => {
      window.removeEventListener("attendee-form-toggle", handleToggle);
    };
  }, [eventId, storageKey]);

  function toggleOpen() {
    const next = !open;

    setOpen(next);
    window.sessionStorage.setItem(storageKey, String(next));

    window.dispatchEvent(
      new CustomEvent("attendee-form-toggle", {
        detail: { eventId, open: next },
      })
    );
  }

  async function submitAttendance() {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const phoneNormalized = cleanPhone.replace(/\D/g, "");

    if (cleanName.length < 2) {
      alert("Please enter your full name.");
      return;
    }

    if (phoneNormalized.length < 10) {
      alert("Please enter a valid phone number.");
      return;
    }

    setSaving(true);

    const companionCount = Number(companions) || 0;

    const { error } = await supabase.from("event_attendees").insert({
      event_id: eventId,
      event_type: "business",
      event_title: eventTitle,
      name: cleanName,
      phone: cleanPhone,
      phone_normalized: phoneNormalized,
      companions: companionCount,
      total_count: companionCount + 1,
    });

    setSaving(false);

    if (error?.code === "23505") {
      alert("This phone number is already registered for this event.");
      return;
    }

    if (error) {
      alert("Registration failed: " + error.message);
      return;
    }

    setDone(true);
    setOpen(false);
    window.sessionStorage.setItem(storageKey, "false");

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

  if (formOnly && !open && !done) {
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
        No login required. The same phone number can register only once.
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
        inputMode="tel"
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
