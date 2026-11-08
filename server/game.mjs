import {randomUUID} from 'node:crypto';
import {GameError,requireCondition,integer} from './errors.mjs';
import {materials,itemById,items,economy,skills,stages,legacyStages,equipmentSlots,heroDefinition,definitionFor,campaign,heroAlbum,heroDefinitions,heroShardMerge,heroExpItem,heroKits,kitForAvatar,profileForAvatar} from './catalog.mjs';
import {skillLevels,skillTier,ensureLuffySkills,battleSkillState,effectiveStat} from './luffy-skills.mjs';
import {ensureRoster,heroSkills,heroLevels,heroTier,shardFor} from './hero-roster.mjs';
import {zoroRound} from './zoro-combat.mjs';
import {formationView,validateFormation,ownedHeroes} from './formation.mjs';
import {initializeTeamBattle,teamRound} from './team-combat.mjs';
import {emptyAfk,startAfk,bankAfk,afkView,collectAfk,afkHours} from './afk.mjs';
import {trackEvent,claimEvent,exchangeEvent,prayEvent,eventsView,checkinView,claimCheckin,buyEventMaterial,startEventStage,finishEventStage,spinEvent,freeEventGift,rollcallEvent} from './events.mjs';
import {emptyTower,towerView,spendTowerTurn,finishTower,floorEnemies} from './tower.mjs';
import {rollChest,chestHero} from './chests.mjs';
import {startBeast,finishBeast,claimBeast} from './beast.mjs';
import {equipmentBonus,forgeItem} from './equipment.mjs';
import {stoneGroups,unlockStone,upgradeStone,convertStone,applyStoneItem,stoneDust} from './hero-stones.mjs';
import {specialView,applySpecial,upgradeSpecial} from './special-equip.mjs';
import {trackDaily,dailyQuestView,claimDaily} from './daily-quests.mjs';
import {claimMail,deleteMail} from './mail.mjs';
import {albumView,albumGroups,rollAlbum} from './album.mjs';
import {masteryView,claimMasteryQuest,claimMasteryMilestone,recordBossBattle} from './mastery.mjs';
import {achievementView,claimAchievement,countSummons} from './achievements.mjs';
import {homeQuestView,claimHomeQuest,homeQuestEvent} from './home-quest.mjs';
import {germaView,germaStats,upgradeGerma,resetGerma,activeGermaSkills,germaUnlockStar} from './germa.mjs';
import {kitFromProfile} from './skill-kit.mjs';
import {srView,srCheckIn,srStart,srFinish,srClaimAchievement,srClaimSeason} from './silent-ring.mjs';
import {petView,recruitPets,combinePet,levelPet,growthPet,erasePet,enlightPet,starUpPet,equipPet,heroPet} from './pet.mjs';
import {devilFruitView,combineFruit,levelUpFruit,starUpFruit,rollWheel,setResonance,unlockResonance,fruitBonus} from './devil-fruit.mjs';
import {abyssView,startAbyss,finishAbyss,claimAbyssQuest,buyAbyssTurn,claimAbyssMilestone} from './abyss.mjs';
import {rollSummon,rollFiveStar,validateSummon,grantSummon,startSummon,choicePool} from './summon.mjs';

