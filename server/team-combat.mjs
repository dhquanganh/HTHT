import {skillTier} from './luffy-skills.mjs';
import {zoroTiers} from './zoro-combat.mjs';
import {statusNames} from './skill-kit.mjs';

const alive=units=>units.filter(u=>u.hp>0);
const isZoro=u=>u.heroId==='zoro-king-of-hell';
const isLuffy=u=>u.heroId==='luffy-gear-2';
const ztier=(u,id)=>zoroTiers[id][Math.min(3,Math.max(1,u.skills?.[id]||1))-1];
// Công / Thủ / Tốc nhân theo %, các chỉ số còn lại (chí mạng, xuyên thủ, giảm ST...) cộng thẳng.
const scaled=new Set(['attack','defense','speed']);
function stat(u,key,round){
 const total=(u.effects||[]).filter(e=>e.attribute===key&&e.expiresTurn>=round).reduce((n,e)=>n+e.value,0);
 if(key==='critChance')return Math.max(0,Math.min(1,(u.critChance||0)-total));
 if(!scaled.has(key))return(u[key]||0)+total;
 return Math.max(0,Math.round((u['base'+key[0].toUpperCase()+key.slice(1)]??u[key])*(1+total)));
}
// Khống chế làm mất lượt; Câm lặng chỉ chặn Nộ; Uy hiếp còn chặn hồi Nộ.
const skipping=new Set(['stun','freeze','petrify','fear','panic']);
const hasStatus=(u,kind,round)=>(u.statuses||[]).some(s=>s.kind===kind&&s.until>=round);

