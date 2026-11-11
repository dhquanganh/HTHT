/* Luyện tập — BraveTrialScene2 gốc (scene 41) dựng bằng PrefabDOM, luật ở server/brave.mjs, chữ trợ giúp ở brave.json.
 *   BraveMap: 15 ải (Stage1..15: đầu tướng chủ ải, số ải), đường chấm Path2..15 sáng tới ải đang đứng, ArrowFocus chỉ ải hiện tại,
 *   StageExtra1..5: rương mốc 3/6/9/12/15. Chạm ải -> PopupBravePlayerNew (đội hình địch 2 hàng, máu còn lại, thưởng, Tấn công).
 *   ButtonAlstarOfTrial: Tế đàn (PopupAlstarsOfTrial: Hồi sinh / Hồi máu / Phước lành, tốn huy hiệu, mua thêm).
 *   GroupBottomLeft Rage / Rock / Storm: cấp phước lành, chạm xem InformationBraveTrial. BoxCountDown: làm mới bản đồ sau.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,root=null,popup=null,data=null,main=null,timer=0,busy=false;const scenes={};
 const scene=id=>scenes[id]??=fetch(`scenes/${id}.json`).then(r=>r.json());
 const find=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=find(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const pic=(n,key)=>{const x=comp(n,'Image');if(x&&key)x.asset=key};
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5}};
 const p=()=>c.player(),v=()=>p().brave,headOf=avatar=>c.catalog().heroes.find(h=>h.avatar===String(avatar))?.visual?.head||c.heroHead(avatar);
 const clock=ms=>{const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return(d?d+' ngày ':'')+[h,m,s%60].map(x=>String(x).padStart(2,'0')).join(':')};
 // Đọc chữ gốc lúc dùng (localization.json tải xong sau khi module này chạy).
 const blessingText=()=>({rage:{name:I2('LBL_BRAVE_TRIAL_TITLE_RAGE','Cuồng nộ'),d1:I2('MSG_BRAVE_TRIAL_SCENE_INFO_RAGE_1','Với mỗi cấp độ phước lành, tấn công của đội tăng thêm 20%(chỉ có ở trận kế tiếp)'),d2:I2('MSG_BRAVE_TRIAL_SCENE_INFO_RAGE_2','')},
  rock:{name:I2('LBL_BRAVE_TRIAL_TITLE_ROCK','Đá tảng'),d1:I2('MSG_BRAVE_TRIAL_SCENE_INFO_ROCK_1','Với mỗi cấp độ phước lành, HP tối đa của đội tăng thêm 30% (chỉ có ở trận đấu kế tiếp)'),d2:I2('MSG_BRAVE_TRIAL_SCENE_INFO_ROCK_2','')},
  storm:{name:I2('LBL_BRAVE_TRIAL_TITLE_STORM','Bão tố'),d1:I2('MSG_BRAVE_TRIAL_SCENE_INFO_STORM_1','Với mỗi cấp độ phước lành, tốc độ của đội tăng thêm 50(chỉ có ở trận kế tiếp)'),d2:I2('MSG_BRAVE_TRIAL_SCENE_INFO_STORM_2','')}});
 const nodeKey={rage:'Rage',rock:'Rock',storm:'Storm'};
 const mount=(n,cls)=>{const skeletons=[];const el=D.render(n,W,H,{assetSrc:c.assetSrc,assets:c.assets(),onSkeleton:(e,sk)=>skeletons.push({e,sk})});el.classList.add('brave-layer',...cls.split(' '));c.layer().appendChild(el);
  for(const {e,sk} of skeletons){if(!sk.skeleton||e.closest('[style*="display: none"]'))continue;const cv=document.createElement('canvas');cv.width=cv.height=320;cv.className='brave-spine';e.appendChild(cv);c.spine(cv,{skeleton:sk.skeleton,animation:sk.animation||'animation'},{loop:true,scale:1})}
  return el};
 const bind=(el,x,f)=>{if(typeof x==='string')x=D.find(el,x);if(x){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();f(e)}}return x};
 async function open(){
  try{data??=await fetch('brave.json').then(r=>r.json());main??=await scene(41);const b=v();if(!b.unlocked)return c.toast(`Yêu cầu cấp độ ${b.minLevel}`);
   render();clearInterval(timer);timer=setInterval(tick,1000)}catch(e){c.toast(e.message)}
 }
 function tick(){if(!root?.isConnected)return clearInterval(timer);const left=v().resetAt-Date.now();if(left<=0){close();return c.toast('Luyện tập đã làm mới.')}D.setText(D.find(root,'TextCountDown'),clock(left))}
 function render(){
  if(!main)return;const n=structuredClone(main.roots.find(r=>r.name==='Canvas')),b=v();n.transform={...full};n.components=[];
  {const t=find(n,'TextOpen');txt(t,I2('LBL_REFESH_AFTER','Làm mới sau:'));const x=comp(t,'Text');if(x){x.overflow=1;x.align=5}}txt(find(n,'TextCountDown'),clock(b.resetAt-Date.now()));
  const map=find(n,'BraveMap');
  for(let i=1;i<=15;i++){
   const s=find(map,'Stage'+i),st=b.map[i-1];on(s,true);txt(find(s,'TextStage'),i);pic(find(s,'ImageHead'),headOf(st.head));s.braveStage=i;
   s.braveState=i<b.stage?'done':i===b.stage?'current':'locked';const path=find(map,'Path'+i);on(path,i<=b.stage&&i>1);
  }
  on(find(map,'BraveTrialStage'),false);
  // Mũi tên chỉ ải đang đánh.
  const arrow=find(map,'ArrowFocus');if(b.done)on(arrow,false);else{const s=find(map,'Stage'+b.stage);arrow.transform={...arrow.transform,m_AnchoredPosition:{x:s.transform.m_AnchoredPosition.x,y:s.transform.m_AnchoredPosition.y+70}}}
  b.milestones.forEach((m,i)=>{const e=find(map,'StageExtra'+(i+1));on(e,!m.claimed);e.braveChest=m.stage;e.braveReady=m.ready});
  on(find(n,'ButtonChest'),true);on(find(n,'SpineLoadNightMode'),false);
  for(const [k,name] of Object.entries(nodeKey)){const x=find(n,name);txt(find(x,'TurnNumber'),b.blessing[k]);x.braveBless=k}
  root?.remove();root=mount(n,'brave-main');
  for(const el of root.querySelectorAll('.pd-node')){const node=el._node;if(!node)continue;
   if(node.braveStage){el.classList.add('brave-stage',node.braveState);bind(root,el,()=>stagePopup(node.braveStage))}
   if(node.braveChest){el.classList.toggle('brave-ready',node.braveReady);bind(root,el,()=>node.braveReady?claim(node.braveChest):rewardPopup())}
   if(node.braveBless)bind(root,el,()=>blessInfo(node.braveBless));
  }
  bind(root,'ButtonBack',close);bind(root,'ButtonHelp',help);bind(root,'ButtonChest',rewardPopup);
  const altar=bind(root,'ButtonAlstarOfTrial',()=>v().altarOpen?altarPopup():c.toast(I2('MSG_BRAVE_TRIAL_SCENE_CHECK_OPEN_ALSTAR_OF_TRIAL','Hoàn thành màn 6 để mở khóa Tế đàn')));altar?.classList.toggle('brave-locked',!b.altarOpen);
 }
 async function act(body){if(busy)return null;busy=true;try{return await c.mutation('/api/brave',body,{render:false,close:false,message:false})}finally{busy=false;if(root)render()}}
 async function claim(stage){const r=await act({op:'claim',stage});if(r)c.bonusPopup(r.result.rewards||[])}
 // ---- Popup chung.
 async function showPopup(id,build){
  const s=await scene(id),n=structuredClone(s.roots[0]);n.transform={...full};const extra=build(n)||{};
  const shade={id:'bsh',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.6]}],transform:full,children:[]};
  popup?.remove();popup=mount({id:'bp',name:'BravePopup',active:true,components:[],transform:full,children:[shade,n]},'brave-popup');
  const closeP=()=>{popup?.remove();popup=null};bind(popup,'Shade',closeP);bind(popup,'ButtonClose',closeP);extra.after?.(popup,closeP);return popup;
 }
 function stagePopup(stage){
  const b=v(),st=b.map[stage-1];
  showPopup(1192,n=>{
   txt(find(n,'TextTitle'),`Ải ${stage}`);on(find(n,'SlotPet'),false);
   const info=find(n,'PlayerInfo');txt(find(info,'TextPlayerName'),st.enemies[0].name);on(find(info,'TextGuild'),false);pic(find(info,'PlayerAvatar'),headOf(st.head));on(find(info,'TagLevel'),false);
   txt(find(n,'TextLineup'),I2('LBL_LINE_UP','Đội hình'));
   const power=st.enemies.reduce((a,e)=>a+Math.round(((e.attack||0)*6+(e.maxHp||0)*.6+(e.defense||0)*4)*(e.hp??1)),0);txt(find(n,'TextPower'),power?c.num(power):'?');
   for(let i=1;i<=6;i++){const h=find(n,'HeroHeadClickable'+i),e=st.enemies[i-1];if(!h)continue;on(h,!!e);if(!e)continue;
    pic(find(h,'ImageHead'),headOf(e.avatar));txt(find(h,'TextLevel'),p().account.level);pic(find(h,'ImageFaction'),c.named('faction_'+(e.faction||'light')));
    for(const g of find(h,'HeroStar')?.children||[])on(g,false);on(find(h,'Death'),e.hp<=0);on(find(h,'SliderHp'),true);h.braveHp=e.hp}
   txt(find(n,'TextBattle'),I2('LBL_TITLE_ATTACK','Tấn công'));
   return{after:el=>{
    for(const x of el.querySelectorAll('.pd-node'))if(x._node?.braveHp!==undefined){const f=D.find(D.find(x,'SliderHp'),'Fill');if(f){f.style.right='auto';f.style.width=x._node.braveHp*100+'%'}}
    {const av=D.find(el,'PlayerAvatar');if(av){const im=document.createElement('img');im.className='brave-avatar';im.src=c.assetSrc(headOf(st.head));av.appendChild(im)}}
    const box=D.find(el,'Rewards');if(box){const row=document.createElement('div');row.className='brave-rewards';row.innerHTML=st.rewards.map(r=>c.rewardTile(r)).join('');box.appendChild(row)}
    const btn=D.find(el,'ButtonBattle');if(stage!==b.stage)btn?.classList.add('brave-locked');
    bind(el,btn,()=>stage<b.stage?c.toast('Đã vượt qua ải này.'):stage>b.stage?c.toast(`Hãy vượt qua ải ${b.stage} trước.`):fight());
   }};
  });
 }
 function fight(){
  const b=v(),alive=p().heroes.map(h=>h.id).filter(id=>(b.hp[id]??1)>0);if(!alive.length)return c.toast('Toàn bộ thuyền viên đã ngã. Hãy dùng Tế đàn để hồi sinh.');
  popup?.remove();popup=null;
  c.pickTeam(`${I2('LBL_WORLD_SCENE_BRAVE_TRIAL','Luyện tập')} · Ải ${b.stage}`,async slots=>{
   const r=await c.mutation('/api/brave/fight',{formation:slots},{close:false,render:false,message:false});if(r){close();await c.navigate(9)}
  },{allow:alive,note:'Thuyền viên không hồi phục giữa các trận. Thuyền viên đã ngã không thể ra trận.'});
 }
 function rewardPopup(){
  const b=v();
  showPopup(1349,n=>{txt(find(n,'TextTitle'),I2('TITLE_REWARD','Phần thưởng'));b.milestones.forEach((m,i)=>{const ch=find(n,'ChestBraveReward'+(i+1));ch.braveChest=m;const sk=comp(find(ch,'SpineChest'),'SkeletonGraphic');if(sk)sk.animation=m.ready&&!m.claimed?'Animation':'Closed'});
   return{after:el=>{const fill=D.find(el,'Fill');if(fill){fill.style.right='auto';fill.style.width=Math.min(1,(b.stage-1)/15)*100+'%'}
    for(const x of el.querySelectorAll('.pd-node')){const m=x._node?.braveChest;if(!m)continue;x.classList.toggle('brave-ready',m.ready&&!m.claimed);x.classList.toggle('brave-claimed',m.claimed);
     bind(el,x,()=>m.ready&&!m.claimed?claim(m.stage).then(()=>rewardPopup()):c.modal(`Rương ải ${m.stage}`,`<p class="item-description">${m.claimed?'Đã nhận.':`Vượt qua ải ${m.stage} để mở rương.`}</p><div class="reward-items brave-modal-rewards">${m.rewards.map(r=>c.rewardTile(r)).join('')}</div>`))}}}});
 }
 function blessInfo(kind){
  const k=blessingText()[kind];
  showPopup(1027,n=>{n.transform={...n.transform,m_AnchorMin:{x:.5,y:.5},m_AnchorMax:{x:.5,y:.5},m_AnchoredPosition:{x:0,y:0},m_SizeDelta:{x:391,y:307}};
   txt(find(find(n,'Title'),'Text'),`${k.name} · Cấp ${v().blessing[kind]}`);txt(find(n,'Desc1'),k.d1);txt(find(n,'Desc2'),k.d2);on(find(n,'Icon'),false);
   pic(find(find(n,'Title'),'Image'),comp(find(main.roots.find(r=>r.name==='Canvas'),nodeKey[kind]),'Image')?.asset)});
 }
 function altarPopup(){
  const b=v();
  showPopup(1269,n=>{txt(find(n,'NumberBadge'),b.badges);
   const desc={Revival:`Hồi sinh 1 thuyền viên đã ngã với 60% máu.`,Healing:'Hồi 50% máu cho mọi thuyền viên bị thương.',Blessing:'Tăng 1 cấp phước lành: Cuồng nộ, Đá tảng hoặc Bão tố (chỉ có ở trận kế tiếp).'};
   for(const k of Object.keys(desc)){const g=find(n,k);g.braveAltar=k}
   return{after:(el,closeP)=>{
    for(const x of el.querySelectorAll('.pd-node')){const k=x._node?.braveAltar;if(!k)continue;const d=document.createElement('p');d.className='brave-altar-desc';d.innerHTML=`${c.escape(desc[k])}<br><b>1 huy hiệu</b>`;D.find(x,'Bgr').appendChild(d);
     bind(el,D.find(x,'Button'),()=>altarUse(k,closeP))}
    bind(el,D.find(el,'ButtonAdd'),buyBadge);bind(el,D.find(el,'ButtonHelp'),help);
   }};
  });
 }
 function altarUse(kind,closeP){
  const b=v();if(b.badges<=0)return buyBadge();
  if(kind==='Healing')return act({op:'heal'}).then(r=>{if(r){c.toast('Đã hồi máu cho đội.');altarPopup()}});
  if(kind==='Revival'){const dead=p().heroes.filter(h=>b.hp[h.id]===0);if(!dead.length)return c.toast('Không có thuyền viên nào đã ngã.');
   return pickList('Hồi sinh',dead.map(h=>{const d=c.catalog().heroes.find(x=>x.id===h.id);return{key:h.id,label:d?.name||h.id,img:d?.visual?.head}}),id=>act({op:'revive',heroId:id}).then(r=>{if(r){c.toast('Đã hồi sinh thuyền viên.');altarPopup()}}))}
  pickList('Phước lành',Object.entries(blessingText()).map(([k,x])=>({key:k,label:`${x.name} (cấp ${b.blessing[k]})`,img:comp(find(main.roots.find(r=>r.name==='Canvas'),nodeKey[k]),'Image')?.asset})),k=>act({op:'bless',kind:k}).then(r=>{if(r){c.toast(`${blessingText()[k].name} +1`);altarPopup()}}));
 }
 function pickList(title,items,pick){
  c.modal(title,`<div class="brave-pick">${items.map(x=>`<button type="button" data-brave-pick="${c.escape(x.key)}">${x.img?`<img src="${c.assetSrc(x.img)}" alt="">`:''}<span>${c.escape(x.label)}</span></button>`).join('')}</div>`);
  for(const b of document.querySelectorAll('[data-brave-pick]'))b.onclick=()=>{document.querySelector('#dialog-ui').innerHTML='';pick(b.dataset.bravePick)};
 }
 function buyBadge(){const b=v();if(b.badgeBuyLeft<=0)return c.toast('Đã hết lượt mua huy hiệu.');c.confirm(`Mua 1 huy hiệu với ${b.badgePrice} kim cương?`,'Mua huy hiệu',b.badgePrice,()=>act({op:'buy-badge',count:1}).then(r=>{if(r&&popup)altarPopup()}))}
 function help(){c.modal(I2('LBL_WORLD_SCENE_BRAVE_TRIAL','Luyện tập'),`<p class="item-description">${c.escape(data.help)}</p>${Object.values(blessingText()).map(k=>`<p class="item-description"><b>${c.escape(k.name)}:</b> ${c.escape(k.d1)}</p>`).join('')}<p class="item-description">Tế đàn mở sau màn 6, mỗi lần dùng tốn 1 huy hiệu (nhận 1 huy hiệu mỗi ải vượt qua). Bản đồ làm mới mỗi 2 ngày.</p>`)}
 function close(){clearInterval(timer);popup?.remove();popup=null;root?.remove();root=null}
 window.BraveUI={init(ctx){c=ctx},open,close,isOpen:()=>!!root};
})();
