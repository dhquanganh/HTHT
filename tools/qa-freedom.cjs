// QA Đấu Trường Tự Do (thay mô tả bên dưới): toà Siêu Tân Tinh trên bản đồ → màn chính (thứ Hai, đăng ký 3 đội) → popup → khởi động lại
// với đồng hồ thứ Ba 10:00 (đánh tự do) → màn khiêu chiến → đánh 1 trận → thứ Bảy (vòng 16, dự đoán).
// Dùng: node tools/qa-nova.cjs (ảnh: qa-output/freedom/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_freeqa_'+crypto.randomBytes(6).toString('hex'),port=4231,url=`http://127.0.0.1:${port}`,output='qa-output/freedom';let server,browser,client;
const H=3600000,D=24*H,monday=Date.UTC(2026,10,15,17)+60000;
const start=time=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NOVA_QA_TIME:String(time)},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
const restart=async time=>{server.kill();await new Promise(r=>server.once('exit',r));server=await start(time)};
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start(Date.now());client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(600)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const world=async()=>{await page.evaluate(()=>GameRuntime.navigate(37));await page.waitForFunction(()=>GameView.getSceneId()===37&&document.querySelector('#loading').hidden);await page.waitForTimeout(1500)};
 const clickHit=async name=>{const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;const b=await page.waitForFunction(n=>GameView.hitBox(n),name,{timeout:15000}).then(h=>h.jsonValue());await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k)};
 const ok=async()=>{await page.waitForSelector('.msg-layer [data-guild-confirm]',{timeout:5000});await page.locator('.msg-layer [data-guild-confirm]').last().click();await page.waitForTimeout(900)};
 const btn=n=>page.locator(`.fd-root [data-name="${n}"]`).first();
 const fd=()=>page.evaluate(()=>GameRuntime.player.freedom);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Free_QA');await page.locator('#password').fill('free-password-1');await page.locator('#password-confirm').fill('free-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'free_qa'},{$set:{'player.account.level':60,'player.wallet.diamonds':5000,'player.inventory.consumable:4':5}});
 await page.reload();await ready();await world();await shot('01-world');
 await clickHit('B_Explore');await page.waitForSelector('.fd-root');await page.waitForTimeout(1200);await shot('02-register');
 await btn('ButtonJoinWithTicket').click();await ok();await page.waitForTimeout(1500);await shot('03-team');
 let s=await fd();assert.equal(s.run.status,'team');assert.equal(s.runs,1);const first=s.run.team.join();
 await btn('ButtonResetTeam').click();await page.waitForSelector('.fd-reset');await shot('04-reset-popup');await page.locator('.fd-reset [data-name="ButtonReset"]').click();await page.waitForTimeout(1500);
 s=await fd();assert.notEqual(s.run.team.join(),first);assert.equal(s.run.resets,1);
 await btn('ButtonConfirmTeam').click();await page.waitForTimeout(1500);await shot('05-help');assert.equal((await fd()).run.status,'help');
 await btn('ButtonLeftConfirm').click();await page.waitForTimeout(1500);await shot('06-battle-status');assert.equal((await fd()).run.status,'attack');
 await btn('ButtonCard').click();await page.waitForSelector('.fd-cards');await shot('07-cards');await page.locator('.fd-cards [data-name="ButtonClose"]').first().click();
 await btn('ButtonListHero').click();await page.waitForSelector('.fd-pool');await shot('08-pool');await page.locator('.fd-pool [data-name="ButtonClose"]').first().click();
 await btn('ButtonBattle').click();await page.waitForSelector('.fd-formation');await shot('09-formation');
 await page.locator('.fd-formation [data-attack]').click();await page.waitForFunction(()=>GameView.getSceneId()===9,null,{timeout:20000});await page.waitForTimeout(2500);await shot('10-battle');
 assert.ok(await page.evaluate(()=>!!GameRuntime.player.battle?.freedom),'trận Tự Do');
 await page.locator('[data-action="battle-skip"]').click().catch(()=>{});await page.waitForSelector('.battle-end [data-action="freedom-back"]',{timeout:120000});await shot('11-result');
 const won=await page.evaluate(()=>GameRuntime.player.battle.status==='won');console.log('stage 1',won?'won':'lost');
 await page.locator('.battle-end [data-action="freedom-back"]').click();await page.waitForSelector('.fd-root',{timeout:30000});await page.waitForTimeout(1500);await shot('12-back');
 s=await fd();assert.equal(s.run.status,won?'help':'done');
 if(won){await btn('ButtonRightConfirm').click();await page.waitForTimeout(1200);await btn('ButtonBattle').click();await page.waitForSelector('.fd-formation');await shot('13-formation-stage2');await page.locator('.fd-formation [data-name="ButtonClose"]').first().click()}
 // Kết thúc lượt (đặt trạng thái: đã qua 3 ải, thua ải 4) → màn kết thúc + Nhận thưởng.
 await players.updateOne({usernameKey:'free_qa'},{$set:{'player.freedom.run.status':'done','player.freedom.run.total':10,'player.freedom.run.wins':8,'player.freedom.run.stage':8,'player.freedom.run.lost':true,'player.freedom.run.options':null,'player.freedom.run.enemy':null}});
 await page.reload();await ready();await world();await clickHit('B_Explore');await page.waitForSelector('.fd-root');await page.waitForTimeout(1200);await shot('14-done');
 // 10 ải → 2 trang: mở sẵn trang 2 (ải 8 - 10), mũi tên trái về trang 1, phải sang lại trang 2.
 assert.match(await page.locator('.fd-root .fd-page-no').textContent(),/Trang 2\/2/);assert.equal(await page.locator('.fd-root .fd-stage').count(),3);
 assert.ok(await page.locator('.fd-root .fd-page.next').isDisabled());await page.locator('.fd-root .fd-page.prev').click();await page.waitForTimeout(600);await shot('14b-page1');
 assert.match(await page.locator('.fd-root .fd-page-no').textContent(),/Trang 1\/2/);assert.equal(await page.locator('.fd-root .fd-stage').count(),7);
 await page.locator('.fd-root .fd-page.next').click();await page.waitForTimeout(400);assert.equal(await page.locator('.fd-root .fd-stage').count(),3);
 const gold=await page.evaluate(()=>GameRuntime.player.wallet.gold);await btn('ButtonBattle').click();await page.waitForTimeout(2000);await shot('15-claimed');
 s=await fd();assert.equal(s.run,null);assert.equal(s.best,8);assert.ok(await page.evaluate(()=>GameRuntime.player.wallet.gold)>gold);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{assert.match(database,/^htps_freeqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
