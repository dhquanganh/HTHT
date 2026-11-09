// Tân Tứ Hoàng (TTHMain / TTHHub / TTHLobby gốc, bundle lua_bossserver). Luật theo mã Lua và Trợ giúp gốc:
//   - 4 Tứ Hoàng (TTHDb.BOSSES: Luffy / Buggy / Shanks / Blackbeard Yonko), mỗi ngày chỉ khiêu chiến 1 boss, xoay vòng theo
//     ngày (bossIndex = (ngày - 1) % 4: ngày 19 là Shanks như ảnh gốc), cứ qua 1 ngày boss mạnh lên (cấp = 10 × ngày).
//   - Mỗi Tứ Hoàng có bộ kỹ năng (kỹ năng gốc của tướng, db_heroes active + passive1..3) và mức kháng sát thương riêng.
//   - Boss không chết: đánh tới hết số hiệp, tính tổng sát thương 1 lần tấn công (trận luôn kết thúc VICTORY).
//   - Mỗi ngày 10 lượt miễn phí, mua thêm bằng kim cương.
//   - Thưởng sát thương: theo sát thương 1 lần tấn công, mỗi mốc nhận tối đa 1 lần mỗi ngày (tự nhận khi đạt).
//   - Thưởng xếp hạng: sát thương cao nhất 1 lần trong ngày là căn cứ xếp hạng, thưởng gửi qua thư sau 00:00.
// Máy chủ gốc (TanTuHoangHandler) giữ các con số (cấp / kháng / mốc / bậc thưởng / giá mua) và không có trong client,
// nên các số dưới đây do bản web đặt; vật phẩm thưởng là Hải hồn và Rương Hải Hồn của bản gốc (2201-2206).
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition} from './errors.mjs';

export const tthData=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/tth.json',import.meta.url)),'utf8'));
export const freePerDay=10,maxBuy=10,battleRounds=15,levelPerDay=10;
export const buyPrice=bought=>bought>=maxBuy?-1:50+25*bought;
// Kháng sát thương (‰, hiển thị /10 như TTHLobby): khác nhau theo Tứ Hoàng, tăng thêm 0,5% mỗi ngày, tối đa 60%.
export const baseResist=[200,250,300,280];
export const resistOf=(index,day)=>Math.min(600,baseResist[index]+5*(day-1));
export const vnDay=(now=Date.now())=>Math.floor((now+7*3600000)/86400000);
export const nextVnDay=(now=Date.now())=>(vnDay(now)+1)*86400000-7*3600000;
// Ngày Tân Tứ Hoàng: tính từ ngày mở tính năng (TTH_START_DATE, mặc định 01/11/2026, giờ Việt Nam), ngày đầu là 1.
export const startDay=vnDay(Date.parse((process.env.TTH_START_DATE||'2026-11-01')+'T00:00:00+07:00'));
export const tthDay=(now=Date.now())=>Math.max(1,vnDay(now)-startDay+1);
export const bossOfDay=day=>tthData.bosses[((day-1)%4+4)%4];
const item=(id,n)=>({itemId:'consumable:'+id,quantity:n});
/** Mốc sát thương: cấp boss × 50 × hệ số (boss mạnh lên mỗi ngày thì mốc cũng tăng). */
export const milestones=[[1,[item(2201,3)]],[2,[item(2201,5)]],[4,[item(2205,1)]],[8,[item(2202,3)]],[15,[item(2205,2)]],[25,[item(2203,2)]],[40,[item(2206,1)]],[60,[item(2204,1),item(2206,1)]]];
export const rankTiers=[[1,1,[{itemId:'diamonds',quantity:500},item(2206,3),item(2204,2)]],[2,2,[{itemId:'diamonds',quantity:400},item(2206,2),item(2204,1)]],[3,3,[{itemId:'diamonds',quantity:300},item(2206,2),item(2203,2)]],
 [4,10,[{itemId:'diamonds',quantity:200},item(2206,1),item(2203,1)]],[11,20,[{itemId:'diamonds',quantity:150},item(2205,2)]],[21,50,[{itemId:'diamonds',quantity:100},item(2205,1)]],[51,100,[item(2205,1)]],[101,999999,[item(2202,2)]]];
