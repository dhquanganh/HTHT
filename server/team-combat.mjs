import {skillTier} from './luffy-skills.mjs';
import {zoroTiers} from './zoro-combat.mjs';

const alive=units=>units.filter(u=>u.hp>0);
const isZoro=u=>u.heroId==='zoro-king-of-hell';
const isLuffy=u=>u.heroId==='luffy-gear-2';
const ztier=(u,id)=>zoroTiers[id][Math.min(3,Math.max(1,u.skills?.[id]||1))-1];
function stat(u,key,round){
 const total=(u.effects||[]).filter(e=>e.attribute===key&&e.expiresTurn>=round).reduce((n,e)=>n+e.value,0);
 if(key==='critChance')return Math.max(0,Math.min(1,(u.critChance||0)-total));
 return Math.max(0,Math.round((u['base'+key[0].toUpperCase()+key.slice(1)]??u[key])*(1+total)));
}
export function initializeTeamBattle(b){
 b.hero=b.allies[0];
 for(const u of [...b.allies,...b.enemies]){
  u.baseAttack??=u.attack;u.baseDefense??=u.defense;u.baseSpeed??=u.speed;u.effects??=[];u.cooldowns??={};u.critChance??=u.side==='enemy'?.2:0;
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
 const addEffect=(source,target,skillId,name,attribute,value,expiresTurn)=>{
  if(target.immuneDebuff&&source.side!==target.side)return;
  if(source.side!==target.side&&(target.debuffResist||0)>0&&random()<target.debuffResist){emit({type:'resist',actor:target.id,target:target.id,skillId,name});return}
  const id=skillId+':'+source.id+':'+attribute;target.effects=target.effects.filter(e=>e.id!==id);target.effects.push({id,skillId,source:source.id,name,attribute,value,expiresTurn});emit({type:'buff',actor:source.id,target:target.id,skillId,name,attribute,value,expiresTurn});
 };
 for(const u of [...b.allies,...b.enemies]){
  for(const e of u.effects.filter(e=>e.expiresTurn<b.turn))emit({type:'effect-expired',actor:e.source,target:u.id,skillId:e.skillId,name:e.name});
  u.effects=u.effects.filter(e=>e.expiresTurn>=b.turn);
  for(const key of Object.keys(u.cooldowns))u.cooldowns[key]=Math.max(0,u.cooldowns[key]-1);
 }
 const firstTarget=unit=>{
  const available=alive(opponents(unit));
  if(isZoro(unit))return available.sort((a,c)=>a.hp-c.hp||a.position-c.position)[0];
  const front=available.filter(u=>u.frontRow);return(front.length?front:available).sort((a,c)=>a.position-c.position||a.id.localeCompare(c.id))[0];
 };
 const hit=(source,target,{multiplier=1,skill=false,skillId,bypass=false,missing=0,cap=0,execute=0,trueDamage=0,penetration=0,flat=0}={})=>{
  if(target.passives?.includes('penetration')){penetration=0;trueDamage=0}
  const attack=stat(source,'attack',b.turn),haki=isZoro(target)?ztier(target,'conqueror-haki'):null;
  const immune=!bypass&&(target.damageImmune||haki&&b.turn<=haki.duration&&stat(source,'attack',b.turn)<stat(target,'attack',b.turn)&&random()<haki.immunity);
  const miss=!bypass&&(target.dodgeChance||0)>0&&random()<target.dodgeChance;
  const chance=stat(source,'critChance',b.turn),critical=!flat&&chance>0&&random()<chance;
  const raw=(attack*multiplier+Math.min(Math.max(0,target.maxHp-target.hp)*missing,attack*cap))*(skill?1+(source.skillDamage||0):1);
  const pierce=Math.min(1,penetration+(target.passives?.includes('penetration')?0:source.penetration||0));
  const normal=Math.max(1,raw*(critical?1.5+(source.critDamage||0):1)-stat(target,'defense',b.turn)*(1-pierce)*.6);
  // Chặn trừ đi Chính xác của người đánh; đòn bị chặn còn một nửa. Giảm ST tối đa 90% như mô tả Thủ của game.
  const blocked=!flat&&!bypass&&random()<Math.max(0,(target.block||0)-(source.accuracy||0)),guard=(blocked?.5:1)*(1-Math.min(.9,target.damageReduction||0));
  const resistance=isZoro(target)&&!bypass?ztier(target,'enma').reduction:0;
  let amount=immune||miss?0:Math.max(1,Math.round(flat?flat*(1-Math.min(.9,target.damageReduction||0)):(normal*(1-resistance)+raw*(trueDamage+(target.passives?.includes('penetration')?0:source.trueDamage||0))*(1-resistance))*guard*(.94+random()*.12)));
  // Lì Đòn giảm đòn chí mạng, Thôn Phệ giảm đòn nộ: mỗi mùa boss có một trong hai hoặc kỹ năng khác.
  if(target.passives&&(critical&&target.passives.includes('critical')||skill&&target.passives.includes('ultimate')))amount=Math.max(1,Math.round(amount*.01));
  if(target.immortal&&!bypass)amount=Math.min(amount,Math.max(0,target.hp-1));
  target.hp=Math.max(0,target.hp-amount);target.energy=Math.min(100,(target.energy||0)+12);
  if(target.endless){target.damageTaken+=amount;if(!target.hp)target.hp=target.maxHp}
  emit({type:'damage',actor:source.id,target:target.id,amount,hp:target.hp,energy:target.energy,skill,skillId,bypass,immune:!!immune,miss:!!miss,critical,blocked});
  if(execute&&!target.endless&&target.hp>0&&target.hp/target.maxHp<execute){const remaining=target.hp;target.hp=0;emit({type:'execute',actor:source.id,target:target.id,amount:remaining,hp:0,name:'Trảm Sát'})}
  if(!target.hp){emit({type:'death',actor:source.id,target:target.id});return{dead:true,landed:!immune&&!miss}}
  if(amount>0&&isLuffy(target)){
   addEffect(target,source,'polish','Mài Dũa','critChance',skillTier(target.skills,'polish').values.critReduction,b.turn+3);
   if(!target.desperationUsed&&target.hp/target.maxHp<.3){target.desperationUsed=true;addEffect(target,target,'desperation','Tuyệt Cảnh','defense',skillTier(target.skills,'desperation').values.armor,b.turn+2)}
  }
  return{dead:false,landed:!immune&&!miss};
 };
 const queue=alive([...b.allies,...b.enemies]).sort((a,c)=>stat(c,'speed',b.turn)-stat(a,'speed',b.turn)||(a.side===c.side?0:a.side==='ally'?-1:1)||a.position-c.position||a.id.localeCompare(c.id));
 b.initiative=queue.map(u=>u.id);
 for(const u of queue){
  if(!u.hp||!alive(opponents(u)).length)continue;
  emit({type:'unit-turn',actor:u.id,energy:u.energy,hp:u.hp,speed:stat(u,'speed',b.turn)});
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
   const cast=action==='skill'||action==='auto'&&u.energy>=100;
   if(cast){
    u.energy-=100;
    const castOnce=()=>{const t=firstTarget(u);if(!t)return false;addEffect(u,u,'hiryu-jigoku','Ippyakusanjo Hiryu Jigoku','attack',ultimate.attack,b.turn+ultimate.duration-1);emit({type:'skill',actor:u.id,target:t.id,skillId:'hiryu-jigoku',animation:'skill',name:'Ippyakusanjo Hiryu Jigoku',energy:u.energy});return strike(t,true)};
    const killed=castOnce(),follow=ztier(u,'decisive-strike');if(alive(opponents(u)).length&&random()<(killed?follow.killChance:follow.chance)){emit({type:'trigger',actor:u.id,skillId:'decisive-strike',name:'Đòn Quyết Định'});castOnce()}
   }else{emit({type:'attack',actor:u.id,target:target.id,animation:'beat'});strike(target,false);u.energy=Math.min(100,u.energy+35)}
  }else if(isLuffy(u)){
   const cast=action==='skill'||action==='auto'&&u.energy>=80&&!u.cooldowns['rubber-whip'];
   if(cast){
    u.energy-=80;u.cooldowns['rubber-whip']=3;const values=skillTier(u.skills,'rubber-whip').values,attack=stat(u,'attack',b.turn);
    emit({type:'skill',actor:u.id,target:target.id,skillId:'rubber-whip',animation:'skill3',name:'Roi Cao Su',energy:u.energy});hit(u,target,{multiplier:values.damage,skill:true,skillId:'rubber-whip'});
    const healed=alive(side(u)).sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp||a.position-c.position)[0];
    const amount=Math.min(healed.maxHp-healed.hp,Math.round(attack*values.heal));healed.hp+=amount;emit({type:'heal',actor:u.id,target:healed.id,skillId:'rubber-whip',amount,hp:healed.hp});
    if(values.attackBuff)addEffect(u,u,'rubber-whip','Roi Cao Su','attack',values.attackBuff,b.turn+2);
   }else{emit({type:'attack',actor:u.id,target:target.id,animation:'beat'});hit(u,target,{multiplier:1.12});u.energy=Math.min(100,u.energy+35)}
  }else if(u.ultimate&&u.energy>=100&&(action==='skill'||action==='auto')){
   u.energy-=100;const ult=u.ultimate,foes=alive(opponents(u)),team=alive(side(u));
   const ranked=manual?[manual,...foes.filter(t=>t!==manual)]:ult.pick==='lowest'?[...foes].sort((a,c)=>a.hp-c.hp||a.position-c.position):ult.pick==='rage'?[...foes].sort((a,c)=>(c.energy||0)-(a.energy||0)||a.position-c.position):ult.pick==='back'?[...foes].sort((a,c)=>a.frontRow-c.frontRow||a.position-c.position):ult.pick==='random'?foes.map(t=>[random(),t]).sort((a,c)=>a[0]-c[0]).map(x=>x[1]):[target,...foes.filter(t=>t!==target)];
   const targets=ult.damage?ranked.slice(0,ult.targets):[];
   emit({type:'skill',actor:u.id,target:(targets[0]||target).id,skillId:ult.id,animation:'skill',name:ult.name,energy:u.energy});
   if(ult.buff)for(const ally of ult.buff.team?team:[u])addEffect(u,ally,ult.id,ult.name,'attack',ult.buff.value,b.turn+ult.buff.duration-1);
   for(const t of targets)if(t.hp>0)hit(u,t,{multiplier:ult.damage,skill:true,skillId:ult.id});
   if(ult.heal){const attack=stat(u,'attack',b.turn),living=alive(side(u)),healed=ult.heal.team?living:[...living].sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp||a.position-c.position).slice(0,1);
    for(const ally of healed){const amount=Math.min(ally.maxHp-ally.hp,Math.round(ult.heal.attack?attack*ult.heal.attack:ally.maxHp*ult.heal.maxHp));ally.hp+=amount;emit({type:'heal',actor:u.id,target:ally.id,skillId:ult.id,amount,hp:ally.hp})}}
  }else{emit({type:'attack',actor:u.id,target:target.id,animation:'beat'});hit(u,target);u.energy=Math.min(100,u.energy+35)}
  emit({type:'unit-state',actor:u.id,hp:u.hp,energy:u.energy});
  if(!alive(b.allies).length||!alive(b.enemies).length)break;
 }
 b.hero=b.allies[0];return events;
}
