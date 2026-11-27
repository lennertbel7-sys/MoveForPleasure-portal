// ============================================================
// onboarding.js — 3 korte vragen na je eerste login
//
// Nieuwe leden landen niet meer op een scherm vol nullen, maar
// krijgen eerst drie vragen: je naam, waarom je wil bewegen, en
// hoeveel dagen per week (plus wat je graag doet). Daarna maken
// we meteen een weekplanning en nodigen we uit tot de eerste log.
//
// Wie al iets heeft (naam, doel of beweging) krijgt dit niet.
// "Later" mag altijd; dan vragen we het niet opnieuw.
// Gebruikt: doelOpties, weekdoelUitleg, vulWeekVoor, sportIcoon (planning.js)
// ============================================================

const obEl = (id) => document.getElementById(id);
const obScherm = obEl("onboarding");
const obKeuze = { doel: "", dagen: 3, sport: "Wandelen" };
const obSporten = ["Wandelen", "Fietsen", "Hardlopen", "Zwemmen", "Krachttraining", "Padel", "Touwspringen", "Traplopen"];

function nodigOnboarding() {
  if (profiel.onboarding) return false;                      // al gedaan of overgeslagen
  if (profiel.naam || profiel.doel) return false;            // bestaand lid
  if (workouts.length || cardio.length) return false;        // heeft al bewogen
  return true;
}

// Wordt door account.js aangeroepen nadat je ingelogd bent en je data binnen is
function startOnboardingIndienNodig() {
  if (!nodigOnboarding()) return;
  obKeuze.dagen = weekdoel || 3;
  toonObStap(1);
  obScherm.hidden = false;
  document.body.classList.add("welkom-open");
  setTimeout(() => obEl("ob-naam").focus(), 50);
}

function sluitOnboarding() {
  obScherm.hidden = true;
  document.body.classList.remove("welkom-open");
}

function toonObStap(n) {
  obScherm.querySelectorAll(".ob-stap").forEach(s => { s.hidden = Number(s.dataset.stap) !== n; });
  obScherm.querySelectorAll(".ob-bolletjes i").forEach((b, i) => b.classList.toggle("actief", i < n));
  obEl("ob-later").hidden = n === 4;
  obScherm.querySelector(".ob-bolletjes").hidden = n === 4;
  if (n === 2) tekenObDoelen();
  if (n === 3) tekenObDagen();
}

// ----- Stap 1: naam -----
obScherm.querySelector('[data-stap="1"]').addEventListener("submit", (e) => {
  e.preventDefault();
  toonObStap(2);
});

// ----- Stap 2: waarom -----
function tekenObDoelen() {
  const vak = obEl("ob-doelen");
  vak.innerHTML = "";
  doelOpties.forEach(optie => {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "doel-tegel" + (obKeuze.doel === optie.id ? " gekozen" : "");
    knop.setAttribute("role", "radio");
    knop.setAttribute("aria-checked", obKeuze.doel === optie.id);
    knop.innerHTML = `<span class="doel-icoon">${optie.icoon}</span><span></span>`;
    knop.lastChild.textContent = optie.naam;
    knop.onclick = () => { obKeuze.doel = optie.id; tekenObDoelen(); };
    vak.appendChild(knop);
  });
}
obEl("ob-naar-3").addEventListener("click", () => toonObStap(3));

// ----- Stap 3: dagen + favoriete sport -----
function tekenObDagen() {
  const vak = obEl("ob-dagen");
  vak.innerHTML = "";
  for (let n = 1; n <= 7; n++) {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "weekdoel-knop" + (obKeuze.dagen === n ? " gekozen" : "");
    knop.setAttribute("role", "radio");
    knop.setAttribute("aria-checked", obKeuze.dagen === n);
    knop.textContent = n;
    knop.onclick = () => { obKeuze.dagen = n; tekenObDagen(); };
    vak.appendChild(knop);
  }
  obEl("ob-dagen-uitleg").textContent = weekdoelUitleg[obKeuze.dagen] || "";

  const sporten = obEl("ob-sporten");
  sporten.innerHTML = "";
  obSporten.forEach(sport => {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "ob-sport" + (obKeuze.sport === sport ? " gekozen" : "");
    knop.setAttribute("role", "radio");
    knop.setAttribute("aria-checked", obKeuze.sport === sport);
    knop.textContent = `${sportIcoon(sport)} ${sport}`;
    knop.onclick = () => { obKeuze.sport = sport; tekenObDagen(); };
    sporten.appendChild(knop);
  });
}

// ----- Afronden: alles bewaren en de week voorstellen -----
const dagVoluit = { ma: "maandag", di: "dinsdag", wo: "woensdag", do: "donderdag", vr: "vrijdag", za: "zaterdag", zo: "zondag" };
function opsomming(lijst) {
  return lijst.length <= 1 ? lijst.join("") : lijst.slice(0, -1).join(", ") + " en " + lijst[lijst.length - 1];
}

obEl("ob-klaar").addEventListener("click", () => {
  const naam = obEl("ob-naam").value.trim();
  bewaarProfiel({ ...profiel, naam: naam || profiel.naam || "", doel: obKeuze.doel || profiel.doel || "", onboarding: new Date().toISOString() });
  bewaarWeekdoel(obKeuze.dagen);
  const dagen = vulWeekVoor(obKeuze.sport);
  // Nieuwe leden niet meteen begroeten met "4 ongelezen": oudere berichten tellen als gelezen
  if (typeof markeerAllesGelezen === "function") markeerAllesGelezen();
  vernieuwAlles();
  if (typeof vulProfielFormulier === "function") vulProfielFormulier();

  obEl("ob-klaar-titel").textContent = naam ? `Klaar, ${naam}!` : "Klaar!";
  obEl("ob-klaar-tekst").textContent = dagen.length
    ? `We planden ${sportIcoon(obKeuze.sport)} ${obKeuze.sport.toLowerCase()} op ${opsomming(dagen.map(d => dagVoluit[d]))}. Past het niet? Pas het gewoon aan bij Planning.`
    : "Je week staat klaar. Pas gerust aan wat je wil bij Planning.";
  toonObStap(4);
});

obEl("ob-eerste-log").addEventListener("click", () => {
  sluitOnboarding();
  toonTab("bewegen");
  if (typeof kiesBeweging === "function") kiesBeweging(obKeuze.sport);
});
obEl("ob-planning").addEventListener("click", () => {
  sluitOnboarding();
  toonTab("schema");
});

// ----- Later -----
obEl("ob-later").addEventListener("click", () => {
  bewaarProfiel({ ...profiel, onboarding: "overgeslagen" });
  sluitOnboarding();
  toonToast("Geen probleem! Je kan je doel later instellen bij Planning.");
});
