// Chiêu mộ bằng Thùng bia. Bộ dữ liệu client không có tỉ lệ gốc, nên `economy.summon.rates` là mức tự đặt.
import {randomInt} from 'node:crypto';
import {requireCondition} from './errors.mjs';
import {economy,heroAlbum,heroDefinitions} from './catalog.mjs';
import {ownedHeroes} from './formation.mjs';
import {newHero,shardFor} from './hero-roster.mjs';

const {factions,rates,counts,duplicateShards}=economy.summon,playable=new Map(heroDefinitions.map(h=>[h.avatar,h]));
const tier=rank=>rank>=6?6:rank===5?5:rank===4?4:3;
const pools=Object.fromEntries(factions.map(faction=>[faction,Object.fromEntries([6,5,4,3].map(key=>[key,heroAlbum.heroes.filter(h=>playable.has(h.avatar)&&h.faction===faction&&tier(h.rank)===key)]))]));
const secureRandom=()=>randomInt(1e9)/1e9;
export function rollHero(faction,random=secureRandom,minimum=3){
 const table=rates.filter(([rank])=>rank>=minimum&&pools[faction][rank].length),total=table.reduce((sum,[,weight])=>sum+weight,0);
 let roll=random()*total,rank=table.at(-1)[0];
 for(const [key,weight] of table){if(roll<weight){rank=key;break}roll-=weight}
 const pool=pools[faction][rank];return pool[Math.floor(random()*pool.length)];
}
/** Mảnh tướng 5 sao chung: ngẫu nhiên một tướng từ 5 sao trở lên, mọi hệ. */
export const rollFiveStar=(random=secureRandom)=>rollHero(factions[Math.floor(random()*factions.length)],random,5);
/** Lần cuối của lượt x10 chắc chắn ra tướng bậc A trở lên nếu chín lần trước chưa có. */
export function rollSummon(faction,count,random=secureRandom){
 const heroes=[];for(let i=0;i<count;i++)heroes.push(rollHero(faction,random,i===9&&!heroes.some(h=>h.rank>=4)?4:3));return heroes;
}
export function validateSummon(input){
 const count=Number(input.count);
 requireCondition(factions.includes(input.faction),'Hãy chọn hệ thuyền viên muốn chiêu mộ.');
 requireCondition(counts.includes(count),'Số lần chiêu mộ không hợp lệ.');
 return{faction:input.faction,count};
}
export const choicePool=item=>heroAlbum.heroes.filter(h=>playable.has(h.avatar)&&h.rank===item.choice.rank&&item.choice.factions.includes(h.faction));
/** Tướng chưa có vào đội ngay; tướng đã có đổi thành mảnh để nâng sao. */
export function grantSummon(p,hero){
 const definition=playable.get(hero.avatar);
 if(ownedHeroes(p).has(definition.id))return{avatar:hero.avatar,shardItem:shardFor(definition),shards:duplicateShards};
 (p.reserveHeroes??={})[definition.id]=newHero(definition);return{avatar:hero.avatar,fresh:true};
}
/** Tặng lô Thùng bia ban đầu một lần cho tài khoản mới và tài khoản đã có. Trả về true nếu có thay đổi cần lưu. */
export function startSummon(p){
 if(p.summonGranted)return false;
 p.summonGranted=true;p.inventory[economy.summon.item]=(p.inventory[economy.summon.item]||0)+economy.summon.startItems;return true;
}
