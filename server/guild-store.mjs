// Hạm đội trên MongoDB: collection guilds (thông tin, thành viên, đơn xin vào, nhật ký, boss chung) và guild_hits (mỗi trận
// đánh boss chỉ được trừ máu một lần). Thao tác chạm tới player (trả phí, thưởng, kỹ năng) chạy qua Store.mutate với context
// hạm đội đã kiểm tra; phần chung (EXP, máu boss, thành viên) cập nhật ở đây.
import {ObjectId} from 'mongodb';
import {requireCondition,GameError} from './errors.mjs';
import {sendMail} from './mail.mjs';
import {definitionFor} from './catalog.mjs';
import {roles,expToNext,maxGuildLevel,memberLimit,stageHp,stageData,bossPower,finalReward,guildCoin,validName,guildData,nextVnDay} from './guild.mjs';
import {guildBossDamage} from './game.mjs';

const ONLINE=5*60000;
const memberInfo=user=>({userId:user._id,name:user.player.displayName,avatar:definitionFor(user.player.hero.id).avatar,level:user.player.account.level});
const hex=id=>String(id);
export function installGuild(Store){
 const P=Store.prototype;
 P.setupGuild=async function(){
  this.guilds=this.db.collection('guilds');this.guildHits=this.db.collection('guild_hits');
  // Sát thương Boss hạm đội theo ải: mỗi thành viên một dòng / ải, cộng dồn qua các lượt; giữ lại sau khi hạ boss để xem bảng xếp hạng ải cũ.
  this.guildDamage=this.db.collection('guild_boss_damage');await this.guildDamage.createIndex({guildId:1,stage:1,userId:1},{unique:true});await this.guildDamage.createIndex({guildId:1,stage:1,damage:-1});
  await this.guilds.createIndex({nameKey:1},{unique:true});await this.guilds.createIndex({shortId:1},{unique:true});await this.guilds.createIndex({'members.userId':1});await this.guilds.createIndex({'applications.userId':1});
 };
 // Hạm đội đã hạ ải boss cuối (cleared) mà quản trị thêm ải mới sau đó: tự mở ải kế khi đọc hạm đội.
P.guildOf=async function(userId){
 const g=await this.guilds.findOne({'members.userId':new ObjectId(hex(userId))});
 if(!g?.boss?.cleared||g.boss.stage>=guildData.stages.length)return g;
 const next=g.boss.stage+1;
 await this.guilds.updateOne({_id:g._id,'boss.stage':g.boss.stage,'boss.cleared':true},{$set:{boss:{stage:next,hp:stageHp(next),damage:{},cleared:false,kills:g.boss.kills||{}}}});
 await this.guildLog(g._id,`Boss hạm đội mở ải mới ${next}.`);
 return this.guilds.findOne({_id:g._id});
};
 /** Ghi vào player có khóa phiên bản (thư thưởng, vào / rời hạm đội do người khác duyệt). */
 P.guildPlayer=async function(userId,change){
  for(let attempt=0;attempt<10;attempt++){
   const user=await this.getUser(userId);if(!user)return false;const next=structuredClone(user.player);if(change(next)===false)return false;next.version++;
   const r=await this.users.updateOne({_id:user._id,'player.version':user.player.version},{$set:{player:next,updatedAt:new Date()}});if(r.modifiedCount)return true;
  }
  return false;
 };
 P.guildMail=function(userId,mail){return this.guildPlayer(userId,p=>{try{sendMail(p,mail)}catch{return false}})};
 P.guildLog=function(id,text){return this.guilds.updateOne({_id:id},{$push:{log:{$each:[{at:new Date(),text}],$slice:-60}}})};
 /** Context cho Store.mutate: hạm đội thật trong database (người chơi phải là thành viên). */
 P.guildContext=async function(userId){
  const g=await this.guildOf(userId);requireCondition(g,'Hãy tạo hoặc gia nhập hạm đội',409,'NO_GUILD');
  return{guild:{id:hex(g._id),level:g.level,boss:g.boss}};
 };
 P.guildRole=function(g,userId){return g.members.find(m=>m.userId.equals(new ObjectId(hex(userId))))?.role||null};
 P.guildView=function(g,userId){
  const now=Date.now(),boss=g.boss,max=stageHp(boss.stage).reduce((a,b)=>a+b,0),left=boss.hp.reduce((a,b)=>a+Math.max(0,b),0);
  return{id:hex(g._id),shortId:g.shortId,name:g.name,flag:g.flag,level:g.level,exp:g.exp,expNext:expToNext(g.level),maxLevel:maxGuildLevel,notice:g.notice||'',memberLimit:memberLimit(g.level),
   role:this.guildRole(g,userId),roleName:roles[this.guildRole(g,userId)]||'',
   members:g.members.map(m=>({id:hex(m.userId),name:m.name,avatar:m.avatar,level:m.level,role:m.role,roleName:roles[m.role],dedication:m.dedication||0,online:now-(m.lastSeen?.getTime?.()||0)<ONLINE,lastSeen:m.lastSeen,me:m.userId.equals(new ObjectId(hex(userId)))}))
    .sort((a,b)=>['leader','vice','member'].indexOf(a.role)-['leader','vice','member'].indexOf(b.role)||b.dedication-a.dedication),
   applications:['leader','vice'].includes(this.guildRole(g,userId))?(g.applications||[]).map(a=>({id:hex(a.userId),name:a.name,avatar:a.avatar,level:a.level,at:a.at})):[],
   boss:{stage:boss.stage,stages:guildData.stages.length,hpPercent:max?Math.ceil(left/max*100):0,resetAt:nextVnDay(now)},log:(g.log||[]).slice().reverse()};
 };
 /** Trạng thái hạm đội của người chơi; tự sửa player.guild.id nếu đã bị khai trừ / hạm đội giải tán. */
 P.guildStatus=async function(userId){
  const user=await this.getUser(userId);requireCondition(user,'Tài khoản không tồn tại.',401);
  const g=await this.guildOf(user._id),cached=user.player.guild?.id||null;
  if(!g&&cached)await this.guildPlayer(user._id,p=>{if(p.guild?.id!==cached)return false;p.guild.id=null});
  if(g&&cached!==hex(g._id))await this.guildPlayer(user._id,p=>{p.guild??={};p.guild.id=hex(g._id)});
  if(g)await this.guilds.updateOne({_id:g._id,'members.userId':user._id},{$set:{'members.$.lastSeen':new Date(),'members.$.name':user.player.displayName,'members.$.level':user.player.account.level,'members.$.avatar':definitionFor(user.player.hero.id).avatar}});
  const fresh=g&&await this.guilds.findOne({_id:g._id});
  const applied=g?[]:(await this.guilds.find({'applications.userId':user._id},{projection:{_id:1}}).toArray()).map(x=>hex(x._id));
  return{guild:fresh?this.guildView(fresh,userId):null,applied};
 };
 P.guildSearch=async function(userId,q=''){
  const text=String(q).trim().slice(0,30).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),filter=text?{$or:[{nameKey:{$regex:text.toLowerCase()}},...(/^\d+$/.test(text)?[{shortId:Number(text)}]:[])]}:{};
  const rows=await this.guilds.find(filter,{projection:{name:1,flag:1,level:1,members:1,applications:1,shortId:1}}).sort({level:-1,exp:-1}).limit(30).toArray();
  const me=new ObjectId(hex(userId));
  return{guilds:rows.map(g=>({id:hex(g._id),shortId:g.shortId,name:g.name,flag:g.flag,level:g.level,members:g.members.length,limit:memberLimit(g.level),applied:(g.applications||[]).some(a=>a.userId.equals(me))}))};
 };
 P.guildCreate=async function(userId,requestKey,input){
  const user=await this.getUser(userId);requireCondition(user,'Tài khoản không tồn tại.',401);
  if(user.player.receipts?.some(r=>r.key===requestKey))return this.mutate(userId,requestKey,'guild-create',{name:input?.name,flag:input?.flag});
  requireCondition(!await this.guildOf(user._id),'Bạn đang trong bang khác',409,'IN_GUILD');
  const name=validName(input?.name),_id=new ObjectId();let shortId;
  for(let i=0;i<20&&!shortId;i++){const n=10000+Math.floor(Math.random()*89999);if(!await this.guilds.findOne({shortId:n},{projection:{_id:1}}))shortId=n}
  const doc={_id,shortId,name,nameKey:name.toLowerCase(),flag:Number(input?.flag)||1,level:1,exp:0,notice:name,leaderId:user._id,members:[{...memberInfo(user),role:'leader',joinedAt:new Date(),dedication:0,lastSeen:new Date()}],applications:[],log:[{at:new Date(),text:`${user.player.displayName} lập hạm đội.`}],
   boss:{stage:1,hp:stageHp(1),damage:{}},createdAt:new Date()};
  try{await this.guilds.insertOne(doc)}catch(e){if(e.code===11000)throw new GameError('Tên hạm đội đã có người dùng.',409,'GUILD_NAME_TAKEN');throw e}
  try{const data=await this.mutate(userId,requestKey,'guild-create',{name:input?.name,flag:input?.flag},{guildId:hex(_id)});await this.guilds.updateMany({'applications.userId':user._id},{$pull:{applications:{userId:user._id}}});return data}
  catch(e){await this.guilds.deleteOne({_id});throw e}
 };
 P.guildApply=async function(userId,guildId){
  const user=await this.getUser(userId);requireCondition(user,'Tài khoản không tồn tại.',401);requireCondition(!await this.guildOf(user._id),'Bạn đã là thành viên trong bang',409,'IN_GUILD');
  requireCondition(ObjectId.isValid(String(guildId)),'Hạm đội không tồn tại.',404);const g=await this.guilds.findOne({_id:new ObjectId(String(guildId))});requireCondition(g,'Hạm đội không tồn tại.',404);
  requireCondition(g.members.length<memberLimit(g.level),'Hạm đội đã đủ thành viên.',409,'GUILD_FULL');
  await this.guilds.updateOne({_id:g._id,'applications.userId':{$ne:user._id}},{$push:{applications:{$each:[{...memberInfo(user),at:new Date()}],$slice:-50}}});
  return{message:'Đợi đăng ký được xét duyệt',...await this.guildSearch(userId)};
 };
 P.guildManage=async function(userId,input){
  const g=await this.guildOf(userId);requireCondition(g,'Bạn chưa gia nhập bang hội',409,'NO_GUILD');const role=this.guildRole(g,userId),op=String(input?.op||'');
  requireCondition(['leader','vice'].includes(role),'Bạn không có quyền quản lí hạm đội.',403,'GUILD_ROLE');
  const target=ObjectId.isValid(String(input?.userId))?new ObjectId(String(input.userId)):null;requireCondition(target,'Người chơi không hợp lệ.');
  if(op==='approve'||op==='reject'){
   const app=(g.applications||[]).find(a=>a.userId.equals(target));requireCondition(app,'Đơn xin vào không còn.',404);
   await this.guilds.updateOne({_id:g._id},{$pull:{applications:{userId:target}}});
   if(op==='approve'){
    requireCondition(g.members.length<memberLimit(g.level),'Hạm đội đã đủ thành viên.',409,'GUILD_FULL');requireCondition(!await this.guildOf(target),'Người chơi đang trong bang khác.',409,'IN_GUILD');
    const user=await this.getUser(target);requireCondition(user,'Người chơi không tồn tại.',404);
    const r=await this.guilds.updateOne({_id:g._id,'members.userId':{$ne:target},$expr:{$lt:[{$size:'$members'},memberLimit(g.level)]}},{$push:{members:{...memberInfo(user),role:'member',joinedAt:new Date(),dedication:0}}});requireCondition(r.modifiedCount,'Hạm đội đã đủ thành viên.',409,'GUILD_FULL');
    await this.guilds.updateMany({_id:{$ne:g._id}},{$pull:{applications:{userId:target}}});
    await this.guildPlayer(target,p=>{p.guild??={};p.guild.id=hex(g._id)});await this.guildLog(g._id,`${user.player.displayName} gia nhập hạm đội.`);
   }
  }else{
   const member=g.members.find(m=>m.userId.equals(target));requireCondition(member,'Người chơi không còn trong hạm đội.',404);requireCondition(!member.userId.equals(new ObjectId(hex(userId))),'Không thể tự thao tác với chính mình.');
   if(op==='kick'){requireCondition(role==='leader'||member.role==='member','Thuyền phó chỉ khai trừ được thủy thủ.',403,'GUILD_ROLE');
    await this.guilds.updateOne({_id:g._id},{$pull:{members:{userId:target}}});await this.guildPlayer(target,p=>{if(p.guild?.id!==hex(g._id))return false;p.guild.id=null});await this.guildLog(g._id,`${member.name} bị khai trừ khỏi hạm đội.`)}
   else if(op==='promote'){requireCondition(role==='leader','Chỉ thuyền trưởng được bổ nhiệm.',403,'GUILD_ROLE');const next=member.role==='vice'?'member':'vice';
    await this.guilds.updateOne({_id:g._id,'members.userId':target},{$set:{'members.$.role':next}});await this.guildLog(g._id,`${member.name} ${next==='vice'?'được bổ nhiệm Thuyền phó':'trở lại làm Thủy thủ'}.`)}
   else if(op==='transfer'){requireCondition(role==='leader','Chỉ thuyền trưởng được nhường chức.',403,'GUILD_ROLE');
    await this.guilds.updateOne({_id:g._id,'members.userId':target},{$set:{'members.$.role':'leader',leaderId:target}});await this.guilds.updateOne({_id:g._id,'members.userId':new ObjectId(hex(userId))},{$set:{'members.$.role':'vice'}});await this.guildLog(g._id,`${member.name} trở thành Thuyền trưởng.`)}
   else throw new GameError('Thao tác không hợp lệ.');
  }
  return this.guildStatus(userId);
 };
 P.guildEdit=async function(userId,input){
  const g=await this.guildOf(userId);requireCondition(g,'Bạn chưa gia nhập bang hội',409,'NO_GUILD');requireCondition(['leader','vice'].includes(this.guildRole(g,userId)),'Bạn không có quyền sửa thông tin.',403,'GUILD_ROLE');
  const set={};if(typeof input?.notice==='string')set.notice=input.notice.replace(/[<>\u0000-\u0008]/g,'').slice(0,200);
  if(input?.flag!==undefined){const f=Number(input.flag);requireCondition(Number.isInteger(f)&&f>=1&&f<=guildData.flags.length,'Cờ đội không hợp lệ.');set.flag=f}
  if(Object.keys(set).length)await this.guilds.updateOne({_id:g._id},{$set:set});return this.guildStatus(userId);
 };
 P.guildLeave=async function(userId,requestKey){
  const g=await this.guildOf(userId);requireCondition(g,'Bạn chưa gia nhập bang hội',409,'NO_GUILD');const me=new ObjectId(hex(userId));
  const data=await this.mutate(userId,requestKey,'guild-leave',{},{guild:{id:hex(g._id),level:g.level,boss:g.boss}});
  if(data.replayed)return data;
  const rest=g.members.filter(m=>!m.userId.equals(me));
  if(!rest.length){await this.guilds.deleteOne({_id:g._id});await this.guildDamage.deleteMany({guildId:g._id});return data}
  await this.guilds.updateOne({_id:g._id},{$pull:{members:{userId:me}}});
  if(this.guildRole(g,userId)==='leader'){const heir=rest.find(m=>m.role==='vice')||rest.sort((a,b)=>(b.dedication||0)-(a.dedication||0))[0];await this.guilds.updateOne({_id:g._id,'members.userId':heir.userId},{$set:{'members.$.role':'leader',leaderId:heir.userId}});await this.guildLog(g._id,`${heir.name} trở thành Thuyền trưởng.`)}
  const user=await this.getUser(userId);await this.guildLog(g._id,`${user.player.displayName} rời hạm đội.`);return data;
 };
 /** Thao tác của người chơi cần hạm đội (điểm danh, cống hiến, kỹ năng, đánh boss, mua lượt). */
 P.guildAct=async function(userId,requestKey,action,input){
  const user=await this.getUser(userId);requireCondition(user,'Tài khoản không tồn tại.',401);
  if(user.player.receipts?.some(r=>r.key===requestKey))return this.mutate(userId,requestKey,action,input);
  return this.mutate(userId,requestKey,action,input,await this.guildContext(userId));
 };
 /** Sau mỗi thao tác đã lưu: cộng EXP / cống hiến cho hạm đội, chốt trận đánh boss vừa kết thúc. */
 P.guildAfter=async function(userId,before,next,result,action){
  const gid=next.guild?.id;if(!gid||!ObjectId.isValid(gid))return null;const _id=new ObjectId(gid);
  if(result?.guildExp){
   await this.guilds.updateOne({_id,'members.userId':userId},{$inc:{exp:result.guildExp,'members.$.dedication':result.dedication||result.guildExp}});await this.guildLevelUp(_id);
   const name=next.displayName;if(action==='guild-rollcall')await this.guildLog(_id,`${name} điểm danh.`);if(action==='guild-donate')await this.guildLog(_id,`${name} cống hiến ${Number(result.dedication).toLocaleString('vi-VN')} beli.`);
  }
  const b=next.battle;if(b?.guildBoss&&b.status!=='active'&&!(before.battle?.id===b.id&&before.battle.status!=='active'))return this.guildBossSettle(userId,next,b);
  return null;
 };
 P.guildLevelUp=async function(_id){
  for(let i=0;i<maxGuildLevel;i++){const g=await this.guilds.findOne({_id},{projection:{level:1,exp:1}});if(!g||g.level>=maxGuildLevel)return;const need=expToNext(g.level);
   const r=await this.guilds.updateOne({_id,level:g.level,exp:{$gte:need}},{$inc:{level:1,exp:-need}});if(!r.modifiedCount)return;await this.guildLog(_id,`Hạm đội lên cấp ${g.level+1}.`)}
 };
 /** Trừ máu boss chung một lần cho mỗi trận; hạ boss thì thưởng người hạ + xếp hạng sát thương (gửi thư) và mở ải kế. */
 P.guildBossSettle=async function(userId,player,b){
  const meta=b.guildBoss,_id=new ObjectId(meta.guildId);
  try{await this.guildHits.insertOne({_id:b.id,guildId:_id,userId,at:new Date()})}catch(e){if(e.code===11000)return null;throw e}
  const dealt=guildBossDamage(b),total=dealt.reduce((n,x)=>n+x.damage,0);
  const g=await this.guilds.findOne({_id});if(!g||g.boss.stage!==meta.stage)return{damage:total,counted:false};
  // Cập nhật từng phần tử mảng bằng pipeline: tính lại cả mảng hp.
  const hpExpr={$map:{input:{$range:[0,{$size:'$boss.hp'}]},as:'i',in:{$max:[0,{$subtract:[{$arrayElemAt:['$boss.hp','$$i']},{$arrayElemAt:[dealt.reduce((arr,x)=>{arr[x.index]=x.damage;return arr},Array(g.boss.hp.length).fill(0)),'$$i']}]}]}}};
  const key=`boss.damage.${hex(userId)}`;
  await this.guilds.updateOne({_id,'boss.stage':meta.stage},[{$set:{'boss.hp':hpExpr,[key]:{$add:[{$ifNull:[`$${key}`,0]},total]}}}]);
  const member=g.members.find(m=>m.userId.equals(userId));
  await this.guildDamage.updateOne({guildId:_id,stage:meta.stage,userId},{$inc:{damage:total,hits:1},$set:{name:player.displayName,avatar:member?.avatar||definitionFor(player.hero.id).avatar,level:player.account.level,lastAt:new Date()}},{upsert:true});
  await this.guilds.updateOne({_id,'members.userId':userId},{$inc:{exp:meta.reward.guildExp}});await this.guildLevelUp(_id);
  const after=await this.guilds.findOne({_id});let killed=false;
  if(after.boss.stage===meta.stage&&after.boss.hp.every(v=>v<=0)){
   const nextStage=Math.min(guildData.stages.length,meta.stage+1),done=meta.stage>=guildData.stages.length;
   const r=await this.guilds.updateOne({_id,'boss.stage':meta.stage,'boss.hp':{$not:{$elemMatch:{$gt:0}}}},{$set:{boss:{stage:done?meta.stage:nextStage,hp:done?after.boss.hp:stageHp(nextStage),damage:done?after.boss.damage:{},cleared:done,kills:{...(after.boss.kills||{}),[meta.stage]:{userId,name:player.displayName,at:new Date()}}}}});
   if(r.modifiedCount){
    killed=true;const s=stageData(meta.stage);
    await this.guildMail(userId,{title:'Hạ Boss hạm đội',text:`Bạn đã hạ Boss ải ${meta.stage}!`,rewards:[{itemId:'gold',quantity:s.killGold},{itemId:guildCoin,quantity:s.killCoin}]});
    const ranking=await this.guildDamage.find({guildId:_id,stage:meta.stage}).sort({damage:-1,lastAt:1}).limit(30).toArray();
    for(const [i,row] of ranking.entries()){const f=finalReward(meta.stage,i+1);if(f){await this.guildMail(row.userId,{title:'Thưởng Boss hạm đội',text:`Ải ${meta.stage}: hạng ${i+1} sát thương.`,rewards:[{itemId:'gold',quantity:f.gold},{itemId:guildCoin,quantity:f.coin}]});await this.guildDamage.updateOne({_id:row._id},{$set:{rank:i+1,reward:f}})}}
    await this.guildLog(_id,`${player.displayName} hạ Boss ải ${meta.stage}.`);
   }
  }
  return{damage:total,counted:true,killed,stage:meta.stage};
 };
 /** Danh sách ải boss (thẻ PopupGuildRaid) và chi tiết một ải (PopupGuildBossAttack: máu, top sát thương, thưởng). */
 P.guildBoss=async function(userId,stageInput){
  const g=await this.guildOf(userId);requireCondition(g,'Bạn chưa gia nhập bang hội',409,'NO_GUILD');
  const boss=g.boss,max=stageHp(boss.stage),left=boss.hp.reduce((a,b)=>a+Math.max(0,b),0),total=max.reduce((a,b)=>a+b,0);
  const stage=Number.isInteger(Number(stageInput))&&Number(stageInput)>=1&&Number(stageInput)<=guildData.stages.length?Number(stageInput):boss.stage;
  const rows=await this.guildDamage.find({guildId:g._id,stage}).sort({damage:-1,lastAt:1}).limit(50).toArray(),me=new ObjectId(hex(userId));
  const mine=rows.findIndex(r=>r.userId.equals(me));
  const sum=rows.reduce((n,r)=>n+r.damage,0),kill=boss.kills?.[stage];
  return{now:Date.now(),resetAt:nextVnDay(),current:boss.stage,cleared:!!boss.cleared,hpPercent:total?Math.ceil(left/total*100):0,hp:boss.hp,maxHp:max,power:bossPower(boss.stage),
   stages:guildData.stages.map(s=>({stage:s.stage,monsters:s.monsters.map(m=>({avatar:m.avatar,name:m.name,level:m.level,stars:m.stars,position:m.position})),power:bossPower(s.stage),gold:s.gold,guildCoin:s.guildCoin,guildExp:s.guildExp,killGold:s.killGold,killCoin:s.killCoin,final:s.final})),
   ranking:{stage,state:stage<boss.stage||boss.cleared&&stage===boss.stage?'dead':stage===boss.stage?'current':'locked',totalDamage:sum,killer:kill?{name:kill.name,at:kill.at}:null,
    top:rows.map((r,i)=>({rank:i+1,id:hex(r.userId),name:r.name,avatar:r.avatar,level:r.level,damage:r.damage,hits:r.hits||0,share:sum?r.damage/sum:0,reward:finalReward(stage,i+1),me:r.userId.equals(me)})),
    me:mine>=0?{rank:mine+1,damage:rows[mine].damage}:null}};
 };
}
