// QA Đảo Bánh: đảo B_Dungeon trên bản đồ thế giới -> DungeonScene; chọn đội (popup đội hình), xem đội hình ải, đánh (bỏ qua trận
// và trận thật -> màn kết thúc -> quay lại đảo), nhặt bình, dùng bình máu, gian thương (mua / bỏ qua -> Cửa hàng Đảo Bánh), trợ giúp, top.
// DB htps_dungeonqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_dungeonqa_'+crypto.randomBytes(6).toString('hex'),port=4283,url=`http://127.0.0.1:${port}`,output='qa-output/dungeon';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_dungeonqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root')&&document.querySelector('#loading').hidden,null,{timeout:40000});
 const shot=async(name,ms=900)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 const closeBonus=async()=>{if(await page.locator('.bonus-popup').count()){await page.locator('.bonus-close').click();await page.waitForTimeout(200)}};
 const D=()=>page.evaluate(()=>GameRuntime.player.dungeon);
 const world=async()=>{await page.evaluate(()=>GameRuntime.navigate(37));await page.waitForFunction(()=>GameView.getSceneId()===37&&document.querySelector('#loading').hidden,null,{timeout:30000});await page.waitForTimeout(800)};
 const set=async patch=>{await players.updateOne({usernameKey:'dungeon_qa'},{$set:patch});await page.reload();await ready();await world();await page.evaluate(()=>DungeonUI.open());await page.waitForSelector('.dungeon-main')};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Dungeon_QA');await page.locator('#password').fill('dungeon-password-1');await page.locator('#password-confirm').fill('dungeon-password-1');await page.locator('.auth-submit').click();await ready();
 // Cấp thấp: đảo khóa.
 await world();
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;
 // Bản đồ thế giới rộng 2300: kéo sang trái tới khi đảo hiện trong khung rồi chạm.
 const tap=async name=>{for(let i=0;i<6;i++){const b=await page.evaluate(n=>GameView.hitBox(n),name);assert.ok(b,name);const cx=b.x+b.w/2,cy=b.y+b.h/2;
  if(cx>80&&cx<1056){await page.mouse.click(stage.x+cx*k,stage.y+cy*k);return}
  const dx=cx>=1056?-500:500;await page.mouse.move(stage.x+568*k,stage.y+450*k);await page.mouse.down();await page.mouse.move(stage.x+(568+dx)*k,stage.y+450*k,{steps:12});await page.mouse.up();await page.waitForTimeout(500)}
  throw Error('cannot scroll to '+name)};
 await tap('B_Dungeon');await page.waitForTimeout(600);assert.equal(await page.locator('.dungeon-main').count(),0);
 await players.updateOne({usernameKey:'dungeon_qa'},{$set:{'player.account.level':30,'player.wallet.diamonds':5000}});await page.reload();await ready();await world();
 const open=(await D()).open;
 if(!open){await tap('B_Dungeon');await page.waitForSelector('.dungeon-main');await shot('closed')}
 else{
  await tap('B_Dungeon');await page.waitForSelector('.dungeon-main');await page.waitForSelector('[data-action="team-fight"]');await shot('1-pick-team');
  await page.locator('[data-action="team-fight"]').click();await page.waitForFunction(()=>GameRuntime.player.dungeon.team.length>0);await page.waitForSelector('.dungeon-main canvas.dungeon-spine');await shot('2-main',1800);
  await page.locator('.dungeon-main [data-name="CanvasHeroStage"] [data-name="ClickArea"]').click();await page.waitForSelector('.dungeon-popup');await shot('3-stage-lineup');await page.locator('.dungeon-popup [data-name="ButtonClose"]').click();
  // Bỏ qua trận đấu.
  await page.locator('.dungeon-main [data-name="ButtonCheckSkip"]').click();await page.waitForTimeout(300);
  await page.locator('.dungeon-main [data-name="ButtonBattle"]').click();await page.waitForFunction(()=>{const d=GameRuntime.player.dungeon;return d.stage>1||d.team.some(t=>t.hp<1)||d.enemies.some(e=>e.hp<1)},null,{timeout:20000});await shot('4-after-skip-fight',800);await closeBonus();
  // Trận thật -> màn kết thúc -> về đảo.
  await page.locator('.dungeon-main [data-name="ButtonCheckSkip"]').click();await page.waitForTimeout(300);
  await set({'player.dungeon.node':null,'player.dungeon.hp':Object.fromEntries((await D()).team.map(t=>[t.id,1]))});
  await page.locator('.dungeon-main [data-name="ButtonBattle"]').click();await page.waitForFunction(()=>window.GameRuntime.player.battle?.dungeon&&GameView.getSceneId()===9&&document.querySelector('#loading').hidden,null,{timeout:30000});await shot('5-battle',1500);
  await page.locator('[data-action="battle-skip"]').click().catch(()=>{});await page.waitForSelector('.battle-end [data-action="dungeon-back"]',{timeout:90000});await shot('6-battle-end');
  await page.locator('.battle-end [data-action="dungeon-back"]').click();await page.waitForSelector('.dungeon-main',{timeout:30000});
  // Bình: nhặt bình máu vừa, dùng cho thuyền viên đang chọn.
  const sel=(await D()).selected;
  await set({'player.dungeon.node':{type:'lotion',kind:'hp',id:2},[`player.dungeon.hp.${sel}`]:.3});await shot('7-lotion');
  await page.locator('.dungeon-main [data-name="DungeonLotion"] [data-name="ClickArea"]').click();await page.waitForFunction(()=>GameRuntime.player.dungeon.lotions[2]===1);
  await page.locator('.dungeon-main [data-name="ButtonLotionHp2"]').click();await page.locator('[data-guild-confirm]').click();await page.waitForFunction(s=>GameRuntime.player.dungeon.team.find(t=>t.id===s).hp>.85,sel);await shot('8-healed');
  // Gian thương.
  const good={reward:{itemId:'consumable:16',quantity:2},price:{itemId:'diamonds',quantity:60}};
  await set({'player.dungeon.node':{type:'merchant',merchant:2,good},'player.dungeon.buffs':{1:4,2:10,3:20}});await shot('9-merchant',1500);
  await page.locator('.dungeon-main [data-name="DungeonMerchantMen"] [data-name="ClickArea"]').click();await page.waitForSelector('.dungeon-popup .dungeon-tile');await shot('10-buy-popup');await page.locator('.dungeon-popup [data-name="ButtonClose"]').click();
  await page.locator('.dungeon-main [data-name="ButtonSkipMerchant"]').click();await page.waitForFunction(()=>GameRuntime.player.dungeon.smashed[2].length===1);
  await page.locator('.dungeon-main [data-name="ButtonSmashedMerchant"]').click();await page.waitForSelector('.dungeon-popup .dungeon-count');await shot('11-smashed-merchants');
  await page.locator('.dungeon-popup [data-name="ImageMerchant2"] [data-name="ButtonEnter"]').click();await page.waitForSelector('.dungeon-cell');await shot('12-smashed-shop');
  const gems=await page.evaluate(()=>GameRuntime.player.wallet.diamonds);await page.locator('.dungeon-cell button').click();await page.waitForFunction(g=>GameRuntime.player.wallet.diamonds===g-60,gems);await closeBonus();
  if(await page.locator('.dungeon-popup [data-name="ButtonClose"]').count())await page.locator('.dungeon-popup [data-name="ButtonClose"]').click();
  await page.locator('.dungeon-main [data-name="ButtonHelp"]').click();await page.waitForSelector('.dungeon-help');await shot('13-help');await page.locator('.dungeon-popup [data-name="Button_Close"]').click();
  await page.locator('.dungeon-main [data-name="ButtonTop"]').click();await page.waitForSelector('.dungeon-ranking');await shot('14-top');
 }
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,open,checks:open?['locked-low-level','world-button','pick-team','main','stage-lineup','skip-fight','real-battle','battle-end-return','lotion-collect','hp-potion','merchant-buy-popup','merchant-skip','smashed-shop-buy','help','top']:['locked-low-level','closed-screen']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_dungeonqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
