// Mê cung (Sealed Land gốc: SealedLandScene, SealedLandSelectBattle, PanelCenterSealedLand, CellSealedLand).
// Luật theo tên lớp / trường trong global-metadata và chữ gốc:
//   - 6 vùng theo hệ (lvAbyss / lvShadow / lvFortress / lvForest / lvDark / lvLight), mỗi vùng 20 ải ("8/20").
//   - Mỗi vùng chỉ cho thuyền viên đúng hệ ra trận (KEY_LINEUP_SEAL_LAND_<HỆ>: đội hình riêng từng vùng).
//   - Ải có trạng thái STATE_LOCKED / STATE_CHALLENGE / STATE_SMASH. Ải kế tiếp: Khiêu chiến (SEALED_LAND_CHALLENGE,
//     tốn 1 lượt icon_seal_challenge, thắng nhận m_BonusChallenge lần đầu). Ải đã qua: Càn quét (SEALED_LAND_SMASH,
//     tốn 1 lượt icon_seal_smash, nhận ngay m_BonusSmash).
//   - HUD: số lượt càn quét (IndexSmash) và khiêu chiến (IndexAttack), mua thêm bằng kim cương
//     (ButtonBuySmash / ButtonBuyAttack, m_feeBuySmash / m_feeBuyAtk, m_numberBuySmashLeft). Lượt hồi mỗi ngày.
//   - Phần thưởng là Sách phong ấn (SEAL_BOOK_NORMAL / SEAL_BOOK_DL) dùng ở Cửa hàng Mê cung (SHOP_SEALEDLAND).
// Số liệu máy chủ gốc (cấp mở, số lượt, giá, sức mạnh địch, thưởng) không có trong client nên do bản web đặt.
import {requireCondition} from './errors.mjs';
import {heroAlbum,campaign,towerData} from './catalog.mjs';
import {allowedPool,overrideLineup,adjustStats,onContentChange} from './content.mjs';

export const sealBook='material:seal-book',sealBookDL='material:seal-book-dl';
export const sealedFactions=['abyss','shadow','fortress','forest','dark','light'];
export const sealedConfig={minLevel:25,levels:20,dailyAttack:5,dailySmash:5,buyLimit:5,feeAttack:50,feeSmash:30};
const it=(itemId,quantity)=>({itemId,quantity});
// Bảng thưởng khiêu chiến / càn quét từng ải (sửa được ở trang quản trị, server/reward-config.mjs).
export const challengeTable=Array.from({length:20},(_,i)=>{const level=i+1;return[it(sealBook,20+level*5),it('diamonds',10+level*2),...(level%5===0?[it(sealBookDL,1+Math.floor(level/10))]:[])]});
export const smashTable=Array.from({length:20},(_,i)=>{const level=i+1;return[it(sealBook,8+level*2),it('gold',20000+level*4000)]});
const defaultChallenge=level=>[it(sealBook,20+level*5),it('diamonds',10+level*2),...(level%5===0?[it(sealBookDL,1+Math.floor(level/10))]:[])];
const defaultSmash=level=>[it(sealBook,8+level*2),it('gold',20000+level*4000)];
onContentChange(c=>{sealedConfig.levels=Math.max(1,c.counts?.sealed||20);while(challengeTable.length<sealedConfig.levels)challengeTable.push(defaultChallenge(challengeTable.length+1));while(smashTable.length<sealedConfig.levels)smashTable.push(defaultSmash(smashTable.length+1))});
export const challengeRewards=level=>challengeTable[level-1]||[];
export const smashRewards=level=>smashTable[level-1]||[];
const DAY=86400000,vnDay=now=>Math.floor((now+7*3600000)/DAY);
export const sealedResetAt=now=>(vnDay(now)+1)*DAY-7*3600000;

