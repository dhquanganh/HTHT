// Giáng sinh / Sinh nhật (bundle `event_xmas`: PopupEventXmasBirthday + TabManagerEventXmas). Dữ liệu sự kiện gốc do server trả
// qua /events/type/12 nên luật được thiết kế lại theo giao diện gốc; mùa = tháng (giờ Việt Nam), quản trị sửa mọi số liệu.
//   * Quà tất (PanelEventXmaxGift): 4 chiếc tất (miễn phí / vàng / kim cương), mua một lần mỗi mùa rồi nhận quà mỗi ngày.
//   * Quà tích lũy (PanelEventXmasSanta, CellEventBirthDay): mốc theo số ngày nhận quà tất, số lần mở túi, số lần ước, Bông Tuyết.
//   * Điều ước (PanelEventXmasWish): chọn món muốn ước rồi mở hộp quà (tốn Bông Tuyết); có tỉ lệ ra đúng món đã ước.
//   * Túi kì diệu (PanelEventXmasPuppet: GroupBadge Bánh Gừng, SnowPlake, PuppetRedeem): mở túi bằng Bánh Gừng (nhận mỗi
//     ngày hoặc mua bằng kim cương), ra quà ngẫu nhiên và Bông Tuyết; đổi Bông Tuyết lấy quà (giới hạn mỗi mùa).
import {requireCondition,integer} from './errors.mjs';

export const snow='consumable:42',ginger='consumable:600663',sock='consumable:600666';
const DAY=86400000,VN=7*3600000;
const vnDate=now=>new Date(now+VN);
export const seasonOf=now=>{const d=vnDate(now);return d.getUTCFullYear()*12+d.getUTCMonth()};
export const seasonEnd=season=>Date.UTC(Math.floor(season/12),season%12+1,1)-VN;
export const dayOf=now=>Math.floor((now+VN)/DAY);
const it=(itemId,quantity)=>({itemId,quantity});

