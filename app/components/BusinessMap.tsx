"use client";

import Link from "next/link";
import AuthRefreshWrapper from "./AuthRefreshWrapper";


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

// 처음 지도에 표시할 Raleigh 중심 반경입니다.
const INITIAL_MARKER_RADIUS_MILES = 40;

type MapBoundsValue = {
  north: number;
  south: number;
  east: number;
  west: number;
};

function isSpotInsideBounds(
  spot: Spot,
  bounds: MapBoundsValue | null
) {
  if (!bounds) return false;

  const lat = Number(spot.lat);
  const lng = Number(spot.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  return (
    lat <= bounds.north &&
    lat >= bounds.south &&
    lng <= bounds.east &&
    lng >= bounds.west
  );
}

function isSpotInsideInitialRadius(spot: Spot) {
  const lat = Number(spot.lat);
  const lng = Number(spot.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  return (
    milesBetween(INITIAL_MAP_CENTER, [lat, lng]) <=
    INITIAL_MARKER_RADIUS_MILES
  );
}

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
      width:44px;
      height:44px;
      overflow:hidden;
      border-radius:50%;
      border:3px solid white;
      background:#000;
      box-shadow:0 3px 10px rgba(0,0,0,.45);
    ">
      <img
        src="/images/kioti-logo.jpg"
        alt="KIOTI"
        style="display:block;width:100%;height:100%;object-fit:cover;"
      />
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -24],
});

const caryMarkerIcon = L.divIcon({
  className: "cary-map-marker",
  html: `
    <div style="
      width:44px;
      height:44px;
      overflow:hidden;
      border-radius:50%;
      border:3px solid white;
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
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -24],
});



const business16MarkerIcon = L.divIcon({
  className: "business16-map-marker",
  html: `
    <div style="
      width:44px;
      height:44px;
      overflow:hidden;
      border-radius:50%;
      border:3px solid white;
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
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -24],
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

    /*
     * 선택한 마커를 화면 중앙에 먼저 놓은 뒤 다시 panBy 하지 않고,
     * 카드에 가리지 않는 최종 중심 좌표를 미리 계산하여 한 번에 이동합니다.
     */
    const offsetY = isMobilePortrait ? 110 : 45;

    const markerPoint = map.project(
      [lat, lng],
      INITIAL_MAP_ZOOM
    );

    const adjustedCenterPoint = markerPoint.add([0, offsetY]);

    const adjustedCenter = map.unproject(
      adjustedCenterPoint,
      INITIAL_MAP_ZOOM
    );

    map.stop();

    map.setView(adjustedCenter, INITIAL_MAP_ZOOM, {
      animate: true,
      duration: 0.3,
    });
  }, [lat, lng, map]);

  return null;
}

