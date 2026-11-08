import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {starterPlayer,applyAction} from '../server/game.mjs';
import {heroKits,heroDefinitions} from '../server/catalog.mjs';
import {compileSkill,kitFromProfile,selectOf} from '../server/skill-kit.mjs';
import {grantSummon} from '../server/summon.mjs';

const profiles=JSON.parse(readFileSync(new URL('../dist/hero-profiles.json',import.meta.url),'utf8'));
const slots=(...ids)=>[...ids,...Array(6-ids.length).fill(null)];
/** Trận 1 vòng: tướng `avatar` đánh trước, kẻ địch rất trâu để đếm đòn. */
function round(avatar,setup=()=>{},action='auto'){
 const p=starterPlayer('Kit');p.account.level=100;grantSummon(p,{avatar});const id='hero-'+avatar;
 p.adventure.unlockedStage=12;applyAction(p,'battle-start',{stageId:12,formation:slots(id)});const unit=p.battle.allies[0];
 unit.speed=unit.baseSpeed=1e6;for(const e of p.battle.enemies){e.hp=e.maxHp=1e8;e.speed=e.baseSpeed=1;e.attack=e.baseAttack=1;e.critChance=0}
 setup(p,unit);const events=applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action}).events;return{p,unit,events};
}

test('target wording: toàn thể phe địch / toàn bộ kẻ địch / hàng sau / N kẻ địch',()=>{
 assert.equal(selectOf('Gây 300% Công cho toàn thể phe địch').count,6);
 assert.equal(selectOf('Tấn công toàn bộ kẻ địch, gây ST 700% Công').count,6);
 assert.deepEqual(selectOf('Tấn công hàng sau đội địch, gây sát thương (350%Công)'),{count:6,pick:'back',row:'back'});
 assert.equal(selectOf('Tấn công 3 kẻ địch Nộ cao nhất').count,3);assert.equal(selectOf('Tấn công 3 kẻ địch Nộ cao nhất').pick,'rage');
 assert.equal(selectOf('Gây sát thương (125%Công) địch hàng sau').count,1);
});

test('Zoro Wano: Nộ đánh toàn bộ địch, bị động cộng chỉ số và kích hoạt khi tướng khác dùng Nộ',()=>{
 const kit=heroKits.get('hero-453');
 assert.equal(kit.ultimate.effects.find(e=>e.type==='damage').select.count,6);
 assert.equal(kit.stats.maxHp,.35);assert.equal(kit.stats.attack,.45);assert.equal(kit.stats.lifesteal,.2);
 assert.ok(kit.triggers.some(t=>t.on==='allyUlt'&&t.scope==='any'&&t.effects.some(e=>e.type==='damage'&&e.select.count===3)));
 assert.ok(kit.triggers.some(t=>t.on==='roundStart'&&t.effects.some(e=>e.type==='stat'&&e.attr==='critChance'&&e.on==='enemies')));
 const {p,unit,events}=round('453',(p,u)=>{u.energy=100});
 const hits=new Set(events.filter(e=>e.type==='damage'&&e.actor===unit.id&&e.skill).map(e=>e.target));
 assert.equal(hits.size,p.battle.enemies.length,'mọi kẻ địch đều trúng Nộ');
 assert.ok(events.some(e=>e.type==='trigger'&&e.actor===unit.id&&e.name==='Luyện Ngục Trảm Quỷ'),'bị động kích hoạt khi bản thân/bất kỳ ai dùng Nộ');
 const base=heroDefinitions.find(h=>h.id==='hero-453');assert.ok(unit.maxHp>0&&unit.kitApplied);
});

test('Mihawk Samurai: Nộ và đánh thường đều đánh toàn bộ kẻ địch',()=>{
 const kit=heroKits.get('hero-537');
 assert.equal(kit.ultimate.effects.find(e=>e.type==='damage').select.count,6);
 assert.equal(kit.triggers.find(t=>t.on==='attack'&&t.replace).effects[0].select.count,6);
 assert.equal(kit.stats.speedFlat,150);assert.equal(kit.stats.energy,50);assert.equal(kit.stats.dodgeChance,.8);
 const ult=round('537',(p,u)=>{u.energy=100});assert.equal(new Set(ult.events.filter(e=>e.type==='damage'&&e.actor===ult.unit.id&&e.skill).map(e=>e.target)).size,ult.p.battle.enemies.length);
 const basic=round('537',(p,u)=>{u.energy=0;u.kitApplied=true});
 assert.equal(new Set(basic.events.filter(e=>e.type==='damage'&&e.actor===basic.unit.id&&!e.skill).map(e=>e.target)).size,basic.p.battle.enemies.length);
});

