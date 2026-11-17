// Mở rương theo dist/chests.json (tools/export-chests.py). Bảng gốc không có tỉ lệ nên các phần thưởng của rương ngẫu nhiên
// có cơ hội ngang nhau. Chế độ: random (draws món khác nhau), random + groups (bốc nguyên một bộ, ví dụ 1 set trang bị đỏ),
// choice (người chơi chọn 1), all (nhận hết). Loại quà: gold, diamonds, item, hero, avatar, fruit, fruitShard, pet, petShard.
import {randomInt} from 'node:crypto';
import {requireCondition,integer} from './errors.mjs';
import {chestData,heroAlbum,itemById} from './catalog.mjs';

const secureRandom=()=>randomInt(1e9)/1e9,maxOpen=10;
const pick=(rewards,draws,random)=>{const pool=[...rewards],out=[];for(let i=0;i<Math.min(draws,pool.length);i++)out.push(pool.splice(Math.floor(random()*pool.length),1)[0]);return out};
/** Chọn phần thưởng cho một lượt mở, chưa thay đổi player. */
export function rollChest(item,input,random=secureRandom){
 const chest=chestData[item.id];requireCondition(chest,'Vật phẩm này không mở được.');
 if(chest.mode==='choice'){
  const index=integer(input.index,0,chest.rewards.length-1,'Lựa chọn');
  requireCondition(input.count===undefined||Number(input.count)===1,'Rương tự chọn chỉ mở từng cái.');
  return{count:1,rewards:[chest.rewards[index]]};
 }
 const count=integer(input.count??1,1,maxOpen,'Số lượng'),rewards=[];
 for(let i=0;i<count;i++){
  if(chest.mode==='all')rewards.push(...chest.rewards);
  else if(chest.groups)rewards.push(...chest.groups[Math.floor(random()*chest.groups.length)].map(index=>chest.rewards[index]));
  else rewards.push(...pick(chest.rewards,chest.draws||1,random));
 }
 return{count,rewards};
}
export const chestHero=reward=>heroAlbum.heroes.find(h=>h.avatar===reward.avatar);
export const chestItem=reward=>itemById.get(reward.itemId);
