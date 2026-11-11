// Huyết tế (AltarScene gốc) — tab HUYẾT TẾ, tab TƯỚNG HOÀN TRẢ và Cửa hàng huyết tế.
//   - Huyết tế: chọn tối đa 8 thuyền viên (ListAltar 8 ô), không được chọn tướng chính / tướng đang khóa và không được huyết tế
//     toàn bộ thuyền viên (MSG_ALTAR_SCENE_CAN_NOT_ALTAR_ALL_HERO). Thu hồi (LBL_ALTAR_SCENE_PREVIEW_RESOURCE_RECOVERY):
//     toàn bộ EXP tướng đã nâng (vào quỹ EXP), Đá cường hóa đã dùng thức tỉnh, trang bị đang mặc, và Hồn hải tặc theo bậc × sao
//     (Hồn hải tặc: "Sử dụng trong cửa hàng Huyết Tế").
//   - Hoàn trả: 1 thuyền viên về cấp 1, nhận lại toàn bộ EXP đã nâng (MSG_ALTAR_SCENE_DESC_RETURN_HERO), phí 50 kim cương (GroupFee).
//   - Cửa hàng huyết tế (MISC_2_LBL_ALTAR_STORE): đổi Hồn hải tặc, giới hạn mỗi ngày.
// Bảng thu hồi / giá cửa hàng gốc nằm ở máy chủ nên con số do bản web đặt, dựa trên công thức phí nâng cấp của bản web.
import {requireCondition} from './errors.mjs';

export const altarSlots=8,returnFee=50,soulItem='consumable:7';
const soulByRank={1:2,2:4,3:10,4:30,5:60,6:120};
export const altarShop=[
 {id:'barrel',reward:{itemId:'consumable:16',quantity:1},cost:300,limit:5},
 {id:'enhance',reward:{itemId:'consumable:2',quantity:200},cost:100,limit:10},
 {id:'soul-chest',reward:{itemId:'consumable:178',quantity:1},cost:150,limit:3},
 {id:'dust',reward:{itemId:'consumable:3',quantity:500},cost:80,limit:10},
 {id:'gold',reward:{itemId:'gold',quantity:100000},cost:50,limit:10},
 {id:'spirit',reward:{itemId:'spirit',quantity:20000},cost:60,limit:10},
];
const levelExp=l=>Math.round(l*45*(1+l/40));
/** EXP tướng đã dùng để nâng từ cấp 1 lên `level`. */
export const spentExp=level=>{let n=0;for(let l=1;l<level;l++)n+=levelExp(l);return n};
/** Đá cường hóa đã dùng thức tỉnh tới `stars` sao (theo bảng thức tỉnh của bản web). */
export function spentStones(stars){let n=0;for(let s=1;s<stars;s++){if(s<5)continue;n+=s<9?(s-4)*1000:s<14?(s-7)*1500:(s-12)*3000}return n}
const vnDay=now=>new Date(now+7*3600000).toISOString().slice(0,10);
function shopState(p,now){const day=vnDay(now);if(p.altar?.day!==day)p.altar={day,bought:{}};return p.altar}

/** Phần thu hồi khi huyết tế một thuyền viên. */
export function recovery(h,def){
 const items={};const add=(id,q)=>{if(q>0)items[id]=(items[id]||0)+q};
 add('spirit',spentExp(h.level||1));add('consumable:2',spentStones(h.stars||1));
 add(soulItem,(soulByRank[def?.rank]||10)*Math.max(1,h.stars||1));
 for(const id of Object.values(h.equipment||{}))if(id)add(id,1);
 return items;
}
export function altarView(p,now=Date.now()){const st=shopState(p,now);return{slots:altarSlots,returnFee,shop:altarShop.map(o=>({...o,bought:st.bought[o.id]||0}))}}

/** ctx: {owned, definition(id), grant({itemId,quantity}), pay(diamonds), payItems({id:q}), formation} */
export function altarAction(p,input,ctx,now=Date.now()){
 if(input.op==='sacrifice'){
  const ids=[...new Set(Array.isArray(input.heroIds)?input.heroIds:[])];
  requireCondition(ids.length>0,'Bạn chưa chọn tướng huyết tế');requireCondition(ids.length<=altarSlots,'Số tướng huyết tế đã đầy');
  for(const id of ids){requireCondition(ctx.owned.has(id),'Hãy chọn thuyền viên');requireCondition(id!==p.hero.id,'Không thể huyết tế tướng chính.');requireCondition(!(p.lockedHeroes||[]).includes(id),'Thuyền viên đang khóa.')}
  requireCondition(ids.length<ctx.owned.size,'Bạn không thể huyết tế toàn bộ thuyền viên của mình');
  const total={};
  for(const id of ids){
   const h=ctx.owned.get(id);for(const [k,q] of Object.entries(recovery(h,ctx.definition(id))))total[k]=(total[k]||0)+q;
   delete p.reserveHeroes[id];if(p.pets?.equip)delete p.pets.equip[id];
  }
  if(p.formation?.slots)p.formation.slots=p.formation.slots.map(x=>ids.includes(x)?null:x);
  const rewards=Object.entries(total).map(([itemId,quantity])=>({itemId,quantity}));for(const r of rewards)ctx.grant(r);
  return{message:`Đã huyết tế ${ids.length} thuyền viên.`,rewards};
 }
 if(input.op==='return'){
  const h=ctx.owned.get(input.heroId);requireCondition(h,'Hãy chọn thuyền viên');requireCondition((h.level||1)>1,'Thuyền viên đang ở cấp 1.');
  ctx.pay(returnFee);const exp=spentExp(h.level);h.level=1;h.exp=0;
  const rewards=[{itemId:'spirit',quantity:exp}];ctx.grant(rewards[0]);
  return{message:'Thuyền viên đã được đưa về trạng thái level 1',rewards};
 }
 if(input.op==='lock'){
  const id=input.heroId;requireCondition(ctx.owned.has(id),'Hãy chọn thuyền viên');p.lockedHeroes??=[];
  p.lockedHeroes=p.lockedHeroes.includes(id)?p.lockedHeroes.filter(x=>x!==id):[...p.lockedHeroes,id];return{message:p.lockedHeroes.includes(id)?'Đã khóa thuyền viên.':'Đã mở khóa thuyền viên.'};
 }
 if(input.op==='buy'){
  const o=altarShop.find(x=>x.id===input.id);requireCondition(o,'Vật phẩm không tồn tại.');const st=shopState(p,now),n=st.bought[o.id]||0;
  requireCondition(n<o.limit,'Đã hết lượt mua hôm nay.');ctx.payItems({[soulItem]:o.cost});st.bought[o.id]=n+1;ctx.grant(o.reward);
  return{message:'Đổi thành công.',rewards:[o.reward]};
 }
 requireCondition(false,'Thao tác không hợp lệ.');
}
