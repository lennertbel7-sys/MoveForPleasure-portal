// ============================================================
// sw.js: service worker
//
// Dit maakt van de website een installeerbare app (PWA) en
// zorgt dat hij ook zonder internet opent. Strategie:
// eerst het netwerk proberen (zodat je altijd de nieuwste
// versie krijgt), maar bij traag of geen bereik (bv. in de
// fitness) na 4 seconden terugvallen op de bewaarde kopie.
//
// Alleen eigen bestanden (HTML/CSS/JS) die we OPHALEN (GET)
// worden bewaard, en alleen als ze goed binnenkwamen (geen
// foutpagina's). Verzoeken naar de database (Supabase) gaan
// altijd gewoon direct naar het internet.
//
// Nieuwe release? Verhoog VERSIE hier ÉN de ?v=… in index.html.
// ============================================================

const VERSIE = 28;
const CACHE_NAAM = "sportlog-v" + VERSIE;
const WACHTTIJD_MS = 4000;

// De kern van de app, die we bij installatie meteen bewaren
const KERN = [
  "./", "index.html", "manifest.json", "../config.js", "../icon.svg",
  "style.css", "fouten.js", "data.js", "motivatie.js", "berichten.js", "profiel.js", "cardio.js",
  "planning.js", "agenda.js", "beweging.js", "app.js", "account.js", "chat.js",
].map((pad) => (/\.(js|css)$/.test(pad) && !pad.startsWith("..") ? `${pad}?v=${VERSIE}` : pad));

self.addEventListener("install", (gebeurtenis) => {
  gebeurtenis.waitUntil(
    caches.open(CACHE_NAAM)
      .then((cache) => cache.addAll(KERN))
      .catch((fout) => console.warn("Vooraf bewaren deels mislukt", fout)) // nooit de installatie blokkeren
      .then(() => self.skipWaiting()) // meteen actief worden
  );
});

// Oude caches opruimen als er een nieuwe versie is
self.addEventListener("activate", (gebeurtenis) => {
  gebeurtenis.waitUntil(
    self.clients.claim().then(() => caches.keys()).then((namen) =>
      Promise.all(namen.filter((n) => n !== CACHE_NAAM).map((n) => caches.delete(n)))
    )
  );
});

async function uitCache(verzoek) {
  return (await caches.match(verzoek)) || (await caches.match(verzoek, { ignoreSearch: true }));
}

self.addEventListener("fetch", (gebeurtenis) => {
  const verzoek = gebeurtenis.request;
  const eigenSite = new URL(verzoek.url).origin === self.location.origin;
  if (verzoek.method !== "GET" || !eigenSite) return; // browser regelt het zelf

  gebeurtenis.respondWith((async () => {
    // cache: "no-cache" = altijd even bij de server checken of er een nieuwere
    // versie is. Zo krijg je nooit een mix van oude en nieuwe bestanden.
    const netwerk = fetch(verzoek, { cache: "no-cache" }).then((antwoord) => {
      if (antwoord.ok) {
        const kopie = antwoord.clone();
        caches.open(CACHE_NAAM).then((cache) => cache.put(verzoek, kopie));
      }
      return antwoord;
    });
    netwerk.catch(() => {}); // een late netwerkfout mag geen foutmelding geven

    // Wie wint: het netwerk, of de wachttijd (traag bereik)?
    const teLaat = new Promise((klaar) => setTimeout(() => klaar("te laat"), WACHTTIJD_MS));
    try {
      const eerste = await Promise.race([netwerk, teLaat]);
      if (eerste !== "te laat") return eerste;
      // Traag: toon de bewaarde kopie als die er is (het netwerk werkt de cache nog bij)
      const bewaard = await uitCache(verzoek);
      return bewaard || await netwerk;
    } catch {
      // Geen internet: bewaarde kopie
      const bewaard = await uitCache(verzoek);
      return bewaard || Response.error();
    }
  })());
});
