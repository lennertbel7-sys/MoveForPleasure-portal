// ============================================================
// planning.js — je doel en je weekplanning
//
// Mijn doel:  waarom je beweegt (keuze + eigen woorden + datum)
//             en hoeveel dagen per week (= je weekritme).
// Planning:   per dag één of meer activiteiten met sport, duur,
//             tijdstip en notitie. Alles wordt meteen bewaard.
// Vandaag:    toont je doel en wat er vandaag gepland staat,
//             met een knop om het meteen te loggen.
// ============================================================

const doelOpties = [
  { id: "volhouden", icoon: "🌱", naam: "Een gewoonte opbouwen" },
  { id: "fit",       icoon: "⚡", naam: "Fitter en energieker" },
  { id: "conditie",  icoon: "❤️", naam: "Betere conditie" },
  { id: "sterker",   icoon: "💪", naam: "Sterker worden" },
  { id: "afvallen",  icoon: "⚖️", naam: "Gewicht verliezen" },
];

const weekdoelUitleg = {
  1: "Mooi begin! Eén keer per week is al beter dan niets. 🌱",
  2: "Twee dagen: haalbaar en een goede basis.",
  3: "Drie dagen: de gulden middenweg. Een sterke keuze! 💪",
  4: "Vier dagen: lekker actief bezig.",
  5: "Vijf dagen: beweging wordt echt deel van je leven. 🔥",
  6: "Zes dagen: indrukwekkend! Gun jezelf wel één rustdag.",
  7: "Elke dag bewegen! Een wandeling telt ook. 🚶",
};

// Sporten die je kan plannen: krachttraining + alle sporten uit cardio.js
const planSporten = [{ naam: "Krachttraining", icoon: "🏋️" }]
  .concat(Object.keys(sportInfo).map(naam => ({ naam, icoon: sportInfo[naam].icoon })));
const sportIcoon = (naam) => (planSporten.find(s => s.naam === naam) || { icoon: "🏅" }).icoon;

const plEl = (id) => document.getElementById(id);
let openDag = null; // dag waarvan het "plan iets"-formulier open staat

// Vandaag als sleutel: "ma", "di", ...
function vandaagDag() {
  return WEEKDAGEN[(new Date().getDay() + 6) % 7];
}

// "🚶 Wandelen · 30 min · 18:00"
function planTekst(item) {
  const delen = [`${sportIcoon(item.sport)} ${item.sport === "Anders" && item.notitie ? item.notitie : item.sport}`];
  if (item.minuten) delen.push(`${item.minuten} min`);
  if (item.tijd) delen.push(item.tijd);
  return delen.join(" · ");
}

// ===================== Mijn doel =====================
function tekenDoel() {
  const tegels = plEl("doel-tegels");
  tegels.innerHTML = "";
  doelOpties.forEach(optie => {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "doel-tegel" + (profiel.doel === optie.id ? " gekozen" : "");
    knop.setAttribute("role", "radio");
    knop.setAttribute("aria-checked", profiel.doel === optie.id);
    knop.innerHTML = `<span class="doel-icoon">${optie.icoon}</span><span></span>`;
    knop.lastChild.textContent = optie.naam;
    knop.onclick = () => kiesDoel(optie.id);
    tegels.appendChild(knop);
  });

  // Velden niet overschrijven terwijl je erin typt
  if (document.activeElement !== plEl("doel-tekst")) plEl("doel-tekst").value = profiel.doelTekst || "";
  if (document.activeElement !== plEl("doel-datum")) plEl("doel-datum").value = profiel.doelDatum || "";
  plEl("doel-datum").min = vandaagTekst();

  const keuze = plEl("weekdoel-keuze");
  keuze.innerHTML = "";
  for (let n = 1; n <= 7; n++) {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "weekdoel-knop" + (weekdoel === n ? " gekozen" : "");
    knop.setAttribute("role", "radio");
    knop.setAttribute("aria-checked", weekdoel === n);
    knop.textContent = n;
    knop.onclick = () => {
      bewaarWeekdoel(n);
      vernieuwAlles();
      toonToast(`🎯 Je weekritme: ${n} ${n === 1 ? "dag" : "dagen"} bewegen`);
    };
    keuze.appendChild(knop);
  }
  plEl("weekdoel-uitleg").textContent = weekdoelUitleg[weekdoel] || "";
}

