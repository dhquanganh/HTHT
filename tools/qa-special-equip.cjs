// QA Trang bị đặc thù: panel khóa, mở khóa ở cấp 30, popup Cường hóa / Phẩm đồ, nâng cấp thật qua API.
// Chạy trên database tạm (htps_special_*) và xóa sau khi xong.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
try{process.loadEnvFile('.env')}catch{}
const database='htps_special_'+crypto.randomBytes(6).toString('hex'),port=4178,out='qa-output/special';let server,browser;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),30000);server.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve()}});server.once('exit',code=>reject(Error('QA server exited '+code)))});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=async name=>{await page.waitForFunction(()=>document.querySelector('#loading').hidden);await page.locator('#stage').screenshot({path:`${out}/${name}.png`})};
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);
 await page.goto('http://127.0.0.1:'+port);await page.waitForSelector('#auth-form');await page.locator('[data-action="auth-register"]').click();
 await page.locator('#username').fill('Special_QA');await page.locator('#password').fill('special-equip-password-2026');await page.locator('#password-confirm').fill('special-equip-password-2026');await page.locator('.auth-submit').click();await ready();
 const openTab=async()=>{await page.evaluate(()=>window.GameRuntime.navigate(1156));await page.locator('[data-action="hero-tab"][data-tab="special"]').click();await page.waitForSelector('.reference-special')};
 await openTab();assert.equal(await page.locator('.se-side.locked').count(),2,'Cấp 1: cả hai món khóa');await shot('locked');
 await page.locator('.se-medal[data-slot="role"]').click();assert.equal(await page.locator('.special-popup').count(),0,'Món khóa không mở popup');
 // Đưa tướng lên cấp 30 và thêm nguyên liệu trực tiếp trong database tạm.
 const client=new MongoClient(process.env.MONGODB_URI);await client.connect();
 await client.db(database).collection('players').updateOne({usernameKey:'special_qa'},{$set:{'player.hero.level':30,'player.wallet.gold':50000000,'player.inventory.consumable:2028':5000,'player.inventory.consumable:2016':40,'player.inventory.consumable:2026':40,'player.inventory.consumable:2020':40}});await client.close();
 await page.reload();await ready();await openTab();
 assert.equal(await page.locator('.se-side.locked').count(),0,'Cấp 30 mở cả hai món (Luffy hạng S)');assert.equal(await page.locator('.se-side h4').first().innerText(),'Đấu sĩ');assert.equal(await page.locator('.se-dot').count(),2);await shot('unlocked');
 await page.locator('.se-medal[data-slot="role"]').click();await page.waitForSelector('.special-popup');await shot('popup-strengthen');
 const attack=await page.evaluate(()=>window.GameRuntime.player.hero.stats.attack);
 for(let level=1;level<=20;level++){await page.locator('[data-action="se-upgrade"][data-kind="level"]').click();await page.waitForFunction(level=>window.GameRuntime.player.hero.special.role.level===level,level)}
 assert.ok(await page.evaluate(()=>window.GameRuntime.player.hero.stats.attack)>attack,'Cường hóa tăng Công');
 await page.locator('[data-action="se-tab"][data-tab="tier"]').click();await page.waitForSelector('.se-coordination');await shot('popup-tier');
 await page.locator('[data-action="se-upgrade"][data-kind="tier"]').click();await page.waitForFunction(()=>window.GameRuntime.player.hero.special.role.tier===2);
 assert.equal(await page.locator('.se-left .se-side.selected .se-star').count(),2);await shot('popup-tier-2');
 await page.locator('.se-left [data-action="se-slot"][data-slot="rank"]').click();await page.waitForSelector('.se-left .se-side.selected:nth-child(2)');await page.locator('[data-action="se-tab"][data-tab="level"]').click();await shot('popup-rank');
 await page.locator('[data-action="se-close"]').click();await page.waitForSelector('.special-popup',{state:'detached'});
 assert.equal(await page.locator('.se-side').first().locator('.se-level').innerText(),'Cấp độ: 20');await shot('panel-after');
 await page.setViewportSize({width:844,height:390});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot('mobile');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,database,shots:fs.readdirSync(out)}));
})().catch(async e=>{console.error(e.stack);if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(process.env.MONGODB_URI){const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();assert.match(database,/^htps_special_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
