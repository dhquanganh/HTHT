import {test,describe,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {starterPlayer,applyAction,playerView,arenaSnapshot} from '../server/game.mjs';
import {arenaData,seasonWindow,dayKey,eloDelta,rewardFor,pointsPerHour,allstarSeasonReward,knockoutReward,allstarPhase,simulate,series,asEnemies,ticketItem,freeTickets} from '../server/arena.mjs';
import {Store} from '../server/store.mjs';
import {newHero} from '../server/hero-roster.mjs';
import {heroDefinitions} from '../server/catalog.mjs';
try{process.loadEnvFile('.env')}catch{}

test('original reward tables: db_arena_reward daily / season / Liên đấu, db_allstars_*',()=>{
 assert.equal(arenaData.dailyHourUtc,21);
 assert.deepEqual(rewardFor(arenaData.solo.daily,1),[{itemId:'diamonds',quantity:120},{itemId:'consumable:3',quantity:600},{itemId:'consumable:19',quantity:80}]);
 assert.deepEqual(rewardFor(arenaData.solo.daily,51).map(r=>r.quantity),[30,200,32]);
 assert.deepEqual(rewardFor(arenaData.solo.season,51).map(r=>r.quantity),[300,1000,560]);
 assert.deepEqual(rewardFor(arenaData.solo.season,2).map(r=>r.quantity),[1140,2800,1440]);
 assert.deepEqual(rewardFor(arenaData.league.season,1).map(r=>r.quantity),[1920,2400]);
 assert.equal(pointsPerHour(1),23);assert.equal(pointsPerHour(7),17);assert.equal(pointsPerHour(5000),1);
 assert.deepEqual(allstarSeasonReward(5200).map(r=>r.itemId),['diamonds','gold','consumable:40']);
 assert.deepEqual(knockoutReward(0),[{itemId:'consumable:40',quantity:2500}]);assert.deepEqual(knockoutReward(4),[{itemId:'consumable:40',quantity:500}]);
});

test('weekly seasons end Sunday 21:00 UTC; daily reset at 21:00 UTC; Võ đấu phases',()=>{
 const w=seasonWindow(Date.UTC(2026,10,9,12));assert.equal(new Date(w.end).toISOString(),'2026-11-15T21:00:00.000Z');assert.equal(new Date(w.start).getUTCDay(),0);
 assert.equal(dayKey(Date.UTC(2026,10,9,20,59)),dayKey(Date.UTC(2026,10,8,21,0)));assert.notEqual(dayKey(Date.UTC(2026,10,9,21,0)),dayKey(Date.UTC(2026,10,9,20,59)));
 assert.equal(allstarPhase(Date.UTC(2026,10,10)).phase,'group');assert.equal(allstarPhase(Date.UTC(2026,10,14,10)).round,'r16');assert.equal(allstarPhase(Date.UTC(2026,10,15,15)).round,'final');
});

test('Elo points: beating a stronger player gives more, losing costs points',()=>{
 assert.equal(eloDelta(1000,1000,true),16);assert.equal(eloDelta(1000,1000,false),-16);
 assert.ok(eloDelta(1000,1200,true)>eloDelta(1000,800,true));assert.ok(eloDelta(1000,1200,false)>eloDelta(1000,800,false));
});

const strong=()=>{const p=starterPlayer('Arena');p.account.level=90;p.hero.level=150;p.hero.stars=8;return p};
test('defense snapshot, tickets refill to 10 at reset, buying tickets, solo battle settles as arena win/loss',()=>{
 const p=strong(),snap=arenaSnapshot(p,'solo');assert.equal(snap.teams.length,1);assert.ok(snap.teams[0].units.length>=1&&snap.power>0);assert.equal(snap.teams[0].heads[0].heroId,p.hero.id);
 assert.equal(playerView(p).arena.tickets,freeTickets);
 const weak=starterPlayer('Weak'),opp=arenaSnapshot(weak,'solo');
 const ctx={arena:{mode:'solo',season:1,opponent:{id:'solo:1:x',name:'Weak',avatar:'109',level:1,teams:opp.teams}}};
 applyAction(p,'arena-start',{mode:'solo',opponentId:'solo:1:x',skip:true},Date.now(),ctx);
 assert.equal(p.inventory[ticketItem],freeTickets-1);assert.equal(p.battle.status,'won');assert.ok(p.battle.arena);assert.equal(p.battle.reward,null);
 const gems=p.wallet.diamonds=1000;applyAction(p,'arena-buy',{kind:'ticket',count:2});assert.equal(p.inventory[ticketItem],freeTickets+1);assert.equal(p.wallet.diamonds,gems-40);
 assert.throws(()=>applyAction(starterPlayer('Low'),'arena-defense',{mode:'league',teams:[[],[],[]]}),/cấp độ 55/);
});

test('Liên đấu: 3 defense teams without duplicates, 3-bout series decided server-side',()=>{
 const p=strong();p.reserveHeroes??={};p.reserveHeroes['hero-645']={...newHero(heroDefinitions.find(d=>d.id==='hero-645')),level:150,stars:8};
 const ids=[p.hero.id,'zoro-king-of-hell','hero-645'];
 assert.throws(()=>applyAction(p,'arena-defense',{mode:'league',teams:[[ids[0]],[ids[0]],[ids[1]]]}),/một đội/);
 applyAction(p,'arena-defense',{mode:'league',teams:[[ids[0]],[ids[1]],[null,ids[2]]]});
 const snap=arenaSnapshot(p,'league');assert.equal(snap.teams.length,3);assert.deepEqual(snap.teams.map(t=>t.heads[0].heroId),ids);
 const weak=arenaSnapshot(starterPlayer('W'),'league'),ctx={arena:{mode:'league',season:1,opponent:{id:'league:1:w',name:'W',avatar:'109',level:60,teams:weak.teams}}};
 const r=applyAction(p,'arena-start',{mode:'league',opponentId:'league:1:w'},Date.now(),ctx);
 assert.equal(r.arena.win,true);assert.ok(r.arena.bouts.length>=2&&r.arena.bouts.length<=3);assert.equal(p.battle,null);assert.equal(p.inventory[ticketItem],freeTickets-1);
});

test('simulate / series run the real team engine; an empty defense team loses its bout',()=>{
 const a=arenaSnapshot(strong(),'solo').teams[0].units,b=arenaSnapshot(starterPlayer('W'),'solo').teams[0].units;
 const r=simulate(a,b,7);assert.equal(r.win,true);assert.ok(r.topDamage>0);
 const s=series([a],[b],9);assert.equal(s.win,true);assert.deepEqual(s.score,[2,0]);
 assert.equal(simulate(a,[],1).win,true);assert.equal(simulate([],b,1).win,false);
 assert.equal(asEnemies(a)[0].side,'enemy');assert.equal(asEnemies(a)[0].frontRow,a[0].position<2);
});

describe('Chiến trường on MongoDB',{skip:!process.env.MONGODB_URI},()=>{
 const database='htps_arena_'+randomUUID().replaceAll('-','').slice(0,12);let store,a,b;
 const key=()=>randomUUID();
 before(async()=>{store=new Store(process.env.MONGODB_URI,database);await store.connect();
  a=await store.createUser('arena_a','password-arena-1');b=await store.createUser('arena_b','password-arena-2');
  for(const u of [a,b])await store.users.updateOne({_id:u._id},{$set:{'player.account.level':90,'player.hero.level':120,'player.hero.stars':6}})});
 after(async()=>{assert.match(database,/^htps_arena_[a-f0-9]{12}$/);if(store){await store.db.dropDatabase();await store.close()}});
 test('bots fill the ladder, players join at 1000 points and see three rivals',async()=>{
  const scene=await store.arenaScene(a._id.toHexString(),'solo');assert.equal(scene.me.points,1000);assert.ok(scene.top.length>=50);assert.ok(scene.rewards.daily.length);
  const rivals=await store.arenaRivals(a._id.toHexString(),'solo');assert.equal(rivals.rivals.length,3);
 });
 test('a won fight moves points for both sides exactly once and writes battle records',async()=>{
  await store.arenaScene(b._id.toHexString(),'solo');const season=seasonWindow().id;
  const bId=`solo:${season}:${b._id}`;await store.arenaEntries.updateOne({_id:`solo:${season}:${a._id}`},{$set:{rivals:[bId]}});
  const k=key(),data=await store.arenaFight(a._id.toHexString(),k,'solo',{opponentId:bId,skip:true});
  assert.ok(['won','lost'].includes(data.player.battle.status));const delta=data.result.arena.delta;assert.ok(delta!==0);
  const again=await store.arenaFight(a._id.toHexString(),k,'solo',{opponentId:bId,skip:true});assert.equal(again.replayed,true);
  const ea=await store.arenaEntries.findOne({_id:`solo:${season}:${a._id}`}),eb=await store.arenaEntries.findOne({_id:bId});
  assert.equal(ea.points,1000+delta);assert.equal(eb.points,1000-delta);
  const ra=await store.arenaHistory(a._id.toHexString(),'solo'),rb=await store.arenaHistory(b._id.toHexString(),'solo');
  assert.equal(ra.records.length,1);assert.equal(rb.records.length,1);assert.equal(rb.records[0].attack,false);assert.equal(rb.records[0].delta,-delta);
  await assert.rejects(store.arenaFight(a._id.toHexString(),key(),'solo',{opponentId:bId}),/làm mới/);
 });
 test('Võ đấu: winning against a higher rank swaps ranks; knockout bracket resolves and pays bets',async()=>{
  const scene=await store.arenaScene(a._id.toHexString(),'allstars');const season=seasonWindow().id,me=`allstars:${season}:${a._id}`;
  const above=await store.arenaEntries.findOne({mode:'allstars',season,bot:true},{sort:{rank:-1}});
  await store.arenaEntries.updateOne({_id:above._id},{$set:{teams:arenaSnapshot(starterPlayer('W'),'allstars').teams}});
  const myRank=(await store.arenaEntries.findOne({_id:me})).rank;await store.arenaEntries.updateOne({_id:above._id},{$set:{rank:myRank-1}});
  await store.arenaEntries.updateOne({_id:me},{$set:{rivals:[above._id]}});
  if(allstarPhase().phase==='group'){const data=await store.arenaFight(a._id.toHexString(),key(),'allstars',{opponentId:above._id,skip:true});
   if(data.player.battle.status==='won')assert.equal((await store.arenaEntries.findOne({_id:me})).rank,myRank-1)}
  // Vô song: chạy tick ở thời điểm sau Chung kết.
  const w=seasonWindow(),end=w.start+7*86400000-60000;await store.allstarKnockout(w,w.start+5*86400000+60000);
  const bracket=await store.allstarBracket(a._id.toHexString());assert.equal(bracket.rounds[0].matches.length,8);
  const match=bracket.rounds[0].matches[0];await store.allstarBets.insertOne({season:w.id,matchId:match.id,userId:a._id,pick:'even',amount:1000});
  await store.allstarKnockout(w,end);const done=await store.allstarBracket(a._id.toHexString());
  assert.ok(done.rounds.every(r=>r.resolved));assert.equal(done.rounds[3].matches.length,1);assert.ok(done.rounds[3].matches[0].winner);
  const bet=await store.allstarBets.findOne({matchId:match.id,userId:a._id});assert.equal(bet.settled,true);assert.ok(['even','odd'].includes(bet.result));
  assert.ok(scene.phase.label);
 });
});
// Các test này sửa trực tiếp tướng của tài khoản mới nên tắt phần mở đầu (tài khoản mới có Luffy).
process.env.NEW_ACCOUNT_INTRO??='off';
