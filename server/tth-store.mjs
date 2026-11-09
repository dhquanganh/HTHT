// Tân Tứ Hoàng trên MongoDB: tth_scores (một dòng mỗi ngày / boss / người chơi = sát thương cao nhất 1 lần đánh, mỗi boss
// một bảng xếp hạng) và tth_meta (khóa trả thưởng xếp hạng từng ngày). Thưởng gửi qua Hòm thư sau 00:00 như bản gốc.
import {ObjectId} from 'mongodb';
import {requireCondition} from './errors.mjs';
import {definitionFor} from './catalog.mjs';
import {tthDay,bossOfDay,rankReward,tthData} from './tth.mjs';

export function installTth(Store){
 const P=Store.prototype;
 P.setupTth=async function(){
  this.tthScores=this.db.collection('tth_scores');this.tthMeta=this.db.collection('tth_meta');
  await this.tthScores.createIndex({day:1,boss:1,userId:1},{unique:true});await this.tthScores.createIndex({day:1,boss:1,best:-1,at:1});
  await this.tthTick();this.tthTimer=setInterval(()=>this.tthTick().catch(e=>console.error(JSON.stringify({event:'tth_tick_failed',name:e.name,message:e.message}))),60000);this.tthTimer.unref();
 };
 /** Sau mỗi thao tác đã lưu: trận Tân Tứ Hoàng vừa kết thúc thì ghi sát thương cao nhất của ngày vào bảng của boss đó. */
 P.tthAfter=async function(userId,before,next){
  const b=next.battle;if(!b?.tth||b.status==='active'||(before.battle?.id===b.id&&before.battle.status!=='active')||!b.reward?.counted)return null;
  const {day,bossIndex}=b.tth,damage=b.reward.damage;
  await this.tthScores.updateOne({day,boss:bossIndex,userId},[{$set:{name:next.displayName,avatar:definitionFor(next.hero.id).avatar,level:next.account.level,
   at:{$cond:[{$gt:[damage,{$ifNull:['$best',-1]}]},new Date(),'$at']},best:{$max:[{$ifNull:['$best',0]},damage]}}}],{upsert:true});
  const rank=await this.tthRank(day,bossIndex,userId);return{rank};
 };
 P.tthRank=async function(day,boss,userId){
  const me=await this.tthScores.findOne({day,boss,userId});if(!me)return 0;
  return 1+await this.tthScores.countDocuments({day,boss,$or:[{best:{$gt:me.best}},{best:me.best,at:{$lt:me.at}}]});
 };
 /** Bảng xếp hạng của một boss: hôm nay nếu boss đang trực, nếu không thì ngày gần nhất boss đó trực. */
 P.tthRanking=async function(userId,bossInput){
  const today=tthDay(),todayBoss=bossOfDay(today).index,boss=[0,1,2,3].includes(Number(bossInput))?Number(bossInput):todayBoss;
  let day=today;while(day>1&&bossOfDay(day).index!==boss)day--;
  if(bossOfDay(day).index!==boss)return{boss,day:null,today:false,top:[],me:null,name:tthData.bosses[boss].name};
  const _id=new ObjectId(String(userId)),rows=await this.tthScores.find({day,boss}).sort({best:-1,at:1}).limit(50).toArray(),mine=await this.tthScores.findOne({day,boss,userId:_id});
  const row=(r,rank)=>({rank,name:r.name,avatar:r.avatar,level:r.level,damage:r.best,me:r.userId.equals(_id)});
  return{boss,day,today:day===today,name:tthData.bosses[boss].name,top:rows.map((r,i)=>row(r,i+1)),me:mine?row(mine,await this.tthRank(day,boss,_id)):null};
 };
 /** Trả thưởng xếp hạng các ngày đã qua (mỗi ngày một lần, khóa bằng tth_meta). */
 P.tthTick=async function(){
  // tth_meta 'paid'.day = ngày cuối đã trả thưởng. Lần đầu chỉ đặt mốc (không trả các ngày trước khi có server).
  const today=tthDay();await this.tthMeta.updateOne({_id:'paid'},{$setOnInsert:{day:today-1}},{upsert:true});
  for(;;){
   const meta=await this.tthMeta.findOne({_id:'paid'}),day=meta.day+1;if(day>=today)return;
   // Chuyển mốc day-1 -> day nguyên tử: chỉ một tiến trình trả thưởng cho mỗi ngày.
   if(!(await this.tthMeta.updateOne({_id:'paid',day:meta.day},{$set:{day}})).modifiedCount)continue;
   const boss=bossOfDay(day),rows=await this.tthScores.find({day,boss:boss.index}).sort({best:-1,at:1}).toArray();
   for(const [i,row] of rows.entries()){const rewards=rankReward(i+1);if(rewards.length)await this.arenaMail(row.userId,{title:'Thưởng Tân Tứ Hoàng',text:`Ngày ${day} · ${boss.name}: hạng ${i+1} sát thương.`,rewards})}
  }
 };
}
