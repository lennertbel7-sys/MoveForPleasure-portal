// ============================================================
// account.js — inloggen en online bewaren (Supabase)
//
// Hoe het werkt:
// 1. De app bewaart alles eerst lokaal (data.js). Dat blijft zo,
//    zodat hij snel is en ook zonder internet werkt.
// 2. Ben je ingelogd, dan sturen we elke wijziging een paar
//    seconden later door naar de tabel "gebruikersdata"
//    (één rij per onderdeel: workouts, cardio, profiel, ...).
// 3. Lijsten (workouts, bewegingen, gewichten) worden ALTIJD per
//    item samengevoegd: wat je op je gsm logt en wat je op je
//    tablet logt, komt allebei in je account. Wat je wist, onthouden
//    we in "verwijderd", zodat het niet terugkomt van een ander toestel.
// 4. Voor de rest (profiel, planning, weekdoel) wint de nieuwste versie.
//    Eerste login op een toestel: lokaal en online worden samengevoegd.
//
// Beveiliging: de database laat elke gebruiker alleen zijn eigen
// rijen zien (Row Level Security). De sleutel in config.js is
// publiek en mag in de browser staan.
// ============================================================

// Onderdelen die we online bewaren (de berichten-cache niet: die komt van de server)
const SYNC_SLEUTELS = ["workouts", "cardio", "schema", "weekdoel", "profiel", "gewichten", "badges-gezien", "berichten-gelezen", "verwijderd"];
// Lijsten met een id per item: die voegen we bij elke synchronisatie samen
const LIJST_SLEUTELS = ["workouts", "cardio", "gewichten"];
// Lijstjes van ids (gezien/gelezen): gewoon alles bij elkaar
const SET_SLEUTELS = ["badges-gezien", "berichten-gelezen"];
const META_SLEUTEL = "sportlog-sync"; // administratie: wat moet nog verstuurd worden?

// Supabase laden (als de CDN niet bereikbaar was, werkt de app gewoon lokaal)
const db = (typeof supabase !== "undefined")
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let gebruiker = null;     // ingelogde gebruiker (of null)
let verstuurTimer = null;
let bezigMetSync = false;
let syncOpnieuw = false;  // tijdens een sync iets gewijzigd? Dan straks nog eens

// ===== Administratie (welke onderdelen zijn lokaal gewijzigd?) =====
// { userId, gewijzigd: { sleutel: tijdstip }, teVersturen: [sleutels] }
function laadMeta() {
  const leeg = { userId: null, gewijzigd: {}, teVersturen: [] };
  try { return { ...leeg, ...JSON.parse(localStorage.getItem(META_SLEUTEL)) }; }
  catch { return leeg; }
}
function bewaarMeta(meta) {
  localStorage.setItem(META_SLEUTEL, JSON.stringify(meta));
}

// Wordt door data.js aangeroepen na elke opslag
function naOpslaan(sleutel) {
  if (!SYNC_SLEUTELS.includes(sleutel)) return;
  const meta = laadMeta();
  meta.gewijzigd[sleutel] = new Date().toISOString();
  if (!meta.teVersturen.includes(sleutel)) meta.teVersturen.push(sleutel);
  bewaarMeta(meta);
  if (gebruiker) {
    if (bezigMetSync) syncOpnieuw = true;
    clearTimeout(verstuurTimer);
    verstuurTimer = setTimeout(synchroniseer, 1500);
  }
  toonSyncStatus();
}

// Wordt nog gebruikt bij uitloggen: alles wat openstaat meteen versturen
async function verstuur() {
  clearTimeout(verstuurTimer);
  await synchroniseer();
}

// ===== Samenvoegen =====
// Gewiste items bewaren we maximaal een jaar in "verwijderd"
const BEWAAR_VERWIJDERD_DAGEN = 365;

// "verwijderd" = { workouts: { id: gewistOpMs }, cardio: {...}, gewichten: {...} }
function voegVerwijderdSamen(a, b) {
  const samen = {};
  const grens = Date.now() - BEWAAR_VERWIJDERD_DAGEN * 86400000;
  [a || {}, b || {}].forEach(bron => {
    Object.entries(bron).forEach(([soort, ids]) => {
      samen[soort] = samen[soort] || {};
      Object.entries(ids || {}).forEach(([id, op]) => {
        if (op > grens) samen[soort][id] = Math.max(op, samen[soort][id] || 0);
      });
    });
  });
  return samen;
}

