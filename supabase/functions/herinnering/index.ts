// ============================================================
// Edge Function "herinnering": een seintje op dagen waarop je iets plande
//
// Elk uur roept de database-planner (pg_cron) deze functie aan.
// Wie herinneringen aanzette (profiel.herinnering = { aan, uur, mail })
// en op dit uur (Belgische tijd) een herinnering wil, krijgt er één als:
//   - er vandaag iets in zijn weekplanning staat, en
//   - hij vandaag nog niet bewoog, en
//   - hij vandaag nog geen herinnering kreeg (tabel herinnering_verstuurd).
//
// Kanaal: eerst een pushmelding naar zijn toestellen. Lukt dat niet
// (geen toestel, of melding geweigerd), dan een mail (tenzij uitgezet).
//
// Pushmeldingen zijn "leeg": we sturen geen inhoud mee, alleen een seintje.
// De app op de telefoon toont dan zelf de tekst uit je planning. Zo gaat
// er geen persoonlijke info via Google/Apple/Mozilla. We hebben daarvoor
// alleen een VAPID-sleutelpaar nodig, dat deze functie de eerste keer zelf
// aanmaakt en in de Supabase Vault bewaart (niemand hoeft iets te plakken).
//
// Andere aanroepen:
//   { "test": true } + login-token  -> testmelding naar je eigen toestellen
//   { "init": true }                -> sleutels aanmaken (eenmalig)
// Geheimen: RESEND_API_KEY (zelfde als de andere mails)
// ============================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP_URL = "https://moveforpleasure.be/app/";
const PROFIEL_URL = "https://moveforpleasure.be/app/#profiel";
const CONTACT = "mailto:moveforpleasure@gmail.com";
const WEEKDAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

const antwoord = (tekst: string, status = 200) =>
  new Response(tekst, { status, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey" } });

function ontsnap(t: string) {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ===== Tijd in België =====
function nuBE() {
  const delen = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  const dagIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(delen.weekday);
  return { datum: `${delen.year}-${delen.month}-${delen.day}`, uur: Number(delen.hour), dag: WEEKDAGEN[dagIndex] };
}

// ===== Base64url =====
function b64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const tekstNaarB64url = (t: string) => b64url(new TextEncoder().encode(t));

// ===== VAPID-sleutels (eenmalig aanmaken, daarna uit de Vault) =====
let sleutels: { publiek: string; prive: CryptoKey } | null = null;
async function vapid() {
  if (sleutels) return sleutels;
  let { data: publiek } = await db.rpc("vapid_publiek");
  let { data: priveJwk } = await db.rpc("vapid_prive");
  if (!publiek || !priveJwk) {
    const paar = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const nieuwPubliek = b64url(new Uint8Array(await crypto.subtle.exportKey("raw", paar.publicKey)));
    const nieuwPrive = JSON.stringify(await crypto.subtle.exportKey("jwk", paar.privateKey));
    await db.rpc("vapid_bewaar", { publiek: nieuwPubliek, prive: nieuwPrive });
    ({ data: publiek } = await db.rpc("vapid_publiek")); // lees terug (bij gelijktijdig aanmaken wint er één)
    ({ data: priveJwk } = await db.rpc("vapid_prive"));
  }
  const prive = await crypto.subtle.importKey("jwk", JSON.parse(priveJwk), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  sleutels = { publiek, prive };
  return sleutels;
}

// Ondertekend "pasje" (JWT) waarmee de pushdienst weet dat het van ons komt
const pasjes = new Map<string, string>();
async function vapidPasje(endpoint: string) {
  const aud = new URL(endpoint).origin;
  if (pasjes.has(aud)) return pasjes.get(aud)!;
  const { prive } = await vapid();
  const kop = tekstNaarB64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const inhoud = tekstNaarB64url(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTACT }));
  const handtekening = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, prive, new TextEncoder().encode(`${kop}.${inhoud}`)));
  const pasje = `${kop}.${inhoud}.${b64url(handtekening)}`;
  pasjes.set(aud, pasje);
  return pasje;
}

