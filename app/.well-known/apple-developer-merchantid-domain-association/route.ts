import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SQUARE_ASSOCIATION_URL =
  "https://app.squareup.com/digital-wallets/apple-pay/apple-developer-merchantid-domain-association";

export async function GET() {
  try {
    const response = await fetch(SQUARE_ASSOCIATION_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      return new NextResponse(
        "Apple Pay verification file unavailable.",
        { status: 502 },
      );
    }

    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(
      "Apple Pay verification file unavailable.",
      { status: 502 },
    );
  }
}
