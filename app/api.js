/* HodoPlanner · accès aux données.
   Deux versions avec les mêmes fonctions :
   - Supabase (réel) quand config.js est rempli ;
   - démo (données d'exemple gardées sur le téléphone) sinon, ou avec ?demo dans l'adresse. */
(() => {
  "use strict";
  const cfg = window.HODO_CONFIG || {};
  const wantDemo = new URLSearchParams(location.search).has("demo");
  const LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) && !wantDemo;
  const REDIRECT = location.origin + location.pathname;
  const clean = (o, drop = ["created_at", "updated_at"]) => { const c = { ...o }; drop.forEach((k) => delete c[k]); return c; };
  const must = (r) => { if (r.error) throw r.error; return r.data; };

  // ======================= Supabase =======================
  function supabaseApi() {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    });
    async function upsert(table, row) {
      const r = clean(row);
      if (r.id) { const id = r.id; delete r.id; return must(await sb.from(table).update(r).eq("id", id).select().single()); }
      delete r.id;
      return must(await sb.from(table).insert(r).select().single());
    }
    return {
      mode: "live",
      async session() { return (await sb.auth.getSession()).data.session; },
      onAuth(cb) { sb.auth.onAuthStateChange((_e, s) => cb(s)); },
      async sendLink(email) { must(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: REDIRECT, shouldCreateUser: true } })); },
      async verifyCode(email, token) { must(await sb.auth.verifyOtp({ email, token, type: "email" })); },
      async signOut() { await sb.auth.signOut(); },
      async profile() {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return null;
        const p = must(await sb.from("profiles").select("*").eq("id", user.id).maybeSingle());
        return p || { id: user.id, email: user.email, is_admin: false };
      },
      async joinTrip(code) { return must(await sb.rpc("join_trip", { trip_code: code })); },
      async trips() { return must(await sb.from("trips").select("*").order("start_date", { nullsFirst: false })); },
      async tripData(id) {
        const [t, i, p, d] = await Promise.all([
          sb.from("trips").select("*").eq("id", id).single(),
          sb.from("items").select("*").eq("trip_id", id).order("position").order("created_at"),
          sb.from("item_progress").select("*").eq("trip_id", id),
          sb.from("days").select("*").eq("trip_id", id).order("date"),
        ]);
        return { trip: must(t), items: must(i), progress: must(p), days: must(d) };
      },
      subscribe(id, cb) {
        const ch = sb.channel("trip-" + id);
        ["trips", "items", "item_progress", "days"].forEach((table) =>
          ch.on("postgres_changes", { event: "*", schema: "public", table, filter: table === "trips" ? `id=eq.${id}` : `trip_id=eq.${id}` }, () => cb()));
        ch.subscribe();
        return () => sb.removeChannel(ch);
      },
      async saveProgress(p) { must(await sb.from("item_progress").upsert(clean(p, ["updated_at", "updated_by"]))); },
      async upload(tripId, itemId, file) {
        const path = `${tripId}/${itemId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        must(await sb.storage.from("confirmations").upload(path, file, { upsert: true }));
        return path;
      },
      async fileUrl(path) { return must(await sb.storage.from("confirmations").createSignedUrl(path, 3600)).signedUrl; },
      // réservé à Erika (la base refuse aux autres)
      saveTrip: (t) => upsert("trips", t),
      async deleteTrip(id) { must(await sb.from("trips").delete().eq("id", id)); },
      saveItem: (it) => upsert("items", it),
      async deleteItem(id) { must(await sb.from("items").delete().eq("id", id)); },
      saveDay: (d) => upsert("days", d),
      async deleteDay(id) { must(await sb.from("days").delete().eq("id", id)); },
      async members(tripId) {
        const m = must(await sb.from("trip_members").select("user_id, joined_at").eq("trip_id", tripId));
        if (!m.length) return [];
        const ps = must(await sb.from("profiles").select("id, email").in("id", m.map((x) => x.user_id)));
        return m.map((x) => ({ ...x, email: (ps.find((p) => p.id === x.user_id) || {}).email || "?" }));
      },
    };
  }

  // ======================= Démo (sur le téléphone) =======================
  function demoApi() {
    const KEY = "hodo-app-demo-v1";
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
    const listeners = new Set();
    let db = load();
    function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.trips) return d; } catch (_) {} return seed(); }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {} listeners.forEach((f) => f()); }
    window.addEventListener("storage", (e) => { if (e.key === KEY) { db = load(); listeners.forEach((f) => f()); } });
    const me = () => db.users.find((u) => u.id === db.session);
    const isAdmin = () => !!(me() && me().is_admin);
    const member = (tripId) => db.members.some((m) => m.trip_id === tripId && m.user_id === db.session);
    const canSee = (tripId) => isAdmin() || member(tripId);
    const guard = () => { if (!isAdmin()) throw new Error("Réservé à Erika"); };
    const up = (list, row) => {
      const now = new Date().toISOString();
      if (row.id) { const i = db[list].findIndex((x) => x.id === row.id); db[list][i] = { ...db[list][i], ...row, updated_at: now }; save(); return db[list][i]; }
      const r = { ...row, id: uid(), created_at: now, updated_at: now }; db[list].push(r); save(); return r;
    };
    return {
      mode: "demo",
      async session() { return me() ? { user: me() } : null; },
      onAuth(cb) { listeners.add(() => cb(me() ? { user: me() } : null)); },
      async sendLink(email) { db.pending = email.trim().toLowerCase(); save(); },
      async verifyCode(email, token) {
        if (token !== "123456") throw new Error("Code incorrect (démo : 123456)");
        const e = email.trim().toLowerCase();
        let u = db.users.find((x) => x.email === e);
        if (!u) { u = { id: uid(), email: e, is_admin: e.startsWith("erika") }; db.users.push(u); }
        db.session = u.id; save();
      },
      async signOut() { db.session = null; save(); },
      async profile() { return me() || null; },
      async joinTrip(code) {
        if (!me()) throw new Error("Connexion nécessaire");
        const t = db.trips.find((x) => x.code === code.trim().toUpperCase());
        if (!t) throw new Error("Code inconnu");
        if (!member(t.id)) db.members.push({ trip_id: t.id, user_id: me().id, joined_at: new Date().toISOString() });
        save(); return t.id;
      },
      async trips() { return db.trips.filter((t) => canSee(t.id)).sort((a, b) => (a.start_date || "9").localeCompare(b.start_date || "9")); },
      async tripData(id) {
        if (!canSee(id)) throw new Error("Voyage introuvable");
        return {
          trip: db.trips.find((t) => t.id === id),
          items: db.items.filter((i) => i.trip_id === id).sort((a, b) => a.position - b.position),
          progress: db.progress.filter((p) => p.trip_id === id),
          days: db.days.filter((d) => d.trip_id === id && (isAdmin() || d.published)).sort((a, b) => a.date.localeCompare(b.date)),
        };
      },
      subscribe(_id, cb) { listeners.add(cb); return () => listeners.delete(cb); },
      async saveProgress(p) {
        if (!canSee(p.trip_id)) throw new Error("Refusé");
        const i = db.progress.findIndex((x) => x.item_id === p.item_id);
        const row = { ...p, updated_by: db.session, updated_at: new Date().toISOString() };
        if (i < 0) db.progress.push(row); else db.progress[i] = { ...db.progress[i], ...row };
        save();
      },
      async upload(tripId, itemId, file) { return `${tripId}/${itemId}/${file.name}`; },
      async fileUrl() { return null; },
      async saveTrip(t) { guard(); if (!t.id && !t.code) t.code = "HODO-" + Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01IOL]/g, "X"); return up("trips", t); },
      async deleteTrip(id) { guard(); db.trips = db.trips.filter((t) => t.id !== id); ["items", "days", "progress", "members"].forEach((k) => { db[k] = db[k].filter((x) => x.trip_id !== id); }); save(); },
      async saveItem(it) { guard(); return up("items", { position: 0, urgent: false, partner: false, type: "activity", ...it }); },
      async deleteItem(id) { guard(); db.items = db.items.filter((x) => x.id !== id); db.progress = db.progress.filter((x) => x.item_id !== id); save(); },
      async saveDay(d) { guard(); return up("days", { stops: [], eat: [], published: false, ...d }); },
      async deleteDay(id) { guard(); db.days = db.days.filter((x) => x.id !== id); save(); },
      async members(tripId) { return db.members.filter((m) => m.trip_id === tripId).map((m) => ({ ...m, email: (db.users.find((u) => u.id === m.user_id) || {}).email })); },
      reset() { db = seed(); save(); },
    };

    function seed() {
      const T = "demo-trip-japon", lea = "demo-lea", erika = "demo-erika";
      const it = (n, o) => ({ id: "demo-item-" + n, trip_id: T, position: n, urgent: false, partner: false, ...o });
      const st = (when, name, text, tip, lat, lng, icon) => ({ when, name, text, tip, lat, lng, icon });
      const day = (n, date, title, subtitle, icon, color, base, stops, eat, tip, published = true) =>
        ({ id: "demo-day-" + n, trip_id: T, date, title, subtitle, icon, color, base, stops, eat, tip, published });
      return {
        session: null, pending: null,
        users: [{ id: erika, email: "erika@demo.be", is_admin: true }, { id: lea, email: "lea@demo.be", is_admin: false }],
        trips: [{ id: T, code: "HODO-DEMO42", title: "Japon", emoji: "flower", country: "JP", start_date: "2027-04-03", end_date: "2027-04-16", travelers: ["Léa", "Tom"], status: "delivered",
          practical: [
            { icon: "sos", title: "Urgences", text: "Police : 110\nAmbulance et pompiers : 119\nJapan Visitor Hotline (JNTO, en anglais, 24 h/24) : 050-3816-2787", source: "JNTO" },
            { icon: "syringe", title: "Santé", text: "Aucun vaccin obligatoire pour le Japon. Vérifie que tes vaccins de base sont à jour ; demande conseil à ton médecin.", source: "wanda.be · vérifié par Erika" },
            { icon: "plug", title: "Prises et batteries", text: "100 V, prises type A : prends un adaptateur.\nBatteries externes en cabine uniquement.", source: "" },
          ] }],
        members: [{ trip_id: T, user_id: lea, joined_at: "2026-10-01T10:00:00Z" }],
        items: [
          it(1, { type: "flight", title: "Vols Bruxelles → Tokyo, Osaka → Bruxelles", where_label: "Skyscanner", link: "https://www.skyscanner.fr", date: "2027-04-03", deadline: "2026-11-30", price: "≈ 890 € / pers." }),
          it(2, { type: "activity", title: "Ghibli Park · Grand Warehouse", where_label: "ghibli-park.jp", link: "https://ghibli-park.jp/en/", date: "2027-04-11", rule: "ghibli-park", price: "2 × 3 500 ¥" }),
          it(3, { type: "hotel", title: "Hôtel à Shinjuku · 3 nuits", where_label: "Booking", link: "https://www.booking.com", date: "2027-04-04", deadline: "2027-01-15", price: "≈ 390 €", partner: true, note: "Annulation gratuite jusqu’au 28 mars." }),
          it(4, { type: "food", title: "Pokémon Café · 11:30", where_label: "Pokémon Center Online", link: "https://www.pokemoncenter-online.com/cafe/", date: "2027-04-05", rule: "pokemon-cafe", price: "≈ 30 € / pers." }),
          it(5, { type: "hotel", title: "Ryokan à Hakone · dîner inclus", where_label: "Japanican", link: "https://www.japanican.com", date: "2027-04-07", deadline: "2027-01-31", urgent: true, price: "≈ 38 000 ¥", note: "Les ryokans avec onsen privé partent vite au printemps." }),
          it(6, { type: "admin", title: "Visit Japan Web (QR immigration et douane)", where_label: "Visit Japan Web", link: "https://vjw-lp.digital.go.jp/en/", date: "2027-04-04", deadline: "2027-03-28", price: "gratuit" }),
        ],
        progress: [{ item_id: "demo-item-1", trip_id: T, done: true, ref: "XK7L2P", paid: "1 780 €", updated_at: "2026-10-02T10:00:00Z" },
                   { item_id: "demo-item-3", trip_id: T, done: true, ref: "4821 339 610", paid: "372 €", updated_at: "2026-10-03T10:00:00Z" }],
        days: [
          day(1, "2027-04-04", "Arrivée à Tokyo", "Shinjuku, sakura et yakitori", "tower", "mint", "Tokyo",
            [st("Matin", "Arrivée à Haneda", "Keikyu puis JR jusqu’à Shinjuku, environ 45 min.", "Ajoute une carte Suica dans le Wallet de ton téléphone.", 35.5494, 139.7798, "train"),
             st("Après-midi", "Shinjuku Gyoen", "Le plus beau parc de Tokyo pour les cerisiers début avril.", null, 35.6852, 139.7101, "flower"),
             st("Soir", "Omoide Yokocho", "Ruelles de petits bars à brochettes.", null, 35.6929, 139.6995, "lantern")],
            [{ name: "Yakitori", text: "brochettes au charbon", icon: "lantern" }], "Couche-toi tôt mais pas avant 21 h."),
          day(2, "2027-04-05", "Pokémon Café & Shibuya", "Meiji Jingu, Harajuku, Shibuya Sky", "crossing", "mint", "Tokyo",
            [st("Matin", "Sanctuaire Meiji Jingu", "Grande allée en forêt, calme le matin.", null, 35.6764, 139.6993, "torii"),
             st("Midi", "Pokémon Café", "Nihonbashi Takashimaya, 5e étage.", "Arrive 10 min avant.", 35.6812, 139.7745, "cup"),
             st("Soir", "Shibuya Sky", "Coucher de soleil sur la ville.", null, 35.6585, 139.7022, "crossing")],
            [{ name: "Crêpes de Harajuku", text: "chantilly et fraises", icon: "pancake" }], null),
          day(3, "2027-04-07", "Hakone", "Onsen, téléphérique, bateau pirate", "onsen", "blue", "Hakone",
            [st("Matin", "Romancecar vers Hakone", "Environ 1 h 25.", "Le Hakone Free Pass couvre presque tout.", 35.2326, 139.1069, "train"),
             st("Soir", "Ryokan avec onsen", "Dîner kaiseki et bain chaud.", null, 35.25, 139.049, "onsen")],
            [{ name: "Kuro-tamago", text: "œufs noirs d’Owakudani", icon: "dango" }], "Envoie ta grosse valise directement à Kyoto."),
          day(4, "2027-04-11", "Ghibli Park", "Aller-retour Nagoya", "star", "pink", "Kyoto",
            [st("Journée", "Ghibli Park", "Grand Warehouse et la Colline de la jeunesse.", "Billets nominatifs : prends ton passeport.", 35.172, 137.089, "star")],
            [], null, false),
        ],
      };
    }
  }

  window.HodoApi = LIVE ? supabaseApi() : demoApi();
})();
