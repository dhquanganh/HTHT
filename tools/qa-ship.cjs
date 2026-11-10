// QA Chiến hạm: nút Chiến hạm ở màn chính -> MonsterScene (3 thẻ, chuyển trang), Kích hoạt bằng Hồn chiến hạm, PopupPet
// 3 tab (lên cấp, kỹ năng, Phế tích khóa), xem trước, chọn chiến hạm ở đội hình, chiến hạm tung chiêu trong trận. DB htps_shipqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_shipqa_'+crypto.randomBytes(6).toString('hex'),port=4265,url=`http://127.0.0.1:${port}`,output='qa-output/ship';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_shipqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root'),null,{timeout:40000});
 const shot=async(name,ms=900)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 const click=async sel=>{await page.locator(sel).first().click()};
 await page.goto(url);await page.waitForSelector('#auth-form');await click('[data-action=auth-register]');await page.locator('#username').fill('Ship_QA');await page.locator('#password').fill('ship-password-1');await page.locator('#password-confirm').fill('ship-password-1');await click('.auth-submit');await ready();
 await players.updateOne({usernameKey:'ship_qa'},{$set:{'player.account.level':25,'player.wallet.gold':5e9,'player.hero.level':60}});
 await page.reload();await ready();
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136,canvasClick=async name=>{const b=await page.evaluate(n=>GameView.hitBox(n),name);assert.ok(b,name);await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k)};
 await canvasClick('ButtonShip');await page.waitForSelector('.ship-hub');await shot('1-hub',1500);
 let t=await page.locator('.ship-hub').innerText();assert.ok(t.includes('Sexy Foxy')&&t.includes('Kích hoạt')&&t.includes('240'),t.slice(0,300));
 const gift=await page.evaluate(()=>GameRuntime.player.inventory['material:ship-soul']);assert.equal(gift,300);
 await click('.ship-hub [data-name="ButtonNext"]');await page.waitForFunction(()=>document.querySelector('.ship-hub')?.innerText.includes('Red Force'));await shot('2-hub-page2',1200);
 await click('.ship-hub [data-name="ButtonPrev"]');await page.waitForFunction(()=>document.querySelector('.ship-hub')?.innerText.includes('Sexy Foxy'));
 await click('.ship-hub [data-name="CellPet1"] [data-name="ButtonPreview"]');await page.waitForSelector('.ship-preview');await shot('3-preview',800);
 assert.ok((await page.locator('.ship-preview').innerText()).includes('Cấp 240'));await click('.ship-preview [data-name="ButtonClose"]');
 await click('.ship-hub [data-name="CellPet1"] [data-name="ButtonActivate"]');await click('[data-guild-confirm]');
 await page.waitForFunction(()=>GameRuntime.player.ships?.list?.[1]);await page.waitForSelector('.ship-hub [data-name="CellPet1"] [data-name="ButtonDetail"]');
 assert.equal(await page.evaluate(()=>GameRuntime.player.inventory['material:ship-soul']),60);
 await players.updateOne({usernameKey:'ship_qa'},{$set:{'player.inventory.material:ship-soul':500000,'player.inventory.material:ship-chaos':500000}});
 await page.evaluate(async()=>{const r=await fetch('/api/auth/session').then(r=>r.json());Object.assign(GameRuntime.player,r.player)});
 await click('.ship-hub [data-name="CellPet1"] [data-name="ButtonDetail"]');await page.waitForSelector('.ship-popup');await shot('4-popup-level',1500);
 t=await page.locator('.ship-popup').innerText();assert.ok(t.includes('1/30')&&t.includes('Death Stares'),t.slice(0,400));
 for(let i=0;i<3;i++){await click('.ship-popup [data-name="ButtonUpLevel"]');await page.waitForFunction(n=>GameRuntime.player.ships.list[1].level===n,i+2)}
 assert.ok((await page.locator('.ship-popup').innerText()).includes('4/30'));
 await click('.ship-popup [data-name="TabSkill"]');await page.waitForFunction(()=>document.querySelector('.ship-popup [data-name="PanelPassiveBuff"]')?.offsetParent);await shot('5-popup-skill',900);
 await click('.ship-popup [data-name="PanelPassiveBuff"] [data-name="ButtonUpgrade"]');await page.waitForFunction(()=>GameRuntime.player.ships.list[1].passives[0]===2);
 await click('.ship-popup [data-name="ButtonPetSkill2"]');await page.waitForFunction(()=>document.querySelector('.ship-popup')?.innerText.includes('phẩm 1'));
 await click('.ship-popup [data-name="TabRuin"]');await page.waitForFunction(()=>document.querySelector('.ship-popup [data-name="PanelRuin"]')?.offsetParent);await shot('6-popup-ruin',900);
 assert.ok((await page.locator('.ship-popup').innerText()).includes('tối đa bảng kỹ năng'));
 await click('.ship-popup [data-name="ButtonClose"]');await page.waitForSelector('.ship-popup',{state:'detached'});await click('.ship-hub [data-name="ButtonBack"]');
 // Trận có chiến hạm (đã tự chọn khi kích hoạt chiếc đầu tiên).
 await page.evaluate(()=>GameRuntime.navigate(34));await page.waitForTimeout(1200);await page.locator('[data-action="campaign-team"]').first().click();await page.waitForSelector('.campaign-formation');await shot('8-formation',600);
 await page.locator('[data-action="campaign-ship"]').click();await page.waitForSelector('.ship-pick-cell');await shot('9-select-ship',1200);
 assert.equal(await page.locator('.ship-pick-cell.owned.picked').count(),1);assert.ok(await page.locator('.ship-pick-cell.locked').count()>=4);
 await page.locator('.ship-select [data-name="ButtonSelect"]').click();await page.waitForSelector('.ship-select',{state:'detached'});await page.locator('.campaign-formation [data-action="close"]').click();
 assert.equal(await page.evaluate(()=>GameRuntime.player.ships.selected),1);
 await page.evaluate(async()=>{await GameRuntime.navigate(34)});await page.waitForTimeout(800);
 const status=await page.evaluate(async()=>{const s=await fetch('/api/auth/session').then(r=>r.json());const r=await fetch('/api/adventure/start',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrfToken,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({stageId:1,formation:[s.player.hero.id,null,null,null,null,null]})});return r.status+' '+(await r.text()).slice(0,200)});
 assert.ok(status.startsWith('200'),status);
 await players.updateOne({usernameKey:'ship_qa'},{$set:{'player.battle.enemies.$[].hp':5e7,'player.battle.enemies.$[].maxHp':5e7}});
 await page.reload();await page.waitForFunction(()=>GameView.getSceneId()===9&&GameRuntime.player?.battle?.ship,null,{timeout:40000}).catch(()=>{});
 const hasShip=await page.evaluate(()=>!!GameRuntime.player?.battle?.ship);
 if(hasShip){await page.waitForTimeout(1500);await page.evaluate(()=>{const b=document.createElement('button');b.dataset.action='battle-resume';b.hidden=true;document.body.appendChild(b);b.click()});await shot('7a-battle-bar',300);await page.waitForSelector('.ship-cinema',{timeout:90000});await shot('7b-battle-cinema',700);await page.waitForTimeout(600);await shot('7c-battle-cinema',0);await page.waitForSelector('.ship-cinema',{state:'detached',timeout:15000});await shot('7d-battle-hit',250)}
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|403 \(Forbidden\)|409 \(Conflict\)|400 \(Bad Request\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,battleWithShip:hasShip,checks:['home-button','hub','pages','preview','activate','popup-level','level-up','skill-tab','passive-up','tier-lock','ruin-lock','selected']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_shipqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
