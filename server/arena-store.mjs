// Chiến trường trên MongoDB: bảng điểm theo mùa (arena_entries), chiến sử (arena_records), mốc trao thưởng / nhánh Vô song
// (arena_meta) và cược Võ đấu (allstar_bets). Luật thuần nằm ở arena.mjs; thao tác của người chơi chạy qua Store.mutate
// với context (đối thủ đã kiểm tra), rồi điểm hai bên được chốt ở đây một lần duy nhất cho mỗi trận (khóa battleId).
import {ObjectId} from 'mongodb';
import {randomUUID} from 'node:crypto';
import {requireCondition} from './errors.mjs';
import {starterPlayer,arenaSnapshot} from './game.mjs';
import {heroDefinitions,heroKits} from './catalog.mjs';
import {newHero} from './hero-roster.mjs';
import {sendMail} from './mail.mjs';
import {arenaData,arenaModes,startPoints,seasonWindow,dayKey,nextDaily,allstarPhase,knockoutRounds,groupEndOffset,eloDelta,rewardFor,pointsPerHour,allstarSeasonReward,knockoutReward,botName,botProfile,seeded,series,knockoutSize} from './arena.mjs';

const botCount={solo:60,league:40,allstars:40},HOUR=3600000;
const entryId=(mode,season,key)=>`${mode}:${season}:${key}`;
const userKey=id=>String(id);
const publicEntry=(e,rank)=>({id:e._id,rank,name:e.name,avatar:e.avatar,level:e.level,power:e.power,points:e.points,apoints:e.apoints||0,ladder:e.rank||null,bot:!!e.bot});

/** Người chơi máy: đội tướng có bộ kỹ năng, cấp / sao theo thứ hạng. Cùng mùa luôn sinh cùng một đội. */
function botEntry(mode,season,i,total){
 const prof=botProfile(mode,i,total),rand=seeded(season*7919+i*104729+mode.length*31),pool=heroDefinitions.filter(d=>heroKits.has(d.id)&&d.id!=='luffy-gear-2'&&d.id!=='zoro-king-of-hell');
 const picks=[];while(picks.length<6*arenaModes[mode].teams&&picks.length<pool.length){const d=pool[Math.floor(rand()*pool.length)];if(!picks.includes(d))picks.push(d)}
 const p=starterPlayer(botName(i));p.account.level=Math.min(100,Math.max(arenaModes[mode].minLevel,prof.level));
 const heroes=picks.map(d=>({...newHero(d),level:prof.level,stars:prof.stars}));p.hero=heroes[0];p.reserveHeroes=Object.fromEntries(heroes.slice(1).map(h=>[h.id,h]));
 p.arena={defense:{[mode]:Array.from({length:arenaModes[mode].teams},(_,t)=>Array.from({length:6},(_,k)=>heroes[t*6+k]?.id??null))}};
 const snap=arenaSnapshot(p,mode);
 return{_id:entryId(mode,season,'bot'+i),mode,season,userId:null,bot:true,botIndex:i,name:snap.displayName,avatar:snap.avatar,level:snap.level,power:snap.power,teams:snap.teams,points:prof.points,apoints:0,rank:i+1,hidden:false,updatedAt:new Date(0)};
}

