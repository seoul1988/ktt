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

type FlipbookAdSize = 1 | 2 | 3 | 4;

type FlipbookAdRecord = {
  id?: string;
  ad_size: FlipbookAdSize;
  image_url: string;
  enabled: boolean;
  priority: number;
};

const flipbookAdOptions = [
  { size: 1 as FlipbookAdSize, label: "Size 1", description: "전체면 100%", recommendedSize: "1080 × 1527 px" },
  { size: 2 as FlipbookAdSize, label: "Size 2", description: "반면 50%", recommendedSize: "1080 × 960 px" },
  { size: 3 as FlipbookAdSize, label: "Size 3", description: "1/4면 25%", recommendedSize: "540 × 960 px" },
  { size: 4 as FlipbookAdSize, label: "Size 4", description: "1/6면", recommendedSize: "540 × 640 px" },
];


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
  external_video_url?: string | null;
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
  "12:00 AM",
  "12:30 AM",
  "1:00 AM",
  "1:30 AM",
  "2:00 AM",
  "2:30 AM",
  "3:00 AM",
  "3:30 AM",
  "4:00 AM",
  "4:30 AM",
  "5:00 AM",
  "5:30 AM",
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
];

function getBusinessImagePathFromPublicUrl(url: string) {
  const marker = "/storage/v1/object/public/business-images/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.substring(index + marker.length);
}

function isAllowedVideoUrl(url: string) {
  if (!url.trim()) return true;

  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();

    return (
      host.includes("youtube.com") ||
      host.includes("youtu.be") ||
      host.includes("facebook.com") ||
      host.includes("fb.watch") ||
      host.includes("instagram.com")
    );
  } catch {
    return false;
  }
}

