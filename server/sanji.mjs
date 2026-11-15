// Bữa tiệc Sanji (bundle `sanji_party`, EVENT_SANJI_STATUS 800 … EVENT_SANJI_CHEF_SKIP_COOLDOWN 807).
// Mùa theo tuần (giờ Việt Nam). Tặng 1 trong 3 món ngon (Pizza / Mì Ý / Lợn quay — Food.lua: phí tặng, số Thìa và Tim nhận,
// thời gian hồi): nhận Thìa (consumable:2141, tiền của cửa hàng Đầu Bếp) và Tim (điểm vui vẻ). Sau khi tặng, bếp phải chờ hồi
// (GiveFoodButton / TimeCoolDown) hoặc tăng tốc bằng kim cương (GemFee). Tim mở quà mốc (GiftBoardForUser) và xếp hạng
// (RankingPopUp); hết mùa, top nhận thưởng qua thư (GiftBoardForTop: hạng + điểm tối thiểu). Số liệu do server gốc cấp nên
// được đặt mặc định ở đây, quản trị sửa được (sanji_config).
import {requireCondition,integer} from './errors.mjs';

export const spoonItem='consumable:2141';
const DAY=86400000,HOUR=3600000,VN=7*HOUR,mondayEpoch=Date.UTC(2024,0,1);
export const seasonOf=now=>Math.floor((now+VN-mondayEpoch)/(7*DAY));
export const seasonEnd=season=>mondayEpoch+(season+1)*7*DAY-VN;
const it=(itemId,quantity)=>({itemId,quantity});

// Bật / tắt sự kiện (quản trị): tắt thì ẩn khỏi giao diện và từ chối mọi thao tác.
export const defaultSanjiConfig=()=>({enabled:true,...baseSanjiConfig()});
function baseSanjiConfig(){
 return{minLevel:15,skipPerHour:20,
  dishes:[{id:1,name:'Pizza',art:'pizza',fee:null,spoons:10,hearts:10,cooldownHours:1},
   {id:2,name:'Mì Ý',art:'noodle',fee:it('gold',50000),spoons:25,hearts:30,cooldownHours:3},
   {id:3,name:'Lợn quay',art:'roast',fee:it('diamonds',50),spoons:60,hearts:80,cooldownHours:6}],
  milestones:[[50,[it('gold',100000)]],[150,[it('diamonds',50),it(spoonItem,30)]],[300,[it('consumable:4',1),it('gold',300000)]],[600,[it('diamonds',150)]],[1000,[it('diamonds',300),it(spoonItem,100)]]].map(([point,rewards])=>({point,rewards})),
  top:[[1,1,500,[it('diamonds',2000)]],[2,2,400,[it('diamonds',1200)]],[3,3,300,[it('diamonds',800)]],[4,10,200,[it('diamonds',400)]],[11,50,100,[it('diamonds',150)]]].map(([from,to,minPoint,rewards])=>({from,to,minPoint,rewards})),
  shop:[[it('diamonds',50),100,5],[it('gold',200000),40,10],[it('consumable:4',1),150,3],[it('consumable:16',1),60,10]].map(([reward,price,limit],i)=>({id:i+1,reward,price,limit}))};
}
let config=defaultSanjiConfig();
export const sanjiConfig=()=>config;
export function applySanjiConfig(c){config=c||defaultSanjiConfig();return config}
export const validateSanjiConfig=(input,...rest)=>({enabled:input?.enabled!==false,...checkSanjiConfig(input,...rest)});
function checkSanjiConfig(input,isRewardId){
 requireCondition(input&&typeof input==='object','Thiếu cấu hình.');
 const n=(v,label,min,max)=>integer(v,min,max,label);
 const reward=(x,label)=>{requireCondition(typeof x?.itemId==='string'&&isRewardId(x.itemId),`${label}: vật phẩm không tồn tại.`,404);return it(x.itemId,n(x.quantity,`${label}: số lượng`,1,1e12))};
 const rewards=(list,label,min=0)=>{requireCondition(Array.isArray(list)&&list.length>=min&&list.length<=10,`${label}: cần ${min}-10 phần thưởng.`);return list.map(x=>reward(x,label))};
 requireCondition(Array.isArray(input.dishes)&&input.dishes.length===3,'Cần đúng 3 món ăn.');
 requireCondition(Array.isArray(input.milestones)&&input.milestones.length<=30,'Tối đa 30 mốc quà.');
 requireCondition(Array.isArray(input.top)&&input.top.length<=20,'Tối đa 20 mức thưởng top.');
 requireCondition(Array.isArray(input.shop)&&input.shop.length<=40,'Tối đa 40 món trong cửa hàng.');
 const arts=['pizza','noodle','roast'];
 const milestones=input.milestones.map((m,i)=>({point:n(m.point,`Mốc ${i+1}: điểm`,1,1e9),rewards:rewards(m.rewards,`Mốc ${i+1}`,1)})).sort((a,b)=>a.point-b.point);
 requireCondition(new Set(milestones.map(m=>m.point)).size===milestones.length,'Hai mốc quà trùng điểm.');
 const top=input.top.map((t,i)=>{const from=n(t.from,`Top ${i+1}: từ hạng`,1,10000),to=n(t.to,`Top ${i+1}: đến hạng`,from,10000);return{from,to,minPoint:n(t.minPoint,`Top ${i+1}: điểm tối thiểu`,0,1e9),rewards:rewards(t.rewards,`Top ${i+1}`,1)}}).sort((a,b)=>a.from-b.from);
 for(let i=1;i<top.length;i++)requireCondition(top[i].from>top[i-1].to,'Các mức thưởng top bị chồng hạng.');
 return{minLevel:n(input.minLevel,'Cấp tối thiểu',1,1000),skipPerHour:n(input.skipPerHour,'Kim cương tăng tốc mỗi giờ',0,1e6),
  dishes:input.dishes.map((d,i)=>{requireCondition(typeof d?.name==='string'&&d.name.trim()&&d.name.length<=40,`Món ${i+1}: thiếu tên.`);
   return{id:i+1,name:d.name.trim(),art:arts[i],fee:d.fee?reward(d.fee,`Món ${i+1}: phí tặng`):null,spoons:n(d.spoons,`Món ${i+1}: Thìa nhận`,0,1e6),hearts:n(d.hearts,`Món ${i+1}: Tim nhận`,1,1e6),cooldownHours:n(d.cooldownHours,`Món ${i+1}: giờ hồi`,0,240)}}),
  milestones,top,shop:input.shop.map((s,i)=>({id:i+1,reward:reward(s.reward,`Cửa hàng ${i+1}`),price:n(s.price,`Cửa hàng ${i+1}: giá`,1,1e9),limit:n(s.limit,`Cửa hàng ${i+1}: giới hạn`,1,1e6)}))};
}

