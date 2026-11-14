/* Ngọc Vega (bundle `gem` + GemMain của lua_ex): dựng nguyên prefab gốc bằng PrefabDOM rồi đổ dữ liệu theo đúng các
 * lớp Lua gốc: GemManager (3 thẻ), GemPopupEquip / GemSlotUI / GemPopupHeroGemInfo / GemPopupListGemSelect (khảm),
 * GemPopupInventory / GemPopupItemInfo (túi + bán), GemPopupSummon / GemSlotMaterial / GemPopupSelectMaterial /
 * GemPopupReceiveGem (chế tạo), GemPopupListBoss / GemCardBoss / GemPopupBossMain / GemPopupBossSelectDebuff /
 * GemPopupDebuffInfo / GemPopupBossReward (Boss ngọc). Luật và số liệu ở server/gem.mjs.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,root=null,z=40;
 const W=1136,H=640,GREEN='#B1F144';
 const art=key=>data.art[key]?c.assetSrc(data.art[key]):'';
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets(),onSkeleton:(el,comp)=>{el._skeleton=comp}});
 const render=(name,w=W,h=H)=>D.render(data.prefabs[name],w,h,opts());
 const find=(el,path)=>D.find(el,path),show=D.show,text=(el,s,rich=true)=>D.setText(el,s,rich);
 const img=(el,src,size='100% 100%')=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();el.style.backgroundImage=src?`url('${src}')`:'none';el.style.backgroundSize=size;el.style.backgroundRepeat='no-repeat';el.style.backgroundPosition='center'};
 const layer=()=>document.querySelector('#game-layer');
 // Mask của ô (showMaskGraphic tắt trong Unity) chỉ cắt hình: bỏ ảnh nền, không chặn chạm khi ô trống.
 const clearMask=(mask,blocking=false)=>{if(!mask)return;mask.querySelector(':scope>.pd-image')?.remove();mask.style.backgroundImage='none';mask.style.backgroundColor='transparent';mask.style.pointerEvents=blocking?'':'none'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
 const gemState=()=>c.player().gem||{gems:[],heroes:{},sets:{},boss:[],milestones:[]};
 const gemById=id=>gemState().gems.find(g=>g.id===id);
 const setById=id=>data.sets.find(s=>s.id===id);
 const classNames={mage:'Chỉ huy',warrior:'Đấu sĩ',priest:'Hỗ trợ',ranger:'Xạ thủ',assassin:'Kiếm sĩ'};
 const qualityNames=['','Xám','Xanh Lục','Xanh Dương','Tím','Cam','Đỏ'],qualityFrame=[0,11,2,3,4,5,6],qualityColor=['','#c9c9c9','#7be36b','#5fb7ff','#d07bff','#ffb340','#ff5a4a'];
 const tierNames=['Dễ','Trung Bình','Khó','Thử Thách','Ác Mộng','Địa Ngục'];
 const heroClass=d=>d?.class==='fighter'?'warrior':d?.class;
 const def=id=>c.catalog.heroes.find(d=>d.id===id)||(c.catalog.hero?.id===id?c.catalog.hero:null);
 const eligible=h=>{const d=def(h.id);return!!d&&h.level>=250&&(d.rank??6)>=6};
 function popup(el,cls){el.classList.add('gm-popup',cls);el.style.zIndex=String(++z);layer().appendChild(el);return el}
 const closeOn=(el,path)=>{const b=find(el,path);if(b)b.addEventListener('click',e=>{e.stopPropagation();el.remove()})};
 async function act(url,body){const r=await c.mutation(url,body,{close:false,render:false,bonus:false,message:false});if(r)refreshAll();return r}

 // ---- GemItemUI: nền / viền theo phẩm chất (bgr_equipment_N), ảnh bộ (IconGem/set_N), biểu tượng nghề góc trái.
 function fillGem(el,g,{check=false,count=null}={}){
  if(!el)return el;el.classList.add('gm-gem');if(g)el.dataset.gem=g.id;
  img(find(el,'Mask/ImageBgr'),g?c.assetSrc(c.named('bgr_equipment_'+qualityFrame[g.quality])):'');
  img(find(el,'Mask/ImageItem'),g?art('icongem/set_'+g.set):'','contain');
  img(find(el,'ImageBorder'),g?c.assetSrc(c.named('border_equipment_'+qualityFrame[g.quality])):'');
  const box=find(el,'BoxClass');if(box){box.innerHTML='';if(g){const i=document.createElement('span');i.className='gm-class';i.style.backgroundImage=`url('${art(g.clazz+'-on')}')`;box.appendChild(i)}}
  const num=find(el,'TxtNumber');show(num,count!==null);if(count!==null)text(num,String(count),false);
  show(find(el,'Mask/Check'),check);show(find(el,'SpineObject'),false);
  return el;
 }
 const gemTile=(g,opt)=>{const el=render('GemItemUI',100,100);return fillGem(el,g,opt)};
 const place=(el,x,y,w,h)=>{Object.assign(el.style,{position:'absolute',left:x+'px',top:y+'px',width:w+'px',height:h+'px'});return el};
 const gemLines=g=>g.lines.join(' · ');
 const setLines=(g,on)=>`<color=${on?GREEN:'#b8b8b8'}>${g.setLines.join(' · ')}${on?' (đang kích)':''}</color>`;

 // ---- GemPopupItemInfo / GemPopupHeroGemInfo
 function infoPopup(g,{name='GemPopupItemInfo',action1=null,action2=null,setOn=false}={}){
  const el=popup(render(name),'gm-info');
  text(find(el,'Content/Body/BoxInfo/Infor/TextInfo'),`<color=${qualityColor[g.quality]}>${esc(g.setName)}</color>`);
  fillGem(find(el,'Content/Body/BoxInfo/Infor/GemItemUI'),g);
  text(find(el,'Content/Body/BoxInfo/GroupDesc/TextDescTitle'),`Chỉ số cơ bản (<color=${qualityColor[g.quality]}>${qualityNames[g.quality]}</color> · ${classNames[g.clazz]}):`);
  text(find(el,'Content/Body/BoxInfo/GroupDesc/TextDesc'),gemLines(g),false);
  text(find(el,'Content/Body/BoxInfo/GroupSet/TextSet'),'Trang bị theo bộ (đủ 6 viên): '+g.setName,false);
  text(find(el,'Content/Body/BoxInfo/GroupSet/TextEffect1'),setLines(g,setOn));
  const b1=find(el,'Content/Body/BoxInfo/GroupButton/ButtonAction1'),b2=find(el,'Content/Body/BoxInfo/GroupButton/ButtonAction2');
  show(b1,!!action1);if(action1){text(find(b1,'Text'),action1.label,false);b1.addEventListener('click',async e=>{e.stopPropagation();if(await action1.run()!==false)el.remove()})}
  if(b2){show(b2,!!action2);if(action2){text(find(b2,'Text'),action2.label,false);b2.addEventListener('click',async e=>{e.stopPropagation();el.remove();await action2.run()})}}
  closeOn(el,'Dim');closeOn(el,'Content/Body/BoxInfo/ButtonClose');
  return el;
 }

 // ================= GemPopupEquip =================
 const equip={el:null,tab:1,hero:null};
 const tabClass={1:null,2:'assassin',3:'mage',4:'ranger',5:'priest',6:'warrior'},tabNames={1:'TabAll',2:'TabAssassin',3:'TabMage',4:'TabRanger',5:'TabPriest',6:'TabWarrior'};
 function openEquip(){
  equip.el?.remove();const el=equip.el=popup(render('GemPopupEquip'),'gm-equip');equip.hero=null;
  for(const [i,name] of Object.entries(tabNames)){const t=find(el,'Content/Body/BoxRight/TabManager/'+name);if(t){t.dataset.tab=i;t.classList.add('gm-tab')}}
  for(let i=0;i<6;i++){const s=find(el,'Content/Body/BoxLeft/GroupSlotUI/GemSlotUI_'+i);s.dataset.slot=i+1;s.classList.add('gm-slot')}
  el.addEventListener('click',onEquipClick);fillEquip();
 }
 function heroesFor(tab){return c.player().heroes.filter(h=>eligible(h)&&(!tabClass[tab]||heroClass(def(h.id))===tabClass[tab])).sort((a,b)=>b.level-a.level)}
 function fillEquip(){
  const el=equip.el;if(!el?.isConnected)return;const s=gemState();
  for(const [i,name] of Object.entries(tabNames)){const t=find(el,'Content/Body/BoxRight/TabManager/'+name);show(find(t,'ImageOn'),Number(i)===equip.tab);show(find(t,'ImageOff'),Number(i)!==equip.tab)}
  const grid=find(el,'Content/Body/BoxRight/Scroll View/Viewport/Content'),list=heroesFor(equip.tab);grid.innerHTML='';
  list.forEach((h,i)=>{const d=def(h.id),b=document.createElement('button');b.type='button';b.className='gm-hero'+(h.id===equip.hero?' on':'');b.dataset.hero=h.id;place(b,8+(i%5)*79,8+Math.floor(i/5)*84,76,76);
   b.innerHTML=`${c.img(d.visual.head,'gm-hero-head',d.name)}${c.img(c.named('hero_head_border'),'gm-hero-border')}${c.img(c.named('faction_'+d.faction),'gm-hero-faction')}<b>${h.level}</b><span class="gm-hero-stars">${window.heroStarsHtml(h.stars)}</span>`;grid.appendChild(b)});
  grid.style.height=Math.max(372,16+Math.ceil(list.length/5)*84)+'px';
  if(!list.length)grid.innerHTML='<p class="gm-empty">Cần tướng cấp 250, hạng SS trở lên.</p>';
  const hero=equip.hero&&c.player().heroes.find(h=>h.id===equip.hero),d=hero&&def(hero.id),box=find(el,'Content/Body/BoxLeft/HeroBox');
  show(box,!!hero);
  const stage=find(el,'Content/Body/BoxLeft');stage.querySelector('.gm-hero-spine')?.remove();stage.querySelector('.gm-set')?.remove();
  if(hero){
   text(find(box,'ImageBoard/TextHeroName'),d.name,false);show(find(box,'ImageBoard/SpineRank'),false);show(find(box,'ImageBoard/SpineFaction'),false);show(find(box,'ImageBoard/HeroStars'),false);const board=find(box,'ImageBoard');board.querySelector('.gm-board-stars')?.remove();board.insertAdjacentHTML('beforeend',`<span class="gm-board-stars">${window.heroStarsHtml(hero.stars)}</span>`);
   const cv=document.createElement('canvas');cv.width=300;cv.height=600;cv.className='gm-hero-spine';stage.appendChild(cv);c.spine(cv,{skeleton:d.visual.skeleton,animation:'idling'},{loop:true,scale:.95});
   const set=s.sets?.[hero.id],tag=document.createElement('div');tag.className='gm-set'+(set?' on':'');tag.textContent=set?'Kích bộ: '+setById(set).name+' — '+setById(set).effect:'Khảm đủ 6 viên cùng bộ để kích chỉ số bộ';stage.appendChild(tag);
  }
  const worn=hero?(s.heroes[hero.id]||[]):[],clazz=hero&&heroClass(d),free=hero?s.gems.some(g=>!g.hero&&g.clazz===clazz):false;
  for(let i=0;i<6;i++){const slot=find(el,'Content/Body/BoxLeft/GroupSlotUI/GemSlotUI_'+i),g=worn[i]&&gemById(worn[i]),tile=find(slot,'Mask/GemItemUI');
   clearMask(find(slot,'Mask'),!!g);show(tile,!!g);if(g)fillGem(tile,g);show(find(slot,'GoNotifyGem'),!!hero&&!g&&free)}
 }
 async function onEquipClick(e){
  const el=equip.el,b=e.target.closest('.pd-button,.gm-hero,.gm-slot');if(!b||!el.contains(b))return;e.stopPropagation();
  if(b.classList.contains('gm-hero')){equip.hero=b.dataset.hero;fillEquip();return}
  if(b.dataset.tab){equip.tab=Number(b.dataset.tab);fillEquip();return}
  const slot=b.closest('.gm-slot');
  if(slot){if(!equip.hero)return c.toast('Hãy chọn 1 hero!');const n=Number(slot.dataset.slot),id=gemState().heroes[equip.hero]?.[n-1],g=id&&gemById(id);
   if(g)return infoPopup(g,{name:'GemPopupHeroGemInfo',setOn:gemState().sets?.[equip.hero]===g.set,action1:{label:'Gỡ trang bị',run:()=>act('/api/gem/unequip',{heroId:equip.hero,gemIds:[g.id]})},action2:{label:'Thay',run:()=>selectGem(n)}});
   return selectGem(n)}
  const name=b.dataset.name;
  if(name==='ButtonClose'){el.remove();equip.el=null;return}
  if(name==='ButtonHelp')return c.help('equip');
  if(name==='ButtonBag')return openInventory();
  if(name==='ButtonEquipAll'){if(!equip.hero)return c.toast('Hãy chọn 1 hero!');const r=await act('/api/gem/auto',{heroId:equip.hero});if(r)c.toast(r.message||'Đã khảm ngọc.');return}
  if(name==='ButtonUnEquip'){if(!equip.hero)return c.toast('Hãy chọn 1 hero!');if(!(gemState().heroes[equip.hero]||[]).some(Boolean))return c.toast('Tướng chưa trang bị ngọc!');await act('/api/gem/unequip',{heroId:equip.hero});return}
 }
 // ---- GemPopupListGemSelect: ngọc chưa khảm cùng nghề, phẩm chất cao trước; bên trái lọc theo bộ.
 function selectGem(slot){
  const hero=equip.hero,clazz=heroClass(def(hero)),el=popup(render('GemPopupListGemSelect'),'gm-select');let filter=null;
  text(find(el,'Content/Body/BoxRight/TxtTitle'),'Ngọc '+classNames[clazz],false);
  const fill=()=>{
   const all=gemState().gems.filter(g=>!g.hero&&g.clazz===clazz).sort((a,b)=>b.quality-a.quality||a.set-b.set),list=filter?all.filter(g=>g.set===filter):all;
   const left=find(el,'Content/Body/BoxLeft/Bgr/Scroll View/Viewport');left.innerHTML='';const counts=new Map();for(const g of all)counts.set(g.set,(counts.get(g.set)||0)+1);
   const box=document.createElement('div');box.className='gm-setlist';box.innerHTML=`<button type="button" data-set="0" class="${filter?'':'on'}">Tất cả <b>${all.length}</b></button>`+[...counts].sort((a,b)=>a[0]-b[0]).map(([id,n])=>`<button type="button" data-set="${id}" class="${filter===id?'on':''}"><i style="background-image:url('${art('icongem/set_'+id)}')"></i>${esc(setById(id).name)} <b>${n}</b></button>`).join('');left.appendChild(box);
   const grid=find(el,'Content/Body/BoxRight/Scroll View/Viewport/Content');grid.innerHTML='';
   list.forEach((g,i)=>grid.appendChild(place(gemTile(g),10+(i%5)*112,10+Math.floor(i/5)*112,100,100)));grid.style.height=Math.max(476,20+Math.ceil(list.length/5)*112)+'px';
   if(!list.length)grid.innerHTML='<p class="gm-empty">Không có ngọc phù hợp. Hãy chế tạo thêm.</p>';
  };
  fill();
  el.addEventListener('click',e=>{const s=e.target.closest('[data-set]');if(s){filter=Number(s.dataset.set)||null;fill();return}
   const t=e.target.closest('.gm-gem');if(t){const g=gemById(Number(t.dataset.gem));infoPopup(g,{action1:{label:'Trang bị',run:async()=>{const r=await act('/api/gem/equip',{heroId:hero,gemId:g.id,slot});if(r)el.remove();return!!r}}});return}});
  closeOn(el,'Content/Header/ButtonClose');
 }

 // ================= GemPopupInventory =================
 const inv={el:null,clazz:null,set:null,quality:null,selected:new Set()};
 const qualityTabs=['grayoff','xanh','lam','tim','vang','do'];
 function openInventory(){
  inv.el?.remove();const el=inv.el=popup(render('GemPopupInventory'),'gm-inventory');inv.selected.clear();inv.clazz=inv.set=inv.quality=null;
  const tabs=find(el,'Content/Body/BoxLeft/Bgr/Scroll View/Viewport/Content');
  for(const t of find(tabs,'TabClass').children)if(t.dataset.name){t.dataset.filter='clazz';t.dataset.value=t.dataset.name.replace('Tab','')}
  [...find(tabs,'TabSetType').children].forEach((t,i)=>{t.dataset.filter='set';t.dataset.value=i+1;const off=find(t,'ImageOff');if(off&&!off.style.backgroundImage)img(off,art('icongem/set_'+(i+1)),'contain');show(t,!!setById(i+1)?.release)});
  [...find(tabs,'TabQuality').children].forEach((t,i)=>{t.dataset.filter='quality';t.dataset.value=i+1});
  text(find(el,'Content/Body/BoxRight/TxtTitle'),'Túi ngọc',false);
  el.addEventListener('click',onInventoryClick);fillInventory();
 }
 const invList=()=>gemState().gems.filter(g=>(!inv.clazz||g.clazz===inv.clazz)&&(!inv.set||g.set===inv.set)&&(!inv.quality||g.quality===inv.quality)).sort((a,b)=>b.quality-a.quality||a.set-b.set||a.id-b.id);
 function fillInventory(){
  const el=inv.el;if(!el?.isConnected)return;const tabs=find(el,'Content/Body/BoxLeft/Bgr/Scroll View/Viewport/Content');
  for(const t of tabs.querySelectorAll('[data-filter]')){const on=String(inv[t.dataset.filter])===String(t.dataset.value);show(find(t,'ImageOn'),on);show(find(t,'ImageOff'),!on||t.dataset.filter==='set')}
  const list=invList(),grid=find(el,'Content/Body/BoxRight/Scroll View/Viewport/Content');grid.innerHTML='';
  list.forEach((g,i)=>{const t=place(gemTile(g,{check:inv.selected.has(g.id)}),12+(i%5)*111,10+Math.floor(i/5)*111,100,100);if(g.hero){t.classList.add('worn');const d=def(g.hero);if(d)t.insertAdjacentHTML('beforeend',c.img(d.visual.head,'gm-worn',d.name))}grid.appendChild(t)});
  grid.style.height=Math.max(388,20+Math.ceil(list.length/5)*111)+'px';
  if(!list.length)grid.innerHTML='<p class="gm-empty">Chưa có ngọc. Hãy chế tạo ở Lò chế tạo.</p>';
  text(find(el,'Content/Body/BoxRight/TxtTitle'),`Túi ngọc ${gemState().gems.length}/${gemState().max||600}`,false);
  text(find(el,'Content/Body/BoxRight/BoxActions/ButtonSelectAll/Text'),inv.selected.size?'Hủy chọn':'Chọn tất cả',false);
  text(find(el,'Content/Body/BoxRight/BoxActions/ButtonSellAll/Text'),inv.selected.size?`Bán (${inv.selected.size})`:'Bán',false);
 }
 async function onInventoryClick(e){
  const el=inv.el,b=e.target.closest('[data-filter],.pd-button,.gm-gem');if(!b||!el.contains(b))return;e.stopPropagation();
  if(b.dataset.filter){const k=b.dataset.filter,v=k==='clazz'?b.dataset.value:Number(b.dataset.value);inv[k]=inv[k]===v?null:v;inv.selected.clear();fillInventory();return}
  if(b.classList.contains('gm-gem')){const g=gemById(Number(b.dataset.gem));
   if(inv.selected.size&&!g.hero){inv.selected.has(g.id)?inv.selected.delete(g.id):inv.selected.add(g.id);fillInventory();return}
   infoPopup(g,{setOn:!!g.hero&&gemState().sets?.[g.hero]===g.set,action1:g.hero?null:{label:'Bán',run:()=>sell([g.id])}});return}
  const name=b.dataset.name;
  if(name==='ButtonClose'){el.remove();inv.el=null;return}
  if(name==='ButtonSelectAll'){if(inv.selected.size)inv.selected.clear();else for(const g of invList())if(!g.hero&&g.quality<=3)inv.selected.add(g.id);if(!inv.selected.size)c.toast('Không có ngọc phẩm chất thấp (≤ Xanh Dương) chưa khảm.');fillInventory();return}
  if(name==='ButtonSellAll'){if(!inv.selected.size)return c.toast('Hãy chọn tất cả để bán!');if(await window.GameMessage.ask(`Bán ${inv.selected.size} viên ngọc?`,'Bán'))await sell([...inv.selected]);return}
 }
 async function sell(ids){const r=await act('/api/gem/sell',{gemIds:ids});if(r){inv.selected.clear();fillInventory();c.toast(`Đã bán ${ids.length} viên ngọc, nhận ${r.result?.rewards?.[0]?.quantity??''} Vụn đá quý.`)}return!!r}

 // ================= GemPopupSummon =================
 const summon={el:null,materials:[0,0,0]};
 const materialGroups=[{title:'Nguyên liệu - Phẩm chất',ids:[60001,60002,60003,60004,60005]},{title:'Nguyên liệu - Class',ids:[60011,60012,60013,60014,60015]},{title:'Nguyên liệu - Set',ids:Array.from({length:15},(_,i)=>60101+i)}];
 const owned=id=>c.player().inventory?.['consumable:'+id]||0;
 function itemInto(el,itemId,count,need){
  if(!el)return;for(const k of el.children)k.style.visibility='hidden';el.querySelector('.gm-item')?.remove();
  const box=document.createElement('div');box.className='gm-item';box.innerHTML=c.eventTile({itemId,quantity:1},'gm-tile')+(need!==undefined?`<b class="${count>=need?'ok':'short'}">${c.short(count)}/${c.short(need)}</b>`:`<b class="${count>0?'ok':'short'}">${c.short(count)}/1</b>`);el.appendChild(box);
 }
 function openSummon(){
  summon.el?.remove();const el=summon.el=popup(render('GemPopupSummon'),'gm-summon');summon.materials=[0,0,0];
  const usopp=find(el,'Content/Left/Usopp');if(usopp&&data.spines.ussopp){const cv=document.createElement('canvas');cv.width=1000;cv.height=1000;cv.className='gm-spine root';usopp.appendChild(cv);c.spine(cv,{skeleton:data.spines.ussopp,animation:'idle'},{loop:true,scale:.62})}
  el.addEventListener('click',onSummonClick);fillSummon();
 }
 function fillSummon(){
  const el=summon.el;if(!el?.isConnected)return;const costs=data.materials;let full=0;
  ['ItemConsumableUI','ItemConsumableUI1','ItemConsumableUI2'].forEach((n,i)=>{const cost=costs[i],have=owned(cost.item);if(have>=cost.amount)full++;itemInto(find(el,'Content/Right/BoxSelectNguyenLieu/BoxTop/'+n),'consumable:'+cost.item,have,cost.amount)});
  ['GemSlotMaterial','GemSlotMaterial1','GemSlotMaterial2'].forEach((n,i)=>{const slot=find(el,'Content/Right/BoxSelectNguyenLieu/BoxBot/'+n),id=summon.materials[i],ui=find(slot,'Mask/ItemConsumableUI');slot.dataset.material=i;
   // Mask (showMaskGraphic tắt trong Unity) chỉ là khung cắt: không vẽ nền, không chặn chạm vào nút "+".
   clearMask(find(slot,'Mask'),!!id);
   show(ui,!!id);show(find(slot,'ButtonUnSelect'),!!id);if(id)itemInto(ui,'consumable:'+id,owned(id))});
  const fx=find(el,'Content/Right/BoxSelectNguyenLieu/SpineObject');fx.querySelector('canvas')?.remove();
  if(data.spines['vong-phep']){const cv=document.createElement('canvas');cv.width=320;cv.height=320;cv.className='gm-spine';fx.appendChild(cv);c.spine(cv,{skeleton:data.spines['vong-phep'],animation:full===3?'xoay':'idle'},{loop:true,fit:1})}
 }
 async function onSummonClick(e){
  const el=summon.el,slotHit=e.target.closest('[data-material]'),b=e.target.closest('.pd-button')||slotHit;if(!b||!el.contains(b))return;const name=b.dataset.name,slot=b.closest('[data-material]');
  if(e.target.closest('.ev-tile')&&!slot)return;e.stopPropagation();
  if(slot&&name!=='ButtonUnSelect'){if(summon.materials[Number(slot.dataset.material)]&&name!=='ButtonSelect'&&!e.target.closest('.gm-item'))return;return selectMaterial(Number(slot.dataset.material))}
  if(name==='ButtonClose'){el.remove();summon.el=null;return}
  if(name==='ButtonHelp')return c.help('summon');
  if(slot&&name==='ButtonSelect')return selectMaterial(Number(slot.dataset.material));
  if(slot&&name==='ButtonUnSelect'){summon.materials[Number(slot.dataset.material)]=0;fillSummon();return}
  const count=name==='BtnSummonx1'?1:name==='BtnSummonx10'?10:0;if(!count)return;
  const r=await act('/api/gem/summon',{count,materials:summon.materials});if(!r)return;
  for(let i=0;i<3;i++)if(summon.materials[i]&&owned(summon.materials[i])<1)summon.materials[i]=0;fillSummon();receive(r.result?.gems||[]);
 }
 // ---- GemPopupSelectMaterial: vật phẩm đang có của nhóm; chạm → xem → "Sử dụng".
 function selectMaterial(index){
  const g=materialGroups[index],el=popup(render('GemPopupSelectMaterial'),'gm-material');text(find(el,'PanelBody/TextTitle'),g.title,false);
  const vp=find(el,'PanelBody/GroupArtifact/BoxItems/ScrollMaterial/Viewport');vp.innerHTML='';const list=g.ids.filter(id=>owned(id)>0);
  const box=document.createElement('div');box.className='gm-matlist';box.innerHTML=list.length?list.map(id=>`<button type="button" data-pick="${id}">${c.eventTile({itemId:'consumable:'+id,quantity:owned(id)},'gm-tile')}<span>${esc(c.items.get('consumable:'+id)?.name||id)}</span></button>`).join(''):'<p class="gm-empty">Chưa có nguyên liệu loại này. Nhận từ Boss ngọc.</p>';vp.appendChild(box);
  el.addEventListener('click',e=>{const p=e.target.closest('[data-pick]');if(p){e.stopPropagation();summon.materials[index]=Number(p.dataset.pick);el.remove();fillSummon()}});
  closeOn(el,'PanelBody/ButtonClose');closeOn(el,'Block');
 }
 // ---- GemPopupReceiveGem
 function receive(gems){
  const el=popup(render('GemPopupReceiveGem'),'gm-receive'),grid=find(el,'PanelBody/GridItem');grid.innerHTML='';
  const best=Math.max(0,...gems.map(g=>g.quality));text(find(el,'PanelBody/Title'),best>=5?'Uầy gem xịn, ngon!':'Nhận ngọc',false);
  const per=Math.min(gems.length,5);gems.forEach((g,i)=>grid.appendChild(place(gemTile(g),320-per*58+(i%5)*116,Math.floor(i/5)*112-(gems.length>5?56:0),100,100)));
  el.addEventListener('click',e=>{const t=e.target.closest('.gm-gem');if(t){e.stopPropagation();infoPopup(gemById(Number(t.dataset.gem))||gems.find(g=>g.id===Number(t.dataset.gem)))}});
  closeOn(el,'PanelBody/ButtonClose');
 }

 // ================= Boss ngọc =================
 const bossOf=id=>gemState().boss.find(b=>b.id===id);
 function openBossList(){
  const el=popup(render('GemPopupListBoss'),'gm-bosslist'),content=find(el,'Content/Body/Scroll View/Viewport/Content');content.innerHTML='';
  gemState().boss.forEach((b,i)=>{const card=render('GemCardBoss',300,560);place(card,40+i*340,-6,300,560);card.dataset.boss=b.id;card.classList.add('gm-card');
   img(find(card,'ImgBoss'),art('boss/'+b.avatar+(b.open?'_open':'_close')));text(find(card,'FieldStatus/textTitle'),b.open?`Đang mở · Lượt ${b.turns}/${b.maxTurns}`:b.text,false);
   const view=find(card,'FieldViewReward/BoxPreviewReward');view.innerHTML=`<div class="gm-preview">${b.tiers[0].rewards.slice(0,4).map(r=>c.eventTile(r,'gm-tile small')).join('')}</div>`;content.appendChild(card)});
  el.addEventListener('click',e=>{const card=e.target.closest('.gm-card');if(e.target.closest('.ev-tile'))return;
   if(card){e.stopPropagation();const b=bossOf(Number(card.dataset.boss));if(!b.open)return c.toast('Chưa mở!');openBoss(b.id,1);return}
   const btn=e.target.closest('.pd-button');if(btn?.dataset.name==='ButtonHelp'){e.stopPropagation();c.help('boss')}});
  closeOn(el,'Content/Header/ButtonClose');
 }
 const boss={el:null,id:1,tier:1,timer:null};
 function openBoss(id,tier=1){
  boss.el?.remove();clearInterval(boss.timer);const el=boss.el=popup(render('GemPopupBossMain'),'gm-boss');boss.id=id;boss.tier=tier;
  const b=bossOf(id),spot=find(el,'Content/Body/BoxRight/SpineObject');
  const spine=data.spines[String(b.avatar)];if(spine){const cv=document.createElement('canvas');cv.width=1200;cv.height=1200;cv.className='gm-spine root';spot.appendChild(cv);c.spine(cv,{skeleton:spine,animation:'idle'},{loop:true,scale:.78})}
  for(let i=1;i<=6;i++){const t=find(el,'Content/Body/BoxLeft/TabManager/Tab'+i);t.dataset.tier=i;text(find(t,'Text'),tierNames[i-1],false)}
  for(let i=1;i<=4;i++){const s=find(el,'Content/Body/BoxRight/BoxBossSkill/BtnSkill_'+i);s.dataset.skill=i-1;s.classList.add('gm-skill')}
  find(el,'Content/Body/BoxRight/BoxBossSkill/ButtonDebuffMonster').classList.add('gm-mdebuff');
  img(find(el,'Content/Header/BoxField/FieldCard/IconTurn'),c.assetSrc(c.items.get('consumable:333691')?.assetKey));
  el.addEventListener('click',onBossClick);fillBoss();
  const tick=()=>{if(!el.isConnected)return clearInterval(boss.timer);const left=Math.max(0,bossOf(boss.id).endsAt-Date.now()),s=Math.floor(left/1000);text(find(el,'Content/Body/BoxRight/BoxTime/TextTimeCountDown'),[s/3600,s%3600/60,s%60].map(v=>String(Math.floor(v)).padStart(2,'0')).join(':'),false)};
  tick();boss.timer=setInterval(tick,1000);
 }
 function fillBoss(){
  const el=boss.el;if(!el?.isConnected)return;const b=bossOf(boss.id),t=b.tiers[boss.tier-1];
  for(let i=1;i<=6;i++){const tab=find(el,'Content/Body/BoxLeft/TabManager/Tab'+i);show(find(tab,'ImageOn'),i===boss.tier);show(find(tab,'ImageOff'),i!==boss.tier);tab.classList.toggle('killed',b.killed.includes(i))}
  t.skills.forEach((s,i)=>{const btn=find(el,'Content/Body/BoxRight/BoxBossSkill/BtnSkill_'+(i+1));const icon=data.skillIcons[s.icon];img(find(btn,'SpriteOn'),icon?c.assetSrc(icon):'');img(find(btn,'SpriteOff'),icon?c.assetSrc(icon):'');show(find(btn,'ImgLevel'),false)});
  const md=find(el,'Content/Body/BoxRight/BoxBossSkill/ButtonDebuffMonster');show(md,!!t.debuff);if(t.debuff)img(find(md,'Mask'),art('bossdebufficon/'+t.debuff));
  text(find(el,'Content/Header/BoxField/FieldTurn/TextNumber'),`${b.turns}/${b.maxTurns}`,false);text(find(el,'Content/Header/BoxField/FieldCard/TextNumber'),String(owned(333691)),false);
  const sel=find(el,'Content/Header/ButtonSelectDebuff');show(sel,boss.tier===6);text(find(sel,'IconPoint/TextPoint'),String(points(b.debuffs)),false);
  show(find(el,'Content/Body/BoxRight/BoxSkillDesc'),false);
  let title=el.querySelector('.gm-boss-name');if(!title){title=document.createElement('div');title.className='gm-boss-name';find(el,'Content/Body/BoxRight').appendChild(title)}
  title.innerHTML=`${esc(t.name)}${boss.tier===6?`<small>${b.debuffs.length} debuff · ${points(b.debuffs)} điểm</small>`:''}${b.killed.includes(boss.tier)?'<small class="ok">Đã tiêu diệt hôm nay</small>':''}`;
 }
 const points=ids=>ids.reduce((n,id)=>n+(data.debuffs.find(d=>d.id===id)?.point||0),0);
 async function onBossClick(e){
  const el=boss.el,b=e.target.closest('[data-tier],.gm-skill,.gm-mdebuff,.pd-button');if(!b||!el.contains(b))return;e.stopPropagation();const box=bossOf(boss.id);
  if(b.dataset.tier){boss.tier=Number(b.dataset.tier);fillBoss();return}
  if(b.classList.contains('gm-skill')){const s=box.tiers[boss.tier-1].skills[Number(b.dataset.skill)],d=find(el,'Content/Body/BoxRight/BoxSkillDesc');
   const icon=data.skillIcons[s.icon];img(find(d,'Content/SkillTitle/SkillIcon'),icon?c.assetSrc(icon):'');
   text(find(d,'Content/SkillTitle/TextName'),`<color=#ffd34a>${esc(s.name)}</color>`);text(find(d,'Content/TextDesc'),esc((s.passive?'Bị động: ':'Nộ: ')+s.description));d.classList.add('gm-skilldesc');show(d,true);return}
  if(b.classList.contains('gm-mdebuff'))return debuffInfo(data.debuffs.find(d=>d.id===box.tiers[boss.tier-1].debuff));
  const name=b.dataset.name;
  if(name==='BoxSkillDesc'){show(b,false);return}
  if(name==='ButtonClose'){el.remove();boss.el=null;return}
  if(name==='ButtonSelectDebuff')return selectDebuffs();
  if(name==='ButtonReward')return rewardPopup();
  if(name==='ButtonBattle'){
   if(!box.open)return c.toast('Chưa mở!');if(box.turns<=0&&owned(333691)<=0)return c.toast('Bạn đã hết lượt đánh. Cần Vé Đánh Boss Ngọc.');
   const allow=c.player().heroes.filter(h=>h.level>=250).map(h=>h.id);if(!allow.length)return c.toast('Cần tướng cấp 250 trở lên.');
   c.pickTeam(`Boss ngọc · ${box.tiers[boss.tier-1].name}`,picked=>c.gemBattle({bossId:boss.id,tier:boss.tier,formation:picked}),{allow,note:'Chỉ tướng cấp 250 trở lên được ra trận.'+(box.turns>0?'':' Hết lượt: dùng 1 Vé Đánh Boss Ngọc.')});return}
 }
 // ---- GemPopupDebuffInfo (xem / chọn / bỏ chọn)
 function debuffInfo(d,{selected=null,onToggle=null}={}){
  if(!d)return;const el=popup(render('GemPopupDebuffInfo'),'gm-dinfo');
  const item=find(el,'Content/Body/BoxInfo/Infor/GemDebuffItem');item.innerHTML=`<span class="gm-debuff" style="background-image:url('${art('bossdebufficon/'+d.id)}')"></span>`;
  text(find(el,'Content/Body/BoxInfo/Infor/TextName'),`${esc(d.name)}\n<size=20><color=#ffd34a>${d.point} điểm</color></size>`);text(find(el,'Content/Body/BoxInfo/GroupDesc/TextDesc'),esc(d.description),false);
  const b1=find(el,'Content/Body/BoxInfo/GroupButton/ButtonAction1'),b2=find(el,'Content/Body/BoxInfo/GroupButton/ButtonAction2');
  if(onToggle){show(b1,!selected);show(b2,!!selected);for(const [b,on] of [[b1,true],[b2,false]]){b.insertAdjacentHTML('beforeend',`<span class="gm-btn-label">${on?'Chọn':'Bỏ chọn'}</span>`);b.addEventListener('click',e=>{e.stopPropagation();el.remove();onToggle(on)})}}
  else{show(b1,false);show(b2,false)}
  closeOn(el,'Close2');closeOn(el,'Content/Body/ButtonClose');
 }
 // ---- GemPopupBossSelectDebuff: tối đa 15 debuff; mốc điểm (GemCardDebuffReward) phía trên.
 function selectDebuffs(){
  const el=popup(render('GemPopupBossSelectDebuff'),'gm-debuffs'),b=bossOf(boss.id);let draft=[...b.debuffs];text(find(el,'Content/Body/TitleBg/Title'),'Chọn debuff',false);
  const fill=()=>{
   const total=points(draft),max=gemState().milestones.at(-1)?.point||1;
   const top=find(el,'Content/Body/BoxContent/BoxSlider/Scroll View/Viewport');top.innerHTML=`<div class="gm-milestones"><i style="width:${Math.min(100,total/max*100)}%"></i>${gemState().milestones.map(m=>`<span class="${total>=m.point?'on':''}">${c.eventTile(m.reward,'gm-tile small')}<b>${m.point}</b></span>`).join('')}</div>`;
   const grid=find(el,'Content/Body/BoxContent/BoxCell/Scroll View/Viewport');grid.innerHTML=`<div class="gm-debuff-grid">${data.debuffs.filter(d=>d.release).map(d=>`<button type="button" data-debuff="${d.id}" class="${draft.includes(d.id)?'on':''}"><span class="gm-debuff" style="background-image:url('${art('bossdebufficon/'+d.id)}')"></span><b>${d.point}</b></button>`).join('')}</div>`;
   text(find(el,'Content/Body/BoxContent/BoxSlider/Icon/Text'),`${total}/${max}`,false);
   let info=el.querySelector('.gm-points');if(!info){info=document.createElement('div');info.className='gm-points';find(el,'Content/Body/BoxContent/BoxSlider').appendChild(info)}info.textContent=`Đã chọn ${draft.length}/15 debuff`;
  };
  const save=async()=>{const r=await act('/api/gem/debuffs',{bossId:boss.id,debuffs:draft});if(!r)draft=[...bossOf(boss.id).debuffs];fill()};
  fill();
  el.addEventListener('click',e=>{const t=e.target.closest('[data-debuff]');if(!t)return;e.stopPropagation();const d=data.debuffs.find(x=>x.id===Number(t.dataset.debuff)),on=draft.includes(d.id);
   debuffInfo(d,{selected:on,onToggle:add=>{if(add){if(draft.length>=15)return c.toast('Chỉ có thể chọn tối đa 15 debuff');draft=[...draft,d.id]}else draft=draft.filter(x=>x!==d.id);save()}})});
  closeOn(el,'Content/Body/ButtonClose');
 }
 // ---- GemPopupBossReward / GemBossCellReward: thưởng từng bậc kèm % rơi.
 function rewardPopup(){
  const el=popup(render('GemPopupBossReward'),'gm-reward'),b=bossOf(boss.id),box=find(el,'Content/Body/BoxContent/BoxCell');box.innerHTML='';const list=document.createElement('div');list.className='gm-rewardlist';box.appendChild(list);
  b.tiers.forEach((t,i)=>{const row=render('GemBossCellReward',720,140);row.classList.add('gm-cell');const killed=b.killed.includes(t.tier);
   text(find(row,'BoxContent/txtDesc'),`${tierNames[i]} · Tiêu diệt ${esc(t.name)}`,false);text(find(row,'TextStatus'),killed?'Đã tiêu diệt':'Chưa tiêu diệt',false);img(find(row,'Chest'),art(killed?'chest-opened':'chest-close'),'contain');
   const vp=find(row,'BoxContent/ScrollReward/Viewport');vp.innerHTML=`<div class="gm-preview drops">${t.rewards.map(r=>`<span class="gm-drop">${c.eventTile(r,'gm-tile small')}${r.itemId==='consumable:60000'?'':`<em>${r.rate/10}%</em>`}</span>`).join('')}</div>`;
   list.appendChild(row)});
  if(gemState().milestones.length){const row=document.createElement('div');row.className='gm-cell-note';row.textContent='Địa Ngục: chọn debuff để cộng điểm; đạt mốc nhận thêm phần thưởng mốc cao nhất.';list.appendChild(row)}
  closeOn(el,'Content/Body/ButtonClose');closeOn(el,'Block');
 }

 // ================= GemMain =================
 function refreshAll(){fillEquip();fillInventory();fillSummon();fillBoss()}
 function close(){clearInterval(boss.timer);root?.remove();root=null;for(const p of document.querySelectorAll('.gm-popup'))p.remove();equip.el=inv.el=summon.el=boss.el=null}
 async function open(context,next=null){
  c=context;await load();close();z=40;root=render('GemMain');root.classList.add('gm-root');layer().appendChild(root);
  img(find(root,'Content/ImgBgr'),art('main/bg_gem'),'cover');
  const cards=[['CardGemEquip','main/trang-bi-gem','Trang bị'],['CardGemSummon','main/che-tac-gem','Chế tạo'],['CardGemBoss','main/boss_gem','Boss ngọc']];
  // HorizontalLayoutGroup trong ScrollView (ContentSizeFitter): đặt sẵn 3 thẻ 311×436 cách đều trong khung 1042.
  cards.forEach(([name,key],i)=>{const card=find(root,'Content/Body/Scroll View/Viewport/Content/'+name);if(!card)return;if(!card.style.backgroundImage||card.style.backgroundImage==='none')img(card,art(key));card.classList.add('gm-maincard');place(card,30+i*(311+35),40,311,436)});
  const holder=find(root,'Content/Body/Scroll View/Viewport/Content');if(holder)Object.assign(holder.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',transform:'none'});
  root.addEventListener('click',e=>{const b=e.target.closest('.pd-button');if(!b||e.target.closest('.gm-popup'))return;const name=b.dataset.name;
   if(name==='CardGemEquip')return openEquip();if(name==='CardGemSummon')return openSummon();if(name==='CardGemBoss')return openBossList();
   if(name==='ButtonClose')return close();if(name==='ButtonHelp')return c.help('main')});
  if(next?.boss){openBossList();openBoss(next.boss,next.tier||1)}
 }
 let loading=null;
 function load(){return data?Promise.resolve(data):loading??=fetch('gem.json').then(r=>r.json()).then(d=>data=d)}
 window.GemUI={open,close,load,refresh:refreshAll,isOpen:()=>!!root};
})();
