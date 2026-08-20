/* eslint-disable no-restricted-globals */

// Service Worker for SismoBot PWA

const CACHE_NAME = "sismobot-v1";
const STATIC_ASSETS = ["/", "/index.html"];

// Install — cache shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  // Skip non-GET, API calls, and unsupported schemes (like chrome-extension://)
  if (
    event.request.method !== "GET" || 
    url.includes("/api/") ||
    !(url.startsWith("http:") || url.startsWith("https:"))
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body,
      icon: data.icon || "/icons/icon-192.png",
      badge: data.badge || "/icons/badge-72.png",
      tag: data.tag || "sismobot-alert",
      data: data.data || {},
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: data.requireInteraction || false,
      actions: [
        { action: "open", title: "Ver en mapa" },
        { action: "dismiss", title: "Cerrar" },
      ],
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch (err) {
    console.error("Push parse error:", err);
  }
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
