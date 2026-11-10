const {chromium}=require('playwright-core'),{MongoClient,ObjectId}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_beast_'+crypto.randomBytes(6).toString('hex'),port=4202,url=`http://127.0.0.1:${port}`,output='qa-output/beast',secret=crypto.randomBytes(18).toString('base64url');let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',ADMIN_PASSWORD:secret},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
const stop=s=>new Promise(resolve=>{s.removeAllListeners('exit');s.once('exit',resolve);s.kill()});
const call=async(path,{cookie='',csrf='',body,admin}={})=>{const headers={'Content-Type':'application/json',cookie};if(body!==undefined){headers['Idempotency-Key']=crypto.randomUUID();headers[admin?'X-Admin-CSRF':'X-CSRF-Token']=csrf}const r=await fetch(url+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});let data={};try{data=await r.json()}catch{}return{status:r.status,data,setCookie:r.headers.get('set-cookie')}};
const register=async username=>{const r=await call('/api/auth/register',{body:{username,password:'beast-password-1'}});assert.equal(r.status,200);return{username,cookie:r.setCookie.split(';')[0],csrf:r.data.csrfToken,id:r.data.player.profile.id}};
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();
 client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_beast_[a-f0-9]{12}$/);const db=client.db(database),players=db.collection('players'),bossDb=db.collection('beast_bosses'),rankDb=db.collection('beast_ranking'),payouts=db.collection('beast_payouts'),seasons=db.collection('beast_seasons');
 const catalog=(await call('/api/catalog')).data,assassins=catalog.heroes.filter(h=>h.class==='assassin'&&h.ultimate).slice(0,5);
 const give=async(user,scale=1)=>{const doc=await players.findOne({usernameKey:user.username.toLowerCase()});const reserve=doc.player.reserveHeroes||{};for(const h of assassins)reserve[h.id]={id:h.id,level:30*scale,exp:0,stars:scale,rank:0,equipment:{},skills:Object.fromEntries(h.skills.map(s=>[s.id,1]))};await players.updateOne({_id:doc._id},{$set:{'player.reserveHeroes':reserve}})};
 const slots=[...assassins.map(h=>h.id),null];
 const fight=async(user,boss='sea-king')=>{await players.updateOne({usernameKey:user.username.toLowerCase(),'player.beast.season':{$exists:true}},{$set:{'player.beast.lastAttackAt':0}});const r=await call('/api/beast/start',{...user,body:{boss,formation:slots,skip:true}});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.player.battle.reward.damage};

 assert.equal((await call('/api/beast')).status,401,'Login required');
 assert.equal(await bossDb.countDocuments(),5,'Boss stats live in the database');assert.equal((await bossDb.findOne({_id:'sea-king'})).attack,104,'Numbers come from the asset');
 assert.equal(await db.collection('beast_rewards').countDocuments(),5);assert.equal(await seasons.countDocuments({status:'active'}),1);
 const [ann,bob]=[await register('Ann_Beast'),await register('Bob_Beast')];await give(ann,2);await give(bob,1);

 // Five separate tables.
 const first=await fight(ann),second=await fight(bob);assert.ok(first>0&&second>0);await fight(bob,'sea-king');
 let bobTotal=(await rankDb.findOne({displayName:'Bob_Beast',boss:'sea-king'})).damage;assert.ok(bobTotal>second,'Damage accumulates in the table');
 let detail=(await call('/api/beast/boss/sea-king',ann)).data;assert.equal(detail.ranking.total,2);assert.equal(detail.turns,99);assert.ok(detail.ranking.top.every((r,i,all)=>!i||all[i-1].damage>=r.damage),'Sorted by damage');assert.ok(!JSON.stringify(detail).includes(ann.id),'No account ids');
 assert.equal((await call('/api/beast/boss/nola',ann)).data.ranking.total,0,'Nola has its own table');
 const wrong=await call('/api/beast/start',{...ann,body:{boss:'nola',formation:slots,skip:true}});assert.equal(wrong.data.error?.code,'BEAST_WRONG_CLASS','Nola refuses assassins');
 await rankDb.updateOne({displayName:'Ann_Beast',boss:'sea-king'},{$set:{damage:123456789}});detail=(await call('/api/beast/boss/sea-king',bob)).data;assert.equal(detail.ranking.top[0].damage,123456789,'Ranking is read from the collection');
 assert.equal(detail.ranking.top[0].name,'Ann_Beast');

 // Admin: boss stats and rewards apply at once.
 assert.equal((await call('/api/admin/beast')).status,401,'Admin login required');
 const login=await call('/api/admin/login',{body:{password:secret}}),admin={cookie:login.setCookie.split(';')[0],csrf:login.data.csrfToken,admin:true};
 const panel=(await call('/api/admin/beast',admin)).data;assert.equal(panel.bosses.length,5);assert.ok(panel.bosses[0].rewards[0].every(r=>r.icon&&r.name),'Rewards carry icons');
 const before=(await call('/api/beast/boss/sea-king',bob)).data;assert.deepEqual(before.rewards[0].rewards.map(r=>r.quantity),[400000,200,100]);
 const ranks=panel.bosses[0].rewards.map(rank=>rank.map(({itemId,quantity})=>({itemId,quantity})));ranks[0]=[{itemId:'diamonds',quantity:777},{itemId:'consumable:16',quantity:5}];ranks[1]=[{itemId:'gold',quantity:1234}];
 assert.equal((await call('/api/admin/beast/rewards',{...admin,body:{bosses:['sea-king'],ranks}})).status,200);
 const edited=(await call('/api/beast/boss/sea-king',bob)).data;assert.deepEqual(edited.rewards[0].rewards.map(r=>[r.itemId,r.quantity]),[['diamonds',777],['consumable:16',5]],'Game shows edited rewards at once');assert.deepEqual(edited.current.map(r=>r.quantity),[1234],'Own bracket reward follows');
 assert.deepEqual((await call('/api/beast/boss/nola',bob)).data.rewards[0].rewards.map(r=>r.quantity),[400000,200,100],'Other bosses keep theirs');
 assert.equal((await call('/api/admin/beast/rewards',{...admin,body:{bosses:['sea-king'],ranks:[]}})).status,400,'Bad reward rejected');
 const stats=panel.bosses[0].stats;assert.equal((await call('/api/admin/beast/boss/sea-king',{...admin,body:{...stats,speed:1,defense:0+1}})).status,200);
 await fight(bob);const fought=await players.findOne({usernameKey:'bob_beast'});assert.equal(fought.player.battle.enemies[0].speed,1,'New fights use the edited stats');
 await call('/api/admin/beast/boss/sea-king',{...admin,body:{reset:true}});assert.equal((await bossDb.findOne({_id:'sea-king'})).speed,235,'Reset to asset');
 assert.equal((await call('/api/admin/beast/ranking/sea-king',admin)).data.top.length,2,'Admin sees the table');
 await stop(server);server=await start();assert.equal((await bossDb.findOne({_id:'sea-king'})).speed,235);const again=await db.collection('beast_rewards').findOne({_id:'sea-king'});assert.equal(again.ranks[0][0].quantity,777,'Restart keeps admin edits');
 const relogin=await call('/api/admin/login',{body:{password:secret}});admin.cookie=relogin.setCookie.split(';')[0];admin.csrf=relogin.data.csrfToken;

 // Season end: rewards are paid once, the table restarts.
 assert.notEqual((await rankDb.findOne({displayName:'Ann_Beast',boss:'sea-king'})).damage,123456789,'Startup resync repairs the table from players');
 await players.updateOne({usernameKey:'ann_beast'},{$set:{'player.beast.damage.sea-king':123456789}});await rankDb.updateOne({displayName:'Ann_Beast',boss:'sea-king'},{$set:{damage:123456789}});
 const wallet=(await players.findOne({usernameKey:'ann_beast'})).player.wallet.diamonds;
 assert.equal((await call('/api/admin/beast/season',{...admin,body:{endsAt:new Date().toISOString()}})).status,200);
 assert.equal(await seasons.countDocuments({status:'active'}),1);assert.equal((await seasons.findOne({status:'active'}))._id,2);assert.equal(await payouts.countDocuments(),2);
 const status=(await call('/api/beast',ann)).data;assert.equal(status.pending.length,1);assert.equal(status.pending[0].rank,1);assert.equal(status.turns,100,'Turns refill');
 const claim=await call('/api/beast/claim',{...ann,body:{}});assert.equal(claim.status,200,JSON.stringify(claim.data));assert.equal(claim.data.player.wallet.diamonds,wallet+777);
 assert.equal((await call('/api/beast',ann)).data.pending.length,0);await call('/api/beast/claim',{...ann,body:{}});assert.equal((await players.findOne({usernameKey:'ann_beast'})).player.wallet.diamonds,wallet+777,'Second claim pays nothing');
 assert.equal((await call('/api/beast/boss/sea-king',ann)).data.ranking.total,0,'New season starts empty');assert.equal((await call('/api/admin/beast/ranking/sea-king?season=1',admin)).data.top.length,2,'Past tables stay readable');
 assert.equal((await call(`/api/admin/players/${bob.id}/lock`,{...admin,body:{locked:true}})).status,200);await call(`/api/admin/players/${bob.id}/lock`,{...admin,body:{locked:false}});

 // Real screens.
 await fight(ann);const back=await call('/api/auth/login',{body:{username:'Bob_Beast',password:'beast-password-1'}});bob.cookie=back.setCookie.split(';')[0];bob.csrf=back.data.csrfToken;await fight(bob);
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1564,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/401/.test(m.text()))errors.push(m.text())});
 const box=async()=>page.locator('#stage').boundingBox(),click=async(x,y)=>{const b=await box();await page.mouse.click(b.x+x*b.width/1136,b.y+y*b.height/640)};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('#username').fill('Ann_Beast');await page.locator('#password').fill('beast-password-1');await page.locator('.auth-submit').click();await page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 await page.evaluate(()=>GameRuntime.navigate(37));await page.waitForFunction(()=>GameView.getSceneId()===37&&document.querySelector('#loading').hidden);await page.waitForTimeout(600);await page.locator('#stage').screenshot({path:output+'/world.png'});
 await click(160,312);await page.waitForFunction(()=>GameView.getSceneId()===53&&document.querySelector('#loading').hidden);await page.waitForTimeout(1500);await page.locator('#stage').screenshot({path:output+'/islands.png'});
 await click(215,255);await page.waitForFunction(()=>GameView.getSceneId()===1600&&document.querySelector('.beast-list'));await page.waitForFunction(()=>[...document.querySelectorAll('.beast-list img')].every(i=>i.complete&&i.naturalWidth>0));await page.waitForTimeout(1200);await page.locator('#stage').screenshot({path:output+'/boss.png'});
 assert.equal(await page.locator('.beast-row').count(),2,'Both rows on screen');
 if(process.env.QA_DUMP)console.log(await page.evaluate(()=>{const e=document.querySelector('.beast-current');const t=e.children[0];return JSON.stringify({html:e.outerHTML.slice(0,600),rect:t?.getBoundingClientRect(),cs:t&&getComputedStyle(t).display,w:t&&getComputedStyle(t).width,img:t?.querySelector('img')?.getBoundingClientRect(),css:[...document.styleSheets].map(s=>s.href)})}));
 await click(366,178);await page.waitForSelector('.beast-rewards');await page.waitForFunction(()=>[...document.querySelectorAll('.beast-rewards img')].every(i=>i.complete&&i.naturalWidth>0));await page.waitForTimeout(200);await page.locator('#stage').screenshot({path:output+'/rewards.png'});assert.equal(await page.locator('.beast-reward-list article').count(),10);await page.locator('.reference-close').click();
 await click(66,372);await page.waitForSelector('.modal');assert.ok((await page.locator('.modal').innerText()).length>10,'Skill info opens');await page.keyboard.press('Escape');
 await click(142,578);await page.waitForTimeout(200);await page.locator('#stage').screenshot({path:output+'/skip.png'});assert.equal(await page.evaluate(()=>GameView.getScene()&&true),true);await click(142,578);
 await page.waitForFunction(()=>true);await page.evaluate(async()=>{const start=Date.now();while(Date.now()-start<16000)await new Promise(r=>setTimeout(r,500))});
 await click(222,515);await page.waitForSelector('.campaign-formation [data-action="team-fight"]');await page.waitForTimeout(600);await page.locator('#stage').screenshot({path:output+'/team.png'});assert.equal(await page.locator('.campaign-reserves .campaign-hero-card').count(),5,'Only assassins are offered');assert.equal(await page.locator('.campaign-six-slots .campaign-hero-card').count(),5);assert.ok((await page.locator('.campaign-formation').innerText()).includes('được tham chiến'));
 assert.equal(await page.locator('.campaign-ship-slot').count(),1,'ship slot');
 await page.locator('[data-action="team-fight"]').click();await page.waitForFunction(()=>GameView.getSceneId()===9&&document.querySelector('#loading').hidden,{timeout:30000});await page.waitForTimeout(1500);await page.locator('#stage').screenshot({path:output+'/battle.png'});
 await page.evaluate(()=>document.querySelector('.battle-speed,[data-action=battle-auto]')?.click());await page.waitForTimeout(4200);await page.locator('#stage').screenshot({path:output+'/battle2.png'});
 await page.locator('[data-action=battle-skip]').click().catch(()=>{});await page.waitForSelector('.battle-end [data-action=beast-back]',{timeout:60000});await page.waitForTimeout(300);await page.locator('#stage').screenshot({path:output+'/result.png'});
 await page.locator('[data-action=beast-back]').click();await page.waitForFunction(()=>GameView.getSceneId()===1600&&document.querySelector('.beast-list'));
 // Admin tab.
 const adminPage=await browser.newPage({viewport:{width:1400,height:1000}});adminPage.on('pageerror',e=>errors.push(e.message));await adminPage.goto(url+'/admin.html');await adminPage.locator('#password').fill(secret);await adminPage.locator('#login-form button').click();await adminPage.waitForSelector('#tab-beast:visible');await adminPage.locator('#tab-beast').click();await adminPage.waitForSelector('.beast-rank');await adminPage.waitForTimeout(500);await adminPage.screenshot({path:output+'/admin-rewards.png'});
 await adminPage.locator('[data-boss=nola]').click();await adminPage.locator('[data-add="0"]').click();await adminPage.locator('#beast-search').fill('thung bia');await adminPage.waitForSelector('[data-pick]');await adminPage.waitForTimeout(150);await adminPage.screenshot({path:output+'/admin-picker.png'});await adminPage.locator('[data-pick]').first().click();await adminPage.locator('[data-rank="0"]').last().fill('9');await adminPage.locator('#beast-save').click();await adminPage.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Đã lưu'));
 const nolaRewards=(await call('/api/beast/boss/nola',ann)).data.rewards[0].rewards;assert.deepEqual(nolaRewards.at(-1).quantity,9,'Admin page edit reaches the game');assert.equal(nolaRewards.at(-1).itemId,'consumable:16');
 await adminPage.locator('[data-page=ranking]').click();await adminPage.locator('[data-boss=sea-king]').click();await adminPage.waitForSelector('tr.plain');await adminPage.waitForTimeout(200);await adminPage.screenshot({path:output+'/admin-ranking.png'});await adminPage.locator('[data-page=stats]').click();await adminPage.waitForSelector('#beast-stats');await adminPage.screenshot({path:output+'/admin-stats.png'});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
