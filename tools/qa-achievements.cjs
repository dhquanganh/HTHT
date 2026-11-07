const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_ach_'+crypto.randomBytes(6).toString('hex'),port=4211,url=`http://127.0.0.1:${port}`,output='qa-output/achievements';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_ach_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Ach_QA');await page.locator('#password').fill('ach-password-1');await page.locator('#password-confirm').fill('ach-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'ach_qa'},{$set:{'player.account.level':37,'player.hero.stars':7,'player.tower.floor':8,'player.hero.level':45,'player.mastery':{points:120,milestones:[50],heroes:{'luffy-gear-2':{lap:1,claimed:[],stats:{fights:4,damage:62000,ultimates:3,attacks:12}}}}}});await page.reload();await ready();
 await page.evaluate(()=>GameRuntime.navigate(13));await scene(13);await page.waitForTimeout(500);
 await page.evaluate(()=>GameRuntime.handleHit({name:'ButtonAchievement',node:{}}));await page.waitForSelector('.ach-popup');await shot('achievements');
 assert.match(await page.locator('.ach-cell').first().innerText(),/Đạt cấp 10[\s\S]*37\/10/);assert.equal(await page.locator('.ach-claim:not(.locked)').count(),6);
 const gold=await page.evaluate(()=>GameRuntime.player.wallet.gold);await page.locator('.ach-claim:not(.locked)').first().click();await page.waitForSelector('.bonus-popup');await shot('achievements-claimed');
 assert.equal(await page.evaluate(()=>GameRuntime.player.wallet.gold),gold+10000);await page.evaluate(()=>document.querySelector('.bonus-popup')?.remove());
 assert.match(await page.locator('.ach-popup').innerText(),/Đạt cấp 20/);await page.locator('.ach-scroll').evaluate(e=>e.scrollTop=9999);await shot('achievements-scrolled');
 await page.locator('[data-action=ach-tab][data-tab=mastery]').click();await page.waitForSelector('.mst-miles');await shot('mastery-points');
 assert.equal(await page.locator('.mst-mile-tag').count(),1,'100 points milestone is ready');assert.equal(await page.locator('.mst-mile-tick').count(),1);
 const gems=await page.evaluate(()=>GameRuntime.player.wallet.diamonds);await page.locator('.mst-mile-rewards[data-points="100"]').click();await page.waitForSelector('.bonus-popup');assert.equal(await page.evaluate(()=>GameRuntime.player.wallet.diamonds),gems+200);await page.evaluate(()=>document.querySelector('.bonus-popup')?.remove());
 await page.locator('.mst-hero[data-hero="luffy-gear-2"]').click();await page.waitForSelector('.mst-quests');await shot('mastery-hero');
 assert.match(await page.locator('.mst-quests').innerText(),/Vòng: 1\/3[\s\S]*Nâng tới cấp 20/);assert.equal(await page.locator('.mst-collect:not(.locked)').count(),4);
 await page.locator('.mst-collect:not(.locked)').first().click();await page.waitForSelector('.bonus-popup');await page.evaluate(()=>document.querySelector('.bonus-popup')?.remove());
 assert.equal(await page.locator('.mst-quest-tick').count(),1);assert.equal(await page.evaluate(()=>GameRuntime.player.mastery.points),130);await shot('mastery-claimed');
 await page.locator('[data-action=ach-close]').click();assert.equal(await page.locator('.ach-popup').count(),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
