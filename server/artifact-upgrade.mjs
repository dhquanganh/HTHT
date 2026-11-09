// Nâng cấp bảo vật (PopupUpgradeArtifact). Bảng gốc db_artifact_upgrade_data (tools/export-artifact-upgrade.py):
//   - Mỗi sao cần upgradeCost EXP của phẩm bảo vật (đỏ: 5400), tối đa maxStar sao (không quá số dòng effect).
//   - Nguyên liệu là bảo vật trong túi, tối đa 8 món (8 ô SlotArtifactMaterial). Mỗi món cho baseValue EXP của phẩm
//     nó, cộng toàn bộ EXP đã nạp vào món đó (sao đã lên và EXP dư), nên không mất công nâng trước.
//   - EXP dư sau khi lên sao được giữ; tới sao tối đa thì phần dư bỏ đi.
// Bảo vật đã nâng được lưu bằng khóa "artifact:<id>@<sao>:<exp>" (catalog.mjs: variantOf), vì vậy cất túi, bán, mặc lại
// hay đổi tướng đều giữ nguyên sao và EXP. Bảo vật 1 sao chưa nạp EXP giữ khóa gốc "artifact:<id>".
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition,integer} from './errors.mjs';
import {itemById} from './catalog.mjs';

const data=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/artifact-upgrade.json',import.meta.url)),'utf8'));
export const artifactUpgradeData=data;
const baseOf=item=>item.variantOf?itemById.get(item.variantOf):item;
export const upgradeRow=item=>data.upgrade[String(item.tier)]||data.upgrade['1'];
export const maxStarsOf=item=>Math.min(upgradeRow(item).maxStar,baseOf(item).levels?.length||1);
export function artifactKey(baseId,stars,exp){return stars<=1&&!exp?baseId:`${baseId}@${stars}:${exp}`}
/** EXP một bảo vật cho khi làm nguyên liệu. */
export function materialValue(item){const row=upgradeRow(item);return row.baseValue+((item.stars||1)-1)*row.upgradeCost+(item.artifactExp||0)}
/** Kết quả nạp `gain` EXP vào bảo vật: {stars, exp, key}. */
export function applyExp(item,gain){
 const row=upgradeRow(item),max=maxStarsOf(item);let stars=item.stars||1,exp=(item.artifactExp||0)+gain;
 while(stars<max&&exp>=row.upgradeCost){exp-=row.upgradeCost;stars++}
 if(stars>=max)exp=0;
 return{stars,exp,key:artifactKey(baseOf(item).id,stars,exp)};
}
/**
 * input.target: 'equipped' (bảo vật tướng đang dùng) hoặc khóa bảo vật trong túi; input.materials: {khóa: số lượng}.
 * spend/add: trừ/cộng túi đồ của game.mjs.
 */
export function upgradeArtifact(p,input,{spend,add}){
 const h=p.hero,equipped=input.target==='equipped',key=equipped?h.equipment.accessory:String(input.target||'');
 const item=itemById.get(key);requireCondition(item?.category==='artifact','Hãy chọn bảo vật cần nâng cấp.',400,'ARTIFACT_TARGET');
 if(!equipped)requireCondition((p.inventory[key]||0)>=1,'Bạn chưa sở hữu bảo vật này.',409,'ARTIFACT_TARGET');
 requireCondition((item.stars||1)<maxStarsOf(item),'Bảo vật đã đạt sao tối đa.',409,'ARTIFACT_MAX');
 const materials=input.materials&&typeof input.materials==='object'&&!Array.isArray(input.materials)?input.materials:{};
 let total=0,gain=0;
 for(const [id,raw] of Object.entries(materials)){
  const qty=integer(raw,1,data.materialSlots,'Số lượng nguyên liệu'),m=itemById.get(id);
  requireCondition(m?.category==='artifact','Chỉ dùng bảo vật làm nguyên liệu.',400,'ARTIFACT_MATERIAL');
  const own=(p.inventory[id]||0)-(!equipped&&id===key?1:0);requireCondition(own>=qty,`Không đủ ${m.name}.`,409,'ARTIFACT_MATERIAL');
  total+=qty;gain+=materialValue(m)*qty;
 }
 requireCondition(total>0,'Hãy chọn bảo vật làm nguyên liệu.',400,'ARTIFACT_MATERIAL');
 requireCondition(total<=data.materialSlots,`Tối đa ${data.materialSlots} nguyên liệu mỗi lần.`,400,'ARTIFACT_MATERIAL');
 spend(p,Object.fromEntries(Object.entries(materials).map(([id,q])=>[id,q])));
 const result=applyExp(item,gain);
 if(equipped)h.equipment.accessory=result.key;else{spend(p,{[key]:1});add(p,result.key,1)}
 // Khóa biến thể đã dùng hết thì bỏ khỏi túi (khóa gốc giữ như mọi vật phẩm khác).
 for(const id of [...Object.keys(materials),key])if(id.includes('@')&&!p.inventory[id])delete p.inventory[id];
 const up=result.stars-(item.stars||1);
 return{message:up>0?`${item.name} lên ${result.stars} sao.`:`Đã nạp ${gain} EXP cho ${item.name}.`,itemId:result.key,stars:result.stars,exp:result.exp,gain};
}
