"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { supabase } from "../../../../../lib/supabase";
import CommunityBottomNav from "../../../../components/CommunityBottomNav";

const libraries: "places"[] = ["places"];

function formatDate(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

export default function EditCommunityEventForm({ event }: { event: any }) {
  const router = useRouter();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [title, setTitle] = useState(event.title || "");
  const [description, setDescription] = useState(event.description || "");
  const [eventDate, setEventDate] = useState(formatDate(event.event_date));
  const [location, setLocation] = useState(event.location || event.address || "");
  const [latitude, setLatitude] = useState<number | null>(event.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(event.longitude ?? null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(event.image_url || "");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState(event.video_url || "");
  const [videoUrl, setVideoUrl] = useState(event.external_video_url || "");

  const [contactName, setContactName] = useState(event.contact_name || "");
  const [contactEmail, setContactEmail] = useState(event.contact_email || "");
  const [contactPhone, setContactPhone] = useState(event.contact_phone || "");

  const [collectAttendees, setCollectAttendees] = useState(
    event.collect_attendees === true
  );
  const [raffleEnabled, setRaffleEnabled] = useState(
    event.raffle_enabled === true
  );
  const [raffleDrawAt, setRaffleDrawAt] = useState(
    formatDateTimeLocal(event.raffle_draw_at)
  );
  const [raffleWinnerCount, setRaffleWinnerCount] = useState(
    event.raffle_winner_count || 1
  );

  const [saving, setSaving] = useState(false);
  const [optimizingImage, setOptimizingImage] = useState(false);

  function onPlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    if (!place) return;

    setLocation(place.formatted_address || place.name || "");

    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();

    if (lat && lng) {
      setLatitude(lat);
      setLongitude(lng);
    }
  }


  async function optimizeImage(file: File) {
    if (file.type === "image/gif" || file.type==="image/svg+xml") return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1,1200/bitmap.width,1200/bitmap.height);

    const w=Math.round(bitmap.width*scale);
    const h=Math.round(bitmap.height*scale);

    const canvas=document.createElement("canvas");
    canvas.width=w;
    canvas.height=h;

    const ctx=canvas.getContext("2d");
    if(!ctx) return file;

    ctx.drawImage(bitmap,0,0,w,h);

    const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,"image/webp",0.76));
    bitmap.close();

    if(!blob) return file;

    return new File([blob],file.name.replace(/\.[^.]+$/,"")+".webp",{
      type:"image/webp",
      lastModified:Date.now(),
    });
  }

  async function handleImage(file: File | null) {
    if (!file) return;

    setOptimizingImage(true);

    try {
      const optimized=await optimizeImage(file);
      setImageFile(optimized);
      setImagePreview(URL.createObjectURL(optimized));
    } finally {
      setOptimizingImage(false);
    }
  }

  function handleVideo(file: File | null) {
    if (!file) return;

    const maxSize = 50 * 1024 * 1024;

    if (file.size > maxSize) {
      alert("The video file is too large. Please upload a file under 50MB.");
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  async function uploadFile(file: File, bucket: string, folder: string) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
    const fileName = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/webp",
      });

    if (error) {
      throw new Error(`${bucket} upload failed: ${error.message}`);
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  }

  function setRegistrationMode(value: boolean) {
    setCollectAttendees(value);

    if (!value) {
      setRaffleEnabled(false);
      setRaffleDrawAt("");
      setRaffleWinnerCount(1);
    }
  }

  function setRaffleMode(value: boolean) {
    setRaffleEnabled(value);

    if (value) {
      setCollectAttendees(true);
    } else {
      setRaffleDrawAt("");
      setRaffleWinnerCount(1);
    }
  }

  async function submitEvent() {
    if (!title.trim()) {
      alert("Please enter an event title.");
      return;
    }

    if (raffleEnabled && !raffleDrawAt) {
      alert("Please enter the raffle drawing date and time.");
      return;
    }

    if (raffleEnabled && Number(raffleWinnerCount) < 1) {
      alert("Please enter at least 1 winner.");
      return;
    }

    setSaving(true);

    try {
      let uploadedImageUrl = event.image_url || null;
      let uploadedVideoUrl = event.video_url || null;

      if (imageFile) {
        uploadedImageUrl = await uploadFile(
          imageFile,
          "event-images",
          "images"
        );
      }

      if (videoFile) {
        uploadedVideoUrl = await uploadFile(
          videoFile,
          "event-videos",
          "videos"
        );
      }

      const finalRaffleEnabled = collectAttendees && raffleEnabled;

      const { error } = await supabase
        .from("community_events")
        .update({
          title: title.trim(),
          description: description.trim(),

          image_url: uploadedImageUrl,
          video_url: uploadedVideoUrl,
          external_video_url: videoUrl.trim() || null,

          event_date: eventDate || null,
          location: location.trim(),
          address: location.trim(),

          latitude,
          longitude,

          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,

          collect_attendees: collectAttendees,
          raffle_enabled: finalRaffleEnabled,
          raffle_draw_at: finalRaffleEnabled ? raffleDrawAt : null,
          raffle_winner_count: finalRaffleEnabled
            ? Number(raffleWinnerCount)
            : null,
          attendee_required_name: collectAttendees,
          attendee_required_phone: collectAttendees,
          allow_companions: finalRaffleEnabled ? false : collectAttendees,
        })
        .eq("id", event.id);

      if (error) {
        alert("Update failed: " + error.message);
        setSaving(false);
        return;
      }

      router.push(`/community/events/${event.id}`);
      router.refresh();
    } catch (err: any) {
      alert("Save failed: " + err.message);
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-32">
      <div className="mx-auto max-w-5xl px-2 lg:px-4">
        <div className="relative mb-5 flex items-center justify-center">
          <Link
            href={`/community/events/${event.id}`}
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black text-[#C46A2B] shadow"
          >
            ←
          </Link>

          <h1 className="text-2xl font-black text-[#C46A2B]">
            Edit Event
          </h1>

          <details className="absolute right-0">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-white text-2xl font-black text-[#C46A2B] shadow">
              ⋯
            </summary>

            <div className="absolute right-0 top-12 z-[99999] w-56 overflow-hidden rounded-2xl bg-white text-sm font-bold shadow-xl">
              <Link href="/profile" className="block px-4 py-3 hover:bg-gray-100">
                Edit Profile
              </Link>

              <Link href="/my-coupons" className="block px-4 py-3 hover:bg-gray-100">
                My Coupons
              </Link>

              <Link href="/owner" className="block px-4 py-3 hover:bg-gray-100">
                My Business
              </Link>

              <Link href="/business/new" className="block px-4 py-3 hover:bg-gray-100">
                Register Business
              </Link>

              <Link href="/events/new" className="block px-4 py-3 hover:bg-gray-100">
                Create Event
              </Link>

              <Link href="/deals/new" className="block px-4 py-3 hover:bg-gray-100">
                Create Deal
              </Link>

              <Link href="/coupons/new" className="block px-4 py-3 hover:bg-gray-100">
                Register Coupon
              </Link>

              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                }}
                className="block w-full px-4 py-3 text-left text-red-600 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          </details>
        </div>

        <div className="space-y-4 rounded-3xl bg-white p-5 shadow">
          <input
            type="text"
            placeholder="Event Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          {isLoaded ? (
            <Autocomplete
              onLoad={(autocomplete) => {
                autocompleteRef.current = autocomplete;
              }}
              onPlaceChanged={onPlaceChanged}
            >
              <input
                type="text"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
              />
            </Autocomplete>
          ) : (
            <input
              type="text"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={latitude ?? ""}
              onChange={(e) => setLatitude(Number(e.target.value))}
              placeholder="Latitude"
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />

            <input
              type="number"
              value={longitude ?? ""}
              onChange={(e) => setLongitude(Number(e.target.value))}
              placeholder="Longitude"
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />
          </div>

          <div className="rounded-2xl border bg-gray-50 p-4">
            <p className="mb-3 font-black text-[#172033]">
              Attendee Registration
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRegistrationMode(true)}
                className={`rounded-2xl px-3 py-3 text-sm font-black shadow-sm transition ${
                  collectAttendees
                    ? "bg-[#C46A2B] text-white"
                    : "border bg-white text-[#172033]"
                }`}
              >
                Collect Attendees
              </button>

              <button
                type="button"
                onClick={() => setRegistrationMode(false)}
                className={`rounded-2xl px-3 py-3 text-sm font-black shadow-sm transition ${
                  !collectAttendees
                    ? "bg-[#C46A2B] text-white"
                    : "border bg-white text-[#172033]"
                }`}
              >
                No Registration
              </button>
            </div>

            <p className="mt-3 text-xs font-bold text-gray-500">
              Choose whether this event should collect attendee registrations on the event detail page.
            </p>

            {collectAttendees && (
              <div className="mt-4 rounded-2xl border bg-white p-4">
                <p className="mb-3 text-sm font-black text-[#172033]">
                  Prize Drawing / Raffle
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRaffleMode(true)}
                    className={`rounded-2xl px-3 py-3 text-sm font-black shadow-sm transition ${
                      raffleEnabled
                        ? "bg-[#C4483A] text-white"
                        : "border bg-white text-[#172033]"
                    }`}
                  >
                    Raffle Yes
                  </button>

                  <button
                    type="button"
                    onClick={() => setRaffleMode(false)}
                    className={`rounded-2xl px-3 py-3 text-sm font-black shadow-sm transition ${
                      !raffleEnabled
                        ? "bg-[#C4483A] text-white"
                        : "border bg-white text-[#172033]"
                    }`}
                  >
                    Raffle No
                  </button>
                </div>

                {raffleEnabled && (
                  <div className="mt-4 space-y-3 rounded-2xl bg-red-50 p-4">
                    <div>
                      <label className="mb-1 block text-xs font-black text-[#172033]">
                        Drawing Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={raffleDrawAt}
                        onChange={(e) => setRaffleDrawAt(e.target.value)}
                        className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-black text-[#172033]">
                        Number of Winners
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={raffleWinnerCount}
                        onChange={(e) =>
                          setRaffleWinnerCount(Number(e.target.value) || 1)
                        }
                        className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
                      />
                    </div>

                    <div className="rounded-xl bg-white p-3 text-xs font-bold leading-5 text-red-700">
                      Raffle registration will collect only the attendee&apos;s name and phone number.
                      Guests/companions will be disabled so only the person who directly registers can win a prize.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-gray-50 p-4">
            <p className="mb-3 font-black">Contact Information</p>

            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contact Name"
              className="mb-2 w-full rounded-xl border px-4 py-3"
            />

            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Email"
              className="mb-2 w-full rounded-xl border px-4 py-3"
            />

            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Phone"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div>
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm font-black text-[#C46A2B]">
                Event Image
              </span>

              <label className="cursor-pointer rounded-full bg-[#C46A2B] px-4 py-2 text-xs font-black text-white shadow">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e)=>{await handleImage(e.target.files?.[0]||null); e.currentTarget.value="";}}
                  className="hidden"
                />
              </label>
            </div>

            <p className="mt-2 text-xs font-bold text-blue-600">New images are automatically resized to max 1200px and converted to WebP.</p>

            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-3 h-40 w-full rounded-2xl object-cover"
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm font-black text-[#C46A2B]">
                Event Video
              </span>

              <label className="cursor-pointer rounded-full bg-[#C46A2B] px-4 py-2 text-xs font-black text-white shadow">
                Upload
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleVideo(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            {videoFile && (
              <p className="mt-2 text-xs font-bold text-gray-500">
                {videoFile.name}
              </p>
            )}

            {videoPreview && (
              <video
                src={videoPreview}
                controls
                className="mt-3 h-48 w-full rounded-2xl object-cover"
              />
            )}
          </div>

          <input
            type="text"
            placeholder="Video Link URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <textarea
            placeholder="Event Description"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <button
            type="button"
            disabled={saving || optimizingImage}
            onClick={submitEvent}
            className="w-full rounded-full bg-[#C46A2B] py-4 text-sm font-black text-white disabled:bg-gray-400"
          >
            {optimizingImage ? "Optimizing Image..." : saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}