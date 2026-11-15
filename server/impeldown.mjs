// Vượt Ngục Impel Down (bundle `impeldown`, EventMain). Luật theo client Lua gốc:
//   - Tháp 7 tầng (ImpleDownTower), tầng chưa mở bị ẩn; mỗi tầng 36 ô (6×6) úp (ImpleDownTile).
//   - Mở ô tốn Chìa Khóa Vượt Ngục (600645) theo tầng ("Tầng N, cần X chìa để mở ô" – PanelEventImpleDownHome).
//   - Ô mở ra một phần quà trong kho quà của tầng (mỗi loại có giới hạn số lượng: GiftOpenTile "(đã ra/tối đa)") hoặc
//     Cửa (bonusId 0): mở tầng kế tiếp và nhận quà cửa. Bấm cửa để xuống tầng sau.
//   - Quà đạt mốc (GiftAchieve): tổng số ô đã lật đạt mốc thì nhận; trạng thái 0 chưa đủ / 1 nhận được / 2 đã nhận.
// Phần server gốc giữ (phí chìa, kho quà, quà cửa, mốc, nguồn chìa) là luật bản web: mặc định dưới đây, quản trị sửa
// ở tab "Vượt Ngục" (impeldown_config). Nguồn chìa: tặng mỗi ngày + mua bằng kim cương (giới hạn mỗi ngày).
import {randomInt} from 'node:crypto';
import {requireCondition,integer} from './errors.mjs';

export const keyItem='consumable:600645',floorCount=7,tileCount=36;
const r=(itemId,quantity)=>({itemId,quantity});
const prize=(itemId,quantity,count)=>({reward:r(itemId,quantity),count});
// Kho quà mỗi tầng: tổng 35 ô (36 ô trừ cửa). Tầng sâu hơn quà lớn hơn.
const floorSeed=(n)=>{const k=n;return{keyCost:[1,1,2,2,3,3,4][n-1],
 prizes:[prize('gold',50000*k,12),prize('consumable:3',300*k,8),prize('consumable:2',100*k,6),prize('consumable:20',2*k,4),prize('consumable:16',k,3),prize('diamonds',20*k,1),prize(n>=5?'consumable:2027':'consumable:2026',1,1)],
 door:[r('diamonds',30*k),r(keyItem,2+k)]}};
// Bật / tắt sự kiện (quản trị): tắt thì ẩn khỏi giao diện và từ chối mọi thao tác.
export const defaultImpelConfig=()=>({enabled:true,...baseImpelConfig()});
function baseImpelConfig(){
 return{season:1,dailyKeys:5,keyPrice:50,buyLimit:20,
  floors:Array.from({length:floorCount},(_,i)=>floorSeed(i+1)),
  achievements:[[10,[r('gold',100000),r(keyItem,3)]],[30,[r('diamonds',100)]],[60,[r('consumable:16',3)]],[100,[r('diamonds',200),r(keyItem,10)]],[150,[r('consumable:2026',1)]],[200,[r('diamonds',500)]],[252,[r('consumable:2027',1),r('diamonds',1000)]]]
   .map(([need,rewards],i)=>({id:i+1,need,rewards}))};
}
let config=defaultImpelConfig();
export const impelConfig=()=>config;
export function applyImpelConfig(c){config=c||defaultImpelConfig();return config}
export const validateImpelConfig=(input,...rest)=>({enabled:input?.enabled!==false,...checkImpelConfig(input,...rest)});
function checkImpelConfig(input,isRewardId){
 requireCondition(input&&typeof input==='object','Thiếu cấu hình.');
 const n=(v,label,min,max)=>integer(v,min,max,label);
 const rewards=(list,label,min=1)=>{requireCondition(Array.isArray(list)&&list.length>=min&&list.length<=10,`${label}: cần ${min}-10 phần thưởng.`);
  return list.map(x=>{requireCondition(typeof x?.itemId==='string'&&isRewardId(x.itemId),`${label}: vật phẩm không tồn tại.`,404);return r(x.itemId,n(x.quantity,`${label}: số lượng`,1,1e12))})};
 requireCondition(Array.isArray(input.floors)&&input.floors.length===floorCount,'Cần đủ 7 tầng.');
 const floors=input.floors.map((f,i)=>{const label=`Tầng ${i+1}`;requireCondition(Array.isArray(f?.prizes)&&f.prizes.length>=1&&f.prizes.length<=20,`${label}: cần 1-20 loại quà.`);
  const prizes=f.prizes.map(p=>({reward:rewards([p.reward],label)[0],count:n(p.count,`${label}: số lượng ô`,1,35)}));
  requireCondition(prizes.reduce((s,p)=>s+p.count,0)===tileCount-1,`${label}: tổng số ô quà phải bằng ${tileCount-1} (36 ô trừ cửa).`);
  return{keyCost:n(f.keyCost,`${label}: số chìa mở ô`,1,1000),prizes,door:rewards(f.door,`${label}: quà cửa`,0)}});
 requireCondition(Array.isArray(input.achievements)&&input.achievements.length<=30,'Tối đa 30 mốc.');
 const achievements=input.achievements.map((a,i)=>({id:i+1,need:n(a.need,`Mốc ${i+1}: số ô`,1,floorCount*tileCount),rewards:rewards(a.rewards,`Mốc ${i+1}`)})).sort((a,b)=>a.need-b.need).map((a,i)=>({...a,id:i+1}));
 return{season:n(input.season,'Mùa',1,1e6),dailyKeys:n(input.dailyKeys,'Chìa tặng mỗi ngày',0,1000),keyPrice:n(input.keyPrice,'Giá 1 chìa',0,1e6),buyLimit:n(input.buyLimit,'Số chìa mua / ngày',0,10000),floors,achievements};
}

