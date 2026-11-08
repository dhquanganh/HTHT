// Trái Ác Quỷ (lua_forbiddenfruit, FFMain). Dữ liệu nguyên từ db_devil_fruit, db_devil_fruit_set, db_config_devilFruit
// (tools/export-devil-fruit.py). Luật theo client gốc (FFDataItem, FFUpgrade, FFPanelWheel, FFPopupHeroView) và các
// dịch vụ FRUIT_* của server gốc; câu báo lỗi lấy đúng từ server_message.
//   - Hợp thành: đủ mảnh theo hạng (shard: hạng 1 cần 30, hạng 2-4 cần 50) và chưa sở hữu.
//   - Cường hóa: tối đa cấp maxupgrade (20); phí cấp n = upgrade[hạng].feeupgrade[n] (Tinh Chất + Beli).
//   - Nâng sao: tối đa 12 sao; phí sao n = awaken[hạng].fee[n] (Gen + sameshard mảnh của chính trái đó).
//   - Chỉ số cơ bản × (1 + 0,05 × cấp) × hệ số bộ; chỉ số đặc biệt × scalestar[sao].
//   - Bộ: cả 4 trái của bộ đạt 2 / 4 / 6 sao → chỉ số cơ bản +20% / +30% / +50% (cộng dồn).
//   - Vòng quay thường (Xu Bạc) / đặc biệt (Xu Vàng): 16 ô theo summonNormal / summonSpecial, chọn theo percent;
//     loại 1 = cả trái (đã có thì đổi ra đủ mảnh của trái đó), loại 2 = mảnh trái ngẫu nhiên, loại 3 = vật phẩm.
//   - Tướng cộng hưởng: tướng cấp ≥ 100 đặt vào ô nhận toàn bộ chỉ số các trái đã sở hữu; 3 ô mở sẵn, ô sau mở bằng
//     kim cương theo slotInfo.feeUnlocked, tối đa 50 ô.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition} from './errors.mjs';

const data=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/devil-fruit.json',import.meta.url)),'utf8'));
export const fruitData={fruits:data.fruits,sets:data.sets,config:data.config,points:data.points};
const config=data.config,fruitById=new Map(data.fruits.map(f=>[f.id,f])),setOf=new Map();
for(const set of data.sets)for(const id of set.fruits)setOf.set(id,set);
export const maxLevel=config.maxupgrade,maxStar=config.scalestar.length-1,heroMinLevel=100;
const item=id=>'consumable:'+id;
export const shardsFor=rank=>config.shard.find(s=>s.rank===rank)?.amount??9999;
const wheels={1:{rows:config.summonNormal,fee:config.feeNormal,name:'Vòng quay thường'},2:{rows:config.summonSpecial,fee:config.feeSpecial,name:'Vòng quay đặc biệt'}};

function state(p){
 p.devilFruit??={owned:{},shards:{},slots:config.slotInfo.openDefault,heroes:[],history:{1:[],2:[]}};
 const s=p.devilFruit;s.history??={1:[],2:[]};s.heroes??=[];s.shards??={};s.owned??={};s.slots??=config.slotInfo.openDefault;
 return s;
}
const fruitOrFail=id=>{const f=fruitById.get(Number(id));requireCondition(f,'Trái ác quỷ không tồn tại.',404,'FRUIT_UNKNOWN');return f};
const ownedOrFail=(s,f)=>{const o=s.owned[f.id];requireCondition(o,'Chưa sở hữu trái này.',409,'FRUIT_NOT_OWNED');return o};

