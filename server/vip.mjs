// VIP gốc (db_vip, PopupStoreAndBenefit): EXP VIP tích lũy lên cấp 1-20 theo cột point.
//   - Nguồn EXP VIP: quà nhiệm vụ hằng ngày (ItemVipExpUI trong CellDailyQuest gốc). Bản web không có nạp tiền.
//   - Đạt cấp VIP nhận quà bonus một lần (gửi thư): vật phẩm, tướng (đã có thì đổi mảnh), ảnh đại diện đặc biệt.
//   - Quyền lợi dùng ở bản web: auto_battle = % thưởng treo máy thêm; event_raid_buy = lượt mua Chiến dịch thêm.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {itemById,heroDefinitions} from './catalog.mjs';

export const vipData=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/vip.json',import.meta.url)),'utf8'));
const levels=vipData.levels;
export const vipLevelOf=exp=>{let v=0;for(const l of levels)if(exp>=l.point)v=l.level;return v};
export const vipRow=v=>levels.find(l=>l.level===v)||null;
export const afkBonus=p=>(vipRow(p.vip||0)?.autoBattle||0)/100;
export const raidBuyBonus=p=>vipRow(p.vip||0)?.raidBuy||0;
const avatarIds=new Set(JSON.parse(readFileSync(fileURLToPath(new URL('../dist/avatars.json',import.meta.url)),'utf8')).special.map(a=>a.id));

/** Quà đạt cấp VIP thành phần thưởng của bản web. */
export function vipRewards(v){
 const out=[];
 for(const b of vipRow(v)?.bonus||[]){
  if(b.kind==='item'){
   const id=b.cat===2?(itemById.has('shard:'+b.id)?'shard:'+b.id:'heroshard:'+b.heroAvatar):'consumable:'+b.id;
   if(itemById.has(id))out.push({itemId:id,quantity:b.quantity});
  }else if(b.kind==='hero'){
   const d=heroDefinitions.find(h=>String(h.avatar)===String(b.avatar));if(d)out.push({kind:'hero',avatar:d.avatar,heroId:d.id,quantity:1});
  }else if(b.kind==='avatar'&&avatarIds.has(b.id))out.push({kind:'avatar',id:b.id,quantity:1});
 }
 return out;
}
/** Cộng EXP VIP; mỗi cấp mới gửi quà vào thư. hooks: {mail(title,text,rewards)} */
export function addVipExp(p,amount,hooks){
 p.vipExp=(p.vipExp||0)+amount;const before=p.vip||0,after=vipLevelOf(p.vipExp);
 for(let v=before+1;v<=after;v++){const rewards=vipRewards(v);hooks?.mail?.(`Quà đạt VIP ${v}`,`Chúc mừng thuyền trưởng đạt VIP ${v}! Đạt được cấp VIP này sẽ nhận được:`,rewards)}
 p.vip=after;return after>before;
}
export function vipView(p){
 const v=p.vip||0,next=vipRow(v+1);
 return{level:v,exp:p.vipExp||0,next:next?.point??null,max:levels.length};
}