function isExternalVideoUrl(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("facebook.com") ||
    lower.includes("fb.watch") ||
    lower.includes("instagram.com")
  );
}

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
  const googleHoursAutoCheckedRef = useRef<number | null>(null);

  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: ["places"],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingPhotoIndex, setDeletingPhotoIndex] = useState<number | null>(
    null,
  );
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
  const [searchingGoogleHours, setSearchingGoogleHours] = useState(false);
  const [googleHoursStatus, setGoogleHoursStatus] = useState<
    "idle" | "searching" | "found" | "not_found" | "error"
  >("idle");
  const [googleHoursMessage, setGoogleHoursMessage] = useState("");
  const [description, setDescription] = useState("");

  const [tags, setTags] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);

  const [existingVideoUrl, setExistingVideoUrl] = useState("");
  const [externalVideoUrl, setExternalVideoUrl] = useState("");
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [newVideoPreview, setNewVideoPreview] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // 관리자 전용 플립북 광고 설정
  const [existingFlipbookAds, setExistingFlipbookAds] = useState<
    Partial<Record<FlipbookAdSize, FlipbookAdRecord>>
  >({});
  const [newFlipbookAdFiles, setNewFlipbookAdFiles] = useState<
    Partial<Record<FlipbookAdSize, File>>
  >({});
  const [newFlipbookAdPreviews, setNewFlipbookAdPreviews] = useState<
    Partial<Record<FlipbookAdSize, string>>
  >({});
  const [flipbookAdEnabled, setFlipbookAdEnabled] = useState<
    Record<FlipbookAdSize, boolean>
  >({ 1: false, 2: false, 3: false, 4: false });
  const [flipbookPriorities, setFlipbookPriorities] = useState<
    Record<FlipbookAdSize, number>
  >({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [removedFlipbookAdSizes, setRemovedFlipbookAdSizes] = useState<
    FlipbookAdSize[]
  >([]);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!isLoaded || !business?.id || !business.address) return;
    if (googleHoursAutoCheckedRef.current === business.id) return;

    googleHoursAutoCheckedRef.current = business.id;

    void lookupAndApplyGoogleHours(
      business.name,
      business.address,
      business.lat && business.lng
        ? { lat: business.lat, lng: business.lng }
        : undefined,
      true,
    );
  }, [isLoaded, business?.id]);

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

    const canManage = admin || !!owner;

    if (!canManage) {
      alert("You do not have permission to edit this business.");
      window.location.href = "/owner";
      return;
    }

    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("id, name, emoji")
      .order("name", { ascending: true });

    if (categoryError) {
      console.log("Categories load error:", categoryError);
    }

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
      b.video_urls && b.video_urls.length > 0 ? b.video_urls[0] : "",
    );
    setExternalVideoUrl(b.external_video_url || "");
    setDayHours(parseHours(b.hours));
    setSelectedLat(b.lat || null);
    setSelectedLng(b.lng || null);

    if (admin) {
      const { data: adData, error: adError } = await supabase
        .from("business_flipbook_ads")
        .select("id, ad_size, image_url, enabled, priority")
        .eq("business_id", businessId);

      if (adError) {
        console.error("Flipbook ads load error:", adError);
      }

      const adMap: Partial<Record<FlipbookAdSize, FlipbookAdRecord>> = {};
      const enabledMap: Record<FlipbookAdSize, boolean> = {
        1: false,
        2: false,
        3: false,
        4: false,
      };
      const priorityMap: Record<FlipbookAdSize, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
      };

      for (const item of adData || []) {
        const size = Number(item.ad_size) as FlipbookAdSize;
        if (![1, 2, 3, 4].includes(size)) continue;
        adMap[size] = item as FlipbookAdRecord;
        enabledMap[size] = Boolean(item.enabled);
        priorityMap[size] = Number(item.priority || 0);
      }

      setExistingFlipbookAds(adMap);
      setFlipbookAdEnabled(enabledMap);
      setFlipbookPriorities(priorityMap);
      setNewFlipbookAdFiles({});
      setNewFlipbookAdPreviews({});
      setRemovedFlipbookAdSizes([]);
    }

    setSelectedCategories(
      String(b.category || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    );

    setLoading(false);
  }

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("video/")) {
      alert("Please select a video file.");
      e.target.value = "";
      return;
    }

    if (externalVideoUrl.trim()) {
      alert(
        "동영상은 업로드 또는 링크 중 하나만 가능합니다. 링크를 지운 후 업로드하세요.",
      );
      e.target.value = "";
      return;
    }

    if (newVideoPreview) {
      URL.revokeObjectURL(newVideoPreview);
    }

    setExistingVideoUrl("");
    setExternalVideoUrl("");
    setNewVideoFile(file);
    setNewVideoPreview(URL.createObjectURL(file));

    e.target.value = "";
  }

  function removeVideo() {
    setExistingVideoUrl("");
    setExternalVideoUrl("");
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

  async function removeExistingPhoto(index: number) {
    if (!business) return;
    if (!confirm("이 사진을 삭제하시겠습니까?")) return;

    const targetUrl = existingImageUrls[index];
    const nextImageUrls = existingImageUrls.filter((_, i) => i !== index);
    const nextMainImage = nextImageUrls[0] || null;

    try {
      setDeletingPhotoIndex(index);

      const { data: updatedBusiness, error: dbError } = await supabase
        .from("businesses")
        .update({
          image_urls: nextImageUrls,
          image_url: nextMainImage,
        })
        .eq("id", business.id)
        .select("id,image_url,image_urls")
        .maybeSingle();

      if (dbError) throw dbError;

      if (!updatedBusiness) {
        alert("DB에서 이미지가 삭제되지 않았습니다. RLS 권한을 확인하세요.");
        return;
      }

      const storagePath = getBusinessImagePathFromPublicUrl(targetUrl);

      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from("business-images")
          .remove([storagePath]);

        if (storageError) {
          alert(
            "DB에서는 삭제됐지만 Storage 파일 삭제 권한이 없습니다.\nSupabase Storage RLS 정책을 확인하세요.",
          );
        }
      }

      setExistingImageUrls(updatedBusiness.image_urls || []);
      setBusiness({
        ...business,
        image_urls: updatedBusiness.image_urls || [],
        image_url: updatedBusiness.image_url || null,
      });

      alert("이미지가 삭제되었습니다.");
    } catch (err: any) {
      console.error("business image delete error:", err);
      alert(err?.message || "이미지 삭제 오류");
    } finally {
      setDeletingPhotoIndex(null);
    }
  }

  function removeNewPhoto(index: number) {
    setNewPhotoFiles((prev) => prev.filter((_, i) => i !== index));

    setNewPhotoPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleFlipbookAdChange(
    size: FlipbookAdSize,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (!isAdmin) {
      e.target.value = "";
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      e.target.value = "";
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert("광고 이미지는 15MB 이하만 가능합니다.");
      e.target.value = "";
      return;
    }

    const previousPreview = newFlipbookAdPreviews[size];
    if (previousPreview) URL.revokeObjectURL(previousPreview);

    setNewFlipbookAdFiles((prev) => ({ ...prev, [size]: file }));
    setNewFlipbookAdPreviews((prev) => ({
      ...prev,
      [size]: URL.createObjectURL(file),
    }));
    setFlipbookAdEnabled((prev) => ({ ...prev, [size]: true }));
    setRemovedFlipbookAdSizes((prev) => prev.filter((item) => item !== size));
    e.target.value = "";
  }

  function removeFlipbookAdImage(size: FlipbookAdSize) {
    if (!isAdmin) return;

    const preview = newFlipbookAdPreviews[size];
    if (preview) URL.revokeObjectURL(preview);

    setNewFlipbookAdFiles((prev) => {
      const next = { ...prev };
      delete next[size];
      return next;
    });
    setNewFlipbookAdPreviews((prev) => {
      const next = { ...prev };
      delete next[size];
      return next;
    });
    setFlipbookAdEnabled((prev) => ({ ...prev, [size]: false }));
    setRemovedFlipbookAdSizes((prev) =>
      prev.includes(size) ? prev : [...prev, size],
    );
  }

  function toggleFlipbookAdEnabled(size: FlipbookAdSize) {
    const hasImage =
      Boolean(newFlipbookAdFiles[size]) ||
      (Boolean(existingFlipbookAds[size]?.image_url) &&
        !removedFlipbookAdSizes.includes(size));

    if (!hasImage) {
      alert("먼저 해당 사이즈의 광고 이미지를 첨부해 주세요.");
      return;
    }

    setFlipbookAdEnabled((prev) => ({ ...prev, [size]: !prev[size] }));
  }

  async function uploadFlipbookAdImages() {
    const uploaded: Partial<Record<FlipbookAdSize, string>> = {};

    for (const option of flipbookAdOptions) {
      const size = option.size;
      const file = newFlipbookAdFiles[size];
      if (!file) continue;

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `flipbook-ads/${businessId}-${size}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("business-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("business-images")
        .getPublicUrl(fileName);

      uploaded[size] = data.publicUrl;
    }

    return uploaded;
  }

  function minutesToTime(totalMinutes: number) {
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;

    return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  function applyGoogleOpeningHours(
    openingHours?: google.maps.places.PlaceOpeningHours,
  ) {
    const periods = openingHours?.periods;

    if (!periods?.length) return false;

    const googleDayToAppDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const grouped = new Map<
      string,
      google.maps.places.PlaceOpeningHoursPeriod[]
    >();

    for (const period of periods) {
      if (!period.open) continue;
      const day = googleDayToAppDay[period.open.day];
      grouped.set(day, [...(grouped.get(day) || []), period]);
    }

    const importedHours = defaultHours.map((fallback) => {
      const dayPeriods = (grouped.get(fallback.day) || []).sort((a, b) =>
        (a.open?.time || "").localeCompare(b.open?.time || ""),
      );

      if (dayPeriods.length === 0) {
        return { ...fallback, closed: true, hasBreak: false };
      }

      const first = dayPeriods[0];
      const second = dayPeriods[1];
      const openMinutes =
        Number(first.open?.hours || 0) * 60 + Number(first.open?.minutes || 0);
      const closeMinutes = first.close
        ? Number(first.close.hours || 0) * 60 + Number(first.close.minutes || 0)
        : 23 * 60 + 30;
      const nextOpenMinutes = second
        ? Number(second.open?.hours || 0) * 60 +
          Number(second.open?.minutes || 0)
        : 0;
      const finalCloseMinutes = second?.close
        ? Number(second.close.hours || 0) * 60 +
          Number(second.close.minutes || 0)
        : closeMinutes;

      return {
        day: fallback.day,
        open: minutesToTime(openMinutes),
        close: minutesToTime(second ? finalCloseMinutes : closeMinutes),
        closed: false,
        hasBreak: !!second && !!first.close,
        breakStart: first.close
          ? minutesToTime(
              Number(first.close.hours || 0) * 60 +
                Number(first.close.minutes || 0),
            )
          : fallback.breakStart,
        breakEnd: second ? minutesToTime(nextOpenMinutes) : fallback.breakEnd,
      };
    });

    // 기존 DB 영업시간을 Google 영업시간으로 즉시 교체합니다.
    setDayHours(importedHours);
    return true;
  }

  function normalizeBusinessName(value: string) {
    return value
      .split("|")[0]
      .split("—")[0]
      .split("-")[0]
      .replace(/\b(korean|restaurant|bbq|cary|nc|north carolina)\b/gi, " ")
      .replace(/[^a-z0-9가-힣]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function placeDistanceMeters(
    a: google.maps.LatLng | google.maps.LatLngLiteral,
    b?: google.maps.LatLng,
  ) {
    if (!b) return Number.MAX_SAFE_INTEGER;

    const aLat =
      typeof (a as google.maps.LatLng).lat === "function"
        ? (a as google.maps.LatLng).lat()
        : (a as google.maps.LatLngLiteral).lat;
    const aLng =
      typeof (a as google.maps.LatLng).lng === "function"
        ? (a as google.maps.LatLng).lng()
        : (a as google.maps.LatLngLiteral).lng;

    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRad(b.lat() - aLat);
    const dLng = toRad(b.lng() - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(b.lat());
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return 2 * earthRadius * Math.asin(Math.sqrt(h));
  }

  function normalizeAddress(value: string) {
    return value
      .toLowerCase()
      .replace(/\bnorth carolina\b/g, "nc")
      .replace(/\broad\b/g, "rd")
      .replace(/\bstreet\b/g, "st")
      .replace(/\bavenue\b/g, "ave")
      .replace(/\bboulevard\b/g, "blvd")
      .replace(/\bdrive\b/g, "dr")
      .replace(/\blane\b/g, "ln")
      .replace(/\bhighway\b/g, "hwy")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getHouseNumber(value: string) {
    return normalizeAddress(value).match(/^\d+/)?.[0] || "";
  }

  function hasStrongNameMatch(target: string, candidate: string) {
    const targetWords = normalizeBusinessName(target)
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 2);
    const candidateWords = normalizeBusinessName(candidate)
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 2);

    if (!targetWords.length || !candidateWords.length) return false;

    const targetText = targetWords.join(" ");
    const candidateText = candidateWords.join(" ");

    if (targetText === candidateText) return true;
    if (targetText.length >= 4 && candidateText.includes(targetText)) return true;
    if (candidateText.length >= 4 && targetText.includes(candidateText)) return true;

    const matchedWords = targetWords.filter((word) =>
      candidateWords.includes(word),
    ).length;

    return matchedWords / targetWords.length >= 0.75;
  }

  function hasStrongAddressMatch(
    targetAddress: string,
    candidateAddress: string,
  ) {
    const target = normalizeAddress(targetAddress);
    const candidate = normalizeAddress(candidateAddress);
    const targetHouseNumber = getHouseNumber(targetAddress);
    const candidateHouseNumber = getHouseNumber(candidateAddress);

    if (
      targetHouseNumber &&
      candidateHouseNumber &&
      targetHouseNumber !== candidateHouseNumber
    ) {
      return false;
    }

    const ignored = new Set(["usa", "united", "states", "nc"]);
    const targetWords = target
      .split(/\s+/)
      .filter(
        (word) =>
          word.length >= 3 &&
          !ignored.has(word) &&
          word !== targetHouseNumber,
      );

    const matchedWords = targetWords.filter((word) =>
      candidate.includes(word),
    ).length;

    return matchedWords >= Math.min(3, Math.max(1, targetWords.length));
  }

  async function findGoogleBusinessHours(
    businessName: string,
    businessAddress: string,
    location?: google.maps.LatLng | google.maps.LatLngLiteral,
  ): Promise<{ found: boolean; matchedName?: string }> {
    if (
      !window.google?.maps?.places ||
      !businessName.trim() ||
      !businessAddress.trim()
    ) {
      return { found: false };
    }

    const service = new google.maps.places.PlacesService(
      document.createElement("div"),
    );
    const cleanName =
      normalizeBusinessName(businessName) || businessName.trim();
    const collected: google.maps.places.PlaceResult[] = [];

    if (location) {
      const nearby = await new Promise<google.maps.places.PlaceResult[]>(
        (resolve) => {
          service.nearbySearch(
            {
              location,
              radius: 500,
              keyword: cleanName,
            },
            (results, status) => {
              resolve(
                status === google.maps.places.PlacesServiceStatus.OK && results
                  ? results
                  : [],
              );
            },
          );
        },
      );

      collected.push(...nearby);
    }

    const textResults = await new Promise<google.maps.places.PlaceResult[]>(
      (resolve) => {
        service.textSearch(
          {
            query: `${cleanName}, ${businessAddress}`,
            ...(location ? { location, radius: 1000 } : {}),
          },
          (results, status) => {
            resolve(
              status === google.maps.places.PlacesServiceStatus.OK && results
                ? results
                : [],
            );
          },
        );
      },
    );

    collected.push(...textResults);

    const unique = new Map<string, google.maps.places.PlaceResult>();

    for (const item of collected) {
      if (item.place_id) unique.set(item.place_id, item);
    }

    const validCandidates = [...unique.values()]
      .filter((item) => {
        const candidateName = String(item.name || "");
        const candidateAddress = String(
          item.formatted_address || item.vicinity || "",
        );
        const nameMatches = hasStrongNameMatch(cleanName, candidateName);
        const addressMatches = hasStrongAddressMatch(
          businessAddress,
          candidateAddress,
        );
        const distance = location
          ? placeDistanceMeters(location, item.geometry?.location)
          : 0;

        return nameMatches && addressMatches && (!location || distance <= 250);
      })
      .sort((a, b) => {
        if (!location) return 0;

        return (
          placeDistanceMeters(location, a.geometry?.location) -
          placeDistanceMeters(location, b.geometry?.location)
        );
      });

    if (!validCandidates.length) {
      console.warn("No exact Google business match:", {
        businessName,
        cleanName,
        businessAddress,
      });
      return { found: false };
    }

    for (const item of validCandidates.slice(0, 3)) {
      if (!item.place_id) continue;

      const details = await new Promise<google.maps.places.PlaceResult | null>(
        (resolve) => {
          service.getDetails(
            {
              placeId: item.place_id!,
              fields: [
                "place_id",
                "name",
                "formatted_address",
                "geometry",
                "opening_hours",
                "business_status",
              ],
            },
            (place, status) => {
              resolve(
                status === google.maps.places.PlacesServiceStatus.OK && place
                  ? place
                  : null,
              );
            },
          );
        },
      );

      if (!details) continue;

      const exactName = hasStrongNameMatch(cleanName, details.name || "");
      const exactAddress = hasStrongAddressMatch(
        businessAddress,
        details.formatted_address || "",
      );
      const exactDistance = location
        ? placeDistanceMeters(location, details.geometry?.location)
        : 0;

      if (
        exactName &&
        exactAddress &&
        (!location || exactDistance <= 250) &&
        details.opening_hours?.periods?.length &&
        applyGoogleOpeningHours(details.opening_hours)
      ) {
        return {
          found: true,
          matchedName: details.name || cleanName,
        };
      }
    }

    return { found: false };
  }

  async function lookupAndApplyGoogleHours(
    businessName = name,
    businessAddress = address,
    location?: google.maps.LatLng | google.maps.LatLngLiteral,
    automatic = false,
  ) {
    if (!businessName.trim() || !businessAddress.trim()) {
      setGoogleHoursStatus("not_found");
      setGoogleHoursMessage("업체명과 주소가 필요합니다.");
      return;
    }

    setSearchingGoogleHours(true);
    setGoogleHoursStatus("searching");
    setGoogleHoursMessage(
      automatic
        ? "Google에서 최신 영업시간을 자동으로 확인하고 있습니다."
        : "Google에서 최신 영업시간을 찾고 있습니다.",
    );

    try {
      const resolvedLocation =
        location ||
        (selectedLat && selectedLng
          ? { lat: selectedLat, lng: selectedLng }
          : undefined);
      const result = await findGoogleBusinessHours(
        businessName,
        businessAddress,
        resolvedLocation,
      );

      if (result.found) {
        setGoogleHoursStatus("found");
        setGoogleHoursMessage(
          `✓ ${result.matchedName || businessName}의 Google 영업시간으로 교체했습니다.`,
        );
      } else {
        setGoogleHoursStatus("not_found");
        setGoogleHoursMessage(
          "Google에 등록된 영업시간이 없습니다. 기존 시간을 유지하거나 직접 수정해 주세요.",
        );
      }
    } catch (error) {
      console.error("Google business hours lookup error:", error);
      setGoogleHoursStatus("error");
      setGoogleHoursMessage(
        "Google 영업시간을 가져오는 중 오류가 발생했습니다. 기존 시간을 유지합니다.",
      );
    } finally {
      setSearchingGoogleHours(false);
    }
  }

  function toggleCategory(categoryName: string) {
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((item) => item !== categoryName)
        : [...prev, categoryName],
    );
  }

  function updateDayHour(
    index: number,
    field: keyof DayHour,
    value: string | boolean,
  ) {
    setDayHours((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
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

    if (newVideoFile && externalVideoUrl.trim()) {
      alert("동영상은 첨부 또는 링크 중 하나만 가능합니다.");
      return;
    }

    if (externalVideoUrl.trim() && !isAllowedVideoUrl(externalVideoUrl)) {
      alert("YouTube, Facebook, Instagram video link only.");
      return;
    }

    setSaving(true);

    let uploadedUrls: string[] = [];
    let uploadedVideoUrl = "";
    let uploadedAdUrls: Partial<Record<FlipbookAdSize, string>> = {};

    try {
      uploadedUrls = await uploadNewPhotos();
      uploadedVideoUrl = await uploadVideo();

      if (isAdmin) {
        uploadedAdUrls = await uploadFlipbookAdImages();
      }
    } catch (error: any) {
      setSaving(false);
      alert("Save error: " + error.message);
      return;
    }

    const finalImageUrls = [...existingImageUrls, ...uploadedUrls].slice(0, 6);
    const cleanExternalVideoUrl = externalVideoUrl.trim();

    const finalUploadedVideoUrl =
      uploadedVideoUrl ||
      (existingVideoUrl && !isExternalVideoUrl(existingVideoUrl)
        ? existingVideoUrl
        : "");

    const finalExternalVideoUrl = finalUploadedVideoUrl
      ? null
      : cleanExternalVideoUrl
        ? cleanExternalVideoUrl
        : existingVideoUrl && isExternalVideoUrl(existingVideoUrl)
          ? existingVideoUrl
          : null;

    const updatePayload: Record<string, any> = {
      name,
      address,
      phone,
      category: selectedCategories.join(", "),
      hours: formatBusinessHours(),
      description,
      tags,
      website_url: websiteUrl,
      instagram_url: instagramUrl,
      image_url: finalImageUrls[0] || null,
      image_urls: finalImageUrls,
      video_urls: finalUploadedVideoUrl ? [finalUploadedVideoUrl] : [],
      external_video_url: finalExternalVideoUrl,
      lat: selectedLat,
      lng: selectedLng,
    };

    const { error } = await supabase
      .from("businesses")
      .update(updatePayload)
      .eq("id", business.id);

    if (error) {
      setSaving(false);
      alert(error.message);
      return;
    }

    if (isAdmin) {
      for (const size of removedFlipbookAdSizes) {
        const { error: deleteError } = await supabase
          .from("business_flipbook_ads")
          .delete()
          .eq("business_id", business.id)
          .eq("ad_size", size);

        if (deleteError) {
          setSaving(false);
          alert("광고 삭제 오류: " + deleteError.message);
          return;
        }
      }

      const adRows: Array<{
        business_id: number;
        ad_size: FlipbookAdSize;
        image_url: string;
        enabled: boolean;
        priority: number;
      }> = [];

      for (const option of flipbookAdOptions) {
        const size = option.size;

        if (removedFlipbookAdSizes.includes(size)) continue;

        const imageUrl =
          uploadedAdUrls[size] || existingFlipbookAds[size]?.image_url || "";

        if (!imageUrl) continue;

        adRows.push({
          business_id: business.id,
          ad_size: size,
          image_url: imageUrl,
          enabled: flipbookAdEnabled[size],
          priority: Math.max(
            0,
            Math.min(1000, Number(flipbookPriorities[size] || 0)),
          ),
        });
      }

      if (adRows.length > 0) {
        const { error: adError } = await supabase
          .from("business_flipbook_ads")
          .upsert(adRows, { onConflict: "business_id,ad_size" });

        if (adError) {
          setSaving(false);
          alert("광고 저장 오류: " + adError.message);
          return;
        }
      }
    }

    setSaving(false);
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

                    const formattedAddress =
                      place.formatted_address || place.name || "";
                    const location = place.geometry?.location;
                    const lat = location?.lat() || null;
                    const lng = location?.lng() || null;

                    setAddress(formattedAddress);
                    setSelectedLat(lat);
                    setSelectedLng(lng);

                    const selectedPlaceMatches =
                      !!place.name &&
                      hasStrongNameMatch(name, place.name) &&
                      hasStrongAddressMatch(
                        formattedAddress,
                        place.formatted_address || formattedAddress,
                      );

                    if (
                      selectedPlaceMatches &&
                      place.opening_hours?.periods?.length
                    ) {
                      applyGoogleOpeningHours(place.opening_hours);
                      setGoogleHoursStatus("found");
                      setGoogleHoursMessage(
                        `✓ ${place.name}의 Google 영업시간으로 교체했습니다.`,
                      );
                    } else {
                      void lookupAndApplyGoogleHours(
                        name,
                        formattedAddress,
                        location || undefined,
                      );
                    }
                  }}
                  options={{
                    componentRestrictions: { country: "us" },
                    fields: [
                      "place_id",
                      "name",
                      "formatted_address",
                      "geometry",
                      "opening_hours",
                    ],
                  }}
                >
                  <input
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setSelectedLat(null);
                      setSelectedLng(null);
                      setGoogleHoursStatus("idle");
                      setGoogleHoursMessage("");
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
                  <input
                    value={selectedLat}
                    readOnly
                    className="w-full rounded-xl border bg-green-50 px-3 py-3 text-sm font-bold text-green-700"
                  />

                  <input
                    value={selectedLng}
                    readOnly
                    className="w-full rounded-xl border bg-green-50 px-3 py-3 text-sm font-bold text-green-700"
                  />
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
              <div className="mb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">Business Hours</p>
                    {googleHoursMessage && (
                      <p
                        className={`mt-1 text-xs font-bold ${
                          googleHoursStatus === "found"
                            ? "text-green-700"
                            : googleHoursStatus === "not_found" ||
                                googleHoursStatus === "error"
                              ? "text-red-600"
                              : "text-gray-500"
                        }`}
                      >
                        {googleHoursMessage}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void lookupAndApplyGoogleHours()}
                    disabled={searchingGoogleHours || !isLoaded}
                    className="shrink-0 rounded-xl border bg-white px-3 py-2 text-xs font-black disabled:opacity-50"
                  >
                    {searchingGoogleHours
                      ? "찾는 중..."
                      : googleHoursStatus === "found"
                        ? "Google 시간 다시 불러오기"
                        : "Google 영업시간 찾기"}
                  </button>
                </div>

                <p className="text-[11px] font-bold leading-5 text-gray-500">
                  Google 영업시간을 찾으면 아래에 저장되어 있던 시간을 즉시
                  Google 시간으로 교체합니다. 필요하면 교체된 시간을 직접 수정할
                  수 있습니다.
                </p>
              </div>

              <div className="space-y-4">
                {dayHours.map((item, index) => (
                  <div
                    key={item.day}
                    className="rounded-xl border bg-white p-3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-bold">{item.day}</span>

                      <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                        <input
                          type="checkbox"
                          checked={item.closed}
                          onChange={(e) =>
                            updateDayHour(index, "closed", e.target.checked)
                          }
                          className="h-4 w-4"
                        />
                        Closed
                      </label>
                    </div>

                    {!item.closed && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="mb-1 text-xs font-black text-gray-500">
                              Open
                            </p>
                            <select
                              value={item.open}
                              onChange={(e) =>
                                updateDayHour(index, "open", e.target.value)
                              }
                              className="w-full rounded-xl border bg-gray-50 px-3 py-3 text-sm font-bold"
                            >
                              {timeOptions.map((time) => (
                                <option key={time} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <p className="mb-1 text-xs font-black text-gray-500">
                              Close
                            </p>
                            <select
                              value={item.close}
                              onChange={(e) =>
                                updateDayHour(index, "close", e.target.value)
                              }
                              className="w-full rounded-xl border bg-gray-50 px-3 py-3 text-sm font-bold"
                            >
                              {timeOptions.map((time) => (
                                <option key={time} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                          <input
                            type="checkbox"
                            checked={item.hasBreak}
                            onChange={(e) =>
                              updateDayHour(index, "hasBreak", e.target.checked)
                            }
                            className="h-4 w-4"
                          />
                          Break Time
                        </label>

                        {item.hasBreak && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="mb-1 text-xs font-black text-gray-500">
                                Break Start
                              </p>
                              <select
                                value={item.breakStart}
                                onChange={(e) =>
                                  updateDayHour(
                                    index,
                                    "breakStart",
                                    e.target.value,
                                  )
                                }
                                className="w-full rounded-xl border bg-gray-50 px-3 py-3 text-sm font-bold"
                              >
                                {timeOptions.map((time) => (
                                  <option key={time} value={time}>
                                    {time}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <p className="mb-1 text-xs font-black text-gray-500">
                                Break End
                              </p>
                              <select
                                value={item.breakEnd}
                                onChange={(e) =>
                                  updateDayHour(
                                    index,
                                    "breakEnd",
                                    e.target.value,
                                  )
                                }
                                className="w-full rounded-xl border bg-gray-50 px-3 py-3 text-sm font-bold"
                              >
                                {timeOptions.map((time) => (
                                  <option key={time} value={time}>
                                    {time}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-gray-50 p-4">
              <p className="mb-3 font-black">Categories</p>

              {categories.length === 0 ? (
                <p className="text-sm font-bold text-gray-500">
                  No categories found.
                </p>
              ) : (
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
              )}
            </div>

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
                  className="shrink-0 rounded-xl bg-[#172033] px-4 py-2 text-sm font-semibold text-white"
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
                      disabled={deletingPhotoIndex === index}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white shadow disabled:opacity-50"
                    >
                      {deletingPhotoIndex === index ? "…" : "×"}
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

            {isAdmin && (
              <div className="space-y-4 rounded-2xl border-2 border-[#C4483A]/30 bg-[#FFF5F2] p-4">
                <div>
                  <p className="font-black text-[#172033]">
                    Flipbook Advertisement
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#6B6257]">
                    사이즈별 이미지를 각각 등록할 수 있습니다. 체크된 광고만
                    플립페이지에 표시됩니다.
                  </p>
                </div>

                {flipbookAdOptions.map((option) => {
                  const size = option.size;
                  const existingUrl = removedFlipbookAdSizes.includes(size)
                    ? ""
                    : existingFlipbookAds[size]?.image_url || "";
                  const preview = newFlipbookAdPreviews[size] || existingUrl;
                  const hasImage = Boolean(preview);
                  const checked = flipbookAdEnabled[size];

                  return (
                    <div
                      key={size}
                      className="space-y-3 rounded-2xl border bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!hasImage}
                            onChange={() => toggleFlipbookAdEnabled(size)}
                            className="mt-1 h-5 w-5"
                          />
                          <span>
                            <span className="block text-sm font-black">
                              {option.label} — {option.description}
                            </span>
                            <span className="mt-1 block text-xs font-bold text-gray-500">
                              권장 이미지 크기: {option.recommendedSize}
                            </span>
                          </span>
                        </label>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                            checked
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {checked ? "표시" : "숨김"}
                        </span>
                      </div>

                      <input
                        id={`edit-flipbook-ad-${size}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFlipbookAdChange(size, e)}
                        className="hidden"
                      />

                      {preview ? (
                        <div className="space-y-3">
                          <div className="overflow-hidden rounded-xl border bg-gray-50">
                            <img
                              src={preview}
                              alt={`Flipbook advertisement size ${size}`}
                              className="max-h-[360px] w-full object-contain"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <label
                              htmlFor={`edit-flipbook-ad-${size}`}
                              className="cursor-pointer rounded-xl bg-[#172033] px-4 py-3 text-center text-sm font-black text-white"
                            >
                              이미지 변경
                            </label>
                            <button
                              type="button"
                              onClick={() => removeFlipbookAdImage(size)}
                              className="rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white"
                            >
                              이미지 삭제
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label
                          htmlFor={`edit-flipbook-ad-${size}`}
                          className="block cursor-pointer rounded-xl bg-[#C4483A] px-4 py-3 text-center text-sm font-black text-white"
                        >
                          Size {size} 광고 이미지 첨부
                        </label>
                      )}

                      <div>
                        <label className="mb-1 block text-xs font-black text-gray-500">
                          Display Priority
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={1000}
                          value={flipbookPriorities[size]}
                          onChange={(e) =>
                            setFlipbookPriorities((prev) => ({
                              ...prev,
                              [size]: Math.max(
                                0,
                                Math.min(1000, Number(e.target.value || 0)),
                              ),
                            }))
                          }
                          className="w-full rounded-xl border bg-gray-50 px-3 py-3 text-sm font-bold"
                        />
                      </div>
                    </div>
                  );
                })}

                <p className="text-[11px] font-bold leading-5 text-[#6B6257]">
                  각 이미지 최대 15MB입니다. 이미지가 없는 광고는 체크할 수
                  없습니다.
                </p>
              </div>
            )}

            <div className="space-y-3 rounded-2xl border bg-gray-50 p-4">
              <p className="font-black">Business Video</p>

              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="hidden"
              />

              {!existingVideoUrl && !newVideoPreview ? (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={!!externalVideoUrl.trim()}
                  className="w-full rounded-xl bg-[#172033] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
                >
                  영상첨부
                </button>
              ) : (
                <div className="space-y-2">
                  <video
                    src={newVideoPreview || existingVideoUrl}
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

              <div className="relative flex items-center justify-center py-1">
                <div className="h-px w-full bg-gray-200" />
                <span className="absolute bg-gray-50 px-3 text-xs font-black text-gray-400">
                  OR
                </span>
              </div>

              <input
                value={externalVideoUrl}
                onChange={(e) => {
                  setExternalVideoUrl(e.target.value);
                  if (e.target.value.trim()) {
                    setExistingVideoUrl("");
                    setNewVideoFile(null);
                    if (newVideoPreview) URL.revokeObjectURL(newVideoPreview);
                    setNewVideoPreview("");
                  }
                }}
                disabled={!!newVideoFile || !!existingVideoUrl}
                placeholder="YouTube / Facebook / Instagram video link"
                className="w-full rounded-xl border bg-white px-4 py-3 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>

            <div className="space-y-3 rounded-2xl border bg-gray-50 p-4">
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
              className="w-full rounded-xl bg-[#172033] py-3 text-sm font-semibold text-white disabled:opacity-60"
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