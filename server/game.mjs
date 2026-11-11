import {randomUUID} from 'node:crypto';
import {GameError,requireCondition,integer} from './errors.mjs';
import {materials,itemById,items,economy,skills,levelKit,stages,legacyStages,equipmentSlots,heroDefinition,definitionFor,campaign,heroAlbum,heroDefinitions,heroShardMerge,heroExpItem,heroKits,kitForAvatar,profileForAvatar} from './catalog.mjs';
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
import {hakiView,hakiStats,hakiUnit,pickHaki} from './haki.mjs';
import {upgradeArtifact} from './artifact-upgrade.mjs';
import {talentView,talentStats,talentLevelBonus,talentPassives,talentKit,talentAction} from './talent.mjs';
import {srView,srCheckIn,srStart,srFinish,srClaimAchievement,srClaimSeason} from './silent-ring.mjs';
import {petView,recruitPets,combinePet,levelPet,growthPet,erasePet,enlightPet,starUpPet,equipPet,heroPet} from './pet.mjs';
import {devilFruitView,combineFruit,levelUpFruit,starUpFruit,rollWheel,setResonance,unlockResonance,fruitBonus} from './devil-fruit.mjs';
import {abyssView,startAbyss,finishAbyss,claimAbyssQuest,buyAbyssTurn,claimAbyssMilestone} from './abyss.mjs';
import {arenaModes,dayKey,freeTickets,ticketItem,ticketPrice,ticketBuyLimit,allstarAttacks,allstarAttackPrice,allstarBuyLimit,betItem,betAmount,asEnemies,series} from './arena.mjs';
import {guildState,techBonus,applyTech,techView,techAction,guildCoin,createCost,createLevel,validName,rollCall,donations,donateLimit,bossFreeAttacks,bossBuyPrice,bossBuyLimit,bossRounds,stageData,bossMonster,vnDay,guildData} from './guild.mjs';
import {excView,excAction,excLevel,excPoints,excTierStats,excSkill} from './exc.mjs';
import {tthView,tthBuy,tthSpend,tthFinish,tthDay,bossUnit,bossOfDay,battleRounds as tthRounds} from './tth.mjs';
import {raidSmash,raidBuy,raidPrepare,raidFinish,raidEnemyStats,raidModes,vnDay as raidDay} from './raid.mjs';
import {rollSummon,rollFiveStar,validateSummon,grantSummon,startSummon,choicePool} from './summon.mjs';
import {shipView,shipAction,shipForBattle,shipItems} from './ship.mjs';
import {profileAction,levelRewards,noteLevelUp} from './profile.mjs';
import {applyAura} from './aura.mjs';
// Chiến hạm mở ở cấp thuyền trưởng 20 (MISC_2_MSG_FEATURE_PET); lần đầu mở được tặng đủ Hồn để kích hoạt chiến hạm đầu tiên.
export const shipLevel=20;
export function shipGift(p){if(!p.hero||p.account.level<shipLevel||p.ships?.gift)return false;p.ships??={list:{},selected:null};p.ships.gift=true;p.inventory[shipItems.soul]=(p.inventory[shipItems.soul]||0)+300;p.inventory[shipItems.chaos]=(p.inventory[shipItems.chaos]||0)+200;return true}
function payShip(p,cost){
 for(const [k,id] of [['soul',shipItems.soul],['chaos',shipItems.chaos],['wood',shipItems.wood]])if(cost[k])requireCondition((p.inventory[id]||0)>=cost[k],`Không đủ ${itemById.get(id)?.name||k}.`,409,'NOT_ENOUGH');
 if(cost.gold)spend(p,{gold:cost.gold});const items={};for(const [k,id] of [['soul',shipItems.soul],['chaos',shipItems.chaos],['wood',shipItems.wood]])if(cost[k])items[id]=cost[k];spendItems(p,items);
}

