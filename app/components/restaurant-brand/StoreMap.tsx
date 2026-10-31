"use client";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from "react-leaflet";
import { divIcon, latLngBounds, type Marker as LeafletMarker, type CircleMarker as LeafletCircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { coordinates, orderLink, type BrandStore } from "@/lib/restaurant-brand/brand";

type Point = [number, number];
function Fit({ points }: { points: Point[] }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    const positions: Point[] = JSON.parse(key);
    if (positions.length) map.fitBounds(latLngBounds(positions), { padding: [35, 35], maxZoom: 13 });
  }, [map, key]);
  return null;
}
function StorePin({ store, point, selected, onSelect, brand, service }: {
  store: BrandStore; point: Point; selected: boolean; onSelect: (id: number) => void; brand: string; service: string;
}) {
  const map = useMap();
  const marker = useRef<LeafletMarker | LeafletCircleMarker | null>(null);
  useEffect(() => {
    if (selected) {
      map.panInside(point, { padding: [60, 60], animate: true });
      marker.current?.openPopup();
    } else marker.current?.closePopup();
  }, [map, selected, point[0], point[1]]);
  const pin = useMemo(() => {
    if (!store.logo_url) return null;
    const element = document.createElement("div");
    element.style.cssText = `width:48px;height:48px;border-radius:50%;background:white;border:3px solid ${selected ? "#1d4ed8" : "#b64032"};box-shadow:0 2px 8px #0005;display:flex;align-items:center;justify-content:center;overflow:hidden;`;
    const image = document.createElement("img");
    image.src = store.logo_url;
    image.alt = store.name;
    image.style.cssText = "width:100%;height:100%;object-fit:contain";
    image.onerror = () => { element.textContent = "●"; element.style.color = "#b64032"; };
    element.appendChild(image);
    return divIcon({ html: element, className: "", iconSize: [48, 48], iconAnchor: [24, 24], popupAnchor: [0, -24] });
  }, [store.logo_url, store.name, selected]);
  const popup = <Popup autoPan={false}><strong>{store.name}</strong><p>{store.address}</p><a href={orderLink(brand, store.id, service)}>Order Here →</a></Popup>;
  const eventHandlers = { click: () => onSelect(store.id) };
  return pin
    ? <Marker ref={node => { marker.current = node; }} position={point} icon={pin} title={store.name} eventHandlers={eventHandlers} zIndexOffset={selected ? 1000 : 0}>{popup}</Marker>
    : <CircleMarker ref={node => { marker.current = node; }} center={point} radius={selected ? 13 : 10} eventHandlers={eventHandlers} pathOptions={{ color: selected ? "#1d4ed8" : "#ffffff", fillColor: "#b64032", fillOpacity: 1, weight: 3 }}>{popup}</CircleMarker>;
}
export default function StoreMap({ stores, brand, service, selectedId, onSelect, location }: {
  stores: BrandStore[]; brand: string; service: string; selectedId: number | null;
  onSelect: (id: number) => void; location: Point | null;
}) {
  const located = stores.flatMap(store => { const point = coordinates(store); return point ? [{ store, point }] : []; });
  const points = located.map(item => item.point);
  if (location) points.push(location);
  if (!points.length) return <div className="flex h-full items-center justify-center bg-slate-100 p-8 text-sm text-slate-600">No map locations available. Please choose from the store list.</div>;
  return <MapContainer center={points[0]} zoom={10} className="h-full w-full" scrollWheelZoom zoomControl={false} doubleClickZoom touchZoom>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Fit points={points} />
    {located.map(({ store, point }) => <StorePin key={store.id} store={store} point={point} selected={selectedId === store.id} onSelect={onSelect} brand={brand} service={service} />)}
    {location && <CircleMarker center={location} radius={9} pathOptions={{ color: "white", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}><Popup>Your current location</Popup></CircleMarker>}
  </MapContainer>;
}
