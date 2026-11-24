// ============================================================
// sw.js: service worker
//
// Dit maakt van de website een installeerbare app (PWA) en
// zorgt dat hij ook zonder internet opent. Strategie:
// eerst het netwerk proberen (zodat je altijd de nieuwste
// versie krijgt), en alleen bij geen verbinding terugvallen
// op de bewaarde kopie.
//
// Alleen eigen bestanden (HTML/CSS/JS) die we OPHALEN (GET)
// worden bewaard. Verzoeken naar de database (Supabase) gaan
// altijd gewoon direct naar het internet.
// ============================================================

const CACHE_NAAM = "sportlog-v19";

self.addEventListener("fetch", (gebeurtenis) => {
  const verzoek = gebeurtenis.request;
  const eigenSite = new URL(verzoek.url).origin === self.location.origin;
  if (verzoek.method !== "GET" || !eigenSite) return; // browser regelt het zelf

  gebeurtenis.respondWith(
    fetch(verzoek)
      .then((antwoord) => {
        // Gelukt: kopie bewaren voor offline gebruik
        const kopie = antwoord.clone();
        caches.open(CACHE_NAAM).then((cache) => cache.put(verzoek, kopie));
        return antwoord;
      })
      .catch(() => caches.match(verzoek))
  );
});

// Oude caches opruimen als er een nieuwe versie is
self.addEventListener("activate", (gebeurtenis) => {
  gebeurtenis.waitUntil(
    caches.keys().then((namen) =>
      Promise.all(namen.filter((n) => n !== CACHE_NAAM).map((n) => caches.delete(n)))
    )
  );
});
