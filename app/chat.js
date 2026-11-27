// ============================================================
// chat.js — chatten met de admin
//
// Elke gebruiker heeft één gesprek met het MoveForPleasure-team.
// Berichten staan in de tabel "chatberichten" (Supabase). De
// database zorgt dat je alleen je eigen gesprek ziet.
// Nieuwe antwoorden komen live binnen (Supabase Realtime);
// als dat niet lukt, kijken we elke 30 seconden even.
// Gebruikt "db" en "gebruiker" uit account.js.
// ============================================================

let chatBerichten = [];
let chatOngelezen = 0;
let chatKanaal = null;
let chatPollTimer = null;
let chatOpen = false;

const chatEl = (id) => document.getElementById(id);

// ----- Wisselen tussen Nieuws en Chat -----
function toonChatPaneel(open) {
  chatOpen = open;
  chatEl("wissel-nieuws").classList.toggle("actief", !open);
  chatEl("wissel-chat").classList.toggle("actief", open);
  chatEl("paneel-nieuws").hidden = open;
  chatEl("paneel-chat").hidden = !open;
  if (open) {
    tekenChat();
    markeerChatGelezen();
    chatEl("chat-lijst").scrollTop = chatEl("chat-lijst").scrollHeight;
  }
}
chatEl("wissel-nieuws").addEventListener("click", () => toonChatPaneel(false));
chatEl("wissel-chat").addEventListener("click", () => toonChatPaneel(true));

// Berichten-tab verlaten = terug naar Nieuws (dan tellen nieuwe antwoorden weer als ongelezen)
document.querySelectorAll(".nav-knop, #profiel-knop, #berichten-knop, .snel-knop").forEach(k =>
  k.addEventListener("click", () => { if (k.dataset.tab !== "berichten" && chatOpen) toonChatPaneel(false); })
);

// ----- Ophalen -----
async function haalChatOp() {
  if (!db || !gebruiker) return;
  const { data, error } = await db.from("chatberichten")
    .select("id, van_admin, tekst, aangemaakt, gelezen")
    .eq("gebruiker_id", gebruiker.id)
    .order("aangemaakt", { ascending: false }) // de nieuwste 200 ophalen...
    .limit(200);
  if (error) { console.warn("Chat ophalen mislukt:", error.message); return; }
  chatBerichten = data.reverse();               // ...en in leesvolgorde tonen (oud → nieuw)
  telOngelezen();
  if (chatOpen && !chatEl("tab-berichten").classList.contains("verborgen")) {
    tekenChat();
    markeerChatGelezen();
  }
}

function telOngelezen() {
  chatOngelezen = chatBerichten.filter(b => b.van_admin && !b.gelezen).length;
  const t = chatEl("chat-teller");
  t.textContent = chatOngelezen > 9 ? "9+" : chatOngelezen;
  t.hidden = chatOngelezen === 0;
  if (typeof vernieuwTeller === "function") vernieuwTeller();
}

async function markeerChatGelezen() {
  if (!chatOngelezen || !db) return;
  chatBerichten.forEach(b => { if (b.van_admin) b.gelezen = true; });
  telOngelezen();
  await db.rpc("chat_gelezen");
}

// ----- Tekenen (altijd textContent: er kan geen code insluipen) -----
function tekenChat() {
  const lijst = chatEl("chat-lijst");
  lijst.innerHTML = "";
  if (!chatBerichten.length) {
    const leeg = document.createElement("p");
    leeg.className = "gedempt chat-leeg";
    leeg.textContent = "👋 Vraag, idee of gewoon iets kwijt? Stuur ons een bericht. We lezen alles en antwoorden zo snel mogelijk.";
    lijst.appendChild(leeg);
    return;
  }
  let vorigeDag = "";
  chatBerichten.forEach(b => {
    const dag = wanneer(b.aangemaakt);
    if (dag !== vorigeDag) {
      const scheiding = document.createElement("div");
      scheiding.className = "chat-dag";
      scheiding.textContent = dag;
      lijst.appendChild(scheiding);
      vorigeDag = dag;
    }
    const bel = document.createElement("div");
    bel.className = "chat-bel " + (b.van_admin ? "van-admin" : "van-mij");
    if (b.van_admin) {
      const wie = document.createElement("span");
      wie.className = "chat-wie";
      wie.textContent = "MoveForPleasure";
      bel.appendChild(wie);
    }
    const tekst = document.createElement("p");
    tekst.textContent = b.tekst;
    const tijd = document.createElement("span");
    tijd.className = "chat-tijd";
    tijd.textContent = new Date(b.aangemaakt).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" }) + (b.wachtend ? " ⏳" : "");
    bel.append(tekst, tijd);
    lijst.appendChild(bel);
  });
  lijst.scrollTop = lijst.scrollHeight;
}

