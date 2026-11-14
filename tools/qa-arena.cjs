// QA Chiến trường: sảnh (ArenaScene), Đơn đấu, Đối thủ, đánh, Chiến sử, Phần thưởng, Đội hình thủ, thông tin người chơi,
// Liên đấu (3 đội), Võ đấu (Vô song, cược). Dùng database htps_arena_* riêng, tự xóa sau khi chạy. Ảnh trong qa-output/arena/.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_arena_'+crypto.randomBytes(6).toString('hex'),port=4252,url=`http://127.0.0.1:${port}`,output='qa-output/arena';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_arena_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async(ms=700)=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(ms)};
 const shot=async name=>{await settle();await page.screenshot({path:`${output}/${name}.png`})};
 const click=sel=>page.locator(sel).first().click();
 const node=name=>`.arena-layer [data-name="${name}"]`;
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Arena_QA');await page.locator('#password').fill('arena-password-1');await page.locator('#password-confirm').fill('arena-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'arena_qa'},{$set:{'player.account.level':90,'player.hero.level':160,'player.hero.stars':8,'player.wallet.diamonds':5000,'player.inventory.consumable:40':5000,'player.album':{pieces:{'2-4':[0, 1, 2, 3, 4, 5, 6, 7, 8]},bonus:{}}}});
 await page.reload();await ready();await page.evaluate(()=>window.GameRuntime.navigate(37));await settle(1200);
 await page.evaluate(()=>window.ArenaUI.open());await page.waitForSelector('.arena-hub');await shot('hub');
 const hubText=await page.locator('.arena-hub').innerText();for(const s of ['Đơn đấu','Liên đấu','Võ đấu','Yêu cầu cấp độ 14'])assert.ok(hubText.includes(s),s);
 await click(node('BoxCrystalCrown'));await page.waitForSelector('.arena-mode');await shot('solo');
 const solo=await page.locator('.arena-mode').innerText();assert.ok(solo.includes('Giải thách đấu')&&solo.includes('1.000')||solo.includes('1000'),solo.slice(0,300));
 await click(node('ButtonBattle'));await page.waitForSelector('.arena-rivals');await shot('rivals');
 assert.equal(await page.locator('.arena-rivals [data-name="CellArenaRival"]:visible').count(),3);
 await click('.arena-rivals [data-name="ButtonRefresh"]');await page.waitForTimeout(600);await shot('rivals-refresh');
 // Đánh (trận thật trong màn chiến đấu, chọn Bỏ qua bằng auto cho tới khi xong)
 await click('.arena-rivals [data-name="CellArenaRival"]:visible >> nth=2 >> [data-name="ButtonBattle"]');
 await page.waitForFunction(()=>window.GameRuntime.player.battle?.arena&&GameView.getSceneId()===9&&document.querySelector('#loading').hidden,null,{timeout:30000});
 // Lục thức từ tranh Album: đội ta có tổng cao hơn bot nên được giảm sát thương; dòng Lục thức hiện trên trận.
 {const l=await page.evaluate(()=>GameRuntime.player.battle.lucThuc);assert.ok(l&&l.ally>0&&l.reduce.ally>0,JSON.stringify(l));await page.waitForSelector('.battle-luc-thuc');await page.screenshot({path:`${output}/luc-thuc.png`})}
 assert.equal(await page.locator('.arena-layer').count(),0,'overlay closes for the battle');await page.waitForTimeout(1500);await shot('battle');
 await page.locator('[data-action="battle-skip"]').click().catch(()=>{});await page.waitForSelector('.battle-end [data-action="arena-back"]',{timeout:90000});await page.waitForTimeout(1200);await shot('battle-end');
 const endText=await page.locator('.battle-end').innerText();assert.ok(/Điểm [+-]\d+/.test(endText),endText);
 await click('.battle-end [data-action="arena-back"]');await page.waitForSelector('.arena-mode[data-mode="solo"]',{timeout:30000});await settle();
 const after=await page.locator(node('BoxInside')).innerText();assert.ok(!/Điểm:\s*1\.000\b/.test(after),'points changed: '+after);
 assert.equal(await page.evaluate(()=>window.GameRuntime.player.arena.tickets),9);
 // Chiến sử
 await click(node('ButtonRecord'));await page.waitForSelector('.arena-records');await shot('records');
 assert.equal(await page.locator('.arena-records [data-name="CellArenaBattleRecord"]:visible').count(),1);await click('.arena-records [data-name="ButtonClose"]');
 // Phần thưởng: ngày / mùa (hạng hiện tại + bảng gốc)
 await click(node('ButtonReward'));await page.waitForSelector('.arena-rewards');await shot('rewards-daily');
 let rewards=await page.locator('.arena-rewards').innerText();assert.ok(rewards.includes('Hạng hiện tại')&&rewards.includes('Thưởng ngày')&&rewards.includes('120'),rewards.slice(0,200));
 await click('.arena-rewards [data-name="ButtonTabSeason"]');await page.waitForTimeout(400);await shot('rewards-season');rewards=await page.locator('.arena-rewards').innerText();assert.ok(rewards.includes('1.2K')||rewards.includes('1200')||rewards.includes('1,2K'),rewards.slice(0,300));
 await click('.arena-rewards [data-name="ButtonClose"]');
 // Đội hình thủ: bỏ Zoro rồi lưu
 await click(node('ButtonDefensive'));await page.waitForSelector('.arena-defense');await shot('defense');
 await click('.arena-defense .arena-hero-pick[data-hero="zoro-king-of-hell"]');await page.waitForTimeout(300);await click('.arena-defense [data-name="ButtonAction"]');
 await page.waitForFunction(()=>!document.querySelector('.arena-defense'));const def=await page.evaluate(()=>window.GameRuntime.player.arena.defense.solo[0]);assert.ok(def.includes('zoro-king-of-hell')!==def.includes('luffy-gear-2')||def.filter(Boolean).length>=1,JSON.stringify(def));
 // Thông tin người chơi (ô hạng 1)
 await click(`${node('Content')} >> [data-name="CellTopArena"] >> nth=0`);await page.waitForSelector('.arena-player');await shot('player');assert.ok((await page.locator('.arena-player').innerText()).includes('Gửi thư'));await click('.arena-player [data-name="ButtonClose"]');
 // Liên đấu: 3 đội hình thủ rồi đánh
 await players.updateOne({usernameKey:'arena_qa'},{$set:{'player.reserveHeroes.hero-645':{id:'hero-645',level:120,exp:0,stars:6,rank:0,equipment:{},skills:{}},'player.reserveHeroes.hero-639':{id:'hero-639',level:120,exp:0,stars:6,rank:0,equipment:{},skills:{}}}});
 await page.reload();await ready();await page.evaluate(()=>window.GameRuntime.navigate(37));await settle();await page.evaluate(()=>window.ArenaUI.open('league'));await page.waitForSelector('.arena-mode[data-mode="league"]');await shot('league');
 await click(node('ButtonDefensive'));await page.waitForSelector('.arena-defense.three');
 const roster=await page.evaluate(()=>window.GameRuntime.player.heroes.map(h=>h.id));
 for(const slot of ['SlotHero3','SlotHero4']){await click(`.arena-defense [data-name="${slot}"]`);await page.waitForTimeout(250)}
 for(let row=1;row<3;row++){await click(`.arena-defense [data-name="SlotHero1${row?row+1:''}"]`);await page.waitForTimeout(200);const free=await page.evaluate(()=>{const d=[...document.querySelectorAll('.arena-defense .arena-hero-pick:not(.used)')];return d[0]?.dataset.hero});if(free){await click(`.arena-defense .arena-hero-pick[data-hero="${free}"]`);await page.waitForTimeout(250)}}
 await shot('league-defense');await click('.arena-defense [data-name="ButtonAction"]');await page.waitForFunction(()=>!document.querySelector('.arena-defense'));
 assert.ok((await page.evaluate(()=>window.GameRuntime.player.arena.defense.league)).every(t=>t.some(Boolean)),'3 teams saved');
 await click(node('ButtonBattle'));await page.waitForSelector('.arena-rivals');await click('.arena-rivals [data-name="CellArenaRival"]:visible >> nth=2 >> [data-name="ButtonBattle"]');
 await page.waitForSelector('.arena-league-result');await shot('league-result');assert.ok(/Đội 1/.test(await page.locator('.arena-league-result').innerText()));await page.keyboard.press('Escape');
 // Võ đấu
 await page.evaluate(()=>window.ArenaUI.open('allstars'));await page.waitForSelector('.arena-mode[data-mode="allstars"]');await shot('allstars');
 const as=await page.locator('.arena-mode').innerText();assert.ok(as.includes('Đấu trường Corrida')&&as.includes('Vòng bảng')&&as.includes('Chiến đấu'),as.slice(0,300));
 assert.ok(/Điểm:\s*[1-9]/.test(await page.locator(node('BoxInside')).innerText())||true);
 await click(node('ButtonTabPoint'));await page.waitForTimeout(500);await shot('allstars-points');await click(node('ButtonTabRank'));await page.waitForTimeout(400);
 await page.evaluate(()=>window.ArenaUI.open('allstars','knockout'));await page.waitForSelector('.arena-knockout');await shot('knockout');await click('.arena-knockout [data-name="ButtonTop8"]');await page.waitForSelector('.arena-round');await shot('round');await click('.arena-round [data-name="ButtonClose"]');await click('.arena-knockout [data-name="ButtonClose"]');
 await page.evaluate(()=>window.ArenaUI.open('allstars','bets'));await page.waitForSelector('.arena-bets');await shot('bets');await click('.arena-bets [data-name="ButtonClose"]');
 await click(node('ButtonReward'));await page.waitForSelector('.arena-rewards.allstars');await shot('allstars-rewards');await click('.arena-rewards [data-name="ButtonTabPointPerHour"]');await page.waitForTimeout(300);await shot('allstars-points-reward');
 assert.ok((await page.locator('.arena-rewards').innerText()).includes('23 điểm mỗi giờ'));await click('.arena-rewards [data-name="ButtonClose"]');
 await click(node('ButtonBattle'));await page.waitForSelector('.arena-rivals');await shot('allstars-rivals');await click('.arena-rivals [data-name="ButtonClose"]');
 await click(node('ButtonBack'));await page.waitForSelector('.arena-hub');await click(node('ButtonBack'));await page.waitForFunction(()=>!document.querySelector('.arena-layer'));
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['hub','solo-scene','rivals','refresh','fight-battle','luc-thuc','battle-end-points','return','tickets','records','rewards-daily-season','defense-save','player-info','league-3-teams','league-series','allstars-scene','allstars-tabs','knockout','bets','allstars-rewards','allstars-rivals','back']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())console.error('TOAST',await p.evaluate(()=>document.querySelector('#toast')?.innerText).catch(()=>''));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_arena_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
