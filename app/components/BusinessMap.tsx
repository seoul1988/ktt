"use client";

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

type MapCategory = {
  id?: number;
  name: string;
  emoji: string | null;
};

type Spot = {
  id: number;
  name: string;
  category: string | null;
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
  tags?: string | null;
  event_title?: string | null;
  event_name?: string | null;
  coupon_title?: string | null;
  deal_title?: string | null;
  coupon_badge?: string | null;
  coupon_count?: number | null;
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

function hasPromotion(spot: Spot) {
  if (spot.coupon_badge || spot.coupon_count) return true;
  if (spot.coupons && spot.coupons.length > 0) return true;
  if (spot.event_title || spot.event_name || spot.coupon_title || spot.deal_title) return true;

  const tagText = String(spot.tags || "").toLowerCase();
  return (
    tagText.includes("coupon") ||
    tagText.includes("event") ||
    tagText.includes("deal") ||
    tagText.includes("discount") ||
    tagText.includes("special")
  );
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

  const currentMinutes =
    now
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

  if (line.includes("Closed")) {
    return { text: "Closed Today" };
  }

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

function MoveMap({ lat, lng }: { lat?: number; lng?: number }) {
  const map = useMap();
  const movedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lat || !lng) return;

    const key = `${lat},${lng}`;

    if (movedRef.current === key) return;

    movedRef.current = key;

   map.flyTo(
  [lat - 0.20, lng],
  Math.max(map.getZoom() - 2, 9),
  {
    animate: true,
  }
);
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
  categories = [],
  showAllOnLoad = false,
  activeNav = "map",
  communityMode = false,
  role = null,
}: {
  spots: Spot[];
  categories?: MapCategory[];
  showAllOnLoad?: boolean;
  activeNav?: "home" | "map" | "deals" | "events" | "community" | "admin";
  communityMode?: boolean;
  role?: string | null;
}) {

  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] =
    useState<[number, number] | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(!showAllOnLoad);
  const [showCards, setShowCards] = useState(showAllOnLoad);
  const [imageIndexes, setImageIndexes] = useState<Record<number, number>>({});
  const [likedIds, setLikedIds] = useState<Record<number, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [mapCategories, setMapCategories] = useState<MapCategory[]>([]);
  const [myRole, setMyRole] = useState<string | null>(role);
  const displayCategories = useMemo(() => {
    if (mapCategories.length > 0) {
      return mapCategories;
    }

    // If this is community map and no community categories are checked,
    // do not force Marketplace to show.
    if (communityMode) {
      return [];
    }

    const names = new Set<string>();

    spots.forEach((spot) => {
      String(spot.category || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .forEach((v) => names.add(v));
    });

    return Array.from(names)
      .sort()
      .map((name) => ({
        name,
        emoji: "🏷️",
      }));
  }, [communityMode, mapCategories, spots]);
	
	
  const cardRefs = useRef<Record<number, HTMLAnchorElement | null>>({});

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
    return spots.filter((spot) => {
      const searchText = `
	  ${spot.name || ""}
	  ${spot.category || ""}
	  ${spot.tags || ""}
	  ${spot.city || ""}
	  ${spot.description || ""}
	  ${spot.coupon_badge || ""}
	`.toLowerCase();

      const spotCategories = String(spot.category || "")
        .split(",")
        .map((item) => normalizeCategory(item));

      const matchesSearch = search
        ? searchText.includes(search.trim().toLowerCase())
        : true;

      const matchesCategory = selectedCategory
        ? spotCategories.includes(normalizeCategory(selectedCategory))
        : true;

     if (!selectedCategory && !search) {
  if (showAllOnLoad) return true;
  return false;
}





      return matchesSearch && matchesCategory;
    });
  }, [spots, search, selectedCategory, showAllOnLoad]);

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

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.id - b.id;
  });
}, [mapSpots, userLocation]);

