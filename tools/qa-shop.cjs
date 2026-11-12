// QA Cửa hàng (PopupShop gốc): Chợ đen mua / làm mới, tab Huyết tế đổi Hồn hải tặc, trở về.
// DB htps_shopqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_shopqa_'+crypto.randomBytes(6).toString('hex'),port=4286,url=`http://127.0.0.1:${port}`,output='qa-output/shop';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_shopqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root')&&document.querySelector('#loading').hidden,null,{timeout:40000});
 const shot=async(name,ms=900)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 const closeBonus=async()=>{if(await page.locator('.bonus-popup').count()){await page.locator('.bonus-close').click();await page.waitForTimeout(200)}};
 const S=()=>page.evaluate(()=>GameRuntime.player.shop);
 const world=async()=>{await page.evaluate(()=>GameRuntime.navigate(37));await page.waitForFunction(()=>GameView.getSceneId()===37&&document.querySelector('#loading').hidden,null,{timeout:30000});await page.waitForTimeout(800)};
 const set=async patch=>{await players.updateOne({usernameKey:'shop_qa'},{$set:patch});await page.reload();await ready();await world();await page.evaluate(()=>GameRuntime.navigate(1404));await page.waitForSelector('.shop-layer [data-name="ShopItem"]')};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Shop_QA');await page.locator('#password').fill('shop-password-1');await page.locator('#password-confirm').fill('shop-password-1');await page.locator('.auth-submit').click();await ready();
 // Cấp thấp: đảo khóa.
 await world();
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;
 // Bản đồ thế giới rộng 2300: kéo sang trái tới khi đảo hiện trong khung rồi chạm.
 const tap=async name=>{for(let i=0;i<6;i++){const b=await page.evaluate(n=>GameView.hitBox(n),name);assert.ok(b,name);const cx=b.x+b.w/2,cy=b.y+b.h/2;
  if(cx>80&&cx<1056){await page.mouse.click(stage.x+cx*k,stage.y+cy*k);return}
  const dx=cx>=1056?-500:500;await page.mouse.move(stage.x+568*k,stage.y+450*k);await page.mouse.down();await page.mouse.move(stage.x+(568+dx)*k,stage.y+450*k,{steps:12});await page.mouse.up();await page.waitForTimeout(500)}
  throw Error('cannot scroll to '+name)};
 await players.updateOne({usernameKey:'shop_qa'},{$set:{'player.account.level':30,'player.wallet.diamonds':5000,'player.wallet.gold':5000000,'player.inventory.consumable:7':1000}});await page.reload();await ready();await world();
 const open=async()=>{await page.evaluate(()=>GameRuntime.navigate(1404));await page.waitForFunction(()=>GameView.getSceneId()===1404&&document.querySelector('#loading').hidden,null,{timeout:30000});await page.waitForSelector('.shop-layer [data-name="ShopItem"]')};
 await open();await shot('1-market',1200);
 assert.equal(await page.locator('.shop-layer [data-name="ShopItem"]').count(),(await S()).items.length);
 // Mua món đầu.
 const first=(await S()).items[0];await page.locator('.shop-layer [data-name="Price"]').first().click();await page.waitForSelector('[data-guild-confirm]');await shot('2-buy-confirm');
 await page.locator('[data-guild-confirm]').first().click();await page.waitForFunction(()=>GameRuntime.player.shop.items[0].bought);await page.waitForTimeout(300);await shot('3-bought');await closeBonus();
 await page.waitForSelector('.shop-layer [data-name="PriceInactive"]');
 // Làm mới.
 const g=await page.evaluate(()=>GameRuntime.player.wallet.diamonds),cost=(await S()).refreshCost;
 await page.locator('.shop-layer [data-name="ButtonRefresh"]').click();await page.waitForSelector('[data-guild-confirm]');await page.locator('[data-guild-confirm]').first().click();
 await page.waitForFunction(([g,c])=>GameRuntime.player.wallet.diamonds===g-c&&GameRuntime.player.shop.items.every(i=>!i.bought),[g,cost]);await shot('4-refreshed',800);
 // Tab Huyết tế.
 await page.locator('.shop-layer [data-name="Tab_altar"]').click();await page.waitForSelector('.shop-layer .shop-limit');await shot('5-altar');
 const souls=await page.evaluate(()=>GameRuntime.player.inventory['consumable:7']);await page.locator('.shop-layer [data-name="Price"]').first().click();await page.waitForSelector('[data-guild-confirm]');await page.locator('[data-guild-confirm]').first().click();
 await page.waitForFunction(s=>GameRuntime.player.inventory['consumable:7']<s,souls);await closeBonus();await shot('6-altar-bought',600);
 await page.locator('.shop-layer [data-name="Tab_market"]').click();await page.waitForTimeout(400);
 await page.locator('.shop-layer [data-name="ButtonBack"]').click();await page.waitForFunction(()=>GameView.getSceneId()===13);assert.equal(await page.locator('.shop-layer').count(),0);
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['open','shelf','buy-confirm','buy','sold-state','refresh','altar-tab','altar-buy','back']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_shopqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
