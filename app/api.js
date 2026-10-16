/* HodoPlanner · accès aux données (Supabase, réglé dans config.js). */
(() => {
  "use strict";
  const cfg = window.HODO_CONFIG || {};
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
      async validateBrief(tripId, note) { return must(await sb.rpc("validate_brief", { trip: tripId, note: note || null })); },
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
      async requests() { return must(await sb.from("requests").select("*").order("created_at", { ascending: false }).limit(200)); },
      async updateRequest(id, fields) { must(await sb.from("requests").update(fields).eq("id", id)); },
      async deleteRequest(id) { must(await sb.from("requests").delete().eq("id", id)); },
      // le mail part du serveur (fonction send-mail), jamais avec un mot de passe dans l'app
      async sendMail(q) {
        const { data, error } = await sb.functions.invoke("send-mail", { body: q });
        if (error) {
          let msg = error.message;
          try { msg = (await error.context.json()).error || msg; } catch (_) {}
          throw new Error(msg);
        }
        return data;
      },
      async members(tripId) {
        const m = must(await sb.from("trip_members").select("user_id, joined_at").eq("trip_id", tripId));
        if (!m.length) return [];
        const ps = must(await sb.from("profiles").select("id, email").in("id", m.map((x) => x.user_id)));
        return m.map((x) => ({ ...x, email: (ps.find((p) => p.id === x.user_id) || {}).email || "?" }));
      },
    };
  }

  window.HodoApi = supabaseApi();
})();
