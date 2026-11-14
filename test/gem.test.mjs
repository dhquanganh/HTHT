import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,heroStats,playerView} from '../server/game.mjs';
import {heroDefinitions,definitionFor} from '../server/catalog.mjs';
import {grantSummon} from '../server/summon.mjs';
import {gemSets,gemDebuffs,gemBosses,makeGem,activeSet,debuffTriggers,summonCost,bossOpen,openText,heroMinLevel,gemConfig,applyGemConfig,validateGemConfig,defaultGemConfig} from '../server/gem.mjs';

// Thứ hai 9/11/2026 (giờ VN): Douglas Bullet mở (thứ 2, 3, CN).
const monday=Date.UTC(2026,10,9,5),wednesday=Date.UTC(2026,10,11,5);
const ss=heroDefinitions.find(d=>d.rank===6&&d.class==='warrior'&&d.avatar!=='109');
const player=()=>{const p=starterPlayer('Gem');p.account.level=120;p.wallet.gold=1e10;p.wallet.diamonds=1e6;for(const c of summonCost)p.inventory[c.itemId]=1e7;return p};
const withHero=(p,level=260)=>{grantSummon(p,{avatar:ss.avatar});const h=p.reserveHeroes[ss.id];h.level=level;return h};

test('db_set_name / db_debuff / db_config_open_boss: 31 bộ, 38 debuff, 3 boss × 6 bậc',()=>{
 assert.equal(gemSets.length,31);assert.equal(gemDebuffs.length,38);
 assert.deepEqual(gemSets.find(s=>s.id===1).points,[[100,450]]);
 assert.equal(gemBosses.length,3);for(const b of gemBosses)assert.equal(b.tiers.length,6);
 assert.deepEqual(gemBosses.map(b=>b.name),['Douglas Bullet','Wadatsumi','Pica']);
 assert.ok(bossOpen(gemBosses[0],monday)&&!bossOpen(gemBosses[0],wednesday)&&bossOpen(gemBosses[1],wednesday));
 assert.equal(openText(gemBosses[0]),'Mở vào Thứ 2, Thứ 3, Chủ nhật');
});

test('chế tạo: trừ đúng phí gốc, đá phẩm chất / thẻ nghề / thẻ bộ quyết định ngọc nhận được',()=>{
 const p=player();p.inventory['consumable:60005']=10;p.inventory['consumable:60012']=10;p.inventory['consumable:60101']=10;
 const before=summonCost.map(c=>p.inventory[c.itemId]);
 const r=applyAction(p,'gem-summon',{count:10,materials:[60005,60012,60101]},monday);
 assert.equal(r.gems.length,10);summonCost.forEach((c,i)=>assert.equal(before[i]-p.inventory[c.itemId],c.quantity*10));
 for(const g of r.gems){assert.equal(g.quality,6);assert.equal(g.clazz,'warrior');assert.equal(g.set,1);assert.equal(g.base.length,4)}
 assert.equal(p.inventory['consumable:60005'],0);
 assert.throws(()=>applyAction(p,'gem-summon',{count:1,materials:[60005,0,0]},monday),/Không đủ|đủ/);
});

