// ============================================================
// Edge Function "weekmail": de zondagmail met je beweegweek
//
// Elke zondag om 18u (Belgische tijd) roept de database-planner
// (pg_cron) deze functie aan. Elk lid krijgt dan een kort overzicht:
// hoeveel dagen je bewoog, wat je deed, je weekritme, en een
// vriendelijke duw voor volgende week.
//
// Wie krijgt hem NIET:
//   - wie de zondagmail uitzette (profiel.zondagmail === false)
//   - wie zijn e-mailadres nog niet bevestigde
//   - wie nog nooit iets logde en al langer dan 4 weken lid is
//
// Veiligheid: iedereen kan deze functie aanroepen (zoals chat-melding),
// maar ze verstuurt alleen op zondag, en elk lid krijgt maximaal één
// mail per week (tabel weekmail_verstuurd). Misbruik levert dus niets op.
//
// Voorbeeld: een ingelogde ADMIN kan zichzelf op elk moment een voorbeeld
// sturen (knop op de adminpagina). Dat telt niet als "verstuurd".
//
// Geheimen (Supabase > Edge Functions > Secrets): RESEND_API_KEY, optioneel MAIL_AFZENDER
// ============================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP_URL = "https://moveforpleasure.be/app/";
const PROFIEL_URL = "https://moveforpleasure.be/app/#profiel";

type Item = { datum: string; id: number; oefening?: string; type?: string; minuten?: number; sets?: number; reps?: number; gewicht?: number; km?: number };

const antwoord = (tekst: string, status = 200) =>
  new Response(tekst, { status, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey" } });

function ontsnap(t: string) {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ===== Datums in Belgische tijd =====
function vandaagBE(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date()); // "2026-11-29"
}
function plusDagen(datum: string, n: number): string {
  const d = new Date(datum + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function maandagVan(datum: string): string {
  const d = new Date(datum + "T12:00:00Z");
  return plusDagen(datum, -((d.getUTCDay() + 6) % 7));
}
const dagNamen = ["zo", "ma", "di", "wo", "do", "vr", "za"];
function dagKort(datum: string) {
  return dagNamen[new Date(datum + "T12:00:00Z").getUTCDay()];
}

// ===== Het overzicht van één lid =====
function maakOverzicht(workouts: Item[], cardio: Item[], weekdoel: number, maandag: string) {
  const zondag = plusDagen(maandag, 6);
  const inWeek = (i: Item) => i.datum >= maandag && i.datum <= zondag;
  const deze = [...workouts.filter(inWeek), ...cardio.filter(inWeek)]
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.id - b.id);
  const dagen = new Set(deze.map((i) => i.datum)).size;
  const minuten = deze.reduce((som, i) => som + (i.minuten || 0), 0);

  // Weekritme: hoeveel weken op rij (t/m deze) haalde je je weekdoel?
  const perWeek = new Map<string, Set<string>>();
  [...workouts, ...cardio].forEach((i) => {
    const w = maandagVan(i.datum);
    if (!perWeek.has(w)) perWeek.set(w, new Set());
    perWeek.get(w)!.add(i.datum);
  });
  let reeks = 0;
  let w = maandag;
  while ((perWeek.get(w)?.size ?? 0) >= weekdoel) { reeks++; w = plusDagen(w, -7); }

  const regels = deze.slice(0, 8).map((i) => {
    const wat = i.oefening
      ? `${i.oefening}: ${i.sets}×${i.reps}${i.gewicht ? " @ " + i.gewicht + " kg" : ""}`
      : `${i.type}: ${i.minuten} min${i.km ? ", " + i.km + " km" : ""}`;
    return `${dagKort(i.datum)} · ${wat}`;
  });
  if (deze.length > 8) regels.push(`… en nog ${deze.length - 8} keer`);

  const ooitIets = workouts.length + cardio.length > 0;
  return { dagen, minuten, reeks, regels, gehaald: dagen >= weekdoel, ooitIets };
}

function mailHtml(naam: string, weekdoel: number, o: ReturnType<typeof maakOverzicht>) {
  const hoi = naam ? `Hoi ${ontsnap(naam)}!` : "Hoi!";
  let kop: string, tekst: string;
  if (o.gehaald) {
    kop = `🎉 Weekchallenge gehaald: ${o.dagen} van ${weekdoel} dagen!`;
    tekst = o.reeks > 1
      ? `Al ${o.reeks} weken op rij. Zo groeit een gewoonte die blijft. Geniet van je zondag!`
      : "Wat fijn dat je zo in beweging was. Geniet van je zondag, je hebt het verdiend!";
  } else if (o.dagen > 0) {
    kop = `💪 Je bewoog ${o.dagen} van ${weekdoel} ${weekdoel === 1 ? "dag" : "dagen"} deze week`;
    tekst = "Elke beweegdag telt, ook als het doel er net niet was. Volgende week is een nieuwe kans, zonder stress.";
  } else {
    kop = "🌱 Een rustige week";
    tekst = o.ooitIets
      ? "Deze week was het stil, en dat is helemaal oké. Zin om volgende week te beginnen met één wandeling? Meer hoeft niet."
      : "Je account staat klaar. Zin om deze week je eerste beweging bij te houden? Een korte wandeling is een prima start.";
  }
  const lijst = o.regels.length
    ? `<div style="background:#3a2847;border-radius:10px;padding:12px 14px;line-height:1.7;color:#ffffff;margin-top:14px;">${o.regels.map(ontsnap).join("<br>")}</div>`
    : "";
  const extra = o.minuten ? `<p style="margin:12px 0 0;color:#d9c6d2;">Samen goed voor <strong style="color:#ffd23f;">${o.minuten} minuten</strong> beweging. 🙌</p>` : "";

  return `<!DOCTYPE html><html><body style="margin:0;background:#f6f1f4;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:28px 16px;">
    <div style="background:#23152f;border-radius:16px;padding:26px;color:#eaeaea;">
      <div style="font-size:20px;font-weight:700;color:#ff7a3d;margin-bottom:14px;">MoveForPleasure</div>
      <p style="margin:0 0 6px;color:#d9c6d2;">${hoi}</p>
      <h1 style="font-size:19px;margin:0 0 8px;color:#ffffff;">${ontsnap(kop)}</h1>
      <p style="margin:0;color:#d9c6d2;line-height:1.5;">${ontsnap(tekst)}</p>
      ${lijst}${extra}
      <a href="${APP_URL}" style="display:inline-block;margin-top:20px;background:#ff7a3d;color:#23152f;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">Open de app</a>
    </div>
    <p style="font-size:12px;color:#8a7a85;text-align:center;margin-top:14px;line-height:1.5;">
      Je krijgt deze zondagmail omdat je een account hebt bij MoveForPleasure.<br>
      Liever niet? Zet hem uit in de app, bij <a href="${PROFIEL_URL}" style="color:#8a7a85;">je profiel</a>. 🧡
    </p>
  </div></body></html>`;
}

function onderwerp(weekdoel: number, o: ReturnType<typeof maakOverzicht>) {
  if (o.gehaald) return `🎉 Weekchallenge gehaald! Jouw beweegweek`;
  if (o.dagen > 0) return `📈 Jouw beweegweek: ${o.dagen} van ${weekdoel} dagen`;
  return `🌱 Jouw beweegweek bij MoveForPleasure`;
}

async function stuurMail(aan: string, titel: string, html: string) {
  const sleutel = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!sleutel) { console.log("Geen RESEND_API_KEY: niets verstuurd"); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${sleutel}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_AFZENDER") ?? "MoveForPleasure <meldingen@moveforpleasure.be>",
      to: [aan], subject: titel, html,
    }),
  });
  if (!r.ok) console.error("Resend-fout", r.status, await r.text());
  return r.ok;
}

