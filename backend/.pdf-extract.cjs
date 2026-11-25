const fs = require('fs'); const zlib = require('zlib');
for (const file of process.argv.slice(1)) {
 const b=fs.readFileSync(file); let out='';
 for (const m of b.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
  const s=Buffer.from(m[1],'latin1');
  for (const fn of [zlib.inflateSync,zlib.inflateRawSync]) try { const x=fn(s).toString('latin1'); if (/BT|Tj|TJ|Tf/.test(x)) out += x+'\n'; } catch {}
 }
 const strings=[...out.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)].map(m=>m[1].replace(/\\([()\\])/g,'$1').replace(/\\n/g,' '));
 console.log('\n### '+file+'\n'+strings.join(' '));
}
