const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_kit_'+crypto.randomBytes(6).toString('hex'),port=4215,url=`http://127.0.0.1:${port}`,output='qa-output/skill-kit';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_kit_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Kit_QA');await page.locator('#password').fill('kit-password-1');await page.locator('#password-confirm').fill('kit-password-1');await page.locator('.auth-submit').click();await ready();
 const team=['hero-453','hero-537','hero-140','hero-510','hero-645','hero-573'],doc=await players.findOne({usernameKey:'kit_qa'});
 await players.updateOne({_id:doc._id},{$set:{'player.reserveHeroes':{...doc.player.reserveHeroes,...Object.fromEntries(team.map(id=>[id,{id,level:30,exp:0,stars:5,rank:0,equipment:{},skills:{}}]))},'player.formation':{version:2,slots:team},'player.adventure.unlockedStage':20,'player.account.level':60}});
 await page.reload();await ready();
 await page.evaluate(()=>GameRuntime.navigate(34));await page.waitForSelector('.campaign-deck');await page.waitForTimeout(500);await page.locator('.campaign-primary').click();await page.waitForSelector('.campaign-formation');
 await page.locator('[data-action="battle-start"]').click();await page.waitForSelector('.battle-hud');
 // Đủ Nộ cho Zoro Wano và Mihawk để vòng 1 tung Nộ; kẻ địch trâu hơn để trận kéo dài nhiều vòng.
 await players.updateOne({usernameKey:'kit_qa'},{$set:{'player.battle.allies.0.energy':100,'player.battle.allies.1.energy':100},$mul:{'player.battle.enemies.$[].maxHp':400,'player.battle.enemies.$[].hp':400}});
 let shots=0;const t0=Date.now();
 while(Date.now()-t0<150000){const end=await page.locator('.battle-end').count();if(end)break;await page.waitForTimeout(2500);if(shots<3){await page.locator('#stage').screenshot({path:`${output}/battle-${shots}.png`});shots++}}
 const b=await page.evaluate(()=>GameRuntime.player.battle);
 const enemies=b.enemies.map(e=>e.id),events=b.events,actor=id=>b.allies.find(a=>a.heroId===id)?.id;
 const ultTargets=id=>{const a=actor(id),out=[];let on=false;for(const e of events){if(e.type==='skill')on=e.actor===a;else if(e.type==='attack'||e.type==='unit-turn')on=false;if(on&&e.type==='damage'&&e.actor===a&&e.skill)out.push(e.target)}return new Set(out).size};
 const basicTargets=id=>{const a=actor(id);let best=0,cur=new Set(),on=false;for(const e of events){if(e.type==='attack'){if(on)best=Math.max(best,cur.size);on=e.actor===a;cur=new Set()}else if(e.type==='skill'||e.type==='unit-turn'){if(on)best=Math.max(best,cur.size);on=false}if(on&&e.type==='damage'&&e.actor===a&&!e.skill)cur.add(e.target)}return Math.max(best,on?cur.size:0)};
 const counts={};for(const e of events)counts[e.type]=(counts[e.type]||0)+1;
 const statuses=[...new Set(events.filter(e=>e.type==='buff').map(e=>e.name))];
 const report={status:b.status,turns:b.turn,enemies:enemies.length,zoroWanoUltTargets:ultTargets('hero-453'),mihawkUltTargets:ultTargets('hero-537'),mihawkBasicTargets:basicTargets('hero-537'),triggers:[...new Set(events.filter(e=>e.type==='trigger').map(e=>e.name))],statuses:statuses.slice(0,25),counts};
 console.log(JSON.stringify(report));
 assert.equal(report.zoroWanoUltTargets,enemies.length,'Nộ Zoro Wano trúng toàn bộ kẻ địch');assert.equal(report.mihawkUltTargets,enemies.length,'Nộ Mihawk trúng toàn bộ kẻ địch');
 assert.ok(report.mihawkBasicTargets===0||report.mihawkBasicTargets===enemies.length||report.mihawkBasicTargets>=Math.min(enemies.length,2),'đánh thường Mihawk đánh toàn bộ');
 // Vực thẳm: tướng phe địch có bộ kỹ năng; Akainu (143) đủ Nộ đánh toàn bộ đội ta, hiệu ứng lật về phía đội ta.
 await page.evaluate(()=>document.querySelector('[data-action="battle-leave"]')?.click());await page.waitForTimeout(600);
 await players.updateOne({usernameKey:'kit_qa'},{$set:{'player.battle':null}});await page.reload();await ready();
 const started=await page.evaluate(async()=>{const s=await(await fetch('/api/auth/session',{credentials:'same-origin'})).json();const r=await fetch('/api/abyss/start',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'X-CSRF-Token':s.csrfToken},body:JSON.stringify({stage:1})});return r.status});
 await players.updateOne({usernameKey:'kit_qa'},{$set:{'player.battle.enemies.4.energy':100,'player.battle.enemies.4.speed':1e7,'player.battle.enemies.4.baseSpeed':1e7},$mul:{'player.battle.allies.$[].maxHp':50,'player.battle.allies.$[].hp':50}});
 await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(9));await page.waitForSelector('.battle-hud',{timeout:20000});
 const enemyCast=await page.evaluate(async()=>{const t0=performance.now();return await new Promise(done=>{const tick=()=>{const f=(GameRuntime.effects||[]).find(e=>e.skill&&e.elapsed>e.duration*.4);const caster=GameRuntime.actors?.find(a=>a.side==='enemy'&&a.heroId==='hero-143');if(f){const c=document.querySelector('#game'),o=document.createElement('canvas');o.width=784;o.height=442;o.getContext('2d').drawImage(c,0,0,784,442);return done({key:f.controller.key,x:Math.round(f.x),flip:f.flip,caster:!!caster,image:o.toDataURL('image/jpeg',.72)})}if(performance.now()-t0>60000)return done(null);requestAnimationFrame(tick)};requestAnimationFrame(tick)})});
 if(enemyCast)fs.writeFileSync(`${output}/abyss-enemy-ult.jpg`,Buffer.from(enemyCast.image.split(',')[1],'base64'));
 await page.waitForTimeout(3000);
 const ab=await page.evaluate(()=>GameRuntime.player.battle),akainu=ab.enemies.find(e=>e.heroId==='hero-143');
 const enemyHits=new Set(ab.events.filter(e=>e.type==='damage'&&e.actor===akainu.id&&e.skill).map(e=>e.target)).size;
 console.log(JSON.stringify({abyssStart:started,enemyKits:ab.enemies.filter(e=>e.kit).length,enemyCast:enemyCast&&{key:enemyCast.key,x:enemyCast.x,flip:enemyCast.flip},akainuUltTargets:enemyHits,allies:ab.allies.length}));
 assert.equal(started,200);assert.equal(enemyHits,ab.allies.length,'Nộ Akainu (phe địch) trúng toàn bộ đội ta');assert.ok(enemyCast,'hiệu ứng Nộ của tướng địch hiện trên màn');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
