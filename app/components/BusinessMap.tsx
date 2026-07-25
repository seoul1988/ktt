"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthRefreshWrapper from "./AuthRefreshWrapper";
import BottomNav from "./BottomNav";


import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import ProfileButton from "./ProfileButton";
import "leaflet/dist/leaflet.css";
import { supabase } from "../../lib/supabase";

const MAP_STATE_KEY = "ktt_map_state_v1";

// 초기 지도 중심과 줌 레벨을 고정합니다.
// 숫자가 클수록 더 가까이 보이고, 작을수록 더 넓게 보입니다.
const INITIAL_MAP_CENTER: [number, number] = [35.765, -78.625];
const INITIAL_MAP_ZOOM = 9;

// TomTom 실시간 교통 레이어용 공개 환경변수입니다.
// .env.local: NEXT_PUBLIC_TOMTOM_API_KEY=발급받은_API_KEY
const TOMTOM_API_KEY =
  process.env.NEXT_PUBLIC_TOMTOM_API_KEY ||
  "DLSAyKT2rONDvZPY0Cqi9P57h501r33X";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const selectedMarkerIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const kiotiMarkerIcon = L.divIcon({
  className: "kioti-map-marker",
  html: `
    <div style="
      width:24px;
      height:24px;
      overflow:hidden;
      border-radius:50%;
      border:2px solid white;
      background:#000;
      box-shadow:0 3px 10px rgba(0,0,0,.45);
    ">
      <img
        src="/images/kioti.png"
        alt="KIOTI"
        style="display:block;width:100%;height:100%;object-fit:cover;"
      />
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
});

const caryMarkerIcon = L.divIcon({
  className: "cary-map-marker",
  html: `
    <div style="
      width:24px;
      height:24px;
      overflow:hidden;
      border-radius:50%;
      border:2px solid white;
      background:white;
      box-shadow:0 3px 10px rgba(0,0,0,.45);
    ">
      <img
        src="/images/cary.png"
        alt="Business 15"
        style="display:block;width:100%;height:100%;object-fit:contain;"
      />
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
});










const business16MarkerIcon = L.divIcon({
  className: "business16-map-marker",
  html: `
    <div style="
      width:24px;
      height:24px;
      overflow:hidden;
      border-radius:50%;
      border:2px solid white;
      background:white;
      box-shadow:0 3px 10px rgba(0,0,0,.45);
    ">
      <img
        src="/images/lee.png"
        alt="Business 16"
        onerror="this.onerror=null;this.src='/lee.png';"
        style="display:block;width:100%;height:100%;object-fit:contain;"
      />
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
});

const business10MarkerIcon = L.divIcon({
  className: "business10-map-marker",
  html: `
    <div style="
      width:24px;
      height:24px;
      overflow:hidden;
      border-radius:50%;
      border:2px solid white;
      background:white;
      box-shadow:0 3px 10px rgba(0,0,0,.45);
    ">
      <img
        src="/images/h.png"
        alt="Business 10"
        onerror="this.onerror=null;this.src='/h.png';"
        style="display:block;width:100%;height:100%;object-fit:cover;"
      />
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
});



type MapCategory = {
  id?: number;
  name: string;
  emoji: string | null;
};

type Spot = {
  id: number;
  map_key?: string | null;
  business_id?: number | string | null;
  original_business_id?: number | string | null;
  source_type?: string | null;
  deal_id?: number | string | null;
  event_id?: number | string | null;
  type?: string | null;
  original_id?: number | string | null;
  marketplace_id?: number | string | null;
  name: string;
  business_name?: string | null;
  title?: string | null;
  category: string | null;
  categories?: string | null;
  matched_categories?: string[] | null;
  city: string | null;
  image_url: string | null;
  image_urls?: string[] | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  description?: string | null;
  rating?: number | null;
  review_count?: number | null;
  lat?: number | null;
  lng?: number | null;
  hours?: string | null;
  tags?: string | string[] | null;
  tag?: string | string[] | null;
  search_text?: string | null;
  event_title?: string | null;
  event_name?: string | null;
  coupon_title?: string | null;
  deal_title?: string | null;
  coupon_badge?: string | null;
  coupon_count?: number | null;
  display_order?: number | null;
  order_number?: number | null;
  order_no?: number | null;
  coupons?: {
    id: number;
    business_id?: number | string | null;
    title?: string | null;
    description?: string | null;
    coupon_type?: string | null;
    value?: number | string | null;
    min_order?: number | string | null;
    start_date?: string | null;
    end_date?: string | null;
  }[] | null;
};

type SpotWithDistance = Spot & {
  distance?: number;
};

type RouteInfo = {
  minutes: number;
  miles: number;
};

function getSpotKey(spot: Spot | null | undefined) {
  if (!spot) return "";

  return (
    spot.map_key ||
    [
      spot.source_type || spot.type || "business",
      spot.deal_id ?? "no-deal",
      spot.event_id ?? "no-event",
      spot.marketplace_id ?? "no-market",
      spot.business_id ?? spot.original_business_id ?? spot.original_id ?? spot.id,
    ].join("-")
  );
}

function getBusinessId(spot: Spot) {
  return Number(spot.business_id || spot.original_business_id || spot.id);
}

function getDetailHref(
  spot: Spot,
  businessId: number,
  communityMode: boolean
) {
  if (
    communityMode &&
    (spot.source_type === "marketplace" || spot.type === "marketplace")
  ) {
    return `/community/market/${
      spot.original_id || spot.marketplace_id || spot.id
    }?from=community-map`;
  }

  if (communityMode) {
    return `/business/${businessId}?from=community-map`;
  }

  return `/business/${businessId}?from=map`;
}

function milesBetween(a: [number, number], b: [number, number]) {
  const R = 3958.8;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function estimateDriveMinutes(distanceMiles?: number) {
  if (distanceMiles === undefined || !Number.isFinite(distanceMiles)) return null;

  // TomTom 응답 전 또는 Routing API 실패 시 카드가 비어 보이지 않도록
  // Triangle 지역의 일반적인 평균 주행 속도로 임시 예상 시간을 표시합니다.
  const averageSpeedMph =
    distanceMiles < 3 ? 22 : distanceMiles < 10 ? 30 : 42;

  return Math.max(2, Math.round((distanceMiles / averageSpeedMph) * 60));
}

function normalizeCategory(value: string) {
  return value.trim().toLowerCase().replace(/s$/, "");
}

/**
 * 한글 조합형과 공백 차이를 통일하여 한 글자 부분 검색도 가능하게 합니다.
 */
function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

/**
 * tags가 배열, 일반 문자열 또는 JSON 배열 문자열이어도 검색할 수 있게 변환합니다.
 */
function getTagsText(tags: unknown) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag ?? ""))
      .filter(Boolean)
      .join(" ");
  }

  if (typeof tags === "string") {
    const trimmed = tags.trim();
    if (!trimmed) return "";

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed
          .map((tag) => String(tag ?? ""))
          .filter(Boolean)
          .join(" ");
      }
    } catch {
      // JSON이 아닌 일반 문자열은 그대로 사용합니다.
    }

    return trimmed;
  }

  return "";
}

/**
 * 업체 제목, 상호명, 태그 및 기존 검색 항목을 하나의 문자열로 만듭니다.
 */
