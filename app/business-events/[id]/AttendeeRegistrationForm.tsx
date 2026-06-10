"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Props = {
  eventId: string;
  eventTitle: string;
  raffleEnabled?: boolean;
  allowCompanions?: boolean;
  buttonOnly?: boolean;
  formOnly?: boolean;
};

type Mode = "attend" | "cancel" | null;

type FoundRegistration = {
  id: string;
  name: string | null;
  phone: string | null;
  companions: number | null;
  total_count: number | null;
};

export default function AttendeeRegistrationForm({
  eventId,
  eventTitle,
  raffleEnabled = false,
  allowCompanions = true,
  buttonOnly = false,
  formOnly = false,
}: Props) {
  const storageKey = `attendee-form-mode-${eventId}`;

  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companions, setCompanions] = useState("0");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [foundRegistration, setFoundRegistration] =
    useState<FoundRegistration | null>(null);

  const guestsAllowed = allowCompanions !== false && raffleEnabled !== true;

  useEffect(() => {
    const saved = window.sessionStorage.getItem(storageKey) as Mode;

    if (saved === "attend" || saved === "cancel") {
      setMode(saved);
    }

    function handleModeChange(event: Event) {
      const customEvent = event as CustomEvent<{
        eventId: string;
        mode: Mode;
      }>;

      if (customEvent.detail?.eventId === eventId) {
        setMode(customEvent.detail.mode);
        setMessage("");
        setFoundRegistration(null);
      }
    }

    window.addEventListener("attendee-form-mode-change", handleModeChange);

    return () => {
      window.removeEventListener("attendee-form-mode-change", handleModeChange);
    };
  }, [eventId, storageKey]);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
    setFoundRegistration(null);

    if (nextMode) {
      window.sessionStorage.setItem(storageKey, nextMode);
    } else {
      window.sessionStorage.removeItem(storageKey);
    }

    window.dispatchEvent(
      new CustomEvent("attendee-form-mode-change", {
        detail: { eventId, mode: nextMode },
      })
    );
  }

  function resetForm() {
    setName("");
    setPhone("");
    setCompanions("0");
    setFoundRegistration(null);
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
    setMessage("");

    const companionCount = guestsAllowed ? Number(companions) || 0 : 0;
    const totalCount = companionCount + 1;

    const { error } = await supabase.from("event_attendees").insert({
      event_id: eventId,
      event_type: "business",
      event_title: eventTitle,
      name: cleanName,
      phone: cleanPhone,
      phone_normalized: phoneNormalized,
      companions: companionCount,
      total_count: totalCount,
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

    setMessage("Registration received. Thank you for registering.");
    changeMode(null);
    resetForm();
  }

  async function findRegistrationForCancel() {
    const cleanPhone = phone.trim();
    const phoneNormalized = cleanPhone.replace(/\D/g, "");

    if (phoneNormalized.length < 10) {
      alert("Please enter the phone number used for registration.");
      return;
    }

    setSaving(true);
    setMessage("");
    setFoundRegistration(null);

    const { data, error } = await supabase
      .from("event_attendees")
      .select("id, name, phone, companions, total_count")
      .eq("event_id", eventId)
      .eq("phone_normalized", phoneNormalized)
      .maybeSingle();

    setSaving(false);

    if (error) {
      alert("Search failed: " + error.message);
      return;
    }

    if (!data) {
      alert("No registration found with this phone number.");
      return;
    }

    setFoundRegistration(data);
  }

  async function confirmCancelRegistration() {
    if (!foundRegistration) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("event_attendees")
      .delete()
      .eq("id", foundRegistration.id);

    setSaving(false);

    if (error) {
      alert("Cancellation failed: " + error.message);
      return;
    }

    setMessage("Your registration has been canceled.");
    changeMode(null);
    resetForm();
  }

  if (buttonOnly) {
    return (
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => changeMode("attend")}
          className={`rounded-full px-4 py-2 text-sm font-black shadow ${
            mode === "attend"
              ? "bg-[#C46A2B] text-white"
              : "bg-white text-[#C46A2B]"
          }`}
        >
          Attend
        </button>

        <button
          type="button"
          onClick={() => changeMode("cancel")}
          className={`rounded-full px-4 py-2 text-sm font-black shadow ${
            mode === "cancel"
              ? "bg-[#172033] text-white"
              : "bg-gray-100 text-[#172033]"
          }`}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (formOnly && !mode && !message) {
    return null;
  }

  if (message && !mode) {
    return (
      <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-lg font-black text-green-700">{message}</p>
      </div>
    );
  }

  if (mode === "cancel") {
    return (
      <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
        <h2 className="text-lg font-black text-[#172033]">
          Cancel Registration
        </h2>

        <p className="mt-1 text-xs font-bold text-gray-500">
          Enter your phone number to find your registration.
        </p>

        <input
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setFoundRegistration(null);
          }}
          placeholder="Phone Number"
          inputMode="tel"
          className="mt-4 w-full rounded-2xl border px-4 py-3 text-sm font-bold"
        />

        {!foundRegistration && (
          <button
            type="button"
            disabled={saving}
            onClick={findRegistrationForCancel}
            className="mt-4 w-full rounded-full bg-[#172033] py-4 text-sm font-black text-white disabled:bg-gray-400"
          >
            {saving ? "Searching..." : "Find My Registration"}
          </button>
        )}

        {foundRegistration && (
          <div className="mt-4 rounded-2xl border bg-white p-4">
            <p className="text-sm font-black text-[#172033]">
              Is this your registration?
            </p>

            <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm font-bold text-gray-700">
              <p>Name: {foundRegistration.name || "No Name"}</p>
              <p>Phone: {foundRegistration.phone || "No Phone"}</p>
              <p>Guests: {Number(foundRegistration.companions) || 0}</p>
              <p>Total People: {Number(foundRegistration.total_count) || 1}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={confirmCancelRegistration}
                className="rounded-full bg-red-600 py-3 text-sm font-black text-white disabled:bg-gray-400"
              >
                {saving ? "Canceling..." : "Yes, Cancel"}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setFoundRegistration(null);
                  setPhone("");
                  changeMode(null);
                }}
                className="rounded-full bg-gray-200 py-3 text-sm font-black text-[#172033]"
              >
                No, Keep
              </button>
            </div>
          </div>
        )}
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

      {raffleEnabled && (
        <p className="mt-3 rounded-xl bg-yellow-100 p-3 text-xs font-black leading-5 text-yellow-900">
          Prize Drawing Event는 본인 1명만 등록할 수 있습니다.
          <br />
          Guest 입력은 사용할 수 없습니다.
        </p>
      )}

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

      {guestsAllowed && (
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
      )}

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