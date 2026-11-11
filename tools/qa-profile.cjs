// QA thông tin tài khoản gốc: avatar màn chính -> PopupSettings/PopupAccountInfo, đổi ảnh đại diện (tab tướng / đặc biệt),
// đổi tên (lần đầu miễn phí, lần sau 100 KC), lên cấp -> PopupLevelUp có thưởng. DB htps_pfqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_pfqa_'+crypto.randomBytes(6).toString('hex'),port=4273,url=`http://127.0.0.1:${port}`,output='qa-output/profile';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_pfqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root'),null,{timeout:40000});
 const shot=async(name,ms=700)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Profile_QA');await page.locator('#password').fill('profile-password-1');await page.locator('#password-confirm').fill('profile-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'profile_qa'},{$set:{'player.avatars':[1,2]}});await page.reload();await ready();await shot('0-home',1200);await page.evaluate(()=>{document.querySelector('#loading').hidden=false});await shot('0-loading',900);await page.evaluate(()=>{document.querySelector('#loading').hidden=true});
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136,canvasClick=async name=>{const b=await page.evaluate(n=>GameView.hitBox(n),name);await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k)};
 await canvasClick('GroupAvatar');await page.waitForSelector('.pf-info');await shot('1-info');
 let t=await page.locator('.pf-info').innerText();assert.ok(t.includes('Profile_QA')&&t.includes('Đăng xuất')&&t.includes('Đổi tên'),t);
 // Ảnh đại diện: tab tướng -> Zoro
 await page.locator('.pf-info [data-name="PlayerAvatar"]').click();await page.waitForSelector('.pf-avatar-cell');await shot('2-avatar-hero');
 await page.locator('.pf-avatar-cell[data-id="zoro-king-of-hell"]').click();await page.locator('.pf-avatar [data-name="ButtonSave"]').click();
 await page.waitForFunction(()=>GameRuntime.player.avatar?.id==='zoro-king-of-hell');assert.equal(await page.evaluate(()=>GameRuntime.player.hero.id),'luffy-gear-2','main hero unchanged');
 await page.locator('.pf-info [data-name="PlayerAvatar"]').click();await page.locator('.pf-avatar [data-name="AvatarSpecial"]').click();await page.waitForSelector('.pf-avatar-cell[data-kind="special"]');await shot('3-avatar-special');
 assert.ok(await page.locator('.pf-avatar-cell.locked').count()>50);await page.locator('.pf-avatar-cell[data-kind="special"][data-id="2"]').click();await page.locator('.pf-avatar [data-name="ButtonSave"]').click();
 await page.waitForFunction(()=>GameRuntime.player.avatar?.kind==='special');
 // Đổi tên
 await page.locator('.pf-info [data-name="ButtonEditName"]').click();await page.waitForSelector('.pf-name-input');await shot('4-rename-free');
 const gems=await page.evaluate(()=>GameRuntime.player.wallet.diamonds);await page.locator('.pf-name-input').fill('Thuyen_Truong');await page.locator('.pf-rename [data-name="ButtonSaveFree"]').click();
 await page.waitForFunction(()=>GameRuntime.player.displayName==='Thuyen_Truong');assert.equal(await page.evaluate(()=>GameRuntime.player.wallet.diamonds),gems);
 await page.locator('.pf-info [data-name="ButtonEditName"]').click();await page.waitForSelector('.pf-name-input');await shot('5-rename-paid');assert.equal(await page.locator('.pf-rename [data-name="ButtonSave"]:visible').count(),1);
 await page.locator('.pf-rename [data-name="ButtonClose"]').click();await page.locator('.pf-info [data-name="ButtonClose"]').click();await shot('6-home-avatar',900);
 // Lên cấp
 await players.updateOne({usernameKey:'profile_qa'},{$set:{'player.levelUps':[{level:2,rewards:[{itemId:'diamonds',quantity:20}]}]}});await page.reload();await ready();
 await page.waitForSelector('.pf-levelup',{timeout:15000});await shot('7-levelup',1400);assert.ok((await page.locator('.pf-levelup').innerText()).includes('Cấp 2'));
 await page.locator('.pf-levelup [data-name="ButtonClose"]').click();await page.waitForFunction(()=>!GameRuntime.player.levelUps?.length);
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['info-popup','avatar-hero','main-hero-kept','avatar-special-owned','locked-special','rename-free','rename-paid-button','levelup-popup','levelup-ack']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_pfqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
