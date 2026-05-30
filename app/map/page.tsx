import { supabase } from "../../lib/supabase";
import MapWrapper from "../components/MapWrapper";
import BottomNav from "../components/BottomNav";
import InstallAppButton from "../components/InstallAppButton";

type Coupon = {
  id: number;
  business_id: number | string | null;
  title?: string | null;
  description?: string | null;
  coupon_type?: string | null;
  value?: number | string | null;
  min_order?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type Category = {
  id: number;
  name: string;
  emoji: string | null;
  show_on_main_map: boolean | null;
  show_on_community_map: boolean | null;
};

function makeCouponBadge(coupon: Coupon) {
  if (coupon.title && coupon.title.trim()) return coupon.title.trim();

  const value =
    coupon.value !== null && coupon.value !== undefined
      ? String(coupon.value)
      : "";

  const type = String(coupon.coupon_type || "").toLowerCase();

  if (value && type.includes("percent")) return `${value}% OFF`;
  if (value && (type.includes("amount") || type.includes("dollar"))) {
    return `$${value} OFF`;
  }
  if (value) return `Coupon ${value}`;

  return "Coupon";
}

export default async function MapPage() {
  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .order("id", { ascending: true });

  if (businessError) {
    console.log("Map businesses load error:", businessError);
  }

  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("*")
    .eq("show_on_main_map", true)
    .order("name", { ascending: true });

  if (categoryError) {
    console.log("Map categories load error:", categoryError);
  }

  const { data: coupons, error: couponError } = await supabase
    .from("coupons")
    .select(
      "id,business_id,title,description,coupon_type,value,min_order,start_date,end_date"
    )
    .order("id", { ascending: false });

  if (couponError) {
    console.log("Map coupons load error:", couponError);
  }

  const couponList = (coupons || []) as Coupon[];
  const categoryList = (categories || []) as Category[];

  const mainCategoryNames = new Set(
    categoryList.map((category) => category.name)
  );

  const spots = (businesses || [])
    .filter((business) => {
      if (!business.category) return true;
      return mainCategoryNames.has(business.category);
    })
    .map((business) => {
      const businessCoupons = couponList.filter(
        (coupon) => String(coupon.business_id) === String(business.id)
      );

      return {
        ...business,
        coupons: businessCoupons,
        coupon_count: businessCoupons.length,
        coupon_badge:
          businessCoupons.length > 0
            ? makeCouponBadge(businessCoupons[0])
            : null,
      };
    });

  return (
    <main className="min-h-screen">
	 <InstallAppButton />
      <MapWrapper
        spots={spots}
        categories={categoryList}
        activeNav="map"
      />
      <BottomNav />
    </main>
  );
}