// Leeg seintje naar één toestel. Geeft "ok", "weg" (toestel bestaat niet meer) of "fout".
async function stuurPush(endpoint: string): Promise<"ok" | "weg" | "fout"> {
  try {
    const { publiek } = await vapid();
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { TTL: "14400", Urgency: "normal", Authorization: `vapid t=${await vapidPasje(endpoint)}, k=${publiek}`, "Content-Length": "0" },
    });
    if (r.ok) return "ok";
    if (r.status === 404 || r.status === 410) return "weg";
    console.error("Push-fout", r.status, (await r.text()).slice(0, 200));
    return "fout";
  } catch (e) {
    console.error("Push-fout", String(e));
    return "fout";
  }
}

// Naar alle toestellen van een lid; verdwenen toestellen ruimen we op
async function pushNaarLid(userId: string) {
  const { data: toestellen } = await db.from("push_abonnementen").select("id, endpoint").eq("user_id", userId);
  let gelukt = 0;
  for (const t of toestellen ?? []) {
    const r = await stuurPush(t.endpoint);
    if (r === "ok") { gelukt++; await db.from("push_abonnementen").update({ laatst_ok: new Date().toISOString() }).eq("id", t.id); }
    if (r === "weg") await db.from("push_abonnementen").delete().eq("id", t.id);
  }
  return gelukt;
}

// ===== Mail (als er geen pushmelding aankwam) =====
type Plan = { sport?: string; minuten?: number | null; tijd?: string; notitie?: string };
function planTekst(p: Plan) {
  const wat = p.sport === "Anders" && p.notitie ? p.notitie : (p.sport || "Bewegen");
  return [wat, p.minuten ? `${p.minuten} min` : "", p.tijd || ""].filter(Boolean).join(" · ");
}

async function stuurMail(aan: string, naam: string, plannen: Plan[]): Promise<"ok" | "limiet" | "fout"> {
  const sleutel = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!sleutel) return "fout";
  const eerste = plannen[0]?.sport && plannen[0].sport !== "Anders" ? plannen[0].sport.toLowerCase() : "bewegen";
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f6f1f4;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:28px 16px;">
    <div style="background:#23152f;border-radius:16px;padding:26px;color:#eaeaea;">
      <div style="font-size:14px;font-weight:700;letter-spacing:0.5px;color:#ff7a3d;margin-bottom:12px;">MOVEFORPLEASURE</div>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 10px;color:#ffffff;">${naam ? `Hoi ${ontsnap(naam)}!` : "Hoi!"}<br><span style="color:#ff9a6b;">Vandaag op je planning</span></h1>
      <div style="background:#3a2847;border-left:4px solid #ff7a3d;border-radius:10px;padding:12px 14px;line-height:1.7;color:#ffffff;">${plannen.map((p) => ontsnap(planTekst(p))).join("<br>")}</div>
      <p style="margin:16px 0 0;color:#d9c6d2;line-height:1.5;">Zin? Ook een korter rondje telt. En lukt het vandaag niet, dan is dat ook oké. 🧡</p>
      <a href="${APP_URL}" style="display:inline-block;margin-top:20px;background:#ff7a3d;color:#23152f;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">Open de app</a>
    </div>
    <p style="font-size:12px;color:#8a7a85;text-align:center;margin-top:14px;line-height:1.5;">
      Je krijgt dit omdat je herinneringen aanzette in MoveForPleasure.<br>
      Liever niet, of op een ander uur? Pas het aan bij <a href="${PROFIEL_URL}" style="color:#8a7a85;">je profiel</a>.
    </p>
  </div></body></html>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${sleutel}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_AFZENDER") ?? "MoveForPleasure <meldingen@moveforpleasure.be>",
      to: [aan], subject: `🔔 Vandaag op je planning: ${eerste}`, html,
    }),
  });
  if (r.ok) return "ok";
  console.error("Resend-fout", r.status, (await r.text()).slice(0, 200));
  return r.status === 429 ? "limiet" : "fout";
}

// Weekplanning van één dag (ook het oude formaat: gewone tekst)
function plannenVan(schema: Record<string, unknown> | null, dag: string): Plan[] {
  const w = schema?.[dag];
  if (Array.isArray(w)) return w as Plan[];
  if (typeof w === "string" && w.trim()) return [{ sport: "Anders", notitie: w.trim() }];
  return [];
}

