// ============================================================
// admin.js: berichten beheren
//
// Inloggen gaat via Supabase Auth. De database controleert ZELF
// of je admin bent (Row Level Security): ook als iemand deze
// pagina namaakt, kan hij zonder adminrechten niets plaatsen.
// ============================================================

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const categorieInfo = {
  motivatie: { icoon: "💪", naam: "Motivatie" },
  weetje:    { icoon: "💡", naam: "Weetje" },
  tip:       { icoon: "🎯", naam: "Tip" },
  nieuws:    { icoon: "📣", naam: "Nieuws" }
};

const $ = (id) => document.getElementById(id);
let bewerkId = null;  // id van het bericht dat we bewerken (null = nieuw)
let alleBerichten = [];

// ===== Schermen wisselen =====
function toonScherm(naam) {
  ["login", "geen-rechten", "beheer"].forEach(s => { $("scherm-" + s).hidden = s !== naam; });
  $("uitloggen").hidden = naam === "login";
}

// ===== Inloggen / uitloggen =====
$("login-formulier").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-fout").textContent = "";
  $("login-knop").disabled = true;
  const { error } = await db.auth.signInWithPassword({
    email: $("login-email").value.trim(),
    password: $("login-wachtwoord").value
  });
  $("login-knop").disabled = false;
  if (error) {
    $("login-fout").textContent = "Inloggen mislukt. Controleer je e-mailadres en wachtwoord.";
    return;
  }
  $("login-wachtwoord").value = "";
  await start();
});

$("uitloggen").addEventListener("click", async () => {
  await db.auth.signOut();
  toonScherm("login");
});

// ===== Start: ingelogd? admin? =====
async function start() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return toonScherm("login");

  const { data } = await db.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
  if (!data) return toonScherm("geen-rechten");

  toonScherm("beheer");
  resetFormulier();
  laadCijfers();
  if (typeof startAdminChat === "function") startAdminChat();
  if (typeof laadLeden === "function") laadLeden();
  await laadBerichten();
}

// ===== Kerncijfers (accounts, actief, wachtlijst) =====
async function laadCijfers() {
  const { data, error } = await db.rpc("admin_cijfers");
  if (error) { $("admin-cijfers").textContent = "Cijfers konden niet geladen worden."; return; }
  const tegels = [
    ["👥", data.gebruikers, "accounts"],
    ["✉️", data.bevestigd, "bevestigd"],
    ["🌱", data.nieuw_7d, "nieuw (7 dagen)"],
    ["🔥", data.actief_7d, "actief (7 dagen)"],
    ["📝", data.wachtlijst, "op de wachtlijst"],
  ];
  $("admin-cijfers").innerHTML = tegels.map(([icoon, getal, label]) =>
    `<div class="cijfer-tegel"><span>${icoon}</span><strong>${getal}</strong><small>${label}</small></div>`
  ).join("");
}

// ===== Berichtkaart (zelfde opmaak als in de app) =====
function maakKaart(b) {
  const info = categorieInfo[b.categorie] || categorieInfo.motivatie;
  const kaart = document.createElement("article");
  kaart.className = `bericht bericht-${b.categorie}`;
  const kop = document.createElement("div");
  kop.className = "bericht-kop";
  const label = document.createElement("span");
  label.className = "bericht-label";
  label.textContent = `${info.icoon} ${info.naam}`;
  const datum = document.createElement("span");
  datum.className = "bericht-datum";
  datum.textContent = (b.vastgepind ? "📌 " : "") +
    new Date(b.gepubliceerd_op).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  kop.append(label, datum);
  const titel = document.createElement("h3");
  titel.textContent = b.titel || "Titel van je bericht";
  const tekst = document.createElement("p");
  tekst.className = "bericht-tekst";
  tekst.textContent = b.tekst || "Hier komt de tekst van je bericht…";
  kaart.append(kop, titel, tekst);
  return kaart;
}

// ===== Formulier =====
function gekozenCategorie() {
  return document.querySelector("input[name=categorie]:checked").value;
}

// Datum naar het formaat dat een datetime-local veld verwacht (lokale tijd)
function naarLokaal(iso) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function publicatieMoment() {
  if ($("b-wanneer").value === "later" && $("b-moment").value) {
    return new Date($("b-moment").value).toISOString();
  }
  return new Date().toISOString();
}

function vernieuwVoorbeeld() {
  $("titel-teller").textContent = `${$("b-titel").value.length}/120`;
  $("tekst-teller").textContent = `${$("b-tekst").value.length}/2000`;
  $("voorbeeld").innerHTML = "";
  $("voorbeeld").appendChild(maakKaart({
    titel: $("b-titel").value, tekst: $("b-tekst").value, categorie: gekozenCategorie(),
    vastgepind: $("b-vastgepind").checked, gepubliceerd_op: publicatieMoment()
  }));
}
["b-titel", "b-tekst", "b-vastgepind", "b-moment"].forEach(id => $(id).addEventListener("input", vernieuwVoorbeeld));
document.querySelectorAll("input[name=categorie]").forEach(r => r.addEventListener("change", vernieuwVoorbeeld));

// 🎲 Willekeurig weetje: vult titel en tekst in, klik nog eens voor een ander
$("weetje-knop").addEventListener("click", () => {
  const w = willekeurigWeetje($("b-titel").value);
  document.querySelector("input[name=categorie][value=weetje]").checked = true;
  $("b-titel").value = w.titel;
  $("b-tekst").value = w.tekst;
  vernieuwVoorbeeld();
});