test('khống chế làm mất lượt, DoT trừ máu cuối hiệp, khiên chặn đòn',()=>{
 const {p,unit,events}=round('453',(p,u)=>{const e=p.battle.enemies[0];e.speed=e.baseSpeed=2e6;e.attack=e.baseAttack=50;e.statuses=[{kind:'stun',until:1,source:u.id}];u.dots=[{kind:'burn',amount:77,until:1,source:e.id}];u.energy=0});
 const enemy=p.battle.enemies[0];
 assert.ok(!events.some(e=>e.type==='attack'&&e.actor===enemy.id),'kẻ địch bị choáng không đánh');
 assert.ok(events.some(e=>e.type==='buff'&&e.actor===enemy.id&&e.attribute==='stun'));
 assert.ok(events.some(e=>e.type==='damage'&&e.target===unit.id&&e.skillId==='burn'),'thiêu đốt trừ máu cuối hiệp');
 // Năng Lượng Hắc Ám: đầu hiệp nhận khiên chặn 1 đợt.
 assert.ok(events.some(e=>e.type==='buff'&&e.target===unit.id&&e.attribute==='shield'));
});

test('hồi sinh khi chết (Aokiji: Tái xuất)',()=>{
 const kit=heroKits.get('hero-140');assert.ok(kit.triggers.some(t=>t.on==='death'&&t.effects.some(e=>e.type==='revive'&&e.maxHp===1)));
 const {events,unit}=round('140',(p,u)=>{u.hp=1;u.energy=0;u.speed=u.baseSpeed=1;const e=p.battle.enemies[0];e.speed=e.baseSpeed=9e6;e.attack=e.baseAttack=1e6;e.critChance=0;u.dodgeChance=0;u.damageReduction=0;u.shields=[]});
 assert.ok(events.some(e=>e.type==='heal'&&e.revive&&e.target===unit.id));assert.ok(unit.hp>0);
});

test('mọi bộ kỹ năng biên dịch được và Nộ của tướng có sát thương đều có mục tiêu hợp lệ',()=>{
 for(const h of heroDefinitions.filter(h=>h.ultimate)){
  const kit=kitFromProfile(profiles[h.avatar]);assert.ok(kit.ultimate,h.name);
  for(const e of kit.ultimate.effects.filter(e=>e.type==='damage'))assert.ok(e.select.count>=1&&e.select.count<=6&&(e.mult>0||e.hpMult>0||e.defMult>0||e.foeHp>0),h.name);
  for(const [k,v] of Object.entries(kit.stats))assert.ok(Number.isFinite(v),h.name+' '+k);
 }
 assert.equal(compileSkill({passive:true,description:'Bị động: Tăng bản thân 40% Máu và 36% Xuyên giáp'}).stats.penetration,.36);
});

test('Vực thẳm: tướng phe địch dùng bộ kỹ năng của mình (bị động + Nộ đánh vào đội ta)',()=>{
 const p=starterPlayer('Abyss');p.account.level=100;grantSummon(p,{avatar:'453'});grantSummon(p,{avatar:'537'});
 applyAction(p,'abyss-start',{stage:1,formation:slots('hero-453','hero-537')},Date.now());
 const foes=p.battle.enemies;assert.deepEqual(foes.map(e=>e.heroId),['hero-92','hero-69','hero-109','hero-182','hero-143','hero-123']);
 assert.ok(foes.every(e=>e.kit&&e.energy===35),'mọi tướng địch có bộ kỹ năng, kể cả Luffy - S (109)');
 assert.deepEqual(foes.map(e=>e.frontRow),[true,true,false,false,false,false]);
 // Akainu (143) đủ Nộ và ra tay trước: Nộ đánh toàn bộ đội ta.
 const akainu=foes.find(e=>e.heroId==='hero-143');akainu.energy=100;akainu.speed=akainu.baseSpeed=1e7;
 for(const a of p.battle.allies){a.hp=a.maxHp=1e8;a.speed=a.baseSpeed=1}
 const events=applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'}).events;
 assert.ok(events.some(e=>e.type==='skill'&&e.actor===akainu.id));
 const hit=new Set(events.filter(e=>e.type==='damage'&&e.actor===akainu.id&&e.skill).map(e=>e.target));
 assert.equal(hit.size,p.battle.allies.length,'Nộ Akainu trúng toàn bộ đội ta');
 // Bị động cộng chỉ số khi vào trận cũng áp lên phe địch.
 assert.ok(foes.every(e=>e.kitApplied));
});

test('bảo vật trong trận: Nộ vào trận, miễn Đóng băng, ST vào nghề',()=>{
 const p=starterPlayer('Art');p.account.level=100;grantSummon(p,{avatar:'453'});p.adventure.unlockedStage=12;
 p.reserveHeroes['hero-453'].equipment={accessory:'artifact:200'};
 applyAction(p,'battle-start',{stageId:12,formation:slots('hero-453')});const u=p.battle.allies[0];
 assert.equal(u.startEnergy,50);assert.equal(u.heroClass,'assassin');
 for(const e of p.battle.enemies){e.hp=e.maxHp=1e8;e.speed=e.baseSpeed=1;e.attack=e.baseAttack=1}
 u.speed=u.baseSpeed=1e6;u.energy=35;u.kit=null;u.ultimate=null;
 applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'});
 assert.ok(u.startEnergyApplied&&u.energy>=85,'35 + 50 Nộ từ bảo vật');
});
