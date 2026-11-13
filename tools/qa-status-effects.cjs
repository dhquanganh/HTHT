const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_status_'+crypto.randomBytes(6).toString('hex'),url='http://127.0.0.1:4191',output='qa-output/status';let server,browser,client;
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:'4191',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);server.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve()}});server.once('exit',code=>reject(Error('QA server exited '+code)))});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1564,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action="auth-register"]').click();await page.locator('#username').fill('Status_QA');await page.locator('#password').fill('status-qa-password');await page.locator('#password-confirm').fill('status-qa-password');await page.locator('.auth-submit').click();await page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_status_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 const box=await page.locator('#stage').boundingBox(),at=(x,y)=>[box.x+x*box.width/1136,box.y+y*box.height/640],click=(x,y)=>page.mouse.click(...at(x,y));
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id),now=()=>page.evaluate(()=>GameView.getSceneId()),shot=name=>page.locator('#stage').screenshot({path:`${output}/${name}.png`}),player=fn=>page.evaluate(fn);
 await page.waitForTimeout(400);await page.evaluate(()=>GameRuntime.navigate(37));await scene(37);await page.waitForTimeout(600);await page.evaluate(()=>GameRuntime.navigate(40));await scene(40);await page.waitForTimeout(800);await shot('tower-floor-1');
 assert.deepEqual(await player(()=>GameRuntime.player.tower.floors.map(f=>f.floor)),[1,2,3,4]);
 // Chỉ Luffy ra trận (không có cutscene mở màn của Zoro); dừng trận ngay khi vào để chụp.
 await players.updateOne({usernameKey:'status_qa'},{$set:{'player.formation':{version:2,slots:['luffy-gear-2',null,null,null,null,null],position:0}}});await page.reload();await page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);await page.evaluate(()=>GameRuntime.navigate(40));await scene(40);await page.waitForTimeout(600);
 // Vào trận tháp tầng 1 rồi gắn trạng thái (client) để xem hình: không đổi luật trận.
 await click(568,578);await page.locator('[data-action="team-fight"]').click();await page.waitForFunction(()=>GameView.getSceneId()===9&&document.querySelector('#loading').hidden);
 await page.evaluate(()=>{GameView.paused=true});await page.waitForTimeout(500);
 const put=async list=>{await page.evaluate(list=>{const actors=GameRuntime.battleActors(),turn=GameRuntime.player.battle.turn;for(const a of actors)a.statusEffects=[];list.forEach((fx,i)=>{const a=actors[i%actors.length];a.statusEffects.push(...fx.map(([attribute,value])=>({skillId:'qa-'+attribute,name:attribute,attribute,value,expiresTurn:turn+5})))})},list);await page.waitForTimeout(1600)};
 const kinds=[['stun'],['freeze'],['petrify'],['silence'],['burn'],['poison'],['bleed'],['fear'],['panic'],['seal'],['shield'],['frostbite']];
 assert.ok(await page.evaluate(()=>GameRuntime.battleActors().length)>=6);
 await put(kinds.slice(0,8).map(k=>[[k[0],0]]));await shot('status-1');
 await put(kinds.slice(4).map(k=>[[k[0],0]]));await shot('status-2');
 await put([[['attack',.2],['defense',.2],['speed',.1],['critChance',.1]],[['attack',-.2],['defense',-.2],['speed',-.1]],[['trueDamage',.1],['skillDamage',.1],['damageReduction',.1]],[['critDamage',-.2],['accuracy',-.1],['block',.1]],[['penetration',.2],['controlResist',-.1]],[['controlResist',.2],['stun',0]]]);await shot('status-icons');
 const errorsSeen=errors.filter(e=>!/401/.test(e));assert.deepEqual(errorsSeen,[]);
 console.log(JSON.stringify({checks:['status-spines','buff-icons'],errors:errorsSeen}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
