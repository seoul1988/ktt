"use client";

import { useEffect, useRef, useState } from "react";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";

type Category = {
  id: number;
  name: string;
  emoji: string | null;
};

type DayHour = {
  day: string;
  open: string;
  close: string;
  closed: boolean;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
};

const googleLibraries: "places"[] = ["places"];

const defaultHours: DayHour[] = [
  { day: "Mon", open: "10:00 AM", close: "9:00 PM", closed: false, hasBreak: false, breakStart: "3:00 PM", breakEnd: "5:00 PM" },
  { day: "Tue", open: "10:00 AM", close: "9:00 PM", closed: false, hasBreak: false, breakStart: "3:00 PM", breakEnd: "5:00 PM" },
  { day: "Wed", open: "10:00 AM", close: "9:00 PM", closed: false, hasBreak: false, breakStart: "3:00 PM", breakEnd: "5:00 PM" },
  { day: "Thu", open: "10:00 AM", close: "9:00 PM", closed: false, hasBreak: false, breakStart: "3:00 PM", breakEnd: "5:00 PM" },
  { day: "Fri", open: "10:00 AM", close: "10:00 PM", closed: false, hasBreak: false, breakStart: "3:00 PM", breakEnd: "5:00 PM" },
  { day: "Sat", open: "11:00 AM", close: "10:00 PM", closed: false, hasBreak: false, breakStart: "3:00 PM", breakEnd: "5:00 PM" },
  { day: "Sun", open: "11:00 AM", close: "8:00 PM", closed: true, hasBreak: false, breakStart: "3:00 PM", breakEnd: "5:00 PM" },
];

const timeOptions = [
  "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM",
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM",
  "9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM",
  "12:00 AM", "12:30 AM", "1:00 AM", "1:30 AM", "2:00 AM",
];

export default function NewBusinessPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: googleLibraries,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string>("user");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [phone, setPhone] = useState("");
  const [dayHours, setDayHours] = useState<DayHour[]>(defaultHours);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
const videoInputRef = useRef<HTMLInputElement | null>(null);

const [videoFile, setVideoFile] = useState<File | null>(null);
const [videoPreview, setVideoPreview] = useState("");

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  useEffect(() => {
    checkUser();
    loadCategories();
  }, []);

  async function loadCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, emoji")
      .order("name", { ascending: true });

    if (error) {
      console.log("Categories load error:", error);
      return;
    }

    setCategories((data || []) as Category[]);
  }


function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("video/")) {
    alert("Please select a video file.");
    e.target.value = "";
    return;
  }

  setVideoFile(file);
  setVideoPreview(URL.createObjectURL(file));

  e.target.value = "";
}

function removeVideo() {
  if (videoPreview) URL.revokeObjectURL(videoPreview);
  setVideoFile(null);
  setVideoPreview("");
}

