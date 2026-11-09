// Thiên phú (HolyBlessing / HLB của bản gốc). Dữ liệu nguyên từ db_talent_upgrade, db_talent_table và db_hero_skill
// (tools/export-talent.py). Luật theo HLBPanelAdvance / HLBPanelAdvanceLevelUp / HLBPanelAdvanceStarUp / HLBPanelScheme /
// HLBPopupSelectTable / HLBPopupSelectSkill / HLBBlessingModel:
//   - Mở khi tướng thức tỉnh tới sao đỏ (bản gốc: tướng 10 sao). Chưa chọn bảng thì chỉ có nút chọn bảng (lần đầu miễn phí).
//   - Chọn bảng: Thiên phú cấp 1, 1 sao. Cấp n hiển thị chỉ số point_level_data của cấp n (Công / Máu / Tốc cộng thẳng)
//     và phí material_level_up của cấp n để lên cấp n+1 (Kết Tinh Ý Chí). Tối đa 50 cấp, giới hạn cấp = sao × 10.
//   - Ở cấp có skill_unlock_hero_star > sao hiện tại (10, 20, 30, 40, 50) phải nâng sao: material_star_up (Kết Tinh Ý Chí
//     + Ngọc Tủy Hải Hồn) và copy_hero_star bản sao tướng. Mỗi sao mở thêm một ô kỹ năng (5 ô) và cộng add_level_star vào
//     giới hạn cấp tướng. Bản web mỗi tướng là duy nhất nên mỗi bản sao đổi thành heroShardPerHero mảnh của chính tướng.
//   - Mỗi ô kỹ năng đã mở chọn 1 trong 3 kỹ năng của bảng (lưu theo thứ tự 1-3 như listSkillId), đổi miễn phí.
//     Đổi bảng tốn feeChangeTable kim cương, giữ cấp/sao và thứ tự kỹ năng (ánh xạ sang bảng mới như getRealSkillIdByIndex).
//   - Cài lại: feeReset kim cương, hoàn toàn bộ nguyên liệu nâng cấp/nâng sao, về cấp 1 sao 1 và bỏ kỹ năng đã chọn.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition,GameError} from './errors.mjs';

const data=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/talent.json',import.meta.url)),'utf8'));
export const talentData=data;
export const talentUnlockStar=10,heroShardPerHero=10;
const maxLevel=data.levels.length,row=level=>data.levels[Math.max(1,Math.min(maxLevel,level))-1];
const pointField={0:'attack',2:'maxHp',3:'speed'};
const empty=()=>({table:0,level:0,star:0,skills:[0,0,0,0,0],spent:{}});

