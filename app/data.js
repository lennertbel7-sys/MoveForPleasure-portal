// ============================================================
// data.js — de opslaglaag
//
// Alle code die data bewaart en ophaalt zit in dit ene bestand.
// Nu gebruikt het localStorage (opslag in je eigen browser).
// In fase 3 vervangen we de binnenkant van deze functies door
// een online database (Supabase) — de rest van de app hoeft
// daar dan niets van te merken.
// ============================================================

const opslag = {
  laad(sleutel, standaardWaarde) {
    const tekst = localStorage.getItem("sportlog-" + sleutel);
    return tekst ? JSON.parse(tekst) : standaardWaarde;
  },
  bewaar(sleutel, waarde) {
    localStorage.setItem("sportlog-" + sleutel, JSON.stringify(waarde));
  }
};

// ===== De data van de app =====
// workouts: [{ id, datum: "2026-06-11", oefening, gewicht, sets, reps }]
// cardio:   [{ id, datum, type, minuten, km, rondes? }]  rondes = [{ seconden, aantal }]
// schema:   { ma: "tekst", di: "", ... }
// weekdoel: getal (actieve dagen per week)

let workouts = opslag.laad("workouts", []);
let cardio = opslag.laad("cardio", []);
let schema = opslag.laad("schema", { ma: "", di: "", wo: "", do: "", vr: "", za: "", zo: "" });
let weekdoel = opslag.laad("weekdoel", 3);

// profiel:   { naam, doel, niveau, lengte, geboortejaar, gewichtVolgen }
// gewichten: [{ id, datum, kg }]  (lichaamsgewicht, max. één per dag)
let profiel = opslag.laad("profiel", { naam: "", doel: "", niveau: "", lengte: null, geboortejaar: null, gewichtVolgen: false });
let gewichten = opslag.laad("gewichten", []);

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

function logWorkout(oefening, gewicht, sets, reps) {
  workouts.unshift({ id: Date.now(), datum: vandaagTekst(), oefening, gewicht, sets, reps });
  opslag.bewaar("workouts", workouts);
}

function verwijderWorkout(id) {
  workouts = workouts.filter(w => w.id !== id);
  opslag.bewaar("workouts", workouts);
}

// rondes is optioneel: [{ seconden, aantal }]
function logCardio(type, minuten, km, rondes = []) {
  const item = { id: Date.now(), datum: vandaagTekst(), type, minuten, km };
  if (rondes.length) item.rondes = rondes;
  cardio.unshift(item);
  opslag.bewaar("cardio", cardio);
}

function verwijderCardio(id) {
  cardio = cardio.filter(c => c.id !== id);
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
  gewichten = gewichten.filter(g => g.datum !== vandaag);
  gewichten.push({ id: Date.now(), datum: vandaag, kg });
  gewichten.sort((a, b) => a.datum.localeCompare(b.datum)); // oudste eerst
  opslag.bewaar("gewichten", gewichten);
}

function verwijderGewicht(id) {
  gewichten = gewichten.filter(g => g.id !== id);
  opslag.bewaar("gewichten", gewichten);
}
