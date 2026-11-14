// Ngọc Vega (bundle `gem`, GemMain). Dữ liệu nguyên từ db_set_name, db_debuff, db_material_number_require,
// db_config_open_boss và db_heroes "Boss … I-VI" (tools/export-gem.py). Luật theo client Lua gốc:
//   - GemPopupEquip: 6 ô ngọc mỗi tướng; chỉ tướng cấp ≥ 250, hạng SS trở lên; ngọc phải cùng nghề với tướng.
//   - GemPopupHeroGemInfo: đủ 6 viên cùng bộ thì kích chỉ số bộ (data_effect của db_set_name).
//   - GemPopupSummon: mỗi lần chế tạo cần 150 Vụn đá quý, 15000 Đá nâng đồ, 1000 Bụi ma thuật (db_material_number_require);
//     thêm Đá phẩm chất (loại 10) → phẩm chất tối thiểu, Thẻ nghề (loại 12) → đúng nghề, Thẻ bộ (loại 11) → đúng bộ.
//   - GemPopupInventory: bán ngọc chưa trang bị; "Chọn tất cả" chỉ chọn ngọc phẩm chất ≤ 3.
//   - Boss ngọc (GemPopupListBoss / GemPopupBossMain): 3 boss mở theo ngày (db_config_open_boss), mỗi boss 5 bậc +
//     bậc thử thách chọn tối đa 15 debuff (db_debuff), điểm debuff đổi mốc thưởng; tướng cấp ≥ 250 mới được ra trận.
// Phần server gốc không có trong client (chỉ số cơ bản của ngọc, tỉ lệ phẩm chất, thưởng boss, lượt/ngày, chỉ số boss
// theo bậc) là luật của bản web, ghi ở các hằng số dưới đây.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition,integer} from './errors.mjs';
import {kitFromProfile} from './skill-kit.mjs';
import {itemIcon} from './catalog.mjs';

const raw=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/gem.json',import.meta.url)),'utf8'));
export const gemSets=raw.sets,gemDebuffs=raw.debuffs,gemVisuals=raw.visuals;
const setById=new Map(gemSets.map(s=>[s.id,s])),debuffById=new Map(gemDebuffs.map(d=>[d.id,d]));
export const classes=['mage','warrior','priest','ranger','assassin'];// thứ tự Thẻ Ngọc 60011-60015 / clazz trang bị 1-5
export const classNames={mage:'Chỉ huy',warrior:'Đấu sĩ',priest:'Hỗ trợ',ranger:'Xạ thủ',assassin:'Kiếm sĩ'};
export const qualityNames=['','Trắng','Xanh Lục','Xanh Dương','Tím','Cam','Đỏ'];
export const heroMinLevel=250,heroMinRank=6,maxInventory=600,slots=6;
const item=id=>'consumable:'+id;
export const summonCost=raw.materials.map(m=>({itemId:item(m.item),quantity:m.amount}));
// Đá phẩm chất 60001-60005: "nhận được một viên đá quý có phẩm chất X trở lên" (Xanh Lục … Đỏ).
export const qualityStones={60001:2,60002:3,60003:4,60004:5,60005:6};
export const classCards={60011:'mage',60012:'warrior',60013:'priest',60014:'ranger',60015:'assassin'};
// Thẻ bộ 60101-60115 dùng khi chế tạo; 60116-60125 mở thẳng ra 1 viên ngọc của bộ (bộ không chế tạo được).
export const setCards=Object.fromEntries(gemSets.filter(s=>s.id<100).map(s=>[60100+s.id,s.id]));
export const openableCards=Object.fromEntries(gemSets.filter(s=>!s.material&&s.release).map(s=>[60100+s.id,s.id]));
// Bản web: tỉ lệ phẩm chất khi chế tạo (‰), số dòng chỉ số cơ bản và hệ số chỉ số theo phẩm chất, giá bán.
export const qualityWeights=[0,350,300,200,100,40,10];
const lineCount=[0,1,2,2,3,3,4],qualityScale=[0,1,1.5,2.2,3,4,5.5];
export const sellReward=q=>({itemId:item(60000),quantity:[0,5,10,20,40,80,150][q]});
const basePool=[[0,400],[1,150],[2,6000],[3,5],[100,30],[101,30],[102,30]];// [mã, giá trị phẩm chất 1] (mã % tính ‰)
export const ticketItem=item(333691);

