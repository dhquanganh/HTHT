import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {economy,stages} from '../server/catalog.mjs';
import {startAfk} from '../server/afk.mjs';

const start=Date.UTC(2026,10,6,8),minute=60000,hour=3600000,stone=economy.afk.stoneItem;
const view=(p,now)=>playerView(p,now).afk;
function cleared(stage,now=start){const p=starterPlayer('Captain');p.adventure.cleared=Array.from({length:stage},(_,i)=>i+1);p.adventure.unlockedStage=stage+1;p.account.level=100;startAfk(p,now);return p}
function win(p,stageId,now){applyAction(p,'battle-start',{stageId,formation:[p.hero.id,null,null,null,null,null]},now);for(const unit of p.battle.enemies)unit.hp=1;for(const unit of p.battle.allies){unit.attack=1e6;unit.speed=1e6}let rounds=0;while(p.battle.status==='active'&&rounds++<10)applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},now);assert.equal(p.battle.status,'won')}

test('every original stage has an AFK rate that never drops',()=>{const p=starterPlayer('Captain');let previous=0;for(const stage of [1,50,200,500,999]){p.adventure.unlockedStage=stage+1;const {rate}=view(p,start);assert.ok(rate.gold>=previous&&rate.accountExp>0&&rate.spirit>0);previous=rate.gold}assert.equal(stages.length,999)});

test('chest stays empty until the first stage is cleared',()=>{
 const p=starterPlayer('Captain');assert.equal(view(p,start+20*hour).state,'empty');assert.equal(view(p,start+20*hour).rate,null);
 assert.throws(()=>applyAction(p,'afk-claim',{},start+20*hour),/Rương trống/);
 win(p,1,start);const after=view(p,start+2*hour);assert.equal(after.seconds,7200);assert.equal(after.state,'overflow');assert.equal(after.stageCode,'1-1');
});

test('chest moves from empty to closed to overflowing, and stops at ten hours',()=>{
 const p=cleared(1);
 assert.equal(view(p,start).state,'empty');assert.equal(view(p,start+59000).state,'empty');assert.equal(view(p,start+minute).state,'full');
 assert.equal(view(p,start+hour-1000).state,'full');assert.equal(view(p,start+hour).state,'overflow');
 assert.deepEqual(view(p,start+40*hour).pending,view(p,start+10*hour).pending);assert.equal(view(p,start+40*hour).seconds,36000);
});

test('claim pays gold, captain EXP and EXP stones from the stage rate, then empties the chest',()=>{
 const p=cleared(1),{rate}=view(p,start),gold=p.wallet.gold,stones=p.wallet.spirit,ticks=720;
 const result=applyAction(p,'afk-claim',{},start+hour);
 assert.equal(p.wallet.gold,gold+ticks*rate.gold);assert.equal(p.wallet.spirit,stones+ticks*rate.spirit,'Đá EXP is the hero EXP pool, 1 stone = 1 EXP');
 assert.equal(result.reward.accountExp,ticks*rate.accountExp);assert.ok(p.account.level>1||p.account.exp>0);assert.match(result.message,/14\.400 vàng, 3\.600 kinh nghiệm, 1\.440 Đá EXP/);
 assert.equal(view(p,start+hour).state,'empty');assert.equal(view(p,start+hour).pending.gold,0);
 assert.throws(()=>applyAction(p,'afk-claim',{},start+hour),/Rương trống/);
 assert.equal(view(p,start+hour+minute).state,'full');
});

test('Đá EXP in the bag and EXP tướng in the header are the same number',()=>{
 const p=cleared(1);applyAction(p,'afk-claim',{},start+hour);const state=playerView(p,start+hour);
 assert.equal(state.inventory[stone],p.wallet.spirit);assert.equal(p.inventory[stone],undefined,'Never stored twice');
 assert.throws(()=>applyAction(p,'use',{itemId:stone,quantity:1},start+hour),/trang bị hoặc nâng cấp/,'No separate use step');
});

test('frequent claims lose neither partial EXP stones nor partial ticks',()=>{
 const rare=cleared(1),frequent=cleared(1);applyAction(rare,'afk-claim',{},start+3*hour);
 for(let now=start+7*minute+3000;now<=start+3*hour;now+=7*minute+3000)applyAction(frequent,'afk-claim',{},now);
 const end=start+3*hour,stones=p=>p.wallet.spirit,spirit=view(rare,end).rate.spirit;
 const total=p=>p.wallet.gold+view(p,end).pending.gold,points=p=>stones(p)-700+view(p,end).pending.spirit;
 assert.equal(total(frequent),total(rare));assert.equal(points(frequent),points(rare));assert.equal(points(rare),2160*spirit);
});

test('a claim taken after the cap starts counting from that moment',()=>{
 const p=cleared(1);applyAction(p,'afk-claim',{},start+30*hour);assert.equal(view(p,start+30*hour).seconds,0);assert.equal(view(p,start+30*hour+minute).seconds,60);
});

test('clearing a new stage keeps earned time at the old rate and applies the new rate afterwards',()=>{
 const index=stages.findIndex((s,i)=>i&&s.idleOutput!==stages[i-1].idleOutput),stageId=index+1,p=cleared(index);
 const oldRate=view(p,start).rate;win(p,stageId,start+hour);const newRate=view(p,start+hour).rate;assert.notEqual(newRate.gold+newRate.spirit+newRate.accountExp,oldRate.gold+oldRate.spirit+oldRate.accountExp);
 const pending=view(p,start+2*hour).pending;assert.equal(pending.gold,720*oldRate.gold+720*newRate.gold);assert.equal(pending.spirit,720*oldRate.spirit+720*newRate.spirit);
});

test('the ten hour limit spans a rate change',()=>{
 const index=stages.findIndex((s,i)=>i&&s.idleOutput!==stages[i-1].idleOutput),p=cleared(index);win(p,index+1,start+9*hour);
 assert.equal(view(p,start+11*hour).seconds,36000);assert.equal(view(p,start+40*hour).seconds,36000);
});

test('existing accounts start counting now without retroactive rewards',()=>{
 const p=starterPlayer('Captain');p.adventure.cleared=[1,2];p.adventure.unlockedStage=3;delete p.adventure.afk;
 assert.equal(view(p,start).seconds,0);assert.equal(startAfk(p,start),true);assert.equal(startAfk(p,start),false);assert.equal(view(p,start+minute).seconds,60);
});

test('client-supplied amounts, clock rollback and active battles cannot change the payout',()=>{
 const p=cleared(1),gold=p.wallet.gold;applyAction(p,'afk-claim',{gold:1e12,seconds:1e9,now:start+40*hour},start+minute);assert.equal(p.wallet.gold-gold,240);
 const q=cleared(1);assert.equal(view(q,start-hour).seconds,0);assert.throws(()=>applyAction(q,'afk-claim',{},start-hour),/Rương trống/);
 applyAction(q,'battle-start',{stageId:1},start);assert.throws(()=>applyAction(q,'afk-claim',{},start+hour),/kết thúc trận/);
});