// Bật / tắt sự kiện (quản trị): tắt thì ẩn khỏi giao diện và từ chối mọi thao tác.
export const defaultXmasConfig=()=>({enabled:true,...baseXmasConfig()});
function baseXmasConfig(){
 return{minLevel:10,title:'Giáng Sinh - Sinh Nhật',dailyGinger:3,gingerPrice:20,gingerBuyLimit:20,wishCost:5,wishRate:150,wishLimit:50,
  socks:[{name:'Tất trắng',price:null,days:7,daily:[it('gold',20000),it(snow,2)]},{name:'Tất xanh',price:it('gold',300000),days:7,daily:[it('gold',60000),it(snow,5)]},
   {name:'Tất đỏ',price:it('diamonds',200),days:7,daily:[it('diamonds',40),it(snow,10)]},{name:'Tất vàng',price:it('diamonds',600),days:7,daily:[it('diamonds',120),it(ginger,3),it(snow,15)]}],
  bag:[[it('gold',30000),300],[it(snow,3),300],[it(snow,8),150],[it('diamonds',20),120],[it('consumable:4',1),60],[it('consumable:16',1),50],[it('diamonds',100),20]].map(([reward,weight])=>({reward,weight})),
  wishes:[it('diamonds',300),it('consumable:4',3),it('gold',1000000),it('consumable:600851',1),it('consumable:2027',1)],
  wishPool:[[it('gold',50000),400],[it(ginger,2),250],[it('diamonds',30),200],[it('consumable:16',1),150]].map(([reward,weight])=>({reward,weight})),
  milestones:[['sock',3,[it('gold',100000)]],['sock',7,[it('diamonds',150)]],['bag',20,[it(snow,30)]],['bag',60,[it('diamonds',200)]],['wish',10,[it('consumable:4',2)]],['wish',30,[it('consumable:600851',1)]],['snow',300,[it('diamonds',300)]]].map(([kind,need,rewards],i)=>({id:i+1,kind,need,rewards})),
  shop:[[it('diamonds',50),40,10],[it('consumable:4',1),60,5],[it('consumable:16',2),30,10],[it('consumable:600851',1),300,2],[it('gold',300000),20,10]].map(([reward,price,limit],i)=>({id:i+1,reward,price,limit}))};
}
let config=defaultXmasConfig();
export const xmasConfig=()=>config;
export function applyXmasConfig(c){config=c||defaultXmasConfig();return config}
const KINDS=['sock','bag','wish','snow'];
export const validateXmasConfig=(input,...rest)=>({enabled:input?.enabled!==false,...checkXmasConfig(input,...rest)});
function checkXmasConfig(input,isRewardId){
 requireCondition(input&&typeof input==='object','Thiếu cấu hình.');
 const n=(v,l,a,b)=>integer(v,a,b,l);
 const reward=(x,label)=>{requireCondition(typeof x?.itemId==='string'&&isRewardId(x.itemId),`${label}: vật phẩm không tồn tại.`,404);return it(x.itemId,n(x.quantity,`${label}: số lượng`,1,1e12))};
 const rewards=(list,label,min=1)=>{requireCondition(Array.isArray(list)&&list.length>=min&&list.length<=10,`${label}: cần ${min}-10 phần thưởng.`);return list.map(x=>reward(x,label))};
 const weighted=(list,label)=>{requireCondition(Array.isArray(list)&&list.length>=1&&list.length<=30,`${label}: cần 1-30 món.`);const out=list.map((x,i)=>({reward:reward(x.reward,`${label} ${i+1}`),weight:n(x.weight,`${label} ${i+1}: tỉ lệ`,0,1e6)}));requireCondition(out.some(x=>x.weight>0),`${label}: tỉ lệ phải lớn hơn 0.`);return out};
 requireCondition(Array.isArray(input.socks)&&input.socks.length===4,'Cần đúng 4 chiếc tất.');
 requireCondition(typeof input.title==='string'&&input.title.trim()&&input.title.length<=60,'Thiếu tên sự kiện.');
 requireCondition(Array.isArray(input.wishes)&&input.wishes.length>=1&&input.wishes.length<=12,'Điều ước: cần 1-12 món.');
 requireCondition(Array.isArray(input.milestones)&&input.milestones.length<=30,'Tối đa 30 mốc tích lũy.');requireCondition(Array.isArray(input.shop)&&input.shop.length<=30,'Tối đa 30 món đổi quà.');
 return{minLevel:n(input.minLevel,'Cấp tối thiểu',1,1000),title:input.title.trim(),dailyGinger:n(input.dailyGinger,'Bánh Gừng mỗi ngày',0,1000),gingerPrice:n(input.gingerPrice,'Giá Bánh Gừng',1,1e6),
  gingerBuyLimit:n(input.gingerBuyLimit,'Mua Bánh Gừng mỗi ngày',0,1e4),wishCost:n(input.wishCost,'Bông Tuyết mỗi lần ước',1,1e6),wishRate:n(input.wishRate,'Tỉ lệ ra món ước (‰)',0,1000),wishLimit:n(input.wishLimit,'Số lần ước mỗi mùa',1,1e5),
  socks:input.socks.map((s,i)=>{requireCondition(typeof s?.name==='string'&&s.name.trim()&&s.name.length<=30,`Tất ${i+1}: thiếu tên.`);return{name:s.name.trim(),price:s.price?reward(s.price,`Tất ${i+1}: giá`):null,days:n(s.days,`Tất ${i+1}: số ngày`,1,31),daily:rewards(s.daily,`Tất ${i+1}: quà mỗi ngày`)}}),
  bag:weighted(input.bag,'Túi kì diệu'),wishes:input.wishes.map((x,i)=>reward(x,`Điều ước ${i+1}`)),wishPool:weighted(input.wishPool,'Quà hộp ước'),
  milestones:input.milestones.map((m,i)=>{requireCondition(KINDS.includes(m.kind),`Mốc ${i+1}: loại không hợp lệ.`);return{id:i+1,kind:m.kind,need:n(m.need,`Mốc ${i+1}: mục tiêu`,1,1e9),rewards:rewards(m.rewards,`Mốc ${i+1}`)}}),
  shop:input.shop.map((s,i)=>({id:i+1,reward:reward(s.reward,`Đổi quà ${i+1}`),price:n(s.price,`Đổi quà ${i+1}: giá`,1,1e9),limit:n(s.limit,`Đổi quà ${i+1}: giới hạn`,1,1e6)}))};
}

