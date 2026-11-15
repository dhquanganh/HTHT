import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView,isRewardId,freedomUnits} from '../server/game.mjs';
import {freedomConfig,applyFreedomConfig,validateFreedomConfig,defaultFreedomConfig,cards,applyCards,heroPool,stageCount,weekKey} from '../server/freedom.mjs';

const now=Date.UTC(2026,10,15,5),DAY=86400000;
const player=(level=60)=>{const p=starterPlayer('Freedom');p.account.level=level;p.wallet.diamonds=1e6;p.inventory['consumable:4']=50;return p};
const view=(p,t=now)=>playerView(p,t).freedom;
/** Đánh tự động tới hết trận (dùng chung lượt chiến đấu của game). */
function fight(p,t=now){while(p.battle?.status==='active')applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},t);return p.battle}

test('cấu hình mặc định hợp lệ, 7 ải, thẻ có tên / icon / mô tả tiếng Việt',()=>{
 const c=defaultFreedomConfig();assert.equal(c.stages.length,stageCount);assert.deepEqual(validateFreedomConfig(c,isRewardId),c);
 assert.throws(()=>validateFreedomConfig({...c,stages:[]},isRewardId),/từ 1 đến/);
 const ten=[...c.stages,...c.stages.slice(0,3)];assert.equal(validateFreedomConfig({...c,stages:ten},isRewardId).stages.length,10);
 assert.throws(()=>validateFreedomConfig({...c,helpWeights:[0,0,0]},isRewardId),/lớn hơn 0/);
 assert.ok(cards.length>=30);for(const k of cards){assert.ok(k.name&&k.icon&&/[a-zà-ỹ]/i.test(k.description),k.id)}
 assert.ok(heroPool().length>=20);assert.equal(weekKey(Date.UTC(2026,10,15,17)),weekKey(Date.UTC(2026,10,22,16,59)));
});

test('thẻ: cộng chỉ số toàn đội / theo hàng, giảm chỉ số đối thủ',()=>{
 const a=freedomUnits(heroPool().slice(0,6),160),b=freedomUnits(heroPool().slice(6,12),160);
 const atk=a.map(u=>u.attack),def=b.map(u=>u.defense),front=a.find(u=>u.frontRow),back=a.find(u=>!u.frontRow),hpF=front.maxHp,hpB=back.maxHp;
 applyCards(a,[117,28,78],b);// +20% công, -10% thủ địch, hàng trước +15% máu
 a.forEach((u,i)=>assert.equal(u.attack,Math.round(atk[i]*1.2)));b.forEach((u,i)=>assert.equal(u.defense,Math.round(def[i]*.9)));
 assert.equal(front.maxHp,Math.round(hpF*1.15));assert.equal(back.maxHp,hpB);assert.ok(front.block>=.2);
});

