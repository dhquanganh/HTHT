// Bakes the original Item_effect Spine (the sparkle of top-tier equipment) into a sprite strip for DOM icons.
// Bag, shop and forge grids can hold dozens of these; one CSS animation is far cheaper than one Spine per icon.
// bs-attack-strip is baked in a 300px cell; run tools/crop-strip.py afterwards so the marker sits centred on its stage.
const {chromium}=require('playwright-core'),http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../dist'),types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.css':'text/css','.atlas':'text/plain','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res)});
(async()=>{
 await new Promise(r=>server.listen(4211,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),page=await browser.newPage();
 await page.goto('http://127.0.0.1:4211/index.html');await page.waitForFunction(()=>window.GameView&&window.spine);
 for(const [sceneId,name,size,out,dx,dy] of [[1017,'Loop',150,'item-effect-strip',0,0],[1263,'animation',300,'bs-attack-strip',0,0]]){
 const data=await page.evaluate(async({sceneId,name,size,dx,dy})=>{
  const scene=await fetch(`scenes/${sceneId}.json`).then(r=>r.json());let graphic=null;const walk=n=>{for(const c of n.components)if(c.type==='SkeletonGraphic'&&c.skeleton)graphic=c;n.children.forEach(walk)};scene.roots.forEach(walk);
  const controller={...graphic,animation:name,loop:true};await GameView.loadSkeleton(controller);
  const {instance,state}=controller,animation=instance.data.findAnimation(name),count=Math.round(animation.duration*20),canvas=document.createElement('canvas');canvas.width=size*count;canvas.height=size;
  const ctx=canvas.getContext('2d'),renderer=new spine.canvas.SkeletonRenderer(ctx);renderer.triangleRendering=true;
  state.setAnimation(0,name,true);
  for(let i=0;i<count;i++){
   state.update(i?animation.duration/count:0);state.apply(instance);instance.updateWorldTransform();
   ctx.save();ctx.beginPath();ctx.rect(i*size,0,size,size);ctx.clip();ctx.translate(i*size+size/2+dx,size/2+dy);ctx.scale(1,-1);renderer.draw(instance);ctx.restore();
  }
  return{url:canvas.toDataURL('image/webp',.9),count,size,duration:animation.duration};
 },{sceneId,name,size,dx,dy});
 fs.writeFileSync(path.join(root,`assets/${out}.webp`),Buffer.from(data.url.split(',')[1],'base64'));
 console.log({out,count:data.count,size:data.size,duration:data.duration});
 }
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
