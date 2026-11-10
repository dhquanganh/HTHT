// Chiến hạm (MonsterScene / PopupPet / PopupSelectPet gốc), dữ liệu dist/ship.json (tools/export-ship.py).
// Luật theo bảng và mã Lua gốc:
//   - Kích hoạt bằng Hồn chiến hạm (fee_unlock của db_pet: 240 / 320 / 410). Chiến hạm released = 0 không dùng được.
//   - Cấp: phí mỗi cấp theo db_pet_level_upgrade (Beli + Hồn chiến hạm, cấp 1-180) và db_monster_up_level
//     (ShipFixUpgradeLevel.lua: từ cấp 180 thêm Gỗ Quý 2143, tối đa 240).
//   - Phẩm (ToggleTier 3 ngôi sao): ở cấp 30 / 60 / 90 phải "Nâng phẩm" (cột gold_evolve / soul_stone_evolve) mới lên tiếp.
//   - Kỹ năng chủ động: id = active_skill + cấp - 1 (ShipFixDescSkillMax.lua), mạnh dần theo cấp chiến hạm; mỗi cuối hiệp
//     chiến hạm ra trận tung kỹ năng (sát thương cố định, khống chế, DoT, hồi máu, Nộ, tăng / giảm chỉ số như mô tả gốc).
//   - Bảng kỹ năng (4 bị động, mỗi cái 30 cấp): chỉ số cộng cho cả đội. Bị động k mở ở phẩm k - 1 ("Yêu cầu chiến xa
//     nâng lên phẩm {0}"). Phí mỗi cấp bị động và giới hạn cấp theo phẩm do bản web đặt (bảng gốc ở máy chủ): dùng bảng
//     Phế tích gốc (Beli + Đá hỗn độn), giới hạn 10 / 20 / 30 / 30 theo phẩm.
//   - Phế tích (3 ô Máu / Công / Tốc, tối đa 60 như ShipFixUpgradeRuin.lua): mở khi bảng kỹ năng đạt tối đa
//     (MISC_2_POPUP_PET_MSG_NOTE), phí db_pet_ruin_upgrade, cộng ruin_scale × cấp cho cả đội.
//   - Tái tạo: về cấp 1 phẩm 0, hoàn Hồn chiến hạm và Gỗ Quý đã dùng (trừ Beli) như MSG_POPUP_PET_REBIRTH.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition} from './errors.mjs';

const data=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/ship.json',import.meta.url)),'utf8'));
export const shipItems={soul:'material:ship-soul',chaos:'material:ship-chaos',wood:'consumable:2143',metal:'consumable:2142'};
export const shipData=data;
const byId=new Map(data.ships.map(s=>[s.id,s]));
const tierCaps=[30,60,90];
export const levelCap=tier=>tier<3?tierCaps[tier]:data.maxLevel;
export const passiveCap=tier=>Math.min(30,10*(tier+1));
export const ruinMax=data.ruinMax;
const ruinCost=level=>data.ruins[Math.max(1,level)]||data.ruins[Object.keys(data.ruins).length];

function state(p){p.ships??={list:{},selected:null};p.ships.list??={};return p.ships}
function ship(p,id){
 const s=byId.get(Number(id));requireCondition(s&&s.released,'Chiến hạm không tồn tại.');
 const own=state(p).list[s.id];return{def:s,own};
}
const owned=(p,id)=>{const r=ship(p,id);requireCondition(r.own,'Chiến hạm chưa được kích hoạt');return r};
const skillsMaxed=own=>own.passives.every(l=>l>=30);

/** Phí lên cấp tiếp theo; null khi phải nâng phẩm hoặc đã tối đa. */
export function levelCost(own){
 if(own.level>=levelCap(own.tier))return null;const c=data.levels[own.level];return c?{gold:c.gold,soul:c.soul,wood:c.wood||0}:null;
}
export function tierCost(own){if(own.tier>=3||own.level<levelCap(own.tier))return null;const c=data.evolve[levelCap(own.tier)];return c?{gold:c.gold,soul:c.soul}:null}
export function passiveCost(own,k){
 if(own.tier<k)return null;const lv=own.passives[k];if(lv>=passiveCap(own.tier))return null;const c=ruinCost(lv+1);return{gold:c.gold,chaos:c.chaos};
}
export function ruinCostOf(own,r){if(!skillsMaxed(own)||own.ruins[r]>=ruinMax)return null;const c=ruinCost(own.ruins[r]);return{gold:c.gold,chaos:c.chaos}}

/** Chỉ số cả đội của một chiến hạm: tổng bị động đã học + Phế tích. */
export function shipAura(def,own){
 const out={};const add=(k,v)=>{out[k]=(out[k]||0)+v};
 own.passives.forEach((lv,k)=>{if(lv>0)for(const s of def.passives[k][lv-1])add(s.type,s.value)});
 const ruin=(i,key,field)=>{const lv=own.ruins[i];if(lv<=0)return;add(field,def.ruinScale[key]*Math.min(60,lv)+Math.max(0,lv-60)*def.ruinScale2[key])};
 ruin(0,'hp','maxHpFlat');ruin(1,'attack','attackFlat');ruin(2,'speed','speedFlat');
 return out;
}
export const activeSkill=(def,own)=>def.active[Math.min(def.active.length,own.level)-1];

