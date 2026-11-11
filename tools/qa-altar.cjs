// QA Huyết tế: nút Huyết tế ở màn chính -> AltarScene; chọn nhanh, xem trước, huyết tế (thu hồi + Hồn hải tặc), khóa tướng,
// tab Tướng hoàn trả (về cấp 1, 50 KC), Cửa hàng huyết tế. DB htps_altarqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_altarqa_'+crypto.randomBytes(6).toString('hex'),port=4277,url=`http://127.0.0.1:${port}`,output='qa-output/altar';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_altarqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root'),null,{timeout:40000});
 const shot=async(name,ms=700)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Altar_QA');await page.locator('#password').fill('altar-password-1');await page.locator('#password-confirm').fill('altar-password-1');await page.locator('.auth-submit').click();await ready();
 // Thêm 4 tướng phụ (Zoro cấp 30 6 sao để có thu hồi).

 const defs=['hero-645','hero-642','hero-639','hero-636'];
 const set={'player.reserveHeroes.zoro-king-of-hell':{id:'zoro-king-of-hell',level:30,exp:0,stars:6,rank:0,equipment:{},skills:{'hiryu-jigoku':3,enma:3,'conqueror-haki':3,'decisive-strike':3}}};for(const id of defs)set['player.reserveHeroes.'+id]={id,level:5,exp:0,stars:2,rank:0,equipment:{},skills:{}};
 await players.updateOne({usernameKey:'altar_qa'},{$set:set});await page.reload();await ready();
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136,box=await page.evaluate(()=>GameView.hitBox('ButtonAltar'));
 await page.mouse.click(stage.x+(box.x+box.w/2)*k,stage.y+(box.y+box.h/2)*k);await page.waitForSelector('.altar-layer .alt-heroes .alt-head');await shot('1-altar');
 await page.locator('.altar-layer [data-name="ButtonSmart"]').click();await page.waitForFunction(()=>document.querySelectorAll('.alt-slot .alt-head').length===4);await shot('2-smart');
 await page.locator('.altar-layer [data-name="ButtonPreview"]').click();await page.waitForSelector('.alt-preview');await shot('3-preview');await page.locator('[data-action="close"]').first().click();
 const souls=await page.evaluate(()=>GameRuntime.player.inventory['consumable:7']||0);
 await page.locator('.altar-layer [data-name="ButtonDisassemble"]').click();await page.waitForFunction(n=>(GameRuntime.player.inventory['consumable:7']||0)>n,souls);await shot('4-done',900);
 assert.equal(await page.evaluate(()=>GameRuntime.player.heroes.length),2);
 // Tướng hoàn trả: Zoro cấp 30 về cấp 1
 await page.locator('.bonus-close').click();await page.waitForSelector('.bonus-popup',{state:'detached'});
 await page.locator('.altar-layer [data-name="ButtonReturn"]').click();await page.locator('.alt-heroes .alt-head[data-hero="zoro-king-of-hell"]').click();await page.waitForSelector('.alt-return-slot .alt-head');await shot('5-return');
 const gems=await page.evaluate(()=>GameRuntime.player.wallet.diamonds);await page.locator('.altar-layer [data-name="PanelReturnHero"] [data-name="Button"]').click();await page.locator('[data-guild-confirm]').click();
 await page.waitForFunction(()=>GameRuntime.player.heroes.find(h=>h.id==='zoro-king-of-hell').level===1);assert.equal(await page.evaluate(()=>GameRuntime.player.wallet.diamonds),gems-50);
 // Cửa hàng
 await page.locator('.bonus-popup .bonus-close').click({timeout:3000}).catch(()=>{});
 await page.locator('.altar-layer [data-name="ButtonShop"]').click();await page.waitForSelector('.alt-shop');await shot('6-shop');
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|404 \(Not Found\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['home-button','altar-scene','smart-select','preview','sacrifice','return-level1-50gems','shop']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_altarqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
