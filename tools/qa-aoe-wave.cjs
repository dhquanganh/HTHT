const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_wave_'+crypto.randomBytes(6).toString('hex'),port=4216,url=`http://127.0.0.1:${port}`,output='qa-output/aoe-wave';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_wave_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Wave_QA');await page.locator('#password').fill('wave-password-1');await page.locator('#password-confirm').fill('wave-password-1');await page.locator('.auth-submit').click();await ready();
 // Mihawk Samurai đủ Nộ: Nộ đánh toàn bộ kẻ địch → số sát thương và lúc ngã của mọi kẻ địch phải cùng một khung hình.
 const run=async(label,kill)=>{
  const doc=await players.findOne({usernameKey:'wave_qa'}),id='hero-537';
  await players.updateOne({_id:doc._id},{$set:{'player.battle':null,'player.reserveHeroes':{...doc.player.reserveHeroes,[id]:{id,level:30,exp:0,stars:5,rank:0,equipment:{},skills:{}}},'player.formation':{version:2,slots:[id,null,null,null,null,null]},'player.adventure.unlockedStage':20,'player.account.level':60}});
  await page.reload();await ready();
  await page.evaluate(()=>GameRuntime.navigate(34));await page.waitForSelector('.campaign-deck');await page.waitForTimeout(400);await page.locator('.campaign-primary').click();await page.waitForSelector('.campaign-formation');
  await page.locator('[data-action="battle-start"]').click();await page.waitForSelector('.battle-hud');
  await players.updateOne({usernameKey:'wave_qa'},{$set:{'player.battle.allies.0.energy':100,'player.battle.allies.0.speed':1e7,'player.battle.allies.0.baseSpeed':1e7},...(kill?{}:{$mul:{'player.battle.enemies.$[].maxHp':400,'player.battle.enemies.$[].hp':400}})});
  await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(9));await page.waitForSelector('.battle-hud',{timeout:20000});await page.locator('.battle-hud [data-action="battle-auto"]').click().catch(()=>{});
  const r=await page.evaluate(async()=>{const hit={},dead={},start=performance.now();
   await new Promise(done=>{const tick=()=>{for(const a of GameRuntime.actors||[]){if(a.side!=='enemy')continue;if(a.lastHp===undefined)a.lastHp=a.hp;if(a.hp<a.lastHp&&!hit[a.id])hit[a.id]=performance.now();if(a.deathAt!==undefined&&a.deathAt!==-1&&!dead[a.id])dead[a.id]=performance.now()}
     const enemies=(GameRuntime.actors||[]).filter(a=>a.side==='enemy');if(enemies.length&&Object.keys(hit).length===enemies.length&&(Object.keys(dead).length===enemies.length||performance.now()-Math.max(...Object.values(hit))>2500)||performance.now()-start>60000)return done();requestAnimationFrame(tick)};requestAnimationFrame(tick)});
   const spread=o=>{const v=Object.values(o);return v.length?Math.round(Math.max(...v)-Math.min(...v)):null};
   return{enemies:(GameRuntime.actors||[]).filter(a=>a.side==='enemy').length,hit:Object.keys(hit).length,hitSpread:spread(hit),dead:Object.keys(dead).length,deathSpread:spread(dead)}});
  await page.locator('#stage').screenshot({path:`${output}/${label}.png`});
  await page.evaluate(()=>document.querySelector('[data-action="battle-leave"]')?.click());await page.waitForTimeout(500);
  return r;
 };
 const survive=await run('aoe-hit',false),kill=await run('aoe-kill',true);
 console.log(JSON.stringify({survive,kill}));
 assert.equal(survive.hit,survive.enemies);assert.ok(survive.hitSpread<=50,'mọi kẻ địch trúng đòn cùng lúc');
 assert.equal(kill.dead,kill.enemies);assert.ok(kill.deathSpread<=50,'mọi kẻ địch ngã cùng lúc');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