export function shipView(p){
 const st=state(p);
 return{selected:st.selected,list:Object.fromEntries(Object.entries(st.list).map(([id,own])=>{const def=byId.get(Number(id));return[id,{...own,cap:levelCap(own.tier),passiveCap:passiveCap(own.tier),
  levelCost:levelCost(own),tierCost:tierCost(own),passiveCosts:[0,1,2,3].map(k=>passiveCost(own,k)),ruinCosts:[0,1,2].map(r=>ruinCostOf(own,r)),ruinsOpen:skillsMaxed(own),aura:shipAura(def,own)}]}))};
}

/** Thao tác Chiến hạm. pay(cost) trừ {gold, soul, chaos, wood}; báo lỗi nếu thiếu. */
export function shipAction(p,input,pay){
 const action=input?.op;
 if(action==='activate'){
  const {def,own}=ship(p,input.shipId);requireCondition(!own,'Chiến hạm đã được kích hoạt.');
  pay({soul:def.unlock});const st=state(p);st.list[def.id]={level:1,tier:0,passives:[1,0,0,0],ruins:[0,0,0],spent:{soul:0,wood:0}};
  if(!st.selected)st.selected=def.id;return{message:`Đã kích hoạt ${def.name}.`};
 }
 if(action==='select'){
  if(input.shipId===null){state(p).selected=null;return{message:'Đã bỏ chiến hạm khỏi đội hình.'}}
  const {def}=owned(p,input.shipId);state(p).selected=def.id;return{message:`${def.name} sẽ ra trận cùng đội hình.`};
 }
 if(action==='level'){
  const {def,own}=owned(p,input.shipId);requireCondition(own.level<data.maxLevel,'Đã đạt cấp tối đa');
  const cost=levelCost(own);requireCondition(cost,'Hãy nâng phẩm chiến hạm để lên cấp tiếp.',409,'NEED_TIER');
  pay(cost);own.level++;own.spent.soul+=cost.soul;own.spent.wood+=cost.wood;return{message:`${def.name} lên cấp ${own.level}.`};
 }
 if(action==='tier'){
  const {def,own}=owned(p,input.shipId);requireCondition(own.tier<3,'Đã đạt phẩm tối đa.');
  const cost=tierCost(own);requireCondition(cost,`Cần đạt cấp ${levelCap(own.tier)} để nâng phẩm.`);
  pay(cost);own.tier++;own.spent.soul+=cost.soul;return{message:`${def.name} đã nâng lên phẩm ${own.tier}.`};
 }
 if(action==='passive'){
  const {def,own}=owned(p,input.shipId),k=Number(input.index);requireCondition([0,1,2,3].includes(k),'Kỹ năng không hợp lệ.');
  requireCondition(own.tier>=k,`Yêu cầu chiến xa nâng lên phẩm ${k}`);
  const cost=passiveCost(own,k);requireCondition(cost,own.passives[k]>=30?'Đã đạt cấp tối đa':`Yêu cầu chiến xa nâng lên phẩm ${own.tier+1}`);
  pay(cost);own.passives[k]++;return{message:`${def.name}: kỹ năng ${k+1} lên cấp ${own.passives[k]}.`};
 }
 if(action==='ruin'){
  const {def,own}=owned(p,input.shipId),r=Number(input.index);requireCondition([0,1,2].includes(r),'Phế tích không hợp lệ.');
  requireCondition(skillsMaxed(own),'Cần nâng cấp tối đa bảng kỹ năng chiến hạm mục 2');requireCondition(own.ruins[r]<ruinMax,'Đã đạt cấp tối đa');
  const cost=ruinCostOf(own,r);pay(cost);own.ruins[r]++;return{message:`${def.name}: Phế tích ${['Máu','Công','Tốc độ'][r]} lên cấp ${own.ruins[r]}.`};
 }
 if(action==='rebirth'){
  const {def,own}=owned(p,input.shipId);requireCondition(own.level>1||own.tier>0,'Chiến hạm đang ở cấp 1.');
  const refund={soul:own.spent.soul,wood:own.spent.wood};own.level=1;own.tier=0;own.spent={soul:0,wood:0};
  return{message:`Đã tái tạo ${def.name}.`,refund};
 }
 requireCondition(false,'Thao tác chiến hạm không hợp lệ.');
}

/** Gắn chiến hạm đang chọn vào trận: cộng chỉ số đội và đặt b.ship để mỗi cuối hiệp tung kỹ năng. */
export function shipForBattle(p,allies){
 const st=p.ships;if(!st?.selected)return null;const own=st.list?.[st.selected],def=byId.get(st.selected);if(!own||!def)return null;
 const aura=shipAura(def,own);
 for(const u of allies){
  if(aura.maxHpFlat){u.maxHp+=Math.round(aura.maxHpFlat);u.hp=u.maxHp}
  if(aura.attackFlat)u.attack=Math.round(u.attack+aura.attackFlat);if(aura.speedFlat)u.speed=Math.round(u.speed+aura.speedFlat);
  for(const key of ['penetration','accuracy','dodgeChance','critChance','critDamage','skillDamage','block','trueDamage'])if(aura[key])u[key]=(u[key]||0)+aura[key];
 }
 return{id:'ship',shipId:def.id,name:def.name,level:own.level,side:'ally',skill:activeSkill(def,own),skillName:def.skillName,hp:1,maxHp:1,attack:0,defense:0,speed:0,energy:0,effects:[],statuses:[],dots:[],shields:[],cooldowns:{}};
}
