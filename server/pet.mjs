// Thú cưng (lua_pet: PetHome / PetMain / PetSummon / PetLibrary / PetInventory / PopupPetEquip). Dữ liệu nguyên từ
// db_pet_2 và db_pet_2_upgrade (tools/export-pet.py). Các dịch vụ theo PetDataSender gốc:
//   PET_2_RECRUIT  chiêu mộ (La Bàn 3002 ×1 hoặc ×10, mỗi ngày 1 lần miễn phí)  -> mảnh / thú cưng / vật phẩm
//   PET_2_SUMMON   ghép thú cưng ở Thư viện khi đủ shard (50) mảnh
//   PET_2_UPGRADE  lên cấp: Vàng + Exp (Thú Cưng) 3004 theo levels[cấp+1]; cấp tối đa theo stars[sao].limitLevel
//   PET_2_GROWTH   Hoàn đồng: Thuốc Tăng Cường 3003 ×1, quay lại chỉ số Trưởng thành (intelligent_min..max)
//   PET_2_RESET    Tẩy luyện: mode 0 tốn Thuốc tái tạo 3001 ×1 quay chỉ số cơ bản mới (chờ), mode 1 đổi sang chỉ số mới
//   PET_2_UPGRADE_TIER  Lĩnh ngộ: Thuốc Rumble Ball 3000 ×stone, tỉ lệ percent/1000, thất bại lùi về lvlBackUp
//   PET_2_UPGRADE_STAR  Thức tỉnh: hiến shard / samePet con cùng loại (+ star5/6/9 pet con có số sao đó) + numItem Đá cường hóa
//   PET_2_EQUIP    trang bị cho tướng (mỗi tướng 1 con, mỗi con 1 tướng)
// Chỉ số cuối, tỉ lệ chiêu mộ và thời gian miễn phí nằm ở server gốc (không có trong asset); công thức dưới đây do bản
// web đặt, dùng đúng các bảng gốc: cơ bản × scaleBasic(lĩnh ngộ) × scale(sao) × (1 + (cấp-1) × trưởng thành / 10000).
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition} from './errors.mjs';

const data=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/pet.json',import.meta.url)),'utf8'));
export const petData={pets:data.pets,upgrade:data.upgrade,skills:data.skills,items:data.items};
const U=data.upgrade,items=data.items,byId=new Map(data.pets.map(p=>[p.id,p]));
const starRow=s=>U.stars.find(r=>r.star===s),tierRow=t=>U.tiers.find(r=>r.level===t),levelRow=l=>U.levels.find(r=>r.level===l);
export const maxPetStar=U.maxstar,freeCooldown=24*3600e3;
const fee=f=>({itemId:'consumable:'+f[2],quantity:f[3]});

function state(p){
 p.pets??={list:[],shards:{},equip:{},nextFree:0,seq:0};
 const s=p.pets;s.list??=[];s.shards??={};s.equip??={};s.nextFree??=0;s.seq??=0;return s;
}
const round1=v=>Math.round(v*10)/10;
const roll=([a,b],random)=>round1(a+(b-a)*random());
/** Phẩm Trưởng thành: Thường / Ưu Tú / Nổi Bật / Trác Việt / Hoàn Mỹ theo vị trí trong khoảng min..max. */
export const growthTier=(base,g)=>{const [a,b]=base.intelligent,f=(g-a)/Math.max(1,b-a);return f>=.8?5:f>=.6?4:f>=.4?3:f>=.2?2:1};
const rollBasic=(base,random)=>Object.fromEntries(['atk','def','hp','spd'].map(k=>[k,roll(base.basic[k],random)]));
export function newPet(s,setId,random=Math.random){
 const base=byId.get(setId),g=roll(base.intelligent,random);
 const pet={uid:++s.seq,setId,star:0,tier:0,level:1,basic:rollBasic(base,random),pending:null,growth:g};
 s.list.push(pet);return pet;
}
/** Chỉ số cuối của một thú cưng (atk, def, hp, spd) và lực chiến atk + def + hp / 6 như PetDataItem.GetPower. */
export function petStats(pet){
 const tier=tierRow(pet.tier).scaleBasic/1000,star=starRow(pet.star).scale,grow=1+(pet.level-1)*pet.growth/10000;
 const out={atk:Math.round(pet.basic.atk*tier*star*grow),def:Math.round(pet.basic.def*tier*star*grow),hp:Math.round(pet.basic.hp*tier*star*grow),
  spd:Math.round(pet.basic.spd*tier*(1+(pet.level-1)/50)*(1+.1*pet.star))};
 out.power=Math.round(out.atk+out.def+out.hp/6);return out;
}
/** Cấp kỹ năng theo sao (đếm các mốc unlockSkill đã đạt) và mã kỹ năng đang dùng (sao > 5 dùng upgrade_skill[sao-5]). */
export function petSkills(pet){
 const base=byId.get(pet.setId),levels=[0,0,0];
 for(const r of U.stars)if(r.unlockSkill&&pet.star>=r.star)levels[r.unlockSkill-1]++;
 const ids=pet.star>5&&base.upgradeSkill[pet.star-6]?base.upgradeSkill[pet.star-6]:base.passives;
 return ids.map((id,i)=>({id,level:levels[i],active:levels[i]>=1&&id>=0,skill:data.skills[String(id)]||null}));
}
const view=(s,pet)=>({...pet,maxLevel:starRow(pet.star).limitLevel,growthTier:growthTier(byId.get(pet.setId),pet.growth),stats:petStats(pet),
 skills:petSkills(pet).map(({id,level,active})=>({id,level,active})),hero:Object.entries(s.equip).find(([,uid])=>uid===pet.uid)?.[0]||null});
