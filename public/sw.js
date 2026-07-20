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
  const badgeCount = Math.max(1, Number(data.badgeCount || 1));

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

self.addEventListener("notificationclick", function (event) {
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
});