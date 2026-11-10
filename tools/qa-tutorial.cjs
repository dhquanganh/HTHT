// QA hướng dẫn: tài khoản mới sau phần mở đầu đi trọn chuỗi chính (đặt tên, vượt ải 1-1, rương treo máy, nâng tướng,
// trang bị, nhiệm vụ, đánh tiếp) chỉ bằng cách làm theo lời Luffy và bấm đúng chỗ bàn tay chỉ; tải lại giữa chừng vẫn đúng
// bước; sau đó giới thiệu tính năng theo cấp (Chiến hạm ở cấp 20). DB htps_tutqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_tutqa_'+crypto.randomBytes(6).toString('hex'),port=4267,url=`http://127.0.0.1:${port}`,output='qa-output/tutorial';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_tutqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const shot=async name=>{await page.waitForTimeout(500);await page.screenshot({path:`${output}/${name}.png`})};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Tut_QA');await page.locator('#password').fill('tut-password-1');await page.locator('#password-confirm').fill('tut-password-1');await page.locator('.auth-submit').click();
 await page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root'),null,{timeout:40000});
 // Như tài khoản vừa xong phần mở đầu: đã có Luffy, intro done, hướng dẫn ở bước 0.
 await players.updateOne({usernameKey:'tut_qa'},{$set:{'player.intro':'done','player.tutorial':{core:0,tips:[]}}});await page.reload();
 await page.waitForFunction(()=>window.GameRuntime?.player?.tutorial&&!document.querySelector('.login-root'),null,{timeout:40000});
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;
 const state=()=>page.evaluate(()=>({core:GameRuntime.player.tutorial.core,scene:GameView.getSceneId(),guide:!!document.querySelector('.tut-guide'),name:!!document.querySelector('#tut-name'),hand:(()=>{const h=document.querySelector('.tut-hand');return h?{x:parseFloat(h.style.left),y:parseFloat(h.style.top)}:null})(),battle:GameRuntime.player.battle?.status,end:!!document.querySelector('.battle-end-close'),say:document.querySelector('.tut-guide .intro-say')?.textContent||''}));
 const seen=[],shots=new Set();let reloaded=false,guard=0;
 while(guard++<400){
  const s=await state();if(s.core>=13)break;
  if(!seen.includes(s.core)){seen.push(s.core)}
  if(s.guide){if(!shots.has('say-'+s.core)){shots.add('say-'+s.core);await shot(`step-${String(s.core).padStart(2,'0')}-say`)}await page.locator('.tut-guide').click({position:{x:700,y:560}});await page.waitForTimeout(250);continue}
  if(s.name){await shot('step-00-name');await page.locator('#tut-name').fill('Thuyen_Truong');await page.locator('[data-tut-name]').click();await page.waitForTimeout(600);continue}
  if(await page.locator('.bonus-popup').count()){await page.locator('.bonus-popup').click({position:{x:5,y:5}});await page.waitForTimeout(400);continue}
  if(s.end){await page.locator('.battle-end-close').click();await page.waitForTimeout(800);continue}
  if(s.scene===9&&s.battle==='active'&&!s.hand){await page.evaluate(()=>{const b=document.createElement('button');b.dataset.action='battle-skip';b.hidden=true;document.body.appendChild(b);b.click();b.remove()});await page.waitForTimeout(1500);continue}
  if(s.hand){
   if(!shots.has('hand-'+s.core)){shots.add('hand-'+s.core);await shot(`step-${String(s.core).padStart(2,'0')}-hand`)}
   // Tải lại một lần giữa chuỗi: phải quay về đúng bước.
   if(s.core===7&&!reloaded){reloaded=true;await page.reload();await page.waitForFunction(()=>window.GameRuntime?.player?.tutorial&&!document.querySelector('.login-root'),null,{timeout:40000});assert.equal((await state()).core,7);continue}
   await page.mouse.click(stage.x+s.hand.x*k,stage.y+s.hand.y*k);await page.waitForTimeout(900);continue}
  await page.waitForTimeout(400);
 }
 const end=await state();assert.equal(end.core,13,'core finished: '+JSON.stringify({end,seen}));
 const db=(await players.findOne({usernameKey:'tut_qa'})).player;assert.equal(db.tutorial.core,13);assert.equal(db.profile?.displayName||db.displayName,'Thuyen_Truong');
 assert.ok((db.adventure.cleared||[]).length>=1,'cleared 1-1');assert.ok(db.hero.level>=2,'hero levelled');
 // Mẹo tính năng: cấp 20 -> giới thiệu Chiến hạm khi về màn chính.
 await players.updateOne({usernameKey:'tut_qa'},{$set:{'player.account.level':20,'player.tutorial.tips':['checkin','event','mission','achievement','shop','bag','summon','forge','lucky','guild','arena','tower']}});
 await page.reload();await page.waitForFunction(()=>window.GameRuntime?.player&&!document.querySelector('.login-root'),null,{timeout:40000});
 await page.evaluate(()=>GameRuntime.navigate(13));await page.waitForSelector('.tut-guide',{timeout:20000});await page.waitForTimeout(1500);await shot('tip-pet');
 assert.ok((await page.locator('.tut-guide').innerText()).includes('Chiến Hạm'));
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,steps:seen,checks:['set-name','camp1-hand','stage-hand','formation-hand','battle','win','afk','hero-hand','pick','level-up','equip','quest','again','resume-after-reload','tip-pet']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_tutqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
