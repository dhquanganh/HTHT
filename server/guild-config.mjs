// Boss hạm đội cho trang quản trị (tab "Boss hạm đội"): sửa đội quái / thưởng từng ải, thêm ải boss mới, xoá ải đã thêm.
// Bảng gốc 60 ải (dist/guild.json, db_guild_boss_2) là mặc định; bản sửa lưu nguyên danh sách ải ở guild_boss_config
// ({_id:'stages', stages}) và được áp thẳng vào guildData.stages (server/guild.mjs đọc từ đó).
// Ải đang đánh dở của một hạm đội giữ máu đã trừ; đổi đội quái của ải đó có hiệu lực đầy đủ từ lần mở ải kế.
import {requireCondition,integer} from './errors.mjs';
import {guildData,bossMonster,bossPower} from './guild.mjs';
import {heroAlbum,campaign,towerData,itemIcon} from './catalog.mjs';

const defaults=structuredClone(guildData.stages);
export const defaultStageCount=defaults.length;
const visuals={...campaign.visuals,...towerData.visuals};
const byAvatar=new Map(heroAlbum.heroes.map(h=>[String(h.avatar),h]));
// Quái chọn được: tướng có hình Spine và ảnh đầu (vẽ được trong trận).
export const bossMonsters=heroAlbum.heroes.filter(h=>visuals[h.avatar]?.skeleton&&visuals[h.avatar]?.head).sort((a,b)=>b.rank-a.rank||a.name.localeCompare(b.name,'vi'));
const usable=new Set(bossMonsters.map(h=>String(h.avatar)));
const rankKeys=['1','2','3','10','15','20','30'];
export const maxLevel=10000000;

export function applyGuildBoss(doc){
 const stages=doc?.stages?.length?doc.stages:defaults;
 guildData.stages.splice(0,guildData.stages.length,...structuredClone(stages).map((s,i)=>({...s,stage:i+1})));
}
// Hệ số gốc của tướng khi thêm quái mới: lấy từ một quái cùng tướng trong bảng gốc, không có thì 1.
const knownScale=new Map();for(const s of defaults)for(const m of s.monsters)if(!knownScale.has(String(m.avatar)))knownScale.set(String(m.avatar),m.scale);
export const scaleFor=avatar=>structuredClone(knownScale.get(String(avatar))||{attack:1,maxHp:1,defense:1,speed:1});

export function guildBossView(edited=false){
 const head=a=>visuals[a]?.head?itemIcon({assetKey:visuals[a].head}):null;
 return{edited,defaultCount:defaultStageCount,maxLevel,
  monsters:bossMonsters.map(h=>({avatar:String(h.avatar),name:h.name,faction:h.faction,rank:h.rank,head:head(h.avatar)})),
  stages:guildData.stages.map(s=>({...structuredClone(s),power:bossPower(s.stage),hp:s.monsters.reduce((n,m,i)=>n+bossMonster(m,i).maxHp,0),
   monsters:s.monsters.map(m=>({...m,head:head(m.avatar)}))}))};
}
const num=(v,min,max,label)=>integer(v,min,max,label);
/** Kiểm tra một ải boss gửi lên; tên / hệ / nghề lấy theo tướng. */
export function validateBossStage(input,n){
 requireCondition(input&&typeof input==='object','Dữ liệu không hợp lệ.');const label=`Ải ${n}`;
 requireCondition(Array.isArray(input.monsters)&&input.monsters.length>=1&&input.monsters.length<=6,`${label}: cần 1–6 quái.`);
 const positions=new Set();
 const monsters=input.monsters.map((m,i)=>{
  const avatar=String(m?.avatar);requireCondition(usable.has(avatar),`${label}: quái ${avatar} không dùng được.`,404);
  const h=byAvatar.get(avatar),position=num(m.position??i+1,1,6,`${label}: vị trí`);requireCondition(!positions.has(position),`${label}: hai quái trùng vị trí ${position}.`);positions.add(position);
  const level=num(m.level,1,maxLevel,`${label}: cấp quái`),sc=m.scale||{},s=k=>Math.round(Number(sc[k]??1)*10000)/10000;
  for(const k of ['attack','maxHp','defense','speed'])requireCondition(Number.isFinite(s(k))&&s(k)>=.01&&s(k)<=1000,`${label}: hệ số chỉ số không hợp lệ.`);
  return{monsterId:m.monsterId??'hero-'+avatar,heroId:String(m.heroId??avatar),avatar,name:h.name,level,skillLevel:num(m.skillLevel??level,1,maxLevel,`${label}: cấp kỹ năng`),stars:num(m.stars??1,1,15,`${label}: sao`),
   faction:h.faction,class:h.class,position,scale:{attack:s('attack'),maxHp:s('maxHp'),defense:s('defense'),speed:s('speed')}};
 });
 const r=(v,label2)=>num(v??0,0,1e12,`${label}: ${label2}`),f=input.final||{};
 return{stage:n,monsters,guildExp:r(input.guildExp,'EXP hạm đội'),gold:r(input.gold,'Beli mỗi lượt'),guildCoin:r(input.guildCoin,'Huy hiệu mỗi lượt'),killGold:r(input.killGold,'Beli hạ boss'),killCoin:r(input.killCoin,'Huy hiệu hạ boss'),
  final:Object.fromEntries(rankKeys.map(k=>[k,{gold:r(f[k]?.gold,`Top ${k} beli`),coin:r(f[k]?.coin,`Top ${k} huy hiệu`)}]))};
}
/** Ải boss mới nối sau ải cuối: chép ải cuối, cấp quái +10%, thưởng +10%. */
export function nextBossStage(){
 const last=structuredClone(guildData.stages.at(-1)),n=guildData.stages.length+1,up=v=>Math.round(v*1.1);
 for(const m of last.monsters){m.level=Math.max(m.level+1,up(m.level));m.skillLevel=Math.max(m.skillLevel+1,up(m.skillLevel))}
 for(const k of ['guildExp','gold','guildCoin','killGold','killCoin'])last[k]=up(last[k]);
 for(const k of rankKeys)last.final[k]={gold:up(last.final[k].gold),coin:up(last.final[k].coin)};
 return{...last,stage:n};
}
/** op: save {stage, data} | add | remove (ải cuối, chỉ ải đã thêm) → danh sách ải mới (chưa áp). */
export function editGuildBoss(input){
 const stages=structuredClone(guildData.stages),op=input?.op;
 if(op==='save'){const n=num(input.stage,1,stages.length,'Ải');stages[n-1]=validateBossStage(input.data,n);return stages}
 if(op==='add'){requireCondition(stages.length<1000,'Tối đa 1000 ải boss.');stages.push(nextBossStage());return stages}
 if(op==='remove'){requireCondition(stages.length>defaultStageCount,'Chỉ xoá được ải boss đã thêm (ải gốc giữ nguyên).');stages.pop();return stages}
 requireCondition(false,'Thao tác không hợp lệ.');
}
