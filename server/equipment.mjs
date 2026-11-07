// Trang bị: chỉ số, bộ đồ và công thức Tiệm đồ. Số liệu từ db_item_equipment, db_equipment_set, db_point_view.
import {requireCondition,integer} from './errors.mjs';
import {definitionFor,equipmentData,itemById} from './catalog.mjs';

const {sets,points}=equipmentData;
export {sets as equipmentSets};
const clazz={1:'mage',2:'warrior',3:'priest',4:'ranger',5:'assassin'};
const flat={0:'attack',1:'defense',2:'maxHp',3:'speed'},percent={100:'attack',101:'defense',102:'maxHp',103:'speed'};
const combat={5:'skillDamage',6:'accuracy',7:'block',8:'critChance',9:'critDamage',10:'penetration',11:'debuffResist',12:'damageReduction',13:'trueDamage'};
const fraction=(id,value)=>value*points[id].rate/100;
export const fightsAs=value=>value==='fighter'?'warrior':value;
const setOf=new Map(sets.flatMap(set=>set.items.map(id=>[id,set])));

function addPoint(bonus,id,value){
 if(flat[id])bonus.flat[flat[id]]=(bonus.flat[flat[id]]||0)+value;
 else if(percent[id])bonus.percent[percent[id]]=(bonus.percent[percent[id]]||0)+fraction(id,value);
 else if(combat[id])bonus.combat[combat[id]]=(bonus.combat[combat[id]]||0)+fraction(id,value);
}
/** Cộng toàn bộ chỉ số của các món đang mặc. Dòng `clazz` chỉ tính khi đúng nghề tướng; bộ tính theo số món trùng bộ. */
export function equipmentBonus(ids,heroId,extraGroups=[]){
 const bonus={flat:{},percent:{},combat:{}},heroClass=fightsAs(definitionFor(heroId).class),worn=new Map();
 for(const id of ids){
  const item=itemById.get(id);if(!item?.points)continue;
  for(const group of item.points)if(!group.clazz||clazz[group.clazz]===heroClass)for(const [point,value] of group.point)addPoint(bonus,point,value);
  const set=setOf.get(id);if(set)worn.set(set,(worn.get(set)||0)+1);
 }
 for(const group of extraGroups)if(!group.clazz||clazz[group.clazz]===heroClass)for(const [point,value] of group.point)addPoint(bonus,point,value);
 for(const [set,count] of worn)set.effects.forEach((effect,i)=>{if(count>=i+2)for(const [point,value] of effect)addPoint(bonus,point,value)});
 return bonus;
}
export function forgeItem(p,input,spend,add){
 const item=itemById.get(input.itemId),recipe=item?.forge;requireCondition(recipe,'Vật phẩm này không rèn được.',404);
 const quantity=integer(input.quantity,1,999,'Số lượng'),gold=recipe.gold*quantity,count=recipe.count*quantity;
 requireCondition((p.inventory[recipe.material]||0)>=count,`Cần ${count} ${itemById.get(recipe.material).name}.`,409,'FORGE_MATERIAL');
 requireCondition(p.wallet.gold>=gold,'Không đủ vàng.',409,'FORGE_GOLD');
 p.wallet.gold-=gold;spend(p,{[recipe.material]:count});add(p,item.id,quantity);
 return{message:`Đã tạo ${quantity} ${item.name}.`,itemId:item.id,quantity,rewards:[{itemId:item.id,quantity}]};
}
