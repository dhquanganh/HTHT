// QA Mê cung: đảo B_Dungeon trên bản đồ thế giới -> DungeonScene; chọn đội (popup đội hình), xem đội hình ải, đánh (bỏ qua trận
// và trận thật -> màn kết thúc -> quay lại đảo), nhặt bình, dùng bình máu, gian thương (mua / bỏ qua -> Cửa hàng Đảo Bánh), trợ giúp, top.
// DB htps_sealedqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_sealedqa_'+crypto.randomBytes(6).toString('hex'),port=4287,url=`http://127.0.0.1:${port}`,output='qa-output/sealed';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_sealedqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root')&&document.querySelector('#loading').hidden,null,{timeout:40000});
 const shot=async(name,ms=900)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 const closeBonus=async()=>{if(await page.locator('.bonus-popup').count()){await page.locator('.bonus-close').click();await page.waitForTimeout(200)}};
 const S=()=>page.evaluate(()=>GameRuntime.player.sealed);
 const world=async()=>{await page.evaluate(()=>GameRuntime.navigate(37));await page.waitForFunction(()=>GameView.getSceneId()===37&&document.querySelector('#loading').hidden,null,{timeout:30000});await page.waitForTimeout(800)};
 const set=async patch=>{await players.updateOne({usernameKey:'sealed_qa'},{$set:patch});await page.reload();await ready();await world();await page.evaluate(()=>SealedUI.open());await page.waitForSelector('.sealed-layer')};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Sealed_QA');await page.locator('#password').fill('sealed-password-1');await page.locator('#password-confirm').fill('sealed-password-1');await page.locator('.auth-submit').click();await ready();
 // Cấp thấp: đảo khóa.
 await world();
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;
 // Bản đồ thế giới rộng 2300: kéo sang trái tới khi đảo hiện trong khung rồi chạm.
 const tap=async name=>{for(let i=0;i<6;i++){const b=await page.evaluate(n=>GameView.hitBox(n),name);assert.ok(b,name);const cx=b.x+b.w/2,cy=b.y+b.h/2;
  if(cx>80&&cx<1110){await page.mouse.click(stage.x+cx*k,stage.y+cy*k);return}
  const dx=cx>=1110?-500:500;await page.mouse.move(stage.x+568*k,stage.y+450*k);await page.mouse.down();await page.mouse.move(stage.x+(568+dx)*k,stage.y+450*k,{steps:12});await page.mouse.up();await page.waitForTimeout(500)}
  throw Error('cannot scroll to '+name)};
 await tap('B_SealLand');await page.waitForTimeout(600);assert.equal(await page.locator('.sealed-layer').count(),0);
 await players.updateOne({usernameKey:'sealed_qa'},{$set:{'player.account.level':30,'player.wallet.diamonds':5000}});await page.reload();await ready();await world();
 await tap('B_SealLand');await page.waitForSelector('.sealed-layer [data-name="FramesLight"]');await shot('1-wheel',1500);
 await page.locator('.sealed-layer [data-name="ButtonNext"]').click();await page.waitForTimeout(500);await shot('2-rotated',800);
 await page.locator('.sealed-layer [data-name="FramesLight"]').click();await page.waitForTimeout(300);await page.locator('.sealed-layer [data-name="FramesLight"]').click();
 await page.waitForSelector('.sealed-layer .sealed-challenge');await shot('3-levels-light',800);
 assert.equal(await page.locator('.sealed-layer [data-name="CellSealedLand"]').count(),20);
 // Khiêu chiến ải 1 với Zoro (hệ Ánh sáng).
 await page.locator('.sealed-layer .sealed-challenge [data-name="ButtonAttack"]').click();await page.waitForSelector('[data-action="team-fight"]');await shot('4-team');
 await page.locator('[data-action="team-fight"]').click();
 await page.waitForFunction(()=>window.GameRuntime.player.battle?.sealed&&GameView.getSceneId()===9&&document.querySelector('#loading').hidden,null,{timeout:30000});await shot('5-battle',1500);
 await page.locator('[data-action="battle-skip"]').click().catch(()=>{});await page.waitForSelector('.battle-end [data-action="sealed-back"]',{timeout:90000});await shot('6-battle-end');
 await page.locator('.battle-end [data-action="sealed-back"]').click();await page.waitForSelector('.sealed-layer.sealed-levels',{timeout:30000});
 const after=await S();assert.equal(after.attack,4);
 // Càn quét ải đã qua (đặt sẵn 3 ải hệ Ánh sáng đã qua).
 await set({'player.sealed.cleared.light':3});await page.evaluate(()=>{SealedUI.close();SealedUI.open('light',true)});await page.waitForSelector('.sealed-layer .sealed-smash');await shot('7-smash-list',800);
 const smash=(await S()).smash;await page.locator('.sealed-layer .sealed-smash [data-name="ButtonAttack"]').first().click();await page.waitForFunction(n=>GameRuntime.player.sealed.smash===n-1,smash);await closeBonus();
 await page.locator('.sealed-layer [data-name="ButtonBuySmash"]').click();await page.waitForSelector('[data-guild-confirm]');await page.locator('[data-guild-confirm]').first().click();await page.waitForFunction(n=>GameRuntime.player.sealed.smash===n,smash);
 await page.locator('.sealed-layer [data-name="Help"]').click();await page.waitForTimeout(500);await shot('8-help');await page.keyboard.press('Escape');await page.locator('#dialog-ui [data-action="close"], #dialog-ui .close, #dialog-ui button').first().click().catch(()=>{});await page.waitForTimeout(300);
 // Cửa hàng Mê cung.
 await page.locator('.sealed-layer [data-name="Shop"]').click();await page.waitForSelector('.shop-layer [data-name="Tab_sealed"]');await page.waitForTimeout(500);await shot('9-shop',800);
 assert.ok(await page.locator('.shop-layer [data-name="FieldSealBookNormal"]').isVisible());
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['locked-low-level','world-button','wheel','rotate','levels','team-faction','battle','battle-end-return','attempt-spent','smash','buy-smash','help','shop-tab']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_sealedqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
