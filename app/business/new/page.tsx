"use client";

import { useEffect, useRef, useState } from "react";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";
import BottomNav from "../../components/BottomNav";

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


type FlipbookAdSize = 1 | 2 | 3 | 4 | 5;

type FlipbookAdItem = {
  size: FlipbookAdSize;
  label: string;
  description: string;
  recommendedSize: string;
};

const flipbookAdOptions: FlipbookAdItem[] = [
  {
    size: 1,
    label: "Size 1",
    description: "전체면 100%",
    recommendedSize: "1080 × 1527 px",
  },
  {
    size: 2,
    label: "Size 2",
    description: "반면 50%",
    recommendedSize: "1080 × 764 px",
  },
  {
    size: 3,
    label: "Size 3",
    description: "1/4면 25%",
    recommendedSize: "540 × 764 px",
  },
  {
    size: 4,
    label: "Size 4",
    description: "1/6면",
    recommendedSize: "540 × 509 px",
  },
  
  {
    size: 5,
    label: "Size 5",
    description: "1/12면",
    recommendedSize: "540 × 255 px",
  },
  
  
];

const googleLibraries: "places"[] = ["places"];

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

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const weekendDays = ["Sat", "Sun"];
const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

async function optimizeImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82,
): Promise<File> {
  // Animated GIFs and SVG files should not be converted because conversion
  // would remove animation or vector information.
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  let source: ImageBitmap | HTMLImageElement | null = null;
  let objectUrl = "";

  try {
    if ("createImageBitmap" in window) {
      source = await createImageBitmap(file);
    } else {
      objectUrl = URL.createObjectURL(file);
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not read image."));
        image.src = objectUrl;
      });
    }

    if (!source) return file;

    const originalWidth = source.width;
    const originalHeight = source.height;
    const scale = Math.min(
      1,
      maxWidth / originalWidth,
      maxHeight / originalHeight,
    );

    const targetWidth = Math.max(1, Math.round(originalWidth * scale));
    const targetHeight = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.drawImage(source, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });

    // JPG/PNG 등 일반 이미지는 원본보다 WebP가 조금 커지더라도
    // 항상 WebP 파일로 저장합니다. 그래야 Storage에 원본 확장자가
    // 섞여 올라가는 문제를 막을 수 있습니다.
    if (!blob) {
      throw new Error("WebP conversion failed.");
    }

    const baseName = file.name.replace(/\.[^/.]+$/, "") || "image";
    const optimizedFile = new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });

    console.log("Image optimized:", {
      originalName: file.name,
      originalSize: file.size,
      optimizedName: optimizedFile.name,
      optimizedSize: optimizedFile.size,
      originalDimensions: `${originalWidth}x${originalHeight}`,
      optimizedDimensions: `${targetWidth}x${targetHeight}`,
    });

    return optimizedFile;
  } catch (error) {
    console.warn("Image optimization skipped:", error);
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);

    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      source.close();
    }
  }
}


async function createBusinessThumbnail(file: File): Promise<Blob> {
  const targetWidth = 480;
  const targetHeight = 360;

  let source: ImageBitmap | HTMLImageElement | null = null;
  let objectUrl = "";

  try {
    if ("createImageBitmap" in window) {
      source = await createImageBitmap(file);
    } else {
      objectUrl = URL.createObjectURL(file);

      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
          reject(new Error("Could not read the thumbnail source image."));
        image.src = objectUrl;
      });
    }

    if (!source) {
      throw new Error("Thumbnail source image is unavailable.");
    }

    const sourceWidth = source.width;
    const sourceHeight = source.height;

    /*
     * 480 × 360 영역을 빈 공간 없이 채우는 cover 방식입니다.
     * 중앙을 기준으로 필요한 부분만 잘라 썸네일을 만듭니다.
     */
    const scale = Math.max(
      targetWidth / sourceWidth,
      targetHeight / sourceHeight,
    );

    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const offsetX = (targetWidth - drawWidth) / 2;
    const offsetY = (targetHeight - drawHeight) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create the thumbnail canvas.");
    }

    context.drawImage(
      source,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight,
    );

    const thumbnailBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.76);
    });

    if (!thumbnailBlob) {
      throw new Error("Thumbnail WebP conversion failed.");
    }

    return thumbnailBlob;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    if (
      typeof ImageBitmap !== "undefined" &&
      source instanceof ImageBitmap
    ) {
      source.close();
    }
  }
}

