// Kiểm tra bộ kỹ năng của mọi tướng: đọc mô tả gốc, dịch sang hiệu ứng (server/skill-kit.mjs) và liệt kê
// những câu chưa mô phỏng được. Chạy: node tools/audit-skills.mjs [avatar...]  → qa-output/skill-audit.json
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {heroDefinitions} from '../server/catalog.mjs';
import {kitFromProfile} from '../server/skill-kit.mjs';

const profiles=JSON.parse(readFileSync(new URL('../dist/hero-profiles.json',import.meta.url),'utf8'));
const only=process.argv.slice(2);
const heroes=heroDefinitions.filter(h=>h.ultimate&&profiles[h.avatar]&&(!only.length||only.includes(h.avatar)));
const report=[];let sentences=0,missed=0;
const count=s=>String(s.description||'').replace(/^(?:Bị động|Nộ)\s*:\s*/i,'').replace(/\(([^()]*:[^()]*)\)/g,'').split(/(?<!\d)\.(?!\d)|;/).filter(x=>x.trim()).length;
for(const h of heroes){
 const kit=kitFromProfile(profiles[h.avatar]),notes=[...(kit.ultimate?.notes||[]).map(n=>'Nộ: '+n),...kit.passives.flatMap(p=>p.notes.map(n=>p.name+': '+n))];
 sentences+=profiles[h.avatar].skills.reduce((n,s)=>n+count(s),0);missed+=notes.length;
 report.push({avatar:h.avatar,name:h.name,ultimate:kit.ultimate?.effects,stats:kit.stats,triggers:kit.triggers.map(t=>({on:t.on,replace:t.replace,from:t.from,effects:t.effects})),notes});
}
mkdirSync(new URL('../qa-output',import.meta.url),{recursive:true});
writeFileSync(new URL('../qa-output/skill-audit.json',import.meta.url),JSON.stringify(report,null,1));
if(only.length)for(const r of report)console.log(JSON.stringify(r,null,1));
const noDamage=report.filter(r=>!r.ultimate?.some(e=>e.type==='damage')).map(r=>r.avatar+' '+r.name);
console.log(JSON.stringify({heroes:report.length,sentences,understood:sentences-missed,missed,coverage:+((sentences-missed)/sentences).toFixed(3),ultWithoutDamage:noDamage.length,sampleNoDamage:noDamage.slice(0,12)}));
