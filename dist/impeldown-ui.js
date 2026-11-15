/* Vượt Ngục Impel Down (bundle `impeldown`): dựng nguyên prefab EventMain / Gift / GiftOpenTile bằng PrefabDOM rồi đổ dữ
 * liệu theo PanelEventImpleDownHome / ImpleDownTile / ImpleDownTower / ImpleDownPopupGiftAchieve / ImpleDownPopupGiftOpenTile.
 * Luật ở server/impeldown.mjs. */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,root=null,busy=false;
 const W=1136,H=640;
 const art=k=>data.art[k]?c.assetSrc(data.art[k]):'';
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const render=(name,w=W,h=H)=>D.render(data.prefabs[name],w,h,opts());
 const find=(el,p)=>D.find(el,p),show=D.show,text=(el,s,rich=false)=>D.setText(el,s,rich);
 const st=()=>c.player().impelDown;
 const layer=()=>document.querySelector('#game-layer');
 const floorOf=()=>st().floors[st().current-1];
 const tile=(r,cls='')=>c.eventTile(r,'im-tile '+cls);
 async function act(url,body){if(busy)return null;busy=true;try{return await c.mutation(url,body,{close:false,render:false,bonus:false,message:false})}finally{busy=false}}

 function fill(){
  if(!root?.isConnected)return;const s=st(),f=floorOf();
  text(find(root,'KeyNumber/Number'),c.short(s.keys));
  text(find(root,'DescFloor'),`Tầng ${s.current}, cần ${f.keyCost} chìa để mở ô`);
  // Tháp: tầng ≤ tầng mở cao nhất mới hiện, mũi tên ở tầng đang xem.
  for(let i=1;i<=7;i++){const t=find(root,'TowerArea/Tower/Tower_'+i);show(t,i<=s.maxFloor);t.dataset.floor=i;show(find(t,'Arrow'),i===s.current)}
  const tiles=[...find(root,'Tiles').children];
  tiles.forEach((t,i)=>{const v=f.tiles[i];t.dataset.index=i;
   show(find(t,'NotOpened'),v===null);show(find(t,'Door'),v===0);show(find(t,'Opened'),v>0);
   const box=find(t,'Opened/ImageItem'),num=find(t,'Opened/NumberItem');
   if(v>0){const pr=f.prizes[v-1];show(box,true);box.innerHTML=tile(pr.reward,'small');show(num,false)}else if(box)box.innerHTML=''});
 }
 // ---- Quà đạt mốc (Gift) / Quà trong tầng (GiftOpenTile)
 function achievePopup(){
  const pop=find(root,'PopupGiftAchieve'),content=find(pop,'Content/Scroll View/Viewport/Content');show(pop,true);content.innerHTML='';
  const list=[...st().achievements].sort((a,b)=>(a.status===2)-(b.status===2)||a.need-b.need);
  list.forEach((a,i)=>{const row=render('Gift',673,131);row.classList.add('im-row');Object.assign(row.style,{position:'relative',left:'0',top:'0',margin:'0 auto 8px'});
   text(find(row,'Number'),String(a.need));text(find(row,'Progress'),`(${Math.min(st().opened,a.need)}/${a.need})`);
   find(row,'ItemConsum/Scroll View/Viewport').innerHTML=`<div class="im-rewards">${a.rewards.map(r=>tile(r)).join('')}</div>`;
   const btn=find(row,'ButtonReceive'),done=find(row,'StatusGift');show(btn,a.status===1);show(done,a.status!==1);text(done,a.status===2?'Đã nhận quà':'Chưa đủ điều kiện nhận');btn.dataset.claim=a.id;
   content.appendChild(row)});
  content.style.height='auto';
 }
 function bonusPopup(){
  const pop=find(root,'PopupGiftBonus'),content=find(pop,'Content/Scroll View/Viewport/Content'),f=floorOf();show(pop,true);content.innerHTML='';
  text(find(pop,'PopupTitle'),`Quà trong tầng ${f.floor}`);
  const rows=[...f.prizes.map(p=>({reward:p.reward,progress:`(${p.taken}/${p.count})`})),...f.door.map(r=>({reward:r,progress:f.tiles.includes(0)?'Cửa · Đã mở':'Cửa · (0/1)'}))];
  for(const x of rows){const row=render('GiftOpenTile',645,131);row.classList.add('im-row');Object.assign(row.style,{position:'relative',left:'0',top:'0',margin:'0 auto 8px'});
   text(find(row,'ItemName'),c.items.get(x.reward.itemId)?.name||{gold:'Vàng',diamonds:'Kim cương',spirit:'EXP tướng'}[x.reward.itemId]||x.reward.itemId);text(find(row,'Progress'),x.progress);
   find(row,'ItemConsum').innerHTML=tile(x.reward);content.appendChild(row)}
  content.style.height='auto';
 }
 // Quà vừa nhận bay lên ở TrfBonus (ItemBonusShow).
 function flyReward(rewards,at){
  for(const [i,r] of rewards.entries()){const el=document.createElement('div');el.className='im-fly';el.innerHTML=tile(r);Object.assign(el.style,{left:at.x+'px',top:(at.y-i*60)+'px'});layer().appendChild(el);setTimeout(()=>el.remove(),1600)}
 }
 const centerOf=el=>{const lr=layer().getBoundingClientRect(),r=el.getBoundingClientRect(),k=lr.width/W;return{x:(r.left+r.width/2-lr.left)/k-40,y:(r.top-lr.top)/k-20}};
 async function onClick(e){
  const b=e.target.closest('.pd-button,[data-claim],[data-floor]');if(!b||!root.contains(b))return;if(e.target.closest('.ev-tile')&&!b.dataset.claim)return;
  const name=b.dataset.name;
  if(b.dataset.claim&&name==='ButtonReceive'){const r=await act('/api/impel/claim',{id:Number(b.dataset.claim)});if(r){c.toast('Nhận quà đạt mốc.');achievePopup();fill()}return}
  if(b.dataset.floor&&b.closest('[data-name="Tower"]')){const f=Number(b.dataset.floor);if(f!==st().current&&await act('/api/impel/floor',{floor:f}))fill();return}
  const t=b.closest('[data-index]');
  if(t&&name==='NotOpened'){const f=floorOf();if(st().keys<f.keyCost)return keyPopup(`Không đủ chìa (cần ${f.keyCost}).`);
   const at=centerOf(t),r=await act('/api/impel/open',{floor:st().current,index:Number(t.dataset.index)});if(!r)return;fill();flyReward(r.result.rewards||[],at);if(r.result.door)c.toast(r.result.message);return}
  if(t&&name==='Door'){const s=st();if(s.current<7&&s.maxFloor>s.current){if(await act('/api/impel/floor',{floor:s.current+1}))fill()}else c.toast(s.current>=7?'Đã vượt ngục thành công!':'Hãy mở cửa để xuống tầng sau.');return}
  if(name==='ButtonClose'){const pop=b.closest('[data-name="PopupGiftAchieve"],[data-name="PopupGiftBonus"]');if(pop){show(pop,false);return}close();return}
  if(name==='ButtonGift')return achievePopup();
  if(name==='ButtonBonus')return bonusPopup();
  if(name==='ButtonHelp')return c.help();
  if(b.classList.contains('im-buy'))return keyPopup();
 }
 // Mua chìa bằng kim cương (giới hạn mỗi ngày).
 async function keyPopup(note=''){
  const s=st(),left=Math.max(0,s.buyLimit-s.bought);if(!left)return c.toast(note||'Hôm nay đã mua tối đa chìa.');
  const count=Math.min(left,10);
  if(await window.GameMessage.ask(`${note?note+'\n':''}Mua ${count} Chìa Khóa Vượt Ngục với giá ${s.keyPrice*count} kim cương? (Hôm nay còn mua được ${left})`,'Mua',{price:s.keyPrice*count})){const r=await act('/api/impel/buy',{count});if(r){c.toast(r.result.message);fill()}}
 }
 function close(){root?.remove();root=null}
 async function open(context){
  c=context;await load();close();
  await act('/api/impel/enter',{}).then(r=>{if(r?.result?.rewards?.length)c.toast(r.result.message)});
  root=render('EventMain');root.classList.add('im-root');layer().appendChild(root);
  const key=find(root,'KeyNumber');key.insertAdjacentHTML('beforeend','<button type="button" class="im-buy pd-button" aria-label="Mua chìa">+</button>');
  root.addEventListener('click',onClick);fill();
 }
 let loading=null;
 function load(){return data?Promise.resolve(data):loading??=fetch('impeldown.json').then(r=>r.json()).then(d=>data=d)}
 window.ImpelDownUI={open,close,load,refresh:fill,isOpen:()=>!!root,icon:()=>data?art('tower_unlock_7'):''};
})();
