// Đấu Trường Tự Do (bundle `arenafreedom`, FREEDOM_ARENA_STATUS 1031 … GET_REWARD 1038): mỗi lượt chơi tốn vé, hệ thống phát
// 6 tướng ngẫu nhiên (cùng cấp, không dùng tướng của người chơi; reset tốn kim cương tăng dần), rồi vượt các ải nối tiếp (mặc định 7, quản trị thêm / bớt được).
// Trước mỗi ải chọn 1 trong 2 "trợ giúp" (db_Buff gốc: 1-2 tướng thêm và/hoặc thẻ Marineford), ra trận 6 tướng trong nhóm.
// Thua một ải là hết lượt; nhận thưởng theo số ải đã qua. Giá vé / reset / lượt tuần / đối thủ / thưởng do server gốc cấp
// nên ở đây là cấu hình mặc định, quản trị sửa được (freedom_config).
import {requireCondition,integer} from './errors.mjs';
import {heroDefinitions,heroKits} from './catalog.mjs';
import {readFileSync} from 'node:fs';

const data=JSON.parse(readFileSync(new URL('../dist/freedom.json',import.meta.url),'utf8'));
export const stageCount=7,maxStages=50,teamSize=6;// stageCount: số ải mặc định
const DAY=86400000,VN=7*3600000,mondayEpoch=Date.UTC(2024,0,1);// 01/01/2024 là thứ Hai
export const weekKey=now=>Math.floor((now+VN-mondayEpoch)/(7*DAY));
const it=(itemId,quantity)=>({itemId,quantity});

// ---- Thẻ trợ giúp: thẻ Marineford gốc (tên, bậc, icon) có hiệu ứng chỉ số áp cả trận. Mô tả viết lại theo hiệu ứng.
// atk / def / hp / speed: % chỉ số gốc; energy: nộ đầu trận; còn lại cộng thẳng vào chỉ số chiến đấu (tỉ lệ).
// row: 'front' | 'back' giới hạn hàng; enemy: áp lên đối thủ.
const cardRules={
 6:{energy:15},7:{energy:25},16:{energy:100},
 12:{block:.3},14:{accuracy:.3,critChance:.1},17:{atk:.2,hp:.2,skillDamage:1},18:{def:.15,hp:.15},19:{healPower:.3},
 22:{hp:.25,critChance:.3,critDamage:.4},28:{enemy:{def:-.1}},31:{healTaken:.8},32:{critDamage:.35},33:{enemy:{atk:-.1}},36:{critChance:.4,critDamage:.4},
 76:{row:'front',hp:.05,block:.1},77:{row:'front',hp:.1,block:.15},78:{row:'front',hp:.15,block:.2},
 79:{row:'back',atk:.05,accuracy:.1},80:{row:'back',atk:.1,accuracy:.15},81:{row:'back',atk:.2,accuracy:.3},
 91:{damageReduction:.1},92:{damageReduction:.15},93:{damageReduction:.25},
 97:{lifesteal:.1},98:{lifesteal:.15},99:{lifesteal:.25},
 100:{critChance:.1},101:{critChance:.15},102:{critChance:.25},
 109:{hp:.05},110:{hp:.1},111:{hp:.2},
 115:{atk:.05},116:{atk:.1},117:{atk:.2},
 118:{skillDamage:.15},119:{skillDamage:.2},120:{skillDamage:.3},
 121:{block:.1},122:{block:.2},123:{block:.3},
};
const viNames={76:'Tiên phong',77:'Tiên phong',78:'Tiên phong',79:'Hộ tống',80:'Hộ tống',81:'Hộ tống',91:'Hoa sen',92:'Hoa sen',93:'Hoa sen',97:'Hút máu',98:'Hút máu',99:'Hút máu',
 100:'Rìu bạc',101:'Rìu bạc',102:'Rìu bạc',109:'Huyết mạch',110:'Huyết mạch',111:'Huyết mạch',115:'Sức mạnh',116:'Sức mạnh',117:'Sức mạnh',118:'Sách phép',119:'Sách phép',120:'Sách phép',121:'Khiên sắt',122:'Khiên sắt',123:'Khiên sắt'};
