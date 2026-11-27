// ============================================================
// maatjes.js — samen bewegen met een beweegmaatje
//
// Uitnodigen: je krijgt een link (…/app/#maatje=CODE) die je deelt,
// bv. via WhatsApp. Wie die opent (en inlogt of een account maakt),
// krijgt de vraag om maatjes te worden.
//
// Wat je van een maatje ziet: voornaam, op welke dagen hij/zij deze week
// bewoog en het weekritme (bv. 2/3). Meer niet. Je kan elkaar aanmoedigen
// met 👏 💪 🔥 🧡 (max. 3 per dag per maatje) en altijd stoppen.
//
// Alles loopt via databasefuncties met eigen controles (zie migratie
// "beweegmaatjes"); de tabellen zelf zijn dicht voor gebruikers.
// Gebruikt: db, gebruiker (account.js), toonToast (app.js)
// ============================================================

const mEl = (id) => document.getElementById(id);
const UITNODIGING_SLEUTEL = "mfp-uitnodiging"; // code bewaren tot je ingelogd bent
const EMOJIS = ["👏", "💪", "🔥", "🧡"];
let maatjes = [];

// ----- Een uitnodigingslink geopend? Code onthouden (ook als je eerst
//       nog een account moet maken of je e-mail moet bevestigen) -----
(function vangUitnodiging() {
  const m = location.hash.match(/maatje=([0-9a-f]{16})/i);
  if (!m) return;
  localStorage.setItem(UITNODIGING_SLEUTEL, m[1].toLowerCase());
  history.replaceState(null, "", location.pathname);
})();

// ----- Maatjes ophalen en tonen -----
async function laadMaatjes() {
  if (!db || !gebruiker) return;
  const { data, error } = await db.rpc("mijn_maatjes");
  if (error) { console.warn("Maatjes laden mislukt", error.message); return; }
  maatjes = data || [];
  tekenMaatjes();
  laadAanmoedigingen();
}

function tekenMaatjes() {
  const lijst = mEl("maatjes-lijst");
  lijst.innerHTML = "";
  if (!maatjes.length) {
    const leeg = document.createElement("div");
    leeg.className = "maatjes-leeg";
    leeg.innerHTML = `<p>Bewegen is leuker samen. Nodig een vriend, collega of familielid uit: jullie zien op welke dagen de ander bewoog en kunnen elkaar aanmoedigen.</p>`;
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "snel-knop maatje-uitnodig-groot";
    knop.textContent = "👯 Nodig een beweegmaatje uit";
    knop.onclick = nodigUit;
    leeg.appendChild(knop);
    lijst.appendChild(leeg);
    mEl("maatje-uitnodigen").hidden = true;
    return;
  }
  mEl("maatje-uitnodigen").hidden = false;

  const maandag = maandagVan(vandaagTekst());
  const weekDagen = WEEKDAGEN.map((_, i) => {
    const d = new Date(maandag + "T12:00:00");
    d.setDate(d.getDate() + i);
    return datumNaarTekst(d);
  });

  maatjes.forEach(m => {
    const rij = document.createElement("div");
    rij.className = "maatje";

    const avatar = document.createElement("span");
    avatar.className = "maatje-avatar";
    avatar.textContent = m.naam.charAt(0).toUpperCase();

    const midden = document.createElement("div");
    midden.className = "maatje-midden";
    const kop = document.createElement("div");
    kop.className = "maatje-kop";
    const naam = document.createElement("strong");
    naam.textContent = m.naam;
    const stand = document.createElement("span");
    const aantal = (m.dagen || []).length;
    stand.className = "maatje-stand" + (aantal >= m.weekdoel ? " gehaald" : "");
    stand.textContent = aantal >= m.weekdoel ? `🎉 ${aantal}/${m.weekdoel}` : `${aantal}/${m.weekdoel}`;
    kop.append(naam, stand);

    const bollen = document.createElement("div");
    bollen.className = "maatje-bollen";
    bollen.setAttribute("aria-label", `${m.naam} bewoog deze week ${aantal} ${aantal === 1 ? "dag" : "dagen"}`);
    weekDagen.forEach((dag, i) => {
      const b = document.createElement("i");
      if ((m.dagen || []).includes(dag)) b.className = "aan";
      if (dag === vandaagTekst()) b.classList.add("vandaag");
      b.title = WEEKDAGEN[i];
      bollen.appendChild(b);
    });
    midden.append(kop, bollen);

    const acties = document.createElement("div");
    acties.className = "maatje-acties";
    const genoeg = m.aangemoedigd_vandaag >= 3;
    EMOJIS.forEach(e => {
      const k = document.createElement("button");
      k.type = "button";
      k.className = "maatje-emoji";
      k.textContent = e;
      k.disabled = genoeg;
      k.setAttribute("aria-label", `Stuur ${e} naar ${m.naam}`);
      k.onclick = () => moedigAan(m, e, k);
      acties.appendChild(k);
    });
    const stop = document.createElement("button");
    stop.type = "button";
    stop.className = "maatje-stop";
    stop.textContent = "⋯";
    stop.setAttribute("aria-label", `Stoppen met ${m.naam} als maatje`);
    stop.onclick = () => stopMaatje(m);
    acties.appendChild(stop);

    rij.append(avatar, midden, acties);
    lijst.appendChild(rij);
  });
}

