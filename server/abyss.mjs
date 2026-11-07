// Vực thẳm (event_abyss): 20 ải trên bản đồ MainScene, mỗi ải 3 nhiệm vụ = 3 sao, tối đa 60 sao một mùa.
// Nhiệm vụ: Chiến thắng / Thắng với ít nhất 2 tướng hệ X / Thắng với ít nhất 3 tướng hệ X (QuestWarrior, QuestElite, QuestMaster).
// Mỗi nhiệm vụ đạt được thì rương của nó sáng lên để nhận. Ải sau mở khi đã thắng ải trước.
// Mỗi ải có 3 lượt đánh mỗi ngày, mua thêm bằng kim cương (AbyssPopupBuyTurn). Mùa kéo dài 7 ngày rồi làm mới;
// đủ sao thì nhận quà mốc ở nút quà (PopupSelectReward, chọn 1 phần quà).
// Đội địch là đội tướng (PbUser.team: heroId, star, level + chiến hạm) do server gốc gửi qua ABYSS_STATUS_DETAIL.
// Ải 1 lấy đúng như ảnh gốc: Killer, Zoro - S | Luffy - S, Califa, Akainu, Caesar, cấp 160, 2 sao tím (7 sao), lực chiến 318338.
// Các ải sau không có trong asset nên dựng theo cùng khuôn: 2 tướng hệ của ải ở hàng sau + 4 tướng hệ khác,
// cấp theo db_tower (tầng 200 + 50/ải), lực chiến tăng theo tỉ lệ lực chiến tầng đó.
import {requireCondition} from './errors.mjs';
import {heroAlbum,campaign,towerData} from './catalog.mjs';

export const abyssStages=20,abyssTurns=3,abyssBuyPrice=50,abyssBuyLimit=5,seasonDays=7;
const card='consumable:100045';
export const factionNames={forest:'Sinh Khí',abyss:'Bền Bỉ',fortress:'Nhanh Nhẹn',shadow:'Chính Xác',light:'Thông Minh',dark:'Minh Mẫn'};
const factionOrder=['forest','abyss','fortress','shadow','light','dark'];
export const stageFaction=stage=>factionOrder[(stage-1)%factionOrder.length];
export const stageFloor=stage=>200+(stage-1)*50;
const visuals={...campaign.visuals,...towerData.visuals},byAvatar=new Map(heroAlbum.heroes.map(h=>[h.avatar,h]));
const towerRow=stage=>towerData.floors[Math.min(stageFloor(stage),towerData.floors.length)-1];
const firstStage=['92','69','109','182','143','123'];
const pools=Object.fromEntries(factionOrder.map(f=>[f,heroAlbum.heroes.filter(h=>h.faction===f&&h.rank>=5&&visuals[h.avatar]?.skeleton&&visuals[h.avatar]?.head).map(h=>h.avatar).sort((a,b)=>a-b)]));
const pickFrom=(faction,stage,offset)=>{const pool=pools[faction],at=Math.min(pool.length-1,Math.floor((stage-1)/(abyssStages-1)*(pool.length-2))+offset);return pool[(at+pool.length)%pool.length]};
function lineupAvatars(stage){
 if(stage===1)return firstStage;
 const faction=stageFaction(stage),others=factionOrder.filter(f=>f!==faction),start=(stage-1)%others.length,rest=[0,1,2,3].map(i=>others[(start+i)%others.length]);
 return[pickFrom(rest[0],stage,0),pickFrom(rest[1],stage,0),pickFrom(rest[2],stage,0),pickFrom(faction,stage,0),pickFrom(rest[3],stage,0),pickFrom(faction,stage,1)];
}
/** Đội địch của một ải: 6 tướng theo vị trí 1..6 (2 hàng trước, 4 hàng sau) và lực chiến hiển thị. */
export function stageEnemies(stage){
 const row=towerRow(stage),level=stage===1?160:row.level,stars=Math.min(15,7+Math.floor((stage-1)/4));
 return{power:Math.round(318338*row.power/towerRow(1).power),heroes:lineupAvatars(stage).map((avatar,i)=>{const h=byAvatar.get(avatar);return{avatar,name:h.name,faction:h.faction,level,stars,position:i+1}})};
}
export function questsOf(stage){
 const faction=factionNames[stageFaction(stage)];
 return[
  {text:'Chiến thắng',need:0,rewards:[{itemId:'gold',quantity:30000+stage*10000}]},
  {text:`Thắng với ít nhất 2 tướng hệ ${faction}`,need:2,rewards:[{itemId:card,quantity:10+stage*2}]},
  {text:`Thắng với ít nhất 3 tướng hệ ${faction}`,need:3,rewards:[{itemId:'diamonds',quantity:20+stage*2},{itemId:card,quantity:15+stage*2}]},
 ];
}
/** Rương kho báu: cứ mỗi 6 sao mở một ô, mỗi ô chọn một trong ba phần quà. */
export const starMilestones=Array.from({length:10},(_,i)=>({stars:6*(i+1),options:[{itemId:card,quantity:50*(i+1)},{itemId:'diamonds',quantity:50*(i+1)},{itemId:'gold',quantity:150000*(i+1)}]}));

