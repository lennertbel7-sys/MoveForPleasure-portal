// ============================================================
// motivatie.js: alles wat de gebruiker motiveert
//
//  - weekreeks: hoeveel weken op rij je je weekdoel haalde
//  - persoonlijke records (zwaarder dan ooit bij een oefening)
//  - badges (prestaties die je vrijspeelt)
//  - een persoonlijke aanmoediging op het Vandaag-scherm
//  - een spreuk van de dag (als er geen bericht van de admin is)
//
// Dit bestand gebruikt de data en hulpfuncties uit data.js.
// ============================================================

// ===== Weken =====

// Geeft de maandag van de week waarin een datum valt, als tekst ("2026-11-16")
function maandagVan(datumTekst) {
  const d = new Date(datumTekst + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return datumNaarTekst(d);
}

// Telt per week (sleutel = maandag) op hoeveel dagen je actief was
function actieveDagenPerWeek() {
  const perWeek = new Map();
  actieveDagen().forEach(dag => {
    const week = maandagVan(dag);
    perWeek.set(week, (perWeek.get(week) || 0) + 1);
  });
  return perWeek;
}

// Weekreeks: aantal weken op rij dat je je weekdoel haalde.
// De huidige week telt mee als je hem al gehaald hebt; zo niet,
// dan breekt dat de reeks (nog) niet: de week is nog bezig.
function berekenWeekreeks() {
  const perWeek = actieveDagenPerWeek();
  const week = new Date(maandagVan(vandaagTekst()) + "T12:00:00");
  let reeks = 0;

  if ((perWeek.get(datumNaarTekst(week)) || 0) >= weekdoel) reeks++;
  week.setDate(week.getDate() - 7);

  while ((perWeek.get(datumNaarTekst(week)) || 0) >= weekdoel) {
    reeks++;
    week.setDate(week.getDate() - 7);
  }
  return reeks;
}

// Totaal aantal weken waarin je je (huidige) weekdoel haalde
function wekenDoelGehaald() {
  let aantal = 0;
  actieveDagenPerWeek().forEach(dagen => { if (dagen >= weekdoel) aantal++; });
  return aantal;
}

// Langste reeks opeenvolgende actieve dagen ooit
function langsteStreak() {
  const dagen = [...actieveDagen()].sort();
  let langste = 0, huidig = 0, vorige = null;
  dagen.forEach(dag => {
    const d = new Date(dag + "T12:00:00");
    if (vorige) {
      const verschil = Math.round((d - vorige) / 86400000);
      huidig = verschil === 1 ? huidig + 1 : 1;
    } else {
      huidig = 1;
    }
    langste = Math.max(langste, huidig);
    vorige = d;
  });
  return langste;
}

// Heb je in één en dezelfde week zowel kracht als cardio gedaan?
function ooitKrachtEnCardioInEenWeek() {
  const krachtWeken = new Set(workouts.map(w => maandagVan(w.datum)));
  return cardio.some(c => krachtWeken.has(maandagVan(c.datum)));
}

// ===== Persoonlijke records =====

function zelfdeOefening(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Zou dit gewicht een nieuw record zijn? (Alleen als je de oefening al
// eerder deed: de eerste keer is per definitie geen "verbetering".)
function isNieuwRecord(oefening, gewicht) {
  if (!gewicht) return false;
  const eerder = workouts.filter(w => zelfdeOefening(w.oefening, oefening) && w.gewicht);
  if (eerder.length === 0) return false;
  return gewicht > Math.max(...eerder.map(w => w.gewicht));
}

// Hoeveel keer heb je in totaal een record verbeterd?
function aantalRecords() {
  const besteTotNu = {};
  let records = 0;
  [...workouts].reverse().forEach(w => { // oudste eerst
    if (!w.gewicht) return;
    const naam = w.oefening.trim().toLowerCase();
    if (naam in besteTotNu && w.gewicht > besteTotNu[naam]) records++;
    besteTotNu[naam] = Math.max(besteTotNu[naam] || 0, w.gewicht);
  });
  return records;
}

// ===== Badges =====

// uitleg = wat je moet doen (zie je bij een vergrendelde badge)
// proficiat = wat je te zien krijgt als je hem net vrijspeelt
const badges = [
  { id: "eerste",   icoon: "👟", naam: "Eerste stap",      uitleg: "Log je eerste training",          behaald: s => s.totaal >= 1,
    proficiat: "Je eerste training staat erin. Het begin is gemaakt, en dat is altijd het moeilijkste stuk." },
  { id: "streak3",  icoon: "🔥", naam: "Op stoom",         uitleg: "3 dagen op rij actief",           behaald: s => s.langste >= 3,
    proficiat: "Drie dagen op rij in beweging. Je zit lekker in je ritme!" },
  { id: "week1",    icoon: "🎯", naam: "Doel geraakt",     uitleg: "Haal voor het eerst je weekdoel", behaald: s => s.wekenGehaald >= 1,
    proficiat: "Je eerste weekdoel is binnen. Zo bouw je een gewoonte die blijft." },
  { id: "record1",  icoon: "🏆", naam: "Sterker dan ooit", uitleg: "Verbeter een persoonlijk record", behaald: s => s.records >= 1,
    proficiat: "Je eerste persoonlijke record. Je lichaam wordt echt sterker!" },
  { id: "allround", icoon: "⚡", naam: "Allrounder",       uitleg: "Kracht én cardio in één week",    behaald: s => s.allround,
    proficiat: "Kracht én cardio in één week: de beste combinatie voor een fit lichaam." },
  { id: "tien",     icoon: "💪", naam: "Tien keer",        uitleg: "10 trainingen gelogd",            behaald: s => s.totaal >= 10,
    proficiat: "Tien trainingen! Dit is geen toeval meer, dit wordt een gewoonte." },
  { id: "streak7",  icoon: "🌟", naam: "Weekstrijder",     uitleg: "7 dagen op rij actief",           behaald: s => s.langste >= 7,
    proficiat: "Een volle week elke dag actief. Indrukwekkend! Vergeet ook niet te rusten." },
  { id: "reeks4",   icoon: "📈", naam: "Een maand sterk",  uitleg: "4 weken op rij je weekdoel",      behaald: s => s.weekreeks >= 4,
    proficiat: "Vier weken op rij je doel gehaald. Een hele maand consequent: daar haken de meeste mensen af, jij niet." },
  { id: "vijftig",  icoon: "🥇", naam: "Vijftig!",         uitleg: "50 trainingen gelogd",            behaald: s => s.totaal >= 50,
    proficiat: "Vijftig trainingen. Kijk eens hoe ver je al gekomen bent!" },
  { id: "reeks12",  icoon: "👑", naam: "Gewoonte-held",    uitleg: "12 weken op rij je weekdoel",     behaald: s => s.weekreeks >= 12,
    proficiat: "Twaalf weken op rij. Sporten hoort nu gewoon bij wie je bent. Echt knap." }
];

// Alle cijfers die de badges nodig hebben, in één keer berekend
function verzamelStatus() {
  return {
    totaal: workouts.length + cardio.length,
    langste: langsteStreak(),
    weekreeks: berekenWeekreeks(),
    wekenGehaald: wekenDoelGehaald(),
    records: aantalRecords(),
    allround: ooitKrachtEnCardioInEenWeek()
  };
}

function behaaldeBadges() {
  const status = verzamelStatus();
  return badges.filter(b => b.behaald(status)).map(b => b.id);
}

// Welke badges zijn nieuw sinds de vorige keer? Die vieren we.
// Bij de allereerste keer (bestaande gebruikers) tellen we alles
// als "al gezien", zodat je niet tien felicitaties tegelijk krijgt.
let gezienBadges = opslag.laad("badges-gezien", null);
if (gezienBadges === null) {
  gezienBadges = behaaldeBadges();
  opslag.bewaar("badges-gezien", gezienBadges);
}

function nieuweBadges() {
  const nieuw = behaaldeBadges().filter(id => !gezienBadges.includes(id));
  if (nieuw.length) {
    gezienBadges = [...gezienBadges, ...nieuw];
    opslag.bewaar("badges-gezien", gezienBadges);
  }
  return nieuw.map(id => badges.find(b => b.id === id));
}

// ===== Aanmoediging op het Vandaag-scherm =====

function groet() {
  const uur = new Date().getHours();
  if (uur < 6) return "Goedenacht";
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

function aanmoediging() {
  const vandaagActief = actieveDagen().has(vandaagTekst());
  const actief = actieveDagenDezeWeek();
  const nogNodig = Math.max(0, weekdoel - actief);
  const dagenOver = 7 - ((new Date().getDay() + 6) % 7); // incl. vandaag
  const streak = berekenStreak();
  const totaal = workouts.length + cardio.length;
  const dag = (n) => (n === 1 ? "dag" : "dagen");

  if (totaal === 0) {
    return "Elke reis begint met één stap. Log vandaag je eerste training, hoe klein ook. 💪";
  }
  if (vandaagActief && nogNodig === 0) {
    return "Weekdoel binnen! Alles wat je nu nog doet is pure bonus. 🌟";
  }
  if (vandaagActief) {
    return `Lekker bezig vandaag! Nog ${nogNodig} ${dag(nogNodig)} en je weekdoel is binnen.`;
  }
  if (nogNodig === 0) {
    return "Je weekdoel heb je al gehaald. Vandaag rusten of nog even bewegen? Allebei goed. 😌";
  }
  if (streak >= 2) {
    return `Je streak van ${streak} dagen staat op het spel 🔥 Een korte wandeling telt ook!`;
  }
  if (nogNodig > dagenOver) {
    return "Deze week wordt krap, en dat is oké. Elke training telt. Pak vandaag gewoon de draad weer op.";
  }
  if (nogNodig === dagenOver) {
    return `Nog ${nogNodig} ${dag(nogNodig)} nodig en nog ${dagenOver} ${dag(dagenOver)} over: vandaag telt! 💥`;
  }
  return `Nog ${nogNodig} ${dag(nogNodig)} tot je weekdoel en nog ${dagenOver} ${dag(dagenOver)} over. Je kunt het!`;
}

// ===== Spreuk van de dag =====
// Wordt getoond als de admin (nog) geen vastgepind bericht heeft.

const spreuken = [
  "Consequent zijn wint het altijd van perfect zijn.",
  "De moeilijkste stap is die naar de deur. Daarna gaat het vanzelf.",
  "Je hoeft niet zin te hebben om te beginnen. De zin komt tijdens het bewegen.",
  "Tien minuten bewegen is oneindig veel meer dan nul minuten.",
  "Vergelijk jezelf alleen met wie je vorige maand was.",
  "Rustdagen zijn geen luiheid: dan word je sterker.",
  "Eén gemiste training is geen probleem. Zorg alleen dat het er geen twee op rij worden.",
  "Je lichaam onthoudt elke training, ook de korte.",
  "Kleine stappen, elke week. Over een jaar herken je jezelf niet meer.",
  "Motivatie zet je in beweging, gewoonte houdt je in beweging.",
  "Je bent maar één training verwijderd van een beter humeur.",
  "Niet sneller dan gisteren nodig: gewoon opnieuw opdagen.",
  "Plan je training zoals een afspraak. Die met jezelf is de belangrijkste.",
  "Trots zijn mag ook op de dagen dat het zwaar voelde.",
  "Sporten is geen straf voor wat je at, maar een cadeau voor wat je lichaam kan."
];

function spreukVanDeDag() {
  const nu = new Date();
  const dagVanHetJaar = Math.floor((nu - new Date(nu.getFullYear(), 0, 0)) / 86400000);
  return spreuken[dagVanHetJaar % spreuken.length];
}

// ===== Felicitaties na het loggen =====
// Korte, afwisselende complimenten voor een gewone log.
const complimenten = [
  "Lekker bezig! 💪", "Weer een stap vooruit! 🚀", "Goed gedaan! ✨",
  "Die telt! ✅", "Sterk werk! 🔥", "Je toekomstige ik is je dankbaar! 🙌"
];
function willekeurigCompliment() {
  return complimenten[Math.floor(Math.random() * complimenten.length)];
}
