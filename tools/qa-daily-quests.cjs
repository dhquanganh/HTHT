// QA Nhiệm vụ hằng ngày: mở từ nút Nhiệm vụ ở sảnh, chiêu mộ để hoàn thành, nhận thưởng, chụp màn hình.
// Chạy trên database tạm (htps_daily_*) và xóa sau khi xong.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
try{process.loadEnvFile('.env')}catch{}
const db='htps_daily_'+crypto.randomBytes(6).toString('hex'),port=4180,out='qa-output/daily-quests';let server,browser;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:db,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),30000);server.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve()}});server.once('exit',code=>reject(Error('QA exited '+code)))});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=async name=>{await page.waitForFunction(()=>document.querySelector('#loading').hidden);await page.locator('#stage').screenshot({path:`${out}/${name}.png`})};
 await page.goto('http://127.0.0.1:'+port);await page.waitForSelector('#auth-form');await page.locator('[data-action="auth-register"]').click();
 await page.locator('#username').fill('Daily_QA');await page.locator('#password').fill('daily-quest-password-2026');await page.locator('#password-confirm').fill('daily-quest-password-2026');await page.locator('.auth-submit').click();
 await page.waitForFunction(()=>window.GameRuntime?.player&&window.GameView.getSceneId()===13&&document.querySelector('#loading').hidden);
 const mongo=new MongoClient(process.env.MONGODB_URI);await mongo.connect();await mongo.db(db).collection('players').updateOne({usernameKey:'daily_qa'},{$set:{'player.inventory.consumable:16':20}});await mongo.close();await page.reload();await page.waitForFunction(()=>window.GameRuntime?.player&&window.GameView.getSceneId()===13&&document.querySelector('#loading').hidden);
 const open=async()=>{await page.evaluate(()=>GameRuntime.handleHit({name:'ButtonQuest',node:{}}));await page.waitForSelector('.reference-daily')};
 await open();assert.equal(await page.locator('.dq-scroll .dq-cell').count(),10);assert.match(await page.locator('.dq-countdown').innerText(),/^\d\d:\d\d:\d\d$/);
 assert.equal(await page.locator('.dq-summary b').innerText(),'0/10');await shot('daily-empty');
 const first=await page.locator('.dq-countdown').innerText();await page.waitForTimeout(1300);assert.notEqual(await page.locator('.dq-countdown').innerText(),first,'Đồng hồ đếm ngược chạy');
 // Thực hiện → sang màn Chiêu mộ.
 await page.locator('.dq-scroll .dq-cell').first().locator('[data-action="dq-go"]').click();await page.waitForFunction(()=>window.GameView.getSceneId()===24);
 const csrf=await page.evaluate(async()=>{const r=await fetch('/api/auth/session');return (await r.json()).csrfToken});
 for(const count of [1,10]){const r=await page.evaluate(async([count,csrf])=>{const r=await fetch('/api/summon',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'X-CSRF-Token':csrf},body:JSON.stringify({faction:'abyss',count})});return r.status},[count,csrf]);assert.equal(r,200,'summon '+count)}
 await page.reload();await page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);await page.evaluate(()=>window.GameRuntime.navigate(13));await page.waitForFunction(()=>window.GameView.getSceneId()===13);
 await open();assert.equal(await page.locator('[data-action="dq-claim"]').count(),2);await shot('daily-ready');
 const gold=await page.evaluate(()=>window.GameRuntime.player.wallet.gold);
 await page.locator('[data-action="dq-claim"][data-quest="summon-basic"]').click();await page.waitForFunction(g=>window.GameRuntime.player.wallet.gold===g+20000,gold);
 await page.waitForSelector('.reference-daily');assert.equal(await page.locator('.dq-check').count(),1);assert.equal(await page.locator('.dq-summary b').innerText(),'1/10');await shot('daily-claimed');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,shots:fs.readdirSync(out)}));
})().catch(async e=>{console.error(e.stack);if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(process.env.MONGODB_URI){const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();assert.match(db,/^htps_daily_[a-f0-9]{12}$/);await client.db(db).dropDatabase()}finally{await client.close()}}});
