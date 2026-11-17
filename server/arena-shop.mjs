// Cửa hàng Lệnh bài võ đấu (tab "Đấu trường" của PopupShop gốc, ô tiền FieldArenaCoin):
// đổi Lệnh bài võ đấu (consumable:40, nhận từ Võ đấu / cược) lấy vật phẩm, mỗi món có giới hạn lượt đổi theo kỳ.
// Kỳ làm mới lượt đổi: 'day' (0:00 giờ Việt Nam) | 'week' (0:00 thứ Hai) | 'never' (giới hạn trọn đời).
// Danh mục do trang quản trị sửa (arena_shop_config); bản mặc định dưới đây là số tự đặt.
import {requireCondition,integer} from './errors.mjs';

export const arenaToken='consumable:40';
const it=(itemId,quantity)=>({itemId,quantity});
const offer=(id,reward,price,limit)=>({id,reward,price,limit});
export const defaultArenaShopConfig=()=>({enabled:true,reset:'week',offers:[
 offer('gold',it('gold',200000),200,10),
 offer('exp-stone',it('consumable:1',100),200,10),
 offer('enhance',it('consumable:2',500),300,10),
 offer('dust',it('consumable:3',1000),300,10),
 offer('challenge',it('consumable:4',5),400,5),
 offer('barrel',it('consumable:16',1),500,5),
 offer('diamonds',it('diamonds',100),800,5),
 offer('soul-chest',it('consumable:178',1),1500,3),
 offer('rank-s',it('consumable:2026',1),3000,1),
 offer('rank-ss',it('consumable:2027',1),8000,1),
 offer('artifact-red',it('consumable:58',1),15000,1),
 offer('hero-ss',it('consumable:53',1),20000,1),
]});
let config=defaultArenaShopConfig();
export const arenaShopConfig=()=>structuredClone(config);
export function applyArenaShopConfig(input){config=input?structuredClone(input):defaultArenaShopConfig()}

const resets=['day','week','never'];
/** Kiểm tra cấu hình từ trang quản trị: 1–60 món, id không trùng, quà là vật phẩm có thật, giá (lệnh bài) ≥ 1, giới hạn 0–9999 (0 = không giới hạn). */
export function validateArenaShopConfig(input,isRewardId){
 requireCondition(input&&typeof input==='object','Dữ liệu không hợp lệ.');
 requireCondition(resets.includes(input.reset),'Kỳ làm mới không hợp lệ.');
 requireCondition(Array.isArray(input.offers)&&input.offers.length>=1&&input.offers.length<=60,'Cửa hàng cần từ 1 đến 60 món.');
 const seen=new Set();
 const offers=input.offers.map((o,i)=>{
  const id=typeof o?.id==='string'&&/^[a-z0-9-]{1,32}$/.test(o.id)?o.id:`item-${i+1}`;
  requireCondition(!seen.has(id),`Món ${i+1}: mã bị trùng.`);seen.add(id);
  const itemId=o?.reward?.itemId;requireCondition(typeof itemId==='string'&&isRewardId(itemId),`Món ${i+1}: vật phẩm không tồn tại.`,404);
  return offer(id,it(itemId,integer(o.reward.quantity,1,1e12,`Món ${i+1}: số lượng`)),integer(o.price,1,1e9,`Món ${i+1}: giá lệnh bài`),integer(o.limit,0,9999,`Món ${i+1}: giới hạn`));
 });
 return{enabled:input.enabled!==false,reset:input.reset,offers};
}

const DAY=86400000,vn=now=>now+7*3600000;
const periodKey=now=>config.reset==='never'?'never':config.reset==='day'?'d'+Math.floor(vn(now)/DAY):'w'+Math.floor((Math.floor(vn(now)/DAY)+3)/7);
function periodEnd(now){
 if(config.reset==='never')return null;
 const day=Math.floor(vn(now)/DAY);
 if(config.reset==='day')return(day+1)*DAY-7*3600000;
 // Ngày 0 (1970-01-01) là thứ Năm → thứ Hai kế tiếp: (ngày+3) chia 7.
 return((Math.floor((day+3)/7)+1)*7-3)*DAY-7*3600000;
}
function state(p,now){
 const key=periodKey(now);
 if(p.arenaShop?.period!==key)p.arenaShop={period:key,bought:{}};
 return p.arenaShop;
}
export function arenaShopView(p,now=Date.now()){
 const s=p.arenaShop?.period===periodKey(now)?p.arenaShop:{bought:{}};
 return{enabled:config.enabled!==false,reset:config.reset,resetAt:periodEnd(now),token:arenaToken,
  offers:config.offers.map(o=>({...o,bought:s.bought[o.id]||0}))};
}
/** op 'arena-buy' {id, count}: trả lệnh bài (ctx.pay), nhận quà (ctx.grant). */
export function arenaShopBuy(p,input,ctx,now=Date.now()){
 requireCondition(config.enabled!==false,'Cửa hàng Đấu trường đang đóng.',409,'SHOP_CLOSED');
 const o=config.offers.find(x=>x.id===input.id);requireCondition(o,'Vật phẩm không tồn tại.',404);
 const s=state(p,now),count=integer(input.count??1,1,99,'Số lượng'),used=s.bought[o.id]||0;
 requireCondition(!o.limit||used+count<=o.limit,'Đã hết lượt đổi món này.',409,'SHOP_SOLD');
 ctx.pay(it(arenaToken,o.price*count));
 const reward=it(o.reward.itemId,o.reward.quantity*count);ctx.grant(reward);s.bought[o.id]=used+count;
 return{message:'Đổi thành công.',rewards:[reward]};
}
