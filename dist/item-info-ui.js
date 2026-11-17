/* Thông tin vật phẩm khi chạm ô quà ở các sự kiện — PopupItemInfo gốc (scene 1417) dựng bằng PrefabDOM.
 *   ImgBgr (round_rect_8) · Infor: TextTitle (tên), GameItem (ô vật phẩm), TextInfo (loại, số đang có) · TextDesc (mô tả).
 *   Nút hành động (GroupButton), bộ trang bị, nút nhận / xem trước của prefab không dùng ở đây (chỉ xem thông tin).
 *   Ô quà nào có data-info-item (eventTile trong game.js) và không nằm trong nút thao tác đều mở popup này.
 *   Rương có đồ bên trong (chests.json): ô vật phẩm và nút ButtonInfoPreview gốc mở bảng xem trước — PopupShowListRewards gốc
 *   (scene 1150: nền Content, TextTitle, ButtonClose) với lưới các món trong rương; chạm từng món để xem thông tin của món đó.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,src=null,layer=null,pvSrc=null,preview=null;
 const deep=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=deep(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const place=(n,{x=0,y=0,w,h,ax=.5,ay=.5}={})=>{n.transform={...n.transform,m_AnchorMin:{x:ax,y:ay},m_AnchorMax:{x:ax,y:ay},m_Pivot:{x:.5,y:.5},m_AnchoredPosition:{x,y},...(w?{m_SizeDelta:{x:w,y:h}}:{})}};
 const strip=n=>{n.components=(n.components||[]).filter(x=>!['HorizontalLayoutGroup','VerticalLayoutGroup','ContentSizeFitter','LayoutElement'].includes(x.type));for(const k of n.children||[])strip(k)};
 const kinds={equipment:'Trang bị',artifact:'Bảo vật',consumable:'Vật phẩm',material:'Nguyên liệu',shard:'Mảnh ghép'};
 const walletInfo={gold:['Vàng','Tiền tệ dùng để nâng cấp, rèn đồ và mua sắm.'],diamonds:['Kim cương','Tiền tệ cao cấp dùng để mua vật phẩm, làm mới và mua lượt.'],spirit:['EXP tướng','Dùng để nâng cấp thuyền viên.'],vipExp:['EXP VIP','Tích lũy để tăng cấp VIP.']};
 function info(id){
  const p=c.player(),item=c.items.get(id),wallet=walletInfo[id];
  const sp=c.special?.(id);if(sp)return{name:sp.name,kind:sp.label,desc:sp.desc,have:null};
  if(id.startsWith('hero:')){const h=c.hero?.(id.slice(5));return{name:h?.name||'Thuyền viên',kind:'Thuyền viên'+(h?.grade?` bậc ${h.grade}`:''),desc:'Nhận thuyền viên này. Nếu đã có thì đổi thành mảnh để nâng sao.',have:null}}
  if(item)return{name:item.name,kind:kinds[item.category]||'Vật phẩm',desc:item.description&&item.description!==item.name?item.description:'',have:item.category==='equipment'||item.category==='artifact'?null:p.inventory?.[id]||0,rarity:item.rarity};
  if(wallet)return{name:wallet[0],kind:'Tiền tệ',desc:wallet[1],have:id==='vipExp'?p.vipExp||0:p.wallet?.[id]||0};
  return{name:id,kind:'Vật phẩm',desc:'',have:null};
 }
 // Màu chữ dạng RGBA 0..1 như Text của prefab; vật phẩm không có phẩm giữ màu vàng gốc của TextTitle.
const rarityColor={gray:[.85,.85,.85,1],green:[.48,.88,.35,1],blue:[.35,.71,1,1],purple:[.82,.48,1,1],yellow:[1,.85,.29,1],orange:[1,.6,.24,1],red:[1,.35,.29,1]};
 // fit: chiều cao phần mô tả đo được ở lần vẽ trước (chữ dài thì vẽ lại cho vừa).
 async function show(id,quantity=1,fit=null){
  try{src??=await fetch('scenes/1417.json').then(r=>r.json())}catch{return}
  const chest=id.startsWith('hero:')?null:(await c.chests?.())?.[id]||null;
  close();const it=info(id),n=structuredClone(src.roots[0]);strip(n);it.detail=id.startsWith('hero:')?'':c.detail?.(id)||'';
  const detailRows=(it.detail.match(/<p|<h3/g)||[]).length;
  n.transform={...n.transform,m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0}};n.components=(n.components||[]).filter(x=>x.type!=='Image');
  const panel=deep(n,'PanelGroup'),bg=deep(n,'ImgBgr'),infor=deep(n,'Infor'),desc=deep(n,'TextDesc');
  place(deep(n,'Content'),{w:W,h:H});place(panel,{w:W,h:H});
  const body=it.desc||it.detail,lines=(it.desc?Math.ceil(it.desc.length/34):0)+detailRows,bodyH=body?Math.min(fit?360:220,fit??lines*28+24):0,h=172+bodyH;
  place(bg,{w:470,h});
  place(infor,{x:0,y:h/2-90,w:430,h:150});
  // Tên (TextTitle), ô vật phẩm (GameItem: ẩn các dạng ô của prefab, vẽ ô quà chung lên trên), thông tin (TextInfo).
  // Tên dài (vd. mảnh trái ác quỷ): xuống tối đa 2 dòng, cỡ chữ giảm vừa phải.
  const longName=it.name.length>22;const title=deep(infor,'TextTitle');txt(title,it.name);place(title,longName?{x:58,y:48,w:300,h:56}:{x:58,y:42,w:300,h:34});{const t=comp(title,'Text');if(t){t.align=3;t.overflow=0;t.size=longName?Math.max(19,Math.min(22,Math.floor(600/it.name.length*1.7))):t.size||26;t.bestFit=false;if(rarityColor[it.rarity])t.color=rarityColor[it.rarity]}}
  const game=deep(infor,'GameItem');for(const k of game.children||[])on(k,false);place(game,{x:-150,y:-8,w:96,h:96});game.infoTile=true;
  const line=deep(infor,'TextInfo');txt(line,[it.kind,quantity>1?`Số lượng: ${c.num(quantity)}`:null,it.have!==null?`Đang có: ${c.num(it.have)}`:null].filter(Boolean).join('\n'));place(line,{x:58,y:-14,w:300,h:70});{const t=comp(line,'Text');if(t){t.align=3;t.overflow=1}}
  on(deep(infor,'ButtonUpgrade'),false);
  on(desc,!!body);if(body){txt(desc,it.desc||'');place(desc,{x:0,y:-h/2+bodyH/2+16,w:420,h:bodyH});const t=comp(desc,'Text');if(t){t.align=0;t.overflow=0}}
  for(const name of ['GroupEquipmentSet','GroupButton','GroupExtra','PanelDrop'])on(deep(n,name),false);
  // Nút xem trước gốc (ButtonInfoPreview, kính lúp) đặt ở góc dưới phải ô vật phẩm.
  if(chest){const extra=deep(n,'GroupExtra'),pv=deep(n,'ButtonInfoPreview');on(extra,true);for(const k of extra.children||[])on(k,k===pv);place(extra,{w:470,h});on(pv,true);place(pv,{x:-104,y:h/2-90-8-40,w:44,h:44});pv.infoPreview=true}
  const x=deep(n,'ButtonClose');on(x,true);place(x,{x:235-6,y:h/2-6,w:57,h:57});x.infoClose=true;
  const shade={id:'iis',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.55]}],transform:{m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5}},children:[]};
  layer=D.render({id:'iir',name:'ItemInfoLayer',active:true,components:[],transform:shade.transform,children:[shade,n]},W,H,{assetSrc:c.assetSrc,assets:c.assets()});
  layer.classList.add('item-info-layer');c.layer().appendChild(layer);
  for(const el of layer.querySelectorAll('.pd-node')){
   if(el._node?.infoTile){const box=document.createElement('div');box.className='item-info-tile';box.innerHTML=id.startsWith('hero:')?heroTile(id.slice(5),quantity):c.tile({itemId:id,quantity});el.appendChild(box);
    if(chest){box.classList.add('item-info-chest');box.title='Xem trước vật phẩm trong rương';box.onclick=e=>{e.stopPropagation();openPreview(id,chest)}}}
   if(el._node?.infoPreview){el.classList.add('pd-button');el.title='Xem trước';el.onclick=e=>{e.stopPropagation();openPreview(id,chest)}}
   if(el._node?.infoClose){el.classList.add('pd-button');el.onclick=e=>{e.stopPropagation();close()}}
  }
  D.find(layer,'Shade').onclick=close;D.find(layer,'ImgBgr').onclick=e=>e.stopPropagation();
  // Mô tả dài hơn ô ước lượng: đo chiều cao chữ thật rồi vẽ lại một lần (tối đa 360, quá nữa thì cuộn trong ô).
  const d=body&&D.find(layer,'TextDesc');
  // Chỉ số / hiệu ứng (giống popup túi đồ) nằm dưới mô tả, đo chung chiều cao.
  if(d&&it.detail){const t=d.querySelector('.pd-text');if(t)t.insertAdjacentHTML('beforeend',`<div class="item-info-detail">${it.detail}</div>`)}
  if(d&&fit===null){const need=Math.ceil(d.querySelector('.pd-text')?.offsetHeight||0)+10;if(need>bodyH+2||need<bodyH-30)return show(id,quantity,Math.max(40,need))}
  if(d)d.classList.add('item-info-desc');
 }
 function close(){layer?.remove();layer=null}
 const heroTile=(avatar,quantity=1)=>{const h=c.hero?.(avatar);return `<span class="ev-tile chest-pv-hero" title="${h?.name||''}" data-info-item="hero:${avatar}" data-info-qty="${quantity}"><img src="${h?.head?c.assetSrc(h.head):''}" alt="${h?.name||''}"><b>${quantity>1?c.num(quantity):''}</b></span>`};
 // Phần thưởng trong chests.json: {kind:'item'|'gold'|'diamonds'|'hero'|'pet'|'petShard'|'fruit'|'fruitShard'|'avatar', itemId?, avatar?, id?, quantity}.
 const special=new Set(['pet','petShard','fruit','fruitShard','avatar']);
 const rewardTile=r=>r.kind==='hero'?heroTile(r.avatar,r.quantity||1):c.tile({itemId:special.has(r.kind)?`${r.kind}:${r.id}`:r.kind==='gold'||r.kind==='diamonds'?r.kind:r.itemId,quantity:r.quantity||1});
 /** Bảng xem trước các món trong rương (PopupShowListRewards gốc). Chạm món → thông tin món đó (mở chồng lên trên). */
 async function openPreview(id,chest){
  try{pvSrc??=await fetch('scenes/1150.json').then(r=>r.json())}catch{return}
  closePreview();close();
  const rewards=chest.rewards||[],count=rewards.length,cols=Math.min(6,Math.max(1,count)),rows=Math.ceil(count/cols),cell=104;
  const gridW=cols*cell,gridH=Math.min(rows,3.5)*cell,w=Math.max(520,gridW+70),h=gridH+128;
  const n=structuredClone(pvSrc.roots[0]);strip(n);n.components=(n.components||[]).filter(x=>x.type!=='TweenPopup');
  n.transform={...n.transform,m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0}};
  const content=deep(n,'Content'),title=deep(n,'TextTitle'),group=deep(n,'GroupRewards'),x=deep(n,'ButtonClose');
  place(content,{w,h});
  const name=c.items.get(id)?.name||'Rương';txt(title,name);place(title,{x:0,y:h/2-34,w:w-120,h:44});{const t=comp(title,'Text');if(t){t.bestFit=false;t.overflow=0;if(name.length>24)t.size=Math.max(20,Math.floor((t.size||30)*24/name.length))}}
  group.children=[];group.previewGrid=true;place(group,{x:0,y:-20,w:Math.max(gridW+16,w-60),h:gridH+36});
  place(x,{x:w/2-4,y:h/2-4,w:64,h:64});x.previewClose=true;
  preview=D.render({id:'cpr',name:'ChestPreviewLayer',active:true,components:[],transform:n.transform,children:[n]},W,H,{assetSrc:c.assetSrc,assets:c.assets()});
  preview.classList.add('item-info-layer','chest-preview-layer');c.layer().appendChild(preview);
  for(const el of preview.querySelectorAll('.pd-node')){
   if(el._node?.previewGrid){const note=count===1?'Mở ra nhận món này':chest.mode==='choice'?`Chọn 1 trong ${count} món`:chest.mode==='all'?`Nhận tất cả ${count} món`:chest.groups?`Nhận ngẫu nhiên 1 trong ${chest.groups.length} bộ (mỗi bộ ${chest.groups[0].length} món)`:`Nhận ngẫu nhiên ${chest.draws||1} trong ${count} món`;
    el.innerHTML=`<p class="chest-pv-note">${note} · chạm để xem thông tin</p><div class="chest-pv-grid" style="--cols:${cols}">${rewards.map(r=>`<div class="chest-pv-cell">${rewardTile(r)}</div>`).join('')}</div>`}
   if(el._node?.previewClose){el.classList.add('pd-button');el.onclick=e=>{e.stopPropagation();closePreview()}}
  }
  D.find(preview,'Bgr').onclick=e=>{if(!e.target.closest('[data-name="Content"]'))closePreview()};
 }
 function closePreview(){preview?.remove();preview=null}
 // Chạm ô quà ở sự kiện (bỏ qua ô nằm trong nút thao tác như nút đổi / nút mua).
 document.addEventListener('click',e=>{
  const tile=e.target.closest?.('[data-info-item]');if(!tile||!c||tile.closest('.item-info-layer:not(.chest-preview-layer)'))return;
  const action=tile.parentElement?.closest('button,[data-action]');if(action&&!action.classList.contains('ev-rewards'))return;
  e.preventDefault();e.stopPropagation();show(tile.dataset.infoItem,Number(tile.dataset.infoQty)||1);
 },true);
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(layer)close();else if(preview)closePreview()});
 window.ItemInfoUI={init(ctx){c=ctx},show,close,preview:openPreview,closePreview,isOpen:()=>!!layer||!!preview};
})();
