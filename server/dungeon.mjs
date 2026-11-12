// Đảo Bánh (Aspen Dungeon gốc: DungeonScene, DungeonFlagPole, DungeonLotion, DungeonMerchantMen, PopupSmashedMerchants...).
// Luật theo db_help gốc ("Địa lao") và tên lớp/trường trong global-metadata:
//   - Chọn 5 thuyền viên mạnh nhất (BoxHeroes 5 ô) để vượt các ải khó dần. Mỗi trận chỉ cử 1 thuyền viên (DUNGEON_SELECT_HERO)
//     đánh đội hình của ải (PopupDungeonStageHero, tối đa 6 tướng). Máu của thuyền viên và của địch được giữ lại
//     giữa các trận cho tới khi qua ải; thuyền viên hết máu không ra trận được nữa.
//   - Qua ải có thể nhận vật phẩm tiêu thụ: LOTION_HP_1..3 hồi máu (dùng cho thuyền viên đang chọn, DUNGEON_USE_POTION),
//     LOTION_BUFF_1..3 tăng Công / Nộ / Máu cho cả đội, tối đa 20 tầng mỗi loại (FieldLotionBuff "x/20").
//   - Có thể gặp gian thương (MERCHANT_OLD_MAN / SCAM_BOY / YOUNG_LADY) bán một món (PopupDungeonBuyItem); bỏ qua
//     (ButtonSkipMerchant) thì món đó vào Cửa hàng Đảo Bánh (PopupSmashedMerchants -> PopupSmashedShop) để mua sau.
//   - Đảo mở theo chu kỳ (BoxCountdownClose "Kết thúc sau" / BoxCountdownOpen "Mở sau"), hết chu kỳ thì làm lại từ ải 1.
//   - Bảng Top đảo bánh (TOP_DUNGEON) xếp theo số ải đã qua trong chu kỳ.
// Số liệu máy chủ gốc (số ải, chu kỳ, cấp mở, tỉ lệ rơi, giá) không có trong client nên do bản web đặt.
import {requireCondition} from './errors.mjs';
import {heroAlbum,campaign,towerData} from './catalog.mjs';

export const dungeonConfig={minLevel:20,stages:60,teamSize:5,openDays:2,closedDays:1,buffMax:20,
 hpLotions:{1:.3,2:.6,3:1},buffs:{1:{stat:'attack',value:.03},2:{stat:'energy',value:5},3:{stat:'maxHp',value:.03}}};
const it=(itemId,quantity)=>({itemId,quantity});
// Gian thương: 1 Tiệm Mắt To, 2 Tiệm Hạt Đậu, 3 Tiệm Răng Sún. Mỗi món có giá gốc và giá bán rẻ.
// Thưởng qua từng ải (sửa được ở trang quản trị, server/reward-config.mjs).
export const dungeonStageTable=Array.from({length:dungeonConfig.stages},(_,i)=>{const stage=i+1;return[it('gold',4000+stage*600),...(stage%5===0?[it('diamonds',10+stage),it('consumable:2',100+stage*10)]:[])]});
export const merchantGoods={
 1:[{reward:it('consumable:16',2),price:it('diamonds',60)},{reward:it('consumable:2',500),price:it('diamonds',50)},{reward:it('spirit',100000),price:it('gold',60000)},{reward:it('consumable:35',1),price:it('diamonds',90)}],
 2:[{reward:it('consumable:3',500),price:it('gold',80000)},{reward:it('consumable:178',1),price:it('diamonds',120)},{reward:it('gold',300000),price:it('diamonds',80)},{reward:it('consumable:1',10),price:it('gold',50000)}],
 3:[{reward:it('consumable:37',1),price:it('diamonds',200)},{reward:it('consumable:10',5),price:it('diamonds',70)},{reward:it('consumable:53',1),price:it('diamonds',300)},{reward:it('consumable:2',1500),price:it('diamonds',120)}],
};
const lotionPool=[['hp',1,30],['hp',2,18],['hp',3,7],['buff',1,15],['buff',2,15],['buff',3,15]];
const DAY=86400000,cycleDays=dungeonConfig.openDays+dungeonConfig.closedDays;
const vnDay=now=>Math.floor((now+7*3600000)/DAY);
// Chu kỳ tính từ thứ Hai 1970-01-05 giờ Việt Nam: 2 ngày mở, 1 ngày đóng.
export const cycleOf=now=>Math.floor((vnDay(now)-4)/cycleDays);
const cycleStart=c=>(c*cycleDays+4)*DAY-7*3600000;
export function dungeonClock(now=Date.now()){const c=cycleOf(now),start=cycleStart(c),closeAt=start+dungeonConfig.openDays*DAY,next=start+cycleDays*DAY;return{cycle:c,open:now<closeAt,closeAt,openAt:now<closeAt?start:next}}

