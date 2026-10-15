/* HodoReminder · quand les réservations ouvrent, lieu par lieu.
   Partagé par la page Rappels et l'app HodoPlanner (plus tard : la base de données commune Hodo).
   Chaque règle calcule le moment d'ouverture à partir de la date de visite.
   verified:false = règle approximative, à confirmer sur le site officiel avant de s'y fier. */
(() => {
  "use strict";

  /** Un instant précis à l'heure locale d'un pays (décalage fixe, sans heure d'été : Japon UTC+9). */
  const at = (y, m, d, hh, mm, offset) => new Date(Date.UTC(y, m, d, hh - offset, mm));
  const parts = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m: m - 1, d }; };
  const JST = 9;

  const RULES = [
    {
      id: "ghibli-park", name: "Ghibli Park", place: "Nagakute (Nagoya)", country: "Japon", icon: "star",
      link: "https://ghibli-park.jp/en/", verified: true,
      how: "Billets en vente le 10 du mois, deux mois avant le mois de la visite, à 14:00 heure du Japon.",
      opens: (iso) => { const { y, m } = parts(iso); return at(y, m - 2, 10, 14, 0, JST); },
    },
    {
      id: "pokemon-cafe", name: "Pokémon Café", place: "Tokyo et Osaka", country: "Japon", icon: "cup",
      link: "https://www.pokemoncenter-online.com/cafe/", verified: true,
      how: "Réservations 31 jours avant, à 18:00 heure du Japon. Les créneaux partent en quelques minutes.",
      opens: (iso) => { const { y, m, d } = parts(iso); return at(y, m, d - 31, 18, 0, JST); },
    },
    {
      id: "kirby-cafe", name: "Kirby Café", place: "Tokyo", country: "Japon", icon: "pancake",
      link: "https://kirbycafe.jp/", verified: false,
      how: "Ouverture souvent le 10 du mois précédent, à 18:00 heure du Japon.",
      opens: (iso) => { const { y, m } = parts(iso); return at(y, m - 1, 10, 18, 0, JST); },
    },
    {
      id: "pokepark-kanto", name: "PokéPark KANTO", place: "Yomiuriland (Tokyo)", country: "Japon", icon: "pokeball",
      link: "https://www.pokepark-kanto.co.jp/", verified: false,
      how: "Loterie environ trois mois avant, en général au début du mois. Les dates exactes sont annoncées sur le site officiel.",
      opens: (iso) => { const { y, m } = parts(iso); return at(y, m - 3, 1, 10, 0, JST); },
    },
    {
      id: "ana-blue-hangar", name: "ANA Blue Hangar Tour", place: "Haneda (Tokyo)", country: "Japon", icon: "ticket",
      link: "https://www.anahd.co.jp/group/tour/ana-blue-hangar/", verified: false,
      how: "Visite gratuite, réservation en ligne environ 30 jours avant.",
      opens: (iso) => { const { y, m, d } = parts(iso); return at(y, m, d - 30, 9, 30, JST); },
    },
    {
      id: "shibuya-sky", name: "Shibuya Sky", place: "Tokyo", country: "Japon", icon: "tower",
      link: "https://www.shibuya-scramble-square.com/sky/", verified: false,
      how: "Billets en ligne environ 4 semaines avant. Le créneau du coucher de soleil part en premier.",
      opens: (iso) => { const { y, m, d } = parts(iso); return at(y, m, d - 28, 0, 0, JST); },
    },
  ];

  /** Le rappel : l'ouverture, plus un rappel la veille. */
  function compute(ruleId, visitIso) {
    const r = RULES.find((x) => x.id === ruleId);
    if (!r || !visitIso) return null;
    const opens = r.opens(visitIso);
    return { rule: r, opens, eve: new Date(opens.getTime() - 86400000) };
  }

  /** Date et heure, chez la personne et au Japon. */
  function describe(date) {
    const local = date.toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const there = date.toLocaleString("fr-FR", { timeZone: "Asia/Tokyo", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    return { local, there };
  }

  /** Fichier .ics : un évènement de 30 min à l'ouverture, avec alarmes la veille et 15 min avant. */
  function ics(result, visitIso) {
    const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const end = new Date(result.opens.getTime() + 30 * 60000);
    const r = result.rule;
    const text = (s) => s.replace(/[,;\\]/g, (c) => "\\" + c);
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HodoPlanner//HodoReminder//FR", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${r.id}-${visitIso}@hodoplanner`,
      `DTSTAMP:${z(new Date())}`, `DTSTART:${z(result.opens)}`, `DTEND:${z(end)}`,
      `SUMMARY:${text("Réserver : " + r.name)}`,
      `DESCRIPTION:${text(`Visite prévue le ${visitIso}. ${r.how} ${r.link}`)}`,
      `URL:${r.link}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${text("Demain : " + r.name)}`, "TRIGGER:-P1D", "END:VALARM",
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${text("Dans 15 min : " + r.name)}`, "TRIGGER:-PT15M", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
  }

  function downloadIcs(result, visitIso) {
    const blob = new Blob([ics(result, visitIso)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rappel-${result.rule.id}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  window.HodoRules = { RULES, compute, describe, ics, downloadIcs };
})();