// Lijst per id samenvoegen; wat ergens gewist is, valt weg
function voegLijstSamen(sleutel, lokaal, online, verwijderd) {
  if (!lokaal && !online) return null;
  const weg = (verwijderd && verwijderd[sleutel]) || {};
  const perId = new Map();
  [...(online || []), ...(lokaal || [])].forEach(item => {
    if (item && !weg[item.id]) perId.set(item.id, item);
  });
  let lijst = [...perId.values()];
  if (sleutel === "gewichten") {
    // max. één meting per dag: de laatst ingevoerde telt
    const perDag = new Map();
    lijst.sort((a, b) => a.id - b.id).forEach(g => perDag.set(g.datum, g));
    return [...perDag.values()].sort((a, b) => a.datum.localeCompare(b.datum));
  }
  return lijst.sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id); // nieuwste eerst
}

// Bij de eerste login op een toestel: profiel, planning en weekdoel samenvoegen
function voegSamen(sleutel, lokaal, online) {
  if (lokaal === null || lokaal === undefined) return online;
  if (online === null || online === undefined) return lokaal;
  if (sleutel === "schema") {
    // per dag: lokaal ingevuld wint, anders wat online stond
    const lok = normaliseerSchema(lokaal), onl = normaliseerSchema(online);
    const samen = { ...onl };
    Object.keys(lok).forEach(dag => { if (lok[dag].length) samen[dag] = lok[dag]; });
    return samen;
  }
  if (sleutel === "profiel") {
    // velden die online leeg zijn, vullen we aan met lokaal
    const samen = { ...online };
    Object.keys(lokaal).forEach(veld => {
      if (samen[veld] === "" || samen[veld] === null || samen[veld] === undefined) samen[veld] = lokaal[veld];
    });
    return samen;
  }
  return online; // weekdoel: wat al online stond
}

function lokaleWaarde(sleutel) {
  try {
    const tekst = localStorage.getItem("sportlog-" + sleutel);
    return tekst ? JSON.parse(tekst) : null;
  } catch { return null; }
}

