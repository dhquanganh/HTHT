// QA hiệu ứng đòn đánh thường gốc (hero-effects.json → heroes[avatar].attack): vào ải, chờ hiệu ứng atk-fx chạy và chụp lại.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
try{process.loadEnvFile('.env')}catch{}
const stage=Number(process.env.STAGE||20),db='htps_attackfx_'+crypto.randomBytes(6).toString('hex'),port=4179,out='qa-output/attack-effects';let server,browser;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:db,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),30000);server.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve()}});server.once('exit',code=>reject(Error('QA exited '+code)))});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port);await page.waitForSelector('#auth-form');await page.locator('[data-action="auth-register"]').click();
 await page.locator('#username').fill('AttackFx_QA');await page.locator('#password').fill('attack-fx-password-2026');await page.locator('#password-confirm').fill('attack-fx-password-2026');await page.locator('.auth-submit').click();
 await page.waitForFunction(()=>window.GameRuntime?.player&&window.GameView.getSceneId()===13&&document.querySelector('#loading').hidden);
 // Mở ải có quái dùng hiệu ứng riêng (ải 20: Hit_189, Hit_11) trực tiếp trong database tạm.
 const mongo=new MongoClient(process.env.MONGODB_URI);await mongo.connect();await mongo.db(db).collection('players').updateOne({usernameKey:'attackfx_qa'},{$set:{'player.adventure.unlockedStage':stage,'player.account.level':40,'player.hero.level':60}});await mongo.close();
 await page.reload();await page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);
 await page.evaluate(()=>window.GameRuntime.navigate(34));await page.locator(`[data-action="stage"][data-id="${stage}"]`).click();
 const remove=page.locator('.campaign-reserves [data-action="campaign-hero"][data-hero="zoro-king-of-hell"].selected');if(await remove.count())await remove.click();
 await page.locator('[data-action="battle-start"]').click();await page.waitForSelector('.battle-hud');await page.waitForFunction(()=>window.GameRuntime.actors.every(a=>a.controller.instance&&a.visualHeight));
 const avatars=await page.evaluate(()=>window.GameRuntime.actors.map(a=>({side:a.side,avatar:a.avatar,name:a.name})));
 const seen=new Map();
 for(let i=0;i<10&&seen.size<3;i++){
  const shown=await page.waitForFunction(()=>window.GameRuntime.effects.filter(f=>f.controller.kind==='atk-fx'&&f.elapsed>.05&&f.elapsed<f.duration).map(f=>f.controller.skeleton.name),{},{timeout:30000,polling:30}).then(h=>h.jsonValue()).catch(()=>[]);
  if(process.env.FX_DEBUG&&shown.length)console.log(JSON.stringify(await page.evaluate(()=>window.GameRuntime.effects.filter(f=>f.controller.kind==='atk-fx').map(f=>{const o=new spine.Vector2(),z=new spine.Vector2();f.controller.instance.getBounds(o,z,[]);return{n:f.controller.skeleton.name,x:Math.round(f.x),y:Math.round(f.y),scale:f.scale,flip:f.flip,el:f.elapsed.toFixed(2),dur:f.duration,bounds:[o.x,o.y,z.x,z.y].map(Math.round)}}))));
  for(const name of shown)if(!seen.has(name)){seen.set(name,true);await page.locator('#stage').screenshot({path:`${out}/${seen.size}-${name}.png`})}
  await page.waitForTimeout(400);
 }
 assert.ok(seen.size>0,'Không thấy hiệu ứng đòn thường gốc nào');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,actors:avatars,attackEffects:[...seen.keys()]}));
})().catch(async e=>{console.error(e.stack);if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(process.env.MONGODB_URI){const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();assert.match(db,/^htps_attackfx_[a-f0-9]{12}$/);await client.db(db).dropDatabase()}finally{await client.close()}}});
