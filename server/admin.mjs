// Trang quản trị: phiên riêng, tách khỏi tài khoản người chơi. Không đặt ADMIN_PASSWORD thì mọi route trả 404.
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {GameError,requireCondition,integer} from './errors.mjs';
import {items,itemById,itemIcon} from './catalog.mjs';
import {sendMail} from './mail.mjs';

const sha=value=>createHash('sha256').update(value).digest();
const hex=value=>sha(value).toString('hex');
const sessionMs=8*3600000,cookie='ht_admin',minimumPassword=12;
const equal=(a,b)=>timingSafeEqual(sha(String(a)),sha(String(b)));
const tokenFrom=req=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1);
const name=delta=>new Intl.NumberFormat('vi-VN').format(delta);

/** Phần cộng gửi thành một thư, người chơi tự nhận; phần trừ áp ngay. Chạy trong lượt ghi có khóa phiên bản. */
export function applyAdminGrant(player,input){
 const added=[],removed=[],rewards=[],wallet={...player.wallet},inventory={...player.inventory};
 if(input.itemId!==undefined){
  const item=itemById.get(input.itemId);requireCondition(item,'Vật phẩm không tồn tại.',404);
  const quantity=integer(input.quantity,-1000000,1000000,'Số lượng');requireCondition(quantity!==0,'Số lượng phải khác 0.');
  if(quantity>0){rewards.push({itemId:item.id,quantity});added.push(`+${name(quantity)} ${item.name}`)}
  else{const next=(inventory[item.id]||0)+quantity;requireCondition(next>=0,'Người chơi không đủ vật phẩm để trừ.');if(next)inventory[item.id]=next;else delete inventory[item.id];removed.push(`${name(quantity)} ${item.name}`)}
 }
 for(const [currency,label] of [['gold','vàng'],['diamonds','kim cương']]){
  if(input[currency]===undefined||input[currency]==='')continue;
  const delta=integer(input[currency],-1000000000000,1000000000000,'Giá trị');if(!delta)continue;
  if(delta>0){rewards.push({itemId:currency,quantity:delta});added.push(`+${name(delta)} ${label}`)}
  else{requireCondition(wallet[currency]+delta>=0,`Người chơi không đủ ${label} để trừ.`);wallet[currency]+=delta;removed.push(`${name(delta)} ${label}`)}
 }
 requireCondition(added.length||removed.length,'Chưa có thay đổi nào.');
 if(rewards.length)sendMail(player,{title:input.title,text:input.text,rewards});
 player.wallet=wallet;player.inventory=inventory;
 return[added.length?`Gửi thư: ${added.join(', ')}`:'',removed.join(', ')].filter(Boolean).join('; ');
}

