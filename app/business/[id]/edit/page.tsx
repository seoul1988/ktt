"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { supabase } from "../../../../lib/supabase";
import BottomNav from "../../../components/BottomNav";

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

type Business = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  category: string | null;
  hours: string | null;
  description: string | null;
  image_url: string | null;
  image_urls?: string[] | null;
  lat?: number | null;
  lng?: number | null;
  tags: string | null;
  website_url: string | null;
  instagram_url: string | null;
  video_urls?: string[] | null;
};

const defaultHours: DayHour[] = [
  {
    day: "Mon",
    open: "10:00 AM",
    close: "9:00 PM",
    closed: false,
    hasBreak: false,
    breakStart: "3:00 PM",
    breakEnd: "5:00 PM",
  },
  {
    day: "Tue",
    open: "10:00 AM",
    close: "9:00 PM",
    closed: false,
    hasBreak: false,
    breakStart: "3:00 PM",
    breakEnd: "5:00 PM",
  },
  {
    day: "Wed",
    open: "10:00 AM",
    close: "9:00 PM",
    closed: false,
    hasBreak: false,
    breakStart: "3:00 PM",
    breakEnd: "5:00 PM",
  },
  {
    day: "Thu",
    open: "10:00 AM",
    close: "9:00 PM",
    closed: false,
    hasBreak: false,
    breakStart: "3:00 PM",
    breakEnd: "5:00 PM",
  },
  {
    day: "Fri",
    open: "10:00 AM",
    close: "10:00 PM",
    closed: false,
    hasBreak: false,
    breakStart: "3:00 PM",
    breakEnd: "5:00 PM",
  },
  {
    day: "Sat",
    open: "11:00 AM",
    close: "10:00 PM",
    closed: false,
    hasBreak: false,
    breakStart: "3:00 PM",
    breakEnd: "5:00 PM",
  },
  {
    day: "Sun",
    open: "11:00 AM",
    close: "8:00 PM",
    closed: true,
    hasBreak: false,
    breakStart: "3:00 PM",
    breakEnd: "5:00 PM",
  },
];

const timeOptions = [
  "6:00 AM",
  "6:30 AM",
  "7:00 AM",
  "7:30 AM",
  "8:00 AM",
  "8:30 AM",
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
  "6:30 PM",
  "7:00 PM",
  "7:30 PM",
  "8:00 PM",
  "8:30 PM",
  "9:00 PM",
  "9:30 PM",
  "10:00 PM",
  "10:30 PM",
  "11:00 PM",
  "11:30 PM",
  "12:00 AM",
  "12:30 AM",
  "1:00 AM",
  "1:30 AM",
  "2:00 AM",
];

function parseHours(hoursText: string | null): DayHour[] {
  if (!hoursText) return defaultHours;

  return defaultHours.map((defaultItem) => {
    const line = hoursText
      .split("\n")
      .find((v) => v.startsWith(defaultItem.day));

    if (!line) return defaultItem;

    if (line.includes("Closed")) {
      return { ...defaultItem, closed: true };
    }

    const hasBreak = line.includes("/ Break");
    const mainPart = line
      .split("/ Break")[0]
      .replace(defaultItem.day, "")
      .trim();
    const breakPart = line.split("/ Break")[1]?.trim();

    const [open, close] = mainPart.split(" - ").map((v) => v.trim());

    let breakStart = defaultItem.breakStart;
    let breakEnd = defaultItem.breakEnd;

    if (breakPart) {
      const [bs, be] = breakPart.split(" - ").map((v) => v.trim());
      breakStart = bs || defaultItem.breakStart;
      breakEnd = be || defaultItem.breakEnd;
    }

    return {
      ...defaultItem,
      open: open || defaultItem.open,
      close: close || defaultItem.close,
      closed: false,
      hasBreak,
      breakStart,
      breakEnd,
    };
  });
}

