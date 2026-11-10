import {heroDefinitions} from './catalog.mjs';
import {requireCondition} from './errors.mjs';

export function ownedHeroes(player){return new Map([player.hero,...Object.values(player.reserveHeroes||{})].filter(Boolean).map(h=>[h.id,h]))}
export function formationView(player){
 const owned=ownedHeroes(player),slots=Array(6).fill(null),seen=new Set();
 if(Array.isArray(player.formation?.slots)){
  for(let i=0;i<6;i++){const id=player.formation.slots[i];if(owned.has(id)&&!seen.has(id)){slots[i]=id;seen.add(id)}}
 }else if(player.hero){
  const position=player.formation?.position??0;slots[position>=0&&position<6?position:0]=player.hero.id;seen.add(player.hero.id);
  for(const id of owned.keys()){if(seen.has(id))continue;const index=slots.indexOf(null);if(index<0)break;slots[index]=id;seen.add(id)}
 }
 if(!seen.size&&player.hero)slots[0]=player.hero.id;
 return{version:2,slots};
}
export function validateFormation(player,input){
 requireCondition(Array.isArray(input)&&input.length<=6,'Đội hình có tối đa 6 ô.');
 const slots=Array.from({length:6},(_,i)=>input[i]??null),owned=ownedHeroes(player),definitions=new Set(heroDefinitions.map(h=>h.id)),seen=new Set();
 for(const id of slots){
  if(id===null)continue;
  requireCondition(typeof id==='string'&&owned.has(id)&&definitions.has(id),'Đội hình chứa tướng chưa sở hữu.',400,'INVALID_FORMATION');
  requireCondition(!seen.has(id),'Mỗi tướng chỉ được xuất chiến một lần.',400,'DUPLICATE_HERO');seen.add(id);
 }
 requireCondition(seen.size>0,'Hãy chọn ít nhất một tướng.',400,'EMPTY_FORMATION');return{version:2,slots};
}
