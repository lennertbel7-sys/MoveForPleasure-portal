// ============================================================
// app.js — de gebruikersinterface
//
// Dit bestand leest de data (uit data.js) en zet die op het
// scherm, en verwerkt wat de gebruiker doet (tikken, invullen).
// ============================================================

// ===== Navigatie tussen tabs =====
const dagSleutels = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const dagNamenVoluit = { ma: "Maandag", di: "Dinsdag", wo: "Woensdag", do: "Donderdag", vr: "Vrijdag", za: "Zaterdag", zo: "Zondag" };

document.querySelectorAll(".nav-knop").forEach(knop => {
  knop.addEventListener("click", () => toonTab(knop.dataset.tab));
});

// Berichten zit achter het belletje rechtsboven
document.getElementById("berichten-knop").addEventListener("click", () => toonTab("berichten"));

// De app heeft 4 tabs. Kracht en cardio zitten samen in "Bewegen";
// toonTab("workout") of toonTab("cardio") opent die tab met het juiste formulier.
function toonTab(naam) {
  if (naam === "workout" || naam === "cardio") naam = "bewegen"; // oude namen

  // Bestaat die tab niet (bv. half bijgewerkte app)? Dan naar Vandaag i.p.v. een leeg scherm.
  if (!document.getElementById("tab-" + naam)) naam = "vandaag";
  document.querySelectorAll(".tab").forEach(tab => tab.classList.add("verborgen"));
  document.getElementById("tab-" + naam).classList.remove("verborgen");
  document.querySelectorAll(".nav-knop").forEach(knop => {
    knop.classList.toggle("actief", knop.dataset.tab === naam);
  });
  document.getElementById("profiel-knop").classList.toggle("actief", naam === "profiel");
  document.getElementById("berichten-knop").classList.toggle("actief", naam === "berichten");
  vernieuwAlles();
  window.scrollTo(0, 0);
  // Berichten-tab geopend: de nieuwe berichten zijn nog even gemarkeerd
  // (zodat je ziet wat nieuw is), maar de teller gaat meteen naar 0.
  if (naam === "berichten") markeerAllesGelezen();
}

// Snelknoppen op het Vandaag-scherm
document.querySelectorAll(".snel-knop").forEach(knop => {
  knop.addEventListener("click", () => toonTab(knop.dataset.naar));
});

// ===== Alles op het scherm verversen =====
// Na elke wijziging roepen we dit aan: het leest de actuele data
// en tekent alle onderdelen opnieuw.
function vernieuwAlles() {
  vernieuwStreakBadge();
  vernieuwVandaag();
  vernieuwWorkoutLijst();
  vernieuwCardioLijst();
  vernieuwBerichten();
  vernieuwProfiel();
  vernieuwPlanning();
  vernieuwAgendas();
}

// ===== Felicitaties =====
let toastTimer;
function toonToast(tekst) {
  const toast = document.getElementById("toast");
  toast.textContent = tekst;
  toast.classList.add("zichtbaar");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("zichtbaar"), 2600);
}

function toonViering(icoon, titel, tekst) {
  document.getElementById("viering-icoon").textContent = icoon;
  document.getElementById("viering-titel").textContent = titel;
  document.getElementById("viering-tekst").textContent = tekst;
  const viering = document.getElementById("viering");
  viering.hidden = false;
  strooiConfetti(viering);
  document.getElementById("viering-knop").focus();
}

