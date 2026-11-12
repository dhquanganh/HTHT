// Tổng bộ (Tarven gốc: TarvenScene, CellTarvenQuest, PopupTarvenQuest, SlotHeroQuest, TarvenQuestRequirementUI).
// Luật theo tên lớp/trường trong global-metadata và chữ gốc:
//   - Mỗi ngày nhận một bảng nhiệm vụ 1..7 sao (TarvenQuestStar), số nhiệm vụ theo VIP (db_vip.tavern_quest: 6..16).
//   - Nhiệm vụ có trạng thái STATE_WAITING / STATE_ON_PROCESS / STATE_COMPLETED, thời gian (m_TimeTotal), 1 phần thưởng
//     (m_RewardItem) và yêu cầu thuyền viên (QuestRequirement: REQUIREMENT_STAR / REQUIREMENT_FACTION / REQUIREMENT_CLASS).
//   - Cử thuyền viên vào các ô (SlotHeroQuest) cho đủ yêu cầu (MSG_POPUP_TARVEN_QUEST_ENTER_ENOUGHT_CREW,
//     MSG_POPUP_TARVEN_QUEST_SAILOR_INCORRECT). Thuyền viên không bị mất, mỗi người chỉ làm 1 nhiệm vụ một lúc
//     (MSG_POPUP_TARVEN_QUEST_HELP, GetListHeroIdDoingQuest).
//   - Đang làm: Hoàn thành ngay bằng kim cương (TARVEN_SPEED_UP_QUEST, MSG_CELL_TARVEN_QUEST_SPEED_CLICK) hoặc Hủy
//     (TARVEN_CANCEL_QUEST). Xong thì Nhận (TARVEN_COMPLETED_QUEST).
//   - Làm mới bằng kim cương (TARVEN_REFRESH, m_GemRefreshPerQuest: giá theo số nhiệm vụ bị thay); nhiệm vụ đã khoá
//     (TARVEN_SWITCH_LOCK_QUEST) không mất khi làm mới; hỏi lại nếu còn nhiệm vụ 4 sao trở lên (MSG_TARVEN_SCENE_DESC).
//   - Dùng cuộn để thêm nhiệm vụ (TARVEN_GEN_QUEST): "Nhiệm vụ thường" (consumable:17) 1-3 sao, "Nhiệm vụ khó"
//     (consumable:18) 4-7 sao.
// Số liệu máy chủ gốc (tỉ lệ sao, thời gian, yêu cầu, thưởng, giá) không có trong client nên do bản web đặt.
import {requireCondition} from './errors.mjs';
import {definitionFor} from './catalog.mjs';
import {vipRow} from './vip.mjs';

const it=(itemId,quantity)=>({itemId,quantity});
export const tavernConfig={minLevel:10,baseQuests:5,gemPerQuest:10,gemPerMinute:1/6,maxQuests:30,
 scrolls:{basic:{item:'consumable:17',stars:[1,2,3]},senior:{item:'consumable:18',stars:[4,5,6,7]}},
 // Tỉ lệ sao khi tạo nhiệm vụ hằng ngày / làm mới (%).
 rates:{1:30,2:28,3:22,4:12,5:5.5,6:2,7:.5},
 hours:{1:1,2:2,3:3,4:4,5:6,6:8,7:12},
 slots:{1:1,2:2,3:2,4:3,5:3,6:4,7:5}};
export const factions=['abyss','light','dark','forest','fortress','shadow'];
export const classes=['fighter','mage','priest','warrior','ranger','assassin'];
// Phần thưởng theo sao: mỗi nhiệm vụ 1 món.
export const rewardPool={
 1:[it('gold',20000),it('consumable:2',80),it('consumable:1',40)],
 2:[it('gold',40000),it('consumable:2',160),it('consumable:3',100)],
 3:[it('gold',80000),it('consumable:3',200),it('diamonds',20)],
 4:[it('diamonds',40),it('consumable:16',1),it('gold',160000)],
 5:[it('diamonds',80),it('consumable:16',2),it('consumable:35',1)],
 6:[it('diamonds',150),it('consumable:178',1),it('consumable:16',4)],
 7:[it('diamonds',300),it('consumable:37',1),it('consumable:178',2)]};