export function petView(p,now=Date.now()){
 const s=state(p);return{list:s.list.map(x=>view(s,x)),shards:s.shards,equip:s.equip,freeIn:Math.max(0,s.nextFree-now)};
}
const petOrFail=(s,uid)=>{const pet=s.list.find(x=>x.uid===Number(uid));requireCondition(pet,'Thú cưng không tồn tại.',404,'PET_UNKNOWN');return pet};

// ---- Chiêu mộ (PET_2_RECRUIT): mỗi lượt ra mảnh (thường), cả con (hiếm) hoặc Exp thú cưng.
const rankWeight={3:50,4:25,5:15,6:10},shardRange={3:[5,10],4:[3,6],5:[2,4],6:[1,3]};
function recruitOnce(s,random,grant){
 const pool=data.pets,total=pool.reduce((n,x)=>n+(rankWeight[x.rank]||5),0);let r=random()*total,base=pool[0];
 for(const x of pool){r-=rankWeight[x.rank]||5;if(r<0){base=x;break}}
 const kind=random();
 if(kind<.05){const pet=newPet(s,base.id,random);return{type:2,setId:base.id,uid:pet.uid}}
 if(kind<.2){const reward={itemId:items.exp,quantity:50};grant(reward);return{type:3,reward}}
 const [a,b]=shardRange[base.rank]||[1,3],n=a+Math.floor(random()*(b-a+1));s.shards[base.id]=(s.shards[base.id]||0)+n;return{type:1,setId:base.id,amount:n};
}
export function recruitPets(p,input,{pay,grant,now=Date.now(),random=Math.random}){
 const s=state(p),amount=Number(input.amount);requireCondition([-1,1,10].includes(amount),'Số lượt chiêu mộ không hợp lệ.',400);
 if(amount===-1){requireCondition(now>=s.nextFree,'Chưa tới lượt chiêu mộ miễn phí.',409,'PET_FREE_COOLDOWN');s.nextFree=now+freeCooldown}
 else pay({itemId:items.summon,quantity:amount});
 const results=Array.from({length:Math.abs(amount)},()=>recruitOnce(s,random,grant));
 return{message:`Chiêu mộ ${results.length} lần.`,results};
}
// ---- Ghép ở Thư viện (PET_2_SUMMON)
export function combinePet(p,input){
 const s=state(p),base=byId.get(Number(input.setId));requireCondition(base,'Thú cưng không tồn tại.',404);
 requireCondition((s.shards[base.id]||0)>=base.shardReq,'Không đủ mảnh thú cưng.',409,'PET_SHARDS');
 s.shards[base.id]-=base.shardReq;const pet=newPet(s,base.id);
 return{message:`Triệu hồi ${base.name}.`,uid:pet.uid};
}
// ---- Lên cấp (PET_2_UPGRADE)
export function levelPet(p,input,pay){
 const s=state(p),pet=petOrFail(s,input.uid);requireCondition(pet.level<starRow(pet.star).limitLevel,'Thú cưng đã đạt cấp tối đa, hãy thức tỉnh.',409,'PET_MAX_LEVEL');
 const row=levelRow(pet.level+1);pay({itemId:'gold',quantity:row.gold});pay({itemId:items.exp,quantity:row.exp});
 pet.level++;return{message:`${byId.get(pet.setId).name} lên cấp ${pet.level}.`,level:pet.level};
}
// ---- Hoàn đồng (PET_2_GROWTH)
export function growthPet(p,input,pay,random=Math.random){
 const s=state(p),pet=petOrFail(s,input.uid);pay(fee(U.fee1));
 pet.growth=roll(byId.get(pet.setId).intelligent,random);return{message:'Hoàn đồng thành công.',growth:pet.growth};
}
// ---- Tẩy luyện (PET_2_RESET): mode 0 quay chỉ số mới (chờ xác nhận), mode 1 đổi sang chỉ số mới.
export function erasePet(p,input,pay,random=Math.random){
 const s=state(p),pet=petOrFail(s,input.uid),mode=Number(input.mode);
 if(mode===1){requireCondition(pet.pending,'Chưa có chỉ số mới để thay đổi.',409);pet.basic=pet.pending;pet.pending=null;return{message:'Đã thay đổi chỉ số cơ bản.'}}
 pay(fee(U.fee2));pet.pending=rollBasic(byId.get(pet.setId),random);return{message:'Tẩy luyện thành công.',pending:pet.pending};
}
// ---- Lĩnh ngộ (PET_2_UPGRADE_TIER)
export function enlightPet(p,input,pay,random=Math.random){
 const s=state(p),pet=petOrFail(s,input.uid),next=tierRow(pet.tier+1);requireCondition(next,'Thú cưng đã đạt cấp độ tối đa.',409,'PET_MAX_TIER');
 pay({...fee(U.fee3),quantity:next.stone*U.fee3[3]});
 const success=random()*1000<next.percent;pet.tier=success?next.level:next.lvlBackUp;
 return{message:success?`Lĩnh ngộ thành công, Lv${pet.tier}.`:`Lĩnh ngộ thất bại, giảm xuống Lv${pet.tier}.`,success,tier:pet.tier};
}
// ---- Thức tỉnh (PET_2_UPGRADE_STAR)
export function starRequirement(pet){
 const next=starRow(pet.star+1);if(!next||pet.star>=maxPetStar)return null;
 const same=next.star>=6&&next.samePet!=null?next.samePet:next.shard;
 const extra=next.star>=6?[[5,next.star5pet],[6,next.star6pet],[9,next.star9pet],[10,next.star10pet]].find(([,n])=>n>0)||null:null;
 return{star:next.star,limitLevel:next.limitLevel,same,extraStar:extra?.[0]??null,extra:extra?.[1]??0,item:{itemId:items.awaken,quantity:next.numItem},unlockSkill:next.unlockSkill||0};
}
export function starUpPet(p,input,pay){
 const s=state(p),pet=petOrFail(s,input.uid),req=starRequirement(pet);requireCondition(req,'Thú cưng đã đạt sao tối đa.',409,'PET_MAX_STAR');
 const same=(input.same||[]).map(Number),extra=(input.extra||[]).map(Number),all=[...same,...extra];
 requireCondition(new Set(all).size===all.length&&!all.includes(pet.uid),'Nguyên liệu không hợp lệ.',400);
 requireCondition(same.length===req.same,'Không đủ nguyên liệu',409,'PET_STAR_MATERIAL');
 for(const uid of same){const x=petOrFail(s,uid);requireCondition(x.setId===pet.setId,'Nguyên liệu phải cùng loại thú cưng.',409)}
 requireCondition(extra.length===req.extra,'Không đủ nguyên liệu',409,'PET_STAR_MATERIAL');
 for(const uid of extra){const x=petOrFail(s,uid);requireCondition(x.star===req.extraStar,`Nguyên liệu phải là thú cưng ${req.extraStar} sao.`,409)}
 if(req.item.quantity>0)pay(req.item);
 s.list=s.list.filter(x=>!all.includes(x.uid));for(const [hero,uid] of Object.entries(s.equip))if(all.includes(uid))delete s.equip[hero];
 pet.star++;return{message:`${byId.get(pet.setId).name} đạt ${pet.star} sao.`,star:pet.star};
}
// ---- Trang bị (PET_2_EQUIP): uid -1 để tháo.
export function equipPet(p,input,ownsHero){
 const s=state(p),heroId=String(input.heroId),uid=Number(input.uid);requireCondition(ownsHero(heroId),'Bạn chưa sở hữu tướng này.',404);
 if(uid<=0){delete s.equip[heroId];return{message:'Đã tháo thú cưng.'}}
 const pet=petOrFail(s,uid);for(const [hero,u] of Object.entries(s.equip))if(u===uid)delete s.equip[hero];
 s.equip[heroId]=pet.uid;return{message:`Đã trang bị ${byId.get(pet.setId).name}.`};
}
/** Thú cưng của tướng: chỉ số cộng thẳng (Công, Thủ, Máu, Tốc) và kỹ năng bị động đã mở (mô tả gốc, áp cho chủ nhân). */
export function heroPet(p,heroId){
 const s=p.pets,uid=s?.equip?.[heroId],pet=uid&&s.list.find(x=>x.uid===uid);if(!pet)return null;
 return{pet,stats:petStats(pet),skills:petSkills(pet).filter(x=>x.active&&x.skill).map(x=>x.skill)};
}
