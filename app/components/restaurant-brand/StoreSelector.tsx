"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { coordinates, distanceMiles, orderLink, type BrandStore } from "@/lib/restaurant-brand/brand";

const StoreMap = dynamic(() => import("./StoreMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-slate-100 text-sm">Loading map…</div>,
});

export default function StoreSelector({ stores, brand, initialService }: {
  stores: BrandStore[]; brand: string; initialService: string;
}) {
  const [service, setService] = useState(initialService === "delivery" ? "delivery" : "pickup");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const displayed = useMemo(() => stores
    .filter(store => `${store.name} ${store.address || ""}`.toLowerCase().includes(search.toLowerCase()))
    .map(store => {
      const point = coordinates(store);
      return { store, distance: location && point ? distanceMiles(location, point) : null };
    })
    .sort((a, b) => location
      ? (a.distance ?? Infinity) - (b.distance ?? Infinity)
      : a.store.name.localeCompare(b.store.name)), [stores, search, location]);

  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage("Location is unavailable. Please choose from the store list.");
      return;
    }
    setLocationMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(pos => {
      setLocation([pos.coords.latitude, pos.coords.longitude]);
      setLocationMessage("Stores sorted by distance.");
    }, () => setLocationMessage("Location unavailable. Search by store name or city instead."),
    { timeout: 10000, maximumAge: 60000 });
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b px-4 py-3 lg:px-6 lg:py-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Online Order</p>
        <h1 className="mt-1 text-2xl font-black">{brand.replace(/-/g, " ")}</h1>
        <p className="mt-1 text-sm text-slate-600">Choose your location</p>
      </header>
      <div className="grid min-w-0 grid-cols-1 lg:h-[calc(100dvh-132px)] lg:min-h-[520px] lg:grid-cols-[390px_minmax(0,1fr)]">
        <section aria-label="Store locations map"
          className="relative isolate z-0 col-start-1 row-start-1 h-[clamp(240px,40dvh,380px)] min-w-0 border-b lg:col-start-2 lg:h-full lg:border-b-0">
          <StoreMap stores={displayed.map(item => item.store)} brand={brand} service={service} />
        </section>
        <aside className="col-start-1 row-start-2 min-w-0 p-4 lg:row-start-1 lg:overflow-y-auto lg:border-r lg:p-5">
          <div className="grid grid-cols-2 rounded-full bg-slate-100 p-1">
            {["pickup", "delivery"].map(value => <button type="button" key={value}
              aria-pressed={service === value} onClick={() => setService(value)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${service === value ? "bg-slate-900 text-white" : ""}`}>
              {value === "pickup" ? "Pickup" : "Delivery"}
            </button>)}
          </div>
          <label className="mt-4 block text-sm font-bold lg:mt-5">Find your store
            <input className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" value={search}
              onChange={e => setSearch(e.target.value)} placeholder="Store name, city or ZIP" />
          </label>
          <button type="button" onClick={locate} className="mt-3 text-sm font-bold text-blue-800">◎ Use my current location</button>
          {locationMessage && <p role="status" className="mt-2 text-xs text-slate-600">{locationMessage}</p>}
          <p className="mt-4 border-b pb-3 text-xs font-bold lg:mt-5">
            {displayed.length} stores{service === "delivery" ? " · Delivery availability is checked at checkout." : ""}
          </p>
          <p className="mt-2 text-xs text-slate-500 lg:hidden">Swipe to choose your store →</p>
          <div role="region" aria-label="Choose a store" tabIndex={0}
            className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 lg:mt-0 lg:block lg:overflow-visible lg:pb-0">
            {displayed.map(({ store, distance }) => <article key={store.id}
              className="flex w-[86%] max-w-[360px] shrink-0 snap-start flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:w-auto lg:max-w-none lg:rounded-none lg:border-0 lg:border-b lg:py-5 lg:px-0 lg:shadow-none">
              <h2 className="font-black">{store.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{store.address}</p>
              {store.phone && <a className="mt-2 block text-sm text-slate-600" href={`tel:${store.phone}`}>{store.phone}</a>}
              {distance !== null && <p className="mt-2 text-xs text-slate-500">{distance.toFixed(1)} mi away</p>}
              {typeof store.hours === "string" && store.hours && <details className="mt-2 text-xs text-slate-600">
                <summary>Business hours</summary><p className="mt-2 whitespace-pre-line">{store.hours}</p>
              </details>}
              <div className="mt-auto pt-4"><Link href={orderLink(brand, store.id, service)}
                className="inline-block rounded-full bg-[#b64032] px-6 py-2.5 text-sm font-black text-white">Order Here</Link></div>
            </article>)}
            {!displayed.length && <p className="py-8 text-sm text-slate-600">No matching stores. Try another search.</p>}
          </div>
        </aside>
      </div>
    </main>
  );
}
