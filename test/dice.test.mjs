import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {board,config} from '../server/dice.mjs';

const roll=(p,extra={})=>applyAction(p,'dice',{op:'roll',...extra});
test('22-tile board from the original map; daily free dice once; buying with diamonds',()=>{
 assert.equal(board.length,22);const p=starterPlayer('Dice');
 applyAction(p,'dice',{op:'free'});assert.equal(p.dice.normal,config.dailyDice);assert.throws(()=>applyAction(p,'dice',{op:'free'}),/đã nhận/);
 const gems=p.wallet.diamonds;applyAction(p,'dice',{op:'buy',count:2});assert.equal(p.wallet.diamonds,gems-40);assert.equal(p.dice.normal,7);
 assert.equal(playerView(p).dice.tiles.length,22);
});
test('lucky dice picks the number; landing on a resource pays and levels the tile; dice and tarot triggers',()=>{
 const p=starterPlayer('Dice2');applyAction(p,'dice',{op:'free'});p.dice.lucky=5;
 const spirit=p.wallet.spirit;const r=roll(p,{lucky:true,number:1});assert.equal(r.to,1);assert.equal(p.wallet.spirit-spirit,20000);assert.equal(p.dice.levels[0],2);
 roll(p,{lucky:true,number:4});assert.equal(p.dice.tile,5);assert.equal(p.dice.normal,6,'Dice1 tile +1 normal die');
 roll(p,{lucky:true,number:5});assert.equal(p.dice.tile,10);assert.equal(p.dice.tarot,true);assert.throws(()=>roll(p),/lá bài/);
 const t=applyAction(p,'dice',{op:'tarot'});assert.ok([1,2,5,6,7,8,9].includes(t.tarot.effect));assert.equal(p.dice.tarot,false);
});
test('dizzy: even goes forward, odd goes back; completing a lap gives stars; star milestones are claimable once',()=>{
 const p=starterPlayer('Dice3');p.dice=undefined;applyAction(p,'dice',{op:'free'});p.dice.lucky=10;p.dice.tile=14;
 roll(p,{lucky:true,number:1});assert.equal(p.dice.effect,4);roll(p,{lucky:true,number:3});assert.equal(p.dice.tile,12);
 p.dice.tile=21;const stars=p.dice.stars;const r=roll(p,{lucky:true,number:3});assert.equal(r.laps,1);assert.equal(p.dice.lap,1);assert.ok(p.dice.stars>=stars+config.lapStars);
 p.dice.stars=60;applyAction(p,'dice',{op:'claim',index:0});assert.throws(()=>applyAction(p,'dice',{op:'claim',index:0}),/Đã nhận/);assert.throws(()=>applyAction(p,'dice',{op:'claim',index:2}),/Cần 100/);
});
import {defaultDiceConfig,validateDiceConfig,applyDiceConfig} from '../server/dice.mjs';
import {isRewardId} from '../server/game.mjs';
import {applyFreedomConfig,defaultFreedomConfig} from '../server/freedom.mjs';
test('cấu hình quản trị: hợp lệ, đổi bàn / giá / mốc có hiệu lực ngay; tắt thì ẩn và từ chối; Tự Do tắt cũng vậy',()=>{
 const c=defaultDiceConfig();assert.deepEqual(validateDiceConfig(c,isRewardId),c);
 assert.throws(()=>validateDiceConfig({...c,board:c.board.slice(1)},isRewardId),/22 ô/);
 assert.throws(()=>validateDiceConfig({...c,milestones:[c.milestones[0],c.milestones[0]]},isRewardId),/trùng/);
 const b=structuredClone(c.board);b[0]={type:1,key:1,amount:777};
 applyDiceConfig(validateDiceConfig({...c,price:7,board:b},isRewardId));
 try{
  const p=starterPlayer('DiceCfg');applyAction(p,'dice',{op:'free'});const g=p.wallet.diamonds;applyAction(p,'dice',{op:'buy',count:1});assert.equal(g-p.wallet.diamonds,7);
  p.dice.lucky=1;const sp=p.wallet.spirit;roll(p,{lucky:true,number:1});assert.equal(p.wallet.spirit-sp,777);
  applyDiceConfig({...c,enabled:false});assert.equal(playerView(p).dice.enabled,false);assert.throws(()=>applyAction(p,'dice',{op:'free'}),/tạm đóng/);
 }finally{applyDiceConfig(null)}
 assert.equal(board[0].amount,c.board[0].amount);
 applyFreedomConfig({...defaultFreedomConfig(),enabled:false});
 try{const p=starterPlayer('FreeOff');p.account.level=99;assert.equal(playerView(p).freedom.enabled,false);assert.throws(()=>applyAction(p,'freedom-join',{}),/tạm đóng/)}finally{applyFreedomConfig(null)}
});
