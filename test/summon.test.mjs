import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {levelCap} from '../server/game.mjs';
import {economy,itemById,materials} from '../server/catalog.mjs';
import {rollHero,rollSummon,grantSummon,startSummon} from '../server/summon.mjs';

const barrel=economy.summon.item;
test('new accounts start with ten barrels, granted only once',()=>{const p=starterPlayer('Captain');assert.equal(p.inventory[barrel],10);assert.equal(startSummon(p),false);assert.equal(p.inventory[barrel],10)});
test('existing accounts receive the barrels once',()=>{const p=starterPlayer('Captain');delete p.summonGranted;delete p.collection;delete p.inventory[barrel];assert.equal(startSummon(p),true);assert.equal(p.inventory[barrel],10);assert.equal(startSummon(p),false)});
test('barrels are consumed and heroes land in the collection',()=>{
 const p=starterPlayer('Captain');const one=applyAction(p,'summon',{faction:'fortress',count:1});assert.equal(one.heroes.length,1);assert.equal(p.inventory[barrel],9);
 const ten=applyAction(starterPlayer('Captain'),'summon',{faction:'forest',count:10});assert.equal(ten.heroes.length,10);
});
test('summons without enough barrels or with bad input are refused and spend nothing',()=>{
 const p=starterPlayer('Captain');p.inventory[barrel]=9;assert.throws(()=>applyAction(p,'summon',{faction:'abyss',count:10}),/Không đủ/);assert.equal(p.inventory[barrel],9);
 for(const input of [{faction:'light',count:1},{faction:'abyss',count:3},{faction:'abyss',count:-1},{count:1}])assert.throws(()=>applyAction(p,'summon',input));assert.equal(p.inventory[barrel],9);
});
test('the result comes from the server, not from client fields',()=>{const p=starterPlayer('Captain');const result=applyAction(p,'summon',{faction:'abyss',count:1,avatar:'578',rank:6,fresh:true});assert.notEqual(result.heroes[0].avatar,'578')});
test('heroes match the chosen faction and rates hold over many rolls',()=>{
 const seen={};let seed=12345;const random=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296};
 for(let i=0;i<20000;i++){const h=rollHero('fortress',random);assert.equal(h.faction,'fortress');const key=h.rank>=4?h.rank:3;seen[key]=(seen[key]||0)+1}
 assert.ok(Math.abs(seen[6]/200-1)<.5);assert.ok(Math.abs(seen[5]/200-12)<1.5);assert.ok(Math.abs(seen[4]/200-35)<2);assert.ok(Math.abs(seen[3]/200-52)<2);
});
test('ten pulls always contain grade A or better',()=>{let seed=7;const low=()=>{seed=(seed*1664525+1013904223)%4294967296;return .9+seed/42949672960};for(let i=0;i<200;i++)assert.ok(rollSummon('shadow',10,low).some(h=>h.rank>=4))});
test('a new hero joins the roster; a repeat becomes shards for star-ups',()=>{
 const p=starterPlayer('Captain'),shards=p.inventory['heroshard:624']||0;assert.equal(grantSummon(p,{avatar:'624'}).fresh,true);assert.ok(p.reserveHeroes['hero-624']);
 const repeat=grantSummon(p,{avatar:'624'});assert.equal(repeat.fresh,undefined);assert.equal(repeat.shardItem,'heroshard:624');assert.equal(repeat.shards,8);assert.equal(p.inventory['heroshard:624']||0,shards);
 assert.equal(grantSummon(p,{avatar:'109'}).shardItem,materials.star);
});
test('barrels are sold for diamonds and the collection reaches the client',()=>{
 assert.equal(itemById.get(barrel).priceCurrency,'diamonds');const p=starterPlayer('Captain');assert.throws(()=>applyAction(p,'buy',{itemId:barrel,quantity:1}),/không bán/);assert.equal(p.inventory[barrel],10);
 applyAction(p,'summon',{faction:'abyss',count:10});assert.ok(playerView(p).heroes.length>2);
});
test('summoning is blocked during a battle',()=>{const p=starterPlayer('Captain');applyAction(p,'battle-start',{stageId:1});assert.throws(()=>applyAction(p,'summon',{faction:'abyss',count:1}),/kết thúc trận/)});
test('hero shards merge into that hero, then only feed stars',()=>{
 const p=starterPlayer('Captain');p.inventory['heroshard:624']=49;assert.throws(()=>applyAction(p,'shard-merge',{itemId:'heroshard:624'}),/Cần 50/);
 p.inventory['heroshard:624']=60;applyAction(p,'shard-merge',{itemId:'heroshard:624'});assert.ok(p.reserveHeroes['hero-624']);assert.equal(p.inventory['heroshard:624'],10);
 assert.throws(()=>applyAction(p,'shard-merge',{itemId:'heroshard:624'}),/Đã có tướng/);assert.equal(p.inventory['heroshard:624'],10);
 const star=playerView({...p,hero:p.reserveHeroes['hero-624']}).costs.star.items;assert.deepEqual(Object.keys(star),['heroshard:624']);
});
test('fifty generic shards roll a hero of five stars or more',()=>{
 const p=starterPlayer('Captain');p.inventory['shard:30000']=50;const result=applyAction(p,'shard-merge',{itemId:'shard:30000'});assert.ok(result.hero.avatar);assert.equal(p.inventory['shard:30000']||0,0);
 assert.throws(()=>applyAction(p,'shard-merge',{itemId:'consumable:16'}),/không ghép/);
});
test('stars go 5 yellow, 4 purple, 5 red, then L1-L5; level caps 200..280 red, 300/350/400/500/600 for L1-L5',()=>{
 const p=starterPlayer('Captain');p.wallet.gold=1e12;p.account.level=200;p.hero.level=60;p.inventory['material:luffy-shard']=1e6;p.inventory['consumable:2']=1e6;p.inventory['consumable:200019']=1e7;
 const caps=[];
 for(let s=1;s<19;s++){if(s===5)assert.ok(playerView(p).costs.star.items['consumable:2'],'Purple needs enhance stones');p.hero.level=Math.max(p.hero.level,playerView(p).costs.star.minLevel);applyAction(p,'upgrade',{type:'star'});caps.push(levelCap(p.hero.stars))}
 assert.equal(p.hero.stars,19);assert.throws(()=>applyAction(p,'upgrade',{type:'star'}),/tối đa/);
 assert.deepEqual(caps.slice(8),[200,220,240,260,280,300,350,400,500,600]);
 assert.equal(playerView(p).hero.starLabel,'L5');
 p.account.level=100;p.hero.stars=19;assert.equal(playerView(p).costs.level.maxLevel,600,'L5 lên được 600');
 p.account.level=1;assert.equal(playerView(p).costs.level.maxLevel,600,'không phụ thuộc cấp thuyền trưởng');
 p.hero.stars=13;p.hero.level=200;assert.throws(()=>applyAction(p,'upgrade',{type:'star'}),/Cần tướng cấp 260/,'red stars need the current level cap');
});
