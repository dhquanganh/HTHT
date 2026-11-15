// QA tab "Tự Do" của trang quản trị. Dùng: node tools/qa-admin-freedom.cjs (ảnh: qa-output/admin-freedom/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_admfree_'+crypto.randomBytes(6).toString('hex'),port=4235,url=`http://127.0.0.1:${port}`,output='qa-output/admin-freedom',secret=crypto.randomBytes(18).toString('base64url');let server,browser;
const start=env=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off',...env},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start({ADMIN_PASSWORD:secret});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 await page.goto(url+'/admin');await page.locator('#password').fill(secret);await page.locator('#login-form button').click();await page.waitForSelector('#tab-freedom');
 await page.locator('#tab-freedom').click();await page.waitForSelector('#freedom-tab .gem-admin');await page.waitForTimeout(400);await page.screenshot({path:output+'/01-common.png',fullPage:true});
 for(const v of ['stages','cards']){await page.locator(`#freedom-tab [data-view="${v}"]`).click();await page.waitForTimeout(300);await page.screenshot({path:`${output}/02-${v}.png`,fullPage:true})}
 await page.locator('#freedom-tab [data-view="stages"]').click();await page.locator('[data-num="stages.0.level"]').fill('95');
 for(let k=0;k<3;k++)await page.locator('#freedom-tab [data-add-stage]').click();await page.waitForTimeout(300);await page.screenshot({path:output+'/02-stages-10.png',fullPage:true});
 await page.locator('#freedom-tab [data-view="common"]').click();await page.locator('[data-num="weeklyRuns"]').fill('8');await page.locator('#freedom-tab [data-add-reset]').click();
 await page.locator('#freedom-save').click();await page.waitForTimeout(800);await page.screenshot({path:output+'/03-saved.png',fullPage:true});
 const saved=await page.evaluate(()=>fetch('/api/admin/freedom').then(r=>r.json()));assert.equal(saved.custom,true);assert.equal(saved.config.stages[0].level,95);assert.equal(saved.config.weeklyRuns,8);assert.equal(saved.config.stages.length,10);assert.equal(saved.config.stages[9].level,saved.config.stages[8].level+20);assert.equal(saved.config.resetCosts.length,6);
 // Tỉ lệ trợ giúp toàn 0 → server báo lỗi
 for(const i of [0,1,2])await page.locator(`[data-num="helpWeights.${i}"]`).fill('0');
 await page.locator('#freedom-save').click();await page.waitForTimeout(700);const toast=await page.evaluate(()=>document.querySelector('#toast')?.textContent||'');console.log('toast',toast);assert.match(toast,/lớn hơn 0/);
 const player=await browser.newPage();await player.goto(url);await player.waitForSelector('#auth-form');await player.locator('[data-action="auth-register"]').click();await player.locator('#username').fill('Free_Admin_QA');await player.locator('#password').fill('free-admin-pass');await player.locator('#password-confirm').fill('free-admin-pass');await player.locator('.auth-submit').click();await player.waitForFunction(()=>GameRuntime?.player);
 assert.equal(await player.evaluate(()=>GameRuntime.player.freedom.weeklyRuns),8);
 await page.locator('#freedom-reset').click();await page.waitForTimeout(700);assert.equal((await page.evaluate(()=>fetch('/api/admin/freedom').then(r=>r.json()))).custom,false);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(process.env.MONGODB_URI){const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();assert.match(database,/^htps_admfree_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
