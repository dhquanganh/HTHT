// QA Vòng quay + VIP: nút Vòng quay -> PopupChooseSpin -> vòng 8 ô (quay miễn phí, mua xu, quay), VIP khóa / mở;
// dấu + kim cương -> PopupStoreAndBenefit (cấp VIP, thanh EXP VIP, quyền lợi, quà). DB htps_casinoqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_casinoqa_'+crypto.randomBytes(6).toString('hex'),port=4279,url=`http://127.0.0.1:${port}`,output='qa-output/casino';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_casinoqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root'),null,{timeout:40000});
 const shot=async(name,ms=700)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Casino_QA');await page.locator('#password').fill('casino-password-1');await page.locator('#password-confirm').fill('casino-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'casino_qa'},{$set:{'player.vipExp':600,'player.vip':3,'player.wallet.diamonds':5000}});await page.reload();await ready();await shot('0-home',1200);
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136,tap=async name=>{const b=await page.evaluate(n=>GameView.hitBox(n),name);assert.ok(b,name);await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k)};
 await tap('ButtonLuckySpin');await page.waitForSelector('.casino-choose');await shot('1-choose');
 await page.locator('.casino-choose [data-name="ButtonCasino"]').click();await page.waitForSelector('.casino-wheel .casino-slot');await shot('2-wheel');
 await page.locator('.casino-wheel [data-name="ButtonSpin1"]').click();await page.waitForTimeout(1500);await shot('3a-spinning',0);await page.waitForSelector('.bonus-popup',{timeout:15000});await shot('3-spin-result',300);
 assert.equal(await page.evaluate(()=>GameRuntime.player.casino.freeLeft),0);await page.locator('.bonus-close').click();
 // Ô trúng nằm dưới kim: góc quay của đĩa + góc ô = bội số 360.
 const aligned=await page.evaluate(()=>{const d=document.querySelector('.casino-wheel [data-name="SpinDisk"]'),hit=document.querySelector('.casino-slot.hit');return{rot:parseFloat(d.style.rotate),hit:!!hit}});assert.ok(aligned.hit&&aligned.rot>=1800,JSON.stringify(aligned));
 await page.locator('.casino-wheel [data-name="ButtonSpin1"]').click();await page.locator('[data-guild-confirm]').click();await page.waitForFunction(()=>(GameRuntime.player.inventory['consumable:10']||0)>=10);
 await page.locator('.casino-wheel [data-name="ButtonSpin10"]').click();await page.waitForSelector('.bonus-popup',{timeout:15000});await shot('4-x10',300);await page.locator('.bonus-close').click();
 assert.equal(await page.evaluate(()=>GameRuntime.player.inventory['consumable:10']||0),2);
 const before=await page.evaluate(()=>JSON.stringify(GameRuntime.player.casino.wheels.normal.slots));
 await page.locator('.casino-wheel [data-name="ButtonRefresh"]').click();await page.waitForSelector('.casino-refresh');await shot('4a-refresh-fx',350);await page.waitForFunction(b=>JSON.stringify(GameRuntime.player.casino.wheels.normal.slots)!==b||GameRuntime.player.casino.wheels.normal.refreshCost>0,before);await shot('4b-refreshed',600);
 assert.match(await page.locator('.casino-wheel [data-name="TextCountDownRefresh"]').innerText(),/^\d\d:\d\d:\d\d$/);
 await players.updateOne({usernameKey:'casino_qa'},{$set:{'player.inventory.consumable:10':80}});await page.reload();await ready();await page.evaluate(()=>CasinoUI.openWheel('normal'));await page.waitForSelector('.casino-wheel .casino-slot');
 await page.locator('.casino-wheel [data-name="ButtonSpin100"]').click();await page.waitForSelector('.bonus-popup',{timeout:15000});await shot('4c-x100',300);await page.locator('.bonus-close').click();
 assert.equal(await page.evaluate(()=>GameRuntime.player.inventory['consumable:10']||0),0);await page.evaluate(()=>CasinoUI.close());await tap('ButtonLuckySpin');await page.waitForSelector('.casino-choose');await page.locator('.casino-choose [data-name="ButtonCasino"]').click();await page.waitForSelector('.casino-wheel .casino-slot');
 await page.locator('.casino-wheel [data-name="ButtonBack"]').click();await page.locator('.casino-choose [data-name="ButtonSuperCasino"]').click();await page.waitForSelector('.casino-wheel.super .casino-slot');await shot('5-vip-wheel');
 await page.locator('.casino-wheel [data-name="ButtonBack"]').click();await page.locator('.casino-choose [data-name="ButtonClose"]').click();
 await tap('ButtonAddGem');await page.waitForSelector('.vip-layer .vip-benefits');await shot('6-vip');
 assert.ok((await page.locator('.vip-layer').innerText()).includes('Quyền Lợi'));await page.locator('.vip-layer [data-name="ButtonNext"]').click();await shot('7-vip-next',400);
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['home-button','choose','wheel','free-spin','disk-aligned','buy-chips','x10','refresh','countdown','x100','vip-wheel','vip-popup','vip-pages']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_casinoqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
