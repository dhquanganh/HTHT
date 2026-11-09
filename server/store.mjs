import {MongoClient,ObjectId} from 'mongodb';
import {createHash,randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {GameError,requireCondition} from './errors.mjs';
import {starterPlayer,playerView,applyAction} from './game.mjs';
import {startAfk} from './afk.mjs';
import {startSummon} from './summon.mjs';
import {rankingEntry} from './tower.mjs';
import {applyEventConfig,editableEvents,validateEventConfig} from './events.mjs';
import {isRewardId} from './game.mjs';
import {beastBosses,bossByKey,bracketIndex,classLabel,beastEntry,beastTurns,defaultBoss,defaultConfig,defaultRewards,rankBrackets,rewardItems,rewardView,variantOf,validateBossStats,validateConfig,validateRewards} from './beast.mjs';
import {itemById,itemIcon} from './catalog.mjs';
import {ensureRoster} from './hero-roster.mjs';
import {installArena} from './arena-store.mjs';
const scrypt=promisify(scryptCallback),sha=value=>createHash('sha256').update(value).digest('hex');
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64,{N:16384,r:8,p:1});return`scrypt:${salt}:${hash.toString('hex')}`}
async function verifyPassword(password,encoded){const [scheme,salt,expected]=encoded.split(':');if(scheme!=='scrypt'||!salt||!expected)return false;const hash=await scrypt(password,salt,64,{N:16384,r:8,p:1});const saved=Buffer.from(expected,'hex');return hash.length===saved.length&&timingSafeEqual(hash,saved)}
const summary=user=>({...(ensureRoster(user.player),{}),id:user._id.toHexString(),username:user.usernameKey,displayName:user.player.displayName,level:user.player.account.level,gold:user.player.wallet.gold,diamonds:user.player.wallet.diamonds,stage:user.player.adventure.unlockedStage,towerFloor:user.player.tower?.floor||1,heroes:1+Object.keys(user.player.reserveHeroes||{}).length,locked:!!user.locked,createdAt:user.createdAt,updatedAt:user.updatedAt});
export class Store {
 constructor(uri,dbName){this.client=new MongoClient(uri,{serverSelectionTimeoutMS:15000,connectTimeoutMS:10000,maxPoolSize:15});this.db=this.client.db(dbName);this.users=this.db.collection('players');this.sessions=this.db.collection('sessions');this.adminLog=this.db.collection('admin_log');this.ranking=this.db.collection('tower_ranking');for(const [field,name] of [['beastBosses','beast_bosses'],['beastConfig','beast_config'],['beastRewards','beast_rewards'],['beastSeasons','beast_seasons'],['beastRanking','beast_ranking'],['beastPayouts','beast_payouts']])this[field]=this.db.collection(name)}
 async connect(){await this.client.connect();await this.db.command({ping:1});await this.users.createIndex({usernameKey:1},{unique:true});await this.sessions.createIndex({tokenHash:1},{unique:true});await this.sessions.createIndex({expiresAt:1},{expireAfterSeconds:0});await this.sessions.createIndex({userId:1});await this.adminLog.createIndex({userId:1,at:-1});await this.ranking.createIndex({userId:1},{unique:true});await this.ranking.createIndex({floors:-1,reachedAt:1,userId:1});await this.syncRanking();await this.setupBeast();await this.setupArena();this.eventConfig=this.db.collection('event_config');applyEventConfig(await this.eventConfig.find().toArray());this.dummyHash=await passwordHash('not-a-real-account-password');return this}
 async close(){clearInterval(this.beastTimer);clearInterval(this.arenaTimer);await this.client.close()}
 // ---- Chiến Thần Thú ----
 async setupBeast(){
  await this.beastRanking.createIndex({season:1,boss:1,userId:1},{unique:true});await this.beastRanking.createIndex({season:1,boss:1,hidden:1,damage:-1,reachedAt:1,userId:1});await this.beastPayouts.createIndex({userId:1,claimedAt:1});await this.beastPayouts.createIndex({season:1,boss:1,userId:1},{unique:true});
  // Chỉ thêm khi chưa có: dữ liệu admin đã sửa không bị asset ghi đè lúc khởi động.
  await this.beastBosses.bulkWrite(beastBosses.map(boss=>{const {_id,...stats}=defaultBoss(boss);return{updateOne:{filter:{_id},update:{$setOnInsert:stats},upsert:true}}}),{ordered:false});
  await this.beastRewards.bulkWrite(beastBosses.map(boss=>({updateOne:{filter:{_id:boss.key},update:{$setOnInsert:{ranks:defaultRewards()}},upsert:true}})),{ordered:false});
  await this.beastConfig.updateOne({_id:'config'},{$setOnInsert:defaultConfig},{upsert:true});
  await this.beastTick();await this.syncBeastRanking();
  this.beastTimer=setInterval(()=>this.beastTick().catch(e=>console.error(JSON.stringify({event:'beast_tick_failed',name:e.name}))),30000);this.beastTimer.unref();
 }
 async syncBeastRanking(){
  const season=await this.beastSeasons.findOne({status:'active'});if(!season)return;
  const users=await this.users.find({'player.beast.season':season._id},{projection:{'player.displayName':1,'player.hero.id':1,'player.account.level':1,'player.beast':1,locked:1,updatedAt:1}}).toArray(),writes=[];
  for(const user of users)for(const [boss,damage] of Object.entries(user.player.beast.damage))writes.push({updateOne:{filter:{season:season._id,boss,userId:user._id},update:{$set:{...beastEntry(user.player),damage,hidden:!!user.locked},$setOnInsert:{reachedAt:user.updatedAt||new Date()}},upsert:true}});
  if(writes.length)await this.beastRanking.bulkWrite(writes,{ordered:false});
 }
 /** Mở mùa đầu, chốt mùa hết hạn và mở mùa kế. Chạy định kỳ và trước mọi thao tác Chiến Thần Thú. */
 async beastTick(now=new Date()){
  for(const stuck of await this.beastSeasons.find({status:'settling'}).toArray())await this.settleSeason(stuck);
  let season=await this.beastSeasons.findOne({status:'active'});
  if(season&&season.endsAt<=now){
   const locked=await this.beastSeasons.findOneAndUpdate({_id:season._id,status:'active',endsAt:{$lte:now}},{$set:{status:'settling'}});
   if(locked){await this.settleSeason(season);season=null}else season=await this.beastSeasons.findOne({status:'active'});
  }
  if(!season){
   const last=await this.beastSeasons.find().sort({_id:-1}).limit(1).next(),config=await this.beastConfig.findOne({_id:'config'});
   season={_id:(last?._id||0)+1,status:'active',startsAt:now,endsAt:new Date(now.getTime()+config.seasonDays*86400000)};
   await this.beastSeasons.insertOne(season).catch(e=>{if(e.code!==11000)throw e});
  }
  return season;
 }
 async settleSeason(season){
  const rewards=Object.fromEntries((await this.beastRewards.find().toArray()).map(doc=>[doc._id,doc.ranks]));
  for(const boss of beastBosses){
   const rows=await this.beastRanking.find({season:season._id,boss:boss.key,hidden:{$ne:true},damage:{$gt:0}}).sort({damage:-1,reachedAt:1,userId:1}).toArray();
   if(rows.length)await this.beastPayouts.bulkWrite(rows.map((row,i)=>({updateOne:{filter:{season:season._id,boss:boss.key,userId:row.userId},update:{$setOnInsert:{rank:i+1,damage:row.damage,rewards:rewards[boss.key]?.[bracketIndex(i+1)]||[],claimedAt:null}},upsert:true}})),{ordered:false});
  }
  await this.beastSeasons.updateOne({_id:season._id},{$set:{status:'settled',settledAt:new Date()}});
 }
 async beastContext(userId){
  const [season,config,bosses]=await Promise.all([this.beastTick(),this.beastConfig.findOne({_id:'config'}),this.beastBosses.find().toArray()]);
  const context={season:{id:season._id,endsAt:season.endsAt},config,bosses:Object.fromEntries(bosses.map(({_id,...stats})=>[_id,stats]))};
  if(userId)context.payouts=(await this.pendingPayouts(userId)).map(row=>({id:`${row.season}:${row.boss}`,rewards:row.rewards}));
  return context;
 }
 pendingPayouts(userId){return this.beastPayouts.find({userId:new ObjectId(userId),claimedAt:null}).sort({season:1}).toArray()}
 /** Thứ hạng đọc thẳng từ beast_ranking; mỗi boss là một bảng riêng. */
 async beastTop(season,boss,userId,limit=100){
  const visible={season,boss,hidden:{$ne:true}},_id=userId?new ObjectId(userId):null;
  const [rows,total,mine]=await Promise.all([this.beastRanking.find(visible).sort({damage:-1,reachedAt:1,userId:1}).limit(limit).toArray(),this.beastRanking.countDocuments(visible),_id?this.beastRanking.findOne({season,boss,userId:_id}):null]);
  const row=(doc,rank)=>({rank,name:doc.displayName,heroId:doc.heroId,level:doc.level,damage:doc.damage});
  const ahead=mine?await this.beastRanking.countDocuments({...visible,$or:[{damage:{$gt:mine.damage}},{damage:mine.damage,reachedAt:{$lt:mine.reachedAt}},{damage:mine.damage,reachedAt:mine.reachedAt,userId:{$lt:mine.userId}}]}):0;
  return{total,top:rows.map((doc,i)=>row(doc,i+1)),me:mine&&!mine.hidden?row(mine,ahead+1):null};
 }
 async beastStatus(userId){
  const [context,user]=await Promise.all([this.beastContext(userId),this.getUser(userId)]);requireCondition(user,'Tài khoản không tồn tại.',401);
  const beast=user.player.beast,same=beast?.season===context.season.id;
  return{season:context.season.id,endsAt:context.season.endsAt,remaining:Math.max(0,context.season.endsAt.getTime()-Date.now()),turns:beastTurns(user.player,context),cooldown:same?Math.max(0,beast.lastAttackAt+context.config.cooldownSeconds*1000-Date.now()):0,bosses:beastBosses.map(boss=>({key:boss.key,name:boss.name,avatar:boss.avatar,class:boss.class})),pending:(await this.pendingPayouts(userId)).map(row=>({season:row.season,boss:bossByKey.get(row.boss)?.name||row.boss,rank:row.rank,damage:row.damage,rewards:row.rewards.map(rewardView)}))};
 }
 async beastDetail(userId,key){
  const boss=bossByKey.get(key);requireCondition(boss,'Boss không tồn tại.',404);
  const [status,context,user,rewards]=await Promise.all([this.beastStatus(userId),this.beastContext(),this.getUser(userId),this.beastRewards.findOne({_id:key})]);
  const variant=variantOf(boss,context.season.id),ranking=await this.beastTop(context.season.id,key,userId),ranks=rewards?.ranks||[],index=ranking.me?bracketIndex(ranking.me.rank):-1;
  return{...status,boss:{key,name:boss.name,avatar:boss.avatar,class:boss.class,classLabel:classLabel(boss.class),faction:variant.faction,...context.bosses[key],skills:variant.skills,active:boss.active},minLevel:context.config.minLevel,ranking,formation:user.player.beast?.formations?.[key]||null,rewards:rankBrackets.map((bracket,i)=>({...bracket,rewards:(ranks[i]||[]).map(rewardView)})),current:index>=0?(ranks[index]||[]).map(rewardView):[]};
 }
 async beastClaim(userId,requestKey){
  const data=await this.mutate(userId,requestKey,'beast-claim',{});
  await this.beastPayouts.updateMany({userId:new ObjectId(userId),claimedAt:null},{$set:{claimedAt:new Date()}});return data;
 }
 async saveBeast(userId,before,next){
  const season=next.beast?.season;if(!season)return;
  const entry=beastEntry(next);
  if(JSON.stringify(beastEntry(before))!==JSON.stringify(entry))await this.beastRanking.updateMany({userId,season},{$set:entry});
  const changed=Object.entries(next.beast.damage).filter(([boss,damage])=>before.beast?.season!==season||before.beast.damage[boss]!==damage);if(!changed.length)return;
  if(!await this.beastSeasons.findOne({_id:season,status:'active'}))return;
  const hidden=!!(await this.users.findOne({_id:userId},{projection:{locked:1}}))?.locked,now=new Date();
  await this.beastRanking.bulkWrite(changed.map(([boss,damage])=>({updateOne:{filter:{season,boss,userId},update:{$set:{...entry,damage,hidden,reachedAt:now}},upsert:true}})),{ordered:false});
 }
 async beastAdmin(){
  const context=await this.beastContext(),[rewards,seasons]=await Promise.all([this.beastRewards.find().toArray(),this.beastSeasons.find().sort({_id:-1}).limit(20).toArray()]),ranks=Object.fromEntries(rewards.map(doc=>[doc._id,doc.ranks]));
  return{config:(({_id,...rest})=>rest)(context.config),season:{id:context.season.id,endsAt:context.season.endsAt},seasons:seasons.map(s=>({id:s._id,status:s.status,startsAt:s.startsAt,endsAt:s.endsAt})),brackets:rankBrackets,rewardItems:rewardItems(),bosses:beastBosses.map(boss=>({key:boss.key,name:boss.name,class:boss.class,classLabel:classLabel(boss.class),head:itemIcon({assetKey:boss.visual.head}),skills:variantOf(boss,context.season.id).skills,stats:context.bosses[boss.key],defaults:defaultBoss(boss),rewards:(ranks[boss.key]||[]).map(rank=>rank.map(rewardView))}))};
 }
 async beastAdminRanking(key,season){
  requireCondition(bossByKey.has(key),'Boss không tồn tại.',404);
  const current=await this.beastTick();return{season:Number.isInteger(season)&&season>0?season:current._id,...await this.beastTop(Number.isInteger(season)&&season>0?season:current._id,key,null,200)};
 }
 // ---- Cấu hình sự kiện: bản trong database đè lên bộ mặc định, áp ngay vào bộ nhớ của server.
 eventAdmin(){return{...editableEvents(),rewardItems:rewardItems()}}
 async setEventConfig(id,input,ip){
  if(input?.reset===true)await this.eventConfig.deleteOne({_id:id});
  else await this.eventConfig.updateOne({_id:id},{$set:{config:validateEventConfig(id,input?.config,isRewardId),updatedAt:new Date()}},{upsert:true});
  applyEventConfig(await this.eventConfig.find().toArray());await this.beastLog(`${input?.reset===true?'Trả về mặc định':'Sửa'} sự kiện ${id}`,ip);return this.eventAdmin();
 }
 async beastLog(detail,ip){await this.adminLog.insertOne({userId:null,at:new Date(),detail,ip})}
 async setBeastRewards(keys,ranks,ip){
  const clean=validateRewards(ranks);for(const key of keys)requireCondition(bossByKey.has(key),'Boss không tồn tại.',404);
  await this.beastRewards.bulkWrite(keys.map(key=>({updateOne:{filter:{_id:key},update:{$set:{ranks:clean}},upsert:true}})));await this.beastLog(`Sửa thưởng Chiến Thần Thú: ${keys.join(', ')}`,ip);
 }
 async setBeastBoss(key,stats,ip){
  const boss=bossByKey.get(key);requireCondition(boss,'Boss không tồn tại.',404);const {_id,...clean}=stats==='reset'?defaultBoss(boss):{_id:key,...validateBossStats(stats)};
  await this.beastBosses.updateOne({_id:key},{$set:clean},{upsert:true});await this.beastLog(`Sửa chỉ số boss ${boss.name}`,ip);
 }
 async setBeastConfig(input,ip){const clean=validateConfig(input);await this.beastConfig.updateOne({_id:'config'},{$set:clean},{upsert:true});await this.beastLog('Sửa cấu hình Chiến Thần Thú',ip)}
 async setBeastEnd(endsAt,ip){
  const date=new Date(endsAt);requireCondition(Number.isFinite(date.getTime()),'Thời gian không hợp lệ.');
  const update=await this.beastSeasons.updateOne({status:'active'},{$set:{endsAt:date}});requireCondition(update.matchedCount,'Không có mùa đang chạy.',409);await this.beastLog('Đổi hạn mùa Chiến Thần Thú',ip);await this.beastTick();
 }
 /** Đồng bộ lại toàn bộ từ players: đưa tài khoản cũ vào bảng và sửa các lần ghi lỗi trước đó. */
 async syncRanking(){
  const users=await this.users.find({},{projection:{'player.displayName':1,'player.hero.id':1,'player.account.level':1,'player.tower.floor':1,locked:1,updatedAt:1}}).toArray();
  if(users.length)await this.ranking.bulkWrite(users.map(user=>({updateOne:{filter:{userId:user._id},update:{$set:{...rankingEntry(user.player),hidden:!!user.locked},$setOnInsert:{reachedAt:user.updatedAt||new Date()}},upsert:true}})),{ordered:false});
 }
 async saveRanking(userId,player,reached){
  const now=new Date();await this.ranking.updateOne({userId},{$set:{...rankingEntry(player),...(reached?{reachedAt:now}:{})},$setOnInsert:{hidden:false,...(reached?{}:{reachedAt:now})}},{upsert:true});
 }
 /** Bảng xếp hạng đọc thẳng từ tower_ranking. Cùng số tầng thì ai đạt trước xếp trên. */
 async towerRanking(userId,limit=50){
  const _id=typeof userId==='string'?new ObjectId(userId):userId,visible={hidden:{$ne:true}};
  const [rows,total,mine]=await Promise.all([this.ranking.find(visible).sort({floors:-1,reachedAt:1,userId:1}).limit(limit).toArray(),this.ranking.countDocuments(visible),this.ranking.findOne({userId:_id})]);
  const row=(doc,rank)=>({rank,name:doc.displayName,heroId:doc.heroId,level:doc.level,floors:doc.floors});
  const ahead=mine?await this.ranking.countDocuments({...visible,$or:[{floors:{$gt:mine.floors}},{floors:mine.floors,reachedAt:{$lt:mine.reachedAt}},{floors:mine.floors,reachedAt:mine.reachedAt,userId:{$lt:mine.userId}}]}):0;
  return{total,top:rows.map((doc,i)=>({...row(doc,i+1),me:doc.userId.equals(_id)})),me:mine?row(mine,ahead+1):null};
 }
 async createUser(username,password){const doc={usernameKey:username.toLowerCase(),passwordHash:await passwordHash(password),createdAt:new Date(),updatedAt:new Date(),player:starterPlayer(username)};try{const {insertedId}=await this.users.insertOne(doc);await this.saveRanking(insertedId,doc.player,false);return{...doc,_id:insertedId}}catch(e){if(e.code===11000)throw new GameError('Tên đăng nhập đã được sử dụng.',409,'USERNAME_TAKEN');throw e}}
 async authenticate(username,password){const user=await this.users.findOne({usernameKey:username.toLowerCase()});const valid=await verifyPassword(password,user?.passwordHash||this.dummyHash);requireCondition(user&&valid,'Tên đăng nhập hoặc mật khẩu không đúng.',401,'INVALID_CREDENTIALS');requireCondition(!user.locked,'Tài khoản đã bị khóa.',403,'ACCOUNT_LOCKED');return user}
 async createSession(userId){const token=randomBytes(32).toString('base64url'),csrfToken=randomBytes(24).toString('base64url');const session={userId,tokenHash:sha(token),csrfToken,createdAt:new Date(),expiresAt:new Date(Date.now()+7*86400000)};await this.sessions.insertOne(session);return{token,session}}
 async getSession(token){if(typeof token!=='string'||!/^[A-Za-z0-9_-]{40,64}$/.test(token))return null;return this.sessions.findOne({tokenHash:sha(token),expiresAt:{$gt:new Date()}})}
 async deleteSession(token){if(typeof token==='string')await this.sessions.deleteOne({tokenHash:sha(token)})}
 async getUser(id){return this.users.findOne({_id:typeof id==='string'?new ObjectId(id):id})}
 async view(id){const user=await this.getUser(id);requireCondition(user,'Tài khoản không tồn tại.',401);const started=[startAfk(user.player),startSummon(user.player)].some(Boolean);if(started)await this.users.updateOne({_id:user._id,'player.version':user.player.version},{$set:{player:user.player}});return{...playerView(user.player),profile:{id:user._id.toHexString(),username:user.usernameKey}}}
 adminId(id){requireCondition(typeof id==='string'&&ObjectId.isValid(id),'Tài khoản không tồn tại.',404);return new ObjectId(id)}
 async adminList({q='',page=0}){
  const size=25,skip=Math.max(0,Math.floor(page))*size,text=q.trim().slice(0,40).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const filter=text?{$or:[{usernameKey:{$regex:text,$options:'i'}},{'player.displayName':{$regex:text,$options:'i'}}]}:{};
  const [total,rows]=await Promise.all([this.users.countDocuments(filter),this.users.find(filter,{projection:{passwordHash:0}}).sort({updatedAt:-1}).skip(skip).limit(size).toArray()]);
  return{total,pageSize:size,players:rows.map(summary)};
 }
 async adminPlayer(id){
  const _id=this.adminId(id),user=await this.users.findOne({_id},{projection:{passwordHash:0}});requireCondition(user,'Tài khoản không tồn tại.',404);
  const log=await this.adminLog.find({userId:_id}).sort({at:-1}).limit(30).toArray();
  return{...summary(user),mail:(user.player.mail||[]).filter(m=>!m.claimedAt).map(m=>({title:m.title,sentAt:m.sentAt,rewards:m.rewards.map(rewardView)})),inventory:Object.entries(user.player.inventory).filter(([,n])=>n>0).map(([itemId,quantity])=>({itemId,quantity,name:itemById.get(itemId)?.name||itemId,icon:itemIcon(itemById.get(itemId))})).sort((a,b)=>a.name.localeCompare(b.name,'vi')),log:log.map(({at,detail})=>({at,detail}))};
 }
 async adminUpdate(id,change,ip){
  const _id=this.adminId(id);
  for(let attempt=0;attempt<10;attempt++){
   const user=await this.getUser(_id);requireCondition(user,'Tài khoản không tồn tại.',404);
   const next=structuredClone(user.player),detail=change(next);next.version++;next.activity.push({action:'admin',message:detail,at:new Date().toISOString(),version:next.version});next.activity=next.activity.slice(-100);
   const update=await this.users.updateOne({_id,'player.version':user.player.version},{$set:{player:next,updatedAt:new Date()}});
   if(update.modifiedCount){await this.adminLog.insertOne({userId:_id,at:new Date(),detail,ip});await this.saveBeast(_id,user.player,next).catch(()=>{});return detail}
  }
  throw new GameError('Có thao tác đồng thời. Hãy thử lại.',409,'WRITE_CONFLICT');
 }
 async adminLock(id,locked,ip){
  const _id=this.adminId(id),update=await this.users.updateOne({_id},{$set:{locked}});requireCondition(update.matchedCount,'Tài khoản không tồn tại.',404);
  await this.ranking.updateOne({userId:_id},{$set:{hidden:locked}});await this.beastRanking.updateMany({userId:_id},{$set:{hidden:locked}});if(locked)await this.sessions.deleteMany({userId:_id});await this.adminLog.insertOne({userId:_id,at:new Date(),detail:locked?'Khóa tài khoản':'Mở khóa tài khoản',ip});
 }
 async adminSetPassword(id,password,ip){
  // Ghi đè mật khẩu cũ bằng hash mới và đăng xuất mọi phiên đang mở của tài khoản.
  const _id=this.adminId(id),update=await this.users.updateOne({_id},{$set:{passwordHash:await passwordHash(password),updatedAt:new Date()}});requireCondition(update.matchedCount,'Tài khoản không tồn tại.',404);
  await this.sessions.deleteMany({userId:_id});await this.adminLog.insertOne({userId:_id,at:new Date(),detail:'Đặt lại mật khẩu',ip});
 }
 async mutate(userId,requestKey,action,input,extraContext){
  requireCondition(typeof requestKey==='string'&&/^[A-Za-z0-9_-]{12,100}$/.test(requestKey),'Thiếu mã chống lặp thao tác.',400,'IDEMPOTENCY_REQUIRED');
  const fingerprint=sha(JSON.stringify({action,input}));
  for(let attempt=0;attempt<10;attempt++){
   const user=await this.getUser(userId);requireCondition(user,'Phiên đăng nhập không hợp lệ.',401);
   const receipt=user.player.receipts.find(r=>r.key===requestKey);
   if(receipt){requireCondition(receipt.fingerprint===fingerprint,'Mã thao tác đã được dùng cho nội dung khác.',409,'IDEMPOTENCY_CONFLICT');return{player:playerView(user.player),result:receipt.result,replayed:true}}
   const context=extraContext??(action.startsWith('beast-')?await this.beastContext(userId):undefined);
   const next=structuredClone(user.player),result=applyAction(next,action,input,Date.now(),context);
   next.version++;next.receipts.push({key:requestKey,fingerprint,result,at:new Date().toISOString()});next.receipts=next.receipts.slice(-150);
   next.activity.push({action,message:result.message,at:new Date().toISOString(),version:next.version});next.activity=next.activity.slice(-100);
   const update=await this.users.updateOne({_id:user._id,'player.version':user.player.version},{$set:{player:next,updatedAt:new Date()}});
   if(update.modifiedCount){
    const before=rankingEntry(user.player),after=rankingEntry(next);
    // Bảng phụ không được làm hỏng thao tác game đã lưu; lần khởi động sau syncRanking sẽ sửa lại.
    if(JSON.stringify(before)!==JSON.stringify(after))await this.saveRanking(user._id,next,after.floors>before.floors).catch(e=>console.error(JSON.stringify({event:'ranking_write_failed',name:e.name})));
    await this.saveBeast(user._id,user.player,next).catch(e=>console.error(JSON.stringify({event:'beast_ranking_write_failed',name:e.name})));
    // Chiến trường: chốt điểm hai bên khi trận vừa kết thúc; lưu đội hình thủ thì cập nhật snapshot trên bảng.
    const arena=await this.arenaAfter(user._id,user.player,next,result).catch(e=>{console.error(JSON.stringify({event:'arena_settle_failed',name:e.name,message:e.message}));return null});
    if(action==='arena-defense')await this.arenaJoin({...user,player:next},input.mode).catch(()=>{});
    return{player:playerView(next),result:arena?{...result,arena:{...(result.arena||{}),...arena}}:result,replayed:false};
   }
  }
  throw new GameError('Có thao tác đồng thời. Hãy thử lại.',409,'WRITE_CONFLICT');
 }
}

installArena(Store);
