// QA Bảng Haki: tab Haki (PanelESkill), sổ Haki (PopupHeroESkill), kích hoạt từng bậc, khóa theo L1-L5,
// kỹ năng tự lên cấp theo sao. Dùng database htps_haki_* riêng, tự xóa sau khi chạy. Ảnh trong qa-output/haki/.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_haki_'+crypto.randomBytes(6).toString('hex'),port=4231,url=`http://127.0.0.1:${port}`,output='qa-output/haki';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_haki_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845},deviceScaleFactor:1.5}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(500)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const visible=sel=>page.locator(sel).evaluateAll(els=>els.map(e=>e.offsetParent!==null&&getComputedStyle(e).display!=='none'));
 const openTab=async()=>{await page.evaluate(()=>window.GameRuntime.navigate(1156));await page.waitForSelector('.hero-side-tabs');await page.locator('[data-action="hero-tab"][data-tab="haki"]').click();await page.waitForSelector('.haki-panel [data-name="GroupEnable"]')};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Haki_QA');await page.locator('#password').fill('haki-password-1');await page.locator('#password-confirm').fill('haki-password-1');await page.locator('.auth-submit').click();await ready();

 // 1 sao: kỹ năng cấp 1, cả 5 bậc Haki khóa.
 await openTab();assert.equal(await page.locator('[data-tab="skills"]').count(),0);
 assert.deepEqual(await visible('.haki-panel .haki-node [data-name="IconLock"]'),[true,true,true,true,true]);await shot('locked');
 await page.locator('.haki-panel [data-name="ButtonESkill1"]').click();await page.waitForTimeout(200);

 // L5 (sao 19): mọi bậc mở, kỹ năng tự lên cấp 3.
 await players.updateOne({usernameKey:'haki_qa'},{$set:{'player.hero.stars':19,'player.hero.level':300}});await page.reload();await ready();
 assert.deepEqual(Object.values(await page.evaluate(()=>window.GameRuntime.player.hero.skills)),[4,4,4,4]);
 await page.evaluate(()=>window.GameRuntime.navigate(1156));await page.waitForSelector('.hero-round-skill');assert.deepEqual(await page.locator('.hero-skill-level').allTextContents(),['4','4','4','4']);
 await page.locator('.hero-round-skill').first().click();await page.waitForSelector('.luffy-skill-tooltip');const tip=await page.locator('.luffy-skill-tooltip').innerText();assert.ok(tip.includes('Đã đạt cấp tối đa'));assert.equal(await page.locator('.luffy-skill-tooltip [data-type="skill"]').count(),0);await page.locator('[data-action="close"]').first().click();
 const power=await page.evaluate(()=>window.GameRuntime.player.hero.stats.power);
 await openTab();assert.deepEqual(await visible('.haki-panel .haki-node [data-name="IconLock"]'),[false,false,false,false,false]);await shot('unlocked-empty');

 // Sổ Haki: chọn theo ảnh tham chiếu (bậc 1 Vũ Trang, 2-5 Quan Sát), xem chi tiết [4] Vũ Trang trước.
 await page.locator('.haki-panel [data-name="ButtonSwitchSkill"]').click();await page.waitForSelector('.haki-popup .haki-option');
 assert.equal(await page.locator('.haki-popup .haki-option').count(),15);await shot('book');
 await page.locator('.haki-popup .haki-option[data-haki-id="14"]').click();const detail=page.locator('.haki-popup [data-name="BoxSkill"] [data-name="PanelESkillDetail"]').first();await detail.waitFor({state:'visible'});
 const text=await detail.innerText();assert.ok(text.includes('[4]')&&text.includes('Vũ Trang')&&text.includes('Tăng 20% máu, 10% giảm sát thương'),text);await shot('detail-vu-trang');
 await detail.click({position:{x:5,y:5}});await detail.waitFor({state:'hidden'});
 for(const [tier,id] of [[1,2],[2,4],[3,7],[4,13],[5,10]]){
  await page.locator(`.haki-popup .haki-option[data-haki-id="${id}"]`).click();await detail.waitFor({state:'visible'});await detail.locator('[data-name="ButtonActivate"]').click();
  await page.waitForFunction(({tier,id})=>window.GameRuntime.player.hero.haki.selected[tier-1]===id,{tier,id});await detail.waitFor({state:'hidden'});
 }
 assert.deepEqual(await visible('.haki-popup .haki-option [data-name="FrameSelected"]'),[false,true,false,true,false,false,true,false,false,true,false,false,true,false,false]);
 assert.deepEqual(await visible('.haki-popup [data-name="MedMan"] [data-name^="Line"]'),[true,true,true,true,true]);await shot('book-selected');
 // Đổi lựa chọn miễn phí rồi trả lại.
 const gold=await page.evaluate(()=>window.GameRuntime.player.wallet.gold);
 await page.locator('.haki-popup .haki-option[data-haki-id="1"]').click();await detail.locator('[data-name="ButtonActivate"]').click();await page.waitForFunction(()=>window.GameRuntime.player.hero.haki.selected[0]===1);
 await page.locator('.haki-popup .haki-option[data-haki-id="2"]').click();await detail.locator('[data-name="ButtonActivate"]').click();await page.waitForFunction(()=>window.GameRuntime.player.hero.haki.selected[0]===2);
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.wallet.gold),gold);
 await page.locator('.haki-popup [data-name="ButtonClose"]').click();await page.waitForSelector('.haki-popup',{state:'detached'});

 assert.deepEqual(await visible('.haki-panel [data-name^="Line"]'),[true,true,true,true,true]);await shot('board');
 await page.locator('.haki-panel [data-name="ButtonESkill4"]').click();const panelDetail=page.locator('.haki-panel>[data-name="PanelESkillDetail"]');await panelDetail.waitFor({state:'visible'});
 assert.ok((await panelDetail.innerText()).includes('Tăng 20% công'));await shot('board-detail');await panelDetail.click({position:{x:5,y:5}});
 assert.ok(await page.evaluate(()=>window.GameRuntime.player.hero.stats.power)>power,'Haki raises power');

 // Sao 16 (L2): bậc 3-5 khóa, Haki đã chọn ở bậc cao không còn hiệu lực trên bảng.
 await players.updateOne({usernameKey:'haki_qa'},{$set:{'player.hero.stars':16}});await page.reload();await ready();await openTab();
 assert.deepEqual(await visible('.haki-panel .haki-node [data-name="IconLock"]'),[false,false,true,true,true]);assert.deepEqual(await visible('.haki-panel [data-name^="Line"]'),[true,false,false,false,false]);await shot('partly-locked');
 // Tướng chiêu mộ ở sao tím: Mihawk Samurai max cấp 4, mô tả bản [4] gốc (Tốc Kiếm Yoru 1000% Công).
 {const doc=await players.findOne({usernameKey:'haki_qa'}),id='hero-537';await players.updateOne({_id:doc._id},{$set:{['player.reserveHeroes.'+id]:{id,level:120,exp:0,stars:6,rank:0,equipment:{},skills:{}}}});
  await page.reload();await ready();await page.evaluate(()=>window.GameRuntime.navigate(7));await page.locator('[data-action="hero"][data-hero="hero-537"]').click();await page.waitForSelector('.hero-round-skill');
  assert.deepEqual(await page.locator('.hero-skill-level').allTextContents(),['4','4','4','4']);await settle();await page.locator('.hero-ref-skills').screenshot({path:`${output}/mihawk-level4.png`});
  await page.locator('.hero-round-skill').first().click();await page.waitForSelector('.luffy-skill-tooltip');const t=await page.locator('.luffy-skill-tooltip').innerText();assert.ok(t.includes('[4]')&&t.includes('1000% Công')&&t.includes('Đã đạt cấp tối đa'),t);await page.locator('.luffy-skill-tooltip').screenshot({path:`${output}/mihawk-skill4.png`});await page.locator('[data-action="close"]').first().click()}
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.uiDebug?.errors||[]),[]);
 const report={errors,checks:['tab-replaces-skills','locked-at-1-star','auto-skill-level-4','no-skill-upgrade-button','book-15-options','vu-trang-detail','five-activations','free-switch','board-lines','board-detail','power-increase','partial-lock','summoned-hero-level-4']};fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_haki_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
