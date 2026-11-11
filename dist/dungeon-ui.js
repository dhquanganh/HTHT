/* Đảo Bánh — DungeonScene gốc (scene 23) dựng bằng PrefabDOM, luật ở server/dungeon.mjs, tài nguyên thêm ở dungeon.json
 * (tools/export-dungeon.py).
 *   Trái: thuyền viên đang chọn (CanvasHero1) + thanh máu; BoxHpLotion (bình máu nhỏ / vừa / lớn), BoxBuffLotion (Công / Nộ / Máu x/20).
 *   Giữa: cột cờ BattleFlag (ButtonBattle đánh, ButtonBattleInactive, ButtonSkipMerchant bỏ qua gian thương), Bỏ qua trận đấu.
 *   Phải: tướng địch của ải (CanvasHeroStage, chạm xem đội hình PopupDungeonStageHero) hoặc vật phẩm (DungeonLotion)
 *         hoặc gian thương (DungeonMerchantMen -> PopupDungeonBuyItem).
 *   Dưới: 5 thuyền viên (BoxHeroes), Mở sau (BoxCountdownOpen) khi đảo đóng. Trên: Kết thúc sau + Ải, Trợ giúp, Top, Cửa hàng Đảo Bánh.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640,SKIP_KEY='key_dungeon_skip_battle';
 let c=null,root=null,popup=null,data=null,main=null,timer=0,busy=false;const scenes={};
 const scene=id=>scenes[id]??=fetch(`scenes/${id}.json`).then(r=>r.json());
 const find=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=find(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const pic=(n,key)=>{const x=comp(n,'Image');if(x&&key)x.asset=key};
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5}};
 const p=()=>c.player(),v=()=>p().dungeon,def=id=>c.catalog().heroes.find(d=>d.id===id),wait=ms=>new Promise(r=>setTimeout(r,ms));
 const clock=ms=>{const s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return[h,m,s%60].map(x=>String(x).padStart(2,'0')).join(':')};
 const skipOn=()=>{try{return localStorage.getItem(SKIP_KEY)==='1'}catch{return false}};
 const merchantNames={1:I2('MISC_2_LBL_BIG_EYE','Tiệm Mắt To'),2:I2('MISC_2_LBL_BEANS','Tiệm Hạt Đậu'),3:I2('MISC_2_LBL_TOOTH_DECAY','Tiệm Răng Sún')};
 const lotionText={hp:{1:'Bình máu nhỏ: hồi 30% máu cho thuyền viên đang chọn.',2:'Bình máu vừa: hồi 60% máu cho thuyền viên đang chọn.',3:'Bình máu lớn: hồi đầy máu, hồi sinh thuyền viên đã ngã.'},
  buff:{1:'Tăng 3% Công cho cả đội mỗi tầng (tối đa 20).',2:'Tăng 5 Nộ khi vào trận cho cả đội mỗi tầng (tối đa 20).',3:'Tăng 3% Máu tối đa cho cả đội mỗi tầng (tối đa 20).'}};
 const lotionIcon=(kind,id)=>data.images['icon_lotion_'+(kind==='hp'?id:3+Number(id))];
 const mount=(n,cls)=>{const el=D.render(n,W,H,{assetSrc:c.assetSrc,assets:c.assets()});el.classList.add('dungeon-layer',...cls.split(' '));c.layer().appendChild(el);return el};
 const bind=(el,x,f)=>{if(typeof x==='string')x=D.find(el,x);if(x){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();f(e)}}return x};
 function spineAt(host,skeleton,animation,{scale=1,flip=false,size=720}={}){
  if(!host||!skeleton)return;host.querySelector(':scope>.dungeon-spine')?.remove();
  const cv=document.createElement('canvas');cv.width=cv.height=size;cv.className='dungeon-spine'+(flip?' flip':'');host.appendChild(cv);c.spine(cv,{skeleton,animation},{loop:true,scale});
 }
 async function open(){
  try{
   data??=await fetch('dungeon.json').then(r=>r.json());main??=await scene(23);
   const d=v();if(!d.unlocked)return c.toast(`Yêu cầu cấp độ ${d.minLevel}`);
   render();clearInterval(timer);timer=setInterval(tick,1000);
   if(d.open&&!d.team.length)setTimeout(chooseTeam,300);
  }catch(e){c.toast(e.message)}
 }
 function tick(){
  if(!root?.isConnected)return clearInterval(timer);const d=v(),now=Date.now();
  if(d.open&&now>=d.closeAt||!d.open&&now>=d.openAt){close();return c.toast(d.open?'Đảo bánh đã đóng cửa.':'Đảo bánh đã mở, hãy vào lại.')}
  D.setText(D.find(root,'BoxCountdownClose/TextTime'),clock(d.closeAt-now));D.setText(D.find(root,'BoxCountdownOpen/TextTime'),clock(d.openAt-now));
 }
 function render(){
  if(!main)return;
  const n=structuredClone(main.roots.find(r=>r.name==='Canvas')),d=v(),pl=p(),selected=d.team.find(t=>t.id===d.selected)||d.team[0];
  n.transform={...full};n.components=[];
  txt(find(n,'TextGold'),c.short(pl.wallet.gold));txt(find(n,'TextGem'),c.short(pl.wallet.diamonds));
  txt(find(n,'TextStage'),d.done?'Đã vượt hết ải':`Ải ${d.stage}/${d.stages}`);txt(find(find(n,'BoxCountdownClose'),'TextTime'),clock(d.closeAt-Date.now()));
  on(find(n,'BoxCountdownClose'),d.open);on(find(n,'BoxCountdownOpen'),!d.open);txt(find(find(n,'BoxCountdownOpen'),'TextTime'),clock(d.openAt-Date.now()));
  // Bình máu và bình tăng cường.
  for(const k of [1,2,3]){const b=find(n,'ButtonLotionHp'+k);txt(find(b,'TextNumber'),d.lotions[k]);pic(find(b,'ImageLotion'),lotionIcon('hp',k))}
  [1,2,3].forEach(k=>{const f=find(n,k===3?'FieldLotionBuff 3':'FieldLotionBuff'+k);txt(find(f,'TextNumber'),`${d.buffs[k]}/${d.buffMax}`);pic(find(f,'IconBuff'),lotionIcon('buff',k));f.dungeonBuff=k});
  // Cột cờ.
  const merchant=d.node?.type==='merchant',canFight=d.open&&d.team.length&&!d.node&&!d.done&&selected&&selected.hp>0;
  on(find(n,'ButtonBattle'),canFight);on(find(n,'ButtonBattleInactive'),!canFight&&!merchant);on(find(n,'ButtonSkipMerchant'),merchant);
  pic(find(n,'ButtonSkipMerchant'),data.images.button_skip_merchant);
  on(find(find(n,'ButtonCheckSkip'),'Tick'),skipOn());
  // 5 thuyền viên.
  for(let i=0;i<5;i++){
   const h=find(n,'HeroHeadClickable'+(i+1)),t=d.team[i];if(!h)continue;
   if(!t){for(const k of find(h,'HeroHeadUI').children)on(k,k.name==='ImageFrame');h.dungeonPick=true;continue}
   const hero=pl.heroes.find(x=>x.id===t.id),dd=def(t.id);h.dungeonHero=t.id;
   pic(find(h,'ImageHead'),dd?.visual?.head);txt(find(h,'TextLevel'),hero?.level??'');pic(find(h,'ImageFaction'),c.named('faction_'+(dd?.faction||'light')));
   for(const g of find(h,'HeroStar').children)on(g,false);on(find(h,'Death'),t.hp<=0);on(find(h,'Check'),t.id===selected?.id);on(find(h,'SliderHp'),true);h.dungeonHp=t.hp;
  }
  on(find(n,'PointHideBoxHeroes'),false);on(find(n,'PointHideBoxCountdownOpen'),false);on(find(n,'PointHideBoxHp'),false);on(find(n,'PointHideBoxBuff'),false);
  // Bên phải: vật phẩm / gian thương / tướng địch.
  on(find(n,'DungeonLotion'),d.node?.type==='lotion');if(d.node?.type==='lotion')pic(find(find(n,'DungeonLotion'),'ImageLotion'),lotionIcon(d.node.kind,d.node.id));
  on(find(n,'DungeonMerchantMen'),merchant);if(merchant){const m=find(n,'DungeonMerchantMen');txt(find(m,'TextName'),merchantNames[d.node.merchant]);const sk=comp(find(m,'Skeleton'),'SkeletonGraphic');if(sk)sk.skeleton=null}
  const stageHero=find(n,'CanvasHeroStage');on(stageHero,!d.node&&!d.done&&d.enemies.length>0);on(find(stageHero,'Mesh'),true);on(find(stageHero,'SliderHp'),true);
  on(find(find(n,'CanvasHero1'),'Mesh'),true);on(find(find(n,'CanvasHero1'),'SliderHp'),!!selected);on(find(find(n,'CanvasHero1'),'ClickArea'),false);
  for(const name of ['EffectHeroStage','SpineSmash','SpineCoin'])on(find(n,name),false);
  for(const sk of ['CanvasHero1','CanvasHeroStage']){const g=comp(find(find(n,sk),'Skeleton'),'SkeletonGraphic');if(g)g.skeleton=null}
  root?.remove();root=mount(n,'dungeon-main');
  // Thanh máu, spine.
  const fillOf=(el,ratio)=>{const f=el&&D.find(el,'Fill');if(f){f.style.right='auto';f.style.width=Math.max(0,Math.min(1,ratio))*100+'%'}};
  for(const el of root.querySelectorAll('.pd-node')){
   const node=el._node;if(!node)continue;
   if(node.dungeonHp!==undefined)fillOf(D.find(el,'SliderHp'),node.dungeonHp);
   if(node.dungeonHero)bind(el,el,()=>select(node.dungeonHero));
   if(node.dungeonPick)bind(el,el,()=>d.team.length?c.toast('Đội đã chọn cho chu kỳ này.'):chooseTeam());
   if(node.dungeonBuff)bind(el,el,()=>c.toast(lotionText.buff[node.dungeonBuff]));
  }
  [1,2,3].forEach(k=>{const f=D.find(root,k===3?'FieldLotionBuff 3':'FieldLotionBuff'+k);fillOf(f,d.buffs[k]/d.buffMax)});
  const hero1=D.find(root,'CanvasHero1');if(selected){const dd=def(selected.id);spineAt(D.find(hero1,'Mesh'),c.skeleton(dd?.avatar),'idling');fillOf(D.find(hero1,'SliderHp'),selected.hp)}
  if(!d.node&&!d.done&&d.enemies.length){const st=D.find(root,'CanvasHeroStage'),first=d.enemies.find(e=>e.hp>0)||d.enemies[0];spineAt(D.find(st,'Mesh'),c.skeleton(first.avatar),'idling',{flip:true});
   fillOf(D.find(st,'SliderHp'),d.enemies.reduce((a,e)=>a+e.hp*(e.maxHp||1),0)/Math.max(1,d.enemies.reduce((a,e)=>a+(e.maxHp||1),0)));bind(root,D.find(st,'ClickArea'),stageLineup)}
  if(merchant){const m=D.find(root,'DungeonMerchantMen');spineAt(D.find(m,'Mesh'),data.spines['Thuongnhan_'+d.node.merchant],'Idle',{scale:1});bind(root,D.find(m,'ClickArea'),buyPopup)}
  if(d.node?.type==='lotion')bind(root,D.find(root,'DungeonLotion/ClickArea'),collect);
  // Nút.
  bind(root,'ButtonBack',close);bind(root,'ButtonHelp',help);bind(root,'ButtonTop',top);bind(root,'ButtonSmashedMerchant',smashedMerchants);
  bind(root,'ButtonBattle',fight);bind(root,'ButtonBattleInactive',()=>c.toast(!d.open?'Đảo bánh đang đóng cửa.':!d.team.length?'Hãy chọn đội trước.':d.done?'Đã vượt hết các ải.':'Thuyền viên đã hết máu, hãy chọn thuyền viên khác.'));
  bind(root,'ButtonSkipMerchant',()=>act({op:'skip'}));
  bind(root,'ButtonCheckSkip',()=>{try{localStorage.setItem(SKIP_KEY,skipOn()?'0':'1')}catch{}render()});
  for(const k of [1,2,3])bind(root,'ButtonLotionHp'+k,()=>useHp(k));
 }
 async function act(body,opts={}){if(busy)return null;busy=true;try{return await c.mutation('/api/dungeon',body,{render:false,close:false,message:false,...opts})}finally{busy=false;if(root)render()}}
 function select(id){const d=v();if(id===d.selected)return;act({op:'select',heroId:id})}
 function chooseTeam(){
  if(v().team.length)return;
  c.pickTeam(I2('LBL_WORLD_SCENE_DUNGEON','Đảo bánh'),async slots=>{const heroes=slots.filter(Boolean).slice(0,5);if(!heroes.length)return c.toast('Hãy chọn thuyền viên.');const r=await act({op:'team',heroes});if(r)open()},{note:'Chọn tối đa 5 thuyền viên mạnh nhất. Máu của thuyền viên được giữ lại giữa các trận trong chu kỳ.'});
 }
 function useHp(k){
  const d=v();if(!d.lotions[k])return c.toast(lotionText.hp[k]);
  c.confirm(I2('MSG_DUNGEON_SCENE_DESC_WOULD_YOU_LIKE_TO_USE_THIS_ITEM','Bạn có muốn sử dụng vật phẩm này không?')+' '+lotionText.hp[k],I2('LBL_USE','Sử dụng'),null,()=>act({op:'use-hp',lotion:k,heroId:d.selected}));
 }
 async function collect(){
  const el=D.find(root,'DungeonLotion');el?.classList.add('dungeon-collect');await wait(350);
  const r=await act({op:'collect'});if(r?.result?.lotion){const {kind,id}=r.result.lotion;c.toast(lotionText[kind][id])}
 }
 async function fight(){
  const d=v();if(busy)return;busy=true;
  try{
   const skip=skipOn(),r=await c.mutation('/api/dungeon/fight',{heroId:d.selected,skip},{render:false,close:false,message:false});if(!r)return;
   if(!skip){close();await c.navigate(9);return}
   const res=r.result.result;if(res?.won){c.bonusPopup(res.rewards||[]);}else c.toast('Thất bại. Máu hai bên được giữ lại.');
  }finally{busy=false;if(root)render()}
 }
 // ---- Popup chung: shade + prefab.
 async function showPopup(id,build){
  const s=await scene(id),n=structuredClone(s.roots[0]);n.transform={...full};const extra=build(n)||{};
  const shade={id:'dsh',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.6]}],transform:full,children:[]};
  popup?.remove();popup=mount({id:'dp',name:'DungeonPopup',active:true,components:[],transform:full,children:[shade,n]},'dungeon-popup');
  const closeP=()=>{popup?.remove();popup=null};bind(popup,'Shade',closeP);for(const name of ['ButtonClose','Button_Close'])bind(popup,name,closeP);
  extra.after?.(popup,closeP);return popup;
 }
 function stageLineup(){
  const d=v();showPopup(1218,n=>{for(let i=1;i<=6;i++){const h=find(n,'HeroHeadClickable'+i),e=d.enemies[i-1];if(!h)continue;on(h,!!e);if(!e)continue;
   const dd=c.catalog().heroes.find(x=>x.avatar===String(e.avatar));pic(find(h,'ImageHead'),dd?.visual?.head||c.heroHead(e.avatar));txt(find(h,'TextLevel'),p().account.level);pic(find(h,'ImageFaction'),c.named('faction_'+(e.faction||'light')));
   for(const g of find(h,'HeroStar')?.children||[])on(g,false);on(find(h,'Death'),e.hp<=0);on(find(h,'SliderHp'),true);h.dungeonHp=e.hp}
   return{after:el=>{for(const x of el.querySelectorAll('.pd-node'))if(x._node?.dungeonHp!==undefined){const f=D.find(D.find(x,'SliderHp'),'Fill');if(f){f.style.right='auto';f.style.width=x._node.dungeonHp*100+'%'}}}}});
 }
 function priceIcon(price){return price.itemId==='gold'?c.named('icon_gold'):c.named('icon_gem')}
 function buyPopup(){
  const d=v(),good=d.node?.good;if(!good)return;
  showPopup(1286,n=>{const g=find(n,'GameItem');g.children=[];txt(find(n,'TextCost'),c.num(good.price.quantity));pic(find(n,'IconCurrency'),priceIcon(good.price));
   return{after:(el,closeP)=>{const host=D.find(el,'GameItem');host.innerHTML=`<span class="dungeon-tile">${c.rewardTile(good.reward)}</span>`;
    bind(el,'ButtonBuy',async()=>{const r=await act({op:'buy'});if(r){closeP();c.bonusPopup([good.reward])}})}}});
 }
 function smashedMerchants(){
  const d=v();showPopup(1323,n=>{for(const k of [1,2,3]){const m=find(n,'ImageMerchant'+k);pic(m,data.images['img_merchant_'+k]);pic(find(m,'Stuff'),data.images[`merchant_${k}_stuff`]);m.dungeonShop=k}
   return{after:el=>{for(const x of el.querySelectorAll('.pd-node')){const k=x._node?.dungeonShop;if(!k)continue;const count=(d.smashed[k]||[]).length;
    const badge=document.createElement('span');badge.className='dungeon-count';badge.textContent=count;x.appendChild(badge);bind(el,D.find(x,'ButtonEnter'),()=>smashedShop(k));bind(el,x,()=>smashedShop(k))}}}});
 }
 function smashedShop(k){
  const d=v(),list=d.smashed[k]||[];
  showPopup(1503,n=>{txt(find(n,'TextTitle'),merchantNames[k]);txt(find(find(n,'FieldGold'),'TextGold'),c.short(p().wallet.gold));txt(find(find(n,'FieldGem'),'TextGem'),c.short(p().wallet.diamonds));on(find(n,'CellMerchantShop'),false);
   return{after:el=>{const vp=D.find(el,'Viewport'),box=document.createElement('div');box.className='dungeon-shop';
    box.innerHTML=list.length?list.map((g,i)=>`<div class="dungeon-cell"><span class="dungeon-tile">${c.rewardTile(g.reward)}</span><button type="button" data-i="${i}"><img src="${c.assetSrc(priceIcon(g.price))}" alt="">${c.num(g.price.quantity)}</button></div>`).join(''):'<p class="dungeon-empty">Chưa có món hàng nào. Bỏ qua gian thương ở các ải thì món hàng của họ sẽ ở đây.</p>';
    vp.appendChild(box);for(const b of box.querySelectorAll('button'))b.onclick=async e=>{e.stopPropagation();const g=list[Number(b.dataset.i)],r=await act({op:'smashed-buy',merchant:k,index:Number(b.dataset.i)});if(r){c.bonusPopup([g.reward]);smashedShop(k)}}}}});
 }
 function help(){
  showPopup(1294,n=>{txt(find(n,'TextTitle'),I2('LBL_HELP','TRỢ GIÚP'));
   return{after:el=>{const lay=D.find(el,'Viewport'),box=document.createElement('div');box.className='dungeon-help';const d=v();
    box.innerHTML=`<h3>${c.escape(I2('LBL_WORLD_SCENE_DUNGEON','Đảo bánh'))}</h3><p>${c.escape(data.help)}</p><p>Mỗi trận cử 1 thuyền viên. Bình máu: nhỏ hồi 30%, vừa hồi 60%, lớn hồi đầy và hồi sinh. Bình tăng cường cộng Công / Nộ / Máu cho cả đội, tối đa ${d.buffMax} tầng mỗi loại.</p><p>Gian thương bán vật phẩm giá tốt; bỏ qua thì món hàng được giữ ở Cửa hàng Đảo Bánh. Đảo mở 2 ngày rồi đóng 1 ngày, mỗi lần mở lại bắt đầu từ ải 1. Cần cấp ${d.minLevel}.</p>`;lay.appendChild(box)}}});
 }
 async function top(){
  try{const r=await c.api('/api/dungeon/ranking');const row=x=>{const dd=c.catalog().heroes.find(h=>h.id===x.heroId);return `<li class="ranking-row ${x.me?'own':''}"><span class="ranking-number">${x.rank}</span><span class="ranking-avatar">${dd?`<img class="ranking-head" src="${c.assetSrc(dd.visual.head)}" alt="">`:''}</span><span class="ranking-name"><strong>${c.escape(x.name)}</strong><small>Cấp ${x.level}</small></span><span class="ranking-floor"><small>Ải</small><strong>${x.stages}</strong></span></li>`};
   c.modal(I2('LBL_TOP_ISLAND_CAKE','Top đảo bánh'),`<ol class="ranking-list dungeon-ranking">${r.top.map(row).join('')||'<li class="ranking-empty">Chưa có dữ liệu xếp hạng.</li>'}</ol>${r.me?`<ol class="ranking-self">${row(r.me)}</ol>`:''}`)}catch(e){c.toast(e.message)}
 }
 function close(){clearInterval(timer);popup?.remove();popup=null;root?.remove();root=null}
 window.DungeonUI={init(ctx){c=ctx},open,close,isOpen:()=>!!root};
})();