const DAY=86400000,vnDay=now=>Math.floor((now+7*3600000)/DAY);
export const tavernResetAt=now=>(vnDay(now)+1)*DAY-7*3600000;
export const dailyQuestCount=p=>vipRow(p.vip||0)?.tavern||tavernConfig.baseQuests;
const rng=s=>()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
const pick=(r,a)=>a[Math.floor(r()*a.length)];
function rollStar(r,allowed=[1,2,3,4,5,6,7]){const total=allowed.reduce((n,s)=>n+tavernConfig.rates[s],0);let x=r()*total;for(const s of allowed){x-=tavernConfig.rates[s];if(x<0)return s}return allowed.at(-1)}
/** Tạo 1 nhiệm vụ. Yêu cầu: luôn có 1 yêu cầu sao (từ 3 sao trở lên), thêm hệ / nghề tuỳ độ khó. */
export function makeQuest(id,star,r){
 const slots=tavernConfig.slots[star],req=[];
 if(star>=3)req.push({type:'star',value:star-1,count:Math.min(slots,star>=6?2:1)});
 if(star>=2)req.push({type:'faction',value:pick(r,factions),count:Math.min(slots,star>=5?2:1)});
 if(star>=4)req.push({type:'class',value:pick(r,classes),count:1});
 return{id,star,slots,req,duration:tavernConfig.hours[star]*3600000,reward:pick(r,rewardPool[star]),state:'waiting',locked:false,heroes:[],startAt:0};
}
function fresh(p,day){return{day,seq:0,quests:[],refreshes:0}}
function addQuests(s,n,seed,allowed){const r=rng(seed);for(let i=0;i<n&&s.quests.length<tavernConfig.maxQuests;i++)s.quests.push(makeQuest(++s.seq,rollStar(r,allowed),r))}
export function tavernState(p,now=Date.now()){
 const day=vnDay(now);
 if(!p.tavern)p.tavern=fresh(p,day-1);
 const s=p.tavern;
 if(s.day!==day){
  // Sang ngày mới: giữ nhiệm vụ đã khoá, đang làm, đã xong; thay phần còn lại bằng bảng mới.
  s.quests=s.quests.filter(q=>q.locked||q.state!=='waiting');s.day=day;s.refreshes=0;
  addQuests(s,Math.max(0,dailyQuestCount(p)-s.quests.filter(q=>q.state==='waiting').length),day*977+(s.seq+1)*31);
 }
 return s;
}
const stateOf=(q,now)=>q.state==='running'&&now>=q.startAt+q.duration?'done':q.state;
export const speedUpCost=(q,now)=>Math.max(1,Math.ceil(Math.max(0,q.startAt+q.duration-now)/60000*tavernConfig.gemPerMinute));
const busyHeroes=s=>new Set(s.quests.filter(q=>q.state!=='waiting').flatMap(q=>q.heroes));
const refreshTargets=s=>s.quests.filter(q=>q.state==='waiting'&&!q.locked);
export const refreshCost=s=>Math.max(1,refreshTargets(s).length)*tavernConfig.gemPerQuest;
export function tavernView(p,now=Date.now()){
 const s=tavernState(p,now);
 return{unlocked:p.account.level>=tavernConfig.minLevel,minLevel:tavernConfig.minLevel,resetAt:tavernResetAt(now),daily:dailyQuestCount(p),refreshCost:refreshCost(s),
  scrollItems:{basic:tavernConfig.scrolls.basic.item,senior:tavernConfig.scrolls.senior.item},rates:tavernConfig.rates,hours:tavernConfig.hours,busy:[...busyHeroes(s)],
  quests:s.quests.map(q=>({...q,state:stateOf(q,now),endAt:q.state==='waiting'?0:q.startAt+q.duration,speedUp:q.state==='running'?speedUpCost(q,now):0}))
   .sort((a,b)=>({done:0,running:1,waiting:2}[a.state]-{done:0,running:1,waiting:2}[b.state])||b.star-a.star||a.id-b.id)};
}
/** Kiểm tra đội cử đi có thoả yêu cầu: mỗi yêu cầu cần ít nhất `count` thuyền viên đạt. */
export function satisfies(quest,heroes){
 return quest.req.every(r=>heroes.filter(h=>r.type==='star'?h.stars>=r.value:r.type==='faction'?h.faction===r.value:h.class===r.value).length>=r.count);
}
/**
 * ctx: {owned: Map id->hero, grant, pay, inventory: id->số lượng, spendItem(id,n)}
 * op: start {questId, heroes[]}, cancel, speed-up, claim, lock, refresh, scroll {kind: basic|senior}
 */
