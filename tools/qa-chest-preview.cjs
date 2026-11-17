// QA xem trước rương trong popup thông tin vật phẩm: chạm icon rương / nút kính lúp → PopupShowListRewards với các món bên trong,
// chạm từng món → thông tin món đó (đóng lại thì về bảng xem trước).
// Dùng: node tools/qa-chest-preview.cjs (ảnh: qa-output/chest-preview/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_cpvqa_'+crypto.randomBytes(6).toString('hex'),port=4257,url=`http://127.0.0.1:${port}`,output='qa-output/chest-preview';let server,browser;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())});
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Chest_QA');await page.locator('#password').fill('chest-password-1');await page.locator('#password-confirm').fill('chest-password-1');await page.locator('.auth-submit').click();
 await page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden&&GameView.getSceneId()===13);await page.waitForTimeout(1500);
 const shot=name=>page.locator('#stage').screenshot({path:`${output}/${name}.png`});
 const ids=await page.evaluate(async()=>{const t=await fetch('chests.json').then(r=>r.json()),items=GameRuntime.catalog.items;
  const named=items.find(i=>/Bảo vật đỏ vip/i.test(i.name)&&t[i.id])?.id,big=Object.entries(t).filter(([,v])=>v.mode==='random').sort((a,b)=>b[1].rewards.length-a[1].rewards.length)[0][0],hero=Object.entries(t).find(([,v])=>v.rewards.some(r=>r.kind==='hero'))?.[0];return{named,big,hero}});
 console.log('ids',JSON.stringify(ids));assert.ok(ids.named,'không thấy rương Bảo vật đỏ vip');
 // 1. Thông tin rương: ô vật phẩm có thể chạm, có nút kính lúp gốc.
 await page.evaluate(id=>ItemInfoUI.show(id),ids.named);await page.waitForSelector('.item-info-chest');await page.waitForTimeout(300);await shot('01-info');
 assert.ok(await page.locator('.item-info-layer [data-name="ButtonInfoPreview"]').isVisible());
 // 2. Chạm icon rương → bảng xem trước.
 await page.locator('.item-info-chest').click();await page.waitForSelector('.chest-preview-layer .chest-pv-cell');await page.waitForTimeout(300);await shot('02-preview');
 const want=await page.evaluate(async id=>(await fetch('chests.json').then(r=>r.json()))[id].rewards.length,ids.named);
 assert.equal(await page.locator('.chest-pv-cell').count(),want);assert.equal(await page.locator('.chest-pv-cell .item-sparkle').count(),want,'bảo vật đỏ lấp lánh');assert.equal(await page.locator('.chest-pv-cell .aui').count(),want,'khung phẩm chất bảo vật');
 // 3. Chạm một món → thông tin món, nằm trên bảng xem trước; đóng → còn bảng xem trước.
 await page.locator('.chest-pv-cell .ev-tile').first().click();await page.waitForSelector('.item-info-layer:not(.chest-preview-layer)');await page.waitForTimeout(300);await shot('03-item-info');
 assert.match(await page.locator('.item-info-layer:not(.chest-preview-layer) .item-info-detail').textContent(),/Tăng/,'bảo vật hiện chỉ số');
 await page.locator('.item-info-layer:not(.chest-preview-layer) [data-name="ButtonClose"]').click();await page.waitForTimeout(200);
 assert.equal(await page.locator('.item-info-layer:not(.chest-preview-layer)').count(),0);assert.equal(await page.locator('.chest-preview-layer').count(),1);
 await page.locator('.chest-preview-layer [data-name="ButtonClose"]').click();assert.equal(await page.locator('.chest-preview-layer').count(),0);
 // 4. Rương ngẫu nhiên nhiều món (cuộn) — mở bằng nút kính lúp.
 await page.evaluate(id=>ItemInfoUI.show(id),ids.big);await page.waitForSelector('.item-info-layer [data-name="ButtonInfoPreview"]');await page.locator('.item-info-layer [data-name="ButtonInfoPreview"]').click();
 await page.waitForSelector('.chest-pv-cell');await page.waitForTimeout(300);await shot('04-big');
 assert.ok(await page.evaluate(()=>{const g=document.querySelector('.chest-pv-grid');return g.scrollHeight>g.clientHeight}),'lưới cuộn được');
 await page.keyboard.press('Escape');
 // 5. Rương có tướng: chạm tướng → thông tin thuyền viên.
 if(ids.hero){await page.evaluate(id=>ItemInfoUI.show(id),ids.hero);await page.locator('.item-info-chest').click();await page.waitForSelector('.chest-pv-hero');await page.waitForTimeout(300);await shot('05-hero');
  await page.locator('.chest-pv-hero').first().click();await page.waitForSelector('.item-info-layer:not(.chest-preview-layer)');await page.waitForTimeout(300);await shot('06-hero-info');
  assert.match(await page.locator('.item-info-layer:not(.chest-preview-layer) [data-name="TextInfo"]').textContent(),/Thuyền viên/)}
 // Vật phẩm thường không có nút xem trước.
 // 6. Trang bị có bộ: hiện chỉ số và hiệu ứng bộ trang bị.
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 const gear=await page.evaluate(()=>GameRuntime.catalog.equipmentSets.find(s=>s.items.length)?.items.at(-1));
 await page.evaluate(id=>ItemInfoUI.show(id),gear);await page.waitForSelector('.item-info-detail .item-popup-set');await page.waitForTimeout(300);await shot('07-equipment');
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.evaluate(()=>ItemInfoUI.show('consumable:2'));await page.waitForTimeout(500);
 assert.equal(await page.locator('.item-info-chest').count(),0);
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(process.env.MONGODB_URI){const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();assert.match(database,/^htps_cpvqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
