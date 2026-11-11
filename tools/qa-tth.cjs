// QA Tân Tứ Hoàng: đảo trên bản đồ thế giới, TTHHub (4 đảo), TTHLobby, đánh boss (không chết, VICTORY + sát thương),
// bảng xếp hạng lưu trên MongoDB (2 người chơi), mỗi boss một bảng, quà sát thương / quà hạng / Có thể nhận, mua lượt.
// Database htps_tthqa_* riêng, tự xóa. Ảnh trong qa-output/tth/.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_tthqa_'+crypto.randomBytes(6).toString('hex'),port=4256,url=`http://127.0.0.1:${port}`,output='qa-output/tth';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_tthqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=globalThis.__errors=[];
 const open=async name=>{const ctx=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill(name);await page.locator('#password').fill('tth-password-1');await page.locator('#password-confirm').fill('tth-password-1');await page.locator('.auth-submit').click();
  await page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);return page};
 const settle=async(p,ms=900)=>{await p.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:20000}).catch(()=>{});await p.waitForTimeout(ms)};
 const shot=async(name,p)=>{await settle(p);await p.screenshot({path:`${output}/${name}.png`})};
 const fight=async p=>{await p.locator('.tth-lobby [data-name="ButtonAttack"]').click();await p.locator('[data-action="team-fight"]').click();await p.waitForFunction(()=>window.GameRuntime.player.battle?.tth&&GameView.getSceneId()===9&&document.querySelector('#loading').hidden,null,{timeout:30000});
  await p.waitForTimeout(1200);await p.locator('[data-action="battle-skip"]').click().catch(()=>{});await p.waitForSelector('.battle-end [data-action="tth-back"]',{timeout:90000});await p.waitForTimeout(800)};
 // Người chơi 2 đánh trước để có 2 dòng xếp hạng.
 const other=await open('Tth_Two');await players.updateOne({usernameKey:'tth_two'},{$set:{'player.hero.level':80,'player.hero.stars':5}});await other.reload();await other.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);
 await other.evaluate(()=>window.GameRuntime.navigate(37));await settle(other,1200);await other.evaluate(()=>window.TthUI.open(window.GameRuntime.player.tth.bossIndex));await other.waitForSelector('.tth-lobby');await fight(other);
 const page=await open('Tth_QA');await players.updateOne({usernameKey:'tth_qa'},{$set:{'player.hero.level':160,'player.hero.stars':8,'player.wallet.diamonds':5000}});
 await page.reload();await page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);await page.evaluate(()=>window.GameRuntime.navigate(37));await settle(page,1500);await shot('world',page);
 // Đảo B_TanTuHoang trên bản đồ thế giới (nửa phải): cuộn sang phải rồi bấm chuột thật vào đảo.
 await page.mouse.move(800,450);await page.mouse.wheel(0,3000);await page.waitForTimeout(500);await shot('world-right',page);
 const at=await page.evaluate(()=>{const n=GameView.allNodes(GameView.getScene()).find(x=>x.name==='B_TanTuHoang');return !!n});assert.ok(at,'B_TanTuHoang trong WorldScene');
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;await page.mouse.click(stage.x+550*k,stage.y+450*k);
 await page.waitForSelector('.tth-hub');await settle(page,1500);await shot('hub',page);
 const s=await page.evaluate(()=>window.GameRuntime.player.tth);assert.equal(s.attacksLeft,10);
 assert.equal(await page.locator('.tth-hub [data-name="ButtonFight"]:visible').count(),1);assert.ok(await page.locator('.tth-hub canvas.tth-spine').count()>=4,'chibi Spine 4 boss');
 await page.locator(`.tth-hub [data-name="Island${s.bossIndex+1}"] [data-name="ButtonFight"]`).click();await page.waitForSelector('.tth-lobby');await settle(page,1200);await shot('lobby',page);
 let text=await page.locator('.tth-lobby').innerText();assert.ok(text.includes('XẾP HẠNG SÁT THƯƠNG')&&text.includes(`Ngày ${s.day}`)&&text.includes('Tth_Two')&&text.includes('Lượt đánh miễn phí: 10'),text.slice(0,400));
 await page.locator('.tth-lobby [data-name="ButtonSkill1"]').click();await page.waitForTimeout(300);await shot('skill',page);await page.locator('.tth-lobby [data-name="BoxSkillDesc"]').click();
 await fight(page);await shot('battle-end',page);assert.ok((await page.locator('.battle-end').innerText()).includes('Sát thương cao nhất hôm nay'));
 await page.locator('.battle-end [data-action="tth-back"]').click();await page.waitForSelector('.tth-lobby',{timeout:30000});await settle(page,1200);await shot('lobby-after',page);
 text=await page.locator('.tth-lobby').innerText();assert.ok(text.includes('Lượt đánh miễn phí: 9'));const meRank=await page.locator('.tth-lobby [data-name="Me"] [data-name="TextRank"]').innerText();assert.ok(/^[12]$/.test(meRank.trim()),meRank);
 const rows=await page.evaluate(async()=>(await (await fetch('/api/tth/ranking')).json()).top.map(r=>r.name));assert.deepEqual(rows.sort(),['Tth_QA','Tth_Two']);
 assert.equal(await client.db(database).collection('tth_scores').countDocuments({}),2);
 await page.locator('.tth-lobby [data-name="ButtonDamageReward"]').click();await page.waitForSelector('.tth-popup');await settle(page);await shot('reward-damage',page);
 await page.locator('.tth-popup .tth-item.chest').first().click();await page.waitForTimeout(500);await shot('chest',page);
 assert.ok((await page.locator('.tth-popup').last().innerText()).includes('Có thể nhận'));await page.locator('.tth-popup').last().locator('[data-name="ButtonClose"]').click();
 await page.locator('.tth-popup [data-name="ButtonClose"]').click();
 await page.locator('.tth-lobby [data-name="ButtonRankReward"]').click();await page.waitForSelector('.tth-popup');await settle(page);await shot('reward-rank',page);await page.locator('.tth-popup [data-name="ButtonClose"]').click();
 // Mỗi boss một bảng: boss khác chưa có ai.
 await page.locator('.tth-lobby [data-name="ButtonBack"]').click();const otherIsland=(s.bossIndex+1)%4+1;
 await page.locator(`.tth-hub [data-name="Island${otherIsland}"] [data-name="ButtonIsland"]`).click();await page.waitForSelector('.tth-lobby.tth-view');await settle(page,1000);await shot('lobby-other-boss',page);
 assert.ok((await page.locator('.tth-lobby').innerText()).includes('Chưa có ai khiêu chiến'));await page.locator('.tth-lobby [data-name="ButtonBack"]').click();
 // Mua lượt.
 await page.locator('.tth-hub [data-name="ButtonBuy"]').click();await page.locator('[data-guild-confirm]').click();await page.waitForFunction(()=>window.GameRuntime.player.tth.attacksLeft===10);
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.wallet.diamonds),4950);
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['world','hub-4-islands','spines','fight-only-today','lobby','skill-desc','battle-victory-damage','ranking-db-2-players','me-row','damage-rewards','chest-contents','rank-rewards','per-boss-ranking','buy-attack']};fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_tthqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