function MapViewportWatcher({
  ignoreMoveRef,
  onMapMoved,
}: {
  ignoreMoveRef: React.MutableRefObject<boolean>;
  onMapMoved: (bounds: MapBoundsValue) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      if (ignoreMoveRef.current) return;

      const bounds = map.getBounds();

      onMapMoved({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    },
  });

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
}: {
  spots: Spot[];
  markerSpots?: Spot[];
  categories?: MapCategory[];
  showAllOnLoad?: boolean;
  activeNav?: "home" | "map" | "deals" | "events" | "community" | "admin";
  communityMode?: boolean;
  role?: string | null;
  initialCategory?: string;
}) {
  const [search, setSearch] = useState("");
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

  // 지도 이동 후 사용자가 "이 지역에서 검색"을 눌렀을 때 적용할 범위입니다.
  // null이면 Raleigh 중심 반경 40마일을 사용합니다.
  const [activeSearchBounds, setActiveSearchBounds] =
    useState<MapBoundsValue | null>(null);
  const [pendingSearchBounds, setPendingSearchBounds] =
    useState<MapBoundsValue | null>(null);
  const [showSearchAreaButton, setShowSearchAreaButton] = useState(false);

  const ignoreMapMoveRef = useRef(false);
  const ignoreMapMoveTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const cardRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const cardScrollRef = useRef<HTMLDivElement | null>(null);
  const restoredRef = useRef(false);

  // 마커 클릭으로 카드를 이동하는 동안 onScroll이 다른 카드를
  // 다시 선택하지 못하도록 잠시 막습니다.
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const storageKey = `${MAP_STATE_KEY}-${communityMode ? "community" : activeNav}`;

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
  }, [markerSpots, spots, kiotiSpot, carySpot, business16Spot]);

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
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      if (typeof parsed.search === "string") setSearch(parsed.search);
    if (initialCategory) {
  setSelectedCategory(initialCategory);
  setCategoryPanelOpen(false);
  setShowCards(true);
} else if (parsed.selectedCategory) {
  setSelectedCategory(parsed.selectedCategory);
}
      if (parsed.selectedSpotKey) setSelectedSpotKey(parsed.selectedSpotKey);

      setCategoryPanelOpen(false);
      setShowCards(true);
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

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
      const isPermanentMarker = [199, 15, 16].includes(
        getBusinessId(spot)
      );

      // 199, 15, 16은 검색, 카테고리, 지도 범위와 관계없이 항상 표시합니다.
      if (isPermanentMarker) {
        return true;
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

  const visibleMarkerSpots = useMemo(() => {
    return filteredMarkerSpots.filter((spot) => {
      const businessId = getBusinessId(spot);

      // 특별 마커는 항상 표시합니다.
      if ([199, 15, 16].includes(businessId)) {
        return true;
      }

      // 카드가 선택되면 현재 지도 검색 범위 밖이어도 해당 마커를 표시합니다.
      if (selectedSpotKey && getSpotKey(spot) === selectedSpotKey) {
        return true;
      }

      // "이 지역에서 검색"을 누른 뒤에는 현재 지도 화면 범위를 사용합니다.
      if (activeSearchBounds) {
        return isSpotInsideBounds(spot, activeSearchBounds);
      }

      // 처음에는 Raleigh 중심 반경 40마일 안의 마커만 표시합니다.
      return isSpotInsideInitialRadius(spot);
    });
  }, [
    filteredMarkerSpots,
    activeSearchBounds,
    selectedSpotKey,
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

  useEffect(() => {
    // 검색 결과 자동 맞춤 또는 카드 선택으로 지도가 움직일 때
    // "이 지역에서 검색" 버튼이 잘못 나타나는 것을 막습니다.
    if (
      selectedMapSpot ||
      search.trim() ||
      selectedCategory ||
      showAllOnLoad
    ) {
      ignoreMapMoveRef.current = true;

      if (ignoreMapMoveTimerRef.current) {
        clearTimeout(ignoreMapMoveTimerRef.current);
      }

      ignoreMapMoveTimerRef.current = setTimeout(() => {
        ignoreMapMoveRef.current = false;
      }, 900);
    }
  }, [
    selectedMapSpot,
    search,
    selectedCategory,
    showAllOnLoad,
    visibleMarkerSpots,
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
      cardRefs.current[selectedSpotKey]?.scrollIntoView({
        behavior: "auto",
        inline: "center",
        block: "center",
      });

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

      if (ignoreMapMoveTimerRef.current) {
        clearTimeout(ignoreMapMoveTimerRef.current);
      }
    };
  }, []);



  return (
    <div className="relative min-h-screen">
      <div className="absolute left-4 right-4 top-5 z-[1000] flex items-center gap-3 landscape:left-3 landscape:right-3 landscape:top-3">
        {showAllOnLoad && !communityMode && !selectedCategory && !search && (
          <div className="absolute left-4 top-[78px] z-[1100] rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white shadow-xl landscape:hidden">
            {activeNav === "deals" ? "🔥 DEALS" : "🎉 EVENTS"}
          </div>
        )}

        <input
          value={search}
          onChange={(e) => {
            const value = e.target.value;

            setSearch(value);
            setSelectedCategory(null);

            // 이전 검색에서 선택된 카드와 마커를 해제합니다.
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
          placeholder="업체명 또는 태그 검색..."
          className="flex-1 rounded-2xl border-none bg-white px-5 py-4 text-sm font-semibold shadow-xl outline-none landscape:px-4 landscape:py-3 landscape:text-xs"
        />

      <div className="shrink-0">
  <AuthRefreshWrapper>
    <ProfileButton />
  </AuthRefreshWrapper>
</div>
      </div>

      {categoryPanelOpen && (
  <div className="fixed right-2 top-24 z-[1300] max-h-[72vh] w-[72px] overflow-y-auto rounded-2xl bg-white/95 p-1.5 shadow-2xl scrollbar-hide landscape:right-2 landscape:top-16 landscape:max-h-[78vh] landscape:w-[68px]">
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

      {displayCategories.map((cat) => (
        <button
          key={cat.name}
          onClick={() => selectCategory(cat.name)}
          title={cat.name}
          className="flex w-full flex-col items-center justify-center rounded-xl bg-gray-50 px-1 py-2 text-center text-[9px] font-black text-[#172033] shadow-sm active:scale-95"
        >
          <span className="text-base leading-none">
            {cat.emoji || "🏷️"}
          </span>

          <span className="mt-1 block w-full truncate text-[9px] leading-tight">
            {cat.name}
          </span>
        </button>
      ))}
    </div>
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

      {selectedCategory && !categoryPanelOpen && (
        <div className="fixed left-4 top-[88px] z-[1100] rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-[#172033] shadow-xl landscape:left-3 landscape:top-[62px]">
          {selectedCategory}
        </div>
      )}

      {showSearchAreaButton && pendingSearchBounds && (
        <button
          type="button"
          onClick={() => {
            setActiveSearchBounds(pendingSearchBounds);
            setShowSearchAreaButton(false);
            setSelectedSpotKey(null);
            setShowCards(true);
          }}
          className="fixed left-1/2 top-[86px] z-[1500] -translate-x-1/2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#172033] shadow-2xl active:scale-95 landscape:top-[62px] landscape:px-4 landscape:py-2 landscape:text-xs"
        >
          🔍 이 지역에서 검색
        </button>
      )}

     <MapContainer
  center={INITIAL_MAP_CENTER}
  zoom={INITIAL_MAP_ZOOM}
  zoomControl={false}
  className="h-screen w-full"
>
        <InitialMapView />

        <ResetMapView
          search={search}
          selectedCategory={selectedCategory}
        />

        <MapViewportWatcher
          ignoreMoveRef={ignoreMapMoveRef}
          onMapMoved={(bounds) => {
            setPendingSearchBounds(bounds);
            setShowSearchAreaButton(true);
          }}
        />

        <FitFilteredMarkers
          spots={visibleMarkerSpots}
          enabled={Boolean(search.trim() || selectedCategory || showAllOnLoad)}
        />

        <PanToSelectedSpot
          lat={selectedMapSpot?.lat ?? undefined}
          lng={selectedMapSpot?.lng ?? undefined}
        />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

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

        {visibleMarkerSpots
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

            const lat = Number(spot.lat);
            const lng = Number(spot.lng);

            const sameLocationSpots = visibleMarkerSpots.filter(
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
                    : isSelected
                    ? selectedMarkerIcon
                    : markerIcon
                }
                zIndexOffset={
                  isKioti || isCary || isBusiness16
                    ? 20000
                    : isSelected
                    ? 10000
                    : sameLocationIndex
                }
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e.originalEvent);

                    if (isKioti || isCary || isBusiness16) {
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

                    setTimeout(() => {
                      cardRefs.current[baseKey]?.scrollIntoView({
                        behavior: "smooth",
                        inline: "center",
                        block: "nearest",
                      });
                    }, 50);
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

              <div className="border-t border-gray-200 bg-gray-100 px-4 pb-4 pt-3 landscape:min-w-0 landscape:flex-1 landscape:border-0 landscape:bg-transparent landscape:p-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-xl font-black text-[#172033] landscape:text-[12px] landscape:leading-tight">
                    {spot.name}
                  </h3>

                  <div className="flex shrink-0 items-center gap-2 landscape:hidden">
                    <button
                      onClick={(e) => toggleLike(e, businessId)}
                      className={`rounded-full border px-2 py-1 text-xs font-bold ${
                        likedIds[businessId]
                          ? "border-red-200 bg-red-50 text-red-500"
                          : "border-pink-100 bg-pink-50 text-pink-500"
                      }`}
                    >
                      {likedIds[businessId] ? "♥" : "♡"}{" "}
                      {likeCounts[businessId] || 0}
                    </button>

                    <div
                      className={`rounded-full px-3 py-1 text-[9px] font-extrabold ${
                        status.text === "Open"
                          ? "bg-green-100 text-green-700"
                          : status.text === "Break Time"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-white text-gray-600"
                      }`}
                    >
                      {status.text}
                    </div>
                  </div>
                </div>

                <p className="mt-1 text-sm font-semibold text-gray-700 landscape:hidden">
                  {spot.category} · {spot.city || "Triangle"}
                  {spot.rating && (
                    <>
                      {" · "}⭐ {spot.rating}
                      {spot.review_count ? ` (${spot.review_count})` : ""}
                    </>
                  )}
                </p>

                <p className="mt-1 text-sm font-bold text-[#2453A6] landscape:hidden">
                  {userLocation && spot.distance !== undefined
                    ? `${spot.distance.toFixed(1)} miles away`
                    : "Near Triangle"}
                </p>
              </div>
            </a>
          );
        })}

        <div className="hidden landscape:block landscape:h-[calc((100vh-112px)/3)] landscape:shrink-0" />
      </div>

      {!communityMode && (
        <nav className="fixed bottom-4 left-1/2 z-[1000] flex w-[90%] max-w-md -translate-x-1/2 justify-around rounded-3xl bg-[#172033] px-4 py-3 text-xs font-semibold text-white shadow-2xl landscape:bottom-3 landscape:w-[70%] landscape:max-w-sm landscape:py-2 landscape:text-[11px]">
          <a href="/" className={activeNav === "home" ? "text-[#F7B955]" : undefined}>
            Home
          </a>

          <a href="/map" className={activeNav === "map" ? "text-[#F7B955]" : undefined}>
            Map
          </a>

          <a
            href="/deals"
            className={activeNav === "deals" ? "text-[#F7B955]" : undefined}
          >
            Deals
          </a>

          <a
            href="/community"
            className={activeNav === "community" ? "text-[#F7B955]" : undefined}
          >
            Community
          </a>

          {myRole === "admin" && (
            <a
              href="/admin"
              className={activeNav === "admin" ? "text-[#F7B955]" : undefined}
            >
              ADMIN
            </a>
          )}
        </nav>
      )}
    </div>
  );
} 