const visuals={...campaign.visuals,...towerData.visuals};
const poolOf=f=>heroAlbum.heroes.filter(h=>h.faction===f&&h.rank>=3&&visuals[h.avatar]?.skeleton&&visuals[h.avatar]?.head).map(h=>h.avatar).sort((a,b)=>a-b);
const pools=Object.fromEntries(sealedFactions.map(f=>[f,poolOf(f)]));
const byAvatar=new Map(heroAlbum.heroes.map(h=>[h.avatar,h]));
const hash=(a,b)=>{let x=(a*2246822519^b*3266489917)>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0};
export const sealedEnemyCount=level=>Math.min(6,3+Math.floor((level-1)/5));
/** Thủ vệ của ải: cùng hệ với vùng, cố định theo (hệ, ải). */
const fromOverride=list=>list.filter(a=>byAvatar.has(a)).slice(0,6).map((avatar,i)=>{const h=byAvatar.get(avatar);return{avatar,name:h.name,faction:h.faction,rank:h.rank,position:i+1}});
export function sealedLineup(faction,level){
 const ov=overrideLineup('sealed',`${faction}-${level}`);if(ov)return fromOverride(ov);
 const pool=allowedPool(pools[faction]),n=sealedEnemyCount(level),picked=[],fi=sealedFactions.indexOf(faction);
 for(let i=0;picked.length<n&&i<60;i++){const a=pool[hash(fi*131+level,i)%pool.length];if(!picked.includes(a))picked.push(a)}
 return picked.map((avatar,i)=>{const h=byAvatar.get(avatar);return{avatar,name:h.name,faction:h.faction,position:i+1}});
}
// Sức mạnh thủ vệ so với chỉ số trung bình 6 thuyền viên mạnh nhất của người chơi.
export const sealedScale=level=>.45+level*.075;
export function sealedEnemyStats(ref,level,i,faction,avatar){const k=sealedScale(level)*(1+i*.04);return adjustStats({maxHp:Math.round(ref.maxHp*k*1.3),attack:Math.round(ref.attack*k),defense:Math.round(ref.defense*k),speed:Math.round(ref.speed*(.85+level*.01))},'sealed',`${faction}-${level}`,avatar,ref.level)}
export const enemyPower=(ref,level,faction=sealedFactions[0])=>sealedLineup(faction,level).reduce((n,e,i)=>{const s=sealedEnemyStats(ref,level,i,faction,e.avatar);return n+Math.round(s.attack*6+s.maxHp*.6+s.defense*4)},0);

