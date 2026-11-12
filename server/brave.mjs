// Luyện tập (Brave Trial gốc, bản mới: BraveTrialScene2 / BraveTrialSceneNew, PopupBravePlayerNew, PopupBraveReward,
// PopupAlstarsOfTrial, InformationBraveTrial). Luật theo db_help gốc ("Luyện tập") và chữ gốc của tính năng:
//   - 15 ải khó dần trên bản đồ (Stage1..15). Thuyền viên KHÔNG hồi phục: máu đội ta giữ lại giữa các trận, tướng ngã
//     không ra trận được nữa; máu đội địch của ải cũng giữ lại tới khi qua ải.
//   - Mỗi ải qua được nhận thưởng; mốc 3 / 6 / 9 / 12 / 15 ải có rương thưởng (PopupBraveReward, StageExtra1..5).
//   - Tế đàn (ButtonAlstarOfTrial) mở sau màn 6 (MSG_BRAVE_TRIAL_SCENE_CHECK_OPEN_ALSTAR_OF_TRIAL), mỗi lần dùng tốn
//     1 huy hiệu (GroupBuyBadge, mua thêm bằng kim cương): Hồi sinh 1 thuyền viên, Hồi máu cả đội, hoặc Phước lành.
//   - Phước lành (Rage / Rock / Storm, nút góc trái dưới, InformationBraveTrial): mỗi cấp +20% công / +30% máu tối đa /
//     +50 tốc độ cho cả đội, chỉ có ở trận kế tiếp rồi mất (MSG_BRAVE_TRIAL_SCENE_INFO_*).
//   - Bản đồ làm mới theo chu kỳ (BoxCountDown).
// Số liệu máy chủ gốc (chu kỳ, cấp mở, thưởng, giá huy hiệu, mức hồi) không có trong client nên do bản web đặt.
import {requireCondition} from './errors.mjs';
import {heroAlbum,campaign,towerData} from './catalog.mjs';

export const braveConfig={minLevel:15,stages:15,cycleDays:2,altarStage:6,badgePrice:50,badgeBuyLimit:10,healRatio:.5,reviveRatio:.6,
 blessing:{rage:{stat:'attack',value:.2},rock:{stat:'maxHp',value:.3},storm:{stat:'speed',value:50}},milestones:[3,6,9,12,15]};
const it=(itemId,quantity)=>({itemId,quantity});
// Bảng thưởng từng ải (sửa được ở trang quản trị, server/reward-config.mjs).
export const braveStageTable=Array.from({length:15},(_,i)=>{const stage=i+1;return[it('gold',8000+stage*2500),it('consumable:2',60+stage*15),...(stage%5===0?[it('diamonds',20+stage*2)]:[])]});
export const stageRewards=stage=>braveStageTable[stage-1]||[];
export const milestoneRewards={3:[it('gold',50000),it('consumable:3',300)],6:[it('diamonds',60),it('consumable:16',1)],9:[it('gold',120000),it('consumable:2',600)],
 12:[it('diamonds',100),it('consumable:178',1)],15:[it('diamonds',200),it('consumable:37',1)]};
const DAY=86400000,vnDay=now=>Math.floor((now+7*3600000)/DAY);
export const braveCycle=now=>Math.floor((vnDay(now)-4)/braveConfig.cycleDays);
export const braveResetAt=now=>((braveCycle(now)+1)*braveConfig.cycleDays+4)*DAY-7*3600000;

