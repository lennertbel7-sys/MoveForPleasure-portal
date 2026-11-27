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

const VERSIE = 37;
const CACHE_NAAM = "sportlog-v" + VERSIE;
const WACHTTIJD_MS = 4000;

// De kern van de app, die we bij installatie meteen bewaren
const KERN = [
  "./", "index.html", "manifest.json", "../config.js", "../icon.svg",
  "style.css", "fouten.js", "data.js", "motivatie.js", "berichten.js", "profiel.js", "cardio.js",
  "planning.js", "agenda.js", "beweging.js", "app.js", "account.js", "chat.js", "onboarding.js", "herinneringen.js", "maatjes.js", "pro.js",
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
      // (de map met instellingen voor herinneringen laten we staan)
      Promise.all(namen.filter((n) => n !== CACHE_NAAM && n !== INSTELLINGEN).map((n) => caches.delete(n)))
    )
  );
});

// ===== Herinneringen (pushmeldingen) =====
// De server stuurt een LEEG seintje (geen persoonlijke inhoud via Google/Apple).
// De tekst halen we uit wat de app zelf klaarzette: je planning per weekdag
// (herinneringen.js bewaart die in de cache "mfp-instellingen").
const INSTELLINGEN = "mfp-instellingen";
const DAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];

self.addEventListener("push", (gebeurtenis) => {
  gebeurtenis.waitUntil((async () => {
    let titel = "MoveForPleasure";
    let tekst = "Zin om even te bewegen? Elke minuut telt. 🧡";
    try {
      const cache = await caches.open(INSTELLINGEN);
      // 1. Ligt er een bericht klaar in de "brievenbus" van dit toestel?
      //    (bv. "👏 Lotte moedigt je aan!"). Zo ja: dat tonen.
      const toestel = await cache.match("toestel.json");
      if (toestel) {
        const t = await toestel.json();
        const r = await fetch(`${t.url}/rest/v1/rpc/push_melding_ophalen`, {
          method: "POST",
          headers: { apikey: t.key, "Content-Type": "application/json" },
          body: JSON.stringify({ sleutel: t.sleutel }),
        });
        const melding = r.ok ? await r.json() : null;
        if (melding && melding.titel) {
          await self.registration.showNotification(melding.titel, {
            body: melding.tekst || "", icon: "../logo/icon-192.png", badge: "../logo/icon-192.png",
            tag: "aanmoediging", data: { url: "./" },
          });
          return;
        }
      }
      // 2. Anders: testmelding of herinnering uit je planning
      const test = await cache.match("test.json");
      if (test && (await test.json()).tot > Date.now()) {
        titel = "🔔 Het werkt!";
        tekst = "Zo krijg je je herinneringen op dagen waarop je iets plande.";
        await cache.delete("test.json");
      } else {
        const opgeslagen = await cache.match("herinnering.json");
        const perDag = opgeslagen ? await opgeslagen.json() : {};
        const vandaag = perDag[DAGEN[new Date().getDay()]];
        if (vandaag) { titel = vandaag.titel; tekst = vandaag.tekst; }
      }
    } catch { /* standaardtekst */ }
    await self.registration.showNotification(titel, {
      body: tekst,
      icon: "../logo/icon-192.png",
      badge: "../logo/icon-192.png",
      tag: "herinnering",          // nooit meerdere herinneringen tegelijk
      data: { url: "./" },
    });
  })());
});

// Tik op de melding: open (of toon) de app
self.addEventListener("notificationclick", (gebeurtenis) => {
  gebeurtenis.notification.close();
  gebeurtenis.waitUntil((async () => {
    const vensters = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const app = vensters.find((v) => v.url.includes("/app/"));
    if (app) return app.focus();
    return self.clients.openWindow("./");
  })());
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
