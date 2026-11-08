const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_form_'+crypto.randomBytes(6).toString('hex'),port=4214,url=`http://127.0.0.1:${port}`,output='qa-output/formation';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_form_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Form_QA');await page.locator('#password').fill('form-password-1');await page.locator('#password-confirm').fill('form-password-1');await page.locator('.auth-submit').click();await ready();
 // Đội 4 tướng: Luffy + 3 tướng triệu hồi.
 const ids=['hero-453','hero-468','hero-143'],doc=await players.findOne({usernameKey:'form_qa'});
 await players.updateOne({_id:doc._id},{$set:{'player.reserveHeroes':{...doc.player.reserveHeroes,...Object.fromEntries(ids.map(id=>[id,{id,level:20,exp:0,stars:3,rank:0,equipment:{},skills:{}}]))},'player.formation':{version:2,slots:[doc.player.hero.id,ids[0],ids[1],ids[2],null,null]}}});
 await page.reload();await ready();
 await page.evaluate(()=>GameRuntime.navigate(34));await page.waitForSelector('.campaign-deck');await page.waitForTimeout(500);await page.locator('.campaign-primary').click();await page.waitForSelector('.campaign-formation');await settle();
 const occupied=()=>page.locator('.campaign-slot.occupied').count();
 assert.equal(await occupied(),4);await page.locator('#stage').screenshot({path:`${output}/before.png`});
 // Chạm tướng ở ô 2 (hàng trước): thẻ co lại, hit_cham_tay nổ ở giữa ô, rồi ô trống.
 await page.locator('.campaign-slot[data-slot="1"] [data-action="campaign-slot"]').click();
 await page.waitForSelector('.campaign-slot.leaving');await page.waitForSelector('.formation-burst',{state:'attached'});await page.waitForTimeout(120);await page.locator('#stage').screenshot({path:`${output}/removing.png`});
 const burst=await page.evaluate(()=>{const c=document.querySelector('.formation-burst');if(!c)return 0;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n});
 await page.waitForFunction(()=>!document.querySelector('.campaign-slot.leaving'));await page.waitForTimeout(400);
 assert.equal(await occupied(),3);assert.equal(await page.locator('.campaign-slot[data-slot="1"].occupied').count(),0);assert.match(await page.locator('.campaign-team-power').innerText(),/3\/6/);
 await page.locator('#stage').screenshot({path:`${output}/removed.png`});
 // Hai lần chạm nhanh không gỡ hai tướng.
 await page.locator('.campaign-slot[data-slot="2"] [data-action="campaign-slot"]').dblclick();await page.waitForTimeout(700);assert.equal(await occupied(),2);
 // Thêm lại: chọn ô trống rồi chọn tướng trong danh sách, thẻ bật vào ô.
 await page.locator('.campaign-slot[data-slot="1"] [data-action="campaign-slot"]').click();await page.locator('[data-action="campaign-hero"][data-hero="hero-453"]').first().click();
 await page.waitForSelector('.campaign-slot[data-slot="1"].entering');await page.waitForTimeout(400);assert.equal(await occupied(),3);await page.locator('#stage').screenshot({path:`${output}/added.png`});
 // Lưu: server nhận đội hình mới.
 await page.locator('[data-action="campaign-save"]').click();await page.waitForFunction(()=>GameRuntime.player.formation.slots.filter(Boolean).length===3);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,burstPixels:burst,errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
