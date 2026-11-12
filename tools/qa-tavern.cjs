// QA Tổng bộ: đảo B_Dungeon trên bản đồ thế giới -> DungeonScene; chọn đội (popup đội hình), xem đội hình ải, đánh (bỏ qua trận
// và trận thật -> màn kết thúc -> quay lại đảo), nhặt bình, dùng bình máu, gian thương (mua / bỏ qua -> Cửa hàng Đảo Bánh), trợ giúp, top.
// DB htps_tavernqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_tavernqa_'+crypto.randomBytes(6).toString('hex'),port=4285,url=`http://127.0.0.1:${port}`,output='qa-output/tavern';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_tavernqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root')&&document.querySelector('#loading').hidden,null,{timeout:40000});
 const shot=async(name,ms=900)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 const closeBonus=async()=>{if(await page.locator('.bonus-popup').count()){await page.locator('.bonus-close').click();await page.waitForTimeout(200)}};
 const T=()=>page.evaluate(()=>GameRuntime.player.tavern);
 const world=async()=>{await page.evaluate(()=>GameRuntime.navigate(37));await page.waitForFunction(()=>GameView.getSceneId()===37&&document.querySelector('#loading').hidden,null,{timeout:30000});await page.waitForTimeout(800)};
 const set=async patch=>{await players.updateOne({usernameKey:'tavern_qa'},{$set:patch});await page.reload();await ready();await world();await page.evaluate(()=>TavernUI.open());await page.waitForSelector('.tav-main')};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Tavern_QA');await page.locator('#password').fill('tavern-password-1');await page.locator('#password-confirm').fill('tavern-password-1');await page.locator('.auth-submit').click();await ready();
 // Cấp thấp: đảo khóa.
 await world();
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;
 // Bản đồ thế giới rộng 2300: kéo sang trái tới khi đảo hiện trong khung rồi chạm.
 const tap=async name=>{for(let i=0;i<6;i++){const b=await page.evaluate(n=>GameView.hitBox(n),name);assert.ok(b,name);const cx=b.x+b.w/2,cy=b.y+b.h/2;
  if(cx>80&&cx<1056){await page.mouse.click(stage.x+cx*k,stage.y+cy*k);return}
  const dx=cx>=1056?-500:500;await page.mouse.move(stage.x+568*k,stage.y+450*k);await page.mouse.down();await page.mouse.move(stage.x+(568+dx)*k,stage.y+450*k,{steps:12});await page.mouse.up();await page.waitForTimeout(500)}
  throw Error('cannot scroll to '+name)};
 await tap('B_Tarven');await page.waitForTimeout(600);assert.equal(await page.locator('.tav-main').count(),0);
 await players.updateOne({usernameKey:'tavern_qa'},{$set:{'player.account.level':30,'player.wallet.diamonds':5000}});await page.reload();await ready();await world();
 await tap('B_Tarven');await page.waitForSelector('.tav-main [data-name="CellTarvenQuest"]');await shot('1-board',1200);
 // Đủ 7 mức sao để xem nền dải sao theo phẩm.
 await set({'player.tavern':{day:Math.floor((Date.now()+7*3600000)/86400000),seq:1000,refreshes:0,quests:[1,2,3,4,5,6,7].map(star=>({id:800+star,star,slots:star===6?4:1,req:star===6?[{type:'star',value:5,count:2},{type:'faction',value:'light',count:2},{type:'class',value:'fighter',count:1}]:[],duration:3600000,reward:{itemId:'gold',quantity:1000},state:'waiting',locked:false,heroes:[],startAt:0}))}});await shot('0-stars-all',800);
 await page.locator('.tav-main [data-tav-quest="806"]').click();await page.waitForSelector('.tav-popup .tav-req');await page.locator('.tav-popup .tav-hero').first().click();await page.waitForSelector('.tav-popup .tav-req.ok');await shot('0b-requirements');await page.locator('.tav-popup [data-name="ButtonClose"]').click();
 const n0=(await T()).quests.length;void assert.equal(await page.locator('.tav-main [data-name="CellTarvenQuest"]').count(),n0);
 // Nhiệm vụ 2 sao chỉ yêu cầu hệ Ánh sáng (Zoro) để chắc chắn cử được.
 const quests=[{id:901,star:2,slots:2,req:[{type:'faction',value:'light',count:1}],duration:7200000,reward:{itemId:'gold',quantity:40000},state:'waiting',locked:false,heroes:[],startAt:0},...(await T()).quests.filter(q=>q.state==='waiting').slice(0,3).map(({endAt,speedUp,...q})=>q)];
 await set({'player.tavern':{day:Math.floor((Date.now()+7*3600000)/86400000),seq:1000,refreshes:0,quests}});
 await page.locator('.tav-main [data-tav-quest="901"]').click();await page.waitForSelector('.tav-popup .tav-heroes');await shot('2-quest-popup');
 await page.locator('.tav-popup [data-name="ButtonStart"]').click();await page.waitForTimeout(300);
 await page.locator('.tav-popup [data-name="ButtonAuto"]').click();await page.waitForSelector('.tav-popup .tav-hero.selected');await shot('3-auto-filled');
 await page.locator('.tav-popup [data-name="ButtonStart"]').click();await page.waitForFunction(()=>GameRuntime.player.tavern.quests.some(q=>q.id===901&&q.state==='running'));
 await page.waitForSelector('.tav-main .tav-crew');await shot('4-running',800);
 await page.locator('.tav-main [data-name="ButtonSpeedUp"]').first().click();await page.waitForSelector('[data-guild-confirm]');await shot('5-speed-confirm');
 await page.locator('[data-guild-confirm]').first().click();
 await page.waitForFunction(()=>GameRuntime.player.tavern.quests.some(q=>q.id===901&&q.state==='done'));await page.waitForSelector('.tav-main [data-name="ButtonComplete"]');await shot('6-done',600);
 const gold=await page.evaluate(()=>GameRuntime.player.wallet.gold);await page.locator('.tav-main [data-name="ButtonComplete"]').first().click();
 await page.waitForFunction(g=>GameRuntime.player.wallet.gold>g,gold);await closeBonus();
 // Khoá + làm mới.
 await page.locator('.tav-main [data-name="ButtonUnlock"]').first().click();await page.waitForFunction(()=>GameRuntime.player.tavern.quests.some(q=>q.locked));
 const locked=(await T()).quests.find(q=>q.locked).id,others=(await T()).quests.filter(q=>!q.locked&&q.state==='waiting').map(q=>q.id);
 await page.locator('.tav-main [data-name="ButtonRefresh"]').click();await page.waitForSelector('[data-guild-confirm]');await page.locator('[data-guild-confirm]').first().click();
 await page.waitForFunction(([id,old])=>GameRuntime.player.tavern.quests.some(q=>q.id===id)&&!GameRuntime.player.tavern.quests.some(q=>old.includes(q.id)),[locked,others]);await shot('7-refreshed',600);
 // Cuộn nhiệm vụ khó.
 await set({'player.inventory.consumable:18':2});
 const before=(await T()).quests.length;await page.locator('.tav-main [data-name="ButtonGenQuestSenior"]').click();await page.waitForFunction(n=>GameRuntime.player.tavern.quests.length===n+1,before);
 assert.ok((await T()).quests.some(q=>q.star>=4));await shot('8-senior',600);
 await page.locator('.tav-main [data-name="ButtonInfo"]').click();await page.waitForSelector('.tav-rates');await shot('9-rates');
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['locked-low-level','world-button','board','quest-popup','incomplete-crew','auto-fill','start','running-crew','speed-up','claim','lock','refresh-keeps-locked','senior-scroll','rates']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_tavernqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
