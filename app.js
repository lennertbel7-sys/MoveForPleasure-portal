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
  vernieuwAlles();
}

// ===== Alles op het scherm verversen =====
// Na elke wijziging roepen we dit aan: het leest de actuele data
// en tekent alle onderdelen opnieuw.
function vernieuwAlles() {
  vernieuwStreakBadge();
  vernieuwVandaag();
  vernieuwWorkoutLijst();
  vernieuwCardioLijst();
}

function vernieuwStreakBadge() {
  const streak = berekenStreak();
  document.getElementById("streak-badge").textContent =
    streak > 0 ? `🔥 ${streak} ${streak === 1 ? "dag" : "dagen"}` : "";
}

// ===== Tab: Vandaag =====
function vernieuwVandaag() {
  const nu = new Date();
  const dagSleutel = dagSleutels[nu.getDay()];

  document.getElementById("vandaag-titel").textContent =
    `${dagNamenVoluit[dagSleutel]} ${nu.getDate()}/${nu.getMonth() + 1}`;

  // Training van vandaag uit het weekschema
  const planVandaag = schema[dagSleutel];
  document.getElementById("vandaag-schema").textContent =
    planVandaag ? planVandaag : "Niets gepland — stel je weekschema in via de Schema-tab.";

  // Weekdoel
  const actief = actieveDagenDezeWeek();
  document.getElementById("weekdoel-tekst").textContent =
    actief >= weekdoel
      ? `Weekdoel gehaald: ${actief} van ${weekdoel} dagen actief! 🎉`
      : `${actief} van ${weekdoel} dagen actief deze week`;
  document.getElementById("weekdoel-balk").style.width =
    Math.min(100, (actief / weekdoel) * 100) + "%";
  document.getElementById("weekdoel-invoer").value = weekdoel;

  // Recente activiteit: workouts en cardio samen, nieuwste eerst
  const alles = [
    ...workouts.map(w => ({ datum: w.datum, id: w.id, tekst: `🏋️ ${w.oefening} — ${w.sets}×${w.reps}${w.gewicht ? " @ " + w.gewicht + " kg" : ""}` })),
    ...cardio.map(c => ({ datum: c.datum, id: c.id, tekst: `🏃 ${c.type} — ${c.minuten} min${c.km ? ", " + c.km + " km" : ""}` }))
  ].sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id).slice(0, 8);

  const lijst = document.getElementById("recente-lijst");
  lijst.innerHTML = "";
  if (alles.length === 0) {
    lijst.innerHTML = `<li><span class="gedempt">Nog niets gelogd. Begin via de Workout- of Cardio-tab!</span></li>`;
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
  logWorkout(oefening, gewicht, sets, reps);
  e.target.reset();
  document.getElementById("workout-oefening").focus();
  vernieuwAlles();
});

function vernieuwWorkoutLijst() {
  const lijst = document.getElementById("workout-lijst");
  lijst.innerHTML = "";
  workouts.slice(0, 20).forEach(w => {
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
  const type = document.getElementById("cardio-type").value;
  const minuten = parseInt(document.getElementById("cardio-minuten").value);
  const km = parseFloat(document.getElementById("cardio-km").value) || 0;
  if (!minuten) return;
  logCardio(type, minuten, km);
  e.target.reset();
  vernieuwAlles();
});

function vernieuwCardioLijst() {
  const lijst = document.getElementById("cardio-lijst");
  lijst.innerHTML = "";
  cardio.slice(0, 20).forEach(c => {
    const li = document.createElement("li");
    const tekst = document.createElement("span");
    tekst.textContent = `${c.type} — ${c.minuten} min${c.km ? ", " + c.km + " km" : ""}`;
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

// ===== Tab: Schema =====
// De 7 invoervelden (ma t/m zo) één keer opbouwen.
const schemaVelden = document.getElementById("schema-velden");
["ma", "di", "wo", "do", "vr", "za", "zo"].forEach(dag => {
  const div = document.createElement("div");
  div.className = "schema-dag";
  const label = document.createElement("label");
  label.textContent = dagNamenVoluit[dag];
  label.htmlFor = "schema-" + dag;
  const veld = document.createElement("input");
  veld.type = "text";
  veld.id = "schema-" + dag;
  veld.placeholder = "bv. benen + 20 min hardlopen (of leeg = rustdag)";
  veld.maxLength = 80;
  veld.value = schema[dag];
  div.append(label, veld);
  schemaVelden.appendChild(div);
});

document.getElementById("schema-formulier").addEventListener("submit", (e) => {
  e.preventDefault();
  const nieuwSchema = {};
  ["ma", "di", "wo", "do", "vr", "za", "zo"].forEach(dag => {
    nieuwSchema[dag] = document.getElementById("schema-" + dag).value.trim();
  });
  bewaarSchema(nieuwSchema);
  toonTab("vandaag"); // terug naar het overzicht zodat je het resultaat ziet
});

// ===== PWA: service worker registreren =====
// Hiermee kan de app op een telefoon "geïnstalleerd" worden.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

// ===== Start =====
vernieuwAlles();
