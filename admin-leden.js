// ============================================================
// admin-leden.js: ledenlijst op de adminpagina
//
// Haalt via de databasefunctie "admin_leden" alle accounts op
// (alleen admins krijgen antwoord). Zoeken gebeurt in de browser.
// Gebruikt "db" en "$" uit admin.js.
// ============================================================

let leden = [];

const doelLabels = {
  volhouden: "🌱 Gewoonte",
  fit: "⚡ Fitter",
  conditie: "❤️ Conditie",
  sterker: "💪 Sterker",
  afvallen: "⚖️ Gewicht",
};

function korteDatum(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  const dagen = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (dagen <= 0) return "vandaag";
  if (dagen === 1) return "gisteren";
  if (dagen < 7) return `${dagen} d geleden`;
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: dagen > 300 ? "numeric" : undefined });
}

async function laadLeden() {
  const { data, error } = await db.rpc("admin_leden");
  if (error) { $("leden-lijst").innerHTML = `<tr><td colspan="6">Leden laden lukte niet.</td></tr>`; return; }
  leden = data;
  tekenLeden();
}

function tekenLeden() {
  const zoek = $("leden-zoek").value.trim().toLowerCase();
  const lijst = leden.filter(l => !zoek || (l.email || "").toLowerCase().includes(zoek) || (l.naam || "").toLowerCase().includes(zoek));
  $("leden-aantal").textContent = zoek ? `${lijst.length} van ${leden.length}` : `${leden.length}`;

  const tbody = $("leden-lijst");
  tbody.innerHTML = "";
  if (!lijst.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="leden-leeg">Geen leden gevonden.</td></tr>`;
    return;
  }
  lijst.forEach(l => {
    const rij = document.createElement("tr");
    // Alles via textContent: namen en e-mails komen van gebruikers
    const cellen = [
      (l.naam || "–") + (l.is_admin ? " 🛡️" : ""),
      l.email + (l.bevestigd ? "" : " (niet bevestigd)"),
      doelLabels[l.doel] || "–",
      korteDatum(l.aangemeld),
      korteDatum(l.laatst_actief || l.laatst_ingelogd),
      String(l.beweegmomenten),
    ];
    cellen.forEach((tekst, i) => {
      const td = document.createElement("td");
      td.textContent = tekst;
      if (i === 1) {
        td.className = "leden-email" + (l.bevestigd ? "" : " onbevestigd");
        td.title = "Klik om te kopiëren";
        td.onclick = async () => {
          await navigator.clipboard.writeText(l.email);
          td.textContent = "✓ Gekopieerd";
          setTimeout(() => { td.textContent = tekst; }, 1200);
        };
      }
      if (i === 5) td.className = "leden-getal";
      rij.appendChild(td);
    });
    tbody.appendChild(rij);
  });
}

$("leden-zoek").addEventListener("input", tekenLeden);

// ===== Foutmeldingen uit de app (tabel app_fouten) =====
// Zelfde fout bij meerdere mensen? Dan tonen we hem één keer met een teller.
async function laadFouten() {
  const sinds = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data, error } = await db.from("app_fouten")
    .select("tijd, bericht, bron, versie, browser, gebruiker_id")
    .gte("tijd", sinds).order("tijd", { ascending: false }).limit(300);
  const lijst = $("fouten-lijst");
  lijst.innerHTML = "";
  if (error) { $("fouten-aantal").textContent = "?"; lijst.textContent = "Fouten laden lukte niet."; return; }

  const groepen = new Map();
  data.forEach(f => {
    const sleutel = f.bericht + "|" + (f.bron || "");
    if (!groepen.has(sleutel)) groepen.set(sleutel, { ...f, aantal: 0, mensen: new Set() });
    const g = groepen.get(sleutel);
    g.aantal++;
    g.mensen.add(f.gebruiker_id || "anoniem");
  });
  $("fouten-aantal").textContent = data.length;
  $("fouten-kaart").classList.toggle("heeft-fouten", data.length > 0);
  if (!groepen.size) {
    const li = document.createElement("li");
    li.className = "gedempt-klein";
    li.textContent = "Geen fouten. 🎉";
    lijst.appendChild(li);
    return;
  }
  groepen.forEach(g => {
    const li = document.createElement("li");
    const titel = document.createElement("strong");
    titel.textContent = g.bericht;
    const info = document.createElement("small");
    info.textContent = `${g.aantal}× bij ${g.mensen.size} ${g.mensen.size === 1 ? "persoon" : "personen"} · laatst ${datumTijd(g.tijd)} · versie ${g.versie || "?"} · ${g.bron || "onbekende plek"}`;
    li.append(titel, info);
    lijst.appendChild(li);
  });
}
