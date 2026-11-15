/* Giáng sinh / Sinh nhật (bundle `event_xmas`): khung PopupEventXmasBirthday (tab bên trái, Spine Bigmom_bd), các tab
 * PanelEventXmaxGift (4 chiếc tất), PanelEventXmasSanta (CellEventBirthDay: quà tích lũy), PanelEventXmasWish (bánh kem +
 * điều ước), PanelEventXmasPuppet (Bánh Gừng, Túi kì diệu, đổi quà, quà mỗi ngày). Luật ở server/xmas.mjs. */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,root=null,tab='gift',body=null,popups=[],busy=false,timer=null;
 const W=1136,H=640;
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const render=(name,w=W,h=H)=>D.render(data.prefabs[name],w,h,opts());
 const find=(el,p)=>el&&D.find(el,p),show=(el,on)=>D.show(el,on),text=(el,s)=>D.setText(el,String(s??''),false);
 const art=k=>data.art[k]?c.assetSrc(data.art[k]):'';
 const img=(el,src)=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();el.style.backgroundImage=src?`url('${src}')`:'none';el.style.backgroundSize='contain';el.style.backgroundRepeat='no-repeat';el.style.backgroundPosition='center'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
 const layer=()=>document.querySelector('#game-layer');
 const st=()=>c.player().xmas;
 const SNOW='consumable:42',GINGER='consumable:600663';
 const inv=id=>c.player().inventory?.[id]||0;
 const itemIcon=r=>r.itemId==='diamonds'?c.assetSrc(c.named('icon_gem')||c.named('icon_diamond')):r.itemId==='gold'?c.assetSrc(c.named('icon_gold')):c.assetSrc(c.items.get(r.itemId)?.assetKey);
 const itemName=r=>({gold:'Vàng',diamonds:'Kim cương'})[r.itemId]||c.items.get(r.itemId)?.name||r.itemId;
 const clock=sec=>{sec=Math.max(0,Math.floor(sec));const d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60),s=sec%60,p=n=>String(n).padStart(2,'0');return(d?d+' ngày ':'')+`${p(h)}:${p(m)}:${p(s)}`};
 async function act(url,body={}){if(busy)return null;busy=true;try{return await c.mutation(url,body,{close:false,render:false,bonus:true,message:false})}finally{busy=false}}
 const tiles=list=>list.map(r=>c.eventTile(r,'xm-tile')).join('');
 const spineIn=(host,name,anim,{w=300,h=300,scale=.6,cls='xm-spine'}={})=>{if(!host||!data.spines[name])return;const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.className=cls;host.appendChild(cv);c.spine(cv,{skeleton:data.spines[name],animation:anim},{loop:true,scale})};
 const tabs=[['gift','Quà tất','gift1'],['santa','Tích lũy','giftBasket1'],['wish','Điều ước','icon_wish'],['bag','Túi kì diệu','hop_qua']];

 function mount(){
  closePopups();root?.remove();clearInterval(timer);
  root=render('PopupEventXmasBirthday',W,H);root.classList.add('xm-root');layer().appendChild(root);root.addEventListener('click',onClick);
  show(find(root,'TitleBar'),true);text(find(root,'TitleBar/TextTitle'),st().title);
  for(const n of ['GroupMiscImage/ImageIconTopLeft','GroupMiscImage/ImageIconTopRight','GroupMiscImage/ImageIconBottomRight','ImageGiftBox'])show(find(root,n),false);
  spineIn(find(root,'GroupMiscImage/SpineObjectTopLeft/Skeleton'),'Bigmom_bd','animation',{w:420,h:340,scale:.38});
  spineIn(find(root,'GroupMiscImage/SpineObjectTopRight/Skeleton'),'Band1','Band1',{w:300,h:200,scale:.5});
  // Tab bên trái (ScrollTabButton): nút tab gốc ButtonTabEvent2 (1..4), biểu tượng từng tab.
  const content=find(root,'TabManager/ScrollTabButton/Viewport/Content');
  [...content.children].forEach((b,i)=>{const t=tabs[i];if(!t)return show(b,false);b.dataset.tab=t[0];b.classList.add('xm-tab');b.innerHTML=`<img src="${esc(art(t[2]))}" alt=""><b>${t[1]}</b>`});
  timer=setInterval(()=>{if(!root?.isConnected)return clearInterval(timer);for(const el of root.querySelectorAll('[data-name="TextCountTime"]'))text(el,clock((st().endsAt-Date.now())/1000))},1000);
  showTab(tab);
 }
 function showTab(k){
  tab=k;for(const b of root.querySelectorAll('.xm-tab'))b.classList.toggle('on',b.dataset.tab===k);
  root.querySelector(':scope>.xm-frame')?.remove();
  body=render({gift:'PanelEventXmaxGift',santa:'PanelEventXmasSanta',wish:'PanelEventXmasWish',bag:'PanelEventXmasPuppet'}[k],1000,580);body.classList.add('xm-body');const frame=document.createElement('div');frame.className='xm-frame';frame.appendChild(body);root.appendChild(frame);
  for(const n of ['TitleBar','ImageBgr/TextTitle','BoxCountDown'])show(find(body,n),false);
  // Thứ tự vẽ: nội dung tab < tab trái / trang trí < thanh tiêu đề < nút đóng.
  for(const n of ['TabManager','GroupMiscImage','TitleBar','ButtonClose'])root.appendChild(find(root,n));
  for(const el of body.querySelectorAll('[data-name="TextCountTime"]'))text(el,clock((st().endsAt-Date.now())/1000));
  ({gift,santa,wish,bag})[k]();
 }
 // ---- Quà tất
 function gift(){
  const s=st();show(find(body,'Container'),true);show(find(body,'Container/Line'),false);
  s.socks.forEach((x,i)=>{const g=find(body,`Container/GroupSock${i+1}`),btn=find(g,'Button');btn.dataset.sock=i;
   const label=!x.bought?(x.price?c.short(x.price.quantity):'Miễn phí'):x.today?'Nhận':x.done?'Đã xong':`Ngày ${x.received}/${x.total}`;
   text(find(btn,'Text'),label);show(find(btn,'Icon'),!x.bought&&!!x.price);if(x.price)img(find(btn,'Icon'),itemIcon(x.price));
   btn.classList.toggle('xm-off',x.bought&&!x.today);const bg=find(g,'SockBgr');bg.dataset.sockInfo=i;img(bg,art('c'+(i+1)));bg.style.backgroundSize='100% 100%';
   const tag=document.createElement('span');tag.className='xm-sockname';tag.textContent=`${x.name} · ${x.days} ngày`;g.appendChild(tag)});
  const h=find(body,'ButtonHelp');if(h)h.dataset.help='1';
 }
 // ---- Quà tích lũy
 const kindText={sock:'Nhận quà tất',bag:'Mở Túi kì diệu',wish:'Mở hộp điều ước',snow:'Thu thập Bông Tuyết'};
 function santa(){
  const s=st(),vp=find(body,'ListQuestItem/ScrollView/Viewport'),tpl=find(body,'ListQuestItem/CellEventBirthDay');show(tpl,false);vp.innerHTML='';
  const list=document.createElement('div');list.className='xm-list';vp.appendChild(list);
  for(const m of [...s.milestones].sort((a,b)=>(a.status===2)-(b.status===2)||a.need-b.need)){const cell=tpl.cloneNode(true);cell.style.display='';cell.classList.add('xm-cell');
   text(find(cell,'QuestItem/TextQuestDesc'),`${kindText[m.kind]} ${c.short(m.need)} lần`.replace('Thu thập Bông Tuyết '+c.short(m.need)+' lần','Thu thập '+c.short(m.need)+' Bông Tuyết'));
   text(find(cell,'QuestItem/Slider/TextSumDesc'),`${c.short(Math.min(m.have,m.need))}/${c.short(m.need)}`);const fill=find(cell,'QuestItem/Slider/Fill Area');if(fill){fill.style.width=Math.min(1,m.have/m.need)*221+'px';fill.classList.add('xm-fill')}
   show(find(cell,'Scroll View'),false);find(cell,'GroupRewardsTo').innerHTML=`<div class="xm-row">${tiles(m.rewards)}</div>`;
   const box=find(cell,'Image');box.dataset.claim=m.id;img(box,art(m.status===2?'gitf2a':'gift1'));show(find(box,'CheckReivced'),m.status===2);box.classList.toggle('xm-ready',m.status===1);
   text(find(cell,'TextLimit/TextLimit (1)'),m.status===2?'Đã nhận':m.status===1?'Nhận quà':'');list.appendChild(cell)}
 }
 // ---- Điều ước
 function wish(){
  const s=st(),ct=find(body,'Container');show(ct,true);show(find(ct,'ImageCake'),false);
  spineIn(find(ct,'SpineCake/Skeleton'),'Cake','Cake',{w:420,h:440,scale:.7,cls:'xm-cake'});find(ct,'SpineCake').dataset.wishOpen='1';
  text(find(ct,'GroupBuyBadge/NumberBadge'),c.short(inv(SNOW)));img(find(ct,'GroupBuyBadge/Bgr/ImageBadge'),itemIcon({itemId:SNOW}));show(find(ct,'GroupBuyBadge/ButtonAdd'),false);
  for(let i=0;i<4;i++){const g=find(ct,`GroupSock${i+1}`),w=s.wishes[i];if(!w){show(g,false);continue}
   const a=find(g,'GroupContent/ImgAvatar');a.innerHTML=c.eventTile(w,'xm-wishtile').replace(/data-info-[a-z]+="[^"]*"/g,'');a.dataset.wishSet=i;img(a,'');show(find(g,'GroupContent/SpineObject'),false);
   text(find(g,'GroupContent/Name'),itemName(w));text(find(g,'BottomGroup/TextTurn'),s.wish===i?'Đang ước':'Chọn');img(find(g,'BottomGroup/Icon'),art(s.wish===i?'tick_green':'icon_wish'));g.classList.toggle('xm-picked',s.wish===i)}
  const bar=document.createElement('div');bar.className='xm-wishbar';
  bar.innerHTML=`<span>Tỉ lệ ra món đã ước: ${(s.wishRate/10).toFixed(1)}% · Còn ${s.wishLeft} lần</span><button type="button" data-wish="1"><img src="${esc(itemIcon({itemId:SNOW}))}" alt="">${s.wishCost} · Ước x1</button><button type="button" data-wish="10"><img src="${esc(itemIcon({itemId:SNOW}))}" alt="">${s.wishCost*10} · Ước x10</button>`;
  ct.appendChild(bar);
 }
 // ---- Túi kì diệu / đổi quà / quà mỗi ngày
 function bag(){
  const s=st(),ct=find(body,'Container');show(ct,true);show(find(ct,'SpineHero'),false);
  const tl='GroupTopLeft/';text(find(ct,tl+'GroupBadge/NumberBadge'),c.short(inv(GINGER)));img(find(ct,tl+'GroupBadge/Bgr/ImageBadge'),itemIcon({itemId:GINGER}));find(ct,tl+'GroupBadge/ButtonAdd (1)').dataset.buy='1';
  text(find(ct,tl+'GroupBuyBadge/NumberBadge'),c.short(inv(SNOW)));img(find(ct,tl+'GroupBuyBadge/Bgr/ImageBadge'),itemIcon({itemId:SNOW}));show(find(ct,tl+'GroupBuyBadge/ButtonAdd'),false);
  const ev='GroupEvent/';text(find(ct,ev+'SnowPlake/NameEvent'),'Túi kì diệu (1 Bánh Gừng)');find(ct,ev+'SnowPlake/Image').dataset.bag='1';
  spineIn(find(ct,ev+'SnowPlake/SpineObject/Skeleton'),'Bag','Bag',{w:300,h:260,scale:.55,cls:'xm-bagspine'});
  text(find(ct,ev+'PuppetRedeem/NameEvent'),'Đổi quà');find(ct,ev+'PuppetRedeem/Image').dataset.shop='1';spineIn(find(ct,ev+'PuppetRedeem/SpineObject/Skeleton'),'Box','Red',{w:260,h:240,scale:.5,cls:'xm-boxspine'});
  text(find(ct,ev+'PuppetReplace/NameEvent'),s.gingerReady?`Quà mỗi ngày: ${s.dailyGinger} Bánh Gừng`:'Đã nhận quà hôm nay');find(ct,ev+'PuppetReplace/Image').dataset.daily='1';find(ct,ev+'PuppetReplace').classList.toggle('xm-off',!s.gingerReady);
  spineIn(find(ct,ev+'PuppetReplace/SpineObject/Skeleton'),'Box','Green',{w:260,h:240,scale:.5,cls:'xm-boxspine'});
  const bar=document.createElement('div');bar.className='xm-bagbar';bar.innerHTML=`<button type="button" data-bag="1">Mở x1</button><button type="button" data-bag="10">Mở x10</button>`;ct.appendChild(bar);
 }
 function shopPopup(){
  closePopups();const s=st(),el=document.createElement('div');el.className='xm-popup';el.style.zIndex='50';
  el.innerHTML=`<div class="xm-shop" style="background-image:url('${esc(art('popup_body'))}')"><button type="button" class="xm-x" data-x="1" style="background-image:url('${esc(art('button_Close')||art('popup_close'))}')" aria-label="Đóng"></button><h3>Đổi quà Bông Tuyết <span><img src="${esc(itemIcon({itemId:SNOW}))}" alt="">${c.short(inv(SNOW))}</span></h3>
   <div class="xm-shoplist">${s.shop.map(x=>{const left=x.limit-x.bought;return `<div class="xm-shoprow">${c.eventTile(x.reward,'xm-tile')}<div><b>${esc(itemName(x.reward))} x${c.short(x.reward.quantity)}</b><small>Còn ${left}/${x.limit} lần</small></div><button type="button" data-buyshop="${x.id}" ${left>0?'':'disabled'}><img src="${esc(itemIcon({itemId:SNOW}))}" alt="">${x.price}</button></div>`}).join('')}</div></div>`;
  layer().appendChild(el);popups.push(el);el.addEventListener('click',onClick);
 }
 function closePopups(){for(const p of popups)p.remove();popups=[]}

 async function onClick(e){
  const t=e.target.closest('[data-tab],[data-sock],[data-sock-info],[data-claim],[data-wish-set],[data-wish],[data-wish-open],[data-bag],[data-buy],[data-shop],[data-daily],[data-buyshop],[data-x],[data-help],.pd-button');if(!t)return;
  if(e.target.closest('.ev-tile')&&!t.dataset.wishSet)return;e.stopPropagation();
  const name=t.dataset.name;
  try{
   if(t.dataset.x){closePopups();return}
   if(t.dataset.tab)return showTab(t.dataset.tab);
   if(t.dataset.help||name==='ButtonHelp')return c.help();
   if(t.dataset.sockInfo!==undefined){const x=st().socks[Number(t.dataset.sockInfo)];return c.modal(x.name,`<p class="item-description">Nhận mỗi ngày trong ${x.days} ngày:</p><div class="xm-row">${tiles(x.daily)}</div>`)}
   if(t.dataset.sock!==undefined){const i=Number(t.dataset.sock),x=st().socks[i];
    if(!x.bought){if(x.price&&!await window.GameMessage.ask(`Treo ${x.name} với giá ${c.short(x.price.quantity)} ${itemName(x.price)}? Nhận quà mỗi ngày trong ${x.days} ngày.`,st().title))return;if(!await act('/api/xmas/sock-buy',{index:i}))return;
     if(st().socks[i].today)await act('/api/xmas/sock-claim',{index:i});return showTab('gift')}
    if(x.today){if(await act('/api/xmas/sock-claim',{index:i}))showTab('gift');return}
    return c.toast(x.done?'Chiếc tất đã nhận đủ quà.':'Hôm nay đã nhận, hãy quay lại ngày mai.')}
   if(t.dataset.claim){const m=st().milestones.find(x=>x.id===Number(t.dataset.claim));if(m.status!==1)return c.toast(m.status===2?'Đã nhận quà mốc này.':'Chưa đủ điều kiện.');if(await act('/api/xmas/milestone',{id:m.id}))showTab('santa');return}
   if(t.dataset.wishSet!==undefined){if(await act('/api/xmas/wish-set',{index:Number(t.dataset.wishSet)}))showTab('wish');return}
   if(t.dataset.wish||t.dataset.wishOpen){const n=Number(t.dataset.wish||1),s=st();if(s.wish===null)return c.toast('Hãy chọn món muốn ước trước.');if(inv(SNOW)<s.wishCost*n)return c.toast('Không đủ Bông Tuyết.');
    const r=await act('/api/xmas/wish',{count:n});if(r){if(r.result?.hit)c.toast(r.result.message);showTab('wish')}return}
   if(t.dataset.bag){const n=Number(t.dataset.bag);if(inv(GINGER)<n)return c.toast('Không đủ Bánh Gừng.');if(await act('/api/xmas/bag',{count:n}))showTab('bag');return}
   if(t.dataset.buy){const s=st();if(!s.gingerLeft)return c.toast('Hôm nay đã hết lượt mua.');if(!await window.GameMessage.ask(`Mua 1 Bánh Gừng với giá ${s.gingerPrice} kim cương? (Hôm nay còn ${s.gingerLeft})`,s.title))return;if(await act('/api/xmas/ginger-buy',{count:1}))showTab('bag');return}
   if(t.dataset.daily){if(!st().gingerReady)return c.toast('Hôm nay đã nhận.');if(await act('/api/xmas/ginger'))showTab('bag');return}
   if(t.dataset.shop)return shopPopup();
   if(t.dataset.buyshop){const x=st().shop.find(y=>y.id===Number(t.dataset.buyshop));if(inv(SNOW)<x.price)return c.toast('Không đủ Bông Tuyết.');if(!await window.GameMessage.ask(`Đổi ${x.price} Bông Tuyết lấy ${itemName(x.reward)} x${c.short(x.reward.quantity)}?`,'Đổi quà'))return;if(await act('/api/xmas/shop',{id:x.id,count:1})){shopPopup();showTab(tab)}return}
   if(name==='ButtonClose')return close();
  }catch(err){c.toast(err.message)}
 }
 async function open(context){c=context;await load();tab='gift';mount()}
 function close(){closePopups();clearInterval(timer);root?.remove();root=null}
 let loading=null;
 function load(){return data?Promise.resolve(data):loading??=fetch('xmas.json').then(r=>r.json()).then(d=>data=d)}
 window.XmasUI={open,close,load,isOpen:()=>!!root,data:()=>data};
})();
