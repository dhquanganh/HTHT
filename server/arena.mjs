// Chiến trường (ArenaScene gốc): Đơn đấu (CrystalCrownScene - Giải thách đấu), Liên đấu (TrialOfChampionScene - Giải liên đấu,
// 3 đội hình), Võ đấu (AllStarsLeagueScene - Đấu trường Corrida: vòng bảng + Vô song 16 người + đặt cược Chẵn/Lẻ).
// Bảng thưởng nguyên từ db_arena_reward / db_allstars_* (tools/export-arena.py). Phần còn lại theo chữ của bản gốc:
//   - Thưởng ngày trao lúc 21:00 (UTC/GMT 0) theo hạng hiện tại (MSG_ARENA_TITLE_REWARD), thưởng mùa khi mùa kết thúc.
//   - Đơn đấu yêu cầu cấp 14, Liên đấu cấp 55 (MSG_ARENA_SCENE_DESC_TRIAL_OF_CHAMPION), Võ đấu cấp 80.
//   - Thắng được cộng điểm, thua bị trừ (Chiến sử "+12 điểm"); điểm khởi đầu 1000 như màn Giải thách đấu.
//   - Võ đấu: vòng bảng xếp theo Hạng (thắng người hạng cao hơn thì đổi hạng), mỗi giờ cộng điểm theo hạng
//     (db_allstars_point); hết vòng bảng 16 hạng đầu vào Vô song, mỗi cặp đánh loạt 3 trận; đặt cược trận cuối của loạt:
//     tổng sát thương của tướng có sát thương cao nhất là chẵn hay lẻ (MSG_POPUP_ALL_STAR_BET_DESC).
// Mùa giải theo tuần, kết thúc Chủ nhật 21:00 UTC (cùng mốc trao thưởng ngày).
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {initializeTeamBattle,teamRound} from './team-combat.mjs';

export const arenaData=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/arena.json',import.meta.url)),'utf8'));
export const arenaModes={
 solo:{id:'solo',name:'Đơn đấu',title:'Giải thách đấu',minLevel:14,teams:1},
 league:{id:'league',name:'Liên đấu',title:'Giải liên đấu',minLevel:55,teams:3},
 allstars:{id:'allstars',name:'Võ đấu',title:'Đấu trường Corrida',minLevel:80,teams:1},
};
export const startPoints=1000,ticketItem='consumable:4',freeTickets=10,ticketPrice=20,ticketBuyLimit=20;
export const allstarAttacks=5,allstarAttackPrice=50,allstarBuyLimit=10,betItem='consumable:40',betAmount=1000,knockoutSize=16;
const HOUR=3600000,DAY=24*HOUR,WEEK=7*DAY,dailyHour=arenaData.dailyHourUtc;
// Chủ nhật 4/1/1970 21:00 UTC: mốc tuần đầu tiên.
const anchor=3*DAY+dailyHour*HOUR;
export function seasonWindow(now=Date.now()){const id=Math.floor((now-anchor)/WEEK),start=anchor+id*WEEK;return{id,start,end:start+WEEK}}
export const dayKey=(now=Date.now())=>Math.floor((now-dailyHour*HOUR)/DAY);
export const nextDaily=(now=Date.now())=>(dayKey(now)+1)*DAY+dailyHour*HOUR;
// Võ đấu: vòng bảng từ đầu tuần tới thứ Sáu 21:00, Vô song thứ Bảy / Chủ nhật.
export const knockoutRounds=[
 {id:'r16',name:'Vòng 1/16',at:5*DAY+16*HOUR,size:16},
 {id:'qf',name:'Tứ Kết',at:5*DAY+20*HOUR,size:8},
 {id:'sf',name:'Bán Kết',at:6*DAY+16*HOUR,size:4},
 {id:'final',name:'Chung Kết',at:6*DAY+20*HOUR,size:2},
];
export const groupEndOffset=5*DAY;
export function allstarPhase(now=Date.now()){
 const w=seasonWindow(now),t=now-w.start;if(t<groupEndOffset)return{...w,phase:'group',next:w.start+groupEndOffset,label:'Vòng bảng'};
 const round=knockoutRounds.find(r=>t<r.at);return round?{...w,phase:'knockout',round:round.id,next:w.start+round.at,label:round.name}:{...w,phase:'ended',next:w.end,label:'Đã kết thúc'};
}
/** Elo K=32: thắng người điểm cao hơn được nhiều điểm hơn; điểm không xuống dưới 0. */
export function eloDelta(attacker,defender,win){const expected=1/(1+10**((defender-attacker)/400));return win?Math.max(1,Math.round(32*(1-expected))):-Math.max(1,Math.round(32*expected))}
export const rewardFor=(rows,rank)=>rows.find(r=>rank>=r.from&&rank<=r.to)?.rewards||[];
export const pointsPerHour=rank=>arenaData.allstars.points.find(r=>rank>=r.from&&rank<=r.to)?.perHour||0;
export const allstarSeasonReward=points=>arenaData.allstars.season.find(r=>points>=r.min)?.rewards||[];
/** Thưởng Vô song theo vòng bị loại: 0 = Vô địch, 1 = Chung Kết, 2 = Bán Kết, 3 = Tứ Kết, 4 = Vòng 1/16. */
export const knockoutReward=place=>arenaData.allstars.knockout[place]?.rewards||[];

