const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_cutscene_'+crypto.randomBytes(6).toString('hex'),url='http://127.0.0.1:4192',output='qa-output/cutscene';let server,browser,client;
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:'4192',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);server.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve()}});server.once('exit',code=>reject(Error('QA server exited '+code)))});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1564,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action="auth-register"]').click();await page.locator('#username').fill('Cutscene_QA');await page.locator('#password').fill('cutscene-qa-password');await page.locator('#password-confirm').fill('cutscene-qa-password');await page.locator('.auth-submit').click();await page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_cutscene_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 const box=await page.locator('#stage').boundingBox(),at=(x,y)=>[box.x+x*box.width/1136,box.y+y*box.height/640],click=(x,y)=>page.mouse.click(...at(x,y));
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id),now=()=>page.evaluate(()=>GameView.getSceneId()),shot=name=>page.locator('#stage').screenshot({path:`${output}/${name}.png`}),player=fn=>page.evaluate(fn);
 await page.waitForTimeout(400);await page.evaluate(()=>GameRuntime.navigate(37));await scene(37);await page.waitForTimeout(600);await page.evaluate(()=>GameRuntime.navigate(40));await scene(40);await page.waitForTimeout(800);await shot('tower-floor-1');
 assert.deepEqual(await player(()=>GameRuntime.player.tower.floors.map(f=>f.floor)),[1,2,3,4]);
 // Akainu (avatar 143, có đoạn phim BeyondCanvas) ra trận một mình, mạnh để sống tới lúc đủ nộ tung chiêu.
 await players.updateOne({usernameKey:'cutscene_qa'},{$set:{'player.reserveHeroes.hero-143':{id:'hero-143',level:120,exp:0,stars:10,rank:5,equipment:{},skills:{}},'player.formation':{version:2,slots:['hero-143',null,null,null,null,null],position:0}}});
 await page.reload();await page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 await page.evaluate(()=>{window.__battleTrace=[]});await page.evaluate(()=>GameRuntime.navigate(40));await scene(40);await page.waitForTimeout(600);
 await click(568,578);await page.locator('[data-action="team-fight"]').click();await page.waitForFunction(()=>GameView.getSceneId()===9&&document.querySelector('#loading').hidden);
 // Chờ chiêu của Akainu: có sự kiện skill với đoạn phim, rồi chụp giữa phim và ngay sau khi nhân vật bắt đầu hoạt ảnh chiêu.
 await page.waitForFunction(()=>window.__battleTrace.some(x=>x.k==='skill-event'&&x.cutEnd>0),null,{timeout:120000});
 await page.waitForTimeout(500);await shot('during-cutscene');
 await page.waitForFunction(()=>window.__battleTrace.some(x=>x.k==='actor-skill'&&x.cutEnd>0),null,{timeout:30000});await page.waitForTimeout(250);await shot('after-cutscene');
 const trace=await page.evaluate(()=>window.__battleTrace);const ev=trace.find(x=>x.k==='skill-event'&&x.cutEnd>0),act=trace.find(x=>x.k==='actor-skill'&&x.cutEnd>0&&x.t>=ev.t);
 console.log('TRACE',JSON.stringify({event:ev,actorSkill:act}));
 assert.ok(act,'actor skill animation starts');assert.ok(act.t-ev.t>=ev.cutEnd-0.05,`skill animation waited for the cutscene (${(act.t-ev.t).toFixed(2)}s vs cut ${ev.cutEnd.toFixed(2)}s)`);
 assert.ok(!trace.some(x=>x.k==='actor-skill'&&x.actor===ev.actor&&x.t>=ev.t&&x.t<ev.t+ev.cutEnd-0.05),'no skill animation during the cutscene');
 const errorsSeen=errors.filter(e=>!/401/.test(e));assert.deepEqual(errorsSeen,[]);
 console.log(JSON.stringify({checks:['cutscene-first','skill-after-cutscene'],errors:errorsSeen}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
