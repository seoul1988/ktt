"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type CommunityEventFormProps = {
  mode: "create" | "edit";
  event?: any;
};

function formatDateTimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

export default function CommunityEventForm({
  mode,
  event,
}: CommunityEventFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function submitForm(formData: FormData) {
    setSaving(true);

    const payload = {
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      event_date: String(formData.get("event_date") || "").trim() || null,
      location: String(formData.get("location") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      raffle_enabled: formData.get("raffle_enabled") === "on",
      allow_companions: formData.get("allow_companions") === "on",
    };

    const result =
      mode === "edit"
        ? await supabase
            .from("community_events")
            .update(payload)
            .eq("id", event.id)
            .select()
            .single()
        : await supabase
            .from("community_events")
            .insert(payload)
            .select()
            .single();

    setSaving(false);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    router.push(`/community/events/${result.data.id}`);
    router.refresh();
  }

  return (
    <form action={submitForm} className="space-y-4 rounded-3xl bg-white p-5 shadow">
      <div>
        <label className="mb-1 block text-sm font-black">Event Title</label>
        <input
          name="title"
          defaultValue={event?.title || ""}
          required
          className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-black">Date & Time</label>
        <input
          type="datetime-local"
          name="event_date"
          defaultValue={formatDateTimeLocal(event?.event_date || null)}
          required
          className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-black">Location Name</label>
        <input
          name="location"
          defaultValue={event?.location || ""}
          className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-black">Address</label>
        <input
          name="address"
          defaultValue={event?.address || ""}
          className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-black">Description</label>
        <textarea
          rows={7}
          name="description"
          defaultValue={event?.description || ""}
          className="w-full resize-none rounded-2xl border px-4 py-3 text-sm font-bold outline-none"
        />
      </div>

      <div className="space-y-3 rounded-2xl bg-[#F8F3EC] p-4">
        <label className="flex items-center justify-between text-sm font-black">
          <span>Prize Drawing Event</span>
          <input
            type="checkbox"
            name="raffle_enabled"
            defaultChecked={event?.raffle_enabled === true}
            className="h-5 w-5"
          />
        </label>

        <label className="flex items-center justify-between text-sm font-black">
          <span>Allow Guests</span>
          <input
            type="checkbox"
            name="allow_companions"
            defaultChecked={event?.allow_companions !== false}
            className="h-5 w-5"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-[#172033] py-4 text-sm font-black text-white shadow disabled:bg-gray-400"
      >
        {saving
          ? "Saving..."
          : mode === "edit"
            ? "Save Changes"
            : "Create Event"}
      </button>
    </form>
  );
}