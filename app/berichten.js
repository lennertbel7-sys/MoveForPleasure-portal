// ============================================================
// berichten.js: het berichtencentrum
//
// Haalt de berichten op die de admin publiceert (via admin.html)
// en toont ze in de Berichten-tab. Welke berichten je al gelezen
// hebt, onthoudt de app op je eigen toestel.
//
// Zonder internet tonen we de laatst opgehaalde berichten.
// SUPABASE_URL en SUPABASE_KEY komen uit config.js.
// ============================================================

const categorieInfo = {
  motivatie: { icoon: "💪", naam: "Motivatie" },
  weetje:    { icoon: "💡", naam: "Weetje" },
  tip:       { icoon: "🎯", naam: "Tip" },
  nieuws:    { icoon: "📣", naam: "Nieuws" }
};

let berichten = opslag.laad("berichten-cache", []);
let gelezenBerichten = opslag.laad("berichten-gelezen", []);

// Nieuwe gebruikers: het welkomstbericht en de rest zijn "nieuw".
// Daarom beginnen we met een lege gelezen-lijst.

async function haalBerichtenOp() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/berichten`
      + "?select=id,titel,tekst,categorie,vastgepind,gepubliceerd_op"
      + "&order=vastgepind.desc,gepubliceerd_op.desc&limit=50";
    const antwoord = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
    if (!antwoord.ok) throw new Error("Status " + antwoord.status);
    berichten = await antwoord.json();
    opslag.bewaar("berichten-cache", berichten);
  } catch (fout) {
    console.warn("Berichten ophalen lukte niet, we tonen de bewaarde versie.", fout);
  }
  vernieuwBerichten();
}

function ongelezenBerichten() {
  return berichten.filter(b => !gelezenBerichten.includes(b.id));
}

function markeerAllesGelezen() {
  gelezenBerichten = berichten.map(b => b.id);
  opslag.bewaar("berichten-gelezen", gelezenBerichten);
  vernieuwTeller();
}

// "vandaag", "gisteren", "3 dagen geleden" of "12 nov"
function wanneer(isoDatum) {
  const d = new Date(isoDatum);
  const dagen = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (dagen <= 0) return "vandaag";
  if (dagen === 1) return "gisteren";
  if (dagen < 7) return `${dagen} dagen geleden`;
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

// Maakt één berichtkaart. We gebruiken textContent (geen innerHTML)
// voor de tekst van de admin, zodat er nooit code in kan sluipen.
function maakBerichtKaart(bericht, opties = {}) {
  const info = categorieInfo[bericht.categorie] || categorieInfo.motivatie;
  const kaart = document.createElement("article");
  kaart.className = `bericht bericht-${bericht.categorie}`;
  if (opties.ongelezen) kaart.classList.add("ongelezen");

  const kop = document.createElement("div");
  kop.className = "bericht-kop";
  const label = document.createElement("span");
  label.className = "bericht-label";
  label.textContent = `${info.icoon} ${info.naam}`;
  const datum = document.createElement("span");
  datum.className = "bericht-datum";
  datum.textContent = (bericht.vastgepind ? "📌 " : "") + wanneer(bericht.gepubliceerd_op);
  kop.append(label, datum);

  const titel = document.createElement("h3");
  titel.textContent = bericht.titel;
  const tekst = document.createElement("p");
  tekst.className = "bericht-tekst";
  tekst.textContent = bericht.tekst;

  kaart.append(kop, titel, tekst);
  return kaart;
}

function vernieuwTeller() {
  const aantal = ongelezenBerichten().length;
  const teller = document.getElementById("berichten-teller");
  teller.textContent = aantal > 9 ? "9+" : aantal;
  teller.hidden = aantal === 0;
}

function vernieuwBerichten() {
  vernieuwTeller();

  // De lijst in de Berichten-tab
  const lijst = document.getElementById("berichten-lijst");
  lijst.innerHTML = "";
  if (berichten.length === 0) {
    lijst.innerHTML = `<p class="gedempt leeg">Nog geen berichten. Kom snel terug voor tips en motivatie!</p>`;
  } else {
    berichten.forEach(b => lijst.appendChild(maakBerichtKaart(b, { ongelezen: !gelezenBerichten.includes(b.id) })));
  }

  // Op het Vandaag-scherm: nieuwste ongelezen bericht, anders de spreuk van de dag
  const plek = document.getElementById("vandaag-bericht");
  plek.innerHTML = "";
  const nieuwste = ongelezenBerichten().sort((a, b) => b.gepubliceerd_op.localeCompare(a.gepubliceerd_op))[0];
  if (nieuwste) {
    const kaart = maakBerichtKaart(nieuwste, { ongelezen: true });
    kaart.classList.add("bericht-uitgelicht");
    const knop = document.createElement("button");
    knop.className = "link-knop";
    knop.textContent = "Alle berichten →";
    knop.onclick = () => toonTab("berichten");
    kaart.appendChild(knop);
    plek.appendChild(kaart);
  } else {
    const kaart = document.createElement("article");
    kaart.className = "bericht spreuk";
    const label = document.createElement("span");
    label.className = "bericht-label";
    label.textContent = "✨ Spreuk van de dag";
    const tekst = document.createElement("p");
    tekst.className = "spreuk-tekst";
    tekst.textContent = spreukVanDeDag();
    kaart.append(label, tekst);
    plek.appendChild(kaart);
  }
}