// Alle data van één lid ophalen en (eventueel) de mail sturen
async function verwerkLid(userId: string, email: string, aangemaakt: string, maandag: string, voorbeeld: boolean) {
  const { data: rijen } = await db.from("gebruikersdata").select("sleutel, waarde")
    .eq("user_id", userId).in("sleutel", ["workouts", "cardio", "weekdoel", "profiel"]);
  const w = Object.fromEntries((rijen ?? []).map((r) => [r.sleutel, r.waarde]));
  const profiel = (w.profiel ?? {}) as { naam?: string; zondagmail?: boolean };
  if (!voorbeeld && profiel.zondagmail === false) return "uitgezet";

  const weekdoel = Number(w.weekdoel) >= 1 ? Number(w.weekdoel) : 3;
  const o = maakOverzicht(Array.isArray(w.workouts) ? w.workouts : [], Array.isArray(w.cardio) ? w.cardio : [], weekdoel, maandag);
  const vierWekenOud = Date.now() - new Date(aangemaakt).getTime() > 28 * 86400_000;
  if (!voorbeeld && !o.ooitIets && vierWekenOud) return "nooit actief";

  if (!voorbeeld) {
    // Eén keer per week: "claim" deze week voor dit lid (lukt maar één keer)
    const { error } = await db.from("weekmail_verstuurd").insert({ user_id: userId, week: maandag });
    if (error) return "al verstuurd";
  }
  const ok = await stuurMail(email, (voorbeeld ? "[Voorbeeld] " : "") + onderwerp(weekdoel, o), mailHtml(profiel.naam ?? "", weekdoel, o));
  return ok ? "verstuurd" : "mislukt";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return antwoord("ok");
  if (req.method !== "POST") return antwoord("alleen POST", 405);
  const maandag = maandagVan(vandaagBE());

  // --- Voorbeeld voor de admin (met zijn eigen login) ---
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { voorbeeld } = await req.json().catch(() => ({}));
  if (voorbeeld) {
    const { data: u } = await db.auth.getUser(token);
    const user = u?.user;
    if (!user?.email) return antwoord("niet ingelogd", 401);
    const { data: admin } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) return antwoord("geen toegang", 403);
    const status = await verwerkLid(user.id, user.email, user.created_at, maandag, true);
    return antwoord(status === "verstuurd" ? `Voorbeeld verstuurd naar ${user.email}` : `Niet gelukt (${status})`);
  }

  // --- De echte zondagmail: alleen op zondag ---
  if (new Date(vandaagBE() + "T12:00:00Z").getUTCDay() !== 0) return antwoord("het is geen zondag");

  const telling: Record<string, number> = {};
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) { console.error(error.message); break; }
    for (const u of data.users) {
      if (!u.email || !u.email_confirmed_at) { telling["niet bevestigd"] = (telling["niet bevestigd"] ?? 0) + 1; continue; }
      const status = await verwerkLid(u.id, u.email, u.created_at, maandag, false);
      telling[status] = (telling[status] ?? 0) + 1;
    }
    if (data.users.length < 200) break;
  }
  console.log("Zondagmail", maandag, JSON.stringify(telling));
  return antwoord(JSON.stringify(telling));
});
