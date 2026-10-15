/* HodoPlanner · fonctions partagées : icônes, calcul du devis, envoi des demandes */
(() => {
  "use strict";

  // ============================================================
  //  RÉGLAGES (à modifier ici)
  // ============================================================

  // ID du formulaire Formspree (https://formspree.io → "New form" → l'ID après /f/).
  // Tant qu'il est vide, la demande s'ouvre dans l'app mail avec tout le contenu prérempli.
  const FORMSPREE_ID = "";
  const CONTACT_EMAIL = "hello@erikaramel.com";

  // Offre de lancement : true = la planification est offerte (contre un avis).
  const LAUNCH_FREE = true;

  // Formule du devis :
  //   prix = BASE + Σ (tarif du jour × poids du jour) + options
  //   tarif du jour = DAY_MIN + DAY_PCT × (budget sur place ÷ nombre de jours), plafonné à DAY_MAX
  //   poids du jour : jours 1–14 = 1, jours 15–30 = 0,6, au-delà = 0,35 (les longs voyages coûtent moins par jour)
  const PRICING = {
    BASE: 29,             // brief, recherche de départ, mise en page du carnet
    DAY_MIN: 6,           // € par jour, même pour un petit budget
    DAY_PCT: 0.02,        // + 2 % du budget quotidien (tout le groupe)
    DAY_MAX: 22,          // € par jour au maximum
    TIERS: [[14, 1], [30, 0.6], [Infinity, 0.35]],
    BIG_GROUP: { from: 5, factor: 1.1 },          // 5 voyageurs ou plus : +10 %
    COMPLEXITY: { simple: 1, multi: 1.08, countries: 1.15 },
    REMINDERS: 15,        // option « rappels de réservation » (forfait)
    ON_TRIP_PER_DAY: 3,   // option « dispo pendant le voyage » (€ par jour)
    MIN: 39,
    QUOTE_ABOVE: 490,     // au-delà : devis personnalisé
  };

  // Niveaux de budget proposés (€ par personne et par jour, sur place, hors vols)
  const BUDGET_LEVELS = { eco: 80, confort: 150, plaisir: 300 };

  // ============================================================

  const DESTINATIONS = {
    "japan": "Japon", "south-korea": "Corée du Sud", "vietnam": "Viêt Nam", "indonesia": "Indonésie",
    "singapore": "Singapour", "jordan": "Jordanie", "hong-kong": "Hong Kong", "china": "Chine",
    "belgium": "Belgique", "luxembourg": "Luxembourg", "france": "France", "italy": "Italie",
    "iceland": "Islande", "romania": "Roumanie", "poland": "Pologne", "cyprus": "Chypre",
    "turkiye": "Turquie", "germany": "Allemagne", "hungary": "Hongrie", "norway": "Norvège",
    "egypt": "Égypte", "morocco": "Maroc", "lesotho": "Lesotho", "namibia": "Namibie",
    "south-africa": "Afrique du Sud", "botswana": "Botswana", "ireland": "Irlande",
    "united-kingdom": "Royaume-Uni", "denmark": "Danemark", "sweden": "Suède",
    "portugal": "Portugal", "spain": "Espagne", "switzerland": "Suisse", "austria": "Autriche",
    "netherlands": "Pays-Bas", "thailand": "Thaïlande", "taiwan": "Taïwan",
  };

  const round5 = (v) => Math.round(v / 5) * 5;
  const euro = (v) => `${Math.round(v).toLocaleString("fr-FR")} €`;

  /** Nombre de jours pondérés (dégressif) pour une durée donnée. */
  function weightedDays(days) {
    let left = days, prev = 0, total = 0;
    for (const [upTo, w] of PRICING.TIERS) {
      const n = Math.max(0, Math.min(left, upTo - prev));
      total += n * w; left -= n; prev = upTo;
      if (left <= 0) break;
    }
    return total;
  }

  /**
   * Estimation du prix de la planification.
   * days : durée du voyage · budget : budget sur place pour tout le groupe (hors vols) · people : voyageurs
   * complexity : simple | multi | countries · reminders : bool · onTrip : bool
   */
  function estimate({ days, budget, people = 1, complexity = "simple", reminders = false, onTrip = false }) {
    days = Math.max(1, Math.round(days || 1));
    people = Math.max(1, Math.round(people || 1));
    budget = Math.max(0, budget || 0);
    const P = PRICING;
    const perDay = budget / days;
    const dayRate = Math.min(P.DAY_MAX, P.DAY_MIN + P.DAY_PCT * perDay);
    const wDays = weightedDays(days);
    let planning = P.BASE + dayRate * wDays;
    const factor = (P.COMPLEXITY[complexity] || 1) * (people >= P.BIG_GROUP.from ? P.BIG_GROUP.factor : 1);
    planning *= factor;
    const extras = (reminders ? P.REMINDERS : 0) + (onTrip ? P.ON_TRIP_PER_DAY * days : 0);
    const total = Math.max(P.MIN, round5(planning + extras));
    return {
      days, people, budget, perDay, dayRate, wDays, factor, extras, total,
      custom: total > P.QUOTE_ABOVE,
      free: LAUNCH_FREE,
    };
  }

  /** Dessine les icônes kawaii : <span data-icon="train" data-size="48"></span> */
  function drawIcons(root = document) {
    if (!window.HodoIcons) return;
    root.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML = HodoIcons.icon(el.dataset.icon, +el.dataset.size || 48);
    });
  }

  function toast(msg) {
    let el = document.querySelector(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2800);
  }

  /** Envoie la demande via Formspree, sinon ouvre un mail prérempli. `lines` = texte lisible du récap. */
  async function send(fd, subject, lines) {
    if (FORMSPREE_ID) {
      fd.append("_subject", subject);
      const r = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, { method: "POST", headers: { Accept: "application/json" }, body: fd });
      if (!r.ok) throw new Error(`Formspree HTTP ${r.status}`);
      return "sent";
    }
    location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    return "mail";
  }

  function destinationFromUrl() {
    const d = new URLSearchParams(location.search).get("destination");
    return d ? (DESTINATIONS[d] || d.replace(/-/g, " ")) : "";
  }

  document.addEventListener("DOMContentLoaded", () => {
    drawIcons();
    const y = document.getElementById("y");
    if (y) y.textContent = new Date().getFullYear();
    // Les liens venant de HodoGuides (?destination=…) sont transmis au devis.
    if (location.search) document.querySelectorAll("a[data-keep-query]").forEach((a) => {
      const [path, hash] = a.getAttribute("href").split("#");
      a.href = path + location.search + (hash ? "#" + hash : "");
    });
  });

  window.Planner = {
    estimate, weightedDays, euro, drawIcons, toast, send, destinationFromUrl,
    PRICING, BUDGET_LEVELS, LAUNCH_FREE, CONTACT_EMAIL, hasForm: !!FORMSPREE_ID,
  };
})();
