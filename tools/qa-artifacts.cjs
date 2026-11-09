const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_art_'+crypto.randomBytes(6).toString('hex'),port=4218,url=`http://127.0.0.1:${port}`,output='qa-output/artifacts';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_art_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000}).catch(()=>{});await page.waitForTimeout(400)};
 const shot=async name=>{await settle();await page.locator('#stage').screenshot({path:`${output}/${name}.png`})};
 const scene=id=>page.waitForFunction(id=>GameView.getSceneId()===id&&document.querySelector('#loading').hidden,id);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Art_QA');await page.locator('#password').fill('art-password-1');await page.locator('#password-confirm').fill('art-password-1');await page.locator('.auth-submit').click();await ready();
 // Bảo vật theo db_item_baovat: bậc (quality), chỉ số theo cấp, dòng theo hệ / nghề trong popup vật phẩm.
 const ids=['artifact:1','artifact:17','artifact:112','artifact:130','artifact:200'];
 await players.updateOne({usernameKey:'art_qa'},{$set:Object.fromEntries(ids.map(id=>['player.inventory.'+id,1]))});
 await page.reload();await ready();await page.evaluate(()=>GameRuntime.navigate(12));await page.waitForTimeout(1200);
 console.log('bag',JSON.stringify(await page.evaluate(()=>({tabs:[...document.querySelectorAll('[data-action]')].map(b=>b.dataset.action+':'+(b.dataset.tab||b.dataset.filter||b.dataset.item||'')).filter(x=>/bag|tab|filter|item/.test(x)).slice(0,30)}))));
 await page.locator('[data-action="inventory-tab"][data-tab="artifact"]').click().catch(async()=>{await page.evaluate(()=>[...document.querySelectorAll('[data-action="inventory-tab"]')].find(b=>/artifact/.test(b.outerHTML))?.click())});await page.waitForTimeout(800);await page.locator('#stage').screenshot({path:`${output}/bag-artifacts.png`});
 const report=[];
 for(const id of ids){
  const sel=`[data-action="item"][data-item="${id}"]`;
  if(!(await page.locator(sel).count())){report.push({id,shown:false});continue}
  await page.locator(sel).first().scrollIntoViewIfNeeded();await page.locator(sel).first().click();await page.waitForSelector('.item-popup');await settle();
  const text=await page.locator('.item-popup').innerText();report.push({id,lines:text.split('\n').filter(l=>/Cấp|Hệ|%|Tốc|Nộ|Công|Máu/.test(l)).slice(0,9)});
  await page.locator('#stage').screenshot({path:`${output}/${id.replace(':','-')}.png`});
  await page.evaluate(()=>document.querySelector('.item-popup-shade')?.remove());await page.waitForTimeout(200);
 }
 console.log(JSON.stringify(report,null,1));
 assert.ok(report.every(r=>r.lines));const dieu=report.find(r=>r.id==='artifact:130').lines.join('\n');
 // Popup như PopupItemInfo gốc: chỉ số của sao hiện tại, dòng theo hệ ghi rõ hệ; nút nâng cấp thay cho bảng cấp.
 assert.match(dieu,/Hệ Sinh Khí: Tăng 115 Tốc độ/);assert.doesNotMatch(dieu,/Cấp 6:/);
 // Bán bảo vật nhận đúng giá gốc cấp 1.
 const gold=await page.evaluate(()=>GameRuntime.player.wallet.gold);
 const sold=await page.evaluate(async()=>{const s=await(await fetch('/api/auth/session',{credentials:'same-origin'})).json();const r=await fetch('/api/items/sell',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'X-CSRF-Token':s.csrfToken},body:JSON.stringify({itemId:'artifact:17',quantity:1})});return r.status});
 const after=(await players.findOne({usernameKey:'art_qa'})).player.wallet.gold;assert.equal(sold,200);assert.equal(after-gold,30000);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
