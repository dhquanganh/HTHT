import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {starterPlayer,applyAction,heroStats,playerView} from '../server/game.mjs';
import {hakiTiers,hakiUnit,hakiUnlockStars} from '../server/haki.mjs';
import {starSkillLevel} from '../server/hero-roster.mjs';
import {initializeTeamBattle,teamRound} from '../server/team-combat.mjs';

const data=JSON.parse(readFileSync(new URL('../dist/haki.json',import.meta.url),'utf8'));
const assets=JSON.parse(readFileSync(new URL('../dist/assets.json',import.meta.url),'utf8'));

test('Haki board uses the original 5 tiers x 3 options with existing icons and prefabs',()=>{
 assert.equal(data.tiers.length,5);assert.deepEqual(data.tiers.map(t=>t.options.length),[3,3,3,3,3]);
 assert.deepEqual(hakiTiers.flatMap(t=>t.options).sort((a,b)=>a-b),[...Array(15)].map((_,i)=>i+1));
 for(const t of data.tiers)for(const o of t.options)assert.ok(assets[o.icon],o.icon);
 assert.equal(data.tiers[3].options[1].plain,'Vũ Trang');assert.match(data.tiers[3].options[1].plainDesc,/20% máu, 10% giảm sát thương/);
 for(const name of ['PanelESkill','PopupHeroESkill'])assert.ok(data.prefabs[name]?.children?.length,name);
});

test('skills level up automatically with awakening tiers',()=>{
 assert.deepEqual([1,2,3,4,5,6,9,10,19].map(starSkillLevel),[1,1,2,2,3,4,4,4,4]);
 const p=starterPlayer('Captain');assert.equal(playerView(p).hero.skills['rubber-whip'],1);
 p.hero.stars=3;assert.equal(playerView(p).hero.skills['rubber-whip'],2);
 p.hero.stars=5;assert.equal(playerView(p).hero.skills['rubber-whip'],3);
 // Sao tím: mọi tướng max cấp 4, mô tả là bản [4] gốc.
 p.hero.stars=6;assert.deepEqual(Object.values(playerView(p).hero.skills),[4,4,4,4]);
 const zoro=playerView(p).heroes.find(h=>h.id==='zoro-king-of-hell');assert.deepEqual(Object.values(zoro.skills),[1,1,1,1]);
 // Cấp đã lưu từ bản nâng bằng sách không còn tác dụng.
 p.hero.stars=1;p.hero.skills['rubber-whip']=3;assert.equal(playerView(p).hero.skills['rubber-whip'],1);
 assert.equal(playerView(p).costs.skills,undefined);
});

test('Haki tiers unlock at L1-L5, one pick per tier, switching is free',()=>{
 const p=starterPlayer('Captain');
 assert.throws(()=>applyAction(p,'haki-pick',{hakiId:2}),/L1/);
 p.hero.stars=hakiUnlockStars(1);const before=heroStats(p),gold=p.wallet.gold;
 applyAction(p,'haki-pick',{hakiId:2});assert.equal(p.hero.haki[0],2);assert.equal(p.wallet.gold,gold);
 assert.equal(heroStats(p).attack,Math.round(before.attack*1.1));
 assert.throws(()=>applyAction(p,'haki-pick',{hakiId:2}),/đang được kích hoạt/);
 applyAction(p,'haki-pick',{hakiId:1});assert.equal(p.hero.haki[0],1);assert.equal(heroStats(p).maxHp,Math.round(before.maxHp*1.12));
 assert.throws(()=>applyAction(p,'haki-pick',{hakiId:4}),/L2/);
 assert.throws(()=>applyAction(p,'haki-pick',{hakiId:99}));
 const view=playerView(p).hero.haki;assert.deepEqual(view.unlocked,[true,false,false,false,false]);assert.deepEqual(view.selected,[1,null,null,null,null]);
 // Picks above the current awakening stay stored but do nothing.
 p.hero.stars=19;applyAction(p,'haki-pick',{hakiId:14});p.hero.stars=15;assert.equal(hakiUnit(p.hero).damageReduction,undefined);
 p.hero.stars=18;assert.ok(Math.abs(hakiUnit(p.hero,{damageReduction:.05}).damageReduction-.15)<1e-9);
});

function unit(id,side,position,o={}){return{id,side,position,frontRow:side==='ally'?position<2:position>=4,name:id,heroId:'npc',maxHp:10000,hp:10000,attack:100,defense:0,speed:200-position,energy:0,critChance:0,...o}}
const battle=(allies,enemies,seed=7)=>({allies,enemies,turn:1,seed,events:[],status:'active'});

test('Haki combat effects: low-HP shield, end-of-round heal and attack, non-crit bonus',()=>{
 const tank=unit('a','ally',0,{hp:5100,hakiLowShield:3,hakiRoundHeal:.15,speed:1});
 const foe=unit('e','enemy',4,{attack:500,speed:300});
 const b=battle([tank],[foe]);initializeTeamBattle(b);const events=teamRound(b);
 assert.ok(events.some(e=>e.type==='trigger'&&e.name==='Haki Vũ Trang'));
 assert.ok(events.some(e=>e.type==='heal'&&e.skillId==='haki'&&e.target==='a'));
 const hitter=unit('h','ally',0,{hakiNoCrit:1,hakiRoundAttack:.03}),dummy=unit('d','enemy',4,{speed:1});
 const plain=unit('p','ally',0),dummy2=unit('d','enemy',4,{speed:1});
 const b1=battle([hitter],[dummy]),b2=battle([plain],[dummy2]);
 const dmg=b=>teamRound(b).filter(e=>e.type==='damage'&&e.actor!=='d').reduce((n,e)=>n+e.amount,0);
 const strong=dmg(b1),weak=dmg(b2);assert.ok(strong>weak*1.8,`${strong} vs ${weak}`);
 assert.ok(hitter.effects.some(e=>e.skillId==='haki-attack'&&Math.abs(e.value-.06)<1e-9));
});
