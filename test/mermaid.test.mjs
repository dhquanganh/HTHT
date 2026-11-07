import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,heroStats,playerView} from '../server/game.mjs';
import {pictures,albumFee,albumMaterial} from '../server/album.mjs';
import {heroDefinitions} from '../server/catalog.mjs';
import {newHero} from '../server/hero-roster.mjs';
import {questsOf,stageFaction,abyssBuyPrice,seasonEnds,stageEnemies} from '../server/abyss.mjs';

const now=Date.UTC(2026,10,9,5);
const captain=level=>{const p=starterPlayer('Captain');p.account.level=level;return p};

test('db_album has 14 albums and Rebeca 1-1 is a 2x2 picture giving the team 64000 HP',()=>{
 assert.equal(pictures.length,120);assert.equal(new Set(pictures.map(p=>p.album)).size,14);
 const rebeca=pictures[0];assert.deepEqual([rebeca.name,rebeca.rows,rebeca.cols,rebeca.requireLevel],['Rebeca',2,2,80]);assert.deepEqual(rebeca.points,[[2,64000]]);
 assert.equal(albumMaterial,'consumable:100045');assert.equal(albumFee,50);
});
test('rolling costs 50 Thẻ huyền bí, opens a new piece each time, pays the half milestone and completes the picture',()=>{
 const p=captain(80);p.inventory[albumMaterial]=200;const before=heroStats(p).maxHp;
 const first=applyAction(p,'album-roll',{album:1,image:1},now);assert.equal(p.inventory[albumMaterial],150);assert.equal(p.album.pieces['1-1'].length,1);assert.equal(first.rewards.length,0);
 const second=applyAction(p,'album-roll',{album:1,image:1},now);assert.deepEqual(second.rewards,[{itemId:albumMaterial,quantity:100}],'Half of 4 pieces pays 100 cards');
 applyAction(p,'album-roll',{album:1,image:1},now);const last=applyAction(p,'album-roll',{album:1,image:1},now);
 assert.equal(last.complete,true);assert.deepEqual(p.album.pieces['1-1'],[0,1,2,3]);assert.equal(p.inventory[albumMaterial],100);
 assert.ok(heroStats(p).maxHp>=before+64000,'A finished picture adds its points to every hero');
 assert.throws(()=>applyAction(p,'album-roll',{album:1,image:1},now),/đủ mảnh/);
 const view=playerView(p,now).albumState;assert.deepEqual(view.totals,[[2,64000]]);assert.equal(view.pictures[0].complete,true);
});
test('pictures stay locked until the required picture and level',()=>{
 const p=captain(79);p.inventory[albumMaterial]=500;
 assert.throws(()=>applyAction(p,'album-roll',{album:1,image:1},now),/lv80/);
 p.account.level=90;assert.throws(()=>applyAction(p,'album-roll',{album:1,image:2},now),/Album 1-1/);
});
test('not enough cards blocks a roll',()=>{const p=captain(80);assert.throws(()=>applyAction(p,'album-roll',{album:1,image:1},now),/Không đủ/)});

