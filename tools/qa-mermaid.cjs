const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_mermaid_'+crypto.randomBytes(6).toString('hex'),port=4210,url=`http://127.0.0.1:${port}`,output='qa-output/mermaid';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_mermaid_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Mermaid_QA');await page.locator('#password').fill('mermaid-password-1');await page.locator('#password-confirm').fill('mermaid-password-1');await page.locator('.auth-submit').click();await ready();
 await players.updateOne({usernameKey:'mermaid_qa'},{$set:{'player.account.level':90,'player.inventory.consumable:100045':400,'player.wallet.diamonds':5000}});await page.reload();await ready();
 // World map: B_PlaceHolder3 is now MermaidIsland
 await page.evaluate(()=>GameRuntime.navigate(37));await scene(37);await page.waitForTimeout(600);{const b=await page.locator('#stage').boundingBox();await page.mouse.move(b.x+b.width*.7,b.y+b.height/2);await page.mouse.wheel(0,3000)}await page.waitForTimeout(400);await shot('world');
 await page.evaluate(()=>GameRuntime.navigate(1700));await scene(1700);await page.waitForSelector('.mm-tags .mm-tag',{state:'attached'});await page.waitForTimeout(1500);await shot('island');
 {const b0=await page.locator('#stage').boundingBox(),at0=(x,y)=>[b0.x+x*b0.width/1136,b0.y+y*b0.height/640];
  await page.mouse.click(...at0(640,540));await page.waitForTimeout(250);await shot('island-tap');await page.waitForTimeout(2600);await shot('island-walked');
  const before=await page.evaluate(()=>1);await page.mouse.click(...at0(300,540));await page.waitForTimeout(4500);await shot('island-left');
  assert.equal(await page.locator('.mm-tags .mm-tag').count(),4);}
 const box=await page.locator('#stage').boundingBox(),at=(x,y)=>[box.x+x*box.width/1136,box.y+y*box.height/640];
 // ButtonSach (Album) and ButtonNui (Vực thẳm) sit bottom-right
 await page.mouse.click(...at(1136-117,640-47));await page.waitForSelector('.album-screen');await shot('album-main');
 await page.locator('[data-action=mm-album-grid]').click();await page.waitForSelector('.album-roll');await shot('album-grid-empty');
 await page.locator('[data-action=mm-album-roll]').click();await page.waitForSelector('.album-reveal',{state:'attached'});await page.waitForTimeout(350);await page.evaluate(()=>document.querySelectorAll('.bonus-popup').forEach(x=>x.remove()));for(const t of [0,300,600,900])await page.waitForTimeout(t?300:0).then(()=>page.locator('#stage').screenshot({path:`${output}/album-reveal-${t}.png`}));await page.waitForTimeout(2500);assert.match(await page.locator('.album-step').innerText(),/1\/4/,'grid shows the new piece count');assert.equal(await page.locator('.album-grid span.open').count(),1);
 for(let i=1;i<2;i++){await page.locator('[data-action=mm-album-roll]').click();await page.waitForFunction(n=>GameRuntime.player.albumState.pictures[0].pieces.length===n,i+1);await page.waitForTimeout(150);await page.evaluate(()=>document.querySelectorAll('.bonus-popup').forEach(x=>x.remove()))}
 await shot('album-grid-half');
 for(let i=2;i<4;i++){await page.locator('[data-action=mm-album-roll]').click();await page.waitForFunction(n=>GameRuntime.player.albumState.pictures[0].pieces.length===n,i+1);await page.waitForTimeout(150);await page.evaluate(()=>document.querySelectorAll('.bonus-popup').forEach(x=>x.remove()))}
 assert.equal(await page.evaluate(()=>GameRuntime.player.albumState.totals[0][1]),64000);
 await page.locator('[data-action=mm-album-main]').click();await page.locator('[data-action=mm-album-points]').click();await page.waitForSelector('.album-points-body');assert.match(await page.locator('.album-points-body').innerText(),/Máu\s*64000/);await shot('album-points');
 await page.locator('.album-points-body [data-action=mm-popup-close]').click();await page.locator('[data-action=mm-album-step][data-step="1"]').click();await page.waitForSelector('.album-screen');await shot('album-2');
 await page.locator('[data-action=mm-album-overview]').click();await page.waitForSelector('.album-ov');await shot('album-overview');
 await page.locator('.album-ov [data-action=mm-popup-close]').click();await page.locator('.album-back').click();await page.waitForSelector('.mm-screen',{state:'detached'});
 // Vực thẳm
 await page.mouse.click(...at(1136-244,640-47));await page.waitForSelector('.abyss-screen');await shot('abyss-map');
 await page.locator('[data-action=mm-abyss-stage][data-stage="2"]').click();await page.waitForSelector('#toast:not([hidden])');
 await page.locator('[data-action=mm-abyss-stage][data-stage="1"]').click();await page.waitForSelector('.abyss-body');assert.match(await page.locator('.abyss-body').innerText(),/Thắng với ít nhất 2 tướng hệ Sinh Khí/);assert.match(await page.locator('.abyss-field').first().innerText(),/318/);assert.equal(await page.locator('.abyss-head img.abyss-face[alt=Killer]').count(),1);await shot('abyss-enemy');await page.locator('[data-action=mm-abyss-attack]').click();await page.locator('[data-action="team-fight"]').click();await scene(9);await page.waitForTimeout(2500);await shot('abyss-battle');await page.locator('[data-action=battle-leave]').click().catch(()=>{});await page.evaluate(()=>GameRuntime.navigate(1700));await scene(1700);await page.mouse.click(...at(1136-244,640-47));await page.waitForSelector('.abyss-screen');await page.locator('[data-action=mm-abyss-stage][data-stage="1"]').click();await page.waitForSelector('.abyss-body');
 await page.locator('[data-action=mm-abyss-buy-open]').click();await page.waitForSelector('.abyss-buy-body');await shot('abyss-buy');
 await page.locator('[data-action=mm-abyss-buy]').click();await page.waitForFunction(()=>GameRuntime.player.abyss.stages[0].turns===3);
 await page.locator('[data-action=mm-abyss-attack]').click();await page.locator('[data-action="team-fight"]').click();await scene(9);
 await page.evaluate(()=>{const b=GameRuntime.player.battle;return b.abyss.stage}).then(s=>assert.equal(s,1));
 await page.locator('[data-action=battle-leave]').click().catch(()=>{});await page.waitForFunction(()=>GameView.getSceneId()===1700,null,{timeout:15000}).catch(()=>{});
 await page.evaluate(()=>GameRuntime.navigate(1700));await scene(1700);await page.mouse.click(...at(1136-244,640-47));await page.waitForSelector('.abyss-screen');
 await page.locator('[data-action=mm-abyss-gift]').click();await page.waitForSelector('.abyss-gift-body');await shot('abyss-gift');
 await page.locator('.abyss-gift-body [data-action=mm-popup-close]').click();
 await players.updateOne({usernameKey:'mermaid_qa'},{$set:{'player.abyss.stages.0.quests':[2,1,0]}});await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(1700));await scene(1700);await page.mouse.click(...at(1136-244,640-47));await page.waitForSelector('.abyss-screen');
 await page.locator('[data-action=mm-abyss-stage][data-stage="1"]').click();await page.waitForSelector('.abyss-chest-spine');await page.waitForTimeout(800);await shot('abyss-chest');
 assert.ok(await page.evaluate(()=>{const c=document.querySelector('.abyss-chest-spine');const d=c.getContext('2d').getImageData(0,0,100,100).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n>200}),'chest spine draws');
 const gold=await page.evaluate(()=>GameRuntime.player.wallet.gold);await page.locator('[data-action=mm-abyss-chest][data-quest="1"]').click();await page.waitForFunction(g=>GameRuntime.player.abyss.stages[0].quests[1].status===2,gold);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