const visuals={...campaign.visuals,...towerData.visuals};
const pool=heroAlbum.heroes.filter(h=>h.rank>=4&&visuals[h.avatar]?.skeleton&&visuals[h.avatar]?.head).map(h=>h.avatar).sort((a,b)=>a-b);
const byAvatar=new Map(heroAlbum.heroes.map(h=>[h.avatar,h]));
const hash=(a,b)=>{let x=(a*2654435761^b*40503)>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0};
export const braveEnemyCount=stage=>Math.min(6,2+Math.ceil(stage/3));
/** Đội hình ải (vị trí 1-2 hàng trước, 3-6 hàng sau như PopupBravePlayerNew FrontLine / BackLine). */
export function braveLineup(cycle,stage){
 const n=braveEnemyCount(stage),picked=[];
 for(let i=0;picked.length<n&&i<50;i++){const a=pool[hash(cycle+13,stage*17+i)%pool.length];if(!picked.includes(a))picked.push(a)}
 return picked.map((avatar,i)=>{const h=byAvatar.get(avatar);return{avatar,name:h.name,faction:h.faction,position:i+1}});
}
export const braveScale=stage=>.28+stage*.05;
export function braveEnemyStats(ref,stage,i){const k=braveScale(stage)*(1+i*.05);return{maxHp:Math.round(ref.maxHp*k*1.3),attack:Math.round(ref.attack*k),defense:Math.round(ref.defense*k),speed:Math.round(ref.speed*(.85+stage*.012))}}

const fresh=cycle=>({cycle,stage:1,hp:{},rage:{},enemyHp:null,ref:null,claimed:[],badges:3,bought:0,blessing:{rage:0,rock:0,storm:0}});
export function braveState(p,now=Date.now()){const c=braveCycle(now);if(p.brave?.cycle!==c)p.brave=fresh(c);return p.brave}
export function braveView(p,now=Date.now()){
 const s=braveState(p,now),done=s.stage>braveConfig.stages;
 return{cycle:s.cycle,resetAt:braveResetAt(now),minLevel:braveConfig.minLevel,unlocked:p.account.level>=braveConfig.minLevel,stages:braveConfig.stages,stage:s.stage,done,
  hp:s.hp,badges:s.badges,badgePrice:braveConfig.badgePrice,badgeBuyLeft:braveConfig.badgeBuyLimit-s.bought,blessing:s.blessing,altarOpen:s.stage>braveConfig.altarStage,altarStage:braveConfig.altarStage,
  milestones:braveConfig.milestones.map(m=>({stage:m,rewards:milestoneRewards[m],claimed:s.claimed.includes(m),ready:s.stage>m})),
  map:Array.from({length:braveConfig.stages},(_,i)=>{const stage=i+1,lineup=braveLineup(s.cycle,stage);return{stage,head:lineup[0].avatar,rewards:stageRewards(stage),
   enemies:lineup.map((e,j)=>({...e,hp:stage===s.stage?(s.enemyHp?.[j]??1):stage<s.stage?0:1,...(s.ref?braveEnemyStats(s.ref,stage,j):{})}))}})};
}
const requireOpen=p=>requireCondition(p.account.level>=braveConfig.minLevel,`Yêu cầu cấp độ ${braveConfig.minLevel}`,409,'BRAVE_LEVEL');
/**
 * Thao tác ngoài trận. ctx: {owned(id), grant, pay}
 * op: claim (rương mốc), buy-badge, revive {heroId}, heal, bless {kind: rage|rock|storm}
 */
