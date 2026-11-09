// QA Nâng cấp bảo vật (PopupUpgradeArtifact): popup bảo vật đang mặc có nút nâng (mũi tên xanh), bảng nâng cấp với
// thanh EXP theo db_artifact_upgrade_data, chọn nguyên liệu từ túi, lên sao; lấp lánh Item_effect trên bảo vật đỏ.
// Dùng database htps_artifact_* riêng, tự xóa sau khi chạy. Ảnh trong qa-output/artifact-upgrade/.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_artifact_'+crypto.randomBytes(6).toString('hex'),port=4232,url=`http://127.0.0.1:${port}`,output='qa-output/artifact-upgrade';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
const mode=process.argv[2]||'full';
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_artifact_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845},deviceScaleFactor:1.5}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(600)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Artifact_QA');await page.locator('#password').fill('artifact-password-1');await page.locator('#password-confirm').fill('artifact-password-1');await page.locator('.auth-submit').click();await ready();
 // La Bàn Hải Tặc (đỏ) đang mặc; túi có 6 bảo vật đỏ + vài bảo vật thấp để làm nguyên liệu.
 await players.updateOne({usernameKey:'artifact_qa'},{$set:{'player.hero.equipment.accessory':'artifact:231','player.inventory.artifact:51':1,'player.inventory.artifact:52':1,'player.inventory.artifact:53':1,'player.inventory.artifact:54':1,'player.inventory.artifact:55':2,'player.inventory.artifact:2':3},$unset:{'player.inventory.artifact:1':''}});
 await page.reload();await ready();
 await page.evaluate(()=>window.GameRuntime.navigate(1156));await page.waitForSelector('.hero-side-tabs');await page.locator('[data-action="hero-tab"][data-tab="equipment"]').click();await page.waitForTimeout(300);await shot('equipment');
 await page.locator('.reference-gear[title="Bảo vật"] button').first().click();await page.waitForTimeout(400);await shot('artifact-popup');
 if(mode==='before'){console.log('before screenshots done');return}
 // Popup bảo vật: nút nâng cấp mở PopupUpgradeArtifact.
 await page.locator('[data-action="artifact-upgrade"]').click();await page.waitForSelector('.artifact-upgrade [data-name="BoxUpgrade"]');
 const fill=()=>page.locator('.artifact-upgrade [data-name="TextMatterialFill"]').innerText();
 assert.equal((await fill()).trim(),'0/5400');assert.equal(await page.locator('.artifact-upgrade .artifact-material').count(),6);await shot('upgrade-empty');
 // Chọn 1 bảo vật đỏ (5400 EXP) -> đủ lên 2 sao.
 await page.locator('.artifact-upgrade .artifact-material[data-item="artifact:51"]').click();assert.equal((await fill()).trim(),'5400/5400');
 assert.equal(await page.locator('.artifact-upgrade [data-name^="SlotArtifactMaterial"] [data-name="ItemArtifactUI"]:visible').count(),1);await shot('upgrade-picked');
 // Chạm ô bảo vật -> popup thông tin bật lên (ô sau khi nâng hiện chỉ số 2 sao), chạm để đóng.
 await page.locator('.artifact-upgrade [data-name="ItemArtifactUI2"]').click();const info=page.locator('.artifact-upgrade .aui-info .item-popup');await info.waitFor({state:'visible'});
 assert.equal(await info.evaluate(el=>getComputedStyle(el).animationName),'aui-pop');
 const infoText=await info.innerText();assert.ok(infoText.includes('LA BÀN HẢI TẶC')||infoText.includes('La Bàn Hải Tặc'),infoText);assert.ok(infoText.includes('Tăng 125 Tốc độ, 27% Công'),infoText);
 assert.equal(await info.locator('button').count(),0);assert.equal(await info.locator('.item-popup-title').evaluate(el=>getComputedStyle(el).color),'rgb(255, 210, 42)');await page.waitForTimeout(350);await shot('upgrade-info-popup');
 await page.locator('.artifact-upgrade .aui-info').click();await page.waitForSelector('.artifact-upgrade .aui-info',{state:'detached'});
 await page.locator('.artifact-upgrade [data-name="ItemArtifactUI1"]').click();await info.waitFor({state:'visible'});assert.ok((await info.innerText()).includes('Tăng 120 Tốc độ, 23% Công'));await page.locator('.artifact-upgrade .aui-info').click();await page.waitForSelector('.artifact-upgrade .aui-info',{state:'detached'});
 // Bỏ chọn bằng cách chạm ô nguyên liệu, rồi chọn lại.
 await page.locator('.artifact-upgrade [data-name="SlotArtifactMaterial1"]').click();assert.equal((await fill()).trim(),'0/5400');
 await page.locator('.artifact-upgrade .artifact-material[data-item="artifact:51"]').click();
 await page.locator('.artifact-upgrade [data-name="ButtonUpgrade"]').click();
 await page.waitForFunction(()=>/^artifact:231@2/.test(window.GameRuntime.player.hero.equipment.accessory||''));
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.inventory['artifact:51']||0),0);
 assert.equal((await fill()).trim(),'0/5400');await shot('upgrade-done');
 // Nhiều nguyên liệu: 2 Găng Dao Găm (10800) -> 4 sao; dư EXP giữ lại.
 await page.locator('.artifact-upgrade .artifact-material[data-item="artifact:55"]').click();await page.locator('.artifact-upgrade .artifact-material[data-item="artifact:55"]').click();
 await page.locator('.artifact-upgrade .artifact-material[data-item="artifact:2"]').click();
 await page.locator('.artifact-upgrade [data-name="ButtonUpgrade"]').click();
 await page.waitForFunction(()=>/^artifact:231@4:20$/.test(window.GameRuntime.player.hero.equipment.accessory||''));
 assert.equal((await fill()).trim(),'20/5400');await shot('upgrade-4-stars');
 await page.locator('.artifact-upgrade [data-name="ButtonClose"]').click();await page.waitForSelector('.artifact-upgrade',{state:'detached'});
 await page.waitForTimeout(300);await shot('equipment-after');
 // Tháo ra rồi mặc lại: giữ sao và EXP.
 const key=await page.evaluate(()=>window.GameRuntime.player.hero.equipment.accessory);
 await page.locator('.reference-gear[title="Bảo vật"] button').first().click();await page.waitForTimeout(300);await shot('artifact-popup-4-stars');
 await page.locator('[data-action="unequip"]').click();await page.waitForFunction(k=>window.GameRuntime.player.inventory[k]===1&&!window.GameRuntime.player.hero.equipment.accessory,key);
 await page.evaluate(()=>window.GameRuntime.navigate(12));await page.waitForTimeout(500);await page.locator('[data-action="inventory-tab"][data-tab="artifact"]').click().catch(()=>{});await page.waitForTimeout(400);await shot('bag-artifacts');
 assert.equal(await page.locator(`.ref-item[data-item="${key}"]`).count(),1,'upgraded artifact shows in bag');assert.equal(await page.locator(`.ref-item[data-item="${key}"] .aui-stars img`).count(),4);
 // Trang bị nhanh chọn lại bảo vật 4 sao.
 await page.evaluate(()=>window.GameRuntime.navigate(1156));await page.waitForSelector('.hero-side-tabs');await page.locator('[data-action="hero-tab"][data-tab="equipment"]').click();await page.locator('[data-action="equip-best"]').click();await page.waitForFunction(k=>window.GameRuntime.player.hero.equipment.accessory===k,key);
 assert.deepEqual(errors,[]);
 const report={errors,checks:['popup-upgrade-button','exp-bar-5400','six-material-choices','pick-unpick','info-popup','upgrade-to-2','multi-material-overflow','unequip-keeps-level','bag-variant','quick-equip-variant']};fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_artifact_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
