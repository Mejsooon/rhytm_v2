// Service worker rhytm: tylko powiadomienia push i kliknięcie w powiadomienie.
// Celowo bez obsługi „fetch” i bez cache — strony aplikacji zawsze idą z sieci.
self.addEventListener("push", (event) => {
  // Powiadomienie pokazujemy zawsze (userVisibleOnly), nawet gdy treść jest pusta albo nie jest JSON-em
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "rhytm", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/dzis" },
    }),
  );
});

// Nowa wersja service workera przejmuje otwarte karty od razu (inaczej navigate() na nich odrzuca)
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Tylko adresy z tej samej domeny: obcy adres w treści powiadomienia (open redirect) → /dzis
  let url = "/dzis";
  try {
    const u = new URL(event.notification.data?.url ?? "/dzis", self.location.origin);
    if (u.origin === self.location.origin) url = u.pathname + u.search + u.hash;
  } catch {}
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        // Otwartą kartę aplikacji przenosimy na adres z powiadomienia i skupiamy; gdy jej nie ma, otwieramy nową
        for (const client of windows) {
          if ("navigate" in client && "focus" in client) {
            // navigate() odrzuca (albo zwraca null) dla karty, której ten SW nie kontroluje —
            // wtedy po skupieniu otwieramy adres w nowym oknie
            const nawigacja = await client.navigate(url).catch(() => null);
            await client.focus().catch(() => null);
            if (!nawigacja) return self.clients.openWindow(url);
            return;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
