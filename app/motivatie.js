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

// Hoeveel dagen geleden bewoog je voor het laatst (vóór vandaag)?
// null = nog nooit iets gelogd. Gebruikt voor "Welkom terug!".
function dagenSindsLaatsteBeweging() {
  const vandaag = vandaagTekst();
  const eerder = [...actieveDagen()].filter(d => d < vandaag).sort();
  if (!eerder.length) return null;
  const laatste = new Date(eerder[eerder.length - 1] + "T12:00:00");
  return Math.round((new Date(vandaag + "T12:00:00") - laatste) / 86400000);
}
const PAUZE_DAGEN = 7; // vanaf zoveel dagen zonder beweging zeggen we "welkom terug"

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
// datum: de dag waarop je logt (telt alleen wat je vóór/op die dag deed)
function isNieuwRecord(oefening, gewicht, datum = vandaagTekst()) {
  if (!gewicht) return false;
  const eerder = workouts.filter(w => zelfdeOefening(w.oefening, oefening) && w.gewicht && w.datum <= datum);
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
  { id: "eerste",   icoon: "👟", naam: "Eerste stap",      uitleg: "Houd je eerste beweegmoment bij",          behaald: s => s.totaal >= 1,
    proficiat: "Je eerste beweegmoment staat erin! Het begin is gemaakt, en dat is altijd het moeilijkste stuk. 🧡" },
  { id: "streak3",  icoon: "🔥", naam: "Op stoom",         uitleg: "3 dagen op rij actief",           behaald: s => s.langste >= 3,
    proficiat: "Drie dagen op rij in beweging. Je zit lekker in je ritme!" },
  { id: "week1",    icoon: "🎯", naam: "Doel geraakt",     uitleg: "Haal voor het eerst je weekritme", behaald: s => s.wekenGehaald >= 1,
    proficiat: "Je eerste weekritme is gehaald! Zo groeit een gewoonte die blijft." },
  { id: "record1",  icoon: "🏆", naam: "Sterker dan ooit", uitleg: "Verbeter een persoonlijk record", behaald: s => s.records >= 1,
    proficiat: "Je eerste persoonlijke record! Voel je hoe je lichaam sterker wordt?" },
  { id: "allround", icoon: "⚡", naam: "Allrounder",       uitleg: "Kracht én cardio in één week",    behaald: s => s.allround,
    proficiat: "Kracht én cardio in één week. Afwisseling maakt bewegen extra leuk!" },
  { id: "tien",     icoon: "💪", naam: "Tien keer",        uitleg: "10 keer bewogen",            behaald: s => s.totaal >= 10,
    proficiat: "Tien keer bewogen! Dit is geen toeval meer, dit wordt een gewoonte. 🌱" },
  { id: "streak7",  icoon: "🌟", naam: "Weekstrijder",     uitleg: "7 dagen op rij actief",           behaald: s => s.langste >= 7,
    proficiat: "Een volle week elke dag in beweging. Wat een energie! Gun jezelf ook een rustdag." },
  { id: "reeks4",   icoon: "📈", naam: "Een maand sterk",  uitleg: "4 weken op rij je weekritme",      behaald: s => s.weekreeks >= 4,
    proficiat: "Vier weken op rij je challenge gehaald. Een hele maand: daar haken de meeste mensen af, jij niet!" },
  { id: "vijftig",  icoon: "🥇", naam: "Vijftig!",         uitleg: "50 keer bewogen",            behaald: s => s.totaal >= 50,
    proficiat: "Vijftig keer bewogen. Kijk eens hoe ver je al gekomen bent! 🥳" },
  { id: "reeks12",  icoon: "👑", naam: "Gewoonte-held",    uitleg: "12 weken op rij je weekritme",     behaald: s => s.weekreeks >= 12,
    proficiat: "Twaalf weken op rij. Bewegen hoort nu gewoon bij wie je bent. Echt knap!" }
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

// ===== Levels en XP =====
// Je verdient XP (ervaringspunten) met alles wat je doet:
//   10 XP per training, 20 XP per week dat je je doel haalde,
//   25 XP per badge. Zo stijg je in level.
const levels = [
  { vanaf: 0,    naam: "Starter" },
  { vanaf: 50,   naam: "Beweger" },
  { vanaf: 150,  naam: "Op dreef" },
  { vanaf: 300,  naam: "Doorzetter" },
  { vanaf: 500,  naam: "Sterkhouder" },
  { vanaf: 800,  naam: "Atleet" },
  { vanaf: 1200, naam: "Topper" },
  { vanaf: 1700, naam: "Kampioen" },
  { vanaf: 2300, naam: "Legende" },
  { vanaf: 3000, naam: "Icoon" }
];

function berekenXP() {
  return (workouts.length + cardio.length) * 10 + wekenDoelGehaald() * 20 + behaaldeBadges().length * 25;
}

// Geeft { nummer, naam, xp, vanaf, tot, procent } (tot = null bij het hoogste level)
function huidigLevel() {
  const xp = berekenXP();
  let i = 0;
  while (i + 1 < levels.length && xp >= levels[i + 1].vanaf) i++;
  const volgende = levels[i + 1];
  return {
    nummer: i + 1,
    naam: levels[i].naam,
    xp,
    vanaf: levels[i].vanaf,
    tot: volgende ? volgende.vanaf : null,
    procent: volgende ? ((xp - levels[i].vanaf) / (volgende.vanaf - levels[i].vanaf)) * 100 : 100
  };
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
    return "Welkom! Elke beweging telt, ook een korte wandeling. Waar heb jij vandaag zin in? 😃";
  }
  // Even weg geweest? Geen verwijten, gewoon blij dat je er bent.
  const pauze = dagenSindsLaatsteBeweging();
  if (!vandaagActief && pauze !== null && pauze >= PAUZE_DAGEN) {
    return "Fijn dat je er weer bent! 🧡 Geen inhaalwerk nodig: één rustige wandeling is een prima herstart.";
  }
  if (vandaagActief && nogNodig === 0) {
    return "Je weekritme is gehaald! Alles wat je nu nog doet is pure bonus. Geniet ervan! 🌟";
  }
  if (vandaagActief) {
    return `Fijn dat je bewogen hebt vandaag! Nog ${nogNodig} ${dag(nogNodig)} en je weekritme is gehaald. 🧡`;
  }
  if (nogNodig === 0) {
    return "Je weekritme heb je al gehaald. Vandaag rusten of nog even bewegen voor de fun? Allebei goed. 😌";
  }
  const weken = berekenWeekreeks();
  if (weken >= 2) {
    return `Al ${weken} weken op rij je challenge gehaald! 📈 Nog ${nogNodig} ${dag(nogNodig)} deze week en je bouwt verder aan je ritme.`;
  }
  if (nogNodig > dagenOver) {
    return "Drukke week? Helemaal oké. Elke beweging telt, ook een kleine. Doe vandaag gewoon iets wat je leuk vindt.";
  }
  if (nogNodig === dagenOver) {
    return `Nog ${nogNodig} ${dag(nogNodig)} en nog ${dagenOver} ${dag(dagenOver)} over: perfect haalbaar. Waar heb je zin in? 💥`;
  }
  return `Nog ${nogNodig} ${dag(nogNodig)} voor je weekritme, en je hebt nog ${dagenOver} ${dag(dagenOver)}. Zonder stress, gewoon op jouw tempo. 🙂`;
}

