// Leo đậu thần, chế độ Đơn: dữ liệu tầng lấy nguyên từ db_tower, server giữ tiến trình và lượt.
import {requireCondition} from './errors.mjs';
import {economy,materials,stages,towerData} from './catalog.mjs';

const {turnsPerDay}=economy.tower,{floors,enemies}=towerData;
const dayOf=now=>new Date(now+7*3600000).toISOString().slice(0,10);
export const emptyTower=()=>({floor:1,turns:turnsPerDay,day:null});
const refresh=(p,now)=>{const tower=p.tower||(p.tower=emptyTower()),day=dayOf(now);if(tower.day!==day){tower.day=day;tower.turns=turnsPerDay}return tower};

// Chỉ số quái dùng chung công thức thử nghiệm của phụ bản: `power` của tầng quy về ải có cùng sức mạnh.
const ceilings=[];for(const stage of stages)ceilings.push(Math.max(stage.enemyPower,ceilings.at(-1)||0));
export function towerStrength(power){
 const index=ceilings.findIndex(value=>value>=power),last=ceilings.at(-1);
 return index>=0?index+1:ceilings.length+Math.ceil((power-last)/(last/ceilings.length));
}
const summary=row=>({floor:row.floor,level:row.level,power:row.power,gold:row.gold,stones:row.stones,drops:row.drops,avatar:enemies[row.enemies[0].monsterId].avatar});
export function towerView(p,now=Date.now()){
 const tower=p.tower||emptyTower(),turns=tower.day===dayOf(now)?tower.turns:turnsPerDay;
 return{floor:tower.floor,turns,maxTurns:turnsPerDay,maxFloor:floors.length,floors:floors.slice(tower.floor-1,tower.floor+3).map(summary)};
}
/** Dữ liệu một dòng trong collection tower_ranking. `floors` là số tầng đã vượt, không phải tầng đang đứng. */
export const rankingEntry=p=>({displayName:p.displayName,heroId:p.hero.id,level:p.account.level,floors:Math.max(0,(p.tower?.floor||1)-1)});
/** Đội địch của một tầng, dùng lại cho sự kiện. Tầng vượt quá bảng thì lấy tầng cuối. */
export function floorEnemies(floor){
 const row=floors[Math.min(floor,floors.length)-1];
 return{row,sources:row.enemies.map(slot=>({slot,source:enemies[slot.monsterId]})),strength:towerStrength(row.power)};
}
/** Giữ một lượt cho trận sắp đánh; thắng sẽ hoàn lại nên chỉ thua hoặc rút lui mới mất lượt. */
export function spendTowerTurn(p,now=Date.now()){
 const tower=refresh(p,now),row=floors[tower.floor-1];
 requireCondition(row,'Bạn đã leo hết đậu thần.',409,'TOWER_COMPLETE');
 requireCondition(tower.turns>0,'Đã hết lượt leo hôm nay. Lượt làm mới lúc 00:00.',409,'TOWER_NO_TURNS');
 tower.turns--;
 return{row,sources:row.enemies.map(slot=>({slot,source:enemies[slot.monsterId]})),strength:towerStrength(row.power)};
}
/** Lên tầng khi thắng. Trận đã lưu tầng lúc bắt đầu nên không thể cộng thưởng hai lần cho một tầng. */
export function finishTower(p,floor,now=Date.now()){
 const tower=refresh(p,now),row=floors[floor-1];
 requireCondition(row&&tower.floor===floor,'Tầng không còn hợp lệ.',409,'TOWER_STALE');
 tower.floor++;tower.turns=Math.min(turnsPerDay,tower.turns+1);
 return{gold:row.gold,items:[{itemId:materials.rank,quantity:row.stones},...row.drops].filter(item=>item.quantity>0)};
}