test('một lượt chơi: vé → đội ngẫu nhiên → đổi đội → xác nhận → trợ giúp → đánh 7 ải hoặc thua → nhận thưởng',()=>{
 const p=player(),c=freedomConfig();
 assert.throws(()=>applyAction(player(10),'freedom-join',{},now),/cấp độ/);
 applyAction(p,'freedom-join',{},now);let v=view(p);
 assert.equal(p.inventory['consumable:4'],49);assert.equal(v.runs,1);assert.equal(v.run.status,'team');assert.equal(new Set(v.run.team).size,6);
 assert.throws(()=>applyAction(p,'freedom-join',{},now),/đang trong/);
 const d=p.wallet.diamonds;applyAction(p,'freedom-reset',{},now);assert.equal(p.wallet.diamonds,d-c.resetCosts[0]);assert.equal(view(p).run.resetCost,c.resetCosts[1]);
 applyAction(p,'freedom-team',{},now);v=view(p);assert.equal(v.run.status,'help');assert.equal(v.run.options.length,2);
 assert.throws(()=>applyAction(p,'freedom-reset',{},now),/trước khi xác nhận/);
 assert.throws(()=>applyAction(p,'freedom-attack',{formation:v.run.team},now),/Chưa tới lúc tấn công/);
 let stages=0;
 while(view(p).run.status!=='done'){
  v=view(p);const o=v.run.options[0];applyAction(p,'freedom-help',{option:0},now);v=view(p);
  for(const h of o.heroes)assert.ok(v.run.pool.includes(h));for(const k of o.cards)assert.ok(v.run.cards.some(x=>x.id===k.id));
  assert.equal(v.run.status,'attack');assert.equal(v.run.enemy.heroes.length,6);
  assert.throws(()=>applyAction(p,'freedom-attack',{formation:v.run.pool.slice(0,5)},now),/đủ 6 tướng/);
  assert.throws(()=>applyAction(p,'freedom-attack',{formation:[...v.run.pool.slice(0,5),'luffy-gear-2']},now),/không thuộc/);
  applyAction(p,'freedom-attack',{formation:v.run.pool.slice(0,6)},now);assert.ok(p.battle.freedom);
  assert.ok(p.battle.allies.every(u=>v.run.pool.includes(u.heroId)));assert.equal(p.battle.allies[0].level,c.heroLevel);
  const b=fight(p);stages++;assert.ok(['won','lost'].includes(b.status));assert.equal(b.freedomResult.wins,view(p).run.wins);
  if(b.status==='lost')break;
 }
 v=view(p);assert.equal(v.run.status,'done');assert.equal(v.run.wins,stages-(v.run.lost?1:0));
 const gold=p.wallet.gold,claim=applyAction(p,'freedom-claim',{},now);
 const expect=c.stages.slice(0,v.run.wins).flatMap(s=>s.rewards).filter(r=>r.itemId==='gold').reduce((n,r)=>n+r.quantity,0);
 assert.equal(p.wallet.gold-gold,expect);assert.equal(view(p).run,null);assert.equal(view(p).best,v.run.wins);assert.ok(Array.isArray(claim.rewards));
});

test('giới hạn lượt mỗi tuần, trả bằng kim cương, bỏ cuộc',()=>{
 const p=player();applyFreedomConfig({...defaultFreedomConfig(),weeklyRuns:2});
 try{
  applyAction(p,'freedom-join',{pay:'diamonds'},now);assert.equal(p.wallet.diamonds,1e6-freedomConfig().diamondFee);
  applyAction(p,'freedom-quit',{},now);assert.equal(view(p).run.status,'done');applyAction(p,'freedom-claim',{},now);
  applyAction(p,'freedom-join',{},now);applyAction(p,'freedom-quit',{},now);applyAction(p,'freedom-claim',{},now);
  assert.throws(()=>applyAction(p,'freedom-join',{},now),/hết lượt/);
  applyAction(p,'freedom-join',{},now+7*DAY);assert.equal(view(p,now+7*DAY).runs,1);
 }finally{applyFreedomConfig(null)}
});

test('số ải do quản trị đặt: 10 ải → xong cả 10 mới kết thúc, lượt đang chơi giữ số ải lúc tham gia',()=>{
 const c=defaultFreedomConfig(),ten=[...c.stages,...c.stages.slice(0,3)].map(s=>({...s,level:1,boost:.1,cards:0}));
 applyFreedomConfig({...c,stages:ten});
 try{
  const p=player();applyAction(p,'freedom-join',{},now);applyAction(p,'freedom-team',{},now);assert.equal(view(p).run.total,10);
  for(let k=0;k<10;k++){applyAction(p,'freedom-help',{option:0},now);applyAction(p,'freedom-attack',{formation:view(p).run.pool.slice(0,6),skip:true},now);assert.equal(p.battle.status,'won',`ải ${k+1}`);assert.equal(p.battle.freedom.total,10)}
  assert.equal(view(p).run.status,'done');assert.equal(view(p).run.wins,10);
  const p2=player();applyAction(p2,'freedom-join',{},now);applyFreedomConfig(c);assert.equal(view(p2).run.total,10);
 }finally{applyFreedomConfig(null)}
});
