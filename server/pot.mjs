// Đỉnh Thời Gian — Peaks of Time (bundle `pot`, POT_MAP_LIST 732 … POT_UPDATE_MAP_OBJECTS 786).
// Bản đồ ô vuông (Tilemap gốc MapPoT_1 / MapPoT_2) phủ sương mù, tầm nhìn 2 ô quanh người chơi (PoTMap.revealFog).
// Người chơi chọn ải, ra trận đội 6 tướng của mình; máu tướng giữ qua các trận trong lượt khám phá. Vật thể gốc
// (PoTMapData1/2): cổng dịch chuyển, công tắc cửa / khối đá, tháp pháo bắn theo hướng, nhà ga (gạt cần tắt / bật pháo),
// cổng nhảy, nền sập, quái (thắng → chọn 1 trong 3 di vật), rương, cơm hồi máu, bình hồi sinh, trạm hỗ trợ; boss
// (Akainu, PoTMapBoss) ở cuối bản đồ: hạ boss là qua ải. Luật tương tác do server gốc tính nên được thiết kế lại ở đây;
// số liệu (ải, cấp quái, thưởng, sát thương pháo, % hồi) do quản trị sửa (pot_config).
import {readFileSync} from 'node:fs';
import {requireCondition,integer} from './errors.mjs';
import {cards,cardView,heroPool} from './freedom.mjs';

const data=JSON.parse(readFileSync(new URL('../dist/pot.json',import.meta.url),'utf8'));
const key=(x,y)=>x+','+y;
const it=(itemId,quantity)=>({itemId,quantity});
export const sight=2,dirs=[[1,0],[-1,0],[0,1],[0,-1]];

// ---- Bản đồ: ô đi được = có nền (trừ ô trống viền 64_86) và không có tường.
const extras={
 // Bản đồ 1 (giải đố): quái canh lối, rương sau khối đá (công tắc khối), boss trong phòng sau cửa (công tắc cửa).
 1:[{id:101,type:'monster',rank:1,facing:'left',size:{x:1,y:2},location:{x:4,y:2}},{id:102,type:'chest',quality:2,size:{x:1,y:1},location:{x:8,y:-6}},
    {id:103,type:'boss',size:{x:1,y:2},facing:'left',location:{x:1,y:-1}}],
 // Bản đồ 2: boss ở phòng lớn góc trên phải.
 2:[{id:103,type:'boss',size:{x:1,y:2},facing:'left',location:{x:26,y:8}}],
};
function buildMap(id){
 const m=data.maps[id],layers=Object.fromEntries(m.layers.map(l=>[l.name,l]));
 const walk=new Set(),all=new Set(),wall=new Set((layers.TilemapWall?.cells||[]).map(c=>key(c[0],c[1])));
 for(const c of layers.TilemapBgr.cells){all.add(key(c[0],c[1]));if(c[2]!=='dungeon_tileset_64_86'&&!wall.has(key(c[0],c[1])))walk.add(key(c[0],c[1]))}
 const lay=data.layouts[id],seen=new Set(),objects=[];
 for(const o of [...lay.objects,...(extras[id]||[])]){const x=structuredClone(o);if(seen.has(x.id))x.id=200+objects.length;seen.add(x.id);objects.push(x)}
 for(const o of objects)requireCondition(walk.has(key(o.location.x,o.location.y)),`Bản đồ ${id}: vật thể ${o.type} ${o.id} đặt trên ô không đi được.`);
 const xs=[...all].map(k=>Number(k.split(',')[0])),ys=[...all].map(k=>Number(k.split(',')[1]));
 return{id,walk,spawn:lay.spawnPosition,objects,bounds:{left:Math.min(...xs),right:Math.max(...xs),bottom:Math.min(...ys),top:Math.max(...ys)}};
}
export const maps={1:buildMap(1),2:buildMap(2)};