const win=(p,stage,formation)=>{
 applyAction(p,'abyss-start',{stage,formation},now);for(const e of p.battle.enemies)e.hp=1;for(const a of p.battle.allies){a.attack=a.baseAttack=1e7;a.speed=a.baseSpeed=1e6;a.hp=a.maxHp=1e9}
 let n=0;while(p.battle.status==='active'&&n++<60)applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},now);
 return p.battle;
};
test('Vực thẳm has 20 stages with three quests each and the next stage opens after a win',()=>{
 const p=captain(50),view=playerView(p,now).abyss;
 assert.equal(view.stages.length,20);assert.equal(view.maxStars,60);assert.equal(view.stages[0].quests.length,3);assert.match(view.stages[0].quests[1].text,/Thắng với ít nhất 2 tướng hệ Sinh Khí/);
 assert.equal(view.stages[1].unlocked,false);assert.throws(()=>applyAction(p,'abyss-start',{stage:2},now),/mở khóa/);
 const b=win(p,1,[p.hero.id,null,null,null,null,null]);assert.equal(b.status,'won');
 const after=playerView(p,now).abyss;assert.equal(after.stars,1,'Luffy alone only clears the win quest');assert.deepEqual(after.stages[0].quests.map(q=>q.status),[1,0,0]);assert.equal(after.stages[1].unlocked,true);assert.equal(after.stages[0].turns,2);
 const gold=p.wallet.gold;applyAction(p,'abyss-claim',{stage:1,quest:0},now);assert.equal(p.wallet.gold,gold+questsOf(1)[0].rewards[0].quantity);
 assert.throws(()=>applyAction(p,'abyss-claim',{stage:1,quest:0},now),/Đã nhận/);assert.throws(()=>applyAction(p,'abyss-claim',{stage:1,quest:1},now),/Hoàn thành/);
});
test('faction quests count heroes of the stage faction in the team',()=>{
 const p=captain(50);p.reserveHeroes??={};const faction=stageFaction(1),team=heroDefinitions.filter(d=>d.faction===faction).slice(0,3);
 for(const d of team)p.reserveHeroes[d.id]=newHero(d);
 const b=win(p,1,[p.hero.id,...team.map(d=>d.id),null,null]);assert.equal(b.status,'won');
 assert.deepEqual(playerView(p,now).abyss.stages[0].quests.map(q=>q.status),[1,1,1],'Three heroes of the faction clear all three stars');
});
test('turns run out, can be bought with diamonds up to the limit, and reset with the season',()=>{
 const p=captain(50);for(let i=0;i<3;i++){applyAction(p,'abyss-start',{stage:1,formation:[p.hero.id,null,null,null,null,null]},now);applyAction(p,'battle-leave',{},now)}
 assert.throws(()=>applyAction(p,'abyss-start',{stage:1,formation:[p.hero.id,null,null,null,null,null]},now),/hết lượt/);
 const gems=p.wallet.diamonds;applyAction(p,'abyss-buy',{stage:1,count:2},now);assert.equal(p.wallet.diamonds,gems-2*abyssBuyPrice);assert.equal(playerView(p,now).abyss.stages[0].turns,2);
 assert.throws(()=>applyAction(p,'abyss-buy',{stage:1,count:4},now),/tối đa/);
 assert.equal(playerView(p,now+86400000).abyss.stages[0].turns,3,'Turns refill the next day');
 p.abyss.stages[0].quests=[2,1,1];assert.equal(playerView(p,seasonEnds(now)+1000).abyss.stars,0,'A new season starts over');
});
test('star milestones need the stars and pay the chosen option once',()=>{
 const p=captain(50);playerView(p,now);for(const s of p.abyss.stages.slice(0,4))s.quests=[1,1,1];
 assert.throws(()=>applyAction(p,'abyss-milestone',{stars:18,option:0},now),/Cần 18 sao/);
 const gems=p.wallet.diamonds;applyAction(p,'abyss-milestone',{stars:12,option:1},now);assert.equal(p.wallet.diamonds,gems+100);
 assert.throws(()=>applyAction(p,'abyss-milestone',{stars:12,option:0},now),/Đã nhận/);
});
test('Vực thẳm Ải 1 fields the original enemy team and every stage has six enemy heroes with two of its faction',()=>{
 const one=stageEnemies(1);
 assert.deepEqual(one.heroes.map(h=>h.name),['Killer','Zoro - S','Luffy - S','Califa','Akainu','Caesar']);
 assert.ok(one.heroes.every(h=>h.level===160&&h.stars===7));assert.equal(one.power,318338);
 for(let s=1;s<=20;s++){const e=stageEnemies(s);assert.equal(e.heroes.length,6);assert.ok(e.heroes.filter(h=>h.faction===stageFaction(s)).length>=2,'stage '+s)}
 const p=starterPlayer('abyss-enemy',now);p.account.level=90;applyAction(p,'abyss-start',{stage:1},now);
 assert.deepEqual(p.battle.enemies.map(e=>e.avatar),['92','69','109','182','143','123']);assert.deepEqual(p.battle.enemies.map(e=>e.position),[1,2,3,4,5,6]);
});
