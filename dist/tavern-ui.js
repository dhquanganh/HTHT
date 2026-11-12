/* Tổng bộ — TarvenScene gốc (scene 31) dựng bằng PrefabDOM, luật ở server/tavern.mjs.
 *   Top: kim cương, cuộn nhiệm vụ thường / khó (TextFieldScrollBasic / Senior). NextRefresh: bảng mới sau.
 *   ScrollQuest: mỗi nhiệm vụ một CellTarvenQuest (sao, phần thưởng GameItem, thời gian / tiến độ, Khoá, Hoàn thành ngay, Hủy, Nhận).
 *   ButtonRefresh (kim cương), ButtonGenQuestBasic / ButtonGenQuestSenior (dùng cuộn).
 *   Chạm nhiệm vụ chưa làm -> PopupTarvenQuest: yêu cầu (TarvenQuestRequirementUI), ô thuyền viên (SlotHeroQuest),
 *   Tự động / Bắt đầu / Bỏ tướng, danh sách thuyền viên để chọn.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,root=null,popup=null,main=null,timer=0,busy=false,pick=null;const scenes={};
 const scene=id=>scenes[id]??=fetch(`scenes/${id}.json`).then(r=>r.json());
 const deep=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=deep(k,name);if(r)return r}return null};
 const kid=(n,path)=>path.split('/').reduce((x,p)=>x&&(x.children||[]).find(k=>k.name===p),n);
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const pic=(n,key)=>{const x=comp(n,'Image');if(x&&key)x.asset=key};
 const tag=(n,v)=>{if(n)n.tav=v;return n};
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5},m_LocalScale:{x:1,y:1,z:1}};
 const p=()=>c.player(),v=()=>p().tavern;
 const fmt=ms=>{ms=Math.max(0,ms);const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return(d?d+' ngày ':'')+[h,m,s%60].map(x=>String(x).padStart(2,'0')).join(':')};
 const hours=ms=>{const h=ms/3600000;return h>=1?`${+h.toFixed(1)} giờ`:`${Math.round(ms/60000)} phút`};
 const heroDef=id=>c.catalog().heroes.find(h=>h.id===id)||{};
 const heroInfo=h=>{const d=heroDef(h.id);return{id:h.id,stars:h.stars||1,level:h.level||1,faction:d.faction||'light',class:d.class||'warrior',head:d.visual?.head,name:d.name||h.id}};
 const reqIcon=r=>r.type==='faction'?c.named('faction_'+r.value):r.type==='class'?(c.named('class_'+r.value)||c.named('class_warrior')):c.named('tarven_star');
 const reqName=r=>r.type==='star'?`Thuyền viên ${r.value} sao trở lên`:r.type==='faction'?`Hệ ${({abyss:'Vực thẳm',light:'Ánh sáng',dark:'Bóng tối',forest:'Rừng rậm',fortress:'Pháo đài',shadow:'Hư ảnh'})[r.value]||r.value}`:`Nghề ${({fighter:'Chiến binh',mage:'Thuật sĩ',priest:'Mưu sĩ',warrior:'Thương',ranger:'Cung',assassin:'Kỵ'})[r.value]||r.value}`;
 const reqShort=r=>r.type==='star'?`${r.value} sao trở lên`:reqName(r);
 const meets=(r,h)=>r.type==='star'?h.stars>=r.value:r.type==='faction'?h.faction===r.value:h.class===r.value;
 const reqDone=(q,heroes)=>q.req.map(r=>heroes.filter(h=>meets(r,h)).length>=r.count);
 function mount(n,cls){const el=D.render(n,W,H,{assetSrc:c.assetSrc,assets:c.assets()});el.classList.add('tav-layer',...cls.split(' '));c.layer().appendChild(el);return el}
 function bindAll(el){for(const x of el.querySelectorAll('.pd-node')){const t=x._node?.tav;if(!t)continue;x.classList.add('pd-button');if(t.act==='quest')x.dataset.tavQuest=t.id;x.onclick=e=>{e.stopPropagation();handle(t)}}}
 // Nền dải sao đổi theo số sao (TarvenQuestStar.m_ImageBackground: bgr_star_1..7).
 function stars(n,count){pic(n,c.named('bgr_star_'+count));const g=deep(n,'GroupStar');(g?.children||[]).forEach((s,i)=>on(s,i<count))}
 // Phần thưởng: ẩn các dạng ô của GameItem gốc, vẽ ô thưởng chung lên trên.
 function rewardSlot(item){for(const k of item.children||[])on(k,false);item.tavReward=true}
 function drawRewards(el,list){let i=0;for(const x of el.querySelectorAll('.pd-node'))if(x._node?.tavReward){const r=list[i++];if(!r)continue;const box=document.createElement('div');box.className='tav-reward';box.innerHTML=c.rewardTile(r);x.appendChild(box)}}
 async function open(){
  try{main??=await scene(31);if(!v()?.unlocked)return c.toast(`Yêu cầu cấp độ ${v()?.minLevel||10}`);render();clearInterval(timer);timer=setInterval(tick,1000)}catch(e){c.toast(e.message)}
 }
 function tick(){
  if(!root?.isConnected)return clearInterval(timer);const now=Date.now(),t=v();
  if(t.resetAt<=now){c.api('/api/state').then(()=>render()).catch(()=>{});return}
  for(const x of root.querySelectorAll('.pd-node')){const n=x._node;if(n?.tavEnd){const left=n.tavEnd-now;D.setText(x,fmt(left));if(left<=0&&!n.tavFired){n.tavFired=true;render()}}
   if(n?.tavFill){const q=n.tavFill;x.style.width=(q.state==='done'?100:Math.min(100,Math.max(0,(now-(q.endAt-q.duration))/q.duration*100)))+'%'}}
  const cd=D.find(root,'TextCountDown');if(cd)D.setText(cd,fmt(t.resetAt-now));
 }
 function render(){
  if(!main)return;const n=structuredClone(main.roots.find(r=>r.name==='Canvas')),t=v(),inv=p().inventory||{};n.transform={...full};n.components=[];
  txt(deep(n,'NextRefresh'),I2('LBL_REFESH_AFTER','Làm mới sau:'));txt(deep(n,'TextCountDown'),fmt(t.resetAt-Date.now()));
  txt(kid(deep(n,'TextFieldGem'),'Text'),c.num(p().wallet.diamonds));
  txt(kid(deep(n,'TextFieldScrollBasic'),'Text'),c.num(inv[t.scrollItems.basic]||0));txt(kid(deep(n,'TextFieldScrollSenior'),'Text'),c.num(inv[t.scrollItems.senior]||0));
  txt(deep(n,'TextGemRefresh'),t.refreshCost);txt(deep(n,'TextScroll1'),1);txt(deep(n,'TextScroll2'),1);
  tag(deep(n,'ButtonRefresh'),{act:'refresh'});tag(deep(n,'ButtonGenQuestBasic'),{act:'scroll',kind:'basic'});tag(deep(n,'ButtonGenQuestSenior'),{act:'scroll',kind:'senior'});
  tag(deep(n,'ButtonBack'),{act:'close'});tag(deep(n,'ButtonHelp'),{act:'help'});tag(deep(n,'ButtonInfo'),{act:'rates'});
  const tpl=deep(n,'CellTarvenQuest'),box=deep(n,'BoxQuest');box.children=box.children.filter(k=>k!==tpl);
  const content=kid(deep(n,'ScrollQuest'),'Viewport/Content'),list=t.quests.map(q=>cell(tpl,q));
  const height=list.length*120+Math.max(0,list.length-1)*8+12;
  content.transform={...content.transform,m_AnchorMin:{x:0,y:1},m_AnchorMax:{x:1,y:1},m_Pivot:{x:.5,y:1},m_AnchoredPosition:{x:0,y:0},m_SizeDelta:{x:0,y:height}};
  content.components=[{type:'VerticalLayoutGroup',spacing:8,padding:[0,0,6,6],align:1,controlWidth:true,forceWidth:true}];content.children=list;
  const old=root?.querySelector('[data-name="Viewport"]')?.scrollTop||0;root?.remove();root=mount(n,'tav-main');bindAll(root);drawRewards(root,t.quests.map(q=>q.reward));
  if(!t.quests.length){const e=document.createElement('p');e.className='tav-empty';e.textContent='Không còn nhiệm vụ. Hãy làm mới hoặc dùng cuộn nhiệm vụ.';D.find(root,'ScrollQuest')?.appendChild(e)}
  for(const x of root.querySelectorAll('.pd-node')){const ids=x._node?.tavHeroes;if(!ids)continue;const d=document.createElement('div');d.className='tav-crew';d.innerHTML=ids.map(id=>{const h=heroDef(id);return`<img src="${c.assetSrc(h.visual?.head)}" alt="" title="${c.escape(h.name||id)}">`}).join('');x.appendChild(d)}
  const vp=root.querySelector('[data-name="Viewport"]');if(vp)vp.scrollTop=old;tick();
 }
 function cell(tpl,q){
  const n=structuredClone(tpl);on(n,true);tag(n,q.state==='waiting'?{act:'quest',id:q.id}:null);stars(deep(n,'TarvenStar'),q.star);rewardSlot(deep(n,'GameItem'));
  const time=deep(n,'GoTime'),act=deep(n,'GoAction');
  on(deep(time,'IconClock'),q.state==='waiting');txt(deep(time,'TextTime'),hours(q.duration));on(deep(time,'SliderProgress'),q.state!=='waiting');
  if(q.state!=='waiting'){const pr=deep(time,'TextProgress');if(q.state==='running'){pr.tavEnd=q.endAt}else txt(pr,I2('LBL_COMPLETED','Hoàn thành'));const fill=deep(deep(time,'SliderProgress'),'Fill');if(fill)fill.tavFill=q}
  on(kid(act,'ButtonLock'),q.state==='waiting'&&q.locked);on(kid(act,'ButtonUnlock'),q.state==='waiting'&&!q.locked);
  tag(kid(act,'ButtonLock'),{act:'lock',id:q.id});tag(kid(act,'ButtonUnlock'),{act:'lock',id:q.id});
  on(kid(act,'ButtonSpeedUp'),q.state==='running');txt(deep(kid(act,'ButtonSpeedUp'),'TextGem'),q.speedUp);tag(kid(act,'ButtonSpeedUp'),{act:'speed',id:q.id,cost:q.speedUp});
  on(kid(act,'ButtonCancel'),q.state==='running');tag(kid(act,'ButtonCancel'),{act:'cancel',id:q.id});
  on(kid(act,'ButtonComplete'),q.state==='done');tag(kid(act,'ButtonComplete'),{act:'claim',id:q.id});
  // Thuyền viên đang làm nhiệm vụ: hiện đầu tướng giữa ô (dùng chỗ trống của cell).
  if(q.state!=='waiting')n.tavHeroes=q.heroes;
  return n;
 }
 async function act(body,{rerender=true}={}){if(busy)return null;busy=true;try{return await c.mutation('/api/tavern',body,{render:false,close:false,message:false})}finally{busy=false;if(rerender&&root)render()}}
 async function handle(t){
  const q=t.id&&v().quests.find(x=>x.id===t.id);
  if(t.act==='close')return close();
  if(t.act==='help')return c.modal(I2('LBL_WORLD_SCENE_TARVEN','Tổng bộ'),`<p class="item-description">${c.escape(I2('MSG_POPUP_TARVEN_QUEST_HELP','').replace(/(\d\.)/g,'\n$1').trim()).replace(/\n/g,'<br>')}</p><p class="item-description">Mỗi ngày nhận ${v().daily} nhiệm vụ (theo cấp VIP). ${c.escape(I2('MSG_CELL_TARVEN_QUEST_UNLOCK_CLICK','Khoá nhiệm vụ thì làm mới sẽ không mất'))}. Cuộn Nhiệm vụ thường cho nhiệm vụ 1-3 sao, Nhiệm vụ khó cho 4-7 sao.</p>`);
  if(t.act==='rates')return c.modal(I2('LBL_PERCENT_MISSION','TỈ LỆ NHIỆM VỤ'),`<table class="tav-rates"><tr><th>Nhiệm vụ</th><th>Tỉ lệ</th><th>Thời gian</th></tr>${Object.entries(v().rates).map(([s,r])=>`<tr><td>${'★'.repeat(+s)}</td><td>${r}%</td><td>${hours(v().hours[s]*3600000)}</td></tr>`).join('')}</table>`);
  if(t.act==='refresh'){const go=()=>act({op:'refresh'});return v().quests.some(x=>x.state==='waiting'&&!x.locked&&x.star>=4)?c.confirm(I2('MSG_TARVEN_SCENE_DESC','Có nhiệm vụ 4 sao trở lên. Bạn có muốn làm mới không?'),I2('LBL_REFRESH','Làm mới'),v().refreshCost,go,I2('LBL_REFRESH','Làm mới')):c.confirm(`Làm mới các nhiệm vụ chưa khoá với ${v().refreshCost} kim cương?`,I2('LBL_REFRESH','Làm mới'),v().refreshCost,go,I2('LBL_REFRESH','Làm mới'))}
  if(t.act==='scroll'){const r=await act({op:'scroll',kind:t.kind});if(r)c.toast(r.result?.message||r.message||'Đã nhận nhiệm vụ.');return}
  if(t.act==='lock'){const r=await act({op:'lock',questId:t.id});if(r&&q&&!q.locked)c.toast(I2('MSG_CELL_TARVEN_QUEST_UNLOCK_CLICK','Khoá nhiệm vụ thì làm mới sẽ không mất'));return}
  if(t.act==='speed')return c.confirm(I2('MSG_CELL_TARVEN_QUEST_SPEED_CLICK','Dùng {0} kim cương để hoàn thành nhiệm vụ ngay?').replace('{0}',t.cost),I2('LBL_SPEED_UP','Hoàn thành'),t.cost,()=>act({op:'speed-up',questId:t.id}),I2('LBL_SPEED_UP','Hoàn thành'));
  if(t.act==='cancel')return c.confirm('Hủy nhiệm vụ? Thuyền viên sẽ được trả về.',I2('LBL_CANCEL','Hủy'),null,()=>act({op:'cancel',questId:t.id}));
  if(t.act==='claim'){const r=await act({op:'claim',questId:t.id});if(r)c.bonusPopup(r.result?.rewards||[]);return}
  if(t.act==='quest'&&q){pick={id:q.id,heroes:[]};return questPopup()}
  if(t.act==='slot'&&pick){pick.heroes.splice(t.i,1);return questPopup()}
  if(t.act==='auto')return autoFill();
  if(t.act==='remove'&&pick){pick.heroes=[];return questPopup()}
  if(t.act==='start')return start();
  if(t.act==='pclose'){popup?.remove();popup=null;pick=null}
 }
 const free=()=>{const busyIds=new Set(v().busy);return p().heroes.filter(h=>!busyIds.has(h.id)).map(heroInfo)};
 function autoFill(){
  const q=v().quests.find(x=>x.id===pick.id),pool=free(),chosen=[];
  // Tham lam: lần lượt lấy thuyền viên đáp ứng nhiều yêu cầu còn thiếu nhất, sao thấp trước để dành tướng mạnh.
  while(chosen.length<q.slots){
   const missing=q.req.filter((r,i)=>!reqDone(q,chosen)[i]),left=pool.filter(h=>!chosen.includes(h));if(!left.length)break;
   left.sort((a,b)=>missing.filter(r=>meets(r,b)).length-missing.filter(r=>meets(r,a)).length||a.stars-b.stars||a.level-b.level);chosen.push(left[0]);
  }
  pick.heroes=chosen.map(h=>h.id);if(!reqDone(q,chosen).every(Boolean))c.toast(I2('MSG_POPUP_TARVEN_QUEST_SAILOR_INCORRECT','Thuyền viên không thỏa mãn yêu cầu'));questPopup();
 }
 async function start(){
  const q=v().quests.find(x=>x.id===pick.id),heroes=pick.heroes.map(id=>heroInfo(p().heroes.find(h=>h.id===id)));
  if(heroes.length<q.slots)return c.toast(I2('MSG_POPUP_TARVEN_QUEST_ENTER_ENOUGHT_CREW','Hãy nhập đủ Thuyền viên'));
  if(!reqDone(q,heroes).every(Boolean))return c.toast(I2('MSG_POPUP_TARVEN_QUEST_SAILOR_INCORRECT','Thuyền viên không thỏa mãn yêu cầu'));
  const r=await act({op:'start',questId:q.id,heroes:pick.heroes},{rerender:false});if(r){popup?.remove();popup=null;pick=null;render()}
 }
 async function questPopup(){
  const [s,slotS]=await Promise.all([scene(1121),scene(1320)]),q=v().quests.find(x=>x.id===pick?.id);if(!q)return;
  const n=structuredClone(s.roots[0]);n.transform={...full};
  // Chừa chỗ cho dải thuyền viên ở đáy màn hình.
  {const ct=kid(n,'Content');ct.transform={...ct.transform,m_AnchoredPosition:{x:0,y:(ct.transform.m_AnchoredPosition?.y||0)+62}}}
  stars(deep(n,'TarvenStar'),q.star);txt(deep(n,'TextCountdown'),hours(q.duration));rewardSlot(deep(n,'GameItem'));
  txt(deep(n,'TextRequirement'),I2('LBL_REQUEST','Yêu cầu'));tag(deep(deep(n,'TextRequirement'),'ButtonHelp'),{act:'help'});
  const chosen=pick.heroes.map(id=>heroInfo(p().heroes.find(h=>h.id===id))),done=reqDone(q,chosen);
  const box=deep(n,'GroupRequirement'),slotRow=kid(box,'GroupSlot'),reqRow=kid(box,'GroupRequirement');
  slotRow.children=Array.from({length:q.slots},(_,i)=>{const sl=structuredClone(slotS.roots[0]);sl.transform={...sl.transform,m_AnchoredPosition:{x:0,y:0}};const h=chosen[i];
   const hh=deep(sl,'HeroHeadUI');on(hh,!!h);if(h){pic(deep(hh,'ImageHead'),h.head);txt(deep(hh,'TextLevel'),h.level);pic(deep(hh,'ImageFaction'),c.named('faction_'+h.faction));sl.tavStars=h.stars;tag(sl,{act:'slot',i})}
   for(const g of deep(hh,'HeroStar')?.children||[])on(g,false);return sl});
  // Yêu cầu: ô gốc TarvenQuestRequirementUI chỉ 40px, chữ số đè lên biểu tượng nên khó đọc; vẽ thẻ rõ ràng
  // (biểu tượng, tên yêu cầu, số thuyền viên đạt / cần) vào đúng hàng GroupRequirement.
  reqRow.children=[];reqRow.components=[];reqRow.tavReqs=q.req.map((r,i)=>({r,ok:done[i],have:chosen.filter(h=>meets(r,h)).length}));
  for(const [b,a,label] of [['ButtonAuto','auto','Tự động'],['ButtonStart','start','Bắt đầu'],['ButtonRemove','remove','Bỏ tướng']]){const x=deep(n,b);tag(x,{act:a});txt(kid(x,'Text'),I2({auto:'LBL_AUTO',start:'LBL_START',remove:'LBL_REMOVE_HERO'}[a],label))}
  tag(deep(n,'ButtonClose'),{act:'pclose'});
  const shade={id:'tsh',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.6]}],transform:full,children:[]};tag(shade,{act:'pclose'});
  popup?.remove();popup=mount({id:'tp',name:'TavernPopup',active:true,components:[],transform:full,children:[shade,n]},'tav-popup');bindAll(popup);drawRewards(popup,[q.reward]);
  for(const x of popup.querySelectorAll('.pd-node')){const reqs=x._node?.tavReqs;if(reqs){const row=document.createElement('div');row.className='tav-reqs';
    row.innerHTML=reqs.map(({r,ok,have})=>`<span class="tav-req ${ok?'ok':'miss'}" title="${c.escape(reqName(r))}">${r.type==='star'?'<i class="tav-req-star">★</i>':`<img src="${c.assetSrc(reqIcon(r))}" alt="">`}<span>${c.escape(reqShort(r))}</span><b>${Math.min(have,r.count)}/${r.count}</b></span>`).join('');x.appendChild(row)}
   if(x._node?.tavStars){const b=document.createElement('b');b.className='tav-slot-star';b.textContent=x._node.tavStars+'★';x.appendChild(b)}}
  // Danh sách thuyền viên rảnh để chọn (dưới khung popup).
  const strip=document.createElement('div');strip.className='tav-heroes';const busyIds=new Set(v().busy);
  strip.innerHTML=p().heroes.map(heroInfo).sort((a,b)=>b.stars-a.stars||b.level-a.level).map(h=>{const sel=pick.heroes.includes(h.id),b=busyIds.has(h.id),fit=q.req.some(r=>meets(r,h));
   return`<button type="button" class="tav-hero${sel?' selected':''}${b?' busy':''}${fit?' fit':''}" data-tav-hero="${c.escape(h.id)}" title="${c.escape(h.name)}"><img src="${c.assetSrc(h.head)}" alt=""><img class="tav-faction" src="${c.assetSrc(c.named('faction_'+h.faction))}" alt=""><i>${h.level}</i><b>${h.stars}★</b>${b?'<em>Đang làm</em>':''}</button>`}).join('')||'<p>Chưa có thuyền viên.</p>';
  popup.appendChild(strip);
  for(const b of strip.querySelectorAll('[data-tav-hero]'))b.onclick=e=>{e.stopPropagation();const id=b.dataset.tavHero;if(busyIds.has(id))return c.toast('Thuyền viên đang làm nhiệm vụ khác.');
   const i=pick.heroes.indexOf(id);if(i>=0)pick.heroes.splice(i,1);else if(pick.heroes.length<q.slots)pick.heroes.push(id);else return c.toast('Đã đủ thuyền viên. Chạm ô để bỏ bớt.');questPopup()};
 }
 function close(){clearInterval(timer);popup?.remove();popup=null;pick=null;root?.remove();root=null}
 window.TavernUI={init(ctx){c=ctx},open,close,isOpen:()=>!!root};
})();