export function talentState(h){
 const t=h.talent&&typeof h.talent==='object'?h.talent:empty();
 t.skills=Array.isArray(t.skills)&&t.skills.length===5?t.skills.map(v=>[1,2,3].includes(v)?v:0):[0,0,0,0,0];t.spent??={};
 h.talent=t;return t;
}
const read=h=>h.talent&&typeof h.talent==='object'?h.talent:empty();
export const levelCapOf=t=>Math.min(maxLevel,Math.max(1,t.star)*10);
/** Kỹ năng đang dùng: id thật theo bảng và thứ tự đã chọn ở các ô đã mở. */
export function talentSkillIds(h){
 const t=read(h),table=data.tables.find(x=>x.id===t.table);if(!table)return[];
 return (t.skills||[]).map((index,i)=>i<t.star&&index>0?table.lots[i][index-1]:0);
}
/** Công / Máu / Tốc cộng thẳng của cấp hiện tại. */
export function talentStats(h){
 const out={attack:0,maxHp:0,speed:0},t=read(h);if(!t.table||t.level<1||h.stars<talentUnlockStar)return out;
 for(const [id,value] of row(t.level).points)if(pointField[id])out[pointField[id]]+=value;
 return out;
}
/** Giới hạn cấp tướng cộng thêm từ các lần nâng sao Thiên phú (add_level_star). */
export function talentLevelBonus(h){
 const t=read(h);if(!t.table)return 0;
 return data.levels.filter(r=>r.starNext>1&&r.starNext<=t.star).reduce((n,r)=>n+r.heroLevelCap,0);
}
// Hiệu ứng trận đấu của 45 kỹ năng Thiên phú, viết tay theo đúng mô tả gốc (db_hero_skill chỉ có mô tả, không có tham số).
// stats: cộng một lần khi vào trận (team-combat applyKitStats); triggers: cùng định dạng skill-kit.
// Ghi chú chỉ số: Kháng Chí Mạng = critAvoid (trừ tỉ lệ chí mạng của kẻ tấn công), Giảm ST Chí Mạng = critResist,
// Miễn Chống = debuffResist, Xuyên Miễn Chống = controlPierce, Hiệu Quả Hồi Máu = healTaken, Hiệu Quả Hồi Nộ = energyGain,
// ST/Giảm ST Đánh Thường = basicDamage/basicReduction, ST/Giảm ST Nộ = skillDamage/skillReduction,
// ST/Giảm ST Cuối Lượt (thiêu đốt, độc, chảy máu, Bỏng Lạnh...) = dotDamage/dotReduction.
const st=(attr,value,turns,on='self',extra={})=>({type:'stat',attr,value,flat:false,turns,on,...extra});
const front={count:1,pick:'front',row:null};
const onHit=(effects)=>[{on:'attack',effects,chance:1},{on:'selfUlt',effects,chance:1}];
const kits={
 // Cuồng Bạo
 210001:{stats:{attack:.2,penetration:.35}},
 210002:{stats:{skillDamage:.35,trueDamage:.25}},
 210003:{stats:{critChance:.5,critDamage:.35}},
 210010:{triggers:[{on:'battleStart',effects:[st('attack',1,1),st('trueDamage',1,1)],chance:1}]},
 210011:{triggers:[{on:'enemyDeath',effects:[{type:'energy',value:50,on:'self'},st('penetration',.5,5)],chance:1}]},
 210012:{triggers:[{on:'allyUlt',effects:[{type:'energy',value:15,on:'self'},st('attack',.3,3)],chance:1}]},
 210019:{triggers:[{on:'selfUlt',effects:[st('penetration',.5,3)],chance:1}]},
 210020:{triggers:onHit([st('dotDamage',.35,3)])},
 210021:{triggers:[{on:'selfUlt',effects:[st('passiveDamage',1,3)],chance:1}]},
 210028:{stats:{basicDamage:.25,dodgePierce:.35}},
 210029:{stats:{skillDamage:.25,capPierce:.25}},
 210030:{stats:{dotDamage:.25,immortalPierce:.2}},
 210037:{triggers:[{on:'battleStart',effects:[{type:'bloodPact',ratio:.5,attack:1,turns:1}],chance:1}]},
 210038:{triggers:[{on:'selfUlt',effects:[{type:'damage',hits:1,select:front,mult:0,hpMult:2.5}],chance:1}]},
 210039:{triggers:onHit([{type:'dot',kind:'frostbite',mult:2.5,turns:2,chance:1,stack:true}])},
 // Thủ Ngự
 210004:{stats:{maxHp:.25,penResist:.35}},
 210005:{stats:{defense:.35,damageReduction:.2}},
 210006:{stats:{critAvoid:.5,critResist:.35}},
 210013:{triggers:[{on:'battleStart',effects:[st('maxHp',1,99),st('defense',1,99),st('penResist',1,99)],chance:1}]},
 210014:{triggers:[{on:'lowHp',threshold:.5,effects:[{type:'heal',maxHp:.5,on:'self'},st('damageReduction',.3,5)],chance:1}]},
 210015:{triggers:[{on:'roundStart',effects:[{type:'shield',maxHp:.25,turns:2,on:'self'}],chance:1}]},
 210022:{triggers:[{on:'selfUlt',effects:[{type:'shield',block:2,turns:2,on:'self'}],chance:1}]},
 210023:{triggers:[{on:'selfUlt',effects:[st('dotReduction',.35,3)],chance:1}]},
 210024:{triggers:[{on:'hurt',from:'any',effects:[{type:'heal',maxHp:.1,on:'self'}],chance:1}]},
 210031:{stats:{basicReduction:.5}},
 210032:{stats:{skillReduction:.5}},
 210033:{stats:{dotReduction:.5}},
 210040:{triggers:[{on:'death',effects:[{type:'revive',maxHp:1},st('maxHp',.5,99),st('attack',.5,99),st('damageReduction',.25,99)],chance:1}]},
 210041:{triggers:[{on:'hurt',from:'any',effects:[st('attack',-.15,2,'enemies')],chance:1}]},
 210042:{stats:{damageCap:.35,damageCapRounds:3}},
 // Viện Trợ
 210007:{stats:{debuffResist:.35,controlPierce:.25}},
 210008:{stats:{speedFlat:200,dodgeChance:.25}},
 210009:{stats:{lifesteal:.2,healTaken:.35}},
 210016:{triggers:[{on:'battleStart',effects:[{type:'energy',value:50,on:'self'},{type:'stat',attr:'speed',value:500,flat:true,turns:1,on:'self'}],chance:1}]},
 210017:{triggers:[{on:'dodge',effects:[st('attack',.15,2),st('maxHp',.1,2)],chance:1}]},
 210018:{triggers:[{on:'roundStart',round:4,effects:[st('attack',.5,99,'team'),st('maxHp',.25,99,'team'),st('damageReduction',.15,99,'team')],chance:1}]},
 210025:{triggers:[{on:'selfUlt',effects:[{type:'cleanse',count:2,on:'team'}],chance:1}]},
 210026:{triggers:onHit([{type:'heal',maxHp:.15,on:'team'}])},
 210027:{triggers:[{on:'hurt',from:'any',effects:[{type:'energy',value:-25,on:'target',chance:1}],chance:1}]},
 210034:{stats:{energy:25,energyGain:.5}},
 210035:{stats:{evade:.15}},
 210036:{stats:{healCutImmune:1}},
 210043:{triggers:[{on:'battleStart',effects:[{type:'seal',turns:2,extraChance:.5,damage:-.5,passives:2}],chance:1}]},
 210044:{triggers:[{on:'selfUlt',effects:[st('vulnerability',.5,3,'enemies',{chance:.75})],chance:1}]},
 210045:{triggers:[{on:'selfUlt',effects:[st('healTaken',-.99,3,'enemies')],chance:1}]},
};
export const talentSkillKits=kits;
/** Kỹ năng Thiên phú đang dùng (tên, mô tả hiển thị). */
export function talentPassives(h){
 if(h.stars<talentUnlockStar)return[];
 return talentSkillIds(h).filter(Boolean).map(id=>{const s=data.skills[id];return{id,name:s.name,passive:true,description:s.description}});
}
/** Bộ kỹ năng trận đấu của Thiên phú: {passives, stats, triggers}. */
export function talentKit(h){
 const passives=talentPassives(h),stats={},triggers=[];
 for(const s of passives){const k=kits[s.id];if(!k)continue;
  for(const [key,v] of Object.entries(k.stats||{}))stats[key]=key==='damageCapRounds'?Math.max(stats[key]||0,v):(stats[key]||0)+v;
  for(const t of k.triggers||[])triggers.push({...t,skill:s.name});}
 return{passives:passives.map(s=>({name:s.name,passive:true,description:s.description,effects:[]})),stats,triggers};
}
export function talentView(h){
 const t=read(h);
 return{unlocked:h.stars>=talentUnlockStar,unlockStar:talentUnlockStar,table:t.table,level:t.level,star:t.star,levelCap:levelCapOf(t),skills:[...(t.skills||[0,0,0,0,0])],
  skillIds:talentSkillIds(h),levelBonus:talentLevelBonus(h),feeChangeTable:data.feeChangeTable,feeReset:data.feeReset};
}
const addSpent=(t,id,q)=>{t.spent[id]=(t.spent[id]||0)+q};
/**
 * input.op: 'table' {tableId} | 'level' | 'star' | 'skill' {lot, index} | 'reset'.
 * ctx: {pay(cost{itemId:qty}), grant(rewards[]), have(id), spendDiamonds(n), shard}.
 */
