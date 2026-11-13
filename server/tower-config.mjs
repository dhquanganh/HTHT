// Leo tháp đậu thần cho trang quản trị (tab "Leo tháp"): chọn quái từng tầng, cấp quái, sức mạnh %, thưởng; thêm tầng mới.
// 2.301 tầng gốc (db_tower) là mặc định. Bản sửa lưu thưa ở tower_config ({_id:'tower', floors:{số tầng: sửa}, added:[tầng thêm]})
// và được áp thẳng vào towerData.floors / towerData.enemies mà server/tower.mjs đọc.
//   - enemies: [{avatar, position}] — quái chọn từ tướng có hình; nguồn quái mới đăng ký với mã 'hero-<avatar>'.
//   - level: cấp quái của tầng. Chỉ số quái (vốn tính theo sức mạnh tầng) nhân theo đường cong lên cấp của tướng
//     giữa cấp mới và cấp gốc của tầng (server/content.mjs levelCurve); cấp hiển thị trong trận cũng đổi theo.
//   - scale: sức mạnh % (100 = giữ nguyên); stars: sao quái tùy chỉnh; gold / stones / drops: thưởng qua tầng.
import {requireCondition,integer} from './errors.mjs';
import {towerData,heroAlbum,campaign,itemIcon,materials} from './catalog.mjs';
import {levelCurve} from './content.mjs';

const {floors,enemies}=towerData;
const defaults=structuredClone(floors),defaultEnemies=new Set(Object.keys(enemies));
export const defaultFloorCount=defaults.length,maxLevel=10000000;
const visuals={...campaign.visuals,...towerData.visuals};
const byAvatar=new Map(heroAlbum.heroes.map(h=>[String(h.avatar),h]));
export const towerMonsters=heroAlbum.heroes.filter(h=>visuals[h.avatar]?.skeleton&&visuals[h.avatar]?.head).sort((a,b)=>b.rank-a.rank||a.name.localeCompare(b.name,'vi'));
// Quái gốc chỉ có trong bảng quái tháp (vd. Luffy N.W) cũng chọn được: lấy tên / hệ / nghề từ bảng đó.
const towerOnly=new Map();for(const e of Object.values(enemies))if(!byAvatar.has(String(e.avatar))&&visuals[e.avatar]?.head&&!towerOnly.has(String(e.avatar)))towerOnly.set(String(e.avatar),{avatar:String(e.avatar),name:e.name,faction:e.faction,class:e.class,rank:0});
const usable=new Set([...towerMonsters.map(h=>String(h.avatar)),...towerOnly.keys()]);
let saved={floors:{},added:[]};

const sourceFor=(avatar,level,stars)=>{const h=byAvatar.get(String(avatar))||towerOnly.get(String(avatar)),id=`hero-${avatar}-${level}-${stars}`;
 enemies[id]??={sourceId:'hero-'+avatar,heroId:String(avatar),avatar:String(avatar),name:h.name,level,stars,faction:h.faction,class:h.class};return id};
