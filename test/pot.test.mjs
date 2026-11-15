import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView,isRewardId} from '../server/game.mjs';
import {grantSummon} from '../server/summon.mjs';
import {heroDefinitions,heroKits} from '../server/catalog.mjs';
import {maps,passable,turretLine,potConfig,applyPotConfig,defaultPotConfig,validatePotConfig,potState} from '../server/pot.mjs';

const now=Date.UTC(2026,10,15,5),k=(x,y)=>x+','+y;
function player(){
 const p=starterPlayer('Pot');p.account.level=80;p.reserveHeroes??={};
 for(const d of heroDefinitions.filter(d=>heroKits.has(d.id)&&d.id!=='luffy-gear-2').slice(0,6)){grantSummon(p,{avatar:d.avatar});const h=p.reserveHeroes[d.id];if(h){h.level=300;h.stars=12}}
 return p;
}
const team=p=>[p.hero.id,...Object.keys(p.reserveHeroes)].slice(0,6);
const run=p=>potState(p).run;
/** Đường đi ngắn nhất (BFS 4 hướng) tới ô đích hoặc ô kề vật thể. */
function path(p,goal,adjacent=false){
 const r=run(p),start=r.pos,prev=new Map([[k(start.x,start.y),null]]),q=[start];
 const done=c=>adjacent?Math.abs(c.x-goal.x)+Math.abs(c.y-goal.y)===1:c.x===goal.x&&c.y===goal.y;
 while(q.length){const c=q.shift();if(done(c)){const out=[];let cur=k(c.x,c.y);while(prev.get(cur)){out.unshift(cur.split(',').map(Number));cur=prev.get(cur)}return out}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:c.x+dx,y:c.y+dy},key=k(n.x,n.y);if(prev.has(key)||!passable(r,n.x,n.y))continue;prev.set(key,k(c.x,c.y));q.push(n)}}
 return null;
}
const obj=(p,id)=>run(p).objects.find(o=>o.id===id);
const go=(p,id,extra={})=>{const o=obj(p,id),at=o.type==='rail'?o.station:o.location,route=path(p,at,true);assert.ok(route,`không có đường tới ${o.type} ${id}`);return applyAction(p,'pot-move',{route,target:id,...extra},now)};
function fight(p){while(p.battle?.status==='active')applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},now);return p.battle}

test('bản đồ gốc: ô đi được từ Tilemap, vật thể đặt trên ô đi được, cấu hình hợp lệ',()=>{
 assert.equal(maps[1].walk.size,159);assert.equal(maps[2].walk.size,632);
 assert.ok(maps[1].objects.some(o=>o.type==='boss')&&maps[2].objects.some(o=>o.type==='boss'));
 const c=defaultPotConfig();assert.deepEqual(validatePotConfig(c,isRewardId),c);
 assert.throws(()=>validatePotConfig({...c,stages:[{...c.stages[0],map:9}]},isRewardId),/bản đồ không tồn tại/);
});

test('vào ải, đi theo lộ trình, sương mù, lộ trình sai bị chặn, cửa mở bằng công tắc',()=>{
 const p=player();assert.throws(()=>applyAction(p,'pot-enter',{stage:2},now),/chưa mở/);
 applyAction(p,'pot-enter',{stage:1,formation:team(p)},now);const v=playerView(p,now).pot.run;
 assert.deepEqual(v.pos,maps[1].spawn);assert.equal(v.revealed.length,25);
 assert.throws(()=>applyAction(p,'pot-move',{route:[[5,5]]},now),/liền mạch/);
 // Cửa (-1,0) đang đóng: phòng boss chưa vào được.
 assert.equal(path(p,obj(p,103).location,true),null);
 go(p,3);assert.equal(obj(p,4).isOpen,true);assert.ok(path(p,obj(p,103).location,true),'mở cửa → có đường tới boss');
 assert.ok(run(p).revealed.length>25);
});