export function starterPlayer(username){
 const inventory={[materials.xp]:8,[materials.star]:25,[materials.rank]:12,[materials.skill]:12};
 const starterIds={pants:'equipment:1',armor:'equipment:22',boots:'equipment:43',helmet:'equipment:64',accessory:'artifact:1'};
 for(const slot of equipmentSlots){const item=itemById.get(starterIds[slot])||items.find(x=>x.slot===slot);if(item)inventory[item.id]=1}
 const player={version:0,starScheme:2,displayName:username,wallet:{gold:economy.initialGold,diamonds:economy.initialDiamonds,spirit:700},account:{level:1,exp:0},hero:{id:'luffy-gear-2',level:1,exp:0,stars:1,rank:0,skills:skillLevels(),equipment:{}},inventory,adventure:{unlockedStage:1,cleared:[],wins:0,lastDaily:null,afk:emptyAfk()},tower:emptyTower(),battle:null,receipts:[],activity:[]};
 startSummon(player);return player;
}
// Kỹ năng bị động của thú cưng ("Tăng cho chủ nhân ...") nhập vào bộ kỹ năng trận đấu của chủ nhân.
const petKits=new Map();
function withPetKit(kit,pet){
 if(!kit||!pet?.skills.length)return kit;
 const key=pet.skills.map(s=>s.name+s.description).join('|');
 if(!petKits.has(key))petKits.set(key,kitFromProfile({skills:pet.skills.map(s=>({name:s.name,passive:true,description:s.description.replace(/(tăng )?cho chủ nhân/gi,(m,t)=>t?'Bản thân tăng':'bản thân').replace(/chủ nhân/gi,'bản thân')}))}));
 const extra=petKits.get(key),stats={...kit.stats};for(const [k,v] of Object.entries(extra.stats))stats[k]=(stats[k]||0)+v;
 return{...kit,passives:[...kit.passives,...extra.passives],stats,triggers:[...kit.triggers,...extra.triggers]};
}
const germaKits=new Map();
/** Bộ kỹ năng trận đấu khi đã kích hoạt kỹ năng Germa: thay bị động 1-3 / Nộ bằng bản cấp 4 rồi dựng lại như kitFromProfile. */
function germaKit(h,definition){
 const actives=activeGermaSkills(h,definition.avatar),profile=profileForAvatar(definition.avatar);if(!actives.length||!profile)return null;
 const key=definition.avatar+':'+actives.map(a=>a.slot).join();
 if(!germaKits.has(key)){const skills=profile.skills.map(s=>({...s}));for(const {slot,skill} of actives){const i=slot===4?0:slot;if(skills[i])skills[i]={...skills[i],name:skill.name,level:4,description:skill.description}}germaKits.set(key,kitFromProfile({...profile,skills}))}
 return germaKits.get(key);
}
export function heroStats(player){
 const h=player.hero,zoro=h.id==='zoro-king-of-hell',scale=definitionFor(h.id).statScale,haki=zoro||scale?{hp:0,armor:0}:skillTier(h.skills,'armament-haki').values,rank=1+h.rank*.16,star=1+(h.stars-1)*.20;
 // Tăng trưởng mỗi cấp tăng dần theo cấp: cấp L được nhân (1 + L/150), nên cấp 600 mạnh gấp ~5 lần mỗi cấp so với cấp đầu.
 const grow=h.level*(1+h.level/150);
 const stats={maxHp:Math.round((800+grow*82)*rank*star),attack:Math.round((100+grow*14)*rank*star),defense:Math.round((25+grow*4)*rank*star),speed:Math.round(100+h.level*(1+h.level/600))};
 if(scale){stats.attack=Math.round(stats.attack*scale.attack);stats.maxHp=Math.round(stats.maxHp*scale.maxHp)}
 const fruit=fruitBonus(player,h),bonus=equipmentBonus(Object.values(h.equipment),h.id,[...stoneGroups(h),...albumGroups(player),...fruit.groups]);
 for(const [field,value] of Object.entries(bonus.flat))stats[field]+=value;
 // Thú cưng trang bị: Công, Thủ, Máu, Tốc của thú cưng cộng thẳng cho chủ nhân.
 {const pet=heroPet(player,h.id);if(pet){stats.attack+=pet.stats.atk;stats.defense+=pet.stats.def;stats.maxHp+=pet.stats.hp;stats.speed+=pet.stats.spd}}
 // Ép Sao / Germa: Công, Máu, Tốc cộng thẳng từ các nút chỉ số.
 for(const [field,value] of Object.entries(germaStats(h)))stats[field]+=value;
 for(const [field,value] of Object.entries(bonus.percent))stats[field]=Math.round(stats[field]*(1+value));
 Object.assign(stats,bonus.combat);
 for(const [field,value] of Object.entries(fruit.combat))stats[field]=(stats[field]||0)+value;
 for(const id of Object.values(h.equipment)){const item=itemById.get(id);if(!item||item.points)continue;for(const [name,value] of Object.entries(item.stats||{})){const field=({hp:'maxHp',atk:'attack',armor:'defense'})[name]||name;if(field in stats&&Number.isFinite(value))stats[field]+=Math.round(value)}}
 stats.maxHp=Math.round(stats.maxHp*(1+haki.hp));stats.defense=Math.round(stats.defense*(1+haki.armor));
 applySpecial(h,stats);
 if(zoro){const tier=heroLevels(h).enma,bonus=[.3,.5,.7][Math.min(3,tier)-1];stats.attack=Math.round(stats.attack*(1+bonus));stats.speed+=[80,100,150][Math.min(3,tier)-1]}
 stats.power=Math.round(stats.attack*2.4+stats.maxHp*.13+stats.defense*2);return stats;
}
// Sao 1-5 vàng, 6-9 tím, 10-14 là 5 sao đỏ, 15-19 là L1-L5 (prefab HeroStars: hero_star_1/2/3, star_e_bgr).
// Cấp tối đa: vàng 60, tím 80-110, sao đỏ 1-5: 200/220/240/260/280, L1-L5: 300/350/400/500/600.
// Từ sao đỏ, muốn thức tỉnh tiếp phải đạt cấp tối đa hiện tại. Bảng thức tỉnh gốc nằm ở server nên số nguyên liệu do bản web đặt.
const redCaps=[200,220,240,260,280],lCaps=[300,350,400,500,600];
export const levelCap=stars=>stars<=5?economy.maxHeroLevel:stars<=9?20+stars*10:stars<=14?redCaps[stars-10]:lCaps[Math.min(4,stars-15)];
export const starLabel=stars=>stars<=5?`${stars} sao vàng`:stars<=9?`${stars-5} sao tím`:stars<=14?`${stars-9} sao đỏ`:`L${stars-14}`;
function starCost(h,shard){
 const s=h.stars;if(s<5)return{gold:s*1000,items:{[shard]:s*8},minLevel:s*5};
 if(s<9)return{gold:(s-4)*100000,items:{[shard]:50,'consumable:2':(s-4)*1000},minLevel:s*5};
 if(s<14)return{gold:(s-7)*300000,items:{[shard]:100+(s-9)*20,'consumable:2':(s-7)*1500},minLevel:levelCap(s)};
 return{gold:(s-12)*800000,items:{[shard]:200+(s-14)*50,'consumable:2':(s-12)*3000,'consumable:200019':(s-13)*20000},minLevel:levelCap(s)};
}
export function upgradeCosts(player){const h=player.hero;return{
 // Cấp tối đa của tướng chỉ phụ thuộc số sao (levelCap), không phụ thuộc cấp thuyền trưởng.
 // Phí lên cấp tăng nhanh hơn theo cấp: × (1 + L/40) — cấp 100 gấp 3,5 lần, cấp 600 gấp 16 lần công thức cũ.
 level:{gold:Math.round(h.level*140*(1+h.level/40)),heroExp:Math.round(h.level*45*(1+h.level/40)),maxLevel:levelCap(h.stars)},
 star:{...starCost(h,shardFor(h)),nextCap:levelCap(Math.min(economy.maxStars,h.stars+1))},
 rank:{gold:(h.rank+1)*700,items:{[materials.rank]:(h.rank+1)*3},minLevel:(h.rank+1)*3},
 skills:Object.fromEntries(heroSkills(h).map(s=>{const level=heroLevels(h)[s.id];return[s.id,{gold:level*250,items:{[materials.skill]:level},maxLevel:Math.max(level,Math.min(economy.maxSkillLevel,2+h.rank*2))}]})),
}}
export function playerView(player,now=Date.now()){return{...baseView(player,now),events:eventsView(player,now),checkin:checkinView(player,now)}}
function baseView(player,now){ensureRoster(player);const {receipts,activity,reserveHeroes,...state}=player;const view=h=>({...h,skills:heroLevels(h),skillDetails:Object.fromEntries(heroSkills(h).map(s=>[s.id,heroTier(h,s.id)])),name:definitionFor(h.id).name,stats:heroStats({...player,hero:h}),special:specialView(h),germa:germaView(h,definitionFor(h.id).avatar),starLabel:starLabel(h.stars)});return{...state,inventory:{...state.inventory,...(state.wallet.spirit>0?{[heroExpItem]:state.wallet.spirit}:{})},formation:formationView(player),hero:view(state.hero),heroes:[state.hero,...Object.values(reserveHeroes)].map(view),costs:upgradeCosts(player),afk:afkView(player,now),tower:towerView(player,now),albumState:albumView(player),achievements:achievementView(player),homeQuest:homeQuestView(player),devilFruit:devilFruitView(player),pets:petView(player,now),silentRing:srView(player,now),mastery:masteryView(player),abyss:abyssView(player,now),dailyQuest:dailyQuestView(player,now),activity:activity.slice(-20).reverse()}}
function addItem(p,id,qty){requireCondition(itemById.has(id),'Vật phẩm không tồn tại.');if(id===heroExpItem){p.wallet.spirit=(p.wallet.spirit||0)+qty;requireCondition(p.wallet.spirit>=0,'Không đủ Đá EXP.');return}p.inventory[id]=(p.inventory[id]||0)+qty;requireCondition(p.inventory[id]>=0,'Không đủ vật phẩm.')}
function spend(p,cost){for(const [currency,amount] of Object.entries(cost)){requireCondition(Number.isSafeInteger(amount)&&amount>=0,'Chi phí không hợp lệ.');requireCondition((p.wallet[currency]||0)>=amount,`Không đủ ${({gold:'vàng',diamonds:'kim cương',spirit:'EXP tướng'})[currency]||currency}.`,400,'INSUFFICIENT_FUNDS');p.wallet[currency]-=amount;if(currency==='diamonds')trackEvent(p,'diamondSpend',amount)}}
function spendItems(p,cost={}){for(const [id,amount] of Object.entries(cost)){requireCondition((id===heroExpItem?p.wallet.spirit:p.inventory[id]||0)>=amount,`Không đủ ${itemById.get(id)?.name||'vật phẩm'}.`);addItem(p,id,-amount)}}
const walletIds=new Set(['gold','diamonds','spirit']);
export const isRewardId=id=>walletIds.has(id)||itemById.has(id);
export function grantReward(p,{itemId,quantity}){if(walletIds.has(itemId))p.wallet[itemId]=(p.wallet[itemId]||0)+quantity;else addItem(p,itemId,quantity)}
function payReward(p,{itemId,quantity}){if(walletIds.has(itemId))spend(p,{[itemId]:quantity});else spendItems(p,{[itemId]:quantity})}
function outsideBattle(p){requireCondition(!p.battle||p.battle.status!=='active','Hãy kết thúc trận chiến trước.',409,'BATTLE_ACTIVE')}
export const maxAccountLevel=100;
function accountExp(p,amount){p.account.exp+=amount;while(p.account.level<maxAccountLevel&&p.account.exp>=p.account.level*100){p.account.exp-=p.account.level*100;p.account.level++}}
export function applyAction(p,action,input,now=Date.now(),context){
 const beastActive=!!p.battle?.beast&&p.battle.status==='active',result=runAction(p,action,input,now,context);
 trackDaily(p,{action,input,beastWon:beastActive&&p.battle?.status==='won'},now);return result;
}
function runAction(p,action,input,now,context){
 ensureRoster(p);startAfk(p,now);startSummon(p);if(p.hero.id==='luffy-gear-2')ensureLuffySkills(p);
 if(action==='formation-save'){outsideBattle(p);p.formation=validateFormation(p,input.slots);return{message:'Đã lưu đội hình.'}}
 if(action==='hero-select'){
  outsideBattle(p);requireCondition(typeof input.heroId==='string','Tướng không hợp lệ.');
  if(p.hero.id===input.heroId)return{message:'Đã chọn tướng này.'};
  const next=p.reserveHeroes[input.heroId];requireCondition(next,'Bạn chưa sở hữu tướng này.',404);
  p.reserveHeroes[p.hero.id]=p.hero;delete p.reserveHeroes[input.heroId];p.hero=next;p.battle=null;
  return{message:`Đã chọn ${definitionFor(next.id).name}.`};
 }
 if(action==='profile-update'){
  requireCondition(typeof input.displayName==='string','Tên thuyền trưởng không hợp lệ.');const name=input.displayName.trim();
  requireCondition(name.length>=3&&name.length<=24&&!/[<>\u0000-\u001f]/.test(name),'Tên thuyền trưởng cần 3–24 ký tự.');p.displayName=name;return{message:'Đã đổi tên thuyền trưởng.'};
 }
 if(action==='daily')return claimCheckin(p,reward=>grantReward(p,reward),now);
 if(action==='event-spin')return spinEvent(p,input,cost=>payReward(p,cost),reward=>grantReward(p,reward),now);
 if(action==='event-free')return freeEventGift(p,input,reward=>grantReward(p,reward),now);
 if(action==='event-rollcall')return rollcallEvent(p,input,reward=>grantReward(p,reward),now);
 if(action==='event-buy')return buyEventMaterial(p,input,cost=>payReward(p,cost),reward=>grantReward(p,reward),now);
 if(action==='album-roll'){outsideBattle(p);return rollAlbum(p,input,cost=>payReward(p,cost),reward=>grantReward(p,reward))}
 if(action==='abyss-start'){
  outsideBattle(p);const teamFormation=validateFormation(p,input.formation??formationView(p).slots),{floor,enemies,meta}=startAbyss(p,input,now),{row,strength}=floorEnemies(floor);
  // Đội địch Vực thẳm là đội tướng: mỗi tướng dùng bộ kỹ năng (Nộ + bị động) đọc từ mô tả như tướng phe ta.
  // Hàng trước (ô 1-2 trong popup) đứng ở cột trước của phe địch (ô 4-5), hàng sau ở ô 1-3 và 6.
  const column={1:4,2:5,3:1,4:2,5:3,6:6};
  const foes=enemies.heroes.map((h,i)=>{const unit=enemyUnit({...h,sourceId:'hero-'+h.avatar},{position:column[h.position]},i,strength),heroId='hero-'+h.avatar,kit=kitForAvatar(h.avatar),definition=heroKits.has(heroId)?definitionFor(heroId):null;
   return kit?{...unit,heroId,kit,ultScale:1,...(definition?.ultimate?{ultimate:definition.ultimate}:{})}:unit});
  openBattle(p,foes,{chapter:1+(row.floor-1)%12,stageId:null,abyss:meta},teamFormation,p.formation?.position??0,now);
  // openBattle đặt Nộ địch = 0 và hàng theo ô; tướng địch vào trận với 35 Nộ như phe ta, hàng theo đội hình gốc.
  p.battle.enemies.forEach((e,i)=>{e.frontRow=enemies.heroes[i].position<=2;if(e.kit)e.energy=35});
  return{message:`Bắt đầu Ải ${meta.stage}.`,battleId:p.battle.id};
 }
 if(action==='mastery-claim'){outsideBattle(p);return claimMasteryQuest(p,input,reward=>grantReward(p,reward))}
 if(action==='mastery-milestone'){outsideBattle(p);return claimMasteryMilestone(p,input,reward=>grantReward(p,reward))}
 if(action==='achievement-claim'){outsideBattle(p);return claimAchievement(p,input,reward=>grantReward(p,reward))}
 if(action==='abyss-claim'){outsideBattle(p);return claimAbyssQuest(p,input,reward=>grantReward(p,reward),now)}
 if(action==='abyss-buy'){outsideBattle(p);return buyAbyssTurn(p,input,cost=>payReward(p,cost),now)}
 if(action==='abyss-milestone'){outsideBattle(p);return claimAbyssMilestone(p,input,reward=>grantReward(p,reward),now)}
 if(action==='event-stage'){
  outsideBattle(p);const teamFormation=validateFormation(p,input.formation??formationView(p).slots),{floor,meta}=startEventStage(p,input,cost=>payReward(p,cost),now),{row,sources,strength}=floorEnemies(floor);
  openBattle(p,sources.map(({slot,source},i)=>enemyUnit(source,slot,i,strength)),{chapter:1+(row.floor-1)%12,stageId:null,broken:meta},teamFormation,p.formation?.position??0,now);
  return{message:`Khiêu chiến ${meta.title}.`,battleId:p.battle.id};
 }
 if(action==='event-claim')return claimEvent(p,input,reward=>grantReward(p,reward),now);
 if(action==='event-exchange')return exchangeEvent(p,input,cost=>payReward(p,cost),reward=>grantReward(p,reward),now);
 if(action==='event-pray')return prayEvent(p,input,cost=>payReward(p,cost),reward=>grantReward(p,reward),now);
 // Cửa hàng chỉ để xem: mọi yêu cầu mua đều bị từ chối, kể cả gọi API trực tiếp.
 if(action==='buy')throw new GameError('Cửa hàng không bán vật phẩm.',410,'SHOP_CLOSED');
 if(action==='use'){
  outsideBattle(p);const item=itemById.get(input.itemId),qty=integer(input.quantity??1,1,1000000000);requireCondition(item?.effect,'Vật phẩm này dùng để trang bị hoặc nâng cấp.');if(item.stoneId){requireCondition(qty===1,'Mỗi lần chỉ lắp được một viên đá.');requireCondition((p.inventory[item.id]||0)>=1,`Không đủ ${item.name}.`);const done=applyStoneItem(p.hero,item.stoneId);spendItems(p,{[item.id]:1});return done}spendItems(p,{[item.id]:qty});if(item.afk){const amount=afkHours(p,item.afk.kind,item.afk.hours)*qty;if(item.afk.kind==='gold')p.wallet.gold+=amount;else addItem(p,economy.afk.stoneItem,amount);return{message:`Nhận ${amount} ${item.afk.kind==='gold'?'vàng':'Đá EXP'}.`,rewards:[{itemId:item.afk.kind==='gold'?'gold':economy.afk.stoneItem,quantity:amount}]}}for(const [stat,value] of Object.entries(item.effect)){if(stat==='heroExp')p.wallet.spirit+=value*qty;else if(stat==='accountExp')accountExp(p,value*qty);else if(['gold','diamonds'].includes(stat))p.wallet[stat]+=value*qty}return{message:`Đã dùng ${qty} ${item.name}.`};
 }
 if(action==='sell'){
  outsideBattle(p);const item=itemById.get(input.itemId),qty=integer(input.quantity??1,1,99);requireCondition(item,'Vật phẩm không tồn tại.',404);requireCondition(!item.noShop||item.points,'Vật phẩm này không bán.');spendItems(p,{[item.id]:qty});const gold=item.sellPrice*qty;p.wallet.gold+=gold;return{message:`Đã bán ${qty} ${item.name}, nhận ${gold} vàng.`};
 }
 if(action==='upgrade'){
  outsideBattle(p);const type=input.type,costs=upgradeCosts(p),h=p.hero;
  if(type==='level'){requireCondition(h.level<costs.level.maxLevel,'Tướng đã đạt cấp tối đa, hãy thức tỉnh để nâng thêm.');requireCondition(p.wallet.spirit>=costs.level.heroExp,'Không đủ Đá EXP. Hãy nhận thêm từ ải, tự động đánh hoặc vượt ải.');spend(p,{gold:costs.level.gold,spirit:costs.level.heroExp});h.level++}
  else if(type==='star'){requireCondition(h.stars<economy.maxStars,'Tướng đã đạt số sao tối đa.');requireCondition(h.level>=costs.star.minLevel,`Cần tướng cấp ${costs.star.minLevel}.`);spend(p,{gold:costs.star.gold});spendItems(p,costs.star.items);h.stars++}
  else if(type==='rank'){requireCondition(h.rank<economy.maxRank,'Tướng đã đạt bậc tối đa.');requireCondition(h.level>=costs.rank.minLevel,`Cần tướng cấp ${costs.rank.minLevel}.`);spend(p,{gold:costs.rank.gold});spendItems(p,costs.rank.items);h.rank++}
  else if(type==='skill'){const skill=heroSkills(h).find(s=>s.id===input.skillId);requireCondition(skill,'Kỹ năng không tồn tại.');const c=costs.skills[skill.id];requireCondition(h.skills[skill.id]<c.maxLevel,'Cần đột phá bậc tướng để nâng kỹ năng.');spend(p,{gold:c.gold});spendItems(p,c.items);h.skills[skill.id]++}
  else throw new GameError('Loại nâng cấp không hợp lệ.');return{message:'Nâng cấp thành công.',type};
 }
 if(action==='equip'){
  outsideBattle(p);const item=itemById.get(input.itemId);requireCondition(item?.slot&&equipmentSlots.includes(item.slot),'Vật phẩm không thể trang bị.');requireCondition((p.inventory[item.id]||0)>0,'Bạn chưa sở hữu vật phẩm này.');requireCondition(p.hero.equipment[item.slot]!==item.id,'Vật phẩm đã được trang bị.');const old=p.hero.equipment[item.slot];if(old)addItem(p,old,1);spendItems(p,{[item.id]:1});p.hero.equipment[item.slot]=item.id;return{message:`Đã trang bị ${item.name}.`};
 }
 if(action==='unequip'){outsideBattle(p);requireCondition(equipmentSlots.includes(input.slot),'Ô trang bị không hợp lệ.');const old=p.hero.equipment[input.slot];requireCondition(old,'Ô trang bị đang trống.');addItem(p,old,1);delete p.hero.equipment[input.slot];return{message:'Đã tháo trang bị.'}}
 if(action==='battle-start'){
  outsideBattle(p);const stageId=integer(input.stageId,1,stages.length,'Màn chơi');requireCondition(stageId<=p.adventure.unlockedStage,'Màn chơi chưa được mở khóa.',403,'STAGE_LOCKED');const stage=stages[stageId-1];
  requireCondition(p.account.level>=stage.requireLevel,`Cần thuyền trưởng cấp ${stage.requireLevel}.`,403,'LEVEL_REQUIRED');
  const teamMode=input.formation!==undefined||(input.heroId===undefined&&input.position===undefined&&Array.isArray(p.formation?.slots));
  const teamFormation=teamMode?validateFormation(p,input.formation??p.formation.slots):null;
  const position=integer(input.position??p.formation?.position??0,0,5,'Vị trí đội hình');
  if(!teamMode&&input.heroId!==undefined&&input.heroId!==p.hero.id)applyAction(p,'hero-select',{heroId:input.heroId},now);
  openBattle(p,stage.enemies.map((slot,i)=>enemyUnit(campaign.enemies[slot.monsterId],slot,i,stageId)),{chapter:stage.chapter,stageId},teamFormation,position,now);
  return{message:`Bắt đầu ${stage.name}.`,battleId:p.battle.id};
 }
 if(action==='tower-start'){
  outsideBattle(p);const teamFormation=validateFormation(p,input.formation??formationView(p).slots),{row,sources,strength}=spendTowerTurn(p,now);
  openBattle(p,sources.map(({slot,source},i)=>enemyUnit(source,slot,i,strength)),{chapter:1+(row.floor-1)%12,stageId:null,tower:{floor:row.floor}},teamFormation,p.formation?.position??0,now);
  return{message:`Bắt đầu tầng ${row.floor}.`,battleId:p.battle.id};
 }
 if(action==='beast-start'){
  outsideBattle(p);const {team,unit,meta}=startBeast(p,input,context,now),saved=p.formation;trackEvent(p,'beast',1,now);
  openBattle(p,[unit],meta,team,saved?.position??0,now);
  // Đội đánh boss chỉ có một nghề, không được ghi đè đội hình chính.
  if(saved)p.formation=saved;else delete p.formation;
  if(input.skip===true)while(p.battle.status==='active')battleRound(p,{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},now);
  return{message:`Khiêu chiến ${unit.name}.`,battleId:p.battle.id};
 }
 if(action==='beast-claim'){
  outsideBattle(p);const granted=claimBeast(p,context?.payouts||[],reward=>grantReward(p,reward));
  return{message:'Đã nhận quà tổng kết.',granted,rewards:granted};
 }
 if(action==='mail-claim'){outsideBattle(p);return claimMail(p,input,reward=>grantReward(p,reward),now)}
 if(action==='mail-delete')return deleteMail(p,input);
 if(action==='shard-merge'){
  outsideBattle(p);const item=itemById.get(input.itemId);requireCondition(item?.merge,'Vật phẩm này không ghép được.',404);
  if(item.heroShard)requireCondition(!ownedHeroes(p).has('hero-'+item.heroShard),'Đã có tướng này, mảnh dùng để lên sao.',409,'HERO_OWNED');
  requireCondition((p.inventory[item.id]||0)>=item.merge,`Cần ${item.merge} ${item.name}.`,409,'SHARD_NOT_ENOUGH');
  spendItems(p,{[item.id]:item.merge});const target=item.heroShard?{avatar:item.heroShard}:rollFiveStar(),grant=grantSummon(p,target);if(grant.shardItem)addItem(p,grant.shardItem,grant.shards);
  if((heroAlbum.heroes.find(h=>h.avatar===target.avatar)?.rank||0)>=5)trackEvent(p,'merge5',1,now);
  return{message:grant.shardItem?`Đã có tướng này, nhận ${grant.shards} mảnh.`:'Đã ghép thành tướng mới.',hero:grant};
 }
 if(['stone-unlock','stone-upgrade','stone-convert'].includes(action)){
  outsideBattle(p);const pay=(gold,dust)=>{spend(p,{gold});spendItems(p,{[stoneDust]:dust})};
  if(action==='stone-upgrade'){const result=upgradeStone(p.hero,pay);homeQuestEvent(p,5,1);return result}
  return action==='stone-unlock'?unlockStone(p.hero):convertStone(p.hero,pay);
 }
 if(action==='sr-checkin'){outsideBattle(p);return srCheckIn(p,input,ownedHeroes(p),now)}
 if(action==='sr-claim'){outsideBattle(p);return srClaimAchievement(p,input,reward=>grantReward(p,reward),now)}
 if(action==='sr-season'){outsideBattle(p);return srClaimSeason(p,reward=>grantReward(p,reward),now)}
 if(action==='sr-start'){
  outsideBattle(p);const saved=p.formation,{team,unit,meta}=srStart(p,input,{owned:ownedHeroes(p),validate:f=>validateFormation(p,f),now});
  // Quái Vành Đai dùng bộ kỹ năng gốc (Nộ + bị động, boss thêm Đại Nộ / Hộ thể theo máu hộ vệ) đọc từ mô tả.
  const [active,...passives]=unit.silentSkills,kit=kitFromProfile({skills:[{...active,passive:false},...passives.map(s=>({...s,passive:true}))]});delete unit.silentSkills;
  openBattle(p,[{...unit,kit,ultScale:1}],meta,team,saved?.position??0,now);
  if(saved)p.formation=saved;else delete p.formation;
  if(input.skip===true)while(p.battle.status==='active')battleRound(p,{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},now);
  return{message:`Khiêu chiến ${unit.name}.`,battleId:p.battle.id};
 }
 if(action==='pet-recruit'){outsideBattle(p);return recruitPets(p,input,{pay:cost=>payReward(p,cost),grant:reward=>grantReward(p,reward),now})}
 if(action==='pet-combine'){outsideBattle(p);return combinePet(p,input)}
 if(action==='pet-level'){outsideBattle(p);return levelPet(p,input,cost=>payReward(p,cost))}
 if(action==='pet-growth'){outsideBattle(p);return growthPet(p,input,cost=>payReward(p,cost))}
 if(action==='pet-erase'){outsideBattle(p);return erasePet(p,input,cost=>payReward(p,cost))}
 if(action==='pet-enlight'){outsideBattle(p);return enlightPet(p,input,cost=>payReward(p,cost))}
 if(action==='pet-star'){outsideBattle(p);return starUpPet(p,input,cost=>payReward(p,cost))}
 if(action==='pet-equip'){outsideBattle(p);return equipPet(p,input,id=>ownedHeroes(p).has(id))}
 if(action==='germa-upgrade'){outsideBattle(p);const h=p.hero;return upgradeGerma(p,h,input,{pay:cost=>payReward(p,cost),grant:reward=>grantReward(p,reward),shard:shardFor(h),avatar:definitionFor(h.id).avatar})}
 if(action==='germa-reset'){outsideBattle(p);return resetGerma(p,p.hero,{pay:cost=>payReward(p,cost),grant:reward=>grantReward(p,reward)})}
 if(action==='fruit-combine'){outsideBattle(p);return combineFruit(p,input)}
 if(action==='fruit-level'){outsideBattle(p);return levelUpFruit(p,input,cost=>payReward(p,cost))}
 if(action==='fruit-star'){outsideBattle(p);return starUpFruit(p,input,cost=>payReward(p,cost))}
 if(action==='fruit-roll'){outsideBattle(p);return rollWheel(p,input,{pay:cost=>payReward(p,cost),grant:reward=>grantReward(p,reward),name:p.displayName})}
 if(action==='fruit-heroes'){outsideBattle(p);return setResonance(p,input,ownedHeroes(p))}
 if(action==='fruit-unlock'){outsideBattle(p);return unlockResonance(p,cost=>payReward(p,cost))}
 if(action==='home-quest-claim'){outsideBattle(p);return claimHomeQuest(p,reward=>grantReward(p,reward))}
 if(action==='daily-quest-claim'){outsideBattle(p);return claimDaily(p,input,reward=>grantReward(p,reward),now)}
 if(action==='special-upgrade'){outsideBattle(p);return upgradeSpecial(p.hero,input,cost=>{spend(p,{gold:cost.gold});spendItems(p,cost.items)})}
 if(action==='forge'){outsideBattle(p);const result=forgeItem(p,input,spendItems,addItem);trackEvent(p,'forge',result.quantity,now);return result}
 if(action==='battle-action')return battleRound(p,input,now);
 if(action==='chest-open'){
  outsideBattle(p);const item=itemById.get(input.itemId);requireCondition(item?.chest,'Vật phẩm này không mở được.');
  const {count,rewards}=rollChest(item,input);spendItems(p,{[item.id]:count});const merged=new Map();
  const add=(key,value)=>{const row=merged.get(key);if(row)row.quantity+=value.quantity;else merged.set(key,{...value})};
  for(const reward of rewards){
   if(reward.kind==='gold'||reward.kind==='diamonds'){p.wallet[reward.kind]+=reward.quantity;add(reward.kind,reward)}
   else if(reward.kind==='item'){addItem(p,reward.itemId,reward.quantity);add(reward.itemId,reward)}
   else{const grant=grantSummon(p,chestHero(reward));if(grant.shardItem){addItem(p,grant.shardItem,grant.shards);add('hero:'+grant.avatar,{kind:'hero',avatar:grant.avatar,shardItem:grant.shardItem,quantity:grant.shards})}else add('hero:'+grant.avatar,{kind:'hero',avatar:grant.avatar,fresh:true,quantity:1})}
  }
  return{message:`Đã mở ${count} ${item.name}.`,rewards:[...merged.values()]};
 }
 if(action==='item-choose'){
  outsideBattle(p);const item=itemById.get(input.itemId);requireCondition(item?.choice,'Vật phẩm này không thể chọn tướng.');
  const hero=choicePool(item).find(h=>h.avatar===input.avatar);requireCondition(hero,'Tướng này không có trong danh sách.');
  // Thẻ chọn tướng trả 50 mảnh của tướng đó: đủ để ghép, hoặc dùng nâng sao nếu đã có tướng.
  spendItems(p,{[item.id]:1});const shard=shardFor(heroDefinitions.find(d=>d.avatar===hero.avatar)),quantity=heroShardMerge;addItem(p,shard,quantity);
  return{message:`Nhận ${quantity} mảnh ${hero.name}.`,hero:{avatar:hero.avatar,shardItem:shard,shards:quantity},rewards:[{itemId:shard,quantity}]};
 }
 if(action==='summon'){
  outsideBattle(p);const {faction,count}=validateSummon(input);spendItems(p,{[economy.summon.item]:count});
  trackEvent(p,'summon',count,now);countSummons(p,count);const rolled=rollSummon(faction,count);trackEvent(p,'summon4',rolled.filter(h=>h.rank>=4).length,now);const heroes=rolled.map(hero=>{const grant=grantSummon(p,hero);if(grant.shardItem)addItem(p,grant.shardItem,grant.shards);return grant});
  return{message:`Đã chiêu mộ ${count} lần.`,heroes};
 }
 if(action==='afk-claim'){
  outsideBattle(p);const payout=collectAfk(p,now),amount=n=>n.toLocaleString('vi-VN'),items=payout.stones?[{itemId:economy.afk.stoneItem,quantity:payout.stones}]:[];
  p.wallet.gold+=payout.gold;accountExp(p,payout.accountExp);if(payout.stones)addItem(p,economy.afk.stoneItem,payout.stones);
  return{message:`Đã nhận ${amount(payout.gold)} vàng, ${amount(payout.accountExp)} kinh nghiệm${payout.stones?`, ${amount(payout.stones)} Đá EXP`:''}.`,reward:{gold:payout.gold,accountExp:payout.accountExp,items,seconds:payout.seconds},rewards:[{itemId:'gold',quantity:payout.gold},{itemId:'consumable:1002',quantity:payout.accountExp},...items].filter(r=>r.quantity>0)};
 }
 if(action==='battle-leave'){requireCondition(p.battle?.status==='active','Không có trận chiến đang diễn ra.');if(p.battle.silent){p.battle.status='won';srFinish(p,p.battle,reward=>grantReward(p,reward),now);return{message:'Đã rút lui. Sát thương vẫn được tính.'}}if(p.battle.beast){p.battle.status='won';finishBeast(p,p.battle);recordBossBattle(p,p.battle);return{message:'Đã rút lui. Sát thương vẫn được tính.'}}p.battle.status='abandoned';return{message:'Đã rút lui. Không nhận thưởng.'}}
 throw new GameError('Thao tác không tồn tại.',404);
}
function enemyUnit(source,slot,i,strength){const maxHp=Math.round((240+strength*100)*(1+i*.13));return{id:'enemy-'+i,name:source.name,avatar:source.avatar,faction:source.faction,heroClass:source.class||null,level:source.level,stars:source.stars,monsterId:source.sourceId,position:slot.position,maxHp,hp:maxHp,attack:25+strength*15+i*8,defense:9+strength*4,speed:70+i*4,visualIndex:i}}
function scaledUltimate(ultimate,level){
 const scale=1+.1*(level-1),heal=ultimate.heal&&{...ultimate.heal,attack:ultimate.heal.attack*scale,maxHp:ultimate.heal.maxHp*scale};
 return{...ultimate,damage:ultimate.damage*scale,...(heal?{heal}:{})};
}
function openBattle(p,enemies,meta,teamFormation,position,now){
 const heroSnapshot=heroStats(p);p.formation={position};
 p.battle={id:randomUUID(),campaignVersion:1,...meta,status:'active',turn:1,seed:Math.floor(now%4294967295)||1,hero:{id:'hero',heroId:p.hero.id,name:definitionFor(p.hero.id).name,...heroSnapshot,hp:heroSnapshot.maxHp,position,frontRow:position<2,energy:p.hero.id==='zoro-king-of-hell'?100:35,cooldowns:{},skills:{...p.hero.skills}},enemies,events:[],createdAt:new Date(now).toISOString(),reward:null};
 if(!teamFormation)return;
 const owned=ownedHeroes(p),allies=[];
 teamFormation.slots.forEach((heroId,position)=>{if(!heroId)return;const h=owned.get(heroId),stats=heroStats({...p,hero:h}),definition=definitionFor(heroId);allies.push({id:allies.length?'ally-'+heroId:'hero',heroId,side:'ally',name:definition.name,faction:definition.faction,avatar:definition.avatar,heroClass:definition.class,level:h.level,stars:h.stars,...stats,hp:stats.maxHp,energy:heroId==='zoro-king-of-hell'?100:35,position,frontRow:position<2,skills:heroLevels(h),cooldowns:{},...(definition.ultimate?{ultimate:scaledUltimate(definition.ultimate,heroLevels(h)[definition.ultimate.id])}:{}),...(heroKits.get(heroId)?{kit:withPetKit(germaKit(h,definition)||heroKits.get(heroId),heroPet(p,heroId)),ultScale:1+.1*((heroLevels(h)[definition.ultimate?.id]||1)-1)}:{})})});
 p.formation=teamFormation;p.battle.combatVersion=2;p.battle.allies=allies;
 for(const e of enemies){e.side='enemy';e.frontRow=e.position>=4;e.energy=0}
 initializeTeamBattle(p.battle);
}
function random(b){let x=b.seed>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;b.seed=x>>>0;return b.seed/4294967296}
function damage(b,attack,defense,multiplier=1){return Math.max(1,Math.round((attack*multiplier-defense*.6)*(.94+random(b)*.12)))}
function event(b,events,e){const value={id:b.events.length+events.length,turn:b.turn,...e};events.push(value);return value}
function battleRound(p,input,now){
 const b=p.battle;requireCondition(b?.status==='active','Không có trận chiến đang diễn ra.',409,'BATTLE_FINISHED');requireCondition(input.battleId===b.id,'Trận chiến không khớp.',409);integer(input.turn,1,60,'Lượt');requireCondition(input.turn===b.turn,'Lượt chiến đấu đã thay đổi. Hãy tải lại trạng thái.',409,'STALE_TURN');
 const type=input.action;requireCondition(['attack','skill','defend','auto'].includes(type),'Hành động chiến đấu không hợp lệ.');const events=[],h=b.hero;
 if(b.combatVersion===2){
  const primary=b.allies[0];
  if(type==='skill'){requireCondition(primary.hp>0,'Tướng này đã bị hạ.');const luffy=primary.heroId==='luffy-gear-2',rage=luffy?80:100;requireCondition(primary.energy>=rage,`Chưa đủ ${rage} nộ.`);if(luffy)requireCondition(!primary.cooldowns?.['rubber-whip'],'Kỹ năng đang hồi chiêu.')}
  events.push(...teamRound(b,input));
  if(b.silent){if(!b.allies.some(u=>u.hp>0)||!b.enemies.some(u=>u.hp>0)||b.turn>=b.silent.rounds){b.status='won';srFinish(p,b,reward=>grantReward(p,reward),now);event(b,events,{type:'victory',reward:b.reward})}else b.turn++}
  else if(b.beast){if(!b.allies.some(u=>u.hp>0)||b.turn>=b.beast.rounds){b.status='won';finishBeast(p,b);event(b,events,{type:'victory',reward:b.reward})}else b.turn++}
  else if(!b.enemies.some(u=>u.hp>0)){b.status='won';settleVictory(p,b,now);event(b,events,{type:'victory',reward:b.reward})}
  else if(!b.allies.some(u=>u.hp>0)||b.turn>=40){b.status='lost';event(b,events,{type:'defeat'})}else b.turn++;
  b.events.push(...events);if(b.beast&&b.status==='won')recordBossBattle(p,b);return{message:b.status==='won'?'Chiến thắng!':b.status==='lost'?'Thất bại. Hãy nâng cấp đội hình.':'Đã kết thúc vòng.',events,battleId:b.id};
 }
 if(p.hero.id==='zoro-king-of-hell'){
  if(type==='skill')requireCondition(h.energy>=100,'Chưa đủ 100 nộ.');
  requireCondition(b.enemies.some(e=>e.hp>0),'Mục tiêu không hợp lệ.');
  zoroRound(b,type,{random:()=>random(b),emit:e=>event(b,events,e)});
  if(!b.enemies.some(e=>e.hp>0)){b.status='won';settleVictory(p,b,now);event(b,events,{type:'victory',reward:b.reward})}
  else if(h.hp<=0||b.turn>=40){b.status='lost';event(b,events,{type:'defeat'})}else b.turn++;
  b.events.push(...events);return{message:b.status==='won'?'Chiến thắng!':b.status==='lost'?'Thất bại. Hãy nâng cấp tướng.':'Đã kết thúc lượt.',events,battleId:b.id};
 }
 battleSkillState(b);
 for(const unit of [h,...b.enemies]){const expired=unit.effects.filter(e=>e.expiresTurn<b.turn);unit.effects=unit.effects.filter(e=>e.expiresTurn>=b.turn);for(const effect of expired)event(b,events,{type:'effect-expired',target:unit.id,skillId:effect.skillId,name:effect.name})}
 for(const name of Object.keys(h.cooldowns))h.cooldowns[name]=Math.max(0,h.cooldowns[name]-1);
 const cast=type==='skill'||(type==='auto'&&h.energy>=80&&!h.cooldowns['rubber-whip']),defend=type==='defend';
 const applyEffect=(unit,skillId,attribute,value,lastTurn)=>{
  const name=skills.find(s=>s.id===skillId).name,effect={id:skillId,skillId,name,attribute,value,expiresTurn:lastTurn};
  unit.effects=unit.effects.filter(e=>e.id!==effect.id);unit.effects.push(effect);event(b,events,{type:'buff',actor:'hero',target:unit.id,skillId,name,attribute,value,expiresTurn:lastTurn});
 };
 const hit=(attacker,target,multiplier,skill=false)=>{
  const critChance=effectiveStat(attacker,'critChance',b.turn),critical=critChance>0&&random(b)<critChance;
  const amount=damage(b,effectiveStat(attacker,'attack',b.turn),effectiveStat(target,'defense',b.turn),multiplier*(critical?1.5:1));target.hp=Math.max(0,target.hp-amount);
  event(b,events,{type:'damage',actor:attacker.id,target:target.id,amount,hp:target.hp,skill,critical});
  if(!target.hp){event(b,events,{type:'death',target:target.id});return}
  if(target.id==='hero'){
   applyEffect(attacker,'polish','critChance',skillTier(h.skills,'polish').values.critReduction,b.turn+3);
   if(!h.desperationUsed&&h.hp/h.maxHp<.3){h.desperationUsed=true;applyEffect(h,'desperation','defense',skillTier(h.skills,'desperation').values.armor,b.turn+2)}
  }
 };
 const target=b.enemies.find(e=>e.id===input.targetId&&e.hp>0)||b.enemies.find(e=>e.hp>0);
 requireCondition(target,'Mục tiêu không hợp lệ.');
 if(cast){
  requireCondition(h.energy>=80,'Chưa đủ 80 nộ.');requireCondition(!h.cooldowns['rubber-whip'],'Kỹ năng đang hồi chiêu.');
  const values=skillTier(h.skills,'rubber-whip').values,attack=effectiveStat(h,'attack',b.turn);h.energy-=80;h.cooldowns['rubber-whip']=3;
  event(b,events,{type:'skill',actor:'hero',target:target.id,skillId:'rubber-whip',animation:'skill3',name:'Roi Cao Su'});hit(h,target,values.damage,true);
  // The current party has one ally: Luffy is also the lowest-HP ally.
  const amount=Math.min(h.maxHp-h.hp,Math.round(attack*values.heal));h.hp+=amount;
  event(b,events,{type:'heal',actor:'hero',target:'hero',skillId:'rubber-whip',amount,hp:h.hp});
  if(values.attackBuff)applyEffect(h,'rubber-whip','attack',values.attackBuff,b.turn+2);
 }else if(defend){h.energy=Math.min(100,h.energy+20);event(b,events,{type:'defend',actor:'hero',name:'Phòng thủ',energy:h.energy})}
 else{event(b,events,{type:'attack',actor:'hero',target:target.id,animation:'beat'});hit(h,target,1.12);h.energy=Math.min(100,h.energy+35)}
 for(const enemy of b.enemies.filter(e=>e.hp>0)){
  event(b,events,{type:'attack',actor:enemy.id,target:'hero',animation:'beat'});hit(enemy,h,defend?.45:1);h.energy=Math.min(100,h.energy+12);if(!h.hp)break;
 }
 if(!b.enemies.some(e=>e.hp>0)){b.status='won';settleVictory(p,b,now);event(b,events,{type:'victory',reward:b.reward})}
 else if(h.hp<=0||b.turn>=40){b.status='lost';event(b,events,{type:'defeat'})}
 else b.turn++;
 b.events.push(...events);return{message:b.status==='won'?'Chiến thắng!':b.status==='lost'?'Thất bại. Hãy nâng cấp Luffy.':'Đã kết thúc lượt.',events,battleId:b.id};
}
function settleVictory(p,b,now){
 // Called inside the same versioned MongoDB document update as the last hit.
 if(b.tower){trackEvent(p,'tower',1,now);const reward=finishTower(p,b.tower.floor,now);p.wallet.gold+=reward.gold;for(const item of reward.items)addItem(p,item.itemId,item.quantity);b.reward=reward;return}
 if(b.abyss){b.reward=finishAbyss(p,b,now);return}
 if(b.broken){b.reward=finishEventStage(p,b.broken,reward=>grantReward(p,reward),now);return}
 trackEvent(p,'stage',1,now);bankAfk(p,now);
 const original=b.campaignVersion===1,stage=(original?stages:legacyStages)[b.stageId-1]||stages[b.stageId-1],first=!p.adventure.cleared.includes(stage.id);const reward={...stage.rewards,firstClear:first,items:[]};
  if(first){reward.diamonds+=stage.firstClear.diamonds;addItem(p,shardFor(p.hero),stage.firstClear.starShards);reward.items.push({itemId:shardFor(p.hero),quantity:stage.firstClear.starShards});p.adventure.cleared.push(stage.id)}
 p.wallet.gold+=reward.gold;p.wallet.diamonds+=reward.diamonds;accountExp(p,reward.accountExp);
 // Cột spirit của ải là EXP tướng: vào quỹ chung một lần, không nhân theo số tướng ra trận.
 p.wallet.spirit+=reward.heroExp;
 p.adventure.unlockedStage=Math.min(stages.length,Math.max(p.adventure.unlockedStage,stage.id+1));p.adventure.wins++;
 if(original){for(const drop of stage.drops){addItem(p,drop.itemId,drop.quantity);reward.items.push({...drop})}}
 else{const dropIds=[materials.xp,materials.rank,materials.skill];const drop=dropIds[(stage.id-1)%dropIds.length];addItem(p,drop,1);reward.items.push({itemId:drop,quantity:1});const equipment=items.filter(x=>x.category==='equipment');if(equipment.length){const item=equipment[(stage.id*7+p.adventure.wins)%equipment.length];addItem(p,item.id,1);reward.items.push({itemId:item.id,quantity:1})}}
 startAfk(p,now);b.reward=reward;
}