/** Chỉ số bị động cộng thẳng khi vào trận (một lần): % Máu / Công / Thủ / Tốc, Tốc và Nộ cộng số, còn lại cộng vào thuộc tính. */
function applyKitStats(u){
 const s=u.kit?.stats;if(!s||u.kitApplied)return;u.kitApplied=true;
 const full=u.hp>=u.maxHp;u.maxHp=Math.round(u.maxHp*(1+(s.maxHp||0))+(s.maxHpFlat||0));if(full)u.hp=u.maxHp;
 u.baseAttack=Math.round(u.baseAttack*(1+(s.attack||0))+(s.attackFlat||0));u.attack=u.baseAttack;
 u.baseDefense=Math.round(u.baseDefense*(1+(s.defense||0))+(s.defenseFlat||0));u.defense=u.baseDefense;
 u.baseSpeed=Math.round(u.baseSpeed*(1+(s.speed||0))+(s.speedFlat||0));u.speed=u.baseSpeed;
 u.energy=Math.min(100,(u.energy||0)+(s.energy||0));
 for(const key of ['critChance','critDamage','critResist','penetration','penResist','trueDamage','skillDamage','damageReduction','dodgeChance','block','accuracy','lifesteal','controlResist','controlPierce','healTaken','healPower'])if(s[key])u[key]=(u[key]||0)+s[key];
 u.critChance=Math.min(1,u.critChance||0);u.dodgeChance=Math.min(.85,u.dodgeChance||0);u.damageReduction=Math.min(.9,u.damageReduction||0);
 u.resist={};for(const t of u.kit.triggers)if(t.on==='battleStart')for(const e of t.effects)if(e.type==='resist')u.resist[e.kind]=Math.max(u.resist[e.kind]||0,e.value);
}
export function initializeTeamBattle(b){
 b.hero=b.allies[0];
 for(const u of [...b.allies,...b.enemies]){
  u.baseAttack??=u.attack;u.baseDefense??=u.defense;u.baseSpeed??=u.speed;u.effects??=[];u.cooldowns??={};u.critChance??=u.side==='enemy'?.2:0;u.statuses??=[];u.dots??=[];u.shields??=[];
  applyKitStats(u);
  if(isZoro(u)&&!u.teamInitialized){
   const haki=ztier(u,'conqueror-haki');u.effects.push({id:'conqueror-haki:'+u.id,skillId:'conqueror-haki',source:u.id,name:'Haki Bá Vương',attribute:'attack',value:haki.attack*(u.frontRow?2:1),expiresTurn:haki.duration});
   if(u.frontRow)u.effects.push({id:'haki-speed:'+u.id,skillId:'conqueror-haki',source:u.id,name:'Haki Bá Vương',attribute:'speed',value:haki.speed,expiresTurn:haki.duration});
  }
  u.teamInitialized=true;
 }
}
export function teamRound(b,input={action:'auto'}){
 initializeTeamBattle(b);const events=[],emit=e=>{const v={id:b.events.length+events.length,turn:b.turn,...e};events.push(v);return v};
 const random=()=>{let x=b.seed>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;b.seed=x>>>0;return b.seed/4294967296};
 const side=u=>u.side==='ally'?b.allies:b.enemies,opponents=u=>u.side==='ally'?b.enemies:b.allies;
 const addEffect=(source,target,skillId,name,attribute,value,expiresTurn,stack=false)=>{
  if(target.immuneDebuff&&source.side!==target.side)return;
  if(source.side!==target.side&&(target.debuffResist||0)>0&&random()<target.debuffResist){emit({type:'resist',actor:target.id,target:target.id,skillId,name});return}
  const id=skillId+':'+source.id+':'+attribute+(stack?':'+b.turn:'');target.effects=target.effects.filter(e=>e.id!==id);target.effects.push({id,skillId,source:source.id,name,attribute,value,expiresTurn});emit({type:'buff',actor:source.id,target:target.id,skillId,name,attribute,value,expiresTurn});
 };
 // Phản ứng bị động phát sinh trong lúc đánh (bị đánh, máu thấp, chết) chạy sau khi hành động hiện tại xong.
 const pending=[];
 const triggersOf=(u,on)=>(u.kit?.triggers||[]).filter(t=>t.on===on);
 for(const u of [...b.allies,...b.enemies]){
  for(const e of u.effects.filter(e=>e.expiresTurn<b.turn))emit({type:'effect-expired',actor:e.source,target:u.id,skillId:e.skillId,name:e.name});
  u.effects=u.effects.filter(e=>e.expiresTurn>=b.turn);u.statuses=(u.statuses||[]).filter(s=>s.until>=b.turn);u.shields=(u.shields||[]).filter(s=>s.until>=b.turn&&(s.amount>0||s.hits>0));
  for(const key of Object.keys(u.cooldowns))u.cooldowns[key]=Math.max(0,u.cooldowns[key]-1);
 }
 const firstTarget=unit=>{
  const available=alive(opponents(unit));
  if(isZoro(unit))return available.sort((a,c)=>a.hp-c.hp||a.position-c.position)[0];
  const front=available.filter(u=>u.frontRow);return(front.length?front:available).sort((a,c)=>a.position-c.position||a.id.localeCompare(c.id))[0];
 };
 const heal=(source,target,amount,skillId)=>{if(!target.hp)return;const value=Math.min(target.maxHp-target.hp,Math.round(amount*(1+(source.healPower||0))*(1+(target.healTaken||0))));if(value<=0)return;target.hp+=value;emit({type:'heal',actor:source.id,target:target.id,skillId,amount:value,hp:target.hp})};
 const hit=(source,target,{multiplier=1,skill=false,skillId,bypass=false,missing=0,cap=0,execute=0,trueDamage=0,penetration=0,flat=0,forceCritical=false,periodic=false}={})=>{
  if(target.passives?.includes('penetration')){penetration=0;trueDamage=0}
  const attack=stat(source,'attack',b.turn),haki=isZoro(target)?ztier(target,'conqueror-haki'):null;
  const immune=!bypass&&(target.damageImmune||haki&&b.turn<=haki.duration&&stat(source,'attack',b.turn)<stat(target,'attack',b.turn)&&random()<haki.immunity);
  const dodge=Math.min(.85,stat(target,'dodgeChance',b.turn)),miss=!bypass&&dodge>0&&random()<dodge;
  const chance=stat(source,'critChance',b.turn),critical=!flat&&(forceCritical||chance>0&&random()<chance);
  const raw=(attack*multiplier+Math.min(Math.max(0,target.maxHp-target.hp)*missing,attack*cap))*(skill?1+stat(source,'skillDamage',b.turn):1);
  const pierce=Math.max(0,Math.min(1,penetration+(target.passives?.includes('penetration')?0:stat(source,'penetration',b.turn))-(target.penResist||0)));
  const critBonus=Math.max(0,.5+stat(source,'critDamage',b.turn)-(target.critResist||0));
  const normal=Math.max(1,raw*(critical?1+critBonus:1)-stat(target,'defense',b.turn)*(1-pierce)*.6);
  // Chặn trừ đi Chính xác của người đánh; đòn bị chặn còn một nửa. Giảm ST tối đa 90% như mô tả Thủ của game.
  const blocked=!flat&&!bypass&&random()<Math.max(0,stat(target,'block',b.turn)-stat(source,'accuracy',b.turn)),guard=(blocked?.5:1)*(1-Math.min(.9,Math.max(0,stat(target,'damageReduction',b.turn))));
  const resistance=isZoro(target)&&!bypass?ztier(target,'enma').reduction:0;
  let amount=immune||miss?0:Math.max(1,Math.round(flat?flat*(1-Math.min(.9,target.damageReduction||0)):(normal*(1-resistance)+raw*(trueDamage+(target.passives?.includes('penetration')?0:Math.max(0,stat(source,'trueDamage',b.turn))))*(1-resistance))*guard*(.94+random()*.12)));
  // Lì Đòn giảm đòn chí mạng, Thôn Phệ giảm đòn nộ: mỗi mùa boss có một trong hai hoặc kỹ năng khác.
  if(target.passives&&(critical&&target.passives.includes('critical')||skill&&target.passives.includes('ultimate')))amount=Math.max(1,Math.round(amount*.01));
  // Khiên: chặn N đợt sát thương hoặc hấp thụ một lượng máu.
  let absorbed=0;
  if(amount>0&&!bypass)for(const s of target.shields||[]){if(s.until<b.turn)continue;if(s.hits>0){s.hits--;absorbed=amount;amount=0;break}if(s.amount>0){const take=Math.min(s.amount,amount);s.amount-=take;amount-=take;absorbed+=take;if(!amount)break}}
  if(target.immortal&&!bypass)amount=Math.min(amount,Math.max(0,target.hp-1));
  const before=target.hp;target.hp=Math.max(0,target.hp-amount);if(!hasStatus(target,'fear',b.turn))target.energy=Math.min(100,(target.energy||0)+12);
  if(target.endless){target.damageTaken+=amount;if(!target.hp)target.hp=target.maxHp}
  emit({type:'damage',actor:source.id,target:target.id,amount,hp:target.hp,energy:target.energy,skill,skillId,bypass,immune:!!immune,miss:!!miss,critical,blocked,...(absorbed?{absorbed}:{})});
  if(amount>0&&stat(source,'lifesteal',b.turn)>0)heal(source,source,amount*stat(source,'lifesteal',b.turn),'lifesteal');
  if(execute&&!target.endless&&target.hp>0&&target.hp/target.maxHp<execute){const remaining=target.hp;target.hp=0;emit({type:'execute',actor:source.id,target:target.id,amount:remaining,hp:0,name:'Trảm Sát'})}
  if(!target.hp){
   const revive=triggersOf(target,'death').flatMap(t=>t.effects).find(e=>e.type==='revive');
   if(revive&&!target.revived){target.revived=true;target.hp=Math.max(1,Math.round(target.maxHp*revive.maxHp));target.statuses=[];target.dots=[];emit({type:'trigger',actor:target.id,skillId:'revive',name:'Hồi sinh'});emit({type:'heal',actor:target.id,target:target.id,skillId:'revive',amount:target.hp,hp:target.hp,revive:true});return{dead:false,landed:true,critical,amount}}
   emit({type:'death',actor:source.id,target:target.id});
   for(const t of triggersOf(target,'death'))if(t.effects.some(e=>e.type!=='revive'))pending.push({unit:target,trigger:t,cause:source,dead:true});
   return{dead:true,landed:!immune&&!miss,critical,amount};
  }
  if(amount>0&&isLuffy(target)){
   addEffect(target,source,'polish','Mài Dũa','critChance',skillTier(target.skills,'polish').values.critReduction,b.turn+3);
   if(!target.desperationUsed&&target.hp/target.maxHp<.3){target.desperationUsed=true;addEffect(target,target,'desperation','Tuyệt Cảnh','defense',skillTier(target.skills,'desperation').values.armor,b.turn+2)}
  }
  if(amount>0&&target.kit&&!periodic){
   for(const t of triggersOf(target,'hurt'))if(t.from==='any'||t.from==='critical'&&critical||t.from==='ultimate'&&skill)pending.push({unit:target,trigger:t,cause:source});
   for(const t of triggersOf(target,'lowHp'))if(!target['low:'+t.skill]&&before/target.maxHp>=t.threshold&&target.hp/target.maxHp<t.threshold){target['low:'+t.skill]=true;pending.push({unit:target,trigger:t,cause:source})}
  }
  return{dead:false,landed:!immune&&!miss,critical,amount};
 };

 // ----- Bộ kỹ năng đọc từ mô tả (server/skill-kit.mjs) -----
 const pickTargets=(u,sel,preferred)=>{
  let foes=alive(opponents(u));if(!foes.length)return[];
  if(sel?.row){const row=foes.filter(t=>sel.row==='back'?!t.frontRow:t.frontRow);if(row.length)foes=row}
  const by={lowest:(a,c)=>a.hp-c.hp,rage:(a,c)=>(c.energy||0)-(a.energy||0),attack:(a,c)=>stat(c,'attack',b.turn)-stat(a,'attack',b.turn),highestHp:(a,c)=>c.maxHp-a.maxHp,back:(a,c)=>a.frontRow-c.frontRow}[sel?.pick];
  let ranked=sel?.pick==='random'?foes.map(t=>[random(),t]).sort((a,c)=>a[0]-c[0]).map(x=>x[1]):[...foes].sort((a,c)=>(by?by(a,c):0)||a.position-c.position);
  if(preferred&&ranked.includes(preferred)&&(!sel?.pick||sel.pick==='front'))ranked=[preferred,...ranked.filter(t=>t!==preferred)];
  else if(!by&&sel?.pick!=='random'){const first=firstTarget(u);if(first&&ranked.includes(first))ranked=[first,...ranked.filter(t=>t!==first)]}
  return ranked.slice(0,sel?.count||1);
 };
 const applyStatus=(u,t,e,skillId,name)=>{
  if(!t.hp)return;const resist=Math.min(1,(t.resist?.[e.kind]||0)+Math.max(0,(t.controlResist||0)-(u.controlPierce||0)));
  if(random()>=e.chance*(1-resist)){if(e.chance*(1-resist)<e.chance)emit({type:'resist',actor:t.id,target:t.id,skillId,name:statusNames[e.kind]});return}
  t.statuses=t.statuses.filter(s=>s.kind!==e.kind);t.statuses.push({kind:e.kind,until:b.turn+e.turns-1+(e.kind==='silence'?0:0),source:u.id});
  emit({type:'buff',actor:u.id,target:t.id,skillId,name:statusNames[e.kind],attribute:e.kind,value:0,expiresTurn:b.turn+e.turns-1});
 };
 const applyStat=(u,x,e,skillId,name)=>{
  if(!x.hp)return;let value=e.value;
  if(scaled.has(e.attr)&&e.flat)value=e.value/Math.max(1,x['base'+e.attr[0].toUpperCase()+e.attr.slice(1)]);
  if(e.attr==='critChance')value=-value;// critChance: hiệu ứng được trừ vào tỉ lệ (theo cách Mài Dũa của Luffy)
  addEffect(u,x,skillId,name,e.attr,value,e.turns>=99?999:b.turn+e.turns-1,e.turns>=99);
 };
 /** Chạy danh sách hiệu ứng. `hitTargets` là mục tiêu của đòn đánh trong cùng câu (khống chế, DoT, giảm chỉ số áp lên chúng). */
 const runEffects=(u,effects,{skill=false,skillId,name,preferred=null,cause=null,scale=1,depth=0}={})=>{
  let hitTargets=[],lastDamage=0;
  for(const e of effects){
   if(!u.hp&&e.type!=='damage')continue;
   const victims=()=>e.select?pickTargets(u,e.select,preferred).filter(t=>e.cond!=='slower'||stat(t,'speed',b.turn)<stat(u,'speed',b.turn)):hitTargets.length?hitTargets.filter(t=>t.hp>0):cause&&cause.side!==u.side&&cause.hp>0?[cause]:pickTargets(u,{count:1},preferred);
   if(e.type==='damage'){
    if(e.followUp){if(random()>=(e.chance??1))continue;const t=hitTargets.find(x=>x.hp>0)||pickTargets(u,e.select,preferred)[0];if(t)hit(u,t,{multiplier:e.mult*scale,skill,skillId});continue}
    const targets=pickTargets(u,e.select,preferred);if(!targets.length)continue;hitTargets=targets;
    const attack=Math.max(1,stat(u,'attack',b.turn)),mult=((e.mult||0)+(e.hpMult?e.hpMult*u.maxHp/attack:0)+(e.defMult?e.defMult*stat(u,'defense',b.turn)/attack:0))*scale||1;
    for(let i=0;i<(e.hits||1);i++)for(const t of targets)if(t.hp>0){const per=e.foeHp?Math.min(e.cap||4,e.foeHp*t.maxHp/attack)*scale:0;const r=hit(u,t,{multiplier:(mult+per)/(e.hits>1?Math.sqrt(e.hits):1),skill,skillId,trueDamage:e.pierce?.3:0,forceCritical:e.critical});lastDamage+=r.amount||0}
   }
   else if(e.type==='status')for(const t of victims())applyStatus(u,t,e,skillId,name);
   else if(e.type==='dot'){const amount=Math.max(1,Math.round(stat(u,'attack',b.turn)*e.mult*scale));for(const t of victims())if(t.hp>0&&random()<(e.chance??1)){t.dots.push({kind:e.kind,amount,until:b.turn+Math.min(e.turns,20)-1,source:u.id,skillId});emit({type:'buff',actor:u.id,target:t.id,skillId,name:statusNames[e.kind],attribute:e.kind,value:amount,expiresTurn:b.turn+Math.min(e.turns,20)-1})}}
   else if(e.type==='stat'){const list=e.on==='team'?alive(side(u)):e.on==='self'?[u]:e.on==='enemies'?alive(opponents(u)).filter(t=>e.cond!=='slower'||stat(t,'speed',b.turn)<stat(u,'speed',b.turn)):victims();for(const x of list)applyStat(u,x,e,skillId,name)}
   else if(e.type==='heal'){const team=alive(side(u)),list=e.on==='team'?team:e.on==='lowest'?[...team].sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp)[0]?[[...team].sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp)[0]]:[]:e.on==='some'?[...team].sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp).slice(0,e.count||2):[u];
    for(const x of list)heal(u,x,e.attack?stat(u,'attack',b.turn)*e.attack*scale:x.maxHp*e.maxHp,skillId)}
   else if(e.type==='shield'){const list=e.on==='team'?alive(side(u)):[u];for(const x of list){x.shields.push(e.block?{hits:e.block,until:b.turn+e.turns-1}:{amount:Math.round(e.maxHp?u.maxHp*e.maxHp:stat(u,'attack',b.turn)*e.attack),until:b.turn+e.turns-1});emit({type:'buff',actor:u.id,target:x.id,skillId,name:'Khiên chắn',attribute:'shield',value:0,expiresTurn:b.turn+e.turns-1})}}
   else if(e.type==='energy'){
    if(e.on==='target'){for(const t of victims())if(random()<(e.chance??1)){const taken=Math.min(t.energy||0,-e.value);t.energy-=taken;emit({type:'unit-state',actor:t.id,hp:t.hp,energy:t.energy});if(e.steal){u.energy=Math.min(100,u.energy+taken)}}}
    else for(const x of e.on==='team'?alive(side(u)):[u])if(!hasStatus(x,'fear',b.turn)){x.energy=Math.min(100,(x.energy||0)+e.value);emit({type:'unit-state',actor:x.id,hp:x.hp,energy:x.energy})}
    if(e.steal)emit({type:'unit-state',actor:u.id,hp:u.hp,energy:u.energy});
   }
   else if(e.type==='cleanse'){for(const x of e.on==='team'?alive(side(u)):[u]){let n=e.count;x.statuses=x.statuses.filter(()=>n-->0?false:true);x.dots=x.dots.slice(Math.max(0,n));x.effects=x.effects.filter(f=>!(f.value<0&&f.source!==x.id&&n-->0))}}
   else if(e.type==='dispel'){for(const t of victims())if(random()<(e.chance??1)){let n=e.count;t.effects=t.effects.filter(f=>!(f.value>0&&n-->0));t.shields=n>0?[]:t.shields}}
   else if(e.type==='counter'&&cause&&cause.hp>0&&cause.side!==u.side&&u.counterTurn!==b.turn&&random()<(e.chance??1)){u.counterTurn=b.turn;emit({type:'trigger',actor:u.id,skillId,name:'Phản công'});kitBasic(u,cause,depth+1)}
   else if(e.type==='castUlt'&&depth===0&&random()<(e.chance??1)&&!hasStatus(u,'silence',b.turn)){emit({type:'trigger',actor:u.id,skillId,name});castKitUltimate(u,null,depth+1,true)}
   else if(e.type==='extraAction'&&depth===0&&random()<(e.chance??1)){emit({type:'trigger',actor:u.id,skillId,name});kitBasic(u,firstTarget(u),depth+1)}
  }
  return{hitTargets,lastDamage};
 };
 const flushPending=()=>{let guard=0;while(pending.length&&guard++<40){const {unit,trigger,cause,dead}=pending.shift();if(!dead&&!unit.hp)continue;if(random()>=(trigger.chance??1))continue;emit({type:'trigger',actor:unit.id,skillId:'passive',name:trigger.skill});runEffects(unit,trigger.effects.filter(e=>e.type!=='revive'),{skillId:'passive',name:trigger.skill,cause})}};
 const afterUltimate=caster=>{
  for(const t of triggersOf(caster,'selfUlt'))pending.push({unit:caster,trigger:t});
  // "Bất cứ tướng nào sử dụng Nộ" gồm cả bản thân; "khi đồng đội dùng Nộ" chỉ đồng đội cùng phe.
 for(const x of alive([...b.allies,...b.enemies]))for(const t of triggersOf(x,'allyUlt'))if(t.scope==='any'||x!==caster&&x.side===caster.side)pending.push({unit:x,trigger:t});
 };
 function castKitUltimate(u,manual,depth=0,free=false){
  const ult=u.kit.ultimate,base=u.ultimate||{id:u.heroId+'-ult',name:ult.name};if(!free)u.energy-=100;
  const preferred=manual||firstTarget(u),first=pickTargets(u,ult.effects.find(e=>e.type==='damage')?.select,preferred)[0]||preferred;
  emit({type:'skill',actor:u.id,target:(first||u).id,skillId:base.id,animation:'skill',name:base.name,energy:u.energy});
  runEffects(u,ult.effects,{skill:true,skillId:base.id,name:base.name,preferred,scale:u.ultScale||1,depth});
  afterUltimate(u);
 }
 function kitBasic(u,target,depth=0){
  const replace=triggersOf(u,'attack').find(t=>t.replace),riders=triggersOf(u,'attack').filter(t=>!t.replace);
  emit({type:'attack',actor:u.id,target:target.id,animation:'beat'});
  let hitTargets=[target];
  if(replace)hitTargets=runEffects(u,replace.effects,{skillId:'basic',name:replace.skill,preferred:target,depth}).hitTargets;
  else hit(u,target);
  for(const t of riders)if(random()<(t.chance??1))runEffects(u,t.effects,{skillId:'basic',name:t.skill,preferred:target,depth,cause:null,...{}}),void 0;
  if(!hasStatus(u,'fear',b.turn))u.energy=Math.min(100,u.energy+35);
  return hitTargets;
 }

 // Đầu hiệp: bị động "đầu mỗi hiệp" (và "vào trận" ở hiệp 1).
 for(const u of alive([...b.allies,...b.enemies])){
  if(b.turn===1)for(const t of triggersOf(u,'battleStart')){const effects=t.effects.filter(e=>e.type!=='resist');if(effects.length)runEffects(u,effects,{skillId:'passive',name:t.skill})}
  for(const t of triggersOf(u,'roundStart'))if(random()<(t.chance??1))runEffects(u,t.effects,{skillId:'passive',name:t.skill});
 }
 flushPending();

 const queue=alive([...b.allies,...b.enemies]).sort((a,c)=>stat(c,'speed',b.turn)-stat(a,'speed',b.turn)||(a.side===c.side?0:a.side==='ally'?-1:1)||a.position-c.position||a.id.localeCompare(c.id));
 b.initiative=queue.map(u=>u.id);
 for(const u of queue){
  if(!u.hp||!alive(opponents(u)).length)continue;
  emit({type:'unit-turn',actor:u.id,energy:u.energy,hp:u.hp,speed:stat(u,'speed',b.turn)});
  const blocked=[...skipping].find(kind=>hasStatus(u,kind,b.turn));
  if(blocked){emit({type:'buff',actor:u.id,target:u.id,skillId:'status',name:statusNames[blocked],attribute:blocked,value:0,expiresTurn:b.turn});emit({type:'unit-state',actor:u.id,hp:u.hp,energy:u.energy});continue}
  const silenced=hasStatus(u,'silence',b.turn);
  const action=u.id===b.hero.id?input.action:'auto';
  const manual=u.side==='ally'&&u.id===b.hero.id&&action!=='auto'?alive(opponents(u)).find(t=>t.id===input.targetId):null;
  const target=manual||firstTarget(u);if(!target)break;
  if(action==='defend'){
   u.energy=Math.min(100,u.energy+20);addEffect(u,u,'defend','Phòng thủ','defense',1.2,b.turn);emit({type:'defend',actor:u.id,name:'Phòng thủ',energy:u.energy});continue;
  }
  if(u.boss){
   // Skill 100208: đánh tất cả, 20% máu tối đa của mục tiêu, không quá 1500% công. Boss không có đòn thường.
   const attack=stat(u,'attack',b.turn);emit({type:'skill',actor:u.id,target:target.id,skillId:'boss-active',animation:'skill',name:'Đại Chiến',energy:u.energy});
   for(const t of alive(opponents(u)))hit(u,t,{skill:true,skillId:'boss-active',bypass:true,flat:Math.min(t.maxHp*.2,attack*15)});
  }else if(isZoro(u)){
   const enma=ztier(u,'enma'),ultimate=ztier(u,'hiryu-jigoku');
   const strike=(t,skill)=>{const bypass=enma.bypass>0&&random()<enma.bypass;const outcome=hit(u,t,{multiplier:skill?ultimate.damage:enma.basic,skill,skillId:skill?'hiryu-jigoku':'enma',bypass,missing:skill?ultimate.missing:enma.missing,cap:skill?ultimate.cap:enma.cap,execute:skill?ultimate.execute:0,trueDamage:enma.trueDamage,penetration:enma.penetration});if(!skill&&!outcome.dead&&outcome.landed)addEffect(u,t,'enma','Địa Ngục Kiếm Enma','attack',-enma.weaken,b.turn+enma.duration);return outcome.dead};
   const cast=!silenced&&(action==='skill'||action==='auto'&&u.energy>=100);
   if(cast){
    u.energy-=100;
    const castOnce=()=>{const t=firstTarget(u);if(!t)return false;addEffect(u,u,'hiryu-jigoku','Ippyakusanjo Hiryu Jigoku','attack',ultimate.attack,b.turn+ultimate.duration-1);emit({type:'skill',actor:u.id,target:t.id,skillId:'hiryu-jigoku',animation:'skill',name:'Ippyakusanjo Hiryu Jigoku',energy:u.energy});return strike(t,true)};
    const killed=castOnce(),follow=ztier(u,'decisive-strike');if(alive(opponents(u)).length&&random()<(killed?follow.killChance:follow.chance)){emit({type:'trigger',actor:u.id,skillId:'decisive-strike',name:'Đòn Quyết Định'});castOnce()}
    afterUltimate(u);
   }else{emit({type:'attack',actor:u.id,target:target.id,animation:'beat'});strike(target,false);u.energy=Math.min(100,u.energy+35)}
  }else if(isLuffy(u)){
   const cast=!silenced&&(action==='skill'||action==='auto'&&u.energy>=80&&!u.cooldowns['rubber-whip']);
   if(cast){
    u.energy-=80;u.cooldowns['rubber-whip']=3;const values=skillTier(u.skills,'rubber-whip').values,attack=stat(u,'attack',b.turn);
    emit({type:'skill',actor:u.id,target:target.id,skillId:'rubber-whip',animation:'skill3',name:'Roi Cao Su',energy:u.energy});hit(u,target,{multiplier:values.damage,skill:true,skillId:'rubber-whip'});
    const healed=alive(side(u)).sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp||a.position-c.position)[0];
    const amount=Math.min(healed.maxHp-healed.hp,Math.round(attack*values.heal));healed.hp+=amount;emit({type:'heal',actor:u.id,target:healed.id,skillId:'rubber-whip',amount,hp:healed.hp});
    if(values.attackBuff)addEffect(u,u,'rubber-whip','Roi Cao Su','attack',values.attackBuff,b.turn+2);
    afterUltimate(u);
   }else{emit({type:'attack',actor:u.id,target:target.id,animation:'beat'});hit(u,target,{multiplier:1.12});u.energy=Math.min(100,u.energy+35)}
  }else if(u.kit?.ultimate){
   if(!silenced&&u.energy>=100&&(action==='skill'||action==='auto'))castKitUltimate(u,manual);
   else kitBasic(u,target);
  }else if(!silenced&&u.ultimate&&u.energy>=100&&(action==='skill'||action==='auto')){
   u.energy-=100;const ult=u.ultimate,foes=alive(opponents(u)),team=alive(side(u));
   const ranked=manual?[manual,...foes.filter(t=>t!==manual)]:ult.pick==='lowest'?[...foes].sort((a,c)=>a.hp-c.hp||a.position-c.position):ult.pick==='rage'?[...foes].sort((a,c)=>(c.energy||0)-(a.energy||0)||a.position-c.position):ult.pick==='back'?[...foes].sort((a,c)=>a.frontRow-c.frontRow||a.position-c.position):ult.pick==='random'?foes.map(t=>[random(),t]).sort((a,c)=>a[0]-c[0]).map(x=>x[1]):[target,...foes.filter(t=>t!==target)];
   const targets=ult.damage?ranked.slice(0,ult.targets):[];
   emit({type:'skill',actor:u.id,target:(targets[0]||target).id,skillId:ult.id,animation:'skill',name:ult.name,energy:u.energy});
   if(ult.buff)for(const ally of ult.buff.team?team:[u])addEffect(u,ally,ult.id,ult.name,'attack',ult.buff.value,b.turn+ult.buff.duration-1);
   for(const t of targets)if(t.hp>0)hit(u,t,{multiplier:ult.damage,skill:true,skillId:ult.id});
   if(ult.heal){const attack=stat(u,'attack',b.turn),living=alive(side(u)),healed=ult.heal.team?living:[...living].sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp||a.position-c.position).slice(0,1);
    for(const ally of healed){const amount=Math.min(ally.maxHp-ally.hp,Math.round(ult.heal.attack?attack*ult.heal.attack:ally.maxHp*ult.heal.maxHp));ally.hp+=amount;emit({type:'heal',actor:u.id,target:ally.id,skillId:ult.id,amount,hp:ally.hp})}}
   afterUltimate(u);
  }else{emit({type:'attack',actor:u.id,target:target.id,animation:'beat'});hit(u,target);if(!hasStatus(u,'fear',b.turn))u.energy=Math.min(100,u.energy+35)}
  flushPending();
  emit({type:'unit-state',actor:u.id,hp:u.hp,energy:u.energy});
  if(!alive(b.allies).length||!alive(b.enemies).length)break;
 }
 // Cuối hiệp: sát thương theo lượt (thiêu đốt, độc, chảy máu) rồi bị động "cuối mỗi hiệp".
 if(alive(b.allies).length&&alive(b.enemies).length){
  for(const u of alive([...b.allies,...b.enemies])){
   for(const d of u.dots.filter(d=>d.until>=b.turn)){if(!u.hp)break;const source=[...b.allies,...b.enemies].find(x=>x.id===d.source)||u;hit(source,u,{flat:d.amount,bypass:true,periodic:true,skillId:d.kind})}
   u.dots=u.dots.filter(d=>d.until>b.turn);
  }
  for(const u of alive([...b.allies,...b.enemies]))for(const t of triggersOf(u,'roundEnd'))if(random()<(t.chance??1))runEffects(u,t.effects,{skillId:'passive',name:t.skill});
  flushPending();
 }
 b.hero=b.allies[0];return events;
}
