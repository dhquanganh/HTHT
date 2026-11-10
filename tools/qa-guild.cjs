// QA Hạm đội: lập đội (PopupCreateGuild), GuildScene, Hội trường + điểm danh, Kỹ năng, Đánh Boss (thẻ + trận + quay lại),
// Nhiệm vụ (cống hiến / top), người thứ hai xin vào và được duyệt. Database htps_guildqa_* riêng, tự xóa. Ảnh trong qa-output/guild/.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_guildqa_'+crypto.randomBytes(6).toString('hex'),port=4253,url=`http://127.0.0.1:${port}`,output='qa-output/guild';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_guildqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=globalThis.__errors=[];
 const open=async name=>{const ctx=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill(name);await page.locator('#password').fill('guild-password-1');await page.locator('#password-confirm').fill('guild-password-1');await page.locator('.auth-submit').click();
  await page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);return page};
 const page=await open('Guild_QA');
 const settle=async(p=page,ms=700)=>{await p.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:20000}).catch(()=>{});await p.waitForTimeout(ms)};
 const shot=async(name,p=page)=>{await settle(p);await p.screenshot({path:`${output}/${name}.png`})};
 const click=(sel,p=page)=>p.locator(sel).first().click();
 // Bấm chuột thật vào ô rồi gõ phím (không dùng fill: fill bỏ qua lỗi ô nhập không nhận chuột).
 const typeInto=async(sel,text,p=page)=>{await p.locator(sel).click();await p.keyboard.press('Control+A');await p.keyboard.press('Backspace');await p.keyboard.type(text);assert.equal(await p.locator(sel).inputValue(),text,sel+' nhận chuột + bàn phím')};
 await players.updateOne({usernameKey:'guild_qa'},{$set:{'player.account.level':65,'player.hero.level':60,'player.hero.stars':5,'player.wallet.diamonds':5000,'player.wallet.gold':50000000,'player.inventory.consumable:6':5000}});
 await page.reload();await page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);await page.evaluate(()=>window.GameRuntime.navigate(37));await settle(page,1200);await shot('world');
 // Đảo Hạm đội -> Tìm đội / Lập đội
 await page.evaluate(()=>window.GuildUI.open());await page.waitForSelector('.guild-create');await typeInto('.guild-create .guild-input','Rom');await shot('find');
 await click('.guild-create [data-name="ButtonTabCreate"]');await page.waitForSelector('#guild-name');await shot('create');
 await typeInto('#guild-name','abc');await click('.guild-create [data-name="ButtonCreate"]');await page.waitForTimeout(500);
 assert.match(await page.evaluate(()=>document.querySelector('#toast')?.innerText||''),/6 đến 20/);
 await click('.guild-create [data-name="ButtonAvatar"]');await page.waitForSelector('.guild-flags');await shot('flags');assert.equal(await page.locator('.guild-flags [data-name="ButtonGuildAvatar"]:visible').count(),31);
 await page.locator('.guild-flags [data-name="ButtonGuildAvatar"]:visible').nth(6).click();await page.waitForFunction(()=>!document.querySelector('.guild-flags'));await page.waitForTimeout(600);await page.waitForSelector('#guild-name');
 await typeInto('#guild-name','Mu Rom Hai Tac');await click('.guild-create [data-name="ButtonCreate"]');await page.waitForSelector('.guild-scene');await shot('scene');
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.wallet.diamonds),4500);
 // Hội trường + điểm danh
 await click('.guild-scene [data-name="ButtonHall"]');await page.waitForSelector('.guild-hall');await shot('hall');
 let hall=await page.locator('.guild-hall').innerText();assert.ok(hall.includes('Mu Rom Hai Tac')&&hall.includes('Thuyền trưởng')&&hall.includes('1/20'),hall.slice(0,300));
 await click('.guild-hall [data-name="ButtonRollCall"]');await page.waitForFunction(()=>window.GameRuntime.player.guild.rollCall);await page.waitForSelector('.bonus-popup');await shot('rollcall-reward');await click('.bonus-popup [data-action="bonus-close"]');await page.waitForSelector('.guild-hall');await page.waitForTimeout(800);await shot('hall-rollcall');
 assert.ok((await page.locator('.guild-hall').innerText()).includes('30/3.000'));
 await click('.guild-hall [data-name="ButtonLogActivity"]');await page.waitForSelector('.guild-log');await shot('log');await click('.guild-log [data-name="ButtonClose"]');
 await click('.guild-hall [data-name="ButtonSetting"]');await page.waitForSelector('#guild-notice');await typeInto('#guild-notice','Cùng nhau ra khơi!');await click('.guild-edit [data-name="ButtonSave"]');await page.waitForSelector('.guild-hall');await page.waitForTimeout(500);
 assert.ok((await page.locator('.guild-hall').innerText()).includes('Cùng nhau ra khơi!'));
 await click('.guild-hall [data-name="BoxMember"] [data-name="ButtonClose"]');await page.waitForFunction(()=>!document.querySelector('.guild-hall'));
 // Kỹ năng
 await click('.guild-scene [data-name="ButtonTech"]');await page.waitForSelector('.guild-tech');await shot('tech');
 const atk=await page.evaluate(()=>window.GameRuntime.player.hero.stats.attack);
 await click('.guild-tech [data-name="ButtonUpgrade"]');await page.waitForFunction(()=>window.GameRuntime.player.guild.tech.warrior.levels[0]===1);await page.waitForSelector('.guild-tech');await shot('tech-up');
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.hero.stats.attack),Math.round(atk*1.01));
 await click('.guild-tech [data-name="ButtonTechSkill2"]');await page.waitForTimeout(400);assert.ok((await page.locator('.guild-tech').innerText()).includes('Yêu cầu kĩ năng trước đạt cấp 10'));
 await click('.guild-tech [data-name="TabMage"]');await page.waitForTimeout(500);await shot('tech-mage');await click('.guild-tech [data-name="ButtonClose"]');
 // Đánh Boss
 await click('.guild-scene [data-name="BuidingBoss"]');await page.waitForSelector('.guild-raid');await settle(page,1500);await shot('raid');
 await page.locator('.guild-raid [data-name="GuildBossUI"]').first().click();await page.waitForSelector('.guild-attack');await settle(page,1200);await shot('attack');
 await click('.guild-attack [data-name="ButtonInfo"]');await page.waitForSelector('.guild-boss-rewards');await shot('boss-rewards');await click('.guild-boss-rewards [data-name="ButtonClose"]');
 await click('.guild-attack [data-name="ButtonAttack"]');await page.locator('[data-action="team-fight"]').click();await page.waitForFunction(()=>window.GameRuntime.player.battle?.guildBoss&&GameView.getSceneId()===9&&document.querySelector('#loading').hidden,null,{timeout:30000});await page.waitForTimeout(1500);await shot('battle');
 await page.locator('[data-action="battle-skip"]').click().catch(()=>{});await page.waitForSelector('.battle-end [data-action="guild-back"]',{timeout:90000});await page.waitForTimeout(1000);await shot('battle-end');
 assert.ok((await page.locator('.battle-end').innerText()).includes('Đánh Boss hạm đội ải 1'));
 await click('.battle-end [data-action="guild-back"]');await page.waitForSelector('.guild-raid',{timeout:30000});await settle(page,1200);await shot('raid-after');
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.guild.bossLeft),2);
 await page.locator('.guild-raid [data-name="GuildBossUI"]').first().click();await page.waitForSelector('.guild-attack');await settle(page,800);await shot('attack-after');
 assert.equal(await page.locator('.guild-attack [data-name="CellGuildBossDmg"]:visible').count(),1);
 assert.ok((await page.locator('.guild-attack').innerText()).includes('Hạng của bạn: 1'));
 // Hạ boss ải 1 (đặt máu còn 1) rồi xem lại bảng xếp hạng ải đã hạ: vẫn lưu trong database.
 await client.db(database).collection('guilds').updateOne({},{$set:{'boss.hp':[1,0,0,0]}});
 await click('.guild-attack [data-name="ButtonAttack"]');await page.locator('[data-action="team-fight"]').click();await page.waitForFunction(()=>window.GameRuntime.player.battle?.guildBoss&&GameView.getSceneId()===9,null,{timeout:30000});
 await page.locator('[data-action="battle-skip"]').click().catch(()=>{});await page.waitForSelector('.battle-end [data-action="guild-back"]',{timeout:90000});await click('.battle-end [data-action="guild-back"]');
 await page.waitForSelector('.guild-raid',{timeout:30000});await settle(page,1200);await shot('raid-killed');
 await page.locator('.guild-raid [data-name="GuildBossUI"]').first().click();await page.waitForSelector('.guild-attack.dead');await settle(page,800);await shot('attack-dead');
 const dead=await page.locator('.guild-attack').innerText();assert.ok(dead.includes('Đã hạ')&&dead.includes('Guild_QA')&&dead.includes('2 lượt'),dead.slice(0,300));
 assert.equal(await page.locator('.guild-attack [data-name="CellGuildBossDmg"]:visible').count(),1);await click('.guild-attack [data-name="ButtonClose"]');
 await page.locator('.guild-raid [data-name="GuildBossUI"]').nth(1).click();await page.waitForSelector('.guild-attack:not(.dead)');await settle(page,800);await shot('attack-stage2');await click('.guild-attack [data-name="ButtonClose"]');
 await click('.guild-raid [data-name="ButtonClose"]');
 // Nhiệm vụ: cống hiến + top
 await click('.guild-scene [data-name="ButtonMill"]');await page.waitForSelector('.guild-mill .guild-donate');await shot('mill');
 await click('.guild-mill [data-donate="0"]');await page.waitForFunction(()=>window.GameRuntime.player.guild.donated===1);await page.waitForSelector('.bonus-popup');await shot('donate-reward');await click('.bonus-popup [data-action="bonus-close"]');await page.waitForFunction(()=>document.querySelectorAll('.guild-mill').length===1&&document.querySelector('.guild-mill .guild-donate'));await page.waitForTimeout(400);
 await click('.guild-mill [data-name="TabTop"]');await page.waitForSelector('.guild-mill .guild-top');await shot('mill-top');await click('.guild-mill [data-name="ButtonClose"]');
 // Người thứ hai xin vào, thuyền trưởng duyệt
 const other=await open('Guild_QA2');await other.evaluate(()=>window.GameRuntime.navigate(37));await settle(other,1000);await other.evaluate(()=>window.GuildUI.open());await other.waitForSelector('.guild-create [data-name="CellGuild"]:visible');await shot('find-list',other);
 await other.locator('.guild-create [data-name="CellGuild"]:visible >> [data-name="ButtonApply"]').first().click();await other.waitForTimeout(800);
 assert.match(await other.evaluate(()=>document.querySelector('#toast')?.innerText||''),/xét duyệt/);
 await page.evaluate(()=>window.GuildUI.open());await page.waitForSelector('.guild-scene');await click('.guild-scene [data-name="ButtonHall"]');await page.waitForSelector('.guild-hall');
 await click('.guild-hall [data-name="ButtonShowActionMenu"]');await click('.guild-hall [data-name="ButtonProcessApplication"]');await page.waitForSelector('.guild-applications');await shot('applications');
 await click('.guild-applications [data-name="ButtonApprove"]');await page.waitForSelector('.guild-applications');await page.waitForTimeout(600);
 await page.locator('.guild-applications [data-name="ButtonClose"]').click();await page.waitForTimeout(300);
 hall=await page.locator('.guild-hall').innerText();assert.ok(hall.includes('2/20')&&hall.includes('Guild_QA2'),hall.slice(0,400));await shot('hall-2');
 await other.evaluate(()=>window.GuildUI.open());await other.waitForSelector('.guild-scene');await shot('member-scene',other);
 const unexpected=errors.filter(e=>!/(401 \(Unauthorized\)|400 \(Bad Request\))/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['world','find','create-name-rule','flags-31','create-500-gems','hall','rollcall-exp','log','edit-notice','tech-upgrade-stat','tech-chain-lock','tech-tabs','raid','attack-popup','boss-rewards','boss-battle','battle-end','return-raid','top-damage','kill-stage','dead-ranking-persisted','next-stage','donate','top','apply','approve','member-joins']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages()){console.error('TOAST',await p.evaluate(()=>document.querySelector('#toast')?.innerText).catch(()=>''));await p.screenshot({path:`${output}/failure-${c===browser.contexts()[0]?'a':'b'}.png`}).catch(()=>{})}process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_guildqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
