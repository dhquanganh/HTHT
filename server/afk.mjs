// Rương tự động đánh ải: server giữ đồng hồ, client chỉ hiển thị.
import {requireCondition} from './errors.mjs';
import {economy,itemById,stages} from './catalog.mjs';

const {tickSeconds,maxSeconds,minClaimSeconds,overflowSeconds,stoneItem}=economy.afk;
const tickMs=tickSeconds*1000,maxTicks=maxSeconds/tickSeconds,spiritPerStone=1;
// Cột output của db_vuotai, ví dụ "G +20/5s; EXP +5/5s; S +2/5s".
const rates=stages.map(stage=>{const match=/^G \+(\d+)\/5s; EXP \+(\d+)\/5s; S \+(\d+)\/5s$/.exec(stage.idleOutput);if(!match)throw Error(`Ải ${stage.code} thiếu tốc độ tự động đánh.`);return{gold:Number(match[1]),accountExp:Number(match[2]),spirit:Number(match[3])}});
const earningStage=p=>Math.min(stages.length,Math.max(p.adventure.unlockedStage-1,...p.adventure.cleared));
const freshTicks=(a,now)=>a.since===null?0:Math.min(maxTicks-a.ticks,Math.max(0,Math.floor((now-a.since)/tickMs)));

export const emptyAfk=()=>({since:null,ticks:0,gold:0,accountExp:0,spirit:0});
/** Bắt đầu đồng hồ từ ải đầu tiên đã qua; tài khoản cũ tính từ lúc này, không cộng hồi tố. Trả về true nếu có thay đổi cần lưu. */
export function startAfk(p,now=Date.now()){
 const existing=p.adventure.afk,a=existing||(p.adventure.afk=emptyAfk());
 if(a.since===null&&earningStage(p)){a.since=now;return true}
 return !existing;
}
/** Chốt phần đã tích lũy theo tốc độ hiện tại. Gọi trước khi mở ải mới để tốc độ mới không áp dụng ngược về trước. */
export function bankAfk(p,now=Date.now()){
 const a=p.adventure.afk;if(a.since===null)return a;
 const rate=rates[earningStage(p)-1],ticks=freshTicks(a,now);
 a.gold+=ticks*rate.gold;a.accountExp+=ticks*rate.accountExp;a.spirit+=ticks*rate.spirit;a.ticks+=ticks;
 a.since=a.ticks<maxTicks?a.since+ticks*tickMs:now;return a;
}
/** Lượng nhận được trong `hours` giờ, dùng cho vật phẩm Beli và Đá EXP theo giờ. */
export function afkHours(p,kind,hours){
 const rate=rates[Math.max(1,earningStage(p))-1],ticks=hours*3600/tickSeconds;
 return kind==='gold'?rate.gold*ticks:Math.floor(rate.spirit*ticks/spiritPerStone);
}
export function afkView(p,now=Date.now()){
 const a=p.adventure.afk||emptyAfk(),stageId=earningStage(p),rate=rates[stageId-1]||null,ticks=freshTicks(a,now);
 const seconds=a.since===null?0:Math.min(maxSeconds,a.ticks*tickSeconds+Math.max(0,Math.floor((now-a.since)/1000)));
 const spirit=a.spirit+ticks*(rate?.spirit||0);
 return{state:seconds<minClaimSeconds?'empty':seconds<overflowSeconds?'full':'overflow',seconds,stageCode:stages[stageId-1]?.code||null,rate,spiritPerStone,pending:{gold:a.gold+ticks*(rate?.gold||0),accountExp:a.accountExp+ticks*(rate?.accountExp||0),spirit,stones:Math.floor(spirit/spiritPerStone)}};
}
/** Rút toàn bộ rương. Điểm S chưa đủ một viên Đá EXP ở lại cho lần sau; phần giây lẻ của tick dở cũng được giữ. */
export function collectAfk(p,now=Date.now()){
 const {seconds}=afkView(p,now);
 requireCondition(seconds>=minClaimSeconds,'Rương trống. Hãy đợi thuyền viên đánh tự động thêm một thời gian nữa.',409,'AFK_EMPTY');
 const a=bankAfk(p,now),stones=Math.floor(a.spirit/spiritPerStone),payout={gold:a.gold,accountExp:a.accountExp,stones,seconds};
 a.spirit-=stones*spiritPerStone;a.gold=0;a.accountExp=0;a.ticks=0;return payout;
}
