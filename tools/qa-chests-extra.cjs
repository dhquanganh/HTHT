// QA các rương trước đây "chưa dùng được": RƯƠNG TRANG BỊ (1 bộ đỏ), túi thú cưng, rương mảnh thú cưng, trái ác quỷ, avatar.
// Kiểm tra: popup vật phẩm có nút Mở, bảng xem trước (ảnh, biểu tượng mảnh, chú thích bộ), bảng nhận được sau khi mở.
// Dùng: node tools/qa-chests-extra.cjs (ảnh: qa-output/chests-extra/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_chxqa_'+crypto.randomBytes(6).toString('hex'),port=4265,url=`http://127.0.0.1:${port}`,output='qa-output/chests-extra';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())});
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Chest_QA');await page.locator('#password').fill('chest-password-1');await page.locator('#password-confirm').fill('chest-password-1');await page.locator('.auth-submit').click();
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden&&GameView.getSceneId()===13);await ready();
 const inv={'consumable:200045':3,'consumable:3007':1,'consumable:105':1,'consumable:11005':1,'consumable:600857':2};
 await players.updateOne({usernameKey:'chest_qa'},{$set:Object.fromEntries(Object.entries(inv).map(([k,v])=>['player.inventory.'+k,v]))});await page.reload();await ready();await page.waitForTimeout(800);
 const shot=name=>page.locator('#stage').screenshot({path:`${output}/${name}.png`});
 const openItem=id=>page.evaluate(id=>{const b=document.createElement('button');b.dataset.action='item';b.dataset.item=id;b.hidden=true;document.body.appendChild(b);b.click();b.remove()},id);
 const closeAll=()=>page.evaluate(()=>{ItemInfoUI.closePreview();ItemInfoUI.close();document.querySelector('#dialog [data-action="close"],#dialog .modal-close')?.click()});
 const imagesOk=sel=>page.evaluate(sel=>[...document.querySelectorAll(sel+' img')].filter(i=>i.complete&&i.naturalWidth>0).length,sel);
 // 1. Popup vật phẩm RƯƠNG TRANG BỊ: không còn dòng "chưa dùng được", có nút Mở 1.
 await openItem('consumable:200045');await page.waitForSelector('.item-popup');await page.waitForTimeout(300);await shot('01-item');
 assert.equal(await page.locator('.item-popup-note').count(),0,'không còn "chưa dùng được"');
 assert.ok(await page.locator('.item-popup [data-action="chest-open"][data-count="1"]').isVisible());
 // 2. Xem trước: 44 món, 11 bộ.
 await closeAll();await page.evaluate(()=>ItemInfoUI.show('consumable:200045'));await page.waitForSelector('.item-info-chest');await page.locator('.item-info-chest').click();
 await page.waitForSelector('.chest-preview-layer .chest-pv-cell');await page.waitForTimeout(500);await shot('02-preview-set');
 assert.equal(await page.locator('.chest-pv-cell').count(),44);assert.match(await page.locator('.chest-pv-note').textContent(),/1 trong 11 bộ/);
 // 3. Mở 1 → nhận đúng 4 món của một bộ.
 await closeAll();await openItem('consumable:200045');await page.waitForSelector('.item-popup [data-action="chest-open"][data-count="1"]');await page.locator('.item-popup [data-action="chest-open"][data-count="1"]').click();
 await page.waitForSelector('.chest-result');await page.waitForTimeout(500);await shot('03-opened-set');
 assert.equal(await page.locator('.chest-result .choice-hero').count(),4);assert.ok(await page.locator('.choice-modal [data-action="chest-open"]').isVisible(),'Mở tiếp');
 // 4. Rương mảnh Laboon: ô có ảnh + biểu tượng mảnh; chạm ô → thông tin "Mảnh Laboon".
 await closeAll();await page.evaluate(()=>ItemInfoUI.show('consumable:600857'));await page.locator('.item-info-chest').click();await page.waitForSelector('.chest-pv-cell');await page.waitForTimeout(500);
 assert.equal(await page.locator('.chest-pv-cell .ev-shard').count(),1);assert.ok(await imagesOk('.chest-pv-cell')>=2,'ảnh thú cưng + mảnh');await shot('04-preview-pet-shard');
 await page.locator('.chest-pv-cell [data-info-item]').first().click();await page.waitForTimeout(500);await shot('05-pet-shard-info');
 assert.match(await page.locator('.item-info-layer:not(.chest-preview-layer)').innerText(),/Mảnh Laboon/);
 // 5. Trái Ác Quỷ SS: 10 trái trong bể, có ảnh.
 await closeAll();await page.evaluate(()=>ItemInfoUI.show('consumable:105'));await page.locator('.item-info-chest').click();await page.waitForSelector('.chest-pv-cell');await page.waitForTimeout(500);
 assert.equal(await page.locator('.chest-pv-cell').count(),10);assert.equal(await imagesOk('.chest-pv-cell'),10);await shot('06-preview-fruit');
 // 6. Mở túi thú cưng, trái ác quỷ, avatar → bảng nhận được.
 for(const [id,name] of [['consumable:3007','07-open-pet'],['consumable:105','08-open-fruit'],['consumable:11005','09-open-avatar']]){
  await closeAll();await openItem(id);await page.waitForSelector('.item-popup [data-action="chest-open"][data-count="1"]');await page.locator('.item-popup [data-action="chest-open"][data-count="1"]').click();
  await page.waitForSelector('.chest-result');await page.waitForTimeout(500);assert.equal(await imagesOk('.chest-result'),1,name);await shot(name);
 }
 const st=await page.evaluate(()=>({pets:GameRuntime.player.pets?.list?.length,fruits:Object.keys(GameRuntime.player.devilFruit?.owned||{}).length,avatars:GameRuntime.player.avatars}));
 console.log('state',JSON.stringify(st));assert.equal(st.pets,1);assert.equal(st.fruits,1);assert.deepEqual(st.avatars,[1005]);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{assert.match(database,/^htps_chxqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
