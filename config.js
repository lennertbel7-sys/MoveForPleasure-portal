// ============================================================
// config.js: verbinding met de online database (Supabase)
//
// Deze "publishable" sleutel MAG openbaar zijn: hij staat in
// elke website die Supabase gebruikt. De echte beveiliging zit
// in de database zelf (Row Level Security): bezoekers kunnen
// zich alleen inschrijven, niets lezen of wijzigen.
//
// Zet NOOIT de "secret"/"service_role"-sleutel in dit bestand!
// ============================================================

const SUPABASE_URL = "https://wrwwwgquqaqnmphrhvyr.supabase.co";
const SUPABASE_KEY = "sb_publishable_zZgJ3l13CKZdOq2O2_9d2w_kYYZMxTH";
