// Đá hộ mệnh theo db_hero_stone: 26 bậc từ Đá Xanh 1 sao tới Đá Hoàng Kim 6 sao, mỗi tướng một viên.
// Viên đá có một dòng chỉ số đang chọn trong các dòng effect1-3 của bậc đó. Nâng cấp lên bậc kế (upgrade_cost),
// có gem_retain_effect% giữ nguyên dòng; Hoán đổi (convert_cost) quay lại dòng khác.
import {randomInt} from 'node:crypto';
import {requireCondition} from './errors.mjs';
import {heroStoneData} from './catalog.mjs';

export const stoneRows=heroStoneData.stones,stoneDust='consumable:3',stoneUnlockLevel=30;
const rowOf=id=>stoneRows.find(row=>row.id===id);
const choices=row=>row.effects.flatMap((list,group)=>list.map((_,index)=>[group,index]));
const pick=(list,random)=>list[random(list.length)];
const defaultRandom=max=>randomInt(max);
export const stoneEffect=stone=>{if(!stone)return null;const [group,index]=stone.effect;return rowOf(stone.id)?.effects[group]?.[index]||null};
export const stoneGroups=hero=>{const effect=stoneEffect(hero.stone);return effect?[effect]:[]};
function payStone(cost,spend){spend(cost.gold,cost.dust)}
export function unlockStone(hero,random=defaultRandom){
 requireCondition(!hero.stone,'Tướng đã có Đá hộ mệnh.',409,'STONE_EXISTS');
 requireCondition(hero.level>=stoneUnlockLevel,`Cần tướng cấp ${stoneUnlockLevel} để mở ô Đá hộ mệnh.`,409,'STONE_LOCKED');
 hero.stone={id:1,effect:pick(choices(rowOf(1)),random)};
 return{message:'Đã mở ô Đá hộ mệnh.'};
}
export function upgradeStone(hero,spend,random=defaultRandom){
 requireCondition(hero.stone,'Tướng chưa có Đá hộ mệnh.',409,'STONE_MISSING');
 const row=rowOf(hero.stone.id),next=rowOf(hero.stone.id+1);requireCondition(next,'Đá hộ mệnh đã đạt bậc tối đa.',409,'STONE_MAX');
 payStone(row.upgrade,spend);
 const [group,index]=hero.stone.effect,keep=next.effects[group]?.[index]&&random(100)<row.retain;
 hero.stone={id:next.id,effect:keep?[group,index]:pick(choices(next),random)};
 return{message:`Đã nâng lên ${next.name} ${next.star} sao.`,kept:!!keep};
}
export function convertStone(hero,spend,random=defaultRandom){
 requireCondition(hero.stone,'Tướng chưa có Đá hộ mệnh.',409,'STONE_MISSING');
 const row=rowOf(hero.stone.id),others=choices(row).filter(c=>c.join()!==hero.stone.effect.join());
 requireCondition(others.length,'Bậc này chỉ có một dòng chỉ số.',409,'STONE_SINGLE');
 payStone(row.convert,spend);hero.stone={id:row.id,effect:pick(others,random)};
 return{message:'Đã hoán đổi chỉ số.'};
}
/** Vật phẩm đá (ví dụ Đá Cam) thay viên đang lắp nếu bậc cao hơn. */
export function applyStoneItem(hero,stoneId,random=defaultRandom){
 const row=rowOf(stoneId);requireCondition(row,'Đá không hợp lệ.');
 requireCondition(!hero.stone||hero.stone.id<stoneId,'Đá hộ mệnh của tướng đã cao hơn hoặc bằng viên này.',409,'STONE_LOWER');
 hero.stone={id:row.id,effect:pick(choices(row),random)};
 return{message:`Đã lắp ${row.name} ${row.star} sao.`};
}
