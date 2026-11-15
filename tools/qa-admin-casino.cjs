// QA tab "Vòng quay" của trang quản trị: chỉnh giá xu Casino thường / VIP, số xu mỗi lượt → người chơi thấy giá mới, mua xu trừ đúng kim cương.
// Dùng: node tools/qa-admin-casino.cjs (ảnh: qa-output/admin-casino/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_admcas_'+crypto.randomBytes(6).toString('hex'),port=4253,url=`http://127.0.0.1:${port}`,output='qa-output/admin-casino',secret=crypto.randomBytes(18).toString('base64url');let server,browser;
const start=env=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off',...env},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start({ADMIN_PASSWORD:secret});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 await page.goto(url+'/admin');await page.locator('#password').fill(secret);await page.locator('#login-form button').click();await page.waitForSelector('#tab-casino');
 await page.locator('#tab-casino').click();await page.waitForSelector('#casino-tab .gem-admin');await page.screenshot({path:output+'/01-normal.png',fullPage:true});
 await page.locator('#casino-tab [data-num="normal.price"]').fill('7');await page.locator('#casino-tab [data-num="normal.costs.10"]').fill('9');
 await page.locator('#casino-tab [data-view="super"]').click();await page.screenshot({path:output+'/02-super.png',fullPage:true});
 await page.locator('#casino-tab [data-num="super.price"]').fill('33');
 await page.locator('#casino-save').click();await page.waitForTimeout(800);assert.match(await page.evaluate(()=>document.querySelector('#toast')?.textContent||''),/Đã lưu/);
 const r=await page.evaluate(()=>fetch('/api/admin/casino').then(r=>r.json()));assert.equal(r.config.normal.price,7);assert.equal(r.config.normal.costs[10],9);assert.equal(r.config.super.price,33);
 // Giá không hợp lệ bị từ chối.
 const bad=await page.evaluate(c=>AdminApp.api('/api/admin/casino',{config:{...c,normal:{...c.normal,price:0}}}).then(()=>'ok',e=>e.message),r.config);console.log('bad',bad);assert.notEqual(bad,'ok');
 const player=await browser.newPage({viewport:{width:1500,height:845}});await player.goto(url);await player.waitForSelector('#auth-form');await player.locator('[data-action="auth-register"]').click();await player.locator('#username').fill('Casino_Admin_QA');await player.locator('#password').fill('casino-admin-pass');await player.locator('#password-confirm').fill('casino-admin-pass');await player.locator('.auth-submit').click();await player.waitForFunction(()=>GameRuntime?.player);
 const w=await player.evaluate(()=>GameRuntime.player.casino.wheels);console.log('player',w.normal.price,w.normal.costs,w.super.price);
 assert.equal(w.normal.price,7);assert.equal(w.normal.costs[10],9);assert.equal(w.super.price,33);
 await page.locator('#casino-reset').click();await page.waitForTimeout(700);assert.equal((await page.evaluate(()=>fetch('/api/admin/casino').then(r=>r.json()))).custom,false);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(process.env.MONGODB_URI){const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();assert.match(database,/^htps_admcas_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
