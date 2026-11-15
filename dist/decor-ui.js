/* Trang trí tàu / Nội Thất (bundle `shipdecor`): PanelShipDecorHome (Búa gỗ, đếm phẩm đỏ / vàng / tím, nút Xưởng / Kho /
 * Bộ sưu tập), các tầng tàu dựng từ ShipDecorFloor (18 ô SpaceUpper1-9 / SpaceLower10-18), màn sửa tầng, Xưởng
 * PanelShopFurniture (Franky Spine, chế tạo x1 / x10, thanh 30 lần nhận Thẻ vàng, đặt hàng vàng / đỏ), Kho StoreRoom
 * (lưới ItemFurniture, chi tiết PanelItemDetail, tái chế). Luật ở server/decor.mjs. */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,root=null,popups=[],busy=false;
 const W=1136,H=640;
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const render=(name,w=W,h=H)=>D.render(data.prefabs[name],w,h,opts());
 const find=(el,p)=>el&&D.find(el,p),show=(el,on)=>D.show(el,on),text=(el,s)=>D.setText(el,String(s??''),false);
 const art=k=>data.art[k]?c.assetSrc(data.art[k]):'';
 const img=(el,src)=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();el.style.backgroundImage=src?`url('${src}')`:'none';el.style.backgroundSize='100% 100%'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
 const layer=()=>document.querySelector('#game-layer');
 const st=()=>c.player().decor;
 const inv=id=>c.player().inventory?.[id]||0;
 const HAMMER='consumable:2138',GOLD='consumable:2139',RED='consumable:2140';
 const qName=['','Tím','Vàng','Đỏ'],stat={0:'Công',2:'Máu',3:'Tốc độ',97:'Lục thức'};
 const factionVi={shadow:'Bóng tối',abyss:'Vực thẳm',fortress:'Pháo đài',forest:'Rừng xanh',dark:'Hắc ám',light:'Ánh sáng'},classVi={mage:'Pháp sư',warrior:'Chiến binh',priest:'Mục sư',ranger:'Xạ thủ',assassin:'Sát thủ'};
 async function act(url,body={},o={}){if(busy)return null;busy=true;try{return await c.mutation(url,body,{close:false,render:false,bonus:true,message:false,...o})}finally{busy=false}}
 const heroName=id=>c.def(id)?.name||id;
 /** Ô nội thất: khung theo phẩm, ảnh, biểu tượng hệ / nghề / tướng (như ItemFurniture). */
 function tile(it,{check=false,on=false}={}){
  const head=it.hero&&c.def(it.hero)?.visual?.head;
  return `<button type="button" class="dc-item q${it.quality} ${on?'on':''}" data-uid="${it.uid}" title="${esc(it.name)}"><img class="dc-pic" src="${esc(c.assetSrc(it.image))}" alt="">
   <span class="dc-badges">${it.faction?`<img src="${esc(c.assetSrc(c.named('faction_'+it.faction)))}" alt="">`:''}${it.clazz?`<img src="${esc(art('class_'+it.clazz))}" alt="">`:''}${head?`<img class="dc-hh" src="${esc(c.assetSrc(head))}" alt="">`:''}</span>
   ${it.placed?'<i class="dc-used">Đang đặt</i>':''}${check?`<i class="dc-check">${on?'✔':''}</i>`:''}</button>`;
 }
 function effectText(it){return it.effect.map(e=>`${e.hero?heroName(e.hero):e.clazz?classVi[e.clazz]:e.faction?'Hệ '+factionVi[e.faction]:'Toàn đội'}: `+e.point.map(([k,v])=>`+${c.short(v)} ${stat[k]||k}`).join(', ')).join('<br>')}

 // ---------------- Màn chính
 function mount(){
  closePopups();root?.remove();root=render('PanelShipDecorHome');root.classList.add('dc-root');layer().appendChild(root);root.addEventListener('click',onClick);
  for(const n of ['BoatHouse','TabShips','ButtonRoomEditor','ButtonShowTutorial','PanelTutorialShipdecor','AnchorTopRight/ButtonQuest','Image','ImageBgr/ImageTiep'])show(find(root,n),false);
  const p=c.player();text(find(root,'AnchorTopLeft/PlayerInfo/TextPlayername'),p.displayName);text(find(root,'AnchorTopLeft/PlayerInfo/TextLv'),'Cấp '+p.account.level);show(find(root,'AnchorTopLeft/PlayerInfo/GroupAvatar/FrameVip'),false);
  img(find(root,'AnchorTopLeft/PlayerInfo/GroupAvatar/Mask/ImageAvatar'),c.assetSrc(c.def(p.hero.id)?.visual?.head));
  text(find(root,'AnchorBottomRight/ButtonShop/ButtonShopDesc'),'Xưởng');text(find(root,'AnchorTopRight/ButtonStoreroom/ButtonStoreroomDesc'),'Kho');text(find(root,'AnchorTopRight/ButtonGallery/ButtonGalleryDesc'),'Bộ riêng');
  fill();
 }
 function counts(){const s=st(),q=[0,0,0,0];for(const it of s.items)q[it.quality]++;return q}
 function fill(){
  if(!root?.isConnected)return;const s=st(),q=counts();
  text(find(root,'BoxItemCount/Red/CountNumber'),q[3]);text(find(root,'BoxItemCount/Yellow/CountNumber'),q[2]);text(find(root,'BoxItemCount/Purple/CountNumber'),q[1]);
  text(find(root,'BoxHammerCount/Text'),c.short(inv(HAMMER)));
  root.querySelector(':scope>.dc-ship')?.remove();const ship=document.createElement('div');ship.className='dc-ship';
  s.floors.forEach((f,i)=>{const row=document.createElement('div');row.className='dc-floor-row';row.dataset.floor=i;row.appendChild(floorEl(f,.36));
   const lab=document.createElement('div');lab.className='dc-floor-label';lab.innerHTML=`<b>Tầng ${i+1}</b> · ${f.hero?esc(heroName(f.hero)):'Chưa có thuyền viên'}${f.set?` · Bộ riêng ${f.set.have}/18`:''} <span>Chạm để trang trí</span>`;row.appendChild(lab);ship.appendChild(row)});
  if(s.dailyReady){const d=document.createElement('button');d.type='button';d.className='dc-daily';d.dataset.daily='1';d.innerHTML=`<img src="${esc(art('decor_hammer'))}" alt=""> Nhận ${s.dailyHammers} Búa gỗ hôm nay`;ship.appendChild(d)}
  root.appendChild(ship);
 }
 /** Một tầng: prefab ShipDecorFloor, đặt ảnh nội thất vào từng ô. */
 function floorEl(f,scale,{edit=false,sel=null}={}){
  const el=render('ShipDecorFloor',2448,452);el.classList.add('dc-floor');el.style.scale=String(scale);
  for(const n of ['ButtonEdit','ButtonEditHero','HeroFloorDetail','HeroMove','ProgressBox'])show(find(el,n),false);
  const items=new Map(st().items.map(i=>[i.uid,i]));
  for(let slot=1;slot<=18;slot++){const sp=find(el,'Furnitures/'+(slot<=9?'SpaceUpper':'SpaceLower')+slot);if(!sp)continue;sp.dataset.slot=slot;
   const it=items.get(f.slots[slot]),im=find(sp,'ImageItem');show(find(sp,'ButtonRemoveItem'),false);
   // Ô trống: bỏ ảnh giữ chỗ trắng của prefab (ImageItem).
   if(im){im.innerHTML='';img(im,'');if(it)im.innerHTML=`<img class="dc-slot-img q${it.quality}" src="${esc(c.assetSrc(it.image))}" alt="">`}
   const g=find(sp,'GroupSpace');if(g){show(g,edit);if(edit){show(find(g,'ImageEditFrame'),true);show(find(g,'ImageEditSelect'),sel===slot)}}}
  if(f.hero){const sk=c.skeleton(c.def(f.hero)?.avatar);if(sk){const cv=document.createElement('canvas');cv.width=260;cv.height=300;cv.className='dc-hero';el.appendChild(cv);c.spine(cv,{skeleton:sk,animation:'idling'},{loop:true,scale:.75})}}
  return el;
 }

 // ---------------- Sửa tầng
 let edit=null;
 function editor(floor,slot=null){
  closePopups();edit={floor,slot};const s=st(),f=s.floors[floor];
  const el=document.createElement('div');el.className='dc-popup dc-editor';el.style.zIndex='48';
  el.innerHTML=`<div class="dc-ed-bg" style="background-image:url('${esc(art('decor_bgr_room_edit')||art('decor_bgr'))}')"></div><div class="dc-ed-floor"></div>
   <div class="dc-ed-bar"><button type="button" class="dc-back" data-ed="back" style="background-image:url('${esc(art('button_back'))}')" aria-label="Quay lại"></button>
    <div class="dc-ed-hero"><b>Tầng ${floor+1}</b>${f.hero?`<span>${esc(heroName(f.hero))}</span>`:'<span>Chưa có thuyền viên</span>'}<button type="button" data-ed="hero">${f.hero?'Đổi thuyền viên':'Thêm thuyền viên'}</button>${f.hero?'<button type="button" class="ghost" data-ed="unhero">Rời phòng</button>':''}</div>
    <div class="dc-ed-actions"><button type="button" data-ed="auto">Tự động đặt</button><button type="button" class="ghost" data-ed="clear">Tháo toàn bộ</button></div></div>
   <div class="dc-ed-info"></div><div class="dc-ed-list"></div>`;
  layer().appendChild(el);popups.push(el);el.addEventListener('click',onClick);
  el.querySelector('.dc-ed-floor').appendChild(floorEl(f,.455,{edit:true,sel:slot}));
  const set=f.set;el.querySelector('.dc-ed-info').innerHTML=set?`<b>Bộ riêng ${esc(set.name)}: ${set.have}/18</b> ${[6,12,18].map(k=>`<span class="${set.have>=k?'ok':''}">${k} món: ${set.bonus[k].map(([id,v])=>'+'+c.short(v)+' '+(stat[id]||id)).join(', ')}</span>`).join('')}`:f.hero?'Thuyền viên này chưa có bộ nội thất riêng.':'Giao tầng cho một thuyền viên để kích hoạt bộ nội thất riêng của tướng đó.';
  const list=el.querySelector('.dc-ed-list');
  if(slot===null){list.innerHTML='<p class="dc-hint">Chọn một ô trên tầng: hàng trên đặt đồ treo tường / trần, hàng dưới đặt đồ sàn.</p>';return}
  const upper=slot<=9,cur=f.slots[slot],items=s.items.filter(i=>(upper?i.place!==1:i.place===1)).sort((a,b)=>(a.placed-b.placed)||b.quality-a.quality);
  list.innerHTML=`<div class="dc-ed-head">Ô ${slot} · ${upper?'Đồ treo tường / trần':'Đồ đặt sàn'} ${cur?'<button type="button" class="ghost" data-ed="remove">Tháo món đang đặt</button>':''}</div><div class="dc-grid">${items.length?items.map(i=>tile(i,{on:i.uid===cur})).join(''):'<p class="dc-hint">Kho chưa có nội thất phù hợp. Vào Xưởng để chế tạo.</p>'}</div>`;
 }

 // ---------------- Xưởng
 function shop(){
  closePopups();const s=st(),el=popup('PanelShopFurniture','dc-shop');
  const fr=find(el,'Content/Left/Franky/Skeleton');if(fr&&data.spines.frank){const cv=document.createElement('canvas');cv.width=560;cv.height=640;cv.className='dc-franky';fr.appendChild(cv);c.spine(cv,{skeleton:data.spines.frank,animation:'idling'},{loop:true,scale:.75})}
  const L='Content/Left/',R='Content/Right/nen_phai_truoc/';
  const n=s.cardEvery?s.created%s.cardEvery:0;text(find(el,L+'NumberItemsCreated/NumberCount/NumberCreated'),n);text(find(el,L+'NumberItemsCreated/NumberCount/30Created'),'/'+(s.cardEvery||'-'));
  const bar=find(el,L+'NumberItemsCreated/BarBackGound/Bar');if(bar)bar.style.width=(s.cardEvery?n/s.cardEvery*100:0)+'%';
  text(find(el,L+'Bottom/ButtonLegendaryOrder/BorderNumber/Text'),inv(GOLD));text(find(el,L+'Bottom/ButtonMythicOrder/BorderNumber/Text'),inv(RED));
  for(const [b,label,k] of [['ButtonBuy','Chế tạo',1],['ButtonBuyx10','Chế tạo x10',10]]){const x=find(el,R+b);text(find(x,'Text'),label);text(find(x,'UnitPrice'),s.price*k);img(find(x,'ImagePrice'),art('decor_hammer'));show(find(x,'NotiDot'),false)}
  text(find(el,R+'TextBoxGold/Text'),c.short(inv(HAMMER)));img(find(el,R+'TextBoxGold/GoldImage'),art('decor_hammer'));
  text(find(el,'AnchorTopLeft/Recycle/Text'),'Tái chế');show(find(el,'AnchorTopLeft/WishList'),false);show(find(el,'PopupNewItem'),false);
 }
 function newItems(list,title='Nội thất mới'){
  const el=document.createElement('div');el.className='dc-popup dc-new';el.style.zIndex=String(52+popups.length);
  el.innerHTML=`<div class="dc-new-box"><h3>${esc(title)}</h3><div class="dc-grid">${list.map(i=>tile(i)).join('')}</div><p>Chạm để đóng</p></div>`;
  layer().appendChild(el);popups.push(el);el.addEventListener('click',()=>{el.remove();popups=popups.filter(p=>p!==el)});
  if(data.spines.Open_Furniture){const best=Math.max(...list.map(i=>i.quality));const cv=document.createElement('canvas');cv.width=400;cv.height=400;cv.className='dc-open';el.querySelector('.dc-new-box').prepend(cv);c.spine(cv,{skeleton:data.spines.Open_Furniture,animation:['','Open_Magentas','Open_yellow','Open_red'][best]},{loop:false,scale:.8})}
 }
 function order(kind){
  const el=document.createElement('div');el.className='dc-popup dc-order';el.style.zIndex=String(50+popups.length);let pickC=null,pickF=null,pickH=null;
  const draw=()=>{el.innerHTML=`<div class="dc-order-box" style="background-image:url('${esc(art('decor_bgr_order'))}')"><h3>${kind==='legend'?'Đặt hàng vàng':'Đặt hàng đỏ'}</h3>
   ${kind==='legend'?`<div class="dc-label">1. Chọn nghề</div><div class="dc-row">${Object.entries(classVi).map(([k,v])=>`<button type="button" class="dc-opt ${pickC===k?'on':''}" data-c="${k}"><img src="${esc(art('class_'+k))}" alt=""><small>${v}</small></button>`).join('')}</div>
    <div class="dc-label">2. Chọn hệ</div><div class="dc-row">${Object.entries(factionVi).map(([k,v])=>`<button type="button" class="dc-opt ${pickF===k?'on':''}" data-f="${k}"><img src="${esc(c.assetSrc(c.named('faction_'+k)))}" alt=""><small>${v}</small></button>`).join('')}</div>`
   :`<div class="dc-label">Chọn thuyền viên (nội thất riêng)</div><div class="dc-row dc-heroes">${st().mythicHeroes.filter(id=>c.def(id)).map(id=>`<button type="button" class="dc-opt ${pickH===id?'on':''}" data-h="${esc(id)}"><img src="${esc(c.assetSrc(c.def(id).visual?.head))}" alt=""><small>${esc(heroName(id))}</small></button>`).join('')}</div>`}
   <div class="dc-row dc-end"><button type="button" class="ghost" data-x="cancel">Hủy</button><button type="button" data-x="ok">Xác nhận (${kind==='legend'?'1 Thẻ vàng':'1 Thẻ đỏ'})</button></div></div>`};
  draw();layer().appendChild(el);popups.push(el);
  el.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();
   if(b.dataset.c){pickC=b.dataset.c;return draw()}if(b.dataset.f){pickF=b.dataset.f;return draw()}if(b.dataset.h){pickH=b.dataset.h;return draw()}
   if(b.dataset.x==='cancel'){el.remove();popups=popups.filter(p=>p!==el);return}
   if(b.dataset.x==='ok'){if(kind==='legend'&&(!pickC||!pickF))return c.toast('Cần lựa chọn nghề và hệ');if(kind==='mythic'&&!pickH)return c.toast('Hãy chọn thuyền viên');
    const r=await act(kind==='legend'?'/api/decor/legend':'/api/decor/mythic',kind==='legend'?{clazz:pickC,faction:pickF}:{hero:pickH});if(r){el.remove();popups=popups.filter(p=>p!==el);shop();newItems(r.result.items);fill()}}});
 }

 // ---------------- Kho / tái chế (StoreRoom)
 let room={mode:'view',sel:null,picked:new Set(),cat:'all'};
 function storeroom(mode='view'){
  closePopups();room={mode,sel:null,picked:new Set(),cat:'all'};const el=popup('StoreRoom','dc-store');
  for(const [b,k] of [['ButtonAll','all'],['ButtonBed','1'],['ButtonWindow','2'],['ButtonLight','3']]){const x=find(el,'LayoutGroup/PanelRight/TabCategory/'+b);if(x)x.dataset.cat=k}
  show(find(el,'ButtonTest'),false);drawStore();
 }
 function drawStore(){
  const el=popups.find(p=>p.classList.contains('dc-store'));if(!el)return;const s=st();
  text(find(el,'LayoutGroup/PanelMid/ItemInfo/BoxCountItem/NumberCurrent'),s.items.length);text(find(el,'LayoutGroup/PanelMid/ItemInfo/BoxCountItem/NumberMax'),'/'+s.maxItems);
  for(const x of el.querySelectorAll('[data-cat]')){const on=x.dataset.cat===room.cat;show(find(x,'ImageOn'),on);show(find(x,'ImageOff'),!on)}
  const list=s.items.filter(i=>room.cat==='all'||String(i.place)===room.cat).sort((a,b)=>b.quality-a.quality||a.item-b.item);
  const vp=find(el,'LayoutGroup/PanelMid/ItemInfo/ScrollViewGrid/Viewport');vp.innerHTML=`<div class="dc-grid">${list.map(i=>tile(i,{check:room.mode==='recycle',on:room.mode==='recycle'?room.picked.has(i.uid):room.sel===i.uid})).join('')||'<p class="dc-hint">Kho trống.</p>'}</div>`;
  const info=find(el,'LayoutGroup/PanelLeft/ItemInfo');info.querySelector('.dc-detail')?.remove();show(find(info,'PanelItemDetail'),false);
  const box=document.createElement('div');box.className='dc-detail';
  if(room.mode==='recycle'){const gain=[...room.picked].reduce((n,uid)=>n+s.recycle[s.items.find(i=>i.uid===uid).quality-1],0);
   box.innerHTML=`<h3>Tái chế</h3><p>Chọn nội thất chưa đặt trên tàu. Tím: ${s.recycle[0]}, Vàng: ${s.recycle[1]}, Đỏ: ${s.recycle[2]} Búa gỗ mỗi món.</p>
    <div class="dc-row">${[1,2,3].map(q=>`<button type="button" class="ghost" data-pickq="${q}">Chọn hết ${qName[q]}</button>`).join('')}</div>
    <p class="dc-gain"><img src="${esc(art('decor_hammer'))}" alt=""> Nhận ${gain} Búa gỗ (${room.picked.size} món)</p><button type="button" data-recycle="1" ${room.picked.size?'':'disabled'}>Tái chế</button>`}
  else{const it=s.items.find(i=>i.uid===room.sel);box.innerHTML=it?`<h3 class="q${it.quality}">${esc(it.name)}</h3><div class="dc-big q${it.quality}"><img src="${esc(c.assetSrc(it.image))}" alt=""></div><p>${esc(it.desc)}</p><p>Phẩm ${qName[it.quality]} · ${['','Đồ sàn','Đồ treo tường','Đồ treo trần'][it.place]}</p><p class="dc-eff">${effectText(it)}</p>${it.placed?'<p class="dc-hint">Đang đặt trên tàu.</p>':''}`:'<p class="dc-hint">Chọn một nội thất để xem chi tiết.</p><button type="button" data-mode="recycle">Tái chế</button>'}
  info.appendChild(box);
 }
 /** Chọn thuyền viên cho tầng: tướng đã sở hữu, ưu tiên tướng có bộ nội thất riêng; tướng đã có phòng ở tầng khác bị mờ. */
 function pickHero(done){
  const s=st(),used=new Set(s.floors.map(f=>f.hero).filter(Boolean)),sets=new Set(s.mythicHeroes);
  const list=c.player().heroes.slice().sort((a,b)=>(sets.has(b.id)-sets.has(a.id))||(b.stats?.power||0)-(a.stats?.power||0));
  const el=document.createElement('div');el.className='dc-popup dc-pick';el.style.zIndex=String(54+popups.length);
  el.innerHTML=`<div class="dc-sets-box"><button type="button" class="dc-x" data-x="close" style="background-image:url('${esc(art('popup_close'))}')" aria-label="Đóng"></button><h3>Chọn thuyền viên</h3>
   <div class="dc-grid">${list.map(h=>`<button type="button" class="dc-hpick ${used.has(h.id)?'used':''}" data-h="${esc(h.id)}">${c.heroCard(h,{mini:true})}<small>${sets.has(h.id)?'Có bộ riêng':''}</small></button>`).join('')}</div></div>`;
  layer().appendChild(el);popups.push(el);
  el.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();if(b.dataset.x){el.remove();popups=popups.filter(p=>p!==el);return}
   if(b.dataset.h){if(b.classList.contains('used'))return c.toast('Tướng đã có phòng ở tầng khác.');el.remove();popups=popups.filter(p=>p!==el);await done(b.dataset.h)}});
 }
 // ---------------- Bộ riêng thuyền viên
 function sets(){
  closePopups();const el=document.createElement('div');el.className='dc-popup dc-sets';el.style.zIndex='48';const s=st();
  const owned=new Set(c.player().heroes.map(h=>h.id)),have=new Set(s.items.map(i=>i.point));
  const rows=s.mythicHeroes.filter(id=>owned.has(id)&&c.def(id));
  el.innerHTML=`<div class="dc-sets-box"><button type="button" class="dc-x" data-x="close" style="background-image:url('${esc(art('popup_close'))}')" aria-label="Đóng"></button><h3>Bộ nội thất riêng của thuyền viên</h3>
   <p class="dc-hint">Giao tầng tàu cho thuyền viên và đặt nội thất trong bộ riêng của tướng đó lên tầng: đủ 6 / 12 / 18 món nhận thêm chỉ số.</p>
   <div class="dc-sets-list">${rows.map(id=>{const fl=s.floors.findIndex(f=>f.hero===id);return `<div class="dc-set"><img src="${esc(c.assetSrc(c.def(id).visual?.head))}" alt=""><b>${esc(heroName(id))}</b><small>${fl>=0?`Tầng ${fl+1} · đã đặt ${s.floors[fl].set?.have||0}/18`:'Chưa có phòng'}</small></div>`}).join('')||'<p class="dc-hint">Chưa có thuyền viên nào có bộ nội thất riêng.</p>'}</div></div>`;
  layer().appendChild(el);popups.push(el);el.addEventListener('click',e=>{if(e.target.closest('[data-x]')){el.remove();popups=popups.filter(p=>p!==el)}});
 }

 function popup(name,cls){const el=render(name);el.classList.add('dc-popup',cls);el.style.zIndex=String(48+popups.length);layer().appendChild(el);popups.push(el);el.addEventListener('click',onClick);return el}
 const closePopup=el=>{el.remove();popups=popups.filter(p=>p!==el)};
 const closePopups=()=>{for(const p of popups)p.remove();popups=[]};
 async function refresh(){fill()}

 async function onClick(e){
  const t=e.target.closest('[data-uid],[data-slot],[data-ed],[data-floor],[data-daily],[data-cat],[data-mode],[data-pickq],[data-recycle],.pd-button');if(!t)return;e.stopPropagation();
  const name=t.dataset.name,host=t.closest('.dc-popup');
  try{
   if(t.dataset.daily){if(await act('/api/decor/daily'))fill();return}
   if(host?.classList.contains('dc-editor')){
    if(t.dataset.slot)return editor(edit.floor,Number(t.dataset.slot));
    if(t.dataset.uid){const r=await act('/api/decor/place',{floor:edit.floor,slot:edit.slot,uid:Number(t.dataset.uid)});if(r){fill();editor(edit.floor,edit.slot)}return}
    const k=t.dataset.ed;
    if(k==='back'){closePopups();return fill()}
    if(k==='remove'){if(await act('/api/decor/place',{floor:edit.floor,slot:edit.slot,uid:null})){fill();editor(edit.floor,edit.slot)}return}
    if(k==='auto'||k==='clear'){const r=await act('/api/decor/'+k,{floor:edit.floor});if(r){c.toast(r.result.message);fill();editor(edit.floor,edit.slot)}return}
    if(k==='unhero'){if(await act('/api/decor/hero',{floor:edit.floor,hero:null})){fill();editor(edit.floor,edit.slot)}return}
    if(k==='hero'){const fl=edit.floor;return pickHero(async id=>{const r=await act('/api/decor/hero',{floor:fl,hero:id});if(r){fill();editor(fl,edit?.slot??null)}})}
    return;
   }
   if(host?.classList.contains('dc-store')){
    if(t.dataset.cat){room.cat=t.dataset.cat;return drawStore()}
    if(t.dataset.mode){room.mode=t.dataset.mode;room.picked.clear();return drawStore()}
    if(t.dataset.pickq){for(const i of st().items)if(!i.placed&&i.quality===Number(t.dataset.pickq))room.picked.add(i.uid);return drawStore()}
    if(t.dataset.uid){const uid=Number(t.dataset.uid);if(room.mode==='recycle'){const it=st().items.find(i=>i.uid===uid);if(it.placed)return c.toast('Hãy tháo nội thất khỏi tàu trước khi tái chế.');room.picked.has(uid)?room.picked.delete(uid):room.picked.add(uid)}else room.sel=uid;return drawStore()}
    if(t.dataset.recycle){const gain=[...room.picked].reduce((n,uid)=>n+st().recycle[st().items.find(i=>i.uid===uid).quality-1],0);
     if(!await window.GameMessage.ask(`Bạn sẽ nhận được ${gain} búa gỗ. Bạn có chắc chắn?`,'Tái chế'))return;const r=await act('/api/decor/recycle',{uids:[...room.picked]});if(r){room.picked.clear();fill();drawStore()}return}
    if(name==='ButtonClose'){if(room.mode==='recycle'&&room.fromShop){closePopup(host);return shop()}return closePopup(host)}
    return;
   }
   if(host?.classList.contains('dc-shop')){
    if(name==='ButtonBuy'||name==='ButtonBuyx10'){const n=name==='ButtonBuy'?1:10,s=st();if(inv(HAMMER)<s.price*n)return c.toast('Không đủ Búa gỗ.');const r=await act('/api/decor/create',{count:n});if(r){shop();fill();newItems(r.result.items,r.result.cards?`Nội thất mới · +${r.result.cards} Thẻ vàng`:'Nội thất mới')}return}
    if(name==='ButtonLegendaryOrder'){if(!inv(GOLD))return c.toast('Bạn chưa có Thẻ vàng (chế tạo đủ số lần để nhận).');return order('legend')}
    if(name==='ButtonMythicOrder'){if(!inv(RED))return c.toast('Bạn chưa có Thẻ đỏ.');return order('mythic')}
    if(name==='Recycle'){storeroom('recycle');room.fromShop=true;return}
    if(name==='ButtonInfo')return c.help();
    if(name==='ButtonBackShop'){closePopup(host);return fill()}
    return;
   }
   if(t.dataset.floor!==undefined)return editor(Number(t.dataset.floor));
   if(name==='ButtonBack')return close();
   if(name==='ButtonHelp')return c.help();
   if(name==='ButtonShop')return shop();
   if(name==='ButtonStoreroom')return storeroom();
   if(name==='ButtonGallery')return sets();
  }catch(err){c.toast(err.message)}
 }
 async function open(context){c=context;await load();mount()}
 function close(){closePopups();root?.remove();root=null}
 let loading=null;
 function load(){return data?Promise.resolve(data):loading??=fetch('decor.json').then(r=>r.json()).then(d=>data=d)}
 window.DecorUI={open,close,load,isOpen:()=>!!root,data:()=>data,refresh};
})();
