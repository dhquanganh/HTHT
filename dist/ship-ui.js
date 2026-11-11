/* Chiến hạm gốc dựng bằng PrefabDOM, dữ liệu ship.json (tools/export-ship.py), luật ở server/ship.mjs:
 *   MonsterScene (scene 15): nền bgr_monster, Beli / Hồn chiến hạm / Đá hỗn độn, 3 thẻ CellPet mỗi trang (Spine Ship_N,
 *     Kích hoạt bằng Hồn chiến hạm hoặc Nâng cấp, nút xem trước), ButtonPrev / ButtonNext, DotIndicator.
 *   PopupPet (1180): BoxSpine (Spine + Tái tạo) và BoxInfo 3 tab: Cấp (LV x/y, Phẩm 3 sao, phí Beli + Hồn [+ Gỗ Quý],
 *     mô tả kỹ năng chủ động theo cấp), Kỹ năng (4 bị động, tổng chỉ số đội, phí Beli + Đá hỗn độn, yêu cầu phẩm),
 *     Phế tích (Máu / Công / Tốc x/60, khóa tới khi bảng kỹ năng tối đa).
 *   PopupPetPreview (1357): kỹ năng ở cấp tối đa. PopupSelectPet (1022): chọn chiến hạm ra trận ở ô Chiến hạm của đội hình.
 *   Trong trận: Spine ship_battleN tung chiêu (Fire / Cast1) và ship_hitN nổ trên từng mục tiêu.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,data=null,hub=null,popup=null,page=0,tab='level',skillIndex=0,ruinIndex=0;const cache={};
 const scene=id=>cache[id]??=fetch(`scenes/${id}.json`).then(r=>{if(!r.ok)throw Error('Không tải được giao diện.');return r.json()});
 const load=()=>data?Promise.resolve(data):fetch('ship.json').then(r=>{if(!r.ok)throw Error('Không tải được dữ liệu chiến hạm.');return r.json()}).then(d=>data=d);
 const kid=(n,path)=>path.split('/').reduce((x,p)=>x&&(x.children||[]).find(k=>k.name===p),n);
 const find=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=find(k,name);if(r)return r}return null};
 const deep=(n,path)=>{const [first,...rest]=path.split('/');const x=find(n,first);return rest.length?kid(x,rest.join('/')):x};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const img=(n,key)=>{const x=comp(n,'Image');if(x){x.asset=key;x.color=[1,1,1,1]}};
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5}};
 const shell=(n,shade=true)=>({id:'ship',name:'ShipRoot',active:true,components:[],transform:full,children:[...(shade?[{id:'shade',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.6]}],transform:full,children:[]}]:[]),n]});
 const mount=(n,cls,shade)=>{const el=D.render(shell(n,shade),W,H,opts());el.classList.add('ship-layer',...cls.split(' '));c.layer().appendChild(el);return el};
 const bind=(el,x,f)=>{if(typeof x==='string')x=D.find(el,x);if(x){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();f(e)}}return x};
 const p=()=>c.player(),view=()=>p().ships||{list:{},selected:null},own=id=>view().list[id];
 const inv=id=>p().inventory?.[id]||0,soul=()=>inv('material:ship-soul'),chaos=()=>inv('material:ship-chaos');
 const ships=()=>data.ships.filter(s=>s.released);
 const fmt=n=>c.short(n);
 const statLine=s=>`${s.label} +${s.type.endsWith('Flat')?c.num(Math.round(s.value)):Math.round(s.value*1000)/10+'%'}`;
 // Spine chiến hạm vào khung (canvas trong node, gốc skeleton ở giữa dưới như SkeletonGraphic).
 function spineIn(host,desc,{animation=null,fit=.92}={}){if(!host||!desc)return;const w=Math.round(host.offsetWidth)||220,h=Math.round(host.offsetHeight)||220,cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.className='ship-spine';host.appendChild(cv);c.spine(cv,{skeleton:desc,animation:animation||'Idle'},{loop:true,scale:Math.min(w/350,h/485)*fit})}

 // ---------- MonsterScene ----------
 async function openHub(){
  await load();const s=await scene(15),root=structuredClone(s.roots.find(r=>r.name==='Canvas'));root.transform={...full};root.components=[];close();
  const list=ships(),pages=Math.ceil(list.length/3);page=Math.min(page,pages-1);
  txt(deep(root,'FieldGold/Text'),fmt(p().wallet.gold));txt(deep(root,'FieldSoul/Text'),fmt(soul()));txt(deep(root,'FieldChaos/Text'),fmt(chaos()));
  on(deep(root,'LuaPlaceholder1'),false);on(deep(root,'PointHideBoxPet'),false);
  const dots=deep(root,'DotIndicator'),dot=dots.children[0];dots.children=Array.from({length:pages},(_,i)=>{const d=structuredClone(dot);d.name='Dot'+i;on(kid(d,'ImageOn'),i===page);return d});
  dots.components=[...dots.components.filter(x=>x.type!=='DotIndicator'),{type:'HorizontalLayoutGroup',spacing:12,padding:[0,0,0,0],align:4}];
  for(let i=0;i<3;i++){
   const cell=deep(root,'CellPet'+(i+1)),def=list[page*3+i];on(cell,!!def);if(!def)continue;const mine=own(def.id);
   txt(deep(cell,'TextName'),def.name+(view().selected===def.id?' ⚓':''));
   on(deep(cell,'ButtonActivate'),!mine);on(deep(cell,'ButtonDetail'),!!mine);txt(deep(cell,'TextStoneCost'),def.unlock);txt(deep(cell,'ButtonDetail/Text'),'Nâng cấp');txt(deep(cell,'ButtonActivate/Text'),'Kích hoạt');
   cell.shipId=def.id;
  }
  hub=D.render(shell(root,false),W,H,opts());hub.classList.add('ship-layer','ship-hub');c.layer().appendChild(hub);
  bind(hub,'ButtonBack',close);bind(hub,'ButtonHelp',()=>c.modal('Chiến hạm',`<p class="item-description">Kích hoạt chiến hạm bằng Hồn chiến hạm. Chiến hạm ra trận cùng đội hình (chọn ở ô Chiến hạm của Đội hình): cuối mỗi hiệp tung kỹ năng chủ động, bảng kỹ năng và Phế tích cộng chỉ số cho cả đội. Lên cấp tốn Beli và Hồn chiến hạm, tới cấp 30 / 60 / 90 phải Nâng phẩm. Hồn chiến hạm và Đá hỗn độn nhận thêm từ rương treo máy.</p>`));
  bind(hub,'ButtonPrev',()=>{page=(page-1+pages)%pages;openHub()});bind(hub,'ButtonNext',()=>{page=(page+1)%pages;openHub()});
  for(const el of hub.querySelectorAll('.pd-node')){const id=el._node?.shipId;if(!id)continue;const def=data.ships.find(s=>s.id===id);
   bind(el,D.find(el,'ButtonActivate'),()=>activate(def));bind(el,D.find(el,'ButtonDetail'),()=>openPopup(def.id));bind(el,D.find(el,'ButtonPreview'),()=>preview(def));
   spineIn(D.find(el,'ImageBgr'),def.spine)}
 }
 function activate(def){
  if(soul()<def.unlock)return c.toast(`Không đủ Hồn chiến hạm (cần ${def.unlock}).`);
  c.confirm(`Kích hoạt ${def.name} với ${def.unlock} Hồn chiến hạm?`,I2('LBL_ACTIVATE','Kích hoạt'),null,async()=>{const d=await c.mutation('/api/ship',{op:'activate',shipId:def.id},{render:false});if(d)openHub()});
 }
 // ---------- PopupPet ----------
 async function openPopup(id){
  await load();const s=await scene(1180),n=structuredClone(s.roots[0]),def=data.ships.find(x=>x.id===id),o=own(id);if(!o)return;
  txt(deep(n,'TextPetName'),def.name);txt(deep(n,'TextGold'),fmt(p().wallet.gold));txt(deep(n,'TextSoul'),fmt(soul()));txt(deep(n,'TextChaos'),fmt(chaos()));
  for(const t of ['TabLevel','TabSkill','TabRuin']){const b=deep(n,t),active=t==='Tab'+tab[0].toUpperCase()+tab.slice(1);on(kid(b,'SpriteOn'),active);on(kid(b,'SpriteOff'),!active)}
  on(deep(n,'PanelLevel'),tab==='level');on(deep(n,'PanelPassiveBuff'),tab==='skill');on(deep(n,'PanelRuin'),tab==='ruin');
  txt(deep(n,'ButtonRebirth/Text'),'Tái tạo');on(deep(n,'PointHideBoxSpine'),false);on(deep(n,'PointHideBoxInfo'),false);
  // Cấp
  {const lv=deep(n,'PanelLevel');txt(deep(lv,'TextLvCaption'),'LV:');txt(deep(lv,'TextLv'),`${o.level}/${o.cap}`);txt(deep(lv,'TextTierCaption'),'Phẩm');
   const slots=deep(lv,'HorizontalSlotPoint'),tpl=slots.children[0];slots.children=[0,1,2].map(i=>{const t=on(structuredClone(tpl));t.name='Tier'+i;on(kid(t,'ItemOn'),i<o.tier);on(kid(t,'ItemOff'),i>=o.tier);return t});
   on(deep(lv,'ButtonUpTier'),!!o.tierCost);on(deep(lv,'ButtonUpLevel'),!!o.levelCost);
   const max=o.level>=data.maxLevel;on(deep(lv,'BoxUpMaxLevel'),max);txt(deep(lv,'BoxUpMaxLevel/TextMax'),I2('LBL_MAX_LEVEL','Cấp tối đa'));on(deep(lv,'BoxUpRequire'),!max);
   const cost=o.levelCost||o.tierCost||{gold:0,soul:0};txt(deep(lv,'ImgGoldLevel/TextGold'),fmt(cost.gold));txt(deep(lv,'ImgSoul/TextSoul'),fmt(cost.soul));
   const skill=def.active[Math.min(def.active.length,o.level)-1];const ts=deep(lv,'TextSkill');if(comp(ts,'Text'))comp(ts,'Text').size=22;txt(ts,`<color=#a8430c>${def.skillName}</color> (Cấp ${o.level})\n${skill.desc}${o.tierCost?`\n<color=#ff8a65>Cần Nâng phẩm để lên cấp tiếp.</color>`:''}`)}
  // Kỹ năng (bị động)
  {const ps=deep(n,'PanelPassiveBuff'),aura=o.aura||{};
   const lines=Object.entries(aura).map(([type,value])=>({type,value,label:({maxHpFlat:I2('LBL_BLOOD','Máu'),attackFlat:'Công',speedFlat:'Tốc độ',penetration:'Xuyên thủ',accuracy:'Chính xác',dodgeChance:'Né tránh',critChance:'Chí mạng',critDamage:'ST chí mạng',skillDamage:'ST kỹ năng',block:'Chặn',trueDamage:'ST chuẩn'})[type]||type}));
   on(deep(ps,'CellAuraDetail'),false);on(deep(ps,'GridAura'),false);
   for(let k=0;k<4;k++){const b=deep(ps,'ButtonPetSkill'+(k+1));img(kid(b,'SpriteOn'),data.passiveIcons[Math.min(2,k)]);img(kid(b,'SpriteOff'),data.passiveIcons[Math.min(2,k)]);on(kid(b,'SpriteOff'),o.tier<k);on(kid(b,'Selection'),k===skillIndex);txt(deep(b,'TextLevel'),o.passives[k]);b.skillIndex=k}
   const lvl=o.passives[skillIndex],cur=lvl?def.passives[skillIndex][lvl-1]:null,next=def.passives[skillIndex][Math.min(29,lvl)];on(deep(ps,'BoxPetSkillDesc'),false);
   // BoxBuff: kỹ năng đang chọn (hiện tại / cấp kế) và tổng chỉ số chiến hạm cộng cho cả đội.
   txt(deep(ps,'TextBuffSum'),`<color=#ffe08a>Kỹ năng ${skillIndex+1} · Cấp ${lvl}/${o.passiveCap}</color>\n${cur?cur.map(statLine).join(', '):'Chưa học'}${lvl<30?`\n<color=#9be37a>Cấp ${lvl+1}: ${next.map(statLine).join(', ')}</color>`:''}\n<color=#bfe9ff>Cả đội: ${lines.length?lines.map(statLine).join(', '):'chưa có'}</color>`);
   const cost=o.passiveCosts[skillIndex],locked=o.tier<skillIndex,max=lvl>=30;
   on(deep(ps,'GroupRequireTier'),locked||(!cost&&!max));txt(deep(ps,'TextRequireTier'),`Yêu cầu chiến xa nâng lên phẩm ${locked?skillIndex:o.tier+1}`);
   on(deep(ps,'BoxUpMaxLevel'),max);txt(deep(ps,'BoxUpMaxLevel/TextMax'),I2('LBL_MAX_LEVEL','Cấp tối đa'));on(deep(ps,'GroupUpgrade'),!!cost);
   if(cost){txt(deep(ps,'ImgGoldSkill/TextGold'),fmt(cost.gold));txt(deep(ps,'ImgChaos/TextChaos'),fmt(cost.chaos));txt(deep(ps,'ButtonUpgrade/Text'),'Nâng cấp')}}
  // Phế tích
  {const pr=deep(n,'PanelRuin'),scale=(i,key)=>def.ruinScale[key]*Math.min(60,o.ruins[i]);
   txt(deep(pr,'TextHpCap'),I2('LBL_BLOOD','Máu'));txt(deep(pr,'TextAttackCap'),'Công');txt(deep(pr,'TextSpeedCap'),'Tốc độ');txt(deep(pr,'TextHp'),'+'+c.num(scale(0,'hp')));txt(deep(pr,'TextAttack'),'+'+c.num(scale(1,'attack')));txt(deep(pr,'TextSpeed'),'+'+c.num(scale(2,'speed')));
   for(let i=0;i<3;i++){const b=deep(pr,'ButtonPetRuin'+(i+1));txt(kid(b,'TextLevel'),`${o.ruins[i]}/60`);on(kid(b,'Selection'),i===ruinIndex);b.ruinIndex=i}
   txt(deep(pr,'Text1'),I2('LBL_BLOOD','Máu'));txt(deep(pr,'Text2'),'Công');txt(deep(pr,'Text3'),'Tốc độ');
   const cost=o.ruinCosts[ruinIndex],group=deep(pr,'GroupUpgrade');on(deep(group,'BoxLockRuin'),!o.ruinsOpen);txt(deep(group,'BoxLockRuin/TextMax'),'Cần nâng cấp tối đa bảng kỹ năng chiến hạm mục 2');
   on(deep(group,'BoxUpRequire'),!!cost);on(kid(pr,'ButtonUpgrade'),!!cost);on(deep(group,'BoxUpMaxLevel'),o.ruinsOpen&&!cost);txt(deep(group,'BoxUpMaxLevel/TextMax'),I2('LBL_MAX_LEVEL','Cấp tối đa'));on(kid(pr,'ButtonUpgrade'),!!cost);txt(deep(pr,'ButtonUpgrade/Text'),'Nâng cấp');
   if(cost){txt(deep(group,'ImgGoldSkill/TextGold'),fmt(cost.gold));txt(deep(group,'ImgChaos/TextChaos'),fmt(cost.chaos))}}
  const old=popup;popup=mount(n,'ship-popup',true);old?.remove();
  spineIn(D.find(popup,'BgrPet'),def.spine,{fit:.9});
  bind(popup,'ButtonClose',closePopup);bind(popup,'Shade',closePopup);
  bind(popup,'TabLevel',()=>{tab='level';openPopup(id)});bind(popup,'TabSkill',()=>{tab='skill';openPopup(id)});bind(popup,'TabRuin',()=>{tab='ruin';openPopup(id)});
  const run=(op,extra={})=>c.mutation('/api/ship',{op,shipId:id,...extra},{render:false}).then(d=>{if(d){popup?.classList.add('ship-flash');openPopup(id)}});
  bind(popup,'ButtonUpLevel',()=>run('level'));bind(popup,'ButtonUpTier',()=>run('tier'));
  bind(popup,'ButtonRebirth',()=>c.confirm('Tái tạo chiến hạm đưa chiến hạm về cấp độ 1. Các tài nguyên đã dùng để nâng cấp được hoàn lại (trừ beli)',I2('LBL_REGENERATIVE','Tái tạo'),null,()=>run('rebirth')));
  for(const el of popup.querySelectorAll('.pd-node')){const n2=el._node;if(n2?.skillIndex!==undefined)bind(el,el,()=>{skillIndex=n2.skillIndex;openPopup(id)});if(n2?.ruinIndex!==undefined)bind(el,el,()=>{ruinIndex=n2.ruinIndex;openPopup(id)})}
  const skillUp=D.find(popup,'PanelPassiveBuff/GroupUpgrade/ButtonUpgrade');bind(popup,skillUp,()=>run('passive',{index:skillIndex}));
  const ruinUp=D.find(popup,'PanelRuin/ButtonUpgrade');bind(popup,ruinUp,()=>run('ruin',{index:ruinIndex}));
 }
 function closePopup(){popup?.remove();popup=null;if(hub)openHub()}
 // ---------- PopupPetPreview ----------
 async function preview(def){
  await load();const s=await scene(1357),n=structuredClone(s.roots[0]),max=def.active[def.active.length-1];
  txt(deep(n,'TextTitle'),def.name);const ta=deep(n,'TextActiveSkill');if(comp(ta,'Text'))comp(ta,'Text').size=21;txt(ta,`<color=#a8430c>${def.skillName}</color> (Cấp ${def.active.length})\n${max.desc}`);
  for(let k=0;k<4;k++){const b=deep(n,'ButtonPetSkill'+(k+1));img(kid(b,'SpriteOn'),data.passiveIcons[Math.min(2,k)]);img(kid(b,'SpriteOff'),data.passiveIcons[Math.min(2,k)]);on(kid(b,'Selection'),false);txt(deep(b,'TextLevel'),30);b.skillIndex=k}
  const desc=k=>`Kỹ năng ${k+1} (cấp 30): ${def.passives[k][29].map(statLine).join(', ')} cho cả đội. Mở ở phẩm ${k}.`;
  const box=deep(n,'BoxPetSkillDesc');on(box,false);img(deep(box,'SkillIcon'),data.passiveIcons[0]);txt(deep(box,'TextName'),'Kỹ năng 1');txt(deep(box,'TextDesc'),desc(0));
  const el=mount(n,'ship-preview',true);bind(el,'ButtonClose',()=>el.remove());bind(el,'Shade',()=>el.remove());
  for(const x of el.querySelectorAll('.pd-node')){const k=x._node?.skillIndex;if(k===undefined)continue;bind(el,x,()=>{for(const y of el.querySelectorAll('[data-name^="ButtonPetSkill"] [data-name="Selection"]'))y.style.display='none';D.find(x,'Selection').style.display='';D.find(el,'BoxPetSkillDesc').style.display='';D.setText(D.find(el,'BoxPetSkillDesc/SkillTitle/TextName'),'Kỹ năng '+(k+1));D.setText(D.find(el,'BoxPetSkillDesc/TextDesc'),desc(k))})}
 }
 // ---------- PopupSelectPet ----------
 // PopupSelectPet gốc: khung ImageBody + "Chọn chiến hạm", hàng thẻ (bgr_box_2, ảnh chiến hạm, dải tên, khung frame_pet vàng),
 // chiến hạm chưa kích hoạt xám (ảnh _ia / lọc xám, khung bạc), dấu tick_green ở chiến hạm đang chọn, nút Chọn.
 async function select(){
  await load();if(p().account.level<20)return c.toast('Tính năng Chiến hạm mở ở cấp 20.');
  const s=await scene(1022),n=structuredClone(s.roots[0]),content=deep(n,'ScrollView/Viewport/Content');let pick=view().selected;n.transform={...full};n.components=n.components.filter(x=>x.type!=='Image');
  on(deep(n,'CellPetSelection'),false);content.children=[];txt(deep(n,'TextTitle'),'Chọn chiến hạm');txt(deep(n,'ButtonSelect/Text'),'Chọn');
  const el=mount(n,'ship-select',true),closeIt=()=>el.remove();bind(el,'ButtonClose',closeIt);bind(el,'Shade',closeIt);
  const vp=el.querySelector('[data-name="Viewport"]'),row=document.createElement('div');row.className='ship-pick-row';vp.appendChild(row);
  const src=k=>c.assetSrc(k),list=[...ships()].sort((a,b)=>(own(b.id)?1:0)-(own(a.id)?1:0));
  const paint=()=>{for(const x of row.children){const id=Number(x.dataset.ship);x.classList.toggle('picked',pick===id)}};
  for(const def of list){
   const mine=!!own(def.id),cell=document.createElement('button');cell.type='button';cell.className='ship-pick-cell '+(mine?'owned':'locked');cell.dataset.ship=def.id;cell.setAttribute('aria-label',def.name+(mine?'':' (chưa kích hoạt)'));
   const art=mine?def.card:(def.cardOff||def.card);
   cell.innerHTML=`<img class="bg" src="${src('61761ab99204ebe48a34e028202827d2_2')}" alt=""><div class="art">${art?`<img src="${src(art)}" alt="">`:''}</div><span class="name">${c.escape?c.escape(def.name):def.name}</span><span class="frame" style="border-image:url('${src('d5e1124f98fed5642b86c4b5cf9c8e34_2')}') 72 / 36px stretch"></span><img class="tick" src="${src('bba745a01cbc4064297dc55cc48349fb_2')}" alt="">${mine?'':`<img class="ban" src="${src('01459ffa453cc4d4b921b564e789ebe4_2')}" alt="">`}`;
   if(!art)setTimeout(()=>spineIn(cell.querySelector('.art'),def.spine,{fit:1.15}),0);
   cell.onclick=e=>{e.stopPropagation();if(!mine)return c.toast('Chiến hạm chưa được kích hoạt');pick=pick===def.id?null:def.id;paint()};
   row.appendChild(cell);
  }
  paint();
  bind(el,'ButtonSelect',async()=>{const d=await c.mutation('/api/ship',{op:'select',shipId:pick},{render:false,close:false});if(d){closeIt();c.onSelect?.()}});
 }
 // ---------- Trong trận ----------
 // Đầy Nộ: cảnh ship_battleN toàn màn hình (khung đen trên dưới Black_bgr + chiến hạm Fire / Cast1 như db_battle_pets),
 // xong thì nổ ship_hitN trên từng mục tiêu rồi mới hiện sát thương.
 async function battleCast(e,actors){
  await load();const def=data.ships.find(s=>s.id===e.shipId);if(!def?.battle?.spine)return;
  const layer=c.layer(),box=document.createElement('div');box.className='ship-cinema';layer.appendChild(box);
  const add=()=>{const cv=document.createElement('canvas');cv.width=W;cv.height=H;box.appendChild(cv);return cv};
  if(data.black)c.spine(add(),{skeleton:data.black,animation:'2s'},{loop:true,scale:.75});
  await new Promise(resolve=>{let done=false;const end=()=>{if(!done){done=true;resolve()}};c.spine(add(),{skeleton:def.battle.spine,animation:'Fire'},{loop:false,scale:.75,onEnd:end});setTimeout(end,5200)});
  box.classList.add('out');setTimeout(()=>box.remove(),350);
  // Chiến hạm có ship_hitN thì nổ Hit của nó; Ship5 / Ship6 (db_battle_pets) dùng hoạt ảnh Hit trong chính ship_battle.
  const hit=def.battle.hit||def.battle.spine;
  for(const id of e.targets||[]){const a=actors.find(x=>x.id===id);if(!a)continue;const fx=document.createElement('canvas');fx.width=300;fx.height=300;fx.className='ship-hit';fx.style.left=(a.x-150)+'px';fx.style.top=(a.y-230)+'px';layer.appendChild(fx);c.spine(fx,{skeleton:hit,animation:'Hit'},{loop:false,fit:.95});setTimeout(()=>fx.remove(),1300)}
  await new Promise(r=>setTimeout(r,450));
 }
 // Thanh Nộ chiến hạm (PetRageBar1 gốc: Slider 280x40 ở góc trái dưới, nền progress_bgr_2, Fill progress_2 thụt 14 px).
 function bar(value){
  let el=document.querySelector('.ship-rage');
  if(value===null||value===undefined){el?.remove();return}
  if(!el){el=document.createElement('div');el.className='ship-rage';el.innerHTML=`<span class="bg" style="border-image:url('${c.assetSrc('9ebbc1eba3df6844d9feba52c45a562e_2')}') 0 30 fill / 0 30px stretch"></span><span class="fill" style="border-image:url('${c.assetSrc('04d422ad8258c1c4b85ff734d8bd5adb_2')}') 0 16 fill / 0 16px stretch"></span>`;c.layer().appendChild(el)}
  const v=Math.max(0,Math.min(1,value));el.querySelector('.fill').style.width=(v*252)+'px';el.classList.toggle('full',v>=1);
 }
 function close(){hub?.remove();hub=null;popup?.remove();popup=null}
 // Ô Chiến hạm ở Đội hình: ảnh thẻ chiến hạm (pet_thumb) hoặc Spine chiến hạm nếu không có thẻ.
 function decorate(){for(const el of document.querySelectorAll('.campaign-ship-art[data-ship]:not(.done)')){el.classList.add('done');load().then(()=>{const def=data.ships.find(s=>s.id===Number(el.dataset.ship));if(!def)return;if(def.card)el.innerHTML=`<img src="${c.assetSrc(def.card)}" alt="">`;else spineIn(el,def.spine,{fit:1.6})})}}
 new MutationObserver(decorate).observe(document.documentElement,{childList:true,subtree:true});
 window.ShipUI={init(ctx){c=ctx},async open(){try{await openHub()}catch(e){c.toast(e.message)}},select:()=>select().catch(e=>c.toast(e.message)),battleCast,bar,close,load,data:()=>data,isOpen:()=>!!hub};
})();
