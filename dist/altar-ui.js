/* Huyết tế — AltarScene gốc (scene 6) dựng bằng PrefabDOM, luật ở server/altar.mjs.
 *   Tab HUYẾT TẾ (PanelAltar): 8 ô SlotAltar, Chọn nhanh (ButtonSmart: tướng ≤ 3 sao, cấp thấp trước), Huyết tế
 *   (ButtonDisassemble, hỏi lại nếu có tướng > 3 sao), Xem trước tài nguyên thu hồi (ButtonPreview).
 *   Tab TƯỚNG HOÀN TRẢ (PanelReturnHero): 1 ô, phí 50 kim cương, tướng về cấp 1 và nhận lại toàn bộ EXP.
 *   BoxHeroes: danh sách thuyền viên (lọc theo hệ TabFaction, giữ để khóa / mở khóa), GroupCoin: Kim cương, EXP tướng,
 *   Đá cường hóa, Hồn hải tặc. ButtonShop: Cửa hàng huyết tế (đổi Hồn hải tặc).
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,root=null,tab='altar',picked=[],returnId=null,faction=null,scene=null;
 const find=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=find(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5}};
 const p=()=>c.player(),def=id=>c.catalog().heroes.find(d=>d.id===id);
 const soulByRank={1:2,2:4,3:10,4:30,5:60,6:120};
 const levelExp=l=>Math.round(l*45*(1+l/40));
 const spentExp=level=>{let n=0;for(let l=1;l<level;l++)n+=levelExp(l);return n};
 const spentStones=stars=>{let n=0;for(let s=5;s<stars;s++)n+=s<9?(s-4)*1000:s<14?(s-7)*1500:(s-12)*3000;return n};
 function recovery(ids){const t={};const add=(k,q)=>{if(q>0)t[k]=(t[k]||0)+q};for(const id of ids){const h=p().heroes.find(x=>x.id===id);if(!h)continue;add('spirit',spentExp(h.level));add('consumable:2',spentStones(h.stars));add('consumable:7',(soulByRank[def(id)?.rank]||10)*Math.max(1,h.stars));for(const e of Object.values(h.equipment||{}))if(e)add(e,1)}return Object.entries(t).map(([itemId,quantity])=>({itemId,quantity}))}
 const locked=id=>(p().lockedHeroes||[]).includes(id);
 function head(h,extra=''){
  const d=def(h.id);return `<button type="button" class="alt-head ${extra}" data-hero="${h.id}" title="${c.escape(d?.name||'')}"><img class="frame" src="${c.assetSrc('0c8c5b028d3f86f4b962f8096732f7fb_2')}" alt=""><span class="face"><img src="${c.assetSrc('791558cd9af3633458a85b4422832b12_2')}" alt=""><img src="${c.assetSrc(d?.visual?.head)}" alt=""></span><img class="border" src="${c.assetSrc('b0665ab94675b534e994abb5f58b5f66_2')}" alt=""><img class="faction" src="${c.assetSrc(c.named('faction_'+(d?.faction||'abyss')))}" alt=""><b class="lv">${h.level}</b><span class="stars">${window.heroStarsHtml?window.heroStarsHtml(h.stars):'★'+h.stars}</span>${locked(h.id)?`<img class="lock" src="${c.assetSrc('f6f584584745554488e2baa66f0c421b_2')}" alt="">`:''}<img class="tick" src="${c.assetSrc('bba745a01cbc4064297dc55cc48349fb_2')}" alt=""></button>`;
 }
 async function open(){
  scene??=await fetch('scenes/6.json').then(r=>r.json());picked=picked.filter(id=>p().heroes.some(h=>h.id===id));render();
 }
 function render(){
  const n=structuredClone(scene.roots.find(r=>r.name==='Canvas'));n.transform={...full};n.components=[];
  on(find(n,'PanelAltar'),tab==='altar');on(find(n,'PanelReturnHero'),tab==='return');on(find(n,'PointHideBoxHeroes'),false);
  on(find(find(n,'ButtonAltar'),'ImageOn'),tab==='altar');on(find(find(n,'ButtonAltar'),'ImageOff'),tab!=='altar');on(find(find(n,'ButtonReturn'),'ImageOn'),tab==='return');on(find(find(n,'ButtonReturn'),'ImageOff'),tab!=='return');
  txt(find(n,'Title'),I2('LBL_ALTAR_UPPER','HUYẾT TẾ'));txt(find(find(n,'ButtonSmart'),'Text'),'Chọn nhanh');txt(find(find(n,'ButtonDisassemble'),'Text'),'Huyết tế');
  for(let i=1;i<=5;i++)on(find(n,'Tab'+i),false);
  const pl=p(),field=(name,value,icon)=>{const f=find(n,name);txt(find(f,'TextValue'),c.short(value));if(icon){const im=comp(find(f,'Icon'),'Image');if(im)im.asset=icon}};
  field('FieldGem',pl.wallet.diamonds);field('FieldSpirit',pl.wallet.spirit||0);field('FieldPromotion',pl.inventory['consumable:2']||0);field('FieldDaDauXanh',pl.inventory['consumable:7']||0,c.items.get('consumable:7')?.assetKey);
  txt(find(n,'BoxHeroes').children.find(k=>k.name=='TextNumber'),`${pl.heroes.length}/200`);on(find(n,'FieldDaDauXanh'),false);
  {const pr=find(n,'PanelReturnHero'),has=!!pl.heroes.find(x=>x.id===returnId&&x.level>1);on(pr.children.find(k=>k.name==='Desc'),!has);on(pr.children.find(k=>k.name==='ScrollView'),has)}
  for(const [t,f] of [['TabFortress','fortress'],['TabAbyss','abyss'],['TabForest','forest'],['TabShadow','shadow'],['TabDark','dark'],['TabLight','light']]){const b=find(n,t);on(find(b,'ImageOn'),!faction||faction===f);on(find(b,'ImageOff'),!!faction&&faction!==f);b.factionTab=f}
  for(let i=0;i<8;i++)on(find(n,'SlotAltar'+i),false);
  root?.remove();root=D.render(n,W,H,{assetSrc:c.assetSrc,assets:c.assets()});root.classList.add('altar-layer');c.layer().appendChild(root);
  const bind=(x,f)=>{if(typeof x==='string')x=D.find(root,x);if(x){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();f(e)}}return x};
  bind('ButtonBack',close);bind('ButtonAltar',()=>{tab='altar';render()});bind('ButtonReturn',()=>{tab='return';render()});
  bind('ButtonHelp',()=>c.modal('Huyết tế',`<p class="item-description">Huyết tế: chọn tối đa 8 thuyền viên để phân rã, nhận lại toàn bộ EXP tướng đã nâng, Đá cường hóa đã dùng thức tỉnh, trang bị đang mặc và Hồn hải tặc (theo bậc × sao). Không thể huyết tế tướng chính, tướng đang khóa hoặc toàn bộ thuyền viên.\n\nTướng hoàn trả: đưa 1 thuyền viên về cấp 1 và nhận lại toàn bộ EXP đã nâng, phí 50 kim cương.\n\nHồn hải tặc dùng trong Cửa hàng huyết tế.</p>`));
  bind('ButtonShop',shop);bind('ButtonPreview',()=>preview(picked));
  for(const el of root.querySelectorAll('.pd-node')){const f=el._node?.factionTab;if(f)bind(el,()=>{faction=faction===f?null:f;render()})}
  // Ô huyết tế / hoàn trả
  const slot=c.assetSrc('7eee8f8a76c4d314c98314f1c6068fd7_2');
  if(tab==='altar'){const list=D.find(root,'ListAltar'),box=document.createElement('div');box.className='alt-slots';
   box.innerHTML=Array.from({length:8},(_,i)=>{const h=pl.heroes.find(x=>x.id===picked[i]);return `<div class="alt-slot" style="background-image:url('${slot}')">${h?head(h,'in-slot'):''}</div>`}).join('');list.appendChild(box);
   bind('ButtonSmart',smart);bind('ButtonDisassemble',sacrifice);
  }else{
   const panel=D.find(root,'PanelReturnHero'),box=document.createElement('div');box.className='alt-return-slot';const h=pl.heroes.find(x=>x.id===returnId);
   box.style.backgroundImage=`url('${slot}')`;box.innerHTML=h?head(h,'in-slot'):'';panel.appendChild(box);D.find(panel,'SlotAltar').style.display='none';
   const fee=D.find(panel,'GroupFee');D.find(fee,'Fee2').style.display='none';D.setText(D.find(fee,'Fee1/Fee'),'50');
   const items=D.find(panel,'ScrollView');if(items){const list=document.createElement('div');list.className='alt-return-items';list.innerHTML=h&&h.level>1?c.rewardTile({itemId:'spirit',quantity:spentExp(h.level)}):'';items.appendChild(list)}
   bind(D.find(panel,'Button'),doReturn);
  }
  // Danh sách thuyền viên
  const vp=D.find(root,'BoxHeroes/ScrollView'),grid=document.createElement('div');grid.className='alt-heroes';
  const heroes=[...pl.heroes].filter(h=>!faction||def(h.id)?.faction===faction).sort((a,b)=>a.stars-b.stars||a.level-b.level);
  grid.innerHTML=heroes.map(h=>head(h,`${(tab==='altar'?picked.includes(h.id):returnId===h.id)?'picked':''} ${h.id===pl.hero.id?'main':''}`)).join('')||'<p class="alt-empty">Không có thuyền viên</p>';vp.appendChild(grid);
  root.addEventListener('click',e=>{const b=e.target.closest('.alt-head');if(!b)return;e.stopPropagation();const id=b.dataset.hero;
   if(b.classList.contains('in-slot')){if(tab==='altar')picked=picked.filter(x=>x!==id);else returnId=null;return render()}
   if(tab==='return'){returnId=returnId===id?null:id;return render()}
   if(picked.includes(id)){picked=picked.filter(x=>x!==id);return render()}
   if(id===pl.hero.id)return c.toast('Không thể huyết tế tướng chính.');
   if(locked(id))return c.confirm('Thuyền trưởng có muốn mở khóa?',I2('LBL_UNLOCK','Mở khóa'),null,async()=>{if(await c.mutation('/api/altar',{op:'lock',heroId:id},{render:false,close:false}))render()});
   if(picked.length>=8)return c.toast('Số tướng huyết tế đã đầy');
   picked.push(id);render()});
  root.addEventListener('contextmenu',async e=>{const b=e.target.closest('.alt-heroes .alt-head');if(!b)return;e.preventDefault();if(await c.mutation('/api/altar',{op:'lock',heroId:b.dataset.hero},{render:false,close:false})){picked=picked.filter(x=>x!==b.dataset.hero);render()}});
 }
 function smart(){
  const pl=p(),pool=[...pl.heroes].filter(h=>h.id!==pl.hero.id&&!locked(h.id)&&h.stars<=3&&!picked.includes(h.id)).sort((a,b)=>a.stars-b.stars||a.level-b.level);
  if(!pool.length&&!picked.length)return c.toast('Không có thuyền viên 3 sao trở xuống để chọn nhanh.');
  while(picked.length<8&&pool.length&&picked.length<pl.heroes.length-1)picked.push(pool.shift().id);render();
 }
 function preview(ids){
  const list=recovery(ids);c.modal('Xem trước tài nguyên thu hồi',ids.length?`<div class="reward-items alt-preview">${list.map(r=>c.rewardTile(r)).join('')}</div>`:'<p class="item-description">Hãy chọn thuyền viên</p>');
 }
 function sacrifice(){
  if(!picked.length)return c.toast('Bạn chưa chọn tướng huyết tế');
  const go=async()=>{const ids=[...picked];burn();const d=await c.mutation('/api/altar',{op:'sacrifice',heroIds:ids},{render:false,close:false});if(d){picked=[];setTimeout(render,650)}};
  if(picked.some(id=>p().heroes.find(h=>h.id===id)?.stars>3))return c.confirm('Có thuyền viên cao hơn 3 sao trong danh sách huyết tế. Bạn có chắc chắn?',I2('MSG_LABEL_ALTAR','Huyết tế'),null,go);
  go();
 }
 function burn(){for(const s of root.querySelectorAll('.alt-slot .alt-head,.alt-return-slot .alt-head'))s.classList.add('burning');const fx=document.createElement('div');fx.className='alt-flash';D.find(root,tab==='altar'?'ListAltar':'PanelReturnHero')?.appendChild(fx)}
 async function doReturn(){
  const h=p().heroes.find(x=>x.id===returnId);if(!h)return c.toast('Hãy chọn thuyền viên');if(h.level<=1)return c.toast('Thuyền viên đang ở cấp 1.');
  c.confirm('Thuyền viên trên sẽ đưa về trạng thái level 1','Tướng hoàn trả',50,async()=>{burn();const d=await c.mutation('/api/altar',{op:'return',heroId:returnId},{render:false,close:false});if(d)setTimeout(render,650)});
 }
 function shop(){
  const pl=p(),souls=pl.inventory['consumable:7']||0;
  c.modal('Cửa hàng huyết tế',`<p class="item-description">Hồn hải tặc: <b>${c.num(souls)}</b></p><div class="alt-shop">${pl.altar.shop.map(o=>`<div class="alt-offer">${c.rewardTile(o.reward)}<small>${o.bought}/${o.limit} hôm nay</small><button class="green" data-alt-buy="${o.id}" ${o.bought>=o.limit||souls<o.cost?'disabled':''}><img src="${c.assetSrc(c.items.get('consumable:7')?.assetKey)}" alt="">${c.num(o.cost)}</button></div>`).join('')}</div>`);
  for(const b of document.querySelectorAll('[data-alt-buy]'))b.onclick=async()=>{const d=await c.mutation('/api/altar',{op:'buy',id:b.dataset.altBuy},{render:false,close:false});if(d){shop();render()}};
 }
 function close(){root?.remove();root=null}
 window.AltarUI={init(ctx){c=ctx},open:()=>open().catch(e=>c.toast(e.message)),close,isOpen:()=>!!root};
})();
