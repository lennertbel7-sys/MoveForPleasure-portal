// ============================================================
// account.js — inloggen en online bewaren (Supabase)
//
// Hoe het werkt:
// 1. De app bewaart alles eerst lokaal (data.js). Dat blijft zo,
//    zodat hij snel is en ook zonder internet werkt.
// 2. Ben je ingelogd, dan sturen we elke wijziging een paar
//    seconden later door naar de tabel "gebruikersdata"
//    (één rij per onderdeel: workouts, cardio, profiel, ...).
// 3. Bij het openen van de app halen we op wat online staat.
//    Per onderdeel wint de nieuwste versie.
// 4. Eerste keer inloggen op een toestel? Dan voegen we wat je
//    lokaal had samen met wat online staat. Niets gaat verloren.
//
// Beveiliging: de database laat elke gebruiker alleen zijn eigen
// rijen zien (Row Level Security). De sleutel in config.js is
// publiek en mag in de browser staan.
// ============================================================

// Onderdelen die we online bewaren (de berichten-cache niet: die komt van de server)
const SYNC_SLEUTELS = ["workouts", "cardio", "schema", "weekdoel", "profiel", "gewichten", "badges-gezien", "berichten-gelezen"];
// Lijsten met een id per item: die kunnen we bij de eerste login samenvoegen
const LIJST_SLEUTELS = ["workouts", "cardio", "gewichten"];
const META_SLEUTEL = "sportlog-sync"; // administratie: wat moet nog verstuurd worden?

// Supabase laden (als de CDN niet bereikbaar was, werkt de app gewoon lokaal)
const db = (typeof supabase !== "undefined")
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let gebruiker = null;     // ingelogde gebruiker (of null)
let verstuurTimer = null;
let bezigMetSync = false;

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
  if (gebruiker && !bezigMetSync) {
    clearTimeout(verstuurTimer);
    verstuurTimer = setTimeout(verstuur, 1500);
  }
  toonSyncStatus();
}

// ===== Versturen naar Supabase =====
async function verstuur() {
  const meta = laadMeta();
  if (!gebruiker || !meta.teVersturen.length) { toonSyncStatus(); return; }
  if (!navigator.onLine) { toonSyncStatus(); return; }

  const rijen = meta.teVersturen
    .map(s => ({ user_id: gebruiker.id, sleutel: s, waarde: opslag.laad(s, null), bijgewerkt: meta.gewijzigd[s] || new Date().toISOString() }))
    .filter(r => r.waarde !== null);
  toonSyncStatus("bezig");
  const { error } = await db.from("gebruikersdata").upsert(rijen);
  if (error) {
    console.warn("Online bewaren mislukt:", error.message);
    toonSyncStatus("fout");
    return;
  }
  // Alleen afvinken wat sindsdien niet opnieuw gewijzigd is
  const nu = laadMeta();
  nu.teVersturen = nu.teVersturen.filter(s => {
    const verstuurd = rijen.find(r => r.sleutel === s);
    return !verstuurd || nu.gewijzigd[s] !== verstuurd.bijgewerkt;
  });
  bewaarMeta(nu);
  toonSyncStatus();
}

// ===== Samenvoegen bij de eerste login op dit toestel =====
function voegSamen(sleutel, lokaal, online) {
  if (lokaal === null || lokaal === undefined) return online;
  if (online === null || online === undefined) return lokaal;

  if (LIJST_SLEUTELS.includes(sleutel)) {
    const perId = new Map();
    [...online, ...lokaal].forEach(item => perId.set(item.id, item));
    let lijst = [...perId.values()];
    if (sleutel === "gewichten") {
      // max. één meting per dag: de laatste telt
      const perDag = new Map();
      lijst.sort((a, b) => a.id - b.id).forEach(g => perDag.set(g.datum, g));
      return [...perDag.values()].sort((a, b) => a.datum.localeCompare(b.datum));
    }
    return lijst.sort((a, b) => b.id - a.id); // nieuwste eerst
  }
  if (sleutel === "badges-gezien" || sleutel === "berichten-gelezen") {
    return [...new Set([...online, ...lokaal])];
  }
  if (sleutel === "schema") {
    // per dag: lokaal ingevuld wint, anders wat online stond
    const samen = { ...online };
    Object.keys(lokaal).forEach(dag => { if (lokaal[dag]) samen[dag] = lokaal[dag]; });
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

// ===== Ophalen + samenvoegen =====
async function synchroniseer() {
  if (!gebruiker || bezigMetSync || !navigator.onLine) { toonSyncStatus(); return; }
  bezigMetSync = true;
  toonSyncStatus("bezig");

  const { data: rijen, error } = await db.from("gebruikersdata").select("sleutel, waarde, bijgewerkt");
  if (error) {
    console.warn("Ophalen mislukt:", error.message);
    bezigMetSync = false;
    toonSyncStatus("fout");
    return;
  }

  const meta = laadMeta();
  const eersteKeer = meta.userId !== gebruiker.id;
  let veranderd = false;

  SYNC_SLEUTELS.forEach(s => {
    const rij = rijen.find(r => r.sleutel === s);
    const lokaalTekst = localStorage.getItem("sportlog-" + s);
    const lokaal = lokaalTekst ? JSON.parse(lokaalTekst) : null;

    let nieuw;
    let moetVersturen = false;
    if (eersteKeer) {
      nieuw = voegSamen(s, lokaal, rij ? rij.waarde : null);
      moetVersturen = nieuw !== null && JSON.stringify(nieuw) !== JSON.stringify(rij ? rij.waarde : null);
    } else if (!rij) {
      nieuw = lokaal;
      moetVersturen = lokaal !== null;
    } else if (meta.teVersturen.includes(s) && new Date(meta.gewijzigd[s]) > new Date(rij.bijgewerkt)) {
      nieuw = lokaal; // hier recenter gewijzigd (bv. offline): lokaal wint
      moetVersturen = true;
    } else {
      nieuw = rij.waarde; // online is nieuwer
      meta.teVersturen = meta.teVersturen.filter(x => x !== s);
      meta.gewijzigd[s] = rij.bijgewerkt;
    }

    if (nieuw !== null && JSON.stringify(nieuw) !== lokaalTekst) {
      localStorage.setItem("sportlog-" + s, JSON.stringify(nieuw)); // direct, zonder naOpslaan
      veranderd = true;
    }
    if (moetVersturen) {
      if (!meta.teVersturen.includes(s)) meta.teVersturen.push(s);
      if (eersteKeer || !meta.gewijzigd[s]) meta.gewijzigd[s] = new Date().toISOString();
    }
  });

  meta.userId = gebruiker.id;
  bewaarMeta(meta);

  if (veranderd) {
    herlaadData();
    gezienBadges = opslag.laad("badges-gezien", gezienBadges);
    gelezenBerichten = opslag.laad("berichten-gelezen", []);
    vernieuwAlles();
    vulProfielFormulier();
  }
  bezigMetSync = false;
  await verstuur();
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
    ? "🔒 Je gegevens worden veilig bewaard in de EU. Alleen jij kunt ze zien."
    : "🔒 Je gegevens blijven op dit toestel. Niemand anders kan ze zien.";
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
      const { data, error } = await db.auth.signUp({ email, password: wachtwoord, options: { emailRedirectTo: terugAdres } });
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
    // Pas synchroniseren nadat de callback klaar is (aanbeveling van Supabase)
    if (gebruiker && (!vorige || vorige.id !== gebruiker.id)) {
      setTimeout(async () => {
        const eersteKeer = laadMeta().userId !== gebruiker.id;
        await synchroniseer();
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