function createSpotSearchText(spot: Spot, categoryList: string[]) {
  return normalizeSearchText(
    [
      spot.business_name,
      spot.name,
      spot.title,
      getTagsText(spot.tags),
      getTagsText(spot.tag),
      spot.category,
      spot.categories,
      categoryList.join(" "),
      spot.city,
      spot.description,
      spot.coupon_badge,
      spot.event_title,
      spot.event_name,
      spot.coupon_title,
      spot.deal_title,
      spot.search_text,
    ]
      .filter(
        (value) =>
          value !== null &&
          value !== undefined &&
          String(value).trim() !== ""
      )
      .join(" ")
  );
}

function getSpotCategoryList(spot: Spot) {
  const fromMatched = Array.isArray(spot.matched_categories)
    ? spot.matched_categories
    : [];

  const fromCategories = String(spot.categories || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const fromCategory = String(spot.category || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set([...fromMatched, ...fromCategories, ...fromCategory]));
}

function timeTextToMinutes(timeText?: string | null) {
  if (!timeText) return null;

  const match = timeText.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[3].toUpperCase();

  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function getOpenStatus(spot: Spot) {
  const now = new Date();

  const todayShort = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  }).format(now);

  const currentMinutes = now
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
    })
    .split(":")
    .map(Number)
    .reduce((h, m) => h * 60 + m);

  const line = String(spot.hours || "")
    .split("\n")
    .find((v) => v.startsWith(todayShort));

  if (!line) return { text: "Closed" };
  if (line.includes("Closed")) return { text: "Closed Today" };

  const mainPart = line.split("/ Break")[0].replace(todayShort, "").trim();
  const breakPart = line.split("/ Break")[1]?.trim();

  const [openText, closeText] = mainPart.split(" - ").map((v) => v.trim());
  const openMinutes = timeTextToMinutes(openText);
  const closeMinutes = timeTextToMinutes(closeText);

  if (breakPart) {
    const [breakStartText, breakEndText] = breakPart
      .replace("Break", "")
      .split(" - ")
      .map((v) => v.trim());

    const breakStart = timeTextToMinutes(breakStartText);
    const breakEnd = timeTextToMinutes(breakEndText);

    if (
      breakStart !== null &&
      breakEnd !== null &&
      currentMinutes >= breakStart &&
      currentMinutes < breakEnd
    ) {
      return { text: "Break Time" };
    }
  }

  if (
    openMinutes !== null &&
    closeMinutes !== null &&
    currentMinutes >= openMinutes &&
    currentMinutes < closeMinutes
  ) {
    return { text: "Open" };
  }

  return { text: "Closed" };
}

function InitialMapView() {
  const map = useMap();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    initializedRef.current = true;

    map.setView(INITIAL_MAP_CENTER, INITIAL_MAP_ZOOM, {
      animate: false,
    });

    // 처음 열릴 때 중심을 조금 위로 이동
    setTimeout(() => {
      const offset =
        window.innerWidth < 768
          ? 140 // 모바일
          : 50; // PC

      map.panBy([0, offset], {
        animate: false,
      });
    }, 0);
  }, [map]);

  return null;
}

function ResetMapView({
  search,
  selectedCategory,
}: {
  search: string;
  selectedCategory: string | null;
}) {
  const map = useMap();
  const previousValueRef = useRef<string | null>(null);

  useEffect(() => {
    const currentValue = `${search.trim()}|${selectedCategory || ""}`;

    if (previousValueRef.current === currentValue) return;

    previousValueRef.current = currentValue;

    // 검색어나 카테고리가 모두 없을 때만 기본 Raleigh 위치로 돌아갑니다.
    // 검색 중에는 FitFilteredMarkers가 검색된 업체 위치로 지도를 이동합니다.
    if (!search.trim() && !selectedCategory) {
      map.stop();
      map.setView(INITIAL_MAP_CENTER, INITIAL_MAP_ZOOM, {
        animate: false,
      });
    }
  }, [search, selectedCategory, map]);

  return null;
}

function FitFilteredMarkers({
  spots,
  enabled,
}: {
  spots: Spot[];
  enabled: boolean;
}) {
  const map = useMap();
  const previousBoundsKeyRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) {
      previousBoundsKeyRef.current = "";
      return;
    }

    const validSpots = spots.filter((spot) => {
      const lat = Number(spot.lat);
      const lng = Number(spot.lng);

      return Number.isFinite(lat) && Number.isFinite(lng);
    });

    if (validSpots.length === 0) return;

    // 같은 검색 결과로 불필요하게 지도가 반복 이동하지 않게 합니다.
    const boundsKey = validSpots
      .map((spot) => `${getSpotKey(spot)}:${Number(spot.lat)},${Number(spot.lng)}`)
      .sort()
      .join("|");

    if (previousBoundsKeyRef.current === boundsKey) return;
    previousBoundsKeyRef.current = boundsKey;

    map.stop();

    // 검색 결과가 한 곳이면 해당 업체 위치를 충분히 확대해서 보여줍니다.
    if (validSpots.length === 1) {
      map.setView(
        [Number(validSpots[0].lat), Number(validSpots[0].lng)],
        11,
        {
          animate: true,
          duration: 0.35,
        }
      );
      return;
    }

    // 여러 업체가 선택되면 76마일 이상 떨어진 업체도 포함하여
    // 모든 마커가 화면 안에 들어오도록 자동으로 축소합니다.
    const bounds = L.latLngBounds(
      validSpots.map(
        (spot) =>
          [Number(spot.lat), Number(spot.lng)] as [number, number]
      )
    );

    const isMobilePortrait =
      window.innerWidth < 768 &&
      !window.matchMedia("(orientation: landscape)").matches;

    map.fitBounds(bounds, {
      paddingTopLeft: isMobilePortrait ? [30, 105] : [45, 90],
      paddingBottomRight: isMobilePortrait ? [30, 285] : [45, 190],
      maxZoom: 11,
      animate: true,
      duration: 0.35,
    });
  }, [spots, enabled, map]);

  return null;
}
function PanToSelectedSpot({
  lat,
  lng,
}: {
  lat?: number;
  lng?: number;
}) {
  const map = useMap();
  const previousPositionRef = useRef<string | null>(null);

  useEffect(() => {
    if (lat == null || lng == null) return;

    const positionKey = `${lat},${lng}`;
    if (previousPositionRef.current === positionKey) return;

    previousPositionRef.current = positionKey;

    const isMobilePortrait =
      window.innerWidth < 768 &&
      !window.matchMedia("(orientation: landscape)").matches;

    const currentZoom = map.getZoom();
    // 아래 카드가 지도를 가리므로 마커가 실제 보이는 영역의 중앙에 오도록
    // 현재 줌과 현재 지도 높이를 기준으로 중심점을 계산합니다.
    const bottomCardHeight = isMobilePortrait ? 235 : 110;
    const visibleCenterOffsetY = isMobilePortrait
      ? Math.min(145, Math.max(95, bottomCardHeight * 0.48))
      : 45;

    const markerPoint = map.project([lat, lng], currentZoom);
    const adjustedCenterPoint = markerPoint.add([
      0,
      visibleCenterOffsetY,
    ]);
    const adjustedCenter = map.unproject(
      adjustedCenterPoint,
      currentZoom,
    );

    map.stop();
    map.flyTo(adjustedCenter, currentZoom, {
      animate: true,
      duration: 0.35,
    });

    // iPhone Safari에서 레이아웃 계산이 한 프레임 늦는 경우를 보정합니다.
    window.setTimeout(() => {
      map.invalidateSize({ pan: false });
    }, 120);
  }, [lat, lng, map]);

  return null;
}