// ---- Chữ hiển thị chỉ số (LuaGenPoints.getPointDesc): mã % ghi ‰ → chia 10.
const labels={0:'Công',1:'Thủ',2:'Máu',3:'Tốc độ',4:'Nộ',100:'Công',101:'Thủ',102:'Máu',103:'Tốc độ',8:'Chí mạng',9:'ST chí mạng',11:'Miễn chống',13:'ST chuẩn',
 40:'Kháng câm lặng',41:'Kháng hóa đá',42:'Kháng choáng',43:'Kháng đóng băng',58:'Giảm ST cháy, độc, đốt',72:'Hút máu',95:'Kháng xuyên thủ',99:'Xuyên miễn chống',
 1104:'Kháng chí mạng',1105:'Giới hạn giảm ST tối đa',1106:'Hồi nộ',1107:'ST DOT',29:'Bỏ qua né',1111:'Giảm ST trực tiếp',27:'Giới hạn giảm ST trực tiếp tối đa',1102:'Bỏ qua bất tử'};
const flatIds=new Set([0,1,2,3,4]);
export const pointText=(id,value)=>flatIds.has(id)?`${Math.round(value)} ${labels[id]||'?'}`:`${Math.round(value)/10}% ${labels[id]||'?'}`;

function state(p){
 p.gem??={nextId:1,gems:[],boss:{day:null,turns:{},killed:{},debuffs:{}}};
 const s=p.gem;s.gems??=[];s.nextId??=1;s.boss??={};s.boss.turns??={};s.boss.killed??={};s.boss.debuffs??={};
 return s;
}
const gemOrFail=(s,id)=>{const g=s.gems.find(x=>x.id===Number(id));requireCondition(g,'Ngọc không tồn tại.',404,'GEM_UNKNOWN');return g};
const pick=(random,list)=>list[Math.floor(random()*list.length)%list.length];
function rollQuality(random,min=1){
 const pool=qualityWeights.map((w,q)=>q>=min?w:0),total=pool.reduce((a,b)=>a+b,0);let x=random()*total;
 for(let q=1;q<pool.length;q++){x-=pool[q];if(x<0)return q}return 6;
}
/** Một viên ngọc mới: bộ, nghề, phẩm chất và các dòng chỉ số cơ bản (không trùng mã). */
export function makeGem(s,{set,clazz,quality},random=Math.random){
 const pool=[...basePool],base=[];
 for(let i=0;i<lineCount[quality];i++){const [id,v]=pool.splice(Math.floor(random()*pool.length)%pool.length,1)[0];base.push([id,Math.round(v*qualityScale[quality]*(.85+random()*.3))])}
 const g={id:s.nextId++,set,clazz,quality,base,hero:null,slot:0};s.gems.push(g);return g;
}
const gemView=g=>({...g,setName:setById.get(g.set)?.name,lines:g.base.map(([id,v])=>pointText(id,v)),setLines:(setById.get(g.set)?.points||[]).map(([id,v])=>pointText(id,v))});

// ---- Tướng
const heroClass=definition=>definition.class==='fighter'?'warrior':definition.class;
/** Điều kiện của GemPopupEquip.ListHeroByTabId: cấp ≥ 250 và hạng SS (Luffy Gear 2 của người chơi luôn đủ hạng). */
export const eligible=(hero,definition)=>!!hero&&!!definition&&hero.level>=heroMinLevel&&(definition.rank??heroMinRank)>=heroMinRank;
const equippedOn=(s,heroId)=>{const out=Array(slots).fill(null);for(const g of s.gems)if(g.hero===heroId&&g.slot>=1&&g.slot<=slots)out[g.slot-1]=g;return out};
/** Bộ đang kích (đủ 6 viên cùng bộ) của tướng. */
export function activeSet(s,heroId){const worn=equippedOn(s,heroId);if(worn.some(g=>!g))return null;const set=worn[0].set;return worn.every(g=>g.set===set)?setById.get(set):null}

