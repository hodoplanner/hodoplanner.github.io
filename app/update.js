/* HodoPlanner · mises à jour de l'app.
   Pour publier : changer VERSION dans sw.js et dans version.json (avec la liste des nouveautés).
   À l'ouverture, chacun voit « Nouvelle version disponible » et choisit « Mettre à jour ». */
(() => {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  const KEY = "hodo-app-updated";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let updating = false;

  function toast(msg) {
    let el = document.querySelector(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2600);
  }
  async function showUpdate(worker) {
    let notes = [];
    try { notes = (await (await fetch("version.json", { cache: "no-store" })).json()).notes || []; } catch (_) {}
    const phone = document.getElementById("phone");
    const box = document.createElement("div");
    box.innerHTML = `<div class="sheet-bg show" id="ubg"></div><div class="sheet open" id="usheet" role="dialog"><div class="grip"></div>
      <div style="text-align:center">${window.HodoIcons ? HodoIcons.icon("bunnypaws", 90) : ""}</div>
      <h2 style="text-align:center">Nouvelle version disponible <i class="pic" data-picto="sparkle"></i></h2>
      ${notes.length ? `<ul style="margin:12px 0;padding-left:20px;display:grid;gap:6px;font-size:14px">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      <p class="small" style="text-align:center;margin-bottom:12px">Ton voyage et tes coches sont gardés.</p>
      <div class="stack"><button class="btn dark block" id="doUpdate">Mettre à jour</button><button class="btn block" id="later">Plus tard</button></div></div>`;
    phone.append(...box.children);
    // « Plus tard » : la fiche se ferme mais un bouton reste en bas de l'écran (toucher à côté ne ferme rien)
    document.getElementById("later").onclick = () => { document.getElementById("usheet")?.remove(); document.getElementById("ubg")?.remove(); showPill(worker); };
    document.getElementById("doUpdate").onclick = () => apply(worker);
  }
  function apply(worker) {
    updating = true;
    try { sessionStorage.setItem(KEY, "1"); } catch (_) {}
    worker.postMessage("SKIP_WAITING");
  }
  function showPill(worker) {
    if (document.getElementById("upill")) return;
    const b = document.createElement("button");
    b.id = "upill"; b.className = "btn dark small";
    b.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:60;box-shadow:3px 3px 0 var(--pink)";
    b.innerHTML = `<i class="pic" data-picto="sparkle"></i> Mettre à jour l’app`;
    b.onclick = () => apply(worker);
    document.body.appendChild(b);
  }
  const shown = () => document.getElementById("usheet") || document.getElementById("upill");

  navigator.serviceWorker.addEventListener("controllerchange", () => { if (updating) location.reload(); });
  navigator.serviceWorker.register("sw.js").then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    // au retour dans l'app : si une version attend toujours, on la repropose
    const again = () => { if (reg.waiting && navigator.serviceWorker.controller && !shown()) showPill(reg.waiting); };
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdate(nw); });
    });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { again(); reg.update().catch(() => {}); } });
  }).catch(() => {});
  try { if (sessionStorage.getItem(KEY)) { sessionStorage.removeItem(KEY); setTimeout(() => toast("App mise à jour ✓"), 400); } } catch (_) {}
})();
