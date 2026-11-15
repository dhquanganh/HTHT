// Vòng quay gốc (PopupLuckySpin / PopupSuperLuckySpin, mở từ PopupChooseSpin: Casino thường / Casino VIP).
//   - Đĩa 8 ô quà (SpinDisk Items Text1..8). Đĩa quay, kim (RouletteCenter) đứng yên chỉ lên trên.
//   - Nút 1 lượt / 10 lượt / 100 lượt (HotFix100Spins: 100 lượt thường tốn 80 Xu, VIP tốn 100 Xu siêu cấp).
//     Thường: 1 lượt 1 Xu, 10 lượt 8 Xu; VIP: 1 / 10 / 100 Xu siêu cấp. Mỗi ngày vòng thường quay miễn phí 1 lượt.
//   - "Làm mới" (ButtonRefresh, giá kim cương TextGemRefresh) đổi 8 ô quà; "Bắt buộc làm mới" (TextCountDownRefresh)
//     tự đổi ô quà theo chu kỳ, sau mỗi lần bắt buộc làm mới thì lần làm mới đầu miễn phí.
//   - VIP mở ở cấp 40 hoặc VIP 3 (MSG_REQUIRE_VIP_OR_LEVEL). Hết xu mua bằng kim cương (ButtonBuyChip).
// Bể quà, tỉ lệ, chu kỳ và giá làm mới nằm ở máy chủ gốc nên do bản web đặt.
import {randomInt} from 'node:crypto';
import {requireCondition,integer} from './errors.mjs';

const it=(itemId,quantity)=>({itemId,quantity}),pool=(reward,weight)=>({reward,weight});
export const casinos={
 normal:{name:'Vòng quay',chip:'consumable:10',price:20,dailyFree:1,costs:{1:1,10:8,100:80},refreshPrice:20,
  pool:[pool(it('gold',20000),30),pool(it('gold',50000),20),pool(it('gold',100000),8),pool(it('diamonds',20),20),pool(it('diamonds',50),10),pool(it('diamonds',100),5),
        pool(it('consumable:35',1),8),pool(it('consumable:178',1),6),pool(it('consumable:37',1),1),pool(it('consumable:2',200),18),pool(it('consumable:3',200),18),
        pool(it('consumable:16',1),6),pool(it('consumable:1',3),12),pool(it('spirit',20000),18)]},
 super:{name:'Vòng quay VIP',chip:'consumable:13',price:100,minLevel:40,minVip:3,costs:{1:1,10:10,100:100},refreshPrice:50,
  pool:[pool(it('gold',200000),25),pool(it('gold',500000),10),pool(it('diamonds',100),20),pool(it('diamonds',200),12),pool(it('diamonds',500),4),
        pool(it('consumable:53',1),1),pool(it('consumable:2',1000),20),pool(it('consumable:16',2),10),pool(it('consumable:37',1),8),pool(it('consumable:178',3),8),
        pool(it('consumable:3',1000),18),pool(it('spirit',100000),16)]},
};
export const refreshHours=8;
// ---- Cấu hình quản trị (casino_config): giá mua xu (kim cương / xu), số xu mỗi lần quay 1 / 10 / 100, lượt miễn phí mỗi ngày,
// giá làm mới, điều kiện mở VIP, bể quà (quà + trọng số). `casinos` được sửa tại chỗ nên mọi chỗ đang dùng thấy ngay.
const originalCasinos=structuredClone(casinos);
const editable=c=>({name:c.name,chip:c.chip,price:c.price,costs:{...c.costs},dailyFree:c.dailyFree||0,refreshPrice:c.refreshPrice,minLevel:c.minLevel||0,minVip:c.minVip||0,pool:c.pool.map(x=>({reward:{...x.reward},weight:x.weight}))});
export const defaultCasinoConfig=()=>Object.fromEntries(Object.entries(originalCasinos).map(([id,c])=>[id,editable(c)]));
export const casinoConfig=()=>Object.fromEntries(Object.entries(casinos).map(([id,c])=>[id,editable(c)]));
export function applyCasinoConfig(cfg){
 cfg=cfg||defaultCasinoConfig();
 for(const [id,c] of Object.entries(cfg)){if(!casinos[id])continue;Object.assign(casinos[id],{price:c.price,costs:{...c.costs},dailyFree:c.dailyFree,refreshPrice:c.refreshPrice,pool:c.pool.map(x=>pool({...x.reward},x.weight))});
  if(id==='super'){casinos[id].minLevel=c.minLevel;casinos[id].minVip=c.minVip}}
 return cfg;
}
export function validateCasinoConfig(input,isRewardId){
 requireCondition(input&&typeof input==='object','Thiếu cấu hình.');const out={};
 for(const [id,base] of Object.entries(originalCasinos)){
  const c=input[id],name=base.name,n=(v,l,a,b)=>integer(v,a,b,`${name}: ${l}`);requireCondition(c&&typeof c==='object',`${name}: thiếu cấu hình.`);
  requireCondition(Array.isArray(c.pool)&&c.pool.length>=8&&c.pool.length<=40,`${name}: bể quà cần 8-40 món (đĩa có 8 ô).`);
  const items=c.pool.map((x,i)=>{requireCondition(typeof x?.reward?.itemId==='string'&&isRewardId(x.reward.itemId),`${name}: quà ${i+1} không tồn tại.`,404);
   return{reward:{itemId:x.reward.itemId,quantity:n(x.reward.quantity,`quà ${i+1} số lượng`,1,1e12)},weight:n(x.weight,`quà ${i+1} tỉ lệ`,1,1e6)}});
  out[id]={name,chip:base.chip,price:n(c.price,'giá 1 xu (kim cương)',1,1e6),costs:{1:n(c.costs?.[1],'xu cho 1 lượt',1,1e6),10:n(c.costs?.[10],'xu cho 10 lượt',1,1e6),100:n(c.costs?.[100],'xu cho 100 lượt',1,1e7)},
   dailyFree:id==='normal'?n(c.dailyFree,'lượt miễn phí mỗi ngày',0,100):0,refreshPrice:n(c.refreshPrice,'giá làm mới',0,1e6),
   minLevel:id==='super'?n(c.minLevel,'cấp mở',0,1000):0,minVip:id==='super'?n(c.minVip,'VIP mở',0,30):0,pool:items};
 }
 return out;
}
const SLOTS=8,vnDay=now=>new Date(now+7*3600000).toISOString().slice(0,10);
// Mốc bắt buộc làm mới theo giờ Việt Nam: 0h, 8h, 16h.
const nextForced=now=>{const period=refreshHours*3600000,local=now+7*3600000;return Math.floor(local/period)*period+period-7*3600000};
const draw=(c,rand)=>{const left=c.pool.map((x,i)=>i),out=[];
 while(out.length<SLOTS&&left.length){const total=left.reduce((n,i)=>n+c.pool[i].weight,0);let r=rand()*total,k=left.length-1;
  for(let j=0;j<left.length;j++){if(r<c.pool[left[j]].weight){k=j;break}r-=c.pool[left[j]].weight}out.push(left.splice(k,1)[0])}return out};
