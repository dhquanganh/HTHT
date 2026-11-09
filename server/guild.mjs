// Hạm đội (GuildScene gốc): Hội trường, Kỹ năng (PopupGuildSkill), Đánh Boss (PopupGuildRaid / PopupGuildBossAttack),
// Nhiệm vụ - Cống hiến (PopupGuildMill), Chiến trường hạm đội (chưa mở, như MSG_POPOUP_GUILD_WAR_HISTORY_NOTE).
//
// Lấy từ asset gốc (tools/export-guild.py -> dist/guild.json):
//   - 60 ải Đánh Boss của db_guild_boss_2: đội quái, ô đứng, EXP hạm đội / vàng / Huy hiệu hạm đội mỗi lượt đánh, thưởng người
//     hạ boss, thưởng xếp hạng sát thương top 1 / 2 / 3 / 10 / 15 / 20 / 30.
//   - Quái từ db_quai (tướng db_heroes, cấp, cấp kỹ năng, sao) với hệ số Công / Máu / Giáp / Tốc gốc của tướng đó
//     (attack/hp/armor_scale_origin, speed_origin chia trung vị toàn bảng). Chỉ số = đường tăng trưởng tướng của bản web
//     ở đúng cấp và sao của quái × hệ số gốc; bộ kỹ năng đọc từ mô tả kỹ năng của tướng gốc.
//   - Luật chữ gốc: tên 6-20 ký tự; kỹ năng sau cần kỹ năng trước đạt cấp 10; lên "Cấp độ" kỹ năng kế cần nâng tối đa các
//     kỹ năng hiện tại và hạm đội đạt cấp yêu cầu; thiết lập lại hoàn toàn bộ beli + huy hiệu, lần đầu miễn phí;
//     lượt đánh boss thêm tốn 40 kim cương; lập hạm đội 500 kim cương.
// Bản gốc nhận bảng kỹ năng / cấp hạm đội từ máy chủ (không có trong asset), nên các số đó do bản web đặt và ghi rõ ở dưới.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition,GameError} from './errors.mjs';

export const guildData=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/guild.json',import.meta.url)),'utf8'));
export const guildCoin='consumable:6',createCost=500,createLevel=10,nameMin=6,nameMax=20;
export const roles={leader:'Thuyền trưởng',vice:'Thuyền phó',member:'Thủy thủ'};
// Cấp hạm đội: Lv1 0/3000 như màn gốc, mỗi cấp cần 3000 × cấp; 20 thành viên ở cấp 1, +2 mỗi cấp (prefab mẫu 1/22).
export const maxGuildLevel=10;
export const expToNext=level=>level>=maxGuildLevel?0:3000*level;
export const memberLimit=level=>20+2*(Math.max(1,level)-1);
// Điểm danh mỗi ngày, cống hiến beli, lượt đánh boss (giờ Việt Nam, 00:00).
export const rollCall={guildExp:30,coin:20,gold:20000};
export const donations=[{gold:10000,guildExp:10,coin:5},{gold:100000,guildExp:60,coin:30},{gold:1000000,guildExp:300,coin:120}],donateLimit=3;
export const bossFreeAttacks=3,bossBuyPrice=40,bossBuyLimit=5,bossRounds=10,bossHpScale=10;
export const vnDay=(now=Date.now())=>Math.floor((now+7*3600000)/86400000);
export const nextVnDay=(now=Date.now())=>(vnDay(now)+1)*86400000-7*3600000;

