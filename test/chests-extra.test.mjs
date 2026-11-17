import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {starterPlayer,applyAction} from '../server/game.mjs';
import {chestData,itemById,equipmentData} from '../server/catalog.mjs';
import {fruitData} from '../server/devil-fruit.mjs';
import {petData} from '../server/pet.mjs';

const art=JSON.parse(readFileSync(new URL('../dist/chest-art.json',import.meta.url),'utf8'));
const give=(id,n=1)=>{const p=starterPlayer('Captain');p.inventory[id]=n;return p};
const open=(p,itemId,body={})=>applyAction(p,'chest-open',{itemId,...body}).rewards;

test('every special reward points at a real pet / fruit / avatar and has art',()=>{
 const fruits=new Set(fruitData.fruits.map(f=>f.id)),pets=new Set(petData.pets.map(p=>p.id));
 for(const [id,chest] of Object.entries(chestData))for(const r of chest.rewards){
  if(r.kind==='pet'||r.kind==='petShard'){assert.ok(pets.has(r.id),id);assert.ok(art.pet[r.id]?.key,id)}
  if(r.kind==='fruit'||r.kind==='fruitShard'){assert.ok(fruits.has(r.id),id);assert.ok(art.fruit[r.id]?.key,id)}
  if(r.kind==='avatar')assert.ok(art.avatar[r.id]?.key,id);
 }
});

test('RƯƠNG TRANG BỊ gives one whole red equipment set (4 different slots)',()=>{
 const id='consumable:200045',chest=chestData[id];assert.equal(chest.groups.length,11);
 const p=give(id,10);
 for(let i=0;i<5;i++){
  const got=open(p,id);assert.equal(got.length,4);
  const slots=new Set(got.map(r=>equipmentData.items[r.itemId].slot));assert.equal(slots.size,4);
  for(const r of got){assert.equal(equipmentData.items[r.itemId].rarity,'red');assert.ok(p.inventory[r.itemId]>=1)}
 }
 assert.equal(p.inventory[id],5);
 assert.equal(open(p,id,{count:5}).reduce((n,r)=>n+r.quantity,0),20);
});

test('equipment chests that used to be unusable now open',()=>{
 for(const id of ['consumable:2071','consumable:20050','consumable:600792','consumable:200088']){
  assert.ok(itemById.get(id).chest,id);const p=give(id,1);const got=open(p,id);assert.ok(got.length>=1,id);assert.equal(p.inventory[id],0);
 }
 const pick=give('consumable:600742');assert.equal(chestData['consumable:600742'].mode,'choice');
 const [r]=open(pick,'consumable:600742',{index:0});assert.equal(r.itemId,'equipment:82');assert.equal(pick.inventory['equipment:82'],1);
});

test('devil fruit chests give the fruit (or its shards when owned) and fruit shards',()=>{
 const p=give('consumable:105',2);
 const [first]=open(p,'consumable:105');assert.equal(first.kind,'fruit');assert.ok(first.fresh);assert.ok(p.devilFruit.owned[first.id]);
 assert.equal(fruitData.fruits.find(f=>f.id===first.id).rank,3,'SS = bậc 3 như ô fakeitem 105 của vòng quay');
 // Đã sở hữu cả bể → đổi ra mảnh.
 for(const id of chestData['consumable:105'].rewards.map(r=>r.id))p.devilFruit.owned[id]??={level:0,star:0};
 const [again]=open(p,'consumable:105');assert.equal(again.kind,'fruitShard');assert.equal(again.quantity,50);assert.equal(p.devilFruit.shards[again.id],50);
 const q=give('consumable:4003',3);open(q,'consumable:4003',{count:3});assert.equal(q.devilFruit.shards[3],30);
 const s=give('consumable:111');const [shard]=open(s,'consumable:111');assert.equal(shard.quantity,5);assert.equal(s.devilFruit.shards[shard.id],5);
});

test('pet bags give a pet, pet shard chests give 10 shards of the named pet',()=>{
 const p=give('consumable:3007');const [pet]=open(p,'consumable:3007');assert.equal(pet.kind,'pet');
 assert.ok([30,31,33].includes(pet.id),'Rồng Lục, Rồng Vàng, Khủng Long 3 Sừng');assert.equal(p.pets.list.length,1);assert.equal(p.pets.list[0].setId,pet.id);
 const q=give('consumable:600857',2);open(q,'consumable:600857',{count:2});assert.equal(q.pets.shards[63],20,'Laboon');
 const r=give('consumable:3006');const [s]=open(r,'consumable:3006');assert.equal(s.kind,'petShard');assert.equal(s.quantity,10);
 assert.equal(petData.pets.find(x=>x.id===s.id).rank,6);
});

test('special avatar chest unlocks the avatar once',()=>{
 const p=give('consumable:11005',2);
 const [a]=open(p,'consumable:11005');assert.equal(a.kind,'avatar');assert.ok(a.fresh);assert.deepEqual(p.avatars,[1005]);
 const [b]=open(p,'consumable:11005');assert.equal(b.fresh,false);assert.deepEqual(p.avatars,[1005]);
 applyAction(p,'profile-update',{op:'avatar',kind:'special',id:1005});assert.deepEqual(p.avatar,{kind:'special',id:1005});
});

test('hero shard choice chest gives 50 shards of the picked hero',()=>{
 const id='consumable:600638',p=give(id);const chest=chestData[id];assert.equal(chest.mode,'choice');
 const [r]=open(p,id,{index:1});assert.match(r.itemId,/^heroshard:/);assert.equal(p.inventory[r.itemId],50);
});
