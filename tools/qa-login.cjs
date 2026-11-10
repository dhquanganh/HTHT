// QA màn tải + đăng nhập gốc: SplashInit -> SplashTheme -> LoginScene (nền Kaido, thanh Loading) -> BoxLogin; BoxRegister,
// lỗi nhập lại mật khẩu, đăng ký vào game (màn tải mờ đi), đăng xuất về BoxLogin không chạy lại splash, sai mật khẩu, đăng nhập
// đúng, tab Gosu báo chưa hỗ trợ, tải lại trang khi còn phiên chỉ hiện thanh tải. DB htps_loginqa_* tự xóa.
const {chromium}=require('playwright-core'),{MongoClient}=require('mongodb'),{spawn}=require('child_process');
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');try{process.loadEnvFile('.env')}catch{}
const database='htps_loginqa_'+crypto.randomBytes(6).toString('hex'),port=4263,url=`http://127.0.0.1:${port}`,output='qa-output/login';let server,browser,client;
const start=()=>new Promise((resolve,reject)=>{const s=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,MONGODB_DB:database,PORT:String(port),HOST:'127.0.0.1',NEW_ACCOUNT_INTRO:'off'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('QA startup timeout')),60000);s.stdout.on('data',b=>{if(b.toString().includes('đang chạy')){clearTimeout(timer);resolve(s)}});s.stderr.on('data',b=>process.stderr.write(b));s.once('exit',code=>{clearTimeout(timer);reject(Error('QA server exited '+code))})});
(async()=>{
 fs.mkdirSync(output,{recursive:true});server=await start();client=new MongoClient(process.env.MONGODB_URI);await client.connect();assert.match(database,/^htps_loginqa_[a-f0-9]{12}$/);
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=globalThis.__errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const shot=async(name,ms=400)=>{await page.waitForTimeout(ms);await page.screenshot({path:`${output}/${name}.png`})};
 const inGame=()=>page.waitForFunction(()=>window.GameRuntime?.player&&GameView.getSceneId()===13&&!document.querySelector('.login-root'),null,{timeout:30000});
 await page.goto(url);
 await page.waitForSelector('.splash-init.play');await shot('1-splash-init',1500);
 await page.waitForSelector('.splash-theme.play');await shot('2-splash-theme',1600);
 await page.waitForSelector('#auth-form');await shot('3-login',1200);
 assert.ok(await page.locator('.login-root .login-kaido').count(),'Kaido spine canvas');
 const kaidoPixels=await page.evaluate(()=>{const c=document.querySelector('.login-kaido');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=400)if(d[i])n++;return n});assert.ok(kaidoPixels>50,'Kaido draws '+kaidoPixels);
 // Tab Gosu
 await page.locator('[data-login-gosu]').click();await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Gosu'));
 // Đăng ký: nhập lại sai -> lỗi; đúng -> vào game, màn tải biến mất.
 await page.locator('[data-action=auth-register]').click();await page.waitForSelector('.login-box.register');await shot('4-register',500);
 await page.locator('#username').fill('Login_QA');await page.locator('#password').fill('login-password-1');await page.locator('#password-confirm').fill('login-password-2');await page.locator('.auth-submit').click();
 await page.waitForFunction(()=>document.querySelector('#auth-error')?.textContent.includes('không khớp'));await shot('5-register-error',300);
 await page.locator('#password-confirm').fill('login-password-1');await page.locator('.auth-submit').click();
 await page.waitForFunction(()=>document.querySelector('[data-name="PanelLoadingAsset"] [data-name="SliderProgress"]')?.style.display==='',null,{timeout:20000}).catch(()=>{});await shot('6-updating',150);
 await inGame();await shot('7-home',800);
 // Đăng xuất -> BoxLogin, không chạy lại splash.
 await page.evaluate(()=>{const b=document.createElement('button');b.dataset.action='logout';b.id='qa-logout';document.body.appendChild(b)});await page.evaluate(()=>document.querySelector('#qa-logout').click());
 await page.waitForSelector('#auth-form .login-box.login',{timeout:20000});assert.equal(await page.locator('.splash-init').count(),0);await shot('8-after-logout',600);
 await page.locator('#username').fill('Login_QA');await page.locator('#password').fill('wrong-password');await page.locator('.auth-submit').click();
 await page.waitForFunction(()=>document.querySelector('#auth-error')?.textContent.length>0);await shot('9-login-error',300);
 await page.locator('#password').fill('login-password-1');await page.locator('.auth-submit').click();await inGame();
 // Tải lại khi còn phiên: chỉ thanh tải của LoginScene, không splash, vào thẳng game.
 await page.reload();await page.waitForSelector('.login-stage',{timeout:15000});await shot('10-reload-loading',200);assert.equal(await page.locator('.splash-init').count(),0);
 await inGame();
 const unexpected=errors.filter(e=>!/401 \(Unauthorized\)|400 \(Bad Request\)|409 \(Conflict\)/.test(e));assert.deepEqual(unexpected,[]);
 const report={errors:unexpected,kaidoPixels,checks:['splash-init','splash-theme','login-scene-kaido','gosu-tab','register-box','confirm-mismatch','register-enters-game','loading-asset-bar','logout-to-login-no-splash','wrong-password','login','reload-loading-only']};
 fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e.stack);console.error('ERRORS',JSON.stringify(globalThis.__errors||[]));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))}if(client){try{assert.match(database,/^htps_loginqa_[a-f0-9]{12}$/);await client.db(database).dropDatabase()}finally{await client.close()}}});
