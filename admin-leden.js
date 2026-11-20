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
