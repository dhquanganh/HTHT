// QA hiệu ứng chiêu mộ gốc: thùng bia Fx_beer → PopupSummonHeroes từng tướng → bảng kết quả (x1 và x10, bỏ qua).
// Dùng: node tools/qa-summon-fx.cjs (ảnh: qa-output/summon-fx/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_sfxqa_'+crypto.randomBytes(6).toString('hex'),port=4251,url=`http://127.0.0.1:${port}`,output='qa-output/summon-fx';let server,browser,client;
const H=3600000,D=24*H,monday=Date.UTC(2026,10,15,17)+60000;
const start=time=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NOVA_QA_TIME:String(time)},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
const restart=async time=>{server.kill();await new Promise(r=>server.once('exit',r));server=await start(time)};
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start(Date.now());client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const shot=name=>page.locator('#stage').screenshot({path:`${output}/${name}.png`});
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Fx_QA');await page.locator('#password').fill('fx-password-1');await page.locator('#password-confirm').fill('fx-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'fx_qa'},{$set:{'player.inventory.consumable:16':30}});
 await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(24));await page.waitForFunction(()=>GameView.getSceneId()===24&&document.querySelector('#loading').hidden);await page.waitForTimeout(1200);
 const box=await page.locator('#stage').boundingBox(),click=(x,y)=>page.mouse.click(box.x+x*box.width/1136,box.y+y*box.height/640);
 // x1: thùng bia → 1 tướng → chạm → bảng kết quả.
 await click(350,550);await page.waitForSelector('.sfx-root',{timeout:15000});await page.waitForTimeout(300);await shot('01-beer');
 await page.waitForSelector('.sfx-popup',{timeout:15000});await page.waitForTimeout(1200);await shot('02-hero');
 assert.equal(await page.locator('.sfx-count').textContent(),'1/1');assert.ok(await page.locator('.sfx-popup canvas').count()>=3,'Spine bậc, hệ, hạt sáng');
 await page.locator('.sfx-popup').click({position:{x:700,y:300}});await page.waitForSelector('.summon-modal');await shot('03-result');assert.equal(await page.locator('.summon-card').count(),1);
 await page.locator('.summon-modal [data-action="close"]').first().click().catch(()=>{});await page.waitForTimeout(400);
 // x10: xem 2 tướng rồi bỏ qua.
 await click(735,550);await page.waitForSelector('.sfx-popup',{timeout:15000});await page.waitForTimeout(1200);await shot('04-hero-1of10');assert.equal(await page.locator('.sfx-count').textContent(),'1/10');
 await page.locator('.sfx-popup').click({position:{x:700,y:300}});await page.waitForFunction(()=>document.querySelector('.sfx-count')?.textContent==='2/10');await page.waitForTimeout(1000);await shot('05-hero-2of10');
 await page.locator('.sfx-popup [data-name="ButtonBack"]').click();await page.waitForSelector('.summon-modal');await shot('06-result10');assert.equal(await page.locator('.summon-card').count(),10);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{assert.match(database,/^htps_sfxqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