// ===== Ophalen, samenvoegen en versturen (in één beweging) =====
async function synchroniseer() {
  if (!db || !gebruiker || !navigator.onLine) { toonSyncStatus(); return; }
  if (bezigMetSync) { syncOpnieuw = true; return; }
  bezigMetSync = true;
  syncOpnieuw = false;
  toonSyncStatus("bezig");

  let gelukt = false;
  try {
    const { data: rijen, error } = await db.from("gebruikersdata").select("sleutel, waarde, bijgewerkt");
    if (error) throw error;

    const meta = laadMeta();
    const eersteKeer = meta.userId !== gebruiker.id;
    const online = Object.fromEntries(rijen.map(r => [r.sleutel, r]));
    const stempels = { ...meta.gewijzigd }; // om straks te zien of er tussendoor iets wijzigde
    const teVersturen = [];
    let veranderd = false;
    let verwijderd = null;

    // "verwijderd" eerst, want de lijsten hebben die nodig
    const volgorde = ["verwijderd", ...SYNC_SLEUTELS.filter(s => s !== "verwijderd")];
    volgorde.forEach(s => {
      const rij = online[s];
      const onlineWaarde = rij ? rij.waarde : null;
      const lokaal = lokaleWaarde(s);
      let nieuw;

      if (s === "verwijderd") {
        nieuw = voegVerwijderdSamen(lokaal, onlineWaarde);
        verwijderd = nieuw;
      } else if (LIJST_SLEUTELS.includes(s)) {
        nieuw = voegLijstSamen(s, lokaal, onlineWaarde, verwijderd);
      } else if (SET_SLEUTELS.includes(s)) {
        nieuw = (lokaal || onlineWaarde) ? [...new Set([...(onlineWaarde || []), ...(lokaal || [])])] : null;
      } else if (eersteKeer) {
        nieuw = voegSamen(s, lokaal, onlineWaarde);
      } else if (!rij) {
        nieuw = lokaal;
      } else if (meta.teVersturen.includes(s) && new Date(meta.gewijzigd[s]) > new Date(rij.bijgewerkt)) {
        nieuw = lokaal; // hier recenter gewijzigd (bv. offline): lokaal wint
      } else {
        nieuw = onlineWaarde; // online is nieuwer
      }

      if (nieuw === null || nieuw === undefined) return;
      const nieuwTekst = JSON.stringify(nieuw);
      if (nieuwTekst !== JSON.stringify(lokaal)) {
        localStorage.setItem("sportlog-" + s, nieuwTekst); // direct, zonder naOpslaan
        veranderd = true;
      }
      if (nieuwTekst !== JSON.stringify(onlineWaarde)) {
        teVersturen.push({ user_id: gebruiker.id, sleutel: s, waarde: nieuw, bijgewerkt: new Date().toISOString() });
      }
    });

    if (teVersturen.length) {
      const { error: fout } = await db.from("gebruikersdata").upsert(teVersturen);
      if (fout) throw fout;
    }

    // Administratie: afvinken wat tijdens deze sync niet opnieuw gewijzigd is
    const nu = laadMeta();
    nu.userId = gebruiker.id;
    nu.teVersturen = nu.teVersturen.filter(s => nu.gewijzigd[s] !== stempels[s]);
    bewaarMeta(nu);

    if (veranderd) {
      herlaadData();
      gezienBadges = opslag.laad("badges-gezien", gezienBadges);
      gelezenBerichten = opslag.laad("berichten-gelezen", []);
      vernieuwAlles();
      if (typeof vulProfielFormulier === "function") vulProfielFormulier();
    }
    gelukt = true;
  } catch (fout) {
    console.warn("Synchroniseren mislukt:", fout && fout.message);
  } finally {
    bezigMetSync = false;
  }

  toonSyncStatus(gelukt ? undefined : "fout");
  // Tijdens het synchroniseren iets gewijzigd? Dan meteen nog een ronde.
  if (gelukt && syncOpnieuw) setTimeout(synchroniseer, 500);
}

// ===== Scherm =====
const el = (id) => document.getElementById(id);
let modus = "nieuw"; // "nieuw" (account maken) of "in" (inloggen)

function zetModus(nieuweModus) {
  modus = nieuweModus;
  el("account-modus-nieuw").classList.toggle("actief", modus === "nieuw");
  el("account-modus-in").classList.toggle("actief", modus === "in");
  el("account-verstuur").textContent = modus === "nieuw" ? "Account aanmaken" : "Inloggen";
  el("account-wachtwoord").autocomplete = modus === "nieuw" ? "new-password" : "current-password";
  el("account-vergeten").hidden = modus !== "in";
  // Akkoord met voorwaarden + 13+ is alleen nodig bij een nieuw account
  el("account-akkoord-rij").hidden = modus !== "nieuw";
  el("account-akkoord").required = modus === "nieuw";
  toonMelding("");
}

function toonMelding(tekst, soort = "info") {
  const m = el("account-melding");
  m.hidden = !tekst;
  m.textContent = tekst;
  m.className = "account-melding " + soort;
}

// Het welkomstscherm pas tonen als we zeker weten dat je niet ingelogd bent
// (anders flitst het even op bij het openen van de app).
let authBekend = false;

function toonAccount() {
  const ingelogd = Boolean(gebruiker);
  const herstel = !el("account-herstel").hidden;
  el("account-kaart").hidden = !ingelogd && !herstel;
  el("account-in").hidden = !ingelogd || herstel;
  el("welkom-scherm").hidden = ingelogd || !authBekend;
  document.body.classList.toggle("welkom-open", !el("welkom-scherm").hidden);
  if (ingelogd) el("account-wie").textContent = gebruiker.email;
  el("privacy-zin").textContent = ingelogd
    ? "🔒 Veilig bewaard in de EU. Je trainingen zijn privé: wij zien alleen je naam, e-mail en hoe vaak je bewoog, om je te kunnen helpen."
    : "🔒 Je gegevens blijven op dit toestel.";
  toonSyncStatus();
}