/** Ghép bản sửa vào một tầng (row gốc hoặc tầng thêm). */
function merge(base,edit){
 const row=structuredClone(base);if(!edit)return row;
 row.baseLevel=base.baseLevel??base.level;
 if(edit.level)row.level=edit.level;
 if(edit.scale)row.scale=edit.scale;
 for(const k of ['gold','stones'])if(edit[k]!==undefined)row[k]=edit[k];
 if(edit.drops)row.drops=structuredClone(edit.drops);
 if(edit.enemies?.length){const stars=edit.stars||Math.max(...base.enemies.map(e=>enemies[e.monsterId]?.stars||1));row.stars=stars;row.enemies=edit.enemies.map(e=>({monsterId:sourceFor(e.avatar,row.level,stars),position:e.position}))}
 else if(edit.level&&edit.level!==base.level)row.enemies=base.enemies.map(e=>{const s=enemies[e.monsterId];return{...e,monsterId:s&&defaultEnemies.has(e.monsterId)?registerLevel(e.monsterId,edit.level):e.monsterId}});
 return row;
}
// Quái gốc ở cấp mới: bản sao nguồn chỉ khác cấp hiển thị.
function registerLevel(id,level){const key=`${id}@${level}`;enemies[key]??={...enemies[id],level};return key}
export function applyTowerConfig(doc){
 saved={floors:doc?.floors||{},added:doc?.added||[]};
 const rows=[...defaults,...saved.added].map((r,i)=>merge({...r,floor:i+1},saved.floors[i+1]));
 floors.splice(0,floors.length,...rows);
}
/** Điều chỉnh đơn vị quái theo cấp / sức mạnh % của tầng (gọi sau enemyUnit). */
export function adjustTowerUnit(row,unit){
 const k=(row.scale??100)/100,lv=row.level,base=row.baseLevel;
 const r=f=>base&&lv!==base?levelCurve[f](lv)/levelCurve[f](base):1;
 const maxHp=Math.max(1,Math.round(unit.maxHp*k*r('maxHp')));
 return{...unit,level:row.baseLevel?lv:unit.level,maxHp,hp:maxHp,attack:Math.max(1,Math.round(unit.attack*k*r('attack'))),defense:Math.max(1,Math.round(unit.defense*k*r('defense'))),speed:Math.max(1,Math.round(unit.speed*r('speed')))};
}
const head=a=>visuals[a]?.head?itemIcon({assetKey:visuals[a].head}):null;
export function towerAdminView(page=0,size=20){
 const pages=Math.ceil(floors.length/size),p=Math.max(0,Math.min(pages-1,page));
 const row=f=>({floor:f.floor,level:f.level,baseLevel:f.baseLevel??f.level,scale:f.scale??100,power:f.power,gold:f.gold,stones:f.stones,drops:f.drops,stars:f.stars??null,
  edited:!!saved.floors[f.floor],added:f.floor>defaultFloorCount,enemies:f.enemies.map(e=>{const s=enemies[e.monsterId]||{};return{avatar:s.avatar,name:s.name,position:e.position,stars:s.stars,head:head(s.avatar)}})});
 return{total:floors.length,defaultCount:defaultFloorCount,page:p,pages,size,edited:Object.keys(saved.floors).map(Number).sort((a,b)=>a-b),added:saved.added.length,stoneItem:materials.rank,
  floors:floors.slice(p*size,(p+1)*size).map(row),monsters:[...towerMonsters,...towerOnly.values()].map(h=>({avatar:String(h.avatar),name:h.name,faction:h.faction,rank:h.rank,head:head(h.avatar)}))};
}
/** Kiểm tra bản sửa một tầng: {enemies?, level?, scale?, stars?, gold?, stones?, drops?}. */
export function validateFloorEdit(input,n,isRewardId){
 requireCondition(input&&typeof input==='object','Dữ liệu không hợp lệ.');const out={},label=`Tầng ${n}`;
 if(Array.isArray(input.enemies)&&input.enemies.length){
  requireCondition(input.enemies.length<=6,`${label}: tối đa 6 quái.`);const pos=new Set();
  out.enemies=input.enemies.map((e,i)=>{const a=String(e?.avatar);requireCondition(usable.has(a),`${label}: quái ${a} không dùng được.`,404);const p=integer(e.position??i+1,1,6,`${label}: vị trí`);requireCondition(!pos.has(p),`${label}: trùng vị trí ${p}.`);pos.add(p);return{avatar:a,position:p}});
 }
 if(input.level!==undefined&&input.level!==null&&input.level!=='')out.level=integer(input.level,1,maxLevel,`${label}: cấp quái`);
 if(input.scale!==undefined&&input.scale!==null&&input.scale!==''){out.scale=integer(input.scale,10,100000,`${label}: sức mạnh %`);if(out.scale===100)delete out.scale}
 if(input.stars!==undefined&&input.stars!==null&&input.stars!=='')out.stars=integer(input.stars,1,15,`${label}: sao`);
 for(const k of ['gold','stones'])if(input[k]!==undefined&&input[k]!==null&&input[k]!=='')out[k]=integer(input[k],0,1e12,`${label}: ${k==='gold'?'Beli':'Đá đột phá'}`);
 if(Array.isArray(input.drops)){requireCondition(input.drops.length<=8,`${label}: tối đa 8 vật phẩm rơi.`);out.drops=input.drops.map(d=>{requireCondition(isRewardId(d?.itemId),`${label}: vật phẩm không hợp lệ.`);return{itemId:d.itemId,quantity:integer(d.quantity,1,1e12,`${label}: số lượng`)}})}
 return out;
}
/** Thao tác quản trị → bản lưu mới (chưa áp). op: save {floor, data} | clear {floor} | add | remove. */
export function editTower(input,isRewardId){
 const next=structuredClone(saved),op=input?.op,total=defaults.length+next.added.length;
 if(op==='save'){const n=integer(input.floor,1,total,'Tầng');const v=validateFloorEdit(input.data,n,isRewardId);if(Object.keys(v).length)next.floors[n]=v;else delete next.floors[n];return next}
 if(op==='clear'){const n=integer(input.floor,1,total,'Tầng');delete next.floors[n];return next}
 if(op==='add'){requireCondition(total<20000,'Tối đa 20.000 tầng.');const last=floors.at(-1),up=v=>Math.round(v*1.02);
  // Đội quái chép từ tầng gốc / tầng thêm cuối (mã quái gốc, không phụ thuộc bản sửa); cấp +1, sức mạnh / thưởng +2%.
  const baseEnemies=(next.added.at(-1)||defaults.at(-1)).enemies;next.added.push({floor:total+1,level:last.level+1,power:up(last.power),gold:up(last.gold),stones:up(last.stones),drops:[],enemies:structuredClone(baseEnemies)});return next}
 if(op==='remove'){requireCondition(next.added.length,'Chỉ xoá được tầng đã thêm (tầng gốc giữ nguyên).');next.added.pop();delete next.floors[total];return next}
 requireCondition(false,'Thao tác không hợp lệ.');
}