useEffect(() => {
  setSelectedSpotId(cardSpots[0]?.id || null);
}, [cardSpots]);

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
    setCategoryPanelOpen(false);
    setShowCards(true);
  }

  function openCategoryPanel() {
    setCategoryPanelOpen(true);
    setShowCards(false);
  }

  const handleScroll = () => {
    let closestId: number | null = null;
    let closestDistance = Infinity;

    cardSpots.forEach((spot) => {
      const el = cardRefs.current[spot.id];
      if (!el) return;

      const distance = Math.abs(el.getBoundingClientRect().left - 16);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = spot.id;
      }
    });

    if (closestId) {
      setSelectedSpotId(closestId);
    }
  };

  const selectedMapSpot = mapSpots.find(
    (v) => v.id === selectedSpotId && v.lat && v.lng
  );

  return (
    <div className="relative min-h-screen">
      <div className="absolute left-4 right-4 top-5 z-[1000] flex items-center gap-3">
{showAllOnLoad &&
  !communityMode &&
  !selectedCategory &&
  !search && (
    <div className="absolute left-4 top-[78px] z-[1100] rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white shadow-xl">
      {activeNav === "deals" ? "🔥 DEALS" : "🎉 EVENTS"}
    </div>
)}
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedCategory(null);
            setCategoryPanelOpen(false);
            setShowCards(true);
          }}
          placeholder="Search Korean spots..."
          className="flex-1 rounded-2xl border-none bg-white px-5 py-4 text-sm font-semibold shadow-xl outline-none"
        />

        <div className="shrink-0">
          <ProfileButton />
        </div>
      </div>

      {categoryPanelOpen && (
        <div className="fixed right-0 top-24 z-[1300] max-h-[72vh] w-[88px] overflow-y-auto rounded-l-[24px] bg-white p-2 shadow-2xl scrollbar-hide">
          <p className="mb-3 text-center text-xs font-extrabold text-gray-500">
            Category
          </p>

          <div className="space-y-1 overflow-y-auto">
            {displayCategories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => selectCategory(cat.name)}
                className="flex w-full flex-col items-center justify-center rounded-xl bg-gray-50 px-1 py-2 text-[10px] font-extrabold text-[#172033] shadow-sm active:scale-95"
              >
                <span className="text-lg">{cat.emoji || "🏷️"}</span>
                <span className="mt-1 leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!categoryPanelOpen && (
        <button
          onClick={openCategoryPanel}
          className="fixed right-0 top-1/2 z-[1400] -translate-y-1/2 rounded-l-2xl bg-[#172033] px-2 py-7 text-sm font-black text-white shadow-2xl"
        >
          ☰
        </button>
      )}

      {selectedCategory && !categoryPanelOpen && (
        <div className="fixed left-4 top-[88px] z-[1100] rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-[#172033] shadow-xl">
          {selectedCategory}
        </div>
      )}

      <MapContainer
        center={userLocation || [35.7796, -78.6382]}
        zoom={12}
        zoomControl={false}
        className="h-screen w-full"
      >
        <MoveMap
          lat={selectedMapSpot?.lat || undefined}
          lng={selectedMapSpot?.lng || undefined}
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

        {mapSpots
          .filter((spot) => spot.lat && spot.lng)
          .map((spot) => (
            <Marker
              key={spot.id}
              position={[spot.lat as number, spot.lng as number]}
              icon={
                spot.id === selectedSpotId ? selectedMarkerIcon : markerIcon
              }
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e.originalEvent);

                  setSelectedSpotId(spot.id);
                  setCategoryPanelOpen(false);
                  setShowCards(true);

                  cardRefs.current[spot.id]?.scrollIntoView({
                    behavior: "smooth",
                    inline: "center",
                    block: "nearest",
                  });
                },
              }}
            >
              <Popup>{spot.name}</Popup>
            </Marker>
          ))}
      </MapContainer>

      <div
        onScroll={handleScroll}
        className={`fixed left-0 right-0 z-[1000] flex snap-x gap-4 overflow-x-auto px-4 pb-3 pt-2 transition-all duration-300 ${
          showCards
            ? "bottom-[82px] opacity-100"
            : "bottom-[-360px] opacity-0"
        }`}
      >
        {cardSpots.map((spot) => {
          const images =
            spot.image_urls && spot.image_urls.length > 0
              ? spot.image_urls
              : [spot.image_url, spot.image_url_2, spot.image_url_3].filter(
                  Boolean
                );

          const current = imageIndexes[spot.id] || 0;
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
              key={spot.id}
              ref={(el) => {
                cardRefs.current[spot.id] = el;
              }}
              href={`/business/${spot.id}`}
              className={`
                w-[88vw]
                iphone:w-[80vw]
                max-w-[420px]
                shrink-0
                snap-center
                rounded-[28px]
                border-4
                bg-white
                p-[6px]
                shadow-2xl
                ${
                  spot.id === selectedSpotId
                    ? "border-red-500"
                    : "border-transparent"
                }
              `}
            >
              <div className="flex flex-col gap-1">
                <div className="relative h-[125px] w-full overflow-hidden rounded-[22px] bg-gray-100">
                  {images.length > 0 ? (
                    <div
                      id={`image-scroll-${spot.id}`}
                      className="flex h-full w-full snap-x overflow-x-auto scroll-smooth"
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
                          [spot.id]: Math.round(scrollLeft / width),
                        }));
                      }}
                    >
                      {images.map((image, imageIndex) => (
                        <img
                          key={imageIndex}
                          src={image as string}
                          alt={spot.name}
                          draggable={false}
                          className="h-full w-full shrink-0 snap-center object-cover"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-gray-400">
                      No Photo
                    </div>
                  )}

                  {eventLabel && (
                    <div className="absolute left-3 top-3 z-40 max-w-[75%] rounded-md bg-yellow-400 px-3 py-1 text-[11px] font-black text-black shadow-md">
                      <span className="line-clamp-1">{eventLabel}</span>
                    </div>
                  )}

                  {images.length > 1 && current > 0 && (
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const c = document.getElementById(
                          `image-scroll-${spot.id}`
                        );

                        if (!c) return;

                        c.scrollTo({
                          left: c.scrollLeft - c.clientWidth,
                          behavior: "smooth",
                        });
                      }}
                      className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white"
                    >
                      ←
                    </div>
                  )}

                  {images.length > 1 && current < images.length - 1 && (
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const c = document.getElementById(
                          `image-scroll-${spot.id}`
                        );

                        if (!c) return;

                        c.scrollTo({
                          left: c.scrollLeft + c.clientWidth,
                          behavior: "smooth",
                        });
                      }}
                      className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white"
                    >
                      →
                    </div>
                  )}

                  {images.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
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

                <div className="px-1 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-xl font-bold">
                      {spot.name}
                    </h3>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={(e) => toggleLike(e, spot.id)}
                        className={`rounded-full border px-2 py-1 text-xs font-bold ${
                          likedIds[spot.id]
                            ? "border-red-200 bg-red-50 text-red-500"
                            : "border-pink-100 bg-pink-50 text-pink-500"
                        }`}
                      >
                        {likedIds[spot.id] ? "♥" : "♡"}{" "}
                        {likeCounts[spot.id] || 0}
                      </button>

                      <div
                        className={`rounded-full px-3 py-1 text-[9px] font-extrabold ${
                          status.text === "Open"
                            ? "bg-green-100 text-green-700"
                            : status.text === "Break Time"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {status.text}
                      </div>
                    </div>
                  </div>

                  <p className="mt-1 text-sm text-gray-600">
                    {spot.category} · {spot.city || "Triangle"}
                    {spot.rating && (
                      <>
                        {" · "}⭐ {spot.rating}
                        {spot.review_count ? ` (${spot.review_count})` : ""}
                      </>
                    )}
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#2453A6]">
                    {userLocation && spot.distance !== undefined
                      ? `${spot.distance.toFixed(1)} miles away`
                      : "Near Triangle"}
                  </p>

                  <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                    {spot.description || "Tap to view details"}
                  </p>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {!communityMode && (
  <nav className="fixed bottom-4 left-1/2 z-[1000] flex w-[90%] max-w-md -translate-x-1/2 justify-around rounded-3xl bg-[#172033] px-4 py-3 text-xs font-semibold text-white shadow-2xl">
  <a
    href="/"
    className={activeNav === "home" ? "text-[#F7B955]" : undefined}
  >
    Home
  </a>

  <a
    href="/map"
    className={activeNav === "map" ? "text-[#F7B955]" : undefined}
  >
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