function sluitViering() {
  const viering = document.getElementById("viering");
  viering.hidden = true;
  viering.querySelectorAll(".confetti").forEach(c => c.remove());
}
document.getElementById("viering-knop").addEventListener("click", sluitViering);
document.getElementById("viering").addEventListener("click", (e) => { if (e.target.id === "viering") sluitViering(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") sluitViering(); });

function strooiConfetti(plek) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const kleuren = ["#ff7a3d", "#ff4f8b", "#ffd23f", "#ff7a3d", "#f9f871"];
  for (let i = 0; i < 60; i++) {
    const stukje = document.createElement("span");
    stukje.className = "confetti";
    stukje.style.left = Math.random() * 100 + "vw";
    stukje.style.background = kleuren[i % kleuren.length];
    stukje.style.animationDelay = Math.random() * 0.6 + "s";
    stukje.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
    stukje.style.transform = `rotate(${Math.random() * 360}deg)`;
    plek.appendChild(stukje);
  }
}

// Wordt aangeroepen NA elke log. "voor" bevat hoe het ervoor stond,
// zodat we kunnen zien wat er net veranderd is.
function vierResultaat(voor, isRecord, oefening) {
  const nuActief = actieveDagenDezeWeek();
  const streak = berekenStreak();
  const badgesNieuw = nieuweBadges();
  const badgeTekst = badgesNieuw.length
    ? ` Nieuwe badge: ${badgesNieuw.map(b => b.icoon + " " + b.naam).join(", ")}!`
    : "";

  const level = huidigLevel();

  // Terug na een pauze: dat is het belangrijkste moment om te vieren
  if (voor.pauze !== null && voor.pauze >= PAUZE_DAGEN && voor.vandaagActief === false && gekozenDatum === vandaagTekst()) {
    toonViering("👋", "Welkom terug!",
      `Na ${voor.pauze} dagen pauze weer in beweging. Opnieuw beginnen is misschien wel de knapste stap van allemaal. 🧡` + badgeTekst);
  } else if (isRecord) {
    toonViering("🏆", "Nieuw persoonlijk record!", `Zwaarder dan ooit bij ${oefening}. Voel je hoe sterk je wordt? 💪` + badgeTekst);
  } else if (level.nummer > voor.level) {
    toonViering("⭐", `Level up! Level ${level.nummer}`,
      `Je bent nu officieel "${level.naam}". Elke training brengt je verder.` + badgeTekst);
  } else if (voor.actief < weekdoel && nuActief >= weekdoel) {
    const reeks = berekenWeekreeks();
    toonViering("🎯", "Weekchallenge gehaald!",
      (reeks > 1 ? `Al ${reeks} weken op rij! ` : "") + "Zo groeit een gewoonte die blijft. Geniet ervan!" + badgeTekst);
  } else if (streak > voor.streak && [3, 7, 14, 21, 30, 50, 100].includes(streak)) {
    toonViering("🔥", `${streak} dagen op rij!`, "Wat een energie! Gun jezelf ook af en toe een rustdag. 😌" + badgeTekst);
  } else if (badgesNieuw.length) {
    const b = badgesNieuw[0];
    const extra = badgesNieuw.slice(1).map(x => `${x.icoon} ${x.naam}`).join(", ");
    toonViering(b.icoon, `Nieuwe badge: ${b.naam}`, b.proficiat + (extra ? ` Je speelde ook vrij: ${extra}.` : ""));
  } else {
    toonToast(willekeurigCompliment());
  }
}

function statusVoorLog() {
  return {
    actief: actieveDagenDezeWeek(), streak: berekenStreak(), level: huidigLevel().nummer,
    pauze: dagenSindsLaatsteBeweging(), vandaagActief: actieveDagen().has(vandaagTekst())
  };
}

// Bovenaan staat je weekritme (weken op rij je weekdoel gehaald).
// Dat is milder dan dagen op rij: één gemiste dag verandert er niets aan.
// Nog geen week gehaald? Dan tonen we de dagen op rij, als die er zijn.
function vernieuwStreakBadge() {
  const badge = document.getElementById("streak-badge");
  const weken = berekenWeekreeks();
  const streak = berekenStreak();
  if (weken > 0) {
    badge.innerHTML = `📈 ${weken} ${weken === 1 ? "week" : "weken"}`;
    badge.title = "Zoveel weken op rij haalde je je weekchallenge";
  } else if (streak > 1) {
    // De vlam flakkert (zie .vlam in style.css)
    badge.innerHTML = `<span class="vlam">🔥</span> ${streak} dagen`;
    badge.title = "Zoveel dagen op rij in beweging";
  } else {
    badge.innerHTML = "";
  }
}

// ===== Tab: Vandaag =====
function vernieuwVandaag() {
  const nu = new Date();
  const dagSleutel = dagSleutels[nu.getDay()];

  document.getElementById("vandaag-titel").textContent =
    `${dagNamenVoluit[dagSleutel]} ${nu.getDate()}/${nu.getMonth() + 1}`;

  // Groet, aanmoediging en de drie cijfers
  document.getElementById("groet").textContent = groet() + (profiel.naam ? `, ${profiel.naam}` : "") + "! 👋";
  document.getElementById("aanmoediging").textContent = aanmoediging();
  document.getElementById("cijfer-weekreeks").textContent = berekenWeekreeks();
  document.getElementById("cijfer-totaal").textContent = workouts.length + cardio.length;

  // Weekdoel-ring: de gekleurde rand vult zich naarmate je dichter bij je doel komt
  const actiefDezeWeek = actieveDagenDezeWeek();
  const omtrek = 2 * Math.PI * 34;
  const deel = Math.min(1, actiefDezeWeek / weekdoel);
  const ringVoor = document.getElementById("ring-voor");
  ringVoor.style.strokeDasharray = omtrek;
  ringVoor.style.strokeDashoffset = omtrek * (1 - deel);
  document.getElementById("ring").classList.toggle("vol", deel >= 1);
  document.getElementById("ring-tekst").textContent = deel >= 1 ? "🎉" : `${actiefDezeWeek}/${weekdoel}`;

  // Level en XP
  const level = huidigLevel();
  document.getElementById("level-naam").textContent = `⭐ Level ${level.nummer} · ${level.naam}`;
  document.getElementById("level-xp").textContent = level.tot
    ? `${level.xp} / ${level.tot} XP`
    : `${level.xp} XP · max level!`;
  document.getElementById("level-vulling").style.width = level.procent + "%";

  // Bolletjes ma t/m zo
  const bolletjes = document.getElementById("week-bolletjes");
  bolletjes.innerHTML = "";
  const dagen = actieveDagen();
  const maandag = new Date(maandagVan(vandaagTekst()) + "T12:00:00");
  ["ma", "di", "wo", "do", "vr", "za", "zo"].forEach((naam, i) => {
    const dag = new Date(maandag);
    dag.setDate(maandag.getDate() + i);
    const tekst = datumNaarTekst(dag);
    const bol = document.createElement("div");
    bol.className = "bolletje";
    if (dagen.has(tekst)) bol.classList.add("actief");
    if (tekst === vandaagTekst()) bol.classList.add("vandaag");
    bol.innerHTML = `<span>${dagen.has(tekst) ? "✓" : ""}</span><small>${naam}</small>`;
    bolletjes.appendChild(bol);
  });

  // Badges
  const behaald = behaaldeBadges();
  const badgeVak = document.getElementById("badges");
  badgeVak.innerHTML = "";
  badges.forEach(b => {
    const div = document.createElement("div");
    div.className = "badge" + (behaald.includes(b.id) ? " behaald" : "");
    div.title = b.uitleg;
    div.innerHTML = `<span class="badge-icoon">${behaald.includes(b.id) ? b.icoon : "🔒"}</span><small></small>`;
    div.querySelector("small").textContent = b.naam;
    badgeVak.appendChild(div);
  });
  document.getElementById("badges-telling").textContent = `${behaald.length}/${badges.length}`;

  // Doel + wat er vandaag gepland staat (planning.js)
  vernieuwPlanningVandaag();

  // Recente activiteit: workouts en cardio samen, nieuwste eerst
  const alles = [
    ...workouts.map(w => ({ datum: w.datum, id: w.id, tekst: krachtTekst(w) })),
    ...cardio.map(c => ({ datum: c.datum, id: c.id, tekst: cardioTekst(c) }))
  ].sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id).slice(0, 8);

  const lijst = document.getElementById("recente-lijst");
  lijst.innerHTML = "";
  if (alles.length === 0) {
    lijst.innerHTML = `<li><span class="gedempt">Nog niets bijgehouden. Elke beweging telt, begin waar je zin in hebt! 😃</span></li>`;
    return;
  }
  alles.forEach(item => {
    const li = document.createElement("li");
    const tekst = document.createElement("span");
    tekst.textContent = item.tekst;
    const datum = document.createElement("span");
    datum.className = "datum";
    datum.textContent = leesbareDatum(item.datum);
    li.append(tekst, datum);
    lijst.appendChild(li);
  });
}

// Tik op de ring: naar Planning, waar je je weekdoel kiest
document.getElementById("ring").addEventListener("click", () => toonTab("schema"));

// Kop boven wat er op de gekozen dag gelogd is (kracht + cardio samen)
function vernieuwDagKop() {
  const aantal = workouts.filter(w => w.datum === gekozenDatum).length + cardio.filter(c => c.datum === gekozenDatum).length;
  document.getElementById("dag-kop").textContent =
    `${datumKop(gekozenDatum)} · ${aantal ? aantal + " gelogd" : "nog niets gelogd"}`;
}

// ===== Tab: Bewegen =====
// Het formulier zit in beweging.js; hier tekenen we wat er op de gekozen dag gelogd is.
function vernieuwWorkoutLijst() {
  vernieuwBeweegKeuzes();
  const lijst = document.getElementById("workout-lijst");
  lijst.innerHTML = "";
  const opDag = workouts.filter(w => w.datum === gekozenDatum);
  vernieuwDagKop();
  opDag.forEach(w => {
    const li = document.createElement("li");
    const tekst = document.createElement("span");
    tekst.textContent = krachtTekst(w);
    const datum = document.createElement("span");
    datum.className = "datum";
    datum.textContent = leesbareDatum(w.datum);
    const wis = document.createElement("button");
    wis.className = "wissen";
    wis.textContent = "✕";
    wis.onclick = () => { verwijderWorkout(w.id); vernieuwAlles(); };
    li.append(tekst, datum, wis);
    lijst.appendChild(li);
  });
}

function vernieuwCardioLijst() {
  const lijst = document.getElementById("cardio-lijst");
  lijst.innerHTML = "";
  const opDag = cardio.filter(c => c.datum === gekozenDatum);
  opDag.forEach(c => {
    const li = document.createElement("li");
    const tekst = document.createElement("span");
    tekst.textContent = cardioTekst(c);
    const datum = document.createElement("span");
    datum.className = "datum";
    datum.textContent = leesbareDatum(c.datum);
    const wis = document.createElement("button");
    wis.className = "wissen";
    wis.textContent = "✕";
    wis.onclick = () => { verwijderCardio(c.id); vernieuwAlles(); };
    li.append(tekst, datum, wis);
    lijst.appendChild(li);
  });
}

// ===== Tab: Planning =====
// Doel en weekplanning staan in planning.js

// ===== PWA: service worker registreren =====
// Hiermee kan de app op een telefoon "geïnstalleerd" worden.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

// ===== Start =====
vernieuwAlles();
// Link uit de zondagmail (.../app/#profiel): meteen je profiel openen
if (location.hash === "#profiel") toonTab("profiel");
haalBerichtenOp();

// Nieuwe berichten ophalen als je de app weer opent of weer online bent
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { haalBerichtenOp(); vernieuwAlles(); }
});
window.addEventListener("online", haalBerichtenOp);