const labels={atk:'công',def:'thủ',hp:'máu tối đa',critChance:'chí mạng',critDamage:'sát thương chí mạng',skillDamage:'sát thương kỹ năng',block:'chặn',accuracy:'chính xác',
 damageReduction:'giảm sát thương',lifesteal:'hút máu',healPower:'hiệu quả hồi máu',healTaken:'khả năng hồi phục'};
const pct=v=>`${Math.round(Math.abs(v)*100)}%`;
function describe(rule){
 const parts=[];
 for(const [k,v] of Object.entries(rule)){if(k==='row'||k==='enemy')continue;if(k==='energy')parts.push(`đầu trận tăng ${v} nộ`);else parts.push(`${v<0?'giảm':'tăng'} ${pct(v)} ${labels[k]}`)}
 if(rule.enemy)for(const [k,v] of Object.entries(rule.enemy))parts.push(`${v<0?'giảm':'tăng'} ${pct(v)} ${labels[k]} của kẻ địch`);
 const text=parts.join(', ');const who=rule.row==='front'?'Tướng hàng trước ':rule.row==='back'?'Tướng hàng sau ':rule.enemy&&parts.length===Object.keys(rule.enemy).length?'':'Toàn đội ';
 return who+(who?text:text.charAt(0).toUpperCase()+text.slice(1))+'.';
}
export const cards=data.cards.filter(c=>cardRules[c.id]).map(c=>({id:c.id,name:viNames[c.id]||c.name,rank:Math.min(3,Math.max(1,c.rank)),icon:c.icon,description:describe(cardRules[c.id]),rule:cardRules[c.id]}));
const cardById=new Map(cards.map(c=>[c.id,c]));
// Đường dẫn ảnh icon thẻ (trang quản trị dùng thẳng src).
const assetSrc=(()=>{try{const a=JSON.parse(readFileSync(new URL('../dist/assets.json',import.meta.url),'utf8'));return k=>a[k]?.src||null}catch{return()=>null}})();
export const cardIconSrc=k=>k?assetSrc(k):null;
export const cardView=id=>{const c=cardById.get(id);return c?{id:c.id,name:c.name,rank:c.rank,icon:c.icon,description:c.description}:null};

/** Áp thẻ cho một phe (và phần "enemy" của thẻ lên phe kia). */
export function applyCards(units,cardIds,foes=[]){
 const mul=(u,k,v)=>{if(k==='atk'){u.attack=Math.round(u.attack*(1+v));if(u.baseAttack)u.baseAttack=Math.round(u.baseAttack*(1+v))}
  else if(k==='def'){u.defense=Math.round(u.defense*(1+v));if(u.baseDefense)u.baseDefense=Math.round(u.baseDefense*(1+v))}
  else if(k==='hp'){u.maxHp=Math.round(u.maxHp*(1+v));u.hp=u.maxHp;if(u.baseMaxHp)u.baseMaxHp=u.maxHp}
  else if(k==='energy')u.energy=Math.min(100,(u.energy||0)+v);
  else u[k]=(u[k]||0)+v};
 for(const id of cardIds){const r=cardById.get(id)?.rule;if(!r)continue;
  for(const u of units){if(r.row==='front'&&!u.frontRow||r.row==='back'&&u.frontRow)continue;for(const [k,v] of Object.entries(r))if(k!=='row'&&k!=='enemy')mul(u,k,v)}
  if(r.enemy)for(const u of foes)for(const [k,v] of Object.entries(r.enemy))mul(u,k,v)}
 for(const u of [...units,...foes])u.power=Math.round(u.attack*2.4+u.maxHp*.13+u.defense*2);
 return units;
}

// ---- Tướng phát ngẫu nhiên: tướng có bộ kỹ năng (trừ tướng đặc biệt của nhân vật chính).
const excluded=new Set(['luffy-gear-2','zoro-king-of-hell']);
export const heroPool=()=>heroDefinitions.filter(d=>heroKits.has(d.id)&&!excluded.has(d.id)).map(d=>d.id);