function kiesDoel(id) {
  const nieuw = { ...profiel, doel: profiel.doel === id ? "" : id };
  let extra = "";
  // Gewicht bijhouden zetten we nooit vanzelf aan (gezondheidsgegeven: eerst toestemming).
  if (nieuw.doel === "afvallen" && !profiel.gewichtVolgen) {
    extra = " Wil je ook je gewicht volgen? Dat kan in je profiel.";
  }
  bewaarProfiel(nieuw);
  vernieuwAlles();
  if (nieuw.doel) toonToast("🎯 Doel opgeslagen!" + extra);
}

plEl("doel-tekst").addEventListener("change", (e) => {
  bewaarProfiel({ ...profiel, doelTekst: e.target.value.trim() });
  vernieuwAlles();
  toonToast("🎯 Doel opgeslagen!");
});
plEl("doel-datum").addEventListener("change", (e) => {
  bewaarProfiel({ ...profiel, doelDatum: e.target.value || null });
  vernieuwAlles();
});

// ===================== Weekplanning =====================
function geplandeDagen() {
  return WEEKDAGEN.filter(dag => schema[dag].length).length;
}

function tekenPlanning() {
  // Hoeveel dagen gepland t.o.v. je weekritme?
  const gepland = geplandeDagen();
  const status = plEl("planning-status");
  if (gepland === 0) {
    status.textContent = `Nog niets gepland. Je weekritme is ${weekdoel} ${weekdoel === 1 ? "dag" : "dagen"}: tik op "✨ Stel mijn week voor" of plan zelf per dag.`;
    status.dataset.toestand = "leeg";
  } else if (gepland < weekdoel) {
    status.textContent = `Je plande ${gepland} van je ${weekdoel} beweegdagen. Nog ${weekdoel - gepland} te gaan!`;
    status.dataset.toestand = "bijna";
  } else {
    status.textContent = `✅ Top! ${gepland} beweegdagen gepland, je weekritme (${weekdoel}) is haalbaar.`;
    status.dataset.toestand = "klaar";
  }

  const vak = plEl("planning-dagen");
  vak.innerHTML = "";
  const vandaag = vandaagDag();
  WEEKDAGEN.forEach(dag => {
    const kaart = document.createElement("div");
    kaart.className = "plan-dag" + (dag === vandaag ? " vandaag" : "") + (schema[dag].length ? "" : " rust");

    const kop = document.createElement("div");
    kop.className = "plan-dag-kop";
    const naam = document.createElement("strong");
    naam.textContent = dagNamenVoluit[dag];
    if (dag === vandaag) {
      const label = document.createElement("span");
      label.className = "plan-vandaag-label";
      label.textContent = "Vandaag";
      naam.appendChild(label);
    }
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "plan-plus";
    plus.textContent = openDag === dag ? "Sluiten" : "+ Plan iets";
    plus.onclick = () => { openDag = openDag === dag ? null : dag; tekenPlanning(); };
    kop.append(naam, plus);
    kaart.appendChild(kop);

    if (!schema[dag].length && openDag !== dag) {
      const rust = document.createElement("p");
      rust.className = "plan-rust";
      rust.textContent = "Rustdag 😌";
      kaart.appendChild(rust);
    }

    schema[dag].forEach(item => {
      const rij = document.createElement("div");
      rij.className = "plan-item";
      const tekst = document.createElement("span");
      tekst.className = "plan-item-tekst";
      tekst.textContent = planTekst(item);
      rij.appendChild(tekst);
      if (item.notitie && item.sport !== "Anders") {
        const notitie = document.createElement("small");
        notitie.textContent = item.notitie;
        tekst.appendChild(notitie);
      }
      const wis = document.createElement("button");
      wis.type = "button";
      wis.className = "plan-wis";
      wis.setAttribute("aria-label", "Verwijderen");
      wis.textContent = "✕";
      wis.onclick = () => {
        bewaarSchema({ ...schema, [dag]: schema[dag].filter(x => x.id !== item.id) });
        vernieuwAlles();
      };
      rij.appendChild(wis);
      kaart.appendChild(rij);
    });

    if (openDag === dag) kaart.appendChild(maakPlanFormulier(dag));
    vak.appendChild(kaart);
  });
}