$("b-wanneer").addEventListener("change", () => {
  const later = $("b-wanneer").value === "later";
  $("b-moment").hidden = !later;
  $("b-moment").required = later;
  if (later && !$("b-moment").value) {
    const morgen = new Date(Date.now() + 86400000);
    morgen.setHours(8, 0, 0, 0);
    $("b-moment").value = naarLokaal(morgen.toISOString());
  }
  $("opslaan-knop").textContent = bewerkId ? "Wijzigingen opslaan" : later ? "Inplannen" : "Publiceren";
  vernieuwVoorbeeld();
});

function resetFormulier() {
  bewerkId = null;
  $("bericht-formulier").reset();
  $("b-moment").hidden = true;
  $("b-moment").required = false;
  $("formulier-titel").textContent = "Nieuw bericht";
  $("opslaan-knop").textContent = "Publiceren";
  $("annuleer-knop").hidden = true;
  vernieuwVoorbeeld();
}
$("annuleer-knop").addEventListener("click", resetFormulier);

function melding(tekst, fout = false) {
  $("formulier-melding").textContent = tekst;
  $("formulier-melding").className = "melding" + (fout ? " fout" : "");
  if (!fout) setTimeout(() => { $("formulier-melding").textContent = ""; }, 4000);
}

$("bericht-formulier").addEventListener("submit", async (e) => {
  e.preventDefault();
  const gegevens = {
    titel: $("b-titel").value.trim(),
    tekst: $("b-tekst").value.trim(),
    categorie: gekozenCategorie(),
    vastgepind: $("b-vastgepind").checked,
    gepubliceerd_op: publicatieMoment()
  };
  if (!gegevens.titel || !gegevens.tekst) return melding("Vul een titel en tekst in.", true);

  $("opslaan-knop").disabled = true;
  const { error } = bewerkId
    ? await db.from("berichten").update(gegevens).eq("id", bewerkId)
    : await db.from("berichten").insert(gegevens);
  $("opslaan-knop").disabled = false;

  if (error) {
    console.error(error);
    return melding("Opslaan mislukt: " + error.message, true);
  }
  const ingepland = new Date(gegevens.gepubliceerd_op) > new Date();
  melding(bewerkId ? "Wijzigingen opgeslagen ✓" : ingepland ? "Bericht ingepland ✓" : "Bericht gepubliceerd ✓ Iedereen ziet het nu.");
  resetFormulier();
  await laadBerichten();
});

// ===== Lijst met alle berichten =====
async function laadBerichten() {
  const { data, error } = await db.from("berichten")
    .select("*")
    .order("vastgepind", { ascending: false })
    .order("gepubliceerd_op", { ascending: false });
  if (error) { console.error(error); return; }
  alleBerichten = data;

  const lijst = $("admin-lijst");
  lijst.innerHTML = "";
  if (data.length === 0) {
    lijst.innerHTML = `<p class="gedempt">Nog geen berichten.</p>`;
    return;
  }

  data.forEach(b => {
    const item = document.createElement("div");
    item.className = "admin-item";
    item.appendChild(maakKaart(b));

    const balk = document.createElement("div");
    balk.className = "admin-balk";
    const status = document.createElement("span");
    const gepland = new Date(b.gepubliceerd_op) > new Date();
    status.className = "status " + (!b.zichtbaar ? "status-verborgen" : gepland ? "status-gepland" : "status-live");
    status.textContent = !b.zichtbaar ? "Verborgen" : gepland ? "Ingepland" : "Live";
    balk.appendChild(status);

    const acties = [
      ["✏️ Bewerken", () => bewerk(b)],
      [b.vastgepind ? "Losmaken" : "📌 Vastpinnen", () => wijzig(b.id, { vastgepind: !b.vastgepind })],
      [b.zichtbaar ? "🙈 Verbergen" : "👁️ Tonen", () => wijzig(b.id, { zichtbaar: !b.zichtbaar })],
      ["🗑️ Verwijderen", () => verwijder(b), "gevaar"]
    ];
    acties.forEach(([tekst, actie, extra]) => {
      const knop = document.createElement("button");
      knop.className = "actie" + (extra ? " " + extra : "");
      knop.textContent = tekst;
      knop.onclick = actie;
      balk.appendChild(knop);
    });

    item.appendChild(balk);
    lijst.appendChild(item);
  });
}

async function wijzig(id, velden) {
  const { error } = await db.from("berichten").update(velden).eq("id", id);
  if (error) return alert("Wijzigen mislukt: " + error.message);
  await laadBerichten();
}

async function verwijder(b) {
  if (!confirm(`"${b.titel}" definitief verwijderen? Dit kan niet ongedaan worden.\n\nTip: met "Verbergen" haal je het weg zonder te verwijderen.`)) return;
  const { error } = await db.from("berichten").delete().eq("id", b.id);
  if (error) return alert("Verwijderen mislukt: " + error.message);
  if (bewerkId === b.id) resetFormulier();
  await laadBerichten();
}

function bewerk(b) {
  bewerkId = b.id;
  $("b-titel").value = b.titel;
  $("b-tekst").value = b.tekst;
  $("b-vastgepind").checked = b.vastgepind;
  document.querySelector(`input[name=categorie][value=${b.categorie}]`).checked = true;
  $("b-wanneer").value = "later";
  $("b-moment").hidden = false;
  $("b-moment").value = naarLokaal(b.gepubliceerd_op);
  $("formulier-titel").textContent = "Bericht bewerken";
  $("opslaan-knop").textContent = "Wijzigingen opslaan";
  $("annuleer-knop").hidden = false;
  vernieuwVoorbeeld();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

start();
