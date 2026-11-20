// ============================================================
// Edge Function "chat-melding": stuurt een e-mail bij een nieuw chatbericht
//
// - Lid stuurt bericht  -> mail naar de admin(s)
// - Admin antwoordt     -> mail naar het lid
//
// De database roept deze functie aan (trigger op chatberichten) met
// alleen het id van het bericht. De functie zoekt het bericht zelf op
// en verwerkt het maar één keer (kolom "gemeld"), en alleen als het
// minder dan 5 minuten oud is. Zo kan niemand er misbruik van maken.
//
// Om niet te spammen: stuurde dezelfde persoon minder dan 15 minuten
// geleden al een bericht dat nog niet gelezen is, dan sturen we geen
// nieuwe mail (de vorige mail volstaat).
//
// Geheimen (in Supabase > Edge Functions > Secrets, NIET in de code):
//   RESEND_API_KEY   sleutel van resend.com
//   MAIL_AFZENDER    optioneel, standaard "MoveForPleasure <meldingen@moveforpleasure.be>"
// ============================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP_URL = "https://moveforpleasure.be/app/#chat";
const ADMIN_URL = "https://moveforpleasure.be/admin.html";

const antwoord = (tekst: string, status = 200) => new Response(tekst, { status });

function ontsnap(t: string) {
  return t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function mailHtml(titel: string, intro: string, bericht: string, knopTekst: string, knopUrl: string) {
  const kort = bericht.length > 400 ? bericht.slice(0, 400) + "…" : bericht;
  return `<!DOCTYPE html><html><body style="margin:0;background:#f6f1f4;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:28px 16px;">
    <div style="background:#23152f;border-radius:16px;padding:26px;color:#eaeaea;">
      <div style="font-size:20px;font-weight:700;color:#ff7a3d;margin-bottom:14px;">MoveForPleasure</div>
      <h1 style="font-size:19px;margin:0 0 8px;color:#ffffff;">${ontsnap(titel)}</h1>
      <p style="margin:0 0 16px;color:#d9c6d2;line-height:1.5;">${ontsnap(intro)}</p>
      <div style="background:#3a2847;border-left:4px solid #ff7a3d;border-radius:10px;padding:12px 14px;white-space:pre-wrap;line-height:1.5;color:#ffffff;">${ontsnap(kort)}</div>
      <a href="${knopUrl}" style="display:inline-block;margin-top:20px;background:#ff7a3d;color:#23152f;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">${ontsnap(knopTekst)}</a>
    </div>
    <p style="font-size:12px;color:#8a7a85;text-align:center;margin-top:14px;line-height:1.5;">
      Je krijgt deze mail omdat er een nieuw bericht is in je chat met MoveForPleasure.<br>
      Antwoorden op deze mail komt niet aan: antwoord via de chat. 🧡
    </p>
  </div></body></html>`;
}

async function stuurMail(aan: string[], onderwerp: string, html: string) {
  const sleutel = Deno.env.get("RESEND_API_KEY");
  if (!sleutel) {
    console.log("Geen RESEND_API_KEY ingesteld: mail niet verstuurd naar", aan.length, "ontvanger(s)");
    return false;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${sleutel}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_AFZENDER") ?? "MoveForPleasure <meldingen@moveforpleasure.be>",
      to: aan,
      subject: onderwerp,
      html,
    }),
  });
  if (!r.ok) console.error("Resend-fout", r.status, await r.text());
  return r.ok;
}

async function emailVan(userId: string) {
  const { data } = await db.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return antwoord("alleen POST", 405);
  const { id } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) return antwoord("ongeldig id", 400);

  // Bericht één keer "claimen": alleen als het nieuw is en nog niet gemeld
  const vijfMinGeleden = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: b, error } = await db.from("chatberichten")
    .update({ gemeld: true })
    .eq("id", id).eq("gemeld", false).gt("aangemaakt", vijfMinGeleden)
    .select("id, gebruiker_id, van_admin, tekst")
    .maybeSingle();
  if (error) { console.error(error.message); return antwoord("fout", 500); }
  if (!b) return antwoord("niets te doen");

  // Vorige bericht in dezelfde richting: recent én ongelezen? Dan geen extra mail.
  const { data: vorige } = await db.from("chatberichten")
    .select("aangemaakt, gelezen")
    .eq("gebruiker_id", b.gebruiker_id).eq("van_admin", b.van_admin).lt("id", b.id)
    .order("id", { ascending: false }).limit(1).maybeSingle();
  if (vorige && !vorige.gelezen && Date.now() - new Date(vorige.aangemaakt).getTime() < 15 * 60_000) {
    return antwoord("recent al gemeld");
  }

  if (b.van_admin) {
    // Admin antwoordde -> mail naar het lid
    const email = await emailVan(b.gebruiker_id);
    if (!email) return antwoord("lid zonder e-mail");
    const ok = await stuurMail([email], "💬 Je hebt een antwoord van MoveForPleasure",
      mailHtml("Je hebt een nieuw bericht! 🧡", "Het MoveForPleasure-team antwoordde in je chat:", b.tekst, "Open de chat", APP_URL));
    return antwoord(ok ? "mail naar lid" : "mail niet verstuurd");
  }

  // Lid stuurde een bericht -> mail naar alle admins (behalve de afzender zelf)
  const { data: admins } = await db.from("admins").select("user_id");
  const ontvangers = (await Promise.all((admins ?? [])
    .filter((a) => a.user_id !== b.gebruiker_id)
    .map((a) => emailVan(a.user_id)))).filter((e): e is string => Boolean(e));
  if (!ontvangers.length) return antwoord("geen admins");

  const { data: profiel } = await db.from("gebruikersdata").select("waarde")
    .eq("user_id", b.gebruiker_id).eq("sleutel", "profiel").maybeSingle();
  const lidEmail = await emailVan(b.gebruiker_id);
  const naam = (profiel?.waarde as { naam?: string } | null)?.naam || lidEmail || "Een lid";
  const ok = await stuurMail(ontvangers, `💬 Nieuw chatbericht van ${naam}`,
    mailHtml(`Nieuw bericht van ${naam}`, `${lidEmail ?? ""} stuurde je een bericht in de app:`, b.tekst, "Antwoorden op de adminpagina", ADMIN_URL));
  return antwoord(ok ? "mail naar admin" : "mail niet verstuurd");
});
