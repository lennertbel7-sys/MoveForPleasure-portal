// ============================================================
// profiel.js: het profielscherm
//
//  - je gegevens (voornaam, doel, niveau, lengte, geboortejaar)
//  - statistieken over al je trainingen
//  - activiteitskalender van de laatste 12 weken
//  - lichaamsgewicht met grafiek
//  - persoonlijke records per oefening
//  - back-up downloaden
//
// Alles blijft op dit toestel (via de opslaglaag in data.js).
// ============================================================

const doelNamen = {
  volhouden: "Een sportgewoonte opbouwen",
  sterker: "Sterker worden",
  conditie: "Betere conditie",
  afvallen: "Gewicht verliezen",
  fit: "Fitter en energieker"
};
const niveauNamen = { beginner: "Beginner", gemiddeld: "Gemiddeld", gevorderd: "Gevorderd" };

const getal = (n, decimalen = 0) =>
  n.toLocaleString("nl-BE", { minimumFractionDigits: decimalen, maximumFractionDigits: decimalen });

// Profielknop rechtsboven
document.getElementById("profiel-knop").addEventListener("click", () => {
  toonTab("profiel");
  vulProfielFormulier();
});

function initiaal() {
  return profiel.naam ? profiel.naam.trim().charAt(0).toUpperCase() : "👤";
}

// ===== Alles op het profielscherm tekenen =====
function vernieuwProfiel() {
  document.getElementById("p-zondagmail").checked = profiel.zondagmail !== false;
  document.getElementById("profiel-knop").textContent = initiaal();
  document.getElementById("profiel-avatar").textContent = initiaal();
  document.getElementById("profiel-naam").textContent = profiel.naam || "Mijn profiel";

  const alleDatums = [...workouts, ...cardio].map(x => x.datum).sort();
  const delen = [];
  if (profiel.doel) delen.push("🎯 " + doelNamen[profiel.doel]);
  if (profiel.niveau) delen.push(niveauNamen[profiel.niveau]);
  if (alleDatums.length) delen.push("Actief sinds " + leesbareDatum(alleDatums[0]));
  document.getElementById("profiel-sub").textContent =
    delen.length ? delen.join(" · ") : "Vul hieronder je gegevens in om je profiel compleet te maken.";

  vernieuwStatistieken();
  vernieuwKalender();
  vernieuwGewicht();
  vernieuwRecords();
}

// ===== Statistieken =====
function vernieuwStatistieken() {
  const cardioMinuten = cardio.reduce((som, c) => som + (c.minuten || 0), 0);
  const km = cardio.reduce((som, c) => som + (c.km || 0), 0);
  const volume = workouts.reduce((som, w) => som + (w.gewicht || 0) * w.sets * w.reps, 0);

  // Favoriete oefening = degene die je het vaakst logde
  const telling = {};
  workouts.forEach(w => {
    const naam = w.oefening.trim().toLowerCase();
    telling[naam] = (telling[naam] || 0) + 1;
  });
  const favoriet = Object.entries(telling).sort((a, b) => b[1] - a[1])[0];

  const cijfers = [
    ["💪", getal(workouts.length + cardio.length), "keer bewogen"],
    ["📅", getal(actieveDagen().size), "actieve dagen"],
    ["🔥", getal(langsteStreak()), "langste reeks (dagen)"],
    ["⏱️", cardioMinuten >= 120 ? getal(cardioMinuten / 60, 1) + " u" : getal(cardioMinuten) + " min", "cardio"],
    ["📍", getal(km, 1) + " km", "afgelegd"],
    ["🏋️", volume >= 1000 ? getal(volume / 1000, 1) + " ton" : getal(volume) + " kg", "totaal getild"]
  ];

  const vak = document.getElementById("statistieken");
  vak.innerHTML = "";
  cijfers.forEach(([icoon, waarde, label]) => {
    const div = document.createElement("div");
    div.className = "statistiek";
    div.innerHTML = `<span class="stat-icoon">${icoon}</span><strong></strong><small></small>`;
    div.querySelector("strong").textContent = waarde;
    div.querySelector("small").textContent = label;
    vak.appendChild(div);
  });

  if (favoriet) {
    const div = document.createElement("p");
    div.className = "favoriet gedempt";
    const naam = workouts.find(w => w.oefening.trim().toLowerCase() === favoriet[0]).oefening;
    div.textContent = `⭐ Favoriete oefening: ${naam} (${favoriet[1]}×)`;
    vak.appendChild(div);
  }
}

