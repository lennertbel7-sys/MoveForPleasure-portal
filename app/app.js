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

function toonTab(naam) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.add("verborgen"));
  document.getElementById("tab-" + naam).classList.remove("verborgen");
  document.querySelectorAll(".nav-knop").forEach(knop => {
    knop.classList.toggle("actief", knop.dataset.tab === naam);
  });
  document.getElementById("profiel-knop").classList.toggle("actief", naam === "profiel");
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

  if (isRecord) {
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
  return { actief: actieveDagenDezeWeek(), streak: berekenStreak(), level: huidigLevel().nummer };
}

function vernieuwStreakBadge() {
  const streak = berekenStreak();
  // De vlam flakkert (zie .vlam in style.css)
  document.getElementById("streak-badge").innerHTML =
    streak > 0 ? `<span class="vlam">🔥</span> ${streak} ${streak === 1 ? "dag" : "dagen"}` : "";
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
  document.getElementById("cijfer-streak").textContent = berekenStreak();
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

  // Weekdoel
  const actief = actieveDagenDezeWeek();
  document.getElementById("weekdoel-tekst").textContent =
    actief >= weekdoel
      ? `Challenge gehaald: ${actief} van ${weekdoel} beweegdagen! 🎉`
      : `${actief} van ${weekdoel} beweegdagen deze week`;
  document.getElementById("weekdoel-balk").style.width =
    Math.min(100, (actief / weekdoel) * 100) + "%";
  document.getElementById("weekdoel-invoer").value = weekdoel;

  // Recente activiteit: workouts en cardio samen, nieuwste eerst
  const alles = [
    ...workouts.map(w => ({ datum: w.datum, id: w.id, tekst: `🏋️ ${w.oefening} — ${w.sets}×${w.reps}${w.gewicht ? " @ " + w.gewicht + " kg" : ""}` })),
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

// Weekdoel aanpassen
document.getElementById("weekdoel-invoer").addEventListener("change", (e) => {
  const doel = parseInt(e.target.value);
  if (doel >= 1 && doel <= 7) {
    bewaarWeekdoel(doel);
    vernieuwAlles();
  }
});

// ===== Tab: Workout =====
document.getElementById("workout-formulier").addEventListener("submit", (e) => {
  e.preventDefault();
  const oefening = document.getElementById("workout-oefening").value.trim();
  const gewicht = parseFloat(document.getElementById("workout-gewicht").value) || 0;
  const sets = parseInt(document.getElementById("workout-sets").value);
  const reps = parseInt(document.getElementById("workout-reps").value);
  if (!oefening || !sets || !reps) return;
  const voor = statusVoorLog();
  const record = isNieuwRecord(oefening, gewicht, gekozenDatum); // vóór het opslaan checken!
  logWorkout(oefening, gewicht, sets, reps, gekozenDatum);
  e.target.reset();
  vernieuwAlles();
  vierResultaat(voor, record, oefening);
});

// Kop + lege melding boven de lijst van de gekozen dag
function dagLijstKop(id, aantal, leeg) {
  document.getElementById(id).textContent = `${datumKop(gekozenDatum)} · ${aantal ? aantal + " gelogd" : leeg}`;
}

function vernieuwWorkoutLijst() {
  const lijst = document.getElementById("workout-lijst");
  lijst.innerHTML = "";
  const opDag = workouts.filter(w => w.datum === gekozenDatum);
  dagLijstKop("workout-dag-kop", opDag.length, "nog niets gelogd");
  opDag.forEach(w => {
    const li = document.createElement("li");
    const tekst = document.createElement("span");
    tekst.textContent = `${w.oefening} — ${w.sets}×${w.reps}${w.gewicht ? " @ " + w.gewicht + " kg" : ""}`;
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

// ===== Tab: Cardio =====
document.getElementById("cardio-formulier").addEventListener("submit", (e) => {
  e.preventDefault();
  const fout = document.getElementById("cardio-fout");
  const type = document.getElementById("cardio-type").value;
  const rondes = verzamelRondes();
  let minuten = parseInt(document.getElementById("cardio-minuten").value);
  const km = infoVoor(type).km ? parseFloat(document.getElementById("cardio-km").value) || 0 : 0;

  // Geen minuten ingevuld? Dan rekenen we ze uit de tijd van de rondes
  const rondeSeconden = rondes.reduce((som, r) => som + r.seconden, 0);
  if (!minuten && rondeSeconden) minuten = Math.max(1, Math.round(rondeSeconden / 60));

  if (!minuten) {
    fout.textContent = "Vul het aantal minuten in, of voeg rondes met een tijd toe.";
    document.getElementById("cardio-minuten").focus();
    return;
  }
  fout.textContent = "";

  const voor = statusVoorLog();
  logCardio(type, minuten, km, rondes, gekozenDatum);
  e.target.reset();
  sluitRondes();
  pasTypeAan();
  vernieuwAlles();
  vierResultaat(voor, false);
});

function vernieuwCardioLijst() {
  const lijst = document.getElementById("cardio-lijst");
  lijst.innerHTML = "";
  const opDag = cardio.filter(c => c.datum === gekozenDatum);
  dagLijstKop("cardio-dag-kop", opDag.length, "nog niets gelogd");
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
haalBerichtenOp();

// Nieuwe berichten ophalen als je de app weer opent of weer online bent
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { haalBerichtenOp(); vernieuwAlles(); }
});
window.addEventListener("online", haalBerichtenOp);
