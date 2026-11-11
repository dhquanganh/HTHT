// QA Đổ xúc xắc: nút Vòng quay? không — tab xúc xắc trong Sự kiện đặc biệt -> PanelEventDice; nhận xúc xắc ngày, đổ thường,
// xúc xắc may mắn chọn số, ô lá bài -> chọn bài, bảng mốc sao, mua xúc xắc. DB htps_diceqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_diceqa_'+crypto.randomBytes(6).toString('hex'),port=4281,url=`http://127.0.0.1:${port}`,output='qa-output/dice';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_diceqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root'),null,{timeout:40000});
 const shot=async(name,ms=700)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 const closeBonus=async()=>{if(await page.locator('.bonus-popup').count()){await page.locator('.bonus-close').click();await page.waitForTimeout(200)}};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Dice_QA');await page.locator('#password').fill('dice-password-1');await page.locator('#password-confirm').fill('dice-password-1');await page.locator('.auth-submit').click();await ready();
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136,b=await page.evaluate(()=>GameView.hitBox('ButtonEvents'));
 await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k);await page.waitForSelector('[data-action="dice-open"]',{timeout:15000}).catch(async()=>{await page.evaluate(()=>{const x=document.createElement('button');x.dataset.action='dice-open';x.hidden=true;document.body.appendChild(x);x.click()})});
 if(await page.locator('[data-action="dice-open"]:visible').count())await page.locator('[data-action="dice-open"]').first().click();
 await page.waitForSelector('.dice-layer .dice-hero canvas');await shot('1-board',1500);
 await page.locator('.dice-layer [data-name="ButtonFree"]').click();await page.waitForFunction(()=>GameRuntime.player.dice.normal>=5);await closeBonus();
 const before=await page.evaluate(()=>GameRuntime.player.dice.normal);
 await page.locator('.dice-layer [data-name="ButtonRoll1"]').click();await page.waitForTimeout(700);await shot('2-rolling',0);
 await page.waitForFunction(n=>GameRuntime.player.dice.normal!==n||GameRuntime.player.dice.tile>0,before,{timeout:20000});await page.waitForTimeout(3500);await closeBonus();await shot('3-after-roll');
 // Xúc xắc may mắn tới ô lá bài 10.
 await players.updateOne({usernameKey:'dice_qa'},{$set:{'player.dice.lucky':3,'player.dice.tile':4,'player.dice.tarot':false,'player.dice.effect':0}});await page.reload();await ready();
 await page.evaluate(()=>{const x=document.createElement('button');x.dataset.action='dice-open';x.hidden=true;document.body.appendChild(x);x.click()});await page.waitForSelector('.dice-layer .dice-hero');
 await page.locator('.dice-layer [data-name="ButtonRoll2"]').click();await page.waitForSelector('.dice-popup [data-name="ImageDice6"]');await page.locator('.dice-popup [data-name="ImageDice6"]').click();await shot('4-pick-number',300);
 await page.locator('.dice-popup [data-name="ButtonSelect"]').click();await page.waitForSelector('.dice-tarot',{timeout:20000});await shot('5-tarot',600);
 await page.locator('.dice-tarot [data-name="DiceTarotCard2"]').click();await page.waitForSelector('.dice-card-face');await shot('6-tarot-open',600);
 await page.locator('.dice-tarot [data-name="ButtonClose"]').click();await closeBonus();
 await players.updateOne({usernameKey:'dice_qa'},{$set:{'player.dice.stars':60}});await page.reload();await ready();
 await page.evaluate(()=>{const x=document.createElement('button');x.dataset.action='dice-open';x.hidden=true;document.body.appendChild(x);x.click()});await page.waitForSelector('.dice-layer .dice-hero');
 await page.locator('.dice-layer [data-name="ButtonReward"]').click();await page.waitForSelector('.dice-rewards');await shot('7-rewards');
 await page.locator('[data-dice-claim="0"]').click();await page.waitForFunction(()=>GameRuntime.player.dice.milestones[0].claimed);
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['open','free-dice','roll','lucky-pick','tarot','rewards-claim']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_diceqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
