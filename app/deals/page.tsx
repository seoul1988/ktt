import { supabase } from "../../lib/supabase";
import MapWrapper from "../components/MapWrapper";
import BottomNav from "../components/BottomNav";

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

export default async function DealsPage() {
  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .order("id", { ascending: true });

  if (businessError) {
    console.log("Map businesses load error:", businessError);
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

  const spots = (businesses || []).map((business) => {
    const businessCoupons = couponList.filter(
      (coupon) => String(coupon.business_id) === String(business.id)
    );

    return {
      ...business,
      coupons: businessCoupons,
      coupon_count: businessCoupons.length,
      coupon_badge:
        businessCoupons.length > 0 ? makeCouponBadge(businessCoupons[0]) : null,
    };
  });

  const promotedSpots = spots.filter((spot) => {
    const tagText = String(spot.tags || "").toLowerCase();

    return (
      spot.coupon_count > 0 ||
      spot.coupon_badge ||
      spot.event_title ||
      spot.event_name ||
      spot.coupon_title ||
      spot.deal_title ||
      tagText.includes("coupon") ||
      tagText.includes("event") ||
      tagText.includes("deal") ||
      tagText.includes("discount") ||
      tagText.includes("special")
    );
  });

  return (
    <main className="min-h-screen">
      <MapWrapper spots={promotedSpots} showAllOnLoad activeNav="deals" />
      <BottomNav />
    </main>
  );
}