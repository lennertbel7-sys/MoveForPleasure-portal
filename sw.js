// ============================================================
// sw.js — service worker
//
// Dit maakt van de website een installeerbare app (PWA) en
// zorgt dat hij ook zonder internet opent. Strategie:
// eerst het netwerk proberen (zodat je altijd de nieuwste
// versie krijgt), en alleen bij geen verbinding terugvallen
// op de bewaarde kopie.
// ============================================================

const CACHE_NAAM = "sportlog-v1";

self.addEventListener("fetch", (gebeurtenis) => {
  gebeurtenis.respondWith(
    fetch(gebeurtenis.request)
      .then((antwoord) => {
        // Gelukt: kopie bewaren voor offline gebruik
        const kopie = antwoord.clone();
        caches.open(CACHE_NAAM).then((cache) => cache.put(gebeurtenis.request, kopie));
        return antwoord;
      })
      .catch(() => caches.match(gebeurtenis.request))
  );
});
