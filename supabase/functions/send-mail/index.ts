// HodoPlanner · mails envoyés par Erika depuis l'app (validation, précisions, code de l'app, message libre).
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

  let body = `<div style="font-size:15px;line-height:1.6;white-space:pre-wrap;margin-top:14px">${linkify(esc(message))}</div>`;
  if ((kind === "valide" || kind === "precisions") && price) {
    body += `<p style="text-align:center;font-size:13px;color:#6b6a8a;margin:18px 0 6px">${kind === "valide" ? "Prix confirmé" : "Nouveau prix proposé"}</p><div style="text-align:center;margin:0 0 6px"><span style="display:inline-block;background:#fff3d6;border:2.5px solid #3b3a5e;border-radius:16px;box-shadow:3px 3px 0 #b8e3d0;padding:10px 20px;font-size:20px;font-weight:800">${esc(price)}</span></div>`;
  }
  if (kind === "valide") {
    body += `<p style="font-size:13px;color:#6b6a8a;margin:18px 0 6px">Ta demande :</p><div style="background:#fff3d6;border:2px dashed #3b3a5e;border-radius:14px;padding:12px 14px;font-size:13.5px;line-height:1.6;white-space:pre-wrap">${esc(String(r.summary ?? "").slice(0, 8000))}</div>`;
  }
  if (kind === "code") {
    body += `<p style="text-align:center;margin:20px 0 0"><a href="${SITE}/app/" style="display:inline-block;background:#3b3a5e;color:#ffffff;text-decoration:none;font-weight:700;border-radius:14px;padding:12px 22px">Ouvrir mon voyage</a></p>`;
  }

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
