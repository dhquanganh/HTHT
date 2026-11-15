// QA tab "Tân Tinh" của trang quản trị. Dùng: node tools/qa-admin-nova.cjs (ảnh: qa-output/admin-nova/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_admnova_'+crypto.randomBytes(6).toString('hex'),port=4229,url=`http://127.0.0.1:${port}`,output='qa-output/admin-nova',secret=crypto.randomBytes(18).toString('base64url');let server,browser;
const start=env=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off',...env},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start({ADMIN_PASSWORD:secret});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 await page.goto(url+'/admin');await page.locator('#password').fill(secret);await page.locator('#login-form button').click();await page.waitForSelector('#tab-nova');
 await page.locator('#tab-nova').click();await page.waitForSelector('#nova-tab .gem-admin');await page.waitForTimeout(400);await page.screenshot({path:output+'/01-common.png',fullPage:true});
 for(const v of ['rewards','extra','quests','shop']){await page.locator(`#nova-tab [data-view="${v}"]`).click();await page.waitForTimeout(300);await page.screenshot({path:`${output}/02-${v}.png`,fullPage:true})}
 await page.locator('#nova-tab [data-view="shop"]').click();await page.locator('[data-num="shop.0.price"]').fill('77');
 await page.locator('#nova-tab [data-view="common"]').click();await page.locator('[data-num="minLevel"]').fill('50');
 await page.locator('#nova-tab [data-add-hero]').click();await page.locator('#nova-matches [data-pick-hero]').first().click();
 await page.locator('#nova-save').click();await page.waitForTimeout(800);await page.screenshot({path:output+'/03-saved.png',fullPage:true});
 const saved=await page.evaluate(()=>fetch('/api/admin/nova').then(r=>r.json()));assert.equal(saved.custom,true);assert.equal(saved.config.shop[0].price,77);assert.equal(saved.config.minLevel,50);assert.equal(saved.config.recommendPool.length,1);
 // Nhiệm vụ không tên → server báo lỗi
 await page.locator('#nova-tab [data-view="quests"]').click();await page.locator('[data-text="quests.0.title"]').fill('');
 await page.locator('#nova-save').click();await page.waitForTimeout(700);const toast=await page.evaluate(()=>document.querySelector('#toast')?.textContent||'');console.log('toast',toast);assert.match(toast,/thiếu tên/);
 await page.locator('#nova-reset').click();await page.waitForTimeout(700);assert.equal((await page.evaluate(()=>fetch('/api/admin/nova').then(r=>r.json()))).custom,false);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(process.env.MONGODB_URI){const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();assert.match(database,/^htps_admnova_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
