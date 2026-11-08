import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,heroStats,playerView} from '../server/game.mjs';
import {petData,newPet,petStats,petSkills,starRequirement,growthTier,recruitPets} from '../server/pet.mjs';

const player=()=>{const p=starterPlayer('Pet');p.wallet.gold=1e12;for(const id of [2,3000,3001,3002,3003,3004])p.inventory['consumable:'+id]=1e7;return p};
const add=(p,setId,patch={})=>{p.pets??={list:[],shards:{},equip:{},nextFree:0,seq:0};return Object.assign(newPet(p.pets,setId,()=>.5),patch)};

test('db_pet_2: 63 thú cưng đã phát hành, Tôm Đỏ đúng bảng gốc; bảng nâng cấp 350 cấp, 10 bậc, sao tối đa 10',()=>{
 assert.equal(petData.pets.length,63);const tom=petData.pets.find(p=>p.id===1);
 assert.equal(tom.name,'Tôm Đỏ');assert.deepEqual(tom.basic.atk,[41.6,46.1]);assert.deepEqual(tom.intelligent,[787,1942]);assert.equal(tom.shardReq,50);assert.equal(tom.generic,2);
 assert.equal(petData.upgrade.levels.length,350);assert.equal(petData.upgrade.maxstar,10);assert.equal(petData.skills['5000'].name,'Bơi nhanh');
});

test('chiêu mộ: La Bàn ×1/×10, miễn phí mỗi 24 giờ; ghép 50 mảnh ở Thư viện',()=>{
 const p=player(),coins=p.inventory['consumable:3002'];applyAction(p,'pet-recruit',{amount:10});assert.equal(coins-p.inventory['consumable:3002'],10);
 applyAction(p,'pet-recruit',{amount:-1});assert.throws(()=>applyAction(p,'pet-recruit',{amount:-1}),/miễn phí/);
 assert.ok(playerView(p).pets.freeIn>0);
 p.pets.shards[7]=55;applyAction(p,'pet-combine',{setId:7});assert.equal(p.pets.shards[7],5);assert.ok(p.pets.list.some(x=>x.setId===7));
 assert.throws(()=>applyAction(p,'pet-combine',{setId:7}),/Không đủ mảnh/);
});

test('lên cấp tốn Vàng + Exp theo levels; giới hạn theo sao (0 sao: 30)',()=>{
 const p=player(),pet=add(p,1),gold=p.wallet.gold,exp=p.inventory['consumable:3004'];
 applyAction(p,'pet-level',{uid:pet.uid});assert.equal(gold-p.wallet.gold,8000);assert.equal(exp-p.inventory['consumable:3004'],20);
 pet.level=30;assert.throws(()=>applyAction(p,'pet-level',{uid:pet.uid}),/cấp tối đa/);
});

test('hoàn đồng, tẩy luyện (chờ rồi đổi), lĩnh ngộ theo tỉ lệ và lùi cấp khi thất bại',()=>{
 const p=player(),pet=add(p,1),g=p.inventory['consumable:3003'];applyAction(p,'pet-growth',{uid:pet.uid});assert.equal(g-p.inventory['consumable:3003'],1);
 const c=p.inventory['consumable:3001'];applyAction(p,'pet-erase',{uid:pet.uid,mode:0});assert.equal(c-p.inventory['consumable:3001'],1);assert.ok(pet.pending);
 const next=pet.pending;applyAction(p,'pet-erase',{uid:pet.uid,mode:1});assert.deepEqual(pet.basic,next);assert.equal(pet.pending,null);
 assert.equal(growthTier(petData.pets[0],petData.pets[0].intelligent[1]),5);
 pet.tier=5;const r=applyAction(p,'pet-enlight',{uid:pet.uid});assert.ok(r.success?pet.tier===6:pet.tier===4,'thất bại ở Lv6 lùi về Lv4');
});

test('thức tỉnh: hiến thú cưng cùng loại theo bảng sao, Đá cường hóa, mở kỹ năng; sao 6 cần thêm thú cưng 5 sao',()=>{
 const p=player(),pet=add(p,1),food=add(p,1);assert.equal(starRequirement(pet).same,1);
 assert.throws(()=>applyAction(p,'pet-star',{uid:pet.uid,same:[]}),/Không đủ nguyên liệu/);
 const stone=p.inventory['consumable:2'];applyAction(p,'pet-star',{uid:pet.uid,same:[food.uid]});
 assert.equal(pet.star,1);assert.equal(stone-p.inventory['consumable:2'],2000);assert.ok(!p.pets.list.includes(food));
 assert.equal(petSkills(pet)[0].active,true);assert.equal(petSkills(pet)[1].active,false);
 pet.star=5;const req=starRequirement(pet);assert.equal(req.same,2);assert.equal(req.extraStar,5);assert.equal(req.extra,5);
 const same=[add(p,1),add(p,1)].map(x=>x.uid),extra=Array.from({length:5},()=>add(p,8,{star:5}).uid);
 applyAction(p,'pet-star',{uid:pet.uid,same,extra});assert.equal(pet.star,6);assert.equal(petSkills(pet)[0].level,2);
});

test('trang bị: chỉ số thú cưng cộng cho chủ nhân, mỗi con một tướng',()=>{
 const p=player(),pet=add(p,7,{level:30});const before=heroStats(p);
 applyAction(p,'pet-equip',{heroId:p.hero.id,uid:pet.uid});const after=heroStats(p),s=petStats(pet);
 assert.equal(after.attack-before.attack,s.atk);assert.equal(after.speed-before.speed,s.spd);
 applyAction(p,'pet-equip',{heroId:'zoro-king-of-hell',uid:pet.uid});assert.equal(p.pets.equip[p.hero.id],undefined,'chuyển sang tướng khác thì tháo khỏi tướng cũ');
 applyAction(p,'pet-equip',{heroId:'zoro-king-of-hell',uid:-1});assert.deepEqual(p.pets.equip,{});
});

test('tỉ lệ chiêu mộ: chủ yếu mảnh, đôi khi cả con hoặc Exp',()=>{
 const p=player();let i=0;const seq=[.1,.5,.9];const r=recruitPets(p,{amount:10},{pay:()=>{},grant:()=>{},random:()=>seq[i++%3]});
 assert.equal(r.results.length,10);for(const x of r.results)assert.ok([1,2,3].includes(x.type));
});
