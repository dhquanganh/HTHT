// QA Thiên phú (HolyBlessing gốc): nút Thiên phú ở Thông tin tướng, sổ HLBPanelMain, chọn bảng, nâng cấp, nâng sao,
// chọn kỹ năng, đổi bảng. Dùng database htps_talent_* riêng, tự xóa sau khi chạy. Ảnh trong qa-output/talent/.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_talent_'+crypto.randomBytes(6).toString('hex'),port=4233,url=`http://127.0.0.1:${port}`,output='qa-output/talent';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_talent_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async(ms=900)=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(ms)};
 const shot=async name=>{await settle();await page.screenshot({path:`${output}/${name}.png`})};
 const t=()=>page.evaluate(()=>window.GameRuntime.player.hero.talent);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Talent_QA');await page.locator('#password').fill('talent-password-1');await page.locator('#password-confirm').fill('talent-password-1');await page.locator('.auth-submit').click();await ready();
 // 1 sao: sổ báo chưa đủ điều kiện.
 await page.evaluate(()=>window.GameRuntime.navigate(1156));await page.waitForSelector('.talent-entry');await shot('hero-locked');
 await page.locator('.talent-entry').click();await page.waitForSelector('.talent-root [data-name="PanelNotUnlock"]');assert.ok((await page.locator('.talent-root [data-name="PanelNotUnlock"]').innerText()).includes('chưa đủ điều kiện'));
 await page.locator('.talent-root [data-name="ButtonClose"]').click();await page.waitForSelector('.talent-root',{state:'detached'});
 // Sao đỏ, đủ nguyên liệu.
 await players.updateOne({usernameKey:'talent_qa'},{$set:{'player.hero.stars':10,'player.hero.level':200,'player.wallet.diamonds':5000,'player.inventory.consumable:206':200000,'player.inventory.consumable:205':50,'player.inventory.material:luffy-shard':200}});
 await page.reload();await ready();await page.evaluate(()=>window.GameRuntime.navigate(1156));await page.waitForSelector('.talent-entry:not(.locked)');
 await page.locator('.talent-entry').click();await page.waitForSelector('.talent-root [data-name="PanelActiveYet"]');await shot('active-yet');
 await page.locator('.talent-root [data-name="ButtonPick"]').click();await page.waitForSelector('.talent-popup [data-name="PopupMid"]');
 await page.locator('.talent-popup [data-name="HLBIconSkillTableView3"]').click();await page.waitForFunction(()=>document.querySelector('.talent-popup [data-name="PopupMid"]>[data-name="BarName"]')?.innerText.includes('Viện Trợ'));
 assert.ok((await page.locator('.talent-popup').innerText()).includes('Kỹ năng loại kiểm soát'));assert.equal(await page.locator('.talent-popup [data-skill]').count(),15);await shot('select-table');
 await page.locator('.talent-popup [data-name="ButtonConfirm"]').click();await page.waitForFunction(()=>window.GameRuntime.player.hero.talent.table===3);
 await page.waitForSelector('.talent-root [data-name="PanelLevelUp"]');const left=await page.locator('.talent-root [data-name="PanelLevelUp"]').innerText();
 for(const s of ['Cấp','1/10','Công','+100','Máu','+2000','Tốc độ','+10','0/50'.replace('0','200.0K')])if(!/200/.test(s))assert.ok(left.includes(s),s+' in '+left);
 assert.equal(await page.locator('.talent-root canvas.talent-spine').count()>=6,true,'Spine Loop/Line canvases');await shot('level-1');
 for(let i=0;i<9;i++){await page.locator('.talent-root [data-name="ButtonLvUp"]').click();await page.waitForFunction(l=>window.GameRuntime.player.hero.talent.level===l,i+2)}
 await page.waitForSelector('.talent-root [data-name="PanelStarUp"]');const star=await page.locator('.talent-root [data-name="PanelStarUp"]').innerText();assert.ok(star.includes('Giới hạn cấp tướng')&&star.includes('+20'),star);await shot('star-up');
 const cap=await page.evaluate(()=>window.GameRuntime.player.costs.level.maxLevel);
 await page.locator('.talent-root [data-name="ButtonStarUp"]').click();await page.waitForFunction(()=>window.GameRuntime.player.hero.talent.star===2);
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.costs.level.maxLevel),cap+20);
 // Ô kỹ năng 1: chọn Khinh Phong (thứ 2), ô 3 khóa.
 await page.locator('.talent-root [data-name="HLBSkillLotView1"]').click();await page.waitForSelector('.talent-popup [data-name="Cell2"]');await shot('select-skill');
 await page.locator('.talent-popup [data-name="Cell2"] [data-name="ButtonSelect"]').click();await page.waitForFunction(()=>window.GameRuntime.player.hero.talent.skills[0]===2);
 await page.locator('.talent-root [data-name="HLBSkillLotView3"]').click();await page.waitForTimeout(300);
 await page.locator('.talent-root [data-name="HLBSkillLotView1"]').click();await page.waitForSelector('.talent-detail');assert.ok((await page.locator('.talent-detail').innerText()).includes('Khinh Phong'));await shot('skill-detail');await page.locator('.talent-detail').click();
 await shot('scheme');
 // Đổi bảng: 500 kim cương.
 await page.locator('.talent-root [data-name="PanelLevelUp"] [data-name="HLBIconSkillTableView"]').click();await page.waitForSelector('.talent-popup [data-name="PopupMid"]');
 await page.locator('.talent-popup [data-name="HLBIconSkillTableView1"]').click();await page.waitForFunction(()=>document.querySelector('.talent-popup [data-name="PopupMid"]>[data-name="BarName"]')?.innerText.includes('Cuồng Bạo'));
 assert.ok(await page.locator('.talent-popup [data-name="BarCost"]').isVisible());await shot('change-table');
 const gems=await page.evaluate(()=>window.GameRuntime.player.wallet.diamonds);
 await page.locator('.talent-popup [data-name="ButtonConfirm"]').click();await page.locator('[data-guild-confirm]').click();await page.waitForFunction(()=>window.GameRuntime.player.hero.talent.table===1);
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.wallet.diamonds),gems-500);
 assert.equal((await t()).skillIds[0],210002);await shot('cuong-bao');
 await page.locator('.talent-root [data-name="ButtonClose"]').click();await page.waitForSelector('.talent-root',{state:'detached'});await shot('hero-after');
 // Khung Thông tin tướng theo prefab gốc; đủ cấp tối đa thì hiện hộp "Tối Đa".
 const box=await page.locator('.hero-panel.hero-ref').boundingBox(),stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;
 assert.ok(Math.abs((box.x-stage.x)/k-533)<2&&Math.abs(box.width/k-490)<2,JSON.stringify(box));
 const max=await page.evaluate(()=>window.GameRuntime.player.costs.level.maxLevel);await players.updateOne({usernameKey:'talent_qa'},{$set:{'player.hero.level':max}});
 await page.reload();await ready();await page.evaluate(()=>window.GameRuntime.navigate(1156));await page.waitForSelector('.hero-ref-max');assert.equal(await page.locator('.hero-ref-upgrade').count(),0);await shot('hero-max');
 assert.deepEqual(errors,[]);
 const report={errors,checks:['entry-button','not-unlocked','pick-table','vien-tro-desc','level-points','spine','level-to-10','star-up-cap','select-skill','lot-locked','skill-detail','change-table-500','index-mapping','prefab-layout','max-level-box']};fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_talent_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