// ---- Đối thủ máy: lấp bảng xếp hạng khi server còn ít người chơi. Tên tự đặt, đội hình theo tướng trong catalog.
const botNames=['Sói Biển Bạc','Thuyền Trưởng Gió','Mắt Ưng','Hổ Kình','Bão Táp','Rồng Nước','Lưỡi Kiếm Đỏ','Kẻ Săn Kho Báu','Neo Sắt','Hải Âu Đen',
 'Cá Mập Trắng','Sấm Biển','Ngọn Hải Đăng','Thủy Thủ Già','La Bàn Vàng','Buồm Rách','Mũ Rơm Nhỏ','Đảo Lửa','Sóng Ngầm','Pháo Thủ',
 'Rượu Rum','Kẻ Lang Thang','Tay Móc','Chân Gỗ','Bản Đồ Cổ','Mỏ Neo','Thần Gió','Cướp Biển Xám','Cánh Buồm Trắng','Ánh Trăng Biển'];
export function botName(i){return botNames[i%botNames.length]+(i>=botNames.length?' '+(Math.floor(i/botNames.length)+1):'')}
export function seeded(seed){let x=(seed>>>0)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296}}
/** Sức mạnh đối thủ máy theo thứ hạng: hạng cuối cấp 10, hạng đầu cấp 160 (Võ đấu mạnh hơn). */
export function botProfile(mode,index,total){
 const top=1-index/Math.max(1,total-1),base=mode==='allstars'?60:mode==='league'?40:10,span=mode==='allstars'?160:mode==='league'?130:150;
 const level=Math.round(base+span*top**1.6),stars=Math.max(1,Math.min(14,Math.round(1+11*top**1.3)));
 return{level,stars,points:mode==='allstars'?0:Math.round(startPoints-120+380*top**1.2)};
}

// ---- Đội hình: snapshot đội của người chơi (đơn vị trận đấu đã tính sẵn chỉ số và bộ kỹ năng).
// Ô 1-2 là hàng trước, 3-6 hàng sau; phe địch đứng cột 4-5 (trước) và 1-3, 6 (sau) như Vực thẳm.
const column={0:4,1:5,2:1,3:2,4:3,5:6};
export function asEnemies(units){
 return units.map((u,i)=>({...structuredClone(u),id:'foe-'+i,side:'enemy',position:column[u.position]??u.position,frontRow:u.position<2,energy:u.heroId==='zoro-king-of-hell'?100:35,visualIndex:i}));
}
export function asAllies(units){return units.map((u,i)=>({...structuredClone(u),id:i?'ally-'+u.heroId:'hero',side:'ally'}))}
/** Đánh tự động hai đội (Vô song, Liên đấu): trả về thắng/thua và sát thương từng tướng. Hết 40 hiệp thì bên tấn công thua. */
export function simulate(attackers,defenders,seed){
 const b={id:'sim',status:'active',turn:1,seed:(seed>>>0)||1,allies:asAllies(attackers),enemies:asEnemies(defenders),events:[]};
 for(const e of b.enemies)e.frontRow=e.position>=4;
 initializeTeamBattle(b);const damage={};let turns=0;
 while(turns<40&&b.allies.some(u=>u.hp>0)&&b.enemies.some(u=>u.hp>0)){
  for(const e of teamRound(b,{action:'auto'}))if(e.type==='damage'&&e.amount>0)damage[e.actor]=(damage[e.actor]||0)+e.amount;
  turns++;b.turn++;
 }
 const win=!b.enemies.some(u=>u.hp>0)&&b.allies.some(u=>u.hp>0);
 const top=Object.entries(damage).sort((a,c)=>c[1]-a[1])[0]||['',0];
 return{win,turns,damage,topDamage:top[1],topUnit:top[0]};
}
/** Loạt 3 trận (Liên đấu: đội 1-3 đấu đội 1-3; Vô song: cùng đội hình đánh 3 lần). Thắng 2 là thắng loạt. */
export function series(teamsA,teamsB,seed){
 const rand=seeded(seed),bouts=[];let a=0,b=0;
 for(let i=0;i<3&&a<2&&b<2;i++){const r=simulate(teamsA[i%teamsA.length]||[],teamsB[i%teamsB.length]||[],Math.floor(rand()*4294967295));bouts.push(r);if(r.win)a++;else b++}
 return{win:a>b,bouts,score:[a,b]};
}
