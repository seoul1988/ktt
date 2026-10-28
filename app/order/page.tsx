import Link from "next/link";
import {notFound} from "next/navigation";
import RestaurantMenu from "@/app/components/restaurant-order/RestaurantMenu";
import StoreSelector from "@/app/components/restaurant-brand/StoreSelector";
import {chooseBrandStore,normalizeBrandCode,orderLink,type BrandStore} from "@/lib/restaurant-brand/brand";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
export const dynamic="force-dynamic";
export const revalidate=0;
export default async function BrandOrderPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 let brand="";try{if(typeof query.brandId==="string")brand=normalizeBrandCode(query.brandId);}catch{notFound();}
 const businessId=typeof query.businessId==="string"?query.businessId:undefined;
 const service=query.service==="delivery"?"delivery":"pickup";
 if(!brand){if(businessId&&/^[1-9]\d*$/.test(businessId)){const {data,error}=await supabaseAdmin.from("businesses").select("id,name").eq("id",Number(businessId)).or("hidden.is.null,hidden.eq.false").maybeSingle();if(error||!data)notFound();return <main><header className="border-b px-5 py-5"><h1 className="text-2xl font-black">{data.name}</h1></header><RestaurantMenu key={data.id} businessId={data.id} orderEnabled menuEnabled pickupEnabled deliveryEnabled /></main>;}return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-black">Choose a restaurant</h1><p className="mt-3">Please use the restaurant’s online order link.</p></main>;}
 const {data,error}=await supabaseAdmin.from("businesses").select("id,name,address,phone,lat,lng,hours,image_url,brand_code").eq("brand_code",brand).or("hidden.is.null,hidden.eq.false").order("name");
 if(error)return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-black">Online ordering is temporarily unavailable</h1><p className="mt-3">Please try again shortly or contact the restaurant.</p></main>;
 const stores=(data||[]) as BrandStore[];
 if(!stores.length)return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-black">No locations available</h1><p className="mt-3">There are currently no listed locations for this brand.</p></main>;
 const selected=chooseBrandStore(stores,businessId);
 if(businessId&&!selected)notFound();
 if(!selected)return <StoreSelector stores={stores} brand={brand} initialService={service}/>;
 return <main className="min-h-screen bg-white"><header className="border-b px-5 py-5"><div className="mx-auto max-w-6xl"><h1 className="text-2xl font-black">{selected.name}</h1><p className="mt-1 text-sm text-slate-600">{selected.address}</p>{stores.length>1&&<Link href={orderLink(brand,undefined,service)} className="mt-3 inline-block text-sm font-bold text-blue-800">← Change location</Link>}</div></header><RestaurantMenu key={selected.id} businessId={selected.id} orderEnabled menuEnabled pickupEnabled deliveryEnabled /></main>;
}
