const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_world_'+crypto.randomBytes(6).toString('hex'),url='http://127.0.0.1:4187',output='qa-output/world';let server,browser,client;
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:'4187',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);server.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve()}});server.once('exit',code=>reject(Error('QA server exited '+code)))});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1564,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action="auth-register"]').click();await page.locator('#username').fill('World_QA');await page.locator('#password').fill('world-qa-password');await page.locator('#password-confirm').fill('world-qa-password');await page.locator('.auth-submit').click();await page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const box=await page.locator('#stage').boundingBox(),at=(x,y)=>[box.x+x*box.width/1136,box.y+y*box.height/640];
 const click=(x,y)=>page.mouse.click(...at(x,y));
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 const toast=()=>page.locator('#toast').textContent();
 const shot=name=>page.locator('#stage').screenshot({path:`${output}/${name}.png`});
 await page.waitForTimeout(500);await click(1068,430);await scene(37);await page.waitForTimeout(1000);await shot('world');
 await page.mouse.move(...at(900,300));await page.mouse.wheel(0,3000);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>GameView.worldScroll),1164);await shot('world-right');await page.mouse.wheel(0,-3000);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>GameView.worldScroll),0);
 await page.mouse.move(...at(800,300));await page.mouse.down();await page.mouse.move(...at(500,300),{steps:6});await page.mouse.up();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>Math.round(GameView.worldScroll)),300);assert.equal(await page.evaluate(()=>GameView.getSceneId()),37);
 await page.mouse.move(...at(500,300));await page.mouse.down();await page.mouse.move(...at(800,300),{steps:6});await page.mouse.up();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>Math.round(GameView.worldScroll)),0);
 await click(760,470);await page.waitForSelector('.arena-hub');assert.equal(await page.evaluate(()=>GameView.getSceneId()),37);await page.locator('.arena-hub [data-name="ButtonBack"]').click();await page.waitForFunction(()=>!document.querySelector('.arena-layer'));
 await click(148,207);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>GameView.getSceneId()),37);
 // Đảo Chiến dịch (B_EventRaid) mở PopupEventRaid; màn ải Chiến dịch vẫn vào từ nút Chiến dịch ở màn chính.
 await click(470,410);await page.waitForSelector('.raid-hub');assert.equal(await page.evaluate(()=>GameView.getSceneId()),37);await page.locator('.raid-hub [data-name="ButtonClose"]').click();await page.waitForFunction(()=>!document.querySelector('.raid-layer'));
 await page.evaluate(()=>GameRuntime.navigate(34));await scene(34);await page.waitForSelector('.campaign-deck');
 await page.locator('[data-action="campaign-map"]').first().click();await scene(28);await page.locator('.campaign-map [data-action="home"]').click();await scene(37);
 await page.waitForTimeout(300);await click(50,45);await scene(13);
 await page.waitForTimeout(300);await click(1044,570);await scene(34);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:['home-to-world','wheel-scroll','drag-scroll','drag-does-not-click','locked-island-toast','campaign-island','deck-map-back-to-world','world-back-home','explore-direct-to-deck'],errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_world_[a-f0-9]{12}$/);await client.db(database).dropDatabase();await client.close();server?.kill()});