export function mountAdmin(app,store,password,limiter){
 const usable=typeof password==='string'&&password.length>=minimumPassword;
 if(password&&!usable)console.error(`ADMIN_PASSWORD cần ít nhất ${minimumPassword} ký tự; trang quản trị đang tắt.`);
 if(!usable){app.use('/api/admin',(req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'API không tồn tại.'}}));return}
 const sessions=new Map();
 const open=(req,res)=>{
  const token=randomBytes(32).toString('base64url'),csrfToken=randomBytes(24).toString('base64url');
  for(const [key,value] of sessions)if(value.expires<Date.now())sessions.delete(key);
  sessions.set(hex(token),{csrfToken,expires:Date.now()+sessionMs});
  res.cookie(cookie,token,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:sessionMs,path:'/api/admin'});return csrfToken;
 };
 const current=req=>{const token=tokenFrom(req),session=token&&sessions.get(hex(token));return session&&session.expires>Date.now()?session:null};
 const guard=(req,res,next)=>{
  const session=current(req);requireCondition(session,'Cần đăng nhập quản trị.',401,'ADMIN_UNAUTHENTICATED');
  if(req.method!=='GET')requireCondition(equal(req.get('X-Admin-CSRF')||'',session.csrfToken),'Phiên thao tác hết hạn. Hãy tải lại trang.',403,'CSRF_REJECTED');
  req.adminSession=session;next();
 };
 app.post('/api/admin/login',limiter,(req,res)=>{
  requireCondition(equal(typeof req.body?.password==='string'?req.body.password:'',password),'Mật khẩu quản trị không đúng.',401,'ADMIN_INVALID');
  res.json({csrfToken:open(req,res)});
 });
 app.get('/api/admin/session',guard,(req,res)=>res.json({csrfToken:req.adminSession.csrfToken}));
 app.post('/api/admin/logout',guard,(req,res)=>{sessions.delete(hex(tokenFrom(req)));res.clearCookie(cookie,{path:'/api/admin'});res.json({ok:true})});
 app.get('/api/admin/items',guard,(req,res)=>res.json({items:items.map(item=>({id:item.id,name:item.name,category:item.category,icon:itemIcon(item)}))}));
 app.get('/api/admin/players',guard,async(req,res)=>res.json(await store.adminList({q:typeof req.query.q==='string'?req.query.q:'',page:Number(req.query.page)||0})));
 app.get('/api/admin/players/:id',guard,async(req,res)=>res.json(await store.adminPlayer(req.params.id)));
 app.post('/api/admin/players/:id/grant',guard,async(req,res)=>{
  requireCondition(req.body&&typeof req.body==='object'&&!Array.isArray(req.body),'Dữ liệu không hợp lệ.');
  await store.adminUpdate(req.params.id,player=>applyAdminGrant(player,req.body),req.ip);res.json(await store.adminPlayer(req.params.id));
 });
 app.get('/api/admin/events',guard,(req,res)=>res.json(store.eventAdmin()));
 app.post('/api/admin/events/:id',guard,async(req,res)=>res.json(await store.setEventConfig(req.params.id,req.body,req.ip)));
 app.get('/api/admin/tower',guard,(req,res)=>res.json(store.towerAdmin(req.query.page)));
 app.post('/api/admin/tower',guard,async(req,res)=>res.json(await store.setTower(req.body,req.ip)));
 app.get('/api/admin/guild-boss',guard,async(req,res)=>res.json(await store.guildBossAdmin()));
 app.post('/api/admin/guild-boss',guard,async(req,res)=>res.json(await store.setGuildBoss(req.body,req.ip)));
 app.get('/api/admin/content',guard,(req,res)=>res.json(store.contentAdmin()));
 app.post('/api/admin/content/monsters',guard,async(req,res)=>res.json(await store.setMonsters(req.body,req.ip)));
 app.post('/api/admin/content/stages/:mode',guard,async(req,res)=>res.json(await store.setStages(req.params.mode,req.body,req.ip)));
 app.get('/api/admin/rewards',guard,async(req,res)=>res.json(await store.rewardAdmin()));
 app.post('/api/admin/rewards/:id',guard,async(req,res)=>res.json(await store.setRewardConfig(req.params.id,req.body,req.ip)));
 app.get('/api/admin/raid',guard,async(req,res)=>res.json(await store.raidAdmin()));
 app.post('/api/admin/raid',guard,async(req,res)=>res.json(await store.setRaidConfig(req.body,req.ip)));
 app.get('/api/admin/beast',guard,async(req,res)=>res.json(await store.beastAdmin()));
 app.get('/api/admin/beast/ranking/:boss',guard,async(req,res)=>res.json(await store.beastAdminRanking(req.params.boss,Number(req.query.season))));
 app.post('/api/admin/beast/rewards',guard,async(req,res)=>{requireCondition(Array.isArray(req.body?.bosses)&&req.body.bosses.length,'Hãy chọn boss.');await store.setBeastRewards(req.body.bosses,req.body.ranks,req.ip);res.json(await store.beastAdmin())});
 app.post('/api/admin/beast/boss/:boss',guard,async(req,res)=>{await store.setBeastBoss(req.params.boss,req.body?.reset===true?'reset':req.body,req.ip);res.json(await store.beastAdmin())});
 app.post('/api/admin/beast/config',guard,async(req,res)=>{await store.setBeastConfig(req.body,req.ip);res.json(await store.beastAdmin())});
 app.post('/api/admin/beast/season',guard,async(req,res)=>{await store.setBeastEnd(req.body?.endsAt,req.ip);res.json(await store.beastAdmin())});
 app.post('/api/admin/players/:id/password',guard,async(req,res)=>{
  const password=req.body?.password;
  requireCondition(typeof password==='string'&&password.length>=8&&password.length<=128,'Mật khẩu phải có 8–128 ký tự.');
  await store.adminSetPassword(req.params.id,password,req.ip);res.json(await store.adminPlayer(req.params.id));
 });
 app.post('/api/admin/players/:id/lock',guard,async(req,res)=>{
  requireCondition(typeof req.body?.locked==='boolean','Dữ liệu không hợp lệ.');
  await store.adminLock(req.params.id,req.body.locked,req.ip);res.json(await store.adminPlayer(req.params.id));
 });
}
