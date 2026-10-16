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

// ---- récapitulatif illustré (cartes pastel par thème, faites en tableaux pour tous les logiciels de mail) ----
const RECAP: [string, string, string, string[]][] = [
  ["Ton voyage", "#e3f0fc", "#a9cdf2", ["Destination(s)", "Dates", "Durée", "Voyageurs", "Dates flexibles", "Parcours"]],
  ["Ton budget", "#fff3d6", "#ffd98a", ["Budget", "Vols", "Plafond vol", "Plafond nuit", "Réductions", "Budget flexible"]],
  ["Tes envies", "#fde3ea", "#f6a9b9", ["Rythme", "Centres d’intérêt", "Hébergements", "Incontournables", "Contraintes", "Format"]],
  ["À vérifier ensemble", "#dff5ea", "#8fd6b1", ["Visa / vaccins"]],
];
const LABEL: Record<string, string> = { "Destination(s)": "Destination", "Centres d’intérêt": "Centres d’intérêt" };
const frDate = (iso: string) => {
  const d = new Date(iso + "T12:00:00Z");
  return isNaN(+d) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};
function niceValue(k: string, v: string) {
  if (k === "Dates") return v.split("→").map((x) => frDate(x.trim())).join(" → ");
  if (v === "oui" && (k === "Dates flexibles" || k === "Budget flexible")) return "oui, on peut ajuster";
  if (k === "Visa / vaccins") { const n = v.match(/nationalité : (.+)$/); return "je vérifie les infos officielles pour toi" + (n && n[1].trim() !== "?" ? ` (nationalité ${n[1].trim()})` : ""); }
  return v;
}
function prettyRecap(details: Record<string, unknown> | null | undefined, summary: string) {
  const d = (details && typeof details === "object") ? details as Record<string, unknown> : {};
  const cards = RECAP.map(([title, soft, strong, keys]) => {
    const rows = keys.filter((k) => typeof d[k] === "string" && String(d[k]).trim()).map((k) =>
      `<tr><td style="padding:5px 10px 5px 0;font-size:12.5px;color:#6b6a8a;vertical-align:top;white-space:nowrap">${esc(LABEL[k] || k)}</td>
           <td style="padding:5px 0;font-size:14px;font-weight:600;color:#3b3a5e;vertical-align:top">${esc(niceValue(k, String(d[k])))}</td></tr>`).join("");
    if (!rows) return "";
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 12px;background:${soft};border:2px solid #3b3a5e;border-radius:16px;border-collapse:separate;box-shadow:3px 3px 0 ${strong}">
      <tr><td style="padding:12px 14px 4px"><span style="display:inline-block;background:#ffffff;border:2px solid #3b3a5e;border-radius:999px;padding:2px 12px;font-size:12px;font-weight:800;color:#3b3a5e">${esc(title)}</span></td></tr>
      <tr><td style="padding:4px 14px 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table></td></tr></table>`;
  }).join("");
  // ancienne demande sans détails : le texte tel quel
  return cards || `<div style="background:#fff3d6;border:2px dashed #3b3a5e;border-radius:14px;padding:12px 14px;font-size:13.5px;line-height:1.6;white-space:pre-wrap">${esc(summary)}</div>`;
}
const priceBox = (label: string, price: string) =>
  `<p style="text-align:center;font-size:13px;color:#6b6a8a;margin:18px 0 6px">${esc(label)}</p><div style="text-align:center;margin:0 0 16px"><span style="display:inline-block;background:#fff3d6;border:2.5px solid #3b3a5e;border-radius:16px;box-shadow:3px 3px 0 #8fd6b1;padding:10px 20px;font-size:20px;font-weight:800;color:#3b3a5e">${esc(price)}</span></div>`;
// les étapes en pastilles numérotées
const steps = (list: string[], done = 0) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 4px">${list.map((s, i) =>
  `<tr><td width="40" style="padding:5px 0;vertical-align:middle"><div style="width:30px;height:30px;line-height:30px;text-align:center;border:2px solid #3b3a5e;border-radius:50%;font-weight:800;font-size:14px;background:${i < done ? "#8fd6b1" : ["#fde3ea", "#e3f0fc", "#fff3d6", "#efe9fc"][i % 4]};color:#3b3a5e">${i < done ? "✓" : i + 1}</div></td>
   <td style="padding:5px 0;font-size:14px;color:#3b3a5e;vertical-align:middle">${s}</td></tr>`).join("")}</table>`;
const button = (href: string, label: string, dark = true) =>
  `<a href="${href}" style="display:inline-block;margin:4px;background:${dark ? "#3b3a5e" : "#ffffff"};color:${dark ? "#ffffff" : "#3b3a5e"};border:2.5px solid #3b3a5e;text-decoration:none;font-weight:700;border-radius:14px;padding:11px 20px;font-size:14px">${label}</a>`;

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
          `${!waitlist && r.estimate ? priceBox("Estimation", String(r.estimate)) : ""}
           <p style="font-size:13px;color:#6b6a8a;margin:0 0 8px">Ce que tu m’as envoyé :</p>${prettyRecap(r.details as Record<string, unknown>, summary)}
           ${waitlist ? "" : steps(["Tu m’as envoyé ta demande", "Je la lis et je te confirme le prix (sous 48 h)", "Tu valides, et je prépare tout", "Tout arrive dans ton app : réservations, jours, carte"], 1)}
           <p style="font-size:13px;color:#6b6a8a;margin:16px 0 0;text-align:center">Une précision à ajouter ? Réponds simplement à ce mail.</p>`,
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
