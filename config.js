/* the site's settings — the only file to change for the everyday switches.
   SUPABASE_*: the project the TestFlight build talks to (staging until the production switch).
   The key is the public (publishable) one the app itself ships with — never a service key. */
window.SURR = {
  BASE: '/',
  SUPABASE_URL: 'https://wdhfuqxkjxwecpmhdujk.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_WHUyr1I_RYZudp92L9rDuw_GS58dyWi',

  /* the back pages (getsurr.com/backpages) talk to the project above on getsurr.com, and to this one — staging, the test
     server — anywhere else (localhost, a LAN address), so a phone on the same wi-fi can try it without touching production.
     public (publishable) key only, the same one the desk's staging copy uses. */
  BACKPAGES_STAGING: {
    URL: 'https://yvgaajzgrkeyzsztedvh.supabase.co',
    KEY: 'sb_publishable_Fqr-XXQVymA7AFwVqtqhDA_C_-6VlzY',
  },

  /* the public TestFlight link for "open in testflight →". empty = the line is hidden. */
  APP_URL: 'https://testflight.apple.com/join/U5TSYwqy',

  /* the radio ("the chip" on nights): SoundCloud's player does the sound, hidden under our chip, and loads only after the play tap.
     RADIO_ON: false = no chip anywhere. RADIO_EMBED_URL: the track's SoundCloud address; empty = no chip.
     RADIO_WAVE: the mix's 600 loudness values, made once with scripts/wave.mjs (the audio itself is never in this repo).
     RADIO_ARTIST_URL: where the artist's name links (new tab); empty = the name is plain text.
     RADIO_MOOD: the mood ring the mix is made for — spontaneous, persuadable, lowkey or faded; the chip wears its colour and says its word.
     a new mix (002): one JSON and these values — see README "The radio". */
  RADIO_ON: true,
  RADIO_EMBED_URL: 'https://soundcloud.com/motherloading/surr-radio-001-mobilegirl',
  RADIO_WAVE: '/radio/surr-radio-001.json',
  RADIO_ARTIST_URL: 'https://www.instagram.com/mobilegirl/',
  RADIO_MOOD: 'persuadable',

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
     RAISED / SUPPORTERS / GOAL: the counter, "€<raised> of €<goal> from <n> supporters so far" — hidden while RAISED is 0; GOAL 0 = no goal shown.
     BIDS: city → bids for the city race board, e.g. { amsterdam: 131, barcelona: 148 }. missing = 0.
     LIFE_SOLD: city → for life places sold, for the "13 of the first 25 left" line, e.g. { berlin: 12 }. missing = 0.
     PIECES: the tank's and the ring's prices in euros (placeholders until decided).
     RING_MAKER: the ring maker's name; empty = the ring's line ends after "Made once."
     STRIP: the strip in the allies section: newest first, each { name, city, rung, at }; name empty = "someone"; city optional;
            rung one of round · bottle · table · section · cabana · yacht · villa; at an ISO time. Empty = no strip.
            Allies only, names only with their tick — never a patron. The payments build feeds this from the server. */
  DRIVE: {
    ON: false,
    PAY_ON: false,
    RAISED: 0,
    GOAL: 5000,
    SUPPORTERS: 0,
    BIDS: {},
    LIFE_SOLD: {},
    PIECES: { tank: 50, ring: 80 },
    RING_MAKER: '',
    STRIP: [],
  },
};