async function uploadBusinessVideo() {
  if (!videoFile) return "";

  const fileExt = videoFile.name.split(".").pop();
  const fileName = `${userId}-${Date.now()}-video.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("business-videos")
    .upload(fileName, videoFile);

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from("business-videos")
    .getPublicUrl(fileName);

  return data.publicUrl;
}


  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const currentRole = String(profile?.role || "user").toLowerCase();
    setRole(currentRole);

    if (currentRole !== "owner" && currentRole !== "admin") {
      alert("Only approved owners can register a business.");
      window.location.href = "/profile";
      return;
    }

    setLoading(false);
  }

  async function geocodeAddress(addressText: string) {
    const query = `${addressText}, North Carolina, USA`;

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    if (!data || data.length === 0) {
      return { lat: null, lng: null };
    }

    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
    };
  }

  function handleAddressChange(value: string) {
    setAddress(value);

    const match = value.match(
      /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/
    );

    if (match) {
      setLat(match[1]);
      setLng(match[3]);
    }
  }

  function handlePlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    const location = place?.geometry?.location;

    if (!place || !location) return;

    setAddress(place.formatted_address || place.name || "");
    setLat(String(location.lat()));
    setLng(String(location.lng()));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      alert("Please select image files.");
      return;
    }

    const remainCount = 6 - photoFiles.length;

    if (remainCount <= 0) {
      alert("You can upload up to 6 photos.");
      e.target.value = "";
      return;
    }

    const newFiles = imageFiles.slice(0, remainCount);

    setPhotoFiles((prev) => [...prev, ...newFiles]);
    setPhotoPreviews((prev) => [
      ...prev,
      ...newFiles.map((file) => URL.createObjectURL(file)),
    ]);

    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));

    setPhotoPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }

  function toggleCategory(categoryName: string) {
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((item) => item !== categoryName)
        : [...prev, categoryName]
    );
  }

  function updateDayHour(
    index: number,
    field: keyof DayHour,
    value: string | boolean
  ) {
    setDayHours((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function formatBusinessHours() {
    return dayHours
      .map((item) => {
        if (item.closed) return `${item.day} Closed`;

        const base = `${item.day} ${item.open} - ${item.close}`;

        if (item.hasBreak) {
          return `${base} / Break ${item.breakStart} - ${item.breakEnd}`;
        }

        return base;
      })
      .join("\n");
  }

  async function uploadBusinessPhotos() {
    if (photoFiles.length === 0) return [];

    const uploadedUrls: string[] = [];

    for (const file of photoFiles) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("business-images")
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("business-images")
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  }

  async function saveBusiness() {
    if (!userId) return;

    if (!name.trim()) {
      alert("Please enter business name.");
      return;
    }

    if (!address.trim()) {
      alert("Please enter address.");
      return;
    }

    if (selectedCategories.length === 0) {
      alert("Please select at least one category.");
      return;
    }

    setSaving(true);

    let imageUrls: string[] = [];
    let coords = { lat: null as number | null, lng: null as number | null };

   let uploadedVideoUrl = "";

try {
  imageUrls = await uploadBusinessPhotos();
  uploadedVideoUrl = await uploadBusinessVideo();

  if (lat && lng) {
    coords = {
      lat: Number(lat),
      lng: Number(lng),
    };
  } else {
    coords = await geocodeAddress(address);

    if (coords.lat && coords.lng) {
      setLat(String(coords.lat));
      setLng(String(coords.lng));
    }
  }
} catch (error: any) {
  setSaving(false);
  alert("Save error: " + error.message);
  return;
}

    if (!coords.lat || !coords.lng) {
      setSaving(false);
      alert("Could not find this address on the map. Please check the address.");
      return;
    }



  const { data: business, error: businessError } = await supabase
  .from("businesses")
  .insert({
    name,
    address,
    phone,
    category: selectedCategories.join(", "),
    hours: formatBusinessHours(),
    description,

    image_url: imageUrls[0] || "",
    image_urls: imageUrls,

    video_urls: uploadedVideoUrl
      ? [uploadedVideoUrl]
      : [],

    lat: coords.lat,
    lng: coords.lng,

    tags,
    website_url: websiteUrl,
    instagram_url: instagramUrl,

    owner_id: userId,
  })
  .select("id")
  .single();

    if (businessError) {
      setSaving(false);
      alert(businessError.message);
      return;
    }

    if (business?.id) {
      const { error: ownerError } = await supabase
        .from("business_owners")
        .insert({
          user_id: userId,
          business_id: business.id,
          status: "approved",
          approved_at: new Date().toISOString(),
        });

      if (ownerError) {
        setSaving(false);
        alert(ownerError.message);
        return;
      }
    }

    setSaving(false);
    alert("Business registered.");
    window.location.href = "/owner";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] text-[#172033]">
        <p className="font-bold">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 pb-40 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                window.location.href = "/map";
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
            >
              ← Back
            </button>

            <h1 className="text-3xl font-black">Register Business</h1>
          </div>

          <ProfileButton />
        </div>

        <div className="mt-6 space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Business name"
            className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
          />

          {isLoaded ? (
            <Autocomplete
              onLoad={(autocomplete) => {
                autocompleteRef.current = autocomplete;
              }}
              onPlaceChanged={handlePlaceChanged}
            >
              <input
                value={address}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="Full address or coordinates"
                className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
              />
            </Autocomplete>
          ) : (
            <input
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Full address or coordinates"
              className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="Latitude"
              className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
            />

            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="Longitude"
              className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
            />
          </div>

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
          />

         <div className="rounded-2xl border bg-gray-50 p-4 space-y-3">
  <div>
    <p className="font-black">Business Video</p>
    <p className="text-xs font-bold text-gray-500">
      Upload one video only.
    </p>
  </div>

  <input
    ref={videoInputRef}
    type="file"
    accept="video/*"
    onChange={handleVideoChange}
    className="hidden"
  />

  {!videoPreview ? (
    <button
      type="button"
      onClick={() => videoInputRef.current?.click()}
      className="w-full rounded-2xl bg-[#172033] px-4 py-3 text-sm font-extrabold text-white"
    >
      영상첨부
    </button>
  ) : (
    <div className="space-y-2">
      <video
        src={videoPreview}
        controls
        className="h-48 w-full rounded-xl bg-black"
      />

      <button
        type="button"
        onClick={removeVideo}
        className="w-full rounded-xl bg-red-500 py-3 text-sm font-black text-white"
      >
        Remove Video
      </button>
    </div>
  )}
</div>

          <div className="rounded-2xl border bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-black">Business Photos</p>
                <p className="text-xs font-bold text-gray-500">
                  {photoFiles.length}/6 photos selected
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded-2xl bg-[#172033] px-4 py-3 text-sm font-extrabold text-white"
              >
                사진첨부
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              className="hidden"
            />

            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoPreviews.map((preview, index) => (
                  <div key={preview} className="relative">
                    <img
                      src={preview}
                      alt={`Business preview ${index + 1}`}
                      className="h-24 w-full rounded-xl object-cover"
                    />

                    <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                      {index + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white shadow"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-gray-50 p-4">
            <p className="mb-3 font-black">Categories</p>

            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => {
                const checked = selectedCategories.includes(cat.name);

                return (
                  <label
                    key={cat.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold ${
                      checked
                        ? "border-[#172033] bg-white"
                        : "border-gray-200 bg-white/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(cat.name)}
                      className="h-4 w-4"
                    />

                    <span>{cat.emoji || "🏷️"}</span>
                    <span className="truncate">{cat.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-4">
            <p className="mb-3 font-black">Business Hours</p>

            <div className="space-y-3">
              {dayHours.map((item, index) => (
                <div key={item.day} className="rounded-2xl bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-black">{item.day}</p>

                    <label className="flex items-center gap-2 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={item.closed}
                        onChange={(e) =>
                          updateDayHour(index, "closed", e.target.checked)
                        }
                      />
                      Closed
                    </label>
                  </div>

                  {!item.closed && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={item.open}
                          onChange={(e) =>
                            updateDayHour(index, "open", e.target.value)
                          }
                          className="rounded-xl border bg-gray-50 px-3 py-3 text-sm font-bold"
                        >
                          {timeOptions.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>

                        <select
                          value={item.close}
                          onChange={(e) =>
                            updateDayHour(index, "close", e.target.value)
                          }
                          className="rounded-xl border bg-gray-50 px-3 py-3 text-sm font-bold"
                        >
                          {timeOptions.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="flex items-center gap-2 text-sm font-bold">
                        <input
                          type="checkbox"
                          checked={item.hasBreak}
                          onChange={(e) =>
                            updateDayHour(index, "hasBreak", e.target.checked)
                          }
                        />
                        Break time
                      </label>

                      {item.hasBreak && (
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={item.breakStart}
                            onChange={(e) =>
                              updateDayHour(index, "breakStart", e.target.value)
                            }
                            className="rounded-xl border bg-gray-50 px-3 py-3 text-sm font-bold"
                          >
                            {timeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>

                          <select
                            value={item.breakEnd}
                            onChange={(e) =>
                              updateDayHour(index, "breakEnd", e.target.value)
                            }
                            className="rounded-xl border bg-gray-50 px-3 py-3 text-sm font-bold"
                          >
                            {timeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-4 space-y-3">
            <p className="font-black">Business Info</p>

            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (Korean, Family, BBQ, Late Night)"
              className="w-full rounded-xl border bg-white px-4 py-3"
            />

            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="Website (https://...)"
              className="w-full rounded-xl border bg-white px-4 py-3"
            />

            <input
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="Instagram (https://instagram.com/...)"
              className="w-full rounded-xl border bg-white px-4 py-3"
            />
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={5}
            className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
          />

          <button
            onClick={saveBusiness}
            disabled={saving}
            className="w-full rounded-2xl bg-[#172033] py-4 text-lg font-extrabold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Register Business"}
          </button>
        </div>
      </div>

      <div className="fixed bottom-4 left-0 right-0 z-50 px-5">
        <div className="mx-auto flex max-w-md overflow-hidden rounded-full bg-[#172033] text-xs font-black text-white shadow-2xl">
          <a href="/" className="flex-1 py-4 text-center">
            Home
          </a>

          <a href="/map" className="flex-1 py-4 text-center">
            Map
          </a>

          <a href="/business/new" className="flex-1 py-4 text-center text-[#F6C343]">
            Business
          </a>

          <a href="/community" className="flex-1 py-4 text-center">
            Community
          </a>
        </div>
      </div>
    </main>
  );
}