// ===== Spreuk van de dag =====
// Wordt getoond als de admin (nog) geen vastgepind bericht heeft.

const spreuken = [
  "Beweeg niet omdat het moet, maar omdat het goed voelt.",
  "Een wandeling telt. Dansen in de keuken telt. Alles telt.",
  "Je hoeft geen zin te hebben om te beginnen. De zin komt tijdens het bewegen.",
  "Tien minuten bewegen is oneindig veel meer dan nul minuten.",
  "Vergelijk jezelf alleen met wie je vorige maand was.",
  "Rusten hoort er ook bij. Morgen beweeg je met nieuwe energie.",
  "Een dagje overslaan is geen ramp. Het gaat om wat je meestal doet, niet om perfect zijn.",
  "Kleine stappen, elke week. Over een jaar herken je jezelf niet meer.",
  "Zoek de beweging die je blij maakt, en je hoeft jezelf nooit meer te dwingen.",
  "Je bent maar één wandeling verwijderd van een beter humeur.",
  "Bewegen is geen straf voor wat je at, maar een cadeau voor je lichaam.",
  "Samen bewegen is dubbel zo leuk. Vraag eens een vriend(in) mee!",
  "Plezier houdt je langer vol dan discipline ooit kan.",
  "Trots zijn mag, ook op de kleine dingen.",
  "Het beste soort beweging? Die waar je zin in hebt."
];

function spreukVanDeDag() {
  const nu = new Date();
  const dagVanHetJaar = Math.floor((nu - new Date(nu.getFullYear(), 0, 0)) / 86400000);
  return spreuken[dagVanHetJaar % spreuken.length];
}

// ===== Felicitaties na het loggen =====
// Korte, afwisselende complimenten voor een gewone log.
const complimenten = [
  "Lekker bezig! 💪", "Die telt! 🎉", "Goed gedaan! ✨", "Fijn dat je bewoog! 🧡",
  "Weer een stapje verder! 🚀", "Je lichaam zegt dankjewel! 🙌", "Zo leuk! 😃"
];
function willekeurigCompliment() {
  return complimenten[Math.floor(Math.random() * complimenten.length)];
}
