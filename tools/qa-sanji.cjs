// QA Bữa tiệc Sanji: Sự kiện đặc biệt → tab Sanji → tặng món → tăng tốc → xếp hạng / quà mốc / quà top → cửa hàng.
// Dùng: node tools/qa-sanji.cjs (ảnh: qa-output/sanji/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_sjqa_'+crypto.randomBytes(6).toString('hex'),port=4241,url=`http://127.0.0.1:${port}`,output='qa-output/sanji';let server,browser,client;
const H=3600000,D=24*H,monday=Date.UTC(2026,10,15,17)+60000;
const start=time=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NOVA_QA_TIME:String(time)},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
const restart=async time=>{server.kill();await new Promise(r=>server.once('exit',r));server=await start(time)};
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start(Date.now());client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(700)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const sj=()=>page.evaluate(()=>GameRuntime.player.sanji);
 const ok=async()=>{await page.waitForSelector('.msg-layer [data-guild-confirm]',{timeout:5000});await page.locator('.msg-layer [data-guild-confirm]').last().click();await page.waitForTimeout(1200)};
 const closeBonus=async()=>{const b=page.locator('.bonus-close');if(await b.count()){await b.first().click();await page.waitForTimeout(400)}};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Sanji_QA');await page.locator('#password').fill('sanji-password-1');await page.locator('#password-confirm').fill('sanji-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'sanji_qa'},{$set:{'player.account.level':40,'player.wallet.diamonds':5000,'player.wallet.gold':5000000,'player.inventory.consumable:2141':500}});
 await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(13));await page.waitForFunction(()=>GameView.getSceneId()===13&&document.querySelector('#loading').hidden);await page.waitForTimeout(1200);
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136,b=await page.evaluate(()=>GameView.hitBox('ButtonFirstPurchase'));await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k);
 await page.waitForSelector('[data-action="sanji-open"]',{timeout:15000});await shot('01-tab');await page.locator('[data-action="sanji-open"]').first().click();
 await page.waitForSelector('.sj-root');await page.waitForTimeout(1500);await shot('02-home');
 await page.locator('.sj-root [data-name="GiveFoodButton"]').click();await page.waitForSelector('.sj-give');await shot('03-foods');
 await page.locator('.sj-give [data-name="GiveButton"]').first().click();await page.waitForTimeout(1800);await closeBonus();await shot('04-sent');
 let s=await sj();assert.ok(s.hearts>0);assert.ok(s.cooldownUntil>Date.now());
 await page.locator('.sj-root [data-name="GiveFoodButton"]').click();await ok();s=await sj();assert.ok(s.cooldownUntil<=Date.now(),'đã tăng tốc');
 await page.locator('.sj-root [data-name="GiveFoodButton"]').click();await page.waitForSelector('.sj-give');await page.locator('.sj-give [data-name="GiveButton"]').nth(2).click();await ok();await page.waitForTimeout(800);await closeBonus();
 await page.locator('.sj-root [data-name="RankingButton"]').click();await page.waitForSelector('.sj-rank');await page.waitForTimeout(800);await shot('05-rank');
 assert.ok(await page.locator('.sj-rank .sj-cell.me').count());
 await page.locator('.sj-rank [data-tab="gift"]').click();await page.waitForTimeout(800);await shot('06-gift');
 const claim=page.locator('.sj-rank [data-claim]').first();if(await claim.count()){await claim.click();await page.waitForTimeout(1500);await closeBonus();await shot('07-claimed')}
 await page.locator('.sj-rank [data-tab="top"]').click();await page.waitForTimeout(800);await shot('08-top');
 await page.locator('.sj-rank [data-name="CloseButton"]').first().click();
 await page.locator('.sj-root [data-name="CookOnButton"]').click();await page.waitForSelector('.sj-shop');await page.waitForTimeout(800);await shot('09-shop');
 const before=await page.evaluate(()=>GameRuntime.player.inventory['consumable:2141']);await page.locator('.sj-shop [data-buy]').first().click();await ok();await closeBonus();await shot('10-bought');
 assert.ok(await page.evaluate(()=>GameRuntime.player.inventory['consumable:2141'])<before);
 await page.locator('.sj-shop [data-name="CloseButton"]').first().click();await page.locator('.sj-root [data-name="BackButton"]').click();await page.waitForTimeout(300);assert.equal(await page.locator('.sj-root').count(),0);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{assert.match(database,/^htps_sjqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
