import test from 'node:test';import assert from 'node:assert/strict';
import {validateHero,applyCustomHeroes,customHeroFile,compilePreview} from '../server/custom-heroes.mjs';
import {heroDefinitions,heroKits,itemById,publicCatalog} from '../server/catalog.mjs';
const A='a'.repeat(24),B='b'.repeat(24);
const input={name:'Thử',faction:'fortress',class:'warrior',rank:5,summon:true,images:{head:A,thumb:A},stats:{attack:1,defense:1,maxHp:1,speed:1},
 skills:[{name:'Nộ',icon:'skillicon-660',levels:['Tấn công 3 kẻ địch hàng sau gây sát thương 300% Công.']},{name:'BĐ',icon:'skillicon-661',levels:['Tăng bản thân 30% Công, 30% Máu, 100 Tốc Độ.']}],
 anim:{sheets:[{art:B,w:200,h:100}],frames:[{id:1,s:0,x:0,y:0,w:50,h:90,ax:25,ay:90},{id:2,s:0,x:60,y:0,w:50,h:90,ax:85,ay:90}],scale:1,animations:{idling:{fps:8,frames:[{f:1},{f:2}]},beat:{fps:10,frames:[{f:1},{f:2,d:2}],hit:1}},effects:[{name:'Nổ',frames:[{f:2}]}],attack:{impact:0},skill:{cast:0}}};
test('custom hero validates, registers and serves Spine files',()=>{
 const c=validateHero(input,new Set([A,B]),'90001');
 assert.equal(c.skills[0].levels[3].startsWith('Nộ: '),true);
 const errors=applyCustomHeroes([{_id:'90001',rev:2,...c}]);assert.deepEqual(errors,[]);
 const d=heroDefinitions.find(h=>h.id==='hero-90001');assert.ok(d&&heroKits.get('hero-90001')&&itemById.get('heroshard:90001'));
 assert.equal(d.visual.skeleton.skeleton.src,'/custom-hero/90001/2/body.json');
 const json=JSON.parse(customHeroFile('90001',2,'body.json').body);assert.ok(json.animations.idling&&json.animations.skill);
 assert.match(customHeroFile('90001',2,'fx0.atlas').body,/f2/);assert.equal(customHeroFile('90001',1,'body.json'),null);
 assert.ok(publicCatalog().customHeroes.effects.heroes['90001'].attack.impact.length);
 applyCustomHeroes([]);assert.ok(!heroDefinitions.some(h=>h.custom));
});
test('skill preview parses sample sentence',()=>{assert.ok(compilePreview({description:'Tấn công toàn bộ kẻ địch gây sát thương 200% Công, 50% tỉ lệ gây Choáng duy trì 2 lượt.'}).effects.some(e=>e.type==='status'))});
