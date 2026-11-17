// QA Cửa hàng Lệnh bài võ đấu: tab Đấu trường trong Cửa hàng (ô tiền FieldArenaCoin), đổi vật phẩm, giới hạn lượt;
// tab admin "Shop Đấu trường": sửa giá / giới hạn / thêm món, tắt cửa hàng → tab ẩn.
// Dùng: node tools/qa-arena-shop.cjs (ảnh: qa-output/arena-shop/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_arshop_'+crypto.randomBytes(6).toString('hex'),port=4261,url=`http://127.0.0.1:${port}`,output='qa-output/arena-shop',secret=crypto.randomBytes(18).toString('base64url');let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off',ADMIN_PASSWORD:secret},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[];
 const watch=pg=>{pg.on('pageerror',e=>errors.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())})};
 // Admin: sửa giá Thùng bia, giới hạn, thêm món kim cương.
 const admin=await browser.newPage({viewport:{width:1500,height:1000}});watch(admin);admin.on('dialog',d=>d.accept());
 await admin.goto(url+'/admin');await admin.locator('#password').fill(secret);await admin.locator('#login-form button').click();await admin.waitForSelector('#tab-arenashop');
 await admin.locator('#tab-arenashop').click();await admin.waitForSelector('#arena-shop-tab .gem-admin');await admin.screenshot({path:output+'/01-admin.png',fullPage:true});
 const barrelIndex=await admin.evaluate(()=>[...document.querySelectorAll('#arena-shop-tab [data-num$=".price"]')].findIndex(x=>x.closest('.ev-row-edit').textContent.includes('Thùng bia')));
 await admin.locator(`#arena-shop-tab [data-num="offers.${barrelIndex}.price"]`).fill('123');await admin.locator(`#arena-shop-tab [data-num="offers.${barrelIndex}.limit"]`).fill('2');
 await admin.locator('#arena-shop-tab [data-add]').click();await admin.locator('#arena-shop-search').fill('kim cuong');await admin.locator('#arena-shop-matches button').first().click();
 await admin.locator('#arena-shop-save').click();await admin.waitForTimeout(800);
 let cfg=await admin.evaluate(()=>fetch('/api/admin/arena-shop').then(r=>r.json()));const barrel=cfg.config.offers[barrelIndex];
 assert.equal(barrel.price,123);assert.equal(barrel.limit,2);assert.equal(cfg.config.offers.length,13);
 // Người chơi.
 const page=await browser.newPage({viewport:{width:1500,height:845}});watch(page);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Arena_Shop_QA');await page.locator('#password').fill('arena-shop-1');await page.locator('#password-confirm').fill('arena-shop-1');await page.locator('.auth-submit').click();
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden&&GameView.getSceneId()===13);await ready();
 await players.updateOne({usernameKey:'arena_shop_qa'},{$set:{'player.inventory.consumable:40':5650}});await page.reload();await ready();
 const openShop=async()=>{await page.evaluate(()=>GameRuntime.navigate(1404));await page.waitForSelector('.shop-layer');await page.waitForTimeout(600)};
 await openShop();await page.locator('.shop-layer [data-name="Tab_arena"]').click();await page.waitForTimeout(600);await page.locator('#stage').screenshot({path:output+'/02-arena-tab.png'});
 assert.match(await page.locator('.shop-layer [data-name="FieldArenaCoin"]').textContent(),/5[.,]650/);
 // Đổi Thùng bia (123 lệnh bài) hai lần → hết lượt.
 const before=await page.evaluate(()=>GameRuntime.player.inventory['consumable:16']||0);
 const buyBarrel=async()=>{await page.locator('.shop-layer [data-name="ShopItem"]').nth(barrelIndex).locator('[data-name="Price"]').click();await page.waitForSelector('.msg-layer [data-guild-confirm]',{timeout:5000});await page.locator('.msg-layer [data-guild-confirm]').click();await page.waitForTimeout(900);await page.locator('.bonus-close').click({timeout:5000}).catch(()=>{});await page.waitForTimeout(300)};
 await buyBarrel();await buyBarrel();
 const after=await page.evaluate(()=>({b:GameRuntime.player.inventory['consumable:16']||0,t:GameRuntime.player.inventory['consumable:40'],o:GameRuntime.player.shop.arena.offers}));
 console.log('barrels',before,'->',after.b,'tokens',after.t);assert.equal(after.b,before+2);assert.equal(after.t,5650-246);
 console.log('scroll',JSON.stringify(await page.evaluate(()=>{const out=[];for(let e=document.querySelector('.shop-layer');e;e=e.parentElement)if(e.scrollTop||e.scrollLeft)out.push([e.id||e.className,e.scrollTop,e.scrollLeft]);return out})));await page.locator('#stage').screenshot({path:output+'/03-bought.png'});
 assert.ok(await page.locator('.shop-layer [data-name="ShopItem"]').nth(barrelIndex).locator('[data-name="PriceInactive"]').isVisible(),'hết lượt');
 // Tắt cửa hàng → tab ẩn.
 await admin.locator('#arena-shop-tab [data-enabled]').uncheck();await admin.locator('#arena-shop-save').click();await admin.waitForTimeout(800);
 await page.evaluate(()=>window.ShopUI?.close());await page.reload();await ready();await openShop();
 assert.equal(await page.locator('.shop-layer [data-name="Tab_arena"]').count(),0);await page.locator('#stage').screenshot({path:output+'/04-off.png'});
 await admin.locator('#arena-shop-reset').click();await admin.waitForTimeout(700);assert.equal((await admin.evaluate(()=>fetch('/api/admin/arena-shop').then(r=>r.json()))).custom,false);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{assert.match(database,/^htps_arshop_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