// ===== Activiteitskalender (12 weken × 7 dagen) =====
function vernieuwKalender() {
  const perDag = {};
  [...workouts, ...cardio].forEach(x => { perDag[x.datum] = (perDag[x.datum] || 0) + 1; });

  const start = new Date(maandagVan(vandaagTekst()) + "T12:00:00");
  start.setDate(start.getDate() - 7 * 11); // 11 weken terug + deze week = 12
  const vandaag = vandaagTekst();

  const kalender = document.getElementById("kalender");
  kalender.innerHTML = "";
  let actiefTelling = 0;

  for (let week = 0; week < 12; week++) {
    const kolom = document.createElement("div");
    kolom.className = "kalender-week";
    for (let dag = 0; dag < 7; dag++) {
      const d = new Date(start);
      d.setDate(start.getDate() + week * 7 + dag);
      const tekst = datumNaarTekst(d);
      const aantal = perDag[tekst] || 0;
      const vakje = document.createElement("i");
      if (tekst > vandaag) {
        vakje.className = "toekomst";
      } else {
        vakje.className = "k" + Math.min(aantal, 3);
        if (aantal) actiefTelling++;
      }
      if (tekst === vandaag) vakje.classList.add("vandaag");
      vakje.title = `${leesbareDatum(tekst)}: ${aantal} ${aantal === 1 ? "beweegmoment" : "beweegmomenten"}`;
      kolom.appendChild(vakje);
    }
    kalender.appendChild(kolom);
  }
  document.getElementById("kalender-telling").textContent = `${actiefTelling} actieve dagen`;
}

// ===== Lichaamsgewicht =====
function vernieuwGewicht() {
  // Gewicht is optioneel: de kaart is alleen zichtbaar als je het aanzet
  // én er toestemming is (gezondheidsgegeven)
  const zichtbaar = Boolean(profiel.gewichtVolgen && profiel.gewichtToestemming);
  document.getElementById("gewicht-kaart").hidden = !zichtbaar;
  if (!zichtbaar) return;

  const grafiek = document.getElementById("gewicht-grafiek");
  const verschil = document.getElementById("gewicht-verschil");
  const lijst = document.getElementById("gewicht-lijst");

  if (gewichten.length === 0) {
    grafiek.innerHTML = `<p class="gedempt leeg-klein">Weeg je regelmatig (bv. 1× per week, 's ochtends) en zie hier je verloop.</p>`;
    verschil.textContent = "";
  } else if (gewichten.length === 1) {
    grafiek.innerHTML = `<p class="gedempt leeg-klein">Eerste meting: <strong>${getal(gewichten[0].kg, 1)} kg</strong>. Na je volgende meting verschijnt hier een grafiek.</p>`;
    verschil.textContent = "";
  } else {
    grafiek.innerHTML = tekenGrafiek(gewichten.slice(-20)); // laatste 20 metingen
    const delta = gewichten[gewichten.length - 1].kg - gewichten[0].kg;
    verschil.textContent = `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${getal(Math.abs(delta), 1)} kg sinds start`;
  }

  lijst.innerHTML = "";
  [...gewichten].reverse().slice(0, 5).forEach(g => {
    const li = document.createElement("li");
    const tekst = document.createElement("span");
    tekst.textContent = `${getal(g.kg, 1)} kg`;
    const datum = document.createElement("span");
    datum.className = "datum";
    datum.textContent = leesbareDatum(g.datum);
    const wis = document.createElement("button");
    wis.className = "wissen";
    wis.textContent = "✕";
    wis.setAttribute("aria-label", "Meting verwijderen");
    wis.onclick = () => { verwijderGewicht(g.id); vernieuwAlles(); };
    li.append(tekst, datum, wis);
    lijst.appendChild(li);
  });
}

// Tekent een lijngrafiek als SVG (een tekening in code)
function tekenGrafiek(metingen) {
  const breedte = 320, hoogte = 130, marge = 22, links = 40; // links: ruimte voor de kg-labels
  const waarden = metingen.map(m => m.kg);
  let min = Math.min(...waarden), max = Math.max(...waarden);
  if (max - min < 2) { min -= 1; max += 1; } // vlakke lijn mooi in het midden

  const x = i => links + (i * (breedte - links - marge)) / (metingen.length - 1);
  const y = kg => hoogte - marge - ((kg - min) / (max - min)) * (hoogte - 2 * marge);
  const punten = metingen.map((m, i) => `${x(i).toFixed(1)},${y(m.kg).toFixed(1)}`).join(" ");
  const vlak = `${x(0)},${hoogte - marge} ${punten} ${x(metingen.length - 1)},${hoogte - marge}`;

  return `
    <svg viewBox="0 0 ${breedte} ${hoogte}" role="img" aria-label="Grafiek van je lichaamsgewicht">
      <defs>
        <linearGradient id="vlak-verloop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff7a3d" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#ff7a3d" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <text x="2" y="${y(max) + 4}" class="as">${getal(max, 1)}</text>
      <text x="2" y="${y(min) + 4}" class="as">${getal(min, 1)}</text>
      <polygon points="${vlak}" fill="url(#vlak-verloop)"/>
      <polyline points="${punten}" fill="none" stroke="#ff7a3d" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${metingen.map((m, i) => `<circle cx="${x(i)}" cy="${y(m.kg)}" r="3.5" fill="#23152f" stroke="#ff4f8b" stroke-width="2"><title>${leesbareDatum(m.datum)}: ${getal(m.kg, 1)} kg</title></circle>`).join("")}
      <text x="${x(0)}" y="${hoogte - 6}" class="as" text-anchor="start">${leesbareDatum(metingen[0].datum)}</text>
      <text x="${x(metingen.length - 1)}" y="${hoogte - 6}" class="as" text-anchor="end">${leesbareDatum(metingen[metingen.length - 1].datum)}</text>
    </svg>`;
}

