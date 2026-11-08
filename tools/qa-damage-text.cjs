const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_dmgtext_'+crypto.randomBytes(6).toString('hex'),port=4217,url=`http://127.0.0.1:${port}`,output='qa-output/damage-text';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_dmgtext_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Dmg_QA');await page.locator('#password').fill('dmg-password-1');await page.locator('#password-confirm').fill('dmg-password-1');await page.locator('.auth-submit').click();await ready();
 // Chữ sát thương theo prefab gốc (TextHpLost / TextHpCrit / TextHpBuff / TextHpBlock): chụp liên tục trong lúc đánh.
 const team=['hero-537','hero-411','hero-645'],doc=await players.findOne({usernameKey:'dmg_qa'});
 await players.updateOne({_id:doc._id},{$set:{'player.reserveHeroes':{...doc.player.reserveHeroes,...Object.fromEntries(team.map(id=>[id,{id,level:30,exp:0,stars:5,rank:0,equipment:{},skills:{}}]))},'player.formation':{version:2,slots:team},'player.adventure.unlockedStage':20,'player.account.level':60}});
 await page.reload();await ready();
 await page.evaluate(()=>GameRuntime.navigate(34));await page.waitForSelector('.campaign-deck');await page.waitForTimeout(400);await page.locator('.campaign-primary').click();await page.waitForSelector('.campaign-formation');
 await page.locator('[data-action="battle-start"]').click();await page.waitForSelector('.battle-hud');
 await players.updateOne({usernameKey:'dmg_qa'},{$mul:{'player.battle.enemies.$[].maxHp':300,'player.battle.enemies.$[].hp':300}});
 await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(9));await page.waitForSelector('.battle-hud',{timeout:20000});
 const fonts=await page.evaluate(async()=>{await document.fonts.ready;return [...document.fonts].filter(f=>/ef92121f|1241e6a2/.test(f.family)&&f.status==='loaded').map(f=>f.family)});
 let n=0;const t0=Date.now();while(n<40&&Date.now()-t0<60000){await page.locator('#stage').screenshot({path:`${output}/f-${String(n).padStart(2,'0')}.png`});n++;await page.waitForTimeout(150)}
 console.log(JSON.stringify({fonts,frames:n}));assert.equal(new Set(fonts).size,2,'cả hai font gốc đã nạp');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