export function installArena(Store){
 const P=Store.prototype;
 P.setupArena=async function(){
  this.arenaEntries=this.db.collection('arena_entries');this.arenaRecords=this.db.collection('arena_records');this.arenaMeta=this.db.collection('arena_meta');this.allstarBets=this.db.collection('allstar_bets');
  await this.arenaEntries.createIndex({mode:1,season:1,points:-1,updatedAt:1});await this.arenaEntries.createIndex({mode:1,season:1,rank:1});await this.arenaEntries.createIndex({userId:1,mode:1,season:1});
  await this.arenaRecords.createIndex({userId:1,mode:1,at:-1});await this.arenaRecords.createIndex({battleId:1,userId:1},{unique:true});
  await this.allstarBets.createIndex({season:1,matchId:1,userId:1},{unique:true});await this.allstarBets.createIndex({userId:1,season:1});
  await this.arenaTick();
  this.arenaTimer=setInterval(()=>this.arenaTick().catch(e=>console.error(JSON.stringify({event:'arena_tick_failed',name:e.name,message:e.message}))),30000);this.arenaTimer.unref();
 };
 /** Đảm bảo mùa hiện tại có đủ người chơi máy. */
 P.arenaSeason=async function(mode,now=Date.now()){
  const season=seasonWindow(now);
  if(!await this.arenaEntries.findOne({mode,season:season.id,bot:true},{projection:{_id:1}})){
   const total=botCount[mode],docs=Array.from({length:total},(_,i)=>botEntry(mode,season.id,i,total));
   // Người chơi thật vào trước bot (Võ đấu) giữ hạng; bot xếp sau.
   const humans=await this.arenaEntries.countDocuments({mode,season:season.id,bot:{$ne:true}});
   if(mode==='allstars')docs.forEach((d,i)=>{d.rank=humans+i+1});
   await this.arenaEntries.bulkWrite(docs.map(d=>({updateOne:{filter:{_id:d._id},update:{$setOnInsert:d},upsert:true}})),{ordered:false});
  }
  return season;
 };
 /** Vào bảng / cập nhật snapshot đội phòng thủ của người chơi. */
 P.arenaJoin=async function(user,mode,now=Date.now()){
  const season=await this.arenaSeason(mode,now),p=user.player;
  if(p.account.level<arenaModes[mode].minLevel)return null;
  const snap=arenaSnapshot(p,mode),_id=entryId(mode,season.id,userKey(user._id));
  const set={mode,season:season.id,userId:user._id,bot:false,name:snap.displayName,avatar:snap.avatar,level:snap.level,power:snap.power,teams:snap.teams,hidden:!!user.locked};
  const existing=await this.arenaEntries.findOne({_id},{projection:{_id:1}});
  if(existing)await this.arenaEntries.updateOne({_id},{$set:set});
  else{
   const rank=mode==='allstars'?1+await this.arenaEntries.countDocuments({mode,season:season.id}):null;
   await this.arenaEntries.updateOne({_id},{$set:set,$setOnInsert:{points:startPoints,apoints:0,rank,updatedAt:new Date(now)}},{upsert:true});
  }
  return this.arenaEntries.findOne({_id});
 };
 P.arenaStanding=async function(mode,season,entry){
  if(!entry)return null;
  if(mode==='allstars')return entry.rank;
  return 1+await this.arenaEntries.countDocuments({mode,season,hidden:{$ne:true},$or:[{points:{$gt:entry.points}},{points:entry.points,updatedAt:{$lt:entry.updatedAt}},{points:entry.points,updatedAt:entry.updatedAt,_id:{$lt:entry._id}}]});
 };
 P.arenaTop=async function(mode,season,{by='points',limit=50}={}){
  const sort=mode==='allstars'&&by==='rank'?{rank:1}:mode==='allstars'?{apoints:-1,rank:1}:{points:-1,updatedAt:1,_id:1};
  const rows=await this.arenaEntries.find({mode,season,hidden:{$ne:true}},{projection:{teams:0}}).sort(sort).limit(limit).toArray();
  return rows.map((e,i)=>publicEntry(e,mode==='allstars'&&by==='rank'?e.rank:i+1));
 };
 /** Màn chính của từng chế độ: bảng xếp hạng, thông tin bản thân, thời gian. */
 P.arenaScene=async function(userId,mode,{by}={}){
  requireCondition(Object.hasOwn(arenaModes,mode),'Chế độ không tồn tại.',404);
  const user=await this.getUser(userId);requireCondition(user,'Tài khoản không tồn tại.',401);
  const now=Date.now(),season=await this.arenaSeason(mode,now),entry=await this.arenaJoin(user,mode,now),rank=await this.arenaStanding(mode,season.id,entry);
  const out={mode,season:season.id,endsAt:season.end,nextDaily:nextDaily(now),now,minLevel:arenaModes[mode].minLevel,locked:!entry,
   top:await this.arenaTop(mode,season.id,{by:by||(mode==='allstars'?'rank':'points')}),
   me:entry?{...publicEntry(entry,rank),teams:entry.teams.map(t=>({power:t.power,heads:t.heads}))}:{name:user.player.displayName,level:user.player.account.level,rank:0,points:0}};
  if(mode==='solo')out.rewards={daily:rewardFor(arenaData.solo.daily,rank||Infinity),season:rewardFor(arenaData.solo.season,rank||Infinity)};
  if(mode==='league')out.rewards={season:rewardFor(arenaData.league.season,rank||Infinity)};
  if(mode==='allstars'){const phase=allstarPhase(now);out.phase={phase:phase.phase,round:phase.round||null,label:phase.label,next:phase.next};out.perHour=entry?pointsPerHour(entry.rank):0;out.rewards={season:allstarSeasonReward(entry?.apoints||0)}}
  return out;
 };
 /** Top mùa trước (nút bục vinh danh ở sảnh Chiến trường). */
 P.arenaLast=async function(mode){
  requireCondition(Object.hasOwn(arenaModes,mode),'Chế độ không tồn tại.',404);const season=seasonWindow().id-1;
  return{mode,season,top:await this.arenaTop(mode,season,{by:mode==='allstars'?'points':'points',limit:10})};
 };
 P.arenaHub=async function(userId){
  const user=await this.getUser(userId);requireCondition(user,'Tài khoản không tồn tại.',401);const now=Date.now(),w=seasonWindow(now),phase=allstarPhase(now);
  return{now,level:user.player.account.level,modes:Object.values(arenaModes).map(m=>({id:m.id,name:m.name,title:m.title,minLevel:m.minLevel,open:user.player.account.level>=m.minLevel,endsAt:m.id==='allstars'?phase.next:w.end,label:m.id==='allstars'?phase.label:'Kết thúc sau:'}))};
 };
 /** Chọn 3 đối thủ: Đơn đấu / Liên đấu lấy người điểm cao hơn gần mình nhất, Võ đấu lấy người hạng cao hơn (thắng thì đổi hạng). */
 P.arenaRivals=async function(userId,mode,refresh=false){
  const user=await this.getUser(userId);requireCondition(user,'Tài khoản không tồn tại.',401);
  const now=Date.now(),season=await this.arenaSeason(mode,now),entry=await this.arenaJoin(user,mode,now);requireCondition(entry,`Yêu cầu người chơi cấp độ ${arenaModes[mode].minLevel} trở lên.`,403,'LEVEL_REQUIRED');
  let ids=entry.rivals;
  if(refresh||!Array.isArray(ids)||!ids.length){
   const others={mode,season:season.id,hidden:{$ne:true},_id:{$ne:entry._id}};let pool;
   if(mode==='allstars'){pool=await this.arenaEntries.find({...others,rank:{$lt:entry.rank}},{projection:{_id:1}}).sort({rank:-1}).limit(10).toArray();if(pool.length<3)pool=pool.concat(await this.arenaEntries.find({...others,rank:{$gt:entry.rank}},{projection:{_id:1}}).sort({rank:1}).limit(3-pool.length).toArray())}
   else{pool=await this.arenaEntries.find({...others,points:{$gte:entry.points}},{projection:{_id:1}}).sort({points:1}).limit(12).toArray();if(pool.length<6)pool=pool.concat(await this.arenaEntries.find({...others,points:{$lt:entry.points}},{projection:{_id:1}}).sort({points:-1}).limit(6-pool.length).toArray())}
   const rand=seeded(now%4294967295);ids=pool.map(x=>[rand(),x._id]).sort((a,b)=>a[0]-b[0]).slice(0,3).map(x=>x[1]);
   await this.arenaEntries.updateOne({_id:entry._id},{$set:{rivals:ids}});
  }
  const rows=await this.arenaEntries.find({_id:{$in:ids}},{projection:{teams:0}}).toArray();
  const list=ids.map(id=>rows.find(r=>r._id===id)).filter(Boolean).sort((a,b)=>mode==='allstars'?a.rank-b.rank:b.points-a.points);
  return{power:entry.power,rivals:list.map(e=>publicEntry(e,null))};
 };
 P.arenaHistory=async function(userId,mode){
  const rows=await this.arenaRecords.find({userId:new ObjectId(userId),mode}).sort({at:-1}).limit(30).toArray();
  return{records:rows.map(r=>({id:r._id.toHexString?r._id.toHexString():String(r._id),at:r.at,attack:r.attack,win:r.win,delta:r.delta,opponent:r.opponent,season:r.season,revenge:!r.attack&&!r.win&&!r.revenged}))};
 };
 P.arenaPlayer=async function(id){
  const e=await this.arenaEntries.findOne({_id:String(id)});requireCondition(e,'Không tìm thấy người chơi.',404);
  return{id:e._id,name:e.name,avatar:e.avatar,level:e.level,power:e.power,points:e.points,bot:!!e.bot,shortId:e.bot?null:String(e.userId).slice(-5),teams:e.teams.map(t=>({power:t.power,heads:t.heads}))};
 };
 /** Đánh: kiểm tra đối thủ nằm trong danh sách đối thủ (hoặc báo thù), gắn snapshot vào context rồi chạy Store.mutate. */
 P.arenaFight=async function(userId,requestKey,mode,input){
  requireCondition(Object.hasOwn(arenaModes,mode),'Chế độ không tồn tại.',404);
  const user=await this.getUser(userId);requireCondition(user,'Tài khoản không tồn tại.',401);
  const opponentId=String(input?.opponentId||''),payload={mode,opponentId,revenge:!!input?.revenge,...(input?.formation?{formation:input.formation}:{}),...(input?.teams?{teams:input.teams}:{}),...(input?.skip===true?{skip:true}:{})};
  // Gửi lại cùng mã thao tác: trả kết quả đã lưu, không kiểm tra lại đối thủ (danh sách đã đổi sau trận).
  if(user.player.receipts?.some(r=>r.key===requestKey))return this.mutate(userId,requestKey,'arena-start',payload);
  const now=Date.now(),season=await this.arenaSeason(mode,now),entry=await this.arenaJoin(user,mode,now);requireCondition(entry,`Yêu cầu người chơi cấp độ ${arenaModes[mode].minLevel} trở lên.`,403,'LEVEL_REQUIRED');
  if(mode==='allstars')requireCondition(allstarPhase(now).phase==='group','Vòng bảng đã kết thúc',409,'GROUP_ENDED');
  let record=null;
  if(input?.revenge){record=await this.arenaRecords.findOne({userId:user._id,mode,season:season.id,'opponent.id':opponentId,attack:false,win:false,revenged:{$ne:true}});requireCondition(record,'Không thể báo thù trận này.',409,'NO_REVENGE')}
  else requireCondition((entry.rivals||[]).includes(opponentId),'Đối thủ không còn trong danh sách. Hãy làm mới.',409,'ARENA_RIVAL');
  const opp=await this.arenaEntries.findOne({_id:opponentId,mode,season:season.id});requireCondition(opp&&opp._id!==entry._id,'Đối thủ không tồn tại.',404);
  const context={arena:{mode,season:season.id,opponent:{id:opp._id,name:opp.name,avatar:opp.avatar,level:opp.level,teams:opp.teams}}};
  const data=await this.mutate(userId,requestKey,'arena-start',payload,context);
  if(record&&!data.replayed)await this.arenaRecords.updateOne({_id:record._id},{$set:{revenged:true}});
  if(!data.replayed)await this.arenaEntries.updateOne({_id:entry._id},{$unset:{rivals:1}});
  return data;
 };
 /** Sau mỗi thao tác đã lưu: trận Chiến trường vừa kết thúc thì chốt điểm (một lần cho mỗi battleId). */
 P.arenaAfter=async function(userId,before,next,result){
  let outcome=result?.arena;
  const b=next.battle;if(!outcome&&b?.arena&&b.status!=='active'&&!(before.battle?.id===b.id&&before.battle.status!=='active'))outcome={...b.arena,win:b.status==='won',battleId:b.id};
  if(!outcome)return null;
  return this.arenaSettle(userId,next,outcome);
 };
 P.arenaSettle=async function(userId,player,{mode,season,opponentId,win,battleId}){
  const meId=entryId(mode,season,userKey(userId)),[me,opp]=await Promise.all([this.arenaEntries.findOne({_id:meId}),this.arenaEntries.findOne({_id:opponentId})]);
  if(!me||!opp)return null;
  const at=new Date(),info=e=>({id:e._id,name:e.name,avatar:e.avatar,level:e.level});
  let delta=0;if(mode!=='allstars')delta=eloDelta(me.points,opp.points,win);
  try{await this.arenaRecords.insertOne({_id:new ObjectId(),userId,mode,season,battleId,at,attack:true,win,delta,opponent:info(opp)})}catch(e){if(e.code===11000)return null;throw e}
  if(mode==='allstars'){
   if(win&&opp.rank<me.rank){await this.arenaEntries.updateOne({_id:opp._id},{$set:{rank:me.rank}});await this.arenaEntries.updateOne({_id:me._id},{$set:{rank:opp.rank,updatedAt:at}})}
  }else{
   const clamp=d=>[{$set:{points:{$max:[0,{$add:['$points',d]}]},updatedAt:at}}];
   await this.arenaEntries.updateOne({_id:me._id},clamp(delta));await this.arenaEntries.updateOne({_id:opp._id},clamp(-delta));
  }
  if(opp.userId)await this.arenaRecords.insertOne({_id:new ObjectId(),userId:opp.userId,mode,season,battleId,at,attack:false,win:!win,delta:-delta,opponent:info(me)}).catch(e=>{if(e.code!==11000)throw e});
  return{delta,win,rankChanged:mode==='allstars'&&win&&opp.rank<me.rank?opp.rank:null};
 };
 // ---- Thư thưởng: ghi vào player có khóa phiên bản như mọi thao tác khác.
 P.arenaMail=async function(userId,mail){
  if(!userId||!mail.rewards?.length)return;
  for(let attempt=0;attempt<10;attempt++){
   const user=await this.getUser(userId);if(!user)return;
   const next=structuredClone(user.player);try{sendMail(next,mail)}catch{return}next.version++;
   const r=await this.users.updateOne({_id:user._id,'player.version':user.player.version},{$set:{player:next,updatedAt:new Date()}});if(r.modifiedCount)return;
  }
 };
 P.arenaMetaOnce=async function(id,fields={}){const r=await this.arenaMeta.updateOne({_id:id},{$setOnInsert:{at:new Date(),...fields}},{upsert:true});return r.upsertedCount===1};
 P.arenaPayRanks=async function(mode,season,rows,title,text,sort){
  const list=await this.arenaEntries.find({mode,season,hidden:{$ne:true}},{projection:{teams:0}}).sort(sort).toArray();
  for(let i=0;i<list.length;i++){const e=list[i];if(e.bot)continue;const rewards=typeof rows==='function'?rows(e,i+1):rewardFor(rows,i+1);await this.arenaMail(e.userId,{title,text:text(i+1,e),rewards})}
 };
 /** Định kỳ: thưởng ngày Đơn đấu (21:00 UTC), chốt mùa, điểm mỗi giờ và Vô song của Võ đấu. */
 P.arenaTick=async function(now=Date.now()){
  for(const mode of Object.keys(arenaModes))await this.arenaSeason(mode,now);
  const w=seasonWindow(now),day=dayKey(now);
  // Thưởng ngày: trao cho ngày vừa qua theo hạng hiện tại. Lần chạy đầu chỉ ghi mốc.
  const daily=await this.arenaMeta.findOne({_id:'solo:daily'});
  if(!daily)await this.arenaMeta.insertOne({_id:'solo:daily',day}).catch(()=>{});
  else if(daily.day<day&&(await this.arenaMeta.updateOne({_id:'solo:daily',day:daily.day},{$set:{day}})).modifiedCount){
   const season=seasonWindow(now-HOUR).id;
   await this.arenaPayRanks('solo',season,arenaData.solo.daily,'Thưởng ngày Đơn đấu',rank=>`Hạng ${rank} Giải thách đấu lúc 21:00. Chúc mừng thuyền trưởng!`,{points:-1,updatedAt:1,_id:1});
  }
  // Chốt mùa trước.
  const last=w.id-1;
  if(await this.arenaEntries.findOne({season:last,bot:{$ne:true}},{projection:{_id:1}})){
   if(await this.arenaMetaOnce(`solo:season:${last}`))await this.arenaPayRanks('solo',last,arenaData.solo.season,'Thưởng mùa Đơn đấu',rank=>`Kết thúc mùa Giải thách đấu, hạng ${rank}.`,{points:-1,updatedAt:1,_id:1});
   if(await this.arenaMetaOnce(`league:season:${last}`))await this.arenaPayRanks('league',last,arenaData.league.season,'Thưởng mùa Liên đấu',rank=>`Kết thúc mùa Giải liên đấu, hạng ${rank}.`,{points:-1,updatedAt:1,_id:1});
   if(await this.arenaMetaOnce(`allstars:season:${last}`))await this.arenaPayRanks('allstars',last,e=>allstarSeasonReward(e.apoints||0),'Thưởng mùa Võ đấu',(rank,e)=>`Võ đấu kết thúc với ${e.apoints||0} điểm tích lũy.`,{apoints:-1,rank:1});
  }
  await this.allstarAccrue(w,now);await this.allstarKnockout(w,now);
 };
 /** Vòng bảng Võ đấu: mỗi giờ cộng điểm theo hạng hiện tại (db_allstars_point). */
 P.allstarAccrue=async function(w,now){
  const end=Math.min(now,w.start+groupEndOffset),hour=Math.floor(end/HOUR),id=`allstars:accrue:${w.id}`;
  // Mốc tính điểm bắt đầu từ đầu mùa: lần chạy đầu tính bù các giờ đã qua của vòng bảng.
  let meta=await this.arenaMeta.findOne({_id:id});
  if(!meta){await this.arenaMeta.insertOne({_id:id,hour:Math.floor(w.start/HOUR)}).catch(()=>{});meta=await this.arenaMeta.findOne({_id:id})}
  const hours=hour-meta.hour;if(hours<=0)return;
  if(!(await this.arenaMeta.updateOne({_id:id,hour:meta.hour},{$set:{hour}})).modifiedCount)return;
  const rows=await this.arenaEntries.find({mode:'allstars',season:w.id},{projection:{rank:1}}).toArray();
  if(rows.length)await this.arenaEntries.bulkWrite(rows.map(r=>({updateOne:{filter:{_id:r._id},update:{$inc:{apoints:pointsPerHour(r.rank)*hours}}}})),{ordered:false});
 };
 /** Vô song: hết vòng bảng lấy 16 hạng đầu xếp cặp 1-16, 8-9, ...; tới giờ từng vòng thì đánh loạt 3 trận, trả cược, gửi thưởng. */
 P.allstarKnockout=async function(w,now){
  if(now<w.start+groupEndOffset)return;
  const id=`allstars:bracket:${w.id}`;let meta=await this.arenaMeta.findOne({_id:id});
  if(!meta){
   const top=await this.arenaEntries.find({mode:'allstars',season:w.id,hidden:{$ne:true}},{projection:{_id:1}}).sort({rank:1}).limit(knockoutSize).toArray();
   const seeds=[1,16,8,9,5,12,4,13,3,14,6,11,7,10,2,15].map(n=>top[n-1]?._id||null);
   const matches=Array.from({length:8},(_,i)=>({id:`r16-${i+1}`,round:'r16',a:seeds[i*2],b:seeds[i*2+1],winner:null,score:null,top:null}));
   await this.arenaMeta.insertOne({_id:id,rounds:{r16:matches,qf:[],sf:[],final:[]},resolved:[]}).catch(()=>{});meta=await this.arenaMeta.findOne({_id:id});
  }
  for(const [index,round] of knockoutRounds.entries()){
   if(now<w.start+round.at||meta.resolved.includes(round.id))continue;
   if(!(await this.arenaMeta.updateOne({_id:id,resolved:{$ne:round.id}},{$addToSet:{resolved:round.id}})).modifiedCount)continue;
   const matches=meta.rounds[round.id],ids=matches.flatMap(m=>[m.a,m.b]).filter(Boolean),entries=new Map((await this.arenaEntries.find({_id:{$in:ids}}).toArray()).map(e=>[e._id,e]));
   for(const m of matches){
    const a=entries.get(m.a),b=entries.get(m.b);
    if(a&&b){const s=series(a.teams.map(t=>t.units),b.teams.map(t=>t.units),[...m.id].reduce((n,c)=>n*31+c.charCodeAt(0),w.id)>>>0);m.winner=s.win?a._id:b._id;m.score=s.score;m.top=s.bouts.at(-1).topDamage}
    else{m.winner=a?a._id:b?b._id:null;m.score=null;m.top=null}
    const loser=m.winner===m.a?b:a;
    if(loser&&!loser.bot)await this.arenaMail(loser.userId,{title:'Thưởng Vô song Võ đấu',text:`Dừng bước tại ${round.name}.`,rewards:knockoutReward(4-index)});
    if(round.id==='final'){const champ=entries.get(m.winner);if(champ&&!champ.bot)await this.arenaMail(champ.userId,{title:'Thưởng Vô song Võ đấu',text:'Vô địch Đấu trường Corrida!',rewards:knockoutReward(0)})}
    await this.allstarPayBets(w.id,m);
   }
   const next=knockoutRounds[index+1],set={[`rounds.${round.id}`]:matches};
   if(next)set[`rounds.${next.id}`]=Array.from({length:matches.length/2},(_,i)=>({id:`${next.id}-${i+1}`,round:next.id,a:matches[i*2].winner,b:matches[i*2+1].winner,winner:null,score:null,top:null}));
   await this.arenaMeta.updateOne({_id:id},{$set:set});meta=await this.arenaMeta.findOne({_id:id});
  }
 };
 P.allstarPayBets=async function(season,m){
  const bets=await this.allstarBets.find({season,matchId:m.id,settled:{$ne:true}}).toArray();
  for(const bet of bets){
   await this.allstarBets.updateOne({_id:bet._id},{$set:{settled:true,result:m.top===null?null:m.top%2===0?'even':'odd'}});
   const won=m.top!==null&&(m.top%2===0?'even':'odd')===bet.pick,refund=m.top===null;
   if(won||refund)await this.arenaMail(bet.userId,{title:'Cược Võ đấu',text:refund?'Trận đấu không diễn ra, hoàn lại tiền cược.':'Bạn đã đoán đúng kết quả trận đấu!',rewards:[{itemId:'consumable:40',quantity:refund?bet.amount:bet.amount*2}]});
  }
 };
 /** Nhánh Vô song cho popup Kết quả / Vòng 1/16 / Tứ kết / Bán kết / Chung kết. */
 P.allstarBracket=async function(userId){
  const now=Date.now(),w=seasonWindow(now),meta=await this.arenaMeta.findOne({_id:`allstars:bracket:${w.id}`});
  const ids=meta?Object.values(meta.rounds).flat().flatMap(m=>[m.a,m.b]).filter(Boolean):[],entries=new Map((await this.arenaEntries.find({_id:{$in:ids}},{projection:{teams:0}}).toArray()).map(e=>[e._id,publicEntry(e,e.rank)]));
  const bets=userId?await this.allstarBets.find({userId:new ObjectId(userId),season:w.id}).toArray():[];
  return{now,phase:allstarPhase(now),rounds:knockoutRounds.map(r=>({id:r.id,name:r.name,at:w.start+r.at,resolved:!!meta?.resolved.includes(r.id),matches:(meta?.rounds[r.id]||[]).map(m=>({id:m.id,a:entries.get(m.a)||null,b:entries.get(m.b)||null,winner:m.winner,score:m.score,parity:m.top===null||m.top===undefined?null:m.top%2===0?'even':'odd',bet:bets.find(b=>b.matchId===m.id)?.pick||null}))})),
   bets:bets.map(b=>({matchId:b.matchId,pick:b.pick,amount:b.amount,result:b.result??null,settled:!!b.settled}))};
 };
 P.allstarBet=async function(userId,requestKey,input){
  const now=Date.now(),w=seasonWindow(now),meta=await this.arenaMeta.findOne({_id:`allstars:bracket:${w.id}`}),matchId=String(input?.matchId||'');
  const match=meta&&Object.values(meta.rounds).flat().find(m=>m.id===matchId),round=match&&knockoutRounds.find(r=>r.id===match.round);
  const open=!!(match&&match.a&&match.b&&!meta.resolved.includes(match.round)&&now<w.start+round.at);
  requireCondition(open,'Trận này không nhận cược.',409,'BET_CLOSED');
  requireCondition(!await this.allstarBets.findOne({season:w.id,matchId,userId:new ObjectId(userId)}),'Bạn đã cược trận này.',409,'BET_EXISTS');
  const data=await this.mutate(userId,requestKey,'allstar-bet',{matchId,pick:input?.pick},{bet:{open,matchId}});
  if(!data.replayed)await this.allstarBets.insertOne({season:w.id,matchId,userId:new ObjectId(userId),pick:data.result.bet.pick,amount:data.result.bet.amount,at:new Date()}).catch(e=>{if(e.code!==11000)throw e});
  return data;
 };
}
export {randomUUID};