document.getElementById("gewicht-formulier").addEventListener("submit", (e) => {
  e.preventDefault();
  const kg = parseFloat(document.getElementById("gewicht-kg").value);
  if (!(kg >= 20 && kg <= 400)) return;
  logGewicht(Math.round(kg * 10) / 10);
  e.target.reset();
  vernieuwAlles();
  toonToast("Gewicht opgeslagen ✓");
});

// ===== Persoonlijke records =====
function vernieuwRecords() {
  const beste = {};
  workouts.forEach(w => {
    if (!w.gewicht) return;
    const naam = w.oefening.trim().toLowerCase();
    if (!beste[naam] || w.gewicht > beste[naam].gewicht) beste[naam] = w;
  });

  const lijst = document.getElementById("records-lijst");
  lijst.innerHTML = "";
  const records = Object.values(beste).sort((a, b) => b.gewicht - a.gewicht);
  if (records.length === 0) {
    lijst.innerHTML = `<li><span class="gedempt">Log een workout met gewicht en je records verschijnen hier.</span></li>`;
    return;
  }
  records.forEach(w => {
    const li = document.createElement("li");
    const naam = document.createElement("span");
    naam.textContent = w.oefening;
    const waarde = document.createElement("strong");
    waarde.className = "record-waarde";
    waarde.textContent = `${getal(w.gewicht, w.gewicht % 1 ? 1 : 0)} kg`;
    const datum = document.createElement("span");
    datum.className = "datum";
    datum.textContent = leesbareDatum(w.datum);
    li.append(naam, waarde, datum);
    lijst.appendChild(li);
  });
}

// ===== Gegevensformulier =====
// Alleen invullen bij het openen van het scherm, zodat we niet
// overschrijven wat je aan het typen bent.
function vulProfielFormulier() {
  document.getElementById("p-naam").value = profiel.naam || "";
  document.getElementById("p-doel").value = profiel.doel || "";
  document.getElementById("p-niveau").value = profiel.niveau || "";
  document.getElementById("p-lengte").value = profiel.lengte || "";
  document.getElementById("p-geboortejaar").value = profiel.geboortejaar || "";
  document.getElementById("p-gewicht").checked = Boolean(profiel.gewichtVolgen && profiel.gewichtToestemming);
}

// ===== Schakelaar "Zondagmail" =====
// Standaard aan; uitzetten wordt meteen bewaard (en online gezet).
const zondagmailSchakelaar = document.getElementById("p-zondagmail");
zondagmailSchakelaar.addEventListener("change", () => {
  bewaarProfiel({ ...profiel, zondagmail: zondagmailSchakelaar.checked });
  toonToast(zondagmailSchakelaar.checked ? "📬 Je krijgt elke zondag je beweegweek" : "Zondagmail staat uit");
});

// ===== Schakelaar "Gewicht bijhouden" =====
// Lichaamsgewicht is een gezondheidsgegeven (AVG artikel 9). Daarom:
//  - aanzetten kan alleen met uitdrukkelijke toestemming (vinkje),
//    die we met datum bewaren in profiel.gewichtToestemming;
//  - we zetten dit NOOIT vanzelf aan;
//  - bij uitzetten kies je: toestemming intrekken + alles wissen,
//    of alleen verbergen (toestemming blijft, metingen blijven).
const gewichtSchakelaar = document.getElementById("p-gewicht");
const toestemmingVenster = document.getElementById("toestemming");

function toonToestemming(stap) {
  document.getElementById("toestemming-aan").hidden = stap !== "aan";
  document.getElementById("toestemming-uit").hidden = stap !== "uit";
  document.getElementById("toestemming-vink").checked = false;
  document.getElementById("toestemming-akkoord").disabled = true;
  toestemmingVenster.hidden = false;
}
function sluitToestemming() {
  // Bestaande gebruiker die "liever niet" zegt maar al metingen heeft: vraag wat ermee moet
  if (!document.getElementById("toestemming-aan").hidden && !profiel.gewichtToestemming && gewichten.length) {
    toonToestemming("uit");
    return;
  }
  toestemmingVenster.hidden = true;
  if (profiel.gewichtVolgen && !profiel.gewichtToestemming) {
    bewaarProfiel({ ...profiel, gewichtVolgen: false });
    vernieuwAlles();
  }
  gewichtSchakelaar.checked = Boolean(profiel.gewichtVolgen && profiel.gewichtToestemming); // echte stand
}

