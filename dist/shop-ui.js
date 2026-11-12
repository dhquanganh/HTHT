/* Cửa hàng — PopupShop gốc (scene 1404) dựng bằng PrefabDOM.
 *   Nền bgr_shop2 + Nami (ImageNami), thanh tiêu đề "Cửa hàng", nút Trở về.
 *   TabManager (ButtonTabShop): Chợ đen (SHOP_MARKET, server/shop.mjs) và Cửa hàng huyết tế (SHOP_ALTAR, server/altar.mjs).
 *   Kệ hàng: mỗi CellPopupShop là một tầng kệ (shelves1) chứa 3 ShopItem (GameItem + nút giá IconPrice / TextPrice,
 *   PriceInactive khi đã mua). GroupAsset: tiền tệ của tab. ButtonRefresh (kim cương) và GroupRefresh "Làm mới sau".
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,root=null,src=null,tab='market',timer=0,busy=false;
 const deep=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=deep(k,name);if(r)return r}return null};
 const kid=(n,path)=>path.split('/').reduce((x,p)=>x&&(x.children||[]).find(k=>k.name===p),n);
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const pic=(n,key)=>{const x=comp(n,'Image');if(x&&key)x.asset=key};
 const tag=(n,v)=>{if(n)n.shop=v;return n};
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5},m_LocalScale:{x:1,y:1,z:1}};
 const p=()=>c.player();
 const fmt=ms=>{ms=Math.max(0,ms);const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return[h,m,s%60].map(x=>String(x).padStart(2,'0')).join(':')};
 const nextDay=()=>{const D_=86400000;return(Math.floor((Date.now()+7*3600000)/D_)+1)*D_-7*3600000};
 const soulItem='consumable:7',book='material:seal-book',bookDL='material:seal-book-dl';
 const currencyIcon=id=>id==='gold'?c.named('icon_gold'):id==='diamonds'?c.named('icon_gem'):id===soulItem?c.named('icon_soul_coin'):id===book?c.named('icon_seal_book_normal'):id===bookDL?c.named('icon_seal_book_dl'):c.named('icon_gem');
 const balance=id=>id==='gold'||id==='diamonds'?p().wallet[id]||0:p().inventory?.[id]||0;
 const tabs=[{id:'market',title:I2('LBL_POPUP_SHOP_TITLE_MARKET','Chợ đen')},{id:'altar',title:I2('LBL_POPUP_SHOP_TITLE_ALTAR','Huyết tế')},{id:'sealed',title:I2('LBL_SEALAND','Mê cung')}];
 // Danh sách hàng của tab: {key, reward, price, sold, note}
 function goods(){
  if(tab==='market')return p().shop.items.map(o=>({key:o.slot,reward:o.reward,price:o.price,sold:o.bought}));
  if(tab==='sealed')return p().shop.sealed.map(o=>({key:o.id,reward:o.reward,price:o.price,sold:o.bought>=o.limit,note:`${o.limit-o.bought}/${o.limit}`}));
  return(p().altar?.shop||[]).map(o=>({key:o.id,reward:o.reward,price:{itemId:soulItem,quantity:o.cost},sold:o.bought>=o.limit,note:`${o.limit-o.bought}/${o.limit}`}));
 }
 async function open(t){
  try{src??=await fetch('scenes/1404.json').then(r=>r.json());if(t)tab=t;if(tab==='altar'&&!p().altar)await c.api('/api/state').catch(()=>{});render();clearInterval(timer);timer=setInterval(tick,1000)}catch(e){c.toast(e.message)}
 }
 function tick(){if(!root?.isConnected)return clearInterval(timer);const at=tab==='market'?p().shop.resetAt:nextDay();if(at<=Date.now()){c.api('/api/state').then(render).catch(()=>{});return}const t=D.find(root,'TextCountdown');if(t)D.setText(t,fmt(at-Date.now()))}
 function render(){
  const n=structuredClone(src.roots[0]);n.transform={...full};const list=goods();
  txt(deep(n,'TextTitle'),I2('LBL_HOME_2_SCENE_SHOP','Cửa hàng'));tag(deep(n,'ButtonBack'),{act:'back'});
  // Tab: nhân bản ButtonTabShop theo từng cửa hàng.
  const mgr=deep(n,'TabManager'),tpl=kid(mgr,'ButtonTabShop');
  mgr.children=tabs.map(t=>{const b=structuredClone(tpl);b.name='Tab_'+t.id;on(kid(b,'ImageOn'),t.id===tab);on(kid(b,'ImageOff'),t.id!==tab);txt(kid(b,'Text'),t.title);tag(b,{act:'tab',tab:t.id});return b});
  // Tiền tệ của tab.
  const assets=deep(n,'GroupAsset'),show=tab==='market'?['FieldGem','FieldGold']:tab==='sealed'?['FieldSealBookNormal','FieldSealBookDL']:['FieldGem','FieldSoulCoin'];
  for(const f of assets.children){on(f,show.includes(f.name));const v={FieldGem:balance('diamonds'),FieldGold:balance('gold'),FieldSoulCoin:balance(soulItem),FieldSealBookNormal:balance(book),FieldSealBookDL:balance(bookDL)}[f.name];if(v!==undefined)txt(kid(f,'TextValue'),c.num(v))}
  // Làm mới.
  const refresh=deep(n,'ButtonRefresh');on(refresh,tab==='market');txt(kid(refresh,'Text'),I2('LBL_REFRESH','Làm mới'));txt(deep(refresh,'TextCost'),p().shop.refreshCost);tag(refresh,{act:'refresh'});
  txt(deep(n,'TextRefresh'),I2('LBL_REFESH_AFTER','Làm mới sau:'));txt(deep(n,'TextCountdown'),fmt((tab==='market'?p().shop.resetAt:nextDay())-Date.now()));
  // Kệ hàng: mỗi tầng 3 món.
  const cellTpl=deep(n,'CellPopupShop'),itemTpl=kid(cellTpl,'ShopItem'),rows=[];
  for(let i=0;i<list.length;i+=3){const row=structuredClone(cellTpl);on(row,true);on(kid(row,'ShopItem'),false);row.children=row.children.filter(k=>k.name!=='ShopItem');
   kid(row,'ParentItem').children=list.slice(i,i+3).map(g=>shopItem(itemTpl,g));rows.push(row)}
  deep(n,'child_bgr').children=deep(n,'child_bgr').children.filter(k=>k!==cellTpl);
  const content=kid(deep(n,'Scroll View'),'Viewport/Content'),height=rows.length*150+12;
  content.transform={...content.transform,m_AnchorMin:{x:0,y:1},m_AnchorMax:{x:1,y:1},m_Pivot:{x:.5,y:1},m_AnchoredPosition:{x:0,y:0},m_SizeDelta:{x:0,y:height}};
  content.components=[{type:'VerticalLayoutGroup',spacing:0,padding:[0,0,6,6],align:1,controlWidth:true,forceWidth:true}];content.children=rows;
  const old=root?.querySelector('[data-name="Viewport"]')?.scrollTop||0;root?.remove();
  root=D.render(n,W,H,{assetSrc:c.assetSrc,assets:c.assets()});root.classList.add('shop-layer');c.layer().appendChild(root);
  for(const x of root.querySelectorAll('.pd-node')){const t=x._node?.shop;if(t){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();handle(t)}}
   const g=x._node?.shopGood;if(g){const box=document.createElement('div');box.className='shop-reward'+(g.sold?' sold':'');box.innerHTML=c.rewardTile(g.reward)+(g.note?`<i class="shop-limit">${c.escape(g.note)}</i>`:'');x.appendChild(box)}}
  const vp=root.querySelector('[data-name="Viewport"]');if(vp)vp.scrollTop=old;
 }
 function shopItem(tpl,g){
  const n=structuredClone(tpl);on(n,true);const item=deep(n,'GameItem');for(const k of item.children||[])on(k,false);item.shopGood=g;
  const price=kid(n,'Price'),off=kid(n,'PriceInactive');on(price,!g.sold);on(off,g.sold);on(deep(n,'SpineEffect'),false);
  pic(kid(price,'IconPrice'),currencyIcon(g.price.itemId));txt(kid(price,'TextPrice'),c.short(g.price.quantity));
  on(kid(off,'IconPrice'),false);txt(kid(off,'TextPrice'),g.note?'Hết lượt':'Đã mua');
  tag(price,{act:'buy',good:g});tag(item,{act:'info',good:g});return n;
 }
 async function act(url,body){if(busy)return null;busy=true;try{return await c.mutation(url,body,{render:false,close:false,message:false})}finally{busy=false;if(root)render()}}
 function handle(t){
  if(t.act==='back'){close();return c.navigate(13)}
  if(t.act==='tab'){tab=t.tab;return open()}
  if(t.act==='info')return c.itemInfo?.(t.good.reward.itemId);
  if(t.act==='refresh')return c.confirm(I2('MSG_POPUP_SHOP_ASK_REFRESH_SHOP','Bạn có chắc muốn làm mới lại cửa hàng?'),I2('LBL_REFRESH','Làm mới'),p().shop.refreshCost,()=>act('/api/shop/buy',{op:'refresh'}),{okText:I2('LBL_REFRESH','Làm mới')});
  if(t.act==='buy'){
   const g=t.good,name=c.items.get(g.reward.itemId)?.name||({gold:'Beli',diamonds:'Kim cương',spirit:'Linh hồn'})[g.reward.itemId]||g.reward.itemId;
   if(balance(g.price.itemId)<g.price.quantity)return c.toast(g.price.itemId==='gold'?'Không đủ Beli.':g.price.itemId==='diamonds'?'Không đủ kim cương.':g.price.itemId===soulItem?'Không đủ Hồn hải tặc.':`Không đủ ${c.items.get(g.price.itemId)?.name||'vật phẩm'}.`);
   const text=`Mua ${name} x${c.num(g.reward.quantity)}?`,go=async()=>{const r=tab==='market'?await act('/api/shop/buy',{op:'buy',slot:g.key}):tab==='sealed'?await act('/api/shop/buy',{op:'sealed-buy',id:g.key}):await act('/api/altar',{op:'buy',id:g.key});if(r)c.bonusPopup(r.result?.rewards||[g.reward])};
   return g.price.itemId!=='gold'&&g.price.itemId!=='diamonds'?c.confirm(`${text} (${c.num(g.price.quantity)} ${c.items.get(g.price.itemId)?.name||'Hồn hải tặc'})`,I2('LBL_BUY','Mua'),null,go):c.confirm(text,I2('LBL_BUY','Mua'),g.price.quantity,go,{currency:g.price.itemId});
  }
 }
 function close(){clearInterval(timer);root?.remove();root=null}
 window.ShopUI={init(ctx){c=ctx},open,close,isOpen:()=>!!root};
})();
