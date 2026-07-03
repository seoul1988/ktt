import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const baseUrl = "https://ktowntriangle.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/community`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/community/deals`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/events`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/grand-openings`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/ads`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  ];

  const businessUrls = await getRows("businesses", "/business");
  const dealUrls = await getRows("deals", "/community/deals");
  const eventUrls = await getRows("events", "/events");
  const adUrls = await getRows("ads", "/ads");
  const grandOpeningUrls = await getRows("grand_openings", "/grand-openings");

  return [
    ...staticPages,
    ...businessUrls,
    ...dealUrls,
    ...eventUrls,
    ...adUrls,
    ...grandOpeningUrls,
  ];
}

async function getRows(table: string, path: string): Promise<MetadataRoute.Sitemap> {
  const { data, error } = await supabase
    .from(table)
    .select("id, updated_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !data) return [];

  return data.map((item: any) => ({
    url: `${baseUrl}${path}/${item.id}`,
    lastModified: item.updated_at || item.created_at || new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));
}