/** Hệ số bộ của trái: 1 + tổng buff các mốc 2/4/6 sao mà cả 4 trái trong bộ đều đạt. */
export function setScale(s,set){
 if(!set)return{scale:1,steps:0};
 const stars=set.fruits.map(id=>s.owned[id]?.star??-1);let add=0,steps=0;
 [2,4,6].forEach((need,i)=>{if(stars.every(x=>x>=need)){add+=set.buff[i];steps++}});
 return{scale:1+add,steps};
}
/** Chỉ số thực của một trái theo cấp / sao: [mã, giá trị] (giá trị thô như bảng, chưa chia). */
export function fruitPoints(s,fruit,{level,star}={}){
 const o=s.owned[fruit.id]||{level:0,star:0},lv=level??o.level,st=star??o.star;
 const base=(1+config.scaleupgrade*lv)*setScale(s,setOf.get(fruit.id)).scale,special=config.scalestar[Math.min(st,maxStar)];
 return{base:fruit.base.map(([id,v])=>[id,v*base]),special:fruit.special.map(([id,v])=>[id,v*special])};
}
/** Tổng chỉ số mọi trái đã sở hữu (dùng cho tướng cộng hưởng và bảng "Tổng chỉ số"). */
export function totalPoints(s){
 const sum=new Map();
 for(const id of Object.keys(s.owned)){const f=fruitById.get(Number(id));if(!f)continue;const pts=fruitPoints(s,f);for(const [k,v] of [...pts.base,...pts.special])sum.set(k,(sum.get(k)||0)+v)}
 return[...sum].sort((a,b)=>a[0]-b[0]);
}
export function devilFruitView(p){
 const s=state(p);
 return{owned:s.owned,shards:s.shards,slots:s.slots,maxSlots:config.slotInfo.maxSlot,unlockFee:config.slotInfo.feeUnlocked[s.slots]??null,heroes:s.heroes,history:s.history,total:totalPoints(s)};
}
export function combineFruit(p,input){
 const s=state(p),f=fruitOrFail(input.fruitId);
 requireCondition(!s.owned[f.id],'Đã sở hữu trái này.',409,'FRUIT_OWNED');
 const need=shardsFor(f.rank);requireCondition((s.shards[f.id]||0)>=need,'Không đủ mảnh để ghép trái.',409,'FRUIT_SHARDS');
 s.shards[f.id]-=need;s.owned[f.id]={level:0,star:0};
 return{message:`Nhận Trái ${f.name}`,fruitId:f.id};
}
export function levelUpFruit(p,input,pay){
 const s=state(p),f=fruitOrFail(input.fruitId),o=ownedOrFail(s,f);
 requireCondition(o.level<maxLevel,'Trái đã đạt cấp độ tối đa.',409,'FRUIT_MAX_LEVEL');
 const fee=config.upgrade.find(u=>u.rank===f.rank)?.feeupgrade.find(x=>x.level===o.level+1);requireCondition(fee,'Thiếu cấu hình nâng cấp trái.',500);
 pay({itemId:item(fee.item[2]),quantity:fee.item[3]});pay({itemId:'gold',quantity:fee.gold[1]});
 o.level++;return{message:`${f.name} +${o.level}`,level:o.level};
}
export function starUpFruit(p,input,pay){
 const s=state(p),f=fruitOrFail(input.fruitId),o=ownedOrFail(s,f);
 requireCondition(o.star<maxStar,'Trái đã đạt sao tối đa.',409,'FRUIT_MAX_STAR');
 const fee=config.awaken.find(a=>a.rank===f.rank)?.fee.find(x=>x.star===o.star+1);requireCondition(fee,'Thiếu cấu hình thức tỉnh trái.',500);
 requireCondition((s.shards[f.id]||0)>=fee.sameshard,'Không đủ mảnh trái.',409,'FRUIT_SHARDS');
 if(fee.item[3]>0)pay({itemId:item(fee.item[2]),quantity:fee.item[3]});
 s.shards[f.id]-=fee.sameshard;o.star++;
 return{message:`${f.name} ${o.star} sao`,star:o.star};
}
/** Một lượt quay: chọn ô theo percent, trả kết quả và ô trúng (1..16) để client chạy đèn. */
function rollOnce(s,mode,random,grant){
 const rows=wheels[mode].rows,total=rows.reduce((n,r)=>n+r.percent,0);let x=random()*total,index=0;
 for(;index<rows.length-1;index++){x-=rows[index].percent;if(x<0)break}
 const row=rows[index],out={slot:index+1,type:row.type};
 if(row.type===3){const reward={itemId:item(row.values[2]),quantity:row.amount};grant(reward);out.reward=reward}
 else{
  const fruit=fruitById.get(row.values[Math.floor(random()*row.values.length)]);out.fruitId=fruit.id;
  if(row.type===1&&!s.owned[fruit.id]){s.owned[fruit.id]={level:0,star:0};out.newFruit=true}
  else{const amount=row.type===1?shardsFor(fruit.rank):row.amount;s.shards[fruit.id]=(s.shards[fruit.id]||0)+amount;out.shards=amount;out.converted=row.type===1}
 }
 return out;
}
export function rollWheel(p,input,{pay,grant,random=Math.random,name='Bạn'}){
 const s=state(p),mode=Number(input.mode),count=Number(input.count);
 requireCondition(wheels[mode],'Vòng quay không hợp lệ.',400);requireCondition(count===1||count===10,'Số lượt quay không hợp lệ.',400);
 const [ticket,per]=wheels[mode].fee;pay({itemId:item(ticket),quantity:per*count});
 const results=Array.from({length:count},()=>rollOnce(s,mode,random,grant));
 // Lịch sử vòng quay (FRUIT_*_WHEEL_STATUS): các phần quà quý gần nhất.
 for(const r of results)if(r.type!==3){const f=fruitById.get(r.fruitId);s.history[mode].unshift(r.newFruit?`${name} nhận Trái ${f.name}`:`${name} nhận ${r.shards} mảnh ${f.name}`)}
 s.history[mode]=s.history[mode].slice(0,20);
 return{message:`Đã quay ${count} lần.`,results};
}
export function setResonance(p,input,heroes){
 const s=state(p),list=Array.isArray(input.heroes)?input.heroes.slice(0,s.slots):[],seen=new Set();
 for(const id of list){if(!id)continue;const h=heroes.get(id);requireCondition(h,'Bạn chưa sở hữu tướng này.',404);requireCondition(h.level>=heroMinLevel,`Tướng cộng hưởng cần đạt cấp ${heroMinLevel}.`,409,'FRUIT_HERO_LEVEL');requireCondition(!seen.has(id),'Tướng đã ở ô khác.',409);seen.add(id)}
 s.heroes=list.map(id=>id||null);return{message:'Đã lưu tướng cộng hưởng.'};
}
export function unlockResonance(p,pay){
 const s=state(p);requireCondition(s.slots<config.slotInfo.maxSlot,'Đã mở tối đa ô cộng hưởng.',409);
 const fee=config.slotInfo.feeUnlocked[s.slots];if(fee>0)pay({itemId:'diamonds',quantity:fee});s.slots++;
 return{message:`Đã mở ô cộng hưởng thứ ${s.slots}.`};
}
// ---- Chỉ số cộng cho tướng cộng hưởng
// Mã cơ bản 0-3 (cộng số), 100-103 (%); mã đặc biệt chuyển sang thuộc tính trận đấu, giá trị / 1000 (bảng ghi ‰).
const specialCombat={6:'accuracy',7:'block',8:'critChance',9:'critDamage',10:'penetration',11:'debuffResist',12:'damageReduction',13:'trueDamage',95:'penResist',99:'controlPierce',58:'dotReduction',1104:'critResist',1107:'dotDamage',1112:'critResist',1113:'basicDamage',1114:'basicReduction',1115:'skillDamage',1116:'skillReduction'};
export function resonates(p,heroId){const s=p.devilFruit;return !!s?.heroes?.includes(heroId)}
/** Nhóm điểm cho equipmentBonus (mã 0-3, 100-103) và thuộc tính trận đấu cho tướng cộng hưởng đủ cấp. */
export function fruitBonus(p,hero){
 const s=p.devilFruit;if(!s||!hero||hero.level<heroMinLevel||!s.heroes?.includes(hero.id))return{groups:[],combat:{}};
 const groups=[],combat={};
 for(const [id,value] of totalPoints(s)){
  if([0,1,2,3,100,101,102,103].includes(id))groups.push({clazz:0,faction:0,point:[[id,Math.round(value)]]});
  else if(specialCombat[id])combat[specialCombat[id]]=(combat[specialCombat[id]]||0)+value/1000;
 }
 return{groups,combat};
}
