const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_ml_'+crypto.randomBytes(6).toString('hex'),port=4216,url=`http://127.0.0.1:${port}`,output='qa-output/mail';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_ml_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Ml_QA');await page.locator('#password').fill('ml-password-1');await page.locator('#password-confirm').fill('ml-password-1');await page.locator('.auth-submit').click();await ready();
 await page.evaluate(()=>GameRuntime.navigate(13));await scene(13);
 await page.evaluate(()=>GameRuntime.handleHit({name:'ButtonMail',node:{}}));await page.waitForSelector('.reference-mail');await page.waitForTimeout(500);
 const before=await page.locator('.mail-row').count();
 // Ban quản trị gửi thư (ghi thẳng DB như admin) khi hòm thư đang mở: không F5, chờ lượt đồng bộ 20 giây.
 const {sendMail}=await import('../server/mail.mjs');const doc=await players.findOne({usernameKey:'ml_qa'});sendMail(doc.player,{title:'Quà QA',text:'Thư thử',rewards:[{itemId:'gold',quantity:1000}]},Date.now());await players.updateOne({_id:doc._id},{$set:{'player.mail':doc.player.mail}});
 await page.waitForFunction(n=>document.querySelectorAll('.mail-row').length>n,before,{timeout:25000});console.log('mail appeared without reload');
 assert.equal(await page.evaluate(()=>GameRuntime.player.mail.length),1);
 await shot('01-new-mail');
 await page.locator('.mail-row').first().click();await page.locator('[data-action="mail-open"]').click();await page.waitForTimeout(1200);
 await page.evaluate(()=>document.querySelector('.bonus-popup')?.remove());await page.evaluate(()=>GameRuntime.handleHit({name:'ButtonMail',node:{}}));await page.waitForTimeout(800);await shot('02-claimed');
 console.log(await page.locator('.mail-row').first().innerText());
 assert.deepEqual(errors,[]);console.log('ok');
})().catch(e=>{console.error(e.message?.slice(0,400)||e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