// ---- Cấu hình (quản trị)
// Bật / tắt (quản trị): tắt thì ẩn toà nhà khỏi bản đồ và từ chối mọi thao tác.
export const defaultFreedomConfig=()=>({enabled:true,...baseFreedomConfig()});
function baseFreedomConfig(){
 return{minLevel:40,weeklyRuns:5,ticket:it('consumable:4',1),diamondFee:100,resetCosts:[20,50,100,200,300],heroLevel:160,
  // Lựa chọn trợ giúp: tỉ lệ (‰) 2 tướng / 1 tướng + 1 thẻ / 1 thẻ bậc cao.
  helpWeights:[350,400,250],
  stages:[[80,.65,0],[100,.75,0],[120,.85,1],[140,.95,1],[160,1.05,2],[180,1.2,2],[200,1.35,3]].map(([level,boost,cards],i)=>({level,boost,cards,
   rewards:[it('gold',40000*(i+1)),it('diamonds',10*(i+1)+(i===6?100:0)),...(i===6?[it('consumable:4',1)]:[])]}))};
}
let config=defaultFreedomConfig();
export const freedomConfig=()=>config;
export function applyFreedomConfig(c){config=c||defaultFreedomConfig();return config}
export const validateFreedomConfig=(input,...rest)=>({enabled:input?.enabled!==false,...checkFreedomConfig(input,...rest)});
function checkFreedomConfig(input,isRewardId){
 requireCondition(input&&typeof input==='object','Thiếu cấu hình.');
 const n=(v,label,min,max)=>integer(v,min,max,label);
 const rewards=(list,label,min=0)=>{requireCondition(Array.isArray(list)&&list.length>=min&&list.length<=10,`${label}: cần ${min}-10 phần thưởng.`);return list.map(x=>{requireCondition(typeof x?.itemId==='string'&&isRewardId(x.itemId),`${label}: vật phẩm không tồn tại.`,404);return it(x.itemId,n(x.quantity,`${label}: số lượng`,1,1e12))})};
 requireCondition(Array.isArray(input.stages)&&input.stages.length>=1&&input.stages.length<=maxStages,`Cần từ 1 đến ${maxStages} ải.`);
 requireCondition(Array.isArray(input.resetCosts)&&input.resetCosts.length<=20,'Giá reset: tối đa 20 mức.');
 requireCondition(Array.isArray(input.helpWeights)&&input.helpWeights.length===3,'Tỉ lệ trợ giúp: cần 3 giá trị.');
 const weights=input.helpWeights.map((w,i)=>n(w,`Tỉ lệ trợ giúp ${i+1}`,0,1000));requireCondition(weights.some(w=>w>0),'Tỉ lệ trợ giúp phải có ít nhất một giá trị lớn hơn 0.');
 const ticket=rewards([input.ticket],'Vé tham gia',1)[0];
 return{minLevel:n(input.minLevel,'Cấp tối thiểu',1,1000),weeklyRuns:n(input.weeklyRuns,'Lượt mỗi tuần',1,1000),ticket,diamondFee:n(input.diamondFee,'Giá kim cương',0,1e9),
  resetCosts:input.resetCosts.map((v,i)=>n(v,`Giá reset ${i+1}`,0,1e9)),heroLevel:n(input.heroLevel,'Cấp tướng được phát',1,1000),helpWeights:weights,
  stages:input.stages.map((s,i)=>({level:n(s?.level,`Ải ${i+1}: cấp đối thủ`,1,1000),boost:Math.max(.1,Math.min(20,Number(s?.boost)||1)),cards:n(s?.cards,`Ải ${i+1}: số thẻ đối thủ`,0,10),rewards:rewards(s?.rewards,`Ải ${i+1}`)}))};
}