// Wie gewicht al aan had staan van vóór deze toestemmingsvraag, krijgt
// de vraag de eerste keer dat hij zijn profiel opent.
let toestemmingGevraagd = false;
document.getElementById("profiel-knop").addEventListener("click", () => {
  if (!toestemmingGevraagd && profiel.gewichtVolgen && !profiel.gewichtToestemming) {
    toestemmingGevraagd = true;
    toonToestemming("aan");
  }
});

function zetGewichtAan() {
  bewaarProfiel({ ...profiel, gewichtVolgen: true });
  vernieuwAlles();
  toonToast("⚖️ Gewicht bijhouden staat aan");
  document.getElementById("gewicht-kaart").scrollIntoView({ behavior: "smooth", block: "center" });
}

gewichtSchakelaar.addEventListener("change", () => {
  if (gewichtSchakelaar.checked) {
    // Al eerder toestemming gegeven (en niet ingetrokken)? Dan meteen aan.
    if (profiel.gewichtToestemming) zetGewichtAan();
    else toonToestemming("aan");
  } else {
    if (gewichten.length || profiel.gewichtToestemming) toonToestemming("uit");
    else {
      bewaarProfiel({ ...profiel, gewichtVolgen: false });
      vernieuwAlles();
      toonToast("Gewicht bijhouden staat uit");
    }
  }
});

document.getElementById("toestemming-vink").addEventListener("change", (e) => {
  document.getElementById("toestemming-akkoord").disabled = !e.target.checked;
});
document.getElementById("toestemming-akkoord").addEventListener("click", () => {
  bewaarProfiel({ ...profiel, gewichtToestemming: new Date().toISOString() });
  toestemmingVenster.hidden = true;
  zetGewichtAan();
});
document.getElementById("toestemming-intrekken").addEventListener("click", () => {
  wisAlleGewichten();
  bewaarProfiel({ ...profiel, gewichtVolgen: false, gewichtToestemming: null });
  toestemmingVenster.hidden = true;
  vernieuwAlles();
  toonToast("Toestemming ingetrokken. Je metingen zijn gewist.");
});
document.getElementById("toestemming-pauze").addEventListener("click", () => {
  bewaarProfiel({ ...profiel, gewichtVolgen: false });
  toestemmingVenster.hidden = true;
  vernieuwAlles();
  toonToast("Verborgen. Je metingen blijven bewaard.");
});
toestemmingVenster.querySelectorAll("[data-sluit]").forEach(k => k.addEventListener("click", sluitToestemming));

// Kies je "Gewicht verliezen" als doel, dan zetten we NIETS vanzelf aan:
// we wijzen alleen op de mogelijkheid.
document.getElementById("p-doel").addEventListener("change", (e) => {
  if (e.target.value === "afvallen" && !profiel.gewichtVolgen) {
    toonToast("Tip: wil je je gewicht volgen? Zet 'Gewicht bijhouden' hieronder aan.");
  }
});

document.getElementById("profiel-formulier").addEventListener("submit", (e) => {
  e.preventDefault();
  const lengte = parseInt(document.getElementById("p-lengte").value);
  const jaar = parseInt(document.getElementById("p-geboortejaar").value);
  bewaarProfiel({
    ...profiel, // behoud o.a. je persoonlijke doel en doeldatum (Planning-tab)
    naam: document.getElementById("p-naam").value.trim(),
    doel: document.getElementById("p-doel").value,
    niveau: document.getElementById("p-niveau").value,
    lengte: lengte >= 100 && lengte <= 250 ? lengte : null,
    geboortejaar: jaar >= 1920 && jaar <= 2020 ? jaar : null
    // gewichtVolgen niet hier: dat loopt via de toestemming (schakelaar hierboven)
  });
  vernieuwAlles();
  toonToast(profiel.naam ? `Opgeslagen, ${profiel.naam}! ✓` : "Gegevens opgeslagen ✓");
});

// ===== Back-up downloaden =====
document.getElementById("exporteer-knop").addEventListener("click", () => {
  const backup = {
    app: "MoveForPleasure",
    gemaakt_op: new Date().toISOString(),
    profiel, weekdoel, schema, workouts, cardio, gewichten
  };
  const bestand = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(bestand);
  link.download = `moveforpleasure-backup-${vandaagTekst()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
