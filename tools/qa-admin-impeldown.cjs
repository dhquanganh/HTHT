// QA tab "Vượt Ngục" của trang quản trị. Dùng: node tools/qa-admin-impeldown.cjs (ảnh: qa-output/admin-impeldown/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_admimp_'+crypto.randomBytes(6).toString('hex'),port=4225,url=`http://127.0.0.1:${port}`,output='qa-output/admin-impeldown',secret=crypto.randomBytes(18).toString('base64url');let server,browser;
const start=env=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off',...env},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start({ADMIN_PASSWORD:secret});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 await page.goto(url+'/admin');await page.locator('#password').fill(secret);await page.locator('#login-form button').click();await page.waitForSelector('#tab-impel');
 await page.locator('#tab-impel').click();await page.waitForSelector('#impel-tab .gem-admin');await page.waitForTimeout(500);await page.screenshot({path:output+'/01-common.png',fullPage:true});
 await page.locator('#impel-tab [data-view="0"]').click();await page.waitForTimeout(400);await page.screenshot({path:output+'/02-floor1.png',fullPage:true});
 await page.locator('[data-num="floors.0.keyCost"]').fill('3');
 // Tổng ô quà sai → server báo lỗi
 await page.locator('[data-num="floors.0.prizes.0.count"]').fill('13');await page.locator('[data-num="floors.0.prizes.0.count"]').blur();
 await page.locator('#impel-save').click();await page.waitForTimeout(700);
 const toast=await page.evaluate(()=>document.querySelector('#toast')?.textContent||'');console.log('toast',toast);assert.match(toast,/35/);
 await page.locator('[data-num="floors.0.prizes.0.count"]').fill('12');await page.locator('[data-num="floors.0.prizes.0.count"]').blur();
 await page.locator('#impel-save').click();await page.waitForTimeout(800);await page.screenshot({path:output+'/03-saved.png',fullPage:true});
 const saved=await page.evaluate(()=>fetch('/api/admin/impeldown').then(r=>r.json()));assert.equal(saved.custom,true);assert.equal(saved.config.floors[0].keyCost,3);
 const player=await browser.newPage();await player.goto(url);await player.waitForSelector('#auth-form');await player.locator('[data-action="auth-register"]').click();await player.locator('#username').fill('Impel_Admin_QA');await player.locator('#password').fill('impel-admin-pass');await player.locator('#password-confirm').fill('impel-admin-pass');await player.locator('.auth-submit').click();await player.waitForFunction(()=>GameRuntime?.player);
 assert.equal(await player.evaluate(()=>GameRuntime.player.impelDown.floors[0].keyCost),3);
 await page.locator('#impel-reset').click();await page.waitForTimeout(700);assert.equal((await page.evaluate(()=>fetch('/api/admin/impeldown').then(r=>r.json()))).custom,false);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(process.env.MONGODB_URI){const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();assert.match(database,/^htps_admimp_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