async function moedigAan(m, emoji, knop) {
  knop.disabled = true;
  const { error } = await db.rpc("stuur_aanmoediging", { naar: m.maatje, emoji });
  if (error) {
    toonToast(error.message.includes("genoeg") ? `Je moedigde ${m.naam} vandaag al genoeg aan 🙂` : "Versturen lukte niet. Heb je internet?");
  } else {
    m.aangemoedigd_vandaag++;
    toonToast(`${emoji} verstuurd naar ${m.naam}!`);
  }
  tekenMaatjes();
}

async function stopMaatje(m) {
  if (!confirm(`Stoppen met ${m.naam} als beweegmaatje? Jullie zien dan niets meer van elkaar.`)) return;
  const { error } = await db.rpc("maatje_verwijderen", { maatje: m.maatje });
  if (error) { toonToast("Dat lukte niet. Probeer het opnieuw."); return; }
  toonToast(`${m.naam} is geen maatje meer.`);
  laadMaatjes();
}

// ----- Ontvangen aanmoedigingen -----
async function laadAanmoedigingen() {
  const vak = mEl("aanmoedigingen");
  const { data, error } = await db.rpc("mijn_aanmoedigingen");
  if (error || !data || !data.length) { vak.hidden = true; return; }
  // Per maatje samenvoegen: "Lotte stuurde 👏 💪"
  const per = new Map();
  data.forEach(a => { if (!per.has(a.naam)) per.set(a.naam, []); per.get(a.naam).push(a.emoji); });
  vak.innerHTML = "";
  per.forEach((emojis, naam) => {
    const p = document.createElement("p");
    p.textContent = `${emojis.join(" ")} ${naam} moedigt je aan!`;
    vak.appendChild(p);
  });
  vak.hidden = false;
  db.rpc("aanmoedigingen_gelezen"); // de volgende keer niet opnieuw tonen
}

// ----- Uitnodigen -----
async function nodigUit() {
  const { data: code, error } = await db.rpc("maatje_uitnodiging_maken");
  if (error || !code) { toonToast("Uitnodigen lukte niet. Heb je internet?"); return; }
  const link = `${location.origin}/app/#maatje=${code}`;
  const tekst = `Zin om samen te bewegen? Word mijn beweegmaatje in MoveForPleasure 🧡 We zien alleen op welke dagen de ander bewoog, en kunnen elkaar aanmoedigen.`;
  if (navigator.share) {
    try { await navigator.share({ title: "Word mijn beweegmaatje", text: tekst, url: link }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  // Geen deelknop op dit toestel: link tonen om te kopiëren
  mEl("maatje-link-tekst").value = link;
  mEl("maatje-link").hidden = false;
  mEl("maatje-link-tekst").select();
}
mEl("maatje-uitnodigen").addEventListener("click", nodigUit);
mEl("maatje-kopieer").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(mEl("maatje-link-tekst").value); toonToast("Link gekopieerd! Plak hem in een bericht 📋"); }
  catch { mEl("maatje-link-tekst").select(); }
});

// ----- Uitnodiging aanvaarden -----
let openCode = null;
async function verwerkUitnodiging() {
  const code = localStorage.getItem(UITNODIGING_SLEUTEL);
  if (!code || !db || !gebruiker) return;
  // Eerst de onboarding afmaken (als die openstaat)
  const ob = document.getElementById("onboarding");
  if (ob && !ob.hidden) { setTimeout(verwerkUitnodiging, 1500); return; }

  const { data: info, error } = await db.rpc("maatje_uitnodiging_info", { uitnodiging: code });
  if (error) return; // later opnieuw (bv. geen internet)
  if (!info.geldig) {
    localStorage.removeItem(UITNODIGING_SLEUTEL);
    const reden = {
      eigen: "Dat is je eigen uitnodiging. Stuur hem naar iemand anders 🙂",
      "al maatjes": `Jij en ${info.naam} zijn al maatjes 👯`,
      verlopen: `Deze uitnodiging is verlopen of al gebruikt. Vraag ${info.naam || "je maatje"} om een nieuwe link.`,
      onbekend: "Deze uitnodigingslink klopt niet.",
    }[info.reden];
    if (reden) toonToast(reden);
    return;
  }
  openCode = code;
  mEl("maatje-titel").textContent = `${info.naam} nodigt je uit!`;
  mEl("maatje-uitleg").textContent = `Word beweegmaatjes en moedig elkaar aan om in beweging te blijven.`;
  mEl("maatje-venster").hidden = false;
}

mEl("maatje-ja").addEventListener("click", async () => {
  const knop = mEl("maatje-ja");
  knop.disabled = true;
  const { data, error } = await db.rpc("maatje_accepteren", { uitnodiging: openCode });
  knop.disabled = false;
  localStorage.removeItem(UITNODIGING_SLEUTEL);
  mEl("maatje-venster").hidden = true;
  if (error) {
    toonToast(error.message.includes("te veel") ? "Je hebt al 10 maatjes, het maximum." : "Dat lukte niet: de uitnodiging is misschien verlopen.");
    return;
  }
  toonViering("👯", `Jij en ${data.naam} zijn maatjes!`, "Op Vandaag zie je nu hoe jullie week loopt. Stuur gerust een 👏 om elkaar aan te moedigen.");
  laadMaatjes();
});
mEl("maatje-nee").addEventListener("click", () => {
  localStorage.removeItem(UITNODIGING_SLEUTEL);
  mEl("maatje-venster").hidden = true;
});

// ----- Wanneer laden? -----
// Bij inloggen (account.js roept dit aan), en als je de app weer opent
function maatjesGebruikerGewijzigd() {
  if (gebruiker) { laadMaatjes(); verwerkUitnodiging(); }
  else { maatjes = []; tekenMaatjes(); }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && gebruiker) laadMaatjes();
});
