// Trang bị đặc thù (PanelSpecialEquip / PopupSpecialEquipUpgrade trong cache HTTH).
// Mỗi tướng có hai món: "Vai trò" tăng Công, "Nhóm hạng" tăng Máu (chỉ tướng hạng S trở lên).
// Cường hóa nâng cấp độ (tối đa bằng cấp tướng), Phẩm đồ nâng phẩm 1-15 sao (5 vàng, 5 tím, 5 đỏ cam)
// khi cấp độ đủ mốc. Quy tắc và vật phẩm lấy từ client gốc: chuỗi thông báo, Huy Hiệu nghề 2015-2019,
// Huy Hiệu Rank S/SS 2026-2027, Sách Hệ 2020-2025, Đá nâng đồ 2028, Đá Năng Lượng 2144 từ cấp 250 (SpecialEquipFix.lua).
// Bảng số liệu gốc do server gửi xuống nên không có trong cache: chi phí và chỉ số dưới đây là số tự đặt.
import {requireCondition} from './errors.mjs';
import {definitionFor,heroAlbum} from './catalog.mjs';

export const specialUnlockLevel=30,specialMaxLevel=300,specialMaxTier=15,specialRankMin=5;
export const specialItems={stone:'consumable:2028',energy:'consumable:2144'};
// Lớp trong db_heroes → nghề hiển thị và Huy Hiệu tương ứng (Mihawk là assassin → Kiếm Sĩ).
const roles={warrior:['Đấu sĩ','consumable:2016'],fighter:['Đấu sĩ','consumable:2016'],mage:['Chỉ huy','consumable:2015'],assassin:['Kiếm sĩ','consumable:2017'],ranger:['Xạ thủ','consumable:2018'],priest:['Hỗ trợ','consumable:2019']};
const rankBadges={5:'consumable:2026',6:'consumable:2027'},gradeNames={1:'D',2:'C',3:'B',4:'A',5:'S',6:'SS'};
// Sách Hệ theo phe của tướng.
const books={abyss:'consumable:2020',fortress:'consumable:2021',shadow:'consumable:2022',forest:'consumable:2023',light:'consumable:2024',dark:'consumable:2025'};

export function heroIdentity(heroId){
 const d=definitionFor(heroId),album=heroAlbum.heroes.find(h=>h.avatar===d.avatar);
 // Luffy Gear 2 dùng avatar 109, dòng "Luffy - S" (class mage) trong db_heroes.
 const rank=d.rank||album?.rank||(heroId==='luffy-gear-2'?5:4),heroClass=d.class||album?.class||'warrior',faction=d.faction||album?.faction||'abyss';
 const [roleName,roleBadge]=roles[heroClass]||roles.warrior;
 return{rank,grade:gradeNames[rank]||'A',roleName,roleBadge,rankBadge:rankBadges[rank]||null,book:books[faction]||books.abyss};
}
export const tierBand=tier=>tier<=5?0:tier<=10?1:2;
/** Phần trăm cộng dồn: phẩm 1-5 mỗi sao 1%, 6-10 mỗi sao 2%, 11-15 mỗi sao 3%. */
export const tierPercent=tier=>Array.from({length:tier},(_,i)=>[1,2,3][tierBand(i+1)]).reduce((a,b)=>a+b,0);
const perLevel={role:12,rank:80};
export const levelCost=level=>({gold:1000+level*400,items:{[specialItems.stone]:1+Math.floor(level/10),...(level>=250?{[specialItems.energy]:1+Math.floor((level-250)/10)}:{})}});
export const tierNeedLevel=tier=>tier*20;
function tierCost(slot,tier,id){
 const badge=slot==='role'?id.roleBadge:id.rankBadge;
 return{gold:tier*20000,items:{[badge]:tier*2,[id.book]:tier,[specialItems.stone]:tier*10}};
}
const stateOf=hero=>({role:hero.special?.role||{level:0,tier:1},rank:hero.special?.rank||{level:0,tier:1}});
function mutableState(hero,slot){hero.special??={};return hero.special[slot]??={level:0,tier:1}}
/** Trạng thái hiển thị của hai món cho client: khóa, chỉ số hiện tại/kế tiếp, chi phí. */
export function specialView(hero){
 const id=heroIdentity(hero.id),state=stateOf(hero),open=hero.level>=specialUnlockLevel;
 const slot=key=>{
  const s=state[key],usable=key==='role'||!!id.rankBadge,stat=key==='role'?'attack':'maxHp';
  const lock=!open?`Mở khóa khi thuyền viên lên level ${specialUnlockLevel}`:!usable?`Chỉ áp dụng với tướng rank ${gradeNames[specialRankMin]} trở lên`:null;
  const levelBlock=s.level>=specialMaxLevel?'Đã đạt cấp độ tối đa':s.level>=hero.level?`Nâng cấp thuyền viên lên cấp ${s.level+1} để mở khóa cấp độ tiếp theo`:null;
  const tierBlock=s.tier>=specialMaxTier?'Phẩm đồ đạt tối đa':s.level<tierNeedLevel(s.tier)?`Cường hóa trang bị đặc thù lên cấp ${tierNeedLevel(s.tier)} để mở khóa phẩm tiếp theo`:null;
  return{key,stat,locked:!!lock,lock,label:key==='role'?id.roleName:'Hạng '+id.grade,icon:key==='role'?id.roleBadge:id.rankBadge||rankBadges[5],level:s.level,tier:s.tier,
   flat:s.level*perLevel[key],nextFlat:(s.level+1)*perLevel[key],percent:tierPercent(s.tier),nextPercent:tierPercent(Math.min(specialMaxTier,s.tier+1)),
   levelCost:levelCost(s.level),levelBlock,tierCost:usable?tierCost(key,s.tier,id):null,tierBlock,tierNeed:tierNeedLevel(s.tier)};
 };
 return{unlockLevel:specialUnlockLevel,maxLevel:specialMaxLevel,maxTier:specialMaxTier,role:slot('role'),rank:slot('rank')};
}
/** Cộng chỉ số đặc thù vào stats (trước khi tính lực chiến). */
export function applySpecial(hero,stats){
 if(hero.level<specialUnlockLevel)return;
 const view=specialView(hero);
 for(const s of [view.role,view.rank]){if(s.locked)continue;stats[s.stat]=Math.round((stats[s.stat]+s.flat)*(1+s.percent/100))}
}
/** kind 'level' = Cường hóa, 'tier' = Phẩm đồ. pay(cost) trừ vàng và vật phẩm hoặc ném lỗi. */
export function upgradeSpecial(hero,{slot,kind},pay){
 requireCondition(slot==='role'||slot==='rank','Trang bị đặc thù không hợp lệ.');
 requireCondition(kind==='level'||kind==='tier','Kiểu nâng cấp không hợp lệ.');
 const view=specialView(hero)[slot],s=mutableState(hero,slot);
 requireCondition(!view.locked,view.lock+'.',409,'SPECIAL_LOCKED');
 if(kind==='level'){requireCondition(!view.levelBlock,view.levelBlock+'.',409,'SPECIAL_LEVEL');pay(view.levelCost);s.level++;return{message:`Cường hóa thành công, cấp độ ${s.level}.`}}
 requireCondition(!view.tierBlock,view.tierBlock+'.',409,'SPECIAL_TIER');pay(view.tierCost);s.tier++;return{message:`Nâng phẩm thành công, phẩm ${s.tier}.`};
}
