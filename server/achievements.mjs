// Thành tựu (tab "Thành tựu" của PopupMasteringHero, BoxGameChallenge / CellGameChallenge).
// Mẫu câu lấy từ server_message gốc ("Đạt cấp %s", "Sở hữu %s thuyền viên 7 sao", "Vượt tầng %s Tháp Lãng Quên",
// "Triệu hồi Cao Cấp %s lần"...). Danh sách mốc và quà nằm ở server gốc nên không có trong asset; mốc đầu của mỗi
// thành tựu thưởng 10K Beli + 50 kim cương như ảnh gốc, các mốc sau tăng theo bậc.
// Chỉ dựng những thành tựu mà bản web có hệ thống tương ứng: cấp, sao thuyền viên, tháp (db_tower = Tháp Lãng Quên,
// db_tower2 = Tháp Đôi chưa làm) và chiêu mộ.
import {requireCondition} from './errors.mjs';

const starGoals=[4,5,6,7,8,9,10,13,15];
const tiers=(...targets)=>targets;
export const achievements=[
 {id:'level',text:'Đạt cấp %s',targets:tiers(10,20,30,40,50,60,70,80,90,100),progress:p=>p.account.level},
 ...starGoals.map(stars=>({id:'stars-'+stars,text:`Sở hữu %s thuyền viên ${stars} sao`,targets:tiers(1,3,5,10),progress:p=>heroesOf(p).filter(h=>h.stars>=stars).length})),
 {id:'tower',text:'Vượt tầng %s Tháp Lãng Quên',targets:tiers(1,10,50,100,200,300,500,1000,1500,2000),progress:p=>Math.max(0,(p.tower?.floor||1)-1)},
 {id:'summon',text:'Triệu hồi Cao Cấp %s lần',targets:tiers(1,10,50,100,300,500,1000),progress:p=>p.stats?.summons||0},
];
const heroesOf=p=>[p.hero,...Object.values(p.reserveHeroes||{})];
/** Quà của mốc thứ `tier` (bắt đầu từ 0): mốc đầu 10K Beli + 50 kim cương như ảnh gốc. */
export const tierRewards=tier=>[{itemId:'gold',quantity:10000*(tier+1)},{itemId:'diamonds',quantity:50*(tier+1)}];
const claimedOf=(p,id)=>p.achievements?.[id]||0;

/** 0 = đang làm, 1 = đủ điều kiện nhận, 2 = đã nhận hết mốc. Ô nhận được xếp lên đầu như bản gốc. */
export function achievementView(p){
 const rows=achievements.map(a=>{
  const claimed=claimedOf(p,a.id),done=claimed>=a.targets.length,tier=Math.min(claimed,a.targets.length-1),target=a.targets[tier],progress=a.progress(p);
  return{id:a.id,text:a.text.replace('%s',target),progress,target,rewards:tierRewards(tier),status:done?2:progress>=target?1:0};
 });
 const order=s=>s===1?0:s===0?1:2;
 return rows.map((r,i)=>[r,i]).sort((x,y)=>order(x[0].status)-order(y[0].status)||x[1]-y[1]).map(x=>x[0]);
}
export function claimAchievement(p,input,grant){
 const a=achievements.find(x=>x.id===input.id);requireCondition(a,'Thành tựu không hợp lệ.',400,'ACHIEVEMENT_ID');
 const claimed=claimedOf(p,a.id);requireCondition(claimed<a.targets.length,'Đã nhận hết thưởng thành tựu này.',409,'ACHIEVEMENT_DONE');
 requireCondition(a.progress(p)>=a.targets[claimed],'Chưa hoàn thành thành tựu.',409,'ACHIEVEMENT_NOT_DONE');
 p.achievements={...(p.achievements||{}),[a.id]:claimed+1};const rewards=tierRewards(claimed);rewards.forEach(grant);
 return{message:'Đã nhận thưởng.',rewards};
}
export const countSummons=(p,count)=>{p.stats={...(p.stats||{}),summons:(p.stats?.summons||0)+count}};
