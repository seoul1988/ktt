"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../../components/BottomNav";

const libraries: "places"[] = ["places"];

export default function NewEventPage() {
  const router = useRouter();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const [saving, setSaving] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [collectAttendees, setCollectAttendees] = useState(false);
  const [raffleEnabled, setRaffleEnabled] = useState(false);
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [raffleDrawAt, setRaffleDrawAt] = useState("");
  const [raffleWinnerCount, setRaffleWinnerCount] = useState(1);

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

  function handleImage(file: File | null) {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleVideo(file: File | null) {
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
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
        contentType: file.type,
      });

    if (error) {
      throw new Error(`${bucket} upload failed: ${error.message}`);
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  }

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setContactEmail(user.email || "");

      let profile: any = null;

      const byId = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      profile = byId.data;

      if (!profile) {
        const byUserId = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        profile = byUserId.data;
      }

      if (profile) {
        setContactName(
          profile.full_name ||
            profile.name ||
            profile.username ||
            profile.business_name ||
            ""
        );

        setContactPhone(
          profile.phone ||
            profile.phone_number ||
            profile.contact_phone ||
            ""
        );
      }
    }

    loadProfile();
  }, []);

  function setRegistrationMode(value: boolean) {
    setCollectAttendees(value);

    if (!value) {
      setRaffleEnabled(false);
      setRegistrationDeadline("");
      setRaffleDrawAt("");
      setRaffleWinnerCount(1);
    }
  }

  function setRaffleMode(value: boolean) {
    setRaffleEnabled(value);

    if (value) {
      setCollectAttendees(true);
    } else {
      setRegistrationDeadline("");
      setRaffleDrawAt("");
      setRaffleWinnerCount(1);
    }
  }

  async function submitEvent() {
    if (!title.trim()) {
      alert("Please enter an event title.");
      return;
    }

    const finalRaffleEnabled = collectAttendees && raffleEnabled;

    if (finalRaffleEnabled) {
      if (!registrationDeadline) {
        alert("Please enter the registration deadline.");
        return;
      }

      if (!raffleDrawAt) {
        alert("Please enter the raffle drawing date and time.");
        return;
      }

      const deadlineTime = new Date(registrationDeadline).getTime();
      const drawTime = new Date(raffleDrawAt).getTime();

      if (Number.isNaN(deadlineTime) || Number.isNaN(drawTime)) {
        alert("Please enter valid raffle dates.");
        return;
      }

      if (drawTime <= deadlineTime) {
        alert("Drawing Date & Time must be later than the Registration Deadline.");
        setRaffleDrawAt("");
        return;
      }

      if (Number(raffleWinnerCount) < 1) {
        alert("Please enter at least 1 winner.");
        return;
      }
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Please log in first.");
        setSaving(false);
        return;
      }

      let businessId: number | null = null;

      const { data: ownerRow } = await supabase
        .from("business_owners")
        .select("business_id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();

      if (ownerRow?.business_id) {
        businessId = ownerRow.business_id;
      }

      let uploadedImageUrl = "";
      let uploadedVideoUrl = "";

      if (imageFile) {
        uploadedImageUrl = await uploadFile(imageFile, "event-images", "images");
      }

      if (videoFile) {
        uploadedVideoUrl = await uploadFile(videoFile, "event-videos", "videos");
      }

      const { data: insertedEvent, error } = await supabase
        .from("event_requests")
        .insert({
          owner_id: user.id,
          business_id: businessId,

          title: title.trim(),
          description: description.trim(),

          image_url: uploadedImageUrl || null,
          video_url: uploadedVideoUrl || null,
          external_video_url: videoUrl.trim() || null,

          event_date: eventDate || null,
          location: location.trim(),

          latitude,
          longitude,

          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,

          collect_attendees: collectAttendees,
          registration_deadline: finalRaffleEnabled ? registrationDeadline : null,

          raffle_enabled: finalRaffleEnabled,
          raffle_draw_at: finalRaffleEnabled ? raffleDrawAt : null,
          raffle_winner_count: finalRaffleEnabled
            ? Number(raffleWinnerCount)
            : null,

          attendee_required_name: collectAttendees,
          attendee_required_phone: collectAttendees,
          allow_companions: finalRaffleEnabled ? false : collectAttendees,

          status: "pending",
        })
        .select("id, title")
        .single();

      if (error) {
        alert("Event submission failed: " + error.message);
        setSaving(false);
        return;
      }

      try {
        const pushRes = await fetch("/api/push/admin-event-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: insertedEvent.id,
            title: insertedEvent.title,
          }),
        });

        const pushData = await pushRes.json().catch(() => ({}));

        if (!pushRes.ok) {
          alert(
            "The event was submitted, but the push notification failed:\n" +
              (pushData.error || "Unknown Error")
          );
        }
      } catch (pushError: any) {
        alert(
          "The event was submitted, but the push notification request failed:\n" +
            (pushError?.message || "Unknown Error")
        );
      }

      alert("Your event has been submitted and will appear after admin approval.");
      router.push("/");
    } catch (err: any) {
      alert("Save failed: " + err.message);
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-32">
      <div className="mx-auto max-w-md">
        <div className="relative mb-5 flex items-center justify-center">
          <Link
            href="/"
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black text-[#C46A2B] shadow"
          >
            ←
          </Link>

          <h1 className="text-2xl font-black text-[#C46A2B]">Create Event</h1>
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
              onChange={(e) =>
                setLatitude(e.target.value ? Number(e.target.value) : null)
              }
              placeholder="Latitude"
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />

            <input
              type="number"
              value={longitude ?? ""}
              onChange={(e) =>
                setLongitude(e.target.value ? Number(e.target.value) : null)
              }
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
                        Registration Deadline
                      </label>

                      <input
                        type="datetime-local"
                        value={registrationDeadline}
                        onChange={(e) => {
                          const value = e.currentTarget.value;
                          setRegistrationDeadline(value);

                          if (
                            raffleDrawAt &&
                            value &&
                            new Date(raffleDrawAt).getTime() <=
                              new Date(value).getTime()
                          ) {
                            alert(
                              "Drawing Date & Time must be later than the Registration Deadline."
                            );
                            setRaffleDrawAt("");
                          }
                        }}
                        className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-black text-[#172033]">
                        Drawing Date & Time
                      </label>

                      <input
                        type="datetime-local"
                        value={raffleDrawAt}
                        min={registrationDeadline || undefined}
                        onChange={(e) => {
                          const value = e.currentTarget.value;

                          if (
                            registrationDeadline &&
                            value &&
                            new Date(value).getTime() <=
                              new Date(registrationDeadline).getTime()
                          ) {
                            alert(
                              "Drawing Date & Time must be later than the Registration Deadline."
                            );
                            setRaffleDrawAt("");
                            return;
                          }

                          setRaffleDrawAt(value);
                        }}
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
                      Registration Deadline 이후에는 참가 신청이 마감됩니다.
                      <br />
                      Drawing Date & Time은 반드시 Registration Deadline 이후여야 합니다.
                      <br />
                      Drawing Date & Time 이후 관리자/오너가 Draw Winner 버튼으로 추첨할 수 있습니다.
                      <br />
                      추첨 이벤트는 이름과 전화번호만 수집하며, 동반인은 추첨 대상에 포함되지 않습니다.
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
                  onChange={(e) => handleImage(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

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
            disabled={saving}
            onClick={submitEvent}
            className="w-full rounded-full bg-[#C46A2B] py-4 text-sm font-black text-white disabled:bg-gray-400"
          >
            {saving ? "Submitting..." : "Submit Event"}
          </button>

          <p className="text-center text-xs font-bold text-gray-500">
            After submission, an admin will approve it as a Business Event or Community Event.
          </p>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}