function toonSyncStatus(toestand) {
  const s = el("sync-status");
  if (!s || !gebruiker) return;
  if (!toestand) {
    if (!navigator.onLine) toestand = "offline";
    else toestand = laadMeta().teVersturen.length ? "bezig" : "klaar";
  }
  const teksten = {
    klaar: "✅ Alles bewaard",
    bezig: "⏳ Bezig met bewaren…",
    offline: "📴 Offline: wordt later bewaard",
    fout: "⚠️ Nog niet bewaard, we proberen het later opnieuw",
  };
  s.textContent = teksten[toestand];
  s.dataset.toestand = toestand;
}

// Foutmeldingen van Supabase vertalen naar gewone taal
function vertaalFout(fout) {
  const t = (fout && fout.message || "").toLowerCase();
  if (t.includes("admin-account")) return "Dit is een admin-account. Dat kan je niet via de app verwijderen.";
  if (t.includes("invalid login")) return "E-mailadres of wachtwoord klopt niet.";
  if (t.includes("already registered") || t.includes("already been registered")) return "Er bestaat al een account met dit e-mailadres. Kies 'Inloggen'.";
  if (t.includes("email not confirmed")) return "Bevestig eerst je e-mailadres via de link in je mailbox.";
  if (t.includes("password")) return "Kies een wachtwoord van minstens 8 tekens.";
  if (t.includes("rate limit") || t.includes("too many")) return "Even te veel pogingen. Probeer het over een paar minuten opnieuw.";
  if (t.includes("fetch") || t.includes("network")) return "Geen verbinding. Probeer het opnieuw als je online bent.";
  return "Er ging iets mis. Probeer het opnieuw.";
}

// Waar de link in bevestigings- en herstelmails naartoe moet
const terugAdres = location.origin + location.pathname;

