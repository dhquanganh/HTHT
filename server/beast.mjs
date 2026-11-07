// Chiến Thần Thú: 5 boss, mỗi boss một bảng sát thương. Luật lấy từ bossofworldscene/popuptopboss.lua:
// chỉ đúng nghề của boss được xuất chiến, cách nhau 15 giây, thưởng theo 10 mốc hạng.
// Chỉ số boss, thưởng, mùa nằm trong MongoDB; file này là luật thuần, Store nạp dữ liệu rồi truyền vào `context`.
import {requireCondition,integer} from './errors.mjs';
import {beastData,definitionFor,iconByName,itemById,itemIcon} from './catalog.mjs';
import {ownedHeroes,validateFormation} from './formation.mjs';

export const beastBosses=beastData.bosses;
export const bossByKey=new Map(beastBosses.map(boss=>[boss.key,boss]));
/** Các mốc trong popupbossreward.lua: 1..5, 6-10, 11-20, 21-50, 51-100, 100+. */
export const rankBrackets=[[1,1],[2,2],[3,3],[4,4],[5,5],[6,10],[11,20],[21,50],[51,100],[101,null]].map(([from,to])=>({from,to,label:to===null?'100+':from===to?String(from):`${from}-${to}`}));
export const bracketIndex=rank=>rank>=1?rankBrackets.findIndex(b=>rank>=b.from&&(b.to===null||rank<=b.to)):-1;
export const defaultConfig={seasonDays:7,turns:100,cooldownSeconds:15,rounds:40,minLevel:1};
const passiveFlags={100209:'critical',100215:'ultimate',100216:'penetration'};
const maxPerRank=6,maxQuantity=1000000000000;

// Thưởng hạng 1-4 theo ảnh gốc; các mốc sau asset không có nên giảm dần, sửa được ở trang quản trị.
const seed=[[400000,200,100],[320000,160,80],[240000,120,60],[200000,100,50],[180000,90,45],[160000,80,40],[120000,60,30],[80000,40,20],[60000,30,15],[40000,20,10]];
export const defaultRewards=()=>seed.map(([gold,badge,wood])=>[{itemId:'gold',quantity:gold},{itemId:'consumable:6',quantity:badge},{itemId:'consumable:11',quantity:wood}]);
/** `attack, armor, hp, speed` là cột point của db_heroes; máu chỉ là thanh hiển thị vì boss không chết. */
export const defaultBoss=boss=>({_id:boss.key,level:boss.level,attack:boss.point.attack,defense:boss.point.armor,maxHp:boss.point.hp*boss.level,speed:boss.point.speed});

const wallet={gold:'Vàng',diamonds:'Kim cương',spirit:'EXP tướng'};
const walletIcon=id=>id==='spirit'?iconByName('icon_spirit'):beastData.ui[id]?.src||null;
export const rewardItems=()=>Object.keys(wallet).map(id=>({id,name:wallet[id],category:'wallet',icon:walletIcon(id)}));
export const rewardView=reward=>({...reward,name:wallet[reward.itemId]||itemById.get(reward.itemId)?.name||reward.itemId,icon:wallet[reward.itemId]?walletIcon(reward.itemId):itemIcon(itemById.get(reward.itemId))});
export function validateRewards(input){
 requireCondition(Array.isArray(input)&&input.length===rankBrackets.length,'Cần đủ 10 mốc thưởng.');
 return input.map((rank,i)=>{
  requireCondition(Array.isArray(rank)&&rank.length<=maxPerRank,`Mốc ${rankBrackets[i].label} có tối đa ${maxPerRank} phần thưởng.`);
  const seen=new Set();
  return rank.map(reward=>{
   const id=reward?.itemId;requireCondition(typeof id==='string'&&(wallet[id]||itemById.has(id)),'Vật phẩm không tồn tại.',404);
   requireCondition(!seen.has(id),`Mốc ${rankBrackets[i].label} bị trùng vật phẩm.`);seen.add(id);
   return{itemId:id,quantity:integer(reward.quantity,1,maxQuantity,'Số lượng')};
  });
 });
}
export function validateBossStats(input){
 const value=(name,label,max)=>integer(input?.[name],1,max,label);
 return{level:value('level','Cấp',100000),attack:value('attack','Tấn công',1000000000),defense:value('defense','Giáp',1000000000),maxHp:value('maxHp','Máu',1000000000000),speed:value('speed','Tốc độ',1000000)};
}
export function validateConfig(input){
 const value=(name,label,min,max)=>integer(input?.[name],min,max,label);
 return{seasonDays:value('seasonDays','Số ngày mỗi mùa',1,90),turns:value('turns','Lượt đánh',1,100000),cooldownSeconds:value('cooldownSeconds','Thời gian chờ',0,3600),rounds:value('rounds','Số vòng tối đa',1,60),minLevel:value('minLevel','Cấp tướng tối thiểu',1,1000)};
}

