/* Đỉnh Thời Gian — Peaks of Time (bundle `pot`). Màn chọn ải PoTPanelListStage + PoTPanelMapListMenu; màn bản đồ dựng từ
 * Tilemap gốc (MapPoT_1 / MapPoT_2: nền, tường) vẽ sẵn vào canvas, vật thể theo prefab _MapObjects (sprite + pivot, khung
 * Animator), Spine (người chơi chibi_fuji, boss enemy_akainu, itemsupport Pot / Rice / Snail), sương mù tile_fog_0..15 theo
 * PoTTilemapFog.findTileIndex, tầm nhìn 2 ô. HUD PoTPanelMapPlayMenu; popup PoTPanelMapObjectInfo, PoTPanelSelectRelic,
 * PoTPanelPlayerRelics, PoTPanelPlayerHeroes. Luật ở server/pot.mjs (server kiểm tra lại từng bước đi). */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,root=null,screen='list',popups=[],busy=false,selStage=1;
 const W=1136,H=640,CELL=64;
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const render=(name,w=W,h=H)=>D.render(data.prefabs[name],w,h,opts());
 const find=(el,p)=>el&&D.find(el,p),show=(el,on)=>D.show(el,on),text=(el,s)=>D.setText(el,String(s??''),false);
 const art=k=>data.art[k]?c.assetSrc(data.art[k]):'';
 const img=(el,src)=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();el.style.backgroundImage=src?`url('${src}')`:'none';el.style.backgroundSize='100% 100%'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
 const layer=()=>document.querySelector('#game-layer');
 const st=()=>c.player().pot;
 const run=()=>st().run;
 const key=(x,y)=>x+','+y;
 async function act(url,body={},o={}){if(busy)return null;busy=true;try{return await c.mutation(url,body,{close:false,render:false,bonus:true,message:false,...o})}finally{busy=false}}

 // ---------------- Màn chọn ải
 function openList(){
  clearRoot();screen='list';
  const el=render('PoTPanelListStage');el.classList.add('pt-list');root.appendChild(el);
  // Nền: nền ô hầm ngục của bản đồ (dungeon_tileset_64_0) phủ tối.
  el.style.backgroundImage=`linear-gradient(#0009,#000c),url('${art('dungeon_tileset_64_0')}')`;el.style.backgroundSize='auto,64px 64px';el.querySelector(':scope>.pd-image')?.remove();
  for(const n of ['BtnTestClear','BtnTestScroll'])show(find(el,n),false);
  const tpl=find(el,'CellStage');show(tpl,false);
  const vp=find(el,'ScrollViewStage/Viewport');vp.innerHTML='';const box=document.createElement('div');box.className='pt-cells';vp.appendChild(box);
  const s=st();selStage=Math.min(selStage||s.unlocked,s.stages.length);if(run()&&!run().done)selStage=run().stage;
  for(const x of s.stages){const cell=tpl.cloneNode(true);cell.style.display='';cell.classList.add('pt-cell');cell.dataset.stage=x.stage;
   if(x.stage>s.unlocked)cell.classList.add('locked');if(x.stage===selStage)cell.classList.add('on');
   text(find(cell,'TextCell'),`Ải ${x.stage}`+(x.stage>s.unlocked?' (khóa)':''));show(find(cell,'ImageTick'),x.cleared);box.appendChild(cell)}
  info(el);
  const menu=render('PoTPanelMapListMenu');menu.classList.add('pt-menu');root.appendChild(menu);
  box.querySelector('.pt-cell.on')?.scrollIntoView({block:'center'});
 }
 function info(el=root.querySelector('.pt-list')){
  const s=st(),x=s.stages[selStage-1],r=run(),resume=r&&r.stage===selStage&&!r.done;
  el.querySelector('.pt-info')?.remove();const box=document.createElement('div');box.className='pt-info';
  box.innerHTML=`<h3>Ải ${x.stage}</h3><p>Bản đồ ${x.map} · Quái cấp ${x.level}${x.cleared?' · <b class="pt-ok">Đã vượt</b>':''}</p>
   <p class="pt-note">Khám phá bản đồ, mở rương, hạ quái để chọn thẻ hỗ trợ, tìm và hạ boss để qua ải. Máu tướng giữ qua các trận.</p>
   <div class="pt-label">Thưởng qua ải lần đầu</div><div class="pt-rewards">${x.clear.map(r=>c.eventTile(r,'pt-tile')).join('')}</div>
   <div class="pt-actions">${resume?`<button type="button" data-enter="resume">Tiếp tục</button><button type="button" class="ghost" data-enter="reset">Làm mới bản đồ</button>`:`<button type="button" data-enter="new" ${x.stage>s.unlocked?'disabled':''}>Vào ải</button>`}</div>`;
  el.appendChild(box);
 }

 // ---------------- Màn bản đồ
 let map=null,cam={x:0,y:0,z:1},drag=null,moving=false,animTimer=null;
 function walkSet(mid){
  const m=data.maps[mid],layers=Object.fromEntries(m.layers.map(l=>[l.name,l])),wall=new Set(layers.TilemapWall.cells.map(c=>key(c[0],c[1]))),walk=new Set(),all=new Set();
  for(const c of layers.TilemapBgr.cells){all.add(key(c[0],c[1]));if(c[2]!=='dungeon_tileset_64_86'&&!wall.has(key(c[0],c[1])))walk.add(key(c[0],c[1]))}
  const xs=[...all].map(k=>+k.split(',')[0]),ys=[...all].map(k=>+k.split(',')[1]);
  return{walk,all,b:{left:Math.min(...xs),right:Math.max(...xs),bottom:Math.min(...ys),top:Math.max(...ys)}};
 }
 const px=(x,y)=>({x:(x-map.b.left)*CELL+CELL/2,y:(map.b.top-y)*CELL+CELL/2});
 function loadImg(name){return new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=art(name)})}
 /** Vẽ sprite theo pivot / PPU gốc vào ctx, điểm neo tại (cx, cy). */
 function drawSprite(ctx,im,name,cx,cy,flip){const [pxv,pyv,ppu]=data.pivots[name]||[.5,.5,64],k=CELL/ppu,w=im.width*k,h=im.height*k;ctx.save();ctx.translate(cx,cy);if(flip)ctx.scale(flip[0],flip[1]);ctx.drawImage(im,-pxv*w,-(1-pyv)*h,w,h);ctx.restore()}
 async function openMap(){
  clearRoot();screen='map';const r=run(),ws=walkSet(r.map);map={...ws,mid:r.map,objs:new Map()};
  const view=document.createElement('div');view.className='pt-view';const world=document.createElement('div');world.className='pt-world';
  const Wd=(map.b.right-map.b.left+1)*CELL,Hd=(map.b.top-map.b.bottom+1)*CELL;world.style.width=Wd+'px';world.style.height=Hd+'px';map.world=world;map.view=view;
  const tiles=document.createElement('canvas');tiles.width=Wd;tiles.height=Hd;tiles.className='pt-tiles';world.appendChild(tiles);
  const objs=document.createElement('div');objs.className='pt-objs';world.appendChild(objs);map.objLayer=objs;
  const fog=document.createElement('canvas');fog.width=Wd;fog.height=Hd;fog.className='pt-fog';world.appendChild(fog);map.fog=fog;
  view.appendChild(world);root.appendChild(view);
  // HUD gốc
  const hud=render('PoTPanelMapPlayMenu');hud.classList.add('pt-hud');root.appendChild(hud);
  img(find(hud,'GroupBottomLeft/ButtonCardBuff'),art('btn_card_buff'));img(find(hud,'GroupBottomLeft/ButtonHeroList'),art('btn_hero_list'));
  const bar=document.createElement('div');bar.className='pt-team';root.appendChild(bar);map.bar=bar;
  view.addEventListener('pointerdown',onDown);view.addEventListener('pointermove',onDrag);view.addEventListener('pointerup',onUp);view.addEventListener('pointerleave',()=>{drag=null});
  // Nền + tường (thứ tự TilemapRenderer), sương mù vẽ riêng.
  const ctx=tiles.getContext('2d'),names=new Set();for(const l of data.maps[r.map].layers)if(l.name!=='TilemapFog')for(const t of l.cells)if(t[2])names.add(t[2]);
  for(const n of Object.keys(data.art))if(/^tile_fog_/.test(n))names.add(n);
  const ims=Object.fromEntries(await Promise.all([...names].map(async n=>[n,await loadImg(n)])));map.ims=ims;
  for(const l of [...data.maps[r.map].layers].sort((a,b)=>a.order-b.order)){if(l.name==='TilemapFog')continue;for(const t of l.cells){const im=ims[t[2]];if(!im)continue;const p=px(t[0],t[1]);drawSprite(ctx,im,t[2],p.x,p.y,t[3])}}
  map.player=spineEl('chibi_fuji','idling',.42);map.player.classList.add('pt-player');objs.appendChild(map.player);
  drawAll();centerOn(r.pos,true);
 }
 function spineEl(name,anim,scale,{w=160,h=200,ox=0,oy=40}={}){
  const el=document.createElement('div');el.className='pt-spine';const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.style.left=(-w/2+ox)+'px';cv.style.top=(-h/2-oy)+'px';el.appendChild(cv);
  const sk=typeof name==='string'?data.spines[name]:name;if(sk)c.spine(cv,{skeleton:sk,animation:anim},{loop:true,scale});return el;
 }
 function heroSpine(heroId,scale=.38){const d=c.def(heroId),sk=d&&c.skeleton(d.avatar);return spineEl(sk||'enemy_akainu',sk?'idling':'Idle',scale)}
 /** Một vật thể: sprite theo prefab gốc (vị trí, pivot, thứ tự), đổi khung theo trạng thái. */
 function spriteEl(name,ox=0,oy=0,flip=false){const im=document.createElement('img');im.className='pt-sprite';im.alt='';im.draggable=false;setSprite(im,name);im.style.left=ox*CELL+'px';im.style.top=-oy*CELL+'px';if(flip)im.style.scale='-1 1';return im}
 function setSprite(im,name){const [pxv,pyv,ppu]=data.pivots[name]||[.5,.5,64],a=c.assets()[data.art[name]];if(!a)return;const k=CELL/ppu;im.src=art(name);im.style.width=a.width*k+'px';im.style.height=a.height*k+'px';im.style.translate=`${-pxv*a.width*k}px ${-(1-pyv)*a.height*k}px`;im.dataset.sprite=name}
 const frames=n=>data.anims[n]||[];
 const turretSprite=s=>({'0,1':'dungeon_object_7','1,1':'dungeon_object_12','1,0':'dungeon_object_13','1,-1':'dungeon_object_14','0,-1':'dungeon_object_20','-1,-1':'dungeon_object_21','-1,0':'dungeon_object_5','-1,1':'dungeon_object_6'})[`${s.x},${s.y}`]||'dungeon_object_7';
 function buildObj(o){
  const el=document.createElement('div');el.className='pt-obj t-'+o.type;el.dataset.id=o.id;
  const add=n=>el.appendChild(n);
  if(o.type==='portal')add(spriteEl(frames('Portal_Idle')[0]||'dungeon_object_29',0,.261)).dataset.anim='Portal_Idle';
  else if(o.type==='jumpGateEntrance')add(spriteEl(frames('JGEntrance_Idle')[0]||'dungeon_object_50',0,.261)).dataset.anim='JGEntrance_Idle';
  else if(o.type==='jumpGateExit')add(spriteEl(o.isActive?'dungeon_object_32':'dungeon_object_42'));
  else if(o.type==='door'){add(spriteEl('atlas1_12',.01,.395));add(spriteEl('atlas1_12',.01,1.248))}
  else if(o.type==='block')add(spriteEl('atlas1_12'));
  else if(o.type==='switchDoor'||o.type==='switchBlock')add(spriteEl(o.isActive?'dungeon_object_44':'dungeon_object_47',0,-.31));
  else if(o.type==='turret'){add(spriteEl(turretSprite(o.step),0,.2));if(o.isActive)add(spriteEl(frames('Torch_Idle')[0]||'dungeon_object_0',.036,.691)).dataset.anim='Torch_Idle'}
  else if(o.type==='collapseGround')add(spriteEl(o.isActive?(frames('Ground_Solid')[0]||'dungeon_object_56'):(frames('Ground_Hole')[0]||'dungeon_object_63')));
  else if(o.type==='chest')add(spriteEl(o.isOpen?(frames('Chest_Open')[0]||'dungeon_object_69'):(frames('Chest_Close')[0]||'dungeon_object_65'),0,-.5));
  else if(['healingRice','reviveJar','supportStation'].includes(o.type)){add(spriteEl('hero_shadow',0,-.21));add(spineEl('itemsupport',{healingRice:'Rice',reviveJar:'Pot',supportStation:'Snail'}[o.type],.5,{w:120,h:120,oy:20}));if(o.used)el.classList.add('used')}
  else if(o.type==='monster'){add(spriteEl('hero_shadow',0,-.21));add(heroSpine(o.enemy?.heroes?.[0],.34));if(o.facing!=='left')el.classList.add('face-right')}
  else if(o.type==='boss'){add(spriteEl('hero_shadow',0,-.21));add(spineEl('enemy_akainu','Idle',.42,{w:200,h:240,oy:50}));el.classList.add('boss')}
  else if(o.type==='rail'){add(spriteEl('dungeon_object_44',0,-.31)).dataset.anim='Switch_Idle'}
  return el;
 }
 function objCell(o){if(o.type==='block')return o.at;if(o.type==='rail')return o.station||o.location;return o.location}
 function drawAll(){
  const r=run(),rev=new Set(r.revealed);
  // Vật thể: dựng lại khi trạng thái đổi; ẩn trong sương mù.
  for(const el of map.objs.values())el.remove();map.objs.clear();
  for(const o of r.objects){
   if((o.type==='monster'||o.type==='boss')&&o.isDead)continue;if(o.type==='door'&&o.isOpen)continue;
   const cell=objCell(o);if(!rev.has(key(cell.x,cell.y)))continue;
   const el=buildObj(o),p=px(cell.x,cell.y);el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.zIndex=String(100+(map.b.top-cell.y)*3);map.objLayer.appendChild(el);map.objs.set(o.id,el);
  }
  placePlayer(r.pos);drawFog(rev);team();
  clearInterval(animTimer);let tick=0;animTimer=setInterval(()=>{if(!map?.world.isConnected)return clearInterval(animTimer);tick++;for(const im of map.objLayer.querySelectorAll('[data-anim]')){const f=frames(im.dataset.anim);if(f.length)setSprite(im,f[tick%f.length])}},140);
 }
 function placePlayer(pos){const p=px(pos.x,pos.y);map.player.style.left=p.x+'px';map.player.style.top=p.y+'px';map.player.style.zIndex=String(101+(map.b.top-pos.y)*3)}
 /** Sương mù: ô chưa thấy phủ tile_fog theo 4 ô kề đã thấy (UP 1, RIGHT 2, BOTTOM 4, LEFT 8). */
 const fogIdx={11:0,9:1,1:2,3:3,10:4,8:5,0:6,2:7,14:8,12:9,4:10,6:11,15:12,13:13,5:14,7:15};
 function drawFog(rev){
  const ctx=map.fog.getContext('2d');ctx.clearRect(0,0,map.fog.width,map.fog.height);
  for(let x=map.b.left;x<=map.b.right;x++)for(let y=map.b.bottom;y<=map.b.top;y++){if(rev.has(key(x,y)))continue;
   const m=(rev.has(key(x,y+1))?1:0)|(rev.has(key(x+1,y))?2:0)|(rev.has(key(x,y-1))?4:0)|(rev.has(key(x-1,y))?8:0),n='tile_fog_'+fogIdx[m],im=map.ims[n];if(!im)continue;const p=px(x,y);drawSprite(ctx,im,n,p.x,p.y)}
 }
 function team(){
  const r=run();map.bar.innerHTML=(r.team||[]).filter(Boolean).map(id=>{const hp=r.hp[id]??1,h=c.heroCard({id,level:c.player().heroes.find(x=>x.id===id)?.level||1,stars:c.player().heroes.find(x=>x.id===id)?.stars||1},{mini:true});
   return `<span class="pt-hero ${hp<=0?'dead':''}">${h}<i class="pt-hp"><b style="width:${Math.round(hp*100)}%"></b></i></span>`}).join('')+`<span class="pt-relic-count">${r.relics.length} thẻ</span>`;
 }
 // ---- Camera: kéo để di chuyển, nút phóng to / thu nhỏ, giữ người chơi ở giữa sau mỗi bước.
 function applyCam(){map.world.style.transform=`translate(${-cam.x}px,${-cam.y}px) scale(${cam.z})`}
 function centerOn(pos,instant){const p=px(pos.x,pos.y);cam.x=p.x*cam.z-W/2;cam.y=p.y*cam.z-H/2;map.world.style.transition=instant?'none':'transform .25s';applyCam()}
 function onDown(e){drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y,moved:false}}
 function onDrag(e){if(!drag)return;const k=W/layer().getBoundingClientRect().width,dx=(e.clientX-drag.x)*k,dy=(e.clientY-drag.y)*k;if(Math.abs(dx)+Math.abs(dy)>8)drag.moved=true;if(drag.moved){cam.x=drag.cx-dx;cam.y=drag.cy-dy;map.world.style.transition='none';applyCam()}}
 function onUp(e){const d=drag;drag=null;if(!d||d.moved||moving)return;const rect=map.view.getBoundingClientRect(),k=W/rect.width,wx=((e.clientX-rect.left)*k+cam.x)/cam.z,wy=((e.clientY-rect.top)*k+cam.y)/cam.z;
  const x=Math.floor(wx/CELL)+map.b.left,y=map.b.top-Math.floor(wy/CELL);tapCell(x,y)}
 // ---- Tìm đường (giống server/pot.mjs: ô đi được trừ ô bị vật thể chặn)
 function blocked(){const r=run(),s=new Set(),cells=o=>{const out=[];for(let i=0;i<(o.size?.x||1);i++)for(let j=0;j<(o.size?.y||1);j++)out.push(key(o.location.x+i,o.location.y+j));return out};
  for(const o of r.objects){if(o.type==='door'&&!o.isOpen)cells(o).forEach(k=>s.add(k));else if(o.type==='block')s.add(key(o.at.x,o.at.y));else if(o.type==='collapseGround'&&!o.isActive)s.add(key(o.location.x,o.location.y));
   else if((o.type==='monster'||o.type==='boss')&&!o.isDead)s.add(key(o.location.x,o.location.y));else if(o.type==='chest'&&!o.isOpen||['healingRice','reviveJar','supportStation'].includes(o.type)&&!o.used||o.type==='turret')cells(o).forEach(k=>s.add(k))}
  return s}
 function route(goal,adjacent){
  const r=run(),bl=blocked(),start=r.pos,prev=new Map([[key(start.x,start.y),null]]),q=[start];
  const done=p=>adjacent?Math.abs(p.x-goal.x)+Math.abs(p.y-goal.y)<=1:p.x===goal.x&&p.y===goal.y;
  while(q.length){const p=q.shift();if(done(p)){const out=[];let k=key(p.x,p.y);while(prev.get(k)){out.unshift(k.split(',').map(Number));k=prev.get(k)}return out}
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy},k=key(n.x,n.y);if(prev.has(k)||!map.walk.has(k)||bl.has(k))continue;prev.set(k,key(p.x,p.y));q.push(n)}}
  return null;
 }
 const names={portal:'Cổng dịch chuyển',jumpGateEntrance:'Cổng nhảy',jumpGateExit:'Cổng ra',door:'Cửa đá',block:'Khối đá',switchDoor:'Công tắc cửa',switchBlock:'Công tắc khối đá',turret:'Tháp pháo',rail:'Nhà ga',collapseGround:'Nền đá yếu',chest:'Rương',healingRice:'Cơm Sanji',reviveJar:'Bình hồi sinh',supportStation:'Trạm hỗ trợ',monster:'Quái',boss:'Boss'};
 function describe(o){
  const r=run();
  switch(o.type){
   case 'portal':return['Bước lên cổng để dịch chuyển sang cổng liên kết.',null];
   case 'jumpGateEntrance':return['Bước lên để nhảy tới một cổng ra ngẫu nhiên.',null];
   case 'jumpGateExit':return[o.isActive?'Cổng ra đã kích hoạt.':'Cổng ra chưa kích hoạt.',null];
   case 'door':return['Cửa đá đóng. Tìm công tắc để mở.',null];
   case 'block':return['Khối đá chặn đường. Tìm công tắc để dời đi.',null];
   case 'switchDoor':return['Gạt công tắc để mở / đóng cửa đá.','Gạt'];
   case 'switchBlock':return['Gạt công tắc để dời khối đá.','Gạt'];
   case 'turret':return[o.isActive?`Tháp pháo đang hoạt động: bước vào đường bắn, toàn đội mất ${st().turretDamage}% máu.`:'Tháp pháo đã tắt.',null];
   case 'rail':return['Gạt cần ở nhà ga để đổi trạng thái tháp pháo.','Gạt cần'];
   case 'collapseGround':return[o.isActive?'Nền đá yếu: đi qua một lần rồi sẽ sập.':'Nền đã sập.',null];
   case 'chest':return[o.isOpen?'Rương đã mở.':o.looted?'Rương đã nhận thưởng ở lần trước, mở sẽ trống.':(o.quality>=2?'Rương quý.':'Rương thường.'),o.isOpen?null:'Mở'];
   case 'healingRice':return[o.used?'Đã dùng.':'Cơm Sanji: hồi máu cho tướng còn sống.',o.used?null:'Dùng'];
   case 'reviveJar':return[o.used?'Đã dùng.':'Bình hồi sinh: hồi sinh tướng đã ngã.',o.used?null:'Dùng'];
   case 'supportStation':return[o.used?'Đã dùng.':'Trạm hỗ trợ: chọn 1 thẻ hỗ trợ.',o.used?null:'Nhận'];
   case 'monster':case 'boss':{const e=o.enemy;return[`${o.type==='boss'?'Boss':'Quái bậc '+(o.rank||1)} · cấp ${e?.level||''}. Thắng ${o.type==='boss'?'để vượt ải.':'để chọn 1 thẻ hỗ trợ.'}<div class="pt-enemy">${(e?.heroes||[]).map(id=>c.heroCard({id,level:e.level,stars:1},{mini:true})).join('')}</div>`,'Giao chiến']}
  }
  return['',null];
 }
 function tapCell(x,y){
  const r=run(),rev=new Set(r.revealed);if(!rev.has(key(x,y)))return;
  const o=r.objects.find(o=>{const cell=objCell(o);if(cell.x===x&&cell.y===y)return true;return o.size?.y===2&&o.location.x===x&&o.location.y+1===y&&['door','turret','portal','monster','boss','jumpGateEntrance'].includes(o.type)});
  if(o&&!((o.type==='monster'||o.type==='boss')&&o.isDead)&&!(o.type==='door'&&o.isOpen)){
   const stepOn=['portal','jumpGateEntrance','jumpGateExit','collapseGround'].includes(o.type)&&!(o.type==='collapseGround'&&!o.isActive);
   const [desc,action]=describe(o);return objectInfo(o,desc,stepOn?'Đi tới':action);
  }
  if(!map.walk.has(key(x,y)))return;const path=route({x,y},false);if(!path)return c.toast('Không có đường đi tới ô này.');if(path.length)go(path,null);
 }
 function objectInfo(o,desc,action){
  closePopups();const el=popup('PoTPanelMapObjectInfo','pt-objinfo');el.dataset.opened=String(Date.now());const vp=find(el,'Body/ScrollView/Viewport');
  vp.innerHTML=`<div class="pt-objtext"><b>${esc(names[o.type]||o.type)}</b><div>${desc}</div></div>`;
  const btn=find(el,'Body/GroupButton/ButtonAction');show(find(el,'Body/GroupButton'),!!action);text(find(btn,'TextAction'),action||'');btn.dataset.target=o.id;
 }
 async function go(path,target){
  if(moving)return;moving=true;closePopups();
  try{
   const before=run().pos;const r=await act('/api/pot/move',{route:path,target});
   if(!r){moving=false;return}
   // Đi từng ô (hiệu ứng) rồi đồng bộ trạng thái server.
   const steps=(r.result?.events||[]).filter(e=>e.type==='step');for(const s of steps){placePlayer(s);centerOn(s);await wait(110)}
   for(const e of r.result?.events||[]){if(e.type==='turret')flash('Trúng pháo! -'+st().turretDamage+'% máu','bad');if(e.type==='teleport'||e.type==='jump')flash('Dịch chuyển!');if(e.type==='heal')flash('Hồi máu!');if(e.type==='revive')flash('Hồi sinh!');if(e.type==='collapse')flash('Nền sập!','bad')}
   const battleId=r.result?.battleId||r.battleId;
   if(r.result?.message&&!battleId)c.toast(r.result.message);
   if(battleId){moving=false;return c.battle()}
   drawAll();centerOn(run().pos);if(run().pending)selectRelic();if(run().done)doneScreen();
  }catch(e){c.toast(e.message);drawAll()}finally{moving=false}
 }
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 function flash(msg,cls=''){const f=document.createElement('div');f.className='pt-flash '+cls;f.textContent=msg;root.appendChild(f);setTimeout(()=>f.remove(),1400)}
 function doneScreen(){if(root.querySelector('.pt-done'))return;const d=document.createElement('div');d.className='pt-done';d.innerHTML=`<b>Đã vượt ải ${run().stage}!</b><button type="button" data-back="list">Về danh sách ải</button>`;root.appendChild(d)}

 // ---------------- Popup
 function popup(name,cls){const el=render(name);el.classList.add('pt-popup',cls);el.style.zIndex=String(50+popups.length);layer().appendChild(el);popups.push(el);el.addEventListener('click',onClick);return el}
 const closePopup=el=>{el.remove();popups=popups.filter(p=>p!==el)};
 const closePopups=()=>{for(const p of popups)p.remove();popups=[]};
 const rankTag=r=>art(['tag_relic_rare','tag_relic_elite','tag_relic_legendary'][Math.min(2,(r||1)-1)]);
 function fillCard(card,k){show(find(card,'CardBack'),false);const f=find(card,'CardFront');show(f,true);img(f,art('card_relic_front'));
  const ct=find(f,'Contents');img(find(ct,'ImageRelic'),k.icon?c.assetSrc(k.icon):'');img(find(ct,'ImageQuality'),rankTag(k.rank));text(find(ct,'TextName'),k.name);text(find(ct,'TextDesc'),k.description)}
 let pick=null;
 function selectRelic(){
  closePopups();pick=null;const el=popup('PoTPanelSelectRelic','pt-select'),list=run().pending;
  [1,2,3].forEach(i=>{const card=find(el,'Background/PoTCardRelicBig'+i);if(!list[i-1])return show(card,false);fillCard(card,list[i-1]);card.dataset.pick=i-1});
  text(find(el,'Background/BgrTitle/TextTitle'),'Chọn thẻ hỗ trợ');show(find(el,'Background/BoxDesc'),false);
 }
 function relicsPanel(){
  const el=popup('PoTPanelPlayerRelics','pt-relics'),r=run(),vp=find(el,'Content/Background/BoxRelics/ScrollView/Viewport');show(find(el,'Content/Background/BoxNoRelics'),!r.relics.length);
  vp.innerHTML=`<div class="pt-grid">${r.relics.map(k=>`<div class="pt-mini"><span style="background-image:url('${esc(art('card_relic_front'))}')"><img src="${esc(k.icon?c.assetSrc(k.icon):'')}" alt=""></span><b>${esc(k.name)}</b><small>${esc(k.description)}</small></div>`).join('')}</div>`;
 }
 function heroesPanel(){
  const el=popup('PoTPanelPlayerHeroes','pt-heroes'),r=run(),vp=find(el,'Content/Background/BoxHeroes/ScrollView/Viewport');
  vp.innerHTML=`<div class="pt-grid">${(r.team||[]).filter(Boolean).map(id=>{const h=c.player().heroes.find(x=>x.id===id),hp=r.hp[id]??1;return `<div class="pt-hcard ${hp<=0?'dead':''}">${c.heroCard({id,level:h?.level||1,stars:h?.stars||1})}<i class="pt-hp"><b style="width:${Math.round(hp*100)}%"></b></i><small>${hp<=0?'Đã ngã':Math.round(hp*100)+'% máu'}</small></div>`}).join('')}</div>`;
  const g=find(el,'Content/Background/GroupRevine');show(g,true);show(find(g,'RevinePotion'),false);text(find(g,'ButtonRevine/TextRevine'),'Đổi đội hình');
 }
 function teamPicker(then){c.pickTeam('Đội hình Đỉnh Thời Gian',async slots=>{const r=await act('/api/pot/team',{formation:slots});if(r){c.toast('Đã lưu đội hình.');await then?.()}},{slots:run()?.team||undefined})}

 async function onClick(e){
  const t=e.target.closest('[data-stage],[data-enter],[data-back],[data-pick],.pd-button');if(!t)return;if(e.target.closest('.ev-tile'))return;e.stopPropagation();
  const name=t.dataset.name,host=t.closest('.pt-popup');
  try{
   if(t.dataset.stage){if(t.classList.contains('locked'))return c.toast('Ải chưa mở.');selStage=Number(t.dataset.stage);for(const x of root.querySelectorAll('.pt-cell'))x.classList.toggle('on',x===t);return info()}
   if(t.dataset.enter){const reset=t.dataset.enter==='reset',fresh=t.dataset.enter==='new';
    const enter=async formation=>{const r=await act('/api/pot/enter',{stage:selStage,reset:reset||fresh&&!!run()&&run().stage===selStage,...(formation?{formation}:{})});if(r)openMap()};
    if(!run()?.team)return c.pickTeam('Đội hình Đỉnh Thời Gian',slots=>enter(slots));
    if(reset&&!await window.GameMessage.ask('Làm mới bản đồ ải này? Vị trí, vật thể, máu và thẻ hỗ trợ trở về ban đầu.','Đỉnh Thời Gian'))return;
    return enter()}
   if(t.dataset.back)return openList();
   if(t.dataset.pick!==undefined){pick=Number(t.dataset.pick);for(const x of host.querySelectorAll('[data-pick]'))x.classList.toggle('on',x===t);return}
   if(name==='ButtonConfirm'&&host?.classList.contains('pt-select')){if(pick===null)return c.toast('Chọn 1 thẻ.');const r=await act('/api/pot/relic',{index:pick});if(r){closePopup(host);c.toast('Đã nhận thẻ hỗ trợ.');drawAll()}return}
   // Bỏ qua cú chạm vừa mở bảng (cùng lần chạm trên bản đồ).
   if(name==='ButtonAction'&&host?.classList.contains('pt-objinfo')){if(Date.now()-Number(host.dataset.opened||0)<350)return;const o=run().objects.find(x=>x.id===Number(t.dataset.target)),cell=objCell(o);closePopup(host);
    const step=['portal','jumpGateEntrance','jumpGateExit','collapseGround'].includes(o.type);const path=route(cell,!step);if(!path)return c.toast('Không có đường tới đó.');return go(path,step?null:o.id)}
   if(name==='ButtonClose'&&host)return closePopup(host);
   if(name==='ButtonRevine'&&host?.classList.contains('pt-heroes')){closePopup(host);return teamPicker(async()=>{drawAll()})}
   if(name==='Background'&&host&&(host.classList.contains('pt-relic')))return closePopup(host);
   if(name==='ButtonBack'){if(screen==='map')return openList();return close()}
   if(name==='ButtonHelp')return c.help();
   if(name==='ButtonZoomIn'||name==='ButtonZoomOut'){cam.z=Math.max(.5,Math.min(1.5,+(cam.z+(name==='ButtonZoomIn'?.15:-.15)).toFixed(2)));return centerOn(run().pos)}
   if(name==='ButtonCardBuff')return relicsPanel();
   if(name==='ButtonHeroList')return heroesPanel();
  }catch(err){c.toast(err.message)}
 }
 function clearRoot(){closePopups();clearInterval(animTimer);root.innerHTML='';map=null}
 async function open(context,{toMap=false}={}){c=context;await load();root?.remove();root=document.createElement('div');root.className='pt-root';layer().appendChild(root);root.addEventListener('click',onClick);
  if(toMap&&run()&&!run().done)return openMap();if(toMap&&run()?.pending)return openMap();openList()}
 function close(){clearRoot();root?.remove();root=null}
 let loading=null;
 function load(){return data?Promise.resolve(data):loading??=fetch('pot.json').then(r=>r.json()).then(d=>data=d)}
 window.PotUI={open,close,load,isOpen:()=>!!root,data:()=>data,afterBattle:()=>{if(!root)return;if(run()?.pending)selectRelic()}};
})();