// ---- Cấu hình (quản trị)
// Bật / tắt sự kiện (quản trị): tắt thì ẩn khỏi giao diện và từ chối mọi thao tác.
export const defaultPotConfig=()=>({enabled:true,...basePotConfig()});
function basePotConfig(){
 return{minLevel:50,turretDamage:15,healPercent:50,revivePercent:50,relicChoices:3,monsterBoost:[1,1.25],bossBoost:1.6,
  stages:Array.from({length:10},(_,i)=>({map:i%2?2:1,level:100+i*20,boost:+(0.9+i*.08).toFixed(2),
   chest:[[it('gold',30000*(i+1))],[it('gold',60000*(i+1)),it('diamonds',10*(i+1))]],
   clear:[it('gold',100000*(i+1)),it('diamonds',30+i*10),...(i%3===2?[it('consumable:4',1)]:[])]}))};
}
let config=defaultPotConfig();
export const potConfig=()=>config;
export function applyPotConfig(c){config=c||defaultPotConfig();return config}
export const validatePotConfig=(input,...rest)=>({enabled:input?.enabled!==false,...checkPotConfig(input,...rest)});
function checkPotConfig(input,isRewardId){
 requireCondition(input&&typeof input==='object','Thiếu cấu hình.');
 const n=(v,label,min,max)=>integer(v,min,max,label),f=(v,min,max,d=1)=>Math.max(min,Math.min(max,Number(v)||d));
 const rewards=(list,label,min=0)=>{requireCondition(Array.isArray(list)&&list.length>=min&&list.length<=10,`${label}: cần ${min}-10 phần thưởng.`);return list.map(x=>{requireCondition(typeof x?.itemId==='string'&&isRewardId(x.itemId),`${label}: vật phẩm không tồn tại.`,404);return it(x.itemId,n(x.quantity,`${label}: số lượng`,1,1e12))})};
 requireCondition(Array.isArray(input.stages)&&input.stages.length>=1&&input.stages.length<=100,'Cần từ 1 đến 100 ải.');
 requireCondition(Array.isArray(input.monsterBoost)&&input.monsterBoost.length===2,'Hệ số quái: cần 2 bậc.');
 return{minLevel:n(input.minLevel,'Cấp tối thiểu',1,1000),turretDamage:n(input.turretDamage,'Sát thương pháo (%)',0,100),healPercent:n(input.healPercent,'Hồi máu (%)',1,100),
  revivePercent:n(input.revivePercent,'Hồi sinh (%)',1,100),relicChoices:n(input.relicChoices,'Số thẻ để chọn',1,5),
  monsterBoost:input.monsterBoost.map(v=>+f(v,.1,20).toFixed(2)),bossBoost:+f(input.bossBoost,.1,20).toFixed(2),
  stages:input.stages.map((s,i)=>{requireCondition(maps[Number(s?.map)],`Ải ${i+1}: bản đồ không tồn tại.`,404);requireCondition(Array.isArray(s.chest)&&s.chest.length===2,`Ải ${i+1}: cần thưởng rương thường và rương quý.`);
   return{map:Number(s.map),level:n(s.level,`Ải ${i+1}: cấp quái`,1,1000),boost:+f(s.boost,.1,20).toFixed(2),chest:s.chest.map((c,k)=>rewards(c,`Ải ${i+1}: rương ${k?'quý':'thường'}`)),clear:rewards(s.clear,`Ải ${i+1}: thưởng qua ải`)}})};
}

// ---- Trạng thái người chơi (p.pot)
export function potState(p){return p.pot??={unlocked:1,cleared:[],looted:{},run:null}}
function newRun(stage){
 const st=config.stages[stage-1],map=maps[st.map];
 // Công tắc mặc định ở trạng thái tắt; vật thể khác mặc định hoạt động.
 const objects=map.objects.map(o=>({...structuredClone(o),isActive:o.isActive??!String(o.type).startsWith('switch'),isOpen:o.isOpen??false,isDead:false,used:false,
  ...(o.type==='block'?{at:{...o.location}}:{})}));
 const run={stage,map:st.map,pos:{...map.spawn},revealed:[],hp:{},team:null,relics:[],pending:null,done:false,moves:0,objects};
 reveal(run,run.pos);return run;
}
function reveal(run,{x,y}){const set=new Set(run.revealed);for(let dx=-sight;dx<=sight;dx++)for(let dy=-sight;dy<=sight;dy++)set.add(key(x+dx,y+dy));run.revealed=[...set]}
const cellsOf=o=>{const out=[];for(let i=0;i<(o.size?.x||1);i++)for(let j=0;j<(o.size?.y||1);j++)out.push(key(o.location.x+i,o.location.y+j));return out};
/** Ô bị chặn bởi vật thể: cửa đóng, khối đá (vị trí hiện tại), nền đã sập, quái / boss còn sống, rương chưa mở, vật phẩm hỗ trợ chưa dùng, tháp pháo. */
function blockedCells(run){
 const s=new Set();
 for(const o of run.objects){
  if(o.type==='door'&&!o.isOpen)cellsOf(o).forEach(k=>s.add(k));
  else if(o.type==='block')s.add(key(o.at.x,o.at.y));
  else if(o.type==='collapseGround'&&!o.isActive)s.add(key(o.location.x,o.location.y));
  else if((o.type==='monster'||o.type==='boss')&&!o.isDead)s.add(key(o.location.x,o.location.y));
  // Rương đã mở / cơm, bình, trạm đã dùng thì đi qua được (cụm cơm - bình - trạm - rương ở bản đồ 2 nằm sát nhau).
  else if(o.type==='chest'&&!o.isOpen||['healingRice','reviveJar','supportStation'].includes(o.type)&&!o.used||o.type==='turret')cellsOf(o).forEach(k=>s.add(k));
 }
 return s;
}
export const passable=(run,x,y)=>maps[run.map].walk.has(key(x,y))&&!blockedCells(run).has(key(x,y));
/** Đường bắn của tháp pháo: từ ô kế bên theo hướng `step` tới khi gặp ô không đi được. */
export function turretLine(run,t){
 const out=[],walk=maps[run.map].walk;let x=t.location.x+t.step.x,y=t.location.y+t.step.y;
 for(let i=0;i<60&&walk.has(key(x,y));i++){out.push(key(x,y));x+=t.step.x;y+=t.step.y}
 return out;
}
const near=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<=1;
const alive=(run)=>(run.team||[]).filter(id=>id&&(run.hp[id]??1)>0);
function damageAll(run,pct){for(const id of alive(run))run.hp[id]=Math.max(0,+((run.hp[id]??1)-pct/100).toFixed(4))}
function pickRelics(run,random){const owned=new Set(run.relics),pool=cards.filter(c=>!owned.has(c.id)).map(c=>c.id),out=[];while(out.length<config.relicChoices&&pool.length)out.push(pool.splice(Math.floor(random()*pool.length),1)[0]);return out}

