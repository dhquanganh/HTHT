import {skills} from './catalog.mjs';

export function skillLevels(saved={}){
 return Object.fromEntries(skills.map(skill=>{const value=saved[skill.id]??saved[skill.legacySkillId]??1;return[skill.id,Number.isSafeInteger(value)&&value>0?value:1]}));
}
export function skillTier(saved,id){
 const skill=skills.find(s=>s.id===id);const level=skillLevels(saved)[id]||1;
 return skill.levels[Math.min(skill.levels.length,level)-1];
}
export function ensureLuffySkills(player){
 // Keep legacy keys in storage to preserve historical upgrade levels; expose the four current skills.
 player.hero.skills={...player.hero.skills,...skillLevels(player.hero.skills)};
 if(player.battle?.hero&&!player.battle.allies)player.battle.hero.skills={...player.battle.hero.skills,...skillLevels(player.battle.hero.skills)};
}
export function battleSkillState(battle){
 const h=battle.hero;h.baseAttack??=h.attack;h.baseDefense??=h.defense;h.effects??=[];h.desperationUsed??=false;
 h.cooldowns??={};if(h.cooldowns['rubber-whip']===undefined&&h.cooldowns['jet-gatling']!==undefined)h.cooldowns['rubber-whip']=h.cooldowns['jet-gatling'];
 for(const enemy of battle.enemies){enemy.baseAttack??=enemy.attack;enemy.baseDefense??=enemy.defense;enemy.critChance??=.2;enemy.effects??=[]}
}
export function effectiveStat(unit,attribute,turn){
 const active=(unit.effects||[]).filter(effect=>effect.attribute===attribute&&effect.expiresTurn>=turn);
 if(attribute==='critChance')return Math.max(0,Math.min(1,(unit.critChance||0)-active.reduce((sum,e)=>sum+e.value,0)));
 const base=attribute==='attack'?(unit.baseAttack??unit.attack):(unit.baseDefense??unit.defense);
 return Math.round(base*(1+active.reduce((sum,e)=>sum+e.value,0)));
}
