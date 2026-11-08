import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,heroStats,playerView} from '../server/game.mjs';
import {germaData,heroShardPerHero} from '../server/germa.mjs';
import {grantSummon} from '../server/summon.mjs';
import {definitionFor} from '../server/catalog.mjs';

const player=()=>{const p=starterPlayer('Germa');p.wallet.gold=1e12;p.wallet.diamonds=1e6;p.account.level=200;for(const id of [200019,90,91,92])p.inventory['consumable:'+id]=1e8;p.inventory['heroshard:453']=1e5;grantSummon(p,{avatar:'453'});applyAction(p,'hero-select',{heroId:'hero-453'});return p};
const maxNode=(p,node)=>{const n=germaData.nodes[node-1],max=n.type==='level'?n.cost.length:1;while((p.hero.germa?.[node-1]??0)<max)applyAction(p,'germa-upgrade',{node})};

test('UpgradeVoid gốc: 16 nút, Công Kích 30/30 = Công +24914, Phòng Hộ = Máu +494550, Uy Lực 10/10 = Công +10068 Máu +199850',()=>{
 const n=germaData.nodes;assert.equal(n.length,16);assert.deepEqual(n.filter(x=>x.type==='skill').map(x=>x.node),[4,8,12,16]);
 assert.equal(n[0].name,'Công Kích');assert.deepEqual(n[0].buff.at(-1),{0:24914});assert.deepEqual(n[1].buff.at(-1),{2:494550});
 assert.equal(n[2].name,'Uy Lực');assert.deepEqual(n[2].buff.at(-1),{0:10068,2:199850});
 assert.equal(n[0].cost[0],4749);assert.equal(n[3].heroes,5);assert.deepEqual(n[7].item,{itemId:'consumable:90',quantity:6});
 assert.equal(Object.keys(germaData.heroes).length,109);
});

test('Germa mở từ L1, nâng nút chỉ số tốn Nước mắt Mansherry, mở dần từng nhánh, cộng chỉ số thẳng',()=>{
 const p=player();p.hero.stars=14;assert.throws(()=>applyAction(p,'germa-upgrade',{node:1}),/L1/);
 p.hero.stars=15;const before=heroStats(p),tears=p.inventory['consumable:200019'];
 applyAction(p,'germa-upgrade',{node:1});assert.equal(tears-p.inventory['consumable:200019'],4749);
 assert.equal(heroStats(p).attack-before.attack,100);
 assert.throws(()=>applyAction(p,'germa-upgrade',{node:4}),/mở nút/,'nút kỹ năng khóa tới khi 3 nút đầu tối đa');
 maxNode(p,1);maxNode(p,2);assert.equal(p.hero.germa[3],-1);maxNode(p,3);assert.equal(p.hero.germa[3],0);
 const s=heroStats(p);assert.equal(s.attack-before.attack,24914+10068);assert.ok(s.maxHp-before.maxHp>=494550+199850,'Máu cộng thẳng rồi mới nhân Haki');
});

test('Nút kỹ năng: tướng 10 sao đổi thành mảnh, Công nghệ Germa, kích hoạt kỹ năng cấp 4 và mở nhánh sau; thiết lập lại hoàn trả',()=>{
 const p=player();p.hero.stars=15;for(const n of [1,2,3])maxNode(p,n);
 const shards=p.inventory['heroshard:453'];applyAction(p,'germa-upgrade',{node:4});
 assert.equal(shards-p.inventory['heroshard:453'],5*heroShardPerHero);assert.deepEqual(p.hero.germa.slice(3,7),[1,0,0,0]);
 const view=playerView(p).hero.germa;assert.equal(view.skills.length,1);assert.equal(view.skills[0].level,4);
 const tears=p.inventory['consumable:200019'],gems=p.wallet.diamonds;const r=applyAction(p,'germa-reset',{});
 assert.equal(gems-p.wallet.diamonds,100);assert.ok(p.inventory['consumable:200019']>tears);assert.deepEqual(p.hero.germa.slice(0,4),[0,0,0,-1]);assert.ok(r.rewards.length>=2);
});

test('Tướng không có trong UpgradeVoidSkillData không có Ép Sao',()=>{const q=starterPlayer('X');q.hero.stars=15;q.inventory['consumable:200019']=1e6;assert.throws(()=>applyAction(q,'germa-upgrade',{node:1}),/chưa có Ép Sao/);assert.equal(playerView(q).hero.germa,null)});

test('Kỹ năng Germa thay bộ kỹ năng trận đấu của tướng triệu hồi',()=>{
 const p=player();const h=p.hero;
 h.stars=15;p.inventory['heroshard:453']=1e4;for(const n of [1,2,3])maxNode(p,n);applyAction(p,'germa-upgrade',{node:4});
 const skill=germaData.heroes[definitionFor('hero-453').avatar].skills[0];assert.equal(playerView(p).hero.germa.skills[0].name,skill.name);
});