// ---- Trạng thái người chơi (p.freedom)
const pickRandom=(list,count,random,avoid=new Set())=>{const pool=list.filter(x=>!avoid.has(x)),out=[];while(out.length<count&&pool.length)out.push(pool.splice(Math.floor(random()*pool.length),1)[0]);return out};
export function freedomState(p,now){
 const s=p.freedom??={week:weekKey(now),runs:0,run:null,best:0};
 if(s.week!==weekKey(now)){s.week=weekKey(now);s.runs=0}
 return s;
}
function rollTeam(random){return pickRandom(heroPool(),teamSize,random)}
function rollOptions(run,random){
 const heroes=heroPool(),inPool=new Set(run.pool),owned=new Set(run.cards),w=config.helpWeights,total=w.reduce((a,b)=>a+b,0),opts=[];
 const freeCards=minRank=>cards.filter(c=>!owned.has(c.id)&&c.rank>=minRank&&!opts.some(o=>o.cards.includes(c.id))).map(c=>c.id);
 while(opts.length<2){
  let r=random()*total,type=0;while(type<2&&r>=w[type]){r-=w[type];type++}
  const avoid=new Set([...inPool,...opts.flatMap(o=>o.heroes)]);
  const o=type===0?{heroes:pickRandom(heroes,2,random,avoid),cards:[]}:type===1?{heroes:pickRandom(heroes,1,random,avoid),cards:pickRandom(freeCards(1),1,random)}:{heroes:[],cards:pickRandom(freeCards(2),1,random)};
  if(o.heroes.length+o.cards.length)opts.push(o);
 }
 return opts;
}
function rollEnemy(run,random){const st=config.stages[Math.min(run.stage,config.stages.length-1)];return{heroes:pickRandom(heroPool(),teamSize,random),level:st.level,boost:st.boost,cards:pickRandom(cards.map(c=>c.id),st.cards,random)}}
const stageRewards=cleared=>{const sum=new Map();for(const st of config.stages.slice(0,cleared))for(const r of st.rewards)sum.set(r.itemId,(sum.get(r.itemId)||0)+r.quantity);return[...sum].map(([itemId,quantity])=>it(itemId,quantity))};

export function freedomView(p,now){
 const s=freedomState(p,now),run=s.run,c=config;
 return{minLevel:c.minLevel,weeklyRuns:c.weeklyRuns,runs:s.runs,best:s.best||0,ticket:c.ticket,diamondFee:c.diamondFee,heroLevel:c.heroLevel,
  stages:c.stages.map((st,i)=>({stage:i+1,level:st.level,rewards:st.rewards})),
  run:run&&{status:run.status,stage:run.stage,wins:run.wins,total:run.total||c.stages.length,lost:!!run.lost,team:run.team,pool:run.pool,cards:run.cards.map(cardView).filter(Boolean),
   options:run.status==='help'?run.options.map(o=>({heroes:o.heroes,cards:o.cards.map(cardView).filter(Boolean)})):null,
   resets:run.resets,resetCost:run.status==='team'&&run.resets<c.resetCosts.length?c.resetCosts[run.resets]:null,
   enemy:run.status==='attack'&&run.enemy?{heroes:run.enemy.heroes,level:run.enemy.level,cards:run.enemy.cards.map(cardView).filter(Boolean)}:null,
   formation:run.formation||null,rewards:stageRewards(run.wins)}};
}

