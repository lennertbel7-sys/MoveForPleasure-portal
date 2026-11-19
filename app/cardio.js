// ============================================================
// cardio.js: sporten en (optionele) rondes
//
// Per sport weten we welk icoon erbij hoort, of afstand (km)
// zinvol is, en hoe we het "aantal" per ronde noemen
// (sprongen, treden, reps…).
//
// Rondes zijn optioneel. Een ronde = tijd (min:sec) + aantal.
// Voorbeeld touwspringen: 5 rondes van 1:00 met 120 sprongen.
// ============================================================

const sportInfo = {
  Hardlopen:    { icoon: "🏃", km: true,  aantal: "meter" },
  Fietsen:      { icoon: "🚴", km: true,  aantal: "aantal" },
  Wandelen:     { icoon: "🚶", km: true,  aantal: "aantal" },
  Zwemmen:      { icoon: "🏊", km: true,  aantal: "banen" },
  Traplopen:    { icoon: "🪜", km: false, aantal: "treden" },
  Touwspringen: { icoon: "🪢", km: false, aantal: "sprongen" },
  HYROX:        { icoon: "⚡", km: true,  aantal: "reps" },
  Padel:        { icoon: "🎾", km: false, aantal: "games" },
  CrossFit:     { icoon: "💥", km: false, aantal: "reps" },
  Anders:       { icoon: "🏅", km: true,  aantal: "aantal" }
};

function infoVoor(type) {
  return sportInfo[type] || { icoon: "🏃", km: true, aantal: "aantal" };
}

// "1:05" uit 65 seconden
function tijdTekst(seconden) {
  const m = Math.floor(seconden / 60);
  const s = seconden % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Eén regel tekst voor een cardio-item (gebruikt in de lijsten)
function cardioTekst(c) {
  const info = infoVoor(c.type);
  let tekst = `${info.icoon} ${c.type} — ${c.minuten} min`;
  if (c.km) tekst += `, ${c.km} km`;
  if (c.rondes && c.rondes.length) {
    const totaalAantal = c.rondes.reduce((som, r) => som + (r.aantal || 0), 0);
    tekst += ` · ${c.rondes.length} ${c.rondes.length === 1 ? "ronde" : "rondes"}`;
    if (totaalAantal) tekst += ` · ${totaalAantal.toLocaleString("nl-BE")} ${info.aantal}`;
  }
  return tekst;
}

// ===== Formulier: sport kiezen =====
const typeKeuze = document.getElementById("cardio-type");
const kmVeld = document.getElementById("cardio-km");
const minutenVeld = document.getElementById("cardio-minuten");
const rondesKnop = document.getElementById("rondes-knop");
const rondesBlok = document.getElementById("rondes-blok");
const rondesLijst = document.getElementById("rondes-lijst");

// Past het formulier aan de gekozen sport aan
function pasTypeAan() {
  const info = infoVoor(typeKeuze.value);
  kmVeld.hidden = !info.km;
  if (!info.km) kmVeld.value = "";
  document.getElementById("aantal-kop").textContent = info.aantal.charAt(0).toUpperCase() + info.aantal.slice(1);
  rondesLijst.querySelectorAll(".r-aantal").forEach(veld => { veld.placeholder = info.aantal; });
  vernieuwRondesTotaal();
}
typeKeuze.addEventListener("change", pasTypeAan);

// ===== Rondes =====
function maakRonde(vorige) {
  const rij = document.createElement("div");
  rij.className = "ronde";
  rij.innerHTML = `
    <span class="ronde-nr"></span>
    <div class="tijd">
      <input type="number" class="r-min" inputmode="numeric" min="0" max="180" placeholder="0" aria-label="Minuten">
      <span>:</span>
      <input type="number" class="r-sec" inputmode="numeric" min="0" max="59" placeholder="00" aria-label="Seconden">
    </div>
    <input type="number" class="r-aantal" inputmode="numeric" min="0" max="100000" aria-label="Aantal">
    <button type="button" class="ronde-wis" aria-label="Ronde verwijderen">✕</button>`;
  rij.querySelector(".r-aantal").placeholder = infoVoor(typeKeuze.value).aantal;

  // Nieuwe ronde neemt de waarden van de vorige over: sneller invullen
  if (vorige) {
    ["r-min", "r-sec", "r-aantal"].forEach(k => { rij.querySelector("." + k).value = vorige.querySelector("." + k).value; });
  }

  rij.querySelector(".ronde-wis").addEventListener("click", () => {
    rij.remove();
    if (!rondesLijst.children.length) sluitRondes();
    else nummerRondes();
  });
  rij.querySelectorAll("input").forEach(veld => veld.addEventListener("input", vernieuwRondesTotaal));

  rondesLijst.appendChild(rij);
  nummerRondes();
  return rij;
}

function nummerRondes() {
  [...rondesLijst.children].forEach((rij, i) => { rij.querySelector(".ronde-nr").textContent = i + 1; });
  vernieuwRondesTotaal();
}

function openRondes() {
  rondesKnop.hidden = true;
  rondesBlok.hidden = false;
  maakRonde().querySelector(".r-min").focus();
}

function sluitRondes() {
  rondesLijst.innerHTML = "";
  rondesBlok.hidden = true;
  rondesKnop.hidden = false;
  vernieuwRondesTotaal();
}

rondesKnop.addEventListener("click", openRondes);
document.getElementById("rondes-weg").addEventListener("click", sluitRondes);
document.getElementById("ronde-erbij").addEventListener("click", () => {
  const nieuw = maakRonde(rondesLijst.lastElementChild);
  nieuw.querySelector(".r-aantal").focus();
});

// Leest de ingevulde rondes uit (lege rondes tellen niet mee)
function verzamelRondes() {
  return [...rondesLijst.children].map(rij => {
    const min = parseInt(rij.querySelector(".r-min").value) || 0;
    const sec = Math.min(59, parseInt(rij.querySelector(".r-sec").value) || 0);
    return { seconden: min * 60 + sec, aantal: parseInt(rij.querySelector(".r-aantal").value) || 0 };
  }).filter(r => r.seconden > 0 || r.aantal > 0);
}

function vernieuwRondesTotaal() {
  const rondes = verzamelRondes();
  const totaalTekst = document.getElementById("rondes-totaal");
  if (!rondes.length) {
    totaalTekst.textContent = "";
    minutenVeld.placeholder = "minuten";
    return;
  }
  const seconden = rondes.reduce((som, r) => som + r.seconden, 0);
  const aantal = rondes.reduce((som, r) => som + r.aantal, 0);
  const delen = [`${rondes.length} ${rondes.length === 1 ? "ronde" : "rondes"}`];
  if (seconden) delen.push(tijdTekst(seconden));
  if (aantal) delen.push(`${aantal.toLocaleString("nl-BE")} ${infoVoor(typeKeuze.value).aantal}`);
  totaalTekst.textContent = "Totaal: " + delen.join(" · ");
  // Minuten leeg gelaten? Dan rekenen we ze uit de rondes
  minutenVeld.placeholder = seconden ? `minuten (auto: ${Math.max(1, Math.round(seconden / 60))})` : "minuten";
}

pasTypeAan();
