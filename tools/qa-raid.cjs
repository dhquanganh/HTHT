// QA Chiến dịch (Event Raid): đảo Chiến dịch -> PopupEventRaid (3 loại), PopupListRaidChallenge (lượt, mức, khóa cấp), đánh thắng
// nhận thưởng + trừ lượt, càn quét, mua lượt; tab admin "Chiến dịch" sửa thưởng / lượt, người chơi thấy ngay. DB htps_raidqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_raidqa_'+crypto.randomBytes(6).toString('hex'),port=4257,url=`http://127.0.0.1:${port}`,output='qa-output/raid',secret='raid-admin-'+crypto.randomBytes(8).toString('hex');let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',ADMIN_PASSWORD:secret},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_raidqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async(p=page,ms=800)=>{await p.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:20000}).catch(()=>{});await p.waitForTimeout(ms)};
 const shot=async(name,p=page)=>{await settle(p);await p.screenshot({path:`${output}/${name}.png`})};
 const listText=()=>page.locator('.raid-list').innerText();
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Raid_QA');await page.locator('#password').fill('raid-password-1');await page.locator('#password-confirm').fill('raid-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'raid_qa'},{$set:{'player.account.level':45,'player.hero.level':200,'player.hero.stars':10,'player.wallet.diamonds':1000}});
 await page.reload();await ready();await page.evaluate(()=>window.GameRuntime.navigate(37));await settle(page,1200);
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;await page.mouse.click(stage.x+470*k,stage.y+410*k);
 await page.waitForSelector('.raid-hub');await shot('hub');let t=await page.locator('.raid-hub').innerText();assert.ok(t.includes('Beli')&&t.includes('Nguyên liệu')&&t.includes('Mảnh hải tặc'),t);
 await page.locator('.raid-hub [data-name="ImageGold"] [data-name="ButtonHelp"]').click();await page.waitForTimeout(300);assert.ok((await page.locator('#dialog-ui').innerText()).includes('Cấp 20'));await page.keyboard.press('Escape');
 await page.locator('.raid-hub [data-name="ImageGold"] [data-name="ButtonEnter"]').click();await page.waitForSelector('.raid-list');await shot('gold');
 t=await listText();assert.ok(t.includes('Cướp Xu')&&t.includes('2/2')&&t.includes('Cấp 50 mở'),t.slice(0,300));
 const gold=await page.evaluate(()=>window.GameRuntime.player.wallet.gold);
 await page.locator('.raid-list [data-name="ButtonBattle"]').first().click();await page.waitForSelector('[data-action="team-fight"]');await shot('formation');await page.locator('[data-action="team-fight"]').click();await page.waitForFunction(()=>window.GameRuntime.player.battle?.raid&&GameView.getSceneId()===9&&document.querySelector('#loading').hidden,null,{timeout:30000});
 await page.waitForTimeout(1000);await page.locator('[data-action="battle-skip"]').click().catch(()=>{});await page.waitForSelector('.battle-end [data-action="raid-back"]',{timeout:90000});await shot('battle-end');
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.battle.status),'won');assert.equal(await page.evaluate(()=>window.GameRuntime.player.wallet.gold),gold+20000);
 await page.locator('.battle-end [data-action="raid-back"]').click();await page.waitForSelector('.raid-list',{timeout:30000});await shot('gold-after');
 t=await listText();assert.ok(t.includes('1/2')&&t.includes('Càn quét'),t.slice(0,300));
 await page.locator('.raid-list [data-name="ButtonSmash"]').first().click();await page.waitForFunction(()=>document.querySelector('.raid-list')?.innerText.includes('0/2'));await page.waitForSelector('.bonus-popup');await shot('smash');await page.locator('.bonus-popup').click({position:{x:5,y:5}});await page.waitForFunction(()=>!document.querySelector('.bonus-popup'));
 await page.locator('.raid-list [data-name="ButtonBuyTurn"]').click();await page.locator('[data-germa-confirm]').click();await page.waitForFunction(()=>document.querySelector('.raid-list')?.innerText.includes('1/3'));
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.wallet.diamonds),950);
 await page.locator('.raid-list [data-name="ButtonClose"]').click();await page.waitForSelector('.raid-hub');await page.locator('.raid-hub [data-name="ImageSpirit"] [data-name="ButtonEnter"]').click();await page.waitForSelector('.raid-list');await page.evaluate(()=>document.querySelector('.raid-list [data-name="Viewport"]').scrollTop=300);await shot('spirit');
 await page.locator('.raid-list [data-name="ButtonClose"]').click();await page.waitForSelector('.raid-hub');await page.locator('.raid-hub [data-name="ImageHero"] [data-name="ButtonEnter"]').click();await page.waitForSelector('.raid-list');await page.evaluate(()=>document.querySelector('.raid-list [data-name="Viewport"]').scrollTop=300);await shot('hero');
 assert.ok((await listText()).includes('Anh Hùng'));
 // Admin: Beli mức 1 thành 77 kim cương, 3 lượt miễn phí.
 const admin=await browser.newPage({viewport:{width:1500,height:950}});admin.on('pageerror',e=>errors.push(e.message));admin.on('dialog',d=>d.accept());
 await admin.goto(url+'/admin');await admin.waitForSelector('#login-form');await admin.locator('#password').fill(secret);await admin.locator('#login-form button').click();await admin.waitForSelector('tbody tr[data-id]');
 await admin.locator('#tab-raid').click();await admin.waitForSelector('.raid-admin');await shot('admin',admin);
 await admin.locator('.raid-admin [data-num="freeTurns"]').fill('3');
 await admin.locator('.raid-admin [data-swap="modes.gold.levels.0.rewards.0"]').click();await admin.locator('#raid-search').fill('kim cương');await admin.locator('#raid-matches button').first().click();
 await admin.locator('.raid-admin [data-num="modes.gold.levels.0.rewards.0.quantity"]').fill('77');await admin.locator('#raid-save').click();await admin.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Đã lưu'));await shot('admin-saved',admin);
 const cfg=(await client.db(database).collection('raid_config').findOne({_id:'config'})).config;assert.equal(cfg.freeTurns,3);assert.deepEqual(cfg.modes.gold.levels[0].rewards[0],{itemId:'diamonds',quantity:77});
 await page.locator('.raid-list [data-name="ButtonClose"]').click();await page.locator('.raid-hub [data-name="ImageGold"] [data-name="ButtonEnter"]').click();await page.waitForSelector('.raid-list');
 t=await listText();assert.ok(t.includes('2/4'),t.slice(0,200));await shot('gold-admin-config');
 await admin.locator('#raid-reset').click();await admin.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('mặc định'));assert.equal(await client.db(database).collection('raid_config').countDocuments(),0);
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['world-island','hub-3-modes','help','list-turns-locks','fight-win-reward','turn-deducted','sweep','buy-turn','spirit-list','hero-list','admin-tab','admin-edit-save-db','player-sees-config','admin-reset']};fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_raidqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