/** Hành động (gọi trong applyAction của game.mjs). ctx: {now, random, spendItems, spendDiamonds, grant, level}. */
export function freedomAction(p,action,input,ctx){
 const s=freedomState(p,ctx.now),c=config,random=ctx.random||Math.random;
 if(action==='freedom-join'){
  requireCondition(ctx.level>=c.minLevel,`Yêu cầu người chơi cấp độ ${c.minLevel} trở lên.`,403,'FREEDOM_LEVEL');
  requireCondition(!s.run,'Bạn đang trong một lượt chơi.',409,'FREEDOM_RUNNING');
  requireCondition(s.runs<c.weeklyRuns,'Đã hết lượt chơi tuần này.',409,'FREEDOM_LIMIT');
  if(input?.pay==='diamonds'){requireCondition(c.diamondFee>0,'Không thể tham gia bằng kim cương.',409);ctx.spendDiamonds(c.diamondFee)}
  else ctx.spendItems({[c.ticket.itemId]:c.ticket.quantity});
  s.runs++;const team=rollTeam(random);
  s.run={status:'team',stage:0,wins:0,total:c.stages.length,team,pool:[...team],cards:[],resets:0,options:null,enemy:null,formation:team.slice()};
  return{message:'Đã nhận đội hình ngẫu nhiên.'};
 }
 const run=s.run;requireCondition(run,'Chưa tham gia lượt chơi.',409,'FREEDOM_NO_RUN');
 if(action==='freedom-reset'){
  requireCondition(run.status==='team','Chỉ đổi đội trước khi xác nhận.',409);requireCondition(run.resets<c.resetCosts.length,'Đã hết lượt đổi đội.',409,'FREEDOM_RESET_LIMIT');
  const cost=c.resetCosts[run.resets];if(cost>0)ctx.spendDiamonds(cost);run.resets++;run.team=rollTeam(random);run.pool=[...run.team];run.formation=run.team.slice();
  return{message:'Đã đổi đội hình mới.'};
 }
 if(action==='freedom-team'){
  requireCondition(run.status==='team','Đội đã được xác nhận.',409);run.status='help';run.options=rollOptions(run,random);return{message:'Đã xác nhận đội hình.'};
 }
 if(action==='freedom-help'){
  requireCondition(run.status==='help','Chưa tới lúc chọn trợ giúp.',409);const k=integer(input?.option,0,1,'Lựa chọn'),o=run.options[k];
  for(const h of o.heroes)if(!run.pool.includes(h))run.pool.push(h);for(const id of o.cards)if(!run.cards.includes(id))run.cards.push(id);
  run.options=null;run.status='attack';run.enemy=rollEnemy(run,random);return{message:'Đã chọn trợ giúp.',option:k};
 }
 if(action==='freedom-claim'){
  requireCondition(run.status==='done','Lượt chơi chưa kết thúc.',409);const rewards=stageRewards(run.wins);for(const r of rewards)ctx.grant({...r});
  s.best=Math.max(s.best||0,run.wins);s.run=null;return{message:`Vượt ${run.wins}/${run.total||config.stages.length} ải.`,rewards};
 }
 if(action==='freedom-quit'){requireCondition(run.status!=='done','Lượt chơi đã kết thúc.',409);run.status='done';run.lost=true;run.options=null;run.enemy=null;return{message:'Đã kết thúc lượt chơi.'}}
 requireCondition(false,'Hành động Đấu Trường Tự Do không hợp lệ.');
}
/** Đội ra trận: 6 ô (null = trống), chỉ gồm tướng trong nhóm của lượt chơi, đủ 6 tướng. */
export function freedomFormation(p,slots){
 const run=p.freedom?.run;requireCondition(run?.status==='attack','Chưa tới lúc tấn công.',409,'FREEDOM_STATE');
 requireCondition(Array.isArray(slots)&&slots.length<=6,'Đội hình có tối đa 6 ô.');
 const list=Array.from({length:6},(_,i)=>slots[i]??null),seen=new Set();
 for(const id of list)if(id!==null){requireCondition(run.pool.includes(id),'Tướng không thuộc đội Tự Do.',400);requireCondition(!seen.has(id),'Mỗi tướng chỉ được xuất chiến một lần.',400);seen.add(id)}
 requireCondition(seen.size===Math.min(teamSize,run.pool.length),'Cần lắp đủ 6 tướng để tấn công',400,'FREEDOM_FULL');
 run.formation=list;return list;
}
/** Kết thúc trận: thắng → ải tiếp (hoặc hoàn thành), thua → hết lượt. */
export function finishFreedom(p,won,random=Math.random){
 const run=p.freedom?.run;if(!run||run.status!=='attack')return null;
 run.enemy=null;
 if(won){run.wins++;run.stage++;if(run.stage>=(run.total||config.stages.length))run.status='done';else{run.status='help';run.options=rollOptions(run,random)}}
 else{run.status='done';run.lost=true}
 return{wins:run.wins,stage:run.stage,done:run.status==='done',rewards:run.status==='done'?stageRewards(run.wins):[]};
}