// ---- Kỹ năng hạm đội: 5 nghề (tab gốc), mỗi "Cấp độ" 8 kỹ năng nối mũi tên, mỗi kỹ năng 20 cấp.
export const techClasses=['warrior','mage','ranger','assassin','priest'];
export const techClassNames={warrior:'Đấu Sĩ',mage:'Chỉ Huy',ranger:'Xạ Thủ',assassin:'Kiếm Sĩ',priest:'Hỗ Trợ'};
const S=(id,name,effects)=>({id,name,effects});
// effects: [field, per level]; pct = nhân vào chỉ số gốc, còn lại cộng thẳng (tỉ lệ 0-1) / Tốc cộng số.
export const techTiers=[
 [S('atk','Công',[['attackPct',.01]]),S('hp','Máu',[['maxHpPct',.01]]),S('speed','Tốc độ',[['speed',1]]),S('armor_break','Xuyên giáp',[['penetration',.005]]),
  S('crit','Chí mạng',[['critChance',.005]]),S('crit_dmg','ST chí mạng',[['critDamage',.01]]),S('block','Chặn',[['block',.005]]),S('precision','Chính xác',[['accuracy',.005]])],
 [S('skill_dmg','ST kỹ năng',[['skillDamage',.01]]),S('hp_atk','Máu và Công',[['maxHpPct',.005],['attackPct',.005]]),S('speed_atk','Tốc và Công',[['speed',.5],['attackPct',.005]]),
  S('hp_skill_dmg','Máu và ST kỹ năng',[['maxHpPct',.005],['skillDamage',.005]]),S('stun_immune','Kháng Choáng',[['resist.stun',.01]]),S('freeze_immune','Kháng Đóng băng',[['resist.freeze',.01]]),
  S('perify_immune','Kháng Hóa đá',[['resist.petrify',.01]]),S('twine_immune','Kháng Câm lặng',[['resist.silence',.01]])],
 [S('anti_warrior','Khắc Đấu Sĩ',[['vs.warrior',.01]]),S('anti_mage','Khắc Chỉ Huy',[['vs.mage',.01]]),S('anti_ranger','Khắc Xạ Thủ',[['vs.ranger',.01]]),S('anti_assassin','Khắc Kiếm Sĩ',[['vs.assassin',.01]]),
  S('anti_priest','Khắc Hỗ Trợ',[['vs.priest',.01]]),S('hp_atk','Máu và Công',[['maxHpPct',.005],['attackPct',.005]]),S('speed_atk','Tốc và Công',[['speed',.5],['attackPct',.005]]),S('crit_dmg','ST chí mạng',[['critDamage',.01]])],
];
export const techMaxLevel=20,techRequire=10,techTierGuildLevel=[1,3,5],resetPrice=100;
export const techCost=(tier,level)=>({gold:Math.round(20000*tier*(1+level*.25)),coin:Math.round(30*tier*(1+level*.25))});
const blankClass=()=>({tier:1,levels:[0,0,0,0,0,0,0,0],spent:{gold:0,coin:0},resets:0});
export function guildState(p){
 const g=p.guild??={};g.tech??={};for(const c of techClasses){g.tech[c]??=blankClass();const t=g.tech[c];t.levels=Array.from({length:8},(_,i)=>Math.max(0,Math.min(techMaxLevel,Math.floor(t.levels?.[i]||0))));t.tier=Math.max(1,Math.min(techTiers.length,t.tier||1));t.spent??={gold:0,coin:0}}
 return g;
}
const heroClassOf=cls=>cls==='fighter'?'warrior':cls;
/** Cộng dồn hiệu ứng kỹ năng hạm đội cho một nghề (các Cấp độ đã qua tính đủ 20 cấp × 8 kỹ năng). */
export function techBonus(p,cls){
 const out={},t=p.guild?.id?p.guild.tech?.[heroClassOf(cls)]:null;if(!t)return out;
 for(let tier=1;tier<=t.tier;tier++)techTiers[tier-1].forEach((s,i)=>{const lv=tier<t.tier?techMaxLevel:Math.max(0,Math.min(techMaxLevel,t.levels[i]||0));if(!lv)return;for(const [field,per] of s.effects)out[field]=(out[field]||0)+per*lv});
 return out;
}
/** Áp kỹ năng hạm đội vào chỉ số tướng (heroStats). */
export function applyTech(stats,bonus){
 for(const [field,value] of Object.entries(bonus)){
  if(field==='attackPct')stats.attack=Math.round(stats.attack*(1+value));
  else if(field==='maxHpPct')stats.maxHp=Math.round(stats.maxHp*(1+value));
  else if(field==='speed')stats.speed=Math.round(stats.speed+value);
  else if(field.startsWith('resist.')){const k=field.slice(7);stats.statusResist={...(stats.statusResist||{}),[k]:(stats.statusResist?.[k]||0)+value}}
  else if(field.startsWith('vs.')){const k=field.slice(3);stats.classDamage={...(stats.classDamage||{}),[k]:(stats.classDamage?.[k]||0)+value}}
  else stats[field]=(stats[field]||0)+value;
 }
 return stats;
}
export function techView(p){
 const g=p.guild||{};
 return Object.fromEntries(techClasses.map(c=>{const t=g.tech?.[c]||blankClass(),skills=techTiers[t.tier-1];
  return[c,{tier:t.tier,maxTier:techTiers.length,levels:[...t.levels],resets:t.resets||0,refund:t.spent,nextTierGuildLevel:techTierGuildLevel[t.tier]||null,
   skills:skills.map((s,i)=>({id:s.id,name:s.name,level:t.levels[i],max:techMaxLevel,effects:s.effects,cost:t.levels[i]<techMaxLevel?techCost(t.tier,t.levels[i]):null,locked:i>0&&t.levels[i-1]<techRequire}))}]}));
}
/** Nâng 1 cấp kỹ năng / lên Cấp độ kế / thiết lập lại. ctx: {pay(gold,coin), refund(gold,coin), spendDiamonds(n), guildLevel}. */
export function techAction(p,input,ctx){
 const g=guildState(p);requireCondition(g.id,'Hãy tạo hoặc gia nhập hạm đội',409,'NO_GUILD');
 const cls=String(input.cls||'');requireCondition(techClasses.includes(cls),'Nghề không hợp lệ.');const t=g.tech[cls];
 if(input.op==='upgrade'){
  const i=Number(input.index);requireCondition(Number.isInteger(i)&&i>=0&&i<8,'Kỹ năng không hợp lệ.');
  requireCondition(t.levels[i]<techMaxLevel,'Kỹ năng đã đạt cấp tối đa.',409,'TECH_MAX');
  requireCondition(i===0||t.levels[i-1]>=techRequire,`Yêu cầu kĩ năng trước đạt cấp ${techRequire}`,409,'TECH_LOCKED');
  const cost=techCost(t.tier,t.levels[i]);ctx.pay(cost.gold,cost.coin);t.spent.gold+=cost.gold;t.spent.coin+=cost.coin;t.levels[i]++;
  return{message:`${techTiers[t.tier-1][i].name} lên cấp ${t.levels[i]}.`,level:t.levels[i]};
 }
 if(input.op==='tier'){
  requireCondition(t.tier<techTiers.length,'Đã đạt cấp độ kỹ năng cao nhất.',409,'TECH_TIER_MAX');
  requireCondition(t.levels.every(l=>l>=techMaxLevel),'Bạn cần nâng cấp tối đa các kĩ năng đã',409,'TECH_NOT_MAXED');
  const need=techTierGuildLevel[t.tier];requireCondition(ctx.guildLevel>=need,`Yêu cầu bang đạt cấp độ ${need}`,409,'GUILD_LEVEL');
  t.tier++;t.levels=[0,0,0,0,0,0,0,0];return{message:`Kỹ năng ${techClassNames[cls]} lên Cấp độ ${t.tier}.`};
 }
 if(input.op==='reset'){
  requireCondition(t.tier>1||t.levels.some(Boolean),'Hệ kĩ năng chưa nâng cấp',409,'TECH_EMPTY');
  if(t.resets>0)ctx.spendDiamonds(resetPrice);
  const refund={...t.spent};ctx.refund(refund.gold,refund.coin);t.resets++;t.tier=1;t.levels=[0,0,0,0,0,0,0,0];t.spent={gold:0,coin:0};
  return{message:'Đã thiết lập lại hệ kỹ năng, hoàn trả toàn bộ beli và huy hiệu.',rewards:[{itemId:'gold',quantity:refund.gold},{itemId:guildCoin,quantity:refund.coin}].filter(r=>r.quantity>0)};
 }
 throw new GameError('Thao tác không hợp lệ.');
}

