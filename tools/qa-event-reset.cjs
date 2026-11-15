// QA Sự kiện tuần: mốc 240 của Chiêu Mộ Đại Hải Tặc là 50 mảnh tướng SS; hết giờ thì client tự tải lại kỳ mới.
// Dùng: node tools/qa-event-reset.cjs (ảnh: qa-output/event-reset/)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_evrqa_'+crypto.randomBytes(6).toString('hex'),port=4255,url=`http://127.0.0.1:${port}`,output='qa-output/event-reset';let server,browser,client;
const H=3600000,D=24*H,monday=Date.UTC(2026,10,15,17)+60000;
const start=time=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,NEW_ACCOUNT_INTRO:'off',MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NOVA_QA_TIME:String(time)},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stderr.on('data',b=>process.stderr.write(b));s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
const restart=async time=>{server.kill();await new Promise(r=>server.once('exit',r));server=await start(time)};
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start(Date.now());client=new MongoClient(process.env.MONGODB_URI);await client.connect();const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:845}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|status of 40[019]|ERR_CONNECTION_REFUSED/.test(m.text()))errors.push(m.text())});
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action=auth-register]').click();await page.locator('#username').fill('Ev_QA');await page.locator('#password').fill('ev-password-1');await page.locator('#password-confirm').fill('ev-password-1');await page.locator('.auth-submit').click();await ready();
 const d=new Date(Date.now()+7*3600000);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const period='w'+d.toISOString().slice(0,10);
 await players.updateOne({usernameKey:'ev_qa'},{$set:{'player.events.wanted-summon':{period,count:240,claimed:[],bought:{},stage:0,round:1,days:0,lastDay:null,freeDay:null,unlocked:false}}});await page.reload();await ready();
 const count=await page.evaluate(()=>GameRuntime.player.events['wanted-summon'].count);console.log('count',count);
 await page.evaluate(()=>GameRuntime.navigate(10));await page.waitForFunction(()=>GameView.getSceneId()===10&&document.querySelector('#loading').hidden);await page.waitForTimeout(800);
 await page.locator('[data-action="event-pick"][data-event="wanted-summon"]').click();await page.waitForTimeout(500);
 await page.locator('.ev-card').last().scrollIntoViewIfNeeded();await page.locator('#stage').screenshot({path:output+'/01-wanted-240.png'});
 const last=await page.evaluate(()=>{const e=GameRuntime.catalog?.events?.find(x=>x.id==='wanted-summon');return e?.milestones.at(-1)});console.log('last',JSON.stringify(last));
 // Giả lập hết kỳ: đẩy endsAt về 2 giây nữa → client phải gọi lại /api/state và /api/events.
 const calls=[];page.on('request',r=>{if(/\/api\/(state|events)/.test(r.url()))calls.push(r.url().split('/api/')[1])});
 await page.evaluate(()=>{for(const id in GameRuntime.player.events)GameRuntime.player.events[id].endsAt=Date.now()+2000});
 await page.locator('[data-action="event-pick"][data-event="wanted-summon"]').click();await page.waitForTimeout(4500);
 console.log('calls',calls.join(','));assert.ok(calls.includes('state')&&calls.includes('events'));
 const t=await page.locator('[data-event="wanted-summon"] time').textContent();console.log('timer after',t);assert.notEqual(t,'00:00:00');
 await page.locator('#stage').screenshot({path:output+'/02-after-roll.png'});
 console.log('errors',errors);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();if(client){try{assert.match(database,/^htps_evrqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
