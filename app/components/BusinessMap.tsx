"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
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
  description?: string | null;
  rating?: number | null;
  lat?: number | null;
  lng?: number | null;
};

export default function BusinessMap({ spots }: { spots: Spot[] }) {
  const [search, setSearch] = useState("");
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
	const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

	useEffect(() => {
	  navigator.geolocation.getCurrentPosition((position) => {
		setUserLocation([
		  position.coords.latitude,
		  position.coords.longitude,
		]);
	  });
	}, []);
  const filteredSpots = useMemo(() => {
    return spots.filter((spot) => {
      const hasLocation = spot.lat && spot.lng;

      const matchesSearch =
        spot.name.toLowerCase().includes(search.toLowerCase()) ||
        spot.category.toLowerCase().includes(search.toLowerCase()) ||
        spot.city.toLowerCase().includes(search.toLowerCase());

      return hasLocation && matchesSearch;
    });
  }, [spots, search]);

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
        {filteredSpots.map((spot) => (
          <Marker
            key={spot.id}
            position={[spot.lat as number, spot.lng as number]}
            icon={markerIcon}
            eventHandlers={{
              mouseover: () => setSelectedSpot(spot),
              click: () => setSelectedSpot(spot),
            }}
          >
            <Popup>
              <strong>{spot.name}</strong>
              <br />
              {spot.category}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {selectedSpot && (
        <a
          href={`/business/${selectedSpot.id}`}
          className="absolute bottom-24 left-4 right-4 z-[1000] rounded-3xl bg-white p-4 shadow-2xl"
        >
          <div className="flex gap-4">
            <img
              src={selectedSpot.image_url}
              alt={selectedSpot.name}
              className="h-24 w-24 rounded-2xl object-cover"
            />

            <div className="flex-1">
              <h3 className="text-lg font-bold">{selectedSpot.name}</h3>

              <p className="text-sm text-gray-600">
                {selectedSpot.category} · {selectedSpot.city}
              </p>

              <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                {selectedSpot.description || "Tap to view details"}
              </p>
            </div>
          </div>
        </a>
      )}
	  <nav className="fixed bottom-4 left-1/2 z-[1000] flex w-[90%] max-w-md -translate-x-1/2 justify-around rounded-3xl bg-[#172033] px-4 py-3 text-xs font-semibold text-white shadow-2xl">

	  <a href="/">
	  Home
	</a>

	<a
	  href="/map"
	  className="text-[#F7B955]"
	>
	  Map
	</a>

	<a href="/deals">
	  Deals
	</a>

	<a href="/community">
	  Community
	</a>
	</nav>
    </div>
  );
}