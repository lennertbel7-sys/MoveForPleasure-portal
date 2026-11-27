// ============================================================
// fouten.js — foutmeldingen automatisch doorsturen (monitoring)
//
// Loopt de app ergens vast (een JavaScript-fout), dan sturen we
// een korte technische melding naar de tabel "app_fouten".
// De admin ziet die op de adminpagina en kan het probleem oplossen.
//
// Privacy: alleen de foutmelding zelf, het bestand/de regel, de
// app-versie en het type browser. Geen trainingen of andere
// gegevens. Max. 5 meldingen per bezoek, elke melding maar één keer.
// Dit bestand laadt als eerste, zodat het ook fouten van de rest vangt.
// ============================================================

(function () {
  const VERSIE = (document.currentScript && (document.currentScript.src.match(/v=(\d+)/) || [])[1]) || "?";
  const MAX_PER_BEZOEK = 5;
  const gemeld = new Set();

  // Fouten die niets met onze app te maken hebben (browserextensies e.d.)
  const negeren = [/ResizeObserver loop/i, /^Script error\.?$/i, /extension:\/\//i];

  function toegangsToken() {
    try {
      const sleutel = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
      const sessie = sleutel && JSON.parse(localStorage.getItem(sleutel));
      return sessie && sessie.access_token;
    } catch { return null; }
  }

  async function verstuur(melding) {
    const url = `${SUPABASE_URL}/rest/v1/app_fouten`;
    const kop = { apikey: SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=minimal" };
    const token = toegangsToken();
    const body = JSON.stringify(melding);
    try {
      let r = await fetch(url, { method: "POST", headers: token ? { ...kop, Authorization: `Bearer ${token}` } : kop, body });
      if (!r.ok && token) await fetch(url, { method: "POST", headers: kop, body }); // verlopen login: anoniem
    } catch { /* geen internet: jammer, niet erg */ }
  }

  function meld(bericht, bron) {
    bericht = String(bericht || "Onbekende fout").slice(0, 500);
    if (negeren.some(p => p.test(bericht) || p.test(bron || ""))) return;
    const sleutel = bericht + "|" + bron;
    if (gemeld.has(sleutel) || gemeld.size >= MAX_PER_BEZOEK) return;
    gemeld.add(sleutel);
    verstuur({
      bericht,
      bron: String(bron || "").replace(location.origin, "").slice(0, 300),
      versie: String(VERSIE).slice(0, 20),
      browser: navigator.userAgent.slice(0, 200),
    });
  }

  window.addEventListener("error", (e) => {
    meld(e.message, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : "");
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    meld(r && r.message ? r.message : String(r), r && r.stack ? String(r.stack).split("\n")[1] : "belofte");
  });
})();
