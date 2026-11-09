// QA Luyện hồn: nút trên Thông tin tướng (khóa / mở, Spine), sổ EXCPanelMain, nâng cấp tới bậc kỹ năng 1, chỉ số tướng tăng,
// trợ giúp, cài lại. Database htps_excqa_* riêng, tự xóa. Ảnh trong qa-output/exc/.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_excqa_'+crypto.randomBytes(6).toString('hex'),port=4255,url=`http://127.0.0.1:${port}`,output='qa-output/exc';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_excqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async(ms=900)=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(ms)};
 const shot=async name=>{await settle();await page.screenshot({path:`${output}/${name}.png`})};
 const toast=()=>page.evaluate(()=>document.querySelector('#toast')?.innerText||'');
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Exc_QA');await page.locator('#password').fill('exc-password-1');await page.locator('#password-confirm').fill('exc-password-1');await page.locator('.auth-submit').click();await ready();
 // Luffy (không có trong db_exc): nút khóa.
 await page.evaluate(()=>window.GameRuntime.navigate(1156));await page.waitForSelector('.exc-entry.locked');await shot('locked-luffy');
 await page.locator('.exc-button').click();await page.waitForTimeout(300);assert.match(await toast(),/chưa mở khóa Luyện Hồn/);
 // Zoro 9 sao: khóa theo sao.
 const luffy=(await players.findOne({usernameKey:'exc_qa'})).player.hero;
 await players.updateOne({usernameKey:'exc_qa'},{$set:{'player.reserveHeroes':{'luffy-gear-2':luffy},'player.hero':{id:'zoro-king-of-hell',level:150,exp:0,stars:9,rank:0,equipment:{},skills:{'hiryu-jigoku':3,enma:3,'conqueror-haki':3,'decisive-strike':3}}}});
 await players.updateOne({usernameKey:'exc_qa'},{$set:{'player.wallet.diamonds':50000,'player.inventory.consumable:2201':500,'player.inventory.consumable:2202':40}});
 await page.reload();await ready();await page.evaluate(()=>window.GameRuntime.navigate(1156));await page.waitForSelector('.exc-entry.locked');await page.locator('.exc-button').click();await page.waitForTimeout(300);assert.match(await toast(),/10 sao/);
 await players.updateOne({usernameKey:'exc_qa'},{$set:{'player.hero.stars':10}});
 await page.reload();await ready();await page.evaluate(()=>window.GameRuntime.navigate(1156));await page.waitForSelector('.exc-entry:not(.locked)');await shot('hero-open');
 assert.ok(await page.locator('.exc-entry canvas.exc-spine').count()>=1,'Spine Anim_thienphu on the button');
 await page.locator('.exc-button').click();await page.waitForSelector('.exc-panel');await shot('panel-0');
 let text=await page.locator('.exc-panel').innerText();assert.ok(text.includes('Cấp: 0/40')&&text.includes('Lv.1 (cấp 10 để mở khóa)')&&text.includes('Haki Bá Vương'),text.slice(0,300));
 const atk=await page.evaluate(()=>window.GameRuntime.player.hero.stats.attack);
 for(let i=1;i<=10;i++){await page.locator('.exc-panel [data-name="ButtonLvUp"]').click();await page.waitForFunction(l=>window.GameRuntime.player.hero.exc.level===l,i);if(i===2){await page.waitForTimeout(150);await shot('panel-2-burst')}}
 await settle(1200);await shot('panel-10');
 text=await page.locator('.exc-panel').innerText();assert.ok(text.includes('Cấp: 10/40')&&text.includes('Công : +10%')&&text.includes('Máu : +10%')&&text.includes('Tốc độ : +25'),text.slice(0,300));
 const atk10=await page.evaluate(()=>window.GameRuntime.player.hero.stats.attack);assert.ok(Math.abs(atk10/atk-1.1)<.01,atk+' -> '+atk10);
 await page.locator('.exc-panel [data-name="ButtonHelp"]').click();await page.waitForTimeout(400);await shot('help');assert.ok((await page.locator('.exc-panel [data-name="PopupHelp"]').innerText()).includes('40 cấp độ'));
 await page.locator('.exc-panel [data-name="PopupHelp"] [data-name="ButtonClose"]').click();
 await page.locator('.exc-panel [data-name="Close2"]').click({position:{x:10,y:10}});await page.waitForSelector('.exc-panel',{state:'detached'});await settle(1200);await shot('hero-level10');
 assert.ok(await page.locator('.exc-entry canvas.exc-spine').count()>=2,'Fire_eff Level1 on the button');
 // Cài lại
 await page.locator('.exc-button').click();await page.waitForSelector('.exc-panel');await page.locator('.exc-panel [data-name="ButtonReset"]').click();await page.locator('[data-germa-confirm]').click();
 await page.waitForFunction(()=>window.GameRuntime.player.hero.exc.level===0);await page.locator('.bonus-popup [data-action="bonus-close"]').click().catch(()=>{});await shot('reset');
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.inventory['consumable:2201']),500);
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['locked-not-eligible','locked-star','button-spine','panel','level-up-x10','stats','skill-tier-1','help','fire-level-spine','reset-refund']};fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_excqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
