// ============================================================
// herinneringen.js — een seintje op dagen waarop je iets plande
//
// Instellingen (in je profiel, dus ook op je andere toestellen):
//   profiel.herinnering = { aan: true/false, uur: 8, mail: true/false }
//
// De server (Edge Function "herinnering") kijkt elk uur wie op dat uur
// een seintje wil, iets gepland heeft en nog niet bewoog. Eerst een
// pushmelding naar de toestellen waarop je meldingen aanzette, anders
// een mail.
//
// Pushmeldingen: dit toestel meldt zich aan bij de pushdienst van je
// browser (Google, Apple, Mozilla). Dat adres bewaren we in de tabel
// push_abonnementen. De melding zelf bevat niets persoonlijks: de tekst
// komt uit je planning, die we hier op het toestel klaarzetten.
// Gebruikt: db, gebruiker (account.js), schema, planTekst (planning.js)
// ============================================================

const hEl = (id) => document.getElementById(id);
const PUSH_MOGELIJK = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const IS_GEINSTALLEERD = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function herinneringInstellingen() {
  return { aan: false, uur: 8, mail: true, ...(profiel.herinnering || {}) };
}

function bewaarHerinnering(wijziging) {
  bewaarProfiel({ ...profiel, herinnering: { ...herinneringInstellingen(), ...wijziging } });
}

// ----- Teksten voor de melding klaarzetten (per weekdag) -----
// De service worker leest dit als er een seintje binnenkomt.
async function bewaarHerinneringTeksten() {
  if (!("caches" in window)) return;
  const perDag = {};
  WEEKDAGEN.forEach(dag => {
    const items = schema[dag] || [];
    if (!items.length) return;
    perDag[dag] = {
      titel: profiel.naam ? `Hoi ${profiel.naam}! Vandaag op je planning` : "Vandaag op je planning",
      tekst: items.map(planTekst).join(", ") + ". Zin? Elke minuut telt 🧡",
    };
  });
  try {
    const cache = await caches.open("mfp-instellingen");
    await cache.put("herinnering.json", new Response(JSON.stringify(perDag), { headers: { "Content-Type": "application/json" } }));
  } catch { /* niet erg */ }
}

// ----- Pushmeldingen op dit toestel -----
function sleutelNaarBytes(b64) {
  const opgevuld = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(opgevuld), c => c.charCodeAt(0));
}

async function huidigAbonnement() {
  if (!PUSH_MOGELIJK) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function pushAanzetten() {
  const knop = hEl("h-push-aan");
  knop.disabled = true;
  try {
    const toestemming = await Notification.requestPermission();
    if (toestemming !== "granted") {
      toonToast("Meldingen zijn geweigerd. Je kan ze aanzetten in de instellingen van je browser.");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const { data: sleutel, error } = await db.rpc("vapid_publiek");
    if (error || !sleutel) throw new Error("geen sleutel");
    const abonnement = (await reg.pushManager.getSubscription())
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: sleutelNaarBytes(sleutel) });
    const { error: fout } = await db.from("push_abonnementen").insert({ endpoint: abonnement.endpoint });
    if (fout && fout.code !== "23505") throw fout; // 23505 = stond er al
    await bewaarHerinneringTeksten();
    toonToast("📲 Meldingen staan aan op dit toestel!");
  } catch (e) {
    console.warn("Pushmeldingen aanzetten mislukt", e);
    toonToast("Meldingen aanzetten lukte niet. Je krijgt je herinnering dan per mail.");
  } finally {
    knop.disabled = false;
    toonHerinneringen();
  }
}

// Bij uitloggen: dit toestel afmelden, zodat de volgende gebruiker
// hier niet jouw herinneringen krijgt
async function pushAfmelden() {
  try {
    const abonnement = await huidigAbonnement();
    if (!abonnement) return;
    if (db && gebruiker) await db.from("push_abonnementen").delete().eq("endpoint", abonnement.endpoint);
    await abonnement.unsubscribe();
  } catch { /* niet erg */ }
}

async function stuurTestmelding() {
  try {
    const cache = await caches.open("mfp-instellingen");
    await cache.put("test.json", new Response(JSON.stringify({ tot: Date.now() + 60000 })));
    const { data: sessie } = await db.auth.getSession();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/herinnering`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${sessie.session.access_token}` },
      body: JSON.stringify({ test: true }),
    });
    const antwoord = await r.json();
    toonToast(antwoord.toestellen > 0 ? "🔔 Testmelding verstuurd!" : "Er is nog geen toestel met meldingen. Zet ze eerst aan.");
  } catch {
    toonToast("Testmelding versturen lukte niet. Heb je internet?");
  }
}

// ----- Scherm -----
async function toonHerinneringen() {
  if (!hEl("h-aan")) return;
  const h = herinneringInstellingen();
  hEl("h-aan").checked = h.aan;
  hEl("h-instellingen").hidden = !h.aan;
  if (document.activeElement !== hEl("h-uur")) hEl("h-uur").value = String(h.uur);
  hEl("h-mail").checked = h.mail !== false;
  if (!h.aan) return;

  const status = hEl("h-toestel-status");
  const knop = hEl("h-push-aan");
  const test = hEl("h-test");
  hEl("h-ios-tip").hidden = !(IS_IOS && !IS_GEINSTALLEERD);
  if (!PUSH_MOGELIJK) {
    status.textContent = "📧 Dit toestel kan geen meldingen tonen. Je krijgt je herinnering per mail.";
    knop.hidden = true; test.hidden = true;
    return;
  }
  const abonnement = await huidigAbonnement();
  const aan = Boolean(abonnement) && Notification.permission === "granted";
  status.textContent = aan
    ? "✅ Meldingen staan aan op dit toestel."
    : Notification.permission === "denied"
      ? "🚫 Meldingen zijn geblokkeerd in je browser. Je krijgt je herinnering per mail."
      : "Krijg je herinnering als melding op dit toestel:";
  knop.hidden = aan || Notification.permission === "denied";
  test.hidden = !aan;
}

// Wordt aangeroepen via vernieuwAlles (app.js)
function vernieuwHerinneringen() {
  toonHerinneringen();
  if (herinneringInstellingen().aan) bewaarHerinneringTeksten();
}

hEl("h-aan").addEventListener("change", (e) => {
  bewaarHerinnering({ aan: e.target.checked });
  toonHerinneringen();
  if (e.target.checked) {
    bewaarHerinneringTeksten();
    toonToast(`🔔 Herinneringen staan aan, om ${herinneringInstellingen().uur}u op dagen waarop je iets plande.`);
  } else {
    toonToast("Herinneringen staan uit.");
  }
});
hEl("h-uur").addEventListener("change", (e) => {
  bewaarHerinnering({ uur: Number(e.target.value) });
  toonToast(`🔔 Je krijgt je herinnering om ${e.target.value}u.`);
});
hEl("h-mail").addEventListener("change", (e) => bewaarHerinnering({ mail: e.target.checked }));
hEl("h-push-aan").addEventListener("click", pushAanzetten);
hEl("h-test").addEventListener("click", stuurTestmelding);
