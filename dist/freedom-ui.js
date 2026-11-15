/* Đấu Trường Tự Do (bundle `arenafreedom`): dựng nguyên prefab AFMain + AFPanelStateRegistration / PickTeam / PickHelp /
 * BattleStatus, AFCellHeroThumb, AFCardBonusStrength, AFStageBattle, AFPopupReset, AFPopupListCard bằng PrefabDOM rồi đổ dữ liệu
 * theo AFManager.SetStatusUI (0 đăng ký → 1 đội → 2 trợ giúp → 3 tấn công). Luật ở server/freedom.mjs. */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,root=null,popups=[],busy=false,draft=null;
 const W=1136,H=640;
 const art=k=>data.art[k]?c.assetSrc(data.art[k]):'';
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const render=(name,w=W,h=H)=>D.render(data.prefabs[name],w,h,opts());
 const find=(el,p)=>el&&D.find(el,p),show=(el,on)=>D.show(el,on),text=(el,s)=>D.setText(el,String(s??''),false);
 const img=(el,src)=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();el.style.backgroundImage=src?`url('${src}')`:'none';el.style.backgroundSize='100% 100%'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
 const layer=()=>document.querySelector('#game-layer');
 const st=()=>c.player().freedom;
 const html=(host,markup,cls='fd-html')=>{if(!host)return null;host.querySelector(':scope>.'+cls)?.remove();const box=document.createElement('div');box.className=cls;box.innerHTML=markup;host.appendChild(box);return box};
 async function act(url,body={}){if(busy)return null;busy=true;try{return await c.mutation(url,body,{close:false,render:false,bonus:true,message:false})}finally{busy=false}}
 const hero=id=>{const d=c.def(id);return{id,level:st().heroLevel,stars:0,def:d}};

 // ---- Ô tướng (AFCellHeroThumb): khung, Spine đứng, hệ, tên.
 function thumb(id,{scale=.78}={}){
  const d=c.def(id),cell=render('AFCellHeroThumb',156,235);cell.classList.add('fd-thumb');cell.dataset.hero=id;
  text(find(cell,'TxtHeroName'),d?.name||id);img(find(cell,'IconFaction'),c.assetSrc(c.named('faction_'+(d?.faction||'light'))));
  show(find(cell,'HeroStars'),false);
  const box=find(cell,'BoxHero'),sk=d&&c.skeleton(d.avatar);
  if(box&&sk){const cv=document.createElement('canvas');cv.width=134;cv.height=294;cv.className='fd-spine';box.appendChild(cv);c.spine(cv,{skeleton:sk,animation:'idling'},{loop:true,scale})}
  else if(box&&d)box.insertAdjacentHTML('beforeend',`<img class="fd-head" src="${esc(c.assetSrc(d.visual?.head))}" alt="">`);
  return cell;
 }
 // ---- Thẻ trợ giúp (AFCardBonusStrength): nền xanh / tím / vàng theo bậc.
 function card(k){
  const el=render('AFCardBonusStrength',162,238);el.classList.add('fd-card');
  img(find(el,'ImgBgr'),art(['blue_card','purple_card','yellow_card'][k.rank-1]||'blue_card'));text(find(el,'TxtTitle'),k.name);
  img(find(el,'ImgIconBonus'),k.icon?c.assetSrc(k.icon):'');
  const vp=find(el,'Scroll View/Viewport');if(vp)vp.innerHTML=`<p class="fd-card-text">${esc(k.description)}</p>`;
  return el;
 }

 // ---- Khung chính AFMain
 function mount(){
  closePopups();root?.remove();root=render('AFMain');root.classList.add('fd-root');layer().appendChild(root);root.addEventListener('click',onClick);
  img(find(root,'Content/Header/FieldTicket/iconField'),c.assetSrc(c.items.get(st().ticket.itemId)?.assetKey));
  img(find(root,'Content/Header/FieldDiamond/iconField'),c.assetSrc(c.named('icon_gem')||c.named('icon_diamond')));
  fill();
 }
 function header(){
  const p=c.player();text(find(root,'Content/Header/FieldDiamond/TextFieldValue'),c.short(p.wallet.diamonds||0));
  text(find(root,'Content/Header/FieldTicket/TextFieldValue'),c.short(p.inventory?.[st().ticket.itemId]||0));
 }
 function body(name){const b=find(root,'Content/Body');b.innerHTML='';const el=render(name,985,554);el.classList.add('fd-panel');b.appendChild(el);return el}
 function fill(){
  if(!root?.isConnected)return;header();const s=st(),run=s.run;mapPage=null;
  show(find(root,'Content/BoxActions'),!!run);
  if(!run)return registration();
  if(run.status==='team')return pickTeam();
  if(run.status==='help')return pickHelp();
  return battleStatus();
 }
 // Trạng thái 0: đăng ký (vé hoặc kim cương), giới hạn lượt tuần.
 function registration(){
  const s=st(),el=body('AFPanelStateRegistration'),out=s.runs>=s.weeklyRuns;
  img(find(el,'ImgHeader'),art('dttd'));img(find(el,'ImgBanner'),art('banner'));
  text(find(el,'TxtContent'),`Cần vé để tham gia. Hệ thống phát 6 tướng cấp ${s.heroLevel}, vượt ${s.stages.length} ải để nhận thưởng.`);
  text(find(el,'TxtNumPlay'),`Lượt trong tuần: ${s.runs}/${s.weeklyRuns}`+(s.best?` · Tốt nhất: ${s.best} ải`:''));
  show(find(el,'BoxActions'),!out);show(find(el,'BoxDisable'),out);text(find(el,'BoxDisable/TxtDisable'),'Bạn đã hết lượt tham gia tuần này');
  const mata=find(el,'BoxActions/ButtonJoinWithMata'),ticket=find(el,'BoxActions/ButtonJoinWithTicket');
  text(find(mata,'TextPriceMata'),c.short(s.diamondFee));img(find(mata,'IconPriceMata'),c.assetSrc(c.named('icon_gem')||c.named('icon_diamond')));show(mata,s.diamondFee>0);
  text(find(ticket,'TextPriceTicket'),s.ticket.quantity);img(find(ticket,'IconPriceTicket'),c.assetSrc(c.items.get(s.ticket.itemId)?.assetKey));
 }
 // Trạng thái 1: đội phát ngẫu nhiên (6 ô AFCellHeroThumb), Bắt đầu / Làm mới.
 function pickTeam(){
  const run=st().run,el=body('AFPanelStatePickTeam');img(find(el,'ImgHeader'),art('team-banner'));
  const box=find(el,'BoxHero');const row=html(box,'','fd-thumbs');for(const id of run.team)row.appendChild(thumb(id));
  show(find(box,'IconPower'),false);
  show(find(el,'BoxActions/ButtonResetTeam'),run.resetCost!==null);
 }
 // Trạng thái 2: chọn 1 trong 2 trợ giúp (tướng thêm / thẻ).
 function pickHelp(){
  const run=st().run,el=body('AFPanelStatePickHelp');img(find(el,'ImgHeader'),art('help-tittle'));
  run.options.forEach((o,i)=>{const side=i?'Right':'Left',holder=find(el,`BoxBuff${side}/UICard${side}BonusStrength`);holder.innerHTML='';
   const row=document.createElement('div');row.className='fd-help';for(const h of o.heroes)row.appendChild(thumb(h,{scale:.7}));for(const k of o.cards)row.appendChild(card(k));holder.appendChild(row);
   find(el,`BoxBuff${side}/Button${side}Confirm`).dataset.option=i});
 }
 // Trạng thái 3: bản đồ ải (AFStageBattle, 7 ô TfStage1..7 mỗi trang), Thắng x/n, nút Chiến đấu / Nhận thưởng.
 // Quá 7 ải: chia trang, mũi tên gốc arrow_left / arrow_right ở hai mép bản đồ; mặc định mở trang chứa ải đang đánh.
 const perPage=7;let mapPage=null;
 function battleStatus(){
  const run=st().run,total=run.total||st().stages.length,pages=Math.max(1,Math.ceil(total/perPage)),el=body('AFPanelStateBattleStatus');
  img(find(el,'ImgHeader'),art('expedition'));img(find(el,'BoxBanner'),art('expedition-map'));
  const auto=Math.min(pages-1,Math.floor(Math.min(run.stage,total-1)/perPage)),page=mapPage===null?auto:Math.max(0,Math.min(pages-1,mapPage));
  // Vị trí ải lấy từ TfStage1..7 của prefab (so với tâm ViewStage 767 x 214).
  const view=find(el,'BoxBanner/ViewStage'),spots=[[-323,59],[-231,-39],[-104,17],[25,27],[129,-51],[221,27],[339,60]];
  if(view){view.querySelector(':scope>.fd-stages')?.remove();const box=document.createElement('div');box.className='fd-stages';
   spots.forEach(([x,y],k)=>{const i=page*perPage+k;if(i>=total)return;const done=run.status==='done',status=i<run.wins?'win':i===run.stage&&run.lost?'lose':i===run.stage&&!done?'sword_on':'locked';
    box.insertAdjacentHTML('beforeend',`<span class="fd-stage ${status==='sword_on'?'now':''}" style="left:${383.5+x-32}px;top:${107-y-32}px"><img src="${esc(art(status))}" alt=""><b>${i+1}</b></span>`)});view.appendChild(box)}
  img(view,'');
  const banner=find(el,'BoxBanner');banner.querySelector(':scope>.fd-pager')?.remove();
  if(pages>1){const pager=document.createElement('div');pager.className='fd-pager';
   pager.innerHTML=`<button type="button" class="fd-page prev" data-page="${page-1}" ${page===0?'disabled':''} aria-label="Trang trước"><img src="${esc(c.assetSrc(c.named('arrow_left')))}" alt=""></button>`+
    `<span class="fd-page-no">Trang ${page+1}/${pages}</span>`+
    `<button type="button" class="fd-page next" data-page="${page+1}" ${page>=pages-1?'disabled':''} aria-label="Trang sau"><img src="${esc(c.assetSrc(c.named('arrow_right')))}" alt=""></button>`;
   banner.appendChild(pager)}
  text(find(el,'TxtResult'),`Thắng: ${run.wins}/${total}`);
  const btn=find(el,'BoxActions/ButtonBattle');text(find(btn,'Text'),run.status==='done'?'Nhận thưởng':'Chiến đấu');btn.dataset.mode=run.status==='done'?'claim':'battle';
  if(run.status==='done'){html(banner,run.rewards.length?run.rewards.map(r=>c.eventTile(r,'fd-tile')).join(''):'<span>Chưa qua ải nào</span>','fd-rewards')}
 }

 // ---- Popup
 function popup(name,cls){const el=render(name);el.classList.add('fd-popup',cls);el.style.zIndex=String(48+popups.length);layer().appendChild(el);popups.push(el);el.addEventListener('click',onClick);return el}
 const closePopup=el=>{el.remove();popups=popups.filter(p=>p!==el)};
 const closePopups=()=>{for(const p of popups)p.remove();popups=[]};
 function resetPopup(){
  const run=st().run,el=popup('AFPopupReset','fd-reset');text(find(el,'Content/BgrPanel_2/Title'),'Làm mới đội hình');
  text(find(el,'Content/FieldCose/Text'),c.short(run.resetCost));img(find(el,'Content/FieldCose/IconGem'),c.assetSrc(c.named('icon_gem')||c.named('icon_diamond')));
  text(find(el,'Content/Text'),`Đổi sang 6 tướng ngẫu nhiên khác. Đã làm mới ${run.resets} lần.`);text(find(el,'Content/ButtonReset/Text'),'Làm mới');
 }
 function listPopup(title,cls){const el=popup('AFPopupListCard',cls);text(find(el,'Content/BgrPanel_2/Title'),title);const vp=find(el,'Content/ScrollView/Viewport');vp.innerHTML='';return{el,vp}}
 function cardsPopup(){const {vp}=listPopup('Thẻ hỗ trợ của bạn','fd-cards'),run=st().run,box=document.createElement('div');box.className='fd-grid';
  if(!run.cards.length)box.innerHTML='<p class="fd-empty">Chưa có thẻ hỗ trợ. Chọn trợ giúp có thẻ trước mỗi ải.</p>';for(const k of run.cards)box.appendChild(card(k));vp.appendChild(box)}
 function poolPopup(){const {vp}=listPopup('Đội hình Tự Do','fd-pool'),box=document.createElement('div');box.className='fd-grid';for(const id of st().run.pool)box.appendChild(thumb(id));vp.appendChild(box)}
 // Đội ra trận: 6 ô (2 hàng trước, 4 hàng sau như HeroesLineup), chọn từ nhóm tướng của lượt chơi; xem trước đối thủ.
 function formationPopup(){
  const run=st().run;draft=(run.formation&&run.formation.filter(Boolean).every(id=>run.pool.includes(id))?run.formation:run.pool.slice(0,6)).slice();while(draft.length<6)draft.push(null);
  const {el,vp}=listPopup(`Ải ${run.stage+1} - Đội hình`,'fd-formation');vp.innerHTML='<div class="fd-form"></div>';drawFormation(el)
 }
 function drawFormation(el=popups.find(p=>p.classList.contains('fd-formation'))){
  if(!el)return;const run=st().run,box=el.querySelector('.fd-form'),used=new Set(draft.filter(Boolean)),en=run.enemy;
  const slot=(id,i)=>`<button type="button" class="fd-slot" data-slot="${i}">${id?c.heroCard(hero(id),{mini:true}):'<span class="fd-slot-empty">+</span>'}</button>`;
  box.innerHTML=`<div class="fd-enemy"><b>Đối thủ · cấp ${en.level}</b><div class="fd-row">${en.heroes.map(id=>c.heroCard({id,level:en.level,stars:0},{mini:true})).join('')}</div>${en.cards.length?`<div class="fd-row fd-ecards">${en.cards.map(k=>`<span class="fd-mini-card" title="${esc(k.name+': '+k.description)}"><img src="${esc(c.assetSrc(k.icon))}" alt=""><small>${esc(k.name)}</small></span>`).join('')}</div>`:''}</div>
   <div class="fd-lineup"><div><small>Hàng trước</small><div class="fd-row">${[0,1].map(i=>slot(draft[i],i)).join('')}</div></div><div><small>Hàng sau</small><div class="fd-row">${[2,3,4,5].map(i=>slot(draft[i],i)).join('')}</div></div></div>
   <div class="fd-row fd-roster">${run.pool.map(id=>`<button type="button" class="fd-pick ${used.has(id)?'used':''}" data-pick="${esc(id)}">${c.heroCard(hero(id),{mini:true,check:used.has(id)})}</button>`).join('')}</div>
   <div class="fd-row fd-go">${run.cards.length?`<span class="fd-note">${run.cards.length} thẻ hỗ trợ đang áp dụng</span>`:''}<button type="button" class="fd-attack" data-attack="1" ${used.size<Math.min(6,run.pool.length)?'disabled':''}>Tấn công</button></div>`;
 }

 async function onClick(e){
  const t=e.target.closest('[data-pick],[data-slot],[data-attack],[data-page],.pd-button');if(!t)return;
  if(e.target.closest('.ev-tile'))return;e.stopPropagation();
  const name=t.dataset.name,host=t.closest('.fd-popup');
  try{
   if(t.dataset.pick){const id=t.dataset.pick,at=draft.indexOf(id);if(at>=0)draft[at]=null;else{const i=draft.indexOf(null);if(i<0)return c.toast('Đội hình đã đủ 6 tướng.');draft[i]=id}return drawFormation()}
   if(t.dataset.page!==undefined){if(t.disabled)return;mapPage=Number(t.dataset.page);return battleStatus()}
   if(t.dataset.slot!==undefined){draft[Number(t.dataset.slot)]=null;return drawFormation()}
   if(t.dataset.attack){if(draft.filter(Boolean).length<Math.min(6,st().run.pool.length))return c.toast('Cần lắp đủ 6 tướng để tấn công');return c.battle(draft.slice())}
   if((name==='ButtonClose'||name==='BtnClose')&&host)return closePopup(host);
   if(name==='ButtonClose')return close();
   if(name==='ButtonHelp')return c.help();
   if(name==='ButtonJoinWithTicket'||name==='ButtonJoinWithMata'){const s=st(),diamonds=name==='ButtonJoinWithMata';
    if(!await window.GameMessage.ask(diamonds?`Dùng ${s.diamondFee} kim cương để tham gia?`:`Dùng ${s.ticket.quantity} ${c.items.get(s.ticket.itemId)?.name||'vé'} để tham gia?`,'Đấu Trường Tự Do'))return;
    if(await act('/api/freedom/join',{pay:diamonds?'diamonds':'ticket'}))fill();return}
   if(name==='ButtonResetTeam')return resetPopup();
   if(name==='ButtonReset'&&host){if(await act('/api/freedom/reset')){closePopup(host);fill()}return}
   if(name==='ButtonConfirmTeam'){if(await act('/api/freedom/team'))fill();return}
   if(name==='ButtonLeftConfirm'||name==='ButtonRightConfirm'){if(await act('/api/freedom/help',{option:Number(t.dataset.option)}))fill();return}
   if(name==='ButtonBattle'){if(t.dataset.mode==='claim'){const r=await act('/api/freedom/claim');if(r){c.toast(r.result?.message||'Đã nhận thưởng');fill()}return}return formationPopup()}
   if(name==='ButtonCard')return cardsPopup();
   if(name==='ButtonListHero')return poolPopup();
  }catch(err){c.toast(err.message)}
 }
 async function open(context){c=context;await load();mount()}
 function close(){closePopups();root?.remove();root=null}
 let loading=null;
 function load(){return data?Promise.resolve(data):loading??=fetch('freedom.json').then(r=>r.json()).then(d=>data=d)}
 window.FreedomUI={open,close,load,refresh:()=>fill(),isOpen:()=>!!root,data:()=>data};
})();
