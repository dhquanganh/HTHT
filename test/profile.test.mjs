import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView,accountExp} from '../server/game.mjs';

test('avatar is separate from the main hero: owned hero heads only; special avatars must be owned',()=>{
 const p=starterPlayer('Pf');const main=p.hero.id;
 applyAction(p,'profile-update',{op:'avatar',kind:'hero',id:'zoro-king-of-hell'});assert.deepEqual(p.avatar,{kind:'hero',id:'zoro-king-of-hell'});assert.equal(p.hero.id,main,'main hero unchanged');
 assert.throws(()=>applyAction(p,'profile-update',{op:'avatar',kind:'hero',id:'not-owned'}),/chưa sở hữu/);
 assert.throws(()=>applyAction(p,'profile-update',{op:'avatar',kind:'special',id:1}));
 p.avatars=[1];applyAction(p,'profile-update',{op:'avatar',kind:'special',id:1});assert.deepEqual(playerView(p).avatar,{kind:'special',id:1});
});
test('rename: first time free, then 100 diamonds',()=>{
 const p=starterPlayer('Pf');const gems=p.wallet.diamonds;
 applyAction(p,'profile-update',{op:'rename',displayName:'Thuyền Trưởng'});assert.equal(p.wallet.diamonds,gems);
 applyAction(p,'profile-update',{op:'rename',displayName:'Thuyền Trưởng 2'});assert.equal(p.wallet.diamonds,gems-100);
 p.wallet.diamonds=50;assert.throws(()=>applyAction(p,'profile-update',{op:'rename',displayName:'Ten Khac'}));assert.equal(p.displayName,'Thuyền Trưởng 2');
});
test('levelling up pays 20 diamonds per level (+gold every 10 levels) and queues the level-up popup',()=>{
 const p=starterPlayer('Pf');p.account.level=9;p.account.exp=0;const gems=p.wallet.diamonds,gold=p.wallet.gold;
 accountExp(p,900+1000);assert.equal(p.account.level,11);assert.equal(p.wallet.diamonds,gems+40);assert.equal(p.wallet.gold,gold+20000);
 assert.deepEqual(playerView(p).levelUps.map(x=>x.level),[10,11]);
 applyAction(p,'profile-update',{op:'level-ack'});assert.deepEqual(p.levelUps,[]);
});
