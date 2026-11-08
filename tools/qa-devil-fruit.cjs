const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_ff_'+crypto.randomBytes(6).toString('hex'),port=4214,url=`http://127.0.0.1:${port}`,output='qa-output/devil-fruit';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_ff_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Ff_QA');await page.locator('#password').fill('ff-password-1');await page.locator('#password-confirm').fill('ff-password-1');await page.locator('.auth-submit').click();await ready();
 const inv=Object.fromEntries([95,96,97,98,99,100].map(id=>['player.inventory.consumable:'+id,100000]).concat([['player.inventory.consumable:101',50],['player.inventory.consumable:102',20]]));
 await players.updateOne({usernameKey:'ff_qa'},{$set:{'player.account.level':90,'player.wallet.gold':1e10,'player.wallet.diamonds':100000,'player.hero.level':120,...inv,'player.devilFruit':{owned:{1:{level:3,star:2},5:{level:20,star:12},9:{level:0,star:0}},shards:{2:60,1:300},slots:3,heroes:[],history:{1:[],2:[]}}}});
 await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(13));await scene(13);await page.waitForTimeout(1500);await shot('01-home');
 const tap=async action=>{await page.evaluate(a=>{const n=GameView.allNodes(GameView.getScene()).find(x=>x.activityAction===a);GameRuntime.handleHit({name:n.name,node:n})},action);await page.waitForTimeout(500)};
 await tap('toggle');await shot('02-activity-open');
 await tap('FF');await page.waitForSelector('.ff-root');await page.waitForTimeout(1200);await shot('03-list');
 const click=async sel=>{await page.locator(sel).first().click();await page.waitForTimeout(700)};
 const byPath=p=>`.ff-root ${p.split('/').map(n=>`[data-name="${n}"]`).join(' > ')}`;
 await click('.ff-root [data-name="Body"] > [data-name="TabManager"] > [data-name="Tab2"]');await shot('04-group');
 await click('.ff-root [data-name="Body"] > [data-name="TabManager"] > [data-name="Tab3"]');await shot('05-library');
 await click('.ff-root [data-name="Body"] > [data-name="TabManager"] > [data-name="Tab4"]');await shot('06-wheel');
 await click('.ff-root [data-name="Body"] > [data-name="TabManager"] > [data-name="Tab1"]');
 await click('.ff-root [data-name="TabFruitList"] [data-name="FruitInfo"] [data-name="BtnUpgrade"]');await shot('07-upgrade');
 await click('.ff-upgrade [data-name="UpgradeBox"] [data-name="BtnUpgrade"]');await page.waitForTimeout(800);await shot('08-upgraded');
 console.log('after level',await page.evaluate(()=>GameRuntime.player.devilFruit.owned));
 await page.evaluate(()=>document.querySelector('.ff-upgrade')?.remove());
 await click('.ff-root [data-name="ActionButton"]');await shot('09-heroes');
 await page.evaluate(()=>document.querySelector('.ff-heroes [data-slot="0"]').click());await page.waitForTimeout(600);await shot('10-checkin');
 await page.evaluate(()=>document.querySelectorAll('.ff-popup').forEach(e=>e.remove()));
 await click('.ff-root [data-name="Body"] > [data-name="TabManager"] > [data-name="Tab4"]');
 await page.evaluate(()=>localStorage.setItem('KEY_SKIP_FRUIT_WHEEL','1'));
 await click('.ff-root [data-name="WheelNormal"] [data-name="BtnRoll10"]');await page.waitForTimeout(4000);await shot('11-roll');
 await page.evaluate(()=>document.querySelectorAll('.ff-popup').forEach(e=>e.remove()));
 // Nâng sao Magu (2 → 3 sao: Gen + 0 mảnh theo bảng awaken hạng 4)
 await click('.ff-root [data-name="Body"] > [data-name="TabManager"] > [data-name="Tab1"]');
 await click('.ff-root [data-name="TabFruitList"] [data-name="FruitInfo"] [data-name="BtnStarUp"]');await shot('12-starup');
 const star=await page.evaluate(()=>GameRuntime.player.devilFruit.owned[1].star);
 await click('.ff-upgrade [data-name="UpgradeBox"] [data-name="BtnUpgrade"]');await page.waitForTimeout(900);
 console.log('star',star,'->',await page.evaluate(()=>GameRuntime.player.devilFruit.owned[1].star));await shot('13-starred');
 await page.evaluate(()=>document.querySelector('.ff-upgrade')?.remove());
 // Tổng chỉ số
 await click('.ff-root [data-name="TabFruitList"] [data-name="PowerButton"]');await shot('14-total');await page.evaluate(()=>document.querySelectorAll('.ff-popup').forEach(e=>e.remove()));
 // Bộ: popup thông tin bộ
 await click('.ff-root [data-name="Body"] > [data-name="TabManager"] > [data-name="Tab2"]');await click('.ff-root .ff-set-info');await shot('15-setinfo');await page.evaluate(()=>document.querySelectorAll('.ff-popup').forEach(e=>e.remove()));
 // Thư viện: hợp thành Yami (id 2, 60/50)
 await click('.ff-root [data-name="Body"] > [data-name="TabManager"] > [data-name="Tab3"]');await click('.ff-root [data-name="TabFruitLibrary"] .ff-card[data-fruit="2"]');await shot('16-lib-yami');
 await click('.ff-root [data-name="TabFruitLibrary"] [data-name="FruitInfo"] [data-name="BtnCombine"]');await page.waitForTimeout(800);await shot('17-combined');
 const df=await page.evaluate(()=>GameRuntime.player.devilFruit);assert.ok(df.owned[2]);assert.equal(df.shards[2],10);
 await page.evaluate(()=>document.querySelectorAll('.ff-popup').forEach(e=>e.remove()));
 // Cộng hưởng: chọn Luffy (lv120) ô 1, xác nhận; mở ô 4 bằng 100 kim cương
 page.on('dialog',d=>d.accept());
 await click('.ff-root [data-name="ActionButton"]');await page.evaluate(()=>document.querySelector('.ff-heroes [data-slot="0"]').click());await page.waitForTimeout(500);
 await click('.ff-checkin .ff-pick');await click('.ff-checkin [data-name="ButtonConfirm"]');await shot('18-hero-picked');
 await click('.ff-heroes [data-name="ButtonConfirm"]');await page.waitForTimeout(800);
 const heroId=await page.evaluate(()=>GameRuntime.player.hero.id);assert.equal((await page.evaluate(()=>GameRuntime.player.devilFruit.heroes))[0],heroId);
 const gems=await page.evaluate(()=>GameRuntime.player.wallet.diamonds);
 await click('.ff-root [data-name="ActionButton"]');await page.evaluate(()=>document.querySelector('.ff-heroes [data-slot="3"]').click());await page.waitForTimeout(1000);
 assert.equal(await page.evaluate(()=>GameRuntime.player.devilFruit.slots),4);assert.equal(gems-await page.evaluate(()=>GameRuntime.player.wallet.diamonds),100);await shot('19-unlocked');
 await page.evaluate(()=>document.querySelectorAll('.ff-popup').forEach(e=>e.remove()));
 // Quay có hoạt cảnh (đặc biệt, 1 lần)
 await page.evaluate(()=>localStorage.setItem('KEY_SKIP_FRUIT_WHEEL','0'));
 await click('.ff-root [data-name="Body"] > [data-name="TabManager"] > [data-name="Tab4"]');await click('.ff-root [data-name="TabFruitWheel"] [data-name="TabManager"] > [data-name="Tab2"]');await shot('20-special');
 await page.locator('.ff-root [data-name="WheelSpecial"] [data-name="BtnRoll1"]').click();await page.waitForTimeout(1500);await shot('21-spinning');
 await page.waitForSelector('.ff-popup [data-name="Body"]',{timeout:30000});await page.waitForTimeout(1500);await shot('22-special-result');
 // Đóng về sảnh
 await page.evaluate(()=>document.querySelectorAll('.ff-popup').forEach(e=>e.remove()));await click('.ff-root [data-name="Header"] [data-name="ButtonClose"]');assert.equal(await page.evaluate(()=>!!document.querySelector('.ff-root')),false);
 console.log(JSON.stringify({errors}));
})().catch(e=>{console.error(e.message.slice(0,300));process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
