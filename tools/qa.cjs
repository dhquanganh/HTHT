const {chromium}=require('playwright-core');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:4173/#13');
 await page.waitForFunction(()=>document.querySelector('#loading').hidden,{},{timeout:120000});
 await page.waitForTimeout(1500);
 fs.mkdirSync('qa-output',{recursive:true});
 await page.screenshot({path:'qa-output/home.png'});
 console.log(JSON.stringify({title:await page.title(),errors,rendererErrors:await page.evaluate(()=>window.uiDebug.errors),buttons:await page.evaluate(()=>window.uiDebug.hits.length)}));
 await page.selectOption('#scene','1');await page.waitForFunction(()=>document.querySelector('#loading').hidden);await page.screenshot({path:'qa-output/login.png'});
 await page.selectOption('#scene','7');await page.waitForFunction(()=>document.querySelector('#loading').hidden);await page.screenshot({path:'qa-output/heroes.png'});
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
