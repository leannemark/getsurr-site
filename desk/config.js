/* the desk's settings. the project it talks to (production, sap-prod) and that
   project's public (publishable) key — never a service key. changing the
   project also means changing the address in index.html's
   Content-Security-Policy line. */
window.DESK = {
  SUPABASE_URL: 'https://wdhfuqxkjxwecpmhdujk.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_WHUyr1I_RYZudp92L9rDuw_GS58dyWi',
};
