// Luyện hồn (EXC, bundle lua_ex/eventlua2/exclusive). Dữ liệu nguyên db_exc.json (tools/export-exc.py), luật theo
// EXCDbManager / EXCPanelMain / LuaJobAddEXC gốc:
//   - Chỉ 39 tướng trong db_exc.heroes; mở khi tướng đạt unlockStar (10) sao ("Thuyền viên đạt 10 sao trở lên để mở khóa").
//   - 40 cấp. Cấp n -> n+1 tốn material_level_up của dòng n ([3,1,itemId,số] = Hải hồn Sơ / Trung / Cao / Tuyệt).
//   - Chỉ số tích lũy point_level_data của cấp hiện tại: 100 = % Công, 102 = % Máu (giá trị thô, 10 = 1%), 3 = Tốc độ.
//   - Kỹ năng: bậc 1-4 mở ở cấp đầu tiên có skill_level tương ứng (10/20/30/40); bậc cao thay bậc thấp (mô tả là
//     bản cường hóa của cùng kỹ năng). stats của bậc: point 0/1/2/3 + percent = % Công / Thủ / Máu / Tốc,
//     3 + value = Tốc cộng số, 98 = Né tránh, còn lại giá trị / 1000 như chỉ số đặc biệt của Trái Ác Quỷ.
//   - Cài lại: fee_decay kim cương của cấp hiện tại, trả lại toàn bộ nguyên liệu đã dùng, về cấp 0.
//   - Máy chủ gốc còn yêu cầu server mở đủ serverDays (7) ngày; bản web không có ngày mở server nên bỏ điều kiện đó.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition,GameError} from './errors.mjs';