if (db) {
  el("account-modus-nieuw").addEventListener("click", () => zetModus("nieuw"));
  el("account-modus-in").addEventListener("click", () => zetModus("in"));

  el("account-formulier").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = el("account-email").value.trim();
    const wachtwoord = el("account-wachtwoord").value;
    const knop = el("account-verstuur");
    knop.disabled = true;
    knop.textContent = "Even geduld…";

    let melding = "", soort = "fout";
    if (modus === "nieuw") {
      // Het akkoord (13+, voorwaarden, privacy) bewaren we bij het account, met datum en versie
      const { data, error } = await db.auth.signUp({ email, password: wachtwoord, options: {
        emailRedirectTo: terugAdres,
        data: { akkoord_voorwaarden: new Date().toISOString(), voorwaarden_versie: "2026-11-27", leeftijd_13_plus: true },
      } });
      if (error) melding = vertaalFout(error);
      else if (data.user && data.user.identities && data.user.identities.length === 0) melding = "Er bestaat al een account met dit e-mailadres. Kies 'Inloggen'.";
      else if (!data.session) {
        // Bevestiging per mail nodig: daarna kan je inloggen
        melding = "📬 Bijna klaar! Klik op de link in de mail die we je stuurden om je account te bevestigen.";
        soort = "goed";
        zetModus("in");
      }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password: wachtwoord });
      if (error) melding = vertaalFout(error);
    }
    knop.disabled = false;
    knop.textContent = modus === "nieuw" ? "Account aanmaken" : "Inloggen";
    toonMelding(melding, soort);
  });

  el("account-vergeten").addEventListener("click", async () => {
    const email = el("account-email").value.trim();
    if (!email) { toonMelding("Vul eerst je e-mailadres in.", "fout"); return; }
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: terugAdres });
    toonMelding(error ? vertaalFout(error) : "📬 Check je mailbox: we stuurden je een link om een nieuw wachtwoord te kiezen.", error ? "fout" : "goed");
  });

  el("account-herstel").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await db.auth.updateUser({ password: el("account-nieuw-wachtwoord").value });
    if (error) { alert(vertaalFout(error)); return; }
    el("account-herstel").hidden = true;
    toonAccount();
    toonTab("vandaag");
    toonToast("🔑 Nieuw wachtwoord opgeslagen!");
  });

  el("account-uitloggen").addEventListener("click", async () => {
    const meta = laadMeta();
    if (meta.teVersturen.length) {
      await verstuur();
      if (laadMeta().teVersturen.length && !confirm("Niet alles is al online bewaard (geen verbinding?). Als je nu uitlogt, ben je die laatste wijzigingen kwijt. Toch uitloggen?")) return;
    }
    // Dit toestel afmelden voor pushmeldingen (herinneringen.js)
    if (typeof pushAfmelden === "function") await pushAfmelden();
    await db.auth.signOut();
    wisLokaleData();
    location.reload();
  });

  el("account-verwijder").addEventListener("click", async () => {
    if (!confirm("Weet je het zeker? Je account en al je online bewaarde gegevens worden definitief gewist. Dit kan niet ongedaan gemaakt worden.\n\nTip: download eerst een back-up hieronder.")) return;
    const { error } = await db.rpc("verwijder_mijn_account");
    if (error) { alert(vertaalFout(error)); return; }
    await db.auth.signOut();
    wisLokaleData();
    alert("Je account en gegevens zijn gewist. Bedankt dat je met ons bewoog! 🧡");
    location.reload();
  });

  // Reageren op inloggen / uitloggen / wachtwoordherstel
  db.auth.onAuthStateChange((gebeurtenis, sessie) => {
    const vorige = gebruiker;
    gebruiker = sessie ? sessie.user : null;
    authBekend = true;
    if (gebeurtenis === "PASSWORD_RECOVERY") {
      el("account-herstel").hidden = false;
      toonAccount();
      toonTab("profiel");
      return;
    }
    toonAccount();
    // Chat starten of stoppen als de gebruiker verandert
    if ((vorige && vorige.id) !== (gebruiker && gebruiker.id) && typeof chatGebruikerGewijzigd === "function") {
      setTimeout(chatGebruikerGewijzigd, 0);
    }
    // Pas synchroniseren nadat de callback klaar is (aanbeveling van Supabase)
    if (gebruiker && (!vorige || vorige.id !== gebruiker.id)) {
      setTimeout(async () => {
        const eersteKeer = laadMeta().userId !== gebruiker.id;
        await synchroniseer();
        // Beweegmaatjes laden en een openstaande uitnodiging tonen (maatjes.js).
        // Iets later, zodat een eventuele onboarding eerst opent (die gaat voor).
        if (typeof maatjesGebruikerGewijzigd === "function") setTimeout(maatjesGebruikerGewijzigd, 300);
        if (typeof laadProInteresse === "function") laadProInteresse(); // "Op de lijst ✓" bij je profiel (pro.js)
        // Nieuw lid? Dan eerst de 3 korte vragen (onboarding.js). Pas na de sync,
        // zodat we zeker weten of er online al gegevens stonden.
        if (typeof startOnboardingIndienNodig === "function" && nodigOnboarding()) {
          startOnboardingIndienNodig();
          return;
        }
        if (eersteKeer && gebeurtenis !== "INITIAL_SESSION") toonToast("☁️ Ingelogd! Je beweging staat nu veilig online.");
      }, 0);
    }
  });

  // Terug online, of app weer geopend: bijwerken
  window.addEventListener("online", synchroniseer);
  window.addEventListener("offline", () => toonSyncStatus());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") synchroniseer();
  });
} else {
  // Supabase niet geladen (geen internet). Was je al eens ingelogd op dit
  // toestel, dan gewoon verder werken; anders uitleggen dat internet nodig is.
  const alIngelogd = Object.keys(localStorage).some(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
  if (!alIngelogd) {
    authBekend = true;
    toonMelding("📴 Voor je eerste keer inloggen heb je internet nodig. Daarna werkt de app ook offline.", "info");
    el("account-formulier").hidden = true;
    el("account-modus-nieuw").parentElement.hidden = true;
  }
}

// Na uitloggen/verwijderen: lokale kopie wissen, zodat de volgende
// persoon op dit toestel niet jouw gegevens ziet.
function wisLokaleData() {
  SYNC_SLEUTELS.forEach(s => localStorage.removeItem("sportlog-" + s));
  localStorage.removeItem(META_SLEUTEL);
}

toonAccount();
