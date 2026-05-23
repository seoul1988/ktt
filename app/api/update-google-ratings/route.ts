import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!googleKey) {
    return NextResponse.json(
      { error: "Missing GOOGLE_PLACES_API_KEY" },
      { status: 500 }
    );
  }

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id, name, address, city, google_place_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updated = 0;
  let placeIdSaved = 0;

  for (const business of businesses || []) {
    let placeId = business.google_place_id;

    // 1) google_place_id 없으면 먼저 자동으로 찾기
    if (!placeId) {
      const searchText = [
        business.name,
        business.address,
        business.city,
        "NC",
      ]
        .filter(Boolean)
        .join(" ");

      const findUrl =
        "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
        `?input=${encodeURIComponent(searchText)}` +
        "&inputtype=textquery" +
        "&fields=place_id" +
        `&key=${googleKey}`;

      const findRes = await fetch(findUrl);
      const findData = await findRes.json();

      placeId = findData?.candidates?.[0]?.place_id;

      if (!placeId) {
        continue;
      }

      await supabase
        .from("businesses")
        .update({
          google_place_id: placeId,
        })
        .eq("id", business.id);

      placeIdSaved++;
    }

    // 2) place_id로 평점 가져오기
    const detailUrl =
      "https://maps.googleapis.com/maps/api/place/details/json" +
      `?place_id=${placeId}` +
      "&fields=rating,user_ratings_total" +
      `&key=${googleKey}`;

    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();

    const rating = detailData?.result?.rating;
    const reviewCount = detailData?.result?.user_ratings_total;

    if (!rating) {
      continue;
    }

    await supabase
      .from("businesses")
      .update({
        rating,
        review_count: reviewCount || 0,
        rating_updated_at: new Date().toISOString(),
      })
      .eq("id", business.id);

    updated++;
  }

  return NextResponse.json({
    ok: true,
    updated,
    placeIdSaved,
  });
}