// ============================================================
// admin-chat.js: chats met gebruikers beantwoorden
//
// Links de gesprekken (nieuwste bovenaan, ongelezen in het oranje),
// rechts het gekozen gesprek met een antwoordvak.
// Nieuwe berichten komen live binnen (Supabase Realtime).
// Gebruikt "db" en "$" uit admin.js.
// ============================================================

let gesprekken = [];
let actiefGesprek = null;   // gebruiker_id van het open gesprek
let gesprekBerichten = [];
let adminKanaal = null;

function datumTijd(iso) {
  const d = new Date(iso);
  const vandaag = new Date().toDateString() === d.toDateString();
  return vandaag
    ? d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}

// ----- Lijst met gesprekken -----
async function laadGesprekken() {
  const { data, error } = await db.rpc("admin_gesprekken");
  if (error) { $("gesprekken-lijst").textContent = "Gesprekken laden lukte niet."; return; }
  gesprekken = data;
  tekenGesprekken();
}

function tekenGesprekken() {
  const lijst = $("gesprekken-lijst");
  lijst.innerHTML = "";
  if (!gesprekken.length) {
    lijst.innerHTML = `<p class="leeg">Nog geen chats. Zodra iemand je een bericht stuurt, verschijnt het hier.</p>`;
  }
  let totaal = 0;
  gesprekken.forEach(g => {
    totaal += Number(g.ongelezen);
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "gesprek-item" + (g.gebruiker_id === actiefGesprek ? " actief" : "") + (g.ongelezen > 0 ? " ongelezen" : "");
    const naam = document.createElement("strong");
    naam.textContent = g.naam || g.email;
    const tijd = document.createElement("span");
    tijd.className = "gesprek-tijd";
    tijd.textContent = datumTijd(g.laatste_op);
    const voorbeeld = document.createElement("span");
    voorbeeld.className = "gesprek-voorbeeld";
    voorbeeld.textContent = (g.laatste_van_admin ? "Jij: " : "") + g.laatste_tekst;
    knop.append(naam, tijd, voorbeeld);
    if (g.ongelezen > 0) {
      const b = document.createElement("b");
      b.className = "gesprek-badge";
      b.textContent = g.ongelezen;
      knop.appendChild(b);
    }
    knop.onclick = () => openGesprek(g.gebruiker_id);
    lijst.appendChild(knop);
  });
  $("chats-ongelezen").hidden = totaal === 0;
  $("chats-ongelezen").textContent = `${totaal} nieuw`;
  document.title = (totaal ? `(${totaal}) ` : "") + "Admin · MoveForPleasure";
}

// ----- Eén gesprek -----
async function openGesprek(gebruikerId) {
  actiefGesprek = gebruikerId;
  const g = gesprekken.find(x => x.gebruiker_id === gebruikerId);
  $("gesprek-kop").textContent = g ? (g.naam ? `${g.naam} · ${g.email}` : g.email) : "";
  $("antwoord-formulier").hidden = false;

  const { data, error } = await db.from("chatberichten")
    .select("id, van_admin, tekst, aangemaakt")
    .eq("gebruiker_id", gebruikerId)
    .order("aangemaakt", { ascending: false }) // de nieuwste 500...
    .limit(500);
  if (error) { $("gesprek-berichten").textContent = "Laden lukte niet."; return; }
  gesprekBerichten = data.reverse();            // ...in leesvolgorde
  tekenGesprek();
  await db.rpc("chat_gelezen", { gesprek: gebruikerId });
  if (g) g.ongelezen = 0;
  tekenGesprekken();
  $("antwoord-tekst").focus();
}

function tekenGesprek() {
  const vak = $("gesprek-berichten");
  vak.innerHTML = "";
  gesprekBerichten.forEach(b => {
    const bel = document.createElement("div");
    bel.className = "admin-bel " + (b.van_admin ? "van-admin" : "van-gebruiker");
    const p = document.createElement("p");
    p.textContent = b.tekst;
    const t = document.createElement("span");
    t.textContent = datumTijd(b.aangemaakt);
    bel.append(p, t);
    vak.appendChild(bel);
  });
  vak.scrollTop = vak.scrollHeight;
}

// ----- Antwoorden -----
$("antwoord-tekst").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("antwoord-formulier").requestSubmit(); }
});

$("antwoord-formulier").addEventListener("submit", async (e) => {
  e.preventDefault();
  const tekst = $("antwoord-tekst").value.trim();
  if (!tekst || !actiefGesprek) return;
  const knop = e.submitter || $("antwoord-formulier").querySelector("button");
  knop.disabled = true;
  const { data, error } = await db.from("chatberichten")
    .insert({ gebruiker_id: actiefGesprek, van_admin: true, tekst })
    .select("id, van_admin, tekst, aangemaakt")
    .single();
  knop.disabled = false;
  if (error) { alert("Versturen lukte niet: " + error.message); return; }
  $("antwoord-tekst").value = "";
  if (!gesprekBerichten.some(b => b.id === data.id)) gesprekBerichten.push(data);
  tekenGesprek();
  laadGesprekken();
});

// ----- Live -----
function startAdminChat() {
  laadGesprekken();
  if (adminKanaal) return;
  adminKanaal = db.channel("admin-chats")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chatberichten" }, (nieuw) => {
      const b = nieuw.new;
      if (b.gebruiker_id === actiefGesprek && !gesprekBerichten.some(x => x.id === b.id)) {
        gesprekBerichten.push(b);
        tekenGesprek();
        if (!b.van_admin) db.rpc("chat_gelezen", { gesprek: actiefGesprek });
      }
      laadGesprekken();
    })
    .subscribe((status) => {
      // Vangnet: alleen zelf verversen als de live verbinding wegvalt
      if (status === "SUBSCRIBED") {
        clearInterval(adminPollTimer);
        adminPollTimer = null;
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) && !adminPollTimer) {
        adminPollTimer = setInterval(laadGesprekken, 30000);
      }
    });
}
let adminPollTimer = null;
