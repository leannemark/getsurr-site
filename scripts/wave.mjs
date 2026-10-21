// The radio's waveform: 600 loudness values (0–99) measured once from the mix, drawn by the chip in site.js.
// Run (for 002, swap the names):
//   afconvert -f WAVE -d LEI16@8000 -c 1 <mix>.mp3 /tmp/mix-8k.wav
//   node scripts/wave.mjs /tmp/mix-8k.wav > radio/surr-radio-002.json
// 600 RMS buckets, normalised to the loudest, a 0.7 power curve so quiet passages still show.
import fs from 'node:fs';
const buf = fs.readFileSync(process.argv[2]);
let off = 12, dataOff = 0, dataLen = 0;
while (off < buf.length) { const id = buf.toString('ascii', off, off + 4), len = buf.readUInt32LE(off + 4); if (id === 'data') { dataOff = off + 8; dataLen = len; break; } off += 8 + len + (len % 2); }
const n = dataLen / 2, N = 600, per = Math.floor(n / N), out = [];
for (let b = 0; b < N; b++) { let s = 0; const st = dataOff + b * per * 2; for (let i = 0; i < per; i++) { const v = buf.readInt16LE(st + i * 2) / 32768; s += v * v; } out.push(Math.sqrt(s / per)); }
const max = Math.max(...out);
console.log(JSON.stringify(out.map((v) => Math.round(Math.pow(v / max, 0.7) * 99))));