test('công tắc khối đá, cổng dịch chuyển, rương chỉ nhận thưởng một lần',()=>{
 const p=player();applyAction(p,'pot-enter',{stage:1,formation:team(p)},now);
 assert.equal(path(p,obj(p,102).location,true),null,'rương sau khối đá');
 go(p,5);assert.deepEqual(obj(p,6).at,{x:8,y:-2});
 const gold=p.wallet.gold,r=go(p,102);assert.ok(r.rewards.length);assert.ok(p.wallet.gold>gold);
 assert.throws(()=>go(p,102),/đã mở/);
 // Vào lại (làm mới bản đồ): rương đóng lại nhưng không có thưởng nữa.
 applyAction(p,'pot-enter',{stage:1,reset:true},now);go(p,5);assert.equal(go(p,102).rewards.length,0);
 // Cổng: bước lên cổng 1 → sang cổng 2.
 const r2=applyAction(p,'pot-move',{route:path(p,obj(p,1).location)},now);assert.ok(r2.events.some(e=>e.type==='teleport'));assert.deepEqual(run(p).pos,obj(p,2).location);
});

test('đánh quái: thắng → chọn di vật; máu giữ lại; hạ boss → qua ải, mở ải sau, thưởng lần đầu',()=>{
 const p=player();applyAction(p,'pot-enter',{stage:1,formation:team(p)},now);
 applyPotConfig({...defaultPotConfig(),stages:defaultPotConfig().stages.map(s=>({...s,level:1,boost:.1}))});
 try{
  go(p,101);assert.ok(p.battle?.pot);assert.equal(p.battle.pot.objectId,101);let b=fight(p);assert.equal(b.status,'won');
  let v=playerView(p,now).pot.run;assert.equal(v.pending.length,3);assert.ok(Object.values(v.hp).every(x=>x>0&&x<=1));
  assert.throws(()=>go(p,3),/chọn di vật/);applyAction(p,'pot-relic',{index:1},now);assert.equal(playerView(p,now).pot.run.relics.length,1);
  go(p,3);const diamonds=p.wallet.diamonds;go(p,103);b=fight(p);assert.equal(b.status,'won');assert.ok(b.potResult.boss);
  const s=playerView(p,now).pot;assert.equal(s.run.done,true);assert.deepEqual(s.cleared,[1]);assert.equal(s.unlocked,2);assert.ok(p.wallet.diamonds>diamonds);
  assert.throws(()=>applyAction(p,'pot-move',{route:[]},now),/hoàn thành/);
  applyAction(p,'pot-enter',{stage:1,reset:true},now);go(p,3);go(p,101);fight(p);applyAction(p,'pot-relic',{index:0},now);go(p,103);const d2=p.wallet.diamonds;fight(p);assert.equal(p.wallet.diamonds,d2,'thưởng qua ải chỉ lần đầu');
 }finally{applyPotConfig(null)}
});

test('bản đồ 2: pháo bắn khi vào đường bắn, nhà ga tắt pháo, cơm / bình / trạm hỗ trợ, nền sập',()=>{
 const p=player();potState(p).unlocked=2;applyAction(p,'pot-enter',{stage:2,formation:team(p)},now);
 const t=obj(p,1),line=turretLine(run(p),t);assert.ok(line.length>3);
 // Bước vào đường bắn → toàn đội mất % máu.
 const [x,y]=line[0].split(',').map(Number);const r=applyAction(p,'pot-move',{route:path(p,{x,y})},now);
 assert.ok(r.events.some(e=>e.type==='turret'));assert.ok(Object.values(run(p).hp).every(h=>Math.abs(h-(1-potConfig().turretDamage/100))<1e-6));
 // Gạt cần ở nhà ga: pháo 1 tắt, pháo 2 bật.
 go(p,3);assert.equal(obj(p,1).isActive,false);assert.equal(obj(p,2).isActive,true);
 go(p,18);assert.ok(Object.values(run(p).hp).every(h=>h===1));assert.throws(()=>go(p,18),/Đã dùng/);
 for(const id of team(p))run(p).hp[id]=0;run(p).hp[team(p)[0]]=1;go(p,16);assert.ok(team(p).every(id=>run(p).hp[id]>0));
 go(p,17);assert.equal(run(p).pending.length,3);applyAction(p,'pot-relic',{index:2},now);
 // Nền sập: đi qua rồi rời đi → thành hố, không đi lại được.
 const c=obj(p,7);applyAction(p,'pot-move',{route:path(p,c.location)},now);const away=path(p,{x:c.location.x+1,y:c.location.y})||path(p,{x:c.location.x-1,y:c.location.y})||path(p,{x:c.location.x,y:c.location.y+1});
 applyAction(p,'pot-move',{route:away},now);assert.equal(obj(p,7).isActive,false);assert.equal(passable(run(p),c.location.x,c.location.y),false);
});
