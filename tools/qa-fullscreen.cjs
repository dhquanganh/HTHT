const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_fs_'+crypto.randomBytes(6).toString('hex'),port=4220,url=`http://127.0.0.1:${port}`,output='qa-output/fullscreen';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_fs_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Fs_QA');await page.locator('#password').fill('fs-password-1');await page.locator('#password-confirm').fill('fs-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'fs_qa'},{$set:{'player.account.level':60}});
 const sizes=[[1920,1080,1],[2560,1440,1],[915,412,2.6],[1024,768,1]];
 for(const [w,h,dpr] of sizes){
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr});const pg=await ctx.newPage();pg.on('pageerror',e=>errors.push(e.message));
  await pg.goto(url);await pg.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden).catch(async()=>{await pg.locator('[data-action=auth-login]').click().catch(()=>{});await pg.locator('#username').fill('Fs_QA');await pg.locator('#password').fill('fs-password-1');await pg.locator('.auth-submit').click();await pg.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden)});
  await pg.evaluate(()=>GameRuntime.navigate(13));await pg.waitForFunction(()=>GameView.getSceneId()===13&&document.querySelector('#loading').hidden);await pg.waitForTimeout(1500);
  const m=await pg.evaluate(()=>{const s=document.querySelector('#stage').getBoundingClientRect(),c=document.querySelector('#game'),l=document.querySelector('#game-layer').getBoundingClientRect(),b=document.querySelector('#fullscreen-toggle');return{stage:[Math.round(s.x),Math.round(s.y),Math.round(s.width),Math.round(s.height)],canvas:[c.width,c.height],layer:[Math.round(l.width),Math.round(l.height)],ratio:+(s.width/s.height).toFixed(3),button:getComputedStyle(b).display}});
  console.log(w+'x'+h+'@'+dpr,JSON.stringify(m));await pg.screenshot({path:`${output}/home-${w}x${h}.png`});
  if(w===1920){await pg.evaluate(()=>{const n=GameView.allNodes(GameView.getScene()).find(x=>x.activityAction==='toggle');GameRuntime.handleHit({name:n.name,node:n})});await pg.waitForTimeout(500);await pg.evaluate(()=>{const n=GameView.allNodes(GameView.getScene()).find(x=>x.activityAction==='SR');GameRuntime.handleHit({name:n.name,node:n})});await pg.waitForSelector('.pet-screen');await pg.locator('.pet-screen [data-name="PetPanel"]').click();await pg.waitForTimeout(800);await pg.locator('.pet-screen [data-name="Area2"] > [data-name="Button"]').click();await pg.waitForTimeout(800);await pg.locator('.pet-screen:last-of-type [data-name="SummonBtn"]').click();await pg.waitForTimeout(2500);
   console.log('spine canvas',JSON.stringify(await pg.evaluate(()=>[...document.querySelectorAll('.pet-spine')].map(c=>[c.width,c.style.width]))));await pg.screenshot({path:`${output}/summon-${w}x${h}.png`})}
  await ctx.close();
 }
 assert.deepEqual(errors,[]);console.log('ok');
})().catch(e=>{console.error(e.message?.slice(0,500)||e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
