// HodoPlanner · mails envoyés à chaque nouvelle demande (devis ou liste d'attente).
// Déclenchée par un « Database Webhook » Supabase sur l'ajout d'une ligne dans public.requests.
// Envoie :
//   1. au voyageur : « J'ai bien reçu ta demande » + le récapitulatif ;
//   2. à Erika : « Nouvelle demande » + le détail (répondre = répondre au voyageur).
//
// Secrets à créer dans Supabase → Edge Functions → Secrets :
//   SMTP_PASSWORD   le mot de passe de la boîte contact@hodoplanner.com
//   WEBHOOK_SECRET  un mot de passe inventé, aussi mis dans l'en-tête du webhook (x-hodo-secret)
// Facultatifs : SMTP_USER (défaut contact@hodoplanner.com), NOTIFY_EMAIL (où Erika reçoit les alertes,
// défaut : la même adresse), SMTP_HOST (défaut mail.infomaniak.com), SMTP_PORT (défaut 465).
import nodemailer from "npm:nodemailer@6.9.14";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const USER = env("SMTP_USER", "contact@hodoplanner.com");
const NOTIFY = env("NOTIFY_EMAIL", USER);
const SITE = "https://hodoplanner.com";

const transport = nodemailer.createTransport({
  host: env("SMTP_HOST", "mail.infomaniak.com"),
  port: Number(env("SMTP_PORT", "465")),
  secure: true,
  auth: { user: USER, pass: env("SMTP_PASSWORD") },
});

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const emailOk = (e: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e) && e.length <= 200;

// Le même cadre que les mails de connexion (lapin, contour marine, ombre rose)
function frame(title: string, intro: string, body: string) {
  return `<div style="margin:0;padding:24px 12px;background:#fdf8f2;font-family:Poppins,Helvetica,Arial,sans-serif;color:#3b3a5e">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:2.5px solid #3b3a5e;border-radius:20px;box-shadow:4px 4px 0 #f6a9b9;padding:24px">
    <div style="text-align:center"><img src="${SITE}/images/brand/lapin-app-192.png" width="64" height="64" alt="" style="border-radius:16px" /></div>
    <h2 style="font-size:21px;margin:14px 0 6px;text-align:center">${title}</h2>
    <p style="font-size:15px;line-height:1.55;color:#6b6a8a;margin:0 0 16px;text-align:center">${intro}</p>
    ${body}
  </div>
  <p style="text-align:center;font-size:12px;color:#9a99b4;margin-top:14px">HodoPlanner · by Erika · hodoplanner.com</p>
</div>`;
}
const recap = (summary: string) =>
  `<div style="background:#fff3d6;border:2px dashed #3b3a5e;border-radius:14px;padding:12px 14px;font-size:13.5px;line-height:1.6;white-space:pre-wrap">${esc(summary)}</div>`;

Deno.serve(async (req) => {
  // seul le webhook (qui connaît le secret) peut déclencher l'envoi
  if (!env("WEBHOOK_SECRET") || req.headers.get("x-hodo-secret") !== env("WEBHOOK_SECRET")) {
    return new Response("interdit", { status: 401 });
  }
  let payload: { type?: string; table?: string; record?: Record<string, unknown> };
  try { payload = await req.json(); } catch { return new Response("JSON attendu", { status: 400 }); }
  const r = payload.record;
  if (payload.type !== "INSERT" || payload.table !== "requests" || !r) return new Response("ignoré", { status: 200 });

  const firstname = String(r.firstname ?? "").slice(0, 100);
  const email = String(r.email ?? "").trim();
  const dest = String(r.destinations ?? "").slice(0, 300);
  const summary = String(r.summary ?? "").slice(0, 8000);
  const waitlist = r.kind === "attente";
  const results: string[] = [];

  // 1. au voyageur
  if (emailOk(email)) {
    try {
      await transport.sendMail({
        from: `HodoPlanner <${USER}>`,
        to: email,
        replyTo: USER,
        subject: waitlist ? "C’est noté : je te préviens à l’ouverture" : `J’ai bien reçu ta demande${dest ? " · " + dest : ""}`,
        html: frame(
          `Merci${firstname ? " " + esc(firstname) : ""} !`,
          waitlist
            ? "Ton inscription est bien enregistrée. Je t’écris dès l’ouverture, avec ton voyage en tête."
            : "J’ai bien reçu ta demande. Je la lis avec attention et je te réponds sous 48 h.",
          `<p style="font-size:13px;color:#6b6a8a;margin:0 0 6px">Ce que tu m’as envoyé :</p>${recap(summary)}
           <p style="font-size:13px;color:#6b6a8a;margin:16px 0 0">Une précision à ajouter ? Réponds simplement à ce mail.</p>`,
        ),
      });
      results.push("voyageur ok");
    } catch (e) { results.push("voyageur : " + (e as Error).message); }
  }

  // 2. à Erika
  try {
    await transport.sendMail({
      from: `HodoPlanner <${USER}>`,
      to: NOTIFY,
      replyTo: emailOk(email) ? email : undefined,
      subject: `Nouvelle ${waitlist ? "inscription" : "demande"} : ${firstname || "?"} · ${dest || "?"}`,
      html: frame(
        `Nouvelle ${waitlist ? "inscription" : "demande"}`,
        `${esc(firstname || "Quelqu’un")} · ${esc(dest)}${r.estimate ? " · " + esc(r.estimate) : ""}`,
        `${recap(summary)}
         <p style="text-align:center;margin:18px 0 0"><a href="${SITE}/app/" style="display:inline-block;background:#3b3a5e;color:#ffffff;text-decoration:none;font-weight:700;border-radius:14px;padding:12px 22px">Ouvrir mes demandes</a></p>
         <p style="font-size:12px;color:#9a99b4;margin:12px 0 0;text-align:center">Répondre à ce mail écrit directement à ${esc(email)}.</p>`,
      ),
    });
    results.push("Erika ok");
  } catch (e) { results.push("Erika : " + (e as Error).message); }

  return new Response(JSON.stringify(results), { status: 200, headers: { "content-type": "application/json" } });
});
