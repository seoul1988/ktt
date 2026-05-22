"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
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

function MoveMap({ spot }: { spot: Spot | null }) {
  const map = useMap();

  useEffect(() => {
    if (spot?.lat && spot?.lng) {
      const zoom = 14;
      const target = L.latLng(spot.lat, spot.lng);

      // 카드가 아래에 있으므로 마커가 화면 중앙보다 조금 위에 보이게 조정
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

export default function BusinessMap({ spots }: { spots: Spot[] }) {
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] =
    useState<[number, number] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

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
      <div className="absolute left-4 right-4 top-5 z-[1000]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Korean spots..."
          className="w-full rounded-2xl border-none bg-white px-5 py-4 text-sm font-semibold shadow-xl outline-none"
        />
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
              click: () => {
                setSelectedIndex(index);
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
        className="fixed bottom-[82px] left-0 right-0 z-[1000] flex snap-x gap-4 overflow-x-auto px-4 pb-3"
      >
        {sortedSpots.map((spot, index) => (
          <a
            key={spot.id}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
            href={`/business/${spot.id}`}
            className={`w-[88vw] max-w-[420px] shrink-0 snap-center rounded-[28px] bg-white p-3 shadow-2xl ${
              index === selectedIndex ? "ring-4 ring-red-500" : ""
            }`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex h-[170px] w-full snap-x gap-2 overflow-x-auto rounded-[24px] bg-gray-100">
                {[spot.image_url, spot.image_url_2, spot.image_url_3]
                  .filter(Boolean)
                  .map((image, imageIndex) => (
                    <img
                      key={imageIndex}
                      src={image as string}
                      alt={spot.name}
                      className="h-full w-full shrink-0 snap-center rounded-[24px] object-cover object-center"
                    />
                  ))}
              </div>

              <div className="px-1 pb-2">
                <h3 className="text-xl font-bold">{spot.name}</h3>

                <p className="text-sm text-gray-600">
                  {spot.category} · {spot.city}
                </p>

                <p className="mt-1 text-sm font-bold text-[#C4483A]">
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
        ))}
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