export function sanjiState(p,now){
 const s=p.sanji??={season:seasonOf(now),hearts:0,cooldownUntil:0,claimed:[],bought:{},sends:0};
 if(s.season!==seasonOf(now))Object.assign(s,{season:seasonOf(now),hearts:0,cooldownUntil:0,claimed:[],bought:{},sends:0});
 return s;
}
export const skipFee=(s,now)=>{const left=Math.max(0,s.cooldownUntil-now);return left?Math.max(1,Math.ceil(left/HOUR))*config.skipPerHour:0};
export function sanjiView(p,now){
 const s=sanjiState(p,now),c=config;
 return{minLevel:c.minLevel,season:s.season,endsAt:seasonEnd(s.season),hearts:s.hearts,cooldownUntil:s.cooldownUntil,skipFee:skipFee(s,now),
  dishes:c.dishes,milestones:c.milestones.map(m=>({...m,status:s.claimed.includes(m.point)?2:s.hearts>=m.point?1:0})),top:c.top,
  shop:c.shop.map(x=>({...x,bought:s.bought[x.id]||0}))};
}
/** Hành động. ctx: {now, level, spend(cost), grant(reward)}. */
export function sanjiAction(p,action,input,ctx){
 const s=sanjiState(p,ctx.now),c=config;
 requireCondition(ctx.level>=c.minLevel,`Yêu cầu người chơi cấp độ ${c.minLevel} trở lên.`,403,'SANJI_LEVEL');
 if(action==='sanji-send'){
  const d=c.dishes.find(x=>x.id===Number(input?.dish));requireCondition(d,'Món ăn không tồn tại.',404);
  requireCondition(s.cooldownUntil<=ctx.now,'Đầu bếp đang chuẩn bị món, hãy chờ hoặc tăng tốc.',409,'SANJI_COOLDOWN');
  if(d.fee)ctx.spend(d.fee);
  s.hearts+=d.hearts;s.sends++;s.cooldownUntil=ctx.now+d.cooldownHours*HOUR;
  const rewards=d.spoons?[it(spoonItem,d.spoons)]:[];for(const r of rewards)ctx.grant({...r});
  return{message:`Tặng ${d.name}: +${d.hearts} Tim.`,hearts:d.hearts,total:s.hearts,rewards};
 }
 if(action==='sanji-skip'){
  const fee=skipFee(s,ctx.now);requireCondition(fee>0,'Không cần tăng tốc.',409);ctx.spend(it('diamonds',fee));s.cooldownUntil=0;return{message:'Đã tăng tốc.'};
 }
 if(action==='sanji-claim'){
  const m=c.milestones.find(x=>x.point===Number(input?.point));requireCondition(m,'Mốc quà không tồn tại.',404);
  requireCondition(!s.claimed.includes(m.point),'Đã nhận quà mốc này.',409);requireCondition(s.hearts>=m.point,'Chưa đủ Tim.',409);
  s.claimed.push(m.point);for(const r of m.rewards)ctx.grant({...r});return{message:'Nhận quà mốc.',rewards:m.rewards};
 }
 if(action==='sanji-buy'){
  const x=c.shop.find(y=>y.id===Number(input?.id)),count=integer(input?.count??1,1,1000,'Số lượng');requireCondition(x,'Vật phẩm không tồn tại.',404);
  const used=s.bought[x.id]||0;requireCondition(used+count<=x.limit,`Chỉ mua thêm được ${Math.max(0,x.limit-used)} lần.`,409,'SANJI_LIMIT');
  ctx.spend(it(spoonItem,x.price*count));s.bought[x.id]=used+count;const r={...x.reward,quantity:x.reward.quantity*count};ctx.grant(r);return{message:'Mua thành công.',rewards:[r]};
 }
 requireCondition(false,'Hành động Bữa tiệc Sanji không hợp lệ.');
}
/** Thưởng top cho hạng `rank` (1-based) với `points`, theo bảng top (hạng + điểm tối thiểu). */
export const topReward=(rank,points)=>config.top.find(t=>rank>=t.from&&rank<=t.to&&points>=t.minPoint)?.rewards||null;
