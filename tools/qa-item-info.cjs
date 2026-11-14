const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_iteminfo_'+crypto.randomBytes(6).toString('hex'),url='http://127.0.0.1:4192',output='qa-output/item-info';let server,browser,client;
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:'4192',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);server.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve()}});server.once('exit',code=>reject(Error('QA server exited '+code)))});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1564,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action="auth-register"]').click();await page.locator('#username').fill('Info_QA');await page.locator('#password').fill('info-qa-password');await page.locator('#password-confirm').fill('info-qa-password');await page.locator('.auth-submit').click();await page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_iteminfo_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 const box=await page.locator('#stage').boundingBox(),at=(x,y)=>[box.x+x*box.width/1136,box.y+y*box.height/640],click=(x,y)=>page.mouse.click(...at(x,y));
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id),now=()=>page.evaluate(()=>GameView.getSceneId()),shot=name=>page.locator('#stage').screenshot({path:`${output}/${name}.png`}),player=fn=>page.evaluate(fn);
 await page.waitForTimeout(400);await page.evaluate(()=>GameRuntime.navigate(37));await scene(37);await page.waitForTimeout(600);await page.evaluate(()=>GameRuntime.navigate(40));await scene(40);await page.waitForTimeout(800);await shot('tower-floor-1');
 assert.deepEqual(await player(()=>GameRuntime.player.tower.floors.map(f=>f.floor)),[1,2,3,4]);
 const open=async(sel,name)=>{const t=page.locator(sel).first();await t.scrollIntoViewIfNeeded();await t.click();await page.waitForSelector('.item-info-layer [data-name="TextTitle"]');await page.waitForTimeout(500);await shot(name);
  const title=await page.locator('.item-info-layer [data-name="TextTitle"]').innerText();await page.locator('.item-info-layer [data-name="ButtonClose"]').click();await page.waitForFunction(()=>!document.querySelector('.item-info-layer'));return title};
 const titles={};
 // Trang sự kiện: ô thưởng mốc (tuần) và ô gói đổi (ưu đãi).
 await page.evaluate(()=>GameRuntime.navigate(10));await scene(10);await page.waitForSelector('.ev-content .ev-rewards [data-info-item]');
 titles.milestone=await open('.ev-content .ev-rewards [data-info-item]','1-event-milestone');
 titles.gold=await open('.ev-content [data-info-item="gold"]','2-event-gold').catch(()=>null);
 await page.evaluate(()=>{const b=[...document.querySelectorAll('[data-action="event-tab"],[data-event-tab]')].find(x=>/Ưu đãi/.test(x.textContent));b?.click()});await page.waitForTimeout(800);
 if(await page.locator('.ev-offer [data-info-item]').count())titles.offer=await open('.ev-offer [data-info-item]','3-event-offer');
 // Lễ hội (popup sự kiện đặc biệt): cửa hàng và vòng quay.
 await page.evaluate(()=>GameRuntime.navigate(13));await scene(13);await page.waitForTimeout(600);
 {const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136,b=await page.evaluate(()=>GameView.hitBox('ButtonFirstPurchase'));await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k)}
 await page.waitForSelector('.sp-popup [data-info-item]');titles.feast=await open('.sp-popup [data-info-item]','4-feast-item');
 await page.locator('.sp-tab:not(.dice-tab)').nth(1).click();await page.waitForSelector('.sp-board [data-info-item]');titles.wheel=await open('.sp-board [data-info-item]','5-wheel-slot');
 // Chữ dài: mô tả dài nhất và tên dài nhất phải nằm trong khung.
 await page.locator('.sp-popup .sp-close, .sp-popup [data-action="close"]').first().click().catch(()=>{});
 const fits=async(id,name)=>{await page.evaluate(id=>ItemInfoUI.show(id),id);await page.waitForSelector('.item-info-layer [data-name="TextTitle"]');await page.waitForTimeout(400);await shot(name);
  const r=await page.evaluate(()=>{const box=document.querySelector('.item-info-layer [data-name="ImgBgr"]').getBoundingClientRect(),d=document.querySelector('.item-info-layer [data-name="TextDesc"] .pd-text'),t=document.querySelector('.item-info-layer [data-name="TextTitle"]'),ts=t.querySelector('.pd-text');
   const dr=d?.getBoundingClientRect();return{descInside:!dr||(dr.bottom<=box.bottom+1&&dr.top>=box.top-1&&dr.right<=box.right+1),titleFits:ts.scrollWidth<=t.clientWidth+2&&ts.scrollHeight<=t.clientHeight+2&&parseFloat(t.style.fontSize)>=18}});
  await page.locator('.item-info-layer [data-name="ButtonClose"]').click();return r};
 const longDesc=await fits('consumable:200078','6-long-description'),longName=await fits('consumable:4023','7-long-name');
 assert.ok(longDesc.descInside,'long description inside frame');assert.ok(longName.titleFits,'long name fits');
 // Ô hàng trong Cửa hàng (lớp PrefabDOM, cha tắt pointer-events).
 await page.evaluate(()=>GameRuntime.navigate(1404));await page.waitForSelector('.shop-layer [data-info-item]');titles.shop=await open('.shop-layer [data-info-item]','8-shop-item');
 assert.ok(Object.values(titles).filter(Boolean).length>=4,JSON.stringify(titles));
 const unexpected=errors.filter(e=>!/401/.test(e));assert.deepEqual(unexpected,[]);
 console.log(JSON.stringify({titles,errors:unexpected}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
