/* Bữa tiệc Sanji (bundle `sanji_party`): PanelSanjiHome (Spine "bua tiec sanji", thanh Tim / Thìa / kim cương, nút Tặng món
 * ngon + đếm ngược hồi, phí tăng tốc), GiveFoodPopUp + Food (3 món), RankingPopUp (xếp hạng CellRanking / quà mốc Gifts /
 * quà top), GiftPopUp + CellPopupShop (cửa hàng Đầu Bếp, giá bằng Thìa). Luật ở server/sanji.mjs. */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,root=null,popups=[],busy=false,timer=null;
 const W=1136,H=640;
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const render=(name,w=W,h=H)=>D.render(data.prefabs[name],w,h,opts());
 const find=(el,p)=>el&&D.find(el,p),show=(el,on)=>D.show(el,on),text=(el,s)=>D.setText(el,String(s??''),false);
 const art=k=>data.art[k]?c.assetSrc(data.art[k]):'';
 const img=(el,src)=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();el.style.backgroundImage=src?`url('${src}')`:'none';el.style.backgroundSize='100% 100%'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
 const layer=()=>document.querySelector('#game-layer');
 const st=()=>c.player().sanji;
 const spoon='consumable:2141';
 const clock=sec=>{sec=Math.max(0,Math.floor(sec));const d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60),s=sec%60,p=n=>String(n).padStart(2,'0');return(d?d+' ngày ':'')+`${p(h)}:${p(m)}:${p(s)}`};
 async function act(url,body={}){if(busy)return null;busy=true;try{return await c.mutation(url,body,{close:false,render:false,bonus:true,message:false})}finally{busy=false}}
 const costIcon=r=>r.itemId==='diamonds'?art('icon_gem'):r.itemId==='gold'?c.assetSrc(c.named('icon_gold')):c.assetSrc(c.items.get(r.itemId)?.assetKey);

 // ---- Màn chính
 function mount(){
  closePopups();root?.remove();clearInterval(timer);
  root=render('PanelSanjiHome');root.classList.add('sj-root');layer().appendChild(root);root.addEventListener('click',onClick);
  show(find(root,'ViewBlock'),false);
  // Spine bữa tiệc (SkeletonGraphic của PartyBackground).
  const host=find(root,'PartyBackground/SpineObject/Skeleton');if(host&&data.spines['bua tiec sanji']){const cv=document.createElement('canvas');cv.width=1100;cv.height=900;cv.className='sj-spine';host.appendChild(cv);c.spine(cv,{skeleton:data.spines['bua tiec sanji'],animation:'animation'},{loop:true,scale:.82})}
  img(find(root,'Top/ImageSpoonBar/Image'),c.assetSrc(c.items.get(spoon)?.assetKey)||art('golden_spoon'));
  fill();timer=setInterval(tick,1000);
 }
 function fill(){
  if(!root?.isConnected)return;const s=st(),p=c.player();
  text(find(root,'Top/ImageHeartBar/HeartBar'),c.short(s.hearts));text(find(root,'Top/ImageSpoonBar/SpoonBar'),c.short(p.inventory?.[spoon]||0));text(find(root,'Top/ImageDiamondBar/DiamondBar'),c.short(p.wallet.diamonds||0));
  tick();
 }
 function tick(){
  if(!root?.isConnected)return clearInterval(timer);const s=st(),now=Date.now(),left=Math.max(0,(s.cooldownUntil-now)/1000);
  text(find(root,'TimeEndEvent/TimeEnd'),clock((s.endsAt-now)/1000));
  const btn=find(root,'GiveFoodButton');show(find(btn,'TimeCoolDown'),left>0);show(find(btn,'RemoveTimeCooldown'),left>0);show(find(btn,'GiveFoodText'),left<=0);
  text(find(btn,'TimeCoolDown'),clock(left));text(find(btn,'GiveFoodText'),'Tặng món ngon');text(find(btn,'RemoveTimeCooldown'),'Tăng tốc ngay');
  // Phí tăng tốc: theo số giờ hồi còn lại (làm tròn lên), cùng công thức với server.
  const perHour=s.skipFee&&s.cooldownUntil?s.skipFee/Math.max(1,Math.ceil((s.cooldownUntil-c.loadedAt)/3600000)):0;
  show(find(root,'GemFee'),left>0);text(find(root,'GemFee/Number'),c.short(Math.round(Math.max(1,Math.ceil(left/3600))*perHour)||s.skipFee));img(find(root,'GemFee/Icon'),art('icon_gem'));
 }
 // ---- Tặng món (GiveFoodPopUp + 3 Food)
 function foodPopup(){
  closePopups();const el=popup('GiveFoodPopUp','sj-give'),tabs=find(el,'Content/Tabs');tabs.innerHTML='';
  img(find(el,'Content/SanjiGF'),art('sanji'));show(find(el,'Content/GFHeader/Header'),true);text(find(el,'Content/GFHeader/Header/HeaderText'),'TẶNG MÓN NGON');
  const row=document.createElement('div');row.className='sj-foods';tabs.appendChild(row);
  for(const d of st().dishes){const f=render('Food',176,425);f.classList.add('sj-food');f.dataset.dish=d.id;
   img(find(f,'FoodImage'),art(d.art));text(find(f,'TimeCountDown'),`Hồi ${d.cooldownHours} giờ`);
   text(find(f,'Spoons/Value'),d.spoons);img(find(f,'Spoons/SpoonImg'),c.assetSrc(c.items.get(spoon)?.assetKey)||art('golden_spoon'));text(find(f,'Hearts/Value'),d.hearts);img(find(f,'Hearts/HeartImg'),art('heart'));
   show(find(f,'SendFeeFree'),!d.fee);show(find(f,'SendFee'),!!d.fee);if(d.fee){text(find(f,'SendFee'),c.short(d.fee.quantity));img(find(f,'SendFee/GemImg'),costIcon(d.fee))}
   text(find(f,'GiveButton/Text'),'Tặng');find(f,'GiveButton').dataset.dish=d.id;row.appendChild(f)}
 }
 // ---- Xếp hạng / quà mốc / quà top (RankingPopUp)
 let rankTab='rank',ranks=null;
 async function rankPopup(tab='rank'){
  rankTab=tab;ranks=await c.api('/api/sanji/ranks');closePopups();const el=popup('RankingPopUp','sj-rank');
  const b=find(el,'Content/RankingBanner');text(find(b,'SelfRanking/Rank'),ranks.myRank?'Hạng bản thân:':'Chưa có hạng');text(find(b,'SelfRanking/Number'),ranks.myRank||'');
  for(const [n,k] of [['RankButton','rank'],['GiftButton','gift'],['GiftButtonForTop','top']]){const x=find(b,n);x.dataset.tab=k;x.classList.toggle('on',k===tab)}
  show(find(el,'Content/RankingBoard'),tab==='rank');show(find(el,'Content/GiftBoard'),tab==='gift');show(find(el,'Content/GiftBoardForTop'),tab==='top');
  const board=find(el,'Content/'+({rank:'RankingBoard',gift:'GiftBoard',top:'GiftBoardForTop'})[tab]+'/Scroll View/Viewport');board.innerHTML='';const list=document.createElement('div');list.className='sj-list';board.appendChild(list);
  if(tab==='rank'){if(!ranks.rows.length)list.innerHTML='<p class="sj-empty">Chưa có ai tặng món tuần này.</p>';
   for(const r of ranks.rows){const cell=render('CellRanking',698,89);cell.classList.add('sj-cell');if(r.me)cell.classList.add('me');text(find(cell,'RankingOrder'),r.rank);text(find(cell,'PlayerName'),r.name);text(find(cell,'ServerName'),'S1');
    text(find(cell,'RankPoint/Text'),c.short(r.points));img(find(cell,'RankPoint/Image'),art('heart'));img(find(cell,'PlayerAvatar/Mask/ImageAvt'),c.assetSrc(c.heroHead(r.avatar)));text(find(cell,'PlayerAvatar/TagLevel/TextLevel'),r.level);list.appendChild(cell)}}
  else if(tab==='gift')for(const m of st().milestones)list.appendChild(giftRow(`Điểm vui vẻ cần: ${m.point}`,m.rewards,m.status,m.point));
  else for(const t of st().top)list.appendChild(giftRow(`${t.from===t.to?'Hạng '+t.from:`Hạng ${t.from} - ${t.to}`} · tối thiểu ${t.minPoint} Tim`,t.rewards,-1));
 }
 function giftRow(label,rewards,status,point){
  const g=render('Gifts',698,130);g.classList.add('sj-cell');const rp=find(g,'RequiredPoint');text(rp,label);rp.classList.add('sj-label');text(find(g,'RequiredPoint/Point'),'');show(find(g,'RequiredPoint/Point'),false);
  const items=find(g,'ItemsContent');items.innerHTML=`<div class="sj-items">${rewards.map(r=>c.eventTile(r,'sj-tile')).join('')}</div>`;
  const btn=find(g,'GetRewardButton');show(btn,status===1);if(status===1){btn.dataset.claim=point;text(find(btn,'Text'),'Nhận quà')}
  show(find(g,'IsReceived'),status===2||status===0);text(find(g,'IsReceived'),status===2?'Đã nhận quà':'Chưa đủ điểm');if(status===0)find(g,'IsReceived').classList.add('sj-dim');
  return g;
 }
 // ---- Cửa hàng Đầu Bếp (GiftPopUp + CellPopupShop)
 function shopPopup(){
  closePopups();const el=popup('GiftPopUp','sj-shop');show(el,true);const vp=find(el,'Popup/ScrollView/Viewport');vp.innerHTML='';const list=document.createElement('div');list.className='sj-list';vp.appendChild(list);
  const items=st().shop;for(let i=0;i<items.length;i+=3){const cell=render('CellPopupShop',586,150);cell.classList.add('sj-cell','sj-shoprow');const tpl=find(cell,'ShopItem'),parent=find(cell,'ParentItem');show(tpl,false);parent.innerHTML='';
   for(const x of items.slice(i,i+3)){const it=tpl.cloneNode(true);it.style.display='';it.classList.add('sj-shopitem');const left=x.limit-x.bought;
    const gi=find(it,'Item/GameItem');gi.innerHTML=c.eventTile(x.reward,'sj-tile');
    text(find(it,'Price/TextPrice'),c.short(x.price));img(find(it,'Price/IconPrice'),c.assetSrc(c.items.get(spoon)?.assetKey)||art('golden_spoon'));show(find(it,'PriceInactive'),false);
    const pr=find(it,'Price');pr.dataset.buy=x.id;show(pr,left>0);
    const tag=document.createElement('span');tag.className='sj-limit'+(left>0?'':' out');tag.textContent=left>0?`Còn ${left}/${x.limit}`:'Hết hàng';it.appendChild(tag);parent.appendChild(it)}
   list.appendChild(cell)}
 }
 function popup(name,cls){const el=render(name);el.classList.add('sj-popup',cls);el.style.zIndex=String(46+popups.length);layer().appendChild(el);popups.push(el);el.addEventListener('click',onClick);return el}
 const closePopup=el=>{el.remove();popups=popups.filter(p=>p!==el)};
 const closePopups=()=>{for(const p of popups)p.remove();popups=[]};

 async function onClick(e){
  const t=e.target.closest('[data-dish],[data-tab],[data-claim],[data-buy],.pd-button');if(!t)return;if(e.target.closest('.ev-tile'))return;e.stopPropagation();
  const name=t.dataset.name,host=t.closest('.sj-popup');
  try{
   if(t.dataset.buy){const x=st().shop.find(y=>y.id===Number(t.dataset.buy));if(!await window.GameMessage.ask(`Đổi ${x.price} ${c.items.get(spoon)?.name||'Thìa'} lấy vật phẩm này?`,'Đầu Bếp Sanji'))return;
    const r=await act('/api/sanji/buy',{id:x.id,count:1});if(r){fill();shopPopup()}return}
   if(t.dataset.claim){const r=await act('/api/sanji/claim',{point:Number(t.dataset.claim)});if(r){fill();rankPopup('gift')}return}
   if(t.dataset.tab)return rankPopup(t.dataset.tab);
   if(name==='GiveButton'&&t.dataset.dish){const d=st().dishes.find(x=>x.id===Number(t.dataset.dish));
    if(d.fee&&!await window.GameMessage.ask(`Tặng ${d.name} với giá ${c.short(d.fee.quantity)} ${d.fee.itemId==='diamonds'?'kim cương':d.fee.itemId==='gold'?'vàng':(c.items.get(d.fee.itemId)?.name||'')}?`,'Tặng món ngon'))return;
    const r=await c.mutation('/api/sanji/send',{dish:d.id},{close:false,render:false,bonus:true,message:false});if(r){closePopups();fill();c.toast(r.result?.message||'Đã tặng món.')}return}
   if(name==='CloseButton'&&host)return closePopup(host);
   if(name==='BackButton')return close();
   if(name==='ButtonInfo')return c.help();
   if(name==='GiveFoodButton'){const s=st(),left=s.cooldownUntil-Date.now();if(left>0){if(!await window.GameMessage.ask(`Tăng tốc ngay cần tốn ${s.skipFee} kim cương, xác nhận tăng tốc không?`,'Bữa tiệc Sanji'))return;const r=await act('/api/sanji/skip');if(r)fill();return}return foodPopup()}
   if(name==='RankingButton')return rankPopup('rank');
   if(name==='CookOnButton')return shopPopup();
  }catch(err){c.toast(err.message)}
 }
 async function open(context){c=context;await load();mount()}
 function close(){closePopups();clearInterval(timer);root?.remove();root=null}
 let loading=null;
 function load(){return data?Promise.resolve(data):loading??=fetch('sanji.json').then(r=>r.json()).then(d=>data=d)}
 window.SanjiUI={open,close,load,isOpen:()=>!!root,data:()=>data,refresh:()=>fill()};
})();