test('khảm: cần cấp 250 + hạng SS, đúng nghề; đủ 6 viên cùng bộ thì kích chỉ số bộ',()=>{
 const p=player(),h=withHero(p,200),s=(p.gem={nextId:1,gems:[],boss:{}});
 const gems=Array.from({length:6},()=>makeGem(s,{set:1,clazz:'warrior',quality:3},()=>.5));const mage=makeGem(s,{set:1,clazz:'mage',quality:3});
 assert.throws(()=>applyAction(p,'gem-equip',{heroId:h.id,gemId:gems[0].id,slot:1},monday),/cấp 250/);
 h.level=heroMinLevel;
 assert.throws(()=>applyAction(p,'gem-equip',{heroId:h.id,gemId:mage.id,slot:1},monday),/nghề/);
 const bare=heroStats({...p,hero:h});
 gems.slice(0,5).forEach((g,i)=>applyAction(p,'gem-equip',{heroId:h.id,gemId:g.id,slot:i+1},monday));
 assert.equal(activeSet(p.gem,h.id),null);const five=heroStats({...p,hero:h});
 applyAction(p,'gem-equip',{heroId:h.id,gemId:gems[5].id,slot:6},monday);
 assert.equal(activeSet(p.gem,h.id).name,'Thạch Anh Cam');const six=heroStats({...p,hero:h});
 assert.ok(five.attack>=bare.attack&&six.attack>five.attack*1.3,'bộ Thạch Anh Cam: +45% Công');
 assert.deepEqual(playerView(p,monday).gem.sets,{[h.id]:1});
 assert.throws(()=>applyAction(p,'gem-sell',{gemIds:[gems[0].id]},monday),/đang trang bị/);
 applyAction(p,'gem-unequip',{heroId:h.id},monday);assert.ok(p.gem.gems.every(g=>!g.hero));
 applyAction(p,'gem-auto',{heroId:h.id},monday);assert.equal(activeSet(p.gem,h.id)?.id,1);
});

test('bán ngọc chưa khảm đổi ra Vụn đá quý; thẻ bộ 60116+ mở ra ngọc Đỏ',()=>{
 const p=player(),s=(p.gem={nextId:1,gems:[],boss:{}}),g=makeGem(s,{set:2,clazz:'mage',quality:3});const before=p.inventory['consumable:60000'];
 applyAction(p,'gem-sell',{gemIds:[g.id]},monday);assert.equal(p.inventory['consumable:60000']-before,20);assert.equal(p.gem.gems.length,0);
 p.inventory['consumable:60116']=2;const r=applyAction(p,'use',{itemId:'consumable:60116',quantity:2},monday);
 assert.equal(r.gems.length,2);assert.ok(r.gems.every(x=>x.set===16&&x.quality===6));assert.equal(p.inventory['consumable:60116']||0,0);
});

test('mọi debuff đổi ra trigger trận đấu',()=>{
 for(const d of gemDebuffs)assert.ok(debuffTriggers([d.id]).length>0,d.name);
});

test('Boss ngọc: ngày mở, lượt/ngày, vé, debuff bậc thử thách, trận chạy hết và thưởng khi thắng',()=>{
 const p=player();const h=withHero(p,400);p.formation={slots:[h.id,null,null,null,null,null]};
 assert.throws(()=>applyAction(p,'gem-boss',{bossId:1,tier:1,formation:[h.id,null,null,null,null,null]},wednesday),/Chưa mở/);
 // Bậc thử thách với toàn bộ debuff: engine phải chạy được mọi trigger.
 assert.throws(()=>applyAction(p,'gem-debuffs',{bossId:1,debuffs:gemDebuffs.map(d=>d.id)},monday),/tối đa 15/);
 const ids=gemDebuffs.slice(20,35).map(d=>d.id);applyAction(p,'gem-debuffs',{bossId:1,debuffs:ids},monday);
 for(const tier of [1,6,2]){
  const r=applyAction(p,'gem-boss',{bossId:1,tier,formation:[h.id,null,null,null,null,null],skip:true},monday);
  assert.ok(r.battleId);assert.ok(['won','lost'].includes(p.battle.status));assert.equal(p.battle.gemBoss.tier,tier);
  if(tier===6)assert.ok(p.battle.gemBoss.points>0);
 }
 assert.equal(playerView(p,monday).gem.boss[0].turns,0);
 assert.throws(()=>applyAction(p,'gem-boss',{bossId:1,tier:1,formation:[h.id,null,null,null,null,null],skip:true},monday),/Vé Đánh Boss Ngọc/);
 p.inventory['consumable:333691']=1;applyAction(p,'gem-boss',{bossId:1,tier:1,formation:[h.id,null,null,null,null,null],skip:true},monday);
 assert.equal(p.inventory['consumable:333691'],0);
 // Ngày hôm sau (thứ ba) lượt được hồi.
 assert.equal(playerView(p,monday+86400000).gem.boss[0].turns,3);
});