// ---- Boss
const grow=level=>level*(1+level/150);
/** Đơn vị quái của ải boss: đường tăng trưởng tướng ở cấp / sao gốc × hệ số gốc của tướng; Máu nhân bossHpScale (boss chung cả hạm đội). */
export function bossMonster(m,i){
 const star=1+(m.stars-1)*.2,g=grow(m.level),s=m.scale;
 const maxHp=Math.round((800+g*82)*star*s.maxHp*bossHpScale);
 return{id:'boss-'+i,name:m.name,avatar:m.avatar,faction:m.faction,heroClass:m.class==='fighter'?'warrior':m.class,level:m.level,stars:m.stars,monsterId:String(m.monsterId),position:m.position,
  maxHp,hp:maxHp,attack:Math.round((100+g*14)*star*s.attack),defense:Math.round((25+g*4)*star*s.defense),speed:Math.round((100+m.level*(1+m.level/600))*s.speed),visualIndex:i,skillLevel:m.skillLevel};
}
export const stageData=n=>guildData.stages[Math.max(1,Math.min(guildData.stages.length,n))-1];
export const stageHp=n=>stageData(n).monsters.map((m,i)=>bossMonster(m,i).maxHp);
export function bossPower(n){return stageData(n).monsters.reduce((sum,m,i)=>{const u=bossMonster(m,i);return sum+Math.round(u.attack*2.4+u.maxHp/bossHpScale*.13+u.defense*2)},0)}
/** Thưởng xếp hạng sát thương khi hạ boss: top 1, 2, 3, 4-10, 11-15, 16-20, 21-30. */
export function finalReward(n,rank){const f=stageData(n).final,key=rank<=3?String(rank):rank<=10?'10':rank<=15?'15':rank<=20?'20':rank<=30?'30':null;return key?f[key]:null}
export function validName(name){
 requireCondition(typeof name==='string','Tên hạm đội không hợp lệ.');const n=name.trim();
 requireCondition(n.length>=nameMin&&n.length<=nameMax&&!/[<>\u0000-\u001f]/.test(n),`Tên bang phải từ ${nameMin} đến ${nameMax} kí tự`,400,'GUILD_NAME');return n;
}