export function xmasState(p,now){
 const season=seasonOf(now),fresh={season,socks:[null,null,null,null],count:{sock:0,bag:0,wish:0,snow:0},claimed:[],bought:{},wish:null,gingerDay:0,buyDay:0,bought_today:0};
 const s=p.xmas??=fresh;if(s.season!==season)Object.assign(s,fresh);return s;
}
const roll=(list,random)=>{const total=list.reduce((n,x)=>n+x.weight,0);let r=random()*total;for(const x of list){r-=x.weight;if(r<0)return x.reward}return list.at(-1).reward};
function sockView(s,i,now){const b=s.socks[i];if(!b)return{bought:false};const day=dayOf(now),idx=day-b.day;return{bought:true,received:b.got.length,total:config.socks[i].days,today:idx<config.socks[i].days&&!b.got.includes(idx),done:b.got.length>=config.socks[i].days||idx>=config.socks[i].days}}
export function xmasView(p,now){
 const s=xmasState(p,now),c=config,day=dayOf(now);
 return{minLevel:c.minLevel,title:c.title,season:s.season,endsAt:seasonEnd(s.season),dailyGinger:c.dailyGinger,gingerReady:c.dailyGinger>0&&s.gingerDay!==day,gingerPrice:c.gingerPrice,gingerLeft:Math.max(0,c.gingerBuyLimit-(s.buyDay===day?s.bought_today:0)),
  socks:c.socks.map((x,i)=>({...x,...sockView(s,i,now)})),count:s.count,
  milestones:c.milestones.map(m=>({...m,have:s.count[m.kind]||0,status:s.claimed.includes(m.id)?2:(s.count[m.kind]||0)>=m.need?1:0})),
  bag:c.bag,wishes:c.wishes,wish:s.wish,wishCost:c.wishCost,wishRate:c.wishRate,wishLeft:Math.max(0,c.wishLimit-s.count.wish),wishPool:c.wishPool,
  shop:c.shop.map(x=>({...x,bought:s.bought[x.id]||0}))};
}
/** ctx: {now, level, random, spend(cost), grant(reward)} */
export function xmasAction(p,action,input,ctx){
 const s=xmasState(p,ctx.now),c=config,random=ctx.random||Math.random,day=dayOf(ctx.now);
 requireCondition(ctx.level>=c.minLevel,`Yêu cầu người chơi cấp độ ${c.minLevel} trở lên.`,403,'XMAS_LEVEL');
 const give=list=>{for(const r of list){ctx.grant({...r});if(r.itemId===snow)s.count.snow+=r.quantity}return list};
 if(action==='xmas-sock-buy'){
  const i=integer(input?.index,0,3,'Tất'),x=c.socks[i];requireCondition(!s.socks[i],'Đã nhận chiếc tất này.',409);if(x.price)ctx.spend(x.price);
  s.socks[i]={day,got:[]};return{message:`Đã treo ${x.name}.`};
 }
 if(action==='xmas-sock-claim'){
  const i=integer(input?.index,0,3,'Tất'),b=s.socks[i],x=c.socks[i];requireCondition(b,'Chưa có chiếc tất này.',409);
  const idx=day-b.day;requireCondition(idx<x.days,'Chiếc tất đã hết hạn.',409);requireCondition(!b.got.includes(idx),'Hôm nay đã nhận quà tất này.',409);
  b.got.push(idx);s.count.sock++;return{message:'Nhận quà tất.',rewards:give(x.daily)};
 }
 if(action==='xmas-ginger'){requireCondition(c.dailyGinger>0&&s.gingerDay!==day,'Hôm nay đã nhận.',409);s.gingerDay=day;return{message:'Nhận Bánh Gừng.',rewards:give([it(ginger,c.dailyGinger)])}}
 if(action==='xmas-ginger-buy'){
  const count=integer(input?.count??1,1,1000,'Số lượng');if(s.buyDay!==day){s.buyDay=day;s.bought_today=0}
  requireCondition(s.bought_today+count<=c.gingerBuyLimit,`Hôm nay chỉ mua thêm được ${Math.max(0,c.gingerBuyLimit-s.bought_today)} Bánh Gừng.`,409,'XMAS_BUY_LIMIT');
  ctx.spend(it('diamonds',c.gingerPrice*count));s.bought_today+=count;return{message:'Mua Bánh Gừng.',rewards:give([it(ginger,count)])};
 }
 if(action==='xmas-bag'){
  const count=[1,10].includes(Number(input?.count))?Number(input.count):1;ctx.spend(it(ginger,count));
  const got=[];for(let k=0;k<count;k++)got.push(roll(c.bag,random));s.count.bag+=count;return{message:`Mở ${count} Túi kì diệu.`,rewards:give(merge(got))};
 }
 if(action==='xmas-wish-set'){const k=integer(input?.index,0,c.wishes.length-1,'Điều ước');s.wish=k;return{message:'Đã chọn điều ước.'}}
 if(action==='xmas-wish'){
  requireCondition(s.wish!==null&&c.wishes[s.wish],'Hãy chọn điều ước trước.',409,'XMAS_NO_WISH');
  const count=[1,10].includes(Number(input?.count))?Number(input.count):1;requireCondition(s.count.wish+count<=c.wishLimit,`Mùa này chỉ còn ${Math.max(0,c.wishLimit-s.count.wish)} lần ước.`,409,'XMAS_WISH_LIMIT');
  ctx.spend(it(snow,c.wishCost*count));const got=[];let hit=0;
  for(let k=0;k<count;k++){if(random()*1000<c.wishRate){got.push(c.wishes[s.wish]);hit++}else got.push(roll(c.wishPool,random))}
  s.count.wish+=count;return{message:hit?`Điều ước thành hiện thực ${hit} lần!`:`Mở ${count} hộp quà.`,hit,rewards:give(merge(got))};
 }
 if(action==='xmas-milestone'){
  const m=c.milestones.find(x=>x.id===Number(input?.id));requireCondition(m,'Mốc không tồn tại.',404);requireCondition(!s.claimed.includes(m.id),'Đã nhận quà mốc này.',409);
  requireCondition((s.count[m.kind]||0)>=m.need,'Chưa đủ điều kiện.',409);s.claimed.push(m.id);return{message:'Nhận quà tích lũy.',rewards:give(m.rewards)};
 }
 if(action==='xmas-shop'){
  const x=c.shop.find(y=>y.id===Number(input?.id)),count=integer(input?.count??1,1,1000,'Số lượng');requireCondition(x,'Vật phẩm không tồn tại.',404);
  const used=s.bought[x.id]||0;requireCondition(used+count<=x.limit,`Chỉ đổi thêm được ${Math.max(0,x.limit-used)} lần.`,409,'XMAS_SHOP_LIMIT');
  ctx.spend(it(snow,x.price*count));s.bought[x.id]=used+count;const r={...x.reward,quantity:x.reward.quantity*count};ctx.grant(r);return{message:'Đổi quà thành công.',rewards:[r]};
 }
 requireCondition(false,'Hành động sự kiện Giáng Sinh không hợp lệ.');
}
function merge(list){const m=new Map();for(const r of list)m.set(r.itemId,(m.get(r.itemId)||0)+r.quantity);return[...m].map(([itemId,quantity])=>it(itemId,quantity))}
