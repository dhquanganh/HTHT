// QA tab "Ngọc Vega" của trang quản trị: sửa lượt, chỉ số, tỉ lệ rơi, thêm vật phẩm, ngày mở, mốc debuff → lưu →
// người chơi thấy ngay ở /api/state. Dùng: node tools/qa-admin-gem.cjs (ảnh: qa-output/admin-gem/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_admgem_'+crypto.randomBytes(6).toString('hex'),port=4221,url=`http://127.0.0.1:${port}`,output='qa-output/admin-gem',secret=crypto.randomBytes(18).toString('base64url');let server,browser;
const start=env=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off',...env},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start({ADMIN_PASSWORD:secret});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 401/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 await page.goto(url+'/admin');await page.locator('#password').fill(secret);await page.locator('#login-form button').click();await page.waitForSelector('#tab-gem');
 await page.locator('#tab-gem').click();await page.waitForSelector('.gem-admin');await page.waitForTimeout(600);await page.screenshot({path:output+'/01-common.png',fullPage:true});
 await page.locator('[data-num="turns"]').fill('5');
 // Chỉ số theo cấp: Douglas bậc 1 cấp 250 → 500 thì Công / Thủ / Máu ×2, Tốc độ +20%.
 await page.locator('[data-view="0"]').click();await page.waitForSelector('.gem-tier');
 const before=await page.evaluate(()=>['attack','defense','hp','speed'].map(k=>Number(document.querySelector(`[data-num="bosses.0.tiers.0.${k}"]`).value)));
 await page.locator('[data-num="bosses.0.tiers.0.level"]').fill('500');await page.locator('[data-num="bosses.0.tiers.0.level"]').blur();
 const after=await page.evaluate(()=>['attack','defense','hp','speed'].map(k=>Number(document.querySelector(`[data-num="bosses.0.tiers.0.${k}"]`).value)));
 console.log('scale',before,after);assert.deepEqual(after.slice(0,3),before.slice(0,3).map(v=>v*2));assert.equal(after[3],Math.round(before[3]*1.2));
 await page.screenshot({path:output+'/02a-scaled.png',fullPage:true});
 await page.locator('[data-view="2"]').click();await page.waitForSelector('.gem-tier');await page.waitForTimeout(500);await page.screenshot({path:output+'/02-pica.png',fullPage:true});
 await page.locator('[data-num="bosses.2.tiers.0.hp"]').fill('123456');
 await page.locator('[data-rate="bosses.2.tiers.0.rewards.2.rate"]').fill('75');
 await page.locator('[data-add="bosses.2.tiers.0.rewards"]').click();await page.locator('#gem-search').fill('kim cuong');await page.locator('#gem-matches [data-pick]').first().click();
 await page.locator('[data-day="4"]').check();
 await page.locator('[data-select="bosses.2.tiers.1.debuff"]').selectOption('5');
 await page.screenshot({path:output+'/03-edited.png',fullPage:true});
 await page.locator('#gem-save').click();await page.waitForTimeout(800);
 const saved=await page.evaluate(()=>fetch('/api/admin/gem').then(r=>r.json()));
 const t0=saved.config.bosses[2].tiers[0];console.log('saved',saved.custom,saved.config.turns,t0.hp,t0.rewards.map(r=>r.itemId+':'+r.rate),saved.config.bosses[2].days,saved.config.bosses[2].tiers[1].debuff);
 assert.equal(saved.config.turns,5);assert.equal(t0.hp,123456);assert.equal(t0.rewards[2].rate,750);assert.ok(t0.rewards.some(r=>r.itemId==='diamonds'));assert.ok(saved.config.bosses[2].days.includes(4));assert.equal(saved.config.bosses[2].tiers[1].debuff,5);assert.equal(saved.config.bosses[0].tiers[0].level,500);
 // Mốc debuff
 await page.locator('[data-view="common"]').click();await page.locator('[data-add-milestone]').click();await page.screenshot({path:output+'/04-milestones.png',fullPage:true});
 await page.locator('#gem-save').click();await page.waitForTimeout(800);
 assert.equal((await page.evaluate(()=>fetch('/api/admin/gem').then(r=>r.json()))).config.milestones.length,9);
 // Người chơi thấy cấu hình mới
 const player=await browser.newPage();await player.goto(url);await player.waitForSelector('#auth-form');await player.locator('[data-action="auth-register"]').click();await player.locator('#username').fill('Gem_Admin_QA');await player.locator('#password').fill('gem-admin-pass');await player.locator('#password-confirm').fill('gem-admin-pass');await player.locator('.auth-submit').click();await player.waitForFunction(()=>GameRuntime?.player);
 const gem=await player.evaluate(()=>GameRuntime.player.gem);
 assert.equal(gem.boss[2].maxTurns,5);assert.ok(gem.boss[2].tiers[0].rewards.some(r=>r.itemId==='diamonds'));assert.equal(gem.boss[2].tiers[1].debuff,5);assert.equal(gem.milestones.length,9);
 // Về mặc định
 await page.locator('#gem-reset').click();await page.waitForTimeout(800);assert.equal((await page.evaluate(()=>fetch('/api/admin/gem').then(r=>r.json()))).custom,false);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(process.env.MONGODB_URI){const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();assert.match(database,/^htps_admgem_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
