import Link from "next/link";
import { notFound } from "next/navigation";
import RestaurantMenu from "@/app/components/restaurant-order/RestaurantMenu";
import StoreSelector from "@/app/components/restaurant-brand/StoreSelector";
import { chooseBrandStore, normalizeBrandCode, orderLink, type BrandStore } from "@/lib/restaurant-brand/brand";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveOrderDesign } from "./menu-design";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function SelectedStoreMenu({ id, name, address, changeLocation }: {
  id: number; name: string; address?: string | null; changeLocation?: string;
}) {
  const [businessResult, sectionsResult] = await Promise.all([
    supabaseAdmin.from("businesses").select("website_settings").eq("id", id).maybeSingle(),
    supabaseAdmin.from("business_sections")
      .select("id,content,is_visible,sort_order")
      .eq("business_id", id).order("sort_order", { ascending: true }).order("id", { ascending: true }),
  ]);
  if (businessResult.error || sectionsResult.error) {
    console.error("Order page design lookup failed", { businessId: id, businessError: businessResult.error, sectionsError: sectionsResult.error });
    return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-black">Online ordering is temporarily unavailable</h1><p className="mt-3">Please try again shortly or contact the restaurant.</p></main>;
  }
  const design = resolveOrderDesign(sectionsResult.data, businessResult.data?.website_settings);
  return (
    <main className="min-h-screen" style={{ backgroundColor: design.outerBackgroundColor }}>
      <header className="border-b px-5 py-5" style={{ backgroundColor: design.headerBackgroundColor }}>
        <div className="mx-auto max-w-6xl rounded-xl bg-white px-4 py-3 text-gray-950">
          <h1 className="text-2xl font-black">{name}</h1>
          {address && <p className="mt-1 text-sm text-slate-600">{address}</p>}
          {changeLocation && <Link href={changeLocation} className="mt-3 inline-block text-sm font-bold text-blue-800">← Change location</Link>}
        </div>
      </header>
      <div className={`mx-auto w-full ${design.widthClass}`}>
        <RestaurantMenu key={id} businessId={id} {...design.menuProps} orderEnabled menuEnabled pickupEnabled deliveryEnabled />
      </div>
    </main>
  );
}

export default async function BrandOrderPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  let brand = "";
  try { if (typeof query.brandId === "string") brand = normalizeBrandCode(query.brandId); } catch { notFound(); }
  const businessId = typeof query.businessId === "string" ? query.businessId : undefined;
  const service = query.service === "delivery" ? "delivery" : "pickup";
  if (!brand) {
    if (businessId && /^[1-9]\d*$/.test(businessId)) {
      const { data, error } = await supabaseAdmin.from("businesses").select("id,name,address")
        .eq("id", Number(businessId)).or("hidden.is.null,hidden.eq.false").maybeSingle();
      if (error || !data) notFound();
      return <SelectedStoreMenu id={data.id} name={data.name || "Restaurant"} address={data.address} />;
    }
    return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-black">Choose a restaurant</h1><p className="mt-3">Please use the restaurant’s online order link.</p></main>;
  }
  const { data, error } = await supabaseAdmin.from("businesses")
    .select("id,name,address,phone,lat,lng,hours,image_url,brand_code")
    .eq("brand_code", brand).or("hidden.is.null,hidden.eq.false").order("name");
  if (error) return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-black">Online ordering is temporarily unavailable</h1><p className="mt-3">Please try again shortly or contact the restaurant.</p></main>;
  const stores = (data || []) as BrandStore[];
  if (!stores.length) return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-black">No locations available</h1><p className="mt-3">There are currently no listed locations for this brand.</p></main>;
  const selected = chooseBrandStore(stores, businessId);
  if (businessId && !selected) notFound();
  if (!selected) return <StoreSelector stores={stores} brand={brand} initialService={service} />;
  return <SelectedStoreMenu id={selected.id} name={selected.name || "Restaurant"} address={selected.address}
    changeLocation={stores.length > 1 ? orderLink(brand, undefined, service) : undefined} />;
}
