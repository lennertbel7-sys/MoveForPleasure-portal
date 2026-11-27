// ============================================================
// pro.js — MoveForPleasure Pro: interesse meten (nog zonder betalen)
//
// Leden zien wat Pro wordt, wat het zou kosten, en tikken aan welke
// extra's ze zouden gebruiken. Met "Ik wil Pro" komen ze op de lijst
// (tabel pro_interesse). De admin ziet op de adminpagina hoeveel
// interesse er is en welke extra's het populairst zijn.
// Pas als er genoeg interesse is, bouwen we betalingen (Mollie).
// Gebruikt: db, gebruiker (account.js), toonToast (app.js)
// ============================================================

const pEl = (id) => document.getElementById(id);
const PRO_FUNCTIES = [
  { id: "redder",        icoon: "🛟", naam: "Weekritme-redder",        uitleg: "Lukt het een week niet? Met een joker blijft je reeks gewoon staan." },
  { id: "plannen",       icoon: "🗺️", naam: "Beweegplannen",           uitleg: "Stap voor stap naar een doel, bv. van 0 naar 5 km of elke dag wandelen." },
  { id: "groepjes",      icoon: "👯", naam: "Groepjes",                uitleg: "Met vrienden, familie of collega's samen een weekdoel halen." },
  { id: "herinneringen", icoon: "🔔", naam: "Slimme herinneringen",    uitleg: "Meerdere momenten per dag en je eigen, persoonlijke tekst." },
  { id: "rapport",       icoon: "📊", naam: "Maandrapport",            uitleg: "Elke maand een mooi overzicht van je beweging in je mailbox." },
  { id: "coach",         icoon: "🤖", naam: "Persoonlijke coach",      uitleg: "Een slimme coach die je planning kent en je helpt als het even niet lukt." },
];
const pro = { gekozen: new Set(), periode: "maand", opLijst: false };

function tekenProPrijs() {
  const jaar = pro.periode === "jaar";
  pEl("pro-bedrag").textContent = jaar ? "€29,99" : "€3,99";
  pEl("pro-per").textContent = jaar ? "/ jaar" : "/ maand";
  pEl("pro-onder").textContent = jaar
    ? "Slechts €2,50 per maand. Verwachte prijs, incl. btw."
    : "Maandelijks opzegbaar. Verwachte prijs, incl. btw.";
  document.querySelectorAll(".pro-wissel button").forEach(b => b.classList.toggle("actief", b.dataset.periode === pro.periode));
}

function tekenProFuncties() {
  const vak = pEl("pro-functies");
  vak.innerHTML = "";
  PRO_FUNCTIES.forEach(f => {
    const knop = document.createElement("button");
    knop.type = "button";
    const aan = pro.gekozen.has(f.id);
    knop.className = "pro-functie" + (aan ? " gekozen" : "");
    knop.setAttribute("aria-pressed", aan);
    knop.innerHTML = `<span class="pro-functie-icoon"></span><span class="pro-functie-tekst"><strong></strong><small></small></span><span class="pro-vinkje" aria-hidden="true">${aan ? "✓" : ""}</span>`;
    knop.querySelector(".pro-functie-icoon").textContent = f.icoon;
    knop.querySelector("strong").textContent = f.naam;
    knop.querySelector("small").textContent = f.uitleg;
    knop.onclick = () => {
      if (pro.gekozen.has(f.id)) pro.gekozen.delete(f.id); else pro.gekozen.add(f.id);
      tekenProFuncties();
    };
    vak.appendChild(knop);
  });
}

function tekenProStatus() {
  pEl("pro-ja").textContent = pro.opLijst ? "💾 Mijn keuzes bijwerken" : "💎 Ik wil Pro, hou me op de hoogte";
  pEl("pro-intrekken").hidden = !pro.opLijst;
  pEl("pro-melding").hidden = !pro.opLijst;
  pEl("pro-melding").textContent = "✅ Je staat op de lijst! Je hoort als eerste wanneer Pro er is, met korting voor vroege leden.";
  const rij = pEl("pro-rij-status");
  if (rij) rij.textContent = pro.opLijst ? "Op de lijst ✓" : "Binnenkort";
}

async function laadProInteresse() {
  if (!db || !gebruiker) return;
  const { data } = await db.from("pro_interesse").select("functies, periode").maybeSingle();
  pro.opLijst = Boolean(data);
  if (data) {
    pro.gekozen = new Set(data.functies || []);
    if (data.periode === "jaar" || data.periode === "maand") pro.periode = data.periode;
  }
  tekenProStatus();
}

async function openPro() {
  pEl("pro-venster").hidden = false;
  document.body.classList.add("welkom-open");
  tekenProPrijs();
  tekenProFuncties();
  tekenProStatus();
  await laadProInteresse();
  tekenProPrijs();
  tekenProFuncties();
}

function sluitPro() {
  pEl("pro-venster").hidden = true;
  document.body.classList.remove("welkom-open");
}

async function bewaarProInteresse() {
  if (!db || !gebruiker) { toonToast("Even geen verbinding. Probeer het later opnieuw."); return; }
  const knop = pEl("pro-ja");
  knop.disabled = true;
  const rij = { functies: [...pro.gekozen], periode: pro.periode };
  const { error } = pro.opLijst
    ? await db.from("pro_interesse").update(rij).eq("user_id", gebruiker.id)
    : await db.from("pro_interesse").insert(rij);
  knop.disabled = false;
  if (error) { toonToast("Dat lukte niet. Probeer het opnieuw."); return; }
  const nieuw = !pro.opLijst;
  pro.opLijst = true;
  tekenProStatus();
  toonToast(nieuw ? "💎 Top! Je staat op de lijst voor Pro." : "💾 Je keuzes zijn bijgewerkt.");
}

async function trekProIn() {
  const { error } = await db.from("pro_interesse").delete().eq("user_id", gebruiker.id);
  if (error) { toonToast("Dat lukte niet. Probeer het opnieuw."); return; }
  pro.opLijst = false;
  pro.gekozen.clear();
  tekenProFuncties();
  tekenProStatus();
  toonToast("Je staat niet meer op de lijst.");
}

document.querySelectorAll(".pro-open").forEach(k => k.addEventListener("click", openPro));
pEl("pro-sluit").addEventListener("click", sluitPro);
pEl("pro-ja").addEventListener("click", bewaarProInteresse);
pEl("pro-intrekken").addEventListener("click", trekProIn);
document.querySelectorAll(".pro-wissel button").forEach(b => b.addEventListener("click", () => {
  pro.periode = b.dataset.periode;
  tekenProPrijs();
}));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pEl("pro-venster").hidden) sluitPro(); });