function state(p,now){
 p.sealed??={cleared:Object.fromEntries(sealedFactions.map(f=>[f,0])),lineups:{}};
 const s=p.sealed,day=vnDay(now);
 if(s.day!==day)Object.assign(s,{day,attack:sealedConfig.dailyAttack,smash:sealedConfig.dailySmash,boughtAttack:0,boughtSmash:0});
 return s;
}
export function sealedView(p,now=Date.now(),ref=null){
 const s=state(p,now);
 return{unlocked:p.account.level>=sealedConfig.minLevel,minLevel:sealedConfig.minLevel,levels:sealedConfig.levels,resetAt:sealedResetAt(now),
  attack:s.attack,smash:s.smash,feeAttack:sealedConfig.feeAttack,feeSmash:sealedConfig.feeSmash,buyAttackLeft:sealedConfig.buyLimit-s.boughtAttack,buySmashLeft:sealedConfig.buyLimit-s.boughtSmash,
  cleared:s.cleared,lineups:s.lineups,
  factions:Object.fromEntries(sealedFactions.map(f=>[f,Array.from({length:sealedConfig.levels},(_,i)=>{const level=i+1;
   return{level,state:level<=s.cleared[f]?'smash':level===s.cleared[f]+1?'challenge':'locked',enemies:sealedLineup(f,level),power:ref?enemyPower(ref,level,f):0,challenge:challengeRewards(level),smash:smashRewards(level)}})]))};
}
const requireOpen=p=>requireCondition(p.account.level>=sealedConfig.minLevel,`Yêu cầu cấp độ ${sealedConfig.minLevel}`,409,'SEALED_LEVEL');
/** ctx: {pay, grant}. op: buy {kind: attack|smash}, smash {faction, level} */
export function sealedAction(p,input,ctx,now=Date.now()){
 requireOpen(p);const s=state(p,now),op=input.op;
 if(op==='buy'){
  const k=input.kind==='smash'?'smash':'attack',bk=k==='smash'?'boughtSmash':'boughtAttack';
  requireCondition(s[bk]<sealedConfig.buyLimit,'Đã hết lượt mua hôm nay.',409,'SEALED_BUY_LIMIT');
  ctx.pay(it('diamonds',k==='smash'?sealedConfig.feeSmash:sealedConfig.feeAttack));s[bk]++;s[k]++;return{message:k==='smash'?'Đã mua 1 lượt càn quét.':'Đã mua 1 lượt khiêu chiến.'};
 }
 if(op==='smash'){
  const f=input.faction,level=Number(input.level);requireCondition(sealedFactions.includes(f),'Vùng không hợp lệ.');
  requireCondition(Number.isInteger(level)&&level>=1&&level<=s.cleared[f],'Hãy vượt qua ải trước khi càn quét.',409,'SEALED_NOT_CLEARED');
  requireCondition(s.smash>0,'Hết lượt càn quét.',409,'SEALED_NO_SMASH');s.smash--;const rewards=smashRewards(level);rewards.forEach(ctx.grant);return{message:'Càn quét thành công.',rewards};
 }
 requireCondition(false,'Thao tác không hợp lệ.');
}
/** Trước trận khiêu chiến: kiểm tra vùng / ải / lượt / đội cùng hệ, trừ 1 lượt. ctx: {faction(id), stats(id), top()} */
export function prepareSealedFight(p,input,slots,ctx,now=Date.now()){
 requireOpen(p);const s=state(p,now),f=input.faction,level=s.cleared[f]+1;
 requireCondition(sealedFactions.includes(f),'Vùng không hợp lệ.');requireCondition(level<=sealedConfig.levels,'Đã vượt qua toàn bộ ải của vùng này.',409,'SEALED_DONE');
 if(input.level!==undefined)requireCondition(Number(input.level)===level,`Hãy khiêu chiến ải ${level}.`,409,'SEALED_LEVEL_ORDER');
 const ids=slots.filter(Boolean);requireCondition(ids.length,'Hãy chọn thuyền viên.');
 requireCondition(ids.every(id=>ctx.faction(id)===f),'Chỉ thuyền viên cùng hệ với vùng mới được ra trận.',409,'SEALED_FACTION');
 requireCondition(s.attack>0,'Hết lượt khiêu chiến.',409,'SEALED_NO_ATTACK');
 const all=ctx.top().map(ctx.stats),avg=k=>Math.round(all.reduce((n,x)=>n+x[k],0)/Math.max(1,all.length)),ref={maxHp:avg('maxHp'),attack:avg('attack'),defense:avg('defense'),speed:avg('speed'),level:avg('level')||1};
 s.attack--;s.lineups[f]=slots;
 return{enemies:sealedLineup(f,level).map((e,i)=>({...e,...sealedEnemyStats(ref,level,i,f,e.avatar)})),meta:{faction:f,level,day:s.day}};
}
/** Sau trận: thắng thì mở ải và nhận thưởng khiêu chiến. */
export function finishSealed(p,b,grant,now=Date.now()){
 const s=state(p,now),m=b.sealed;if(!m)return null;
 const won=!b.enemies.some(e=>e.hp>0);if(!won||s.cleared[m.faction]!==m.level-1)return{won:false,...m};
 s.cleared[m.faction]=m.level;const rewards=challengeRewards(m.level);rewards.forEach(grant);return{won:true,...m,rewards};
}
export const referenceStats=(all)=>{const avg=k=>Math.round(all.reduce((n,x)=>n+(x[k]||0),0)/Math.max(1,all.length));return{maxHp:avg('maxHp'),attack:avg('attack'),defense:avg('defense'),speed:avg('speed'),level:avg('level')||1}};
