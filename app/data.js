// ============================================================
// data.js — de opslaglaag
//
// Alle code die data bewaart en ophaalt zit in dit ene bestand.
// Alles wordt eerst in je eigen browser bewaard (localStorage),
// zodat de app snel is en ook zonder internet werkt.
// Ben je ingelogd, dan stuurt account.js elke wijziging daarna
// op de achtergrond door naar de online database (Supabase).
// ============================================================

const opslag = {
  laad(sleutel, standaardWaarde) {
    // Beschadigde opslag mag de app nooit laten crashen
    try {
      const tekst = localStorage.getItem("sportlog-" + sleutel);
      return tekst ? JSON.parse(tekst) : standaardWaarde;
    } catch { return standaardWaarde; }
  },
  bewaar(sleutel, waarde) {
    localStorage.setItem("sportlog-" + sleutel, JSON.stringify(waarde));
    // Laat account.js weten dat er iets veranderd is (voor de online opslag)
    if (typeof naOpslaan === "function") naOpslaan(sleutel);
  }
};

// ===== De data van de app =====
// workouts: [{ id, datum: "2026-06-11", oefening, gewicht, sets, reps, minuten? }]  (bewegingen met sets × reps)
// cardio:   [{ id, datum, type, minuten, km, rondes?, aantal? }]  alle andere beweging; type = wat je intypte
//           rondes = [{ seconden, aantal }]
// weekdoel: getal (actieve dagen per week)

let workouts = opslag.laad("workouts", []);
let cardio = opslag.laad("cardio", []);
// Oudere data kan in "log-volgorde" staan: zet alles op datum
workouts.sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id);
cardio.sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id);
// schema (weekplanning): { ma: [ { id, sport, minuten, tijd, notitie } ], di: [...], ... }
// Vroeger was elke dag één stukje tekst; normaliseerSchema zet dat om.
const WEEKDAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];
function normaliseerSchema(s) {
  const nieuw = {};
  WEEKDAGEN.forEach((dag, i) => {
    const waarde = s && s[dag];
    if (Array.isArray(waarde)) nieuw[dag] = waarde;
    else if (typeof waarde === "string" && waarde.trim()) nieuw[dag] = [{ id: i + 1, sport: "Anders", minuten: null, tijd: "", notitie: waarde.trim() }];
    else nieuw[dag] = [];
  });
  return nieuw;
}
let schema = normaliseerSchema(opslag.laad("schema", null));
let weekdoel = opslag.laad("weekdoel", 3);

// profiel:   { naam, doel, niveau, lengte, geboortejaar, gewichtVolgen }
// gewichten: [{ id, datum, kg }]  (lichaamsgewicht, max. één per dag)
let profiel = opslag.laad("profiel", { naam: "", doel: "", niveau: "", lengte: null, geboortejaar: null, gewichtVolgen: false });
let gewichten = opslag.laad("gewichten", []);

// Opnieuw inlezen (nadat de online opslag nieuwere data binnenhaalde)
function herlaadData() {
  workouts = sorteerNieuwsteEerst(opslag.laad("workouts", []));
  cardio = sorteerNieuwsteEerst(opslag.laad("cardio", []));
  schema = normaliseerSchema(opslag.laad("schema", null));
  weekdoel = opslag.laad("weekdoel", 3);
  profiel = opslag.laad("profiel", { naam: "", doel: "", niveau: "", lengte: null, geboortejaar: null, gewichtVolgen: false });
  gewichten = opslag.laad("gewichten", []);
}

// ===== Hulpfuncties voor datums =====
function datumNaarTekst(datum) {
  const jaar = datum.getFullYear();
  const maand = String(datum.getMonth() + 1).padStart(2, "0");
  const dag = String(datum.getDate()).padStart(2, "0");
  return `${jaar}-${maand}-${dag}`;
}

function vandaagTekst() {
  return datumNaarTekst(new Date());
}

