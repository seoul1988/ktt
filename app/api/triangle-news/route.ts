import { NextResponse } from "next/server";


export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  const articles = await getTriangleNews();

  return NextResponse.json(articles, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