function MapEmptyClickHandler({ onToggle }: { onToggle: () => void }) {
  useMapEvents({
    click: () => {
      onToggle();
    },
  });

  return null;
}

export default function BusinessMap({
  spots,
  markerSpots,
  categories = [],
  showAllOnLoad = false,
  activeNav = "map",
  communityMode = false,
  role = null,
  initialCategory = "",
  initialSearch = "",
}: {
  spots: Spot[];
  markerSpots?: Spot[];
  categories?: MapCategory[];
  showAllOnLoad?: boolean;
  activeNav?: "home" | "map" | "deals" | "events" | "community" | "admin";
  communityMode?: boolean;
  role?: string | null;
  initialCategory?: string;
  initialSearch?: string;
}) {
  const router = useRouter();

  const [isIOS, setIsIOS] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const [userLocation, setUserLocation] =
    useState<[number, number] | null>(null);
  const [selectedSpotKey, setSelectedSpotKey] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
  initialCategory || null
);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(!showAllOnLoad);
  const [showCards, setShowCards] = useState(
  showAllOnLoad || !!initialCategory
);
  const [imageIndexes, setImageIndexes] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Record<number, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [mapCategories, setMapCategories] = useState<MapCategory[]>([]);
  const [myRole, setMyRole] = useState<string | null>(role);
  const [kiotiSpot, setKiotiSpot] = useState<Spot | null>(null);
  const [carySpot, setCarySpot] = useState<Spot | null>(null);
  const [business16Spot, setBusiness16Spot] = useState<Spot | null>(null);
  const [business10Spot, setBusiness10Spot] = useState<Spot | null>(null);
  const [showTrafficFlow, setShowTrafficFlow] = useState(false);
  const [trafficNotice, setTrafficNotice] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<Record<string, RouteInfo>>({});
  const [routeLoadFinished, setRouteLoadFinished] = useState(false);

  const cardRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const cardScrollRef = useRef<HTMLDivElement | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [showCategoryDownArrow, setShowCategoryDownArrow] = useState(false);
  const [showCategoryUpArrow, setShowCategoryUpArrow] = useState(false);
  const restoredRef = useRef(false);

  // 마커 클릭으로 카드를 이동하는 동안 onScroll이 다른 카드를
  // 다시 선택하지 못하도록 잠시 막습니다.
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const storageKey = `${MAP_STATE_KEY}-${communityMode ? "community" : activeNav}`;

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;
    const touchPoints = window.navigator.maxTouchPoints;

    const isAppleMobile =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (platform === "MacIntel" && touchPoints > 1);

    setIsIOS(isAppleMobile);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleViewportChange = () => {
      const heightDifference = window.innerHeight - viewport.height;
      setKeyboardOpen(heightDifference > 140);
    };

    handleViewportChange();
    viewport.addEventListener("resize", handleViewportChange);
    viewport.addEventListener("scroll", handleViewportChange);

    return () => {
      viewport.removeEventListener("resize", handleViewportChange);
      viewport.removeEventListener("scroll", handleViewportChange);
    };
  }, []);

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  const normalizedSpots = useMemo(() => {
    return spots.map((spot) => ({
      ...spot,
      map_key: getSpotKey(spot),
    }));
  }, [spots]);

  const normalizedMarkerSpots = useMemo(() => {
    let result = (markerSpots ?? spots).map((spot) => ({
      ...spot,
      map_key: getSpotKey(spot),
    }));

    const permanentSpots = [
      kiotiSpot,
      carySpot,
      business16Spot,
      business10Spot,
    ].filter(Boolean) as Spot[];

    permanentSpots.forEach((permanentSpot) => {
      const permanentBusinessId = getBusinessId(permanentSpot);
      const alreadyIncluded = result.some(
        (spot) => getBusinessId(spot) === permanentBusinessId
      );

      if (alreadyIncluded) {
        result = result.map((spot) =>
          getBusinessId(spot) === permanentBusinessId
            ? {
                ...spot,
                ...permanentSpot,
                map_key: getSpotKey(permanentSpot),
              }
            : spot
        );
      } else {
        result.push({
          ...permanentSpot,
          map_key: getSpotKey(permanentSpot),
        });
      }
    });

    return result;
  }, [markerSpots, spots, kiotiSpot, carySpot, business16Spot, business10Spot]);

  const displayCategories = useMemo(() => {
    if (mapCategories.length > 0) return mapCategories;
    if (communityMode) return [];

    const names = new Set<string>();

    normalizedSpots.forEach((spot) => {
      getSpotCategoryList(spot).forEach((v) => names.add(v));
    });

    return Array.from(names)
      .sort()
      .map((name) => ({
        name,
        emoji: "🏷️",
      }));
  }, [communityMode, mapCategories, normalizedSpots]);

  function saveMapState(next?: {
    selectedSpotKey?: string | null;
    selectedCategory?: string | null;
    search?: string;
  }) {
    if (typeof window === "undefined") return;

    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        selectedSpotKey:
          next?.selectedSpotKey !== undefined
            ? next.selectedSpotKey
            : selectedSpotKey,
        selectedCategory:
          next?.selectedCategory !== undefined
            ? next.selectedCategory
            : selectedCategory,
        search: next?.search !== undefined ? next.search : search,
        showCards: true,
      })
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = sessionStorage.getItem(storageKey);

    if (!saved) {
      if (initialCategory) {
        setSelectedCategory(initialCategory);
        setCategoryPanelOpen(false);
        setShowCards(true);
      }

      return;
    }

    try {
      const parsed = JSON.parse(saved);

      if (typeof parsed.search === "string") {
        setSearch(parsed.search);
      }

      if (initialCategory) {
        setSelectedCategory(initialCategory);
      } else if (parsed.selectedCategory) {
        setSelectedCategory(parsed.selectedCategory);
      }

      if (parsed.selectedSpotKey) {
        setSelectedSpotKey(parsed.selectedSpotKey);
      }

      setCategoryPanelOpen(false);
      setShowCards(true);
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey, initialCategory]);

