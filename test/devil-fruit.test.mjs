import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,heroStats,playerView} from '../server/game.mjs';
import {fruitData,fruitPoints,setScale,shardsFor,maxLevel,maxStar} from '../server/devil-fruit.mjs';
import {grantSummon} from '../server/summon.mjs';

const now=Date.UTC(2026,10,8,9);
const magu=fruitData.fruits.find(f=>f.name==='Magu Magu no Mi');
const pct=(pts,id)=>pts.find(([k])=>k===id)[1]/10; // FFGenPoints: value / 10 = %
const player=()=>{const p=starterPlayer('Fruit');p.wallet.gold=1e10;p.wallet.diamonds=1e6;for(const id of [95,96,97,98,99,100,101,102])p.inventory['consumable:'+id]=1e5;return p};

test('db_devil_fruit: 36 trái, 9 bộ, hạng 1-4, mảnh hợp thành 30 / 50',()=>{
 assert.equal(fruitData.fruits.length,36);assert.equal(fruitData.sets.length,9);assert.equal(maxLevel,20);assert.equal(maxStar,12);
 assert.equal(shardsFor(1),30);assert.equal(shardsFor(2),50);assert.equal(shardsFor(4),50);
 assert.equal(magu.rank,4);assert.deepEqual(magu.special,[[1107,100]]);
});

test('Magu Magu no Mi: % Công 12% ở +0, 24% ở +20; ST DOT 10% ở 0 sao, 45,5% ở 12 sao (như ảnh gốc)',()=>{
 const s={owned:{[magu.id]:{level:0,star:0}}};
 assert.equal(pct(fruitPoints(s,magu).base,100),12);assert.equal(pct(fruitPoints(s,magu).base,101),2);assert.equal(pct(fruitPoints(s,magu).base,103),1.6);
 assert.equal(pct(fruitPoints(s,magu).special,1107),10);
 assert.equal(pct(fruitPoints(s,magu,{level:20,star:12}).base,100),24);
 assert.equal(+pct(fruitPoints(s,magu,{level:20,star:12}).special,1107).toFixed(1),45.5);
});

test('bộ: cả 4 trái đạt 2 / 4 / 6 sao thì chỉ số cơ bản +20% / +50% / +100%',()=>{
 const set=fruitData.sets[0],s={owned:Object.fromEntries(set.fruits.map(id=>[id,{level:0,star:2}]))};
 assert.equal(setScale(s,set).scale,1.2);s.owned[set.fruits[0]].star=1;assert.equal(setScale(s,set).scale,1);
 for(const id of set.fruits)s.owned[id].star=6;assert.equal(setScale(s,set).scale,2);assert.equal(setScale(s,set).steps,3);
});

test('hợp thành, cường hóa, nâng sao theo phí gốc và câu báo lỗi gốc',()=>{
 const p=player(),id=magu.id;
 assert.throws(()=>applyAction(p,'fruit-combine',{fruitId:id},now),/Không đủ mảnh để ghép trái/);
 p.devilFruit={owned:{},shards:{[id]:55},slots:3,heroes:[]};applyAction(p,'fruit-combine',{fruitId:id},now);
 assert.deepEqual(p.devilFruit.owned[id],{level:0,star:0});assert.equal(p.devilFruit.shards[id],5);
 assert.throws(()=>applyAction(p,'fruit-combine',{fruitId:id},now),/Đã sở hữu trái này/);
 const gold=p.wallet.gold,ess=p.inventory['consumable:97'];applyAction(p,'fruit-level',{fruitId:id},now);
 assert.equal(p.devilFruit.owned[id].level,1);assert.equal(gold-p.wallet.gold,1320000);assert.equal(ess-p.inventory['consumable:97'],211,'hạng 4 dùng phí cường hóa hạng 4: Tinh Chất (Cao) 211');
 assert.throws(()=>applyAction(p,'fruit-star',{fruitId:id},now),/Không đủ mảnh trái/,'sao 1 hạng 4 cần 50 mảnh cùng loại');
 p.devilFruit.shards[id]=50;const gene=p.inventory['consumable:100'];applyAction(p,'fruit-star',{fruitId:id},now);
 assert.equal(p.devilFruit.owned[id].star,1);assert.equal(gene-p.inventory['consumable:100'],120);assert.equal(p.devilFruit.shards[id],0);
 p.devilFruit.owned[id].level=20;assert.throws(()=>applyAction(p,'fruit-level',{fruitId:id},now),/cấp độ tối đa/);
 p.devilFruit.owned[id].star=12;assert.throws(()=>applyAction(p,'fruit-star',{fruitId:id},now),/sao tối đa/);
});

test('vòng quay: trừ Xu Bạc / Xu Vàng, kết quả theo bảng; trái đã có đổi thành đủ mảnh',()=>{
 const p=player(),silver=p.inventory['consumable:101'];
 const r=applyAction(p,'fruit-roll',{mode:1,count:10},now);
 assert.equal(silver-p.inventory['consumable:101'],10);assert.equal(r.results.length,10);
 for(const x of r.results){assert.ok(x.slot>=1&&x.slot<=16);if(x.type!==3)assert.ok(fruitData.fruits.some(f=>f.id===x.fruitId))}
 // Ép ô 1 (loại 1: cả trái hạng 2) hai lần: lần 2 đã sở hữu nên thành 50 mảnh.
 const q=player();const first=applyAction(q,'fruit-roll',{mode:1,count:1},now);void first;
 q.devilFruit.owned={};q.devilFruit.shards={};
 const fixed=()=>0;// random()=0 → ô đầu tiên và trái đầu tiên của ô
 const {rollWheel}=awaitImport();const a=rollWheel(q,{mode:1,count:1},{pay:()=>{},grant:()=>{},random:fixed}).results[0];
 assert.equal(a.newFruit,true);const b=rollWheel(q,{mode:1,count:1},{pay:()=>{},grant:()=>{},random:fixed}).results[0];
 assert.equal(b.converted,true);assert.equal(b.shards,50);assert.equal(q.devilFruit.shards[a.fruitId],50);
 assert.throws(()=>applyAction(player(),'fruit-roll',{mode:3,count:1},now),/Vòng quay không hợp lệ/);
});
import * as fruitModule from '../server/devil-fruit.mjs';
function awaitImport(){return fruitModule}

test('tướng cộng hưởng: cần cấp 100, mở ô bằng kim cương, nhận tổng chỉ số trái',()=>{
 const p=player();p.account.level=100;grantSummon(p,{avatar:'453'});const h=p.reserveHeroes['hero-453'];
 p.devilFruit={owned:{[magu.id]:{level:20,star:12}},shards:{},slots:3,heroes:[]};
 assert.throws(()=>applyAction(p,'fruit-heroes',{heroes:['hero-453']},now),/cấp 100/);
 h.level=120;const before=heroStats({...p,hero:h});
 applyAction(p,'fruit-heroes',{heroes:['hero-453']},now);const after=heroStats({...p,hero:h});
 assert.ok(after.attack>before.attack*1.2,'Magu +20: +24% Công');assert.ok(Math.abs((after.dotDamage||0)-.455)<1e-9,'ST DOT 45,5%');
 const gems=p.wallet.diamonds;applyAction(p,'fruit-unlock',{},now);assert.equal(gems-p.wallet.diamonds,100);assert.equal(p.devilFruit.slots,4);
 applyAction(p,'fruit-unlock',{},now);assert.equal(gems-p.wallet.diamonds,300);
 assert.equal(playerView(p,now).devilFruit.unlockFee,300);
});