// intro:true = tài khoản đăng ký mới: chưa có tướng, đi phần mở đầu. Mặc định (bot, test) vẫn có Luffy.
export function starterPlayer(username,{intro=false}={}){
 const inventory={[materials.xp]:8,[materials.star]:25,[materials.rank]:12,[materials.skill]:12};
 const starterIds={pants:'equipment:1',armor:'equipment:22',boots:'equipment:43',helmet:'equipment:64',accessory:'artifact:1'};
 for(const slot of equipmentSlots){const item=itemById.get(starterIds[slot])||items.find(x=>x.slot===slot);if(item)inventory[item.id]=1}
 const player={version:0,starScheme:2,displayName:username,wallet:{gold:economy.initialGold,diamonds:economy.initialDiamonds,spirit:700},account:{level:1,exp:0},hero:intro?null:{id:'luffy-gear-2',level:1,exp:0,stars:1,rank:0,skills:skillLevels(),equipment:{}},...(intro?{intro:'story'}:{}),inventory,adventure:{unlockedStage:1,cleared:[],wins:0,lastDaily:null,afk:emptyAfk()},tower:emptyTower(),battle:null,receipts:[],activity:[]};
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
// Kỹ năng Thiên phú đã chọn là bị động cộng vào bộ kỹ năng trận đấu (kể cả Luffy / Zoro, khi đó chỉ có phần bị động).

function withTalentKit(kit,h){
 const extra=talentKit(h);if(!extra.passives.length)return kit;
 const base=kit||{ultimate:null,passives:[],stats:{},triggers:[]},stats={...base.stats};
 for(const [k,v] of Object.entries(extra.stats))stats[k]=(stats[k]||0)+v;
 return{...base,passives:[...base.passives,...extra.passives],stats,triggers:[...base.triggers,...extra.triggers]};
}
// Luyện hồn: chỉ số của bậc kỹ năng đang mở (stats gốc) + phần kích hoạt đọc từ mô tả của bậc đó (bậc cao thay bậc thấp).
// Bậc đã có stats gốc thì không lấy chỉ số đọc từ mô tả để tránh cộng hai lần.
const excKits=new Map();
function withExcKit(kit,h){
 const avatar=definitionFor(h.id).avatar,level=excLevel(h),skill=h.stars>=10?excSkill(avatar,level):null;if(!skill)return kit;
 const key=avatar+':'+skill.tier;if(!excKits.has(key))excKits.set(key,kitFromProfile({skills:[{name:skill.name,passive:true,description:'Bị động: '+skill.text}]}));
 const parsed=excKits.get(key),base=kit||{ultimate:null,passives:[],stats:{},triggers:[]},stats={...base.stats};
 for(const [k,v] of Object.entries(skill.hasStats?excTierStats(avatar,level):parsed.stats))stats[k]=(stats[k]||0)+v;
 return{...base,passives:[...base.passives,{name:skill.name,passive:true,description:skill.text,effects:[]}],stats,triggers:[...base.triggers,...parsed.triggers.map(t=>({...t,skill:skill.name}))]};
}
/** Bộ kỹ năng trận đấu theo cấp kỹ năng hiện tại (tự lên theo sao); kỹ năng Germa đã kích hoạt thay ô tương ứng. */
function battleKit(h,definition){
 if(!profileForAvatar(definition.avatar))return null;
 const levels=heroLevels(h),override={};
 for(const {slot,skill} of activeGermaSkills(h,definition.avatar)){const i=slot===4?0:slot;override[i]={name:skill.name,level:4,description:skill.description}}
 return levelKit(definition.avatar,definition.skills.map(s=>levels[s.id]||1),override);
}
export function heroStats(player){
 const h=player.hero,zoro=h.id==='zoro-king-of-hell',scale=definitionFor(h.id).statScale,haki=zoro||scale?{hp:0,armor:0}:heroTier(h,'armament-haki').values,rank=1+h.rank*.16,star=1+(h.stars-1)*.20;
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
 // Thiên phú: Công, Máu, Tốc cộng thẳng theo cấp Thiên phú (point_level_data).
 for(const [field,value] of Object.entries(talentStats(h)))stats[field]+=value;
 for(const [field,value] of Object.entries(bonus.percent))stats[field]=Math.round(stats[field]*(1+value));
 Object.assign(stats,bonus.combat);
 for(const [field,value] of Object.entries(fruit.combat))stats[field]=(stats[field]||0)+value;
 for(const id of Object.values(h.equipment)){const item=itemById.get(id);if(!item||item.points)continue;for(const [name,value] of Object.entries(item.stats||{})){const field=({hp:'maxHp',atk:'attack',armor:'defense'})[name]||name;if(field in stats&&Number.isFinite(value))stats[field]+=Math.round(value)}}
 stats.maxHp=Math.round(stats.maxHp*(1+haki.hp));stats.defense=Math.round(stats.defense*(1+haki.armor));
 // Bảng Haki (E-skill): % Máu, % Công và Tốc của các Haki đã kích hoạt.
 {const e=hakiStats(h);stats.maxHp=Math.round(stats.maxHp*(1+e.maxHp));stats.attack=Math.round(stats.attack*(1+e.attack));stats.speed+=e.speed}
 applySpecial(h,stats);
 if(zoro){const tier=Math.min(4,heroLevels(h).enma),bonus=[.3,.5,.7,1][tier-1];stats.attack=Math.round(stats.attack*(1+bonus));stats.speed+=[80,100,150,200][tier-1]}
 // Luyện hồn: % Công, % Máu, Tốc độ tích lũy theo cấp (point_level_data 100 / 102 / 3).
 if(h.stars>=10){const e=excPoints(excLevel(h));stats.attack=Math.round(stats.attack*(1+e.attackPct));stats.maxHp=Math.round(stats.maxHp*(1+e.maxHpPct));stats.speed+=e.speed}
 // Kỹ năng hạm đội (PopupGuildSkill): cộng theo nghề của tướng khi đang ở trong hạm đội.
 applyTech(stats,techBonus(player,definitionFor(h.id).class));
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
 level:{gold:Math.round(h.level*140*(1+h.level/40)),heroExp:Math.round(h.level*45*(1+h.level/40)),maxLevel:levelCap(h.stars)+talentLevelBonus(h)},
 star:{...starCost(h,shardFor(h)),nextCap:levelCap(Math.min(economy.maxStars,h.stars+1))},
 rank:{gold:(h.rank+1)*700,items:{[materials.rank]:(h.rank+1)*3},minLevel:(h.rank+1)*3},
}}
// Phần mở đầu (TutorialStory gốc): 'story' -> 'summon' -> 'done'. Chưa có tướng thì chỉ được chiêu mộ.
const introSteps=['story','summon','done'];
export const introPending=p=>!!p.intro&&p.intro!=='done';
function introStep(p,input){
 const step=input?.step,from=introSteps.indexOf(p.intro??'done'),to=introSteps.indexOf(step);
 requireCondition(to>=0,'Bước mở đầu không hợp lệ.');
 if(to<=from)return{message:'',intro:p.intro};
 requireCondition(step!=='done'||p.hero,'Hãy chiêu mộ thuyền viên đầu tiên trước.',409,'NO_HERO');
 p.intro=step;if(step==='done')p.tutorial??={core:0,tips:[]};return{message:'',intro:step};
}
// Hướng dẫn sau phần mở đầu (TutorialManager gốc): chuỗi chính tutorialCore bước, đi lần lượt; mẹo mở tính năng ghi theo id.
// Client giữ nội dung từng bước (tutorial-ui.js); server chỉ lưu tiến độ để tải lại trang vẫn đúng bước.
export const tutorialCore=13;
export const tutorialTips=['pet','arena','raid','guild','tower','tth','event','checkin','achievement','mission','forge','lucky','shop','summon','bag','mail'];
function tutorialStep(p,input){
 const t=p.tutorial;requireCondition(t,'Tài khoản không có hướng dẫn.');
 if(input?.skip===true){t.core=tutorialCore;t.tips=[...tutorialTips];return{message:'Đã bỏ qua hướng dẫn.',tutorial:t}}
 if(input?.tip!==undefined){requireCondition(tutorialTips.includes(input.tip),'Mẹo hướng dẫn không hợp lệ.');if(!t.tips.includes(input.tip))t.tips.push(input.tip);return{message:'',tutorial:t}}
 const index=Number(input?.index);requireCondition(Number.isInteger(index)&&index>=0&&index<tutorialCore,'Bước hướng dẫn không hợp lệ.');
 if(index===t.core)t.core++;return{message:'',tutorial:t};
}
// Chưa có tướng: chỉ gửi phần cần cho phần mở đầu và màn chiêu mộ.
function introView(state){
 return{...state,hero:null,heroes:[],formation:{version:2,slots:Array(6).fill(null)},costs:null,mail:state.mail||[],events:[],
  afk:null,tower:null,albumState:null,achievements:null,homeQuest:null,devilFruit:null,pets:null,silentRing:null,mastery:null,abyss:null,dailyQuest:null,arena:null,tth:null,guild:null,activity:[]};
}
export function playerView(player,now=Date.now()){if(!player.hero){ensureRoster(player);return baseView(player,now)}return{...baseView(player,now),events:eventsView(player,now),checkin:checkinView(player,now)}}
function baseView(player,now){ensureRoster(player);const {receipts,activity,reserveHeroes,...state}=player;if(!state.hero)return introView(state);const view=h=>({...h,skills:heroLevels(h),skillDetails:Object.fromEntries(heroSkills(h).map(s=>[s.id,heroTier(h,s.id)])),name:definitionFor(h.id).name,stats:heroStats({...player,hero:h}),special:specialView(h),germa:germaView(h,definitionFor(h.id).avatar),haki:hakiView(h),talent:talentView(h),exc:excView(h,definitionFor(h.id).avatar),starLabel:starLabel(h.stars)});return{...state,inventory:{...state.inventory,...(state.wallet.spirit>0?{[heroExpItem]:state.wallet.spirit}:{})},formation:formationView(player),hero:view(state.hero),heroes:[state.hero,...Object.values(reserveHeroes)].map(view),costs:upgradeCosts(player),ships:shipView(player),afk:afkView(player,now),tower:towerView(player,now),albumState:albumView(player),achievements:achievementView(player),homeQuest:homeQuestView(player),devilFruit:devilFruitView(player),pets:petView(player,now),silentRing:srView(player,now),mastery:masteryView(player),abyss:abyssView(player,now),dailyQuest:dailyQuestView(player,now),arena:arenaView(player,now),tth:tthView(player,now),guild:guildView(player,now),activity:activity.slice(-20).reverse()}}
function addItem(p,id,qty){requireCondition(itemById.has(id),'Vật phẩm không tồn tại.');if(id===heroExpItem){p.wallet.spirit=(p.wallet.spirit||0)+qty;requireCondition(p.wallet.spirit>=0,'Không đủ Đá EXP.');return}p.inventory[id]=(p.inventory[id]||0)+qty;requireCondition(p.inventory[id]>=0,'Không đủ vật phẩm.')}
function spend(p,cost){for(const [currency,amount] of Object.entries(cost)){requireCondition(Number.isSafeInteger(amount)&&amount>=0,'Chi phí không hợp lệ.');requireCondition((p.wallet[currency]||0)>=amount,`Không đủ ${({gold:'vàng',diamonds:'kim cương',spirit:'EXP tướng'})[currency]||currency}.`,400,'INSUFFICIENT_FUNDS');p.wallet[currency]-=amount;if(currency==='diamonds')trackEvent(p,'diamondSpend',amount)}}
function spendItems(p,cost={}){for(const [id,amount] of Object.entries(cost)){requireCondition((id===heroExpItem?p.wallet.spirit:p.inventory[id]||0)>=amount,`Không đủ ${itemById.get(id)?.name||'vật phẩm'}.`);addItem(p,id,-amount)}}
const walletIds=new Set(['gold','diamonds','spirit']);
export const isRewardId=id=>walletIds.has(id)||itemById.has(id);
export function grantReward(p,{itemId,quantity}){if(walletIds.has(itemId))p.wallet[itemId]=(p.wallet[itemId]||0)+quantity;else addItem(p,itemId,quantity)}
function payReward(p,{itemId,quantity}){if(walletIds.has(itemId))spend(p,{[itemId]:quantity});else spendItems(p,{[itemId]:quantity})}
function outsideBattle(p){requireCondition(!p.battle||p.battle.status!=='active','Hãy kết thúc trận chiến trước.',409,'BATTLE_ACTIVE')}
export const maxAccountLevel=100;
export function accountExp(p,amount){p.account.exp+=amount;while(p.account.level<maxAccountLevel&&p.account.exp>=p.account.level*100){p.account.exp-=p.account.level*100;p.account.level++;const rewards=levelRewards(p.account.level);for(const r of rewards)grantReward(p,r);noteLevelUp(p,p.account.level,rewards)}}
// ---- Hạm đội (guild.mjs): phần nằm trong player — kỹ năng, điểm danh, cống hiến, lượt đánh boss. Hạm đội chung ở Store.
function guildDaily(p,now){const g=guildState(p),day=vnDay(now);if(g.day!==day){g.day=day;g.rollCall=false;g.donated=0;g.bossUsed=0;g.bossBought=0}return g}
function guildView(p,now){
 const g=p.guild||{},fresh=g.day!==vnDay(now);
 return{id:g.id||null,rollCall:fresh?false:!!g.rollCall,donated:fresh?0:g.donated||0,donateLimit,donations,bossLeft:bossFreeAttacks+(fresh?0:g.bossBought||0)-(fresh?0:g.bossUsed||0),bossFree:bossFreeAttacks,bossBuyPrice,bossBuyLeft:bossBuyLimit-(fresh?0:g.bossBought||0),
  tech:techView(p),coin:p.inventory[guildCoin]||0,createCost,createLevel};
}
function guildAction(p,action,input,now,context){
 const g=guildDaily(p,now);
 if(action==='guild-create'){
  outsideBattle(p);requireCondition(!g.id,'Bạn đang trong bang khác',409,'IN_GUILD');requireCondition(p.account.level>=createLevel,`Cần thuyền trưởng cấp ${createLevel}.`,403,'LEVEL_REQUIRED');
  const name=validName(input.name),flag=Number(input.flag);requireCondition(Number.isInteger(flag)&&flag>=1&&flag<=guildData.flags.length,'Cờ đội không hợp lệ.');
  requireCondition(context?.guildId,'Không thể lập hạm đội.',409);spend(p,{diamonds:createCost});g.id=context.guildId;
  return{message:`Đã lập hạm đội ${name}.`,guild:{id:g.id,name,flag}};
 }
 requireCondition(g.id&&context?.guild?.id===g.id,'Hãy tạo hoặc gia nhập hạm đội',409,'NO_GUILD');
 if(action==='guild-rollcall'){
  requireCondition(!g.rollCall,'Hôm nay đã điểm danh.',409,'ROLLCALL_DONE');g.rollCall=true;p.wallet.gold+=rollCall.gold;addItem(p,guildCoin,rollCall.coin);
  return{message:'Điểm danh thành công.',guildExp:rollCall.guildExp,rewards:[{itemId:'gold',quantity:rollCall.gold},{itemId:guildCoin,quantity:rollCall.coin},{itemId:'consumable:23',quantity:rollCall.guildExp}]};
 }
 if(action==='guild-donate'){
  const d=donations[Number(input.tier)];requireCondition(d,'Mức cống hiến không hợp lệ.');requireCondition(g.donated<donateLimit,'Hôm nay đã hết lượt cống hiến.',409,'DONATE_LIMIT');
  spend(p,{gold:d.gold});addItem(p,guildCoin,d.coin);g.donated++;
  return{message:`Cống hiến ${d.gold.toLocaleString('vi-VN')} beli.`,guildExp:d.guildExp,dedication:d.gold,rewards:[{itemId:guildCoin,quantity:d.coin},{itemId:'consumable:23',quantity:d.guildExp}]};
 }
 if(action==='guild-tech'){outsideBattle(p);return techAction(p,input,{pay:(gold,coin)=>{spend(p,{gold});spendItems(p,{[guildCoin]:coin})},refund:(gold,coin)=>{p.wallet.gold+=gold;if(coin)addItem(p,guildCoin,coin)},spendDiamonds:n=>spend(p,{diamonds:n}),guildLevel:context.guild.level})}
 if(action==='guild-boss-buy'){requireCondition(g.bossBought<bossBuyLimit,'Đã hết lượt mua hôm nay.',409,'BUY_LIMIT');spend(p,{diamonds:bossBuyPrice});g.bossBought++;return{message:'Đã mua 1 lượt đánh boss.'}}
 if(action==='guild-boss'){
  outsideBattle(p);const boss=context.guild.boss;requireCondition(boss&&boss.hp.some(v=>v>0),'Boss đã bị hạ.',409,'BOSS_DEAD');
  requireCondition(g.bossUsed<bossFreeAttacks+g.bossBought,'Đã hết lượt đánh. Hãy mua thêm.',409,'NO_ATTACKS');g.bossUsed++;
  const stage=stageData(boss.stage),teamFormation=validateFormation(p,input.formation??formationView(p).slots),saved=p.formation;
  const foes=stage.monsters.map((m,i)=>{const u=bossMonster(m,i),kit=kitForAvatar(m.avatar);u.hp=Math.max(0,Math.min(u.maxHp,boss.hp[i]??u.maxHp));return kit?{...u,kit,ultScale:1}:u}).filter(u=>u.hp>0);
  p.wallet.gold+=stage.gold;addItem(p,guildCoin,stage.guildCoin);
  openBattle(p,foes,{chapter:1+(boss.stage-1)%12,stageId:null,guildBoss:{guildId:g.id,stage:boss.stage,rounds:bossRounds,start:Object.fromEntries(foes.map(u=>[u.id,u.hp])),reward:{gold:stage.gold,coin:stage.guildCoin,guildExp:stage.guildExp}}},teamFormation,saved?.position??0,now);
  if(saved)p.formation=saved;else delete p.formation;
  // Ô đứng gốc 1-6 của quái: 1-3 hàng sau, 4-6 hàng trước của phe địch (như Chiến dịch).
  for(const e of p.battle.enemies){e.frontRow=e.position>=4;if(e.kit)e.energy=35}
  if(input.skip===true)while(p.battle.status==='active')battleRound(p,{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},now);
  return{message:`Khiêu chiến Boss ải ${boss.stage}.`,battleId:p.battle.id,rewards:[{itemId:'gold',quantity:stage.gold},{itemId:guildCoin,quantity:stage.guildCoin}]};
 }
 if(action==='guild-leave'){outsideBattle(p);g.id=null;return{message:'Đã rời hạm đội.'}}
 throw new GameError('Thao tác không tồn tại.',404);
}
/** Sát thương đã gây cho từng quái của boss hạm đội trong trận vừa xong. */
export function guildBossDamage(b){const start=b.guildBoss.start||{};return b.enemies.map(e=>({id:e.id,index:Number(String(e.id).replace('boss-','')),damage:Math.max(0,(start[e.id]??e.maxHp)-Math.max(0,e.hp))}))}
// ---- Chiến trường: vé Giấy Thách Đấu (Đơn đấu / Liên đấu) và lượt đánh Võ đấu làm mới lúc 21:00 UTC mỗi ngày.
function arenaState(p,now){
 const a=p.arena??={};a.defense??={};a.attacks??={used:0,bought:0};const day=dayKey(now);
 if(a.day!==day){a.day=day;a.bought=0;a.attacks={used:0,bought:0};if((p.inventory[ticketItem]||0)<freeTickets)p.inventory[ticketItem]=freeTickets}
 return a;
}
function arenaView(p,now){
 const a=p.arena||{},fresh=a.day!==dayKey(now),tickets=fresh?Math.max(freeTickets,p.inventory[ticketItem]||0):p.inventory[ticketItem]||0;
 const attacks=fresh?{used:0,bought:0}:a.attacks||{used:0,bought:0};
 return{tickets,ticketPrice,ticketBuyLeft:ticketBuyLimit-(fresh?0:a.bought||0),attacksLeft:allstarAttacks+attacks.bought-attacks.used,attackPrice:allstarAttackPrice,attackBuyLeft:allstarBuyLimit-attacks.bought,
  defense:Object.fromEntries(Object.keys(arenaModes).map(mode=>[mode,arenaDefenseTeams(p,mode)])),betItem,betAmount};
}
const arenaMode=mode=>{requireCondition(Object.hasOwn(arenaModes,mode),'Chế độ không tồn tại.',404);return mode};
function arenaLevel(p,mode){const need=arenaModes[mode].minLevel;requireCondition(p.account.level>=need,`Yêu cầu người chơi cấp độ ${need} trở lên.`,403,'LEVEL_REQUIRED')}
/** Đội hình thủ đã lưu (Liên đấu 3 đội, các chế độ khác 1 đội); chưa lưu thì đội 1 là đội hình chính. Tướng không còn sở hữu bị bỏ. */
export function arenaDefenseTeams(p,mode){
 const owned=ownedHeroes(p),saved=p.arena?.defense?.[mode],used=new Set();
 return Array.from({length:arenaModes[mode].teams},(_,i)=>{const src=saved?.[i]??(i===0?formationView(p).slots:[]);return Array.from({length:6},(_,k)=>{const id=src[k]??null;if(!id||!owned.has(id)||used.has(id))return null;used.add(id);return id})});
}
const heroHead=(p,id,slot)=>{const h=ownedHeroes(p).get(id),d=definitionFor(id);return{slot,heroId:id,avatar:d.avatar,faction:d.faction,cls:d.class,level:h.level,stars:h.stars}};
/** Snapshot đội phòng thủ lưu trong bảng Chiến trường: đơn vị trận đấu đã tính sẵn + đầu tướng để hiển thị. */
export function arenaSnapshot(p,mode){
 const teams=arenaDefenseTeams(p,mode).map(slots=>{const units=teamUnits(p,slots);return{power:units.reduce((n,u)=>n+(u.power||0),0),heads:slots.map((id,slot)=>id&&heroHead(p,id,slot)).filter(Boolean),units}});
 return{displayName:p.displayName,avatar:definitionFor(p.hero.id).avatar,level:p.account.level,power:teams.reduce((n,t)=>n+t.power,0),teams};
}
function arenaAttackTeams(p,mode,input){
 const n=arenaModes[mode].teams,raw=input.teams??(input.formation?[input.formation]:null),used=new Set();
 if(!raw)return n===1?[formationView(p).slots]:arenaDefenseTeams(p,mode);
 requireCondition(Array.isArray(raw)&&raw.length===n,'Đội hình không hợp lệ.');
 return raw.map(slots=>{const f=validateFormation(p,slots);for(const id of f.slots)if(id){requireCondition(!used.has(id),'Mỗi tướng chỉ được ở một đội.',400,'DUPLICATE_HERO');used.add(id)}return f.slots});
}
function arenaAction(p,action,input,now,context){
 const a=arenaState(p,now);
 if(action==='arena-buy'){
  const count=integer(input.count??1,1,20,'Số lượng');
  if(input.kind==='attack'){requireCondition(a.attacks.bought+count<=allstarBuyLimit,'Đã hết lượt mua hôm nay.',409,'BUY_LIMIT');spend(p,{diamonds:allstarAttackPrice*count});a.attacks.bought+=count;return{message:`Đã mua ${count} lượt đánh.`}}
  requireCondition(a.bought+count<=ticketBuyLimit,'Đã hết lượt mua hôm nay.',409,'BUY_LIMIT');spend(p,{diamonds:ticketPrice*count});a.bought+=count;addItem(p,ticketItem,count);
  return{message:`Đã mua ${count} Giấy Thách Đấu.`,rewards:[{itemId:ticketItem,quantity:count}]};
 }
 if(action==='allstar-bet'){
  const bet=context?.bet;requireCondition(bet?.open,'Trận này không nhận cược.',409,'BET_CLOSED');requireCondition(['even','odd'].includes(input.pick),'Hãy chọn Chẵn hoặc Lẻ.');
  spendItems(p,{[betItem]:betAmount});return{message:'Bạn đã đặt cược thành công',bet:{matchId:bet.matchId,pick:input.pick,amount:betAmount}};
 }
 const mode=arenaMode(input.mode);arenaLevel(p,mode);
 if(action==='arena-defense'){
  outsideBattle(p);requireCondition(Array.isArray(input.teams)&&input.teams.length===arenaModes[mode].teams,'Đội hình không hợp lệ.');
  a.defense[mode]=arenaAttackTeams(p,mode,{teams:input.teams});return{message:'Đã lưu đội hình thủ.'};
 }
 if(action==='arena-start'){
  outsideBattle(p);const ctx=context?.arena;requireCondition(ctx?.mode===mode&&ctx.opponent,'Đối thủ không hợp lệ.',409,'ARENA_RIVAL');
  const teams=arenaAttackTeams(p,mode,input),opp=ctx.opponent;
  if(mode==='allstars'){requireCondition(a.attacks.used<allstarAttacks+a.attacks.bought,'Đã hết lượt đánh. Hãy mua thêm.',409,'NO_ATTACKS');a.attacks.used++}
  else spendItems(p,{[ticketItem]:1});
  if(mode==='league'){
   const result=series(teams.map(slots=>teamUnits(p,slots)),opp.teams.map(t=>t.units),Math.floor(now%4294967295)||1);
   const bouts=result.bouts.map((r,i)=>({team:i+1,win:r.win,turns:r.turns}));
   return{message:result.win?'Chiến thắng!':'Thất bại.',arena:{mode,season:ctx.season,opponentId:opp.id,win:result.win,bouts,score:result.score,battleId:randomUUID()}};
  }
  const saved=p.formation;
  openBattle(p,asEnemies(opp.teams[0].units),{chapter:1,stageId:null,arena:{mode,season:ctx.season,opponentId:opp.id,name:opp.name,avatar:opp.avatar,level:opp.level,revenge:!!input.revenge}},{version:2,slots:teams[0]},saved?.position??0,now);
  if(saved)p.formation=saved;else delete p.formation;
  for(const e of p.battle.enemies){e.frontRow=e.position>=4;e.energy=e.heroId==='zoro-king-of-hell'?100:35}
  if(input.skip===true)while(p.battle.status==='active')battleRound(p,{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},now);
  return{message:`Khiêu chiến ${opp.name}.`,battleId:p.battle.id};
 }
 throw new GameError('Thao tác không tồn tại.',404);
}
export function applyAction(p,action,input,now=Date.now(),context){
 const beastActive=!!p.battle?.beast&&p.battle.status==='active',result=runAction(p,action,input,now,context);
 trackDaily(p,{action,input,beastWon:beastActive&&p.battle?.status==='won'},now);return result;
}
function runAction(p,action,input,now,context){
 ensureRoster(p);startAfk(p,now);startSummon(p);if(p.hero?.id==='luffy-gear-2')ensureLuffySkills(p);
 if(action==='intro')return introStep(p,input);
 if(action==='tutorial')return tutorialStep(p,input);
 if(p.hero)shipGift(p);
 if(action==='ship'){outsideBattle(p);requireCondition(p.account.level>=shipLevel,`Chiến hạm mở ở cấp ${shipLevel}.`);const r=shipAction(p,input,cost=>payShip(p,cost));if(r.refund){for(const [k,id] of [['soul',shipItems.soul],['wood',shipItems.wood]])if(r.refund[k])addItem(p,id,r.refund[k])}return r}
 requireCondition(p.hero||action==='summon','Hãy chiêu mộ thuyền viên đầu tiên trước.',409,'NO_HERO');
 if(action.startsWith('arena-')||action==='allstar-bet')return arenaAction(p,action,input,now,context);
 if(action.startsWith('guild-'))return guildAction(p,action,input,now,context);
 if(action==='raid-buy'){outsideBattle(p);requireCondition(context?.raid,'Chưa tải cấu hình Chiến dịch.',503);return raidBuy(p,input,context.raid,n=>spend(p,{diamonds:n}),now)}
 if(action==='raid-smash'){outsideBattle(p);requireCondition(context?.raid,'Chưa tải cấu hình Chiến dịch.',503);return raidSmash(p,input,context.raid,reward=>grantReward(p,reward),now)}
 if(action==='raid-start'){
  // Chiến dịch: đội địch 3-6 tướng có bộ kỹ năng, chia đều lực chiến của mức; thưởng lấy từ cấu hình lúc bắt đầu trận.
  outsideBattle(p);requireCondition(context?.raid,'Chưa tải cấu hình Chiến dịch.',503);
  const {mode,index,level}=raidPrepare(p,input,context.raid,now),teamFormation=validateFormation(p,input.formation??formationView(p).slots),saved=p.formation;
  const count=Math.min(6,3+Math.floor((index-1)/3)),stats=raidEnemyStats(level.power,count),pool=heroDefinitions.filter(d=>heroKits.has(d.id)&&d.id!=='luffy-gear-2'&&d.id!=='zoro-king-of-hell');
  const seed=[...mode].reduce((n,c)=>n*31+c.charCodeAt(0),index*7919),slots=[4,5,1,2,3,6];
  const foes=Array.from({length:count},(_,i)=>{const d=pool[(seed+i*37)%pool.length],heroId=d.id;return{id:'enemy-'+i,name:d.name,avatar:d.avatar,faction:d.faction,heroClass:d.class==='fighter'?'warrior':d.class,level:Math.min(600,20+index*15),stars:Math.min(14,2+index),position:slots[i],
   maxHp:stats.maxHp,hp:stats.maxHp,attack:stats.attack,defense:stats.defense,speed:90+index*8,visualIndex:i,heroId,kit:heroKits.get(heroId),ultScale:1}});
  openBattle(p,foes,{chapter:1+(index-1)%12,stageId:null,raid:{mode,index,name:raidModes[mode].title,day:raidDay(now),rewards:level.rewards}},teamFormation,saved?.position??0,now);
  if(saved)p.formation=saved;else delete p.formation;
  for(const e of p.battle.enemies){e.frontRow=e.position>=4;e.energy=35}
  if(input.skip===true)while(p.battle.status==='active')battleRound(p,{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},now);
  return{message:`Khiêu chiến ${raidModes[mode].title} mức ${index}.`,battleId:p.battle.id};
 }
 if(action==='tth-buy'){outsideBattle(p);return tthBuy(p,now,n=>spend(p,{diamonds:n}))}
 if(action==='tth-attack'){
  // Tân Tứ Hoàng: boss của ngày (kỹ năng gốc của tướng qua bộ kỹ năng đọc từ mô tả), không chết, đánh hết battleRounds hiệp.
  outsideBattle(p);const day=tthDay(now),teamFormation=validateFormation(p,input.formation??formationView(p).slots),saved=p.formation;tthSpend(p,now);
  const b=bossOfDay(day),unit=bossUnit(day),kit=kitForAvatar(b.avatar),heroId='hero-'+b.avatar,definition=heroKits.has(heroId)?definitionFor(heroId):null;
  openBattle(p,[kit?{...unit,heroId,kit,ultScale:1,...(definition?.ultimate?{ultimate:definition.ultimate}:{})}:unit],{chapter:1+(day-1)%12,stageId:null,tth:{day,bossIndex:b.index,name:b.name,rounds:tthRounds}},teamFormation,saved?.position??0,now);
  if(saved)p.formation=saved;else delete p.formation;
  for(const e of p.battle.enemies){e.frontRow=true;if(e.kit)e.energy=35}
  if(input.skip===true)while(p.battle.status==='active')battleRound(p,{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},now);
  return{message:`Khiêu chiến ${b.name}.`,battleId:p.battle.id};
 }
 if(action==='formation-save'){outsideBattle(p);p.formation=validateFormation(p,input.slots);return{message:'Đã lưu đội hình.'}}
 if(action==='hero-select'){
  outsideBattle(p);requireCondition(typeof input.heroId==='string','Tướng không hợp lệ.');
  if(p.hero.id===input.heroId)return{message:'Đã chọn tướng này.'};
  const next=p.reserveHeroes[input.heroId];requireCondition(next,'Bạn chưa sở hữu tướng này.',404);
  p.reserveHeroes[p.hero.id]=p.hero;delete p.reserveHeroes[input.heroId];p.hero=next;p.battle=null;
  return{message:`Đã chọn ${definitionFor(next.id).name}.`};
 }
 if(action==='profile-update'){const op=input.op||'rename';return profileAction(p,{...input,op},{owned:ownedHeroes(p),pay:n=>spend(p,{diamonds:n})})}
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
  else if(type==='skill')throw new GameError('Kỹ năng tự động nâng cấp khi thức tỉnh tướng (sao tím cấp 2, sao đỏ cấp 3).',409,'SKILL_AUTO');
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
 if(action==='haki-pick'){outsideBattle(p);return pickHaki(p.hero,input)}
 if(action==='exc'){outsideBattle(p);const h=p.hero;return excAction(h,definitionFor(h.id).avatar,input,{pay:cost=>{const {gold=0,diamonds=0,...items}=cost;if(gold||diamonds)spend(p,{gold,diamonds});spendItems(p,items)},grant:rewards=>{for(const r of rewards)grantReward(p,r)},spendDiamonds:n=>spend(p,{diamonds:n})})}
 if(action==='talent'){outsideBattle(p);const h=p.hero;return talentAction(h,input,{pay:cost=>spendItems(p,cost),grant:rewards=>{for(const r of rewards)addItem(p,r.itemId,r.quantity)},spendDiamonds:n=>spend(p,{diamonds:n}),shard:shardFor(h)})}
 if(action==='artifact-upgrade'){outsideBattle(p);return upgradeArtifact(p,input,{spend:spendItems,add:addItem})}
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
  // Chiến hạm đã mở: rương treo máy có thêm Hồn chiến hạm (10 / giờ) và Đá hỗn độn (4 / giờ).
  if(p.account.level>=shipLevel){const soul=Math.floor(payout.seconds/360),chaos=Math.floor(payout.seconds/900);if(soul){addItem(p,shipItems.soul,soul);items.push({itemId:shipItems.soul,quantity:soul})}if(chaos){addItem(p,shipItems.chaos,chaos);items.push({itemId:shipItems.chaos,quantity:chaos})}}
  return{message:`Đã nhận ${amount(payout.gold)} vàng, ${amount(payout.accountExp)} kinh nghiệm${payout.stones?`, ${amount(payout.stones)} Đá EXP`:''}.`,reward:{gold:payout.gold,accountExp:payout.accountExp,items,seconds:payout.seconds},rewards:[{itemId:'gold',quantity:payout.gold},{itemId:'consumable:1002',quantity:payout.accountExp},...items].filter(r=>r.quantity>0)};
 }
 if(action==='battle-leave'){requireCondition(p.battle?.status==='active','Không có trận chiến đang diễn ra.');if(p.battle.silent){p.battle.status='won';srFinish(p,p.battle,reward=>grantReward(p,reward),now);return{message:'Đã rút lui. Sát thương vẫn được tính.'}}if(p.battle.beast){p.battle.status='won';finishBeast(p,p.battle);recordBossBattle(p,p.battle);return{message:'Đã rút lui. Sát thương vẫn được tính.'}}if(p.battle.arena){p.battle.status='lost';return{message:'Đã rút lui. Trận đấu tính là thua.'}}if(p.battle.tth){p.battle.status='won';tthFinish(p,p.battle,reward=>grantReward(p,reward));return{message:'Đã rút lui. Sát thương vẫn được tính.'}}if(p.battle.guildBoss){p.battle.status='won';p.battle.reward={damage:guildBossDamage(p.battle).reduce((n,x)=>n+x.damage,0),...p.battle.guildBoss.reward};return{message:'Đã rút lui. Sát thương vẫn được tính.'}}p.battle.status='abandoned';return{message:'Đã rút lui. Không nhận thưởng.'}}
 throw new GameError('Thao tác không tồn tại.',404);
}
function enemyUnit(source,slot,i,strength){const maxHp=Math.round((240+strength*100)*(1+i*.13));return{id:'enemy-'+i,name:source.name,avatar:source.avatar,faction:source.faction,heroClass:source.class||null,level:source.level,stars:source.stars,monsterId:source.sourceId,position:slot.position,maxHp,hp:maxHp,attack:25+strength*15+i*8,defense:9+strength*4,speed:70+i*4,visualIndex:i}}
function scaledUltimate(ultimate,level){
 const scale=1+.1*(level-1),heal=ultimate.heal&&{...ultimate.heal,attack:ultimate.heal.attack*scale,maxHp:ultimate.heal.maxHp*scale};
 return{...ultimate,damage:ultimate.damage*scale,...(heal?{heal}:{})};
}
function openBattle(p,enemies,meta,teamFormation,position,now){
 const heroSnapshot=heroStats(p);p.formation={position};
 p.battle={id:randomUUID(),campaignVersion:1,...meta,status:'active',turn:1,seed:Math.floor(now%4294967295)||1,hero:{id:'hero',heroId:p.hero.id,name:definitionFor(p.hero.id).name,...heroSnapshot,hp:heroSnapshot.maxHp,position,frontRow:position<2,energy:p.hero.id==='zoro-king-of-hell'?100:35,cooldowns:{},skills:{...p.hero.skills,...heroLevels(p.hero)},...hakiUnit(p.hero,heroSnapshot)},enemies,events:[],createdAt:new Date(now).toISOString(),reward:null};
 if(!teamFormation)return;
 const allies=teamUnits(p,teamFormation.slots);
 p.formation=teamFormation;p.battle.combatVersion=2;p.battle.allies=allies;
 {const ship=shipForBattle(p,allies);if(ship)p.battle.ship=ship}
 for(const e of enemies){e.side='enemy';e.frontRow=e.position>=4;e.energy=0}
 // Hiệu ứng đội hình gốc (cùng hệ +Máu/+Công, mỗi hệ +Giảm ST hoặc +Miễn chống) cho cả hai phe.
 p.battle.aura={ally:applyAura(allies),enemy:applyAura(enemies.filter(e=>e.faction))};
 initializeTeamBattle(p.battle);
}
/** Đơn vị trận đấu của một đội hình 6 ô (chỉ số, Haki, Nộ, bộ kỹ năng + thú cưng + Thiên phú). Dùng cho trận thường và snapshot Chiến trường. */
export function teamUnits(p,slots){
 const owned=ownedHeroes(p),allies=[];
 slots.forEach((heroId,position)=>{if(!heroId||!owned.has(heroId))return;const h=owned.get(heroId),stats=heroStats({...p,hero:h}),definition=definitionFor(heroId);allies.push({id:allies.length?'ally-'+heroId:'hero',heroId,side:'ally',name:definition.name,faction:definition.faction,avatar:definition.avatar,heroClass:definition.class,level:h.level,stars:h.stars,...stats,...hakiUnit(h,stats),hp:stats.maxHp,energy:heroId==='zoro-king-of-hell'?100:35,position,frontRow:position<2,skills:heroLevels(h),cooldowns:{},...(definition.ultimate?{ultimate:definition.ultimates?{...definition.ultimates[(heroLevels(h)[definition.ultimate.id]||1)-1]}:scaledUltimate(definition.ultimate,heroLevels(h)[definition.ultimate.id])}:{}),...(heroKits.get(heroId)?{kit:withExcKit(withTalentKit(withPetKit(battleKit(h,definition)||heroKits.get(heroId),heroPet(p,heroId)),h),h),ultScale:1}:(talentPassives(h).length||withExcKit(null,h))?{kit:withExcKit(withTalentKit(null,h),h)}:{})})});
 return allies;
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
  else if(b.raid){if(!b.enemies.some(u=>u.hp>0)){b.status='won';raidFinish(p,b,reward=>grantReward(p,reward),now);event(b,events,{type:'victory',reward:b.reward})}else if(!b.allies.some(u=>u.hp>0)||b.turn>=40){b.status='lost';raidFinish(p,b,()=>{},now);event(b,events,{type:'defeat'})}else b.turn++}
  else if(b.tth){if(!b.allies.some(u=>u.hp>0)||b.turn>=b.tth.rounds){b.status='won';tthFinish(p,b,reward=>grantReward(p,reward));event(b,events,{type:'victory',reward:b.reward})}else b.turn++}
  else if(b.guildBoss){if(!b.allies.some(u=>u.hp>0)||!b.enemies.some(u=>u.hp>0)||b.turn>=b.guildBoss.rounds){b.status='won';b.reward={damage:guildBossDamage(b).reduce((n,x)=>n+x.damage,0),...b.guildBoss.reward};event(b,events,{type:'victory',reward:b.reward})}else b.turn++}
  else if(b.arena){if(!b.enemies.some(u=>u.hp>0)){b.status='won';event(b,events,{type:'victory',reward:null})}else if(!b.allies.some(u=>u.hp>0)||b.turn>=40){b.status='lost';event(b,events,{type:'defeat'})}else b.turn++}
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
