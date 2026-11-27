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
// Pro = 3 duidelijke beloftes (wat je eraan hebt), plus een paar bonussen.
// De id's zijn dezelfde als in de tabel pro_interesse.
const PRO_BELOFTES = [
  { id: "plannen", icoon: "🗺️", naam: "Een plan dat je ergens brengt",
    uitleg: "Plannen van 4 tot 8 weken, bv. van 0 naar 5 km, sterker in 6 weken of elke dag wandelen.",
    punten: ["Elke week precies weten wat je doet", "Past zich aan als je een dag mist", "Een feestje als je de finish haalt 🎉"] },
  { id: "redder", icoon: "🛟", naam: "Je weekritme is veilig",
    uitleg: "Drukke week, ziek of op vakantie? Je reeks blijft gewoon staan.",
    punten: ["Elke maand een weekritme-redder", "Plan een rustweek zonder je reeks te verliezen", "Nooit meer \"alles kwijt\" na één slechte week"] },
  { id: "groepjes", icoon: "👯", naam: "Samen sterker",
    uitleg: "Beweeg met je vrienden, familie of collega's als groepje.",
    punten: ["Samen één weekdoel halen", "Zie wie er deze week al bewoog", "Samen vieren als het lukt"] },
];
const PRO_BONUSSEN = [
  { id: "coach",         icoon: "🤖", naam: "Persoonlijke coach", uitleg: "Denkt mee als het even niet lukt (later)." },
  { id: "herinneringen", icoon: "🔔", naam: "Slimme herinneringen", uitleg: "Meerdere momenten, je eigen tekst." },
  { id: "rapport",       icoon: "📊", naam: "Maandrapport", uitleg: "Je beweegmaand in je mailbox." },
];
// Standaard toont de pagina het jaarabonnement (beste prijs per maand)
const pro = { gekozen: new Set(), periode: "jaar", opLijst: false };

function tekenProPrijs() {
  const jaar = pro.periode === "jaar";
  pEl("pro-bedrag").textContent = jaar ? "€29,99" : "€3,99";
  pEl("pro-per").textContent = jaar ? "/ jaar" : "/ maand";
  pEl("pro-onder").textContent = jaar
    ? "Slechts €2,50 per maand: minder dan één koffie. ☕"
    : "Maandelijks opzegbaar. Met een jaar betaal je maar €2,50 per maand.";
  document.querySelectorAll(".pro-wissel button").forEach(b => b.classList.toggle("actief", b.dataset.periode === pro.periode));
}

// Eén kaart (belofte of bonus) die je kan aantikken: "dit zou ik gebruiken"
function maakProKaart(f, groot) {
  const knop = document.createElement("button");
  knop.type = "button";
  const aan = pro.gekozen.has(f.id);
  knop.className = "pro-functie" + (groot ? " pro-belofte" : " pro-bonus") + (aan ? " gekozen" : "");
  knop.setAttribute("aria-pressed", aan);
  knop.innerHTML = `<span class="pro-functie-icoon"></span><span class="pro-functie-tekst"><strong></strong><small></small></span><span class="pro-vinkje" aria-hidden="true">${aan ? "✓" : ""}</span>`;
  knop.querySelector(".pro-functie-icoon").textContent = f.icoon;
  knop.querySelector("strong").textContent = f.naam;
  knop.querySelector("small").textContent = f.uitleg;
  if (groot && f.punten) {
    const lijst = document.createElement("ul");
    lijst.className = "pro-punten";
    f.punten.forEach(p => { const li = document.createElement("li"); li.textContent = p; lijst.appendChild(li); });
    knop.querySelector(".pro-functie-tekst").appendChild(lijst);
  }
  knop.onclick = () => {
    if (pro.gekozen.has(f.id)) pro.gekozen.delete(f.id); else pro.gekozen.add(f.id);
    tekenProFuncties();
  };
  return knop;
}

function tekenProFuncties() {
  const vak = pEl("pro-functies");
  vak.innerHTML = "";
  PRO_BELOFTES.forEach(f => vak.appendChild(maakProKaart(f, true)));
  const kop = document.createElement("p");
  kop.className = "pro-bonus-kop";
  kop.textContent = "En als bonus:";
  vak.appendChild(kop);
  const bonussen = document.createElement("div");
  bonussen.className = "pro-bonussen";
  PRO_BONUSSEN.forEach(f => bonussen.appendChild(maakProKaart(f, false)));
  vak.appendChild(bonussen);
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
