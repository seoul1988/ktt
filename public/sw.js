self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        body: event.data.text(),
      };
    }
  }

  const title = data.title || "KTown Triangle";
  const badgeCount = Math.max(
    1,
    Number(data.badgeCount || 1),
  );

  const options = {
    body: data.body || "새 알림이 있습니다.",
    icon: "/icon-192.png",

    // Android 알림창에 표시되는 작은 단색 아이콘입니다.
    // 앱 아이콘 숫자 배지와는 별개입니다.
    badge: "/badge-96.png",

    tag: data.tag || `ktown-${Date.now()}`,
    renotify: true,

    data: {
      url: data.url || "/whats-new",
      badgeCount,
      businessId: data.businessId || null,
      type: data.type || "general",
    },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),

      // 설치된 PWA 앱 아이콘 배지
      typeof self.navigator.setAppBadge === "function"
        ? self.navigator.setAppBadge(badgeCount)
        : Promise.resolve(),
    ]),
  );
});

self.addEventListener(
  "notificationclick",
  function (event) {
    event.notification.close();

    const targetPath =
      event.notification.data?.url || "/whats-new";

    const targetUrl = new URL(
      targetPath,
      self.location.origin,
    ).href;

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(async function (clientList) {
          for (const client of clientList) {
            if ("navigate" in client) {
              await client.navigate(targetUrl);
            }

            if ("focus" in client) {
              return client.focus();
            }
          }

          if (self.clients.openWindow) {
            return self.clients.openWindow(targetUrl);
          }
        }),
    );
  },
);

/*
 * 네트워크 요청을 처리하는 fetch 이벤트입니다.
 *
 * POST, PUT, DELETE 같은 요청은 건드리지 않고,
 * 일반적인 GET 요청만 네트워크로 전달합니다.
 */
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(function () {
      return new Response("Network error", {
        status: 503,
        statusText: "Service Unavailable",
      });
    }),
  );
});