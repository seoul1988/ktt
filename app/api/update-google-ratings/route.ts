import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GoogleFindPlaceResponse = {
  status?: string;
  error_message?: string;
  candidates?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
  }>;
};

type GooglePlaceDetailsResponse = {
  status?: string;
  error_message?: string;
  result?: {
    rating?: number;
    user_ratings_total?: number;
  };
};

type FailedBusiness = {
  id: string | number;
  name: string | null;
  step: string;
  status?: string;
  message: string;
  searchText?: string;
  placeId?: string;
};

function isAuthorized(req: Request) {
  const cronSecret =
    process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    console.error(
      "CRON_SECRET environment variable is missing.",
    );

    return false;
  }

  const authorization =
    req.headers.get("authorization")?.trim() || "";

  return (
    authorization === `Bearer ${cronSecret}`
  );
}

async function fetchJson<T>(
  url: string,
  timeoutMs = 20000,
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(
      `Google API HTTP error: ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const googleKey =
    process.env.GOOGLE_PLACES_API_KEY?.trim();

  if (!googleKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing GOOGLE_PLACES_API_KEY",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const { data: businesses, error } =
    await supabase
      .from("businesses")
      .select(
        "id, name, address, city, google_place_id",
      )
      .order("id", {
        ascending: true,
      });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  let updated = 0;
  let placeIdSaved = 0;

  const failed: FailedBusiness[] = [];

  for (const business of businesses || []) {
    let placeId =
      typeof business.google_place_id === "string"
        ? business.google_place_id.trim()
        : "";

    const searchText = [
      business.name,
      business.address,
      business.city,
      "NC",
    ]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join(" ");

    try {
      if (!placeId) {
        if (!searchText) {
          failed.push({
            id: business.id,
            name: business.name,
            step: "find_place",
            message:
              "Business name or address is missing.",
          });

          continue;
        }

        const findUrl =
          "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
          `?input=${encodeURIComponent(searchText)}` +
          "&inputtype=textquery" +
          "&fields=place_id,name,formatted_address" +
          `&key=${encodeURIComponent(googleKey)}`;

        const findData =
          await fetchJson<GoogleFindPlaceResponse>(
            findUrl,
          );

        if (findData.status !== "OK") {
          failed.push({
            id: business.id,
            name: business.name,
            step: "find_place",
            status: findData.status,
            message:
              findData.error_message ||
              "No place found",
            searchText,
          });

          continue;
        }

        placeId =
          findData.candidates?.[0]?.place_id?.trim() ||
          "";

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

        const { error: placeUpdateError } =
          await supabase
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
            placeId,
          });

          continue;
        }

        placeIdSaved += 1;
      }

      const detailUrl =
        "https://maps.googleapis.com/maps/api/place/details/json" +
        `?place_id=${encodeURIComponent(placeId)}` +
        "&fields=rating,user_ratings_total" +
        `&key=${encodeURIComponent(googleKey)}`;

      const detailData =
        await fetchJson<GooglePlaceDetailsResponse>(
          detailUrl,
        );

      if (detailData.status !== "OK") {
        failed.push({
          id: business.id,
          name: business.name,
          step: "details",
          status: detailData.status,
          message:
            detailData.error_message ||
            "No details found",
          placeId,
        });

        continue;
      }

      const rating =
        detailData.result?.rating;

      const reviewCount =
        detailData.result?.user_ratings_total;

      if (
        typeof rating !== "number" ||
        !Number.isFinite(rating)
      ) {
        failed.push({
          id: business.id,
          name: business.name,
          step: "rating",
          message: "No valid rating returned",
          placeId,
        });

        continue;
      }

      const normalizedReviewCount =
        typeof reviewCount === "number" &&
        Number.isFinite(reviewCount)
          ? Math.max(0, Math.floor(reviewCount))
          : 0;

      const { error: ratingUpdateError } =
        await supabase
          .from("businesses")
          .update({
            rating,
            review_count: normalizedReviewCount,
            rating_updated:
              new Date().toISOString(),
          })
          .eq("id", business.id);

      if (ratingUpdateError) {
        failed.push({
          id: business.id,
          name: business.name,
          step: "save_rating",
          message: ratingUpdateError.message,
          placeId,
        });

        continue;
      }

      updated += 1;
    } catch (error) {
      failed.push({
        id: business.id,
        name: business.name,
        step: "unexpected",
        message:
          error instanceof Error
            ? error.message
            : String(error),
        searchText,
        placeId: placeId || undefined,
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      completedAt: new Date().toISOString(),
      totalBusinesses: businesses?.length || 0,
      updated,
      placeIdSaved,
      failedCount: failed.length,
      failed: failed.slice(0, 20),
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export async function POST(req: Request) {
  return GET(req);
}