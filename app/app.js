/* HodoPlanner · l'app (voyageurs + vue d'Erika). Les données passent par HodoApi (api.js). */
(() => {
  "use strict";
  const api = window.HodoApi;
  const cfg = window.HODO_CONFIG || {};
  const $phone = document.getElementById("phone");
  const icon = (n, s = 32) => (window.HodoIcons ? HodoIcons.icon(n, s) : "");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nl = (v) => esc(v).replace(/\n/g, "<br>");
  const fmtDate = (iso, opt = { day: "numeric", month: "short" }) => iso ? new Date(iso + "T12:00").toLocaleDateString("fr-FR", opt) : "";
  const TODAY = new Date(); TODAY.setHours(12, 0, 0, 0);
  const daysUntil = (iso) => Math.round((new Date(iso + "T12:00") - TODAY) / 86400000);
  const gmaps = (s) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : s.name)}`;
  const COLORS = ["mint", "blue", "pink", "yellow", "lav"];
  const soft = (c) => `var(--${COLORS.includes(c) ? c : "mint"}-soft)`;
  const PENDING = "hodo-pending-code";
  const tripIcon = (t, size = 20) => icon(window.HodoIcons && HodoIcons.has(t.emoji) ? t.emoji : "bunny", size);

  const S = { screen: "loading", session: null, profile: null, trips: [], tripId: null, data: null, view: "traveler",
    tab: "home", filter: "todo", day: null, me: false, adminTab: "items", unsub: null, email: "" };
  const isAdmin = () => !!(S.profile && S.profile.is_admin);

  // ---------- icônes de la barre d'onglets ----------
  const SV = 'stroke="#3b3a5e" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
  const TAB_ICONS = {
    home: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 15 16 6l10 9" fill="none" ${SV}/><path d="M8.5 13.5V26h15V13.5" fill="#fde3ea" ${SV}/><rect x="13.5" y="18" width="5" height="8" rx="1.2" fill="#f6a9b9" ${SV}/><circle cx="23" cy="8" r="2.2" fill="#ffd98a" ${SV}/></svg>`,
    book: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="6" width="18" height="21" rx="3" fill="#fff3d6" ${SV}/><rect x="11.5" y="4" width="9" height="5" rx="1.5" fill="#f6a9b9" ${SV}/><path d="m10.5 14 2 2 3.5-3.5M10.5 21l2 2 3.5-3.5" fill="none" ${SV}/><path d="M18.5 15h3.5M18.5 22h3.5" ${SV}/></svg>`,
    days: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="7" width="22" height="20" rx="3.5" fill="#fff" ${SV}/><path d="M5 10.5a3.5 3.5 0 0 1 3.5-3.5h15a3.5 3.5 0 0 1 3.5 3.5V13H5z" fill="#a9cdf2" ${SV}/><path d="M11 5v4M21 5v4" ${SV}/><circle cx="11" cy="18" r="1.5" fill="#3b3a5e"/><circle cx="16" cy="18" r="1.5" fill="#3b3a5e"/><rect x="19" y="20" width="5" height="4.5" rx="1.2" fill="#f6a9b9" ${SV}/><circle cx="11" cy="23" r="1.5" fill="#3b3a5e"/></svg>`,
    map: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m5 9 7-3 8 3 7-3v18l-7 3-8-3-7 3z" fill="#dff5ea" ${SV}/><path d="M12 6v18M20 9v18" fill="none" ${SV}/><path d="M22 11c-2.2 0-3.6 1.6-3.6 3.5 0 2.6 3.6 6 3.6 6s3.6-3.4 3.6-6c0-1.9-1.4-3.5-3.6-3.5z" fill="#ec5866" ${SV}/><circle cx="22" cy="14.5" r="1.2" fill="#fff"/></svg>`,
    info: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 11c0-3 3-5 7-5s7 2 7 5v13a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3z" fill="#c9b9f2" ${SV}/><rect x="11.5" y="17" width="9" height="7" rx="2" fill="#efe9fc" ${SV}/><path d="M13 6.5c0-2 1.3-3 3-3s3 1 3 3" fill="none" ${SV}/><path d="M16 19v3M14.5 20.5h3" ${SV}/></svg>`,
  };
  const TYPES = {
    flight: { label: "Vol", icon: "ticket" }, hotel: { label: "Hébergement", icon: "house" }, activity: { label: "Activité", icon: "star" },
    transport: { label: "Transport", icon: "train" }, food: { label: "Restaurant / café", icon: "cup" }, admin: { label: "À préparer", icon: "gem" },
  };
  const STATUS = { brief: ["brief à valider", "p-blue"], validated: ["à payer", "p-pink"], paid: ["payé", "p-yellow"], in_progress: ["recherches en cours", "p-yellow"], delivered: ["livré", "p-mint"], done: ["terminé", "p-lav"] };

  // ---------- données du voyage ouvert ----------
  const prog = (itemId) => (S.data?.progress || []).find((p) => p.item_id === itemId) || null;
  const isDone = (it) => !!(prog(it.id) || {}).done;
  const stats = () => { const items = S.data.items, done = items.filter(isDone).length; return { done, total: items.length, pct: Math.round((done / Math.max(1, items.length)) * 100) }; };
  function deadlineOf(it) {
    if (it.rule && window.HodoRules && it.date) {
      const r = HodoRules.compute(it.rule, it.date);
      if (r) return { iso: r.opens.toISOString().slice(0, 10), opens: r.opens, rule: r.rule };
    }
    return it.deadline ? { iso: it.deadline } : null;
  }
  const byDeadline = (a, b) => ((deadlineOf(a) || {}).iso || "9").localeCompare((deadlineOf(b) || {}).iso || "9");
  function deadlinePill(it) {
    if (isDone(it)) return `<span class="pill p-mint">réservé</span>`;
    const dl = deadlineOf(it);
    if (!dl) return `<span class="pill p-yellow">à faire</span>`;
    const d = daysUntil(dl.iso);
    // dl.rule : le lieu n'accepte les réservations qu'à partir d'une date (calculée par HodoReminder)
    const txt = dl.rule ? (d <= 0 ? `<i class="pic" data-picto="bell"></i> réservable maintenant` : `<i class="pic" data-picto="bell"></i> réservable dès le ${fmtDate(dl.iso)}`) : (d < 0 ? "en retard" : `avant le ${fmtDate(dl.iso)}`);
    return `<span class="pill ${it.urgent || d <= 30 ? "p-pink" : "p-yellow"}">${txt}</span>`;
  }
  const itemRow = (it, attr = "data-open") => `
    <button type="button" class="item ${isDone(it) ? "done" : ""}" ${attr}="${it.id}" style="${it.urgent && !isDone(it) ? "--sh:var(--red)" : ""}">
      <span class="ic">${icon(TYPES[it.type]?.icon || "star", 30)}</span>
      <span class="tx"><b>${esc(it.title)}</b><small>${it.date ? fmtDate(it.date, { weekday: "short", day: "numeric", month: "short" }) + " · " : ""}${esc(it.where_label || "")}</small>
        <span style="display:inline-block;margin-top:4px">${deadlinePill(it)}</span></span>
      <span class="tick">${isDone(it) ? "✓" : ""}</span>
    </button>`;

  // =================== écrans ===================
  const SCREENS = {
    loading: () => `<div class="loading">${icon("bunny", 80)}</div>`,

    welcome: () => `
      <div class="screen center">
        <img src="../images/brand/lapin-carte.svg" alt="" width="140" height="140" />
        <div><span class="jp" style="font-size:16px;letter-spacing:.3em">旅の計画</span></div>
        <h1 class="big">HodoPlanner</h1>
        <p class="sub" style="max-width:280px">Ton voyage sur mesure, préparé par Erika, toujours dans ta poche.</p>
        <div class="stack" style="width:100%;max-width:310px;margin-top:8px">
          <button class="btn dark block" data-go="login" data-withcode="1"><i class="pic" data-picto="backpack"></i> J’ai un voyage avec Erika</button>
          <a class="btn block" href="../devis.html"><i class="pic" data-picto="plane"></i> Je prépare un voyage</a>
        </div>
        <p class="small">Déjà inscrit·e ? <button class="linklike" data-go="login">Me connecter</button></p>
        ${installBox()}
      </div>`,

    login: () => `
      <div class="app-top"><button class="icon-btn" data-go="welcome" aria-label="Retour">←</button><div><b>${S.withCode ? "Mon voyage" : "Me connecter"}</b><small>sans mot de passe</small></div></div>
      <div class="screen"><form id="loginForm">
        ${S.withCode ? `<p class="sub">Entre le code qu’Erika t’a envoyé, puis ton email : tu recevras un lien pour te connecter.</p>
          <div class="field"><label for="c">Code du voyage</label><input id="c" name="code" class="code-in" placeholder="HODO-XXXXXX" autocomplete="off" required /></div>`
          : `<p class="sub">Indique ton email : tu recevras un lien pour te connecter.</p>`}
        <div class="field"><label for="m">Ton email</label><input id="m" name="email" type="email" placeholder="toi@exemple.com" autocomplete="email" required value="${esc(S.email)}" /></div>
        <p class="err hidden" id="err"></p>
        <button class="btn dark block" type="submit">Recevoir mon lien</button>
      </form></div>`,

    check: () => `
      <div class="app-top"><button class="icon-btn" data-go="login" aria-label="Retour">←</button><div><b>Regarde tes mails</b><small>${esc(S.email)}</small></div></div>
      <div class="screen"><form id="codeForm">
        <div style="text-align:center">${icon("bunnypaws", 110)}</div>
        <p class="sub" style="text-align:center">Je t’ai envoyé un mail avec un <b>code à 6 chiffres</b>. Tape-le ici : tu restes connecté·e dans l’app.</p>
        <div class="field"><label for="t">Code reçu par mail</label><input id="t" name="token" inputmode="numeric" autocomplete="one-time-code" class="code-in" placeholder="123456" maxlength="10" autofocus /></div>
        <p class="err hidden" id="err"></p>
        <button class="btn dark block" type="submit">Valider le code</button>
        <p class="small" style="text-align:center">Rien reçu ? Regarde dans les spams, ou <button type="button" class="linklike" data-action="resend">renvoie le mail</button>.</p>
        <p class="small" style="text-align:center">Le bouton du mail marche aussi, mais il ouvre parfois un autre navigateur (celui de Gmail, par exemple) : c’est alors lui qui est connecté, pas cette app.</p>
      </form></div>`,

    trips: () => `
      <div class="app-top"><span>${icon("bunny", 36)}</span><div><b>Mes voyages</b><small>${esc(S.profile?.email || "")}</small></div><span class="sp"></span><button class="btn small" data-action="logout">Quitter</button></div>
      <div class="screen">
        ${S.trips.length ? S.trips.map((t) => `<button class="card trip-card" data-trip="${t.id}" style="--sh:var(--pink)">
            <div class="row" style="justify-content:space-between"><b style="font-size:17px">${tripIcon(t, 24)} ${esc(t.title)}</b><span class="pill strong">${esc((t.travelers || []).join(" & "))}</span></div>
            <small class="small">${t.start_date ? `${fmtDate(t.start_date, { day: "numeric", month: "long" })} → ${fmtDate(t.end_date, { day: "numeric", month: "long", year: "numeric" })}` : "dates à venir"}</small></button>`).join("")
          : `<p class="sub">Aucun voyage pour l’instant.</p>`}
        <div class="sec-t"><h2>Ajouter un voyage</h2></div>
        <form id="joinForm" class="card" style="--sh:var(--yellow)">
          <div class="field"><label for="jc">Code reçu d’Erika</label><input id="jc" name="code" class="code-in" placeholder="HODO-XXXXXX" required /></div>
          <p class="err hidden" id="err"></p>
          <button class="btn dark" type="submit">Rejoindre</button>
        </form>
      </div>`,

    trip: () => {
      const t = S.data.trip;
      let body;
      if (S.me) body = tabMe(t);
      else if (S.tab === "days" && S.day !== null) body = dayDetail(S.day);
      else body = { home: tabHome, book: tabBook, days: tabDays, map: tabMap, info: tabInfo }[S.tab]();
      const flush = S.tab === "map" && !S.me;
      return `
        <div class="app-top">${S.trips.length > 1 || isAdmin() ? `<button class="icon-btn" data-action="back" aria-label="Mes voyages">←</button>` : `<span>${icon("bunny", 36)}</span>`}
          <div style="min-width:0"><b>${esc(t.title)} ${tripIcon(t)}</b><small>${t.start_date ? `${fmtDate(t.start_date, { day: "numeric", month: "long" })} → ${fmtDate(t.end_date, { day: "numeric", month: "long", year: "numeric" })}` : ""}</small></div><span class="sp"></span>
          ${isAdmin() ? `<button class="btn small" data-action="toAdmin" title="Vue Erika"><i class="pic" data-picto="bunny"></i> Erika</button>` : ""}
          <button class="icon-btn" data-action="me" aria-label="Mon compte" style="${S.me ? "background:var(--yellow)" : ""}">${icon("bunnypaws", 30)}</button></div>
        <div class="screen ${flush ? "flush" : ""}" id="scr">${body}</div>
        <nav class="tabs">${[["home", "Accueil"], ["book", "Réserver"], ["days", "Jours"], ["map", "Carte"], ["info", "Pratique"]]
          .map(([k, l]) => `<button class="${S.tab === k && !S.me ? "on" : ""}" data-tab="${k}">${TAB_ICONS[k]}${l}</button>`).join("")}</nav>`;
    },

    adminHome: () => `
      <div class="app-top erika-top"><span>${icon("bunnymap", 36)}</span><div><b>Bonjour Erika</b><small>${S.trips.length} voyage${S.trips.length > 1 ? "s" : ""}</small></div><span class="sp"></span><button class="btn small" data-action="logout">Quitter</button></div>
      <div class="screen">
        <button type="button" class="card client" data-action="requests" style="--sh:var(--yellow)">
          <div class="row"><b><i class="pic" data-picto="mail"></i> Demandes</b><span class="pill ${S.newRequests ? "p-pink" : "p-mint"}">${S.newRequests ? S.newRequests + " nouvelle" + (S.newRequests > 1 ? "s" : "") : "à jour"}</span></div>
          <small>${S.reqError ? `<b style="color:var(--red)">Impossible de lire les demandes : ${esc(S.reqError)}</b>` : "devis et liste d’attente reçus depuis le site"}</small></button>
        <div class="sec-t" style="margin-top:4px"><h2>Mes voyageurs</h2><button data-action="newTrip">+ Nouveau voyage</button></div>
        ${S.trips.map((t) => `<button type="button" class="card client" data-admintrip="${t.id}" style="--sh:var(--pink)">
            <div class="row"><b>${esc((t.travelers || []).join(" & ") || "Voyageurs ?")}</b><span class="pill strong">${tripIcon(t, 18)} ${esc(t.title)}</span></div>
            <small>${t.start_date ? "départ le " + fmtDate(t.start_date, { day: "numeric", month: "long", year: "numeric" }) + " · " : ""}<span class="pill ${(STATUS[t.status] || STATUS.brief)[1]}" style="font-size:10.5px">${(STATUS[t.status] || STATUS.brief)[0]}</span> · code ${esc(t.code)}</small>
          </button>`).join("") || `<p class="sub">Aucun voyage. Crée le premier !</p>`}
      </div>`,

    adminTrip: () => adminTrip(),

    requests: () => `
      <div class="app-top erika-top"><button class="icon-btn" data-action="adminHome" aria-label="Retour">←</button><div><b>Demandes</b><small>devis et liste d’attente</small></div></div>
      <div class="screen" id="scr">
        <div class="filters">${[["nouveau", "Nouvelles"], ["répondu", "Répondu"], ["client", "Clients"], ["archivé", "Archivées"], ["all", "Toutes"]]
          .map(([k, l]) => `<button class="${S.reqFilter === k ? "on" : ""}" data-reqfilter="${k}">${l}${k === "nouveau" ? ` (${(S.requests || []).filter((r) => r.status === "nouveau").length})` : ""}</button>`).join("")}</div>
        ${S.reqError ? `<div class="note warn" style="margin-top:12px"><span class="ico">!</span><span>Impossible de lire les demandes : ${esc(S.reqError)}</span></div>` : ""}
        ${(S.requests || []).filter((r) => S.reqFilter === "all" || r.status === S.reqFilter).map((r) => `
          <div class="card" style="--sh:var(--${r.status === "nouveau" ? "pink" : r.status === "client" ? "mint" : "blue"});margin-top:12px">
            <div class="row" style="justify-content:space-between"><b>${esc(r.firstname || "?")} · ${esc(r.destinations || "")}</b><span class="pill ${r.kind === "attente" ? "p-lav" : "p-yellow"}">${r.kind === "attente" ? "liste d’attente" : "devis"}</span></div>
            <small class="small">${new Date(r.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}${r.estimate ? " · " + esc(r.estimate) : ""}</small>
            <details style="margin-top:8px"><summary class="small" style="cursor:pointer;font-weight:700">Voir la demande</summary><p class="small" style="white-space:pre-wrap;margin-top:6px">${esc(r.summary)}</p></details>
            <div class="row" style="margin-top:10px">
              ${stepBtns(r)}
            </div>
            ${sentLine(r)}
            <div class="row" style="margin-top:8px">
              <a class="btn small" href="mailto:${esc(r.email)}?subject=${encodeURIComponent("Ton voyage HodoPlanner")}"><i class="pic" data-picto="mail"></i> Répondre</a>
              ${r.whatsapp ? `<a class="btn small" href="https://wa.me/${esc(r.whatsapp.replace(/\D/g, ""))}" target="_blank" rel="noopener"><i class="pic" data-picto="chat"></i> WhatsApp</a>` : ""}
              <select data-reqstatus="${r.id}" style="width:auto;min-height:38px;padding:4px 30px 4px 10px">${["nouveau", "répondu", "client", "archivé"].map((st) => `<option ${r.status === st ? "selected" : ""}>${st}</option>`).join("")}</select>
              <button class="btn small" style="color:var(--red)" data-action="reqDelete" data-id="${esc(r.id)}" aria-label="Supprimer la demande">Supprimer</button>
            </div>
          </div>`).join("") || `<p class="sub" style="margin-top:12px">Rien ici.</p>`}
      </div>`,
  };

  // =================== onglets voyageur ===================
  // ---- brief à valider (avant que je commence) ----
  const BRIEF = [
    ["Ton voyage", "blue", ["Destination(s)", "Dates", "Durée", "Voyageurs", "Dates flexibles", "Parcours"]],
    ["Ton budget", "yellow", ["Budget", "Vols", "Plafond vol", "Plafond nuit", "Réductions", "Budget flexible"]],
    ["Tes envies", "pink", ["Rythme", "Centres d’intérêt", "Hébergements", "Incontournables", "Contraintes", "Format"]],
    ["Formalités", "mint", ["Passeport / visa", "Santé / vaccins", "Visa / vaccins"]],
  ];
  function briefValue(k, v) {
    if (k === "Dates") return v.split("→").map((x) => fmtDate(x.trim(), { day: "numeric", month: "long", year: "numeric" })).join(" → ");
    if (v === "oui" && /flexible/.test(k)) return "oui, on peut ajuster";
    if (k === "Visa / vaccins" || k === "Passeport / visa") { const n = v.match(/nationalité : (.+)$/); return "je vérifie les infos officielles pour toi" + (n && n[1].trim() !== "?" ? ` (nationalité ${n[1].trim()})` : ""); }
    if (k === "Santé / vaccins") return "je te dis quoi prévoir (à confirmer avec un médecin)";
    return v;
  }
  function briefCards(b) {
    const known = BRIEF.flatMap((x) => x[2]);
    const other = Object.keys(b || {}).filter((k) => !known.includes(k));
    return [...BRIEF, ["Autres infos", "lav", other]].map(([title, color, keys]) => {
      const rows = keys.filter((k) => b && typeof b[k] === "string" && b[k].trim());
      return rows.length ? `<div class="card" style="--sh:var(--${color});margin-top:12px"><span class="label" style="--lb:var(--${color}-soft)">${title}</span>
        <div class="brief-rows">${rows.map((k) => `<span class="small">${esc(k === "Destination(s)" ? "Destination" : k)}</span><b>${esc(briefValue(k, b[k]))}</b>`).join("")}</div></div>` : "";
    }).join("");
  }
  function briefPage(t) {
    const free = /offert/i.test(t.price || "");
    return `
      <div class="card hello">
        <span class="label" style="--lb:var(--yellow)">Bonjour ${esc((t.travelers || []).join(" & "))}</span>
        <h2 style="margin-top:8px">Dernière étape : ton brief</h2>
        <p class="sub" style="margin-top:6px">Relis-le bien : c’est la base de mes recherches. Je commence dès que tu le valides${free ? "" : " et que le paiement est fait"}.</p>
        ${t.price ? `<div class="price-tag">${esc(t.price)}</div>` : ""}
      </div>
      ${briefCards(t.brief) || `<p class="sub" style="margin-top:12px">Ton brief arrive : je le prépare à partir de ta demande.</p>`}
      <form id="briefForm" class="card stack" style="--sh:var(--lav);margin-top:14px">
        <div class="field"><label>Quelque chose à ajouter ou corriger ? <span class="small">(facultatif)</span></label><textarea name="note" rows="3" maxlength="2000" placeholder="ex. on préfère éviter les auberges de jeunesse"></textarea></div>
        <label class="check"><input type="checkbox" name="c1" required /> <span>J’ai relu mon brief : c’est la base de tes recherches.</span></label>
        <label class="check"><input type="checkbox" name="c2" required /> <span>J’accepte les <a href="../conditions.html" target="_blank" rel="noopener">conditions de service</a> et je te demande de commencer tout de suite.</span></label>
        <button class="btn dark block" type="submit">${free ? "Valider mon brief" : "Valider mon brief et payer"}</button>
        ${free ? `<p class="small" style="text-align:center">Offert pendant le lancement : rien à payer.</p>` : `<p class="small" style="text-align:center">Le paiement en ligne arrive bientôt : en attendant, je t’envoie le lien de paiement par mail juste après ta validation.</p>`}
      </form>
      <div class="sec-t"><h2>Une question ?</h2></div>
      ${contactBtn()}`;
  }

  function tabHome() {
    const t = S.data.trip, s = stats(), d = t.start_date ? daysUntil(t.start_date) : null;
    if (t.status === "brief") return briefPage(t);
    const todo = S.data.items.filter((i) => !isDone(i)).sort(byDeadline);
    const nextOpen = todo.filter((i) => i.rule).map((i) => ({ i, dl: deadlineOf(i) })).filter((x) => x.dl && x.dl.opens > new Date()).sort((a, b) => a.dl.opens - b.dl.opens)[0];
    const firstDay = S.data.days.findIndex((x) => x.date >= TODAY.toISOString().slice(0, 10));
    return `
      <div class="card hello">
        <span class="label" style="--lb:var(--yellow)">Bonjour ${esc((t.travelers || []).join(" & "))}</span>
        <h2 style="margin-top:8px">${d === null ? "Ton voyage se prépare" : d > 0 ? `Plus que ${d} jour${d > 1 ? "s" : ""} avant le départ !` : "Bon voyage !"}</h2>
        <div class="count"><div><b>${S.data.days.length}</b><small>jours prêts</small></div><div><b>${s.done}/${s.total}</b><small>réservés</small></div><div><b>${s.total - s.done}</b><small>à faire</small></div></div>
        <div class="bar" style="margin-top:12px"><i style="width:${s.pct}%"></i></div>
      </div>
      ${t.status === "validated" ? `<div class="note warn" style="margin-top:14px"><span class="ico">!</span><span><b>Brief validé, merci !</b> Je t’envoie le lien de paiement par mail : je commence les recherches dès qu’il est réglé.</span></div>` : ""}
      ${t.status === "in_progress" && !S.data.items.length && !S.data.days.length ? `<div class="note tip" style="margin-top:14px"><span class="ico">✓</span><span><b>C’est parti !</b> Je prépare ton voyage : les réservations et les jours apparaîtront ici au fur et à mesure.</span></div>` : ""}
      ${nextOpen ? `<div class="note tip" style="margin-top:14px"><span class="ico"><i class="pic" data-picto="bell"></i></span><span><b>Bientôt réservable :</b> ${esc(nextOpen.i.title.split(" · ")[0])}, les réservations ouvrent le ${esc(HodoRules.describe(nextOpen.dl.opens).local)}.</span></div>` : ""}
      <div class="sec-t"><h2>À réserver bientôt</h2><button data-tab="book">tout voir</button></div>
      ${todo.slice(0, 3).map((i) => itemRow(i)).join("") || `<p class="sub">${S.data.items.length ? "Tout est réservé, bravo !" : "Erika prépare ta liste."}</p>`}
      ${S.data.days.length ? `<div class="sec-t"><h2>Le programme</h2><button data-tab="days">tous les jours</button></div>${dayRow(S.data.days[Math.max(0, firstDay)], Math.max(0, firstDay))}` : ""}
      <div class="sec-t"><h2>Besoin d’Erika ?</h2></div>
      ${contactBtn()}`;
  }
  function contactBtn() {
    return cfg.whatsapp
      ? `<a class="btn block" href="https://wa.me/${esc(cfg.whatsapp.replace(/\D/g, ""))}" target="_blank" rel="noopener"><i class="pic" data-picto="chat"></i> Écrire sur WhatsApp</a><p class="small" style="margin-top:6px;text-align:center">En cas de souci : je réponds dès que possible, sans délai garanti.</p>`
      : `<a class="btn block" href="mailto:${esc(cfg.contactEmail || "contact@hodoplanner.com")}"><i class="pic" data-picto="mail"></i> Écrire à Erika</a>`;
  }
  function tabBook() {
    const s = stats();
    const list = S.data.items.filter((i) => S.filter === "all" || (S.filter === "done" ? isDone(i) : !isDone(i))).sort(byDeadline);
    return `
      <div class="filters">${[["todo", `À faire (${s.total - s.done})`], ["done", `Réservé (${s.done})`], ["all", "Tout"]].map(([k, l]) => `<button class="${S.filter === k ? "on" : ""}" data-filter="${k}">${l}</button>`).join("")}</div>
      <p class="small" style="margin-bottom:12px">Réserve avec les liens, puis coche : le numéro de réservation et la confirmation sont facultatifs. <i class="pic" data-picto="bell"></i> = pas réservable avant une certaine date : ajoute-la à ton agenda pour ne pas la rater.</p>
      ${list.map((i) => itemRow(i)).join("") || `<p class="sub">Rien ici pour l’instant.</p>`}`;
  }
  function dayRow(day, i) {
    return `<button type="button" class="day" data-day="${i}" data-tabto="days" style="--sh:var(--${COLORS.includes(day.color) ? day.color : "mint"})">
      <span class="d" style="--c:${soft(day.color)}"><small>${fmtDate(day.date, { weekday: "short" })}</small><b>${new Date(day.date + "T12:00").getDate()}</b></span>
      <span class="tx"><b>${esc(day.title)}${day.published ? "" : " · brouillon"}</b><p>${esc(day.subtitle || "")}</p></span>
      <span>${icon(day.icon || "star", 34)}</span><span class="chev">›</span></button>`;
  }
  // ---- listes à cocher (partagées entre les voyageurs) ----
  const lines = (txt) => String(txt || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const isChecked = (key) => (S.data.checks || []).some((c) => c.key === key && c.done);
  const checkList = (prefix, list) => `<div class="cklist">${list.map((x) => {
    const key = (prefix + ":" + x).slice(0, 500);
    return `<label class="check"><input type="checkbox" data-check="${esc(key)}" ${isChecked(key) ? "checked" : ""} /> <span>${linkify(x)}</span></label>`;
  }).join("")}</div>`;

  const tabDays = () => S.data.days.length
    ? `<p class="small" style="margin-bottom:12px">Touche un jour pour voir le programme, la carte, quoi manger et les conseils.</p>${S.data.days.map(dayRow).join("")}`
    : `<p class="sub">Erika prépare ton programme jour par jour : il apparaîtra ici.</p>`;
  function dayDetail(i) {
    const day = S.data.days[i];
    if (!day) { S.day = null; return tabDays(); }
    const its = S.data.items.filter((x) => x.date === day.date);
    const pts = (day.stops || []).filter((s) => s.lat != null && s.lng != null);
    return `
      <button class="linklike" data-day="back" style="font-size:13px;margin-bottom:10px">← Tous les jours</button>
      <div class="card dhero"><span class="d" style="--c:${soft(day.color)}"><small>${fmtDate(day.date, { weekday: "short" })}</small><b>${new Date(day.date + "T12:00").getDate()}</b><small>${fmtDate(day.date, { month: "short" })}</small></span>
        <div style="flex:1;min-width:0"><span class="small">Jour ${i + 1}${day.base ? " · " + esc(day.base) : ""}</span><h2>${esc(day.title)}</h2></div><span>${icon(day.icon || "star", 46)}</span></div>
      ${pts.length ? `<div class="minimap" id="dayMap"></div>` : ""}
      ${(day.stops || []).length ? `<div class="sec-t"><h2>Le programme <span class="jp">予定</span></h2></div>
        <div class="tl">${day.stops.map((s) => `
          <div class="stop"><span class="ic">${icon(s.icon || "star", 32)}</span><div>
            ${s.when ? `<span class="when">${esc(s.when)}</span>` : ""}<b>${esc(s.name)}</b>${s.text ? `<p>${linkify(s.text)}</p>` : ""}
            ${s.tip ? `<div class="tip">✳ ${linkify(s.tip)}</div>` : ""}
            <a href="${gmaps(s)}" target="_blank" rel="noopener">Itinéraire ↗</a>
          </div></div>`).join("")}</div>` : ""}
      ${(day.eat || []).length ? `<div class="sec-t"><h2>À goûter <span class="jp">グルメ</span></h2></div>
        <div class="eat">${day.eat.map((e) => `<div>${icon(e.icon || "ramen", 34)}<b>${esc(e.name)}</b><p>${esc(e.text || "")}</p></div>`).join("")}</div>` : ""}
      ${its.length ? `<div class="sec-t"><h2>Réservations du jour</h2></div>${its.map((x) => itemRow(x)).join("")}` : ""}
      ${(day.checklist || []).length ? `<div class="sec-t"><h2>À cocher <span class="jp">チェック</span></h2></div><div class="card" style="--sh:var(--${COLORS.includes(day.color) ? day.color : "mint"})">${checkList("day:" + day.id, day.checklist)}</div>` : ""}
      ${day.tip ? `<div class="note tip" style="margin-top:16px"><span class="ico">✳</span><span><b>Le conseil d’Erika :</b> ${linkify(day.tip)}</span></div>` : ""}
      <div class="nav2">${i > 0 ? `<button class="btn small" data-day="${i - 1}">← Jour ${i}</button>` : "<span></span>"}${i < S.data.days.length - 1 ? `<button class="btn small" data-day="${i + 1}">Jour ${i + 2} →</button>` : ""}</div>`;
  }
  const tabMap = () => `<div id="tripMap"></div>${S.data.days.some((d) => (d.stops || []).some((s) => s.lat != null)) ? "" : `<div class="note" style="position:absolute;z-index:600;left:12px;right:12px;top:12px"><span class="ico"><i class="pic" data-picto="map"></i></span><span>Les lieux apparaîtront ici avec ton programme.</span></div>`}`;
  function tabInfo() {
    const sec = S.data.trip.practical || [];
    return `${sec.length ? sec.map((p, k) => `<div class="card" style="--sh:var(--${COLORS[k % COLORS.length]});margin-top:${k ? 14 : 0}px">
        <div class="info"><b>${p.icon && window.HodoPictos ? HodoPictos.svg(p.icon, 24) : ""}${esc(p.title)}</b>${p.list ? checkList("info:" + p.title, lines(p.text)) : `<p>${linkify(p.text || "")}</p>`}${p.source ? `<span class="src">Source : ${esc(p.source)}</span>` : ""}</div></div>`).join("")
      : `<p class="sub">Erika ajoute ici les infos pratiques de ton voyage : urgences, santé, visa, prises, argent…</p>`}
      <div class="sec-t"><h2>Besoin d’Erika ?</h2></div>${contactBtn()}`;
  }
  // numéros de téléphone cliquables dans les infos pratiques
  // (les numéros longs, et les numéros d'urgence à 3 chiffres écrits après « : », ex. « Police : 110 »)
  const tel = (m) => `<a href="tel:${m.replace(/[^\d+]/g, "")}">${m}</a>`;
  const telify = (h) => h
    .replace(/(\+?\d[\d\s-]{4,16}\d)/g, (m) => (m.replace(/\D/g, "").length >= 6 ? tel(m) : m))
    .replace(/(:\s*)(1\d{2})(?!\d)/g, (_m, pre, n) => pre + tel(n));
  // et les adresses web (https://… ou www.…) deviennent des liens
  const linkify = (txt) => nl(txt).split(/((?:https?:\/\/|www\.)[^\s<]*[^\s<.,;:!?)])/g)
    .map((part, k) => (k % 2 ? `<a href="${part.startsWith("http") ? part : "https://" + part}" target="_blank" rel="noopener">${part.replace(/^https?:\/\//, "")}</a>` : telify(part))).join("");

  function tabMe(t) {
    return `
      <button class="linklike" data-action="me" style="font-size:13px;margin-bottom:6px">← Retour</button>
      <div class="sec-t" style="margin-top:4px"><h2>Voyageurs</h2></div>
      <div class="card" style="--sh:var(--lav)">
        <div class="row">${(t.travelers || []).map((n) => `<span class="pill strong">${esc(n)}</span>`).join("")}</div>
        <p class="small" style="margin:10px 0 8px">Invite un compagnon de voyage : il entre ce code dans l’app avec son propre email.</p>
        <div class="code">${esc(t.code)}</div>
        <button class="btn small" style="margin-top:10px" data-action="share">Partager le code</button>
      </div>
      <div class="sec-t"><h2>Mon compte</h2></div>
      <div class="card" style="--sh:var(--blue)"><p class="small">Connecté·e avec <b>${esc(S.profile?.email || "")}</b></p>
        ${S.trips.length > 1 ? `<button class="btn small" style="margin-top:10px" data-action="back">Mes autres voyages</button>` : ""}</div>
      <div class="card" style="--sh:var(--yellow);margin-top:14px"><p class="small">Une nouveauté annoncée n’apparaît pas ?</p>
        <button class="btn small" style="margin-top:8px" data-action="checkUpdate"><i class="pic" data-picto="sparkle"></i> Vérifier les mises à jour</button></div>
      <button class="btn block" style="margin-top:20px" data-action="logout">Se déconnecter</button>`;
  }

  // =================== vue d'Erika : un voyage ===================
  function adminTrip() {
    const t = S.data.trip;
    const tabs = [["items", `Réservations (${S.data.items.length})`], ["days", `Jours (${S.data.days.length})`], ["infos", "Pratique"], ["trip", "Voyage"]];
    let body = "";
    if (S.adminTab === "items") {
      body = `<button class="btn dark small" data-action="editItem" style="margin-bottom:12px">+ Ajouter une réservation</button>
        ${S.data.items.slice().sort(byDeadline).map((i) => itemRow(i, "data-edititem")).join("") || `<p class="sub">Aucune réservation. Ajoute la première.</p>`}`;
    } else if (S.adminTab === "days") {
      const drafts = S.data.days.filter((d) => !d.published).length;
      body = `<div class="row" style="margin-bottom:12px"><button class="btn dark small" data-action="editDay">+ Ajouter un jour</button>${drafts ? `<button class="btn small" data-action="publishAll">Tout publier (${drafts})</button>` : ""}</div>
        <p class="small" style="margin-bottom:10px">Les voyageurs ne voient que les jours <b>publiés</b>. Les brouillons restent pour toi.</p>
        ${S.data.days.map((d) => `<button type="button" class="day ${d.published ? "" : "draft"}" data-editday="${d.id}" style="--sh:var(--${COLORS.includes(d.color) ? d.color : "mint"})">
          <span class="d" style="--c:${soft(d.color)}"><small>${fmtDate(d.date, { weekday: "short" })}</small><b>${new Date(d.date + "T12:00").getDate()}</b></span>
          <span class="tx"><b>${esc(d.title)}</b><p>${d.published ? "publié" : "brouillon · invisible pour les voyageurs"} · ${(d.stops || []).length} étape${(d.stops || []).length > 1 ? "s" : ""}</p></span>
          <span>${icon(d.icon || "star", 30)}</span></button>`).join("") || `<p class="sub">Aucun jour.</p>`}`;
    } else if (S.adminTab === "infos") {
      body = `<form id="infosForm" class="stack">
        <p class="small">Urgences, santé (wanda.be), visa, prises, argent… Les numéros de téléphone deviennent cliquables.</p>
        <div id="secRows" class="stack">${(t.practical || []).map(secRow).join("")}</div>
        <button type="button" class="btn small" data-action="addSec">+ Ajouter une rubrique</button>
        <button class="btn dark block" type="submit">Enregistrer</button></form>`;
    } else {
      body = `<div class="card stack" style="--sh:var(--mint)"><span class="small">Code à envoyer aux voyageurs</span><div class="code">${esc(t.code)}</div>
          <button class="btn small" data-action="share">Copier le code</button></div>
        <div class="sec-t"><h2>Voyageurs inscrits</h2></div><div id="members" class="small">…</div>
        ${t.validated_at ? `<div class="note tip" style="margin-top:14px"><span class="ico">✓</span><span>Brief validé le ${new Date(t.validated_at).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}${t.brief_note ? `<br><b>Sa note :</b> ${esc(t.brief_note)}` : ""}</span></div>` : ""}
        <div class="sec-t"><h2>Infos du voyage</h2></div>${tripForm(t)}
        <div class="sec-t"><h2>Importer · exporter</h2></div>
        <p class="small" style="margin-bottom:10px">Exporte un voyage pour le garder ou le reprendre comme modèle, ou importe un fichier préparé (réservations, jours, infos pratiques).</p>
        <div class="row"><button class="btn small" data-action="exportTrip"><i class="pic" data-picto="doc"></i> Exporter</button><button class="btn small" data-action="importTrip"><i class="pic" data-picto="clip"></i> Importer un fichier</button></div>
        <input type="file" id="importFile" accept=".json,application/json" hidden />
        <button class="btn block" style="margin-top:18px;color:var(--red)" data-action="deleteTrip">Supprimer ce voyage</button>`;
    }
    return `
      <div class="app-top erika-top"><button class="icon-btn" data-action="adminHome" aria-label="Retour">←</button><div style="min-width:0"><b>${esc((t.travelers || []).join(" & ") || t.title)}</b><small>${esc(t.title)} · ${esc(t.code)}</small></div><span class="sp"></span>
        <button class="btn small" data-action="toTraveler"><i class="pic" data-picto="eye"></i> Voyageur</button></div>
      <div class="screen" id="scr"><div class="filters">${tabs.map(([k, l]) => `<button class="${S.adminTab === k ? "on" : ""}" data-admintab="${k}">${l}</button>`).join("")}</div>${body}</div>`;
  }
  const secRow = (p = {}) => `<div class="rowx" data-sec>
      <div class="rowx-head"><span>Rubrique</span><button type="button" class="mini-x" data-action="delRow" aria-label="Retirer">×</button></div>
      <div class="two"><select name="icon">${pictoOptions(p.icon || "sparkle")}</select><input name="title" placeholder="ex. Urgences" value="${esc(p.title)}" /></div>
      <textarea name="text" placeholder="Le texte (une info par ligne)">${esc(p.text)}</textarea>
      <label class="check"><input type="checkbox" data-list ${p.list ? "checked" : ""} /> <span>Liste à cocher (une case par ligne)</span></label>
      <input name="source" placeholder="Source, ex. wanda.be · vérifié le 12 oct." value="${esc(p.source)}" /></div>`;
  const tripForm = (t = {}) => `<form id="tripForm" class="stack">
      <div class="field"><label>Destination *</label><input name="title" required value="${esc(t.title)}" placeholder="ex. Japon" /></div>
      <div class="two"><div class="field"><label>Icône</label><select name="emoji">${iconOptions(window.HodoIcons && HodoIcons.has(t.emoji) ? t.emoji : "torii")}</select></div><div class="field"><label>Pays (code)</label><input name="country" value="${esc(t.country)}" placeholder="JP" /></div></div>
      <div class="field"><label>Voyageurs (prénoms, séparés par des virgules)</label><input name="travelers" value="${esc((t.travelers || []).join(", "))}" placeholder="ex. Ardahan" /></div>
      <div class="two"><div class="field"><label>Départ</label><input type="date" name="start_date" value="${esc(t.start_date)}" /></div><div class="field"><label>Retour</label><input type="date" name="end_date" value="${esc(t.end_date)}" /></div></div>
      <div class="field"><label>Prix</label><input name="price" maxlength="100" value="${esc(t.price)}" placeholder="ex. 150 € (offert : lancement)" /></div>
      <div class="field"><label>Étape</label><select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${t.status === k ? "selected" : ""}>${v[0]}</option>`).join("")}</select></div>
      <button class="btn dark block" type="submit">${t.id ? "Enregistrer" : "Créer le voyage"}</button></form>`;

  // =================== importer · exporter un voyage ===================
  // Format : { hodoplanner: 1, trip: {...}, items: [...], days: [...], practical: [...] }
  // Les réservations peuvent porter done / ref / paid (déjà réservé, n° de résa, prix payé).
  const ITEM_TYPES = ["flight", "hotel", "activity", "transport", "food", "admin"];
  const isDate = (v) => typeof v === "string" && /^\d{4}-\d\d-\d\d$/.test(v);
  const str = (v, max = 2000) => (v == null || v === "" ? null : String(v).slice(0, max));
  const okIcon = (v, d) => (window.HodoIcons && HodoIcons.has(v) ? v : d);
  const okPicto = (v) => (window.HodoPictos && HodoPictos.names.includes(v) ? v : "sparkle");
  function exportTrip() {
    const t = S.data.trip, prog = (id) => S.data.progress.find((p) => p.item_id === id) || {};
    const data = {
      hodoplanner: 1, exported_at: new Date().toISOString(),
      trip: { title: t.title, emoji: t.emoji, country: t.country, start_date: t.start_date, end_date: t.end_date, travelers: t.travelers, price: t.price },
      items: S.data.items.map((i) => ({ type: i.type, title: i.title, where_label: i.where_label, link: i.link, date: i.date, deadline: i.deadline, rule: i.rule,
        price: i.price, note: i.note, urgent: i.urgent, partner: i.partner, done: !!prog(i.id).done, ref: prog(i.id).ref || null, paid: prog(i.id).paid || null })),
      days: S.data.days.map((d) => ({ date: d.date, title: d.title, subtitle: d.subtitle, icon: d.icon, color: d.color, base: d.base, tip: d.tip,
        stops: d.stops, eat: d.eat, checklist: d.checklist || [], published: d.published })),
      practical: t.practical || [],
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `hodoplanner-${(t.title || "voyage").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}-${t.code}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    toast("Fichier téléchargé");
  }
  let importData = null;
  async function readImport(file) {
    let d;
    try { d = JSON.parse(await file.text()); } catch (_) { return toast("Ce fichier n’est pas un export HodoPlanner (JSON illisible)."); }
    if (!d || d.hodoplanner !== 1) return toast("Ce fichier n’est pas un export HodoPlanner.");
    importData = d;
    const n = (k) => (Array.isArray(d[k]) ? d[k].length : 0), t = S.data.trip;
    const has = S.data.items.length || S.data.days.length || (t.practical || []).length;
    showSheet(`<h2>Importer dans ce voyage</h2>
      <p class="small">${esc((d.trip || {}).title || "Fichier")}${d.trip && d.trip.start_date ? " · " + fmtDate(d.trip.start_date, { day: "numeric", month: "short" }) + " → " + fmtDate(d.trip.end_date, { day: "numeric", month: "short", year: "numeric" }) : ""}</p>
      <div class="count" style="margin:12px 0"><div><b>${n("items")}</b><small>réservations</small></div><div><b>${n("days")}</b><small>jours</small></div><div><b>${n("practical")}</b><small>rubriques pratiques</small></div></div>
      <div class="stack">
        ${has ? `<label class="check"><input type="checkbox" id="impReplace" /> <span><b>Remplacer</b> ce qu’il y a déjà (${S.data.items.length} réservations, ${S.data.days.length} jours, ${(t.practical || []).length} rubriques). Sinon, tout est ajouté à la suite.</span></label>` : ""}
        ${d.trip ? `<label class="check"><input type="checkbox" id="impTrip" ${t.start_date ? "" : "checked"} /> <span>Reprendre le titre, les dates et le pays du fichier</span></label>` : ""}
        <label class="check"><input type="checkbox" id="impProgress" checked /> <span>Reprendre ce qui est déjà réservé (coches, n° de réservation, prix payé)</span></label>
        <label class="check"><input type="checkbox" id="impPublish" /> <span>Publier les jours tout de suite (sinon : brouillons, à relire)</span></label>
      </div>
      <p class="err hidden" id="err"></p>
      <button class="btn dark block" style="margin-top:14px" data-action="doImport" id="impGo">Importer</button>`);
  }
  async function doImport(btn) {
    const d = importData; if (!d) return;
    const opt = (id) => !!(document.getElementById(id) || {}).checked;
    const replace = opt("impReplace"), withTrip = opt("impTrip"), withProgress = opt("impProgress"), publish = opt("impPublish");
    if (replace && !confirm("Supprimer tout le contenu actuel de ce voyage avant d’importer ?")) return;
    btn.disabled = true;
    const step = (txt) => { btn.textContent = txt; };
    const tid = S.tripId, t = S.data.trip;
    if (replace) {
      step("Nettoyage…");
      for (const i of S.data.items) await api.deleteItem(i.id);
      for (const x of S.data.days) await api.deleteDay(x.id);
    }
    const items = (Array.isArray(d.items) ? d.items : []).filter((i) => i && i.title);
    let k = 0, pos = replace ? 0 : S.data.items.length;
    for (const i of items) {
      step(`Réservations… ${++k}/${items.length}`);
      const saved = await api.saveItem({ trip_id: tid, type: ITEM_TYPES.includes(i.type) ? i.type : "activity", title: str(i.title, 300), where_label: str(i.where_label, 200),
        link: /^https?:\/\//.test(i.link || "") ? str(i.link, 1000) : null, date: isDate(i.date) ? i.date : null, deadline: isDate(i.deadline) ? i.deadline : null,
        rule: HodoRules.RULES.some((r) => r.id === i.rule) ? i.rule : null, price: str(i.price, 100), note: str(i.note),
        urgent: !!i.urgent, partner: !!i.partner, position: ++pos });
      if (withProgress && (i.done || i.ref || i.paid)) await api.saveProgress({ item_id: saved.id, trip_id: tid, done: !!i.done, ref: str(i.ref, 100), paid: str(i.paid, 100) });
    }
    const days = (Array.isArray(d.days) ? d.days : []).filter((x) => x && isDate(x.date) && x.title);
    k = 0;
    for (const x of days) {
      step(`Jours… ${++k}/${days.length}`);
      await api.saveDay({ trip_id: tid, date: x.date, title: str(x.title, 200), subtitle: str(x.subtitle, 300), icon: okIcon(x.icon, "star"), color: COLORS.includes(x.color) ? x.color : "mint",
        base: str(x.base, 100), tip: str(x.tip),
        stops: (x.stops || []).filter((p) => p && p.name).map((p) => ({ when: str(p.when, 40), name: str(p.name, 200), text: str(p.text), tip: str(p.tip, 500), icon: okIcon(p.icon, "star"),
          lat: Number.isFinite(+p.lat) && p.lat !== null && p.lat !== "" ? +p.lat : null, lng: Number.isFinite(+p.lng) && p.lng !== null && p.lng !== "" ? +p.lng : null })),
        eat: (x.eat || []).filter((e) => e && e.name).map((e) => ({ name: str(e.name, 100), text: str(e.text, 300), icon: okIcon(e.icon, "ramen") })),
        checklist: (x.checklist || []).map((c) => str(c, 300)).filter(Boolean), published: publish || false });
    }
    step("Infos du voyage…");
    const practical = (Array.isArray(d.practical) ? d.practical : []).filter((p) => p && (p.title || p.text))
      .map((p) => ({ icon: okPicto(p.icon), title: str(p.title, 100) || "", text: str(p.text, 6000) || "", source: str(p.source, 200) || "", ...(p.list ? { list: true } : {}) }));
    const row = { id: tid, practical: replace ? practical : (t.practical || []).concat(practical) };
    if (withTrip && d.trip) {
      const dt = d.trip;
      if (dt.title) row.title = str(dt.title, 100);
      if (isDate(dt.start_date)) row.start_date = dt.start_date;
      if (isDate(dt.end_date)) row.end_date = dt.end_date;
      if (dt.country) row.country = str(dt.country, 2).toUpperCase();
      if (dt.emoji) row.emoji = okIcon(dt.emoji, t.emoji);
    }
    await api.saveTrip(row);
    importData = null; closeSheet(); await reloadTrip();
    toast(`Importé : ${items.length} réservations, ${days.length} jours, ${practical.length} rubriques`);
  }

  // =================== fiches ===================
  function showSheet(html) {
    closeSheet(true);
    const el = document.createElement("div");
    el.innerHTML = `<div class="sheet-bg" id="sbg"></div><div class="sheet" id="sheet" role="dialog"><div class="grip"></div>${html}</div>`;
    $phone.append(...el.children);
    requestAnimationFrame(() => { document.getElementById("sbg")?.classList.add("show"); document.getElementById("sheet")?.classList.add("open"); });
    document.getElementById("sbg").onclick = () => closeSheet();
  }
  function closeSheet(now) {
    const s = document.getElementById("sheet"), bg = document.getElementById("sbg");
    if (!s) return;
    if (now) { s.remove(); bg.remove(); return; }
    s.classList.remove("open"); bg.classList.remove("show");
    setTimeout(() => { s.remove(); bg.remove(); }, 280);
  }

  // fiche voyageur : cocher, n°, prix, confirmation
  function openItem(id) {
    const it = S.data.items.find((i) => i.id === id); if (!it) return;
    const p = prog(id) || {}, dl = deadlineOf(it);
    showSheet(`
      <div class="row" style="gap:12px;flex-wrap:nowrap"><span style="flex:0 0 auto">${icon(TYPES[it.type]?.icon || "star", 44)}</span><div><span class="small">${TYPES[it.type]?.label || ""}${it.partner ? ` · <span class="partner">lien partenaire</span>` : ""}</span><h2>${esc(it.title)}</h2></div></div>
      <div class="kv">
        ${it.date ? `<span>Pour le</span><b>${fmtDate(it.date, { weekday: "long", day: "numeric", month: "long" })}</b>` : ""}
        ${dl ? `<span>${dl.rule ? "Réservable dès le" : "À réserver avant le"}</span><b>${dl.rule ? `${esc(HodoRules.describe(dl.opens).local)}<br><small>(${esc(HodoRules.describe(dl.opens).there)} heure du Japon)</small>` : fmtDate(dl.iso, { day: "numeric", month: "long", year: "numeric" })}</b>` : ""}
        ${it.where_label ? `<span>Où</span><b>${esc(it.where_label)}</b>` : ""}
        ${it.price ? `<span>Prix indicatif</span><b>${esc(it.price)}</b>` : ""}
      </div>
      ${dl && dl.rule ? `<div class="note" style="margin-bottom:12px"><span class="ico"><i class="pic" data-picto="bell"></i></span><span>On ne peut pas réserver avant cette date. ${esc(dl.rule.how)} <button class="linklike" data-action="ics" data-id="${it.id}">Ajouter à mon agenda</button></span></div>` : ""}
      ${it.note ? `<div class="note tip" style="margin-bottom:12px"><span class="ico">✳</span><span><b>Le conseil d’Erika :</b> ${nl(it.note)}</span></div>` : ""}
      ${it.partner ? `<p class="small" style="margin-bottom:10px">Lien partenaire : si tu réserves par ce lien, Erika touche une petite commission, sans surcoût pour toi.</p>` : ""}
      ${it.link ? `<a class="btn block" href="${esc(it.link)}" target="_blank" rel="noopener" style="margin-bottom:14px">Réserver${it.where_label ? " sur " + esc(it.where_label) : ""} ↗</a>` : ""}
      <form id="progForm" data-id="${it.id}">
        <label class="switch">C’est réservé !<input type="checkbox" name="done" ${p.done ? "checked" : ""} /><i></i></label>
        <div class="field"><label>N° de réservation <span class="small">(facultatif)</span></label><input name="ref" value="${esc(p.ref)}" /></div>
        <div class="field"><label>Prix payé <span class="small">(facultatif)</span></label><input name="paid" value="${esc(p.paid)}" /></div>
        <label class="file"><input type="file" name="file" accept="application/pdf,image/*" /><span><i class="pic" data-picto="clip"></i></span><span id="fname">${p.file_path ? "Confirmation jointe ✓ (touche pour la remplacer)" : "Joindre la confirmation (PDF ou capture) · facultatif"}</span></label>
        ${p.file_path ? `<button type="button" class="linklike" data-action="openFile" data-path="${esc(p.file_path)}" style="justify-self:start">Ouvrir la confirmation</button>` : ""}
        <div class="field"><label>Note pour moi</label><textarea name="mynote" style="min-height:70px">${esc(p.mynote)}</textarea></div>
        <button class="btn dark block" type="submit">Enregistrer</button>
      </form>`);
    const f = document.getElementById("progForm");
    f.file.onchange = () => { if (f.file.files[0]) document.getElementById("fname").textContent = f.file.files[0].name; };
  }

  // fiche d'Erika : une réservation
  function editItem(id) {
    const it = id ? S.data.items.find((i) => i.id === id) : { type: "activity", position: S.data.items.length + 1 };
    const p = id ? prog(id) : null;
    showSheet(`<h2>${id ? "Modifier" : "Nouvelle réservation"}</h2>
      ${p && (p.done || p.ref) ? `<div class="note" style="margin:10px 0"><span class="ico">✓</span><span>Côté voyageur : ${p.done ? "réservé" : "pas encore"}${p.ref ? " · n° " + esc(p.ref) : ""}${p.paid ? " · " + esc(p.paid) : ""}${p.file_path ? " · confirmation jointe" : ""}</span></div>` : ""}
      <form id="itemForm" class="stack" style="margin-top:10px" data-id="${id || ""}">
        <div class="field"><label>Lieu connu (HodoReminder)</label><select name="rule"><option value="">Aucun</option>${HodoRules.RULES.map((r) => `<option value="${r.id}" ${it.rule === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select><span class="help">La date à partir de laquelle on peut réserver se calcule alors toute seule (avec la date « Pour le »).</span></div>
        <div class="field"><label>Type</label><select name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${it.type === k ? "selected" : ""}>${v.label}</option>`).join("")}</select></div>
        <div class="field"><label>Quoi *</label><input name="title" value="${esc(it.title)}" placeholder="ex. Hôtel à Kyoto · 3 nuits" /></div>
        <div class="field"><label>Où réserver</label><input name="where_label" value="${esc(it.where_label)}" placeholder="ex. Booking" /></div>
        <div class="field"><label>Lien</label><input name="link" type="url" value="${esc(it.link)}" placeholder="https://…" /></div>
        <div class="two"><div class="field"><label>Pour le</label><input name="date" type="date" value="${esc(it.date)}" /></div><div class="field"><label>Avant le</label><input name="deadline" type="date" value="${esc(it.deadline)}" /></div></div>
        <div class="field"><label>Prix indicatif</label><input name="price" value="${esc(it.price)}" placeholder="ex. ≈ 180 €" /></div>
        <div class="field"><label>Ton conseil</label><textarea name="note" style="min-height:70px">${esc(it.note)}</textarea></div>
        <label class="check"><input type="checkbox" name="urgent" ${it.urgent ? "checked" : ""} /> Urgent</label>
        <label class="check"><input type="checkbox" name="partner" ${it.partner ? "checked" : ""} /> Lien partenaire (affiché comme tel)</label>
        <p class="err hidden" id="err"></p>
        <button class="btn dark block" type="submit">Enregistrer</button>
        ${id ? `<button type="button" class="btn block" style="color:var(--red)" data-action="deleteItem" data-id="${id}">Supprimer</button>` : ""}
      </form>`);
  }

  // fiche d'Erika : un jour
  const stopRow = (s = {}) => `<div class="rowx" data-stop>
      <div class="rowx-head"><span>Étape</span><button type="button" class="mini-x" data-action="delRow" aria-label="Retirer">×</button></div>
      <div class="two"><input name="when" placeholder="Matin" value="${esc(s.when)}" /><select name="icon">${iconOptions(s.icon || "star")}</select></div>
      <input name="name" placeholder="Lieu *" value="${esc(s.name)}" />
      <textarea name="text" placeholder="Description" style="min-height:60px">${esc(s.text)}</textarea>
      <input name="tip" placeholder="Conseil (facultatif)" value="${esc(s.tip)}" />
      <div class="two"><input name="lat" inputmode="decimal" placeholder="Latitude" value="${s.lat ?? ""}" /><input name="lng" inputmode="decimal" placeholder="Longitude" value="${s.lng ?? ""}" /></div></div>`;
  const eatRow = (e = {}) => `<div class="rowx" data-eat>
      <div class="rowx-head"><span>À goûter</span><button type="button" class="mini-x" data-action="delRow" aria-label="Retirer">×</button></div>
      <div class="two"><input name="name" placeholder="Plat *" value="${esc(e.name)}" /><select name="icon">${iconOptions(e.icon || "ramen")}</select></div>
      <input name="text" placeholder="Où, comment" value="${esc(e.text)}" /></div>`;
  const pictoOptions = (sel) => (window.HodoPictos ? HodoPictos.names : ["sparkle"]).map((n) => `<option ${n === sel ? "selected" : ""}>${n}</option>`).join("");
  const iconOptions = (sel) => (window.HodoIcons ? HodoIcons.names : ["star"]).map((n) => `<option ${n === sel ? "selected" : ""}>${n}</option>`).join("");
  function editDay(id) {
    const d = id ? S.data.days.find((x) => x.id === id) : { color: "mint", icon: "star", stops: [], eat: [], published: false };
    showSheet(`<h2>${id ? "Modifier le jour" : "Nouveau jour"}</h2>
      <form id="dayForm" class="stack" style="margin-top:10px" data-id="${id || ""}">
        <div class="two"><div class="field"><label>Date *</label><input type="date" name="date" value="${esc(d.date)}" /></div><div class="field"><label>Ville (nuit)</label><input name="base" value="${esc(d.base)}" placeholder="Kyoto" /></div></div>
        <div class="field"><label>Titre *</label><input name="title" value="${esc(d.title)}" placeholder="ex. Fushimi Inari" /></div>
        <div class="field"><label>Sous-titre</label><input name="subtitle" value="${esc(d.subtitle)}" /></div>
        <div class="two"><div class="field"><label>Icône</label><select name="icon">${iconOptions(d.icon || "star")}</select></div>
          <div class="field"><label>Couleur</label><select name="color">${COLORS.map((c) => `<option ${d.color === c ? "selected" : ""}>${c}</option>`).join("")}</select></div></div>
        <div class="field"><label>Ton conseil du jour</label><textarea name="tip" style="min-height:60px">${esc(d.tip)}</textarea></div>
        <b>Programme</b><div id="stopRows" class="stack">${(d.stops || []).map(stopRow).join("")}</div>
        <button type="button" class="btn small" data-action="addStop">+ Étape</button>
        <b>À goûter</b><div id="eatRows" class="stack">${(d.eat || []).map(eatRow).join("")}</div>
        <button type="button" class="btn small" data-action="addEat">+ Spécialité</button>
        <div class="field"><label>À cocher <span class="small">(une case par ligne, ex. « Crème solaire »)</span></label><textarea name="checklist" style="min-height:70px">${esc((d.checklist || []).join("\n"))}</textarea></div>
        <label class="switch">Publié (visible par les voyageurs)<input type="checkbox" name="published" ${d.published ? "checked" : ""} /><i></i></label>
        <p class="err hidden" id="err"></p>
        <button class="btn dark block" type="submit">Enregistrer</button>
        ${id ? `<button type="button" class="btn block" style="color:var(--red)" data-action="deleteDay" data-id="${id}">Supprimer ce jour</button>` : ""}
      </form>`);
  }

  // =================== cartes ===================
  let maps = [];
  // Mapbox si un jeton est configuré, sinon CARTO
  const MAPBOX = (window.HODO_CONFIG || {}).mapboxToken;
  const tiles = () => MAPBOX
    ? L.tileLayer("https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=" + MAPBOX,
        { tileSize: 512, zoomOffset: -1, maxZoom: 19, attribution: '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> <a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener"><b>Améliorer cette carte</b></a>' })
    : L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 18, subdomains: "abcd", attribution: "© OpenStreetMap · © CARTO" });
  function baseMap(el, opts = {}) {
    const m = L.map(el, { zoomControl: false, ...opts });
    tiles().addTo(m);
    maps.push(m); return m;
  }
  const pin = (html, size) => L.divIcon({ className: "", html: `<div class="pin spot">${html}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
  function mountMaps() {
    if (!window.L) return;
    const tm = document.getElementById("tripMap");
    if (tm && S.data) {
      const m = baseMap(tm), all = [];
      S.data.days.forEach((d, i) => (d.stops || []).forEach((s) => {
        if (s.lat == null || s.lng == null) return;
        all.push([s.lat, s.lng]);
        L.marker([s.lat, s.lng], { icon: pin(icon(s.icon || "star", 22), 26) }).addTo(m)
          .bindPopup(`<b>${esc(s.name)}</b>Jour ${i + 1} · ${esc(d.title)}<br><button data-day="${i}" data-tabto="days">Voir la journée</button>`);
      }));
      if (all.length > 1) { L.polyline(all, { color: "#8fd6b1", weight: 3, dashArray: "6 6" }).addTo(m); m.fitBounds(all, { padding: [30, 30] }); }
      else m.setView(all[0] || [35.68, 139.76], all.length ? 12 : 5);
      setTimeout(() => { if (maps.includes(m)) m.invalidateSize(); }, 60);
    }
    const dm = document.getElementById("dayMap");
    if (dm && S.day !== null && S.data.days[S.day]) {
      const pts = S.data.days[S.day].stops.filter((s) => s.lat != null && s.lng != null);
      const m = baseMap(dm, { dragging: !L.Browser.mobile, scrollWheelZoom: false });
      pts.forEach((s, k) => L.marker([s.lat, s.lng], { icon: pin(icon(s.icon || "star", 22), 26) }).addTo(m).bindPopup(`<b>${k + 1}. ${esc(s.name)}</b>`));
      if (pts.length > 1) { L.polyline(pts.map((s) => [s.lat, s.lng]), { color: "#3b3a5e", weight: 2.5, dashArray: "3 6" }).addTo(m); m.fitBounds(pts.map((s) => [s.lat, s.lng]), { padding: [26, 26], maxZoom: 15 }); }
      else m.setView([pts[0].lat, pts[0].lng], 14);
      setTimeout(() => { if (maps.includes(m)) m.invalidateSize(); }, 60);
    }
  }

  // =================== rendu ===================
  function render(keepScroll) {
    const top = document.getElementById("scr")?.scrollTop || 0;
    maps.forEach((m) => { m.stop(); m.remove(); }); maps = [];
    $phone.innerHTML = SCREENS[S.screen]();
    const scr = document.getElementById("scr") || $phone.querySelector(".screen");
    if (scr) scr.scrollTop = keepScroll ? top : 0;
    mountMaps();
    if (S.screen === "adminTrip" && S.adminTab === "trip") loadMembers();
  }
  function toast(msg) {
    let el = document.querySelector(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2600);
  }
  const showErr = (msg) => { const e = document.querySelector("#sheet #err") || document.getElementById("err"); if (e) { e.textContent = msg; e.classList.remove("hidden"); } else toast(msg); };
  const niceErr = (e) => {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (/Code inconnu/i.test(m)) return "Ce code ne correspond à aucun voyage. Vérifie le message d’Erika.";
    if (/rate limit|too many/i.test(m)) return "Trop de demandes : attends quelques minutes avant de réessayer.";
    if (/expired|invalid/i.test(m)) return "Ce code a expiré ou n’est pas bon. Demande un nouveau mail.";
    if (/Failed to fetch|NetworkError/i.test(m)) return "Pas de connexion internet.";
    return m;
  };

  // =================== navigation et données ===================
  async function afterLogin() {
    S.screen = "loading"; render();
    try {
      const pending = localStorage.getItem(PENDING);
      if (pending) {
        localStorage.removeItem(PENDING);
        try { const id = await api.joinTrip(pending); S.tripId = id; } catch (e) { toast(niceErr(e)); }
      }
    } catch (_) {}
    try {
      S.profile = await api.profile();
      S.trips = await api.trips();
    } catch (e) { toast(niceErr(e)); S.trips = []; }
    if (isAdmin()) await countRequests();
    if (isAdmin() && !S.tripId) { S.screen = "adminHome"; render(); return; }
    if (S.tripId || S.trips.length === 1) return openTrip(S.tripId || S.trips[0].id, "traveler");
    S.screen = "trips"; render();
  }
  async function openTrip(id, view) {
    S.tripId = id; S.view = view;
    if (S.unsub) { S.unsub(); S.unsub = null; }
    try { S.data = await api.tripData(id); }
    catch (e) { toast(niceErr(e)); S.screen = isAdmin() ? "adminHome" : "trips"; render(); return; }
    S.unsub = api.subscribe(id, refreshSoon);
    S.screen = view === "admin" ? "adminTrip" : "trip";
    S.tab = "home"; S.day = null; S.me = false;
    render();
  }
  let refreshT;
  function refreshSoon() {
    clearTimeout(refreshT);
    refreshT = setTimeout(async () => {
      if (!S.tripId || document.getElementById("sheet")) return; // ne pas effacer une fiche en cours de saisie
      try { S.data = await api.tripData(S.tripId); render(true); } catch (_) {}
    }, 400);
  }
  async function reloadTrip() { S.data = await api.tripData(S.tripId); render(true); }
  async function countRequests() {
    try { S.newRequests = (await api.requests()).filter((r) => r.status === "nouveau").length; S.reqError = null; }
    catch (e) { S.newRequests = 0; S.reqError = niceErr(e); } // affiché sur la carte, sans bloquer le reste
  }
  async function loadMembers() {
    const el = document.getElementById("members"); if (!el) return;
    try {
      const ms = await api.members(S.tripId);
      el.innerHTML = ms.length ? ms.map((m) => `<div class="pill strong" style="margin:0 6px 6px 0">${esc(m.email)}</div>`).join("") : "Personne pour l’instant : envoie le code !";
    } catch (e) { el.textContent = niceErr(e); }
  }
  async function goAdminHome() {
    if (S.unsub) { S.unsub(); S.unsub = null; }
    S.tripId = null; S.data = null;
    try { S.trips = await api.trips(); } catch (e) { toast(niceErr(e)); }
    if (isAdmin()) await countRequests();
    S.screen = isAdmin() ? "adminHome" : "trips"; render();
  }

  // =================== clics ===================
  $phone.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-go],[data-tab],[data-filter],[data-open],[data-action],[data-day],[data-trip],[data-admintrip],[data-admintab],[data-reqfilter],[data-edititem],[data-editday]");
    if (!t) return;
    const d = t.dataset;
    if (d.go) {
      // depuis l'accueil, le bouton choisi décide si l'on demande un code de voyage
      if (d.go === "login" && t.closest(".screen.center")) S.withCode = !!d.withcode;
      S.screen = d.go; render();
    }
    else if (d.tab) { S.tab = d.tab; S.me = false; S.day = null; render(); }
    else if (d.day !== undefined) { if (d.tabto) S.tab = d.tabto; S.day = d.day === "back" ? null : +d.day; S.me = false; render(); }
    else if (d.filter) { S.filter = d.filter; render(true); }
    else if (d.open) openItem(d.open);
    else if (d.trip) openTrip(d.trip, "traveler");
    else if (d.admintrip) { S.adminTab = "items"; openTrip(d.admintrip, "admin"); }
    else if (d.admintab) { S.adminTab = d.admintab; render(); }
    else if (d.reqfilter) { S.reqFilter = d.reqfilter; render(true); }
    else if (d.edititem) editItem(d.edititem);
    else if (d.editday) editDay(d.editday);
    else if (d.action) action(d.action, t).catch((err) => showErr(niceErr(err)));
  });

  async function action(a, t) {
    if (a === "me") { S.me = !S.me; render(); }
    else if (a === "back" || a === "adminHome") goAdminHome();
    else if (a === "requests") {
      S.reqFilter = S.reqFilter || "nouveau";
      try { S.requests = await api.requests(); S.reqError = null; } catch (e) { S.requests = []; S.reqError = niceErr(e); }
      S.screen = "requests"; render();
    }
    else if (a === "reqDelete") {
      const r = S.requests.find((x) => x.id === t.dataset.id); if (!r) return;
      if (!confirm(`Supprimer définitivement la demande de ${r.firstname || "?"} (${r.destinations || "?"}) ?`)) return;
      const d = r.details || {};
      if (d.trip_id && confirm(`Supprimer aussi son voyage ${d.trip_code || ""} et tout son contenu ?\n(Annuler = garder le voyage)`)) {
        try { await api.deleteTrip(d.trip_id); } catch (e) { toast(niceErr(e)); }
      }
      await api.deleteRequest(r.id); S.requests = await api.requests(); render(true); toast("Demande supprimée");
    }
    else if (a === "reqMail") {
      const r = S.requests.find((x) => x.id === t.dataset.id); if (!r) return;
      const kind = MAILS[t.dataset.kind] ? t.dataset.kind : "valide", T = MAILS[kind];
      showSheet(`<h2>${T.label} · ${esc(r.firstname || "?")}</h2><p class="small">Envoyé à ${esc(r.email)} depuis contact@hodoplanner.com. Tu reçois une copie.</p>
        <div class="filters" style="margin-top:10px">${Object.entries(MAILS).filter(([k, m]) => !m.needsTrip || (r.details || {}).trip_code)
          .map(([k, m]) => `<button class="${k === kind ? "on" : ""}" data-action="reqMail" data-kind="${k}" data-id="${esc(r.id)}">${m.label}</button>`).join("")}</div>
        <form id="mailForm" class="stack" style="margin-top:10px"><input type="hidden" name="rid" value="${esc(r.id)}" /><input type="hidden" name="kind" value="${kind}" />
          <div class="field"><label>Objet</label><input name="subject" maxlength="150" value="${esc(T.subject(r))}" required /></div>
          ${kind === "valide" ? `<div class="field"><label>Prix confirmé</label><input name="price" maxlength="100" value="${esc((r.details || {}).quote_price || r.estimate || "")}" required /></div>` : ""}
          ${kind === "precisions" ? `<div class="field"><label>Nouveau prix (seulement s’il change)</label><input name="price" maxlength="100" placeholder="${esc(r.estimate || "")}" /></div>` : ""}
          <div class="field"><label>Message (modifiable)</label><textarea name="message" rows="12" maxlength="4000" required>${esc(T.text(r))}</textarea></div>
          ${kind === "valide" ? `<p class="small">Le voyage est créé à l’envoi (brief repris de sa demande). Le mail contient le prix, le code et les étapes : la personne valide son brief dans l’app, et tu reçois un mail à ce moment-là.</p>` : ""}
          <button class="btn dark block" type="submit"><i class="pic" data-picto="mail"></i> Envoyer</button></form>`);
    }
    else if (a === "toAdmin") { S.screen = "adminTrip"; S.adminTab = "items"; render(); }
    else if (a === "toTraveler") { S.screen = "trip"; S.tab = "home"; S.day = null; S.me = false; render(); }
    else if (a === "logout") { if (S.unsub) S.unsub(); await api.signOut(); Object.assign(S, { session: null, profile: null, trips: [], tripId: null, data: null, screen: "welcome" }); render(); }
    else if (a === "resend") { await api.sendLink(S.email); toast("Mail renvoyé"); }
    else if (a === "share") {
      const code = S.data.trip.code, text = `Rejoins notre voyage sur HodoPlanner : ouvre ${location.origin}${location.pathname} et entre le code ${code}`;
      try { if (navigator.share) await navigator.share({ title: "HodoPlanner", text }); else { await navigator.clipboard.writeText(code); toast("Code copié : " + code); } } catch (_) {}
    }
    else if (a === "ics") { const it = S.data.items.find((i) => i.id === t.dataset.id); HodoRules.downloadIcs(HodoRules.compute(it.rule, it.date), it.date); }
    else if (a === "openFile") { const url = await api.fileUrl(t.dataset.path); if (url) window.open(url, "_blank", "noopener"); }
    else if (a === "newTrip") { showSheet(`<h2>Nouveau voyage</h2><div style="margin-top:10px">${tripForm()}</div>`); }
    else if (a === "editItem") editItem(null);
    else if (a === "editDay") editDay(null);
    else if (a === "addStop") document.getElementById("stopRows").insertAdjacentHTML("beforeend", stopRow());
    else if (a === "addEat") document.getElementById("eatRows").insertAdjacentHTML("beforeend", eatRow());
    else if (a === "addSec") document.getElementById("secRows").insertAdjacentHTML("beforeend", secRow());
    else if (a === "delRow") t.closest(".rowx").remove();
    else if (a === "publishAll") {
      const drafts = S.data.days.filter((d) => !d.published);
      if (!confirm(`Publier les ${drafts.length} jours en brouillon ? Les voyageurs les verront tout de suite.`)) return;
      for (const d of drafts) await api.saveDay({ id: d.id, published: true });
      await reloadTrip(); toast("Tous les jours sont publiés");
    }
    else if (a === "checkUpdate") { if (window.HodoUpdate) { toast("Vérification…"); await HodoUpdate.check(); } }
    else if (a === "exportTrip") exportTrip();
    else if (a === "importTrip") document.getElementById("importFile").click();
    else if (a === "doImport") await doImport(t);
    else if (a === "deleteItem") { if (!confirm("Supprimer cette réservation ?")) return; await api.deleteItem(t.dataset.id); closeSheet(); await reloadTrip(); toast("Supprimé"); }
    else if (a === "deleteDay") { if (!confirm("Supprimer ce jour ?")) return; await api.deleteDay(t.dataset.id); closeSheet(); await reloadTrip(); toast("Supprimé"); }
    else if (a === "deleteTrip") {
      if (prompt(`Pour supprimer définitivement ce voyage et tout son contenu, écris : ${S.data.trip.code}`) !== S.data.trip.code) return;
      await api.deleteTrip(S.tripId); toast("Voyage supprimé"); goAdminHome();
    }
    else if (a === "install" && installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); }
  }

  // statut d'une demande (vue Erika)
  $phone.addEventListener("change", async (e) => {
    if (e.target.id === "importFile") { const file = e.target.files[0]; e.target.value = ""; if (file) readImport(file); return; }
    const ck = e.target.closest("[data-check]");
    if (ck) {
      const key = ck.dataset.check, done = ck.checked;
      S.data.checks = (S.data.checks || []).filter((c) => c.key !== key).concat(done ? [{ key, done: true }] : []);
      try { await api.setCheck(S.tripId, key, done); }
      catch (err) { ck.checked = !done; toast(/checks/.test(niceErr(err)) ? "Les listes à cocher ne sont pas encore activées (script 05-listes.sql)." : niceErr(err)); }
      return;
    }
    const sel = e.target.closest("[data-reqstatus]"); if (!sel) return;
    try { await api.updateRequest(sel.dataset.reqstatus, { status: sel.value }); S.requests = await api.requests(); render(true); toast("Statut : " + sel.value); }
    catch (err) { toast(niceErr(err)); }
  });

  // =================== formulaires ===================
  const val = (f, n) => (f.elements[n] ? String(f.elements[n].value || "").trim() : "");
  const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
  $phone.addEventListener("submit", (e) => {
    e.preventDefault();
    submit(e.target).catch((err) => showErr(niceErr(err)));
  });
  // étapes d'une demande : valider (ou demander des précisions) → créer le voyage + envoyer le code
  function stepBtns(r) {
    const d = r.details || {}, sent = d.sent || {}, id = esc(r.id);
    const b = (kind, label, picto, main) => `<button class="btn small ${main ? "dark" : ""}" data-action="reqMail" data-kind="${kind}" data-id="${id}"><i class="pic" data-picto="${picto}"></i> ${label}</button>`;
    const trip = d.trip_id && (S.trips || []).find((x) => x.id === d.trip_id);
    const st = trip ? STATUS[trip.status] || STATUS.brief : null;
    return [
      sent.valide ? "" : b("precisions", sent.precisions ? "✓ Précisions" : "Précisions ?", "chat", false),
      sent.valide ? "" : b("valide", "Valider + envoyer le code", "sparkle", true),
      d.trip_id ? `<button class="btn small" data-admintrip="${esc(d.trip_id)}"><i class="pic" data-picto="backpack"></i> ${esc(d.trip_code || "Voyage")}${st ? ` <span class="pill ${st[1]}" style="font-size:10.5px">${st[0]}</span>` : ""}</button>` : "",
      sent.valide ? b("code", "Renvoyer le code", "phone", false) : "",
    ].join("");
  }
  // voyage créé à partir d'une demande : destination, prénom, dates, prix et brief repris tels quels
  const PRIVATE = ["Prénom", "Email", "WhatsApp", "Estimation", "Venu de", "trip_id", "trip_code", "sent", "quote_price"];
  async function tripFromRequest(r, price) {
    const d = r.details || {};
    if (d.trip_id) return { id: d.trip_id, code: d.trip_code };
    const dates = String(d.Dates || "").match(/(\d{4}-\d\d-\d\d)\s*→\s*(\d{4}-\d\d-\d\d)/);
    const brief = Object.fromEntries(Object.entries(d).filter(([k, v]) => !PRIVATE.includes(k) && typeof v === "string"));
    const saved = await api.saveTrip({ title: r.destinations || "Voyage", travelers: r.firstname ? [r.firstname] : [],
      start_date: dates ? dates[1] : null, end_date: dates ? dates[2] : null, status: "brief", price: price || r.estimate || null, brief });
    await api.updateRequest(r.id, { status: "client", details: { ...d, trip_id: saved.id, trip_code: saved.code } });
    return saved;
  }
  function sentLine(r) {
    const sent = (r.details || {}).sent || {}, when = (iso) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const parts = Object.entries(sent).map(([k, v]) => `${(MAILS[k] || { label: k }).label} le ${when(v)}`);
    return parts.length ? `<small class="small" style="display:block;margin-top:6px">Envoyé : ${parts.join(" · ")}</small>` : "";
  }

  // mails proposés depuis une demande (Erika peut tout modifier avant l'envoi)
  const isFree = (r) => /offert/i.test(r.estimate || "") || /offert/i.test((r.details || {}).quote_price || "");
  const MAILS = {
    valide: {
      label: "Validation",
      subject: (r) => `C’est validé : ton espace voyage t’attend${r.destinations ? " · " + r.destinations : ""}`,
      text: (r) => `Bonjour ${r.firstname || ""} !

Bonne nouvelle : ta demande${r.destinations ? " (" + r.destinations + ")" : ""} est validée, je peux préparer ce voyage.
${isFree(r) ? "\nPendant le lancement, c’est offert : en échange, je te demande juste un avis honnête après ton voyage.\n" : ""}
Dernière étape avant que je commence : ouvre l’app avec ton code ci-dessous, relis ton brief et valide-le${isFree(r) ? "" : " en réglant le paiement"}. Je me mets au travail dès ta validation.

À très vite,
Erika`,
    },
    precisions: {
      label: "Précisions",
      subject: (r) => `Quelques questions sur ton voyage${r.destinations ? " · " + r.destinations : ""}`,
      text: (r) => `Bonjour ${r.firstname || ""} !

Merci pour ta demande de voyage${r.destinations ? " (" + r.destinations + ")" : ""}. Avant de la valider, j’ai besoin de quelques précisions :

- 
- 

Réponds simplement à ce mail, et je te confirme tout ensuite.

À très vite,
Erika`,
    },
    code: {
      label: "Code de l’app", needsTrip: true,
      subject: () => "Ton code HodoPlanner",
      text: (r) => `Bonjour ${r.firstname || ""} !

Voici à nouveau ton code pour retrouver ton voyage dans l’app : tout ce qu’il faut réserver (avec les liens), ton programme jour par jour, la carte et les infos pratiques.

À très vite,
Erika`,
    },
    libre: {
      label: "Message libre",
      subject: (r) => `Ton voyage HodoPlanner${r.destinations ? " · " + r.destinations : ""}`,
      text: (r) => `Bonjour ${r.firstname || ""} !



À très vite,
Erika`,
    },
  };

  async function submit(f) {
    const btn = f.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
    try {
      if (f.id === "loginForm") {
        S.email = val(f, "email");
        if (S.withCode) {
          const code = val(f, "code").toUpperCase();
          if (!/^HODO-[A-Z0-9]{4,}$/.test(code)) throw new Error("Le code ressemble à HODO-XXXXXX.");
          try { localStorage.setItem(PENDING, code); } catch (_) {}
        }
        if (!/^\S+@\S+\.\S+$/.test(S.email)) throw new Error("Indique un email valide.");
        await api.sendLink(S.email);
        S.screen = "check"; render();
      } else if (f.id === "codeForm") {
        const token = val(f, "token").replace(/\s/g, "");
        if (!token) throw new Error("Entre le code reçu, ou clique sur le lien du mail.");
        await api.verifyCode(S.email, token);
        await afterLogin();
      } else if (f.id === "joinForm") {
        const id = await api.joinTrip(val(f, "code"));
        S.trips = await api.trips(); await openTrip(id, "traveler");
      } else if (f.id === "progForm") {
        const id = f.dataset.id, it = S.data.items.find((i) => i.id === id), old = prog(id) || {};
        let file_path = old.file_path || null;
        if (f.file.files[0]) { toast("Envoi de la confirmation…"); file_path = await api.upload(S.tripId, id, f.file.files[0]); }
        await api.saveProgress({ item_id: id, trip_id: it.trip_id, done: f.done.checked, ref: val(f, "ref") || null, paid: val(f, "paid") || null, mynote: val(f, "mynote") || null, file_path });
        closeSheet(); await reloadTrip(); toast(f.done.checked ? "Bien joué, c’est coché ✓" : "Enregistré");
      } else if (f.id === "itemForm") {
        const rule = val(f, "rule"), title = val(f, "title") || (HodoRules.RULES.find((r) => r.id === rule) || {}).name;
        if (!title) throw new Error("Indique au moins « Quoi ».");
        const row = { trip_id: S.tripId, rule: rule || null, type: val(f, "type"), title, where_label: val(f, "where_label") || null, link: val(f, "link") || null,
          date: val(f, "date") || null, deadline: val(f, "deadline") || null, price: val(f, "price") || null, note: val(f, "note") || null,
          urgent: f.urgent.checked, partner: f.partner.checked };
        if (f.dataset.id) row.id = f.dataset.id; else row.position = S.data.items.length + 1;
        await api.saveItem(row); closeSheet(); await reloadTrip(); toast("Enregistré : le voyageur le voit tout de suite");
      } else if (f.id === "dayForm") {
        if (!val(f, "date") || !val(f, "title")) throw new Error("Date et titre sont obligatoires.");
        const stops = [...f.querySelectorAll("[data-stop]")].map(rowVals)
          .map((s) => ({ when: s.when, name: s.name, text: s.text, tip: s.tip, icon: s.icon, lat: num(s.lat), lng: num(s.lng) })).filter((s) => s.name);
        const eat = [...f.querySelectorAll("[data-eat]")].map(rowVals).map((x) => ({ name: x.name, text: x.text, icon: x.icon })).filter((x) => x.name);
        const row = { trip_id: S.tripId, date: val(f, "date"), title: val(f, "title"), subtitle: val(f, "subtitle") || null, base: val(f, "base") || null,
          icon: val(f, "icon"), color: val(f, "color"), tip: val(f, "tip") || null, stops, eat, checklist: lines(val(f, "checklist")), published: f.published.checked };
        if (f.dataset.id) row.id = f.dataset.id;
        await api.saveDay(row); closeSheet(); await reloadTrip(); toast(row.published ? "Publié : visible par les voyageurs" : "Brouillon enregistré");
      } else if (f.id === "infosForm") {
        const practical = [...f.querySelectorAll("[data-sec]")].map((r) => ({ ...rowVals(r), list: r.querySelector("[data-list]").checked }))
          .map((x) => ({ icon: x.icon, title: x.title, text: x.text, source: x.source, ...(x.list ? { list: true } : {}) })).filter((x) => x.title || x.text);
        await api.saveTrip({ id: S.tripId, practical }); await reloadTrip(); toast("Infos pratiques enregistrées");
      } else if (f.id === "briefForm") {
        const st = await api.validateBrief(S.tripId, val(f, "note"));
        await reloadTrip(); scrollTo(0, 0);
        toast(st === "in_progress" ? "Merci ! Je commence les recherches" : "Merci ! Je t’envoie le lien de paiement");
      } else if (f.id === "mailForm") {
        const id = val(f, "rid"), r = S.requests.find((x) => x.id === id);
        if (val(f, "kind") === "valide" && r) { await tripFromRequest(r, val(f, "price")); S.trips = await api.trips(); }
        await api.sendMail({ request_id: id, kind: val(f, "kind"), subject: val(f, "subject"), price: val(f, "price"), message: val(f, "message") });
        closeSheet(); S.requests = await api.requests(); S.trips = await api.trips(); render(true); toast("Mail envoyé à " + (r ? r.email : "?"));
      } else if (f.id === "tripForm") {
        const row = { title: val(f, "title"), emoji: val(f, "emoji") || "torii", country: val(f, "country").toUpperCase() || null,
          travelers: val(f, "travelers").split(",").map((x) => x.trim()).filter(Boolean),
          start_date: val(f, "start_date") || null, end_date: val(f, "end_date") || null, status: val(f, "status") || "brief", price: val(f, "price") || null };
        if (!row.title) throw new Error("Indique la destination.");
        const inSheet = !!f.closest("#sheet");
        if (!inSheet) row.id = S.tripId;
        const saved = await api.saveTrip(row);
        if (inSheet) { closeSheet(); S.adminTab = "trip"; await openTrip(saved.id, "admin"); toast("Voyage créé · code " + saved.code); }
        else { await reloadTrip(); toast("Enregistré"); }
      }
    } finally { if (btn && document.body.contains(btn)) btn.disabled = false; }
  }
  // valeurs des champs nommés d'un bloc répété
  function rowVals(r) {
    const o = {};
    r.querySelectorAll("[name]").forEach((el) => { o[el.name] = String(el.value || "").trim(); });
    return o;
  }

  // =================== installer l'app ===================
  let installEvt = null;
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (S.screen === "welcome") render(); });
  function installBox() {
    if (standalone()) return "";
    if (installEvt) return `<button class="btn yellow" data-action="install" style="width:100%;max-width:310px"><i class="pic" data-picto="phone"></i> Installer l’app sur mon téléphone</button>`;
    const ua = navigator.userAgent;
    let how;
    if (/; wv\)|FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua)) how = "Tu es dans le navigateur d’une autre app. Ouvre d’abord ce lien dans <b>Chrome</b>.";
    else if (/SamsungBrowser/i.test(ua)) how = "Menu <b>≡</b> → <b>Ajouter la page à</b> → <b>Écran d’accueil</b>.";
    else if (/iPhone|iPad|iPod/i.test(ua)) how = "Dans <b>Safari</b> : <b>Partager</b> ⬆️ → <b>Sur l’écran d’accueil</b>.";
    else if (/Android/i.test(ua)) how = "Dans <b>Chrome</b> : menu <b>⋮</b> → <b>Ajouter à l’écran d’accueil</b> → <b>Installer</b>.";
    else how = "Menu du navigateur → « Installer » ou « Ajouter à l’écran d’accueil ».";
    return `<div class="note" style="text-align:left;width:100%;max-width:310px"><span class="ico"><i class="pic" data-picto="phone"></i></span><span><b>Installer l’app :</b> ${how}</span></div>`;
  }

  // =================== bouton retour du téléphone ===================
  // Une « marche » d'historique sert de garde : le bouton retour ferme d'abord la fiche ouverte,
  // puis remonte d'un écran ; il ne quitte l'app que depuis l'écran de départ.
  function stepBack() {
    if (document.getElementById("usheet")) { document.getElementById("later")?.click(); return true; }
    if (document.getElementById("sheet")) { closeSheet(); return true; }
    if (S.screen === "trip") {
      if (S.me) { S.me = false; render(); return true; }
      if (S.day !== null) { S.day = null; render(); return true; }
      if (S.tab !== "home") { S.tab = "home"; S.day = null; render(); return true; }
      if (isAdmin()) { S.screen = "adminTrip"; render(); return true; }
      if (S.trips.length > 1) { action("back").catch(() => {}); return true; }
      return false;
    }
    if (S.screen === "adminTrip" || S.screen === "requests") { goAdminHome(); return true; }
    if (S.screen === "check") { S.screen = "login"; render(); return true; }
    if (S.screen === "login") { S.screen = "welcome"; render(); return true; }
    return false;
  }
  try {
    history.replaceState({ hodo: "racine" }, "");
    history.pushState({ hodo: "garde" }, "");
    window.addEventListener("popstate", () => {
      if (stepBack()) history.pushState({ hodo: "garde" }, "");
      else history.back(); // écran de départ : on laisse vraiment partir
    });
  } catch (_) {}

  // =================== démarrage ===================
  let booted = false;
  api.onAuth((s) => {
    const was = !!S.session; S.session = s;
    if (s && !was && booted && ["welcome", "login", "check", "loading"].includes(S.screen)) afterLogin();
    if (!s && was) { S.screen = "welcome"; render(); }
  });
  (async () => {
    try { S.session = await api.session(); } catch (_) { S.session = null; }
    booted = true;
    if (S.session) afterLogin(); else { S.screen = "welcome"; render(); }
  })();
})();