// Zet "2026-06-11" om naar leesbare tekst zoals "do 11/6"
const dagAfkortingen = ["zo", "ma", "di", "wo", "do", "vr", "za"];
function leesbareDatum(datumTekst) {
  const d = new Date(datumTekst + "T12:00:00");
  return `${dagAfkortingen[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

// ===== Afgeleide gegevens =====

// Alle dagen waarop iets gelogd is (workout óf cardio).
function actieveDagen() {
  const dagen = new Set();
  workouts.forEach(w => dagen.add(w.datum));
  cardio.forEach(c => dagen.add(c.datum));
  return dagen;
}

// Streak: hoeveel dagen op rij actief? Vandaag nog niets gedaan
// is niet erg — dan telt de reeks t/m gisteren.
function berekenStreak() {
  const dagen = actieveDagen();
  let streak = 0;
  const d = new Date();
  if (!dagen.has(datumNaarTekst(d))) d.setDate(d.getDate() - 1);
  while (dagen.has(datumNaarTekst(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// Hoeveel dagen deze week (vanaf maandag) was je actief?
function actieveDagenDezeWeek() {
  const dagen = actieveDagen();
  const d = new Date();
  // getDay(): zo=0, ma=1 ... we willen terug tot en met maandag
  const dagenSindsMaandag = (d.getDay() + 6) % 7;
  let teller = 0;
  for (let i = 0; i <= dagenSindsMaandag; i++) {
    const dag = new Date();
    dag.setDate(dag.getDate() - i);
    if (dagen.has(datumNaarTekst(dag))) teller++;
  }
  return teller;
}

// ===== Acties die data wijzigen =====
// Elk item krijgt een uniek id, zodat we het later kunnen verwijderen.

// Nieuwste eerst, op datum (zo kan je ook iets van vorige week toevoegen
// en blijft de volgorde kloppen voor records en lijsten).
function sorteerNieuwsteEerst(lijst) {
  return lijst.sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id);
}

// datum is optioneel: zonder datum wordt het vandaag
// minuten is optioneel (hoe lang je krachttraining duurde)
function logWorkout(oefening, gewicht, sets, reps, datum = vandaagTekst(), minuten = 0) {
  const item = { id: Date.now(), datum, oefening, gewicht, sets, reps };
  if (minuten) item.minuten = minuten;
  workouts.unshift(item);
  sorteerNieuwsteEerst(workouts);
  opslag.bewaar("workouts", workouts);
}

// Onthoud dat een item gewist is, zodat het niet terugkomt
// wanneer een ander toestel synchroniseert (zie account.js)
function markeerVerwijderd(soort, ids) {
  const verwijderd = opslag.laad("verwijderd", {});
  verwijderd[soort] = verwijderd[soort] || {};
  [].concat(ids).forEach(id => { verwijderd[soort][id] = Date.now(); });
  opslag.bewaar("verwijderd", verwijderd);
}

function verwijderWorkout(id) {
  workouts = workouts.filter(w => w.id !== id);
  markeerVerwijderd("workouts", id);
  opslag.bewaar("workouts", workouts);
}

// rondes is optioneel: [{ seconden, aantal }]
// minuten mag 0 zijn als je iets anders invulde (treden, km of rondes)
// aantal = totaal geteld (treden, sprongen, banen), alleen zonder rondes
function logCardio(type, minuten, km, rondes = [], datum = vandaagTekst(), aantal = 0) {
  const item = { id: Date.now(), datum, type, minuten: minuten || 0, km };
  if (rondes.length) item.rondes = rondes;
  else if (aantal) item.aantal = aantal;
  cardio.unshift(item);
  sorteerNieuwsteEerst(cardio);
  opslag.bewaar("cardio", cardio);
}

function verwijderCardio(id) {
  cardio = cardio.filter(c => c.id !== id);
  markeerVerwijderd("cardio", id);
  opslag.bewaar("cardio", cardio);
}

function bewaarSchema(nieuwSchema) {
  schema = nieuwSchema;
  opslag.bewaar("schema", schema);
}

function bewaarWeekdoel(doel) {
  weekdoel = doel;
  opslag.bewaar("weekdoel", weekdoel);
}

function bewaarProfiel(nieuwProfiel) {
  profiel = nieuwProfiel;
  opslag.bewaar("profiel", profiel);
}

// Lichaamsgewicht: weeg je twee keer op één dag, dan telt de laatste
function logGewicht(kg) {
  const vandaag = vandaagTekst();
  const vervangen = gewichten.filter(g => g.datum === vandaag).map(g => g.id);
  if (vervangen.length) markeerVerwijderd("gewichten", vervangen);
  gewichten = gewichten.filter(g => g.datum !== vandaag);
  gewichten.push({ id: Date.now(), datum: vandaag, kg });
  gewichten.sort((a, b) => a.datum.localeCompare(b.datum)); // oudste eerst
  opslag.bewaar("gewichten", gewichten);
}

function verwijderGewicht(id) {
  gewichten = gewichten.filter(g => g.id !== id);
  markeerVerwijderd("gewichten", id);
  opslag.bewaar("gewichten", gewichten);
}

// Alle gewichtsmetingen wissen (bij intrekken van toestemming)
function wisAlleGewichten() {
  if (gewichten.length) markeerVerwijderd("gewichten", gewichten.map(g => g.id));
  gewichten = [];
  opslag.bewaar("gewichten", gewichten);
}
