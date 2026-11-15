import {publicEvents,checkinRewards} from './events.mjs';
import express from 'express';
import helmet from 'helmet';
import {timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GameError,requireCondition} from './errors.mjs';
import {publicCatalog} from './catalog.mjs';
import {customHeroFile} from './custom-heroes.mjs';
import {mountAdmin} from './admin.mjs';
const staticRoot=fileURLToPath(new URL('../dist',import.meta.url));
function credentials(body){
 requireCondition(body&&typeof body.username==='string'&&/^[A-Za-z0-9_]{3,24}$/.test(body.username),'Tên đăng nhập gồm 3–24 chữ cái, số hoặc dấu _.');
 requireCondition(typeof body.password==='string'&&body.password.length>=8&&body.password.length<=128,'Mật khẩu phải có 8–128 ký tự.');return{username:body.username,password:body.password};
}
function tokenFrom(req){const raw=req.headers.cookie||'';const part=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith('ht_session='));return part?.slice('ht_session='.length)}
function cookieOptions(req){return{httpOnly:true,sameSite:'lax',secure:req.secure,maxAge:7*86400000,path:'/'}}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function rateLimiter(limit,windowMs){const buckets=new Map();let count=0;return(req,res,next)=>{const now=Date.now();const key=req.ip+'|'+(typeof req.body?.username==='string'?req.body.username.toLowerCase():'');let bucket=buckets.get(key);if(!bucket||bucket.until<now){bucket={count:0,until:now+windowMs};buckets.set(key,bucket)}bucket.count++;if(++count%200===0)for(const [k,v]of buckets)if(v.until<now)buckets.delete(k);if(bucket.count>limit){res.set('Retry-After',String(Math.ceil((bucket.until-now)/1000)));return next(new GameError('Bạn thao tác quá nhanh. Vui lòng thử lại sau.',429,'RATE_LIMITED'))}next()}}
export function createApp(store,{adminPassword=process.env.ADMIN_PASSWORD}={}){
 const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:'],fontSrc:["'self'",'data:'],connectSrc:["'self'"],mediaSrc:["'self'"],objectSrc:["'none'"],upgradeInsecureRequests:null}},crossOriginEmbedderPolicy:false,hsts:process.env.NODE_ENV==='production'?undefined:false}));
 // JSON 16 KB cho mọi API; riêng lưu danh sách tranh Người Cá (quản trị, ~120+ tranh) được 512 KB.
 {const small=express.json({limit:'16kb',strict:true}),large=express.json({limit:'512kb',strict:true});const hero=express.json({limit:'2mb',strict:true});app.use((req,res,next)=>(req.path==='/api/admin/album'?large:req.path==='/api/admin/heroes/save'?hero:small)(req,res,next))}
 app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(req.method!=='GET'&&req.headers.origin){requireCondition(req.headers.origin===`${req.protocol}://${req.get('host')}`,'Nguồn yêu cầu không hợp lệ.',403,'ORIGIN_REJECTED')}next()});
 app.use('/api',rateLimiter(240,60000));
 const authRate=rateLimiter(20,15*60000);
 app.get('/api/health',async(req,res)=>{await store.db.command({ping:1});res.json({ok:true,service:'haitacphucsinh',database:'connected'})});
 app.get('/api/catalog',(req,res)=>res.json(publicCatalog()));
 const auth=async(req,res,next)=>{const session=await store.getSession(tokenFrom(req));requireCondition(session,'Bạn cần đăng nhập.',401,'UNAUTHENTICATED');req.gameSession=session;next()};
 const csrf=(req,res,next)=>{requireCondition(equal(req.get('X-CSRF-Token'),req.gameSession.csrfToken),'Phiên thao tác hết hạn. Hãy tải lại trang.',403,'CSRF_REJECTED');next()};
 const loginResponse=async(req,res,user)=>{const {token,session}=await store.createSession(user._id);res.cookie('ht_session',token,cookieOptions(req));res.json({player:await store.view(user._id),csrfToken:session.csrfToken})};
 app.post('/api/auth/register',authRate,async(req,res)=>{const {username,password}=credentials(req.body);const user=await store.createUser(username,password);await loginResponse(req,res,user)});
 app.post('/api/auth/login',authRate,async(req,res)=>{const {username,password}=credentials(req.body);const user=await store.authenticate(username,password);const previous=tokenFrom(req);if(previous)await store.deleteSession(previous);await loginResponse(req,res,user)});
 app.get('/api/auth/session',auth,async(req,res)=>res.json({player:await store.view(req.gameSession.userId),csrfToken:req.gameSession.csrfToken}));
 app.post('/api/auth/logout',auth,csrf,async(req,res)=>{await store.deleteSession(tokenFrom(req));res.clearCookie('ht_session',{httpOnly:true,sameSite:'lax',secure:req.secure,path:'/'});res.json({ok:true})});
 app.get('/api/state',auth,async(req,res)=>res.json({player:await store.view(req.gameSession.userId)}));
 app.get('/api/dungeon/ranking',auth,async(req,res)=>res.json(await store.dungeonRanking(req.gameSession.userId)));
 app.get('/api/tower/ranking',auth,async(req,res)=>res.json(await store.towerRanking(req.gameSession.userId)));
 app.get('/api/events',auth,(req,res)=>res.json({events:publicEvents(),checkinRewards}));
 app.get('/api/beast',auth,async(req,res)=>res.json(await store.beastStatus(req.gameSession.userId)));
 app.get('/api/beast/boss/:key',auth,async(req,res)=>res.json(await store.beastDetail(req.gameSession.userId,req.params.key)));
 app.post('/api/beast/claim',auth,csrf,async(req,res)=>res.json(await store.beastClaim(req.gameSession.userId,req.get('Idempotency-Key'))));
 // Chiến trường: Đơn đấu / Liên đấu / Võ đấu.
 const arenaKey=req=>req.get('Idempotency-Key');
 app.get('/api/arena',auth,async(req,res)=>res.json(await store.arenaHub(req.gameSession.userId)));
 // Đấu Trường Tân Tinh (NOVA_*)
 app.get('/api/sanji/ranks',auth,async(req,res)=>res.json(await store.sanjiRanks(req.gameSession.userId)));
 app.post('/api/sanji/send',auth,csrf,async(req,res)=>res.json(await store.sanjiSend(req.gameSession.userId,arenaKey(req),novaBody(req))));
 app.get('/api/nova',auth,async(req,res)=>res.json(await store.novaStatus(req.gameSession.userId)));
 app.get('/api/nova/ranks',auth,async(req,res)=>res.json(await store.novaRanks(req.gameSession.userId,req.query.stage,req.query.group)));
 app.get('/api/nova/history',auth,async(req,res)=>res.json(await store.novaHistory(req.gameSession.userId)));
 app.get('/api/nova/top',auth,async(req,res)=>res.json(await store.novaTop()));
 app.get('/api/nova/schedule',auth,async(req,res)=>res.json(await store.novaSchedule()));
 const novaBody=req=>{requireCondition(req.body&&typeof req.body==='object'&&!Array.isArray(req.body),'Dữ liệu không hợp lệ.');return req.body};
 app.post('/api/nova/team',auth,csrf,async(req,res)=>res.json(await store.novaTeam(req.gameSession.userId,arenaKey(req),novaBody(req))));
 app.post('/api/nova/attack',auth,csrf,async(req,res)=>res.json(await store.novaAttack(req.gameSession.userId,arenaKey(req),novaBody(req))));
 app.post('/api/nova/bet',auth,csrf,async(req,res)=>res.json(await store.novaBet(req.gameSession.userId,arenaKey(req),novaBody(req))));
 app.post('/api/nova/like',auth,csrf,async(req,res)=>res.json(await store.novaLike(req.gameSession.userId,arenaKey(req),novaBody(req))));
 app.post('/api/nova/quest',auth,csrf,async(req,res)=>res.json(await store.mutate(req.gameSession.userId,arenaKey(req),'nova-quest',novaBody(req),{nova:{season:(await import('./nova.mjs')).schedule().season}})));
 app.post('/api/nova/shop',auth,csrf,async(req,res)=>res.json(await store.mutate(req.gameSession.userId,arenaKey(req),'nova-shop',novaBody(req),{nova:{season:(await import('./nova.mjs')).schedule().season}})));
 app.get('/api/arena-player/:id',auth,async(req,res)=>res.json(await store.arenaPlayer(req.params.id)));
 app.get('/api/allstars/bracket',auth,async(req,res)=>res.json(await store.allstarBracket(req.gameSession.userId)));
 app.post('/api/allstars/bet',auth,csrf,async(req,res)=>res.json(await store.allstarBet(req.gameSession.userId,arenaKey(req),req.body)));
 app.post('/api/arena/defense',auth,csrf,async(req,res)=>{requireCondition(req.body&&typeof req.body==='object'&&!Array.isArray(req.body),'Dữ liệu không hợp lệ.');res.json(await store.mutate(req.gameSession.userId,arenaKey(req),'arena-defense',req.body))});
 app.post('/api/arena/buy',auth,csrf,async(req,res)=>{requireCondition(req.body&&typeof req.body==='object'&&!Array.isArray(req.body),'Dữ liệu không hợp lệ.');res.json(await store.mutate(req.gameSession.userId,arenaKey(req),'arena-buy',req.body))});
 app.get('/api/arena/:mode',auth,async(req,res)=>res.json(await store.arenaScene(req.gameSession.userId,req.params.mode,{by:req.query.by==='rank'?'rank':req.query.by==='points'?'points':undefined})));
 app.get('/api/arena/:mode/rivals',auth,async(req,res)=>res.json(await store.arenaRivals(req.gameSession.userId,req.params.mode,false)));
 app.post('/api/arena/:mode/rivals',auth,csrf,async(req,res)=>res.json(await store.arenaRivals(req.gameSession.userId,req.params.mode,true)));
 app.get('/api/arena/:mode/last',auth,async(req,res)=>res.json(await store.arenaLast(req.params.mode)));
 app.get('/api/arena/:mode/records',auth,async(req,res)=>res.json(await store.arenaHistory(req.gameSession.userId,req.params.mode)));
 app.post('/api/arena/:mode/fight',auth,csrf,async(req,res)=>{requireCondition(req.body&&typeof req.body==='object'&&!Array.isArray(req.body),'Dữ liệu không hợp lệ.');res.json(await store.arenaFight(req.gameSession.userId,arenaKey(req),req.params.mode,req.body))});
 // Hạm đội
 const body=req=>{requireCondition(req.body&&typeof req.body==='object'&&!Array.isArray(req.body),'Dữ liệu không hợp lệ.');return req.body};
 app.get('/api/guild',auth,async(req,res)=>res.json(await store.guildStatus(req.gameSession.userId)));
 app.get('/api/guild/search',auth,async(req,res)=>res.json(await store.guildSearch(req.gameSession.userId,typeof req.query.q==='string'?req.query.q:'')));
 app.get('/api/guild/boss',auth,async(req,res)=>res.json(await store.guildBoss(req.gameSession.userId,req.query.stage)));
 app.post('/api/guild/create',auth,csrf,async(req,res)=>res.json(await store.guildCreate(req.gameSession.userId,req.get('Idempotency-Key'),body(req))));
 app.post('/api/guild/apply',auth,csrf,async(req,res)=>res.json(await store.guildApply(req.gameSession.userId,body(req).guildId)));
 app.post('/api/guild/manage',auth,csrf,async(req,res)=>res.json(await store.guildManage(req.gameSession.userId,body(req))));
 app.post('/api/guild/edit',auth,csrf,async(req,res)=>res.json(await store.guildEdit(req.gameSession.userId,body(req))));
 app.post('/api/guild/leave',auth,csrf,async(req,res)=>res.json(await store.guildLeave(req.gameSession.userId,req.get('Idempotency-Key'))));
 for(const [url,action] of [['/api/guild/rollcall','guild-rollcall'],['/api/guild/donate','guild-donate'],['/api/guild/tech','guild-tech'],['/api/guild/boss/attack','guild-boss'],['/api/guild/boss/buy','guild-boss-buy']])
  app.post(url,auth,csrf,async(req,res)=>res.json(await store.guildAct(req.gameSession.userId,req.get('Idempotency-Key'),action,body(req))));
 app.get('/api/tth/ranking',auth,async(req,res)=>res.json(await store.tthRanking(req.gameSession.userId,req.query.boss)));
 app.get('/api/raid',auth,async(req,res)=>res.json(await store.raidStatus(req.gameSession.userId)));
 app.post('/api/profile',auth,csrf,async(req,res)=>{requireCondition(req.body&&typeof req.body==='object'&&!Array.isArray(req.body),'Dữ liệu không hợp lệ.');const data=await store.mutate(req.gameSession.userId,req.get('Idempotency-Key'),'profile-update',req.body);res.json({...data,player:await store.view(req.gameSession.userId)})});
 const routes={'/api/intro':'intro','/api/dice':'dice','/api/casino':'casino','/api/tavern':'tavern','/api/sealed':'sealed','/api/sealed/fight':'sealed-fight','/api/brave':'brave','/api/brave/fight':'brave-fight','/api/dungeon':'dungeon','/api/dungeon/fight':'dungeon-fight','/api/altar':'altar','/api/tutorial':'tutorial','/api/ship':'ship','/api/formation':'formation-save','/api/wallet/daily':'daily','/api/shop/buy':'buy','/api/items/use':'use','/api/items/sell':'sell','/api/hero/select':'hero-select','/api/hero/upgrade':'upgrade','/api/hero/equip':'equip','/api/hero/unequip':'unequip','/api/adventure/start':'battle-start','/api/adventure/afk-claim':'afk-claim','/api/tower/start':'tower-start','/api/forge':'forge','/api/album/roll':'album-roll','/api/abyss/start':'abyss-start','/api/achievement/claim':'achievement-claim','/api/mastery/claim':'mastery-claim','/api/mastery/milestone':'mastery-milestone','/api/abyss/claim':'abyss-claim','/api/abyss/buy':'abyss-buy','/api/abyss/milestone':'abyss-milestone','/api/hero/stone/unlock':'stone-unlock','/api/hero/stone/upgrade':'stone-upgrade','/api/hero/stone/convert':'stone-convert','/api/hero/special':'special-upgrade','/api/daily-quest/claim':'daily-quest-claim','/api/home-quest/claim':'home-quest-claim','/api/sr/checkin':'sr-checkin','/api/sr/start':'sr-start','/api/sr/claim':'sr-claim','/api/sr/season':'sr-season','/api/pet/recruit':'pet-recruit','/api/pet/combine':'pet-combine','/api/pet/level':'pet-level','/api/pet/growth':'pet-growth','/api/pet/erase':'pet-erase','/api/pet/enlight':'pet-enlight','/api/pet/star':'pet-star','/api/pet/equip':'pet-equip','/api/haki/pick':'haki-pick','/api/talent':'talent','/api/raid/start':'raid-start','/api/raid/buy':'raid-buy','/api/raid/smash':'raid-smash','/api/tth/attack':'tth-attack','/api/tth/buy':'tth-buy','/api/exc':'exc','/api/artifact/upgrade':'artifact-upgrade','/api/germa/upgrade':'germa-upgrade','/api/germa/reset':'germa-reset','/api/fruit/combine':'fruit-combine','/api/fruit/level':'fruit-level','/api/fruit/star':'fruit-star','/api/fruit/roll':'fruit-roll','/api/fruit/heroes':'fruit-heroes','/api/fruit/unlock':'fruit-unlock','/api/gem/equip':'gem-equip','/api/gem/auto':'gem-auto','/api/gem/unequip':'gem-unequip','/api/gem/sell':'gem-sell','/api/gem/summon':'gem-summon','/api/gem/debuffs':'gem-debuffs','/api/gem/boss':'gem-boss','/api/xmas/sock-buy':'xmas-sock-buy','/api/xmas/sock-claim':'xmas-sock-claim','/api/xmas/ginger':'xmas-ginger','/api/xmas/ginger-buy':'xmas-ginger-buy','/api/xmas/bag':'xmas-bag','/api/xmas/wish-set':'xmas-wish-set','/api/xmas/wish':'xmas-wish','/api/xmas/milestone':'xmas-milestone','/api/xmas/shop':'xmas-shop','/api/decor/daily':'decor-daily','/api/decor/create':'decor-create','/api/decor/legend':'decor-legend','/api/decor/mythic':'decor-mythic','/api/decor/hero':'decor-hero','/api/decor/place':'decor-place','/api/decor/auto':'decor-auto','/api/decor/clear':'decor-clear','/api/decor/recycle':'decor-recycle','/api/sanji/skip':'sanji-skip','/api/sanji/claim':'sanji-claim','/api/sanji/buy':'sanji-buy','/api/pot/enter':'pot-enter','/api/pot/team':'pot-team','/api/pot/move':'pot-move','/api/pot/relic':'pot-relic','/api/freedom/join':'freedom-join','/api/freedom/reset':'freedom-reset','/api/freedom/team':'freedom-team','/api/freedom/help':'freedom-help','/api/freedom/attack':'freedom-attack','/api/freedom/claim':'freedom-claim','/api/freedom/quit':'freedom-quit','/api/impel/enter':'impel-enter','/api/impel/open':'impel-open','/api/impel/floor':'impel-floor','/api/impel/claim':'impel-claim','/api/impel/buy':'impel-buy','/api/event/unlock':'event-unlock','/api/event/claim':'event-claim','/api/event/spin':'event-spin','/api/event/free':'event-free','/api/event/rollcall':'event-rollcall','/api/event/buy':'event-buy','/api/event/stage':'event-stage','/api/event/exchange':'event-exchange','/api/event/pray':'event-pray','/api/items/merge':'shard-merge','/api/mail/claim':'mail-claim','/api/mail/delete':'mail-delete','/api/beast/start':'beast-start','/api/summon':'summon','/api/items/choose':'item-choose','/api/items/open':'chest-open','/api/battle/action':'battle-action','/api/battle/leave':'battle-leave'};
 for(const [url,action]of Object.entries(routes))app.post(url,auth,csrf,async(req,res)=>{requireCondition(req.body&&typeof req.body==='object'&&!Array.isArray(req.body),'Dữ liệu không hợp lệ.');res.json(await store.mutate(req.gameSession.userId,req.get('Idempotency-Key'),action,req.body))});
 mountAdmin(app,store,adminPassword,authRate);
 app.get('/admin',(req,res)=>res.redirect('/admin.html'));
 // Ảnh tranh Người Cá tải lên ở trang quản trị.
 // Nhân vật tạo ở trang quản trị: ảnh tải lên và tệp Spine sinh từ sprite sheet (đường dẫn có số phiên bản nên cache lâu được).
 app.get('/hero-art/:file',async(req,res)=>{const m=/^([a-f0-9]{24})\.webp$/.exec(req.params.file),doc=m&&await store.heroArtFile(m[1]);if(!doc)return res.status(404).end();res.set({'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});res.send(doc.data.buffer?Buffer.from(doc.data.buffer):doc.data)});
 app.get('/custom-hero/:avatar/:rev/:file',(req,res)=>{const f=customHeroFile(req.params.avatar,req.params.rev,req.params.file);if(!f)return res.status(404).end();res.set({'Content-Type':f.type,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});res.send(f.body)});
 app.get('/album-art/:file',async(req,res)=>{const m=/^([a-f0-9]{24})\.webp$/.exec(req.params.file),doc=m&&await store.albumArtFile(m[1]);if(!doc)return res.status(404).end();res.set({'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});res.send(doc.data.buffer?Buffer.from(doc.data.buffer):doc.data)});
 app.use('/api',(req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'API không tồn tại.'}}));
 app.use(express.static(staticRoot,{dotfiles:'deny',index:'index.html',maxAge:0,etag:true}));
 app.use((err,req,res,next)=>{
  if(err instanceof GameError)return res.status(err.status).json({error:{code:err.code,message:err.message}});
  if(err.type==='entity.parse.failed')return res.status(400).json({error:{code:'INVALID_JSON',message:'JSON không hợp lệ.'}});
  if(err.type==='entity.too.large')return res.status(413).json({error:{code:'BODY_TOO_LARGE',message:'Dữ liệu yêu cầu quá lớn.'}});
  // Never put connection strings, password hashes or driver diagnostics in HTTP responses.
  console.error(JSON.stringify({event:'request_error',name:err.name,code:err.code||null,path:req.path}));
  res.status(500).json({error:{code:'SERVER_ERROR',message:'Không thể hoàn tất thao tác. Vui lòng thử lại.'}});
 });
 return app;
}
