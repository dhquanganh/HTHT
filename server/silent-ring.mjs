// Vành Đai Tĩnh Lặng (lua_silentring: SilentRingStart / Home / Match / PopupCheckIn / PopupReward / PopupSeasonReward /
// PopupAchievement). Dữ liệu nguyên từ db_boss_silent và db_quai/db_heroes (tools/export-silentring.py).
// Luật theo client gốc (dịch vụ BOSS_SILENT_*):
//   - Báo danh tối đa 90 thuyền viên cấp ≥ 50; mỗi thuyền viên đánh 1 lần mỗi ngày (bị khóa trong đội hình tới ngày sau).
//   - 5 độ khó (Dễ, Thường, Khó, Thử thách, Ác mộng), mỗi độ khó phải đánh hộ vệ 1 rồi hộ vệ 2 (mỗi mùa 1 lần) mới tới boss.
//   - Máu còn lại của hộ vệ quyết định cấp kỹ năng đặc biệt của boss (list_skill1/2 theo hp_skill: hộ vệ còn càng nhiều máu
//     thì Đại Nộ / Hộ thể càng mạnh).
//   - Boss có máu chung cả mùa; mỗi trận nhận quà theo sát thương 1 lần (rank_dmg / reward); hết mùa nhận Thưởng mùa
//     theo tổng sát thương (rank_dmg_season / season_reward), boss bị hạ thì quà mùa nhân đôi.
//   - 5 lượt đánh boss mỗi ngày.
// Thời gian mùa, máu boss/hộ vệ, chỉ số quái theo cấp và danh sách thành tựu nằm ở server gốc; bản web đặt: mùa 7 ngày bắt
// đầu thứ Hai 10:00 (giờ VN), mở đánh 6 ngày, ngày cuối để nhận quà mùa; máu boss = mốc thưởng mùa cao nhất, máu hộ vệ =
// mốc thưởng trận đầu tiên, chỉ số quái = chỉ số gốc × cấp / 100.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition} from './errors.mjs';

const data=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/silent-ring.json',import.meta.url)),'utf8'));
export const silentData={diffs:data.diffs,units:data.units,special:data.special};
export const diffNames=['Dễ','Thường','Khó','Thử thách','Ác mộng'];
export const maxTurns=5,maxHeroes=90,minLevel=50,rounds=10;
const VN=7*3600e3,DAY=86400e3,WEEK=7*DAY,EPOCH=Date.UTC(2024,0,1,3);// thứ Hai 01/01/2024 10:00 giờ VN
// SR_TIME_SHIFT_MS: dịch đồng hồ sự kiện (chỉ dùng khi kiểm thử, để luôn vào được ngày đang mở).
const SHIFT=Number(process.env.SR_TIME_SHIFT_MS||0);
export const seasonOf=now=>Math.floor((now+SHIFT-EPOCH)/WEEK);
const seasonStart=s=>EPOCH+s*WEEK,activeEnd=s=>seasonStart(s)+6*DAY;
const dayOf=now=>Math.floor((now+SHIFT+VN)/DAY);
const reward=a=>{const out=[];for(let i=0;i+3<a.length;i+=4)out.push({itemId:a[0+i]===3?'consumable:'+a[i+2]:String(a[i+2]),quantity:a[i+3]});return out};

