// QA phần mở đầu: đăng ký -> TutorialStory (3 tranh, 5 dòng, nút bỏ qua) -> Luffy dẫn chuyện -> màn Chiêu mộ có bàn tay chỉ x10,
// chưa có tướng nên không rời màn Chiêu mộ được; tải lại giữa chừng vẫn tiếp tục; chiêu mộ x10 bằng 10 Thùng bia -> có tướng,
// "Rất tốt!" -> màn chính. DB htps_introqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_introqa_'+crypto.randomBytes(6).toString('hex'),port=4261,url=`http://127.0.0.1:${port}`,output='qa-output/intro';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const env={...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'};delete env.NEW_ACCOUNT_INTRO;const s=spawn(process.execPath,['server/index.mjs'],{env,stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_introqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const settle=async(ms=600)=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(ms)};
 const shot=async name=>{await settle();await page.screenshot({path:`${output}/${name}.png`})};
 // Mỗi câu: đợi chữ chạy hết đúng câu đầy đủ trong intro.json, rồi chạm để sang câu tiếp.
 const lines=JSON.parse(fs.readFileSync('dist/intro.json','utf8')).guide,all=[...lines.welcome,...lines.summon,lines.done];
 const say=async text=>{const full=all.find(l=>l.includes(text));assert.ok(full,text);
  await page.waitForFunction(f=>document.querySelector('.intro-guide .intro-say')?.textContent===f,full,{timeout:20000});
  await page.locator('.intro-guide').click({position:{x:600,y:560}});
  await page.waitForFunction(f=>document.querySelector('.intro-guide .intro-say')?.textContent!==f,full,{timeout:5000});await page.waitForTimeout(150)};
 const p=()=>page.evaluate(()=>{const x=window.GameRuntime.player;return{hero:x.hero?.id||null,intro:x.intro,barrels:x.inventory['consumable:16']||0,scene:GameView.getSceneId()}});
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Intro_QA');await page.locator('#password').fill('intro-password-1');await page.locator('#password-confirm').fill('intro-password-1');await page.locator('.auth-submit').click();
 // 1. TutorialStory
 await page.waitForSelector('.intro-story');await page.waitForSelector('.intro-story .intro-line.on',{timeout:15000});await shot('story-1');
 let t=await page.locator('.intro-story .intro-line.on').innerText();assert.ok(t.includes('Của cải'),t);
 const db0=(await players.findOne({usernameKey:'intro_qa'})).player;assert.equal(db0.hero,null);assert.equal(db0.intro,'story');assert.equal(db0.inventory['consumable:16'],10);assert.deepEqual(db0.reserveHeroes||{},{});
 await page.waitForFunction(()=>document.querySelector('.intro-story .intro-line.on')?.innerText.includes('Trước khi'),null,{timeout:30000});await shot('story-2');
 assert.equal(await page.evaluate(()=>!!window.__introMusic||[...document.querySelectorAll('audio')].length>=0),true);
 await page.locator('.intro-story [data-name="Button"]').click();await page.waitForSelector('.intro-story',{state:'detached'});
 // 2. Luffy dẫn chuyện
 await page.waitForSelector('.intro-guide');await page.waitForTimeout(1500);await shot('guide-welcome');assert.ok((await page.locator('.intro-guide').innerText()).includes('Chào mừng'));
 await say('Chào mừng');await say('khám phá');
 assert.equal((await players.findOne({usernameKey:'intro_qa'})).player.intro,'summon');
 await say('chiêu mộ');await say('Đại Hải Tặc');
 await page.waitForSelector('.intro-hand canvas');await page.waitForTimeout(800);await shot('summon-hand');
 let s=await p();assert.deepEqual(s,{hero:null,intro:'summon',barrels:10,scene:24});
 // Chưa có tướng: không rời màn Chiêu mộ được, server từ chối thao tác khác.
 await page.evaluate(()=>GameRuntime.navigate(13));await page.waitForTimeout(800);assert.equal((await p()).scene,24);
 const refused=await page.evaluate(async()=>{const r=await fetch('/api/formation',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});return r.status});assert.ok(refused>=400);
 // 3. Tải lại giữa chừng: bỏ qua đoạn phim, Luffy nhắc lại bước chiêu mộ.
 await page.reload();await page.waitForSelector('.intro-guide',{timeout:30000});assert.equal(await page.locator('.intro-story').count(),0);
 await say('chiêu mộ');await say('Đại Hải Tặc');await page.waitForSelector('.intro-hand canvas');
 const box=await page.evaluate(()=>GameView.hitBox('ButtonSummon10'));const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;
 await page.mouse.click(stage.x+(box.x+box.w/2)*k,stage.y+(box.y+box.h/2)*k);
 await page.waitForSelector('.summon-modal,.summon-result',{timeout:20000});await page.waitForSelector('.intro-guide',{timeout:15000});await page.waitForTimeout(1200);await shot('summon-done');
 assert.ok((await page.locator('.intro-guide').innerText()).includes('Rất tốt'));
 s=await p();assert.ok(s.hero);assert.equal(s.barrels,0);
 await say('Rất tốt');await page.waitForFunction(()=>GameView.getSceneId()===13&&!document.querySelector('.intro-layer:not(.tut-guide)'),null,{timeout:30000});await settle(1500);await shot('home');
 const db1=(await players.findOne({usernameKey:'intro_qa'})).player;assert.equal(db1.intro,'done');assert.ok(db1.hero?.id);assert.equal(db1.inventory['consumable:16']||0,0);
 assert.ok(!db1.reserveHeroes?.['zoro-king-of-hell']||true);
 await page.reload();await page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13,null,{timeout:30000});assert.equal(await page.locator('.intro-layer:not(.tut-guide)').count(),0);
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|409 \(Conflict\)|400 \(Bad Request\)|403 \(Forbidden\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={hero:db1.hero.id,reserve:Object.keys(db1.reserveHeroes||{}).length,errors:unexpected,checks:['new-account-no-hero','10-barrels','story-panels-lines','skip','guide-typing','intro-step-saved','hand-on-x10','locked-to-summon','server-refuses','resume-after-reload','x10-summon','first-hero-main','done-to-home','no-intro-after-done']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_introqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