const defaultRand=()=>randomInt(1e9)/1e9;
function state(p,now,rand=defaultRand){
 const day=vnDay(now);p.casino??={day,free:0,spins:0};const s=p.casino;if(s.day!==day){s.day=day;s.free=0}
 s.wheels??={};
 for(const [id,c] of Object.entries(casinos)){const w=s.wheels[id];
  if(!w||now>=w.refreshAt||!Array.isArray(w.slots)||w.slots.some(i=>!c.pool[i]))s.wheels[id]={slots:draw(c,rand),refreshAt:nextForced(now),refreshes:0}}
 return s;
}
const open=(p,c)=>!c.minLevel||p.account.level>=c.minLevel||(p.vip||0)>=c.minVip;
const refreshCost=(c,w)=>w.refreshes?c.refreshPrice:0;
export function casinoView(p,now=Date.now()){const s=state(p,now);return{freeLeft:Math.max(0,casinos.normal.dailyFree-s.free),spins:s.spins,
 wheels:Object.fromEntries(Object.entries(casinos).map(([id,c])=>{const w=s.wheels[id];return[id,{name:c.name,chip:c.chip,price:c.price,costs:c.costs,open:open(p,c),minLevel:c.minLevel||0,minVip:c.minVip||0,
  slots:w.slots.map(i=>c.pool[i].reward),refreshAt:w.refreshAt,refreshCost:refreshCost(c,w)}]}))}}
/** ctx: {payItems, payDiamonds, grant, random?} */
export function casinoAction(p,input,ctx,now=Date.now()){
 const c=casinos[input.wheel];requireCondition(c,'Vòng quay không hợp lệ.');
 requireCondition(open(p,c),`Yêu cầu cấp độ ${c.minLevel} hoặc VIP cấp độ ${c.minVip}`);
 const rand=ctx.random||defaultRand,s=state(p,now,rand),w=s.wheels[input.wheel];
 if(input.op==='buy'){const n=Number(input.count)||1;requireCondition(Number.isInteger(n)&&n>=1&&n<=100,'Số lượng không hợp lệ.');ctx.payDiamonds(c.price*n);ctx.grant(it(c.chip,n));return{message:`Đã mua ${n} xu.`}}
 if(input.op==='refresh'){const cost=refreshCost(c,w);if(cost)ctx.payDiamonds(cost);w.slots=draw(c,rand);w.refreshes++;return{message:'Đã làm mới vòng quay.',cost}}
 const times=[1,10,100].includes(Number(input.times))?Number(input.times):1,free=input.wheel==='normal'&&times===1&&s.free<c.dailyFree;
 if(free)s.free++;else ctx.payItems({[c.chip]:c.costs[times]});
 const total=w.slots.reduce((n,i)=>n+c.pool[i].weight,0),hits=[];
 for(let k=0;k<times;k++){let r=rand()*total,index=SLOTS-1;for(let j=0;j<w.slots.length;j++){const wt=c.pool[w.slots[j]].weight;if(r<wt){index=j;break}r-=wt}hits.push(index)}
 // Gộp quà trùng (100 lượt) cho gọn popup thưởng.
 const merged=new Map();for(const i of hits){const r=c.pool[w.slots[i]].reward;merged.set(r.itemId,(merged.get(r.itemId)||0)+r.quantity)}
 const rewards=[...merged].map(([itemId,quantity])=>it(itemId,quantity));for(const r of rewards)ctx.grant(r);
 s.spins+=times;
 return{message:'',hits,rewards,free,cost:free?0:c.costs[times]};
}
