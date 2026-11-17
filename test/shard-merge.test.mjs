import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,starterPlayer} from '../server/game.mjs';
import {itemById,heroAlbum} from '../server/catalog.mjs';
import {mergePoolOf} from '../server/summon.mjs';

const album=avatar=>heroAlbum.heroes.find(h=>h.avatar===avatar);
const randomShards=[...itemById.values()].filter(i=>i.mergePool);

test('every random hero shard merges 50 pieces and has heroes to roll',()=>{
 assert.equal(randomShards.length,21);
 for(const i of randomShards){assert.equal(i.merge,50,i.id);assert.ok(mergePoolOf(i.mergePool).length>0,i.name)}
 assert.deepEqual(itemById.get('shard:40015').mergePool,{rank:6,factions:['dark','light']});
 assert.deepEqual(itemById.get('shard:40014').mergePool.factions,['fortress','abyss','forest','shadow']);
 assert.deepEqual(itemById.get('shard:40008').mergePool,{rank:6,factions:['abyss']});
 assert.deepEqual(itemById.get('shard:40007').mergePool.rank,5);
});

test('50 SS L2 shards become one rare-faction SS hero; duplicates turn into hero shards',()=>{
 const p=starterPlayer('Captain');p.inventory['shard:40015']=1000;
 const r=applyAction(p,'shard-merge',{itemId:'shard:40015'});
 assert.equal(p.inventory['shard:40015'],950);
 const h=album(r.hero.avatar);assert.equal(h.rank,6);assert.ok(['dark','light'].includes(h.faction),h.faction);
 assert.equal(r.heroes.length,1);assert.ok(r.hero.fresh);
 // x10: tốn 500 mảnh, 10 kết quả đúng bể.
 const ten=applyAction(p,'shard-merge',{itemId:'shard:40015',count:10});
 assert.equal(p.inventory['shard:40015'],450);assert.equal(ten.heroes.length,10);
 for(const g of ten.heroes){const a=album(g.avatar);assert.equal(a.rank,6);assert.ok(['dark','light'].includes(a.faction));if(!g.fresh)assert.ok(g.shardItem&&g.shards>0)}
 assert.throws(()=>applyAction(p,'shard-merge',{itemId:'shard:40015',count:10}),/Cần 500/);
});

test('faction shards roll only that faction; not enough shards is refused',()=>{
 const p=starterPlayer('Captain');p.inventory['shard:40002']=100;
 for(let i=0;i<2;i++){const r=applyAction(p,'shard-merge',{itemId:'shard:40002'});const a=album(r.hero.avatar);assert.equal(a.rank,5);assert.equal(a.faction,'shadow')}
 assert.throws(()=>applyAction(p,'shard-merge',{itemId:'shard:40002'}),/Cần 50/);
 // Hệ hiếm không có tướng S: rơi về bậc gần nhất của đúng hệ.
 p.inventory['shard:40005']=50;const r=applyAction(p,'shard-merge',{itemId:'shard:40005'});assert.equal(album(r.hero.avatar).faction,'dark');
});
