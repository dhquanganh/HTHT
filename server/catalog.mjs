import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {kitFromProfile,selectOf} from './skill-kit.mjs';
const read=name=>JSON.parse(readFileSync(fileURLToPath(new URL('../dist/'+name,import.meta.url)),'utf8'));
const imported=read('game-catalog.json');
const assets=read('assets.json');
export const visuals=read('game-visuals.json');
const key=name=>Object.entries(assets).find(([,a])=>a.name===name)?.[0];
export const iconByName=name=>assets[key(name)]?.src||null;
export const itemIcon=item=>assets[item?.assetKey]?.src||null;
const luffy=read('samples.json').find(x=>x.avatar==='109');
export const materials={xp:'material:training',star:'material:luffy-shard',rank:'consumable:2',skill:'material:skill-book'};
const custom=[
 {id:materials.xp,name:'Thịt nướng tiếp tế',category:'material',rarity:'green',assetKey:'e5ca3a347d2ce194883719d48c2f8548_2',effect:{heroExp:100},price:120},
 {id:materials.star,name:'Mảnh Luffy Gear 2',category:'material',rarity:'purple',assetKey:luffy.head,price:250},
 {id:'material:zoro-shard',name:'Mảnh Zoro King Of Hell',category:'material',rarity:'red',assetKey:'htth-zoro-head',price:250},
 {id:'material:rank-stone',name:'Đá đột phá',category:'material',rarity:'blue',assetKey:'a4bdf0315e33de14b931ed3c9ad68295_2',price:220},
 {id:materials.skill,name:'Sách kỹ năng',category:'material',rarity:'blue',assetKey:'359c2692dfb2682488a1d574407bbad6_2',price:180},
 {id:'supply:gold',name:'Rương vàng nhỏ',category:'consumable',rarity:'yellow',assetKey:key('icon_gold')||key('icon_guild_coin'),effect:{gold:2000},price:40,priceCurrency:'diamonds'},
];
const list=Array.isArray(imported)?imported:imported.items;
export const items=list.filter(x=>x.category!=='skill').map((x,i)=>({...x,assetKey:x.assetKey||x.asset,rarity:x.rarity||'green',price:x.price||80+(i%24)*25,priceCurrency:'gold'}));
for(const x of custom)items.push(x);
export const equipmentData=read('equipment.json');
for(const item of items){
 const row=equipmentData.items[item.id];if(!row)continue;
 const base=row.points.find(group=>!group.clazz)?.point||[];
 Object.assign(item,row,{rarityRank:row.tier,stats:Object.fromEntries(base.filter(([id])=>id===0||id===2).map(([id,value])=>[id===0?'attack':'maxHp',value]))});
 item.price=row.sellPrice*4;item.noShop=row.tier>2||!!row.forge;
}
// Vật phẩm từ bảng cache mới hơn: có tên và ảnh gốc nhưng chưa có công dụng, nên không vào Cửa hàng và không bán lại.
for(const x of read('items-extra.json'))items.push({...x,extra:true,noShop:true,price:1000,priceCurrency:'gold'});
// Bảo vật theo db_item_baovat (tools/export-artifacts.py): bậc = quality 1-6 cùng thang màu trang bị, chỉ số cộng thêm
// là dòng effect của cấp hiện tại (vật phẩm trong túi là cấp 1); dòng có faction/clazz chỉ tính khi tướng đúng hệ/nghề.
export const artifactData=read('artifacts.json');
const artifactRarity={1:'gray',2:'green',3:'blue',4:'purple',5:'yellow',6:'red'};
Object.assign(equipmentData.points,artifactData.points);
for(const item of items){
 const row=artifactData.items[item.id];if(item.category!=='artifact'||!row)continue;
 const level=1,points=row.levels[level-1]||[],base=points.find(g=>!g.faction&&!g.clazz)?.point||[];
 Object.assign(item,{tier:row.quality,rarity:artifactRarity[row.quality],rarityRank:row.quality,stars:level,points,levels:row.levels,released:row.release,
  stats:Object.fromEntries(base.filter(([id])=>id===0||id===2).map(([id,value])=>[id===0?'attack':'maxHp',value])),
  sellPrice:row.sellPrices[level-1]||item.sellPrice||1,price:(row.sellPrices[level-1]||250)*4,priceCurrency:'gold',noShop:item.noShop||row.quality>2});
}
export const heroExpItem='consumable:1';
const effects={'consumable:57':{heroExp:100},'consumable:1000':{diamonds:10},'consumable:1001':{gold:1000},'consumable:1002':{accountExp:80}};
// Rương chọn tướng: giá tự sinh quá rẻ so với một tướng SS nên không bán ở Cửa hàng.
const heroChoices={'consumable:53':{rank:6,factions:['abyss','fortress','forest','shadow']},'consumable:54':{rank:6,factions:['dark','light']}};
for(const item of items){
 if(effects[item.id])item.effect=effects[item.id];
 // Đá EXP chính là quỹ EXP tướng (lá xanh trên thanh tiền): túi đồ và thanh tiền cùng một số.
 if(item.id===heroExpItem){item.wallet='spirit';item.description='Dùng để nâng cấp độ Thuyền Viên. Số lượng chính là EXP tướng ở thanh tiền.'}
 if(item.id==='consumable:1000'){item.price=15;item.priceCurrency='diamonds'}
 if(item.id==='consumable:1001'){item.price=30;item.priceCurrency='diamonds'}
 if(item.id==='consumable:16'){item.price=100;item.priceCurrency='diamonds'}
 if(heroChoices[item.id]){item.choice=heroChoices[item.id];item.noShop=true}
 if(!equipmentData.items[item.id]&&!artifactData.items[item.id])item.sellPrice=Math.max(1,Math.floor(item.price*(item.priceCurrency==='diamonds'?2:.25)));
}
export const chestData=read('chests.json');
// Rương mở được nên giá tự sinh trở thành lỗ hổng: khóa mua bán như các món giá trị khác.
for(const item of items)if(chestData[item.id]){item.chest=chestData[item.id].mode;item.noShop=true}
export const itemById=new Map(items.map(x=>[x.id,x]));
export const equipmentSlots=['pants','armor','boots','helmet','accessory'];
export const skills=read('luffy-skills.json');
export const heroDefinition={id:'luffy-gear-2',name:'Luffy Gear 2',avatar:'109',faction:'abyss',class:'fighter',visual:luffy,skills};
export const zoroDefinition=read('zoro-king-of-hell.json');
export const heroDefinitions=[heroDefinition,zoroDefinition];
export const heroAlbum=read('hero-album.json');
export const definitionFor=id=>heroDefinitions.find(h=>h.id===id)||heroDefinition;
export const legacyStages=Array.from({length:12},(_,i)=>({
 id:i+1,chapter:1+Math.floor(i/4),name:['Bến cảng khởi hành','Con đường hải tặc','Đảo hải quân','Thử thách thuyền trưởng','Biển Đông','Thị trấn cảng','Đảo bão tố','Pháo đài hải quân','Đại hải trình','Bến tàu cuối trời','Vùng biển lửa','Trận chiến tự do'][i],
 description:i===0?'Đánh bại lính canh để bắt đầu chuyến hải trình.':`Vượt qua đội canh gác cấp ${i+1}, mở khóa chặng tiếp theo.`,
 recommendedPower:120+i*90,backgroundIndex:i,enemyCount:Math.min(3,1+Math.floor(i/3)),
 rewards:{gold:320+i*110,diamonds:5+Math.floor(i/3),accountExp:40+i*15,heroExp:65+i*20},
 firstClear:{diamonds:20+i*5,starShards:3},
}));
const campaignSource=read('campaign.json');
export const stages=campaignSource.stages;
const {stages:sourceStages,warnings:campaignWarnings,...campaignMetadata}=campaignSource;
export const campaign=campaignMetadata;
export const economy={initialGold:12000,initialDiamonds:500,dailyGold:1500,dailyDiamonds:50,maxHeroLevel:60,maxStars:19,maxRank:5,maxSkillLevel:3,afk:{tickSeconds:5,maxSeconds:36000,minClaimSeconds:60,overflowSeconds:3600,stoneItem:'consumable:1'},tower:{turnsPerDay:5},summon:{item:'consumable:16',factions:['fortress','shadow','abyss','forest'],counts:[1,10],rates:[[6,3],[5,12],[4,35],[3,50]],startItems:10,duplicateShards:8}};
export const towerData=read('tower.json');
export const beastData=read('beast.json');
export const heroStoneData=read('hero-stones.json');
export const albumData=read('album.json'),abyssData=read('abyss.json'),mermaidData=read('mermaid.json');
const heroProfiles=read('hero-profiles.json'),heroVisuals={...campaign.visuals,...towerData.visuals,...read('hero-visuals.json')};
const beastVisuals=Object.fromEntries(beastData.bosses.map(boss=>[boss.avatar,boss.visual]));
// Quái Vành Đai Tĩnh Lặng (Giant Squid, Sea Cow, Lord of the Coast): spine chiến đấu từ tools/export-silentring.py.
const silentVisuals=Object.fromEntries(Object.values(read('silent-ring.json').units).map(u=>[u.avatar,u.visual]));
// Bản thử nghiệm dùng chung công thức chỉ số; bậc và lớp tạo khác biệt giữa các tướng.
const gradeNames={1:'D',2:'C',3:'B',4:'A',5:'S',6:'SS'},gradeScales={1:.65,2:.75,3:.85,4:1,5:1.1,6:1.25};
const classScales={warrior:{attack:.9,maxHp:1.2},mage:{attack:1.15,maxHp:.9},assassin:{attack:1.2,maxHp:.85},ranger:{attack:1.1,maxHp:.95},priest:{attack:.9,maxHp:1.05}};
// Tuyệt kỹ đọc từ mô tả gốc rồi nén về thang của bản thử nghiệm: số mục tiêu, cách chọn mục tiêu, % Công, số lần đánh, hồi máu và tăng Công.
// Các hiệu ứng khác trong mô tả (khiên, choáng, đốt...) chưa được mô phỏng.
// Bộ kỹ năng đầy đủ (Nộ + bị động) đọc từ mô tả gốc cho trận đấu; chỉ dùng ở server.
export const heroKits=new Map();
export const profileForAvatar=avatar=>heroProfiles[avatar]||null;
// Kẻ địch là tướng (Vực thẳm): dùng bộ kỹ năng theo avatar, kể cả avatar không triệu hồi được (109 Luffy - S).
const avatarKits=new Map();
export function kitForAvatar(avatar){if(heroKits.has('hero-'+avatar))return heroKits.get('hero-'+avatar);if(!avatarKits.has(avatar))avatarKits.set(avatar,heroProfiles[avatar]?.skills?.length?kitFromProfile(heroProfiles[avatar]):null);return avatarKits.get(avatar)}
export function ultimateFrom(skill,id){
 const text=skill.description,clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
 const number=pattern=>{const match=pattern.exec(text);return match?Number(match[1]):null};
 const damagePercent=number(/(?:sát thương|\bST\b)[^.;]{0,30}?\(?(\d+)\s*%\s*Công/i)??number(/\(?(\d+)\s*%\s*Công\)?[^.;]{0,14}(?:sát thương|\bST\b)/i);
 const repeats=number(/(\d+)\s*lần\s*(?:sát thương|\bST\b)/i)||1;
 // Cùng cách đọc mục tiêu với bộ kỹ năng trận đấu (toàn thể phe địch, hàng sau đội địch, N kẻ địch...).
 const targets=selectOf(text).count;
 const pick=/địch[^.;]{0,24}(máu|HP)\s*(hiện tại\s*)?thấp nhất/i.test(text)?'lowest':/địch[^.;]{0,24}Nộ cao nhất/i.test(text)?'rage':/ngẫu nhiên/i.test(text)?'random':/hàng sau/i.test(text)?'back':'front';
 const healAttack=number(/hồi[^.;]{0,36}?\(?(\d+)\s*%\s*Công/i),healLife=number(/hồi[^.;]{0,24}?(\d+)\s*%\s*Máu/i),healTeam=/hồi[^.;]{0,40}(toàn đội|toàn bộ đồng minh|tất cả đồng minh)|(toàn đội|toàn bộ đồng minh|tất cả đồng minh)[^.;]{0,30}hồi/i.test(text);
 const teamBuff=/tăng\s+toàn\s+đội[^.;]{0,30}?(\d+)\s*%\s*Công/i.exec(text),selfBuff=/(?:bản thân\s+tăng|tăng\s+bản thân)\s+(\d+)\s*%\s*Công/i.exec(text),buff=teamBuff||selfBuff;
 const ultimate={id,name:skill.name,targets:clamp(targets,1,6),pick,damage:damagePercent?clamp(damagePercent/100*repeats*.6,1.5,4):0};
 if(healAttack||healLife)ultimate.heal={attack:healAttack?clamp(healAttack/100,.5,3):0,maxHp:healAttack?0:clamp((healLife||0)/100,.05,.4),team:healTeam};
 if(buff)ultimate.buff={value:clamp(Number(buff[1])/100,.05,.6),team:!!teamBuff,duration:number(/duy trì\s*(\d+)/i)||2};
 if(!ultimate.damage&&!ultimate.heal&&!ultimate.buff)ultimate.damage=1.5;
 return ultimate;
}
for(const hero of heroAlbum.heroes){
 const visual=heroVisuals[hero.avatar],profile=heroProfiles[hero.avatar];
 if(heroDefinitions.some(h=>h.avatar===hero.avatar)||!visual?.skeleton||!visual.head||!profile)continue;
 const id='hero-'+hero.avatar,scale=gradeScales[hero.rank]||1,shape=classScales[hero.class]||{attack:1,maxHp:1};
 const skills=profile.skills.map((skill,i)=>({id:`${id}-${i}`,name:skill.name,assetKey:skill.icon,passive:skill.passive,energy:skill.passive?0:100,cooldown:0,animation:'skill',description:skill.description,levels:[{level:1,description:skill.description}]}));
heroKits.set(id,kitFromProfile(profile));
 heroDefinitions.push({id,name:hero.name,avatar:hero.avatar,faction:hero.faction,class:hero.class,grade:gradeNames[hero.rank],rank:hero.rank,visual:{card:hero.card,head:visual.head,art:profile.art,skeleton:visual.skeleton},skills,combat:{skills:(visual.combat?.skills||[]).map(s=>({animation:s.animation,delay_cast_eff:s.delay_cast_eff}))},statScale:{attack:scale*shape.attack,maxHp:scale*shape.maxHp},ultimate:ultimateFrom(profile.skills[0],skills[0].id)});
}
// Asset chỉ có mảnh chung; mảnh riêng theo hero_shard_id của db_tower. 50 mảnh ghép thành 1 tướng, như thẻ chọn tướng.
export const heroShardMerge=50;
for(const hero of heroDefinitions){
 if(!hero.id.startsWith('hero-'))continue;
 const item={id:'heroshard:'+hero.avatar,name:'Mảnh '+hero.name,category:'shard',rarity:'purple',assetKey:hero.visual.head,heroShard:hero.avatar,merge:heroShardMerge,description:`Đủ ${heroShardMerge} mảnh ghép thành ${hero.name}. Đã có tướng thì dùng để lên sao.`,noShop:true,price:1000,priceCurrency:'gold',sellPrice:1};
 items.push(item);itemById.set(item.id,item);
}
itemById.get('shard:30000').merge=50;
// Đá Cam dùng để lắp ngay Đá Cam 1 sao (db_hero_stone id 15) cho tướng đang chọn.
if(itemById.get('consumable:100045'))itemById.get('consumable:100045').description='Dùng để rút mảnh ghép ảnh ở Album, Đảo Người Cá. Nhận từ rương nhiệm vụ Vực thẳm.';
if(itemById.get('consumable:60004')){Object.assign(itemById.get('consumable:60004'),{stoneId:15,effect:{},description:'Lắp Đá Cam 1 sao vào ô Đá hộ mệnh của tướng đang chọn.'})}
// Beli và Đá EXP theo giờ: tính theo tốc độ rương tự động của ải cao nhất, như mô tả vật phẩm.
for(const [offset,kind] of [[60,'gold'],[66,'stone']])[2,5,8,12,24,72].forEach((hours,i)=>{const item=itemById.get('consumable:'+(offset+i));if(item){item.afk={kind,hours};item.effect={}}});
import {eventList,checkinRewards} from './events.mjs';
export function publicCatalog(){return{version:'0.5.0',hero:heroDefinition,heroes:heroDefinitions,album:heroAlbum,items,stages,campaign:{...campaign,visuals:{...campaign.visuals,...towerData.visuals,...beastVisuals,...silentVisuals}},economy,skills,equipmentSlots,visuals,beastUi:beastData.ui,heroStones:heroStoneData,albumData,abyssArt:abyssData,mermaid:mermaidData,events:eventList,checkinRewards,equipmentSets:equipmentData.sets,equipmentPoints:equipmentData.points}}
