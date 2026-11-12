// Cửa hàng (PopupShop gốc, tab SHOP_MARKET "Chợ đen"): kệ hàng ngẫu nhiên, mỗi món mua 1 lần, làm mới miễn phí mỗi ngày
// hoặc làm mới ngay bằng kim cương (ButtonRefresh / TextCostRefresh, MSG_POPUP_SHOP_ASK_REFRESH_SHOP), đếm ngược
// "Làm mới sau" (GroupRefresh). Giá theo Beli (FieldGold) hoặc kim cương (FieldGem).
// Các tab khác dùng cửa hàng sẵn có của từng tính năng (Huyết tế: server/altar.mjs).
// Danh mục hàng / giá gốc nằm ở máy chủ nên do bản web đặt.
import {requireCondition} from './errors.mjs';
import {itemById} from './catalog.mjs';

const it=(itemId,quantity)=>({itemId,quantity});
const gold=n=>it('gold',n),gem=n=>it('diamonds',n);
const range=(prefix,a,b)=>Array.from({length:b-a+1},(_,i)=>prefix+(a+i));
const equipBy=rarity=>[...itemById.values()].filter(i=>i.category==='equipment'&&i.rarity===rarity).map(i=>i.id);
// [trọng số, danh sách id (chọn ngẫu nhiên 1), số lượng, giá]
// Bể hàng Chợ đen: [trọng số, id (chọn ngẫu nhiên 1), số lượng, giá] — sửa được ở trang quản trị.
export const marketPool=[
 [10,['consumable:1'],50,gold(50000)],
 [10,['consumable:2'],100,gold(60000)],
 [8,['consumable:3'],100,gold(80000)],
 [7,['material:skill-book'],5,gold(75000)],
 [6,['material:rank-stone'],3,gold(90000)],
 [8,equipBy('gray'),1,gold(20000)],
 [8,equipBy('green'),1,gold(50000)],
 [6,equipBy('blue'),1,gold(100000)],
 [5,range('artifact:',1,6),1,gold(120000)],
 [4,['consumable:17'],1,gold(150000)],
 [5,['consumable:16'],1,gem(90)],
 [6,['shard:10000'],10,gem(60)],
 [3,['shard:20000'],10,gem(150)],
 [4,['consumable:18'],1,gem(80)],
 [4,equipBy('purple'),1,gem(120)],
 [2,equipBy('yellow'),1,gem(250)],
 [3,range('artifact:',7,11),1,gem(200)],
 [4,['consumable:2'],500,gem(150)],
].filter(([,ids])=>ids.length&&ids.every(id=>itemById.has(id)));
// Cửa hàng Mê cung (SHOP_SEALEDLAND, FieldSealBookNormal / FieldSealBookDL): đổi Sách phong ấn, giới hạn mỗi ngày.
const book='material:seal-book',bookDL='material:seal-book-dl';
export const sealedShop=[
 ...[2020,2021,2022,2023,2024,2025].map(n=>({id:'book-'+n,reward:it('consumable:'+n,1),price:it(book,200),limit:3})),
 {id:'book-chest',reward:it('consumable:2031',1),price:it(book,500),limit:2},
 {id:'book-chest-pick',reward:it('consumable:2032',1),price:it(bookDL,3),limit:1},
 {id:'barrel',reward:it('consumable:16',1),price:it(book,300),limit:3},
 {id:'soul-chest',reward:it('consumable:178',1),price:it(bookDL,2),limit:2},
].filter(o=>itemById.has(o.reward.itemId));
export const shopConfig={slots:12,refreshBase:20,refreshStep:10,refreshMax:100};
const DAY=86400000,vnDay=now=>Math.floor((now+7*3600000)/DAY);
export const shopResetAt=now=>(vnDay(now)+1)*DAY-7*3600000;
const rng=s=>()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
const pool=marketPool;
export function rollShelf(seed){
 const r=rng(seed),total=pool.reduce((n,e)=>n+e[0],0);
 const used=new Set();
 // Mỗi món chỉ xuất hiện một lần trên kệ (thử lại tối đa 20 lần).
 return Array.from({length:shopConfig.slots},(_,slot)=>{let pick=null;
  for(let t=0;t<20&&!pick;t++){let x=r()*total,e=pool[0];for(const q of pool){x-=q[0];if(x<0){e=q;break}}const id=e[1][Math.floor(r()*e[1].length)];if(!used.has(id)||t===19)pick={id,e}}
  used.add(pick.id);return{slot,reward:it(pick.id,pick.e[2]),price:pick.e[3],bought:false}});
}
export const refreshCost=n=>Math.min(shopConfig.refreshMax,shopConfig.refreshBase+shopConfig.refreshStep*n);
export function shopState(p,now=Date.now()){
 const day=vnDay(now);
 if(p.shop?.day!==day)p.shop={day,refreshes:0,items:rollShelf(day*7919+(p.account?.level||1)),sealedBought:{}};
 p.shop.sealedBought??={};
 return p.shop;
}
export function shopView(p,now=Date.now()){const s=shopState(p,now);return{resetAt:shopResetAt(now),refreshCost:refreshCost(s.refreshes),items:s.items,sealed:sealedShop.map(o=>({...o,bought:s.sealedBought[o.id]||0}))}}
/** ctx: {pay(cost), grant(reward)}. op: buy {slot} | refresh */
export function shopAction(p,input,ctx,now=Date.now()){
 const s=shopState(p,now);
 if(input.op==='refresh'){ctx.pay(gem(refreshCost(s.refreshes)));s.refreshes++;s.items=rollShelf(s.day*7919+s.refreshes*104729+now%9973);return{message:'Đã làm mới cửa hàng.'}}
 if(input.op==='sealed-buy'){const o=sealedShop.find(x=>x.id===input.id);requireCondition(o,'Vật phẩm không tồn tại.',404);const n=s.sealedBought[o.id]||0;requireCondition(n<o.limit,'Đã hết lượt đổi hôm nay.',409,'SHOP_SOLD');ctx.pay(o.price);s.sealedBought[o.id]=n+1;ctx.grant(o.reward);return{message:'Đổi thành công.',rewards:[o.reward]}}
 requireCondition(input.op==='buy','Cửa hàng không bán vật phẩm này.',410,'SHOP_CLOSED');
 const o=s.items.find(x=>x.slot===Number(input.slot));requireCondition(o,'Vật phẩm không tồn tại.',404);requireCondition(!o.bought,'Đã mua vật phẩm này.',409,'SHOP_SOLD');
 ctx.pay(o.price);o.bought=true;ctx.grant(o.reward);return{message:'Mua thành công.',rewards:[o.reward]};
}
