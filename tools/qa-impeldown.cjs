// QA Vượt Ngục Impel Down: nút Sự kiện → tab Vượt Ngục → lật ô đến khi gặp cửa → xuống tầng 2 → quà trong tầng →
// quà đạt mốc (nhận) → mua chìa. Dùng: node tools/qa-impeldown.cjs (ảnh: qa-output/impeldown/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_impel_'+crypto.randomBytes(6).toString('hex'),port=4223,url=`http://127.0.0.1:${port}`,output='qa-output/impeldown';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[19]/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Impel_QA');await page.locator('#password').fill('impel-password-1');await page.locator('#password-confirm').fill('impel-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'impel_qa'},{$set:{'player.account.level':60,'player.wallet.diamonds':100000,'player.inventory.consumable:600645':200}});
 await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(13));await page.waitForFunction(()=>GameView.getSceneId()===13&&document.querySelector('#loading').hidden);await page.waitForTimeout(1200);
 // Cửa sổ Sự kiện đặc biệt → tab Vượt Ngục
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136,b=await page.evaluate(()=>GameView.hitBox('ButtonEvents'));
 await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k);
 const opened=await page.waitForSelector('[data-action="impel-open"]',{timeout:15000}).then(()=>true).catch(()=>false);
 if(opened){await shot('01-special-tab');await page.locator('[data-action="impel-open"]').first().click()}
 else await page.evaluate(()=>{const x=document.createElement('button');x.dataset.action='impel-open';x.hidden=true;document.body.appendChild(x);x.click()});
 await page.waitForSelector('.im-root');await page.waitForTimeout(1200);await shot('02-floor1');
 const keys=await page.evaluate(()=>GameRuntime.player.impelDown.keys);assert.equal(keys,205,'tặng 5 chìa hôm nay');
 // Lật ô đến khi gặp cửa
 let door=false,n=0;
 while(!door&&n<36){await page.locator(`.im-root [data-name="Tiles"] > [data-index="${n}"] [data-name="NotOpened"]`).click();await page.waitForFunction(i=>GameRuntime.player.impelDown.floors[0].tiles[i]!==null,n);door=await page.evaluate(()=>GameRuntime.player.impelDown.floors[0].tiles.includes(0));n++}
 await page.waitForTimeout(500);await shot('03-opened');assert.ok(door,'gặp cửa');assert.equal(await page.evaluate(()=>GameRuntime.player.impelDown.maxFloor),2);
 await page.locator('.im-root [data-name="Door"]:visible').first().click();await page.waitForTimeout(700);await shot('04-floor2');
 assert.equal(await page.evaluate(()=>GameRuntime.player.impelDown.current),2);
 for(let i=0;await page.evaluate(()=>GameRuntime.player.impelDown.opened)<10;i++){await page.locator(`.im-root [data-name="Tiles"] > [data-index="${i}"] [data-name="NotOpened"]`).click();await page.waitForFunction(i=>GameRuntime.player.impelDown.floors[1].tiles[i]!==null,i)}
 await page.locator('.im-root [data-name="ButtonBonus"]').click();await page.waitForTimeout(600);await shot('05-bonus');
 await page.locator('.im-root [data-name="PopupGiftBonus"] [data-name="ButtonClose"]').click();
 await page.locator('.im-root [data-name="ButtonGift"]').click();await page.waitForTimeout(600);await shot('06-achieve');
 await page.locator('.im-root [data-claim="1"]:visible').click();await page.waitForTimeout(800);await shot('07-claimed');
 assert.equal(await page.evaluate(()=>GameRuntime.player.impelDown.achievements[0].status),2);
 await page.locator('.im-root [data-name="PopupGiftAchieve"] [data-name="ButtonClose"]').click();
 const before=await page.evaluate(()=>GameRuntime.player.impelDown.keys);await page.locator('.im-root .im-buy').click();await page.waitForSelector('[data-name="ButtonAction"]');await page.waitForTimeout(500);await shot('08-buy');await page.locator('[data-name="ButtonAction"]').last().click();await page.waitForTimeout(1200);
 const after=await page.evaluate(()=>GameRuntime.player.impelDown.keys);console.log('keys',keys,'opened',n,'buy',before,'->',after);assert.equal(after-before,10);
 await page.locator('.im-root [data-name="EventBoard"] [data-name="ButtonClose"]').click();await page.waitForTimeout(300);assert.equal(await page.locator('.im-root').count(),0);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{await client.db(database).dropDatabase()}finally{await client.close()}}});
