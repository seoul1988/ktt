import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { id } = await params;

  const serviceWorker = `
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(fetch(event.request));
});
`;

  return new NextResponse(serviceWorker, {
    status: 200,
    headers: {
      "Content-Type":
        "application/javascript; charset=utf-8",
      "Cache-Control":
        "no-cache, no-store, must-revalidate",

      // /business/90/website 페이지와 하위 페이지를 모두 포함
      "Service-Worker-Allowed":
        `/business/${id}/`,
    },
  });
}