// QA tab "Tiệc Sanji / Trang trí tàu / Giáng Sinh" của trang quản trị. Dùng: node tools/qa-admin-events3.cjs (ảnh: qa-output/admin-events3/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_admev3_'+crypto.randomBytes(6).toString('hex'),port=4247,url=`http://127.0.0.1:${port}`,output='qa-output/admin-events3',secret=crypto.randomBytes(18).toString('base64url');let server,browser;
const start=env=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off',...env},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start({ADMIN_PASSWORD:secret});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 await page.goto(url+'/admin');await page.locator('#password').fill(secret);await page.locator('#login-form button').click();await page.waitForSelector('#tab-sanji');
 const save=async()=>{await page.locator(':is(#sanji-tab,#decor-tab,#xmas-tab):not([hidden]) [data-save]').click();await page.waitForTimeout(800);return page.evaluate(()=>document.querySelector('#toast')?.textContent||'')};
 // Tiệc Sanji
 await page.locator('#tab-sanji').click();await page.waitForSelector('#sanji-tab .gem-admin');await page.screenshot({path:output+'/01-sanji.png',fullPage:true});
 await page.locator('#sanji-tab [data-num="dishes.0.hearts"]').fill('15');await page.locator('#sanji-tab [data-view="top"]').click();await page.screenshot({path:output+'/02-sanji-top.png',fullPage:true});
 await page.locator('#sanji-tab [data-addrow="top"]').click();assert.match(await save(),/Đã lưu/);
 let r=await page.evaluate(()=>fetch('/api/admin/sanji').then(r=>r.json()));assert.equal(r.config.dishes[0].hearts,15);assert.equal(r.config.top.length,6);
 await page.locator('#sanji-tab [data-num="top.5.from"]').fill('3');assert.match(await save(),/chồng hạng/);
 await page.locator('#sanji-tab [data-reset]').click();await page.waitForTimeout(700);
 // Trang trí tàu
 await page.locator('#tab-decor').click();await page.waitForSelector('#decor-tab .gem-admin');await page.screenshot({path:output+'/03-decor.png',fullPage:true});
 await page.locator('#decor-tab [data-num="price"]').fill('7');assert.match(await save(),/Đã lưu/);r=await page.evaluate(()=>fetch('/api/admin/decor').then(r=>r.json()));assert.equal(r.config.price,7);
 await page.locator('#decor-tab [data-num="rates.0"]').fill('0');await page.locator('#decor-tab [data-num="rates.1"]').fill('0');assert.match(await save(),/lớn hơn 0/);
 await page.locator('#decor-tab [data-reset]').click();await page.waitForTimeout(700);
 // Giáng Sinh
 await page.locator('#tab-xmas').click();await page.waitForSelector('#xmas-tab .gem-admin');await page.screenshot({path:output+'/04-xmas.png',fullPage:true});
 for(const v of ['bag','wish','milestones','shop']){await page.locator(`#xmas-tab [data-view="${v}"]`).click();await page.waitForTimeout(200);await page.screenshot({path:`${output}/05-xmas-${v}.png`,fullPage:true})}
 await page.locator('#xmas-tab [data-view="common"]').click();await page.locator('#xmas-tab [data-text="title"]').fill('Sinh Nhật 5 Tuổi');assert.match(await save(),/Đã lưu/);
 const player=await browser.newPage();await player.goto(url);await player.waitForSelector('#auth-form');await player.locator('[data-action="auth-register"]').click();await player.locator('#username').fill('Ev3_Admin_QA');await player.locator('#password').fill('ev3-admin-pass');await player.locator('#password-confirm').fill('ev3-admin-pass');await player.locator('.auth-submit').click();await player.waitForFunction(()=>GameRuntime?.player);
 assert.equal(await player.evaluate(()=>GameRuntime.player.xmas.title),'Sinh Nhật 5 Tuổi');
 // Công tắc: tắt Tiệc Sanji → tab Sanji biến mất khỏi cửa sổ Sự kiện đặc biệt, các tab khác vẫn còn; bật lại → hiện lại.
 await page.locator('#tab-sanji').click();await page.waitForSelector('#sanji-tab .gem-admin');await page.locator('#sanji-tab [data-enabled]').uncheck();await page.screenshot({path:output+'/06-sanji-off.png',fullPage:true});assert.match(await save(),/Đã lưu/);
 const tabs=async()=>{await player.reload();await player.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);await player.evaluate(()=>GameRuntime.navigate(13));await player.waitForFunction(()=>GameView.getSceneId()===13&&document.querySelector('#loading').hidden);await player.waitForTimeout(1000);
  const st=await player.locator('#stage').boundingBox(),k=st.width/1136,b=await player.evaluate(()=>GameView.hitBox('ButtonFirstPurchase'));await player.mouse.click(st.x+(b.x+b.w/2)*k,st.y+(b.y+b.h/2)*k);await player.waitForSelector('[data-action="pot-open"]',{timeout:15000});
  return player.evaluate(()=>[...document.querySelectorAll('.sp-tab[data-action]')].map(x=>x.dataset.action))};
 await player.evaluate(()=>{});await player.setViewportSize({width:1500,height:845});
 let list=await tabs();console.log('tabs off',list.join(','));assert.ok(!list.includes('sanji-open'));assert.ok(list.includes('xmas-open')&&list.includes('decor-open')&&list.includes('pot-open'));
 const rej=await player.evaluate(async()=>{const r=await fetch('/api/sanji/claim',{method:'POST',headers:{'content-type':'application/json'},body:'{"point":50}'});return r.status});console.log('sanji api status',rej);
 await page.locator('#sanji-tab [data-enabled]').check();assert.match(await save(),/Đã lưu/);list=await tabs();assert.ok(list.includes('sanji-open'));
 await page.locator('#tab-xmas').click();await page.waitForSelector('#xmas-tab .gem-admin');
 await page.locator('#xmas-tab [data-reset]').click();await page.waitForTimeout(700);assert.equal((await page.evaluate(()=>fetch('/api/admin/xmas').then(r=>r.json()))).custom,false);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(process.env.MONGODB_URI){const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();assert.match(database,/^htps_admev3_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
