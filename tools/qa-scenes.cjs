const {chromium}=require('playwright-core');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/#13');await page.waitForFunction(()=>document.querySelector('#loading').hidden);
 const cases=[13,1,18,7,12,26,24,25,6,14,19,21,37,28,34,8,5,33,11,22,10,31,23,27,41,35,38,40,15,20,46,47,45,48,30,1156,1404,1011,1288,1007];
 const results=[];
 for(const id of cases){await page.selectOption('#scene',String(id));await page.waitForFunction(id=>window.uiDebug.scene?.id===id&&document.querySelector('#loading').hidden,id);await page.waitForTimeout(80);
  if([13,12,26,18,1156,1404].includes(id))await page.screenshot({path:`qa-output/scene-${id}.png`});
  results.push({id,title:await page.title(),buttons:await page.evaluate(()=>window.uiDebug.hits.length)});
 }
 await page.setViewportSize({width:390,height:844});await page.selectOption('#scene','13');await page.waitForFunction(()=>window.uiDebug.scene?.id===13&&document.querySelector('#loading').hidden);await page.screenshot({path:'qa-output/mobile.png'});
 const report={results,errors,rendererErrors:await page.evaluate(()=>window.uiDebug.errors),mobileOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)};
 fs.writeFileSync('qa-output/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
