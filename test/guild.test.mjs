import {test,describe,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {starterPlayer,applyAction,heroStats,playerView} from '../server/game.mjs';
import {guildData,stageData,bossMonster,stageHp,techTiers,techCost,techBonus,guildCoin,finalReward,expToNext,memberLimit} from '../server/guild.mjs';
import {Store} from '../server/store.mjs';
try{process.loadEnvFile('.env')}catch{}

test('Đánh Boss uses the original db_guild_boss_2 / db_quai / db_heroes data',()=>{
 assert.equal(guildData.stages.length,60);assert.equal(guildData.flags.length,31);
 const s1=stageData(1);assert.deepEqual(s1.monsters.map(m=>m.monsterId),[4001,4002,4003,4004]);assert.deepEqual(s1.monsters.map(m=>m.position),[1,3,4,5]);
 assert.deepEqual([s1.guildExp,s1.gold,s1.guildCoin,s1.killGold,s1.killCoin],[36,6000,13,12000,39]);assert.deepEqual(s1.final['1'],{gold:80000,coin:350});
 const monet=s1.monsters[0];assert.equal(monet.name,'Monet');assert.equal(monet.level,50);assert.equal(monet.stars,3);
 const kizaru=stageData(60).monsters[0];assert.equal(kizaru.name,'Kizaru');assert.equal(kizaru.level,335);assert.equal(kizaru.stars,10);
 const weak=bossMonster(monet,0),strong=bossMonster(kizaru,0);assert.ok(strong.attack>weak.attack*20&&strong.maxHp>weak.maxHp*20);
 // Hệ số gốc: ArLong Công cao hơn Monet (7.3 vs 4.5), Monet Máu cao hơn (51.2 vs 27.7) cùng cấp / sao.
 const arlong=bossMonster(s1.monsters[1],1);assert.ok(arlong.attack>weak.attack&&arlong.maxHp<weak.maxHp);
 assert.deepEqual(finalReward(1,5),{gold:51000,coin:300});assert.equal(finalReward(1,31),null);
 assert.equal(expToNext(1),3000);assert.equal(memberLimit(1),20);
});

const member=()=>{const p=starterPlayer('Guild');p.account.level=60;p.wallet.gold=10**9;p.wallet.diamonds=5000;p.inventory[guildCoin]=100000;p.guild={id:'g1'};return p};
const ctx=(level=1)=>({guild:{id:'g1',level,boss:{stage:1,hp:stageHp(1),damage:{}}}});
test('guild skills: cost 20000 beli + 30 badges, chain unlock at level 10, tier needs max + guild level, reset refunds (first free)',()=>{
 const p=member(),gold=p.wallet.gold,coin=p.inventory[guildCoin],atk=heroStats(p).attack;
 applyAction(p,'guild-tech',{op:'upgrade',cls:'warrior',index:0},Date.now(),ctx());
 assert.equal(p.wallet.gold,gold-20000);assert.equal(p.inventory[guildCoin],coin-30);assert.deepEqual(techCost(1,0),{gold:20000,coin:30});
 assert.equal(heroStats(p).attack,Math.round(atk*1.01),'Luffy is a fighter -> Đấu Sĩ +1% Công');
 assert.throws(()=>applyAction(p,'guild-tech',{op:'upgrade',cls:'warrior',index:1},Date.now(),ctx()),/cấp 10/);
 for(let i=1;i<10;i++)applyAction(p,'guild-tech',{op:'upgrade',cls:'warrior',index:0},Date.now(),ctx());
 applyAction(p,'guild-tech',{op:'upgrade',cls:'warrior',index:1},Date.now(),ctx());
 assert.throws(()=>applyAction(p,'guild-tech',{op:'tier',cls:'warrior'},Date.now(),ctx()),/tối đa/);
 for(let i=0;i<8;i++)while(p.guild.tech.warrior.levels[i]<20)applyAction(p,'guild-tech',{op:'upgrade',cls:'warrior',index:i},Date.now(),ctx());
 assert.throws(()=>applyAction(p,'guild-tech',{op:'tier',cls:'warrior'},Date.now(),ctx(1)),/cấp độ 3/);
 applyAction(p,'guild-tech',{op:'tier',cls:'warrior'},Date.now(),ctx(3));assert.equal(p.guild.tech.warrior.tier,2);
 const b=techBonus(p,'fighter');assert.ok(Math.abs(b.attackPct-.2)<1e-9&&b.speed===20&&Math.abs(b.critChance-.1)<1e-9,JSON.stringify(b));
 assert.deepEqual(techBonus(p,'mage'),{},'other classes untouched');
 const spentGold=gold-p.wallet.gold,gems=p.wallet.diamonds;
 applyAction(p,'guild-tech',{op:'reset',cls:'warrior'},Date.now(),ctx(3));assert.equal(p.wallet.gold,gold);assert.equal(p.inventory[guildCoin],coin);assert.equal(p.wallet.diamonds,gems);assert.ok(spentGold>0);
 applyAction(p,'guild-tech',{op:'upgrade',cls:'warrior',index:0},Date.now(),ctx());applyAction(p,'guild-tech',{op:'reset',cls:'warrior'},Date.now(),ctx());assert.equal(p.wallet.diamonds,gems-100);
 p.guild.id=null;assert.deepEqual(techBonus(p,'fighter'),{},'no bonus outside a guild');
});

test('roll call once a day, donations, boss attack opens a battle with shared HP and pays per attack',()=>{
 const p=member(),c=ctx();const r=applyAction(p,'guild-rollcall',{},Date.now(),c);assert.equal(r.guildExp,30);assert.throws(()=>applyAction(p,'guild-rollcall',{},Date.now(),c),/điểm danh/);
 const d=applyAction(p,'guild-donate',{tier:1},Date.now(),c);assert.equal(d.guildExp,60);
 const hp=stageHp(1).map((v,i)=>i===0?0:Math.round(v/2)),gold=p.wallet.gold;
 applyAction(p,'guild-boss',{skip:true},Date.now(),{guild:{id:'g1',level:1,boss:{stage:1,hp,damage:{}}}});
 assert.equal(p.battle.enemies.length,3,'dead monster stays dead');assert.equal(p.battle.status,'won');assert.ok(p.battle.reward.damage>0);assert.equal(p.wallet.gold,gold+6000);
 assert.equal(playerView(p).guild.bossLeft,2);
});

describe('Hạm đội on MongoDB',{skip:!process.env.MONGODB_URI},()=>{
 const database='htps_guild_'+randomUUID().replaceAll('-','').slice(0,12);let store,a,b;const key=()=>randomUUID();
 before(async()=>{store=new Store(process.env.MONGODB_URI,database);await store.connect();a=await store.createUser('guild_a','password-guild-1');b=await store.createUser('guild_b','password-guild-2');
  for(const u of [a,b])await store.users.updateOne({_id:u._id},{$set:{'player.account.level':60,'player.hero.level':150,'player.hero.stars':8,'player.wallet.diamonds':5000,'player.wallet.gold':10**8,'player.inventory.consumable:6':100000}})});
 after(async()=>{assert.match(database,/^htps_guild_[a-f0-9]{12}$/);if(store){await store.db.dropDatabase();await store.close()}});
 test('create (500 gems, 6-20 chars), search, apply, approve, roll call adds guild EXP',async()=>{
  const A=a._id.toHexString(),B=b._id.toHexString();
  await assert.rejects(store.guildCreate(A,key(),{name:'abc',flag:1}),/6 đến 20/);
  const made=await store.guildCreate(A,key(),{name:'Mu Rom Team',flag:3});assert.equal(made.player.wallet.diamonds,4500);
  await assert.rejects(store.guildCreate(B,key(),{name:'mu rom team',flag:1}),/đã có người dùng/);
  const found=await store.guildSearch(B,'rom');assert.equal(found.guilds.length,1);const gid=found.guilds[0].id;
  await store.guildApply(B,gid);let s=await store.guildStatus(A);assert.equal(s.guild.applications.length,1);assert.equal(s.guild.role,'leader');
  await store.guildManage(A,{op:'approve',userId:B});s=await store.guildStatus(B);assert.equal(s.guild.members.length,2);assert.equal((await store.getUser(B)).player.guild.id,gid);
  await store.guildAct(B,key(),'guild-rollcall',{});s=await store.guildStatus(B);assert.equal(s.guild.exp,30);
  await store.guildAct(A,key(),'guild-tech',{op:'upgrade',cls:'warrior',index:0});assert.equal((await store.getUser(A)).player.guild.tech.warrior.levels[0],1);
 });
 test('boss damage is applied once per battle; killing the boss opens the next stage and mails rewards',async()=>{
  const A=a._id.toHexString(),g=await store.guildOf(a._id),k=key();
  await store.users.updateOne({_id:a._id},{$set:{'player.hero.level':40,'player.hero.stars':3,'player.formation':{version:2,slots:['luffy-gear-2',null,null,null,null,null]}}});
  const data=await store.guildAct(A,k,'guild-boss',{skip:true});assert.ok(data.result.guildBoss.damage>0);
  const again=await store.guildAct(A,k,'guild-boss',{skip:true});assert.equal(again.replayed,true);
  let fresh=await store.guilds.findOne({_id:g._id});const max=stageHp(1).reduce((x,y)=>x+y,0),left=fresh.boss.hp.reduce((x,y)=>x+y,0);
  assert.equal(max-left,data.result.guildBoss.damage);assert.equal(fresh.boss.damage[A],data.result.guildBoss.damage);assert.equal(fresh.exp,30+36);
  await store.users.updateOne({_id:a._id},{$set:{'player.hero.level':150,'player.hero.stars':8}});await store.guilds.updateOne({_id:g._id},{$set:{'boss.hp':[1,0,0,0]}});
  const kill=await store.guildAct(A,key(),'guild-boss',{skip:true});assert.equal(kill.result.guildBoss.killed,true);
  fresh=await store.guilds.findOne({_id:g._id});assert.equal(fresh.boss.stage,2);assert.deepEqual(fresh.boss.damage,{});
  const r1=await store.guildBoss(A,1);assert.equal(r1.ranking.state,'dead');assert.equal(r1.ranking.killer.name,'guild_a');assert.equal(r1.ranking.top.length,1);assert.equal(r1.ranking.top[0].hits,2);assert.ok(r1.ranking.top[0].me);
  assert.equal(r1.ranking.top[0].damage,data.result.guildBoss.damage+kill.result.guildBoss.damage);assert.deepEqual(r1.ranking.top[0].reward,finalReward(1,1));
  assert.equal((await store.guildDamage.findOne({guildId:g._id,stage:1})).rank,1);const r2=await store.guildBoss(A);assert.equal(r2.ranking.stage,2);assert.equal(r2.ranking.state,'current');assert.equal(r2.ranking.top.length,0);
  const mail=(await store.getUser(A)).player.mail.map(m=>m.title);assert.ok(mail.includes('Hạ Boss hạm đội')&&mail.includes('Thưởng Boss hạm đội'),mail.join());
 });
 test('kick clears the member, leader leaving hands over, last member leaving disbands',async()=>{
  const A=a._id.toHexString(),B=b._id.toHexString();
  await store.guildLeave(A,key());const s=await store.guildStatus(B);assert.equal(s.guild.role,'leader');assert.equal((await store.getUser(A)).player.guild.id,null);
  await store.guildLeave(B,key());assert.equal(await store.guilds.countDocuments(),0);
 });
});
// Các test này sửa trực tiếp tướng của tài khoản mới nên tắt phần mở đầu (tài khoản mới có Luffy).
process.env.NEW_ACCOUNT_INTRO??='off';
