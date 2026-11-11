// QA hiệu ứng đội hình: dòng hiệu ứng ở cửa sổ Đội hình, PopupInformationAuraNew, vòng hệ trong trận đúng trái / phải và
// chỉ số đã cộng khi vào trận. DB htps_auraqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_auraqa_'+crypto.randomBytes(6).toString('hex'),port=4275,url=`http://127.0.0.1:${port}`,output='qa-output/aura';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_auraqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root'),null,{timeout:40000});
 const shot=async(name,ms=700)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Aura_QA');await page.locator('#password').fill('aura-password-1');await page.locator('#password-confirm').fill('aura-password-1');await page.locator('.auth-submit').click();await ready();
 await page.evaluate(()=>GameRuntime.navigate(34));await page.waitForTimeout(1200);await page.locator('[data-action="campaign-team"]').first().click();await page.waitForSelector('.campaign-formation');await shot('1-formation');
 const line=await page.locator('.campaign-aura-line').innerText();assert.ok(/Máu/.test(line)&&/Công/.test(line),line);
 const expected=await page.evaluate(()=>window.AuraUI.of(GameRuntime.player.formation.slots.filter(Boolean).map(id=>GameRuntime.catalog.heroes.find(d=>d.id===id).faction)));
 await page.locator('.campaign-aura-wheel').click();await page.waitForSelector('.aura-popup');await shot('2-aura-popup');
 assert.ok((await page.locator('.aura-popup').innerText()).includes('6 Thuyền viên cùng một hệ'));assert.ok(await page.locator('.aura-rows li.on').count()>=1);
 await page.locator('.aura-popup .aura-close').click();
 await page.locator('.campaign-formation [data-action="battle-start"]').click();await page.waitForFunction(()=>GameView.getSceneId()===9&&GameRuntime.player.battle?.aura&&document.querySelector('#loading').hidden,null,{timeout:30000});
 await shot('3-battle',1500);
 const aura=await page.evaluate(()=>GameRuntime.player.battle.aura.ally);assert.ok(Math.abs(aura.maxHp-expected.maxHp)<1e-9&&Math.abs(aura.attack-expected.attack)<1e-9,JSON.stringify([aura,expected]));
 assert.equal(await page.locator('.battle-aura.ally .frame').getAttribute('src').then(s=>s.includes('48b097902e7796b44a5c15578869ae6c')),true);
 assert.equal(await page.locator('.battle-aura.enemy .frame').getAttribute('src').then(s=>s.includes('7245551fedc354744942b60f135fda04')),true);
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,aura,checks:['formation-aura-line','aura-popup','battle-aura-applied','battle-wheels-left-right']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_auraqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
