// ============================================================
// landing.js: alles wat "beweegt" op de landingspagina
//
//  1. Menubalk krijgt een randje zodra je scrolt
//  2. Mobiel menu open/dicht (hamburger-knop)
//  3. Blokken schuiven rustig in beeld tijdens het scrollen
//  4. Prijzen wisselen tussen per maand en per jaar
//  5. Teller: hoeveel mensen staan er al op de wachtlijst
//  6. Wachtlijst-formulier: controleren en versturen naar Supabase
//
// SUPABASE_URL en SUPABASE_KEY komen uit config.js.
// ============================================================

document.documentElement.classList.add("js"); // CSS weet nu: JavaScript werkt
document.getElementById("jaar").textContent = new Date().getFullYear();

// ---------- 1. Menubalk ----------
const topbalk = document.getElementById("topbalk");
function checkScroll() {
  topbalk.classList.toggle("gescrold", window.scrollY > 10);
}
window.addEventListener("scroll", checkScroll, { passive: true });
checkScroll();

// ---------- 2. Mobiel menu ----------
const menuKnop = document.getElementById("menu-knop");
const menu = document.getElementById("menu");

function zetMenu(open) {
  menu.classList.toggle("open", open);
  menuKnop.setAttribute("aria-expanded", open);
  menuKnop.setAttribute("aria-label", open ? "Menu sluiten" : "Menu openen");
}
menuKnop.addEventListener("click", () => zetMenu(!menu.classList.contains("open")));
// Klik op een link in het menu → menu dicht
menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => zetMenu(false)));
// Escape-toets → menu dicht
document.addEventListener("keydown", (e) => { if (e.key === "Escape") zetMenu(false); });

// ---------- 3. In beeld schuiven ----------
// IntersectionObserver = de browser laat weten wanneer een blok zichtbaar wordt.
const teOnthullen = document.querySelectorAll(".onthul");
if ("IntersectionObserver" in window) {
  const kijker = new IntersectionObserver((items) => {
    items.forEach((item) => {
      if (item.isIntersecting) {
        item.target.classList.add("zichtbaar");
        kijker.unobserve(item.target); // maar één keer animeren
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  teOnthullen.forEach((el) => kijker.observe(el));
} else {
  teOnthullen.forEach((el) => el.classList.add("zichtbaar"));
}

// ---------- 4. Prijzen maand/jaar ----------
const prijzen = {
  maand: { bedrag: "€2,99", periode: "/ maand", sub: "Maandelijks opzegbaar" },
  jaar:  { bedrag: "€24,99", periode: "/ jaar", sub: "Slechts €2,08 per maand" }
};
document.querySelectorAll(".schakel").forEach((knop) => {
  knop.addEventListener("click", () => {
    const p = prijzen[knop.dataset.periode];
    document.getElementById("pro-bedrag").textContent = p.bedrag;
    document.getElementById("pro-periode").textContent = p.periode;
    document.getElementById("pro-sub").textContent = p.sub;
    document.querySelectorAll(".schakel").forEach((k) => {
      const actief = k === knop;
      k.classList.toggle("actief", actief);
      k.setAttribute("aria-pressed", actief);
    });
  });
});

// ---------- 5. Wachtlijst-teller ----------
// Pas tonen vanaf 10 inschrijvingen: "3 mensen" overtuigt niemand.
// De database geeft alleen het AANTAL terug, nooit e-mailadressen.
async function laadTeller() {
  try {
    const antwoord = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wachtlijst_aantal`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: "{}"
    });
    if (!antwoord.ok) return;
    const aantal = await antwoord.json();
    if (aantal >= 10) {
      const teller = document.getElementById("teller");
      teller.textContent = `🧡 Al ${aantal} mensen bewegen met ons mee`;
      teller.hidden = false;
    }
  } catch { /* geen internet of database even weg: teller gewoon niet tonen */ }
}
laadTeller();

// ---------- 6. Wachtlijst-formulier ----------
const formulier = document.getElementById("wachtlijst-formulier");
const knop = document.getElementById("wl-knop");
const melding = document.getElementById("wl-melding");
const velden = {
  email: document.getElementById("wl-email"),
  type: document.getElementById("wl-type"),
  wens: document.getElementById("wl-wens"),
  akkoord: document.getElementById("wl-akkoord"),
  website: document.getElementById("wl-website") // honingpot
};

// Tekenteller onder het tekstvak
velden.wens.addEventListener("input", () => {
  document.getElementById("wens-teller").textContent = velden.wens.value.length;
});

function toonFout(naam, tekst) {
  document.getElementById("fout-" + naam).textContent = tekst;
  const veld = velden[naam];
  veld.classList.toggle("ongeldig", Boolean(tekst));
  veld.setAttribute("aria-invalid", Boolean(tekst));
}

// Controleert alle velden; geeft true terug als alles klopt
function controleer() {
  const email = velden.email.value.trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  toonFout("email", !email ? "Vul je e-mailadres in." : !emailOk ? "Dit lijkt geen geldig e-mailadres." : "");
  toonFout("type", velden.type.value ? "" : "Kies wat het beste bij je past.");
  toonFout("akkoord", velden.akkoord.checked ? "" : "Vink dit aan om je in te schrijven.");
  return emailOk && velden.type.value && velden.akkoord.checked;
}

// Fout weghalen zodra iemand het veld verbetert
["email", "type", "akkoord"].forEach((naam) => {
  velden[naam].addEventListener("change", () => { if (velden[naam].classList.contains("ongeldig") || naam === "akkoord") controleer(); });
});

function laden(bezig) {
  knop.disabled = bezig;
  knop.classList.toggle("laden", bezig);
  knop.querySelector(".knop-tekst").textContent = bezig ? "Even geduld…" : "Ik doe mee!";
}

function toonGelukt() {
  formulier.hidden = true;
  const gelukt = document.getElementById("gelukt");
  gelukt.hidden = false;
  gelukt.focus(); // schermlezers lezen het bedankje meteen voor
}

formulier.addEventListener("submit", async (gebeurtenis) => {
  gebeurtenis.preventDefault(); // pagina niet herladen
  melding.textContent = "";

  if (!controleer()) {
    formulier.querySelector(".ongeldig")?.focus();
    return;
  }

  // Honingpot ingevuld? Dan is het een bot: doen alsof het gelukt is.
  if (velden.website.value) { toonGelukt(); return; }

  laden(true);
  try {
    const antwoord = await fetch(`${SUPABASE_URL}/rest/v1/wachtlijst`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal" // we hoeven niets terug te krijgen
      },
      body: JSON.stringify({
        email: velden.email.value.trim().toLowerCase(),
        type_sporter: velden.type.value,
        wens: velden.wens.value.trim() || null,
        bron: new URLSearchParams(location.search).get("bron") // bv. ?bron=instagram
      })
    });

    // 201 = gelukt, 409 = e-mailadres stond er al in: voor de bezoeker allebei prima
    if (antwoord.ok || antwoord.status === 409) {
      toonGelukt();
    } else {
      throw new Error("Server gaf status " + antwoord.status);
    }
  } catch (fout) {
    console.error(fout);
    melding.textContent = "Er ging iets mis bij het inschrijven. Controleer je internet en probeer het opnieuw.";
  } finally {
    laden(false);
  }
});
