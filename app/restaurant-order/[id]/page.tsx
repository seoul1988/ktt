import { notFound } from "next/navigation";
import RestaurantMenu from "@/app/components/restaurant-order/RestaurantMenu";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
export const dynamic = "force-dynamic";
export default async function RestaurantOrderPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const businessId=Number(id);
  if(!Number.isSafeInteger(businessId)||businessId<=0) notFound();
  const {data,error}=await supabaseAdmin.from("businesses").select("id,name").eq("id",businessId).maybeSingle();
  if(error||!data) notFound();
  return <main className="min-h-screen bg-white"><header className="border-b px-5 py-5"><h1 className="mx-auto max-w-6xl text-2xl font-black">{data.name}</h1></header><RestaurantMenu businessId={businessId} orderEnabled menuEnabled pickupEnabled deliveryEnabled /></main>;
}
