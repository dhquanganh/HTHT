import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView,isRewardId} from '../server/game.mjs';
import {keyItem,impelConfig,applyImpelConfig,validateImpelConfig,defaultImpelConfig,tileCount} from '../server/impeldown.mjs';

const now=Date.UTC(2026,10,15,5);
const player=()=>{const p=starterPlayer('Impel');p.wallet.diamonds=1e6;p.inventory[keyItem]=1000;return p};

test('mặc định: 7 tầng, mỗi tầng 35 ô quà + 1 cửa, cấu hình hợp lệ',()=>{
 const c=defaultImpelConfig();assert.equal(c.floors.length,7);
 for(const f of c.floors)assert.equal(f.prizes.reduce((n,x)=>n+x.count,0),tileCount-1);
 assert.deepEqual(validateImpelConfig(c,isRewardId),c);
});

test('lật ô: tốn chìa theo tầng, quà không vượt giới hạn kho, đủ 36 ô thì có đúng 1 cửa và mở tầng 2',()=>{
 const p=player(),gold=p.wallet.gold;
 assert.throws(()=>applyAction(p,'impel-open',{floor:2,index:0},now),/Tầng chưa mở/);
 for(let i=0;i<tileCount;i++)applyAction(p,'impel-open',{floor:1,index:i},now);
 assert.equal(p.inventory[keyItem],1000-tileCount*impelConfig().floors[0].keyCost+(2+1));// quà cửa tầng 1: 3 chìa
 const v=playerView(p,now).impelDown,f=v.floors[0];
 assert.equal(f.tiles.filter(t=>t===0).length,1);assert.ok(f.tiles.every(t=>t!==null));
 for(const x of f.prizes)assert.equal(x.taken,x.count);
 assert.equal(v.maxFloor,2);assert.equal(v.opened,36);assert.ok(p.wallet.gold>gold);
 assert.throws(()=>applyAction(p,'impel-open',{floor:1,index:0},now),/Ô đã mở/);
 applyAction(p,'impel-floor',{floor:2},now);assert.equal(playerView(p,now).impelDown.current,2);
});

test('quà đạt mốc: chưa đủ / nhận được / đã nhận',()=>{
 const p=player();assert.throws(()=>applyAction(p,'impel-claim',{id:1},now),/Chưa đủ/);
 for(let i=0;i<10;i++)applyAction(p,'impel-open',{floor:1,index:i},now);
 assert.equal(playerView(p,now).impelDown.achievements[0].status,1);
 applyAction(p,'impel-claim',{id:1},now);assert.equal(playerView(p,now).impelDown.achievements[0].status,2);
 assert.throws(()=>applyAction(p,'impel-claim',{id:1},now),/Đã nhận/);
});

test('chìa: tặng một lần mỗi ngày, mua bằng kim cương có giới hạn ngày',()=>{
 const p=player(),keys=p.inventory[keyItem];
 applyAction(p,'impel-enter',{},now);applyAction(p,'impel-enter',{},now);assert.equal(p.inventory[keyItem],keys+5);
 applyAction(p,'impel-enter',{},now+86400000);assert.equal(p.inventory[keyItem],keys+10);
 const d=p.wallet.diamonds;applyAction(p,'impel-buy',{count:20},now);assert.equal(d-p.wallet.diamonds,1000);
 assert.throws(()=>applyAction(p,'impel-buy',{count:1},now),/chỉ mua thêm được 0/);
 p.inventory[keyItem]=0;assert.throws(()=>applyAction(p,'impel-open',{floor:1,index:0},now),/Không đủ/);
});

test('quản trị: tổng ô quà phải 35; đổi mùa thì người chơi làm lại từ đầu',()=>{
 const bad=defaultImpelConfig();bad.floors[0].prizes[0].count++;assert.throws(()=>validateImpelConfig(bad,isRewardId),/35/);
 const p=player();applyAction(p,'impel-open',{floor:1,index:0},now);assert.equal(playerView(p,now).impelDown.opened,1);
 try{applyImpelConfig(validateImpelConfig({...defaultImpelConfig(),season:2},isRewardId));assert.equal(playerView(p,now).impelDown.opened,0)}
 finally{applyImpelConfig(null)}
});
