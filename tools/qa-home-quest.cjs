const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_hq_'+crypto.randomBytes(6).toString('hex'),port=4212,url=`http://127.0.0.1:${port}`,output='qa-output/home-quest';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_hq_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Hq_QA');await page.locator('#password').fill('hq-password-1');await page.locator('#password-confirm').fill('hq-password-1');await page.locator('.auth-submit').click();await ready();
 const cleared=n=>Array.from({length:n},(_,i)=>i+1);
 const seed=async n=>{await players.updateOne({usernameKey:'hq_qa'},{$set:{'player.account.level':30,'player.adventure.cleared':cleared(n),'player.adventure.unlockedStage':n+1,'player.homeQuest':{index:17,count:0}}});await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(13));await scene(13);await page.waitForTimeout(800)};
 const box=async name=>{await settle();const b=await page.locator('#stage').boundingBox();await page.screenshot({path:`${output}/${name}.png`,clip:{x:b.x,y:b.y,width:b.width*.45,height:b.height*.6}})};
 await seed(30);await shot('home');await box('quest-progress');
 let q=await page.evaluate(()=>GameRuntime.player.homeQuest);assert.equal(q.text,'Vượt ải 4-5');assert.equal(q.progress,30);assert.equal(q.target,35);assert.equal(q.done,false);
 await page.evaluate(()=>GameRuntime.handleHit({name:'ClickBox',node:{}}));await scene(34);
 await seed(35);await page.waitForTimeout(800);await box('quest-done');
 const fx=await page.evaluate(()=>{const s=GameView.getScene(),n=GameView.allNodes(s).find(x=>x.name==='EffectCompleted'),c=GameView.get(n.children[0],'SkeletonGraphic');const sk=c.instance;const o=new spine.Vector2(),z=new spine.Vector2();sk.getBounds(o,z,[]);return{active:n.active,child:n.children[0].active,instance:!!c.instance,anim:c.animation,track:c.state?.tracks?.[0]?.animation?.name,time:c.state?.tracks?.[0]?.trackTime,bounds:[o.x,o.y,z.x,z.y],slots:sk.slots.map(x=>[x.data.name,x.color.a,!!x.attachment]),scale:[sk.scaleX,sk.scaleY]}});console.log('fx',JSON.stringify(fx));
 const dust=await page.evaluate(()=>GameRuntime.player.inventory['consumable:3']||0);
 await page.evaluate(()=>GameRuntime.handleHit({name:'ClickBox',node:{}}));await page.waitForSelector('.bonus-popup');await shot('quest-claimed');
 assert.equal(await page.evaluate(()=>GameRuntime.player.inventory['consumable:3']),dust+100);
 q=await page.evaluate(()=>GameRuntime.player.homeQuest);assert.equal(q.text,'Vượt qua tháp 1');
 await page.evaluate(()=>document.querySelector('.bonus-popup')?.remove());await page.waitForTimeout(600);await box('quest-next');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