// Klein formulier om iets te plannen op een dag
function maakPlanFormulier(dag) {
  const form = document.createElement("form");
  form.className = "plan-formulier";
  form.innerHTML = `
    <select class="pf-sport" aria-label="Sport"></select>
    <div class="rij">
      <input type="number" class="pf-minuten" min="5" max="600" step="5" placeholder="minuten" aria-label="Duur in minuten">
      <input type="time" class="pf-tijd" aria-label="Tijdstip (optioneel)">
    </div>
    <input type="text" class="pf-notitie" maxlength="60" placeholder="Notitie, bv. met de hond of met vrienden (optioneel)">
    <button type="submit">Toevoegen</button>`;
  const keuze = form.querySelector(".pf-sport");
  planSporten.forEach(s => {
    const optie = document.createElement("option");
    optie.value = s.naam;
    optie.textContent = `${s.icoon} ${s.naam}`;
    keuze.appendChild(optie);
  });
  keuze.value = favorieteSport();
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const minuten = parseInt(form.querySelector(".pf-minuten").value);
    const item = {
      id: Date.now(),
      sport: keuze.value,
      minuten: minuten > 0 ? minuten : null,
      tijd: form.querySelector(".pf-tijd").value,
      notitie: form.querySelector(".pf-notitie").value.trim(),
    };
    const lijst = [...schema[dag], item].sort((a, b) => (a.tijd || "99").localeCompare(b.tijd || "99"));
    bewaarSchema({ ...schema, [dag]: lijst });
    openDag = null;
    vernieuwAlles();
    toonToast(`📅 Gepland op ${dagNamenVoluit[dag].toLowerCase()}!`);
  });
  setTimeout(() => form.querySelector(".pf-minuten").focus(), 0);
  return form;
}

// De sport die je het vaakst logt (anders: wandelen)
function favorieteSport() {
  const tellen = {};
  cardio.forEach(c => { tellen[c.type] = (tellen[c.type] || 0) + 1; });
  if (workouts.length) tellen.Krachttraining = workouts.length / 3; // ±3 oefeningen per training
  const top = Object.entries(tellen).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "Wandelen";
}

// "✨ Stel mijn week voor": vult lege dagen tot je weekritme, goed verspreid
const spreiding = {
  1: ["wo"], 2: ["di", "za"], 3: ["ma", "wo", "za"], 4: ["ma", "wo", "vr", "zo"],
  5: ["ma", "di", "do", "vr", "zo"], 6: ["ma", "di", "wo", "do", "vr", "za"], 7: WEEKDAGEN,
};
// Geeft de dagen terug die erbij gepland werden (leeg = er was al genoeg gepland)
function vulWeekVoor(sport = favorieteSport()) {
  let tekort = weekdoel - geplandeDagen();
  if (tekort <= 0) return [];
  const minuten = profiel.niveau === "gevorderd" ? 45 : profiel.niveau === "gemiddeld" ? 30 : 20;
  const nieuw = { ...schema };
  const erbij = [];
  // Eerst de goed verspreide dagen, daarna eventueel andere lege dagen
  const volgorde = [...spreiding[weekdoel], ...WEEKDAGEN];
  volgorde.forEach(dag => {
    if (tekort > 0 && !nieuw[dag].length) {
      nieuw[dag] = [{ id: Date.now() + WEEKDAGEN.indexOf(dag), sport, minuten, tijd: "", notitie: "" }];
      erbij.push(dag);
      tekort--;
    }
  });
  bewaarSchema(nieuw);
  vernieuwAlles();
  return erbij;
}

