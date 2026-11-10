// Thông thạo tướng (tab "Thông thạo" của PopupMasteringHero: BoxMasteringHeroes, BoxMasteringPoint, BoxMasteringQuest).
// Mỗi tướng có một bộ nhiệm vụ theo vòng (Lap); nhận một nhiệm vụ được điểm thông thạo + quà, nhận hết bộ thì sang
// vòng sau với mốc cao hơn. Tổng điểm của mọi tướng mở các mốc "Thông thạo tướng: đạt mốc %s điểm".
// Câu chữ nhiệm vụ lấy từ server_message gốc. Bản gốc còn nhiệm vụ Đơn đấu / Liên đấu / Chiến trường / Tổng bộ / Đảo trời
// nhưng bản web chưa có các chế độ đó, nên chỉ dùng [Cường hóa] và [Boss] (trận Chiến thần thú).
// Bảng mốc, điểm và quà nằm ở server gốc, không có trong asset; số dưới đây do bản web đặt.
import {requireCondition} from './errors.mjs';

export const laps=3;
export const masteryQuests=[
 {id:'level',text:'[Cường hóa] Nâng tới cấp %s',targets:[20,40,60],progress:(h)=>h.level},
 {id:'boss',text:'[Boss] Đánh boss %s lần',targets:[3,10,30],progress:(h,s)=>s.fights},
 {id:'damage',text:'[Boss] Khiêu chiến và sát thương được %s điểm',targets:[50000,500000,5000000],progress:(h,s)=>s.damage},
 {id:'ultimate',text:'[Boss] Xuất nộ %s lần',targets:[5,20,60],progress:(h,s)=>s.ultimates},
 {id:'attack',text:'[Boss] Đánh thường %s lần',targets:[10,40,120],progress:(h,s)=>s.attacks},
];
/** Điểm và quà của một nhiệm vụ ở vòng `lap` (bắt đầu từ 1). */
export const questPoints=lap=>10*lap;
export const questRewards=lap=>[{itemId:'gold',quantity:20000*lap},{itemId:'diamonds',quantity:10*lap}];
const summonItem='consumable:16';
export const milestones=[50,100,200,300,500,800,1200,1600,2000,3000].map((points,i)=>({points,rewards:[{itemId:'diamonds',quantity:100*(i+1)},{itemId:'gold',quantity:100000*(i+1)},{itemId:summonItem,quantity:i+1}]}));

const emptyStats=()=>({fights:0,damage:0,ultimates:0,attacks:0});
const state=p=>p.mastery||(p.mastery={points:0,milestones:[],heroes:{}});
const heroState=(p,heroId)=>{const m=state(p);return m.heroes[heroId]||(m.heroes[heroId]={lap:1,claimed:[],stats:emptyStats()})};
const owned=p=>[p.hero,...Object.values(p.reserveHeroes||{})].filter(Boolean);

/** Cộng số liệu trận boss cho từng tướng trong đội: số trận, sát thương, số lần xuất nộ và đánh thường. */
export function recordBossBattle(p,b){
 if(b.masteryRecorded)return;b.masteryRecorded=true;
 const heroOf=new Map((b.allies||[]).map(u=>[u.id,u.heroId]));
 for(const heroId of new Set(heroOf.values()))heroState(p,heroId).stats.fights++;
 for(const e of b.events||[]){
  const heroId=heroOf.get(e.actor);if(!heroId)continue;const s=heroState(p,heroId).stats;
  if(e.type==='damage'&&e.amount>0)s.damage+=e.amount;else if(e.type==='skill')s.ultimates++;else if(e.type==='attack')s.attacks++;
 }
}
function questsView(h,hs){
 const lap=Math.min(hs.lap,laps);
 return masteryQuests.map((q,i)=>{const target=q.targets[lap-1],progress=q.progress(h,hs.stats),claimed=hs.claimed.includes(i);
  return{index:i,text:q.text.replace('%s',target.toLocaleString('vi-VN')),progress,target,points:questPoints(lap),rewards:questRewards(lap),status:claimed?2:progress>=target?1:0}});
}
const finished=hs=>hs.lap>laps;
export function masteryView(p){
 const m=state(p);
 const heroes=owned(p).map(h=>{const hs=heroState(p,h.id),done=finished(hs),quests=done?[]:questsView(h,hs);return{heroId:h.id,lap:Math.min(hs.lap,laps),laps,done,ready:quests.some(q=>q.status===1),quests}});
 return{points:m.points,heroes,milestones:milestones.map(x=>({...x,status:m.milestones.includes(x.points)?2:m.points>=x.points?1:0}))};
}
export function claimMasteryQuest(p,input,grant){
 const h=owned(p).find(x=>x.id===input.heroId);requireCondition(h,'Bạn chưa sở hữu tướng này.',404);
 const hs=heroState(p,h.id),index=Number(input.quest);requireCondition(!finished(hs),'Tướng đã hoàn thành mọi vòng thông thạo.',409,'MASTERY_DONE');
 const quest=questsView(h,hs).find(q=>q.index===index);requireCondition(quest,'Nhiệm vụ không hợp lệ.',400);
 requireCondition(quest.status!==2,'Đã nhận nhiệm vụ này.',409,'MASTERY_CLAIMED');requireCondition(quest.status===1,'Chưa hoàn thành nhiệm vụ.',409,'MASTERY_NOT_DONE');
 hs.claimed.push(index);state(p).points+=quest.points;quest.rewards.forEach(grant);
 if(hs.claimed.length===masteryQuests.length){hs.lap++;hs.claimed=[]}
 return{message:`Nhận ${quest.points} điểm thông thạo.`,rewards:quest.rewards};
}
export function claimMasteryMilestone(p,input,grant){
 const m=state(p),mark=milestones.find(x=>x.points===Number(input.points));requireCondition(mark,'Mốc không hợp lệ.',400);
 requireCondition(!m.milestones.includes(mark.points),'Đã nhận mốc này.',409,'MASTERY_MILESTONE_CLAIMED');
 requireCondition(m.points>=mark.points,'Chưa đủ điểm thông thạo.',409,'MASTERY_MILESTONE_LOCKED');
 m.milestones.push(mark.points);mark.rewards.forEach(grant);
 return{message:`Thông thạo tướng: đạt mốc ${mark.points} điểm`,rewards:mark.rewards};
}