const visuals={...campaign.visuals,...towerData.visuals};
const pool=heroAlbum.heroes.filter(h=>h.rank>=4&&visuals[h.avatar]?.skeleton&&visuals[h.avatar]?.head).map(h=>h.avatar).sort((a,b)=>a-b);
const byAvatar=new Map(heroAlbum.heroes.map(h=>[h.avatar,h]));
const hash=(a,b)=>{let x=(a*73856093^b*19349663)>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0};
export const enemyCount=stage=>Math.min(6,3+Math.floor((stage-1)/15));
/** Đội địch của ải: tướng (avatar, vị trí 1..6) và hệ số sức mạnh so với chỉ số trung bình của đội người chơi. */
export function stageLineup(cycle,stage){
 const n=enemyCount(stage),picked=[];
 for(let i=0;picked.length<n&&i<40;i++){const a=pool[hash(cycle+7,stage*31+i)%pool.length];if(!picked.includes(a))picked.push(a)}
 const order=[1,2,3,4,5,6].slice(0,n);
 return picked.map((avatar,i)=>{const h=byAvatar.get(avatar);return{avatar,name:h.name,faction:h.faction,rank:h.rank,position:order[i]}});
}
export const stageScale=stage=>.2+stage*.018;
/** Chỉ số một tướng địch dựng từ chỉ số tham chiếu (trung bình đội đã chọn lúc vào đảo). */
export function enemyStats(ref,stage,i){const k=stageScale(stage)*(1+i*.06);return{maxHp:Math.round(ref.maxHp*k*1.4),attack:Math.round(ref.attack*k),defense:Math.round(ref.defense*k),speed:Math.round(ref.speed*(.8+stage*.004))}}

function fresh(cycle){return{cycle,team:[],ref:null,hp:{},rage:{},stage:1,enemyHp:null,node:null,lotions:{1:0,2:0,3:0},buffs:{1:0,2:0,3:0},smashed:{1:[],2:[],3:[]},best:0,selected:null}}
export function dungeonState(p,now=Date.now()){const {cycle}=dungeonClock(now);if(p.dungeon?.cycle!==cycle)p.dungeon=fresh(cycle);return p.dungeon}

export function dungeonView(p,now=Date.now()){
 const d=dungeonState(p,now),clock=dungeonClock(now),done=d.stage>dungeonConfig.stages;
 const lineup=done?[]:stageLineup(d.cycle,d.stage);
 return{...clock,minLevel:dungeonConfig.minLevel,unlocked:p.account.level>=dungeonConfig.minLevel,stages:dungeonConfig.stages,stage:d.stage,best:d.best,done,
  team:d.team.map(id=>({id,hp:d.hp[id]??1,rage:d.rage[id]??0})),selected:d.selected,node:d.node,lotions:d.lotions,buffs:d.buffs,buffMax:dungeonConfig.buffMax,
  smashed:Object.fromEntries(Object.entries(d.smashed).map(([k,v])=>[k,v])),
  enemies:lineup.map((e,i)=>({...e,hp:d.enemyHp?.[i]??1,...(d.ref?enemyStats(d.ref,d.stage,i):{})}))};
}
const requireOpen=(p,now)=>{requireCondition(p.account.level>=dungeonConfig.minLevel,`Yêu cầu cấp độ ${dungeonConfig.minLevel}`,409,'DUNGEON_LEVEL');requireCondition(dungeonClock(now).open,'Đảo bánh đang đóng cửa.',409,'DUNGEON_CLOSED')};
const pick=(list,rand)=>{const total=list.reduce((n,x)=>n+x.at(-1),0);let r=rand()*total;for(const x of list){if(r<x.at(-1))return x;r-=x.at(-1)}return list.at(-1)};