test('bậc thử thách: cả 38 debuff chạy trong trận thật (3 nhóm 15)',()=>{
 const p=player();const h=withHero(p,500);p.inventory['consumable:333691']=10;const ids=gemDebuffs.map(d=>d.id);
 for(const group of [ids.slice(0,15),ids.slice(15,30),ids.slice(23)]){
  applyAction(p,'gem-debuffs',{bossId:1,debuffs:group},monday);
  applyAction(p,'gem-boss',{bossId:1,tier:6,formation:[h.id,null,null,null,null,null],skip:true},monday);
  assert.ok(['won','lost'].includes(p.battle.status));const names=new Set(group.map(id=>gemDebuffs.find(d=>d.id===id).name));assert.ok(p.battle.events.some(e=>e.actor==='enemy-0'&&(e.type==='buff'||e.type==='trigger'||e.type==='damage')&&names.has(e.name)||e.type==='trigger'&&names.has(e.name)),'debuff kích hoạt');
 }
});

test('thắng boss: phần thưởng rơi theo tỉ lệ của bậc',async()=>{
 const {finishGemBoss}=await import('../server/gem.mjs');
 const p=player(),got=[],b={status:'won',gemBoss:{bossId:2,tier:6,points:25}};
 finishGemBoss(p,b,{grant:r=>got.push(r),random:()=>0,now:monday});
 assert.equal(got.length,gemConfig().bosses[1].tiers[5].rewards.length+1);assert.equal(got.at(-1).itemId,'consumable:60116');
 assert.deepEqual(p.gem.boss.killed[2],[6]);
});

test('ss hero definition dùng cho test có tồn tại',()=>{assert.ok(ss&&definitionFor(ss.id).rank===6)});

test('cấu hình quản trị: kiểm tra dữ liệu, đổi thưởng / chỉ số / ngày mở / lượt có hiệu lực ngay',async()=>{
 const {isRewardId}=await import('../server/game.mjs');
 const c=structuredClone(defaultGemConfig());
 assert.throws(()=>validateGemConfig({...c,bosses:c.bosses.slice(1)},isRewardId),/3 boss/);
 const bad=structuredClone(c);bad.bosses[0].tiers[0].rewards.push({itemId:'consumable:999999999',quantity:1,rate:10});assert.throws(()=>validateGemConfig(bad,isRewardId),/không tồn tại/);
 c.turns=1;c.bosses[0].days=[4];c.bosses[2].tiers[0]={...c.bosses[2].tiers[0],hp:1,attack:1,rewards:[{itemId:'gold',quantity:777,rate:1000}]};
 c.milestones=[{point:3,rewards:[{itemId:'diamonds',quantity:5}]}];
 applyGemConfig(validateGemConfig(c,isRewardId));
 try{
  assert.ok(!bossOpen(gemBosses[0],monday)&&bossOpen(gemBosses[0],wednesday));
  const p=player();const h=withHero(p,400);const gold=p.wallet.gold;
  const view=playerView(p,Date.UTC(2026,10,13,5)).gem;assert.equal(view.boss[2].turns,1);assert.deepEqual(view.boss[2].tiers[0].rewards,[{itemId:'gold',quantity:777,rate:1000}]);assert.equal(view.milestones[0].point,3);
  applyAction(p,'gem-boss',{bossId:3,tier:1,formation:[h.id,null,null,null,null,null],skip:true},Date.UTC(2026,10,13,5));
  assert.equal(p.battle.status,'won');assert.equal(p.wallet.gold-gold,777);
 }finally{applyGemConfig(null)}
});
