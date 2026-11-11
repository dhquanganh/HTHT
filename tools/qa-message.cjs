// QA Đổ xúc xắc: nút Vòng quay? không — tab xúc xắc trong Sự kiện đặc biệt -> PanelEventDice; nhận xúc xắc ngày, đổ thường,
// xúc xắc may mắn chọn số, ô lá bài -> chọn bài, bảng mốc sao, mua xúc xắc. DB htps_msgqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('E:/New folder/HaiTacDaiChien_v1.1.3/web-ui/.env')}catch{}
const database='htps_msgqa_'+crypto.randomBytes(6).toString('hex'),port=4291,url=`http://127.0.0.1:${port}`,output='qa-output/message';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_msgqa_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root'),null,{timeout:40000});
 const shot=async(name,ms=700)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 const closeBonus=async()=>{if(await page.locator('.bonus-popup').count()){await page.locator('.bonus-close').click();await page.waitForTimeout(200)}};
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Msg_QA');await page.locator('#password').fill('msg-password-1');await page.locator('#password-confirm').fill('msg-password-1');await page.locator('.auth-submit').click();await ready();
 await page.evaluate(()=>{GameMessage.confirm('Mua 5 xúc xắc với 100 kim cương?','Mua xúc xắc',100,()=>{})});await page.waitForSelector('.msg-layer');await shot('buy-confirm',500);
 await page.locator('.msg-layer [data-msg-cancel]').first().click();
 await page.evaluate(()=>{window.__r=GameMessage.ask('Thuyền trưởng có muốn mở khóa?','Mở khóa').then(v=>window.__v=v)});await page.waitForSelector('.msg-layer');await shot('ask',500);
 await page.locator('.msg-layer [data-guild-confirm]').click();await page.waitForFunction(()=>window.__v===true);
 await page.evaluate(()=>{GameMessage.notify('Đảo bánh đang đóng cửa.')});await page.waitForSelector('.msg-layer');await shot('notify',500);
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,checks:['buy-confirm','ask','notify']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_msgqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