// ===== De ronde van elk uur =====
async function ronde() {
  const nu = nuBE();
  const telling: Record<string, number> = {};
  const tel = (s: string) => (telling[s] = (telling[s] ?? 0) + 1);

  // Wie wil op DIT uur een herinnering? (filter in de database, niet iedereen ophalen)
  const { data: profielen, error } = await db.from("gebruikersdata").select("user_id, waarde")
    .eq("sleutel", "profiel").eq("waarde->herinnering->>aan", "true").eq("waarde->herinnering->>uur", String(nu.uur));
  if (error) { console.error(error.message); return { fout: error.message }; }
  if (!profielen?.length) return { uur: nu.uur, niemand: true };

  const ids = profielen.map((p) => p.user_id);
  const { data: al } = await db.from("herinnering_verstuurd").select("user_id").eq("datum", nu.datum).in("user_id", ids);
  const gedaan = new Set((al ?? []).map((r) => r.user_id));
  const { data: rijen } = await db.from("gebruikersdata").select("user_id, sleutel, waarde")
    .in("user_id", ids).in("sleutel", ["schema", "workouts", "cardio"]);
  const per = new Map<string, Record<string, unknown>>();
  (rijen ?? []).forEach((r) => { if (!per.has(r.user_id)) per.set(r.user_id, {}); per.get(r.user_id)![r.sleutel] = r.waarde; });

  let mailLimiet = false;
  for (const p of profielen) {
    const lid = p.user_id;
    const profiel = p.waarde as { naam?: string; herinnering?: { mail?: boolean } };
    if (gedaan.has(lid)) { tel("al gehad"); continue; }
    const d = per.get(lid) ?? {};
    const plannen = plannenVan(d.schema as Record<string, unknown>, nu.dag);
    if (!plannen.length) { tel("niets gepland"); continue; }
    const bewogen = [...((d.workouts as { datum: string }[]) ?? []), ...((d.cardio as { datum: string }[]) ?? [])].some((i) => i?.datum === nu.datum);
    if (bewogen) { tel("al bewogen"); continue; }

    // Eén keer per dag: eerst "claimen"
    const { error: claimFout } = await db.from("herinnering_verstuurd").insert({ user_id: lid, datum: nu.datum });
    if (claimFout) { tel("al gehad"); continue; }

    if (await pushNaarLid(lid) > 0) {
      await db.from("herinnering_verstuurd").update({ kanaal: "push" }).eq("user_id", lid).eq("datum", nu.datum);
      tel("push");
      continue;
    }
    if (profiel.herinnering?.mail === false || mailLimiet) {
      await db.from("herinnering_verstuurd").delete().eq("user_id", lid).eq("datum", nu.datum);
      tel(mailLimiet ? "mail-limiet" : "geen kanaal");
      continue;
    }
    const { data: u } = await db.auth.admin.getUserById(lid);
    const email = u?.user?.email_confirmed_at ? u.user.email : null;
    const resultaat = email ? await stuurMail(email, profiel.naam ?? "", plannen) : "fout";
    if (resultaat === "ok") {
      await db.from("herinnering_verstuurd").update({ kanaal: "mail" }).eq("user_id", lid).eq("datum", nu.datum);
      tel("mail");
      await new Promise((k) => setTimeout(k, 600)); // max. ±2 mails per seconde
    } else {
      await db.from("herinnering_verstuurd").delete().eq("user_id", lid).eq("datum", nu.datum);
      if (resultaat === "limiet") mailLimiet = true;
      tel("mail mislukt");
    }
  }
  return { uur: nu.uur, ...telling };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return antwoord("ok");
  if (req.method !== "POST") return antwoord("alleen POST", 405);
  const body = await req.json().catch(() => ({}));

  // Eenmalig: sleutels aanmaken
  if (body.init) { await vapid(); return antwoord("sleutels klaar"); }

  // Testmelding naar je eigen toestellen (met je login)
  if (body.test) {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return antwoord("niet ingelogd", 401);
    const aantal = await pushNaarLid(u.user.id);
    return antwoord(JSON.stringify({ toestellen: aantal }));
  }

  const resultaat = await ronde();
  console.log("Herinneringen", JSON.stringify(resultaat));
  return antwoord(JSON.stringify(resultaat));
});