useEffect(() => {
  if (!initialSearch) return;

  setSearch(initialSearch);
  setSelectedCategory(null);
  setSelectedSpotKey(null);
  setCategoryPanelOpen(false);
  setShowCards(true);
}, [initialSearch]);

  useEffect(() => {
    async function loadMyRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMyRole(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.log("Role load error:", error);
        setMyRole(null);
        return;
      }

      setMyRole(data?.role || null);
    }

    loadMyRole();
  }, []);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([
          position.coords.latitude,
          position.coords.longitude,
        ]);
      },
      () => {
        setUserLocation(null);
      }
    );
  }, []);

  useEffect(() => {
    async function loadKiotiSpot() {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", 199)
        .maybeSingle();

      if (error) {
        console.log("KIOTI business load error:", error);
        return;
      }

      if (!data) return;

      const lat = Number(
        data.lat ??
          data.latitude ??
          data.google_lat ??
          data.location_lat
      );
      const lng = Number(
        data.lng ??
          data.longitude ??
          data.google_lng ??
          data.location_lng
      );

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.log("KIOTI business 199 has no valid lat/lng:", data);
        return;
      }

      setKiotiSpot({
        ...data,
        id: 199,
        business_id: 199,
        lat,
        lng,
        map_key: "business-199-kioti",
        source_type: "business",
        type: "business",
      } as Spot);
    }

    loadKiotiSpot();
  }, []);

  useEffect(() => {
    async function loadCarySpot() {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", 15)
        .maybeSingle();

      if (error) {
        console.log("Business 15 load error:", error);
        return;
      }

      if (!data) return;

      const lat = Number(
        data.lat ??
          data.latitude ??
          data.google_lat ??
          data.location_lat
      );
      const lng = Number(
        data.lng ??
          data.longitude ??
          data.google_lng ??
          data.location_lng
      );

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.log("Business 15 has no valid lat/lng:", data);
        return;
      }

      setCarySpot({
        ...data,
        id: 15,
        business_id: 15,
        lat,
        lng,
        map_key: "business-15-cary",
        source_type: "business",
        type: "business",
      } as Spot);
    }

    loadCarySpot();
  }, []);

  useEffect(() => {
    async function loadBusiness16Spot() {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", 16)
        .maybeSingle();

      if (error) {
        console.log("Business 16 load error:", error);
        return;
      }

      if (!data) {
        console.log("Business 16 was not found.");
        return;
      }

      let lat = Number(
        data.lat ??
          data.latitude ??
          data.google_lat ??
          data.location_lat ??
          data.latitude_value
      );

      let lng = Number(
        data.lng ??
          data.longitude ??
          data.google_lng ??
          data.location_lng ??
          data.longitude_value
      );

      // If coordinates are missing, geocode the saved business address.
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const addressText = [
          data.address,
          data.city,
          data.state || "NC",
          data.zip || data.zip_code,
        ]
          .filter(Boolean)
          .join(", ");

        if (addressText) {
          try {
            const geocodeUrl =
              "https://nominatim.openstreetmap.org/search" +
              `?format=jsonv2&limit=1&q=${encodeURIComponent(addressText)}`;

            const geocodeRes = await fetch(geocodeUrl, {
              headers: {
                Accept: "application/json",
              },
            });

            const geocodeData = await geocodeRes.json();
            const firstResult = geocodeData?.[0];

            lat = Number(firstResult?.lat);
            lng = Number(firstResult?.lon);
          } catch (geocodeError) {
            console.log("Business 16 geocoding error:", geocodeError);
          }
        }
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.log("Business 16 has no valid coordinates:", data);
        return;
      }

      setBusiness16Spot({
        ...data,
        id: 16,
        business_id: 16,
        lat,
        lng,
        map_key: "business-16-lee",
        source_type: "business",
        type: "business",
      } as Spot);
    }

    loadBusiness16Spot();
  }, []);

  useEffect(() => {
    async function loadBusiness10Spot() {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", 10)
        .maybeSingle();

      if (error) {
        console.log("Business 10 load error:", error);
        return;
      }

      if (!data) {
        console.log("Business 10 was not found.");
        return;
      }

      const lat = Number(
        data.lat ??
          data.latitude ??
          data.google_lat ??
          data.location_lat ??
          data.latitude_value
      );

      const lng = Number(
        data.lng ??
          data.longitude ??
          data.google_lng ??
          data.location_lng ??
          data.longitude_value
      );

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.log("Business 10 has no valid coordinates:", data);
        return;
      }

      setBusiness10Spot({
        ...data,
        id: 10,
        business_id: 10,
        lat,
        lng,
        map_key: "business-10-h",
        source_type: "business",
        type: "business",
      } as Spot);
    }

    loadBusiness10Spot();
  }, []);

  useEffect(() => {
    async function loadCategories() {
      if (categories.length > 0) {
        setMapCategories(categories);
        return;
      }

      let query = supabase
        .from("categories")
        .select("name, emoji")
        .order("name", { ascending: true });

      if (communityMode) {
        query = query.eq("show_on_community_map", true);
      } else {
        query = query.eq("show_on_main_map", true);
      }

      const { data, error } = await query;

      if (error) {
        console.log("Category load error:", error);
        setMapCategories([]);
        return;
      }

      setMapCategories((data || []) as MapCategory[]);
    }

    loadCategories();
  }, [communityMode, categories]);

  const mapSpots = useMemo(() => {
    return normalizedSpots.filter((spot) => {
      const spotCategoryList = getSpotCategoryList(spot);

      const searchText = createSpotSearchText(
        spot,
        spotCategoryList
      );

      const normalizedSearch = normalizeSearchText(search);

      const normalizedCategoryList = spotCategoryList.map((item) =>
        normalizeCategory(item)
      );


      const matchesSearch = normalizedSearch
        ? searchText.includes(normalizedSearch)
        : true;

      const matchesCategory = selectedCategory
        ? normalizedCategoryList.includes(normalizeCategory(selectedCategory))
        : true;

      if (!selectedCategory && !search) {
        if (showAllOnLoad) return true;
        return false;
      }

      return matchesSearch && matchesCategory;
    });
  }, [normalizedSpots, search, selectedCategory, showAllOnLoad]);

  const filteredMarkerSpots = useMemo(() => {
    return normalizedMarkerSpots.filter((spot) => {
      // Business ID 199 is a permanent sponsored marker.
      // Its saved lat/lng coordinates are used, and it stays visible
      // even when no category is selected or a search is active.
      const isPermanentMarker = [199, 15, 16, 10].includes(
        getBusinessId(spot)
      );

      // Sponsored image markers are shown only on the default map.
      // When a category or search is active, hide all four consistently.
      if (isPermanentMarker) {
        return !selectedCategory && !search.trim();
      }

      const spotCategoryList = getSpotCategoryList(spot);

      const searchText = createSpotSearchText(
        spot,
        spotCategoryList
      );

      const normalizedSearch = normalizeSearchText(search);

      const normalizedCategoryList = spotCategoryList.map((item) =>
        normalizeCategory(item)
      );

      const matchesSearch = normalizedSearch
        ? searchText.includes(normalizedSearch)
        : true;

      const matchesCategory = selectedCategory
        ? normalizedCategoryList.includes(normalizeCategory(selectedCategory))
        : true;

      // On main and community maps, do not show markers before a
      // category is selected or a search is entered.
      // Deals/events can still opt into initial display with showAllOnLoad.
      if (!selectedCategory && !search) {
        return showAllOnLoad;
      }

      return matchesSearch && matchesCategory;
    });
  }, [
    normalizedMarkerSpots,
    search,
    selectedCategory,
    showAllOnLoad,
  ]);

  const selectedMapSpot = useMemo(() => {
    if (!selectedSpotKey) return null;

    return (
      filteredMarkerSpots.find(
        (spot) => getSpotKey(spot) === selectedSpotKey
      ) ??
      normalizedMarkerSpots.find(
        (spot) => getSpotKey(spot) === selectedSpotKey
      ) ??
      null
    );
  }, [
    filteredMarkerSpots,
    normalizedMarkerSpots,
    selectedSpotKey,
  ]);

  const cardSpots: SpotWithDistance[] = useMemo(() => {
    const withDistance = mapSpots.map((spot): SpotWithDistance => ({
      ...spot,
      distance:
        userLocation && spot.lat && spot.lng
          ? milesBetween(userLocation, [spot.lat, spot.lng])
          : undefined,
    }));

    return withDistance.sort((a: any, b: any) => {
      const orderA = a.display_order ?? a.order_number ?? a.order_no ?? 999999;
      const orderB = b.display_order ?? b.order_number ?? b.order_no ?? 999999;

      if (orderA !== orderB) return orderA - orderB;

      return getBusinessId(a) - getBusinessId(b);
    });
  }, [mapSpots, userLocation]);

  useEffect(() => {
    if (!userLocation || !TOMTOM_API_KEY || cardSpots.length === 0) {
      setRouteInfo({});
      setRouteLoadFinished(false);
      return;
    }

    setRouteLoadFinished(false);
    const controller = new AbortController();
    const currentLocation = userLocation;

    async function loadRouteTimes() {
      const targets = cardSpots
        .filter((spot) => {
          const lat = Number(spot.lat);
          const lng = Number(spot.lng);

          return Number.isFinite(lat) && Number.isFinite(lng);
        })
        .slice(0, 15);

      const results = await Promise.allSettled(
        targets.map(async (spot) => {
          const spotKey = getSpotKey(spot);
          const destinationLat = Number(spot.lat);
          const destinationLng = Number(spot.lng);

          const url =
            "https://api.tomtom.com/routing/1/calculateRoute/" +
            `${currentLocation[0]},${currentLocation[1]}:` +
            `${destinationLat},${destinationLng}/json` +
            `?key=${encodeURIComponent(TOMTOM_API_KEY)}` +
            "&traffic=true" +
            "&routeType=fastest" +
            "&travelMode=car" +
            "&routeRepresentation=summaryOnly" +
            "&computeTravelTimeFor=all";

          const response = await fetch(url, {
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`TomTom route request failed: ${response.status}`);
          }

          const data = await response.json();
          const summary = data?.routes?.[0]?.summary;

          if (!summary) {
            throw new Error("TomTom route summary is missing");
          }

          return {
            spotKey,
            minutes: Math.max(
              1,
              Math.round(Number(summary.travelTimeInSeconds) / 60),
            ),
            miles: Number(summary.lengthInMeters) / 1609.344,
          };
        }),
      );

      if (controller.signal.aborted) return;

      const next: Record<string, RouteInfo> = {};

      results.forEach((result) => {
        if (result.status !== "fulfilled") return;

        next[result.value.spotKey] = {
          minutes: result.value.minutes,
          miles: result.value.miles,
        };
      });

      setRouteInfo(next);
      setRouteLoadFinished(true);
    }

    loadRouteTimes().catch((error) => {
      if (error?.name !== "AbortError") {
        console.log("TomTom route time load error:", error);
        setRouteLoadFinished(true);
      }
    });

    return () => {
      controller.abort();
    };
  }, [userLocation, cardSpots]);

  useEffect(() => {
    if (restoredRef.current) return;
    if (!selectedSpotKey) return;
    if (cardSpots.length === 0) return;

    const exists = cardSpots.some((spot) => getSpotKey(spot) === selectedSpotKey);
    if (!exists) return;

    restoredRef.current = true;

    programmaticScrollRef.current = true;

    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
    }

    setTimeout(() => {
      centerCard(selectedSpotKey, "auto");

      programmaticScrollTimerRef.current = setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 250);
    }, 150);
  }, [cardSpots, selectedSpotKey]);

  useEffect(() => {
    async function loadLikes() {
      const { data } = await supabase
        .from("business_likes")
        .select("business_id,user_id");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const counts: Record<number, number> = {};
      const mine: Record<number, boolean> = {};

      data?.forEach((v) => {
        counts[v.business_id] = (counts[v.business_id] || 0) + 1;

        if (user && v.user_id === user.id) {
          mine[v.business_id] = true;
        }
      });

      setLikeCounts(counts);
      setLikedIds(mine);
    }

    loadLikes();
  }, []);

  async function toggleLike(e: React.MouseEvent, businessId: number) {
    e.preventDefault();
    e.stopPropagation();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Login first");
      return;
    }

    const liked = likedIds[businessId];

    if (liked) {
      await supabase
        .from("business_likes")
        .delete()
        .eq("business_id", businessId)
        .eq("user_id", user.id);

      setLikedIds((p) => ({
        ...p,
        [businessId]: false,
      }));

      setLikeCounts((p) => ({
        ...p,
        [businessId]: Math.max((p[businessId] || 1) - 1, 0),
      }));
    } else {
      await supabase.from("business_likes").insert({
        business_id: businessId,
        user_id: user.id,
      });

      setLikedIds((p) => ({
        ...p,
        [businessId]: true,
      }));

      setLikeCounts((p) => ({
        ...p,
        [businessId]: (p[businessId] || 0) + 1,
      }));
    }
  }

  function selectCategory(category: string) {
    setSelectedCategory(category);
    setSearch("");
    setSelectedSpotKey(null);
    setCategoryPanelOpen(false);
    setShowCards(true);
    restoredRef.current = false;

    saveMapState({
      selectedCategory: category,
      selectedSpotKey: null,
      search: "",
    });
  }

  function openCategoryPanel() {
    setCategoryPanelOpen(true);
    setShowCards(false);
  }

  function centerCard(spotKey: string, behavior: ScrollBehavior = "smooth") {
    const container = cardScrollRef.current;
    const card = cardRefs.current[spotKey];

    if (!container || !card) return;

    const isLandscape =
      window.matchMedia("(orientation: landscape)").matches;

    if (isLandscape) {
      const top =
        card.offsetTop -
        container.clientHeight / 2 +
        card.clientHeight / 2;

      container.scrollTo({
        top: Math.max(0, top),
        behavior,
      });
      return;
    }

    const left =
      card.offsetLeft -
      container.clientWidth / 2 +
      card.clientWidth / 2;

    container.scrollTo({
      left: Math.max(0, left),
      behavior,
    });
  }

  const handleScroll = () => {
    if (programmaticScrollRef.current) return;

    let closestKey: string | null = null;
    let closestDistance = Infinity;

    const isLandscape =
      typeof window !== "undefined" &&
      window.matchMedia("(orientation: landscape)").matches;

    const listRect = cardScrollRef.current?.getBoundingClientRect();

    cardSpots.forEach((spot) => {
      const spotKey = getSpotKey(spot);
      const el = cardRefs.current[spotKey];
      if (!el) return;

      const rect = el.getBoundingClientRect();

      let distance = 0;

      if (isLandscape) {
  const targetY = listRect
    ? listRect.top + 80
    : 160;

  const cardTop = rect.top;
  distance = Math.abs(cardTop - targetY);
} else {
        const viewportCenterX = window.innerWidth / 2;
        const cardCenterX = rect.left + rect.width / 2;
        distance = Math.abs(cardCenterX - viewportCenterX);
      }

      if (distance < closestDistance) {
        closestDistance = distance;
        closestKey = spotKey;
      }
    });

    if (closestKey && closestKey !== selectedSpotKey) {
      setSelectedSpotKey(closestKey);

      saveMapState({
        selectedSpotKey: closestKey,
      });
    }
  };

  useEffect(() => {
    return () => {
      if (programmaticScrollTimerRef.current) {
        clearTimeout(programmaticScrollTimerRef.current);
      }
    };
  }, []);

  function updateCategoryArrows() {
    const element = categoryScrollRef.current;

    if (!element || !categoryPanelOpen) {
      setShowCategoryDownArrow(false);
      setShowCategoryUpArrow(false);
      return;
    }

    const hasOverflow =
      element.scrollHeight > element.clientHeight + 8;

    if (!hasOverflow) {
      setShowCategoryDownArrow(false);
      setShowCategoryUpArrow(false);
      return;
    }

    const isAtBottom =
      element.scrollTop + element.clientHeight >=
      element.scrollHeight - 8;

    setShowCategoryDownArrow(!isAtBottom);
    setShowCategoryUpArrow(isAtBottom);
  }

  function scrollCategoryPanelDown() {
    categoryScrollRef.current?.scrollBy({
      top: Math.max(
        180,
        Math.round(
          (categoryScrollRef.current?.clientHeight || 240) * 0.7,
        ),
      ),
      behavior: "smooth",
    });
  }

  function scrollCategoryPanelToTop() {
    categoryScrollRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    if (!categoryPanelOpen) {
      setShowCategoryDownArrow(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      updateCategoryArrows();
    });

    window.addEventListener("resize", updateCategoryArrows);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateCategoryArrows);
    };
  }, [categoryPanelOpen, displayCategories.length, communityMode]);



  function clearMapFilters() {
    setSearch("");
    setSelectedCategory(null);
    setSelectedSpotKey(null);
    setCategoryPanelOpen(true);
    setShowCards(false);
    restoredRef.current = false;

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(storageKey);
    }
  }

  function toggleTrafficFlow() {
    if (!TOMTOM_API_KEY) {
      setTrafficNotice(
        "TomTom API key is missing. Add NEXT_PUBLIC_TOMTOM_API_KEY to .env.local."
      );
      setShowTrafficFlow(false);
      return;
    }

    setTrafficNotice(null);
    setShowTrafficFlow((prev) => !prev);
  }


  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div
        className={`fixed left-4 right-4 z-[1500] flex items-center gap-3 landscape:left-3 landscape:right-3 ${
          keyboardOpen ? "top-2" : "top-[calc(env(safe-area-inset-top)+12px)]"
        } landscape:top-3`}
      >
        {showAllOnLoad && !communityMode && !selectedCategory && !search && (
          <div className="absolute left-4 top-[78px] z-[1100] rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white shadow-xl landscape:hidden">
            {activeNav === "deals" ? "🔥 DEALS" : "🎉 EVENTS"}
          </div>
        )}

        <div className="relative min-w-0 flex-1">
          <input
            ref={searchInputRef}
            value={search}
            onFocus={() => {
              setTimeout(() => {
                searchInputRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }, 180);
            }}
            onChange={(e) => {
              const value = e.target.value;

              setSearch(value);
              setSelectedCategory(null);
              setSelectedSpotKey(null);
              setCategoryPanelOpen(false);
              setShowCards(true);
              restoredRef.current = false;

              saveMapState({
                search: value,
                selectedCategory: null,
                selectedSpotKey: null,
              });
            }}
            placeholder="Search..."
            className="w-full rounded-2xl border-none bg-white px-5 py-4 pr-12 text-base font-semibold shadow-xl outline-none [-webkit-text-size-adjust:100%] landscape:px-4 landscape:py-3 landscape:pr-11 landscape:text-xs"
          />

          {(search.trim() || selectedCategory) && (
            <button
              type="button"
              onClick={clearMapFilters}
              aria-label="Clear search and category"
              title="Reset map"
              className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-lg font-black leading-none text-gray-700 shadow-sm transition active:scale-90"
            >
              ×
            </button>
          )}
        </div>

      <div className="shrink-0">
  <AuthRefreshWrapper>
    <ProfileButton />
  </AuthRefreshWrapper>
