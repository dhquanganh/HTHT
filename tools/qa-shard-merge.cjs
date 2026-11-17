// QA ghép mảnh tướng ngẫu nhiên: popup vật phẩm (Ghép 1000/50, Ghép x10) → popup mở tướng gốc PopupSummonHeroes cho từng tướng → túi đồ.
// Dùng: node tools/qa-shard-merge.cjs (ảnh: qa-output/shard-merge/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_shmqa_'+crypto.randomBytes(6).toString('hex'),port=4263,url=`http://127.0.0.1:${port}`,output='qa-output/shard-merge';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())});
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Merge_QA');await page.locator('#password').fill('merge-password-1');await page.locator('#password-confirm').fill('merge-password-1');await page.locator('.auth-submit').click();
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden&&GameView.getSceneId()===13);await ready();
 await players.updateOne({usernameKey:'merge_qa'},{$set:{'player.inventory.shard:40015':1000}});await page.reload();await ready();await page.waitForTimeout(800);
 const shot=name=>page.locator('#stage').screenshot({path:`${output}/${name}.png`});
 // Mở popup vật phẩm như khi chạm ô trong túi đồ.
 const openItem=()=>page.evaluate(()=>{const b=document.createElement('button');b.dataset.action='item';b.dataset.item='shard:40015';b.hidden=true;document.body.appendChild(b);b.click();b.remove()});
 await openItem();await page.waitForSelector('[data-action="shard-merge"]');await page.waitForTimeout(300);await shot('01-item');
 assert.match(await page.locator('[data-action="shard-merge"]').first().textContent(),/1[.,]000\/50/);
 assert.match(await page.locator('[data-action="shard-merge"][data-count]').textContent(),/x10/);
 // Ghép 1.
 const heroesBefore=await page.evaluate(()=>Object.keys(GameRuntime.player.reserveHeroes||{}).length+(GameRuntime.player.heroes?.length||0));
 await page.locator('[data-action="shard-merge"]:not([data-count])').click();await page.waitForSelector('.sfx-popup',{timeout:15000});await page.waitForTimeout(1300);await shot('02-reveal');
 assert.equal(await page.locator('.sfx-beer').count(),0,'ghép mảnh không có thùng bia');assert.equal(await page.locator('.sfx-count').textContent(),'1/1');
 await page.locator('.sfx-popup').click({position:{x:700,y:300}});await page.waitForSelector('.sfx-root',{state:'detached'});await page.waitForTimeout(500);await shot('03-after');
 assert.equal(await page.evaluate(()=>GameRuntime.player.inventory['shard:40015']),950);
 // Ghép x10 → 10 tướng, xem 2 rồi bỏ qua.
 await page.locator('[data-action="shard-merge"][data-count]').click();await page.waitForSelector('.sfx-popup',{timeout:15000});await page.waitForTimeout(1000);
 assert.equal(await page.locator('.sfx-count').textContent(),'1/10');await page.locator('.sfx-popup').click({position:{x:700,y:300}});
 await page.waitForFunction(()=>document.querySelector('.sfx-count')?.textContent==='2/10');await page.waitForTimeout(1000);await shot('04-reveal-2of10');
 await page.locator('.sfx-popup [data-name="ButtonBack"]').click();await page.waitForSelector('.sfx-root',{state:'detached'});
 assert.equal(await page.evaluate(()=>GameRuntime.player.inventory['shard:40015']),450);
 console.log('heroes',heroesBefore,'->',await page.evaluate(()=>Object.keys(GameRuntime.player.reserveHeroes||{}).length+(GameRuntime.player.heroes?.length||0)));
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{assert.match(database,/^htps_shmqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
