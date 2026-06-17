// Minimal service worker — exists primarily so Android Chrome treats the
// PWA as installable (which removes the URL bar from the home-screen entry).
// Network-first pass-through, no caching, no offline behaviour.
//
// If we later want offline support (queued photo uploads, cached read of the
// dashboard, etc.), this is the file to flesh out.

self.addEventListener("install", (event) => {
  // Take over immediately so the next page load uses the new SW.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch handler. Chrome requires a fetch handler to exist for
// the site to qualify as installable; this one just lets the network handle
// every request as if the SW weren't there.
self.addEventListener("fetch", (event) => {
  // No event.respondWith — browser uses default network behaviour.
});