const vnDay=now=>new Date(now+7*3600000).toISOString().slice(0,10);
function state(p,now){
 let s=p.impelDown;
 if(!s||s.season!==config.season)s=p.impelDown={season:config.season,maxFloor:1,current:1,opened:0,floors:{},claimed:[],day:null,bought:0};
 s.floors??={};s.claimed??=[];
 const day=vnDay(now);if(s.day!==day){s.day=day;s.bought=0;s.giftToday=false}
 return s;
}
/** Chìa tặng mỗi ngày: nhận khi mở sự kiện lần đầu trong ngày. */
function dailyGift(p,s,grant){if(s.giftToday||!config.dailyKeys)return null;s.giftToday=true;const g=r(keyItem,config.dailyKeys);grant(g);return g}
const floorState=(s,f)=>s.floors[f]??={tiles:Array(tileCount).fill(null),taken:{},door:false};
const status=(s,a)=>s.claimed.includes(a.id)?2:s.opened>=a.need?1:0;
export function impelView(p,now=Date.now()){
 const s=state(p,now);
 return{season:config.season,maxFloor:s.maxFloor,current:s.current,opened:s.opened,keyItem,keys:p.inventory?.[keyItem]||0,dailyKeys:config.dailyKeys,giftToday:!!s.giftToday,
  keyPrice:config.keyPrice,buyLimit:config.buyLimit,bought:s.bought,
  floors:config.floors.map((f,i)=>{const fs=s.floors[i+1];return{floor:i+1,keyCost:f.keyCost,door:f.door,tiles:fs?.tiles||Array(tileCount).fill(null),
   prizes:f.prizes.map((x,k)=>({id:k+1,reward:x.reward,count:x.count,taken:fs?.taken?.[k+1]||0}))}}),
  achievements:config.achievements.map(a=>({...a,status:status(s,a)}))};
}
export function impelEnter(p,grant,now=Date.now()){const s=state(p,now),gift=dailyGift(p,s,grant);return{message:gift?`Nhận ${gift.quantity} Chìa Khóa Vượt Ngục hôm nay.`:'Vượt Ngục',rewards:gift?[gift]:[]}}
/** Lật một ô (EVENT_IMPLE_DOWN_UNLOCK): tốn chìa theo tầng, rút ngẫu nhiên trong phần còn lại của kho quà + cửa. */
export function impelOpen(p,input,{spend,grant,random=n=>randomInt(n)},now=Date.now()){
 const s=state(p,now),floor=integer(input.floor,1,floorCount,'Tầng'),index=integer(input.index,0,tileCount-1,'Ô');
 requireCondition(floor<=s.maxFloor,'Tầng chưa mở.',409,'IMPEL_LOCKED');
 const f=config.floors[floor-1],fs=floorState(s,floor);requireCondition(fs.tiles[index]===null,'Ô đã mở.',409,'IMPEL_OPENED');
 spend(f.keyCost);
 const left=f.prizes.map((x,k)=>Math.max(0,x.count-(fs.taken[k+1]||0))),pool=left.reduce((a,b)=>a+b,0)+(fs.door?0:1);
 let x=random(Math.max(1,pool)),got;
 if(!fs.door&&x===0){fs.door=true;fs.tiles[index]=0;got=f.door.map(g=>({...g}));if(floor<floorCount)s.maxFloor=Math.max(s.maxFloor,floor+1)}
 else{if(!fs.door)x--;let k=0;for(;k<left.length;k++){if(x<left[k])break;x-=left[k]}k=Math.min(k,left.length-1);fs.taken[k+1]=(fs.taken[k+1]||0)+1;fs.tiles[index]=k+1;got=[{...f.prizes[k].reward}]}
 for(const g of got)grant(g);s.opened++;s.current=floor;
 return{message:fs.tiles[index]===0?(floor<floorCount?`Tìm thấy cửa xuống tầng ${floor+1}!`:'Đã vượt ngục thành công!'):'Mở ô thành công.',door:fs.tiles[index]===0,rewards:got,floor,index};
}
export function impelClaim(p,input,grant,now=Date.now()){
 const s=state(p,now),a=config.achievements.find(x=>x.id===Number(input.id));requireCondition(a,'Mốc không tồn tại.',404);
 const st=status(s,a);requireCondition(st!==2,'Đã nhận quà.',409,'IMPEL_CLAIMED');requireCondition(st===1,'Chưa đủ điều kiện nhận',409,'IMPEL_NOT_READY');
 s.claimed.push(a.id);for(const g of a.rewards)grant({...g});return{message:'Nhận quà đạt mốc.',rewards:a.rewards};
}
export function impelBuy(p,input,{spendDiamonds,grant},now=Date.now()){
 const s=state(p,now),count=integer(input.count,1,10000,'Số chìa');requireCondition(s.bought+count<=config.buyLimit,`Hôm nay chỉ mua thêm được ${Math.max(0,config.buyLimit-s.bought)} chìa.`,409,'IMPEL_BUY_LIMIT');
 spendDiamonds(config.keyPrice*count);s.bought+=count;const g=r(keyItem,count);grant(g);return{message:`Đã mua ${count} Chìa Khóa Vượt Ngục.`,rewards:[g]};
}
export function impelFloor(p,input,now=Date.now()){const s=state(p,now),floor=integer(input.floor,1,floorCount,'Tầng');requireCondition(floor<=s.maxFloor,'Tầng chưa mở.',409,'IMPEL_LOCKED');s.current=floor;return{message:`Tầng ${floor}`}}
