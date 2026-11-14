// QA Ngọc Vega: nút Hoạt động → GemMain → chế tạo (x10 + nguyên liệu) → túi ngọc → khảm (trang bị nhanh, đủ bộ)
// → Boss ngọc (danh sách, bậc, kỹ năng, debuff Địa Ngục, phần thưởng) → vào trận → kết quả → quay lại đúng boss.
// Dùng: node tools/qa-gem.cjs   (ảnh: qa-output/gem/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_gem_'+crypto.randomBytes(6).toString('hex'),port=4219,url=`http://127.0.0.1:${port}`,output='qa-output/gem';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_gem_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[19]/.test(m.text()))errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(500)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Gem_QA');await page.locator('#password').fill('gem-password-1');await page.locator('#password-confirm').fill('gem-password-1');await page.locator('.auth-submit').click();await ready();
 // Tài khoản cấp 90, 2 tướng SS cấp 260 (Đấu sĩ), nguyên liệu chế tạo và đá / thẻ.
 const {grantSummon}=await import('../server/summon.mjs'),{heroDefinitions}=await import('../server/catalog.mjs');
 const doc=await players.findOne({usernameKey:'gem_qa'}),p=doc.player,ss=heroDefinitions.filter(d=>d.rank===6&&d.class==='warrior').slice(0,2);
 for(const [i,d] of ss.entries()){grantSummon(p,{avatar:d.avatar});p.reserveHeroes[d.id].level=260;p.reserveHeroes[d.id].stars=i?17:5}
 const inv={'consumable:60000':5000,'consumable:2028':500000,'consumable:3':50000,'consumable:60005':10,'consumable:60012':20,'consumable:60101':10,'consumable:60003':5,'consumable:333691':2,'consumable:60116':1};
 Object.assign(p.inventory,inv);p.account.level=90;p.formation={slots:[ss[0].id,ss[1].id,null,null,null,null]};
 await players.updateOne({usernameKey:'gem_qa'},{$set:{player:p}});
 await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(13));await scene(13);await page.waitForTimeout(1500);
 const tap=async action=>{await page.evaluate(a=>{const n=GameView.allNodes(GameView.getScene()).find(x=>x.activityAction===a);GameRuntime.handleHit({name:n.name,node:n})},action);await page.waitForTimeout(600)};
 await tap('toggle');await shot('01-activity');
 await tap('Gem');await page.waitForSelector('.gm-root');await page.waitForTimeout(1200);await shot('02-main');
 const click=async(sel,wait=700)=>{await page.locator(sel).first().click();await page.waitForTimeout(wait)};
 const top=()=>page.evaluate(()=>[...document.querySelectorAll('.gm-popup')].map(e=>e.className.split(' ').find(x=>x.startsWith('gm-')&&x!=='gm-popup')));
 // ---- Chế tạo
 await click('.gm-root [data-name="CardGemSummon"]',1500);await shot('03-summon');
 await click('.gm-summon [data-name="GemSlotMaterial"] [data-name="ButtonSelect"]');await shot('04-material');
 await click('.gm-material [data-pick="60005"]');
 await click('.gm-summon [data-name="GemSlotMaterial1"] [data-name="ButtonSelect"]');await click('.gm-material [data-pick="60012"]');
 await click('.gm-summon [data-name="GemSlotMaterial2"] [data-name="ButtonSelect"]');await click('.gm-material [data-pick="60101"]');await shot('05-materials-set');
 await click('.gm-summon [data-name="BtnSummonx10"]',1500);await shot('06-received');
 const gems=await page.evaluate(()=>GameRuntime.player.gem.gems);assert.equal(gems.length,10);assert.ok(gems.every(g=>g.quality===6&&g.clazz==='warrior'&&g.set===1),'nguyên liệu quyết định ngọc');
 await click('.gm-receive .gm-gem');await shot('07-gem-info');
 await page.evaluate(()=>{document.querySelectorAll('.gm-info,.gm-receive').forEach(e=>e.remove())});
 await click('.gm-summon [data-name="BtnSummonx10"]',1500);await page.evaluate(()=>document.querySelectorAll('.gm-receive').forEach(e=>e.remove()));
 await click('.gm-summon [data-name="Top"] [data-name="ButtonClose"]');
 // ---- Trang bị
 await click('.gm-root [data-name="CardGemEquip"]',1200);await shot('08-equip');
 await click('.gm-equip .gm-hero',1500);await shot('09-equip-hero');
 await click('.gm-equip [data-name="ButtonEquipAll"]',1500);await shot('10-equipped');
 const heroId=await page.evaluate(()=>document.querySelector('.gm-equip .gm-hero.on').dataset.hero);
 const sets=await page.evaluate(()=>GameRuntime.player.gem.sets);assert.equal(sets[heroId],1,'đủ bộ Thạch Anh Cam');
 await click('.gm-equip [data-name="GemSlotUI_0"]');await shot('11-slot-info');await page.evaluate(()=>document.querySelectorAll('.gm-info').forEach(e=>e.remove()));
 await click('.gm-equip [data-name="ButtonBag"]',1200);await shot('12-inventory');
 await click('.gm-inventory [data-filter="quality"][data-value="6"]');await shot('13-inventory-filter');
 await click('.gm-inventory [data-name="Header"] [data-name="ButtonClose"]');await click('.gm-equip [data-name="Header"] [data-name="ButtonClose"]');
 // ---- Boss ngọc (thứ trong tuần thật: mở boss đang mở hôm nay)
 await click('.gm-root [data-name="CardGemBoss"]',1500);await shot('14-boss-list');
 const open=await page.evaluate(()=>GameRuntime.player.gem.boss.find(b=>b.open)?.id);assert.ok(open,'có boss mở hôm nay');
 await click(`.gm-bosslist .gm-card[data-boss="${open}"] [data-name="ImgBoss"]`,2000);await shot('15-boss-main');
 await click('.gm-boss [data-name="BtnSkill_1"]');await shot('16-boss-skill');
 await click('.gm-boss [data-name="Tab6"]');await click('.gm-boss [data-name="ButtonSelectDebuff"]',1000);await shot('17-debuffs');
 for(const id of [1,3,8,14,22]){await click(`.gm-debuffs [data-debuff="${id}"]`,400);await click('.gm-dinfo [data-name="ButtonAction1"]',700)}
 await shot('18-debuffs-picked');assert.equal((await page.evaluate(o=>GameRuntime.player.gem.boss.find(b=>b.id===o).debuffs,open)).length,5);
 await page.evaluate(()=>document.querySelectorAll('.gm-debuffs').forEach(e=>e.remove()));
 await click('.gm-boss [data-name="ButtonReward"]',900);await shot('19-rewards');await page.evaluate(()=>document.querySelectorAll('.gm-reward').forEach(e=>e.remove()));
 await click('.gm-boss [data-name="Tab1"]');await click('.gm-boss [data-name="ButtonBattle"]',1200);await shot('20-team');
 await page.locator('[data-action="team-fight"]').click();
 await page.waitForFunction(()=>window.GameRuntime.player.battle?.gemBoss&&GameView.getSceneId()===9&&document.querySelector('#loading').hidden,null,{timeout:30000});await page.waitForTimeout(3000);await shot('21-battle');
 const battle=await page.evaluate(()=>({boss:GameRuntime.player.battle?.gemBoss,enemy:GameRuntime.player.battle?.enemies?.[0]?.name}));console.log('battle',JSON.stringify(battle));assert.ok(battle.boss,'trận Boss ngọc');
 await page.locator('[data-action="battle-skip"]').click().catch(()=>{});await page.waitForSelector('.battle-end [data-action="gem-back"]',{timeout:120000});await shot('22-result');
 console.log('result',await page.evaluate(()=>({status:GameRuntime.player.battle.status,reward:GameRuntime.player.battle.reward})));
 await page.locator('.battle-end [data-action="gem-back"]').click();await page.waitForSelector('.gm-boss',{timeout:30000});await page.waitForTimeout(2000);await shot('23-back');
 console.log('popups after back',await top());
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{await client.db(database).dropDatabase()}finally{await client.close()}}});
