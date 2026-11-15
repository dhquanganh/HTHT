// Đấu Trường Tân Tinh trên MongoDB: nova_entries (người tham gia + bot của mùa), nova_meta (nhóm, bảng 16, đã xử lý),
// nova_bets (dự đoán vòng 16). Mọi giai đoạn tự xử lý theo giờ (novaTick, mỗi 30 giây và trước mỗi yêu cầu):
//   - Đầu mỗi vòng: chia nhóm (vòng loại 1 lấy người đăng ký + bot đủ 256 suất; vòng sau lấy người đi tiếp).
//   - Hết vòng: lượt chưa đánh tự đánh (có người thật thì mô phỏng loạt 3 trận thật, bot gặp bot theo lực chiến),
//     xếp hạng nhóm, top đi tiếp, gửi thưởng vòng qua thư.
//   - Vòng 16 thứ Bảy: bảng theo hạt giống, xử lý 20:00 / 20:30 / 21:00 / 21:30, trả thưởng dự đoán, thưởng xếp hạng cuối.
import {ObjectId} from 'mongodb';
import {requireCondition} from './errors.mjs';
import {heroDefinitions,heroKits,definitionFor} from './catalog.mjs';
import {series} from './arena.mjs';
import {botEntryFor} from './arena-store.mjs';
import {novaSnapshot} from './game.mjs';
import {schedule,scheduleRows,stages,finalRounds,stageNames,novaConfig,rankGroup,quickSeries,seeded,bracketSeeds,applyNovaBuff,questView,novaPlayerState,currency} from './nova.mjs';

const fieldSize=stages[1].field;
const key=(season,k)=>`${season}:${k}`;
const pub=e=>e&&({id:e._id,name:e.name,avatar:e.avatar,level:e.level,power:e.power,bot:!!e.bot,heads:e.teams?.[0]?.heads?.slice(0,3)||[]});
/** Tướng đề xuất của mùa: nhóm quản trị chọn, không có thì lấy ngẫu nhiên cố định theo mùa trong các tướng có bộ kỹ năng. */
export function recommendHeroes(season){
 const c=novaConfig(),pool=c.recommendPool.length?c.recommendPool:heroDefinitions.filter(d=>heroKits.has(d.id)&&d.rank>=5).map(d=>d.id);
 const r=seeded(season*2654435761),list=[...pool],out=[];while(out.length<Math.min(c.recommendCount,list.length)){out.push(list.splice(Math.floor(r()*list.length),1)[0])}
 return out;
}

