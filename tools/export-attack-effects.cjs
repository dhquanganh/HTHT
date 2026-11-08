// Thêm hiệu ứng đòn đánh thường vào dist/hero-effects.json: mỗi avatar trong db_battle_heroes
// nhận `attack` = {animation, delay, cast, impact} theo skill đánh thường (animation "beat") của cache HTTH.
// Chỉ dùng các Spine đã có trong hero-effects.json (export-hero-effects.py xuất); đường dẫn thiếu được liệt kê.
// Chạy: node tools/export-attack-effects.cjs   (đọc HTTH/**/database_ex/**/__data, không cần Python)
const fs=require('fs'),path=require('path'),readBundle=require('./unityfs.cjs');
const web=path.resolve(__dirname,'..');
function find(dir,test){if(!fs.existsSync(dir))return null;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory()){const r=find(p,test);if(r)return r}else if(test(p))return p}return null}
const source=find(path.join(web,'HTTH'),p=>/database_ex[\\/].*__data$/.test(p))||find(path.join(web,'..','HTTH'),p=>/database_ex[\\/].*__data$/.test(p));
if(!source)throw Error('Không tìm thấy database_ex trong HTTH');
const text=readBundle(source).toString('utf8');
// db_battle_heroes là mảng JSON bắt đầu bằng [{"key" có cột skills.
function table(){
 let at=-1;
 while((at=text.indexOf('[{"key"',at+1))>=0){
  let depth=0,end=at,str=false;
  for(;end<text.length;end++){const ch=text[end];if(str){if(ch==='\\')end++;else if(ch==='"')str=false;continue}if(ch==='"')str=true;else if(ch==='['||ch==='{')depth++;else if(ch===']'||ch==='}'){depth--;if(!depth)break}}
  try{const rows=JSON.parse(text.slice(at,end+1));if(rows[0]?.skills&&rows[0].atk_range)return rows}catch{}
 }
 throw Error('Không tìm thấy db_battle_heroes');
}
const rows=table(),file=path.join(web,'dist/hero-effects.json'),fx=JSON.parse(fs.readFileSync(file,'utf8'));
const number=(v,d=0)=>Number.isFinite(Number(v))&&v!==''?Number(v):d,missing=new Set();
const effect=row=>{
 if(!row.path)return null;const key=row.path.replace(/\\/g,'/').toLowerCase();
 if(!fx.effects[key]){missing.add(key);return null}
 return{key,animation:row.animation||'animation',delay:number(row.delay),x:number(row.offsetx),y:number(row.offsety),scale:number(row.scale),origin:String(row.origin_pos_type||''),target:String(row.impact_pos||''),layer:row.sorting_layer||'',order:number(row.offset_layer)};
};
let count=0;
for(const row of rows){
 const avatar=String(row.key);if(avatar==='576')continue; // Zoro King Of Hell có hoạt cảnh riêng.
 const skills=row.skills||[],attack=skills.find(s=>s.animation==='beat')||skills.find(s=>!/skill/i.test(s.animation||''));if(!attack)continue;
 const data={animation:attack.animation,delay:number(attack.delay_cast_eff,.36),shake:(attack.shake_cams||[]).map(x=>({delay:number(x.delay),duration:number(x.duration)})).filter(x=>x.duration>0),cast:(attack.cast_effs||[]).map(effect).filter(Boolean),impact:(attack.impact_effs||[]).map(effect).filter(Boolean)};
 if(!data.cast.length&&!data.impact.length)continue;
 fx.heroes[avatar]??={animation:null,delay:0,hits:[],cast:[],impact:[]};fx.heroes[avatar].attack=data;count++;
}
fs.writeFileSync(file,JSON.stringify(fx));
console.log(JSON.stringify({attacks:count,missing:[...missing].sort()}));