export function gemsView(p){
 const s=state(p);const heroes={};
 for(const g of s.gems)if(g.hero){heroes[g.hero]??=Array(slots).fill(null);heroes[g.hero][g.slot-1]=g.id}
 const sets={};for(const id of Object.keys(heroes)){const set=activeSet(s,id);if(set)sets[id]=set.id}
 return{gems:s.gems.map(gemView),heroes,sets,max:maxInventory};
}
function validHero(p,heroId,{owned,definitionFor}){
 const h=owned.get(heroId);requireCondition(h,'Bạn chưa sở hữu tướng này.',404);
 const d=definitionFor(heroId);requireCondition(eligible(h,d),`Chỉ tướng cấp ${heroMinLevel} và hạng SS trở lên được khảm ngọc.`,409,'GEM_HERO');
 return{h,d,clazz:heroClass(d)};
}
export function equipGem(p,input,ctx){
 const s=state(p),{clazz}=validHero(p,input.heroId,ctx),g=gemOrFail(s,input.gemId),slot=integer(input.slot,1,slots,'Ô ngọc');
 requireCondition(g.clazz===clazz,`Ngọc này dành cho nghề ${classNames[g.clazz]}.`,409,'GEM_CLASS');
 requireCondition(!g.hero,'Ngọc đang được tướng khác trang bị.',409,'GEM_USED');
 const old=s.gems.find(x=>x.hero===input.heroId&&x.slot===slot);if(old){old.hero=null;old.slot=0}
 g.hero=input.heroId;g.slot=slot;
 return{message:'Đã khảm ngọc.',heroId:input.heroId};
}
/** Khảm tự động (GEM_AUTO_EQUIP): ưu tiên đủ 6 viên một bộ có tổng phẩm chất cao nhất, còn lại lấy 6 viên tốt nhất. */
export function autoEquip(p,input,ctx){
 const s=state(p),{clazz}=validHero(p,input.heroId,ctx);
 const pool=s.gems.filter(g=>g.clazz===clazz&&(!g.hero||g.hero===input.heroId)).sort((a,b)=>b.quality-a.quality||b.id-a.id);
 requireCondition(pool.length,'Không có ngọc phù hợp với nghề của tướng.',409,'GEM_NONE');
 const bySet=new Map();for(const g of pool){if(!bySet.has(g.set))bySet.set(g.set,[]);bySet.get(g.set).push(g)}
 let best=null,score=-1;for(const list of bySet.values())if(list.length>=slots){const v=list.slice(0,slots).reduce((n,g)=>n+g.quality,0);if(v>score){score=v;best=list.slice(0,slots)}}
 const chosen=best||pool.slice(0,slots);
 for(const g of s.gems)if(g.hero===input.heroId){g.hero=null;g.slot=0}
 chosen.forEach((g,i)=>{g.hero=input.heroId;g.slot=i+1});
 return{message:best?`Đã khảm đủ bộ ${setById.get(best[0].set).name}.`:'Đã khảm ngọc tốt nhất.',heroId:input.heroId};
}
export function unequipGems(p,input){
 const s=state(p),ids=Array.isArray(input.gemIds)?input.gemIds.map(Number):null;let n=0;
 for(const g of s.gems)if(g.hero===input.heroId&&(!ids||ids.includes(g.id))){g.hero=null;g.slot=0;n++}
 requireCondition(n,'Tướng chưa trang bị ngọc!',409,'GEM_EMPTY');
 return{message:`Đã tháo ${n} viên ngọc.`,heroId:input.heroId};
}
export function sellGems(p,input,grant){
 const s=state(p),ids=[...new Set((Array.isArray(input.gemIds)?input.gemIds:[]).map(Number))];requireCondition(ids.length&&ids.length<=maxInventory,'Hãy chọn ngọc để bán!');
 const list=ids.map(id=>gemOrFail(s,id));requireCondition(list.every(g=>!g.hero),'Không thể bán ngọc đang trang bị.',409,'GEM_USED');
 const total=list.reduce((n,g)=>n+sellReward(g.quality).quantity,0);s.gems=s.gems.filter(g=>!ids.includes(g.id));
 const reward={itemId:item(60000),quantity:total};grant(reward);
 return{message:`Đã bán ${list.length} viên ngọc.`,rewards:[reward]};
}
/** Chế tạo (GEM_SUMMON): count 1 | 10; materials = [đá phẩm chất, thẻ nghề, thẻ bộ] (0 = trống), mỗi viên tốn 1 cái. */
export function summonGems(p,input,{pay,random=Math.random}){
 const s=state(p),count=Number(input.count);requireCondition(count===1||count===10,'Số lượng chế tạo không hợp lệ.');
 requireCondition(s.gems.length+count<=maxInventory,`Túi ngọc tối đa ${maxInventory} viên.`,409,'GEM_FULL');
 const [stone,card,setCard]=(Array.isArray(input.materials)?input.materials:[]).map(Number);
 requireCondition(!stone||qualityStones[stone],'Nguyên liệu phẩm chất không hợp lệ.');requireCondition(!card||classCards[card],'Nguyên liệu nghề không hợp lệ.');
 requireCondition(!setCard||(setCards[setCard]&&setById.get(setCards[setCard]).material),'Nguyên liệu bộ không hợp lệ.');
 for(const c of summonCost)pay({itemId:c.itemId,quantity:c.quantity*count});
 for(const m of [stone,card,setCard])if(m)pay({itemId:item(m),quantity:count});
 const sets=gemSets.filter(x=>x.material&&x.release).map(x=>x.id),out=[];
 for(let i=0;i<count;i++)out.push(makeGem(s,{set:setCard?setCards[setCard]:pick(random,sets),clazz:card?classCards[card]:pick(random,classes),quality:rollQuality(random,stone?qualityStones[stone]:1)},random));
 return{message:`Nhận ${count} viên ngọc.`,gems:out.map(gemView)};
}
/** Thẻ bộ cao cấp (60116+): "Mở sẽ nhận được 1 ngọc": phẩm chất Đỏ, nghề ngẫu nhiên. */
export function openGemCard(p,itemId,quantity,{random=Math.random}={}){
 const s=state(p),set=openableCards[Number(String(itemId).replace('consumable:',''))];requireCondition(set,'Vật phẩm không mở được ngọc.',400);
 requireCondition(s.gems.length+quantity<=maxInventory,`Túi ngọc tối đa ${maxInventory} viên.`,409,'GEM_FULL');
 const out=Array.from({length:quantity},()=>makeGem(s,{set,clazz:pick(random,classes),quality:6},random));
 return{message:`Nhận ${quantity} ngọc ${setById.get(set).name}.`,gems:out.map(gemView)};
}

