"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../../components/BottomNav";

const libraries: "places"[] = ["places"];

function normalizeUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function NewEventPage() {
  const router = useRouter();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDateTime, setEventDateTime] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [registrationUrl, setRegistrationUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [optimizingImage, setOptimizingImage] = useState(false);

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

    if (typeof lat === "number" && typeof lng === "number") {
      setLatitude(lat);
      setLongitude(lng);
    }
  }

  async function optimizeImage(file: File) {
    if (file.type === "image/gif" || file.type === "image/svg+xml") {
      return file;
    }

    let bitmap: ImageBitmap | null = null;

    try {
      bitmap = await createImageBitmap(file);

      const maxWidth = 1000;
      const maxHeight = 1000;
      const scale = Math.min(
        1,
        maxWidth / bitmap.width,
        maxHeight / bitmap.height
      );

      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        return file;
      }

      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", 0.7);
      });

      if (!blob) {
        throw new Error("Image conversion failed.");
      }

      const baseName = file.name.replace(/\.[^/.]+$/, "") || "event-image";

      return new File([blob], `${baseName}.webp`, {
        type: "image/webp",
        lastModified: Date.now(),
      });
    } finally {
      bitmap?.close();
    }
  }

  async function handleImage(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    setOptimizingImage(true);

    try {
      const optimized = await optimizeImage(file);

      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }

      setImageFile(optimized);
      setImagePreview(URL.createObjectURL(optimized));
    } catch (error: any) {
      alert("Image processing failed: " + (error?.message || "Unknown error"));
    } finally {
      setOptimizingImage(false);
    }
  }

  function removeImage() {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);
    setImagePreview("");
  }

  function handleVideo(file: File | null) {
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert("The video file is too large. Please upload a file under 50MB.");
      return;
    }

    if (videoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(videoPreview);
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  function removeVideo() {
    if (videoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(videoPreview);
    }

    setVideoFile(null);
    setVideoPreview("");
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

    void loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }

      if (videoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreview);
      }
    };
  }, [imagePreview, videoPreview]);

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

    if (!eventDateTime) {
      alert("Please enter the event date and time.");
      return;
    }

    const eventDateObject = new Date(eventDateTime);

    if (Number.isNaN(eventDateObject.getTime())) {
      alert("Please enter a valid event date and time.");
      return;
    }

    const normalizedVideoUrl = normalizeUrl(videoUrl);
    const normalizedRegistrationUrl = normalizeUrl(registrationUrl);

    if (normalizedVideoUrl && !isValidHttpUrl(normalizedVideoUrl)) {
      alert("Please enter a valid video link URL.");
      return;
    }

    if (
      normalizedRegistrationUrl &&
      !isValidHttpUrl(normalizedRegistrationUrl)
    ) {
      alert("Please enter a valid registration link URL.");
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
        alert(
          "Drawing Date & Time must be later than the Registration Deadline."
        );
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

      const { data: insertedEvent, error } = await supabase
        .from("event_requests")
        .insert({
          owner_id: user.id,
          business_id: businessId,

          title: title.trim(),
          description: description.trim() || null,

          image_url: uploadedImageUrl || null,
          video_url: uploadedVideoUrl || null,
          external_video_url: normalizedVideoUrl || null,
          registration_url: normalizedRegistrationUrl || null,

          event_date: eventDateObject.toISOString(),
          location: location.trim() || null,

          latitude,
          longitude,

          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,

          collect_attendees: collectAttendees,
          registration_deadline: finalRaffleEnabled
            ? new Date(registrationDeadline).toISOString()
            : null,

          raffle_enabled: finalRaffleEnabled,
          raffle_draw_at: finalRaffleEnabled
            ? new Date(raffleDrawAt).toISOString()
            : null,
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

      alert(
        "Your event has been submitted and will appear after admin approval."
      );
      router.push("/");
    } catch (err: any) {
      alert("Save failed: " + (err?.message || "Unknown error"));
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-32">
      <div className="mx-auto max-w-lg">
        <div className="relative mb-5 flex items-center justify-center">
          <Link
            href="/"
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black text-[#C46A2B] shadow"
          >
            ←
          </Link>

          <h1 className="text-2xl font-black text-[#C46A2B]">
            Create Event
          </h1>
        </div>

        <div className="space-y-4 rounded-3xl bg-white p-5 shadow">
          <input
            type="text"
            placeholder="Event Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <div>
            <label className="mb-1 block text-xs font-black text-[#172033]">
              Event Date & Time
            </label>

            <input
              type="datetime-local"
              value={eventDateTime}
              onChange={(e) => setEventDateTime(e.currentTarget.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />
          </div>

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
              step="any"
              value={latitude ?? ""}
              onChange={(e) =>
                setLatitude(e.target.value ? Number(e.target.value) : null)
              }
              placeholder="Latitude"
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />

            <input
              type="number"
              step="any"
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
                      Drawing Date & Time은 반드시 Registration Deadline
                      이후여야 합니다.
                      <br />
                      Drawing Date & Time 이후 관리자/오너가 Draw Winner
                      버튼으로 추첨할 수 있습니다.
                      <br />
                      추첨 이벤트는 이름과 전화번호만 수집하며, 동반인은 추첨
                      대상에 포함되지 않습니다.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <label className="mb-2 block text-sm font-black text-[#172033]">
              External Registration Link
            </label>

            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Google Form, Eventbrite, SignUpGenius URL"
              value={registrationUrl}
              onChange={(e) => setRegistrationUrl(e.target.value)}
              onBlur={() => {
                if (registrationUrl.trim()) {
                  setRegistrationUrl(normalizeUrl(registrationUrl));
                }
              }}
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
            />

            <p className="mt-2 text-xs font-semibold leading-5 text-blue-700">
              선택사항입니다. Google Form, Eventbrite, SignUpGenius 등 외부
              참가 신청 링크를 입력할 수 있습니다.
              <br />
              예: https://forms.gle/xxxxx
            </p>
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
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Email"
              className="mb-2 w-full rounded-xl border px-4 py-3"
            />

            <input
              type="tel"
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
                {imagePreview ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const input = e.currentTarget;
                    const file = input.files?.[0] || null;

                    input.value = "";
                    void handleImage(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <p className="mt-2 text-xs font-bold text-blue-600">
              Images are resized to a maximum of 1000px and converted to WebP.
            </p>

            {imagePreview && (
              <div className="mt-3 space-y-2">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-[520px] w-full rounded-2xl object-contain"
                />

                <button
                  type="button"
                  onClick={removeImage}
                  className="w-full rounded-xl bg-red-500 py-3 text-sm font-black text-white"
                >
                  Delete Image
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm font-black text-[#C46A2B]">
                Event Video
              </span>

              <label className="cursor-pointer rounded-full bg-[#C46A2B] px-4 py-2 text-xs font-black text-white shadow">
                {videoFile ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const input = e.currentTarget;
                    const file = input.files?.[0] || null;

                    input.value = "";
                    handleVideo(file);
                  }}
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
              <div className="mt-3 space-y-2">
                <video
                  src={videoPreview}
                  controls
                  className="h-48 w-full rounded-2xl object-cover"
                />

                <button
                  type="button"
                  onClick={removeVideo}
                  className="w-full rounded-xl bg-red-500 py-3 text-sm font-black text-white"
                >
                  Delete Video
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-[#172033]">
              Video Link URL
            </label>

            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="YouTube, Vimeo, Instagram video URL"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onBlur={() => {
                if (videoUrl.trim()) {
                  setVideoUrl(normalizeUrl(videoUrl));
                }
              }}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />
          </div>

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
            className="w-full rounded-full bg-[#C46A2B] py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {optimizingImage
              ? "Optimizing Image..."
              : saving
                ? "Submitting..."
                : "Submit Event"}
          </button>

          <p className="text-center text-xs font-bold text-gray-500">
            After submission, an admin will approve it as a Business Event or
            Community Event.
          </p>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}