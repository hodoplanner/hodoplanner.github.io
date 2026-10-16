// HodoPlanner · mails envoyés par Erika depuis l'app (validation + code, précisions, rappel du code, message libre).
// Appelée par l'app avec la session d'Erika : la fonction vérifie qu'elle est bien admin,
// relit la demande dans la base (l'adresse du voyageur vient de là, pas de l'app),
// envoie le mail depuis contact@hodoplanner.com (copie à Erika) et note l'envoi sur la demande.
//
// Utilise les mêmes secrets que notify-request (SMTP_PASSWORD, et facultatifs SMTP_USER,
// NOTIFY_EMAIL, SMTP_HOST, SMTP_PORT). Laisser « Verify JWT » activé pour cette fonction.
import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const USER = env("SMTP_USER", "contact@hodoplanner.com");
const NOTIFY = env("NOTIFY_EMAIL", USER);
const SITE = "https://hodoplanner.com";
const KINDS = ["valide", "precisions", "code", "libre"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const transport = nodemailer.createTransport({
  host: env("SMTP_HOST", "mail.infomaniak.com"),
  port: Number(env("SMTP_PORT", "465")),
  secure: true,
  auth: { user: USER, pass: env("SMTP_PASSWORD") },
});

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const emailOk = (e: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e) && e.length <= 200;
// liens cliquables dans le texte (déjà échappé)
const linkify = (h: string) => h.replace(/https:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" style="color:#3b3a5e;font-weight:700">${u}</a>`);
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

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

// Le même cadre que les autres mails (lapin, contour marine, ombre rose)
function frame(body: string) {
  return `<div style="margin:0;padding:24px 12px;background:#fdf8f2;font-family:Poppins,Helvetica,Arial,sans-serif;color:#3b3a5e">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:2.5px solid #3b3a5e;border-radius:20px;box-shadow:4px 4px 0 #f6a9b9;padding:24px">
    <div style="text-align:center"><img src="${SITE}/images/brand/lapin-app-192.png" width="64" height="64" alt="" style="border-radius:16px" /></div>
    ${body}
  </div>
  <p style="text-align:center;font-size:12px;color:#9a99b4;margin-top:14px">HodoPlanner · by Erika · <a href="${SITE}" style="color:#9a99b4">hodoplanner.com</a> · <a href="${SITE}/conditions.html" style="color:#9a99b4">conditions</a></p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405);

  // client Supabase « au nom d'Erika » : la base applique ses droits (RLS)
  const auth = req.headers.get("Authorization") ?? "";
  const key = req.headers.get("apikey") ?? env("SUPABASE_ANON_KEY");
  const sb = createClient(env("SUPABASE_URL"), key, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: admin } = await sb.rpc("is_admin");
  if (admin !== true) return json({ error: "Réservé à Erika." }, 403);

  let q: { request_id?: string; kind?: string; subject?: string; price?: string; message?: string };
  try { q = await req.json(); } catch { return json({ error: "JSON attendu" }, 400); }
  const kind = KINDS.includes(String(q.kind)) ? String(q.kind) : "libre";
  const subject = String(q.subject ?? "").trim().slice(0, 150);
  const message = String(q.message ?? "").trim().slice(0, 4000);
  const price = String(q.price ?? "").trim().slice(0, 100);
  if (!q.request_id || !subject || !message) return json({ error: "Objet et message obligatoires." }, 400);

  const { data: r, error } = await sb.from("requests").select("*").eq("id", q.request_id).maybeSingle();
  if (error || !r) return json({ error: "Demande introuvable." }, 404);
  const to = String(r.email ?? "").trim();
  if (!emailOk(to)) return json({ error: "L’adresse mail de la demande n’est pas valide." }, 400);

  // le message d'Erika : première ligne en titre, le reste en paragraphes
  // et la signature (« À très vite, Erika ») tout en bas, après le prix, le récap et les étapes
  const [hello, ...rest] = message.split("\n");
  const paras = rest.join("\n").trim().split(/\n\s*\n/);
  const sign = paras.length > 1 && paras[paras.length - 1].length <= 60 ? paras.pop()! : "";
  let body = `<h2 style="font-size:21px;margin:14px 0 8px;text-align:center;color:#3b3a5e">${esc(hello)}</h2>
    <div style="font-size:15px;line-height:1.6;white-space:pre-wrap;color:#3b3a5e">${linkify(esc(paras.join("\n\n")))}</div>`;
  const reply = (sub: string, txt: string) => `mailto:${USER}?subject=${encodeURIComponent("Re: " + subject + " · " + sub)}&body=${encodeURIComponent(txt)}`;
  const code = String((r.details ?? {}).trip_code ?? "");
  const free = /offert/i.test(price || String(r.estimate ?? ""));
  const codeBox = code ? `<div style="text-align:center;margin:18px 0 0"><p style="font-size:13px;color:#6b6a8a;margin:0 0 6px">Ton code de voyage</p><span style="display:inline-block;background:#dff5ea;border:2.5px dashed #3b3a5e;border-radius:14px;padding:10px 18px;font-size:22px;font-weight:800;letter-spacing:1px;color:#3b3a5e">${esc(code)}</span></div>` : "";
  const appSteps = [`Ouvre <a href="${SITE}/app/" style="color:#3b3a5e;font-weight:700">hodoplanner.com/app</a> et connecte-toi avec ${esc(to)}`, "Entre ton code de voyage"];
  if ((kind === "valide" || kind === "precisions") && price) body += priceBox(kind === "valide" ? (free ? "Ton voyage" : "Prix confirmé") : "Nouveau prix proposé", price);
  if (kind === "valide") {
    body += codeBox;
    body += steps(["Ta demande est validée", ...appSteps, free ? "Relis ton brief et valide-le" : "Relis ton brief, valide-le et règle le paiement",
      "Je prépare tout, et ça arrive au fur et à mesure dans ton app"], 1);
    body += `<p style="text-align:center;margin:18px 0 0">${button(SITE + "/app/", free ? "Valider mon brief" : "Valider et payer")}</p>`;
  }
  if (kind === "precisions") {
    body += `<p style="text-align:center;margin:16px 0 0">${button(reply("mes réponses", ""), "Répondre à tes questions")}</p>`;
  }
  if (kind === "code") {
    body += codeBox;
    body += steps([...appSteps, "Installe l’app sur ton téléphone pour l’avoir toujours sous la main"]);
    body += `<p style="text-align:center;margin:18px 0 0">${button(SITE + "/app/", "Ouvrir mon voyage")}</p>`;
  }

  if (sign) body += `<p style="font-size:15px;line-height:1.6;white-space:pre-wrap;color:#3b3a5e;margin:20px 0 0">${esc(sign)}</p>`;

  try {
    await transport.sendMail({ from: `Erika · HodoPlanner <${USER}>`, to, bcc: NOTIFY, replyTo: USER, subject, html: frame(body), text: message });
  } catch (e) {
    return json({ error: "Le mail n’est pas parti : " + (e as Error).message }, 502);
  }

  // on note l'envoi sur la demande
  const details = (r.details && typeof r.details === "object") ? r.details : {};
  const sent = { ...(details.sent ?? {}), [kind]: new Date().toISOString() };
  const fields: Record<string, unknown> = { details: { ...details, sent, ...(price && kind !== "code" && kind !== "libre" ? { quote_price: price } : {}) } };
  if (r.status === "nouveau") fields.status = "répondu";
  await sb.from("requests").update(fields).eq("id", r.id);

  return json({ ok: true, to });
});