const day=now=>Math.floor((now+7*3600000)/86400000);
// Mùa bắt đầu thứ Hai 00:00 giờ Việt Nam (1970-01-05 là thứ Hai).
const seasonOf=now=>Math.floor((day(now)-4)/seasonDays);
export const seasonEnds=now=>((seasonOf(now)+1)*seasonDays+4)*86400000-7*3600000;
const emptyStage=()=>({quests:[0,0,0],used:0,bought:0,day:0});
function state(p,now){
 const season=seasonOf(now);
 if(!p.abyss||p.abyss.season!==season)p.abyss={season,stages:Array.from({length:abyssStages},emptyStage),milestones:{}};
 for(const s of p.abyss.stages)if(s.day!==day(now)){s.day=day(now);s.used=0;s.bought=0}
 return p.abyss;
}
const starsOf=a=>a.stages.reduce((n,s)=>n+s.quests.filter(q=>q>0).length,0);
const unlocked=(a,stage)=>stage===1||a.stages[stage-2].quests[0]>0;
export function abyssView(p,now=Date.now()){
 const a=state(p,now),stars=starsOf(a);
 return{season:a.season,endsAt:seasonEnds(now),stars,maxStars:abyssStages*3,buyPrice:abyssBuyPrice,buyLimit:abyssBuyLimit,
  stages:a.stages.map((s,i)=>({stage:i+1,faction:stageFaction(i+1),factionName:factionNames[stageFaction(i+1)],floor:stageFloor(i+1),enemies:stageEnemies(i+1),unlocked:unlocked(a,i+1),quests:questsOf(i+1).map((q,j)=>({text:q.text,rewards:q.rewards,status:s.quests[j]})),turns:abyssTurns+s.bought-s.used,maxTurns:abyssTurns,bought:s.bought})),
  milestones:starMilestones.map(m=>({...m,claimed:a.milestones[m.stars]??null,ready:stars>=m.stars}))};
}
const stageOf=input=>{const stage=Number(input.stage);requireCondition(Number.isInteger(stage)&&stage>=1&&stage<=abyssStages,'Ải không hợp lệ.',400,'ABYSS_STAGE');return stage};
/** Giữ một lượt cho trận; trả về meta để lúc thắng biết ải và mùa. */
export function startAbyss(p,input,now=Date.now()){
 const a=state(p,now),stage=stageOf(input),s=a.stages[stage-1];
 requireCondition(unlocked(a,stage),'Chưa đủ điều kiện mở khóa',409,'ABYSS_LOCKED');
 requireCondition(abyssTurns+s.bought-s.used>0,'Đã hết lượt đánh ải này hôm nay.',409,'ABYSS_NO_TURNS');
 s.used++;return{floor:stageFloor(stage),enemies:stageEnemies(stage),meta:{stage,season:a.season}};
}
/** Thắng: đánh dấu các nhiệm vụ đạt được theo số tướng cùng hệ của ải trong đội. */
export function finishAbyss(p,b,now=Date.now()){
 const a=state(p,now),meta=b.abyss;if(meta.season!==a.season)return{gold:0,items:[],stars:0};
 const s=a.stages[meta.stage-1],faction=stageFaction(meta.stage),count=(b.allies||[]).filter(u=>u.faction===faction).length;
 questsOf(meta.stage).forEach((q,i)=>{if(count>=q.need&&s.quests[i]===0)s.quests[i]=1});
 return{gold:0,items:[],abyss:{stage:meta.stage,stars:s.quests.filter(q=>q>0).length}};
}
export function claimAbyssQuest(p,input,grant,now=Date.now()){
 const a=state(p,now),stage=stageOf(input),quest=Number(input.quest),s=a.stages[stage-1];
 requireCondition([0,1,2].includes(quest),'Nhiệm vụ không hợp lệ.');
 requireCondition(s.quests[quest]!==2,'Đã nhận rương này.',409,'ABYSS_CLAIMED');
 requireCondition(s.quests[quest]===1,'Hoàn thành nhiệm vụ để mở rương.',409,'ABYSS_NOT_DONE');
 s.quests[quest]=2;const rewards=questsOf(stage)[quest].rewards;rewards.forEach(grant);
 return{message:'Đã nhận rương.',rewards};
}
export function buyAbyssTurn(p,input,pay,now=Date.now()){
 const a=state(p,now),stage=stageOf(input),s=a.stages[stage-1],count=Number(input.count??1);
 requireCondition(Number.isInteger(count)&&count>=1,'Số lượt không hợp lệ.');
 requireCondition(s.bought+count<=abyssBuyLimit,`Mỗi ngày mua tối đa ${abyssBuyLimit} lượt cho một ải.`,409,'ABYSS_BUY_LIMIT');
 pay({itemId:'diamonds',quantity:abyssBuyPrice*count});s.bought+=count;
 return{message:`Đã mua ${count} lượt.`};
}
export function claimAbyssMilestone(p,input,grant,now=Date.now()){
 const a=state(p,now),mark=starMilestones.find(m=>m.stars===Number(input.stars)),option=Number(input.option);
 requireCondition(mark,'Mốc không hợp lệ.');requireCondition(starsOf(a)>=mark.stars,`Cần ${mark.stars} sao.`,409,'ABYSS_STARS');
 requireCondition(a.milestones[mark.stars]===undefined,'Đã nhận quà mốc này.',409,'ABYSS_CLAIMED');
 requireCondition(mark.options[option],'Phần quà không hợp lệ.');
 a.milestones[mark.stars]=option;grant(mark.options[option]);
 return{message:'Đã nhận quà mốc sao.',rewards:[mark.options[option]]};
}