export function tavernAction(p,input,ctx,now=Date.now()){
 requireCondition(p.account.level>=tavernConfig.minLevel,`Yêu cầu cấp độ ${tavernConfig.minLevel}`,409,'TAVERN_LEVEL');
 const s=tavernState(p,now),op=input.op;
 if(op==='refresh'){
  const targets=refreshTargets(s);requireCondition(targets.length,'Không có nhiệm vụ nào để làm mới.');ctx.pay(it('diamonds',refreshCost(s)));
  const n=targets.length;s.quests=s.quests.filter(q=>!targets.includes(q));s.refreshes++;addQuests(s,n,s.day*131+s.refreshes*7919+s.seq);return{message:'Đã làm mới nhiệm vụ.'};
 }
 if(op==='scroll'){
  const sc=tavernConfig.scrolls[input.kind];requireCondition(sc,'Cuộn không hợp lệ.');requireCondition(s.quests.length<tavernConfig.maxQuests,'Bảng nhiệm vụ đã đầy.');
  requireCondition((ctx.inventory(sc.item)||0)>0,'Không đủ cuộn nhiệm vụ.',409,'TAVERN_NO_SCROLL');ctx.spendItem(sc.item,1);
  addQuests(s,1,now%1000003+s.seq*17,sc.stars);const q=s.quests.at(-1);return{message:`Nhận nhiệm vụ ${q.star} sao.`,questId:q.id};
 }
 const q=s.quests.find(x=>x.id===Number(input.questId));requireCondition(q,'Nhiệm vụ không tồn tại.',404);
 const st=stateOf(q,now);
 if(op==='lock'){requireCondition(st==='waiting','Chỉ khoá được nhiệm vụ chưa làm.');q.locked=!q.locked;return{message:q.locked?'Đã khoá nhiệm vụ.':'Đã mở khoá nhiệm vụ.'}}
 if(op==='start'){
  requireCondition(st==='waiting','Nhiệm vụ đã bắt đầu.');
  const ids=[...new Set((input.heroes||[]).filter(Boolean))];
  requireCondition(ids.length===q.slots,'Hãy nhập đủ Thuyền viên',409,'TAVERN_CREW');
  const busy=busyHeroes(s);requireCondition(ids.every(id=>ctx.owned.has(id)),'Thuyền viên không hợp lệ.');
  requireCondition(!ids.some(id=>busy.has(id)),'Thuyền viên đang làm nhiệm vụ khác.',409,'TAVERN_BUSY');
  const heroes=ids.map(id=>{const d=definitionFor(id);return{stars:ctx.owned.get(id).stars||1,faction:d.faction,class:d.class}});
  requireCondition(satisfies(q,heroes),'Thuyền viên không thỏa mãn yêu cầu',409,'TAVERN_REQUIREMENT');
  Object.assign(q,{state:'running',heroes:ids,startAt:now,locked:false});return{message:'Bắt đầu nhiệm vụ.'};
 }
 if(op==='cancel'){requireCondition(st==='running','Nhiệm vụ chưa bắt đầu.');Object.assign(q,{state:'waiting',heroes:[],startAt:0});return{message:'Đã hủy nhiệm vụ.'}}
 if(op==='speed-up'){requireCondition(st==='running','Nhiệm vụ không đang làm.');ctx.pay(it('diamonds',speedUpCost(q,now)));q.startAt=now-q.duration;return{message:'Đã hoàn thành nhiệm vụ.'}}
 if(op==='claim'){requireCondition(st==='done','Nhiệm vụ chưa hoàn thành.');s.quests=s.quests.filter(x=>x!==q);ctx.grant(q.reward);return{message:'Đã nhận thưởng.',rewards:[q.reward],star:q.star}}
 requireCondition(false,'Thao tác không hợp lệ.');
}
