/* Bảng Haki (E-skill gốc): PanelESkill của PanelHeroInfo và PopupHeroESkill dựng nguyên prefab bằng PrefabDOM,
 * đổ dữ liệu như PanelHeroESkill / PopupHeroESkill / CellGroupESkills / ButtonESkill / PanelESkillDetail:
 *   - Bảng (tab Haki của Thông tin tướng): ButtonESkill1-5 là Haki đang kích hoạt của bậc 1-5 trên nền medition_man;
 *     Line1-5 nối hai bậc liền nhau (5 nối về 1) khi cả hai đã kích hoạt. Chạm nút xem chi tiết; nút "Haki" mở sổ.
 *   - Sổ Haki: mỗi bậc một CellGroupESkills (số bậc + 3 lựa chọn). Lựa chọn đang dùng có FrameSelected, còn lại phủ
 *     ImageCover; bậc chưa mở có IconLock. Chạm lựa chọn mở PanelESkillDetail; nút Kích hoạt gọi /api/haki/pick.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,loading=null,panel=null,popup=null;
 const W=1136,H=640,DEFAULT_ICON='5c52b7576b4569a40b582620b328174a_2';
 const load=()=>data?Promise.resolve(data):loading??=fetch('haki.json').then(r=>{if(!r.ok)throw Error('haki.json');return r.json()}).then(d=>data=d,e=>{loading=null;throw e});
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const find=(el,p)=>el&&D.find(el,p),show=D.show,text=(el,t)=>D.setText(el,t,true);
 const img=(el,key)=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();Object.assign(el.style,{backgroundColor:'transparent',backgroundImage:`url('${c.assetSrc(key)}')`,backgroundSize:'100% 100%',backgroundRepeat:'no-repeat',borderImage:'none',borderWidth:'0'})};
 const option=id=>{for(const t of data.tiers)for(const o of t.options)if(o.id===id)return o;return null};
 const state=()=>c.player().hero.haki||{selected:[],unlocked:[],unlockStars:data.tiers.map(t=>14+t.tier)};
 const active=(s,tier)=>s.unlocked[tier-1]?s.selected[tier-1]||null:null;
 const findNode=(n,name)=>{if(n.name===name)return n;for(const k of n.children||[]){const r=findNode(k,name);if(r)return r}return null};
 const layer=()=>document.querySelector('#game-layer');

 /** GroupEnable: 5 nút bậc + 5 đường nối. */
 function fillBoard(group){
  if(!group)return;const s=state();
  for(const t of data.tiers){
   const b=find(group,'ButtonESkill'+t.tier);if(!b)continue;const id=active(s,t.tier);
   img(find(b,'ImageSkill'),id?option(id).icon:DEFAULT_ICON);
   show(find(b,'ImageCover'),!id);show(find(b,'IconLock'),!s.unlocked[t.tier-1]);show(find(b,'FrameSelected'),!!id);
   b.dataset.hakiTier=t.tier;b.classList.add('haki-node');b.setAttribute('aria-label',id?`Haki bậc ${t.tier}: ${option(id).plain}`:`Haki bậc ${t.tier}`);
  }
  [[1,2],[2,3],[3,4],[4,5],[5,1]].forEach(([a,z],i)=>show(find(group,'Line'+(i+1)),!!(active(s,a)&&active(s,z))));
 }

 /** PanelESkillDetail: icon, tên, mô tả; nút Kích hoạt khi bậc đã mở và Haki chưa được chọn. */
 function fillDetail(detail,id,tier,withAction){
  const o=option(id),s=state(),unlocked=!!s.unlocked[tier-1],on=unlocked&&s.selected[tier-1]===id,bg=find(detail,'Background');
  img(find(bg,'GroupTitle/SkillIcon'),o.icon);text(find(bg,'GroupTitle/TextName'),o.name);
  const desc=find(bg,'TextDescription'),action=find(bg,'GroupAction');
  text(desc,o.desc+(on?'\n<color=#12FE21>Đang kích hoạt</color>':'')+(unlocked?'':`\n<color=#FF4A4A>Mở khi thức tỉnh tướng tới L${tier}.</color>`));
  const showAction=withAction&&unlocked&&!on;show(action,showAction);
  // Như ContentSizeFitter: mô tả nhiều dòng thì khung giãn theo, nút Kích hoạt dời xuống.
  for(const el of [desc,action,bg]){el.dataset.top??=el.style.top;el.dataset.height??=el.style.height;el.style.top=el.dataset.top;el.style.height=el.dataset.height}
  const base=desc.offsetHeight;desc.style.height='auto';const grow=Math.max(0,desc.offsetHeight-base);desc.style.height=(base+grow)+'px';
  const shrink=showAction?0:action.offsetHeight+10;
  action.style.top=(parseFloat(action.dataset.top)+grow)+'px';
  bg.style.height=(parseFloat(bg.dataset.height)+grow-shrink)+'px';bg.style.top=(parseFloat(bg.dataset.top)-(grow-shrink)/2)+'px';
  const btn=find(action,'ButtonActivate');
  btn.onclick=async e=>{e.stopPropagation();const r=await c.mutation('/api/haki/pick',{hakiId:id},{close:false,render:false});if(r){c.rerender();show(detail,false);fillPopup()}};
 }
 function nodeDetail(container,node){
  const tier=Number(node.dataset.hakiTier),s=state(),id=active(s,tier);
  if(!id)return c.toast(s.unlocked[tier-1]?`Chưa kích hoạt Haki bậc ${tier}. Bấm "Haki" để chọn.`:`Haki bậc ${tier} mở khi thức tỉnh tướng tới L${tier}.`);
  const detail=find(container,'PanelESkillDetail');fillDetail(detail,id,tier,false);show(detail,true);
 }

 // ---- Tab Haki trong Thông tin tướng (PanelESkill)
 function onPanelClick(e){
  const detail=find(panel,'PanelESkillDetail');
  if(detail&&detail.style.display!=='none'&&e.target.closest('[data-name="PanelESkillDetail"]'))return show(detail,false);
  const node=e.target.closest('.haki-node');if(node)return nodeDetail(panel,node);
  if(e.target.closest('[data-name="ButtonSwitchSkill"]'))openPopup();
 }
 async function mount(target,context){
  c=context;try{await load()}catch{c.toast('Không tải được dữ liệu Haki. Hãy thử lại.');return}
  if(!target.isConnected)return;
  // Prefab gốc để PanelESkill tắt (PanelHeroInfo bật khi chọn tab).
  panel=D.render({...data.prefabs.PanelESkill,active:true},target.clientWidth||532,target.clientHeight||552,opts());panel.classList.add('haki-panel');target.appendChild(panel);
  fillBoard(find(panel,'GroupEnable'));panel.addEventListener('click',onPanelClick);
 }

 // ---- Sổ Haki (PopupHeroESkill): nhân CellGroupESkills cho từng bậc vào Content của ScrollView.
 function popupNode(){
  const n=structuredClone(data.prefabs.PopupHeroESkill),box=findNode(n,'BoxSkill'),at=box.children.findIndex(x=>x.name==='CellGroupESkills');
  const cell=box.children.splice(at,1)[0];findNode(n,'Content').children=data.tiers.map(t=>({...structuredClone(cell),name:'Cell'+t.tier,active:true}));
  return n;
 }
 function fillPopup(){
  if(!popup?.isConnected)return;const s=state();
  for(const t of data.tiers){
   const cell=find(popup,'Cell'+t.tier);if(!cell)continue;text(find(cell,'PointName/TextTitle'),String(t.tier));
   const buttons=[...cell.children].filter(x=>/^ButtonESkill\d*$/.test(x.dataset.name));
   t.options.forEach((o,i)=>{const b=buttons[i];if(!b)return;const on=active(s,t.tier)===o.id;
    img(find(b,'ImageSkill'),o.icon);show(find(b,'FrameSelected'),on);show(find(b,'ImageCover'),!on);show(find(b,'IconLock'),!s.unlocked[t.tier-1]);
    Object.assign(b.dataset,{hakiId:o.id,hakiTier:t.tier});b.classList.add('haki-option');b.setAttribute('aria-label',`Bậc ${t.tier}: ${o.plain}`)});
  }
  fillBoard(find(popup,'BoxChiPoint/MedMan/GroupEnable'));
 }
 function onPopupClick(e){
  if(e.target.closest('[data-name="ButtonClose"]'))return closePopup();
  const box=find(popup,'BoxSkill'),list=find(box,'PanelESkillDetail'),med=find(popup,'BoxChiPoint/MedMan'),board=find(med,'PanelESkillDetail');
  for(const d of [list,board])if(d&&d.style.display!=='none'&&e.target.closest('[data-name="PanelESkillDetail"]')===d)return show(d,false);
  const opt=e.target.closest('.haki-option');if(opt){show(board,false);fillDetail(list,Number(opt.dataset.hakiId),Number(opt.dataset.hakiTier),true);show(list,true);return}
  const node=e.target.closest('.haki-node');if(node){show(list,false);nodeDetail(med,node)}
 }
 function openPopup(){
  closePopup();popup=D.render(popupNode(),W,H,opts());popup.classList.add('haki-popup');layer().appendChild(popup);
  fillPopup();popup.addEventListener('click',onPopupClick);
 }
 function closePopup(){popup?.remove();popup=null}
 window.HakiUI={mount,load,open:openPopup,close:()=>{panel?.remove();panel=null;closePopup()},refresh:()=>{fillBoard(find(panel,'GroupEnable'));fillPopup()}};
})();