export function potView(p){
 const s=potState(p),c=config,r=s.run;
 return{minLevel:c.minLevel,unlocked:s.unlocked,cleared:s.cleared,turretDamage:c.turretDamage,
  stages:c.stages.map((st,i)=>({stage:i+1,map:st.map,level:st.level,clear:st.clear,cleared:s.cleared.includes(i+1)})),
  run:r&&{stage:r.stage,map:r.map,pos:r.pos,revealed:r.revealed,hp:r.hp,team:r.team,done:r.done,
   relics:r.relics.map(cardView).filter(Boolean),pending:r.pending?.map(cardView).filter(Boolean)||null,
   objects:r.objects.map(o=>({...o,looted:o.type==='chest'?!!s.looted[`${r.stage}:${o.id}`]:undefined,
    ...(o.type==='monster'||o.type==='boss'?{enemy:enemySpec(r,o,heroPool())}:{})}))}};
}

/** Hành động không mở trận. ctx: {now, random, level, grant, owned(id)}. Trả {message, events?, fight?}. */
export function potAction(p,action,input,ctx){
 const s=potState(p),random=ctx.random||Math.random;
 if(action==='pot-enter'){
  requireCondition(ctx.level>=config.minLevel,`Yêu cầu người chơi cấp độ ${config.minLevel} trở lên.`,403,'POT_LEVEL');
  const stage=integer(input?.stage,1,config.stages.length,'Ải');requireCondition(stage<=s.unlocked,'Ải chưa mở.',409,'POT_LOCKED');
  // Vào ải mới / làm mới bản đồ: giữ đội hình đã chọn.
  if(!s.run||s.run.stage!==stage||input?.reset===true){const team=s.run?.team;s.run=newRun(stage);if(team)s.run.team=team}
  if(input?.formation)setTeam(s.run,input.formation,ctx);
  return{message:`Ải ${stage}`};
 }
 const run=s.run;requireCondition(run,'Chưa vào ải.',409,'POT_NO_RUN');
 if(action==='pot-team'){setTeam(run,input?.formation,ctx);return{message:'Đã lưu đội hình.'}}
 if(action==='pot-relic'){requireCondition(run.pending,'Không có di vật để chọn.',409);const k=integer(input?.index,0,run.pending.length-1,'Di vật');run.relics.push(run.pending[k]);run.pending=null;return{message:'Đã nhận di vật.',relic:cardView(run.relics.at(-1))}}
 if(action==='pot-move')return move(p,s,run,input,ctx,random);
 requireCondition(false,'Hành động Đỉnh Thời Gian không hợp lệ.');
}
function setTeam(run,slots,ctx){
 requireCondition(Array.isArray(slots)&&slots.length<=6,'Đội hình có tối đa 6 ô.');
 const list=Array.from({length:6},(_,i)=>slots[i]??null),seen=new Set();
 for(const id of list)if(id!==null){requireCondition(typeof id==='string'&&ctx.owned(id),'Đội hình chứa tướng chưa sở hữu.',400);requireCondition(!seen.has(id),'Mỗi tướng chỉ được xuất chiến một lần.',400);seen.add(id)}
 requireCondition(seen.size>0,'Hãy chọn ít nhất một tướng.',400);run.team=list;
}
/** Di chuyển theo lộ trình (mỗi bước sang ô kề), xử lý hiệu ứng từng bước, rồi tương tác với vật thể đích nếu có. */
function move(p,s,run,input,ctx,random){
 requireCondition(!run.done,'Ải đã hoàn thành.',409,'POT_DONE');requireCondition(!run.pending,'Hãy chọn di vật trước.',409,'POT_PENDING');
 requireCondition(run.team&&run.team.some(Boolean),'Hãy chọn đội hình trước.',409,'POT_TEAM');
 const route=Array.isArray(input?.route)?input.route:[];requireCondition(route.length<=200,'Lộ trình quá dài.');
 const events=[],fired=new Set();let cur={...run.pos},prevCollapse=null;
 const collapseAt=(x,y)=>run.objects.find(o=>o.type==='collapseGround'&&o.isActive&&o.location.x===x&&o.location.y===y);
 // Đang đứng trên nền sập từ lượt trước: rời đi thì nền sập.
 prevCollapse=collapseAt(cur.x,cur.y)||null;
 for(const step of route){
  const x=integer(step?.[0],-999,999,'Ô'),y=integer(step?.[1],-999,999,'Ô');
  requireCondition(Math.abs(x-cur.x)+Math.abs(y-cur.y)===1,'Lộ trình không liền mạch.',400,'POT_ROUTE');
  requireCondition(passable(run,x,y),'Không đi qua được ô này.',409,'POT_BLOCKED');
  if(prevCollapse){prevCollapse.isActive=false;events.push({type:'collapse',id:prevCollapse.id});prevCollapse=null}
  cur={x,y};run.moves++;reveal(run,cur);events.push({type:'step',x,y});
  const c=collapseAt(x,y);if(c)prevCollapse=c;
  // Pháo đang bật bắn khi người chơi bước vào đường bắn (mỗi pháo bắn tối đa một lần mỗi lượt đi).
  for(const t of run.objects.filter(o=>o.type==='turret'&&o.isActive&&!fired.has(o.id)))if(turretLine(run,t).includes(key(x,y))){fired.add(t.id);damageAll(run,config.turretDamage);events.push({type:'turret',id:t.id,x,y})}
  // Dịch chuyển: cổng (portal) sang cổng liên kết; cổng nhảy sang một cổng ra ngẫu nhiên. Dừng lộ trình.
  const portal=run.objects.find(o=>o.type==='portal'&&o.location.x===x&&o.location.y===y);
  if(portal){const to=run.objects.find(o=>o.id===portal.linkId);if(to){cur={...to.location};reveal(run,cur);events.push({type:'teleport',id:portal.id,to:to.id,x:cur.x,y:cur.y})}break}
  const gate=run.objects.find(o=>o.type==='jumpGateEntrance'&&o.location.x===x&&o.location.y===y);
  if(gate){const exits=run.objects.filter(o=>o.type==='jumpGateExit'),e=exits[Math.floor(random()*exits.length)];if(e){e.isActive=true;cur={...e.location};reveal(run,cur);events.push({type:'jump',id:gate.id,to:e.id,x:cur.x,y:cur.y})}break}
 }
 if(prevCollapse&&(prevCollapse.location.x!==cur.x||prevCollapse.location.y!==cur.y)){prevCollapse.isActive=false;events.push({type:'collapse',id:prevCollapse.id})}
 run.pos=cur;
 if(input?.target==null)return{message:'',events};
 const o=run.objects.find(x=>x.id===Number(input.target));requireCondition(o,'Vật thể không tồn tại.',404);
 const at=o.type==='rail'?(o.station||o.location):o.location;
 requireCondition(near(cur,at)||(o.size?.y===2&&near(cur,{x:at.x,y:at.y+1})),'Hãy lại gần vật thể.',409,'POT_FAR');
 return interact(p,s,run,o,events,ctx,random);
}
function toggle(run,sw,events){
 for(const id of [].concat(sw.linkId||[])){const t=run.objects.find(o=>o.id===id);if(!t)continue;
  if(t.type==='door'){if(!t.isOpen||!cellsOf(t).includes(key(run.pos.x,run.pos.y)))t.isOpen=!t.isOpen}
  if(t.type==='block'){const a=sw.linkLocation?.[0]||t.location,b=sw.linkLocationNext?.[0]||t.location,next=t.at.x===a.x&&t.at.y===a.y?b:a;t.at={...next}}}
 sw.isActive=!sw.isActive;events.push({type:'switch',id:sw.id});
}
function interact(p,s,run,o,events,ctx,random){
 const lootKey=`${run.stage}:${o.id}`;
 if(o.type==='chest'){requireCondition(!o.isOpen,'Rương đã mở.',409);o.isOpen=true;const rewards=s.looted[lootKey]?[]:config.stages[run.stage-1].chest[(o.quality||1)>=2?1:0];s.looted[lootKey]=true;for(const r of rewards)ctx.grant({...r});
  events.push({type:'chest',id:o.id});return{message:rewards.length?'Mở rương.':'Rương trống (đã nhận ở lần trước).',events,rewards}}
 if(o.type==='healingRice'){requireCondition(!o.used,'Đã dùng.',409);o.used=true;o.isActive=false;for(const id of alive(run))run.hp[id]=Math.min(1,+((run.hp[id]??1)+config.healPercent/100).toFixed(4));events.push({type:'heal',id:o.id});return{message:`Hồi ${config.healPercent}% máu cho tướng còn sống.`,events}}
 if(o.type==='reviveJar'){requireCondition(!o.used,'Đã dùng.',409);o.used=true;o.isActive=false;for(const id of (run.team||[]).filter(Boolean))if((run.hp[id]??1)<=0)run.hp[id]=config.revivePercent/100;events.push({type:'revive',id:o.id});return{message:`Hồi sinh tướng đã ngã với ${config.revivePercent}% máu.`,events}}
 if(o.type==='supportStation'){requireCondition(!o.used,'Đã dùng.',409);o.used=true;o.isActive=false;run.pending=pickRelics(run,random);events.push({type:'support',id:o.id});return{message:'Chọn di vật hỗ trợ.',events}}
 if(o.type==='rail'){for(const t of run.objects.filter(x=>x.type==='turret'))t.isActive=!t.isActive;events.push({type:'rail',id:o.id});return{message:'Gạt cần: đổi trạng thái tháp pháo.',events}}
 if(o.type==='switchDoor'||o.type==='switchBlock'){toggle(run,o,events);return{message:'',events}}
 if(o.type==='monster'||o.type==='boss'){requireCondition(!o.isDead,'Đã hạ.',409);requireCondition(alive(run).length>0,'Không còn tướng nào chiến đấu được. Hãy tìm bình hồi sinh hoặc vào lại ải.',409,'POT_ALL_DEAD');
  return{message:'',events,fight:{objectId:o.id,boss:o.type==='boss'}}}
 requireCondition(false,'Không tương tác được với vật thể này.',409);
}
/** Đối thủ của quái / boss: 6 tướng cố định theo ải + vật thể (cùng ải luôn cùng đội), cấp ải, hệ số theo bậc. */
export function enemySpec(run,o,pool){
 const st=config.stages[run.stage-1];let seed=(run.stage*7919+o.id*104729)>>>0;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
 const list=pool.slice(),heroes=[];if(o.type==='boss'&&list.includes('hero-143'))heroes.push(list.splice(list.indexOf('hero-143'),1)[0]);
 while(heroes.length<6&&list.length)heroes.push(list.splice(Math.floor(rnd()*list.length),1)[0]);
 const boost=st.boost*(o.type==='boss'?config.bossBoost:config.monsterBoost[Math.min(1,(o.rank||1)-1)]);
 return{heroes,level:st.level,boost:+boost.toFixed(3)};
}
/** Kết thúc trận: lưu máu đội; thắng quái → chọn di vật; thắng boss → qua ải (thưởng lần đầu), mở ải sau. */
export function finishPot(p,b,allies,won,ctx){
 const s=potState(p),run=s.run;if(!run||run.stage!==b.pot.stage)return null;
 for(const u of allies)if(u.heroId)run.hp[u.heroId]=u.maxHp?Math.max(0,+(u.hp/u.maxHp).toFixed(4)):0;
 const o=run.objects.find(x=>x.id===b.pot.objectId);let rewards=[];
 if(won&&o){o.isDead=true;
  if(o.type==='boss'){run.done=true;if(!s.cleared.includes(run.stage)){s.cleared.push(run.stage);rewards=config.stages[run.stage-1].clear;for(const r of rewards)ctx.grant({...r})}s.unlocked=Math.max(s.unlocked,Math.min(config.stages.length,run.stage+1))}
  else run.pending=pickRelics(run,ctx.random||Math.random)}
 return{won,boss:o?.type==='boss',done:run.done,rewards,pending:!!run.pending};
}
