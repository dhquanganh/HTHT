import {heroLevels} from './hero-roster.mjs';

// Level 1–3 values transcribed from cache db_hero_skill (2581–2573); level 4 from the void [4] skills (2569–2572).
export const zoroTiers={
 'hiryu-jigoku':[{attack:.2,duration:2,damage:10,missing:.25,cap:20,execute:.15},{attack:.3,duration:3,damage:15,missing:.35,cap:30,execute:.2},{attack:.4,duration:4,damage:20,missing:.5,cap:40,execute:.25},{attack:.5,duration:5,damage:25,missing:1,cap:50,execute:.35,refund:100}],
 enma:[{trueDamage:.3,penetration:.1,reduction:.2,bypass:0,basic:2.5,missing:.15,cap:5,weaken:.15,duration:2},{trueDamage:.5,penetration:.2,reduction:.4,bypass:0,basic:3.5,missing:.25,cap:7,weaken:.25,duration:2},{trueDamage:.7,penetration:.3,reduction:.6,bypass:.5,basic:5,missing:.35,cap:10,weaken:.3,duration:3},{trueDamage:1,penetration:.5,reduction:.8,bypass:.5,basic:7.5,missing:.5,cap:15,weaken:.5,duration:3}],
 'conqueror-haki':[{duration:2,attack:.3,immunity:.6,speed:.3},{duration:2,attack:.5,immunity:.8,speed:.5},{duration:3,attack:.5,immunity:.8,speed:.5},{duration:3,attack:1,immunity:1,speed:1}],
 'decisive-strike':[{chance:.25,killChance:.5},{chance:.3,killChance:.6},{chance:.4,killChance:.8},{chance:.5,killChance:.9}],
};

export function zoroRound(b,type,{random,emit}){
 const h=b.hero,levels=heroLevels({id:'zoro-king-of-hell',skills:h.skills});
 const tier=id=>zoroTiers[id][Math.min(4,levels[id])-1],enma=tier('enma'),haki=tier('conqueror-haki'),ultimate=tier('hiryu-jigoku');
 const units=[h,...b.enemies];for(const u of units){u.effects??=[];u.baseAttack??=u.attack;u.baseDefense??=u.defense}
 const effect=(u,id,name,attribute,value,expiresTurn)=>{u.effects=u.effects.filter(e=>e.id!==id);const e={id,skillId:id,name,attribute,value,expiresTurn};u.effects.push(e);emit({type:'buff',actor:'hero',target:u.id,skillId:id,name,attribute,value,expiresTurn})};
 if(!h.zoroInitialized){h.zoroInitialized=true;h.baseSpeed=h.speed;effect(h,'conqueror-haki','Haki Bá Vương','attack',haki.attack*(h.frontRow===false?1:2),haki.duration)}
 for(const u of units){for(const e of u.effects.filter(e=>e.expiresTurn<b.turn))emit({type:'effect-expired',target:u.id,skillId:e.skillId,name:e.name});u.effects=u.effects.filter(e=>e.expiresTurn>=b.turn)}
 const attack=u=>Math.round(u.baseAttack*(1+u.effects.filter(e=>e.attribute==='attack').reduce((n,e)=>n+e.value,0)));
 h.speed=Math.round(h.baseSpeed*(b.turn<=haki.duration&&h.frontRow!==false?1+haki.speed:1));
 const lowest=()=>b.enemies.filter(e=>e.hp>0).sort((a,c)=>a.hp-c.hp||a.id.localeCompare(c.id))[0];
 const strike=(target,skill)=>{
  const atk=attack(h),cfg=skill?ultimate:{damage:enma.basic,missing:enma.missing,cap:enma.cap};
  const bypass=enma.bypass>0&&random()<enma.bypass;
  const miss=target.dodgeChance>0&&!bypass&&random()<target.dodgeChance;
  const raw=atk*cfg.damage+Math.min((target.maxHp-target.hp)*cfg.missing,atk*cfg.cap);
  const normal=Math.max(1,raw-target.baseDefense*(1-enma.penetration)*.6);
  let amount=Math.round((normal+raw*enma.trueDamage)*(.94+random()*.12));
  if(miss||target.damageImmune&&!bypass)amount=0;
  if(target.immortal&&!bypass)amount=Math.min(amount,Math.max(0,target.hp-1));
  target.hp=Math.max(0,target.hp-amount);
  emit({type:'damage',actor:'hero',target:target.id,amount,hp:target.hp,skill,bypass,miss});
  if(skill&&target.hp>0&&target.hp/target.maxHp<cfg.execute){
   const remaining=target.hp;target.hp=0;emit({type:'execute',actor:'hero',target:target.id,amount:remaining,hp:0,name:'Trảm Sát'});
  }
  if(target.hp===0){emit({type:'death',target:target.id});return true}
  if(!skill&&!miss)effect(target,'enma','Địa Ngục Kiếm Enma','attack',-enma.weaken,b.turn+enma.duration);
  return false;
 };
 const cast=type==='skill'||type==='auto'&&h.energy>=100;
 if(cast){
  // Caller checks rage before mutating any battle state.
  h.energy-=100;
  const useUltimate=()=>{const target=lowest();if(!target)return false;effect(h,'hiryu-jigoku','Ippyakusanjo Hiryu Jigoku','attack',ultimate.attack,b.turn+ultimate.duration-1);emit({type:'skill',actor:'hero',target:target.id,skillId:'hiryu-jigoku',animation:'skill',name:'Ippyakusanjo Hiryu Jigoku'});return strike(target,true)};
  const killed=useUltimate(),follow=tier('decisive-strike');
  if(lowest()&&random()<(killed?follow.killChance:follow.chance)){emit({type:'trigger',actor:'hero',skillId:'decisive-strike',name:'Đòn Quyết Định'});useUltimate()}
 }else if(type==='defend'){h.energy=Math.min(100,h.energy+20);emit({type:'defend',actor:'hero',name:'Phòng thủ',energy:h.energy})}
 else{const target=lowest();emit({type:'attack',actor:'hero',target:target.id,animation:'beat'});strike(target,false);h.energy=Math.min(100,h.energy+35)}
 for(const enemy of b.enemies.filter(e=>e.hp>0)){
  emit({type:'attack',actor:enemy.id,target:'hero',animation:'beat'});
  const immune=b.turn<=haki.duration&&attack(enemy)<attack(h)&&random()<haki.immunity;
  const critical=!immune&&random()<(enemy.critChance??.2);
  const amount=immune?0:Math.max(1,Math.round(Math.max(1,attack(enemy)*(critical?1.5:1)-h.defense*.6)*(enemy.directDamage?1-enma.reduction:1)*(type==='defend'?.45:1)*(.94+random()*.12)));
  h.hp=Math.max(0,h.hp-amount);emit({type:'damage',actor:enemy.id,target:'hero',amount,hp:h.hp,immune,critical,skillId:immune?'conqueror-haki':undefined});
  h.energy=Math.min(100,h.energy+12);if(!h.hp){emit({type:'death',target:'hero'});break}
 }
}
