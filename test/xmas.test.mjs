import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView,isRewardId} from '../server/game.mjs';
import {xmasConfig,defaultXmasConfig,validateXmasConfig,applyXmasConfig,snow,ginger,seasonOf,seasonEnd} from '../server/xmas.mjs';

const now=Date.UTC(2026,11,10,3),D=86400000;
const player=()=>{const p=starterPlayer('Xmas');p.account.level=30;p.wallet.diamonds=100000;p.wallet.gold=1e8;return p};
const view=(p,t=now)=>playerView(p,t).xmas;

test('cấu hình mặc định hợp lệ; mùa theo tháng giờ Việt Nam',()=>{
 const c=defaultXmasConfig();assert.deepEqual(validateXmasConfig(c,isRewardId),c);
 assert.throws(()=>validateXmasConfig({...c,socks:c.socks.slice(1)},isRewardId),/4 chiếc tất/);
 assert.throws(()=>validateXmasConfig({...c,bag:c.bag.map(x=>({...x,weight:0}))},isRewardId),/lớn hơn 0/);
 const s=seasonOf(now);assert.equal(seasonOf(seasonEnd(s)-1),s);assert.equal(seasonOf(seasonEnd(s)),s+1);
});

test('quà tất: mua một lần, nhận mỗi ngày trong số ngày quy định; tích lũy theo số ngày nhận',()=>{
 const p=player(),c=xmasConfig();
 applyAction(p,'xmas-sock-buy',{index:0},now);assert.throws(()=>applyAction(p,'xmas-sock-buy',{index:0},now),/Đã nhận/);
 const d=p.wallet.diamonds;applyAction(p,'xmas-sock-buy',{index:2},now);assert.equal(p.wallet.diamonds,d-c.socks[2].price.quantity);
 applyAction(p,'xmas-sock-claim',{index:0},now);assert.throws(()=>applyAction(p,'xmas-sock-claim',{index:0},now),/Hôm nay đã nhận/);
 for(let k=1;k<c.socks[0].days;k++)applyAction(p,'xmas-sock-claim',{index:0},now+k*D);
 assert.throws(()=>applyAction(p,'xmas-sock-claim',{index:0},now+c.socks[0].days*D),/hết hạn/);
 assert.equal(view(p,now+D).count.sock,c.socks[0].days);assert.ok(p.inventory[snow]>0);
 const m=view(p,now+D).milestones.find(x=>x.kind==='sock'&&x.status===1);applyAction(p,'xmas-milestone',{id:m.id},now+D);assert.throws(()=>applyAction(p,'xmas-milestone',{id:m.id},now+D),/Đã nhận/);
});

test('Bánh Gừng mỗi ngày / mua giới hạn; túi kì diệu; điều ước; đổi quà; mùa mới làm lại',()=>{
 const p=player(),c=xmasConfig();
 applyAction(p,'xmas-ginger',{},now);assert.equal(p.inventory[ginger],c.dailyGinger);assert.throws(()=>applyAction(p,'xmas-ginger',{},now),/đã nhận/);
 applyAction(p,'xmas-ginger-buy',{count:c.gingerBuyLimit},now);assert.throws(()=>applyAction(p,'xmas-ginger-buy',{count:1},now),/chỉ mua thêm/);
 applyAction(p,'xmas-bag',{count:10},now);assert.equal(view(p).count.bag,10);
 assert.throws(()=>applyAction(p,'xmas-wish',{count:1},now),/chọn điều ước/);
 applyAction(p,'xmas-wish-set',{index:0},now);p.inventory[snow]=(p.inventory[snow]||0)+c.wishCost*10;
 const r=applyAction(p,'xmas-wish',{count:10},now,{random:()=>0});assert.equal(view(p).count.wish,10);assert.ok(r.rewards.length);
 const x=c.shop[0];p.inventory[snow]=x.price*x.limit;applyAction(p,'xmas-shop',{id:x.id,count:x.limit},now);assert.throws(()=>applyAction(p,'xmas-shop',{id:x.id},now),/Chỉ đổi thêm được 0/);
 const next=Date.UTC(2027,0,5,3);assert.equal(view(p,next).count.bag,0);assert.equal(view(p,next).wish,null);
});

test('điều ước luôn ra đúng món khi tỉ lệ 100%',()=>{
 applyXmasConfig({...defaultXmasConfig(),wishRate:1000});
 try{const p=player();applyAction(p,'xmas-wish-set',{index:1},now);p.inventory[snow]=1000;const r=applyAction(p,'xmas-wish',{count:10},now);assert.equal(r.hit,10)}finally{applyXmasConfig(null)}
});

test('tắt sự kiện (quản trị): giao diện nhận enabled=false, mọi thao tác bị từ chối; bật lại thì chạy bình thường',()=>{
 applyXmasConfig({...defaultXmasConfig(),enabled:false});
 try{const p=player();assert.equal(view(p).enabled,false);assert.throws(()=>applyAction(p,'xmas-ginger',{},now),/tạm đóng/);
  assert.equal(validateXmasConfig({...defaultXmasConfig(),enabled:false},isRewardId).enabled,false);assert.equal(validateXmasConfig({...defaultXmasConfig(),enabled:undefined},isRewardId).enabled,true)}
 finally{applyXmasConfig(null)}
 const p=player();assert.equal(view(p).enabled,true);applyAction(p,'xmas-ginger',{},now);
});