</div>
      </div>

      {categoryPanelOpen && (
        <div className="fixed right-2 top-24 z-[1300] w-[72px] overflow-visible rounded-2xl bg-white/95 shadow-2xl landscape:right-2 landscape:top-16 landscape:w-[68px]">
          <div
            ref={categoryScrollRef}
            onScroll={updateCategoryArrows}
            className="max-h-[72vh] overflow-y-auto rounded-2xl p-1.5 pb-14 scrollbar-hide landscape:max-h-[78vh]"
          >
            <p className="mb-2 text-center text-[9px] font-black leading-tight text-gray-500">
              Category
            </p>

            <div className="space-y-1">
              {communityMode && (
                <Link
                  href="/community/directory"
                  className="flex w-full flex-col items-center justify-center rounded-xl bg-[#C4483A] px-1 py-2 text-center text-[9px] font-black text-white shadow-md active:scale-95"
                >
                  <span className="text-base leading-none">🌐</span>
                  <span className="mt-1 w-full truncate leading-tight">All</span>
                </Link>
              )}

              {[...displayCategories]
                .sort((a, b) => {
                  const aSelected =
                    selectedCategory !== null &&
                    normalizeCategory(a.name) ===
                      normalizeCategory(selectedCategory);

                  const bSelected =
                    selectedCategory !== null &&
                    normalizeCategory(b.name) ===
                      normalizeCategory(selectedCategory);

                  if (aSelected && !bSelected) return -1;
                  if (!aSelected && bSelected) return 1;

                  return a.name.localeCompare(b.name);
                })
                .map((cat) => {
                  const isSelected =
                    selectedCategory !== null &&
                    normalizeCategory(selectedCategory) ===
                      normalizeCategory(cat.name);

                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => selectCategory(cat.name)}
                      title={cat.name}
                      aria-pressed={isSelected}
                      className={`
                        flex flex-col items-center justify-center
                        rounded-xl px-2 py-2
                        text-center text-[10px] font-black
                        transition-all duration-200
                        active:scale-95
                        ${
                          isSelected
     ? "w-[88px] -translate-x-4 border-[3px] border-sky-400 bg-sky-50 text-sky-700 shadow-[0_4px_12px_rgba(56,189,248,0.35)] landscape:w-[84px]"
     : "w-full border-2 border-transparent bg-gray-50 text-[#172033] shadow-sm"
                        }
                      `}
                    >
                      {!isSelected && (
                        <span className="text-base leading-none">
                          {cat.emoji || "🏷️"}
                        </span>
                      )}

                      <span
                        className={`
                          block w-full text-center leading-tight
                          ${
                            isSelected
                              ? "mt-0 whitespace-normal text-[10px]"
                              : "mt-1 truncate text-[9px]"
                          }
                        `}
                      >
                        {cat.name}
                      </span>

                      {isSelected && (
                        <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {(showCategoryDownArrow || showCategoryUpArrow) && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-14 rounded-b-2xl bg-gradient-to-t from-white via-white/85 to-transparent" />
          )}

          {showCategoryDownArrow && (
            <button
              type="button"
              onClick={scrollCategoryPanelDown}
              aria-label="Show more categories"
              className="absolute bottom-1 left-1/2 z-20 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border-2 border-[#E7C7A7] bg-[#F8EFE5] shadow-[0_5px_14px_rgba(107,114,128,0.24)] ring-2 ring-white/80 transition-all duration-200 active:scale-90"
            >
              <span className="animate-bounce text-2xl font-black leading-none text-gray-500">
                ↓
              </span>
            </button>
          )}

          {showCategoryUpArrow && (
            <button
              type="button"
              onClick={scrollCategoryPanelToTop}
              aria-label="Back to top of categories"
              className="absolute bottom-1 left-1/2 z-20 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border-2 border-[#E7C7A7] bg-[#F8EFE5] shadow-[0_5px_14px_rgba(107,114,128,0.24)] ring-2 ring-white/80 transition-all duration-200 active:scale-90"
            >
              <span className="animate-bounce text-2xl font-black leading-none text-gray-500">
                ↑
              </span>
            </button>
          )}
        </div>
      )}

      {!categoryPanelOpen && (
        <button
          onClick={openCategoryPanel}
          className="fixed right-0 top-1/2 z-[1400] -translate-y-1/2 rounded-l-2xl bg-[#172033] px-2 py-7 text-sm font-black text-white shadow-2xl landscape:py-5"
        >
          ☰
        </button>
      )}

      <button
        type="button"
        onClick={toggleTrafficFlow}
        className={`fixed right-[92px] top-[calc(env(safe-area-inset-top)+76px)] z-[1450] flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[18px] shadow-xl transition active:scale-90 landscape:right-[84px] landscape:top-[64px] ${
          showTrafficFlow
            ? "bg-emerald-600 ring-2 ring-emerald-300/70"
            : "bg-[#172033]/95"
        }`}
        aria-label={showTrafficFlow ? "Turn traffic off" : "Turn traffic on"}
        aria-pressed={showTrafficFlow}
        title={showTrafficFlow ? "Traffic on" : "Traffic off"}
      >
        🚦
      </button>

      {trafficNotice && (
        <div className="fixed right-[72px] top-[calc(env(safe-area-inset-top)+122px)] z-[1500] w-[min(320px,calc(100vw-24px))] rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 shadow-xl landscape:top-[110px]">
          <div className="flex items-start justify-between gap-3">
            <span>{trafficNotice}</span>
            <button
              type="button"
              onClick={() => setTrafficNotice(null)}
              className="shrink-0 text-base font-black"
              aria-label="Close notice"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {selectedCategory && !categoryPanelOpen && (
  <button
    type="button"
    onClick={openCategoryPanel}
 className="fixed left-4 top-[88px] z-[1100]
rounded-full
bg-sky-500
px-4 py-2
text-xs
font-bold
text-white
shadow-lg
landscape:left-3
landscape:top-[62px]"
  >
    {selectedCategory}
  </button>
)}

     <MapContainer
  center={INITIAL_MAP_CENTER}
  zoom={INITIAL_MAP_ZOOM}
  zoomControl={false}
  className="h-[100dvh] w-full"
>
        <InitialMapView />

        <ResetMapView
          search={search}
          selectedCategory={selectedCategory}
        />

        <FitFilteredMarkers
          spots={filteredMarkerSpots}
          enabled={Boolean(search.trim() || selectedCategory || showAllOnLoad)}
        />

        <PanToSelectedSpot
          lat={selectedMapSpot?.lat ?? undefined}
          lng={selectedMapSpot?.lng ?? undefined}
        />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={showTrafficFlow ? 0.74 : 1}
        />

        {showTrafficFlow && TOMTOM_API_KEY && (
          <>
            <TileLayer
              attribution="Traffic &copy; TomTom"
              url={`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}&tileSize=256`}
              opacity={1}
              zIndex={500}
            />

            <TileLayer
              attribution="Incidents &copy; TomTom"
              url={`https://api.tomtom.com/traffic/map/4/tile/incidents/s0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}&tileSize=256&t=-1`}
              opacity={1}
              zIndex={650}
            />
          </>
        )}

        <MapEmptyClickHandler
          onToggle={() => {
            if (!categoryPanelOpen) {
              setShowCards((prev) => !prev);
            }
          }}
        />

        {userLocation && (
          <CircleMarker
            center={userLocation}
            radius={9}
            pathOptions={{
              color: "#2563eb",
              fillColor: "#3b82f6",
              fillOpacity: 0.9,
            }}
          />
        )}

        {filteredMarkerSpots
          .filter(
            (spot) =>
              spot.lat !== null &&
              spot.lat !== undefined &&
              spot.lng !== null &&
              spot.lng !== undefined
          )
          .map((spot, index) => {
            const baseKey = getSpotKey(spot);
            const markerKey = `${baseKey}-${index}`;
            const isSelected = baseKey === selectedSpotKey;
            const isKioti = getBusinessId(spot) === 199;
            const isCary = getBusinessId(spot) === 15;
            const isBusiness16 = getBusinessId(spot) === 16;
            const isBusiness10 = getBusinessId(spot) === 10;

            const lat = Number(spot.lat);
            const lng = Number(spot.lng);

            const sameLocationSpots = filteredMarkerSpots.filter(
              (s) =>
                s.lat !== null &&
                s.lat !== undefined &&
                s.lng !== null &&
                s.lng !== undefined &&
                Number(s.lat).toFixed(6) === lat.toFixed(6) &&
                Number(s.lng).toFixed(6) === lng.toFixed(6)
            );

            const sameLocationIndex = sameLocationSpots.findIndex(
              (s) => getSpotKey(s) === baseKey
            );

            // 실제 등록 좌표와 마커 위치가 정확히 일치하도록
            // 중복 좌표에 대한 인위적인 좌표 이동을 사용하지 않습니다.
            const markerOffset = 0;

            return (
              <Marker
                key={markerKey}
                position={[lat + markerOffset, lng + markerOffset]}
                icon={
                  isKioti
                    ? kiotiMarkerIcon
                    : isCary
                    ? caryMarkerIcon
                    : isBusiness16
                    ? business16MarkerIcon
                    : isBusiness10
                    ? business10MarkerIcon
                    : isSelected
                    ? selectedMarkerIcon
                    : markerIcon
                }
                zIndexOffset={
                  isKioti || isCary || isBusiness16 || isBusiness10
                    ? 20000
                    : isSelected
                    ? 10000
                    : sameLocationIndex
                }
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e.originalEvent);

                    if (isKioti || isCary || isBusiness16 || isBusiness10) {
                      window.location.href = getDetailHref(
                        spot,
                        getBusinessId(spot),
                        communityMode
                      );
                      return;
                    }

                    setSelectedSpotKey(baseKey);
                    setCategoryPanelOpen(false);
                    setShowCards(true);
                    restoredRef.current = false;

                    saveMapState({
                      selectedSpotKey: baseKey,
                    });

                    programmaticScrollRef.current = true;

                    if (programmaticScrollTimerRef.current) {
                      clearTimeout(programmaticScrollTimerRef.current);
                    }

                    setTimeout(() => {
                      centerCard(baseKey, "smooth");

                      programmaticScrollTimerRef.current = setTimeout(() => {
                        programmaticScrollRef.current = false;
                      }, 450);
                    }, 80);
                  },
                }}
              >
                <Popup>{spot.name}</Popup>
              </Marker>
            );
          })}
      </MapContainer>

      <div
        ref={cardScrollRef}
        onScroll={handleScroll}
        className={`fixed z-[1000] flex snap-x gap-4 overflow-x-auto px-4 pb-3 pt-2 transition-all duration-300 landscape:left-3 landscape:right-auto landscape:top-[76px] landscape:bottom-5 landscape:w-[210px] landscape:flex-col landscape:gap-2 landscape:overflow-y-auto landscape:overflow-x-hidden landscape:px-0 landscape:pb-0 landscape:pt-0 ${
          showCards
            ? "left-0 right-0 bottom-[82px] opacity-100"
            : "left-0 right-0 bottom-[-360px] opacity-0 landscape:left-[-190px] landscape:right-auto landscape:bottom-5"
        }`}
      >
        <div className="hidden landscape:block landscape:h-[135px] landscape:shrink-0" />

        {cardSpots.map((spot, index) => {
          const spotKey = getSpotKey(spot);
          const cardKey = `${spotKey}-${index}`;
          const businessId = getBusinessId(spot);

          const images =
            spot.image_urls && spot.image_urls.length > 0
              ? spot.image_urls
              : [spot.image_url, spot.image_url_2, spot.image_url_3].filter(Boolean);

          const current = imageIndexes[spotKey] || 0;
          const status = getOpenStatus(spot);
          const firstCoupon = spot.coupons?.[0];

          const eventLabel =
            spot.coupon_badge ||
            firstCoupon?.title ||
            spot.event_title ||
            spot.event_name ||
            spot.coupon_title ||
            spot.deal_title ||
            null;

          return (
            <a
              key={cardKey}
              ref={(el) => {
                cardRefs.current[spotKey] = el;
              }}
              href={getDetailHref(spot, businessId, communityMode)}
              onClick={() => {
                setSelectedSpotKey(spotKey);
                saveMapState({
                  selectedSpotKey: spotKey,
                });
              }}
              className={`w-[88vw] max-w-[420px] shrink-0 snap-center overflow-hidden rounded-[24px] bg-white shadow-2xl iphone:w-[80vw] landscape:flex landscape:h-[135px] landscape:w-[200px] landscape:max-w-[200px] landscape:items-center landscape:gap-2 landscape:rounded-2xl landscape:p-2 landscape:shadow-xl ${
                spotKey === selectedSpotKey
                  ? "border-4 border-red-600"
                  : "border-2 border-white"
              }`}
            >
              <div className="relative h-[145px] w-full overflow-hidden bg-white landscape:h-14 landscape:w-14 landscape:shrink-0 landscape:rounded-xl">
                {images.length > 0 ? (
                  <div
                    id={`image-scroll-${spotKey}`}
                    className="flex h-full w-full snap-x overflow-x-auto scroll-smooth landscape:overflow-hidden"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onScroll={(e) => {
                      const target = e.currentTarget;
                      const width = target.clientWidth;
                      const scrollLeft = target.scrollLeft;

                      if (!width) return;

                      setImageIndexes((prev) => ({
                        ...prev,
                        [spotKey]: Math.round(scrollLeft / width),
                      }));
                    }}
                  >
                    {images.map((image, imageIndex) => (
                      <img
                        key={imageIndex}
                        src={image as string}
                        alt={spot.name}
                        draggable={false}
                        className={`h-full w-full shrink-0 snap-center ${
                          communityMode ? "object-contain" : "object-cover"
                        } landscape:object-cover`}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-gray-400 landscape:text-[9px]">
                    No Photo
                  </div>
                )}

                {eventLabel && (
                  <div className="absolute left-3 top-3 z-40 max-w-[75%] rounded-md bg-yellow-400 px-3 py-1 text-[11px] font-black text-black shadow-md landscape:hidden">
                    <span className="line-clamp-1">{eventLabel}</span>
                  </div>
                )}

                {images.length > 1 && current > 0 && (
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      const c = document.getElementById(`image-scroll-${spotKey}`);
                      if (!c) return;

                      c.scrollTo({
                        left: c.scrollLeft - c.clientWidth,
                        behavior: "smooth",
                      });
                    }}
                    className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white landscape:hidden"
                  >
                    ←
                  </div>
                )}

                {images.length > 1 && current < images.length - 1 && (
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      const c = document.getElementById(`image-scroll-${spotKey}`);
                      if (!c) return;

                      c.scrollTo({
                        left: c.scrollLeft + c.clientWidth,
                        behavior: "smooth",
                      });
                    }}
                    className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white landscape:hidden"
                  >
                    →
                  </div>
                )}

                {images.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 landscape:hidden">
                    {images.map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 w-2 rounded-full ${
                          i === current ? "bg-white" : "bg-white/40"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 bg-gray-100 px-4 py-2  landscape:min-w-0 landscape:flex-1 landscape:border-0 landscape:bg-transparent landscape:p-0">
<div className="flex items-start">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3
  className="
    line-clamp-1
    text-[19px]
    iphone:text-[18px]
    font-black
    text-[#172033]
    leading-tight
    landscape:text-[12px]
    landscape:leading-tight
  "
>
          {spot.name}
        </h3>

        
      </div>
    </div>

  </div>


 <div className="mt-1 flex min-h-[24px] items-center gap-1.5 overflow-hidden landscape:hidden">
  {routeInfo[spotKey] ? (
    <>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[12px] font-black leading-tight text-red-600 shadow-sm">
        <span className="text-[11px] leading-none">🚗</span>
        <span className="whitespace-nowrap">
          {routeInfo[spotKey].minutes} min
        </span>
      </span>

      <span className="shrink-0 whitespace-nowrap text-[12px] font-bold leading-tight text-gray-600">
        {routeInfo[spotKey].miles.toFixed(1)} miles
      </span>

      {typeof spot.rating === "number" && spot.rating > 0 && (
        <span className="inline-flex min-w-0 items-center gap-0.5 whitespace-nowrap text-[12px] font-bold leading-tight text-amber-600">
          <span>⭐</span>
          <span>{spot.rating.toFixed(1)}</span>

          {typeof spot.review_count === "number" &&
            spot.review_count > 0 && (
              <span className="text-[11px] text-gray-500">
                ({spot.review_count})
              </span>
            )}
        </span>
      )}
    </>
  ) : userLocation && spot.distance !== undefined ? (
    <>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[12px] font-black leading-tight text-red-600 shadow-sm">
        <span className="text-[11px] leading-none">🚗</span>
        <span className="whitespace-nowrap">
          {estimateDriveMinutes(spot.distance)} min
        </span>
      </span>

      <span className="shrink-0 whitespace-nowrap text-[12px] font-bold leading-tight text-gray-600">
        {spot.distance.toFixed(1)} miles
      </span>

      {typeof spot.rating === "number" && spot.rating > 0 && (
        <span className="inline-flex min-w-0 items-center gap-0.5 whitespace-nowrap text-[12px] font-bold leading-tight text-amber-600">
          <span>⭐</span>
          <span>{spot.rating.toFixed(1)}</span>

          {typeof spot.review_count === "number" &&
            spot.review_count > 0 && (
              <span className="text-[11px] text-gray-500">
                ({spot.review_count})
              </span>
            )}
        </span>
      )}
    </>
  ) : (
    <>
      <span className="inline-flex min-w-0 items-center gap-1 truncate rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-bold leading-tight text-gray-500 shadow-sm">
        <span className="shrink-0 text-[11px] leading-none">📍</span>
        <span className="truncate">
          Enable location
        </span>
      </span>

      {typeof spot.rating === "number" && spot.rating > 0 && (
        <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[12px] font-bold leading-tight text-amber-600">
          <span>⭐</span>
          <span>{spot.rating.toFixed(1)}</span>

          {typeof spot.review_count === "number" &&
            spot.review_count > 0 && (
              <span className="text-[11px] text-gray-500">
                ({spot.review_count})
              </span>
            )}
        </span>
      )}
    </>
  )}
</div>
</div>

            </a>
          );
        })}

        <div className="hidden landscape:block landscape:h-[calc((100vh-112px)/3)] landscape:shrink-0" />
      </div>

      {!communityMode && (
        <BottomNav activeNav="home" />
      )}

    </div>
  );
}