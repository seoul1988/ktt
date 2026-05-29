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

  const failed: any[] = [];

  for (const business of businesses || []) {
    let placeId = business.google_place_id;

    const searchText = [
      business.name,
      business.address,
      business.city,
      "NC",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      if (!placeId) {
        const findUrl =
          "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
          `?input=${encodeURIComponent(searchText)}` +
          "&inputtype=textquery" +
          "&fields=place_id,name,formatted_address" +
          `&key=${googleKey}`;

        const findRes = await fetch(findUrl);
        const findData = await findRes.json();

        if (findData.status !== "OK") {
          failed.push({
            id: business.id,
            name: business.name,
            step: "find_place",
            status: findData.status,
            message: findData.error_message || "No place found",
            searchText,
          });
          continue;
        }

        placeId = findData?.candidates?.[0]?.place_id;

        if (!placeId) {
          failed.push({
            id: business.id,
            name: business.name,
            step: "find_place",
            message: "No place_id returned",
            searchText,
          });
          continue;
        }

        const { error: placeUpdateError } = await supabase
          .from("businesses")
          .update({
            google_place_id: placeId,
          })
          .eq("id", business.id);

        if (placeUpdateError) {
          failed.push({
            id: business.id,
            name: business.name,
            step: "save_place_id",
            message: placeUpdateError.message,
          });
          continue;
        }

        placeIdSaved++;
      }

      const detailUrl =
        "https://maps.googleapis.com/maps/api/place/details/json" +
        `?place_id=${placeId}` +
        "&fields=rating,user_ratings_total" +
        `&key=${googleKey}`;

      const detailRes = await fetch(detailUrl);
      const detailData = await detailRes.json();

      if (detailData.status !== "OK") {
        failed.push({
          id: business.id,
          name: business.name,
          step: "details",
          status: detailData.status,
          message: detailData.error_message || "No details found",
          placeId,
        });
        continue;
      }

      const rating = detailData?.result?.rating;
      const reviewCount = detailData?.result?.user_ratings_total;

      if (!rating) {
        failed.push({
          id: business.id,
          name: business.name,
          step: "rating",
          message: "No rating returned",
          placeId,
        });
        continue;
      }

      const { error: ratingUpdateError } = await supabase
        .from("businesses")
        .update({
          rating,
          review_count: reviewCount || 0,
          rating_updated: new Date().toISOString(),
        })
        .eq("id", business.id);

      if (ratingUpdateError) {
        failed.push({
          id: business.id,
          name: business.name,
          step: "save_rating",
          message: ratingUpdateError.message,
        });
        continue;
      }

      updated++;
    } catch (err: any) {
      failed.push({
        id: business.id,
        name: business.name,
        step: "unexpected",
        message: err?.message || String(err),
        searchText,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    totalBusinesses: businesses?.length || 0,
    updated,
    placeIdSaved,
    failedCount: failed.length,
    failed: failed.slice(0, 10),
    sample: businesses?.slice(0, 3),
  });
}