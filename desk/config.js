/* the desk's settings. the project it talks to (staging for now) and that
   project's public (publishable) key — never a service key. changing the
   project also means changing the address in index.html's
   Content-Security-Policy line. */
window.DESK = {
  SUPABASE_URL: 'https://yvgaajzgrkeyzsztedvh.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_Fqr-XXQVymA7AFwVqtqhDA_C_-6VlzY',
};