// ---- Chỉ số cộng cho tướng
// Mã trang bị đọc được (equipmentBonus): 0-4 cộng số, 100-103 / 11 / 13 / 40-43 theo tỉ lệ bảng điểm (= ‰);
// còn lại chuyển thẳng sang thuộc tính trận đấu (‰ / 1000) như mô tả bộ ("35% Crit" = 350).
const groupIds=new Set([0,1,2,3,4,100,101,102,103,11,13,40,41,42,43]);
const combatIds={8:'critChance',9:'critDamage',58:'dotReduction',72:'lifesteal',95:'penResist',99:'controlPierce',1104:'critResist',1105:'reductionCap',1106:'energyGain',1107:'dotDamage',29:'dodgePierce',1111:'damageReduction',27:'reductionCap',1102:'immortalPierce'};
export function gemBonus(p,hero,definition){
 const s=p.gem;if(!s?.gems?.length||!hero||!eligible(hero,definition))return{groups:[],combat:{}};
 const worn=s.gems.filter(g=>g.hero===hero.id),points=worn.flatMap(g=>g.base),set=activeSet(s,hero.id);
 if(set)points.push(...set.points);
 const groups=[],combat={};
 for(const [id,value] of points){
  if(groupIds.has(id))groups.push({clazz:0,faction:0,point:[[id,value]]});
  else if(combatIds[id])combat[combatIds[id]]=(combat[combatIds[id]]||0)+value/1000;
 }
 return{groups,combat};
}

