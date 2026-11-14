import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {lucThucReduction,lucThucConfig,setupLucThuc} from '../server/luc-thuc.mjs';
import {simulate} from '../server/arena.mjs';
import {starterPlayer,teamUnits} from '../server/game.mjs';
import {albumLucThuc,pictures} from '../server/album.mjs';
import {initializeTeamBattle,teamRound} from '../server/team-combat.mjs';
afterEach(()=>{lucThucConfig.perPercent=1000000});
const unit=(id,side,position,o={})=>({id,side,position,frontRow:side==='ally'?position<2:position>=4,name:id,maxHp:1e7,hp:1e7,attack:1000,defense:50,speed:100+position,energy:0,skills:{},...o});
test('reduction: difference / perPercent %, capped at 70%, only for the higher side',()=>{
 assert.equal(lucThucReduction(10e6,0),.1);assert.equal(lucThucReduction(0,10e6),0);assert.equal(lucThucReduction(500e6,0),.7);
 lucThucConfig.perPercent=500000;assert.equal(lucThucReduction(10e6,0),.2);
});
test('album pictures with Lục thức give every hero that amount',()=>{
 const p=starterPlayer('L');p.account.level=999;const pic=pictures.find(x=>x.points.some(([id])=>id===97));
 p.album={pieces:{[`${pic.album}-${pic.image}`]:Array.from({length:pic.rows*pic.cols},(_,i)=>i)},bonus:{}};
 const v=pic.points.find(([id])=>id===97)[1];assert.equal(albumLucThuc(p),v);
 assert.ok(teamUnits(p,['luffy-gear-2','zoro-king-of-hell',null,null,null,null]).every(u=>u.lucThuc===v));
});
test('PvP battle: the side with more Lục thức takes less damage; PvE ignores it',()=>{
 const run=(pvp,luc)=>{const b={id:'t',status:'active',pvp,turn:1,seed:7,allies:[unit('a','ally',0,{lucThuc:luc})],enemies:[unit('e','enemy',4)],events:[]};initializeTeamBattle(b);
  const ev=teamRound(b,{action:'auto'});return{b,taken:ev.filter(e=>e.type==='damage'&&e.target==='a').reduce((n,e)=>n+e.amount,0)}};
 const base=run(true,0).taken,strong=run(true,30e6),pve=run(false,30e6);
 assert.ok(base>0);assert.deepEqual(strong.b.lucThuc.reduce,{ally:.3,enemy:0});assert.ok(Math.abs(strong.taken-base*.7)<=base*.02+2,`${strong.taken} vs ${base}`);
 assert.equal(pve.b.lucThuc,undefined);assert.equal(pve.taken,base);
});
