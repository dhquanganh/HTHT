// Kiểm tra nộ trong trận thật: Zoro Wano (453) phải có đủ Cast (cutscene), Bgr_hit (nền tím, vẽ sau nhân vật)
// và Hit_skill cùng lúc, và màn hình rung theo shake_cams gốc (2.9s/1.4s và 3.4s/1s, nén theo tỉ lệ chiêu).
// Chạy: node tools/qa-ultimate-fx.cjs [avatar,...]   (mặc định 453)
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_ultfx_'+crypto.randomBytes(6).toString('hex'),port=4213,url=`http://127.0.0.1:${port}`,output='qa-output/ultimate-fx';let server,browser,client;
const avatars=(process.argv[2]||'453').split(',');
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('QA startup timeout')),30000);server.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve()}});server.once('exit',code=>reject(Error('QA server exited '+code)))});
 client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_ultfx_[a-f0-9]{12}$/);const players=client.db(database).collection('players');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1564,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>GameRuntime?.player&&document.querySelector('#loading').hidden);
 await page.goto(url);await page.waitForSelector('#auth-form');await page.locator('[data-action="auth-register"]').click();await page.locator('#username').fill('UltFx_QA');await page.locator('#password').fill('ultfx-qa-password');await page.locator('#password-confirm').fill('ultfx-qa-password');await page.locator('.auth-submit').click();await ready();
 const fx=JSON.parse(fs.readFileSync('dist/hero-effects.json','utf8')),report=[];
 for(const avatar of avatars){
  const id='hero-'+avatar,want=fx.heroes[avatar];
  const doc=await players.findOne({usernameKey:'ultfx_qa'});
  await players.updateOne({_id:doc._id},{$set:{'player.battle':null,'player.reserveHeroes':{...doc.player.reserveHeroes,[id]:{id,level:60,exp:0,stars:5,rank:0,equipment:{},skills:{}}},'player.formation':{version:2,slots:[id,null,null,null,null,null]},'player.adventure.unlockedStage':3,'player.account.level':30}});
  await page.reload();await ready();
  await page.evaluate(()=>GameRuntime.navigate(34));await page.waitForSelector('.campaign-deck');await page.waitForTimeout(500);await page.locator('.campaign-primary').click();await page.waitForSelector('.campaign-formation');
  await page.locator('[data-action="battle-start"]').click();await page.waitForSelector('.battle-hud');
  // Đầy nộ ngay trên server để vòng kế tiếp tung chiêu.
  await players.updateOne({usernameKey:'ultfx_qa'},{$set:{'player.battle.allies.0.energy':100}});
  // Đợi tới nộ: chụp lúc nền (order âm) đã chạy và lúc rung.
  const seen=await page.evaluate(async({key})=>{const out={backdrop:false,hitWithBackdrop:false,shake:0,maxOffset:0,frames:[],worstFrame:0};const t0=performance.now();let prev=performance.now();
   await new Promise(done=>{const tick=()=>{const nowT=performance.now();if(out.backdrop)out.worstFrame=Math.max(out.worstFrame,nowT-prev);prev=nowT;const fx=GameRuntime.effects||[],mine=fx.filter(e=>e.skill&&e.elapsed>0&&e.elapsed<e.duration),back=mine.find(e=>e.behind),front=mine.filter(e=>!e.behind&&e.controller.key===key);
     if(back){out.backdrop=true;if(front.length)out.hitWithBackdrop=true;if(!out.tint&&back.elapsed>back.duration*.3){const sk=back.controller.instance;out.tint=sk.drawOrder.filter(x=>x.attachment).map(x=>[x.data.name,[x.color.r,x.color.g,x.color.b,x.color.a].map(v=>+v.toFixed(2)),x.attachment.color&&[x.attachment.color.r,x.attachment.color.g,x.attachment.color.b].map(v=>+v.toFixed(2)),x.data.blendMode,x.attachment.constructor.name]);out.tintAnim=back.controller.state.getCurrent(0)?.animation.name}}
     out.shake=Math.max(out.shake,(GameRuntime.shakes||[]).length);
     if(back&&out.frames.length<8&&performance.now()-(out.last||0)>260){out.last=performance.now();const c=document.querySelector('#game'),o=document.createElement('canvas');o.width=784;o.height=442;o.getContext('2d').drawImage(c,0,0,784,442);out.frames.push(o.toDataURL('image/jpeg',.72))}
     if((out.backdrop&&!mine.length)||performance.now()-t0>90000)return done();requestAnimationFrame(tick)};requestAnimationFrame(tick)});
   return out},{key:want.cast.find(e=>e.order<0)?.key||want.cast[0]?.key});
  console.log('ult backdrop',seen.tintAnim,JSON.stringify(seen.tint).slice(0,1500));
  seen.frames.forEach((f,i)=>fs.writeFileSync(`${output}/${avatar}-${i}.jpg`,Buffer.from(f.split(',')[1],'base64')));
  // Trận mới cho đòn đánh thường (trận trước có thể đã kết thúc bằng chiêu nộ).
  await page.evaluate(()=>document.querySelector('[data-action="battle-leave"]')?.click());await page.waitForTimeout(800);
  await players.updateOne({usernameKey:'ultfx_qa'},{$set:{'player.battle':null}});await page.reload();await ready();
  await page.evaluate(()=>GameRuntime.navigate(34));await page.waitForSelector('.campaign-deck');await page.waitForTimeout(500);await page.locator('.campaign-primary').click();await page.waitForSelector('.campaign-formation');
  await page.locator('[data-action="battle-start"]').click();await page.waitForSelector('.battle-hud');
  // Đánh thường có nền order âm (Zoro Wano: Bgr_hit tím của Cast_74) cũng phải nằm sau nhân vật.
  let attackBackdrop=null;
  if(want.attack?.cast.some(e=>e.order<0)&&process.env.ATTACK_FRAMES){for(let i=0,t0=Date.now();i<10&&Date.now()-t0<45000;){const st=await page.evaluate(()=>{const f=(GameRuntime.effects||[]).find(e=>e.controller.kind==='atk-fx'&&e.behind&&e.elapsed>=0&&e.elapsed<e.duration);return f?+(f.elapsed/f.duration).toFixed(2):null});if(st!==null){await page.locator('#stage').screenshot({path:`${output}/${avatar}-atk-${i}-${st}.png`});i++}else await page.waitForTimeout(40)}}
  if(want.attack?.cast.some(e=>e.order<0)){attackBackdrop=await page.evaluate(async()=>{const t0=performance.now();return await new Promise(done=>{const tick=()=>{const f=(GameRuntime.effects||[]).find(e=>e.controller.kind==='atk-fx'&&e.behind&&e.elapsed>e.duration*.5);if(f){const sk=f.controller.instance,o2=new spine.Vector2(),z2=new spine.Vector2();sk.getBounds(o2,z2,[]);{const t=document.createElement('canvas');t.width=1136;t.height=640;const tc=t.getContext('2d');tc.fillStyle='#345';tc.fillRect(0,0,1136,640);const r=new spine.canvas.SkeletonRenderer(tc);r.triangleRendering=true;tc.translate(568,320);tc.scale(.75,-.75);r.draw(sk);window.atkSolo=t.toDataURL('image/jpeg',.7)}window.atkInfo={x:f.x,y:f.y,scale:f.scale,duration:f.duration,elapsed:f.elapsed,anim:f.controller.state.getCurrent(0)?.animation.name,bounds:[o2.x,o2.y,z2.x,z2.y],slots:sk.drawOrder.filter(x=>x.attachment).map(x=>[x.data.name,[x.color.r,x.color.g,x.color.b,x.color.a].map(v=>+v.toFixed(2)),x.attachment.color&&[x.attachment.color.r,x.attachment.color.g,x.attachment.color.b].map(v=>+v.toFixed(2)),x.data.blendMode,x.attachment.constructor.name])};const c=document.querySelector('#game'),o=document.createElement('canvas');o.width=784;o.height=442;o.getContext('2d').drawImage(c,0,0,784,442);return done(o.toDataURL('image/jpeg',.72))}if(performance.now()-t0>45000||document.querySelector('.battle-end'))return done(null);requestAnimationFrame(tick)};requestAnimationFrame(tick)})});
   {const solo=await page.evaluate(()=>window.atkSolo);if(solo)fs.writeFileSync(`${output}/${avatar}-attack-solo.jpg`,Buffer.from(solo.split(',')[1],'base64'))}
   console.log('attack fx',JSON.stringify(await page.evaluate(()=>window.atkInfo)));
   if(attackBackdrop)fs.writeFileSync(`${output}/${avatar}-attack.jpg`,Buffer.from(attackBackdrop.split(',')[1],'base64'))}
  const tint=await page.evaluate(()=>spine.canvas.SkeletonRenderer.tintStats);report.push({avatar,worstFrameMs:Math.round(seen.worstFrame),tintCopies:tint.created,tintMs:Math.round(tint.ms),backdrop:seen.backdrop,hitWithBackdrop:seen.hitWithBackdrop,shakes:seen.shake,expectedShakes:want.shake.length,attackBackdrop:want.attack?.cast.some(e=>e.order<0)?!!attackBackdrop:null});
  await page.evaluate(()=>document.querySelector('[data-action="battle-leave"]')?.click());await page.waitForTimeout(800);
 }
 console.log(JSON.stringify(report));
 const zoro=report.find(r=>r.avatar==='453');
 if(zoro){assert.ok(zoro.backdrop,'Bgr_hit nền tím phải chạy và vẽ sau nhân vật');assert.ok(zoro.hitWithBackdrop,'Hit_skill phải chạy cùng Bgr_hit');assert.equal(zoro.shakes,2,'hai lần rung theo shake_cams')}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,errors}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(client){await client.db(database).dropDatabase();await client.close()}server?.kill()});