// ---- Boss ngọc
const bossNames={1:'Douglas Bullet',2:'Wadatsumi',3:'Pica'};
const bossTiers={};// id boss → [bậc 1..6]
for(const b of Object.values(raw.bossHeroes)){const id=Number(Object.keys(bossNames).find(k=>bossNames[k]===b.boss));(bossTiers[id]??=[])[b.tier-1]=b}
export const gemBosses=raw.bosses.map(c=>({id:c.idCardBoss??c.id,days:c.days,name:bossNames[c.id],avatar:bossTiers[c.id][0].avatar,tiers:bossTiers[c.id]}));
// ---- Cấu hình Boss ngọc (trang quản trị, tab "Ngọc Vega"). Phần server gốc không có trong client nên mặc định là luật
// bản web: chỉ số boss = point gốc (db_heroes) × hệ số bậc; debuff có sẵn của bậc; thưởng {vật phẩm, số lượng, tỉ lệ ‰}.
const tierScale=[1,2.2,4.5,9,18,30],tierDebuffs=[0,1,3,14,32,0];
const tierRewards=[
 [[60000,40,1000],[2028,3000,1000],[60001,1,500],[60002,1,200]],
 [[60000,60,1000],[2028,5000,1000],[60002,1,500],[60003,1,150],[333691,1,100]],
 [[60000,90,1000],[3,300,1000],[60003,1,400],[60004,1,100],[60011,1,100],[60012,1,100]],
 [[60000,130,1000],[3,500,1000],[60004,1,300],[60005,1,50],[60013,1,100],[60014,1,100],[60015,1,100]],
 [[60000,180,1000],[3,800,1000],[60005,1,150],[60101,1,80],[60110,1,80],[60113,1,80],[60114,1,80]],
 [[60000,250,1000],[3,1000,1000]],
];
const milestoneSeed=[[5,[60004,1]],[10,[60005,1]],[20,[60116,1]],[30,[60120,1]],[40,[60121,1]],[55,[60122,1]],[70,[60125,1]],[90,[60123,1]]];
export function defaultGemConfig(){
 return{turns:3,rounds:20,maxDebuffs:15,
  bosses:gemBosses.map(b=>({id:b.id,days:[...b.days],tiers:b.tiers.map((t,i)=>({attack:Math.round(t.point.attack*tierScale[i]),defense:Math.round(t.point.defense*tierScale[i]),hp:Math.round(t.point.hp*tierScale[i]),
   speed:Math.round(t.point.speed*(1+(i+1)*.05)),level:250+i*50,debuff:tierDebuffs[i],rewards:tierRewards[i].map(([id,quantity,rate])=>({itemId:item(id),quantity,rate}))}))})),
  milestones:milestoneSeed.map(([point,[id,quantity]])=>({point,rewards:[{itemId:item(id),quantity}]}))};
}
let config=defaultGemConfig();
export const gemConfig=()=>config;
/** Áp cấu hình đã lưu (null = mặc định). Store gọi khi khởi động và sau khi quản trị lưu. */
export function applyGemConfig(c){config=c||defaultGemConfig();return config}
export function validateGemConfig(input,isRewardId){
 requireCondition(input&&typeof input==='object','Thiếu cấu hình.');
 const n=(v,label,min,max)=>integer(v,min,max,label);
 const rewards=(list,label,withRate)=>{requireCondition(Array.isArray(list)&&list.length<=12,`${label}: tối đa 12 phần thưởng.`);const seen=new Set();
  return list.map(r=>{requireCondition(typeof r?.itemId==='string'&&isRewardId(r.itemId),`${label}: vật phẩm không tồn tại.`,404);requireCondition(!seen.has(r.itemId),`${label}: trùng vật phẩm.`);seen.add(r.itemId);
   return{itemId:r.itemId,quantity:n(r.quantity,`${label}: số lượng`,1,1e12),...(withRate?{rate:n(r.rate,`${label}: tỉ lệ ‰`,1,1000)}:{})}})};
 requireCondition(Array.isArray(input.bosses)&&input.bosses.length===gemBosses.length,'Cần đủ 3 boss.');
 const bosses=gemBosses.map((b,bi)=>{const x=input.bosses[bi];requireCondition(x&&Number(x.id)===b.id,'Thứ tự boss không khớp.');
  const days=[...new Set((Array.isArray(x.days)?x.days:[]).map(Number))].sort();for(const d of days)requireCondition(Number.isInteger(d)&&d>=1&&d<=7,`${b.name}: ngày mở không hợp lệ.`);
  requireCondition(Array.isArray(x.tiers)&&x.tiers.length===6,`${b.name}: cần đủ 6 bậc.`);
  return{id:b.id,days,tiers:x.tiers.map((t,i)=>{const label=`${b.name} bậc ${i+1}`;requireCondition(!Number(t.debuff)||debuffById.get(Number(t.debuff)),`${label}: debuff không tồn tại.`,404);
   return{attack:n(t.attack,label+': Công',1,1e12),defense:n(t.defense,label+': Thủ',0,1e12),hp:n(t.hp,label+': Máu',1,1e14),speed:n(t.speed,label+': Tốc độ',1,1e6),level:n(t.level,label+': Cấp',1,10000),
    debuff:Number(t.debuff)||0,rewards:rewards(t.rewards,label,true)}})}});
 requireCondition(Array.isArray(input.milestones)&&input.milestones.length<=20,'Tối đa 20 mốc điểm debuff.');
 const milestones=input.milestones.map((m,i)=>{const r=rewards(m.rewards,`Mốc ${i+1}`,false);requireCondition(r.length,`Mốc ${i+1}: cần ít nhất 1 phần thưởng.`);return{point:n(m.point,`Mốc ${i+1}: điểm`,1,10000),rewards:r}}).sort((a,c)=>a.point-c.point);
 requireCondition(new Set(milestones.map(m=>m.point)).size===milestones.length,'Hai mốc trùng điểm.');
 return{turns:n(input.turns,'Lượt / ngày',0,100),rounds:n(input.rounds,'Số hiệp tối đa',1,60),maxDebuffs:n(input.maxDebuffs,'Số debuff tối đa',1,38),bosses,milestones};
}
const bossConf=id=>config.bosses.find(b=>b.id===id);
const vnDate=now=>new Date(now+7*3600000);
export const vnDayKey=now=>vnDate(now).toISOString().slice(0,10);
/** db_config_open_boss.dateOpen: 1 = Chủ nhật, 2..7 = Thứ hai..Thứ bảy. */
export const bossOpen=(boss,now)=>(bossConf(boss.id)?.days||boss.days).includes(vnDate(now).getUTCDay()+1);
const dayLabel=d=>d===1?'Chủ nhật':'Thứ '+d;
export const openText=boss=>{const days=bossConf(boss.id)?.days||boss.days;return days.length?'Mở vào '+[...days].sort((a,b)=>(a===1?8:a)-(b===1?8:b)).map(dayLabel).join(', '):'Tạm đóng'};
function bossState(p,now){
 const s=state(p),day=vnDayKey(now);
 if(s.boss.day!==day){s.boss.day=day;s.boss.turns={};s.boss.killed={}}
 return s.boss;
}
const bossOrFail=id=>{const b=gemBosses.find(x=>x.id===Number(id));requireCondition(b,'Boss không tồn tại.',404);return b};
export const turnsLeft=(st,bossId)=>st.turns[bossId]??config.turns;
const endOfDay=now=>{const d=vnDate(now);d.setUTCHours(24,0,0,0);return d.getTime()-7*3600000};
export const debuffPoints=ids=>ids.reduce((n,id)=>n+(debuffById.get(id)?.point||0),0);
export function gemBossView(p,now){
 const st=bossState(p,now);
 return gemBosses.map(b=>({id:b.id,name:b.name,avatar:b.avatar,open:bossOpen(b,now),text:openText(b),turns:turnsLeft(st,b.id),maxTurns:config.turns,maxDebuffs:config.maxDebuffs,endsAt:endOfDay(now),
  killed:st.killed[b.id]||[],debuffs:st.debuffs[b.id]||[],
  tiers:b.tiers.map((t,i)=>{const c=bossConf(b.id).tiers[i];return{tier:i+1,heroId:t.id,name:t.name,debuff:c.debuff,skills:t.skills,rewards:c.rewards}})}));
}
export const milestonesView=()=>config.milestones.map(m=>({point:m.point,reward:m.rewards[0],rewards:m.rewards}));
export function setBossDebuffs(p,input,now){
 const b=bossOrFail(input.bossId),st=bossState(p,now),ids=[...new Set((Array.isArray(input.debuffs)?input.debuffs:[]).map(Number))];
 requireCondition(ids.length<=config.maxDebuffs,`Chỉ có thể chọn tối đa ${config.maxDebuffs} debuff`,409);
 for(const id of ids)requireCondition(debuffById.get(id)?.release,'Debuff không tồn tại.',404);
 st.debuffs[b.id]=ids;return{message:`Đã chọn ${ids.length} debuff (${debuffPoints(ids)} điểm).`};
}

