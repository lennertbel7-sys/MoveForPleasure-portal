// ============================================================
// beweging.js — één formulier voor alle beweging
//
// Je typt zelf in wat je deed: "wandelen", "padel", "squats",
// "yoga met mijn zus"… Alles telt. De app onthoudt wat je ooit
// intypte en toont het als snelknopjes en suggesties.
//
// Hoe we het bewaren (zodat records, badges en statistieken blijven werken):
//   - met sets én reps  → als krachtoefening (lijst "workouts")
//   - anders            → als beweging met minuten (lijst "cardio")
// ============================================================

// Voor wie nog niets logde: een paar ideeën om mee te beginnen
const standaardBewegingen = ["Wandelen", "Fietsen", "Hardlopen", "Zwemmen", "Traplopen", "Touwspringen",
  "Krachttraining", "Yoga", "Dansen", "Padel"];

const beweegVelden = {
  minuten: document.getElementById("beweeg-minuten"),
  km: document.getElementById("beweeg-km"),
  kg: document.getElementById("beweeg-kg"),
  sets: document.getElementById("beweeg-sets"),
  reps: document.getElementById("beweeg-reps")
};
const beweegDetails = document.getElementById("beweeg-details");

// Alle bewegingen die je ooit logde: meest recente eerst, zonder dubbels
// (hoofdletters maken niet uit: "Squat" en "squat" zijn dezelfde).
function mijnBewegingen() {
  const alles = [
    ...workouts.map(w => ({ naam: w.oefening, datum: w.datum, id: w.id })),
    ...cardio.map(c => ({ naam: c.type, datum: c.datum, id: c.id }))
  ].sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id);
  const namen = new Map();
  alles.forEach(x => {
    const sleutel = String(x.naam).trim().toLowerCase();
    if (sleutel && !namen.has(sleutel)) namen.set(sleutel, String(x.naam).trim());
  });
  return [...namen.values()];
}

// Zelfde schrijfwijze als vroeger, zodat "wandelen" en "Wandelen" samen tellen.
// Iets nieuws? Dan met een hoofdletter vooraan.
function netteNaam(tekst) {
  const schoon = tekst.trim().replace(/\s+/g, " ");
  const bestaand = [...mijnBewegingen(), ...standaardBewegingen]
    .find(n => n.toLowerCase() === schoon.toLowerCase());
  return bestaand || schoon.charAt(0).toUpperCase() + schoon.slice(1);
}

// Wat deed je de vorige keer bij deze beweging?
function vorigeKeer(naam) {
  const sleutel = naam.trim().toLowerCase();
  if (!sleutel) return null;
  const w = workouts.find(x => x.oefening.trim().toLowerCase() === sleutel);
  const c = cardio.find(x => String(x.type).trim().toLowerCase() === sleutel);
  if (w && (!c || w.datum > c.datum || (w.datum === c.datum && w.id > c.id))) return { kracht: true, item: w };
  if (c) return { kracht: false, item: c };
  return null;
}

// ===== Snelknopjes en suggesties =====
function vernieuwBeweegKeuzes() {
  const eigen = mijnBewegingen();
  const extra = standaardBewegingen.filter(n => !eigen.some(e => e.toLowerCase() === n.toLowerCase()));

  // Suggesties tijdens het typen: alles wat je ooit deed + de standaardlijst
  const lijst = document.getElementById("beweeg-suggesties");
  lijst.innerHTML = "";
  [...eigen, ...extra].forEach(naam => {
    const o = document.createElement("option");
    o.value = naam;
    lijst.appendChild(o);
  });

  // Knopjes: je 10 meest recente bewegingen (aangevuld met ideeën)
  const chips = document.getElementById("beweeg-chips");
  chips.innerHTML = "";
  [...eigen, ...extra].slice(0, 10).forEach(naam => {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "beweeg-chip";
    const vorige = vorigeKeer(naam);
    knop.textContent = `${vorige && vorige.kracht ? "🏋️" : infoVoor(naam).icoon} ${naam}`;
    knop.addEventListener("click", () => kiesBeweging(naam));
    chips.appendChild(knop);
  });
}

function kiesBeweging(naam) {
  const wat = document.getElementById("beweeg-wat");
  wat.value = naam;
  vulVorigeKeerIn();
  pasTypeAan();
  // Naar het eerste veld dat je waarschijnlijk wilt aanpassen
  const vorige = vorigeKeer(naam);
  (vorige && vorige.kracht ? beweegVelden.sets : beweegVelden.minuten).focus();
}

