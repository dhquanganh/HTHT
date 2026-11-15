// QA Đấu Trường Tân Tinh: toà Siêu Tân Tinh trên bản đồ → màn chính (thứ Hai, đăng ký 3 đội) → popup → khởi động lại
// với đồng hồ thứ Ba 10:00 (đánh tự do) → màn khiêu chiến → đánh 1 trận → thứ Bảy (vòng 16, dự đoán).
// Dùng: node tools/qa-nova.cjs (ảnh: qa-output/nova/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_novaqa_'+crypto.randomBytes(6).toString('hex'),port=4227,url=`http://127.0.0.1:${port}`,output='qa-output/nova';let server,browser,client;
const H=3600000,D=24*H,monday=Date.UTC(2026,10,15,17)+60000;
const start=time=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NOVA_QA_TIME:String(time)},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
const restart=async time=>{server.kill();await new Promise(r=>server.once('exit',r));server=await start(time)};
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start(monday+H);client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(500)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const world=async()=>{await page.evaluate(()=>GameRuntime.navigate(37));await page.waitForFunction(()=>GameView.getSceneId()===37&&document.querySelector('#loading').hidden);await page.waitForTimeout(1500)};
 const clickHit=async name=>{const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136;const b=await page.waitForFunction(n=>GameView.hitBox(n),name,{timeout:15000}).then(h=>h.jsonValue());await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k)};
 const ok=async()=>{await page.waitForSelector('.msg-layer [data-guild-confirm]',{timeout:5000});await page.locator('.msg-layer [data-guild-confirm]').last().click();await page.waitForTimeout(900)};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Nova_QA');await page.locator('#password').fill('nova-password-1');await page.locator('#password-confirm').fill('nova-password-1');await page.locator('.auth-submit').click();await ready();
 // Đủ 18 tướng để xếp 3 đội.
 const heroes=await page.evaluate(()=>GameRuntime.catalog?.heroes?.map(d=>d.id)||[]);
 await players.updateOne({usernameKey:'nova_qa'},{$set:{'player.account.level':40}});
 await page.reload();await ready();await world();await shot('01-world-locked');
 await clickHit('B_NovaArena_ImageBuildingHide').catch(()=>clickHit('B_NovaArena'));await page.waitForTimeout(500);assert.equal(await page.locator('.nv-root').count(),0,'khóa dưới cấp 60');
 await players.updateOne({usernameKey:'nova_qa'},{$set:{'player.account.level':80}});
 await page.reload();await ready();await world();await shot('02-world');
 const hit=await page.evaluate(()=>GameView.hitBox('B_NovaArena_ImageBuilding')||GameView.hitBox('B_NovaArena'));console.log('building hit',hit);assert.ok(hit,'toà Tân Tinh trên bản đồ');
 await clickHit(hit?'B_NovaArena_ImageBuilding':'B_NovaArena');await page.waitForSelector('.nv-root');await page.waitForTimeout(1500);await shot('03-root-register');
 // Popup
 for(const [btn,name] of [['ButtonSchedule','04-schedule'],['ButtonReward','05-reward'],['ButtonQuest','06-quest'],['ButtonShop','07-shop']]){
  const b=page.locator(`.nv-root [data-name="${btn}"]`).first();if(!await b.count()){console.log('missing',btn);continue}
  await b.click();await page.waitForSelector('.nv-popup');await page.waitForTimeout(800);await shot(name);
  const close=page.locator('.nv-popup').last().locator('[data-name="ButtonClose"],[data-name="ButtonBack"],[data-name="Close"]').first();if(await close.count())await close.click();else await page.evaluate(()=>document.querySelector('.nv-popup')?.remove());await page.waitForTimeout(300)}
 const buff=page.locator('.nv-root [data-name="BtnInfo"]').first();if(await buff.count()){await buff.click();await page.waitForTimeout(700);await shot('08-buff');await page.evaluate(()=>[...document.querySelectorAll('.nv-popup')].forEach(p=>p.remove()))}
 // Đăng ký: lưu 3 đội qua API (bảng xếp đội dùng chung PopupFormation3 của Chiến trường, đã QA ở qa-arena).
 const doc=await players.findOne({usernameKey:'nova_qa'}),pl=doc.player,{grantSummon}=await import('../server/summon.mjs'),{heroDefinitions,heroKits}=await import('../server/catalog.mjs');
 pl.reserveHeroes??={};for(const d of heroDefinitions.filter(d=>heroKits.has(d.id)).slice(0,8))grantSummon(pl,{avatar:d.avatar});await players.updateOne({_id:doc._id},{$set:{player:pl}});
 await page.reload();await ready();await world();await clickHit('B_NovaArena_ImageBuilding');await page.waitForSelector('.nv-root');await page.waitForTimeout(1000);
 await page.locator('.nv-root [data-name="MainBar"]').first().click();await page.waitForSelector('.arena-hero-pick');await page.waitForTimeout(600);
 for(const [slot,i] of [[null,0],['SlotHero12',1],['SlotHero13',2]]){if(slot){await page.locator(`[data-name="${slot}"]`).last().click();await page.waitForTimeout(300)}await page.locator('.arena-hero-pick:not(.used)').first().click();await page.waitForTimeout(500)}
 await shot('09-formation');await page.locator('.arena-defense [data-name="ButtonAction"]').last().click();await page.waitForTimeout(1500);await shot('09b-registered');
 const reg=await page.evaluate(()=>fetch('/api/nova').then(r=>r.json()));console.log('registered',reg.registered,'power',reg.power);assert.equal(reg.registered,true);
 await page.evaluate(()=>window.NovaUI.close?.());await page.reload();await ready();
 // Thứ Ba 10:00: đánh tự do.
 await restart(monday+D+10*H);await page.reload();await ready();await world();await clickHit('B_NovaArena_ImageBuilding');await page.waitForSelector('.nv-root');await page.waitForTimeout(1500);await shot('10-root-battle');
 const st=await page.evaluate(()=>fetch('/api/nova').then(r=>r.json()));console.log('status',st.status,st.state,'registered',st.registered,'group',st.board?.group);
 if(st.board?.group){await page.locator('.nv-root [data-name="MainBar"]').first().click();await page.waitForTimeout(1500);await shot('11-battle');
  await page.locator('.nv-root [data-name="ButtonAttack"]:visible').first().click();await page.waitForTimeout(2500);await shot('12-after-attack');
  const s2=await page.evaluate(()=>fetch('/api/nova').then(r=>r.json()));assert.equal(s2.board.matches,6);
  const rank=page.locator('.nv-root [data-name="ButtonRank"]').first();if(await rank.count()){await rank.click();await page.waitForTimeout(900);await shot('13-rank');await page.evaluate(()=>[...document.querySelectorAll('.nv-popup')].forEach(p=>p.remove()))}
  const hist=page.locator('.nv-root [data-name="ButtonHistory"]').first();if(await hist.count()){await hist.click();await page.waitForTimeout(900);await shot('14-record');await page.evaluate(()=>[...document.querySelectorAll('.nv-popup')].forEach(p=>p.remove()))}}
 // Thứ Bảy 13:00: vòng 16, đặt cược.
 await restart(monday+5*D+13*H);await page.reload();await ready();await world();await clickHit('B_NovaArena_ImageBuilding');await page.waitForSelector('.nv-root');await page.waitForTimeout(1500);await shot('15-root-final');
 await page.locator('.nv-root [data-name="MainBar"]').first().click();await page.waitForTimeout(1500);await shot('16-bracket');
 const pr=page.locator('.nv-root [data-name="ButtonPredict"]').first();if(await pr.count()){await pr.click();await page.waitForTimeout(1000);await shot('17-predict');
  const pick=page.locator('.nv-popup .nv-pick:visible').first();if(await pick.count()){await pick.click();await page.waitForTimeout(300);await page.locator('.nv-popup [data-match]').first().locator('[data-name="ButtonChange"]').click();await page.waitForTimeout(800);await ok();await shot('18-predicted');const b=await page.evaluate(()=>fetch('/api/nova').then(r=>r.json()));assert.ok(Object.values(b.bracket).flat().some(m=>m.mine),'đã dự đoán')}}
 // Chủ nhật: vinh danh.
 await restart(monday+6*D+2*H);await page.reload();await ready();await world();await clickHit('B_NovaArena_ImageBuilding');await page.waitForSelector('.nv-root');await page.waitForTimeout(2000);await shot('19-top');
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{assert.match(database,/^htps_novaqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