plEl("vul-week").addEventListener("click", () => {
  if (!vulWeekVoor().length) { toonToast("✅ Je week staat al vol genoeg. Goed bezig!"); return; }
  toonToast("✨ Voorstel klaar! Pas gerust aan wat je wil.");
});

// ===================== Vandaag-scherm =====================
function vernieuwPlanningVandaag() {
  // Je doel bovenaan de kaart
  const doelVak = plEl("vandaag-doel");
  doelVak.innerHTML = "";
  const optie = doelOpties.find(o => o.id === profiel.doel);
  if (optie || profiel.doelTekst) {
    const p = document.createElement("p");
    p.className = "vandaag-doel-tekst";
    p.textContent = `${optie ? optie.icoon : "🎯"} ${profiel.doelTekst || optie.naam}`;
    if (profiel.doelDatum) {
      const dagen = Math.ceil((new Date(profiel.doelDatum + "T12:00:00") - new Date(vandaagTekst() + "T12:00:00")) / 86400000);
      const nog = document.createElement("span");
      nog.className = "doel-aftellen";
      nog.textContent = dagen > 0 ? `nog ${dagen} ${dagen === 1 ? "dag" : "dagen"}` : dagen === 0 ? "vandaag!" : "datum voorbij";
      p.appendChild(nog);
    }
    doelVak.appendChild(p);
  } else {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "doel-instellen";
    knop.textContent = "🎯 Stel je doel in →";
    knop.onclick = () => toonTab("schema");
    doelVak.appendChild(knop);
  }

  // Wat staat er vandaag gepland?
  const vak = plEl("vandaag-schema");
  vak.innerHTML = "";
  const items = schema[vandaagDag()];
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "gedempt";
    p.textContent = "Niets gepland vandaag. Zin in iets spontaans? Elke beweging telt! 🙂";
    vak.appendChild(p);
    return;
  }
  const vandaag = vandaagTekst();
  items.forEach(item => {
    const zelfde = (naam) => String(naam).trim().toLowerCase() === item.sport.toLowerCase();
    const gedaan = (item.sport === "Krachttraining" && workouts.some(w => w.datum === vandaag))
      || cardio.some(c => c.datum === vandaag && zelfde(c.type))
      || workouts.some(w => w.datum === vandaag && zelfde(w.oefening));
    const rij = document.createElement("div");
    rij.className = "vandaag-plan" + (gedaan ? " gedaan" : "");
    const tekst = document.createElement("span");
    tekst.textContent = planTekst(item);
    rij.appendChild(tekst);
    if (gedaan) {
      const v = document.createElement("span");
      v.className = "vandaag-plan-gedaan";
      v.textContent = "✅ Gedaan!";
      rij.appendChild(v);
    } else {
      const knop = document.createElement("button");
      knop.type = "button";
      knop.className = "vandaag-plan-knop";
      knop.textContent = "Loggen";
      knop.onclick = () => logGeplandItem(item);
      rij.appendChild(knop);
    }
    vak.appendChild(rij);
  });
}

// Naar het beweegformulier, alvast ingevuld
function logGeplandItem(item) {
  toonTab("bewegen");
  kiesBeweging(item.sport);
  if (item.minuten) {
    document.getElementById("beweeg-minuten").value = item.minuten;
    document.getElementById("beweeg-minuten").dataset.auto = "";
  }
}

// Het hele Planning-scherm (wordt via vernieuwAlles aangeroepen)
function vernieuwPlanning() {
  tekenDoel();
  tekenPlanning();
}