export const excData=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/exc.json',import.meta.url)),'utf8'));
const byAvatar=new Map(excData.heroes.map(h=>[String(h.avatar),h]));
const levels=new Map(excData.levels.map(r=>[r.level,r]));
export const excMaxLevel=excData.maxLevel,excUnlockStar=excData.unlockStar;
export const excHero=avatar=>excData.open?byAvatar.get(String(avatar))||null:null;
const skillUnlock=(()=>{const out={};for(let lv=0;lv<=excMaxLevel;lv++){const r=levels.get(lv);if(r&&r.skill_level>0&&out[r.skill_level]===undefined)out[r.skill_level]=lv}return out})();
/** Bonus [3,k,id,n,...] -> {itemId:qty}. */
export function excCost(level){
 const v=levels.get(level)?.material_level_up||[],out={};
 for(let i=0;i<v.length;){if(v[i]===3){const k=v[i+1];i+=2;for(let j=0;j<k;j++,i+=2)out['consumable:'+v[i]]=(out['consumable:'+v[i]]||0)+v[i+1]}else if(v[i]===1){out.gold=(out.gold||0)+v[i+1];i+=2}else if(v[i]===2){out.diamonds=(out.diamonds||0)+v[i+1];i+=2}else break}
 return out;
}
const state=h=>{const e=h.exc&&typeof h.exc==='object'?h.exc:{level:0,spent:{}};e.level=Math.max(0,Math.min(excMaxLevel,Math.floor(e.level||0)));e.spent??={};return e};
export const excLevel=h=>state(h).level;
/** Chỉ số tích lũy ở cấp hiện tại: {attackPct, maxHpPct, speed}. */
export function excPoints(level){
 const out={attackPct:0,maxHpPct:0,speed:0};for(const [id,v] of levels.get(level)?.point_level_data||[]){if(id===100)out.attackPct+=v/1000;else if(id===102)out.maxHpPct+=v/1000;else if(id===3)out.speed+=v}
 return out;
}
export const excSkillTier=level=>levels.get(level)?.skill_level||0;
const combatPoint={6:'accuracy',7:'block',8:'critChance',9:'critDamage',10:'penetration',11:'debuffResist',12:'damageReduction',13:'trueDamage',58:'dotReduction',95:'penResist',98:'dodgeChance',99:'controlPierce'};
/** stats của bậc kỹ năng đang mở -> chỉ số bộ kỹ năng trận đấu (applyKitStats). */
export function excTierStats(avatar,level){
 const hero=excHero(avatar),tier=excSkillTier(level),s=hero?.skills?.[tier-1];if(!s)return{};
 const out={},add=(k,v)=>{out[k]=(out[k]||0)+v};
 for(const x of s.stats||[]){
  if(x.percent!==undefined){const k={0:'attack',1:'defense',2:'maxHp',3:'speed'}[x.point];if(k)add(k,x.percent/100);else if(combatPoint[x.point])add(combatPoint[x.point],x.percent/100)}
  else if(x.point===3)add('speedFlat',x.value);else if(combatPoint[x.point])add(combatPoint[x.point],x.value/1000);
 }
 return out;
}
/** Kỹ năng đang mở (bậc cao nhất) để đưa vào bộ kỹ năng trận đấu. */
export function excSkill(avatar,level){const hero=excHero(avatar),tier=excSkillTier(level),s=hero?.skills?.[tier-1];return s?{tier,name:`Luyện hồn ${tier}: ${hero.skillName}`,text:s.text,hasStats:!!(s.stats||[]).length}:null}
export function excView(h,avatar){
 const hero=excHero(avatar),e=state(h),open=!!hero&&h.stars>=excUnlockStar;
 return{eligible:!!hero,unlockStar:excUnlockStar,open,level:e.level,maxLevel:excMaxLevel,points:excPoints(e.level),cost:e.level<excMaxLevel?excCost(e.level):null,
  feeDecay:levels.get(e.level)?.fee_decay||0,tier:excSkillTier(e.level),skillName:hero?.skillName||'',
  skills:hero?(hero.skills||[]).map((s,i)=>({tier:i+1,unlock:s.unlock??skillUnlock[i+1],text:s.text,unlocked:e.level>=(s.unlock??skillUnlock[i+1])})):[]};
}
/** op: 'level' | 'reset'. ctx: {pay(cost), grant(rewards), spendDiamonds(n)}. */
export function excAction(h,avatar,input,ctx){
 const hero=excHero(avatar);requireCondition(hero,'Thuyền viên chưa mở khóa Luyện Hồn',409,'EXC_LOCKED');
 requireCondition(h.stars>=excUnlockStar,`Thuyền viên đạt ${excUnlockStar} sao trở lên để mở khóa Luyện Hồn`,409,'EXC_STAR');
 const e=state(h);h.exc=e;
 if(input.op==='level'){
  requireCondition(e.level<excMaxLevel,'Đã đạt cấp tối đa',409,'EXC_MAX');
  const cost=excCost(e.level);ctx.pay(cost);for(const [id,q] of Object.entries(cost))e.spent[id]=(e.spent[id]||0)+q;e.level++;
  const tier=excSkillTier(e.level),newTier=tier>excSkillTier(e.level-1);
  return{message:newTier?`Luyện hồn cấp ${e.level}: mở khóa kỹ năng Lv.${tier}!`:`Luyện hồn lên cấp ${e.level}.`,level:e.level,unlockedTier:newTier?tier:0};
 }
 if(input.op==='reset'){
  requireCondition(e.level>0,'Luyện hồn chưa được nâng cấp.',409,'EXC_EMPTY');
  const fee=levels.get(e.level)?.fee_decay||0;if(fee)ctx.spendDiamonds(fee);
  const rewards=Object.entries(e.spent).filter(([,q])=>q>0).map(([itemId,quantity])=>({itemId,quantity}));ctx.grant(rewards);
  e.level=0;e.spent={};return{message:'Đã hoàn trả Luyện hồn, nhận lại toàn bộ nguyên liệu.',rewards};
 }
 throw new GameError('Thao tác không hợp lệ.');
}
export const excHelp=()=>[
 `Thuyền viên đạt ${excUnlockStar} sao mở khóa Luyện Hồn (chỉ một số thuyền viên).`,
 `Luyện Hồn có ${excMaxLevel} cấp độ, mỗi giai đoạn nâng cấp cần có nguyên liệu tương ứng.`,
 `Khi đạt cấp ${Object.values(skillUnlock).join(', ')} sẽ mở khóa kỹ năng tương ứng.`,
 'Thuyền viên đã nâng cấp Luyện Hồn không thể sử dụng làm nguyên liệu, Hoàn trả, Huyết tế, phân rã...',
 'Có thể sử dụng Kim Cương để cài lại Luyện Hồn, toàn bộ nguyên liệu đã dùng được trả lại; cấp càng cao yêu cầu kim cương càng lớn.'].join('\n');