// ---- Debuff → hiệu ứng trận đấu (trigger của boss nhắm vào phe người chơi), theo skill_data / mô tả db_debuff.
// Ghi chú: "Phe ta" trong mô tả = đội người chơi = kẻ địch của boss.
const stat=(attr,value,turns)=>({type:'stat',attr,value,flat:false,turns,on:'enemies'});
const all={count:6,pick:'random',row:null};
const debuffEffects={
 1:[['battleStart',[stat('defense',-.15,2)]]],2:[['battleStart',[stat('defense',-.3,4)]]],
 3:[['battleStart',[stat('attack',-.15,2)]]],4:[['battleStart',[stat('attack',-.25,4)]]],
 5:[['battleStart',[stat('penetration',-.5,99)]]],6:[['battleStart',[stat('critChance',-.35,99)]]],
 7:[['battleStart',[stat('critDamage',-.35,4)]]],
 8:[['battleStart',[{type:'energy',value:-15,on:'target',select:all}]]],9:[['roundEnd',[{type:'energy',value:-15,on:'target',select:all}]]],
 10:[['battleStart',[stat('debuffResist',-.25,2)]]],
 11:[['roundStart',[{type:'status',kind:'silence',chance:1,turns:1,select:{count:2,pick:'random',row:null}}]]],
 12:[['roundStart',[{type:'hpLoss',maxHp:.08,select:all}]]],13:[['roundStart',[{type:'hpLoss',maxHp:.1,select:all}]]],
 14:[['battleStart',[stat('accuracy',-.35,4)]]],15:[['battleStart',[stat('attack',-.05,2),stat('skillDamage',-.1,2)]]],
 16:[['battleStart',[{type:'status',kind:'freeze',chance:.5,turns:1,select:all}]]],17:[['battleStart',[stat('block',-.2,2)]]],
 18:[['battleStart',[stat('skillDamage',-.4,4)]]],19:[['battleStart',[stat('skillDamage',-.7,99)]]],20:[['battleStart',[stat('trueDamage',-.35,4)]]],
 21:[['battleStart',[stat('healTaken',-2,3)]]],22:[['roundEnd',[{type:'hpLoss',attack:3,select:all}]]],
 23:[['battleStart',[stat('vulnerability',.5,2)]]],24:[['battleStart',[stat('energyGain',-.5,3)]]],
 25:[['battleStart',[{type:'status',kind:'panic',chance:1,turns:1,select:{count:3,pick:'front',row:'front'}}]]],
 26:[['allyUlt',[{type:'hpLoss',maxHp:.05,select:all}],'any']],
 27:[['enemyDeath',[stat('defense',-.25,99)]]],28:[['enemyDeath',[{type:'energy',value:-25,on:'target',select:all}]]],
 29:[['enemyDeath',[stat('attack',-.35,5)]]],30:[['enemyDeath',[{type:'status',kind:'stun',chance:.6,turns:2,select:all}]]],
 31:[['roundStart',[stat('attack',-.1,2),stat('block',-.15,2)]]],32:[['battleStart',[stat('defense',-.25,4),stat('attack',-.2,4)]]],
 33:[['battleStart',[stat('attack',-.25,99),stat('critDamage',-.35,99)]]],
 34:[['battleStart',[{...stat('defense',-.25,99),on:undefined,select:{count:6,pick:'front',row:'front'}},{...stat('block',-.35,99),on:undefined,select:{count:6,pick:'front',row:'front'}}]]],
 35:[['battleStart',[{...stat('attack',-.25,99),on:undefined,select:{count:6,pick:'back',row:'back'}},{...stat('accuracy',-.35,99),on:undefined,select:{count:6,pick:'back',row:'back'}}]]],
 36:[['roundStart',[{type:'dot',kind:'burn',mult:1,turns:1,chance:1,select:all},{type:'dot',kind:'burn',mult:1,turns:1,chance:1,select:all}]]],
 37:[['allyUlt',[{type:'dot',kind:'poison',fixed:2000000,turns:5,chance:1,select:all}],'any']],
 38:[['allyUlt',[{type:'dot',kind:'burn',targetHp:.05,turns:5,chance:1,select:all}],'any']],
};
export function debuffTriggers(ids){
 return ids.flatMap(id=>(debuffEffects[id]||[]).map(([on,effects,scope])=>({on,effects,chance:1,skill:debuffById.get(id)?.name||'Debuff',...(scope?{scope}:{})})));
}
/** Bắt đầu đánh boss: kiểm tra ngày mở, lượt (hết lượt thì dùng Vé Đánh Boss Ngọc), đội hình cấp ≥ 250. */
export function startGemBoss(p,input,{now,owned,definitionFor,spendTicket}){
 const b=bossOrFail(input.bossId),tier=integer(input.tier,1,6,'Bậc boss'),st=bossState(p,now);
 requireCondition(bossOpen(b,now),'Chưa mở!',409,'GEM_BOSS_CLOSED');
 const slots=Array.isArray(input.formation)?input.formation:[];
 for(const id of slots)if(id){const h=owned.get(id);requireCondition(h,'Bạn chưa sở hữu tướng này.',404);requireCondition(h.level>=heroMinLevel,`Tướng cần đạt cấp ${heroMinLevel}.`,409,'GEM_BOSS_LEVEL')}
 requireCondition(slots.some(Boolean),'Hãy chọn tướng ra trận.',400);
 if(turnsLeft(st,b.id)>0)st.turns[b.id]=turnsLeft(st,b.id)-1;else spendTicket();
 const hero=b.tiers[tier-1],c=bossConf(b.id).tiers[tier-1],debuffs=tier===6?(st.debuffs[b.id]||[]).slice(0,config.maxDebuffs):c.debuff?[c.debuff]:[];
 const kit=kitFromProfile({skills:hero.skills.map(sk=>({name:sk.name,description:(sk.passive?'Bị động: ':'Nộ: ')+sk.description,passive:sk.passive}))});
 kit.triggers.push(...debuffTriggers(debuffs));
 const visual=gemVisuals[hero.avatar],maxHp=c.hp;
 const unit={id:'enemy-0',name:hero.name,avatar:hero.avatar,faction:hero.faction,heroClass:hero.class,level:c.level,stars:hero.star,position:1,frontRow:true,
  maxHp,hp:maxHp,attack:c.attack,defense:c.defense,speed:c.speed,visualIndex:0,boss:true,kit,ultScale:1,
  ...(visual?.combat?{gemBoss:true}:{})};
 return{unit,meta:{gemBoss:{bossId:b.id,tier,name:hero.name,debuffs,points:debuffPoints(debuffs),rounds:config.rounds}}};
}
/** Hạ boss: tung từng phần thưởng theo tỉ lệ; bậc thử thách cộng thưởng mốc điểm debuff cao nhất đạt được. */
export function finishGemBoss(p,b,{grant,random=Math.random,now}){
 const g=b.gemBoss,won=b.status==='won',items=[];
 if(won){
  const st=bossState(p,now),k=st.killed[g.bossId]??=[];if(!k.includes(g.tier))k.push(g.tier);
  for(const {itemId,quantity,rate} of bossConf(g.bossId).tiers[g.tier-1].rewards)if(random()*1000<rate){const r={itemId,quantity};grant(r);items.push(r)}
  if(g.tier===6){const m=[...config.milestones].reverse().find(x=>g.points>=x.point);if(m)for(const r of m.rewards){grant({...r});items.push({...r})}}
 }
 b.reward={items,tier:g.tier,points:g.points};
 return b.reward;
}
/** Thông tin phụ cho trang quản trị: tên / ảnh boss, tên bậc, kỹ năng gốc, danh sách debuff, chỉ số mặc định. */
export function gemAdminInfo(){
 return{defaults:defaultGemConfig(),tierNames:['Dễ','Trung Bình','Khó','Thử Thách','Ác Mộng','Địa Ngục'],
  bosses:gemBosses.map(b=>({id:b.id,name:b.name,avatar:b.avatar,head:itemIcon({assetKey:gemVisuals[b.avatar]?.head}),card:itemIcon({assetKey:raw.art['boss/'+b.avatar+'_open']}),tiers:b.tiers.map(t=>({name:t.name,skills:t.skills.map(s=>s.name)}))})),
  debuffs:gemDebuffs.map(d=>({id:d.id,name:d.name,description:d.description,point:d.point,icon:itemIcon({assetKey:raw.art['bossdebufficon/'+d.id]})}))};
}
