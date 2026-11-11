// Hiệu ứng đội hình (PopupInformationAuraNew gốc, lời MSG_POPUP_AURA_*):
//   - Mỗi hệ có n thuyền viên trong đội: +Máu / +Công theo bảng (1..6 người); cộng dồn qua các hệ.
//   - Mỗi thuyền viên còn cho riêng: hệ Dũng (fist, abyss), Nhãn (forest), Phong (fortress), Huyết (shadow) +2% Giảm sát thương;
//     hệ Trí (dark) và Thánh (light) +4% Miễn chống.
// Áp cho cả hai phe khi vào trận (đơn vị có faction).
export const auraTable=[[0,0],[.02,.015],[.05,.035],[.08,.055],[.11,.075],[.14,.095],[.18,.12]];
export const auraSpecial={abyss:{damageReduction:.02},forest:{damageReduction:.02},fortress:{damageReduction:.02},shadow:{damageReduction:.02},dark:{debuffResist:.04},light:{debuffResist:.04}};
export function auraOf(factions){
 const count={};for(const f of factions)if(f)count[f]=(count[f]||0)+1;
 const out={maxHp:0,attack:0,damageReduction:0,debuffResist:0};
 for(const [f,n] of Object.entries(count)){const [hp,atk]=auraTable[Math.min(6,n)];out.maxHp+=hp;out.attack+=atk;for(const [k,v] of Object.entries(auraSpecial[f]||{}))out[k]+=v*n}
 for(const k of Object.keys(out))out[k]=Math.round(out[k]*1000)/1000;
 return out;
}
/** Cộng hiệu ứng đội hình vào các đơn vị một phe (một lần). */
export function applyAura(units){
 const a=auraOf(units.map(u=>u.faction));
 for(const u of units){
  if(u.auraApplied)continue;u.auraApplied=true;
  const full=u.hp>=u.maxHp;u.maxHp=Math.round(u.maxHp*(1+a.maxHp));if(full)u.hp=u.maxHp;
  u.attack=Math.round(u.attack*(1+a.attack));if(u.baseAttack!==undefined)u.baseAttack=u.attack;
  u.damageReduction=(u.damageReduction||0)+a.damageReduction;u.debuffResist=(u.debuffResist||0)+a.debuffResist;
 }
 return a;
}