const guardMaxHp=d=>data.diffs[d].rankDmg[0],bossMaxHp=d=>data.diffs[d].seasonRankDmg.at(-1);
function fresh(season){return{season,seasonClaimed:false,slot:[0,0,0,0,0],guardHp:data.diffs.map(()=>[100,100]),bossHp:data.diffs.map((_,d)=>bossMaxHp(d)),damage:[0,0,0,0,0],guardFights:0,bossFights:[0,0,0,0,0],claimed:[]}}
export function srState(p,now=Date.now()){
 p.silentRing??={heroes:[],used:{},day:0,turns:maxTurns,...fresh(seasonOf(now)),last:null};
 const s=p.silentRing,season=seasonOf(now),day=dayOf(now);
 if(s.season!==season){
  // Mùa cũ: giữ tổng sát thương để nhận Thưởng mùa (statusLastRewardSeason) nếu chưa nhận.
  if(!s.last||s.last.season!==s.season)s.last={season:s.season,damage:[...s.damage],defeated:s.bossHp.map(h=>h<=0),claimed:false};
  Object.assign(s,fresh(season));s.heroes=[];s.used={};
 }
 if(s.day!==day){s.day=day;s.turns=maxTurns;s.used={}}
 return s;
}
const status=(s,now)=>now+SHIFT<activeEnd(s.season)?1:2;
/** Mốc đã đạt: số phần tử của thresholds ≤ value. */
const tierOf=(thresholds,value)=>thresholds.filter(t=>value>=t).length;
/** Cấp kỹ năng đặc biệt của boss theo % máu còn của hộ vệ (SilentRingMatch.SetBossSkill). */
export function bossSkillLevel(hpSkill,ratio){let level=0;for(let i=1;i<hpSkill.length;i++){if(ratio<=hpSkill[hpSkill.length-i])break;level++}return level}
export function bossSkills(d,s){const diff=data.diffs[d];return[0,1].map(k=>{const level=bossSkillLevel(diff.hpSkill,s.guardHp[d][k]),id=(k?diff.skills2:diff.skills1)[diff.skills1.length-1-level];return{level,id:String(id),...data.special[String(id)]}})}
// ---- Thành tựu (BOSS_SILENT_CHALLENGE_*): theo mùa
export function achievements(s){
 const list=[{id:'guard',text:'Khiêu chiến hộ vệ 10 lần',target:10,progress:s.guardFights,rewards:[{itemId:'consumable:3004',quantity:100}]}];
 data.diffs.forEach((diff,d)=>{
  list.push({id:'boss-'+d,text:`Khiêu chiến Lord of the Coast (${diffNames[d]}) 5 lần`,target:5,progress:s.bossFights[d],rewards:[{itemId:'consumable:3004',quantity:50*(d+1)},{itemId:'consumable:3003',quantity:d+1}]});
  list.push({id:'dmg-'+d,text:`Tổng sát thương lên Lord of the Coast (${diffNames[d]}) đạt ${fmtMillion(diff.seasonRankDmg[0])}`,target:diff.seasonRankDmg[0],progress:Math.min(s.damage[d],diff.seasonRankDmg[0]),rewards:[{itemId:'consumable:3002',quantity:d+1},{itemId:'consumable:3001',quantity:d+1}]});
 });
 return list.map(a=>({...a,status:s.claimed.includes(a.id)?2:a.progress>=a.target?1:0}));
}
const fmtMillion=n=>n>=1e9?`${n/1e9} tỷ`:`${n/1e6} triệu`;
export function srView(p,now=Date.now()){
 const s=srState(p,now),st=status(s,now);
 return{season:s.season,status:st,endsIn:Math.max(0,(st===1?activeEnd(s.season):seasonStart(s.season+1))-now-SHIFT),turns:s.turns,maxTurns,heroes:s.heroes,used:Object.keys(s.used),
  slot:s.slot,guardHp:s.guardHp,bossHp:s.bossHp,bossMax:data.diffs.map((_,d)=>bossMaxHp(d)),damage:s.damage,
  seasonClaimed:!!s.seasonClaimed,lastReward:s.last&&!s.last.claimed?{season:s.last.season,damage:s.last.damage,defeated:s.last.defeated}:null,
  achievements:achievements(s),notify:achievements(s).some(a=>a.status===1),bossSkills:data.diffs.map((_,d)=>bossSkills(d,s))};
}
export function srCheckIn(p,input,owned,now=Date.now()){
 const s=srState(p,now);requireCondition(status(s,now)===1,'Sự kiện đã kết thúc!',409,'SR_ENDED');
 const ids=[...new Set((input.heroes||[]).map(String))];requireCondition(ids.length>0,'Vui lòng chọn Thuyền viên',400);requireCondition(ids.length<=maxHeroes,'Đã đủ 90 Thuyền viên',400);
 for(const id of ids){const h=owned.get(id);requireCondition(h,'Bạn chưa sở hữu tướng này.',404);requireCondition(h.level>=minLevel,`Thuyền viên cần đạt cấp ${minLevel}.`,409)}
 s.heroes=ids;return{message:'Báo danh thành công.'};
}
/** Kiểm tra lượt đánh, trả quái cho openBattle. target 1, 2 là hộ vệ, 3 là boss. */
export function srStart(p,input,{owned,validate,now=Date.now()}){
 const s=srState(p,now),d=Number(input.diff)-1,target=Number(input.target),diff=data.diffs[d];
 requireCondition(status(s,now)===1,'Sự kiện đã kết thúc!',409,'SR_ENDED');requireCondition(diff&&[1,2,3].includes(target),'Mục tiêu không hợp lệ.',400);
 requireCondition(s.heroes.length,'Bạn cần báo danh Thuyền viên mới có thể tiến hành khiêu chiến!',409,'SR_NO_CHECKIN');
 const real=s.slot[d]+1;
 if(target===3)requireCondition(real===3,'Cần tấn công hai hộ vệ trước',409,'SR_GUARDS');
 else{requireCondition(real<3,'Đã tấn công 2 hộ vệ',409);requireCondition(target===real,`Cần tấn công hộ vệ ${real}`,409)}
 if(target===3){requireCondition(s.bossHp[d]>0,'Boss đã bị đánh bại.',409,'SR_DEFEATED');requireCondition(s.turns>0,'Bạn đã hết lượt đánh.',409,'SR_NO_TURNS')}
 const team=validate(input.formation);
 for(const id of team.slots){if(!id)continue;requireCondition(s.heroes.includes(id),'Chỉ thuyền viên đã báo danh được tham chiến.',409);requireCondition(!s.used[id],'Thuyền viên đã tham chiến hôm nay.',409,'SR_HERO_USED')}
 for(const id of team.slots)if(id)s.used[id]=1;
 if(target===3)s.turns--;
 const src=target===3?diff.boss:diff.guards[target-1],avatar=data.monsters[src.monsterId],u=data.units[avatar],k=src.level/100;
 // Boss: máu chung cả mùa nằm ở server; trong trận boss đánh mãi không chết (như Chiến Thần Thú), máu trận = chỉ số gốc × cấp × 20
 // để khiên / hồi máu theo % Máu tối đa của boss có ý nghĩa; sát thương gây ra trừ vào máu chung.
 const boss=target===3,maxHp=boss?Math.round(u.point.hp*k*20):guardMaxHp(d),hp=boss?maxHp:Math.round(maxHp*s.guardHp[d][target-1]/100);
 const unit={id:'enemy-0',name:u.name,avatar,faction:u.faction,heroClass:u.class,level:src.level,stars:10,monsterId:src.monsterId,position:1,maxHp,hp,
  attack:Math.round(u.point.attack*k),defense:Math.round(u.point.armor*k),speed:Math.round(u.point.speed*Math.min(2,.5+k/4)),visualIndex:0,boss:true,immuneDebuff:true,startHp:hp,...(boss?{endless:true,damageTaken:0}:{}),
  silentSkills:[...u.skills,...(target===3?bossSkills(d,s).filter(x=>x.level>0):[])]};
 return{team,unit,meta:{chapter:1,stageId:null,silent:{diff:d+1,target,season:s.season,rounds,name:u.name}}};
}
/** Kết thúc trận: ghi máu còn của hộ vệ / boss, sát thương mùa, quà theo sát thương 1 lần (boss). */
export function srFinish(p,b,grant,now=Date.now()){
 const s=srState(p,now),m=b.silent,d=m.diff-1,e=b.enemies[0],damage=Math.max(0,Math.round(e.endless?e.damageTaken:(e.startHp??e.maxHp)-e.hp)),counted=s.season===m.season;
 const result={damage,counted,target:m.target,diff:m.diff,items:[]};
 if(counted){
  if(m.target===3){
   s.bossHp[d]=Math.max(0,s.bossHp[d]-damage);s.damage[d]+=damage;// tổng sát thương mùa tính đủ, máu boss không âms.bossFights[d]++;
   const tier=tierOf(data.diffs[d].rankDmg,damage);if(tier>0){result.items=reward(data.diffs[d].reward[tier-1]);for(const r of result.items)grant(r)}
   result.tier=tier;result.total=s.damage[d];result.defeated=s.bossHp[d]<=0;
  }else{
   s.guardHp[d][m.target-1]=Math.max(0,Math.round(e.hp/e.maxHp*100));s.slot[d]=Math.max(s.slot[d],m.target);s.guardFights++;result.guardHp=s.guardHp[d][m.target-1];
  }
 }
 b.reward=result;return result;
}
export function srClaimAchievement(p,input,grant,now=Date.now()){
 const s=srState(p,now),a=achievements(s).find(x=>x.id===input.id);requireCondition(a,'Thành tựu không tồn tại.',404);
 requireCondition(a.status===1,a.status===2?'Đã nhận thưởng.':'Chưa hoàn thành.',409);s.claimed.push(a.id);for(const r of a.rewards)grant(r);
 return{message:'Nhận thưởng thành công.',rewards:a.rewards};
}
/** Thưởng mùa: mỗi độ khó nhận mốc cao nhất đã đạt theo tổng sát thương; boss bị hạ thì nhân đôi. Mùa đang diễn ra nhận sau khi kết thúc. */
export function seasonRewards(damage,defeated){
 const out=new Map();
 data.diffs.forEach((diff,d)=>{const tier=tierOf(diff.seasonRankDmg,damage[d]);if(!tier)return;for(const r of reward(diff.seasonReward[tier-1]))out.set(r.itemId,(out.get(r.itemId)||0)+r.quantity*(defeated[d]?2:1))});
 return[...out].map(([itemId,quantity])=>({itemId,quantity}));
}
export function srClaimSeason(p,grant,now=Date.now()){
 const s=srState(p,now);let src=null;
 if(s.last&&!s.last.claimed)src=s.last;
 else if(status(s,now)===2&&!s.seasonClaimed){src={damage:s.damage,defeated:s.bossHp.map(h=>h<=0)};s.seasonClaimed=true;s.last={season:s.season,damage:[...s.damage],defeated:src.defeated,claimed:true}}
 requireCondition(src,'Chưa có thưởng mùa để nhận.',409,'SR_NO_SEASON_REWARD');
 const rewards=seasonRewards(src.damage,src.defeated);if(src===s.last)s.last.claimed=true;for(const r of rewards)grant(r);
 return{message:rewards.length?'Nhận thưởng mùa thành công.':'Mùa trước chưa đạt mốc thưởng.',rewards};
}