export const rankReward=rank=>rankTiers.find(([a,b])=>rank>=a&&rank<=b)?.[2]||[];
/** Chỉ số boss ngày `day`: đường tăng trưởng tướng của bản web ở cấp 10 × ngày, 10 sao, nhân hệ số gốc của tướng. */
export function bossUnit(day){
 const b=bossOfDay(day),level=levelPerDay*day,g=level*(1+level/150),star=1+9*.2,s=b.scale,maxHp=Math.round((800+g*82)*star*s.maxHp*20);
 return{id:'enemy-0',name:b.name,avatar:b.avatar,faction:b.faction,heroClass:b.class==='fighter'?'warrior':b.class,level,stars:10,position:2,maxHp,hp:maxHp,
  attack:Math.round((100+g*14)*star*s.attack),defense:Math.round((25+g*4)*star*s.defense),speed:Math.round((100+level*(1+level/600))*s.speed),
  damageReduction:resistOf(b.index,day)/1000,endless:true,damageTaken:0,visualIndex:0};
}
export const milestoneValue=(day,i)=>Math.round(levelPerDay*day*50*milestones[i][0]);
export function tthState(p,day){const t=p.tth&&typeof p.tth==='object'?p.tth:{};if(t.day!==day){t.day=day;t.used=0;t.bought=0;t.best=0;t.claimed=[]}p.tth=t;return t}
export function tthView(p,now=Date.now()){
 const ctx={day:tthDay(now)},t=tthState(structuredClone(p),ctx.day),left=freePerDay+t.bought-t.used,b=bossOfDay(ctx.day);
 return{open:true,day:ctx.day,bossIndex:b.index,bossName:b.name,bossLevel:levelPerDay*ctx.day,resist:resistOf(b.index,ctx.day),attacksLeft:left,freeLeft:Math.max(0,freePerDay-t.used),
  boughtToday:t.bought,maxBuy,buyPrice:buyPrice(t.bought),myBest:t.best,secondsToReset:Math.max(0,Math.round((nextVnDay(now)-now)/1000)),freePerDay,
  milestones:milestones.map((m,i)=>({index:i,threshold:milestoneValue(ctx.day,i),claimed:t.claimed.includes(i),rewards:m[1]})),rankTiers:rankTiers.map(([from,to,rewards])=>({from,to,rewards}))};
}
export function tthBuy(p,now,spendDiamonds){const ctx={day:tthDay(now)};
 const t=tthState(p,ctx.day),price=buyPrice(t.bought);requireCondition(price>=0,'Đã hết lượt mua hôm nay',409,'BUY_LIMIT');
 spendDiamonds(price);t.bought++;return{message:'Mua lượt đánh thành công'};
}
export function tthSpend(p,now){const ctx={day:tthDay(now)};const t=tthState(p,ctx.day);requireCondition(freePerDay+t.bought-t.used>0,'Đã hết lượt khiêu chiến hôm nay',409,'NO_ATTACKS');t.used++;return t}
/** Kết thúc trận: sát thương 1 lần, cập nhật sát thương cao nhất, tự nhận các mốc mới đạt. */
export function tthFinish(p,b,grant){
 // Trận kéo sang ngày mới thì không tính (sát thương / mốc của ngày cũ đã khép lại).
 const damage=Math.round(b.enemies[0].damageTaken||0),counted=p.tth?.day===b.tth.day,t=p.tth;const got=[];
 if(counted){t.best=Math.max(t.best,damage);milestones.forEach((m,i)=>{if(!t.claimed.includes(i)&&damage>=milestoneValue(b.tth.day,i)){t.claimed.push(i);for(const r of m[1]){grant(r);got.push(r)}}})}
 b.reward={damage,best:t.best,counted,items:got};return b.reward;
}