export function talentAction(h,input,ctx){
 requireCondition(h.stars>=talentUnlockStar,'Tướng chưa đủ điều kiện mở Thiên phú (cần thức tỉnh tới sao đỏ).',409,'TALENT_LOCKED');
 const t=talentState(h),op=String(input.op||'');
 if(op==='table'){
  const id=Number(input.tableId);requireCondition(data.tables.some(x=>x.id===id),'Bảng Thiên phú không tồn tại.',400);
  requireCondition(t.table!==id,'Đang dùng bảng này.',409,'TALENT_TABLE');
  if(t.table){ctx.spendDiamonds(data.feeChangeTable);t.table=id;return{message:`Đã đổi sang bảng ${data.tables.find(x=>x.id===id).name}.`}}
  Object.assign(t,{table:id,level:1,star:1});return{message:`Đã chọn bảng ${data.tables.find(x=>x.id===id).name}.`};
 }
 requireCondition(t.table>0,'Hãy chọn bảng Thiên phú trước.',409,'TALENT_NO_TABLE');
 if(op==='level'){
  requireCondition(t.level<maxLevel,'Tướng đã đạt thiên phú tối đa.',409,'TALENT_MAX');
  const r=row(t.level);requireCondition(t.star>=r.starNext,'Hãy nâng sao Thiên phú để tiếp tục nâng cấp.',409,'TALENT_STAR');
  ctx.pay(Object.fromEntries(r.cost.map(c=>[c.itemId,c.quantity])));for(const c of r.cost)addSpent(t,c.itemId,c.quantity);
  t.level++;return{message:`Thiên phú lên cấp ${t.level}.`,level:t.level};
 }
 if(op==='star'){
  const r=row(t.level);requireCondition(t.star<r.starNext,'Chưa thể nâng sao Thiên phú, hãy nâng cấp tiếp.',409,'TALENT_STAR');
  const shards=r.copies*heroShardPerHero,cost=Object.fromEntries(r.starCost.map(c=>[c.itemId,c.quantity]));
  if(shards)cost[ctx.shard]=(cost[ctx.shard]||0)+shards;
  ctx.pay(cost);for(const [id,q] of Object.entries(cost))addSpent(t,id,q);
  t.star++;return{message:`Thiên phú lên ${t.star} sao.`,star:t.star,heroLevelCap:r.heroLevelCap};
 }
 if(op==='skill'){
  const lot=Number(input.lot),index=Number(input.index);
  requireCondition(Number.isInteger(lot)&&lot>=1&&lot<=5&&[1,2,3].includes(index),'Kỹ năng không hợp lệ.',400);
  requireCondition(lot<=t.star,'Nâng sao thiên phú để mở khoá kĩ năng',409,'TALENT_LOT_LOCKED');
  t.skills[lot-1]=index;const id=data.tables.find(x=>x.id===t.table).lots[lot-1][index-1];
  return{message:`Đã chọn ${data.skills[id].name}.`,skillId:id};
 }
 if(op==='reset'){
  requireCondition(t.level>1||t.star>1||t.skills.some(Boolean),'Thiên phú chưa được nâng cấp.',409,'TALENT_RESET');
  ctx.spendDiamonds(data.feeReset);
  const rewards=Object.entries(t.spent).filter(([,q])=>q>0).map(([itemId,quantity])=>({itemId,quantity}));ctx.grant(rewards);
  Object.assign(t,{level:1,star:1,skills:[0,0,0,0,0],spent:{}});
  return{message:'Đã cài lại Thiên phú, hoàn trả toàn bộ nguyên liệu.',rewards};
 }
 throw new GameError('Thao tác Thiên phú không hợp lệ.');
}