export function braveAction(p,input,ctx,now=Date.now()){
 requireOpen(p);const s=braveState(p,now),op=input.op;
 if(op==='claim'){const m=Number(input.stage);requireCondition(braveConfig.milestones.includes(m),'Rương không hợp lệ.');requireCondition(s.stage>m,`Vượt qua ải ${m} để mở rương.`);requireCondition(!s.claimed.includes(m),'Đã nhận rương này.');
  s.claimed.push(m);milestoneRewards[m].forEach(ctx.grant);return{message:'Đã nhận rương.',rewards:milestoneRewards[m]}}
 if(op==='buy-badge'){const n=Number(input.count)||1;requireCondition(Number.isInteger(n)&&n>0&&s.bought+n<=braveConfig.badgeBuyLimit,'Đã hết lượt mua huy hiệu.');ctx.pay(it('diamonds',braveConfig.badgePrice*n));s.bought+=n;s.badges+=n;return{message:`Đã mua ${n} huy hiệu.`}}
 requireCondition(['revive','heal','bless'].includes(op),'Thao tác không hợp lệ.');
 requireCondition(s.stage>braveConfig.altarStage,`Hoàn thành màn ${braveConfig.altarStage} để mở khóa Tế đàn`,409,'BRAVE_ALTAR_LOCKED');
 requireCondition(s.badges>0,'Không đủ huy hiệu.',409,'BRAVE_NO_BADGE');
 if(op==='revive'){const id=input.heroId;requireCondition(ctx.owned(id)&&s.hp[id]===0,'Chọn thuyền viên đã ngã để hồi sinh.');s.hp[id]=braveConfig.reviveRatio;s.rage[id]=0}
 else if(op==='heal'){const hurt=Object.entries(s.hp).filter(([,v])=>v>0&&v<1);requireCondition(hurt.length,'Đội không có thuyền viên bị thương.');for(const [id,v] of hurt)s.hp[id]=Math.min(1,v+braveConfig.healRatio)}
 else{const kind=input.kind;requireCondition(braveConfig.blessing[kind],'Phước lành không hợp lệ.');s.blessing[kind]++}
 s.badges--;return{message:''};
}
/** Trước trận: kiểm tra đội (chỉ thuyền viên còn máu), trả máu/nộ đội ta, đội địch của ải và phước lành. ctx.stats(id) cho chỉ số tham chiếu lần đầu. */
export function prepareBraveFight(p,slots,ctx,now=Date.now()){
 requireOpen(p);const s=braveState(p,now);requireCondition(s.stage<=braveConfig.stages,'Đã vượt hết các ải. Hãy chờ làm mới.',409,'BRAVE_DONE');
 const ids=slots.filter(Boolean);requireCondition(ids.length,'Hãy chọn thuyền viên.');
 const dead=ids.find(id=>s.hp[id]===0);requireCondition(!dead,'Thuyền viên đã ngã không thể ra trận.',409,'BRAVE_HERO_DEAD');
 // Chỉ số tham chiếu cố định cho cả chu kỳ: trung bình 6 thuyền viên mạnh nhất lúc đánh trận đầu.
 if(!s.ref){const all=ctx.top().map(ctx.stats),avg=k=>Math.round(all.reduce((n,x)=>n+x[k],0)/all.length);s.ref={maxHp:avg('maxHp'),attack:avg('attack'),defense:avg('defense'),speed:avg('speed')}}
 const lineup=braveLineup(s.cycle,s.stage),enemies=lineup.map((e,i)=>{const st=braveEnemyStats(s.ref,s.stage,i);return{...e,...st,ratio:s.enemyHp?.[i]??1}});
 const b=braveConfig.blessing,boost={attack:1+s.blessing.rage*b.rage.value,maxHp:1+s.blessing.rock*b.rock.value,speed:s.blessing.storm*b.storm.value};
 return{allies:Object.fromEntries(ids.map(id=>[id,{ratio:s.hp[id]??1,rage:s.rage[id]??0}])),enemies,boost,meta:{cycle:s.cycle,stage:s.stage}};
}
/** Sau trận (thắng, thua, rút lui): lưu máu/nộ hai bên, phước lành hết; thắng thì qua ải, nhận thưởng và 1 huy hiệu. */
export function finishBrave(p,b,grant,now=Date.now()){
 const s=braveState(p,now),meta=b.brave;if(!meta||meta.cycle!==s.cycle||meta.stage!==s.stage)return null;
 for(const u of b.allies||[]){if(!u.heroId)continue;s.hp[u.heroId]=u.hp>0?Math.max(.01,u.hp/u.maxHp):0;s.rage[u.heroId]=u.hp>0?Math.min(100,u.energy||0):0}
 s.blessing={rage:0,rock:0,storm:0};
 const won=!b.enemies.some(e=>e.hp>0);
 if(!won){s.enemyHp=b.enemies.map(e=>e.hp/e.maxHp);return{won:false,stage:s.stage}}
 const stage=s.stage,rewards=stageRewards(stage);rewards.forEach(grant);s.stage++;s.enemyHp=null;s.badges++;
 return{won:true,stage,rewards,badge:1};
}
