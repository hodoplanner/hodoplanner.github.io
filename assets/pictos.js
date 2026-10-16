/* HodoPlanner · pictogrammes de l'interface (remplacent les emojis), dans le style du lapin :
   contour marine, remplissages pastel. 32×32.
   Dans le HTML : <i class="pic" data-picto="bell"></i>   ·   en JS : HodoPictos.svg("bell", 22) */
(() => {
  "use strict";
  const INK = "#3b3a5e";
  const S = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
  const C = { pink: "#f6a9b9", pinkS: "#fde3ea", blue: "#a9cdf2", blueS: "#e3f0fc", mint: "#8fd6b1", mintS: "#dff5ea", yellow: "#ffd98a", yellowS: "#fff3d6", lav: "#c9b9f2", lavS: "#efe9fc", red: "#ec5866", white: "#fff", cream: "#fffdf9" };

  const P = {
    backpack: `<path d="M10 12c0-4 2.7-6.5 6-6.5s6 2.5 6 6.5" fill="none" ${S}/><rect x="7" y="10" width="18" height="18" rx="5" fill="${C.lav}" ${S}/><rect x="11" y="18" width="10" height="7" rx="2" fill="${C.lavS}" ${S}/><path d="M14 21.5h4" ${S}/>`,
    plane: `<path d="M16 3.5c1.1 0 1.8 1 1.8 2.4v6.4l8.7 4.9v2.9l-8.7-2.5v6l2.8 2v1.8L16 26.1l-4.6 1.3v-1.8l2.8-2v-6l-8.7 2.5v-2.9l8.7-4.9V5.9c0-1.4.7-2.4 1.8-2.4z" fill="${C.blue}" ${S}/>`,
    gift: `<rect x="6" y="14" width="20" height="13" rx="2" fill="${C.pinkS}" ${S}/><rect x="4.5" y="10" width="23" height="5" rx="1.5" fill="${C.pink}" ${S}/><path d="M16 10v17" ${S}/><path d="M16 10c-2-4-7-5-7-2s4 2 7 2c3 0 7 1 7-2s-5-2-7 2z" fill="${C.yellow}" ${S}/>`,
    bell: `<path d="M9.5 22v-7.5a6.5 6.5 0 0 1 13 0V22l2 2.5h-17z" fill="${C.yellow}" ${S}/><path d="M13.5 26.5a2.6 2.6 0 0 0 5 0" fill="none" ${S}/><path d="M16 5.5v2.5" ${S}/>`,
    phone: `<rect x="9" y="3.5" width="14" height="25" rx="4" fill="${C.white}" ${S}/><rect x="11.5" y="7" width="9" height="15" rx="1.5" fill="${C.blueS}" ${S}/><circle cx="16" cy="25" r="1.2" fill="${INK}"/>`,
    mail: `<rect x="4.5" y="8" width="23" height="16" rx="3" fill="${C.yellowS}" ${S}/><path d="m5.5 10 10.5 8 10.5-8" fill="none" ${S}/>`,
    chat: `<path d="M6 8.5A3.5 3.5 0 0 1 9.5 5h13A3.5 3.5 0 0 1 26 8.5v9a3.5 3.5 0 0 1-3.5 3.5H14l-5.5 5v-5h0A3.5 3.5 0 0 1 6 17.5z" fill="${C.mintS}" ${S}/><circle cx="11.5" cy="13" r="1.4" fill="${INK}"/><circle cx="16" cy="13" r="1.4" fill="${INK}"/><circle cx="20.5" cy="13" r="1.4" fill="${INK}"/>`,
    sprout: `<path d="M16 27V15" ${S}/><path d="M16 17c-1-5-5-7.5-10-7 0 5 4 8 10 7z" fill="${C.mint}" ${S}/><path d="M16 14c.5-4.5 4-7 9-6.5-.3 4.5-3.8 7-9 6.5z" fill="${C.mintS}" ${S}/><path d="M10 27h12" ${S}/>`,
    sparkle: `<path d="M14 4c.8 5 2.5 7 7.5 8-5 1-6.7 3-7.5 8-.8-5-2.5-7-7.5-8 5-1 6.7-3 7.5-8z" fill="${C.yellow}" ${S}/><path d="M23.5 18.5c.4 2.4 1.3 3.3 3.5 3.8-2.2.5-3.1 1.4-3.5 3.8-.4-2.4-1.3-3.3-3.5-3.8 2.2-.5 3.1-1.4 3.5-3.8z" fill="${C.pink}" ${S}/>`,
    star: `<path d="m16 4.5 3.4 7 7.6 1.1-5.5 5.4 1.3 7.6L16 22l-6.8 3.6 1.3-7.6L5 12.6l7.6-1.1z" fill="${C.yellow}" ${S}/>`,
    syringe: `<g transform="rotate(45 16 16)"><path d="M16 1.5v4M13 5.5h6" ${S}/><rect x="12.5" y="7.5" width="7" height="14" rx="1.5" fill="${C.white}" ${S}/><rect x="12.5" y="14" width="7" height="7.5" fill="${C.blue}" ${S}/><path d="M16 21.5v8" ${S}/><path d="M12.5 11h3M12.5 14h3" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/></g>`,
    passport: `<rect x="8" y="4" width="16" height="24" rx="2.5" fill="${C.blue}" ${S}/><circle cx="16" cy="14" r="4.5" fill="${C.blueS}" ${S}/><path d="M11.5 14h9M16 9.5c-2 3-2 6 0 9M16 9.5c2 3 2 6 0 9" fill="none" stroke="${INK}" stroke-width="1.5"/><path d="M12 23h8" ${S}/>`,
    shield: `<path d="M16 4 26 8v7c0 6.5-4.3 11.2-10 13-5.7-1.8-10-6.5-10-13V8z" fill="${C.mint}" ${S}/><path d="m11.5 16 3 3 6-6.5" fill="none" ${S}/>`,
    plug: `<path d="M12 3.5v6M20 3.5v6" ${S}/><path d="M8.5 9.5h15v5a7.5 7.5 0 0 1-15 0z" fill="${C.yellow}" ${S}/><path d="M16 22v6.5" ${S}/>`,
    battery: `<rect x="4" y="10" width="21" height="12" rx="3" fill="${C.white}" ${S}/><rect x="6.8" y="12.8" width="11" height="6.4" rx="1.2" fill="${C.mint}"/><path d="M25 14v4h2.5v-4z" fill="${INK}" ${S}/>`,
    signal: `<rect x="5" y="19" width="5" height="8" rx="1.2" fill="${C.blue}" ${S}/><rect x="13.5" y="13" width="5" height="14" rx="1.2" fill="${C.blue}" ${S}/><rect x="22" y="6" width="5" height="21" rx="1.2" fill="${C.blueS}" ${S}/>`,
    money: `<rect x="3.5" y="9" width="25" height="14" rx="2.5" fill="${C.mint}" ${S}/><circle cx="16" cy="16" r="3.8" fill="${C.mintS}" ${S}/><circle cx="8" cy="16" r="1.2" fill="${INK}"/><circle cx="24" cy="16" r="1.2" fill="${INK}"/>`,
    lock: `<path d="M10.5 14v-3.5a5.5 5.5 0 0 1 11 0V14" fill="none" ${S}/><rect x="7" y="14" width="18" height="14" rx="3" fill="${C.yellow}" ${S}/><path d="M16 19.5v3.5" ${S}/>`,
    clip: `<path d="m19.5 9-8.2 8.2a2.6 2.6 0 0 0 3.7 3.7l9.4-9.4a4.6 4.6 0 0 0-6.5-6.5L8.4 14.5a6.6 6.6 0 0 0 9.3 9.3l7-7" fill="none" ${S}/>`,
    calendar: `<rect x="5" y="7" width="22" height="20" rx="3.5" fill="${C.white}" ${S}/><path d="M5 10.5a3.5 3.5 0 0 1 3.5-3.5h15a3.5 3.5 0 0 1 3.5 3.5V13H5z" fill="${C.blue}" ${S}/><path d="M11 5v4M21 5v4" ${S}/><rect x="18.5" y="18" width="5" height="5" rx="1.2" fill="${C.pink}" ${S}/>`,
    pin: `<path d="M16 3.5c-5 0-8.5 3.6-8.5 8.2 0 6.3 8.5 16.3 8.5 16.3s8.5-10 8.5-16.3c0-4.6-3.5-8.2-8.5-8.2z" fill="${C.red}" ${S}/><circle cx="16" cy="11.8" r="3" fill="${C.white}" ${S}/>`,
    health: `<rect x="4.5" y="8" width="23" height="18" rx="3" fill="${C.white}" ${S}/><path d="M12 8V5.5h8V8" fill="none" ${S}/><path d="M14 12.5h4v3h3v4h-3v3h-4v-3h-3v-4h3z" fill="${C.red}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
    sos: `<circle cx="16" cy="16" r="11.5" fill="${C.white}" ${S}/><circle cx="16" cy="16" r="5" fill="${C.cream}" ${S}/><path d="M7.9 7.9l4.6 4.6M24.1 7.9l-4.6 4.6M7.9 24.1l4.6-4.6M24.1 24.1l-4.6-4.6" stroke="${C.red}" stroke-width="5" stroke-linecap="butt"/><circle cx="16" cy="16" r="11.5" fill="none" ${S}/><circle cx="16" cy="16" r="5" fill="none" ${S}/>`,
    cap: `<path d="M16 7 29 13l-13 6-13-6z" fill="${C.lav}" ${S}/><path d="M9 16v5.5c2 2 4.3 3 7 3s5-1 7-3V16" fill="${C.lavS}" ${S}/><path d="M27 14v7" ${S}/><circle cx="27" cy="22.5" r="1.5" fill="${C.yellow}" ${S}/>`,
    bottle: `<path d="M13 6h6l-.8 4h-4.4z" fill="${C.pink}" ${S}/><rect x="11" y="10" width="10" height="18" rx="3.5" fill="${C.white}" ${S}/><path d="M11 17h3.5M11 21h3.5M11 25h3.5" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><rect x="11" y="19" width="10" height="9" rx="3.5" fill="${C.blueS}" opacity=".9"/><rect x="11" y="10" width="10" height="18" rx="3.5" fill="none" ${S}/>`,
    card: `<rect x="3.5" y="7.5" width="25" height="17" rx="3" fill="${C.blueS}" ${S}/><path d="M3.5 12.5h25" stroke="${INK}" stroke-width="3"/><rect x="7" y="16.5" width="6" height="4.5" rx="1" fill="${C.yellow}" ${S}/>`,
    doc: `<path d="M8 4h11l6 6v18H8z" fill="${C.white}" ${S}/><path d="M19 4v6h6" fill="${C.blueS}" ${S}/><path d="M12 15h9M12 19h9M12 23h6" ${S}/>`,
    notebook: `<rect x="8" y="4" width="18" height="24" rx="2.5" fill="${C.pink}" ${S}/><rect x="13" y="9" width="9" height="5" rx="1" fill="${C.pinkS}" ${S}/><path d="M5.5 9h4.5M5.5 15h4.5M5.5 21h4.5" ${S}/>`,
    map: `<path d="m5 9 7-3 8 3 7-3v18l-7 3-8-3-7 3z" fill="${C.mintS}" ${S}/><path d="M12 6v18M20 9v18" fill="none" ${S}/><path d="M22 11c-2.2 0-3.6 1.6-3.6 3.5 0 2.6 3.6 6 3.6 6s3.6-3.4 3.6-6c0-1.9-1.4-3.5-3.6-3.5z" fill="${C.red}" ${S}/>`,
    eye: `<path d="M3.5 16S8 8.5 16 8.5 28.5 16 28.5 16 24 23.5 16 23.5 3.5 16 3.5 16z" fill="${C.white}" ${S}/><circle cx="16" cy="16" r="4.5" fill="${C.blue}" ${S}/><circle cx="16" cy="16" r="1.6" fill="${INK}"/>`,
    calc: `<rect x="7" y="3.5" width="18" height="25" rx="3" fill="${C.yellowS}" ${S}/><rect x="10" y="7" width="12" height="5" rx="1" fill="${C.white}" ${S}/><circle cx="12" cy="17" r="1.4" fill="${INK}"/><circle cx="16" cy="17" r="1.4" fill="${INK}"/><circle cx="20" cy="17" r="1.4" fill="${INK}"/><circle cx="12" cy="22" r="1.4" fill="${INK}"/><circle cx="16" cy="22" r="1.4" fill="${INK}"/><rect x="18.6" y="20.6" width="2.8" height="4.8" rx="1" fill="${C.pink}" stroke="${INK}" stroke-width="1.4"/>`,
    turtle: `<path d="M6 21a10 9 0 0 1 20 0z" fill="${C.mint}" ${S}/><path d="M11 21l2.5-5h5L21 21M13.5 16 16 12l2.5 4" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="28" cy="18.5" r="2.6" fill="${C.mintS}" ${S}/><path d="M9 21v3.5M23 21v3.5M4 21h24" ${S}/>`,
    shoe: `<path d="M4 23v-8.5l6-1 3 3.5c3 1.5 8 1.5 11.5 2.5 2.5.7 3.5 2 3.5 3.5v0z" fill="${C.blueS}" ${S}/><path d="M4 23h24v2.5H4z" fill="${C.white}" ${S}/><path d="M12 16.5l1.5-1.5M15 18l1.5-1.5" ${S}/>`,
    bolt: `<path d="M18.5 3.5 7.5 18h7l-2 10.5L24.5 13h-7z" fill="${C.yellow}" ${S}/>`,
    moon: `<path d="M20 5a11 11 0 1 0 7 17A9 9 0 0 1 20 5z" fill="${C.yellow}" ${S}/><path d="M9.5 7.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="${C.lav}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`,
    snow: `<path d="M16 4v24M5.6 10l20.8 12M5.6 22l20.8-12" ${S}/><path d="m12.5 5.5 3.5 3 3.5-3M12.5 26.5l3.5-3 3.5 3M4.6 14.7l4.6.6-1.8 4.3M27.4 14.7l-4.6.6 1.8 4.3" fill="none" ${S}/><circle cx="16" cy="16" r="3" fill="${C.blueS}" ${S}/>`,
    bunny: `<ellipse cx="11.5" cy="9.5" rx="3" ry="6.5" fill="${C.cream}" ${S} transform="rotate(-15 11.5 9.5)"/><ellipse cx="20.5" cy="9.5" rx="3" ry="6.5" fill="${C.cream}" ${S} transform="rotate(15 20.5 9.5)"/><path d="M16 13c6 0 10 3.7 10 8.4C26 25 22 27 16 27S6 25 6 21.4C6 16.7 10 13 16 13z" fill="${C.cream}" ${S}/><circle cx="12.5" cy="20" r="1.2" fill="${INK}"/><circle cx="19.5" cy="20" r="1.2" fill="${INK}"/><ellipse cx="10" cy="22.5" rx="1.8" ry="1.1" fill="${C.pink}"/><ellipse cx="22" cy="22.5" rx="1.8" ry="1.1" fill="${C.pink}"/>`,
  };

  function svg(name, size = 22) {
    const body = P[name] || P.star;
    return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true" focusable="false">${body}</svg>`;
  }
  /** Remplace les <i data-picto="…"> d'une zone par leur dessin. */
  function draw(root = document) {
    root.querySelectorAll("[data-picto]").forEach((el) => {
      if (el.firstElementChild) return;
      el.innerHTML = svg(el.dataset.picto, +el.dataset.size || 22);
      if (!el.dataset.size) el.classList.add("pic-auto");
    });
  }
  window.HodoPictos = { svg, draw, has: (n) => n in P, names: Object.keys(P) };
  // dessine aussi tout ce que les pages ajoutent après coup (écrans de l'app, fiches, messages)
  function start() {
    draw();
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches("[data-picto]")) draw(n.parentNode); else draw(n); } })))
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
