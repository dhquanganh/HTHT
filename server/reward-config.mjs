// Bảng thưởng toàn game cho trang quản trị (tab "Phần thưởng").
// Mỗi bảng khai báo các dòng (thưởng, giá, giới hạn, tỉ lệ) đọc từ dữ liệu của tính năng; bản sửa lưu ở collection
// reward_config ({_id: id bảng, rows}) và được áp thẳng vào bộ nhớ của tính năng (cùng cách tab Sự kiện làm).
// Mặc định được chụp lúc khởi động nên "Trả về mặc định" luôn khôi phục đúng số gốc của bản web.
import {requireCondition,integer} from './errors.mjs';
import {rewardPool} from './tavern.mjs';
import {braveStageTable,milestoneRewards} from './brave.mjs';
import {challengeTable,smashTable} from './sealed.mjs';
import {marketPool,sealedShop} from './shop.mjs';
import {altarShop,soulItem} from './altar.mjs';
import {merchantGoods,dungeonStageTable} from './dungeon.mjs';
import {dailyQuests,dailyFinal} from './daily-quests.mjs';
import {casinos} from './casino.mjs';
import {itemById} from './catalog.mjs';

const clone=x=>structuredClone(x);
const one=r=>[clone(r)];
/** Dòng chung: {key,label,rewards:[{itemId,quantity}], price?, limit?, weight?}. */
const tables=[
 {id:'tavern-pool',group:'Tổng bộ',title:'Thưởng nhiệm vụ theo sao',note:'Mỗi nhiệm vụ nhận 1 món chọn ngẫu nhiên trong danh sách của mức sao đó.',list:true,
  read:()=>Object.entries(rewardPool).map(([star,list])=>({key:star,label:`${star} sao`,rewards:clone(list)})),
  write:rows=>{for(const r of rows)rewardPool[r.key]=clone(r.rewards)}},
 {id:'brave-stage',group:'Luyện tập',title:'Thưởng qua ải',list:true,
  read:()=>braveStageTable.map((list,i)=>({key:String(i+1),label:`Ải ${i+1}`,rewards:clone(list)})),
  write:rows=>{for(const r of rows)braveStageTable[Number(r.key)-1]=clone(r.rewards)}},
 {id:'brave-milestone',group:'Luyện tập',title:'Rương mốc',list:true,
  read:()=>Object.entries(milestoneRewards).map(([m,list])=>({key:m,label:`Mốc ${m} ải`,rewards:clone(list)})),
  write:rows=>{for(const r of rows)milestoneRewards[r.key]=clone(r.rewards)}},
 {id:'sealed-challenge',group:'Mê cung',title:'Thưởng khiêu chiến (lần đầu)',list:true,
  read:()=>challengeTable.map((list,i)=>({key:String(i+1),label:`Ải ${i+1}`,rewards:clone(list)})),
  write:rows=>{for(const r of rows)challengeTable[Number(r.key)-1]=clone(r.rewards)}},
 {id:'sealed-smash',group:'Mê cung',title:'Thưởng càn quét',list:true,
  read:()=>smashTable.map((list,i)=>({key:String(i+1),label:`Ải ${i+1}`,rewards:clone(list)})),
  write:rows=>{for(const r of rows)smashTable[Number(r.key)-1]=clone(r.rewards)}},
 {id:'dungeon-stage',group:'Đảo Bánh',title:'Thưởng qua ải',list:true,
  read:()=>dungeonStageTable.map((list,i)=>({key:String(i+1),label:`Ải ${i+1}`,rewards:clone(list)})),
  write:rows=>{for(const r of rows)dungeonStageTable[Number(r.key)-1]=clone(r.rewards)}},
 {id:'dungeon-merchant',group:'Đảo Bánh',title:'Hàng của gian thương',price:true,
  read:()=>Object.entries(merchantGoods).flatMap(([m,list])=>list.map((g,i)=>({key:`${m}-${i}`,label:`${['','Tiệm Mắt To','Tiệm Hạt Đậu','Tiệm Răng Sún'][m]} · món ${i+1}`,rewards:one(g.reward),price:clone(g.price)}))),
  write:rows=>{for(const r of rows){const [m,i]=r.key.split('-');Object.assign(merchantGoods[m][i],{reward:clone(r.rewards[0]),price:clone(r.price)})}}},
 {id:'shop-market',group:'Cửa hàng',title:'Chợ đen (bể hàng ngẫu nhiên)',note:'Kệ 12 món rút theo tỉ lệ. Dòng "ngẫu nhiên" chọn 1 trang bị / bảo vật trong nhóm; đổi vật phẩm thì dòng chỉ bán đúng vật phẩm đó.',price:true,weight:true,
  read:()=>marketPool.map(([weight,ids,quantity,price],i)=>({key:String(i),label:ids.length>1?`Ngẫu nhiên ${ids.length} món`:`Món ${i+1}`,rewards:[{itemId:ids[0],quantity}],price:clone(price),weight,group:ids.length>1?ids:null})),
  write:rows=>{for(const r of rows){const e=marketPool[Number(r.key)];const keep=e[1].length>1&&e[1][0]===r.rewards[0].itemId;marketPool[Number(r.key)]=[r.weight,keep?e[1]:[r.rewards[0].itemId],r.rewards[0].quantity,clone(r.price)]}}},
 {id:'shop-sealed',group:'Cửa hàng',title:'Cửa hàng Mê cung',price:true,limit:true,
  read:()=>sealedShop.map(o=>({key:o.id,label:o.id,rewards:one(o.reward),price:clone(o.price),limit:o.limit})),
  write:rows=>{for(const r of rows)Object.assign(sealedShop.find(o=>o.id===r.key),{reward:clone(r.rewards[0]),price:clone(r.price),limit:r.limit})}},
 {id:'shop-altar',group:'Cửa hàng',title:'Cửa hàng Huyết tế',note:'Giá luôn trả bằng Hồn hải tặc.',price:true,priceItem:soulItem,limit:true,
  read:()=>altarShop.map(o=>({key:o.id,label:o.id,rewards:one(o.reward),price:{itemId:soulItem,quantity:o.cost},limit:o.limit})),
  write:rows=>{for(const r of rows)Object.assign(altarShop.find(o=>o.id===r.key),{reward:clone(r.rewards[0]),cost:r.price.quantity,limit:r.limit})}},
 ...['normal','super'].map(k=>({id:'casino-'+k,group:'Vòng quay',title:casinos[k].name+' (8 ô rút theo tỉ lệ)',weight:true,
  read:()=>casinos[k].pool.map((x,i)=>({key:String(i),label:`Ô quà ${i+1}`,rewards:one(x.reward),weight:x.weight})),
  write:rows=>{for(const r of rows)Object.assign(casinos[k].pool[Number(r.key)],{reward:clone(r.rewards[0]),weight:r.weight})}})),
 {id:'daily-quests',group:'Nhiệm vụ ngày',title:'Thưởng nhiệm vụ hằng ngày',list:true,
  read:()=>[...dailyQuests.map(q=>({key:q.id,label:q.name,rewards:clone(q.rewards)})),{key:'final',label:dailyFinal.name,rewards:clone(dailyFinal.rewards)}],
  write:rows=>{for(const r of rows){if(r.key==='final')dailyFinal.rewards=clone(r.rewards);else dailyQuests.find(q=>q.id===r.key).rewards=clone(r.rewards)}}},
];
const byId=new Map(tables.map(t=>[t.id,t]));
const defaults=new Map(tables.map(t=>[t.id,t.read()]));
const nameOf=id=>itemById.get(id)?.name;
/** Kiểm tra và chuẩn hoá các dòng gửi lên cho bảng `id` (số dòng và khoá dòng phải giữ nguyên). */
export function validateRewardRows(id,input,isRewardId,onlyTable=false){
 const t=byId.get(id);requireCondition(t,'Bảng thưởng không tồn tại.',404);if(onlyTable)return null;requireCondition(Array.isArray(input),'Dữ liệu không hợp lệ.');
 const base=defaults.get(id);requireCondition(input.length===base.length,'Số dòng không khớp.');
 const reward=(r,what)=>{requireCondition(r&&typeof r==='object'&&isRewardId(r.itemId),`${what}: vật phẩm không hợp lệ.`);return{itemId:r.itemId,quantity:integer(r.quantity,1,1e12,`${what}: số lượng`)}};
 return input.map((row,i)=>{
  requireCondition(row&&row.key===base[i].key,'Thứ tự dòng không khớp.');const what=base[i].label;
  requireCondition(Array.isArray(row.rewards)&&row.rewards.length>=1&&row.rewards.length<=(t.list?10:1),`${what}: ${t.list?'cần 1–10 phần thưởng':'cần đúng 1 phần thưởng'}.`);
  const out={key:row.key,rewards:row.rewards.map(r=>reward(r,what))};
  if(t.price){out.price=reward(row.price,`${what} (giá)`);if(t.priceItem)requireCondition(out.price.itemId===t.priceItem,`${what}: giá phải trả bằng ${nameOf(t.priceItem)||t.priceItem}.`)}
  if(t.limit)out.limit=integer(row.limit,1,1e6,`${what}: giới hạn`);
  if(t.weight)out.weight=integer(row.weight,1,1e6,`${what}: tỉ lệ`);
  return out;
 });
}
/** Áp toàn bộ bản sửa (docs từ database); bảng không có bản sửa trở về mặc định. */
export function applyRewardConfig(docs){
 const saved=new Map(docs.map(d=>[d._id,d.rows]));
 for(const t of tables){const base=defaults.get(t.id),rows=saved.get(t.id);t.write(rows&&rows.length===base.length?rows:base)}
}
export function rewardTablesView(savedIds=[]){
 const saved=new Set(savedIds);
 return tables.map(t=>({id:t.id,group:t.group,title:t.title,note:t.note||'',list:!!t.list,price:!!t.price,priceItem:t.priceItem||null,limit:!!t.limit,weight:!!t.weight,edited:saved.has(t.id),rows:t.read().map(r=>({...r,label:r.label===r.key&&t.id.startsWith('shop-')?nameOf(r.rewards[0].itemId)||r.key:r.label}))}));
}
