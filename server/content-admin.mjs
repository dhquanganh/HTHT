// Dữ liệu và kiểm tra cho tab "Phụ bản" / "Quái" của trang quản trị (cấu hình ở server/content.mjs).
import {requireCondition,integer} from './errors.mjs';
import {heroAlbum,campaign,towerData,itemIcon} from './catalog.mjs';
import {content} from './content.mjs';
import {braveConfig,braveLineup,braveCycle,braveEnemyCount} from './brave.mjs';
import {sealedConfig,sealedFactions,sealedLineup} from './sealed.mjs';
import {dungeonConfig,stageLineup,dungeonClock} from './dungeon.mjs';

const visuals={...campaign.visuals,...towerData.visuals};
// Quái dùng được: tướng có hình Spine và ảnh đầu (bậc 3 trở lên như bể quái của Mê cung).
export const monsterList=heroAlbum.heroes.filter(h=>h.rank>=3&&visuals[h.avatar]?.skeleton&&visuals[h.avatar]?.head).sort((a,b)=>b.rank-a.rank||a.name.localeCompare(b.name,'vi'));
const known=new Set(monsterList.map(h=>h.avatar));
const factionLabel={abyss:'Vực thẳm',shadow:'Hư ảnh',fortress:'Pháo đài',forest:'Rừng rậm',dark:'Bóng tối',light:'Ánh sáng'};
const modes={
 brave:{title:'Luyện tập',fixed:true,note:'15 ải cố định theo bản đồ gốc. Đội hình mặc định đổi mỗi chu kỳ 2 ngày.',keys:()=>Array.from({length:braveConfig.stages},(_,i)=>String(i+1))},
 sealed:{title:'Mê cung',note:'6 vùng theo hệ, mỗi vùng cùng số ải. Đội hình mặc định cố định theo ải; nên chọn quái cùng hệ với vùng.',keys:()=>sealedFactions.flatMap(f=>Array.from({length:sealedConfig.levels},(_,i)=>`${f}-${i+1}`))},
 dungeon:{title:'Đảo Bánh',note:'Đội hình mặc định đổi mỗi chu kỳ đảo (3 ngày).',keys:()=>Array.from({length:dungeonConfig.stages},(_,i)=>String(i+1))},
};
const countOf=mode=>mode==='brave'?braveConfig.stages:mode==='sealed'?sealedConfig.levels:dungeonConfig.stages;

export function contentView(now=Date.now()){
 const bc=braveCycle(now),dc=dungeonClock(now).cycle;
 const lineup=(mode,key)=>(mode==='brave'?braveLineup(bc,Number(key)):mode==='sealed'?sealedLineup(...key.split('-').map((x,i)=>i?Number(x):x)):stageLineup(dc,Number(key))).map(e=>e.avatar);
 const label=(mode,key)=>mode==='sealed'?`${factionLabel[key.split('-')[0]]} · Ải ${key.split('-')[1]}`:`Ải ${key}`;
 return{
  monsters:monsterList.map(h=>({avatar:h.avatar,name:h.name,faction:h.faction,factionLabel:factionLabel[h.faction]||h.faction,rank:h.rank,head:itemIcon({assetKey:visuals[h.avatar].head}),mod:content.monsters[h.avatar]||null})),
  modes:Object.fromEntries(Object.entries(modes).map(([mode,m])=>[mode,{title:m.title,note:m.note,fixed:!!m.fixed,count:countOf(mode),defaultCount:mode==='brave'?15:mode==='sealed'?20:60,
   factions:mode==='sealed'?sealedFactions.map(f=>({id:f,label:factionLabel[f]})):null,
   stages:m.keys().map(key=>{const o=content.stages[mode]?.[key]||null;return{key,label:label(mode,key),lineup:lineup(mode,key),override:o}})}]))};
}
// Cấp quái không giới hạn 1000 (tối đa 10 triệu để chỉ số vẫn là số an toàn).
export const maxLevel=10000000;
const pct=(v,label)=>integer(v,10,1000,label);
/** Chỉnh quái: chỉ nhận avatar có trong danh sách; dòng bằng mặc định (100%, đang bật) bị bỏ. */
export function validateMonsters(input){
 requireCondition(input&&typeof input==='object'&&!Array.isArray(input),'Dữ liệu không hợp lệ.');const out={};
 for(const [avatar,m] of Object.entries(input)){
  requireCondition(known.has(avatar),`Quái ${avatar} không tồn tại.`,404);requireCondition(m&&typeof m==='object','Dữ liệu không hợp lệ.');
  const row={hp:pct(m.hp??100,'Máu'),atk:pct(m.atk??100,'Công'),def:pct(m.def??100,'Thủ'),spd:pct(m.spd??100,'Tốc độ'),disabled:m.disabled===true};
  // Cấp quái cố định (trống = theo cấp đội chuẩn của phụ bản).
  if(m.level!==undefined&&m.level!==null&&m.level!=='')row.level=integer(m.level,1,maxLevel,'Cấp quái');
  if(row.disabled||row.level||row.hp!==100||row.atk!==100||row.def!==100||row.spd!==100)out[avatar]=row;
 }
 requireCondition(monsterList.some(h=>!out[h.avatar]?.disabled),'Phải còn ít nhất một quái đang bật.');
 return out;
}
/** Ải của một chế độ: {count?, stages:{key:{enemies?, scale?}}}. Ải ngoài số ải mới bị bỏ. */
export function validateStages(mode,input){
 const m=modes[mode];requireCondition(m,'Phụ bản không tồn tại.',404);requireCondition(input&&typeof input==='object','Dữ liệu không hợp lệ.');
 let count=countOf(mode);
 if(!m.fixed&&input.count!==undefined)count=integer(input.count,1,mode==='sealed'?60:200,'Số ải');
 const keys=new Set(mode==='sealed'?sealedFactions.flatMap(f=>Array.from({length:count},(_,i)=>`${f}-${i+1}`)):Array.from({length:count},(_,i)=>String(i+1)));
 const stages={};
 for(const [key,o] of Object.entries(input.stages||{})){
  if(!keys.has(key))continue;requireCondition(o&&typeof o==='object','Dữ liệu không hợp lệ.');const row={};
  if(Array.isArray(o.enemies)&&o.enemies.length){requireCondition(o.enemies.length<=6,'Mỗi ải tối đa 6 quái.');for(const a of o.enemies)requireCondition(known.has(String(a)),`Quái ${a} không tồn tại.`,404);row.enemies=o.enemies.map(String)}
  if(o.scale!==undefined&&o.scale!==null&&o.scale!==''){row.scale=pct(o.scale,'Sức mạnh');if(row.scale===100)delete row.scale}
  if(o.level!==undefined&&o.level!==null&&o.level!=='')row.level=integer(o.level,1,maxLevel,'Cấp quái');
  if(Object.keys(row).length)stages[key]=row;
 }
 return{count:m.fixed?null:count,stages};
}
export {braveEnemyCount};
