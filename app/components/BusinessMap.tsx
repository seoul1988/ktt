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

type Spot = {
  id: number;
  name: string;
  category: string;
  city: string;
  image_url: string;
  image_url_2?: string | null;
  image_url_3?: string | null;
  description?: string | null;
  rating?: number | null;
  lat?: number | null;
  lng?: number | null;
  open_time?: string | null;
  close_time?: string | null;
  break_start?: string | null;
  break_end?: string | null;
  closed_days?: string | null;
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

function timeToMinutes(time?: string | null) {
  if (!time) return null;

  const [hour, minute] = String(time).split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return hour * 60 + minute;
}

function getOpenStatus(spot: Spot) {
  const now = new Date();

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  }).format(now);

  const currentTime = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  }).format(now);

  const currentMinutes = timeToMinutes(currentTime);
  const openMinutes = timeToMinutes(spot.open_time);
  const closeMinutes = timeToMinutes(spot.close_time);
  const breakStart = timeToMinutes(spot.break_start);
  const breakEnd = timeToMinutes(spot.break_end);

  const isClosedDay =
    spot.closed_days &&
    String(spot.closed_days).toLowerCase().includes(today.toLowerCase());

  const isBreakTime =
    currentMinutes !== null &&
    breakStart !== null &&
    breakEnd !== null &&
    currentMinutes >= breakStart &&
    currentMinutes < breakEnd;

  const isOpen =
    !isClosedDay &&
    !isBreakTime &&
    currentMinutes !== null &&
    openMinutes !== null &&
    closeMinutes !== null &&
    currentMinutes >= openMinutes &&
    currentMinutes < closeMinutes;

  if (isClosedDay) return { text: "Closed Today" };
  if (isBreakTime) return { text: "Break Time" };
  if (isOpen) return { text: "Open" };

  return { text: "Closed" };
}

function MoveMap({ spot }: { spot: Spot | null }) {
  const map = useMap();

  useEffect(() => {
    if (spot?.lat && spot?.lng) {
      const zoom = 14;
      const target = L.latLng(spot.lat, spot.lng);
      const offsetY = 180;

      const point = map.project(target, zoom);
      const adjustedPoint = L.point(point.x, point.y + offsetY);
      const adjustedCenter = map.unproject(adjustedPoint, zoom);

      map.flyTo(adjustedCenter, zoom, {
        duration: 0.8,
      });
    }
  }, [spot, map]);

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

export default function BusinessMap({ spots }: { spots: Spot[] }) {
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] =
    useState<[number, number] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCards, setShowCards] = useState(true);
  const [imageIndexes, setImageIndexes] = useState<Record<number, number>>({});

  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      setUserLocation([
        position.coords.latitude,
        position.coords.longitude,
      ]);
    });
  }, []);

  const sortedSpots = useMemo(() => {
    const valid = spots.filter((spot) => spot.lat && spot.lng);

    const searched = valid.filter((spot) => {
      const text = `${spot.name} ${spot.category} ${spot.city}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });

    if (!userLocation) return searched;

    return searched
      .map((spot) => ({
        ...spot,
        distance: milesBetween(userLocation, [
          spot.lat as number,
          spot.lng as number,
        ]),
      }))
      .filter((spot) => spot.distance <= 20)
      .sort((a, b) => a.distance - b.distance);
  }, [spots, search, userLocation]);

  const selectedSpot = sortedSpots[selectedIndex] || null;

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleScroll = () => {
    const positions = cardRefs.current.map((el) =>
      el ? Math.abs(el.getBoundingClientRect().left - 16) : Infinity
    );

    const closest = positions.indexOf(Math.min(...positions));

    if (closest !== -1) {
      setSelectedIndex(closest);
    }
  };

  return (
    <div className="relative min-h-screen">
	
	
	
     <div
  className="
    absolute
    left-4
    right-4
    top-5
    z-[1000]
    flex
    items-center
    gap-3
  "
>

  <input
    value={search}
    onChange={(e) => {
      setSearch(e.target.value);
      setShowCards(true);
    }}
    placeholder="Search Korean spots..."
    className="
      flex-1
      rounded-2xl
      border-none
      bg-white
      px-5
      py-4
      text-sm
      font-semibold
      shadow-xl
      outline-none
    "
  />

  <div className="shrink-0">
    <ProfileButton />
  </div>

</div>
	  
	  
	  
	  
	  

      <MapContainer
        center={userLocation || [35.7796, -78.6382]}
        zoom={12}
        zoomControl={false}
        className="h-screen w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MoveMap spot={selectedSpot} />

        <MapEmptyClickHandler
          onToggle={() => {
            setShowCards((prev) => !prev);
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

        {sortedSpots.map((spot, index) => (
          <Marker
            key={spot.id}
            position={[spot.lat as number, spot.lng as number]}
            icon={index === selectedIndex ? selectedMarkerIcon : markerIcon}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);

                setSelectedIndex(index);
                setShowCards(true);

                cardRefs.current[index]?.scrollIntoView({
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
        {sortedSpots.map((spot, index) => {
          const images = [
            spot.image_url,
            spot.image_url_2,
            spot.image_url_3,
          ].filter(Boolean);

          const current = imageIndexes[spot.id] || 0;
          const status = getOpenStatus(spot);

          return (
            <a
              key={spot.id}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              href={`/business/${spot.id}`}
              className={`w-[88vw] max-w-[420px] shrink-0 snap-center rounded-[28px] border-4 bg-white p-3 shadow-2xl ${
                index === selectedIndex
                  ? "border-red-500"
                  : "border-transparent"
              }`}
            >
              <div className="flex flex-col gap-3">
                <div className="relative h-[170px] w-full overflow-hidden rounded-[22px] bg-gray-100">
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
					<div className="rounded-full border border-pink-100 bg-pink-50 px-2 py-1 text-xs font-bold text-pink-500">
					  ♡ 0
					</div>

					<div
					  className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
						status.text === "Open"
						  ? "bg-green-100 text-green-700"
						  : status.text === "Break Time"
						  ? "bg-orange-100 text-orange-700"
						  : ":bg-gray-100 text-gray-600"
					  }`}
					>
                      {status.text}
                    </div>
                  </div>
               </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {spot.category} · {spot.city}
                  </p>

                  {spot.break_start && spot.break_end && (
                    <p className="mt-1 text-xs text-orange-500">
                      Break {spot.break_start}–{spot.break_end}
                    </p>
                  )}

                  <p className="mt-1 text-sm font-semibold text-[#2453A6]">
                    {userLocation && "distance" in spot
                      ? `${(spot as any).distance.toFixed(1)} miles away`
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

      <nav className="fixed bottom-4 left-1/2 z-[1000] flex w-[90%] max-w-md -translate-x-1/2 justify-around rounded-3xl bg-[#172033] px-4 py-3 text-xs font-semibold text-white shadow-2xl">
        <a href="/">Home</a>

        <a href="/map" className="text-[#F7B955]">
          Map
        </a>

        <a href="/deals">Deals</a>

        <a href="/community">Community</a>
      </nav>
    </div>
  );
}