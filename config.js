/* the site's settings — the only file to change for the everyday switches.
   SUPABASE_*: the project the TestFlight build talks to (staging until the production switch).
   The key is the public (publishable) one the app itself ships with — never a service key. */
window.SURR = {
  BASE: '/',
  SUPABASE_URL: 'https://yvgaajzgrkeyzsztedvh.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_Fqr-XXQVymA7AFwVqtqhDA_C_-6VlzY',

  /* the public TestFlight link for "open in testflight →". empty = the line is hidden. */
  APP_URL: '',

  /* the radio bar: off until the mix premieres on Refuge. the track's SoundCloud URL goes in RADIO_EMBED_URL. */
  RADIO_ON: false,
  RADIO_EMBED_URL: '',

  /* the next-night line in the nights box. null = no line. switch off the morning after. */
  NEXT_NIGHT: {
    city: 'berlin',
    date: 'sun 8 nov',
    name: 'tetas locas',
    link: 'https://www.instagram.com/tetas__locas/',
    offer: 'a surr offer awaits you upon entry',
  },
};
