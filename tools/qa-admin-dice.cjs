// QA tab "Đổ xúc xắc + công tắc Tự Do / Tân Tinh" của trang quản trị. Dùng: node tools/qa-admin-dice.cjs (ảnh: qa-output/admin-dice/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_admdice_'+crypto.randomBytes(6).toString('hex'),port=4249,url=`http://127.0.0.1:${port}`,output='qa-output/admin-dice',secret=crypto.randomBytes(18).toString('base64url');let server,browser;
const start=env=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off',...env},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start({ADMIN_PASSWORD:secret});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 await page.goto(url+'/admin');await page.locator('#password').fill(secret);await page.locator('#login-form button').click();await page.waitForSelector('#tab-dice');
 const save=async tab=>{await page.locator(tab+' :is([data-save],#dice-save)').first().click();await page.waitForTimeout(800);return page.evaluate(()=>document.querySelector('#toast')?.textContent||'')};
 await page.locator('#tab-dice').click();await page.waitForSelector('#dice-tab .gem-admin');await page.screenshot({path:output+'/01-common.png',fullPage:true});
 for(const v of ['milestones','board','tarot']){await page.locator(`#dice-tab [data-view="${v}"]`).click();await page.waitForTimeout(200);await page.screenshot({path:`${output}/02-${v}.png`,fullPage:true})}
 await page.locator('#dice-tab [data-view="board"]').click();await page.locator('#dice-tab [data-num="board.0.amount"]').fill('777');
 await page.locator('#dice-tab [data-view="common"]').click();await page.locator('#dice-tab [data-num="price"]').fill('9');
 await page.locator('#dice-tab [data-view="milestones"]').click();await page.locator('#dice-tab [data-addm]').click();
 assert.match(await save('#dice-tab'),/Đã lưu/);
 let r=await page.evaluate(()=>fetch('/api/admin/dice').then(r=>r.json()));assert.equal(r.config.price,9);assert.equal(r.config.board[0].amount,777);assert.equal(r.config.milestones.length,9);
 // Người chơi
 const player=await browser.newPage({viewport:{width:1500,height:845}});await player.goto(url);await player.waitForSelector('#auth-form');await player.locator('[data-action="auth-register"]').click();await player.locator('#username').fill('Dice_Admin_QA');await player.locator('#password').fill('dice-admin-pass');await player.locator('#password-confirm').fill('dice-admin-pass');await player.locator('.auth-submit').click();await player.waitForFunction(()=>GameRuntime?.player);
 assert.equal(await player.evaluate(()=>GameRuntime.player.dice.price),9);
 const ready=async()=>{await player.reload();await player.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden)};
 const tabs=async()=>{await ready();await player.evaluate(()=>GameRuntime.navigate(13));await player.waitForFunction(()=>GameView.getSceneId()===13&&document.querySelector('#loading').hidden);await player.waitForTimeout(1000);
  const st=await player.locator('#stage').boundingBox(),k=st.width/1136,b=await player.evaluate(()=>GameView.hitBox('ButtonFirstPurchase'));await player.mouse.click(st.x+(b.x+b.w/2)*k,st.y+(b.y+b.h/2)*k);await player.waitForSelector('[data-action="pot-open"]',{timeout:15000});
  return player.evaluate(()=>[...document.querySelectorAll('.sp-tab[data-action]')].map(x=>x.dataset.action))};
 const world=async()=>{await ready();await player.evaluate(()=>GameRuntime.navigate(37));await player.waitForFunction(()=>GameView.getSceneId()===37&&document.querySelector('#loading').hidden);await player.waitForTimeout(2500);
  return player.evaluate(()=>{const all=GameView.allNodes(GameView.getScene());return{explore:!!all.find(n=>n.name==='B_Explore')?.active,nova:!!all.find(n=>n.name==='B_NovaArena')?.active}})};
 // Tắt Đổ xúc xắc → tab xúc xắc biến mất, tab khác giữ nguyên.
 await page.locator('#dice-tab [data-enabled]').uncheck();await page.screenshot({path:output+'/03-dice-off.png',fullPage:true});assert.match(await save('#dice-tab'),/Đã lưu/);
 let list=await tabs();console.log('tabs',list.join(','));assert.ok(!list.includes('dice-open')&&list.includes('impel-open')&&list.includes('sanji-open'));
 await page.locator('#dice-tab [data-enabled]').check();assert.match(await save('#dice-tab'),/Đã lưu/);assert.ok((await tabs()).includes('dice-open'));
 // Tự Do / Tân Tinh: tắt → toà nhà ẩn khỏi bản đồ.
 let w=await world();console.log('world on',JSON.stringify(w));assert.ok(w.explore&&w.nova);
 for(const [tab,id] of [['#tab-freedom','#freedom-tab'],['#tab-nova','#nova-tab']]){await page.locator(tab).click();await page.waitForSelector(id+' .gem-admin');await page.locator(id+' [data-enabled]').uncheck();await page.locator(id+' button:is(#freedom-save,#nova-save)').click();await page.waitForTimeout(800)}
 await page.screenshot({path:output+'/04-nova-off.png',fullPage:true});
 w=await world();console.log('world off',JSON.stringify(w));assert.ok(!w.explore&&!w.nova);await player.screenshot({path:output+'/05-world-off.png'});
 for(const [tab,id] of [['#tab-freedom','#freedom-tab'],['#tab-nova','#nova-tab']]){await page.locator(tab).click();await page.waitForSelector(id+' .gem-admin');await page.locator(id+' [data-enabled]').check();await page.locator(id+' button:is(#freedom-save,#nova-save)').click();await page.waitForTimeout(800)}
 w=await world();assert.ok(w.explore&&w.nova);
 await page.locator('#tab-dice').click();await page.waitForSelector('#dice-tab .gem-admin');await page.locator('#dice-reset').click();await page.waitForTimeout(700);assert.equal((await page.evaluate(()=>fetch('/api/admin/dice').then(r=>r.json()))).custom,false);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(process.env.MONGODB_URI){const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();assert.match(database,/^htps_admdice_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
