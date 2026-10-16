/* HodoPlanner · réglages de l'app.
   Les deux valeurs viennent de Supabase → Project Settings → API (ou bouton « Connect »).
   Elles peuvent être publiques : c'est la base qui protège les données (Row Level Security).
   Ne mets JAMAIS ici la clé « service_role » ni le mot de passe de la base.
   Tant qu'elles sont vides, l'app tourne en mode démo (données d'exemple, sur le téléphone). */
window.HODO_CONFIG = {
  supabaseUrl: "https://twzpdtjsfxdkcgasiumc.supabase.co",
  supabaseAnonKey: "sb_publishable_wENnF5hJ-spb_n2VT1UQeg_oOTACMNK",
  // jeton public Mapbox (pk.), limité à hodoplanner.com dans le compte Mapbox ; vide = cartes CARTO
  mapboxToken: "pk.eyJ1IjoiaG9kb3BsYW5uZXIiLCJhIjoiY212YmlidGZzMGViNzJ4cXhmbHU1M3B0OCJ9.6xiW6PcH4fvFls2rXb2BvQ",
};