export default function EditBusinessPage() {
  const params = useParams();
  const businessId = Number(params.id);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: ["places"],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [business, setBusiness] = useState<Business | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);

  const [phone, setPhone] = useState("");
  const [dayHours, setDayHours] = useState<DayHour[]>(defaultHours);
  const [description, setDescription] = useState("");

  const [tags, setTags] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);

  const [existingVideoUrl, setExistingVideoUrl] = useState("");
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [newVideoPreview, setNewVideoPreview] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPage() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const admin = profile?.role === "admin";
    setIsAdmin(admin);

    const { data: owner } = await supabase
      .from("business_owners")
      .select("user_id,status")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle();

    const isOwner = !!owner;
    const canManage = admin || isOwner;

    if (!canManage) {
      alert("You do not have permission to edit this business.");
      window.location.href = "/owner";
      return;
    }

    const { data: categoryData } = await supabase
      .from("categories")
      .select("id, name, emoji")
      .order("name", { ascending: true });

    setCategories((categoryData || []) as Category[]);

    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (error || !data) {
      alert("Business not found.");
      window.location.href = admin ? "/admin/businesses" : "/owner";
      return;
    }

    const b = data as Business;

    const images =
      b.image_urls && b.image_urls.length > 0
        ? b.image_urls
        : b.image_url
        ? [b.image_url]
        : [];

    setBusiness(b);
    setName(b.name || "");
    setAddress(b.address || "");
    setPhone(b.phone || "");
    setDescription(b.description || "");
    setTags(b.tags || "");
    setWebsiteUrl(b.website_url || "");
    setInstagramUrl(b.instagram_url || "");
    setExistingImageUrls(images);
    setExistingVideoUrl(
      b.video_urls && b.video_urls.length > 0 ? b.video_urls[0] : ""
    );
    setDayHours(parseHours(b.hours));
    setSelectedLat(b.lat || null);
    setSelectedLng(b.lng || null);

    setSelectedCategories(
      String(b.category || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    );

    setLoading(false);
  }

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("video/")) {
      alert("Please select a video file.");
      return;
    }

    setNewVideoFile(file);
    setNewVideoPreview(URL.createObjectURL(file));
  }

  function removeVideo() {
    setExistingVideoUrl("");
    setNewVideoFile(null);

    if (newVideoPreview) {
      URL.revokeObjectURL(newVideoPreview);
    }

    setNewVideoPreview("");
  }

  async function uploadVideo() {
    if (!newVideoFile) return "";

    const fileExt = newVideoFile.name.split(".").pop();
    const fileName = `${businessId}-video-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("business-videos")
      .upload(fileName, newVideoFile);

    if (error) throw error;

    const { data } = supabase.storage
      .from("business-videos")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    const currentTotal = existingImageUrls.length + newPhotoFiles.length;
    const remainCount = 6 - currentTotal;

    if (remainCount <= 0) {
      alert("You can upload up to 6 photos.");
      e.target.value = "";
      return;
    }

    const newFiles = imageFiles.slice(0, remainCount);

    setNewPhotoFiles((prev) => [...prev, ...newFiles]);
    setNewPhotoPreviews((prev) => [
      ...prev,
      ...newFiles.map((file) => URL.createObjectURL(file)),
    ]);

    e.target.value = "";
  }

  function removeExistingPhoto(index: number) {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function removeNewPhoto(index: number) {
    setNewPhotoFiles((prev) => prev.filter((_, i) => i !== index));

    setNewPhotoPreviews((prev) => {
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
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
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

  async function uploadNewPhotos() {
    if (newPhotoFiles.length === 0) return [];

    const uploadedUrls: string[] = [];

    for (const file of newPhotoFiles) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${businessId}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("business-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("business-images")
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  }

  async function saveBusiness() {
    if (!business) return;

    if (!name.trim()) {
      alert("Please enter business name.");
      return;
    }

    if (!address.trim()) {
      alert("Please enter address.");
      return;
    }

    if (!selectedLat || !selectedLng) {
      alert("Please select an address from Google autocomplete.");
      return;
    }

    if (selectedCategories.length === 0) {
      alert("Please select at least one category.");
      return;
    }

    setSaving(true);

    let uploadedUrls: string[] = [];
    let uploadedVideoUrl = "";

    try {
      uploadedUrls = await uploadNewPhotos();
      uploadedVideoUrl = await uploadVideo();
    } catch (error: any) {
      setSaving(false);
      alert("Save error: " + error.message);
      return;
    }

    const finalImageUrls = [...existingImageUrls, ...uploadedUrls].slice(0, 6);

    const { error } = await supabase
      .from("businesses")
      .update({
        name,
        address,
        phone,
        category: selectedCategories.join(", "),
        hours: formatBusinessHours(),
        description,
        tags,
        website_url: websiteUrl,
        instagram_url: instagramUrl,
        image_url: finalImageUrls[0] || "",
        image_urls: finalImageUrls,
        video_urls: uploadedVideoUrl
          ? [uploadedVideoUrl]
          : existingVideoUrl
          ? [existingVideoUrl]
          : [],
        lat: selectedLat,
        lng: selectedLng,
      })
      .eq("id", business.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Business updated.");
    window.location.href = isAdmin ? "/admin/businesses" : "/owner";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] text-[#172033]">
        <p className="font-bold">Loading...</p>
      </main>
    );
  }

  const totalPhotos = existingImageUrls.length + newPhotoFiles.length;

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 pb-32 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              window.location.href = isAdmin ? "/admin/businesses" : "/owner";
            }}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
          >
            ← Back
          </button>

          <h1 className="flex-1 text-center text-3xl font-black">
            Edit Business
          </h1>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 w-14 items-center justify-center rounded-full bg-white text-2xl font-black shadow"
            >
              ⋯
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-2xl bg-white text-sm font-bold shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = isAdmin
                      ? "/admin/businesses"
                      : "/owner";
                  }}
                  className="block w-full px-4 py-3 text-left hover:bg-gray-100"
                >
                  {isAdmin ? "Admin Businesses" : "My Business"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/business/${businessId}`;
                  }}
                  className="block w-full px-4 py-3 text-left hover:bg-gray-100"
                >
                  View Business
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/my-coupons";
                  }}
                  className="block w-full px-4 py-3 text-left hover:bg-gray-100"
                >
                  My Coupons
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/profile";
                  }}
                  className="block w-full px-4 py-3 text-left hover:bg-gray-100"
                >
                  Profile
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[32px] bg-white p-6 shadow-2xl">
          <div className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Business name"
              className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
            />

            <div className="relative">
              {isLoaded ? (
                <Autocomplete
                  onLoad={(auto) => setAutocomplete(auto)}
                  onPlaceChanged={() => {
                    const place = autocomplete?.getPlace();
                    if (!place) return;

                    const formattedAddress = place.formatted_address || "";
                    const lat = place.geometry?.location?.lat() || null;
                    const lng = place.geometry?.location?.lng() || null;

                    setAddress(formattedAddress);
                    setSelectedLat(lat);
                    setSelectedLng(lng);
                  }}
                  options={{
                    componentRestrictions: { country: "us" },
                    fields: ["formatted_address", "geometry"],
                    types: ["address"],
                  }}
                >
                  <input
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setSelectedLat(null);
                      setSelectedLng(null);
                    }}
                    placeholder="Full address"
                    className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
                  />
                </Autocomplete>
              ) : (
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Loading address autocomplete..."
                  className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
                />
              )}

              {selectedLat && selectedLng && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-xs font-black text-gray-500">
                      Latitude
                    </p>
                    <input
                      value={selectedLat}
                      readOnly
                      className="w-full rounded-xl border bg-green-50 px-3 py-3 text-sm font-bold text-green-700"
                    />
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-black text-gray-500">
                      Longitude
                    </p>
                    <input
                      value={selectedLng}
                      readOnly
                      className="w-full rounded-xl border bg-green-50 px-3 py-3 text-sm font-bold text-green-700"
                    />
                  </div>
                </div>
              )}
            </div>

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
            />

            <div className="rounded-2xl border bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-black">Business Photos</p>
                  <p className="text-xs font-bold text-gray-500">
                    {totalPhotos}/6 photos selected
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

              <div className="grid grid-cols-3 gap-2">
                {existingImageUrls.map((url, index) => (
                  <div key={url} className="relative">
                    <img
                      src={url}
                      alt={`Existing photo ${index + 1}`}
                      className="h-24 w-full rounded-xl object-cover"
                    />

                    <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                      {index + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeExistingPhoto(index)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white shadow"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {newPhotoPreviews.map((preview, index) => (
                  <div key={preview} className="relative">
                    <img
                      src={preview}
                      alt={`New photo ${index + 1}`}
                      className="h-24 w-full rounded-xl object-cover"
                    />

                    <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                      {existingImageUrls.length + index + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeNewPhoto(index)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white shadow"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black">Business Video</p>
                  <p className="text-xs font-bold text-gray-500">
                    Upload 1 video
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="rounded-2xl bg-[#172033] px-4 py-3 text-sm font-extrabold text-white"
                >
                  영상첨부
                </button>
              </div>

              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="hidden"
              />

              {(existingVideoUrl || newVideoPreview) && (
                <div className="space-y-2">
                  <video
                    controls
                    src={newVideoPreview || existingVideoUrl}
                    className="h-56 w-full rounded-xl bg-black"
                  />

                  <button
                    type="button"
                    onClick={removeVideo}
                    className="w-full rounded-xl bg-red-500 py-3 font-black text-white"
                  >
                    Remove Video
                  </button>
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
                  <div
                    key={item.day}
                    className="rounded-2xl bg-white p-3 shadow-sm"
                  >
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
                              updateDayHour(
                                index,
                                "hasBreak",
                                e.target.checked
                              )
                            }
                          />
                          Break time
                        </label>

                        {item.hasBreak && (
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={item.breakStart}
                              onChange={(e) =>
                                updateDayHour(
                                  index,
                                  "breakStart",
                                  e.target.value
                                )
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
                                updateDayHour(
                                  index,
                                  "breakEnd",
                                  e.target.value
                                )
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

            <div className="space-y-3 rounded-2xl border bg-gray-50 p-4">
              <p className="font-black">Business Info</p>

              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Tags (family, sushi, lunch)"
                className="w-full rounded-xl border bg-white px-4 py-3"
              />

              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="Website URL"
                className="w-full rounded-xl border bg-white px-4 py-3"
              />

              <input
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="Instagram URL"
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
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
