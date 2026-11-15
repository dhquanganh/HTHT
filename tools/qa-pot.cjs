// QA Đỉnh Thời Gian (Peaks of Time): Sự kiện đặc biệt → tab Đỉnh Thời Gian → chọn ải → đội hình → bản đồ → gạt công tắc
// → đánh quái → chọn thẻ hỗ trợ → mở rương sau khối đá. Dùng: node tools/qa-pot.cjs (ảnh: qa-output/pot/)
// với đồng hồ thứ Ba 10:00 (đánh tự do) → màn khiêu chiến → đánh 1 trận → thứ Bảy (vòng 16, dự đoán).
// Dùng: node tools/qa-nova.cjs (ảnh: qa-output/pot/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_potqa_'+crypto.randomBytes(6).toString('hex'),port=4237,url=`http://127.0.0.1:${port}`,output='qa-output/pot';let server,browser,client;
const H=3600000,D=24*H,monday=Date.UTC(2026,10,15,17)+60000;
const start=time=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NOVA_QA_TIME:String(time)},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
const restart=async time=>{server.kill();await new Promise(r=>server.once('exit',r));server=await start(time)};
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start(Date.now());client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())});page.on('dialog',d=>d.accept());
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(700)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const pot=()=>page.evaluate(()=>GameRuntime.player.pot);
 const home=async()=>{await page.evaluate(()=>GameRuntime.navigate(13));await page.waitForFunction(()=>GameView.getSceneId()===13&&document.querySelector('#loading').hidden);await page.waitForTimeout(1200)};
 // Chạm ô (x, y) trên bản đồ: đổi toạ độ ô → điểm trên màn hình theo transform của .pt-world.
 const tap=async(x,y)=>{const p=await page.evaluate(([x,y])=>{const w=document.querySelector('.pt-world'),r=w.getBoundingClientRect(),k=r.width/w.offsetWidth,m=GameRuntime.player.pot.run.map,d=window.PotUI.data().maps[m];
   const cells=d.layers.flatMap(l=>l.cells),xs=cells.map(c=>c[0]),ys=cells.map(c=>c[1]),left=Math.min(...xs),top=Math.max(...ys);return{x:r.left+((x-left)*64+32)*k,y:r.top+((top-y)*64+32)*k}},[x,y]);
  await page.mouse.click(p.x,p.y);await page.waitForTimeout(400)};
 // Đi tới cạnh ô (x, y): tìm đường bằng passable() của server/pot.mjs trên trạng thái hiện tại, chạm dần từng đoạn 2 ô (ô kế tiếp luôn đã lộ).
 const approach=async(x,y)=>{const {passable}=await import('../server/pot.mjs');
  for(let i=0;i<40;i++){const r=(await pot()).run;if(Math.abs(r.pos.x-x)+Math.abs(r.pos.y-y)<=1)return;
   const prev=new Map([[r.pos.x+','+r.pos.y,null]]),q=[r.pos];let end=null;
   while(q.length&&!end){const c=q.shift();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:c.x+dx,y:c.y+dy},k=n.x+','+n.y;if(prev.has(k)||!passable(r,n.x,n.y))continue;prev.set(k,c.x+','+c.y);if(Math.abs(n.x-x)+Math.abs(n.y-y)<=1){end=k;break}q.push(n)}}
   assert.ok(end,'không có đường tới '+x+','+y);const path=[];let k=end;while(prev.get(k)){path.unshift(k);k=prev.get(k)}
   const rev=new Set(r.revealed),step=path.slice(0,2).filter(k=>rev.has(k)).pop()||path[0];const [tx,ty]=step.split(',').map(Number);await tap(tx,ty);await page.waitForTimeout(900);
   // Ô đi qua có thể là phần trên của vật thể cao 2 ô (bảng thông tin mở ra): đóng lại rồi đi tiếp.
   const info=page.locator('.pt-objinfo [data-name="ButtonClose"]');if(await info.count()){await info.first().click();await page.waitForTimeout(200)}}};
 const act=async()=>{await page.waitForTimeout(400);await page.waitForSelector('.pt-objinfo [data-name="ButtonAction"]',{timeout:5000});await page.locator('.pt-objinfo [data-name="ButtonAction"]').click();await page.waitForTimeout(2500)};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Pot_QA');await page.locator('#password').fill('pot-password-1');await page.locator('#password-confirm').fill('pot-password-1');await page.locator('.auth-submit').click();await ready();
 const doc=await players.findOne({usernameKey:'pot_qa'}),pl=doc.player,{grantSummon}=await import('../server/summon.mjs'),{heroDefinitions,heroKits}=await import('../server/catalog.mjs');
 pl.reserveHeroes??={};for(const d of heroDefinitions.filter(d=>heroKits.has(d.id)&&d.id!=='luffy-gear-2').slice(0,8)){grantSummon(pl,{avatar:d.avatar});const h=pl.reserveHeroes[d.id];if(h){h.level=400;h.stars=14}}
 pl.account.level=80;await players.updateOne({_id:doc._id},{$set:{player:pl}});
 await page.reload();await ready();await home();
 const stage=await page.locator('#stage').boundingBox(),k=stage.width/1136,b=await page.evaluate(()=>GameView.hitBox('ButtonFirstPurchase'));await page.mouse.click(stage.x+(b.x+b.w/2)*k,stage.y+(b.y+b.h/2)*k);
 // Cửa sổ Sự kiện đặc biệt chỉ mở khi có sự kiện; không có thì bấm nút ẩn cùng data-action.
 const opened=await page.waitForSelector('[data-action="pot-open"]',{timeout:15000}).then(()=>true).catch(()=>false);
 if(opened){await shot('01-events-tab');await page.locator('[data-action="pot-open"]').first().click()}
 else{await shot('01-events');await page.evaluate(()=>{const x=document.createElement('button');x.dataset.action='pot-open';x.hidden=true;document.body.appendChild(x);x.click()})}
 await page.waitForSelector('.pt-list');await shot('02-list');
 await page.locator('.pt-info [data-enter]').first().click();await page.waitForSelector('[data-action="team-fight"]',{timeout:10000});await shot('03-team');
 await page.locator('[data-action="team-fight"]').click();await page.waitForSelector('.pt-world');await page.waitForTimeout(2500);await shot('04-map');
 let s=await pot();assert.ok(s.run&&s.run.team.some(Boolean));
 // Công tắc cửa (2,4) → cửa mở.
 // Đi lại gần (công tắc đang trong sương mù), rồi chạm công tắc cửa.
 await approach(2,4);await tap(2,4);await shot('05-objinfo');await act();s=await pot();assert.equal(s.run.objects.find(o=>o.id===4).isOpen,true);await shot('06-door-open');
 // Quái (4,2) → trận.
 await approach(4,2);await tap(4,2);await act();await page.waitForFunction(()=>GameView.getSceneId()===9,null,{timeout:20000});await page.waitForTimeout(2000);await shot('07-battle');
 await page.locator('[data-action="battle-skip"]').click().catch(()=>{});await page.waitForSelector('.battle-end [data-action="pot-back"]',{timeout:120000});await shot('08-result');
 const won=await page.evaluate(()=>GameRuntime.player.battle.status==='won');console.log('monster',won?'won':'lost');
 await page.locator('.battle-end [data-action="pot-back"]').click();await page.waitForSelector('.pt-world',{timeout:30000});await page.waitForTimeout(2000);
 if(won){await page.waitForSelector('.pt-select');await shot('09-select-relic');await page.locator('.pt-select [data-pick]').first().click();await page.locator('.pt-select [data-name="ButtonConfirm"]').click();await page.waitForTimeout(1500);assert.equal((await pot()).run.relics.length,1)}
 await shot('10-after');
 // Bảng thẻ / tướng.
 await page.locator('.pt-hud [data-name="ButtonCardBuff"]').click();await page.waitForSelector('.pt-relics');await shot('11-relics');await page.locator('.pt-relics [data-name="ButtonClose"]').first().click();
 await page.locator('.pt-hud [data-name="ButtonHeroList"]').click();await page.waitForSelector('.pt-heroes');await shot('12-heroes');await page.locator('.pt-heroes [data-name="ButtonClose"]').first().click();
 // Công tắc khối đá (5,-5) → rương (8,-6).
 await approach(5,-5);await tap(5,-5);await act();s=await pot();assert.deepEqual(s.run.objects.find(o=>o.id===6).at,{x:8,y:-2});
 const gold=await page.evaluate(()=>GameRuntime.player.wallet.gold);await approach(8,-6);await tap(8,-6);await act();await shot('13-chest');const bp=page.locator('.bonus-popup');if(await bp.count()){await bp.first().click({position:{x:20,y:20}});await page.waitForTimeout(600)}if(await bp.count())await page.evaluate(()=>document.querySelectorAll('.bonus-popup').forEach(x=>x.remove()));assert.ok(await page.evaluate(()=>GameRuntime.player.wallet.gold)>gold,'rương có thưởng');
 // Zoom + quay lại danh sách.
 await page.locator('.pt-hud [data-name="ButtonZoomOut"]').click();await page.waitForTimeout(500);await shot('14-zoom-out');
 await page.locator('.pt-hud [data-name="ButtonBack"]').click();await page.waitForSelector('.pt-list');await shot('15-list-resume');
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{assert.match(database,/^htps_potqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
