/* Thiên phú (HolyBlessing gốc): dựng nguyên prefab HLBPanelMain / HLBPopupSelectTable / HLBPopupSelectSkill bằng PrefabDOM,
 * đổ dữ liệu như HLBPanelAdvance* / HLBPanelScheme / HLBSkillLotView / HLBIconSkillTableView:
 *   - Trang trái: chưa đủ điều kiện / chưa chọn bảng (nút +) / nâng cấp (biểu tượng bảng, sao, chỉ số, phí) / nâng sao
 *     (sao hiện tại -> sao kế, Giới hạn cấp tướng +N, phí và mảnh tướng). Nút cài lại hoàn trả nguyên liệu.
 *   - Trang phải: nền s1..s3 theo bảng, 5 ô kỹ năng (khóa / + / icon) nối bằng 4 đường Spine Line_<màu>.
 *   - Spine anim_thienphu: Loop_red / Loop_blue / Loop_green quanh biểu tượng bảng và ô kỹ năng (Cuồng Bạo / Thủ Ngự / Viện Trợ).
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640,colors={1:'red',2:'blue',3:'green'},pointNames={0:'Công',2:'Máu',3:'Tốc độ'};
 let c=null,data=null,loading=null,root=null,popup=null;
 const load=()=>data?Promise.resolve(data):loading??=fetch('talent.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>data=d,e=>{loading=null;throw e});
 const hero=()=>c.player().hero,state=()=>hero().talent||{unlocked:false,table:0,level:0,star:0,skills:[0,0,0,0,0],skillIds:[0,0,0,0,0]};
 const art=name=>data.art[name.toLowerCase()];
 const row=level=>data.levels[Math.max(1,Math.min(data.levels.length,level))-1];
 const tableOf=id=>data.tables.find(t=>t.id===id);
 const have=id=>id==='diamonds'?c.player().wallet.diamonds:c.player().inventory[id]||0;
 // ---- Thao tác trên cây prefab (JSON) trước khi dựng: bật/tắt, chữ, ảnh, chèn con vào layout group.
 const kid=(n,path)=>path.split('/').reduce((x,p)=>x&&(x.children||[]).find(k=>k.name===p),n);
 const deep=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=deep(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const pic=(n,key)=>{const x=comp(n,'Image');if(x&&key)x.asset=key};
 const clone=n=>structuredClone(n);
 const spines=[];
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets(),onSkeleton:(el,sk)=>spines.push({el,sk})});
 function render(node,cls,color){
  spines.length=0;const el=D.render(node,W,H,opts());el.classList.add(cls);c.layer().appendChild(el);
  // Spine của SkeletonGraphic: 1 đơn vị = 1px thiết kế; canvas đặt giữa node.
  for(const {el:host,sk} of [...spines]){
   if(!host.isConnected||host.offsetParent===null||!sk.skeleton)continue;
   const line=/^Line/.test(sk.animation||''),size=line?420:260,cv=document.createElement('canvas');cv.width=cv.height=size;cv.className='talent-spine';
   Object.assign(cv.style,{left:(host.offsetWidth-size)/2+'px',top:(host.offsetHeight-size)/2+'px'});host.appendChild(cv);
   c.spine(cv,{skeleton:sk.skeleton,animation:String(sk.animation||'Loop_red').replace(/(red|blue|green)$/,color||'red')},{loop:true,scale:1});
  }
  return el;
 }
 function iconTable(n,table,selected=false){
  on(n);pic(deep(n,'Background'),art('hlb_tlb_bg_'+table.id));pic(deep(n,'IconTable'),art('hlb_tbl_'+table.id));txt(kid(n,'BarName/TextName'),table.name);
  on(deep(n,'ImgSelection'),selected);n.talentColor=colors[table.id];
  if(!deep(n,'IconTable')){const bg=deep(n,'Background');bg.children=[{id:'icon',name:'IconTable',active:true,components:[{type:'Image',color:[1,1,1,1],asset:art('hlb_tbl_'+table.id),mode:0,preserve:false,fill:1}],transform:{...bg.transform,m_AnchoredPosition:{x:0,y:0}},children:[]}]}
 }
 const pointView=(caption,value)=>{const n=clone(data.prefabs.HLBPointView);on(n);txt(deep(n,'TextCaption'),caption);txt(deep(n,'TextValue'),value);return n};
 const costView=(itemId,need)=>{const n=clone(data.prefabs.HLBConsumeCostView);on(n);pic(deep(n,'IconItem'),c.items.get(itemId)?.assetKey||c.named('icon_gem'));const own=have(itemId);
  txt(deep(n,'TextValue'),`<color=${own<need?'#ff3b3b':'#ffffff'}>${c.short(own)}</color>/${c.short(need)}`);comp(deep(n,'TextValue'),'Text').rich=true;return n};
 const points=level=>row(level).points.map(([id,value])=>pointView(pointNames[id]||'?','+'+value));
 function skillIcon(n,skillId){const s=data.skills[skillId];pic(deep(n,'IconSkill'),s?.icon)}

 // ---- Sổ Thiên phú (HLBPanelMain)
 function mainNode(){
  const s=state(),n=clone(data.prefabs.HLBPanelMain),adv=deep(n,'PanelAdvance'),scheme=deep(n,'PanelScheme'),table=tableOf(s.table);
  for(const name of ['PanelNotUnlock','PanelActiveYet','PanelLevelUp','PanelStarUp'])on(kid(adv,name),false);
  on(adv);on(scheme,s.unlocked);
  if(!s.unlocked){const p=on(kid(adv,'PanelNotUnlock'));txt(kid(p,'TextNotUnlock'),`Tướng chưa đủ điều kiện mở Thiên phú (cần ${s.unlockStar||10} sao, sao đỏ)`)}
  else if(!table){const p=on(kid(adv,'PanelActiveYet'));txt(kid(p,'TextYet'),'Bạn chưa chọn bảng thiên phú')}
  else{
   const r=row(s.level),starUp=s.star<r.starNext,p=on(kid(adv,starUp?'PanelStarUp':'PanelLevelUp'));
   iconTable(kid(p,'HLBIconSkillTableView'),table);
   const stars=(v,count)=>{for(let i=1;i<=6;i++)on(deep(v,'Star_'+i),i<=count)};
   let enough=true;const costs=list=>list.map(x=>{if(have(x.itemId)<x.quantity)enough=false;return costView(x.itemId,x.quantity)});
   on(kid(p,'ButtonRefresh'),s.level>1||s.star>1);
   if(starUp){
    stars(kid(p,'HLBStarView1'),s.star);stars(kid(p,'HLBStarView2'),s.star+1);
    kid(p,'PointContainer').children=[pointView('Giới hạn cấp tướng','+'+r.heroLevelCap),...points(s.level)];
    kid(p,'BarConsumeMaterial/CostContainer').children=costs(r.starCost);
    const mat=clone(data.prefabs.HLBMaterialHeroView),need=r.copies*10,shards=have(c.shardId());on(mat);on(deep(mat,'GroupScale'),false);
    const head=kid(mat,'HeroMaterial/HeroHead');pic(kid(head,'Mask/ImageHead'),c.heroHead());on(kid(head,'Mask/ImageHeadBw'),false);on(kid(head,'TextHeroKey'),false);on(kid(mat,'HeroMaterial/HeroStar'),false);
    pic(kid(head,'ImageFaction'),c.named('faction_'+c.faction()));txt(kid(mat,'HeroMaterial/TextNumber'),`${c.short(shards)}/${need}`);if(shards<need)enough=false;
    mat.transform.m_LocalScale={x:.75,y:.75,z:1};kid(p,'BarHeroMaterial/CostContainer').children=need?[mat]:[];
    on(kid(p,'ButtonStarUp/GoNotify'),enough);
   }else{
    stars(kid(p,'HLBStarView'),s.star);
    kid(p,'PointContainer').children=[pointView(I2('HC_CAP','Cấp'),`${s.level}/${s.levelCap}`),...points(s.level)];
    const max=s.level>=data.levels.length;
    kid(p,'BarConsumeMaterial/CostContainer').children=max?[]:costs(r.cost);
    on(kid(p,'BarConsumeMaterial'),!max);on(kid(p,'ButtonLvUp'),!max);on(kid(p,'TextMax'),max);txt(kid(p,'TextMax'),'Tướng đã đạt thiên phú tối đa');
    on(kid(p,'ButtonLvUp/GoNotify'),!max&&enough);
   }
  }
  const content=kid(scheme,'Content');on(content,!!table);
  if(table){
   pic(kid(content,'BgSkill'),art('s'+table.id));
   for(let i=1;i<=5;i++){const lot=kid(content,'HLBSkillLotView'+i),locked=i>s.star,id=s.skillIds?.[i-1]||0;
    on(deep(lot,'ImageLock'),locked);on(deep(lot,'ImagePlus'),!locked&&!id);on(kid(lot,'GoNotify'),!locked&&!id);
    const icon=deep(lot,'HLBIconSkillView');on(icon,!!id);if(id){const fresh=clone(data.prefabs.HLBIconSkillView);fresh.transform=icon.transform;fresh.name='HLBIconSkillView';on(fresh);skillIcon(fresh,id);kid(lot,'Scale').children=kid(lot,'Scale').children.map(k=>k.name==='HLBIconSkillView'?fresh:k)}}
  }
  return{n,color:table?colors[table.id]:'red'};
 }
 function fill(){
  if(!data)return;const keep=root?.isConnected;root?.remove();if(!keep&&root)return;
  const {n,color}=mainNode();root=render(n,'talent-root',color);root.addEventListener('click',onMainClick);
 }
 async function act(op,extra={}){const r=await c.mutation('/api/talent',{op,...extra},{close:false,render:false});if(r){c.rerender();fill();if(popup?.isConnected)popup.refresh?.()}return r}
 function onMainClick(e){
  const name=x=>e.target.closest(`[data-name="${x}"]`);
  if(name('ButtonClose')||e.target.closest('[data-name]')?.dataset.name==='Close2')return close();
  if(name('ButtonHelp'))return c.modal('THIÊN PHÚ',`<p class="item-description">Tướng sao đỏ mở Thiên phú. Chọn một trong ba bảng: Cuồng Bạo (sát thương), Thủ Ngự (sinh tồn), Viện Trợ (kiểm soát, chi viện). Dùng Kết Tinh Ý Chí nâng cấp để tăng Công, Máu, Tốc. Ở cấp 10, 20, 30, 40, 50 cần nâng sao bằng Kết Tinh Ý Chí, Ngọc Tủy Hải Hồn và mảnh tướng: mỗi sao mở thêm một ô kỹ năng và tăng giới hạn cấp tướng. Đổi bảng ${data.feeChangeTable} kim cương; cài lại ${data.feeReset} kim cương, hoàn trả toàn bộ nguyên liệu.</p>`);
  if(name('ButtonPick')||name('HLBIconSkillTableView'))return selectTable();
  if(name('ButtonLvUp'))return act('level');
  if(name('ButtonStarUp'))return act('star');
  if(name('ButtonRefresh'))return confirm('Cài lại sẽ hoàn trả tất cả tài nguyên nâng cấp và tài nguyên nâng thiên phú, bạn có muốn cài lại?',I2('HC_CAI_LAI','Cài lại'),data.feeReset,()=>act('reset'));
  const lot=e.target.closest('[data-name^="HLBSkillLotView"]');
  if(lot){const i=Number(lot.dataset.name.slice(-1)),s=state();
   if(i>s.star)return c.toast('Nâng sao thiên phú để mở khoá kĩ năng');
   const id=s.skillIds?.[i-1];if(!id)return selectSkill(i);
   return skillDetail(id,()=>selectSkill(i))}
 }

 // ---- Popup chọn bảng (HLBPopupSelectTable)
 function selectTable(focus){
  const s=state();let selected=focus||s.table||1;
  const build=()=>{
   const n=clone(data.prefabs.HLBPopupSelectTable),mid=deep(n,'PopupMid'),table=tableOf(selected);
   data.tables.forEach(t=>iconTable(kid(mid,'TableIcon/HLBIconSkillTableView'+t.id),t,t.id===selected));
   txt(kid(mid,'BarName/TextName'),table.name);txt(kid(mid,'FrameDesc/TextTableDesc'),table.info);
   kid(mid,'FrameSkills/ScrollSkill/Viewport/Content').children=table.lots.flat().map(id=>{const v=clone(data.prefabs.HLBIconSkillView);on(v);v.name='SkillIcon';v.skillId=id;skillIcon(v,id);v.transform.m_LocalScale={x:.8,y:.8,z:1};v.transform.m_SizeDelta={x:80,y:80};return v});
   const cost=s.table&&s.table!==selected?data.feeChangeTable:0;on(kid(mid,'BarCost'),cost>0);
   if(cost){const v=deep(kid(mid,'BarCost'),'HLBConsumeCostView');pic(deep(v,'IconItem'),c.named('icon_gem'));txt(deep(v,'TextValue'),`<color=${have('diamonds')<cost?'#ff3b3b':'#ffffff'}>${c.short(have('diamonds'))}</color>/${cost}`);comp(deep(v,'TextValue'),'Text').rich=true}
   on(kid(mid,'ButtonConfirm'),s.table!==selected);txt(kid(mid,'ButtonConfirm/Text'),s.table?'Đổi':'Chọn');
   return n;
  };
  const show=()=>{popup?.remove();const color=colors[selected];popup=render(build(),'talent-popup',color);
   // Mỗi biểu tượng bảng phát đúng màu Spine của bảng đó.
   data.tables.forEach(t=>{const v=D.find(popup,'TableIcon/HLBIconSkillTableView'+t.id);const cv=v?.querySelector('canvas');if(cv&&t.id!==selected){cv.remove();const host=D.find(v,'Scale/S');const fresh=document.createElement('canvas');fresh.width=fresh.height=260;fresh.className='talent-spine';Object.assign(fresh.style,{left:(host.offsetWidth-260)/2+'px',top:(host.offsetHeight-260)/2+'px'});host.appendChild(fresh);c.spine(fresh,{skeleton:spineDesc(),animation:'Loop_'+colors[t.id]},{loop:true,scale:1})}});
   const content=D.find(popup,'FrameSkills/ScrollSkill/Viewport/Content'),vp=content?.parentElement;if(vp){vp.style.overflowX='auto';vp.style.overflowY='hidden';content.style.width=(tableOf(selected).lots.flat().length*92+20)+'px'}
   [...popup.querySelectorAll('[data-name="SkillIcon"]')].forEach((el,i)=>{el.dataset.skill=tableOf(selected).lots.flat()[i];el.classList.add('talent-click')});
   popup.addEventListener('click',e=>{
    if(e.target.closest('[data-name="ButtonClose"]')||e.target.closest('[data-name]')?.dataset.name==='Close2')return popup.remove();
    const icon=e.target.closest('[data-name^="HLBIconSkillTableView"]');if(icon){selected=Number(icon.dataset.name.slice(-1));return show()}
    const sk=e.target.closest('[data-skill]');if(sk)return skillDetail(Number(sk.dataset.skill));
    if(e.target.closest('[data-name="ButtonConfirm"]')){const cost=s.table&&s.table!==selected?data.feeChangeTable:0;const go=()=>{popup?.remove();act('table',{tableId:selected})};
     return cost?confirm(`Đổi sang bảng ${tableOf(selected).name}?`,'Đổi bảng',cost,go):go()}
   });
  };
  show();
 }
 const spineDesc=()=>{let found=null;const walk=n=>{for(const x of n.components||[])if(x.type==='SkeletonGraphic'&&x.skeleton)found=x.skeleton;(n.children||[]).forEach(walk)};walk(data.prefabs.HLBPanelMain);return found};

 // ---- Popup chọn kỹ năng (HLBPopupSelectSkill): 3 kỹ năng của ô, nút Chọn.
 function selectSkill(lotIndex){
  const s=state(),table=tableOf(s.table),ids=table.lots[lotIndex-1],n=clone(data.prefabs.HLBPopupSelectSkill);
  const tpl=deep(n,'CellSelectSkill');on(tpl,false);
  deep(n,'ScrollView').children[0].children[0].children=ids.map((id,i)=>{const cell=clone(tpl);on(cell);cell.name='Cell'+(i+1);skillIcon(cell,id);txt(deep(cell,'TextName'),data.skills[id].name);txt(deep(cell,'ButtonSelect/Text'),s.skills[lotIndex-1]===i+1?'Đang dùng':'Chọn');return cell});
  popup?.remove();popup=render(n,'talent-popup',colors[table.id]);
  popup.addEventListener('click',e=>{
   if(e.target.closest('[data-name="ButtonClose"]')||e.target.closest('[data-name]')?.dataset.name==='Close2')return popup.remove();
   const cell=e.target.closest('[data-name^="Cell"]');if(!cell)return;const i=Number(cell.dataset.name.slice(4));
   if(e.target.closest('[data-name="ButtonSelect"]')){if(s.skills[lotIndex-1]===i){popup.remove();return}popup.remove();return act('skill',{lot:lotIndex,index:i})}
   if(e.target.closest('[data-name="HLBIconSkillView"],[data-name="Scale"]'))return skillDetail(ids[i-1]);
  });
 }
 // ---- Xác nhận trả kim cương (PopupBuyConfirm): nằm trên sổ và popup Thiên phú.
 // Hộp xác nhận gốc (PopupBuyConfirm / PopupMessage) dùng chung: GameMessage trong game.js.
 function confirm(text,title,price,ok){GameMessage.confirm(text,title,price,()=>{if(price&&have('diamonds')<price)return c.toast('Không đủ kim cương.');ok()})}
 // ---- Chi tiết kỹ năng (HLBPanelSkillDetail): icon, tên, mô tả gốc; nút Đổi khi xem ô đã chọn.
 function skillDetail(id,onChange){
  const s=data.skills[id];document.querySelector('.talent-detail')?.remove();
  const el=document.createElement('div');el.className='talent-detail';
  el.innerHTML=`<div class="talent-detail-shade"></div><section class="modal item-popup talent-detail-box" style="--popup-frame:url('${c.assetSrc(art('round_rect_8'))}')"><div class="talent-detail-title"><span class="talent-detail-icon"><img src="${c.assetSrc(s.icon)}" alt=""><img src="${c.assetSrc(art('ecp'))}" alt=""></span><h2>${c.escape(s.name)}</h2></div><p class="talent-detail-desc">${D.richText(s.rich||s.description,true)}</p>${onChange?`<div class="talent-detail-actions"><button class="talent-change" style="--btn:url('${c.assetSrc(art('button_green'))}')">Đổi</button></div>`:''}</section>`;
  c.layer().appendChild(el);
  el.addEventListener('click',e=>{if(e.target.closest('.talent-change')){el.remove();onChange();return}el.remove()});
 }

 async function open(context){
  if(context)c=context;try{await load()}catch{c.toast('Không tải được Thiên phú. Hãy thử lại.');return}
  close();root=null;const {n,color}=mainNode();root=render(n,'talent-root',color);root.addEventListener('click',onMainClick);
 }
 function close(){root?.remove();root=null;popup?.remove();popup=null;document.querySelector('.talent-detail')?.remove()}
 /** Nút "Thiên phú" bên trái màn Thông tin tướng: biểu tượng bảng đang dùng (hoặc dấu +) và nhãn. */
 function entryHtml(){
  if(!data){load().then(()=>c?.rerender()).catch(()=>{});return ''}
  const s=state(),table=tableOf(s.table);
  const orb=table?`<span class="talent-orb-bg" style="background-image:url('${c.assetSrc(art('hlb_tlb_bg_'+table.id))}')"></span><img class="talent-orb-icon" src="${c.assetSrc(art('hlb_tbl_'+table.id))}" alt="">`:`<img class="talent-orb-ring" src="${c.assetSrc(art('ecp'))}" alt=""><img class="talent-orb-plus" src="${c.assetSrc(art('v3'))}" alt="">`;
  return `<button class="talent-entry ${s.unlocked?'':'locked'}" data-action="talent-open" aria-label="Thiên phú"><span class="talent-orb" data-color="${table?colors[table.id]:''}">${orb}<canvas class="talent-orb-spine" width="190" height="190"></canvas></span><span class="talent-label" style="background-image:url('${c.assetSrc(art('layer-565-copy'))}')">Thiên phú</span></button>`;
 }
 function mountEntry(screen){const cv=screen.querySelector('.talent-orb-spine'),color=cv?.parentElement.dataset.color;if(cv&&color)c.spine(cv,{skeleton:spineDesc(),animation:'Loop_'+color},{loop:true,scale:1.25})}
 window.TalentUI={init:ctx=>{c=ctx},load,open,close,refresh:fill,entryHtml,mountEntry};
})();
