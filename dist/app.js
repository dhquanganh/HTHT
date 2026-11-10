'use strict';
const canvas=document.querySelector('#game'), ctx=canvas.getContext('2d'), select=document.querySelector('#scene');
const W=1136,H=640,images=new Map(),skeletonData=new Map(),fonts=new Map(),texts=new Map();
let canvasScaleX=1,canvasScaleY=1,canvasPixelDensity=0;
function resizeCanvas(){
 const bounds=canvas.getBoundingClientRect(),density=Math.min(3,window.devicePixelRatio||1);
 const width=Math.max(1,Math.round(bounds.width*density)),height=Math.max(1,Math.round(bounds.height*density));
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
 canvasScaleX=width/W;canvasScaleY=height/H;
 canvasPixelDensity=window.devicePixelRatio||1;
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
}
function logicalCanvasMatrix(){const m=ctx.getTransform();return new DOMMatrix([m.a/canvasScaleX,m.b/canvasScaleY,m.c/canvasScaleX,m.d/canvasScaleY,m.e/canvasScaleX,m.f/canvasScaleY])}
new ResizeObserver(resizeCanvas).observe(canvas);
window.addEventListener('resize',resizeCanvas);
resizeCanvas();
let assets={},catalog=[],samples=[],localization={},scene=null,sceneId=13,paused=false,lastTime=0,time=0,hits=[],hover=null,revision=0,loadErrors=[];
let cloneId=100000,scrollOffsets=new Map(),worldScroll=0,worldDrag=null,worldDragged=false,itemSamples=[],equipmentTemplate=null,selectedHero=null;
window.uiDebug={get scene(){return scene},get hits(){return hits},get errors(){return loadErrors}};
const labels={0:'Khởi động',1:'Đăng nhập',5:'Giải đấu All Stars',6:'Tế đàn',7:'Tướng',8:'Đấu trường',9:'Chiến đấu',10:'Sự kiện',11:'Bang hội',12:'Túi đồ',13:'Màn hình chính',14:'Ghép tướng',15:'Thú cưng',16:'Danh sách tướng',17:'Vòng quay',18:'Thành phố',19:'Đổi tướng',20:'Đỉnh cao',21:'Lò rèn',22:'Chiến bang',23:'Hầm ngục',24:'Triệu hồi nguyên tố',25:'Đổi triệu hồi',26:'Chiêu mộ',27:'Thử thách',28:'Bản đồ',29:'Vòng quay cao cấp',30:'Phiêu lưu',31:'Quán rượu',33:'Đấu trường vô địch',34:'Chiến dịch',35:'Thiên đảo',37:'Thế giới',38:'Vùng đất phong ấn',40:'Tháp thử thách',41:'Thử thách II',45:'Shuriken',46:'Marineford',47:'Sabaody',48:'Sự kiện đặc biệt'};
const primary=[13,1,18,7,12,26,24,25,6,14,19,21,37,28,34,8,5,33,11,22,10,31,23,27,41,35,38,40,15,20,46,47,45,48,30];
const routes={ButtonHero:7,ButtonHeroes:7,ButtonBag:12,ButtonItem:12,ButtonItems:12,ButtonForge:21,ButtonFuse:14,ButtonAltar:6,ButtonWorld:37,ButtonCampaign:28,ButtonGuild:11,ButtonSummon:26,ButtonSummonScroll:26,ButtonArena:8,ButtonTarven:31,ButtonTavern:31,ButtonEvent:10,ButtonDungeon:23,ButtonMonster:15,ButtonTower:40,ButtonHome:13,ButtonBack:13,ButtonClose:13,ButtonEnter:13,ButtonLogin:13,ButtonLoginGosu:13,ButtonOrb:24};
Object.assign(routes,{ButtonShop:1404,ButtonShip:18,ButtonEvents:10,ButtonRollcall:1297,ButtonQuest:1288,GroupAvatar:1007,ButtonMail:1339,ButtonScroll:26,ButtonHeroList:7});
const rgba=(c=[1,1,1,1])=>`rgba(${c.slice(0,3).map(x=>Math.round(x*255)).join(',')},${c[3]??1})`;
const get=(n,type)=>n.components.find(c=>c.type===type);
function toast(s){const el=document.querySelector('#toast');el.textContent=s;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2200)}
async function image(key){if(!key||!assets[key])return null;if(!images.has(key)){images.set(key,new Promise((resolve)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{loadErrors.push('Image: '+key);resolve(null)};img.src=assets[key].src}));}return images.get(key)}
function readyImage(key){return images.get(key)?.image||null}
async function loadImage(key){const im=await image(key);if(im)images.get(key).image=im;return im}
async function loadFont(f){if(!f)return;if(!fonts.has(f.family))fonts.set(f.family,(async()=>{try{const face=new FontFace(f.family,`url(${JSON.stringify(f.src)})`);await face.load();document.fonts.add(face)}catch(e){loadErrors.push('Font: '+f.name)}})());return fonts.get(f.family)}
async function loadSkeleton(c){
 if(!c.skeleton)return;
 const desc=c.skeleton,key=desc.skeleton.src;
 if(!skeletonData.has(key))skeletonData.set(key,(async()=>{
  const pageTextures=new Map();let atlasText='';
  for(const a of desc.atlases){const text=await fetch(a.atlas.src).then(r=>r.text());atlasText+='\n'+text;const pageNames=text.split(/\r?\n/).filter((line,i,all)=>line.trim()&&(i===0||!all[i-1].trim())&&!line.includes(':'));
   for(let i=0;i<a.textures.length;i++){const im=await loadImage(a.textures[i]);if(im)pageTextures.set(pageNames[i]||assets[a.textures[i]].name+'.png',im)}
  }
  const atlas=new spine.TextureAtlas(atlasText,name=>{const im=pageTextures.get(name)||[...pageTextures.values()][0];if(!im)throw Error('Missing atlas page '+name);return new spine.canvas.CanvasTexture(im)});
  const loader=new spine.AtlasAttachmentLoader(atlas);const src=desc.skeleton.src;let data;
  if(src.endsWith('.json')){const json=await fetch(src).then(r=>r.json());
   // APK exports use the 3.8 JSON schema. Normalize this legacy patch marker
   // for the 3.8 reader; the extracted source files remain byte-for-byte intact.
   const originalVersion=json.skeleton?.spine;if(originalVersion==='3.8.75')json.skeleton.spine='3.8.99';
   for(const skin of json.skins||[]){for(const attachments of Object.values(skin.attachments||{})){for(const [name,attachment] of Object.entries(attachments)){const path=attachment.path||name;if(path!==path.trim()&&atlas.findRegion(path.trim()))attachment.path=path.trim()}}}
   data=new spine.SkeletonJson(loader).readSkeletonData(json);data.originalVersion=originalVersion;
  }else{const binary=await fetch(src).then(r=>r.arrayBuffer());data=new spine.SkeletonBinary(loader).readSkeletonData(new Uint8Array(binary))}
  return data;
 })());
 try{const data=await skeletonData.get(key);c.instance=new spine.Skeleton(data);if(c.skin&&data.findSkin(c.skin))c.instance.setSkinByName(c.skin);c.instance.setToSetupPose();c.state=new spine.AnimationState(new spine.AnimationStateData(data));const animation=data.findAnimation(c.animation)?.name||data.findAnimation('idling')?.name||data.findAnimation('Idle')?.name||data.findAnimation('Loop')?.name;if(animation)c.state.setAnimation(0,animation,c.loop);c.state.apply(c.instance);c.instance.updateWorldTransform();}catch(e){c.failed=true;loadErrors.push(desc.name+': '+e.message)}
}
function traverse(n,fn){fn(n);for(const ch of n.children)traverse(ch,fn)}
function allNodes(data){const out=[];for(const n of data.roots)traverse(n,n=>out.push(n));return out}
function cloneNode(n){const c=structuredClone(n);traverse(c,n=>n.id=++cloneId);return c}
function setText(n,value){const c=get(n,'Text');if(c)c.text=value}
function findAsset(name){return Object.keys(assets).find(k=>assets[k].name===name)}
function setAsset(n,key){const c=get(n,'Image');if(c&&key)c.asset=key}
function setTopLeft(n,x,y,w,h){Object.assign(n.transform,{m_AnchorMin:{x:0,y:1},m_AnchorMax:{x:0,y:1},m_Pivot:{x:0,y:1},m_AnchoredPosition:{x,y:-y},m_SizeDelta:{x:w,y:h}})}
function prepareScene(data){
 const nodes=allNodes(data);
 for(const n of nodes){const loc=get(n,'Localize'),text=get(n,'Text');if(text&&loc&&localization[loc.term])text.text=localization[loc.term];
 }
 if([13,36].includes(data.id)){
  const slots=nodes.filter(n=>/^HeroHome2 \(/.test(n.name)).sort((a,b)=>a.name.localeCompare(b.name));
  slots.forEach((n,i)=>{const hero=samples[i];if(!hero)return;traverse(n,ch=>{if(ch.name==='Skeleton'&&hero.skeleton){const c=get(ch,'SkeletonGraphic');if(c){c.skeleton=hero.skeleton;c.animation='Idle';c.skin=''}}const t=get(ch,'Text');if(t?.text==='Naruto')t.text=hero.name.replace(' - S','')})});
  const quest=nodes.find(n=>n.name==='PanelHomeQuest');if(quest)quest.active=false;
  for(const n of nodes){const t=get(n,'Text');if(t&&/Siu Nhan|afas/.test(t.text))t.text='Thuyền trưởng'}
 }
 if([7,39].includes(data.id)){
  const template=nodes.find(n=>n.name==='CellHeroThumb'),content=nodes.find(n=>n.name==='Content'&&get(n,'GridPoolGroup'));
  if(template&&content){content.transform.m_SizeDelta={x:810,y:830};content.children=[];
   samples.slice(0,12).forEach((hero,i)=>{const card=cloneNode(template);card.active=true;card.name='PreviewHeroCard';card.hero=hero;setTopLeft(card,6+(i%4)*200,5+Math.floor(i/4)*270,190,260);
    traverse(card,n=>{if(n.name==='ImageHero')setAsset(n,hero.card);if(n.name==='TextName')setText(n,hero.name.replace(' - S',''));if(n.name==='TextLv')setText(n,'200');if(n.name==='ImageHeroFaction')setAsset(n,findAsset('faction_'+hero.type));if(n.name==='ImageClass')setAsset(n,findAsset('class_'+hero.class));if(n.name==='GroupStarE')n.active=false;if(n.name==='GroupStar1')n.active=true});content.children.push(card)});
  }
 }
 if(data.id===12&&equipmentTemplate){
  for(const n of nodes){if(['GroupConsumable','GroupShard','GroupArtifact'].includes(n.name))n.active=false;if(n.name==='TabEquipment'){for(const ch of n.children)if(ch.name==='ImageOff')ch.active=false}}
  const group=nodes.find(n=>n.name==='GroupEquipment'),content=group&&allNodes({roots:[group]}).find(n=>n.name==='Content');
  if(content){content.transform.m_SizeDelta={x:800,y:600};content.children=[];itemSamples.slice(0,32).forEach((item,i)=>{const tile=cloneNode(equipmentTemplate);setTopLeft(tile,14+(i%7)*111,14+Math.floor(i/7)*116,100,100);traverse(tile,n=>{if(n.name==='ImageItem')setAsset(n,item.asset);if(n.name==='TextNumber')setText(n,String(1+i%9))});content.children.push(tile)})}
 }
 if(data.name==='PanelHeroInfo'){
  const hero=selectedHero||samples[0];for(const n of nodes){if(n.name==='ImageHero'){setAsset(n,hero.art);get(n,'Image').preserve=true}if(n.name==='TextHeroName')setText(n,hero.name);if(n.name==='PanelSpecialEquip')n.active=false;if(n.name==='PanelEquipment')n.active=true}
  let index=0;for(const n of nodes){if(n.name==='ImageItem'&&get(n,'Image'))setAsset(n,itemSamples[index++%Math.max(1,itemSamples.length)]?.asset)}
 }
 if(data.name==='PopupShop'){
  const cell=nodes.find(n=>n.name==='CellPopupShop'),shopItem=nodes.find(n=>n.name==='ShopItem'),content=nodes.find(n=>n.name==='Content'&&n.transform.m_SizeDelta.x===0);
  if(cell&&shopItem&&content){content.transform.m_SizeDelta={x:586,y:640};content.children=[];
   for(let row=0;row<4;row++){const line=cloneNode(cell);line.active=true;setTopLeft(line,0,row*154,586,150);const children=[];for(const ch of line.children){if(ch.name!=='ShopItem')children.push(ch)}line.children=children;
    for(let col=0;col<3;col++){const item=cloneNode(shopItem);item.active=true;setTopLeft(item,24+col*180,0,160,150);const itemMeta=itemSamples[(row*3+col)%itemSamples.length];traverse(item,n=>{if(get(n,'GameItem')){for(const ch of n.children)if(/^Item.*UI$|^HeroHeadClickable$/.test(ch.name))ch.active=ch.name==='ItemEquipmentUI'}if(n.name==='ImageItem')setAsset(n,itemMeta?.asset);if(n.name==='TextPrice')setText(n,String(100*(row+1)));if(n.name==='TextNumber')setText(n,'1')});line.children.push(item)}content.children.push(line)
   }
  }
 }
 // A Mask's own graphic is optional in Unity. Its children still render normally.
 for(const n of allNodes(data)){const mask=get(n,'Mask');if((mask&&!mask.showGraphic)||n.name==='MaskSpineBorder')n.hideGraphic=true}
 window.GameRuntime?.prepareScene(data);
 return data;
}
async function showScene(id){
 if(window.GameRuntime)id=window.GameRuntime.beforeScene(id);
 const rev=++revision;document.querySelector('#loading').hidden=false;hover=null;sceneId=id;select.value=id;
 const item=catalog.find(x=>String(x.id)===String(id));if(!item){document.querySelector('#loading').hidden=true;return}
 const data=prepareScene(await fetch(item.path).then(r=>{if(!r.ok)throw Error('Không tải được màn hình');return r.json()}));
 const jobs=[];for(const n of data.roots)traverse(n,n=>{for(const c of n.components){if(c.asset)jobs.push(loadImage(c.asset));if(c.font)jobs.push(loadFont(c.font));if(c.skeleton)jobs.push(loadSkeleton(c))}});
 await Promise.all(jobs);if(rev!==revision)return;
 scene=data;scrollOffsets.clear();worldScroll=0;time=0;await window.GameRuntime?.onScene(data);document.title=(labels[id]||item.name)+' · Hải Tặc Phục Sinh';document.querySelector('#loading').hidden=true;
 if(location.hash!==`#${id}`)history.replaceState(null,'',`#${id}`);
 render(0);
}
function active(n){if(sceneId===1){if(['PanelInitData','PanelLoadingAsset','BoxRegister','BoxLogin','PanelBlock'].includes(n.name))return false;if(n.name==='BoxServers')return !window.GameRuntime;}return n.active}
function rect(n,pw,ph,override){
 const t=n.transform,amin=t.m_AnchorMin||{x:.5,y:.5},amax=t.m_AnchorMax||amin,p=t.m_Pivot||{x:.5,y:.5},a=t.m_AnchoredPosition||{x:0,y:0},sz=t.m_SizeDelta||{x:100,y:100};
 const w=pw*(amax.x-amin.x)+sz.x,h=ph*(amax.y-amin.y)+sz.y;
 return override||{x:pw*(amin.x+(amax.x-amin.x)*p.x)+a.x-p.x*w,y:ph-(ph*(amin.y+(amax.y-amin.y)*p.y)+a.y)-(1-p.y)*h,w,h};
}
function childRects(n,w,h){
 const group=n.components.find(c=>['HorizontalLayoutGroup','VerticalLayoutGroup','GridLayoutGroup'].includes(c.type));if(!group)return new Map();
 const ch=n.children.filter(active),out=new Map(),[left,right,top,bottom]=group.padding;
 if(group.type==='GridLayoutGroup'){
  const [cw,chh]=group.cell,[sx,sy]=group.spacing;let cols=group.constraint===1?group.constraintCount:Math.max(1,Math.floor((w-left-right+sx)/(cw+sx)));
  ch.forEach((c,i)=>out.set(c.id,{x:left+(i%cols)*(cw+sx),y:top+Math.floor(i/cols)*(chh+sy),w:cw,h:chh}));return out;
 }
 const horizontal=group.type==='HorizontalLayoutGroup',main=horizontal?w:h,cross=horizontal?h:w,pre=horizontal?left:top,post=horizontal?right:bottom,spacing=group.spacing||0;
 const lengths=ch.map(c=>{const r=rect(c,w,h);return Math.max(0,horizontal?r.w:r.h)});
 const force=horizontal?group.forceWidth:group.forceHeight,control=horizontal?group.controlWidth:group.controlHeight;
 const available=main-pre-post-spacing*Math.max(0,ch.length-1),total=lengths.reduce((a,b)=>a+b,0);
 if(force&&control){const extra=(available-total)/Math.max(1,ch.length);lengths.forEach((l,i)=>lengths[i]=Math.max(l+extra,0))}
 let pos=pre;const actual=lengths.reduce((a,b)=>a+b,0)+spacing*Math.max(0,ch.length-1);let ax=group.align%3,ay=Math.floor(group.align/3);pos+=Math.max(0,available+spacing*Math.max(0,ch.length-1)-actual)*(horizontal?ax:ay)/2;
 (group.reverse?[...ch].reverse():ch).forEach((c,i)=>{const r=rect(c,w,h);let cw=r.w,chh=r.h;
  if(horizontal){cw=lengths[i];if(group.controlHeight&&group.forceHeight)chh=h-top-bottom;r.x=pos;r.y=top+Math.max(0,h-top-bottom-chh)*ay/2}
  else{chh=lengths[i];if(group.controlWidth&&group.forceWidth)cw=w-left-right;r.y=pos;r.x=left+Math.max(0,w-left-right-cw)*ax/2}
  out.set(c.id,{x:r.x,y:r.y,w:cw,h:chh});pos+=lengths[i]+spacing;
 });return out;
}
function nineSlice(im,b,w,h,fill=true){
 let [l,bt,r,t]=b;const sw=im.width,sh=im.height,factor=Math.min(1,w/Math.max(1,l+r),h/Math.max(1,t+bt));
 const xs=[0,l,sw-r,sw],ys=[0,t,sh-bt,sh],xd=[0,l*factor,w-r*factor,w],yd=[0,t*factor,h-bt*factor,h];
 for(let y=0;y<3;y++)for(let x=0;x<3;x++){if(!fill&&x===1&&y===1)continue;let a=xs[x+1]-xs[x],b=ys[y+1]-ys[y],c=xd[x+1]-xd[x],d=yd[y+1]-yd[y];if(a>0&&b>0&&c>0&&d>0)ctx.drawImage(im,xs[x],ys[y],a,b,xd[x],yd[y],c,d)}
}
function drawImage(c,w,h){
 const col=c.color||[1,1,1,1];if(col[3]<=0||w<=0||h<=0)return;const im=readyImage(c.asset);ctx.save();ctx.globalAlpha*=col[3];
 if(!im){if(!c.asset){ctx.fillStyle=rgba([...col.slice(0,3),1]);ctx.fillRect(0,0,w,h)}ctx.restore();return}
 const meta=assets[c.asset];
 if(c.mode===1&&meta.border?.some(x=>x>0))nineSlice(im,meta.border,w,h);
 else if(c.preserve){const scale=Math.min(w/im.width,h/im.height),iw=im.width*scale,ih=im.height*scale;ctx.drawImage(im,(w-iw)/2,(h-ih)/2,iw,ih)}
 else{if(c.mode===3&&c.fill<1){ctx.beginPath();ctx.rect(0,0,w*Math.max(0,c.fill),h);ctx.clip()}ctx.drawImage(im,0,0,w,h)}
 if(col[0]<.98||col[1]<.98||col[2]<.98){/* Original neutral UI textures retain their alpha and texture detail. */}
 ctx.restore();
}
function richParts(text,c){
 const parts=[];let color=rgba(c.color),size=c.size,bold=!!(c.style&1),italic=!!(c.style&2);const stack=[];
 for(const s of text.split(/(<\/?(?:color|size|b|i)(?:=[^>]+)?>)/gi)){
  const tag=s.match(/^<(\/?)(color|size|b|i)(?:=([^>]+))?>$/i);
  if(tag){if(tag[1]){const old=stack.pop();if(old)({color,size,bold,italic}=old)}else{stack.push({color,size,bold,italic});const v=(tag[3]||'').replace(/["']/g,'');if(tag[2]==='color')color=v;if(tag[2]==='size')size=Number(v)||size;if(tag[2]==='b')bold=true;if(tag[2]==='i')italic=true}}else if(s)parts.push({text:s,color,size,bold,italic});
 }return parts;
}
function drawText(c,n,w,h){
 let text=c.text||'';if(sceneId===1&&n.name==='TextVersion')text='v1.1.8';if(sceneId===1&&n.name==='TextBuild')text='';if(!text||w<=0||h<=0)return;
 let parts=richParts(text,c),font=c.font?.family||'sans-serif',size=c.size||20;const setFont=(p,scale=1)=>ctx.font=`${p.italic?'italic ':''}${p.bold?'bold ':''}${p.size*scale}px "${font}"`;
 let scale=1;if(c.bestFit){let width=0;for(const p of parts){setFont(p);width+=ctx.measureText(p.text).width}scale=Math.min(1,w/Math.max(1,width),h/size);scale=Math.max(scale,(c.minSize||2)/size)}
 const lines=[[]];let x=0;
 for(const p of parts){setFont(p,scale);for(const word of p.text.split(/(\n|\s+)/)){if(word==='\n'){lines.push([]);x=0;continue}const width=ctx.measureText(word).width;if(!c.overflow&&x+width>w&&x>0&&word.trim()){lines.push([]);x=0}lines.at(-1).push({...p,text:word,width});x+=width}}
 const lh=size*scale*(c.lineSpacing||1)*1.15,ax=c.align%3,ay=Math.floor(c.align/3),height=lh*lines.length;
 let y=(ay===1?(h-height)/2:ay===2?h-height:0)+lh*.78;
 const effect=get(n,'Outline')||get(n,'Shadow');ctx.save();ctx.textBaseline='alphabetic';if(!c.overflow){ctx.beginPath();ctx.rect(-3,-5,w+6,h+10);ctx.clip()}
 for(const line of lines){let width=line.reduce((s,p)=>s+p.width,0),x=ax===1?(w-width)/2:ax===2?w-width:0;for(const p of line){setFont(p,scale);ctx.fillStyle=p.color;if(effect){ctx.lineJoin='round';ctx.lineWidth=Math.max(1,Math.abs(effect.distance[0])*2);ctx.strokeStyle=rgba(effect.color);ctx.strokeText(p.text,x,y)}ctx.fillText(p.text,x,y);x+=p.width}y+=lh}ctx.restore();
}
const spineRenderer=new spine.canvas.SkeletonRenderer(ctx);spineRenderer.triangleRendering=true;
function drawNode(n,pw,ph,override){
 if(!active(n))return;const r=rect(n,pw,ph,override),t=n.transform,p=t.m_Pivot||{x:.5,y:.5},s=t.m_LocalScale||{x:1,y:1},q=t.m_LocalRotation||{z:0,w:1};if(!Number.isFinite(r.w+r.h))return;
 ctx.save();ctx.translate(r.x+p.x*r.w,r.y+(1-p.y)*r.h);const angle=-2*Math.atan2(q.z,q.w);if(angle)ctx.rotate(angle);ctx.scale(s.x,s.y);ctx.translate(-p.x*r.w,-(1-p.y)*r.h);
 const group=get(n,'CanvasGroup');if(group)ctx.globalAlpha*=group.alpha;
 for(const c of n.components){if((c.type==='Image'||c.type==='RawImage')&&!n.hideGraphic)drawImage(c,r.w,r.h);if(c.type==='Text')drawText(c,n,r.w,r.h);if(c.type==='SkeletonGraphic'&&c.instance){ctx.save();ctx.translate(p.x*r.w,(1-p.y)*r.h);ctx.scale(1,-1);try{spineRenderer.draw(c.instance)}catch(e){if(!c.renderError){loadErrors.push(c.skeleton.name+': '+e.message);c.renderError=true}}ctx.restore()}}
 if(get(n,'Button')&&r.w>0&&r.h>0){const m=logicalCanvasMatrix();hits.push({name:n.name,node:n,matrix:m,inverse:m.inverse(),w:r.w,h:r.h});}
 if(get(n,'Mask')||get(n,'RectMask2D')){ctx.beginPath();ctx.rect(0,0,r.w,r.h);ctx.clip()}
 const overrides=childRects(n,r.w,r.h);if(n.name==='Content')ctx.translate(n===worldContent()?-worldScroll:0,-(scrollOffsets.get(n.id)||0));for(const ch of n.children)drawNode(ch,r.w,r.h,overrides.get(ch.id));ctx.restore();
}
function render(dt){
 if(!scene)return;ctx.setTransform(canvasScaleX,0,0,canvasScaleY,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle='#0a2c41';ctx.fillRect(0,0,W,H);hits=[];
 if(window.GameRuntime?.render(ctx,dt))return;
 for(const root of scene.roots)traverse(root,n=>{for(const c of n.components){if(c.instance&&!paused){c.state.update(dt);c.state.apply(c.instance);c.instance.updateWorldTransform()}}});
 const roots=scene.roots.filter(n=>get(n,'Canvas')).sort((a,b)=>(get(a,'Canvas').sorting||0)-(get(b,'Canvas').sorting||0));
 for(const root of roots){if(!active(root))continue;const overrides=childRects(root,W,H);for(const ch of root.children)drawNode(ch,W,H,overrides.get(ch.id))}
 if(scene.prefab){ctx.fillStyle='#08121ddd';ctx.fillRect(0,0,W,H);for(const root of scene.roots){root.active=true;drawNode(root,W,H)}}
}
function frame(now){requestAnimationFrame(frame);if(canvasPixelDensity!==(window.devicePixelRatio||1))resizeCanvas();const dt=Math.min(.05,Math.max(0,(now-lastTime)/1000));lastTime=now;if(!paused)time+=dt;render(dt)}
function worldContent(){return allNodes(scene).find(n=>n.name==='ScrollWorld')?.children[0]?.children[0]}
function scrollWorld(value){const content=worldContent();if(content)worldScroll=Math.max(0,Math.min(content.transform.m_SizeDelta.x-W,value))}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}}
function findHit(p){return [...hits].reverse().find(h=>{const q=new DOMPoint(p.x,p.y).matrixTransform(h.inverse);return q.x>=0&&q.y>=0&&q.x<h.w&&q.y<h.h})}
canvas.addEventListener('pointerdown',e=>{worldDragged=false;if(worldContent()&&e.button===0){worldDrag={x:point(e).x,left:worldScroll};canvas.setPointerCapture(e.pointerId)}});
canvas.addEventListener('pointerup',()=>worldDrag=null);canvas.addEventListener('pointercancel',()=>worldDrag=null);
canvas.addEventListener('pointermove',e=>{if(worldDrag){const moved=worldDrag.x-point(e).x;if(Math.abs(moved)>6)worldDragged=true;if(worldDragged)scrollWorld(worldDrag.left+moved)}const h=findHit(point(e));hover=h?.node.id;canvas.style.cursor=h?'pointer':'default'});
canvas.addEventListener('pointerleave',()=>hover=null);
canvas.addEventListener('wheel',e=>{if(!scene)return;if(worldContent()){e.preventDefault();scrollWorld(worldScroll+e.deltaX+e.deltaY);return}const nodes=allNodes(scene).filter(n=>n.name==='Content'&&n.children.length);if(nodes.length){e.preventDefault();for(const n of nodes){const max=Math.max(0,n.transform.m_SizeDelta.y-500);scrollOffsets.set(n.id,Math.max(0,Math.min(max,(scrollOffsets.get(n.id)||0)+e.deltaY*.7)))}}},{passive:false});
canvas.addEventListener('click',e=>{if(worldDragged){worldDragged=false;return}const hit=findHit(point(e));if(!hit)return;if(window.GameRuntime?.handleHit(hit))return;if(hit.node.hero){selectedHero=hit.node.hero;showScene(1156);return}let route=routes[hit.name];if(route===undefined){const name=hit.name.toLowerCase();for(const [keyword,id] of [['summon',26],['hero',7],['guild',11],['bag',12],['campaign',28],['arena',8],['tarven',31],['forge',21],['fuse',14],['altar',6],['world',37],['tower',40],['back',13]]){if(name.includes(keyword)){route=id;break}}}if(route!==undefined){showScene(route)}else toast('Bản xem giao diện · '+(hit.node.children.flatMap(n=>n.components.filter(c=>c.type==='Text').map(c=>c.text)).find(Boolean)||hit.name))});
select.addEventListener('change',()=>showScene(Number(select.value)));
function step(delta){const i=catalog.findIndex(x=>x.id===Number(sceneId));showScene(catalog[(i+delta+catalog.length)%catalog.length].id)}
document.querySelector('#previous').onclick=()=>step(-1);document.querySelector('#next').onclick=()=>step(1);
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'Chạy chuyển động':'Dừng chuyển động'};
document.querySelector('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('Trình duyệt không hỗ trợ toàn màn hình')}};
document.querySelector('#hide').onclick=()=>document.body.classList.add('clean');document.querySelector('#show').onclick=()=>document.body.classList.remove('clean');
addEventListener('keydown',e=>{if(['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName)||window.GameRuntime)return;if(e.key.toLowerCase()==='h')document.body.classList.toggle('clean');if(e.key==='ArrowRight')step(1);if(e.key==='ArrowLeft')step(-1)});
addEventListener('hashchange',()=>{const id=Number(location.hash.slice(1));if(catalog.some(x=>x.id===id))showScene(id)});
async function init(){try{
 let template;[assets,catalog,samples,localization,itemSamples,template]=await Promise.all(['assets.json','catalog.json','samples.json','localization.json','items.json','scenes/1017.json'].map(url=>fetch(url).then(r=>r.json())));equipmentTemplate=template.roots[0];
 catalog=catalog.filter(x=>!x.prefab||/^(Popup|Panel|GG|TapPopup)/.test(x.name));catalog.sort((a,b)=>{const ia=primary.indexOf(a.id),ib=primary.indexOf(b.id);return(ia<0?100+a.id:ia)-(ib<0?100+b.id:ib)});
 const main=document.createElement('optgroup'),other=document.createElement('optgroup'),popups=document.createElement('optgroup');main.label='Màn hình game';other.label='Scene khác trong APK';popups.label='Cửa sổ & bảng giao diện';select.append(main,popups,other);
 for(const item of catalog){const o=document.createElement('option');o.value=item.id;o.textContent=labels[item.id]||item.name;(item.prefab?popups:primary.includes(item.id)?main:other).append(o)}
 const boot=await window.GameRuntime?.boot();const requested=boot?.sceneId??(location.hash?Number(location.hash.slice(1)):13);await showScene(catalog.some(x=>x.id===requested)?requested:13);requestAnimationFrame(frame)
 }catch(e){document.querySelector('#loading').textContent='Không tải được giao diện. Hãy tải lại trang.';loadErrors.push(e.message);console.error(e)}}
// Vùng chạm của nút theo tọa độ 1136x640 (#game-layer), dùng cho bàn tay hướng dẫn.
function hitBox(name){const h=hits.find(x=>x.name===name);if(!h)return null;const a=h.matrix.transformPoint(new DOMPoint(0,0)),b=h.matrix.transformPoint(new DOMPoint(h.w,h.h));return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y)}}
window.GameView={hitBox,get worldScroll(){return worldScroll},showScene,getScene:()=>scene,getSceneId:()=>Number(sceneId),allNodes,get,setText,setAsset,setTopLeft,findAsset,loadImage,readyImage,loadSkeleton,assets:()=>assets,samples:()=>samples,toast,ctx,canvas,cloneNode,drawText,get paused(){return paused},set paused(value){paused=value}};
init();