export function installNova(Store){
 const P=Store.prototype;
 // Đồng hồ của Tân Tinh (kiểm thử đặt store.novaTime để chạy theo mốc giờ giả lập).
 P.novaClock=function(){return this.novaTime??Date.now()};
 P.setupNova=async function(){
  // QA trình duyệt: NOVA_QA_TIME (ms) cố định đồng hồ Tân Tinh; không dùng khi NODE_ENV=production.
  if(process.env.NOVA_QA_TIME&&process.env.NODE_ENV!=='production')this.novaTime=Number(process.env.NOVA_QA_TIME);
  this.novaEntries=this.db.collection('nova_entries');this.novaMeta=this.db.collection('nova_meta');this.novaBets=this.db.collection('nova_bets');
  await this.novaEntries.createIndex({season:1,userId:1});await this.novaEntries.createIndex({season:1,'groups.1':1});
  await this.novaBets.createIndex({season:1,matchId:1,userId:1},{unique:true});
  this.novaTick().catch(e=>console.error(JSON.stringify({event:'nova_tick_failed',message:e.message})));
  this.novaTimer=setInterval(()=>this.novaTick().catch(e=>console.error(JSON.stringify({event:'nova_tick_failed',message:e.message}))),30000);this.novaTimer.unref();
 };
 const metaId=season=>'season:'+season;
 P.novaMetaDoc=async function(season){return await this.novaMeta.findOne({_id:metaId(season)})||{_id:metaId(season),formed:[],resolved:[],bracket:null,finalResolved:[],top4:[]}};
 /** Một lần cho mỗi bước (khóa trong nova_meta), an toàn khi chạy song song. */
 P.novaOnce=async function(season,field,value){const r=await this.novaMeta.updateOne({_id:metaId(season),[field]:{$ne:value}},{$addToSet:{[field]:value}},{upsert:false}).catch(()=>({modifiedCount:0}));
  if(r.matchedCount===0){try{await this.novaMeta.insertOne({_id:metaId(season),formed:[],resolved:[],finalResolved:[],top4:[],[field]:[value]});return true}catch{return false}}return r.modifiedCount>0};
 // Một tick tại một thời điểm trong tiến trình: hai lượt chạy song song có thể giải tứ kết trước khi vòng 16 ghi xong.
 P.novaTick=function(now=this.novaClock()){
  const run=()=>this.novaTickRun(now);
  this.novaRunning=(this.novaRunning||Promise.resolve()).then(run,run);return this.novaRunning;
 };
 P.novaTickRun=async function(now){
  const s=schedule(now);
  // Mùa trước chưa xong (server tắt): chạy nốt tới cuối mùa.
  if(s.season>1)await this.novaAdvance(s.season-1,schedule(s.start-1),s.start-1);
  await this.novaAdvance(s.season,s,now);
 };
 /** Mùa không có ai đăng ký thì bỏ qua (không dựng 256 bot, không giải đấu) — tránh tốn thời gian khởi động server. */
 P.novaHasPlayers=async function(season){
  this.novaSeasons??=new Set();if(this.novaSeasons.has(season))return true;
  const any=await this.novaEntries.findOne({season,bot:{$ne:true},registered:true},{projection:{_id:1}});if(any)this.novaSeasons.add(season);return !!any;
 };
 P.novaAdvance=async function(season,s,now){
  const start=s.start,DAY=86400000;
  if(now<start+DAY||!await this.novaHasPlayers(season))return;
  for(let k=1;k<=4;k++){
   if(now>=start+k*DAY&&await this.novaOnce(season,'formed',k))await this.novaForm(season,k);
   if(now>=start+(k+1)*DAY&&await this.novaOnce(season,'resolved',k))await this.novaResolve(season,k);
  }
  if(now>=start+5*DAY&&await this.novaOnce(season,'formed',5))await this.novaFormBracket(season);
  for(const r of finalRounds)if(now>=start+5*DAY+r.at*60000&&await this.novaOnce(season,'finalResolved',r.id))await this.novaResolveRound(season,r.id);
 };
 // ---- Vòng loại / vòng bảng
 P.novaForm=async function(season,k){
  let field;
  if(k===1){
   field=await this.novaEntries.find({season,bot:{$ne:true},registered:true}).toArray();
   const real=field.length,need=Math.max(0,fieldSize-real),c=novaConfig();
   const bots=Array.from({length:need},(_,i)=>{const d=botEntryFor('league',100000+season,i,fieldSize,c.botBoost);return{_id:key(season,'bot'+i),season,userId:null,bot:true,registered:true,name:d.name,avatar:d.avatar,level:d.level,power:d.power,teams:d.teams,groups:{},results:{},likes:0}});
   if(bots.length)await this.novaEntries.insertMany(bots,{ordered:false}).catch(()=>{});
   field=await this.novaEntries.find({season,registered:true}).toArray();
   if(field.length>fieldSize)field=field.sort((a,b)=>(a.bot?1:0)-(b.bot?1:0)||b.power-a.power).slice(0,fieldSize);
  }else field=await this.novaEntries.find({season,stage:{$gte:k}}).toArray();
  const r=seeded(season*31+k*7),ordered=field.map(e=>[r(),e]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]),size=stages[k].group;
  const ops=ordered.map((e,i)=>({updateOne:{filter:{_id:e._id},update:{$set:{[`groups.${k}`]:Math.floor(i/size)+1,stage:k,[`results.${k}`]:{wins:0,losses:0,teamWins:0,attacks:{}}}}}}));
  if(ops.length)await this.novaEntries.bulkWrite(ops);
 };
 /** Một trận: có người thật thì mô phỏng loạt 3 trận thật bằng đội đã lưu, bot gặp bot thì theo lực chiến. */
 const fight=(a,b,seed,recommend)=>{
  if(a.bot&&b.bot)return quickSeries(a.power,b.power,seeded(seed));
  const t=e=>e.teams.map(x=>applyNovaBuff(structuredClone(x.units),recommend));const r=series(t(a),t(b),seed>>>0);return{win:r.win,score:r.score};
 };
 P.novaResolve=async function(season,k){
  const all=await this.novaEntries.find({season,[`groups.${k}`]:{$exists:true},stage:{$gte:k}}).toArray(),groups=new Map(),recommend=recommendHeroes(season);
  for(const e of all){const g=e.groups[k];if(!groups.has(g))groups.set(g,[]);groups.get(g).push(e)}
  const ops=[],mails=[],c=novaConfig(),at=this.novaClock();
  for(const [g,members] of groups){
   for(const a of members){const res=a.results[k];
    for(const b of members){if(a._id===b._id||res.attacks[b._id])continue;
     const r=fight(a,b,(season*1000003+k*7919+Number(g)*104729+[...a._id+b._id].reduce((n,ch)=>n*31+ch.charCodeAt(0),7))>>>0,recommend);
     res.attacks[b._id]={win:r.win,score:r.score,at,auto:true};if(r.win){res.wins++;res.lastWin=at}else res.losses++;res.teamWins+=r.score[0]}}
   const ranked=rankGroup(members.map(e=>({id:e._id,...e.results[k],entry:e})));
   ranked.forEach((m,i)=>{const adv=i<stages[k].advance,e=m.entry;
    ops.push({updateOne:{filter:{_id:e._id},update:{$set:{[`results.${k}`]:{...e.results[k],rank:i+1},stage:adv?k+1:k,...(adv?{}:{out:k}),[`seed.${k}`]:i+1}}}});
    if(e.userId){const rw=c.stageRewards[k-1];mails.push({userId:e.userId,mail:{title:`Đấu Trường Tân Tinh · ${stages[k].name}`,text:adv?`Hạng ${i+1} nhóm ${g}: đi tiếp vào vòng sau!`:`Hạng ${i+1} nhóm ${g}: dừng bước tại ${stages[k].name}.`,rewards:adv?rw.advance:rw.out}})}});
  }
  if(ops.length)await this.novaEntries.bulkWrite(ops);
  for(const m of mails)await this.arenaMail(m.userId,m.mail);
 };
 // ---- Vòng 16
 P.novaFormBracket=async function(season){
  const field=(await this.novaEntries.find({season,stage:{$gte:5}}).toArray()).sort((a,b)=>(a.seed?.[4]||9)-(b.seed?.[4]||9)||b.power-a.power).slice(0,16);
  const seeds=bracketSeeds.map(n=>field[n-1]?._id||null);
  const r16=Array.from({length:8},(_,i)=>({id:`r16-${i+1}`,round:'r16',a:seeds[i*2],b:seeds[i*2+1],winner:null,score:null}));
  await this.novaMeta.updateOne({_id:metaId(season)},{$set:{bracket:{r16,qf:[],sf:[],final:[]}}});
 };
 P.novaResolveRound=async function(season,roundId){
  const meta=await this.novaMetaDoc(season);if(!meta.bracket?.[roundId]?.length)return;const matches=meta.bracket[roundId],recommend=recommendHeroes(season),c=novaConfig();
  const ids=matches.flatMap(m=>[m.a,m.b]).filter(Boolean),entries=new Map((await this.novaEntries.find({_id:{$in:ids}}).toArray()).map(e=>[e._id,e]));
  const place={r16:4,qf:3,sf:2};
  for(const m of matches){
   const a=entries.get(m.a),b=entries.get(m.b);
   if(a&&b){const r=fight(a,b,[...m.id].reduce((n,ch)=>n*31+ch.charCodeAt(0),season*7919)>>>0,recommend);m.winner=r.win?a._id:b._id;m.score=r.score}else{m.winner=a?a._id:b?b._id:null;m.score=null}
   const loser=m.winner===m.a?b:a;
   if(loser){await this.novaEntries.updateOne({_id:loser._id},{$set:{out:5,finalPlace:place[roundId]??1}});if(loser.userId&&place[roundId]!==undefined)await this.arenaMail(loser.userId,{title:'Đấu Trường Tân Tinh',text:`Dừng bước tại ${finalRounds.find(r=>r.id===roundId).name}.`,rewards:c.finalRewards[place[roundId]]})}
   if(roundId==='final'){const w=entries.get(m.winner);if(w){await this.novaEntries.updateOne({_id:w._id},{$set:{finalPlace:0}});if(w.userId)await this.arenaMail(w.userId,{title:'Đấu Trường Tân Tinh',text:'Vô địch Đấu Trường Tân Tinh!',rewards:c.finalRewards[0]})}}
   await this.novaPayBets(season,m);
  }
  const index=finalRounds.findIndex(r=>r.id===roundId),next=finalRounds[index+1],set={[`bracket.${roundId}`]:matches};
  if(next)set[`bracket.${next.id}`]=Array.from({length:matches.length/2},(_,i)=>({id:`${next.id}-${i+1}`,round:next.id,a:matches[i*2].winner,b:matches[i*2+1].winner,winner:null,score:null}));
  else{const sf=meta.bracket.sf.map(x=>x.winner===x.a?x.b:x.a);set.top4=[matches[0].winner,matches[0].winner===matches[0].a?matches[0].b:matches[0].a,...sf].filter(Boolean)}
  await this.novaMeta.updateOne({_id:metaId(season)},{$set:set});
 };
 P.novaPayBets=async function(season,m){
  const bets=await this.novaBets.find({season,matchId:m.id,settled:{$ne:true}}).toArray(),c=novaConfig();
  for(const bet of bets){const correct=bet.pick===m.winner;await this.novaBets.updateOne({_id:bet._id},{$set:{settled:true,correct,winner:m.winner}});
   await this.arenaMail(bet.userId,{title:'Dự đoán Đấu Trường Tân Tinh',text:correct?'Dự đoán chính xác!':'Dự đoán chưa chính xác.',rewards:correct?c.bet.correct:c.bet.wrong})}
 };

 // ---- Màn chính: toàn bộ dữ liệu một lần (NOVA_GLOBAL_STATUS + REGISTER / BOARD / FINAL_STATUS + bảng + cược)
 P.novaStatus=async function(userId){
  await this.novaTick();
  const user=await this.getUser(userId);requireCondition(user,'Tài khoản không tồn tại.',401);
  const now=this.novaClock(),s=schedule(now),c=novaConfig(),target=s.status===-1?s.season+1:s.season,recommend=recommendHeroes(s.status===-1?target:s.season);
  const me=await this.novaEntries.findOne({_id:key(s.season,String(userId))}),next=s.status===-1?await this.novaEntries.findOne({_id:key(target,String(userId))}):null;
  const ps=novaPlayerState(structuredClone(user.player),s.season);
  const out={now,enabled:c.enabled!==false,season:s.season,status:s.status,state:s.state,countdown:s.countdown,textMain:String(s.season),textSub:s.textSub,minLevel:c.minLevel,level:user.player.account.level,
   power:me?.power??null,team:user.player.nova?.team||null,registered:!!(s.status===-1?next:me)?.registered,recommend,buff:c.buff,currency,
   quests:questView(ps.quests),shop:c.shop.map(x=>({...x,bought:ps.shop[x.id]||0})),likes:ps.likes,stageNames,
   rewards:{register:c.register,stages:c.stageRewards,final:c.finalRewards,bet:c.bet}};
  if(me&&s.status>=1&&s.status<=4){
   const k=s.status,res=me.results?.[k],g=me.groups?.[k];
   if(g&&me.stage>=k){const members=await this.novaEntries.find({season:s.season,[`groups.${k}`]:g}).toArray(),ranked=rankGroup(members.map(e=>({id:e._id,...e.results?.[k]})));
    out.board={group:g,wins:res?.wins||0,losses:res?.losses||0,matches:members.length-1-Object.keys(res?.attacks||{}).length,rank:ranked.findIndex(x=>x.id===me._id)+1,
     opponents:members.filter(e=>e._id!==me._id).map(e=>({...pub(e),attacked:!!res?.attacks?.[e._id],...(res?.attacks?.[e._id]||{})}))}}
   else out.board={group:0,eliminated:me.out||null};
  }
  if(s.status===5||s.status===-1){const meta=await this.novaMetaDoc(s.status===-1?s.season:s.season);if(meta.bracket){
   const ids=Object.values(meta.bracket).flat().flatMap(m=>[m.a,m.b]),ents=new Map((await this.novaEntries.find({_id:{$in:ids.filter(Boolean)}}).toArray()).map(e=>[e._id,pub(e)]));
   const bets=await this.novaBets.find({season:s.season,userId:user._id}).toArray(),counts=await this.novaBets.aggregate([{$match:{season:s.season}},{$group:{_id:{m:'$matchId',p:'$pick'},n:{$sum:1}}}]).toArray();
   const count=(m,p)=>counts.find(x=>x._id.m===m&&x._id.p===p)?.n||0;
   out.bracket=Object.fromEntries(finalRounds.map(r=>[r.id,(meta.bracket[r.id]||[]).map(m=>({...m,a:ents.get(m.a)||null,b:ents.get(m.b)||null,betsA:count(m.id,m.a),betsB:count(m.id,m.b),mine:bets.find(x=>x.matchId===m.id)?.pick||null,at:s.roundAt(r.id)}))]));
   out.top16=!!me&&me.stage>=5;}}
  return out;
 };
 const novaContext=async(store,season,extra={})=>({nova:{season,recommend:recommendHeroes(season),...extra}});
 /** Lưu đội hình = đăng ký (giai đoạn Đăng ký / ngày nghỉ cho mùa sau); khi đang thi đấu thì cập nhật đội của mình. */
 P.novaTeam=async function(userId,requestKey,input){
  const s=schedule(this.novaClock()),target=s.status===-1?s.season+1:s.season,data=await this.mutate(userId,requestKey,'nova-team',input,await novaContext(this,s.season));
  const user=await this.getUser(userId),snap=novaSnapshot(user.player),id=key(target,String(userId)),existing=await this.novaEntries.findOne({_id:id});
  const fields={name:snap.displayName,avatar:snap.avatar,level:snap.level,power:snap.power,teams:snap.teams};
  if(existing)await this.novaEntries.updateOne({_id:id},{$set:fields});
  else if(s.status===0||s.status===-1)await this.novaEntries.insertOne({_id:id,season:target,userId:user._id,bot:false,registered:true,...fields,groups:{},results:{},likes:0});
  return data;
 };
 P.novaAttack=async function(userId,requestKey,input){
  const s=schedule(this.novaClock());requireCondition(s.status>=1&&s.status<=4,'Không trong vòng đấu.',409,'NOVA_STAGE');
  requireCondition(s.state===2,s.state===1?'Đang trong thời gian chuẩn bị':'Đang trong thời gian đánh tự động',409,'NOVA_STATE');
  const k=s.status,me=await this.novaEntries.findOne({_id:key(s.season,String(userId))});requireCondition(me&&me.stage>=k&&me.groups?.[k],'Không đủ điều kiện tham gia',403,'NOVA_NOT_IN');
  const opp=await this.novaEntries.findOne({_id:String(input?.opponentId||''),season:s.season});requireCondition(opp&&opp._id!==me._id&&opp.groups?.[k]===me.groups[k],'Đối thủ không trong nhóm.',404);
  requireCondition(!me.results?.[k]?.attacks?.[opp._id],'Đã khiêu chiến đối thủ này.',409,'NOVA_DONE');
  const data=await this.mutate(userId,requestKey,'nova-attack',{opponentId:opp._id},await novaContext(this,s.season,{opponent:{id:opp._id,teams:opp.teams}}));
  const r=data.result?.nova;
  if(r&&!data.replayed){const at=this.novaClock(),path=`results.${k}`;
   await this.novaEntries.updateOne({_id:me._id,[`${path}.attacks.${opp._id}`]:{$exists:false}},{$set:{[`${path}.attacks.${opp._id}`]:{win:r.win,score:r.score,at,bouts:r.bouts}},$inc:{[`${path}.wins`]:r.win?1:0,[`${path}.losses`]:r.win?0:1,[`${path}.teamWins`]:r.score[0]},...(r.win?{$max:{[`${path}.lastWin`]:at}}:{})})}
  return data;
 };
 P.novaBet=async function(userId,requestKey,input){
  const s=schedule(this.novaClock());requireCondition(s.status===5&&s.state<=3,'Không trong thời gian dự đoán.',409,'NOVA_BET_TIME');
  const meta=await this.novaMetaDoc(s.season),m=Object.values(meta.bracket||{}).flat().find(x=>x.id===input?.matchId);requireCondition(m&&m.a&&m.b&&!m.winner,'Trận không thể dự đoán.',409);
  requireCondition(this.novaClock()<s.roundAt(m.round),'Trận đã bắt đầu.',409,'NOVA_BET_CLOSED');requireCondition([m.a,m.b].includes(input.pick),'Lựa chọn không hợp lệ.');
  const user=await this.getUser(userId);
  try{await this.novaBets.insertOne({_id:new ObjectId(),season:s.season,matchId:m.id,userId:user._id,pick:input.pick,at:new Date()})}catch(e){if(e.code===11000)requireCondition(false,'Bạn đã dự đoán trận này.',409,'NOVA_BET_DONE');throw e}
  return this.mutate(userId,requestKey,'nova-bet',{matchId:m.id},await novaContext(this,s.season));
 };
 /** Vinh danh (NOVA_TOP_LIST): top 4 các mùa đã xong, số lượt thích. */
 P.novaTop=async function(){
  const metas=await this.novaMeta.find({top4:{$exists:true,$ne:[]}}).sort({_id:-1}).limit(5).toArray();
  return Promise.all(metas.map(async m=>{const ents=await this.novaEntries.find({_id:{$in:m.top4}}).toArray();return{season:Number(m._id.split(':')[1]),players:m.top4.map(id=>{const e=ents.find(x=>x._id===id);return e&&{...pub(e),likes:e.likes||0}}).filter(Boolean)}}));
 };
 P.novaLike=async function(userId,requestKey,input){
  const s=schedule(this.novaClock()),id=String(input?.entryId||''),e=await this.novaEntries.findOne({_id:id});requireCondition(e,'Người chơi không tồn tại.',404);
  const data=await this.mutate(userId,requestKey,'nova-like',{userId:id},await novaContext(this,s.season));
  if(!data.replayed)await this.novaEntries.updateOne({_id:id},{$inc:{likes:1}});return data;
 };
 /** Xếp hạng (NOVA_RANK_GLOBAL_LIST + NOVA_RANK_LIST): mỗi vòng các nhóm; nhóm chọn thì thứ hạng thành viên. */
 P.novaRanks=async function(userId,stage,group){
  const s=schedule(this.novaClock()),k=Math.max(1,Math.min(4,Number(stage)||Math.max(1,Math.min(4,s.status)))),me=await this.novaEntries.findOne({_id:key(s.season,String(userId))});
  const groups=(await this.novaEntries.distinct(`groups.${k}`,{season:s.season})).filter(Boolean).sort((a,b)=>a-b),g=Number(group)||me?.groups?.[k]||groups[0]||1;
  const members=await this.novaEntries.find({season:s.season,[`groups.${k}`]:g}).toArray();
  return{stage:k,groups:groups.length,group:g,myGroup:me?.groups?.[k]||0,advance:stages[k].advance,rows:rankGroup(members.map(e=>({id:e._id,...e.results?.[k]}))).map((x,i)=>({rank:i+1,...pub(members.find(e=>e._id===x.id)),wins:x.wins||0,losses:x.losses||0,teamWins:x.teamWins||0,me:x.id===me?._id}))};
 };
 /** Kết quả trận (NOVA_HISTORY_LIST): trận mình khiêu chiến theo vòng. */
 P.novaHistory=async function(userId){
  const s=schedule(this.novaClock()),me=await this.novaEntries.findOne({_id:key(s.season,String(userId))});if(!me)return{rounds:[]};
  const ids=Object.values(me.results||{}).flatMap(r=>Object.keys(r.attacks||{})),ents=new Map((await this.novaEntries.find({_id:{$in:ids}}).toArray()).map(e=>[e._id,pub(e)]));
  return{rounds:[1,2,3,4].filter(k=>me.results?.[k]).map(k=>({stage:k,name:stages[k].name,rows:Object.entries(me.results[k].attacks||{}).map(([id,r])=>({...r,opponent:ents.get(id)})).sort((a,b)=>b.at-a.at)}))};
 };
 P.novaSchedule=async function(){const now=this.novaClock();return{rows:scheduleRows(now),textSub:schedule(now).textSub}};
}
