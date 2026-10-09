/* the site's settings — the only file to change for the everyday switches.
   SUPABASE_*: the project the TestFlight build talks to (staging until the production switch).
   The key is the public (publishable) one the app itself ships with — never a service key. */
window.SURR = {
  BASE: '/',
  SUPABASE_URL: 'https://wdhfuqxkjxwecpmhdujk.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_WHUyr1I_RYZudp92L9rDuw_GS58dyWi',

  /* the public TestFlight link for "open in testflight →". empty = the line is hidden. */
  APP_URL: '',

  /* the radio bar: off until the mix premieres on Refuge. the track's SoundCloud URL goes in RADIO_EMBED_URL. */
  RADIO_ON: false,
  RADIO_EMBED_URL: '',

  /* the next-night line in the nights box. null = no line. switch off the morning after. */
  NEXT_NIGHT: {
    city: 'berlin',
    date: 'sun 29 nov',
    name: 'tetas locas',
    link: 'https://www.instagram.com/tetas__locas/',
    offer: 'a surr offer awaits you upon entry',
  },

  /* the drive (getsurr.com/drive/). the prices themselves live in drive/drive.js; everything here can change without a build.
     ON: false = the band's fifth tile stays the list with the curtain, no phone screen, and the drive page carries noindex.
         true  = the fuse and the word drive in the fifth tile, the drive screen fifth on the phone, the page may be indexed.
         (the page is reachable at its address either way — that is how day ones get it before it is public.)
     PAY_ON: false = the page is for looking: prices shown, nothing can be picked, "paying opens soon." where the counter goes.
             true  = rows can be picked and the pay bar rises (the payments brief wires the money; until then pay() only shows the after-screen).
     RAISED / SUPPORTERS: the counter, "€<raised> from <n> supporters so far" — hidden while RAISED is 0.
     BIDS: city → bids for the city race board, e.g. { amsterdam: 131, barcelona: 148 }. missing = 0.
     LIFE_SOLD: city → for life places sold, for the "41 of the first 100 left" line, e.g. { berlin: 59 }. missing = 0.
     PIECES: the tank's and the ring's prices in euros (placeholders until decided).
     RING_MAKER: the ring maker's name; empty = the ring's line ends after "Made once." */
  DRIVE: {
    ON: false,
    PAY_ON: false,
    RAISED: 0,
    SUPPORTERS: 0,
    BIDS: {},
    LIFE_SOLD: {},
    PIECES: { tank: 50, ring: 80 },
    RING_MAKER: '',
  },
};
