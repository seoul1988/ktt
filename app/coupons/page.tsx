"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";
import ProfileButton from "../components/ProfileButton";

type Business = {
  id: number;
  name: string | null;
  category: string | null;
  address: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
};

type Coupon = {
  id: number;
  business_id: number;
  title: string;
  description: string | null;
  end_date: string | null;
  active: boolean;
  image_url: string | null;
};

function categoriesOf(value: string | null) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}


declare global {
  interface Window {
    L?: any;
  }
}

type LatLng = {
  latitude: number;
  longitude: number;
};

let leafletLoader: Promise<any> | null = null;

function loadLeaflet() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet is available only in the browser."));
  }

  if (window.L) return Promise.resolve(window.L);
  if (leafletLoader) return leafletLoader;

  leafletLoader = new Promise((resolve, reject) => {
    const existingCss = document.querySelector<HTMLLinkElement>(
      'link[data-ktown-leaflet="css"]',
    );

    if (!existingCss) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.ktownLeaflet = "css";
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-ktown-leaflet="js"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L));
      existingScript.addEventListener("error", () =>
        reject(new Error("Unable to load the map library.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.ktownLeaflet = "js";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Unable to load the map library."));
    document.body.appendChild(script);
  });

  return leafletLoader;
}

function getBusinessCoordinates(business: Business | null): LatLng | null {
  if (!business) return null;

  const latitude = Number(business.latitude ?? business.lat);
  const longitude = Number(business.longitude ?? business.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function TwoPointMap({
  business,
  userLocation,
}: {
  business: Business;
  userLocation: LatLng | null;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const storeCoords = getBusinessCoordinates(business);

  useEffect(() => {
    let cancelled = false;

    async function drawMap() {
      if (!mapElementRef.current || !storeCoords) return;

      try {
        const L = await loadLeaflet();
        if (cancelled || !mapElementRef.current || !L) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = L.map(mapElementRef.current, {
          zoomControl: true,
          attributionControl: true,
        });

        mapInstanceRef.current = map;

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        const storeIcon = L.divIcon({
          className: "",
          html: `
            <div style="
              width:34px;
              height:34px;
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              background:#EB4A45;
              border:3px solid white;
              box-shadow:0 2px 8px rgba(0,0,0,.30);
              display:flex;
              align-items:center;
              justify-content:center;
            ">
              <div style="
                width:10px;
                height:10px;
                border-radius:999px;
                background:white;
              "></div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
        });

        L.marker([storeCoords.latitude, storeCoords.longitude], {
          icon: storeIcon,
        })
          .addTo(map)
          .bindPopup(
            `<strong>${String(business.name || "Store")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")}</strong><br/>Store`,
          );

        const points: [number, number][] = [
          [storeCoords.latitude, storeCoords.longitude],
        ];

        if (userLocation) {
          const myLocationIcon = L.divIcon({
            className: "",
            html: `
              <div style="
                width:24px;
                height:24px;
                border-radius:999px;
                background:#2563EB;
                border:4px solid white;
                box-shadow:0 0 0 2px rgba(37,99,235,.28),0 2px 8px rgba(0,0,0,.25);
              "></div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          L.marker([userLocation.latitude, userLocation.longitude], {
            icon: myLocationIcon,
          })
            .addTo(map)
            .bindPopup("<strong>Your Location</strong>");

          points.push([userLocation.latitude, userLocation.longitude]);

          L.polyline(points, {
            color: "#7C3AED",
            weight: 3,
            opacity: 0.65,
            dashArray: "7 7",
          }).addTo(map);
        }

        if (points.length === 2) {
          map.fitBounds(L.latLngBounds(points), {
            padding: [45, 45],
            maxZoom: 15,
          });
        } else {
          map.setView(
            [storeCoords.latitude, storeCoords.longitude],
            15,
          );
        }

        window.setTimeout(() => {
          map.invalidateSize();
        }, 100);
      } catch (error) {
        console.error("Map load error:", error);
      }
    }

    void drawMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [
    business.id,
    storeCoords?.latitude,
    storeCoords?.longitude,
    userLocation?.latitude,
    userLocation?.longitude,
  ]);

  if (!storeCoords) {
    return (
      <iframe
        title={`${business.name || "Business"} map`}
        src={`https://www.google.com/maps?q=${encodeURIComponent(
          business.address || "",
        )}&output=embed`}
        className="h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return <div ref={mapElementRef} className="h-full w-full" />;
}

export default function CouponsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [mapBusiness, setMapBusiness] = useState<Business | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [businessResult, couponResult] = await Promise.all([
      supabase
        .from("businesses")
        .select("*")
        .order("name", { ascending: true }),
      supabase
        .from("coupons")
        .select("id,business_id,title,description,end_date,active,image_url")
        .eq("active", true)
        .order("created_at", { ascending: false }),
    ]);

    if (businessResult.error) {
      alert(businessResult.error.message);
      setLoading(false);
      return;
    }

    if (couponResult.error) {
      alert(couponResult.error.message);
      setLoading(false);
      return;
    }

    setBusinesses((businessResult.data || []) as Business[]);
    setCoupons((couponResult.data || []) as Coupon[]);
    setLoading(false);
  }

  const appCategories = [
    { id: "ALL", label: "All", icon: "◉" },
    { id: "FOOD", label: "Food", icon: "🍴" },
    { id: "MARKET", label: "Market", icon: "🛒" },
    { id: "BEAUTY", label: "Beauty", icon: "✂" },
    { id: "AUTO", label: "Auto", icon: "🚗" },
    { id: "OTHER", label: "Other", icon: "•••" },
  ] as const;

  function matchesAppCategory(business: Business, selected: string) {
    if (selected === "ALL") return true;

    const values = categoriesOf(business.category).map((v) => v.toLowerCase());
    const joined = values.join(" ");

    const food =
      joined.includes("restaurant") ||
      joined.includes("food") ||
      joined.includes("cafe") ||
      joined.includes("bakery") ||
      joined.includes("chicken") ||
      joined.includes("korean") ||
      joined.includes("chinese") ||
      joined.includes("japanese") ||
      joined.includes("dessert");

    const market =
      joined.includes("market") ||
      joined.includes("grocery") ||
      joined.includes("mart");

    const beauty =
      joined.includes("beauty") ||
      joined.includes("hair") ||
      joined.includes("salon") ||
      joined.includes("spa") ||
      joined.includes("nail");

    const auto =
      joined.includes("auto") ||
      joined.includes("car") ||
      joined.includes("automotive");

    if (selected === "FOOD") return food;
    if (selected === "MARKET") return market;
    if (selected === "BEAUTY") return beauty;
    if (selected === "AUTO") return auto;
    if (selected === "OTHER") return !food && !market && !beauty && !auto;

    return true;
  }

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const businessMap = new Map(businesses.map((b) => [b.id, b]));
    const map = new Map<number, { business: Business; coupons: Coupon[] }>();

    coupons.forEach((coupon) => {
      if (coupon.end_date && new Date(coupon.end_date) < new Date()) return;

      const business = businessMap.get(coupon.business_id);
      if (!business) return;

      if (!matchesAppCategory(business, category)) return;

      const text = [
        business.name,
        business.category,
        business.address,
        coupon.title,
        coupon.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !text.includes(q)) return;

      const existing = map.get(business.id);
      if (existing) existing.coupons.push(coupon);
      else map.set(business.id, { business, coupons: [coupon] });
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.business.name || "").localeCompare(String(b.business.name || "")),
    );
  }, [businesses, coupons, search, category]);

  function openMap(business: Business) {
    openMap(business);
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Your device does not support location.");
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationLoading(false);
      },
      () => {
        setUserLocation(null);
        setLocationLoading(false);
        setLocationError(
          "Location access was not allowed. Store location is shown only.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F5F5] pb-20 text-[#151821]">
      <div className="mx-auto min-h-screen w-full max-w-xl bg-white">
        <header className="sticky top-0 z-30 border-b border-[#ECECEC] bg-white">
          <div className="flex h-12 items-center justify-between px-4">
            <button
              type="button"
              onClick={() => history.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[26px] leading-none text-[#222]"
              aria-label="Back"
            >
              ‹
            </button>

            <h1 className="text-[15px] font-black tracking-[0.02em] text-[#E9413B]">
              COUPONS
            </h1>

            <div className="scale-90">
              <ProfileButton />
            </div>
          </div>

          <div className="px-4 pb-3">
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 fill-none stroke-[#9CA3AF]"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m16.5 16.5 4 4" />
              </svg>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stores or coupons"
                className="h-10 w-full rounded-[10px] border border-[#E4E6E8] bg-white pl-9 pr-3 text-[12px] font-semibold outline-none placeholder:text-[#A7ADB7] focus:border-[#F06A64]"
              />
            </div>

            <div className="mt-3">
              <div className="grid grid-cols-6 gap-1">
                {appCategories.map((item) => {
                  const selected = category === item.id;

                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setCategory(item.id)}
                      className="flex min-w-0 flex-col items-center gap-1"
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-[14px] leading-none ${
                          selected
                            ? "bg-[#EB4A45] text-white"
                            : "bg-[#F2F3F5] text-[#555]"
                        }`}
                      >
                        {item.icon}
                      </span>

                      <span
                        className={`block w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[9px] font-bold ${
                          selected ? "text-[#EB4A45]" : "text-[#737984]"
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {category === "FOOD" && (
                <div className="mt-2 flex items-center gap-4 overflow-x-auto border-t border-[#F1F1F1] pt-2 text-[9px] font-bold text-[#6F7580] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <span className="shrink-0 text-[#EB4A45]">All</span>
                  <span className="shrink-0">Korean</span>
                  <span className="shrink-0">Chicken</span>
                  <span className="shrink-0">Chinese</span>
                  <span className="shrink-0">Japanese</span>
                  <span className="shrink-0">Snack</span>
                  <span className="shrink-0">Cafe</span>
                </div>
              )}
            </div>          </div>
        </header>

        <section className="px-3 pb-4 pt-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-[#EB4A45]">
              {appCategories.find((item) => item.id === category)?.label || "All"}
            </span>
            <span className="text-[9px] font-bold text-[#A0A6AF]">
              {groups.length} stores
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-[12px] font-bold text-gray-400">
              Loading coupons...
            </div>
          ) : groups.length === 0 ? (
            <div className="py-20 text-center">
  <div className="text-5xl">🎟️</div>
  <p className="mt-4 text-[16px] font-black">
    No coupons available.
  </p>
</div>
          ) : (
            <div>
              {groups.map(({ business, coupons }) => {
                const image =
                  coupons.find((c) => c.image_url)?.image_url ||
                  business.image_url ||
                  business.image_urls?.[0] ||
                  "";

                const firstCoupon = coupons[0];

                return (
                  <div
                    key={business.id}
                    className="border-b border-[#EEEEEE]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `/coupons/business/${business.id}`;
                      }}
                      className="flex w-full items-center gap-3 px-1 py-2.5 text-left active:bg-[#FAFAFA]"
                    >
                      <div className="h-[62px] w-[82px] shrink-0 overflow-hidden rounded-[6px] bg-[#F2F2F2]">
                        {image ? (
                          <img
                            src={image}
                            alt={business.name || ""}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-2xl">
                            🏪
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-black uppercase text-[#3C424D]">
                          {business.name || "LOCAL BUSINESS"}
                        </p>

                        <h3 className="mt-0.5 line-clamp-2 text-[14px] font-black leading-[1.15] text-[#111827]">
                          {firstCoupon?.title || "SPECIAL COUPON"}
                        </h3>

                        {firstCoupon?.description && (
                          <p className="mt-1 line-clamp-1 text-[9px] font-semibold text-[#777E88]">
                            {firstCoupon.description}
                          </p>
                        )}
                      </div>

                      <div className="flex min-w-[72px] shrink-0 flex-col items-end justify-center gap-1">
                        <span className="text-[9px] font-black text-[#444B55]">
                          {coupons.length} Coupons
                        </span>

                        {business.address && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              openMap(business);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                openMap(business);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-[#F8F9FA] px-2.5 py-1 text-[9px] font-black text-[#4B5563] active:scale-[0.98]"
                          >
                            <span className="text-[10px]">📍</span>
                            MAP
                          </span>
                        )}

                        <span className="text-[16px] font-light leading-none text-[#B5BAC2]">
                          ›
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {mapBusiness && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-3 sm:items-center"
          onClick={() => setMapBusiness(null)}
        >
          <div
            className="w-full max-w-[430px] overflow-hidden rounded-[24px] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#EEEEEE] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#EB4A45]">
                  Store Location
                </p>
                <h2 className="truncate text-[17px] font-black text-[#171A22]">
                  {mapBusiness.name || "Business"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setMapBusiness(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[20px] font-bold text-[#4B5563]"
                aria-label="Close map"
              >
                ×
              </button>
            </div>

            <div className="relative h-[320px] w-full bg-[#F3F4F6]">
              <TwoPointMap
                business={mapBusiness}
                userLocation={userLocation}
              />

              {locationLoading && (
                <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black text-[#4B5563] shadow">
                  Finding your location...
                </div>
              )}

              {getBusinessCoordinates(mapBusiness) && (
                <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex gap-2 rounded-xl bg-white/95 px-3 py-2 text-[9px] font-black shadow">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    YOU
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    STORE
                  </span>
                </div>
              )}
            </div>

            <div className="p-4">
              <p className="text-[12px] font-bold leading-5 text-[#5F6672]">
                📍 {mapBusiness.address}
              </p>

              <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#F7F8FA] px-3 py-2">
                <span className="text-[13px]">🔵</span>
                <p className="flex-1 text-[10px] font-bold text-[#6B7280]">
                  {locationLoading
                    ? "Finding your location..."
                    : userLocation
                      ? getBusinessCoordinates(mapBusiness)
                        ? "Blue marker is you. Red marker is the store."
                        : "Your location was found, but this store has no saved map coordinates."
                      : locationError || "Current location not available."}
                </p>

                {!locationLoading && (
                  <button
                    type="button"
                    onClick={() => openMap(mapBusiness)}
                    className="shrink-0 rounded-lg bg-white px-2 py-1 text-[9px] font-black text-[#EB4A45] shadow-sm"
                  >
                    MY LOCATION
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMapBusiness(null)}
                  className="rounded-2xl border border-[#E3E5E8] bg-white px-4 py-3 text-[12px] font-black text-[#4B5563]"
                >
                  CLOSE
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const destination = encodeURIComponent(
                      mapBusiness.address || "",
                    );

                    const origin = userLocation
                      ? `&origin=${userLocation.latitude},${userLocation.longitude}`
                      : "";

                    window.open(
                      `https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                  className="rounded-2xl bg-[#EB4A45] px-4 py-3 text-[12px] font-black text-white active:scale-[0.98]"
                >
                  DIRECTIONS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}