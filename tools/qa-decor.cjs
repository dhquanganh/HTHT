// QA Trang trí tàu: tab Trang trí tàu → nhận Búa gỗ → Xưởng chế tạo x10 → Kho → giao tầng → đặt / tự động đặt → tái chế.
// Dùng: node tools/qa-decor.cjs (ảnh: qa-output/decor/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_dcqa_'+crypto.randomBytes(6).toString('hex'),port=4243,url=`http://127.0.0.1:${port}`,output='qa-output/decor';let server,browser,client;
const H=3600000,D=24*H,monday=Date.UTC(2026,10,15,17)+60000;
const start=time=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NOVA_QA_TIME:String(time)},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
const restart=async time=>{server.kill();await new Promise(r=>server.once('exit',r));server=await start(time)};
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start(Date.now());client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(800)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const dc=()=>page.evaluate(()=>GameRuntime.player.decor);
 const ok=async()=>{await page.waitForSelector('.msg-layer [data-guild-confirm]',{timeout:5000});await page.locator('.msg-layer [data-guild-confirm]').last().click();await page.waitForTimeout(1200)};
 const closeBonus=async()=>{const b=page.locator('.bonus-close');if(await b.count()){await b.first().click();await page.waitForTimeout(400)}};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Decor_QA');await page.locator('#password').fill('decor-password-1');await page.locator('#password-confirm').fill('decor-password-1');await page.locator('.auth-submit').click();await ready();
 const doc=await players.findOne({usernameKey:'decor_qa'}),pl=doc.player,{grantSummon}=await import('../server/summon.mjs'),{heroDefinitions,heroKits}=await import('../server/catalog.mjs'),{mythicHeroes}=await import('../server/decor.mjs');
 pl.reserveHeroes??={};for(const d of heroDefinitions.filter(d=>heroKits.has(d.id)&&mythicHeroes.includes(d.id)).slice(0,4))grantSummon(pl,{avatar:d.avatar});
 pl.account.level=60;pl.inventory['consumable:2138']=500;pl.inventory['consumable:2140']=1;await players.updateOne({_id:doc._id},{$set:{player:pl}});
 await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(13));await page.waitForFunction(()=>GameView.getSceneId()===13&&document.querySelector('#loading').hidden);await page.waitForTimeout(1200);
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136,b=await page.evaluate(()=>GameView.hitBox('ButtonFirstPurchase'));await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k);
 await page.waitForSelector('[data-action="decor-open"]',{timeout:15000});await page.locator('[data-action="decor-open"]').first().click();
 await page.waitForSelector('.dc-root');await page.waitForTimeout(1500);await shot('01-home');
 await page.locator('.dc-root [data-daily]').click();await page.waitForTimeout(1200);await closeBonus();assert.equal(await page.evaluate(()=>GameRuntime.player.inventory['consumable:2138']),520);
 await page.locator('.dc-root [data-name="ButtonShop"]').click();await page.waitForSelector('.dc-shop');await page.waitForTimeout(1500);await shot('02-shop');
 await page.locator('.dc-shop [data-name="ButtonBuyx10"]').click();await page.waitForSelector('.dc-new');await page.waitForTimeout(1500);await shot('03-new');await page.locator('.dc-new').click();
 assert.equal((await dc()).items.length,10);
 await page.locator('.dc-shop [data-name="ButtonMythicOrder"]').click();await page.waitForSelector('.dc-order');await page.locator('.dc-order [data-h]').first().click();await shot('04-order');await page.locator('.dc-order [data-x="ok"]').click();await page.waitForSelector('.dc-new');await page.waitForTimeout(1200);await page.locator('.dc-new').click();
 assert.equal((await dc()).items.filter(i=>i.quality===3).length,1);
 await page.locator('.dc-shop [data-name="ButtonBackShop"]').click();await page.waitForTimeout(500);
 await page.locator('.dc-root [data-name="ButtonStoreroom"]').click();await page.waitForSelector('.dc-store');await page.locator('.dc-store [data-uid]').first().click();await page.waitForTimeout(600);await shot('05-store');
 await page.locator('.dc-store [data-name="ButtonClose"]').first().click();
 // Tầng 1: giao thuyền viên, tự động đặt, đặt tay một ô.
 await page.locator('.dc-root [data-floor="0"]').click();await page.waitForSelector('.dc-editor');await page.waitForTimeout(800);
 await page.locator('.dc-editor [data-ed="hero"]').click();await page.waitForSelector('.dc-pick');await page.locator('.dc-pick [data-h]').first().click();await page.waitForTimeout(1200);
 await page.locator('.dc-editor [data-ed="auto"]').click();await page.waitForTimeout(1500);await shot('06-editor');
 let s=await dc();assert.ok(s.floors[0].hero);assert.ok(Object.keys(s.floors[0].slots).length>0);
 await page.locator('.dc-editor [data-slot="1"]').first().click({force:true});await page.waitForTimeout(800);await shot('07-slot');
 await page.locator('.dc-editor [data-ed="back"]').click();await page.waitForTimeout(800);await shot('08-home-after');
 // Tái chế món chưa đặt.
 await page.locator('.dc-root [data-name="ButtonShop"]').click();await page.waitForSelector('.dc-shop');await page.locator('.dc-shop [data-name="Recycle"]').click();await page.waitForSelector('.dc-store');
 await page.locator('.dc-store [data-pickq="1"]').click();await page.waitForTimeout(400);await shot('09-recycle');
 const before=(await dc()).items.length;if(await page.locator('.dc-store [data-recycle]:not([disabled])').count()){await page.locator('.dc-store [data-recycle]').click();await ok();await closeBonus();assert.ok((await dc()).items.length<before)}
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{assert.match(database,/^htps_dcqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