/**
 * Thao tác ngoài trận. ctx: {owned(heroId)->bool, stats(heroId)->{maxHp,attack,defense,speed}, grant, pay, random}
 * op: team (chọn 5 thuyền viên), select, collect (nhặt vật phẩm ở ải), use-hp (dùng bình máu 1..3), buy / skip (gian thương),
 *     smashed-buy (mua lại ở Cửa hàng Đảo Bánh).
 */
export function dungeonAction(p,input,ctx,now=Date.now()){
 requireOpen(p,now);const d=dungeonState(p,now),op=input.op;
 if(op==='team'){
  requireCondition(!d.team.length,'Đội đã chọn cho chu kỳ này.',409,'DUNGEON_TEAM_SET');
  const ids=[...new Set((input.heroes||[]).filter(Boolean))];
  requireCondition(ids.length>=1&&ids.length<=dungeonConfig.teamSize,`Chọn từ 1 đến ${dungeonConfig.teamSize} thuyền viên.`);
  requireCondition(ids.every(id=>ctx.owned(id)),'Thuyền viên không hợp lệ.');
  const stats=ids.map(ctx.stats),avg=k=>Math.round(stats.reduce((n,s)=>n+s[k],0)/stats.length);
  d.team=ids;d.ref={maxHp:avg('maxHp'),attack:avg('attack'),defense:avg('defense'),speed:avg('speed')};d.hp=Object.fromEntries(ids.map(id=>[id,1]));d.rage=Object.fromEntries(ids.map(id=>[id,0]));d.selected=ids[0];
  return{message:'Đã chọn đội.'};
 }
 requireCondition(d.team.length,'Hãy chọn đội trước.',409,'DUNGEON_NO_TEAM');
 if(op==='select'){requireCondition(d.team.includes(input.heroId),'Thuyền viên không hợp lệ.');d.selected=input.heroId;return{message:''}}
 if(op==='use-hp'){
  const k=Number(input.lotion),heal=dungeonConfig.hpLotions[k];requireCondition(heal,'Vật phẩm không hợp lệ.');requireCondition(d.lotions[k]>0,'Không đủ vật phẩm.');
  const id=input.heroId||d.selected;requireCondition(d.team.includes(id),'Thuyền viên không hợp lệ.');
  requireCondition(k===3||d.hp[id]>0,'Thuyền viên đã ngã, chỉ bình máu lớn mới hồi sinh được.');requireCondition(d.hp[id]<1,'Máu đã đầy.');
  d.lotions[k]--;d.hp[id]=Math.min(1,(d.hp[id]||0)+heal);return{message:'',heroId:id,hp:d.hp[id]};
 }
 if(op==='collect'){
  requireCondition(d.node?.type==='lotion','Không có vật phẩm để nhặt.');const {kind,id}=d.node;d.node=null;
  if(kind==='hp')d.lotions[id]++;else d.buffs[id]=Math.min(dungeonConfig.buffMax,d.buffs[id]+1);
  return{message:'',lotion:{kind,id}};
 }
 if(op==='buy'){
  requireCondition(d.node?.type==='merchant','Không có gian thương.');const good=d.node.good;ctx.pay(good.price);ctx.grant(good.reward);d.node=null;
  return{message:'Mua thành công.',rewards:[good.reward]};
 }
 if(op==='skip'){requireCondition(d.node?.type==='merchant','Không có gian thương.');d.smashed[d.node.merchant].push(d.node.good);d.node=null;return{message:''}}
 if(op==='smashed-buy'){
  const list=d.smashed[Number(input.merchant)],i=Number(input.index);requireCondition(list&&list[i],'Món hàng không hợp lệ.');
  const good=list[i];ctx.pay(good.price);ctx.grant(good.reward);list.splice(i,1);return{message:'Mua thành công.',rewards:[good.reward]};
 }
 throw new Error('Thao tác không hợp lệ.');
}
/** Kiểm tra trước trận: trả về thuyền viên ra trận và đội địch (chỉ số + máu còn lại) cho game.mjs dựng trận. */
export function prepareDungeonFight(p,input,now=Date.now()){
 requireOpen(p,now);const d=dungeonState(p,now);
 requireCondition(d.team.length,'Hãy chọn đội trước.',409,'DUNGEON_NO_TEAM');requireCondition(d.stage<=dungeonConfig.stages,'Đã vượt hết các ải.',409,'DUNGEON_DONE');
 requireCondition(!d.node,d.node?.type==='merchant'?'Hãy mua hoặc bỏ qua gian thương.':'Hãy nhặt vật phẩm trước.',409,'DUNGEON_NODE');
 const id=input.heroId||d.selected;requireCondition(d.team.includes(id),'Thuyền viên không hợp lệ.');requireCondition((d.hp[id]??1)>0,'Thuyền viên đã hết máu.',409,'DUNGEON_HERO_DEAD');
 d.selected=id;const lineup=stageLineup(d.cycle,d.stage);
 const enemies=lineup.map((e,i)=>{const s=enemyStats(d.ref,d.stage,i),ratio=d.enemyHp?.[i]??1;return{...e,...s,hp:Math.max(0,Math.round(s.maxHp*ratio))}});
 const b=d.buffs,cfg=dungeonConfig.buffs;
 return{heroId:id,hpRatio:d.hp[id]??1,rage:Math.min(100,(d.rage[id]??0)+b[2]*cfg[2].value),boost:{attack:1+b[1]*cfg[1].value,maxHp:1+b[3]*cfg[3].value},enemies,meta:{cycle:d.cycle,stage:d.stage,heroId:id}};
}
/** Sau trận (thắng, thua hay rút lui): lưu máu / nộ còn lại; thắng thì qua ải, nhận thưởng và có thể gặp vật phẩm hoặc gian thương. */
export function finishDungeon(p,b,grant,rand=Math.random,now=Date.now()){
 const d=dungeonState(p,now),meta=b.dungeon;if(!meta||meta.cycle!==d.cycle||meta.stage!==d.stage)return null;
 const ally=(b.allies||[])[0];if(ally){d.hp[meta.heroId]=ally.hp>0?Math.max(.01,ally.hp/ally.maxHp):0;d.rage[meta.heroId]=ally.hp>0?Math.min(100,ally.energy||0):0}
 const won=!b.enemies.some(e=>e.hp>0);
 if(!won){d.enemyHp=b.enemies.map(e=>e.hp/e.maxHp);return{won:false,stage:d.stage}}
 const stage=d.stage,rewards=structuredClone(dungeonStageTable[stage-1]||[]);
 rewards.forEach(grant);d.stage++;d.best=Math.max(d.best,stage);d.enemyHp=null;
 if(d.stage<=dungeonConfig.stages){const r=rand();
  if(r<.45){const [kind,id]=pick(lotionPool,rand);d.node={type:'lotion',kind,id}}
  else if(r<.65){const merchant=1+Math.floor(rand()*3),goods=merchantGoods[merchant],good=goods[Math.floor(rand()*goods.length)];d.node={type:'merchant',merchant,good}}}
 return{won:true,stage,rewards,node:d.node};
}
export const dungeonRankingEntry=p=>({cycle:p.dungeon?.cycle??null,best:p.dungeon?.best||0});
