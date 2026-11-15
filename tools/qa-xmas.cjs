// QA Giáng sinh / Sinh nhật: tab → quà tất → tích lũy → điều ước → túi kì diệu → đổi quà.
// Dùng: node tools/qa-xmas.cjs (ảnh: qa-output/xmas/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_xmqa_'+crypto.randomBytes(6).toString('hex'),port=4245,url=`http://127.0.0.1:${port}`,output='qa-output/xmas';let server,browser,client;
const H=3600000,D=24*H,monday=Date.UTC(2026,10,15,17)+60000;
const start=time=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NOVA_QA_TIME:String(time)},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
const restart=async time=>{server.kill();await new Promise(r=>server.once('exit',r));server=await start(time)};
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start(Date.now());client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(900)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const xm=()=>page.evaluate(()=>GameRuntime.player.xmas);
 const ok=async()=>{await page.waitForSelector('.msg-layer [data-guild-confirm]',{timeout:5000});await page.locator('.msg-layer [data-guild-confirm]').last().click();await page.waitForTimeout(1200)};
 const closeBonus=async()=>{for(let i=0;i<3;i++){const b=page.locator('.bonus-close');if(!await b.count())break;await b.first().click();await page.waitForTimeout(400)}};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Xmas_QA');await page.locator('#password').fill('xmas-password-1');await page.locator('#password-confirm').fill('xmas-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'xmas_qa'},{$set:{'player.account.level':30,'player.wallet.diamonds':5000,'player.wallet.gold':5000000,'player.inventory.consumable:42':200}});
 await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(13));await page.waitForFunction(()=>GameView.getSceneId()===13&&document.querySelector('#loading').hidden);await page.waitForTimeout(1200);
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136,b=await page.evaluate(()=>GameView.hitBox('ButtonFirstPurchase'));await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k);
 await page.waitForSelector('[data-action="xmas-open"]',{timeout:15000});await shot('00-tabs');await page.locator('[data-action="xmas-open"]').first().click();
 await page.waitForSelector('.xm-root');await page.waitForTimeout(1500);await shot('01-gift');
 await page.locator('.xm-root [data-sock="0"]').click();await page.waitForTimeout(1500);await closeBonus();await shot('02-gift-claimed');
 let s=await xm();assert.ok(s.socks[0].bought);assert.equal(s.count.sock,1);
 await page.locator('.xm-root [data-tab="santa"]').click();await page.waitForTimeout(1000);await shot('03-santa');
 await page.locator('.xm-root [data-tab="bag"]').click();await page.waitForTimeout(1500);await shot('04-bag');
 await page.locator('.xm-root [data-daily]').first().click();await page.waitForTimeout(1200);await closeBonus();
 await page.locator('.xm-root [data-bag="1"]').first().click();await page.waitForTimeout(1500);await closeBonus();s=await xm();assert.equal(s.count.bag,1);
 await page.locator('.xm-root [data-shop]').first().click();await page.waitForSelector('.xm-shop');await shot('05-shop');await page.locator('.xm-shop [data-buyshop]').first().click();await ok();await closeBonus();await page.locator('.xm-shop [data-x]').click();
 await page.locator('.xm-root [data-tab="wish"]').click();await page.waitForTimeout(1500);await shot('06-wish');
 await page.locator('.xm-root [data-wish-set="0"]').click();await page.waitForTimeout(1000);await page.locator('.xm-root [data-wish="10"]').click();await page.waitForTimeout(1800);await closeBonus();await shot('07-wished');
 s=await xm();assert.equal(s.wish,0);assert.equal(s.count.wish,10);
 await page.locator('.xm-root [data-tab="santa"]').click();await page.waitForTimeout(900);await shot('08-santa-after');
 await page.locator('.xm-root > [data-name="ButtonClose"]').click();await page.waitForTimeout(300);assert.equal(await page.locator('.xm-root').count(),0);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{assert.match(database,/^htps_xmqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