// ===== Vorige keer automatisch invullen =====
// Alleen velden die je zelf nog niet aanpaste (dataset.auto = "1" = door ons ingevuld).
Object.values(beweegVelden).forEach(veld => veld.addEventListener("input", () => { veld.dataset.auto = ""; }));

function vulVorigeKeerIn() {
  const naam = document.getElementById("beweeg-wat").value;
  const vorige = vorigeKeer(naam);
  const hint = document.getElementById("beweeg-vorige");
  const it = vorige && vorige.item;
  const waarden = !vorige ? {} : vorige.kracht
    ? { minuten: it.minuten || "", kg: it.gewicht || "", sets: it.sets, reps: it.reps }
    : { minuten: it.minuten || "", km: it.km || "" };

  let detailsNodig = false;
  Object.entries(beweegVelden).forEach(([sleutel, veld]) => {
    if (veld.value === "" || veld.dataset.auto === "1") {
      const nieuw = waarden[sleutel] ?? "";
      veld.value = nieuw;
      veld.dataset.auto = nieuw === "" ? "" : "1";
      if (nieuw !== "" && sleutel !== "minuten") detailsNodig = true;
    }
  });
  if (detailsNodig) beweegDetails.open = true;

  hint.hidden = !vorige;
  if (vorige) {
    const wat = vorige.kracht ? krachtTekst(it) : cardioTekst(it);
    hint.textContent = `↺ Vorige keer (${leesbareDatum(it.datum)}): ${wat.replace(/^.*? — /, "")}. Pas aan wat anders was.`;
  }
}
document.getElementById("beweeg-wat").addEventListener("input", vulVorigeKeerIn);

// ===== Loggen =====
document.getElementById("beweeg-formulier").addEventListener("submit", (e) => {
  e.preventDefault();
  const fout = document.getElementById("beweeg-fout");
  const watVeld = document.getElementById("beweeg-wat");
  const getal = (veld) => parseFloat(veld.value) || 0;

  const naam = watVeld.value.trim() ? netteNaam(watVeld.value) : "";
  const kg = getal(beweegVelden.kg);
  const sets = Math.round(getal(beweegVelden.sets));
  const reps = Math.round(getal(beweegVelden.reps));
  const km = getal(beweegVelden.km);
  const rondes = verzamelRondes();
  let minuten = Math.round(getal(beweegVelden.minuten));

  const meld = (tekst, veld) => { fout.textContent = tekst; if (veld) veld.focus(); };
  if (!naam) return meld("Wat heb je gedaan? Typ het in of tik op een knopje.", watVeld);
  if ((sets && !reps) || (!sets && reps)) {
    beweegDetails.open = true;
    return meld("Vul zowel sets als reps in, of laat ze allebei leeg.", sets ? beweegVelden.reps : beweegVelden.sets);
  }

  const voor = statusVoorLog();
  if (sets && reps) {
    // Krachtoefening (telt mee voor je persoonlijke records)
    const record = isNieuwRecord(naam, kg, gekozenDatum); // vóór het opslaan checken!
    logWorkout(naam, kg, sets, reps, gekozenDatum, minuten);
    naLoggen();
    vierResultaat(voor, record, naam);
    return;
  }

  // Geen minuten ingevuld? Dan rekenen we ze uit de tijd van de rondes
  const rondeSeconden = rondes.reduce((som, r) => som + r.seconden, 0);
  if (!minuten && rondeSeconden) minuten = Math.max(1, Math.round(rondeSeconden / 60));
  if (!minuten) return meld("Hoe lang heb je bewogen? Vul de minuten in.", beweegVelden.minuten);

  logCardio(naam, minuten, km, rondes, gekozenDatum);
  naLoggen();
  vierResultaat(voor, false);
});

function naLoggen() {
  document.getElementById("beweeg-fout").textContent = "";
  document.getElementById("beweeg-formulier").reset();
  Object.values(beweegVelden).forEach(veld => { veld.dataset.auto = ""; });
  document.getElementById("beweeg-vorige").hidden = true;
  beweegDetails.open = false;
  sluitRondes();
  pasTypeAan();
  vernieuwAlles();
}
