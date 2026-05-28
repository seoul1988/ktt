"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";

type CommunityEvent = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  event_date: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  instagram: string | null;
  entry_fee: string | null;
  featured: boolean | null;
};

const emptyForm = {
  title: "",
  description: "",
  image_url: "",
  category: "KPOP",
  event_date: "",
  address: "",
  latitude: "",
  longitude: "",
  website: "",
  instagram: "",
  entry_fee: "",
  featured: false,
};

const libraries: "places"[] = ["places"];

export default function AdminCommunityEventsPage() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  async function loadEvents() {
    const { data, error } = await supabase
      .from("community_events")
      .select("*")
      .order("event_date", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setEvents(data || []);
  }

  useEffect(() => {
    loadEvents();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editEvent(event: CommunityEvent) {
    setEditingId(event.id);

    setForm({
  title: event.title || "",
  description: event.description || "",
  image_url: event.image_url || "",
  category: event.category || "KPOP",
  event_date: event.event_date ? event.event_date.slice(0, 16) : "",
  address: event.address || "",
  latitude: event.latitude?.toString() || "",
  longitude: event.longitude?.toString() || "",
  website: event.website || "",
  instagram: event.instagram || "",
  entry_fee: event.entry_fee || "",
  featured: Boolean(event.featured),
});

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEvent() {
    if (uploading) {
      alert("Image is still uploading. Please wait.");
      return;
    }

    if (!form.title.trim()) {
      alert("Title is required");
      return;
    }

    setSaving(true);

    const payload = {
	  title: form.title.trim(),
	  description: form.description.trim() || null,
	  image_url: form.image_url.trim() || null,
	  category: form.category || null,
	  event_date: form.event_date
		? new Date(form.event_date).toISOString()
		: null,
	  address: form.address.trim() || null,
	  latitude: form.latitude ? Number(form.latitude) : null,
	  longitude: form.longitude ? Number(form.longitude) : null,
	  website: form.website.trim() || null,
	  instagram: form.instagram.trim() || null,
	  entry_fee: form.entry_fee.trim() || null,
	  featured: form.featured,
	};

    const result = editingId
      ? await supabase
          .from("community_events")
          .update(payload)
          .eq("id", editingId)
          .select()
      : await supabase.from("community_events").insert(payload).select();

    setSaving(false);

    if (result.error) {
      alert(result.error.message);
      console.log(result.error);
      return;
    }

    alert(editingId ? "Event updated" : "Event added");
    resetForm();
    loadEvents();
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;

    const { error } = await supabase
      .from("community_events")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadEvents();

    if (editingId === id) {
      resetForm();
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
      <div className="mx-auto max-w-md pb-24">
        
		
		
		
		<div className="relative mb-6">
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1">
      <p className="text-sm font-black text-[#C4483A]">
        ADMIN
      </p>

      <h1 className="text-3xl font-black">
        Community Events
      </h1>

      <p className="mt-2 text-sm font-semibold text-[#6B6257]">
        Add, edit, and delete KTown community events.
      </p>
    </div>

    <button
  type="button"
  onClick={() => setMenuOpen((prev) => !prev)}
  className="fixed right-5 top-6 z-[99999] rounded-full bg-[#172033] px-4 py-3 text-sm font-black text-white shadow-xl"
>
  MENU
</button>
  </div>

  {menuOpen && (
    <div className="absolute right-0 top-14 z-[9999] w-52 overflow-hidden rounded-2xl border border-[#EFE7DC] bg-white shadow-2xl">
      <Link
        href="/admin"
        className="block px-5 py-4 text-sm font-black hover:bg-[#F8F3EC]"
      >
        Admin Home
      </Link>

      <Link
        href="/admin/community/events"
        className="block px-5 py-4 text-sm font-black hover:bg-[#F8F3EC]"
      >
        Events
      </Link>

      <Link
        href="/community"
        className="block px-5 py-4 text-sm font-black hover:bg-[#F8F3EC]"
      >
        View Community
      </Link>
    </div>
  )}
</div>

        <section className="mb-8 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-black">
            {editingId ? "Edit Event" : "Add Event"}
          </h2>

          <div className="space-y-3">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Event title"
              className="w-full rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold outline-none"
            />

            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Description"
              rows={3}
              className="w-full rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold outline-none"
            />

            <div className="space-y-2">
              <label className="text-sm font-black">Event Image</label>

              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setUploading(true);

                  const fileName = `${Date.now()}-${file.name}`;

                  const { error } = await supabase.storage
                    .from("community-events")
                    .upload(fileName, file);

                  if (error) {
                    alert(error.message);
                    setUploading(false);
                    return;
                  }

                  const { data } = supabase.storage
                    .from("community-events")
                    .getPublicUrl(fileName);

                  setForm((prev) => ({
                    ...prev,
                    image_url: data.publicUrl,
                  }));

                  setUploading(false);
                }}
                className="w-full rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold"
              />

              {uploading && (
                <p className="text-xs font-bold text-[#C4483A]">
                  Uploading...
                </p>
              )}

              {form.image_url && (
                <img
                  src={form.image_url}
                  alt="Preview"
                  className="h-40 w-full rounded-2xl object-cover"
                />
              )}
            </div>

            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold outline-none"
            >
              <option value="KPOP">KPOP</option>
              <option value="Korean Association">Korean Association</option>
              <option value="Chamber of Commerce">Chamber of Commerce</option>
              <option value="Night Market">Night Market</option>
              <option value="Concert">Concert</option>
              <option value="Food Event">Food Event</option>
              <option value="Other">Other</option>
            </select>

            <input
              type="datetime-local"
              value={form.event_date}
              onChange={(e) =>
                setForm({ ...form, event_date: e.target.value })
              }
              className="w-full rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold outline-none"
            />

            {isLoaded ? (
              <Autocomplete
                onLoad={(auto) => setAutocomplete(auto)}
                onPlaceChanged={() => {
                  if (!autocomplete) return;

                  const place = autocomplete.getPlace();

                  setForm((prev) => ({
                    ...prev,
                    address:
                      place.formatted_address ||
                      place.name ||
                      prev.address,
                    latitude:
                      place.geometry?.location?.lat()?.toString() || "",
                    longitude:
                      place.geometry?.location?.lng()?.toString() || "",
                  }));
                }}
              >
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="Search address..."
                  className="w-full rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold outline-none"
                />
              </Autocomplete>
            ) : (
              <input
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
                placeholder="Address"
                className="w-full rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold outline-none"
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.latitude}
                onChange={(e) =>
                  setForm({ ...form, latitude: e.target.value })
                }
                placeholder="Latitude"
                className="rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold outline-none"
              />

              <input
                value={form.longitude}
                onChange={(e) =>
                  setForm({ ...form, longitude: e.target.value })
                }
                placeholder="Longitude"
                className="rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold outline-none"
              />
            </div>
			<input
		  value={form.entry_fee}
		  onChange={(e) =>
			setForm({ ...form, entry_fee: e.target.value })
		  }
		  placeholder="Entry Fee (ex: Free / $20)"
		  className="w-full rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold outline-none"
		/>
			
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="Website URL"
              className="w-full rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold outline-none"
            />
		<input
              value={form.instagram}
              onChange={(e) =>
                setForm({ ...form, instagram: e.target.value })
              }
              placeholder="Instagram"
              className="w-full rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold outline-none"
            />

            <label className="flex items-center gap-3 rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-black">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) =>
                  setForm({ ...form, featured: e.target.checked })
                }
              />
              Featured event
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={saveEvent}
                disabled={saving}
                className="flex-1 rounded-2xl bg-[#172033] py-4 text-sm font-black text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update" : "Add Event"}
              </button>

              {editingId && (
                <button
                  onClick={resetForm}
                  className="rounded-2xl bg-gray-200 px-5 py-4 text-sm font-black"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-black">Event List</h2>

          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                {event.image_url && (
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="h-36 w-full object-cover"
                  />
                )}

                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-[#172033] px-3 py-1 text-[10px] font-black text-white">
                      {event.category || "EVENT"}
                    </span>

                    {event.featured && (
                      <span className="rounded-full bg-[#F4C95D] px-3 py-1 text-[10px] font-black text-[#172033]">
                        FEATURED
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-black">{event.title}</h3>

                  <p className="mt-1 text-xs font-bold text-[#6B6257]">
                    {event.event_date
                      ? new Date(event.event_date).toLocaleString()
                      : "Date TBA"}
                  </p>

                  <p className="mt-1 line-clamp-1 text-xs font-semibold text-[#6B6257]">
                    {event.address || "Location TBA"}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => editEvent(event)}
                      className="flex-1 rounded-xl bg-[#172033] py-3 text-xs font-black text-white"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="flex-1 rounded-xl bg-red-500 py-3 text-xs font-black text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!events.length && (
              <div className="rounded-3xl bg-white p-6 text-sm font-bold text-[#6B6257]">
                No events yet.
              </div>
            )}
          </div>
        </section>
      </div>
	  <div className="fixed bottom-4 left-0 right-0 z-50 px-5">
  <div className="mx-auto flex max-w-md overflow-hidden rounded-full bg-[#172033] text-xs font-black text-white shadow-lg">
    <Link href="/admin" className="flex-1 py-4 text-center">
      Admin
    </Link>
    <Link href="/admin/community/events" className="flex-1 bg-[#C4483A] py-4 text-center">
      Events
    </Link>
    <Link href="/community" className="flex-1 py-4 text-center">
      View
    </Link>
  </div>
</div>
    </main>
  );
}