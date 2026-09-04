import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SQUARE_ASSOCIATION_URL =
  "https://app.squareup.com/digital-wallets/apple-pay/apple-developer-merchantid-domain-association";

export async function GET() {
  try {
    const response = await fetch(SQUARE_ASSOCIATION_URL, {
      cache: "no-store",
      headers: {
        Accept: "text/plain,*/*",
      },
    });

    if (!response.ok) {
      return new NextResponse(
        `Unable to load Apple Pay domain association file (${response.status}).`,
        { status: 502 },
      );
    }

    const body = await response.text();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Apple Pay association file error:", error);
    return new NextResponse(
      "Unable to load Apple Pay domain association file.",
      { status: 502 },
    );
  }
}

