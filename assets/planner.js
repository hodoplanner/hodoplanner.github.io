/* HodoPlanner · fonctions partagées : icônes, calcul du devis, envoi des demandes */
(() => {
  "use strict";

  // ============================================================
  //  RÉGLAGES (à modifier ici)
  // ============================================================

  // ID du formulaire Formspree (https://formspree.io → "New form" → l'ID après /f/).
  // Tant qu'il est vide, la demande s'ouvre dans l'app mail avec tout le contenu prérempli.
  const FORMSPREE_ID = "";
  const CONTACT_EMAIL = "contact@hodoplanner.com";

  // Offre de lancement : true = la planification est offerte (contre un avis).
  const LAUNCH_FREE = true;

  // Le service est-il ouvert ? false = mode « bientôt » : bannière en haut des pages,
  // et le devis inscrit à la liste d'attente au lieu d'envoyer une demande.
  const OPEN = false;
  const OPENING = "2027";

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

  // Repères de budget sur place (€ par personne et par jour, hors vols internationaux),
  // par groupe de pays : [petit budget, confort, se faire plaisir].
  // « words » = mots reconnus dans le champ destination (sans accents, en minuscules).
  const COST_ZONES = [
    { name: "l’Asie du Sud-Est", eco: 30, confort: 60, plaisir: 130,
      words: ["vietnam", "viet nam", "thailande", "indonesie", "bali", "cambodge", "laos", "philippines", "malaisie", "sri lanka", "inde", "nepal"] },
    { name: "le Japon", eco: 60, confort: 120, plaisir: 250, words: ["japon", "tokyo", "kyoto", "osaka", "hokkaido", "okinawa"] },
    { name: "la Corée du Sud", eco: 50, confort: 100, plaisir: 200, words: ["coree", "seoul", "busan", "jeju"] },
    { name: "la Chine et Taïwan", eco: 45, confort: 90, plaisir: 190, words: ["chine", "pekin", "shanghai", "taiwan", "taipei"] },
    { name: "Singapour et Hong Kong", eco: 70, confort: 140, plaisir: 280, words: ["singapour", "hong kong", "hongkong", "macao"] },
    { name: "l’Europe de l’Ouest", eco: 70, confort: 130, plaisir: 250,
      words: ["france", "belgique", "italie", "espagne", "portugal", "allemagne", "pays-bas", "pays bas", "luxembourg", "autriche", "irlande", "royaume-uni", "angleterre", "ecosse", "londres", "paris", "rome", "barcelone", "grece", "chypre", "malte"] },
    { name: "le Nord de l’Europe et la Suisse", eco: 100, confort: 180, plaisir: 330,
      words: ["suisse", "islande", "norvege", "suede", "danemark", "finlande", "laponie"] },
    { name: "l’Europe de l’Est et la Turquie", eco: 40, confort: 80, plaisir: 160,
      words: ["roumanie", "pologne", "hongrie", "turquie", "croatie", "tchequie", "prague", "bulgarie", "albanie", "georgie", "istanbul"] },
    { name: "le Maghreb, l’Égypte et la Jordanie", eco: 35, confort: 75, plaisir: 160, words: ["maroc", "tunisie", "egypte", "jordanie"] },
    { name: "l’Afrique australe", eco: 60, confort: 130, plaisir: 280, words: ["afrique du sud", "namibie", "botswana", "lesotho", "zimbabwe", "tanzanie", "kenya"] },
    { name: "l’Amérique du Nord", eco: 90, confort: 170, plaisir: 320, words: ["etats-unis", "etats unis", "usa", "canada", "new york", "californie", "hawai"] },
    { name: "l’Amérique latine", eco: 40, confort: 85, plaisir: 180, words: ["mexique", "perou", "bolivie", "colombie", "argentine", "chili", "bresil", "costa rica", "guatemala", "cuba"] },
    { name: "l’Océanie", eco: 80, confort: 150, plaisir: 290, words: ["australie", "nouvelle-zelande", "nouvelle zelande"] },
  ];
  const DEFAULT_COST = { name: "", eco: 60, confort: 110, plaisir: 230 };

  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  /** Repères de budget pour le texte de destination (moyenne si plusieurs zones). */
  function costFor(destText) {
    const t = norm(destText);
    const found = COST_ZONES.filter((z) => z.words.some((w) => t.includes(w)));
    if (!found.length) return { ...DEFAULT_COST, known: false };
    const avg = (k) => round5(found.reduce((s, z) => s + z[k], 0) / found.length);
    return { name: found.map((z) => z.name).join(" + "), eco: avg("eco"), confort: avg("confort"), plaisir: avg("plaisir"), known: true };
  }

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
    if (!OPEN && !document.body.hasAttribute("data-no-banner")) {
      const b = document.createElement("div");
      b.className = "soon-banner";
      b.innerHTML = `<i class="pic" data-picto="sprout"></i> HodoPlanner ouvre en ${OPENING} · <a href="/devis.html#contact">préviens-moi au lancement</a>`;
      document.body.prepend(b);
    }
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
    PRICING, costFor, COST_ZONES, LAUNCH_FREE, OPEN, OPENING, CONTACT_EMAIL, hasForm: !!FORMSPREE_ID,
  };
})();