// ----- Versturen -----
const chatTekstveld = chatEl("chat-tekst");
// Tekstvak groeit mee met je bericht
chatTekstveld.addEventListener("input", () => {
  chatTekstveld.style.height = "auto";
  chatTekstveld.style.height = Math.min(chatTekstveld.scrollHeight, 140) + "px";
});
// Enter = versturen, Shift+Enter = nieuwe regel
chatTekstveld.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatEl("chat-formulier").requestSubmit();
  }
});

chatEl("chat-formulier").addEventListener("submit", async (e) => {
  e.preventDefault();
  const tekst = chatTekstveld.value.trim();
  if (!tekst || !db || !gebruiker) return;
  chatEl("chat-fout").hidden = true;

  // Meteen tonen (met ⏳), dan versturen
  const tijdelijk = { id: "t" + Date.now(), van_admin: false, tekst, aangemaakt: new Date().toISOString(), wachtend: true };
  chatBerichten.push(tijdelijk);
  chatTekstveld.value = "";
  chatTekstveld.style.height = "auto";
  tekenChat();

  const { data, error } = await db.from("chatberichten")
    .insert({ gebruiker_id: gebruiker.id, tekst })
    .select("id, van_admin, tekst, aangemaakt, gelezen")
    .single();
  chatBerichten = chatBerichten.filter(b => b !== tijdelijk);
  if (error) {
    chatTekstveld.value = tekst;
    const fout = chatEl("chat-fout");
    fout.textContent = error.message.includes("te veel")
      ? "Even rustig aan: je stuurde veel berichten. Probeer het over een tijdje opnieuw."
      : (navigator.onLine ? "Versturen lukte niet. Probeer het opnieuw." : "📴 Geen internet. Probeer het opnieuw als je online bent.");
    fout.hidden = false;
  } else if (!chatBerichten.some(b => b.id === data.id)) {
    chatBerichten.push(data);
  }
  tekenChat();
});

// ----- Live meeluisteren -----
function startChat() {
  stopChat();
  if (!db || !gebruiker) return;
  haalChatOp();
  chatKanaal = db.channel("chat-" + gebruiker.id)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "chatberichten", filter: `gebruiker_id=eq.${gebruiker.id}` },
      (nieuw) => {
        const b = nieuw.new;
        if (chatBerichten.some(x => x.id === b.id)) return;
        chatBerichten.push(b);
        telOngelezen();
        if (chatOpen && !chatEl("tab-berichten").classList.contains("verborgen")) {
          tekenChat();
          markeerChatGelezen();
        } else if (b.van_admin) {
          toonToast("💬 Nieuw antwoord van MoveForPleasure!");
        }
      })
    .subscribe((status) => {
      // Vangnet: alleen als de live verbinding wegvalt, kijken we elke 30 s zelf.
      // Werkt live (weer), dan stopt het extra ophalen (spaart de server bij veel leden).
      if (status === "SUBSCRIBED") {
        clearInterval(chatPollTimer);
        chatPollTimer = null;
        haalChatOp(); // berichten van terwijl we niet verbonden waren
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) && !chatPollTimer) {
        chatPollTimer = setInterval(() => { if (document.visibilityState === "visible") haalChatOp(); }, 30000);
      }
    });
}

function stopChat() {
  if (chatKanaal) { db.removeChannel(chatKanaal); chatKanaal = null; }
  clearInterval(chatPollTimer);
  chatPollTimer = null;
  chatBerichten = [];
  telOngelezen();
}

// Wordt door account.js aangeroepen als je in- of uitlogt
function chatGebruikerGewijzigd() {
  if (gebruiker) {
    startChat();
    // Link uit de meldingsmail (.../app/#chat): meteen de chat openen
    if (location.hash === "#chat") {
      history.replaceState(null, "", location.pathname);
      toonTab("berichten");
      toonChatPaneel(true);
    }
  } else stopChat();
}
if (typeof gebruiker !== "undefined" && gebruiker) startChat();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && gebruiker) haalChatOp();
});