export default function NewBusinessPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
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
  const [ownerPhone, setOwnerPhone] = useState("");
  const [dayHours, setDayHours] = useState<DayHour[]>(defaultHours);
  const [hoursSource, setHoursSource] = useState<"google" | "manual" | "none">(
    "none",
  );
  const [googleHoursMessage, setGoogleHoursMessage] = useState("");
  const [searchingGoogleHours, setSearchingGoogleHours] = useState(false);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [externalVideoUrl, setExternalVideoUrl] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  // 각 사진이 웹사이트 자동 이미지 슬라이드에 사용되는지 저장합니다.
  // 새 사진은 기본적으로 슬라이드에 사용하지 않습니다.
  const [photoSliderEnabled, setPhotoSliderEnabled] = useState<boolean[]>([]);

  const [flipbookAdFiles, setFlipbookAdFiles] = useState<
    Partial<Record<FlipbookAdSize, File>>
  >({});

  const [flipbookAdPreviews, setFlipbookAdPreviews] = useState<
    Partial<Record<FlipbookAdSize, string>>
  >({});

  const [flipbookAdEnabled, setFlipbookAdEnabled] = useState<
    Record<FlipbookAdSize, boolean>
  >({
    1: false,
    2: false,
    3: false,
    4: false,
	5:false,
  });

  const [bulkDays, setBulkDays] = useState<string[]>(weekDays);
  const [bulkOpen, setBulkOpen] = useState("10:00 AM");
  const [bulkClose, setBulkClose] = useState("9:00 PM");
  const [bulkClosed, setBulkClosed] = useState(false);
  const [bulkHasBreak, setBulkHasBreak] = useState(false);
  const [bulkBreakStart, setBulkBreakStart] = useState("3:00 PM");
  const [bulkBreakEnd, setBulkBreakEnd] = useState("5:00 PM");

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

    if (externalVideoUrl.trim()) {
      alert(
        "동영상은 업로드 또는 링크 중 하나만 가능합니다. 링크를 지운 후 업로드하세요.",
      );
      e.target.value = "";
      return;
    }

    if (videoPreview) URL.revokeObjectURL(videoPreview);
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
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
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

    // 사용자가 Google에서 선택한 주소를 다시 수정하면 이전 Google 영업시간이
    // 그대로 남아 있지 않도록 검색 상태를 초기화합니다.
    if (hoursSource === "google") {
      setHoursSource("none");
      setGoogleHoursMessage(
        "주소를 수정했습니다. Google 추천 목록에서 업체 또는 주소를 다시 선택해 주세요.",
      );
    }

    const match = value.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/);

    if (match) {
      setLat(match[1]);
      setLng(match[3]);
    }
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

    if (!periods || periods.length === 0) {
      setHoursSource("manual");
      setGoogleHoursMessage(
        "Google에 등록된 영업시간이 없습니다. 직접 입력해 주세요.",
      );
      setDayHours(defaultHours.map((item) => ({ ...item })));
      return;
    }

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

      // 24-hour businesses may not include a close value.
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

    setDayHours(importedHours);
    setHoursSource("google");
    setGoogleHoursMessage("Google에 등록된 영업시간을 불러왔습니다.");
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

  function hasStrongAddressMatch(targetAddress: string, candidateAddress: string) {
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
  ): Promise<boolean> {
    if (!window.google?.maps?.places || !businessName.trim()) return false;

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
      return false;
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
        details.opening_hours?.periods?.length
      ) {
        applyGoogleOpeningHours(details.opening_hours);
        setGoogleHoursMessage(
          `${details.name || cleanName}의 Google 영업시간을 불러왔습니다.`,
        );
        console.log("Matched Google business:", {
          placeId: details.place_id,
          name: details.name,
          address: details.formatted_address,
          periodsCount: details.opening_hours.periods.length,
        });
        return true;
      }
    }

    return false;
  }

  async function searchGoogleHoursManually() {
    if (!name.trim()) {
      setHoursSource("manual");
      setGoogleHoursMessage("업체명을 먼저 입력해 주세요.");
      return;
    }

    if (!address.trim()) {
      setHoursSource("manual");
      setGoogleHoursMessage("주소를 먼저 입력해 주세요.");
      return;
    }

    setSearchingGoogleHours(true);
    setHoursSource("none");
    setGoogleHoursMessage("Google에서 업체 영업시간을 다시 찾고 있습니다.");

    try {
      const location =
        lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined;

      const found = await findGoogleBusinessHours(name, address, location);

      if (!found) {
        setHoursSource("manual");
        setDayHours(defaultHours.map((item) => ({ ...item })));
        setGoogleHoursMessage(
          "Google에 등록된 영업시간이 없습니다. 아래에서 직접 입력해 주세요.",
        );
      }
    } catch (error) {
      console.error("Google hours manual search error:", error);
      setHoursSource("manual");
      setGoogleHoursMessage(
        "Google 영업시간 검색 중 오류가 발생했습니다. 직접 입력해 주세요.",
      );
    } finally {
      setSearchingGoogleHours(false);
    }
  }

  async function handlePlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    const location = place?.geometry?.location;

    if (!place || !location) return;

    const selectedAddress = place.formatted_address || place.name || "";

    setAddress(selectedAddress);
    setLat(String(location.lat()));
    setLng(String(location.lng()));
    setSearchingGoogleHours(true);
    setHoursSource("none");
    setGoogleHoursMessage("Google에서 업체 영업시간을 확인하고 있습니다.");

    try {
      // 사용자가 자동완성에서 업체 자체를 선택한 경우에는 해당 Place의
      // opening_hours를 우선 사용합니다.
      if (place.opening_hours?.periods?.length) {
        applyGoogleOpeningHours(place.opening_hours);
        setGoogleHoursMessage(
          `${place.name || name || "선택한 업체"}의 Google 영업시간을 불러왔습니다.`,
        );
        return;
      }

      // 주소 Place에는 영업시간이 없을 수 있으므로 업체명 + 주소로 실제
      // 비즈니스 Place를 다시 찾아 상세 영업시간을 가져옵니다.
      const found = await findGoogleBusinessHours(
        name,
        selectedAddress,
        location,
      );

      if (!found) {
        setHoursSource("manual");
        setDayHours(defaultHours.map((item) => ({ ...item })));

        if (!name.trim()) {
          setGoogleHoursMessage(
            "업체명을 먼저 입력한 뒤 Google 추천 목록에서 주소를 다시 선택해 주세요. 찾지 못하면 직접 입력할 수 있습니다.",
          );
        } else {
          setGoogleHoursMessage(
            "Google에 등록된 영업시간이 없습니다. 아래에서 직접 입력해 주세요.",
          );
        }
      }
    } catch (error) {
      console.error("Google business hours lookup error:", error);
      setHoursSource("manual");
      setDayHours(defaultHours.map((item) => ({ ...item })));
      setGoogleHoursMessage(
        "Google 영업시간을 불러오는 중 오류가 발생했습니다. 직접 입력해 주세요.",
      );
    } finally {
      setSearchingGoogleHours(false);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
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

    const selectedFiles = imageFiles.slice(0, remainCount);
    e.target.value = "";

    // Resize and compress before the files are uploaded to Supabase.
    const optimizedFiles = await Promise.all(
      selectedFiles.map((file) => optimizeImage(file, 1200, 1200, 0.75)),
    );

    setPhotoFiles((prev) => [...prev, ...optimizedFiles]);
    setPhotoPreviews((prev) => [
      ...prev,
      ...optimizedFiles.map((file) => URL.createObjectURL(file)),
    ]);
    setPhotoSliderEnabled((prev) => [
      ...prev,
      ...optimizedFiles.map(() => false),
    ]);
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));

    setPhotoPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });

    setPhotoSliderEnabled((prev) =>
      prev.filter((_, i) => i !== index),
    );
  }

  function togglePhotoSlider(index: number) {
    setPhotoSliderEnabled((prev) =>
      prev.map((enabled, i) => (i === index ? !enabled : enabled)),
    );
  }

  async function handleFlipbookAdChange(
    size: FlipbookAdSize,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (role !== "admin") {
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

    const maxSize = 15 * 1024 * 1024;

    if (file.size > maxSize) {
      alert("광고 이미지는 15MB 이하로 올려주세요.");
      e.target.value = "";
      return;
    }

    e.target.value = "";

    const sizeSettings: Record<
      FlipbookAdSize,
      { maxWidth: number; maxHeight: number }
    > = {
      1: { maxWidth: 1080, maxHeight: 1527 },
      2: { maxWidth: 1080, maxHeight: 764 },
      3: { maxWidth: 540, maxHeight: 764 },
      4: { maxWidth: 540, maxHeight: 509 },
	  5:{maxWidth:540,maxHeight:255},
    };

    const setting = sizeSettings[size];
    const optimizedFile = await optimizeImage(
      file,
      setting.maxWidth,
      setting.maxHeight,
      0.82,
    );

    const previousPreview = flipbookAdPreviews[size];

    if (previousPreview) {
      URL.revokeObjectURL(previousPreview);
    }

    setFlipbookAdFiles((prev) => ({
      ...prev,
      [size]: optimizedFile,
    }));

    setFlipbookAdPreviews((prev) => ({
      ...prev,
      [size]: URL.createObjectURL(optimizedFile),
    }));

    setFlipbookAdEnabled((prev) => ({
      ...prev,
      [size]: true,
    }));
  }

  function removeFlipbookAd(size: FlipbookAdSize) {
    const preview = flipbookAdPreviews[size];

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFlipbookAdFiles((prev) => {
      const next = { ...prev };
      delete next[size];
      return next;
    });

    setFlipbookAdPreviews((prev) => {
      const next = { ...prev };
      delete next[size];
      return next;
    });

    setFlipbookAdEnabled((prev) => ({
      ...prev,
      [size]: false,
    }));
  }

  function toggleFlipbookAdEnabled(size: FlipbookAdSize) {
    if (!flipbookAdFiles[size]) {
      alert("먼저 해당 사이즈의 광고 이미지를 첨부해 주세요.");
      return;
    }

    setFlipbookAdEnabled((prev) => ({
      ...prev,
      [size]: !prev[size],
    }));
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

  function toggleBulkDay(day: string) {
    setBulkDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day],
    );
  }

  function applyHoursToDays(days = bulkDays) {
    if (days.length === 0) {
      alert("Please select at least one day.");
      return;
    }

    setDayHours((prev) =>
      prev.map((item) =>
        days.includes(item.day)
          ? {
              ...item,
              open: bulkOpen,
              close: bulkClose,
              closed: bulkClosed,
              hasBreak: bulkClosed ? false : bulkHasBreak,
              breakStart: bulkBreakStart,
              breakEnd: bulkBreakEnd,
            }
          : item,
      ),
    );
  }

  function quickApply(
    days: string[],
    open: string,
    close: string,
    closed = false,
  ) {
    setBulkDays(days);
    setBulkOpen(open);
    setBulkClose(close);
    setBulkClosed(closed);
    setBulkHasBreak(false);

    setDayHours((prev) =>
      prev.map((item) =>
        days.includes(item.day)
          ? {
              ...item,
              open,
              close,
              closed,
              hasBreak: false,
            }
          : item,
      ),
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


  async function uploadBusinessThumbnail(businessId: number) {
    const firstPhoto = photoFiles[0];

    if (!firstPhoto) {
      return "";
    }

    const thumbnailBlob = await createBusinessThumbnail(firstPhoto);
    const thumbnailPath = `business-${businessId}/thumbnail.webp`;

    const { error: uploadError } = await supabase.storage
      .from("business-thumbnails")
      .upload(thumbnailPath, thumbnailBlob, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("business-thumbnails")
      .getPublicUrl(thumbnailPath);

    const thumbnailUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from("businesses")
      .update({
        thumbnail_url: thumbnailUrl,
      })
      .eq("id", businessId);

    if (updateError) {
      throw updateError;
    }

    return thumbnailUrl;
  }

  async function uploadFlipbookAdImages() {
    if (role !== "admin") {
      return [] as {
        size: FlipbookAdSize;
        imageUrl: string;
        enabled: boolean;
      }[];
    }

    const uploadedAds: {
      size: FlipbookAdSize;
      imageUrl: string;
      enabled: boolean;
    }[] = [];

    for (const option of flipbookAdOptions) {
      const size = option.size;
      const file = flipbookAdFiles[size];

      if (!file) continue;

      const rawExtension = file.name.split(".").pop() || "jpg";
      const fileExtension =
        rawExtension.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const fileName =
        `flipbook-ads/${userId}-${size}-${Date.now()}-` +
        `${Math.random().toString(36).substring(2)}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("business-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("business-images")
        .getPublicUrl(fileName);

      uploadedAds.push({
        size,
        imageUrl: data.publicUrl,
        enabled: flipbookAdEnabled[size],
      });
    }

    return uploadedAds;
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

    if (role !== "admin" && !address.trim()) {
      alert("Please enter address.");
      return;
    }

    if (videoFile && externalVideoUrl.trim()) {
      alert("동영상은 업로드 또는 링크 중 하나만 가능합니다.");
      return;
    }

    if (externalVideoUrl.trim() && !isAllowedVideoUrl(externalVideoUrl)) {
      alert("YouTube, Facebook, Instagram video link only.");
      return;
    }

    // 플립북 광고 이미지는 관리자만 선택할 수 있으며 선택 사항입니다.
    // 이미지를 첨부하지 않아도 비즈니스 등록을 계속할 수 있습니다.
    if (role === "admin") {
      const checkedWithoutImage = flipbookAdOptions.some(
        (option) =>
          flipbookAdEnabled[option.size] && !flipbookAdFiles[option.size],
      );

      if (checkedWithoutImage) {
        alert("표시할 광고에는 반드시 이미지를 첨부해 주세요.");
        return;
      }
    }

    setSaving(true);

    let imageUrls: string[] = [];
    let uploadedVideoUrl = "";
    let uploadedFlipbookAds: {
      size: FlipbookAdSize;
      imageUrl: string;
      enabled: boolean;
    }[] = [];
    let coords = { lat: null as number | null, lng: null as number | null };

    try {
      imageUrls = await uploadBusinessPhotos();
      uploadedVideoUrl = await uploadBusinessVideo();
      uploadedFlipbookAds =
        role === "admin" ? await uploadFlipbookAdImages() : [];

      if (lat && lng) {
        coords = {
          lat: Number(lat),
          lng: Number(lng),
        };
      } else if (address.trim()) {
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

    if (role !== "admin" && (!coords.lat || !coords.lng)) {
      setSaving(false);
      alert(
        "Could not find this address on the map. Please check the address.",
      );
      return;
    }

    const cleanExternalVideoUrl = externalVideoUrl.trim();

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .insert({
        name,
        address: address.trim() || null,
        phone,
		owner_phone: ownerPhone,
        category: selectedCategories.join(", "),
        hours: formatBusinessHours(),
        description,

        image_url: imageUrls[0] || "",
        image_urls: imageUrls,

        // 체크된 사진만 웹사이트 자동 이미지 슬라이드에 사용합니다.
        slider_image_urls: imageUrls.filter(
          (_, index) => photoSliderEnabled[index] === true,
        ),

        // Uploaded video files only go here.
        video_urls: uploadedVideoUrl ? [uploadedVideoUrl] : [],

        // YouTube / Facebook / Instagram links go here.
        external_video_url: uploadedVideoUrl
          ? null
          : cleanExternalVideoUrl || null,

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


      /*
       * 등록 완료 후 첫 번째 비즈니스 사진으로 480 × 360 WebP
       * 썸네일을 생성합니다. 썸네일 실패 때문에 업체 등록 전체가
       * 취소되지 않도록 별도로 처리합니다.
       */
      if (photoFiles.length > 0) {
        try {
          await uploadBusinessThumbnail(Number(business.id));
        } catch (thumbnailError) {
          console.error(
            "Business thumbnail generation failed:",
            thumbnailError,
          );
        }
      }

      if (role === "admin" && uploadedFlipbookAds.length > 0) {
        const adRows: Array<{
          business_id: number;
          ad_size: FlipbookAdSize;
          image_url: string;
          enabled: boolean;
          priority: number;
        }> = [];

        for (const ad of uploadedFlipbookAds) {
          adRows.push({
            business_id: business.id,
            ad_size: ad.size,
            image_url: ad.imageUrl,
            enabled: ad.enabled,
            priority: 0,
          });
        }

        const { error: adError } = await supabase
          .from("business_flipbook_ads")
          .insert(adRows);

        if (adError) {
          setSaving(false);
          alert("광고 저장 오류: " + adError.message);
          return;
        }
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
      <div className="mx-auto max-w-xl">
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
              options={{
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

          <button
            type="button"
            onClick={searchGoogleHoursManually}
            disabled={searchingGoogleHours || !isLoaded}
            className={`w-full rounded-2xl border px-4 py-3 text-sm font-black disabled:opacity-50 ${
              hoursSource === "google"
                ? "border-green-700 bg-green-50 text-green-800"
                : googleHoursMessage.includes("등록된 영업시간이 없습니다")
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-[#172033] bg-white text-[#172033]"
            }`}
          >
            {searchingGoogleHours
              ? "Google 영업시간 찾는 중..."
              : hoursSource === "google"
                ? "✓ Google 영업시간을 찾았습니다"
                : googleHoursMessage.includes("등록된 영업시간이 없습니다")
                  ? "Google에 등록된 영업시간이 없습니다"
                  : "Google에서 영업시간 다시 찾기"}
          </button>

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
  placeholder="Business Phone"
  className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
/>

<input
  value={ownerPhone}
  onChange={(e) => setOwnerPhone(e.target.value)}
  placeholder="Owner Phone (Optional)"
  className="w-full rounded-2xl border bg-gray-50 px-5 py-4"
/>

          <div className="space-y-3 rounded-2xl border bg-gray-50 p-4">
            <div>
              <p className="font-black">Business Video</p>
              <p className="text-xs font-bold text-gray-500">
                Upload one video OR paste one YouTube / Facebook / Instagram
                link.
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
                disabled={!!externalVideoUrl.trim()}
                className="w-full rounded-2xl bg-[#172033] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-40"
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

            <div className="relative flex items-center justify-center py-1">
              <div className="h-px w-full bg-gray-200" />
              <span className="absolute bg-gray-50 px-3 text-xs font-black text-gray-400">
                OR
              </span>
            </div>

            <input
              value={externalVideoUrl}
              onChange={(e) => setExternalVideoUrl(e.target.value)}
              disabled={!!videoFile}
              placeholder="YouTube / Facebook / Instagram video link"
              className="w-full rounded-xl border bg-white px-4 py-3 disabled:bg-gray-100 disabled:text-gray-400"
            />

            <p className="text-[11px] font-bold text-gray-500">
              동영상은 1개만 저장됩니다. 업로드 영상이 있으면 링크 입력은
              잠깁니다.
            </p>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-black">Business Photos</p>
                <p className="text-xs font-bold text-gray-500">
                  {photoFiles.length}/6 photos selected
                </p>
                <p className="mt-1 text-[11px] font-bold leading-4 text-blue-700">
                  사진마다 “웹사이트 슬라이드”를 체크하세요. 체크된 사진만
                  자동 이미지 슬라이드에 표시됩니다.
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
                {photoPreviews.map((preview, index) => {
                  const sliderEnabled =
                    photoSliderEnabled[index] === true;

                  return (
                    <div
                      key={preview}
                      className="overflow-hidden rounded-xl border bg-white"
                    >
                      <div className="relative">
                        <img
                          src={preview}
                          alt={`Business preview ${index + 1}`}
                          className="h-24 w-full object-cover"
                        />

                        <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                          {index + 1}
                        </span>

                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white shadow"
                          aria-label={`사진 ${index + 1} 삭제`}
                        >
                          ×
                        </button>
                      </div>

                      <label
                        className={`flex cursor-pointer items-center gap-2 px-2 py-2 text-[11px] font-black ${
                          sliderEnabled
                            ? "bg-green-50 text-green-800"
                            : "bg-gray-50 text-gray-500"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={sliderEnabled}
                          onChange={() => togglePhotoSlider(index)}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="leading-4">
                          웹사이트 슬라이드
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {role === "admin" && (
            <div className="space-y-4 rounded-2xl border border-[#D8C7AE] bg-[#FFF8EA] p-4">
              <div>
                <p className="font-black">Flipbook Advertisement</p>
                <p className="mt-1 text-xs font-bold leading-5 text-[#6B6257]">
                  사이즈별로 광고 이미지를 각각 첨부할 수 있습니다. 체크된
                  광고만 플립북에 표시됩니다.
                </p>
              </div>

              <div className="space-y-4">
                {flipbookAdOptions.map((option) => {
                  const size = option.size;
                  const preview = flipbookAdPreviews[size];
                  const hasImage = !!flipbookAdFiles[size];
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
                        id={`flipbook-ad-input-${size}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFlipbookAdChange(size, e)}
                        className="hidden"
                      />

                      {!preview ? (
                        <label
                          htmlFor={`flipbook-ad-input-${size}`}
                          className="block w-full cursor-pointer rounded-xl bg-[#C4483A] px-4 py-3 text-center text-sm font-extrabold text-white"
                        >
                          Size {size} 광고 이미지 첨부
                        </label>
                      ) : (
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
                              htmlFor={`flipbook-ad-input-${size}`}
                              className="cursor-pointer rounded-xl bg-[#172033] px-4 py-3 text-center text-sm font-black text-white"
                            >
                              이미지 변경
                            </label>

                            <button
                              type="button"
                              onClick={() => removeFlipbookAd(size)}
                              className="rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white"
                            >
                              이미지 삭제
                            </button>
                          </div>
                        </div>
                      )}

                      {!hasImage && (
                        <p className="text-[11px] font-bold text-gray-400">
                          이미지를 첨부하면 표시 체크박스가 활성화됩니다.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] font-bold leading-5 text-[#6B6257]">
                광고는 최대 4개까지 등록할 수 있습니다. 각 이미지 최대 파일
                크기는 15MB입니다. 체크된 사이즈만 플립북에 표시됩니다.
              </p>
            </div>
          )}

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
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-black">Business Hours</p>
                {googleHoursMessage && (
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    {searchingGoogleHours ? "⏳ " : ""}
                    {googleHoursMessage}
                  </p>
                )}
              </div>

              {hoursSource === "google" && (
                <button
                  type="button"
                  onClick={() => setHoursSource("manual")}
                  className="shrink-0 rounded-xl border bg-white px-3 py-2 text-xs font-black"
                >
                  직접 수정
                </button>
              )}
            </div>

            {hoursSource === "google" && (
              <div className="mb-4 space-y-2 rounded-2xl bg-white p-3 shadow-sm">
                {dayHours.map((item) => (
                  <div
                    key={item.day}
                    className="flex items-start justify-between gap-4 text-sm"
                  >
                    <span className="font-black">{item.day}</span>
                    <span className="text-right font-bold text-gray-600">
                      {item.closed
                        ? "Closed"
                        : `${item.open} - ${item.close}${
                            item.hasBreak
                              ? ` / Break ${item.breakStart} - ${item.breakEnd}`
                              : ""
                          }`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {hoursSource !== "google" && (
              <>
                <div className="mb-4 space-y-3 rounded-2xl bg-white p-3 shadow-sm">
                  <div>
                    <p className="font-black">Quick Setup</p>
                    <p className="text-xs font-bold text-gray-500">
                      같은 시간대 요일을 한 번에 적용하세요.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        quickApply(weekDays, "10:00 AM", "9:00 PM")
                      }
                      className="rounded-xl bg-[#172033] px-3 py-3 text-xs font-black text-white"
                    >
                      Mon-Fri Same
                    </button>

                    <button
                      type="button"
                      onClick={() => quickApply(allDays, "10:00 AM", "9:00 PM")}
                      className="rounded-xl bg-[#172033] px-3 py-3 text-xs font-black text-white"
                    >
                      All Days Same
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        quickApply(weekendDays, "11:00 AM", "8:00 PM")
                      }
                      className="rounded-xl bg-[#172033] px-3 py-3 text-xs font-black text-white"
                    >
                      Weekend Same
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        quickApply(["Sun"], "11:00 AM", "8:00 PM", true)
                      }
                      className="rounded-xl bg-red-500 px-3 py-3 text-xs font-black text-white"
                    >
                      Sunday Closed
                    </button>
                  </div>

                  <div className="rounded-2xl border bg-gray-50 p-3">
                    <p className="mb-2 text-sm font-black">
                      Apply To Selected Days
                    </p>

                    <div className="mb-3 grid grid-cols-4 gap-2">
                      {allDays.map((day) => {
                        const checked = bulkDays.includes(day);

                        return (
                          <label
                            key={day}
                            className={`flex cursor-pointer items-center justify-center rounded-xl border px-2 py-2 text-xs font-black ${
                              checked
                                ? "border-[#172033] bg-white text-[#172033]"
                                : "border-gray-200 bg-white/50 text-gray-400"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleBulkDay(day)}
                              className="hidden"
                            />
                            {day}
                          </label>
                        );
                      })}
                    </div>

                    <label className="mb-3 flex items-center gap-2 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={bulkClosed}
                        onChange={(e) => setBulkClosed(e.target.checked)}
                      />
                      Closed selected days
                    </label>

                    {!bulkClosed && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={bulkOpen}
                            onChange={(e) => setBulkOpen(e.target.value)}
                            className="rounded-xl border bg-white px-3 py-3 text-sm font-bold"
                          >
                            {timeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>

                          <select
                            value={bulkClose}
                            onChange={(e) => setBulkClose(e.target.value)}
                            className="rounded-xl border bg-white px-3 py-3 text-sm font-bold"
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
                            checked={bulkHasBreak}
                            onChange={(e) => setBulkHasBreak(e.target.checked)}
                          />
                          Same break time
                        </label>

                        {bulkHasBreak && (
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={bulkBreakStart}
                              onChange={(e) =>
                                setBulkBreakStart(e.target.value)
                              }
                              className="rounded-xl border bg-white px-3 py-3 text-sm font-bold"
                            >
                              {timeOptions.map((time) => (
                                <option key={time} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>

                            <select
                              value={bulkBreakEnd}
                              onChange={(e) => setBulkBreakEnd(e.target.value)}
                              className="rounded-xl border bg-white px-3 py-3 text-sm font-bold"
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

                    <button
                      type="button"
                      onClick={() => applyHoursToDays()}
                      className="mt-3 w-full rounded-xl bg-[#F6C343] px-4 py-3 text-sm font-black text-[#172033]"
                    >
                      Apply To Selected Days
                    </button>
                  </div>
                </div>

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
                                  e.target.checked,
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
                                    e.target.value,
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
                                    e.target.value,
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
              </>
            )}
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
            className="w-full rounded-2xl bg-[#172033] py-4 text-lg font-extrabold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Register Business"}
          </button>
        </div>
      </div>

      <BottomNav />

      </main>
  );
}