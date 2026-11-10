import {test,describe,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {starterPlayer,applyAction,isRewardId} from '../server/game.mjs';
import {defaultRaidConfig,validateRaidConfig,raidView} from '../server/raid.mjs';
import {Store} from '../server/store.mjs';
try{process.loadEnvFile('.env')}catch{}

test('default table matches the original frames and unlock levels',()=>{
 const c=defaultRaidConfig(),q=(m,i)=>c.modes[m].levels[i].rewards.map(r=>r.quantity);
 assert.deepEqual([0,1,2].map(i=>q('gold',i)[0]),[20000,35000,50000]);assert.deepEqual(c.modes.gold.levels.slice(0,6).map(l=>l.power),[20000,60000,100000,140000,180000,220000]);
 assert.deepEqual(q('spirit',3),[50000,25,10]);assert.deepEqual(q('hero',3),[7,3,2]);assert.deepEqual(q('hero',4),[8,4,2]);assert.equal(c.modes.spirit.levels[5].unlock,70);
 assert.equal(c.modes.hero.levels[0].unlock,30);assert.equal(c.freeTurns,2);
 assert.throws(()=>validateRaidConfig({...c,freeTurns:-1},isRewardId),/Lượt miễn phí/);
 const bad=structuredClone(c);bad.modes.gold.levels[0].rewards=[{itemId:'nope',quantity:1}];assert.throws(()=>validateRaidConfig(bad,isRewardId),/không tồn tại/);
 assert.deepEqual(validateRaidConfig(c,isRewardId),c);
});

const ctx={raid:defaultRaidConfig()};
const strong=()=>{const p=starterPlayer('Raid');p.account.level=45;p.hero.level=200;p.hero.stars=10;p.wallet.diamonds=1000;return p};
test('locked by player level; win costs a turn and pays the level rewards; loss keeps the turn; buy more',()=>{
 const low=starterPlayer('L');low.account.level=19;assert.throws(()=>applyAction(low,'raid-start',{mode:'gold',level:1},Date.now(),ctx),/Cấp 20/);
 const p=strong();assert.throws(()=>applyAction(p,'raid-start',{mode:'gold',level:4},Date.now(),ctx),/Cấp 50 mở/);
 const gold=p.wallet.gold;applyAction(p,'raid-start',{mode:'gold',level:1,skip:true},Date.now(),ctx);assert.equal(p.battle.status,'won');assert.equal(p.wallet.gold,gold+20000);
 assert.equal(raidView(p,ctx.raid).modes[0].turns,1);
 const weak=starterPlayer('W');weak.account.level=45;applyAction(weak,'raid-start',{mode:'spirit',level:3,skip:true},Date.now(),ctx);assert.equal(weak.battle.status,'lost');assert.equal(raidView(weak,ctx.raid).modes[1].turns,2);
 applyAction(p,'raid-start',{mode:'gold',level:1,skip:true},Date.now(),ctx);assert.throws(()=>applyAction(p,'raid-start',{mode:'gold',level:1},Date.now(),ctx),/hết lượt/);
 applyAction(p,'raid-buy',{mode:'gold'},Date.now(),ctx);assert.equal(p.wallet.diamonds,950);applyAction(p,'raid-start',{mode:'gold',level:1,skip:true},Date.now(),ctx);
});

describe('Chiến dịch config on MongoDB',{skip:!process.env.MONGODB_URI},()=>{
 const database='htps_raid_'+randomUUID().replaceAll('-','').slice(0,12);let store,a;
 before(async()=>{store=new Store(process.env.MONGODB_URI,database);await store.connect();a=await store.createUser('raid_a','password-raid-1');
  await store.users.updateOne({_id:a._id},{$set:{'player.account.level':45,'player.hero.level':200,'player.hero.stars':10}})});
 after(async()=>{assert.match(database,/^htps_raid_[a-f0-9]{12}$/);if(store){await store.db.dropDatabase();await store.close()}});
 test('admin edits rewards; players are paid by the saved config; reset restores defaults',async()=>{
  const admin=await store.raidAdmin();assert.equal(admin.custom,false);const config=structuredClone(admin.config);
  config.modes.gold.levels[0].rewards=[{itemId:'diamonds',quantity:77},{itemId:'gold',quantity:1234}];config.freeTurns=3;
  await store.setRaidConfig({config},'127.0.0.1');const view=await store.raidStatus(a._id.toHexString());assert.equal(view.modes[0].turns,3);assert.equal(view.modes[0].levels[0].rewards[0].quantity,77);
  const before=(await store.getUser(a._id)).player.wallet.diamonds;const d=await store.mutate(a._id.toHexString(),randomUUID(),'raid-start',{mode:'gold',level:1,skip:true});
  assert.equal(d.player.battle.status,'won');assert.equal(d.player.wallet.diamonds,before+77);
  await store.setRaidConfig({reset:true},'127.0.0.1');assert.equal((await store.raidAdmin()).custom,false);
 });
});

test('sweep only levels already won; it costs a turn and pays instantly',()=>{
 const p=strong();assert.throws(()=>applyAction(p,'raid-smash',{mode:'gold',level:1},Date.now(),ctx),/đánh thắng/);
 applyAction(p,'raid-start',{mode:'gold',level:1,skip:true},Date.now(),ctx);const gold=p.wallet.gold;
 applyAction(p,'raid-smash',{mode:'gold',level:1},Date.now(),ctx);assert.equal(p.wallet.gold,gold+20000);assert.equal(raidView(p,ctx.raid).modes[0].turns,0);assert.equal(p.battle.status,'won');
});
// Các test này sửa trực tiếp tướng của tài khoản mới nên tắt phần mở đầu (tài khoản mới có Luffy).
process.env.NEW_ACCOUNT_INTRO??='off';
