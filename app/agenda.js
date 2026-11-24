// ============================================================
// agenda.js — maandkalender om te kiezen OP WELKE DAG je logt
//
// Bovenaan de tabs Workout en Bewegen staat dezelfde kalender.
// Tik op een dag (vandaag of in het verleden) en alles wat je
// daarna logt, komt op die dag terecht. Onder het formulier zie
// je wat er op die dag al gelogd is.
//
// Een stipje op een dag betekent:
//   oranje = kracht (workout), roze = cardio/beweging.
// Dagen in de toekomst kun je niet kiezen: je logt wat je echt deed.
// ============================================================

const maandNamen = ["januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december"];

// De gekozen dag ("2026-11-24") en de maand die je bekijkt.
// Ze zijn gedeeld: kies je een dag bij Workout, dan staat die ook bij Bewegen klaar.
let gekozenDatum = vandaagTekst();
let agendaMaand = new Date(); // alleen jaar + maand worden gebruikt
agendaMaand.setDate(1);

function kiesDatum(datumTekst) {
  if (datumTekst > vandaagTekst()) return; // geen toekomst
  gekozenDatum = datumTekst;
  const d = new Date(datumTekst + "T12:00:00");
  agendaMaand = new Date(d.getFullYear(), d.getMonth(), 1);
  vernieuwAlles();
}

function verschuifMaand(stap) {
  agendaMaand = new Date(agendaMaand.getFullYear(), agendaMaand.getMonth() + stap, 1);
  vernieuwAgendas();
}

// "Vandaag" of "Maandag 17 november"
function datumKop(datumTekst) {
  if (datumTekst === vandaagTekst()) return "Vandaag";
  const gisteren = new Date();
  gisteren.setDate(gisteren.getDate() - 1);
  if (datumTekst === datumNaarTekst(gisteren)) return "Gisteren";
  const d = new Date(datumTekst + "T12:00:00");
  return `${dagNamenVoluit[dagSleutels[d.getDay()]]} ${d.getDate()} ${maandNamen[d.getMonth()]}`;
}

// Tekent de kalender in elke .agenda op de pagina
function vernieuwAgendas() {
  document.querySelectorAll(".agenda").forEach(tekenAgenda);
  document.querySelectorAll(".log-datum").forEach(el => {
    el.textContent = gekozenDatum === vandaagTekst()
      ? "Je logt voor vandaag"
      : `Je logt voor ${datumKop(gekozenDatum).toLowerCase()}`;
    el.classList.toggle("verleden", gekozenDatum !== vandaagTekst());
  });
}

function tekenAgenda(vak) {
  const jaar = agendaMaand.getFullYear();
  const maand = agendaMaand.getMonth();
  const vandaag = vandaagTekst();
  const nu = new Date();
  const ditIsDezeMaand = jaar === nu.getFullYear() && maand === nu.getMonth();

  // Welke dagen hebben kracht en/of cardio?
  const kracht = new Set(workouts.map(w => w.datum));
  const beweging = new Set(cardio.map(c => c.datum));

  vak.innerHTML = `
    <div class="agenda-kop">
      <button type="button" class="agenda-pijl" data-stap="-1" aria-label="Vorige maand">‹</button>
      <strong>${maandNamen[maand]} ${jaar}</strong>
      <button type="button" class="agenda-pijl" data-stap="1" aria-label="Volgende maand" ${ditIsDezeMaand ? "disabled" : ""}>›</button>
    </div>
    <div class="agenda-raster">
      ${["ma", "di", "wo", "do", "vr", "za", "zo"].map(d => `<span class="agenda-dagnaam">${d}</span>`).join("")}
    </div>`;

  const raster = vak.querySelector(".agenda-raster");
  // Lege vakjes vóór de 1e (de week begint op maandag)
  const eersteDag = (new Date(jaar, maand, 1).getDay() + 6) % 7;
  for (let i = 0; i < eersteDag; i++) raster.appendChild(document.createElement("span"));

  const aantalDagen = new Date(jaar, maand + 1, 0).getDate();
  for (let dag = 1; dag <= aantalDagen; dag++) {
    const tekst = datumNaarTekst(new Date(jaar, maand, dag));
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "agenda-dag";
    if (tekst === vandaag) knop.classList.add("vandaag");
    if (tekst === gekozenDatum) knop.classList.add("gekozen");
    if (tekst > vandaag) knop.disabled = true;

    const stipjes = (kracht.has(tekst) ? `<i class="stip kracht"></i>` : "") +
                    (beweging.has(tekst) ? `<i class="stip beweging"></i>` : "");
    knop.innerHTML = `<span>${dag}</span><span class="stipjes">${stipjes}</span>`;
    knop.setAttribute("aria-label", datumKop(tekst) + (stipjes ? ", bewogen" : ""));
    knop.addEventListener("click", () => kiesDatum(tekst));
    raster.appendChild(knop);
  }

  vak.querySelectorAll(".agenda-pijl").forEach(p =>
    p.addEventListener("click", () => verschuifMaand(parseInt(p.dataset.stap))));

  // Snel terug naar vandaag
  if (gekozenDatum !== vandaag || !ditIsDezeMaand) {
    const terug = document.createElement("button");
    terug.type = "button";
    terug.className = "agenda-vandaag";
    terug.textContent = "↩ Terug naar vandaag";
    terug.addEventListener("click", () => kiesDatum(vandaag));
    vak.appendChild(terug);
  }
}
