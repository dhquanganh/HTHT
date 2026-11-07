const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_stones_'+crypto.randomBytes(6).toString('hex'),port=4208,url=`http://127.0.0.1:${port}`,output='qa-output/stones';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_stones_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await page.waitForTimeout(300)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Stone_QA');await page.locator('#password').fill('stone-password-1');await page.locator('#password-confirm').fill('stone-password-1');await page.locator('.auth-submit').click();await ready();
 const hero=async set=>{await players.updateOne({usernameKey:'stone_qa'},{$set:set});await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(1156));await page.waitForFunction(()=>GameView.getSceneId()===1156&&document.querySelector('#loading').hidden);await page.locator('[data-action=hero-tab][data-tab=equipment]').click();await page.waitForSelector('[data-action=stone-open]')};
 await hero({'player.hero.level':29});await shot('locked');assert.equal(await page.locator('.stone-locked').count(),1);
 await page.locator('[data-action=stone-open]').click();await page.waitForSelector('#toast:not([hidden])');assert.match(await page.locator('#toast').innerText(),/cấp 30/);
 await hero({'player.hero.level':30,'player.wallet.gold':5e7,'player.inventory.consumable:3':5000,'player.inventory.consumable:1001':120,'player.inventory.consumable:60004':1});
 await page.locator('[data-action=stone-open]').click();await page.waitForSelector('.stone-popup');assert.equal(await page.evaluate(()=>GameRuntime.player.hero.stone.id),1);await shot('info-blue');
 await page.locator('[data-action=stone-upgrade-open]').click();await page.waitForSelector('.stone-compare');await shot('upgrade');
 await page.locator('[data-action=stone-upgrade]').click();await page.waitForFunction(()=>GameRuntime.player.hero.stone.id===2);
 await page.locator('[data-action=stone-convert-open]').click();await page.waitForSelector('.stone-costs');await shot('convert');
 const line=await page.evaluate(()=>GameRuntime.player.hero.stone.effect.join());await page.locator('[data-action=stone-convert]').click();await page.waitForFunction(l=>GameRuntime.player.hero.stone.effect.join()!==l,line);
 await page.locator('[data-action=stone-close]').click();await page.waitForSelector('.stone-popup',{state:'detached'});
 // Đá Cam from the bag installs Đá Cam 1 sao, and the 2800 Công / 31% Công row exists at 6 sao.
 await players.updateOne({usernameKey:'stone_qa'},{$set:{'player.hero.stone':{id:20,effect:[0,0]}}});await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(1156));await page.waitForFunction(()=>GameView.getSceneId()===1156&&document.querySelector('#loading').hidden);await page.locator('[data-action=hero-tab][data-tab=equipment]').click();await page.waitForSelector('.stone-slot');await page.locator('[data-action=stone-open]').click();await page.waitForSelector('.stone-popup');assert.match(await page.locator('.stone-popup').innerText(),/Đá Cam[\s\S]*2800 Công, 31% Công/);await shot('info-orange');
 await page.locator('[data-action=stone-close]').click();
 const before=await page.evaluate(()=>GameRuntime.player.wallet.gold);
 await page.evaluate(()=>GameRuntime.navigate(12));await page.waitForFunction(()=>GameView.getSceneId()===12&&document.querySelector('#loading').hidden);await page.locator('.reference-bag-tabs [data-tab="consumable"]').click();await page.locator('[data-item="consumable:1001"]').first().click();await page.locator('[data-action=use-open]').click();await page.waitForSelector('.use-popup');
 assert.equal(await page.locator('#use-count').inputValue(),'120');await page.locator('[data-action=use-step][data-step="-1"]').click();assert.equal(await page.locator('#use-count').inputValue(),'119');await page.locator('#use-count').fill('100');await shot('use-many');
 await page.locator('[data-action=use-many]').click();await page.waitForFunction(()=>(GameRuntime.player.inventory['consumable:1001']||0)===20);const after=await page.evaluate(()=>GameRuntime.player.wallet.gold);assert.equal(after-before,100000,'100 gold bags');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,gold:[before,after],errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