/** Mỗi mùa boss đổi hệ và kỹ năng theo 5 dòng db_quai của nó. */
export const variantOf=(boss,season)=>boss.variants[(season-1)%boss.variants.length];
export const emptyBeast=()=>({season:0,turns:0,lastAttackAt:0,damage:{},formations:{},claimed:[]});
export function refreshBeast(p,context){
 const beast=p.beast||(p.beast=emptyBeast());
 if(beast.season!==context.season.id){beast.season=context.season.id;beast.turns=context.config.turns;beast.damage={}}
 return beast;
}
export const beastTurns=(p,context)=>p.beast?.season===context.season.id?p.beast.turns:context.config.turns;
export const beastEntry=p=>({displayName:p.displayName,heroId:p.hero.id,level:p.account.level});

const className={warrior:'Chiến binh',mage:'Pháp sư',ranger:'Xạ thủ',assassin:'Sát thủ',priest:'Mục sư'};
export const classLabel=value=>className[value]||value;
// Luffy Gear 2 dùng nghề riêng `fighter`; trong game gốc đây là nhóm Chiến binh.
const fightsAs=value=>value==='fighter'?'warrior':value;
export function validateBeastTeam(p,boss,formation,minLevel){
 const team=validateFormation(p,formation),owned=ownedHeroes(p);
 for(const id of team.slots){
  if(!id)continue;
  requireCondition(fightsAs(definitionFor(id).class)===boss.class,`Chỉ ${classLabel(boss.class)} được tham chiến.`,400,'BEAST_WRONG_CLASS');
  requireCondition(owned.get(id).level>=minLevel,`Tướng cần đạt cấp ${minLevel}.`,400,'BEAST_LEVEL');
 }
 return team;
}
/** Kiểm tra lượt và thời gian chờ, trả về đơn vị boss cho openBattle. Lượt mất ngay khi vào trận. */
export function startBeast(p,input,context,now=Date.now()){
 requireCondition(context,'Chiến Thần Thú chưa sẵn sàng.',503);
 const boss=bossByKey.get(input.boss);requireCondition(boss,'Boss không tồn tại.',404);
 const team=validateBeastTeam(p,boss,input.formation,context.config.minLevel),beast=refreshBeast(p,context);
 requireCondition(beast.turns>0,'Bạn đã hết lượt đánh.',409,'BEAST_NO_TURNS');
 const wait=beast.lastAttackAt+context.config.cooldownSeconds*1000-now;
 requireCondition(wait<=0,`Đợi ${Math.ceil(wait/1000)} giây để tiếp tục đánh.`,409,'BEAST_COOLDOWN');
 beast.turns--;beast.lastAttackAt=now;beast.formations[boss.key]=team.slots;
 const stats=context.bosses[boss.key],variant=variantOf(boss,context.season.id),passives=variant.skills.map(s=>passiveFlags[s.id]).filter(Boolean);
 const unit={id:'enemy-0',name:boss.name,avatar:boss.avatar,faction:variant.faction,level:stats.level,stars:boss.star,monsterId:variant.monsterId,position:1,maxHp:stats.maxHp,hp:stats.maxHp,attack:stats.attack,defense:stats.defense,speed:stats.speed,visualIndex:0,boss:true,endless:true,immuneDebuff:true,passives,damageTaken:0};
 return{team,unit,meta:{chapter:1,stageId:null,beast:{key:boss.key,name:boss.name,season:context.season.id,rounds:context.config.rounds}}};
}
/** Ghi sát thương vào player trong cùng lượt ghi với đòn cuối. Trận kéo sang mùa mới thì không tính. */
export function finishBeast(p,b){
 const damage=b.enemies[0].damageTaken,counted=p.beast?.season===b.beast.season,key=b.beast.key;
 if(counted)p.beast.damage[key]=(p.beast.damage[key]||0)+damage;
 b.reward={damage,counted,total:counted?p.beast.damage[key]:0};
}
export function claimBeast(p,payouts,addReward){
 const beast=p.beast||(p.beast=emptyBeast()),granted=[];
 for(const payout of payouts){
  if(beast.claimed.includes(payout.id))continue;
  beast.claimed.push(payout.id);
  for(const reward of payout.rewards)if(wallet[reward.itemId]||itemById.has(reward.itemId)){addReward(reward);granted.push(reward)}
 }
 beast.claimed=beast.claimed.slice(-60);
 return granted;
}
