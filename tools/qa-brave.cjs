// QA Luyện tập (cũ: Đảo Bánh): đảo B_Dungeon trên bản đồ thế giới -> DungeonScene; chọn đội (popup đội hình), xem đội hình ải, đánh (bỏ qua trận
// và trận thật -> màn kết thúc -> quay lại đảo), nhặt bình, dùng bình máu, gian thương (mua / bỏ qua -> Cửa hàng Đảo Bánh), trợ giúp, top.
// DB htps_braveqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_braveqa_'+crypto.randomBytes(6).toString('hex'),port=4284,url=`http://127.0.0.1:${port}`,output='qa-output/brave';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_braveqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root')&&document.querySelector('#loading').hidden,null,{timeout:40000});
 const shot=async(name,ms=900)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 const closeBonus=async()=>{if(await page.locator('.bonus-popup').count()){await page.locator('.bonus-close').click();await page.waitForTimeout(200)}};
 const B=()=>page.evaluate(()=>GameRuntime.player.brave);
 const world=async()=>{await page.evaluate(()=>GameRuntime.navigate(37));await page.waitForFunction(()=>GameView.getSceneId()===37&&document.querySelector('#loading').hidden,null,{timeout:30000});await page.waitForTimeout(800)};
 const set=async patch=>{await players.updateOne({usernameKey:'brave_qa'},{$set:patch});await page.reload();await ready();await world();await page.evaluate(()=>BraveUI.open());await page.waitForSelector('.brave-main')};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Brave_QA');await page.locator('#password').fill('brave-password-1');await page.locator('#password-confirm').fill('brave-password-1');await page.locator('.auth-submit').click();await ready();
 // Cấp thấp: đảo khóa.
 await world();
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;
 // Bản đồ thế giới rộng 2300: kéo sang trái tới khi đảo hiện trong khung rồi chạm.
 const tap=async name=>{for(let i=0;i<6;i++){const b=await page.evaluate(n=>GameView.hitBox(n),name);assert.ok(b,name);const cx=b.x+b.w/2,cy=b.y+b.h/2;
  if(cx>80&&cx<1056){await page.mouse.click(stage.x+cx*k,stage.y+cy*k);return}
  const dx=cx>=1056?-500:500;await page.mouse.move(stage.x+568*k,stage.y+450*k);await page.mouse.down();await page.mouse.move(stage.x+(568+dx)*k,stage.y+450*k,{steps:12});await page.mouse.up();await page.waitForTimeout(500)}
  throw Error('cannot scroll to '+name)};
 await tap('B_BraveTrial');await page.waitForTimeout(600);assert.equal(await page.locator('.brave-main').count(),0);
 await players.updateOne({usernameKey:'brave_qa'},{$set:{'player.account.level':30,'player.wallet.diamonds':5000}});await page.reload();await ready();await world();
 // Bản đồ 15 ải.
 await tap('B_BraveTrial');await page.waitForSelector('.brave-main .brave-stage');await shot('1-map',1500);
 assert.equal(await page.locator('.brave-main .brave-stage').count(),15);
 await page.locator('.brave-main [data-name="Stage1"]').click();await page.waitForSelector('.brave-popup .brave-rewards');await shot('2-stage-popup');
 await page.locator('.brave-popup [data-name="ButtonBattle"]').click();await page.waitForSelector('[data-action="team-fight"]');await page.locator('[data-action="team-fight"]').click();
 await page.waitForFunction(()=>window.GameRuntime.player.battle?.brave&&GameView.getSceneId()===9&&document.querySelector('#loading').hidden,null,{timeout:30000});await shot('3-battle',1500);
 await page.locator('[data-action="battle-skip"]').click().catch(()=>{});await page.waitForSelector('.battle-end [data-action="brave-back"]',{timeout:90000});await shot('4-battle-end');
 await page.locator('.battle-end [data-action="brave-back"]').click();await page.waitForSelector('.brave-main',{timeout:30000});
 const after=await B();assert.ok(after.stage===2||Object.values(after.hp).some(v=>v<1),'HP kept or stage cleared');
 // Tế đàn sau màn 6: hồi sinh, phước lành; rương mốc.
 await set({'player.brave.stage':7,'player.brave.badges':2,'player.brave.hp':{'luffy-gear-2':0,'zoro-king-of-hell':.4}});await shot('5-map-stage7',1200);
 await page.locator('.brave-main [data-name="ButtonAlstarOfTrial"]').click();await page.waitForSelector('.brave-popup .brave-altar-desc');await shot('6-altar');
 await page.locator('.brave-popup [data-name="Revival"] [data-name="Button"]').click();await page.locator('[data-brave-pick="luffy-gear-2"]').click();await page.waitForFunction(()=>GameRuntime.player.brave.hp['luffy-gear-2']>0);
 await page.waitForSelector('.brave-popup .brave-altar-desc');await page.locator('.brave-popup [data-name="Blessing"] [data-name="Button"]').click();await page.locator('[data-brave-pick="rage"]').click();await page.waitForFunction(()=>GameRuntime.player.brave.blessing.rage===1);
 assert.equal((await B()).badges,0);await page.waitForSelector('.brave-popup .brave-altar-desc');await page.locator('.brave-popup [data-name="ButtonClose"]').first().click();
 await page.waitForTimeout(300);await page.locator('.brave-main [data-name="Rage"]').click();await page.waitForSelector('.brave-popup [data-name="Desc1"]');await shot('7-blessing-info');await page.locator('.brave-popup [data-name="Shade"]').click({position:{x:20,y:20}});
 await page.locator('.brave-main [data-name="ButtonChest"]').click();await page.waitForSelector('.brave-popup .brave-ready');await shot('8-rewards');
 await page.locator('.brave-popup .brave-ready').first().click();await page.waitForFunction(()=>GameRuntime.player.brave.milestones[0].claimed);await closeBonus();
 await page.waitForSelector('.brave-popup [data-name="ButtonClose"]');await page.locator('.brave-popup [data-name="ButtonClose"]').click();
 await page.locator('.brave-main [data-name="ButtonHelp"]').click();await page.waitForTimeout(500);await shot('9-help');
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['locked-low-level','world-button','map-15','stage-popup','pick-team','battle','battle-end-return','hp-kept','altar','revive','blessing','blessing-info','milestone-claim','help']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_braveqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
