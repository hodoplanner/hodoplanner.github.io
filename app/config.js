/* HodoPlanner · réglages de l'app.
   Les deux valeurs viennent de Supabase → Project Settings → API (ou bouton « Connect »).
   Elles peuvent être publiques : c'est la base qui protège les données (Row Level Security).
   Ne mets JAMAIS ici la clé « service_role » ni le mot de passe de la base.
   Tant qu'elles sont vides, l'app tourne en mode démo (données d'exemple, sur le téléphone). */
window.HODO_CONFIG = {
  supabaseUrl: "https://twzpdtjsfxdkcgasiumc.supabase.co",
  supabaseAnonKey: "sb_publishable_wENnF5hJ-spb_n2VT1UQeg_oOTACMNK",
};
