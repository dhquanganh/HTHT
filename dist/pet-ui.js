/* Thú cưng (lua_pet + SRMain): dựng nguyên prefab gốc bằng PrefabDOM, đổ dữ liệu theo các lớp Lua gốc:
 *   SRMain (Thú Cưng / Vành Đai Tĩnh Lặng) -> PetHome (Đảo Hoang / Biển Sâu) -> PetMain (bản đồ PMBG1/PMBG2, thú cưng
 *   đi lại như PetGO, nút Chiêu mộ / Thú cưng / Thư viện / Thế giới) -> PetSummon, PetInventory, PetLibrary;
 *   PetHeadUI2, PetBox, PetStar, PopupSelectPet2, PopupPetStarUpgrade, PopupShowBonusEffectPet, PopupSummonPet;
 *   PetEquip ở thông tin tướng (LuaJobAddEquipPet) và PopupPetEquip.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,loading=null;const stack=[];
 const W=1136,H=640;
 const load=()=>data?Promise.resolve(data):loading??=fetch('pet.json').then(r=>r.json()).then(d=>data=d);
 const find=(el,p)=>D.find(el,p),show=D.show,text=D.setText;
 const layer=()=>document.querySelector('#game-layer');
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets(),onSkeleton:(el,comp)=>{el._skeleton=comp}});
 const render=(name,w=W,h=H)=>{const el=D.render(data.prefabs[name],w,h,opts());mountSpines(el);return el};
 const img=(el,src)=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();Object.assign(el.style,{backgroundColor:'transparent',backgroundImage:src?`url('${src}')`:'none',borderImage:'none',borderWidth:'0',backgroundSize:'100% 100%',backgroundRepeat:'no-repeat',backgroundPosition:'center'})};
 const imgContain=(el,src)=>{img(el,src);if(el)el.style.backgroundSize='contain'};
 const art=key=>data.art[key]?c.assetSrc(data.art[key]):'';
 const base=id=>data.pets.find(p=>p.id===Number(id));
 const st=()=>c.player().pets||{list:[],shards:{},equip:{},freeIn:0};
 const have=id=>id==='gold'?c.player().wallet.gold:c.player().inventory[id]||0;
 const itemSrc=id=>c.assetSrc(c.items.get(id)?.assetKey);
 const skillOf=id=>data.skills[String(id)];
 const rankName={1:'D',2:'C',3:'B',4:'A',5:'S',6:'SS',7:'SSS'};
 const growthNames={1:'<color=white>Thường </color>',2:'<color=#00FF00FF>Ưu Tú </color>',3:'<color=#4B85E9FF>Nổi Bật </color>',4:'<color=#9A00FFFF>Trác Việt </color>',5:'<color=#FF9801FF>Hoàn Mỹ </color>'};
 const classNames={1:'Công kích',2:'Sinh tồn',3:'Nhanh nhẹn'};
 const power=pet=>pet.stats.power;

 // ---- Spine trong prefab (SkeletonGraphic): vẽ bằng spine-canvas, 1 đơn vị skeleton = 1 px như SkeletonGraphic.
 function spineOn(el,skeleton,animation,{loop=true,size=700,scale=1,onEnd=null}={}){
  el.querySelector(':scope>.pet-spine')?.remove();if(!skeleton)return;
  const cv=document.createElement('canvas');cv.width=cv.height=size;cv.className='pet-spine';el.appendChild(cv);
  c.spine(cv,{skeleton,animation},{loop,scale,onEnd});return cv;
 }
 // Khung vẽ spine đủ lớn (1400 px) để hình lớn như "pet chieu mo" (đặt ở y -200) không bị cắt.
 function mountSpines(root){for(const el of [root,...root.querySelectorAll('.pd-node')])if(el._skeleton?.skeleton&&el.style.display!=='none')spineOn(el,el._skeleton.skeleton,el._skeleton.animation||'animation',{loop:el._skeleton.loop!==false,size:1400})}

 // ---- PetStar: 0-5 sao (GroupStar0 nền + GroupStar1), 6-9 (GroupStar6), 10 (GroupStar10)
 function stars(group,star){
  if(!group)return;show(group,true);const g=n=>find(group,n);
  show(g('GroupStar0'),star<6);show(g('GroupStar1'),star<6);show(g('GroupStar6'),star>=6&&star<10);show(g('GroupStar10'),star>=10);show(g('GroupStarE'),false);
  [...(g('GroupStar1')?.children||[])].forEach((s,i)=>show(s,i<star));[...(g('GroupStar6')?.children||[])].forEach((s,i)=>show(s,i+5<star));
 }
 // ---- PetHeadUI2
 function head(el,b,pet,{level=false,amount=false,check=false,shard=null,hero=null}={}){
  img(find(el,'Mask/ImageHeadPet'),art('petresources/'+b.id));img(find(el,'Mask/Class/ClassImage'),art('images/'+b.clazz));
  show(find(el,'Mask/LevelText'),level&&!!pet);if(level&&pet)text(find(el,'Mask/LevelText'),String(pet.level),false);
  const hs=find(el,'Mask/HeroStars');show(hs,level&&!!pet);if(level&&pet)stars(hs,pet.star);
  const slider=find(el,'Slider');show(slider,amount);
  if(amount){const n=st().shards[b.id]||0;text(find(slider,'AmountText'),`${n}/${b.shardReq}`,false);const fill=find(slider,'Fill Area/Fill');if(fill)fill.style.width=Math.min(100,n/b.shardReq*100)+'%'}
  show(find(el,'Mask/ShardText'),shard!==null);if(shard!==null)text(find(el,'Mask/ShardText'),String(shard),false);
  show(find(el,'Mask/Check'),check);
  const hi=find(el,'Mask/HeroImg');show(hi,!!hero);if(hero)img(find(hi,'Mask/Image'),c.assetSrc(c.heroHead(hero)));
  el.classList.add('pet-head');el.dataset.set=b.id;if(pet)el.dataset.uid=pet.uid;
  return el;
 }
 // ---- PetBox
 function petBox(el,b,star){
  img(find(el,'ImageHero'),art('petresources/art_'+b.id));imgContain(find(el,'ImageHero'),art('petresources/art_'+b.id));
  img(find(el,'ImageBoard/IconClass'),art('images/'+b.clazz));stars(find(el,'ImageBoard/HeroStars'),star);text(find(el,'ImageBoard/TextHeroName'),b.name,false);
  const rank=find(el,'ImageBoard/SpineRank/Skeleton');if(rank?._skeleton)spineOn(rank,rank._skeleton.skeleton,rankName[b.rank],{loop:true});
 }
 function boxFx(el,up=true){const fx=find(el,up?'EffectHeroUp/Spine':'EffectHeroDown/Spine');if(!fx?._skeleton)return;show(fx,true);spineOn(fx,fx._skeleton.skeleton,'Cast',{loop:false,onEnd:()=>fx.querySelector('.pet-spine')?.remove()})}
 // ---- Nút kỹ năng (ButtonSkillInfo) + BoxSkillDesc
 function skillButtons(group,list,box){
  [...group.children].forEach((btn,i)=>{const it=list[i],sk=it&&skillOf(it.id);show(btn,!!sk);if(!sk)return;
   for(const n of ['SpriteOn','SpriteOff'])img(find(btn,n),c.assetSrc(sk.icon));btn.classList.toggle('pet-skill-off',it.active===false);
   const lv=find(btn,'ImgLevel')||find(btn,'Image');show(lv,it.active!==false&&it.level>0);if(it.level>0)text(find(lv,'TextLevel'),String(it.level),false);
   btn.onclick=e=>{e.stopPropagation();if(!box)return;show(box,true);img(find(box,'Content/SkillTitle/SkillIcon'),c.assetSrc(sk.icon));text(find(box,'Content/SkillTitle/TextName'),sk.name,false);
    text(find(box,'Content/TextDesc'),(it.active===false&&it.unlockStar?`<color=#e1450e>Mở khóa khi đạt ${it.unlockStar} sao </color>\n`:'')+sk.description);
    const content=find(box,'Content');Object.assign(content.style,{height:'auto',minHeight:'134px'});const td=find(box,'Content/TextDesc');Object.assign(td.style,{position:'relative',height:'auto',top:'84px',left:'18px'})}});
  if(box)box.onclick=()=>show(box,false);
 }
 const unlockStar=slot=>data.upgrade.stars.find(r=>r.unlockSkill===slot)?.star;

 // ---- Khung màn hình
 function push(el,refresh){el.classList.add('pet-screen');layer().appendChild(el);const entry={el,refresh};stack.push(entry);return entry}
 function pop(){const e=stack.pop();e?.el.remove();e?.cleanup?.();stack.at(-1)?.refresh?.()}
 function closeAll(){while(stack.length)pop();for(const p of document.querySelectorAll('.pet-popup'))p.remove()}
 const refreshTop=()=>stack.at(-1)?.refresh?.();
 async function act(url,body,options={}){const r=await c.mutation(url,body,{close:false,render:false,bonus:false,message:false,...options});if(r)refreshTop();return r}
 const onBtn=(el,path,fn)=>{const b=find(el,path);if(b)b.onclick=e=>{e.stopPropagation();fn(e)}};
 const helpText={1:'Thú cưng sống ở Đảo Hoang và Biển Sâu. Chiêu mộ bằng La Bàn (mỗi ngày 1 lần miễn phí) để nhận mảnh, đủ mảnh thì triệu hồi ở Thư viện.',2:'Chạm thú cưng trên bản đồ để xem. Thú cưng mạnh nhất của mỗi loài sẽ đi dạo ở khu vực của mình.',3:'Mỗi lần chiêu mộ nhận mảnh thú cưng, Exp thú cưng hoặc may mắn nhận cả thú cưng.'};

 // ---- SRMain
 function openSR(){
  const el=render('SRMain');push(el);
  onBtn(el,'Content/Header/AnchorTopLeft/ButtonClose',closeAll);
  onBtn(el,'Content/Body/Content/PetPanel',openHome);
  onBtn(el,'Content/Body/Content/SilentRingPanel',()=>srLoad().then(openSRStart));
 }
 // ---- PetHome
 // Area1/Area2 trong prefab có kích thước 0 (Unity tự dàn bằng VerticalLayoutGroup theo màn hình): chia đôi màn hình như bản gốc,
 // nửa trên Đảo Hoang (chữ ở bên phải), nửa dưới Biển Sâu (chữ ở bên trái).
 function fixHome(){const walk=n=>{if(/^Area[12]$/.test(n.name))n.transform.m_SizeDelta={x:1136,y:320};n.children.forEach(walk)};walk(data.prefabs.PetHome)}
 function openHome(){
  fixHome();const el=render('PetHome');push(el);
  onBtn(el,'Content/Header/AnchorTopLeft/ButtonClose',pop);onBtn(el,'Content/Header/ButtonHelp',()=>c.modal('THÚ CƯNG',`<p class="item-description">${helpText[1]}</p>`));
  onBtn(el,'Content/Main/Content/Area1/Button',()=>openArea(1));onBtn(el,'Content/Main/Content/Area2/Button',()=>openArea(2));
 }
 // ---- PetMain: bản đồ khu vực, thú cưng đi lại (PetGO: đứng 3-6 giây, chạy 200-600 px với tốc loop)
 function openArea(area){
  const el=render('PetMain'),content=find(el,'Content/Main/Scroll View/Viewport/Content'),entry=push(el,()=>pets());
  const bg=render('PMBG'+area,1470,880);Object.assign(bg.style,{left:'0',top:'0'});content.appendChild(bg);
  const vp=find(el,'Content/Main/Scroll View/Viewport');Object.assign(vp.style,{overflow:'hidden'});
  let ox=(1136-1470)/2,oy=(640-880)/2-(area===2?120:0);// Unity anchoredPosition y +120 đẩy nội dung lênconst place=()=>{ox=Math.min(0,Math.max(1136-1470,ox));oy=Math.min(0,Math.max(640-880,oy));Object.assign(content.style,{left:ox+'px',top:oy+'px',width:'1470px',height:'880px'})};place();
  let drag=null;vp.addEventListener('pointerdown',e=>{if(e.target.closest('.pet-go'))return;drag={x:e.clientX,y:e.clientY,ox,oy}});
  const scale=()=>layer().getBoundingClientRect().width/1136;
  window.addEventListener('pointermove',e=>{if(!drag)return;ox=drag.ox+(e.clientX-drag.x)/scale();oy=drag.oy+(e.clientY-drag.y)/scale();place()});window.addEventListener('pointerup',()=>drag=null);
  const walkers=[];let timer=null;
  function pets(){
   for(const w of walkers)w.el.remove();walkers.length=0;
   const best=new Map();for(const p of st().list){const b=base(p.setId);if(b?.generic!==area)continue;const cur=best.get(b.id);if(!cur||power(p)>power(cur))best.set(b.id,p)}
   for(const p of best.values()){const b=base(p.setId),line=find(bg,'Line'+b.line);if(!line||!data.spines['pett_'+b.id])continue;
    const go=render('PetGO',100,100);go.classList.add('pet-go');line.appendChild(go);const x=-600+Math.random()*1200;
    const sk=find(go,'Mesh/SpineObject/Skeleton'),w={el:go,sk,x,target:x,state:'idle',until:performance.now()+3000+Math.random()*3000,speed:b.speed,dir:1,spine:data.spines['pett_'+b.id]};
    Object.assign(go.style,{left:(x-50)+'px',top:'-50px'});spineOn(sk,data.spines['pett_'+b.id],'idling',{size:500});walkers.push(w);
    find(go,'ClickArea').onclick=e=>{e.stopPropagation();openInventory(area,p.uid)}}
  }
  function tick(){if(!el.isConnected)return;const now=performance.now();
   for(const w of walkers){
    if(w.state==='idle'&&now>=w.until){const left=Math.abs(w.x+600)>=200,right=Math.abs(600-w.x)>=200,goLeft=left&&(!right||Math.random()<.5);
     w.target=goLeft?Math.max(-600,w.x-600)+Math.random()*(w.x-200-Math.max(-600,w.x-600)):w.x+200+Math.random()*(Math.min(600,w.x+600)-w.x-200);w.dir=goLeft?-1:1;w.state='run';w.from=w.x;w.start=now;w.dur=Math.abs(w.target-w.x)/w.speed*1000;
     spineOn(w.sk,w.spine,'run',{size:500});w.el.style.transform=`scaleX(${w.dir})`}
    else if(w.state==='run'){const t=Math.min(1,(now-w.start)/w.dur);w.x=w.from+(w.target-w.from)*t;w.el.style.left=(w.x-50)+'px';if(t>=1){w.state='idle';w.until=now+3000+Math.random()*3000;spineOn(w.sk,w.spine,'idling',{size:500})}}
   }timer=requestAnimationFrame(tick)}
  pets();timer=requestAnimationFrame(tick);entry.cleanup=()=>cancelAnimationFrame(timer);
  onBtn(el,'Content/AnchorTopLeft/ButtonClose',pop);onBtn(el,'Content/BackBtn',closeAll);onBtn(el,'Content/ButtonHelp',()=>c.modal('THÚ CƯNG',`<p class="item-description">${helpText[2]}</p>`));
  onBtn(el,'Content/Right/Group/SummonBtn',()=>openSummon(area));onBtn(el,'Content/Right/Group/InventoryBtn',()=>openInventory(area));onBtn(el,'Content/Right/Group/LibraryBtn',()=>openLibrary(area));
 }
 // ---- PetSummon
 function openSummon(area){
  const el=render('PetSummon');let clock=null;
  const fill=()=>{text(find(el,'Content/Header/FieldResources/TextLB'),c.num(have(data.items.summon)),false);
   for(const p of ['Content/Header/FieldResources/IconLB','Content/Main/ButtonSummon/IconScroll','Content/Main/ButtonSummon10/IconScroll'])imgContain(find(el,p),itemSrc(data.items.summon));
   const end=Date.now()+st().freeIn;clearInterval(clock);const tickClock=()=>{const left=Math.max(0,end-Date.now()),free=left<=0;show(find(el,'Content/Main/ButtonSummonFree'),free);show(find(el,'Content/Main/ButtonSummon'),!free);show(find(el,'Content/Main/ImageCount'),!free);
    const s=Math.ceil(left/1000);text(find(el,'Content/Main/ImageCount/TextCountDown'),[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':'),false);if(free)clearInterval(clock)};tickClock();clock=setInterval(tickClock,1000)};
  const entry=push(el,fill);entry.cleanup=()=>clearInterval(clock);fill();
  onBtn(el,'Content/Header/AnchorTopLeft/ButtonClose',pop);onBtn(el,'Content/Header/ButtonHelp',()=>c.modal('CHIÊU MỘ',`<p class="item-description">${helpText[3]}</p>`));
  const recruit=async amount=>{const r=await act('/api/pet/recruit',{amount});if(r)bonusPopup(r.result.results)};
  onBtn(el,'Content/Main/ButtonSummonFree',()=>recruit(-1));onBtn(el,'Content/Main/ButtonSummon',()=>recruit(1));onBtn(el,'Content/Main/ButtonSummon10',()=>recruit(10));
 }
 // ---- PopupShowBonusEffectPet: mảnh (PetHeadUI2 + số mảnh), cả con (mở PopupSummonPet), vật phẩm
 function bonusPopup(results){
  const el=render('PopupShowBonusEffectPet');el.classList.add('pet-popup');layer().appendChild(el);const box=find(el,'Body/Container');box.innerHTML='';
  const close=find(el,'ButtonClose');show(close,false);const cols=Math.min(5,results.length),cw=92,gap=30;
  const tiles=results.map((r,i)=>{let t;
   if(r.type===3){t=document.createElement('div');t.className='pet-item';t.innerHTML=`<span style="background-image:url('${itemSrc(r.reward.itemId)}')"></span><b>${c.short(r.reward.quantity)}</b>`}
   else{t=render('PetHeadUI2',92,92);head(t,base(r.setId),null,{shard:r.type===1?r.amount:null})}
   Object.assign(t.style,{position:'absolute',left:((800-(cols*(cw+gap)-gap))/2+(i%cols)*(cw+gap))+'px',top:(Math.floor(i/cols)*(cw+gap)+20)+'px',transform:'scale(0)',transition:'transform .3s cubic-bezier(.3,1.6,.5,1)'});box.appendChild(t);return t});
  box.style.height=(Math.ceil(results.length/cols)*(cw+gap)+20)+'px';
  (async()=>{for(let i=0;i<tiles.length;i++){tiles[i].style.transform='scale(1)';await new Promise(r=>setTimeout(r,200));if(results[i].type===2)await summonPopup(base(results[i].setId))}show(close,true)})();
  close.onclick=()=>{el.remove();refreshTop()};
 }
 // ---- PopupSummonPet
 function summonPopup(b){
  return new Promise(resolve=>{const el=render('PopupSummonPet');el.classList.add('pet-popup');layer().appendChild(el);petBox(find(el,'PetBox'),b,0);
   const done=()=>{el.remove();resolve()};find(el,'Bgr').onclick=done;onBtn(el,'Bgr/ButtonBack',done)});
 }
 // ---- PetLibrary
 function openLibrary(area){
  const el=render('PetLibrary');let tab=-1,selected=null;
  const list=()=>data.pets.filter(p=>p.generic===area&&(tab===-1||p.class===tab));
  function fill(){
   const content=find(el,'Content/Main/ListPetScroll/Scroll View/Viewport/Content');content.innerHTML='';const pets=list();
   pets.forEach((b,i)=>{const h=render('PetHeadUI2',92,92);head(h,b,null,{amount:true,check:selected===b.id});Object.assign(h.style,{left:(4+(i%2)*95)+'px',top:(4+Math.floor(i/2)*105)+'px'});h.onclick=()=>{selected=b.id;fill()};content.appendChild(h)});
   content.style.height=(Math.ceil(pets.length/2)*105+10)+'px';
   for(const [i,n] of [[1,'TabSword'],[2,'TabHeart'],[3,'TabLightning']]){const t=find(el,'Content/Main/ListPetScroll/Tabs/'+n);show(find(t,'ImageOn'),tab===i);show(find(t,'ImageOff'),tab!==i);t.onclick=()=>{tab=tab===i?-1:i;selected=null;fill()}}
   if(!pets.some(p=>p.id===selected))selected=pets[0]?.id??null;
   show(find(el,'Content/Main/PetBox'),!!selected);show(find(el,'Content/Main/InfoPanel'),!!selected);if(!selected)return;
   const b=base(selected),info=find(el,'Content/Main/InfoPanel');petBox(find(el,'Content/Main/PetBox'),b,0);
   const g=find(info,'StatInfo/Frame1/GroupTextStat');
   const rows=[['TextGrowthCaption','●Trưởng thành',b.intelligent],['TextAttackCaption','   ◆Công cơ bản:',b.basic.atk],['TextArmorCaption','   ◆Thủ cơ bản:',b.basic.def],['TextHealthCaption','   ◆Máu cơ bản:',b.basic.hp],['TextSpeedCaption','   ◆Tốc cơ bản:',b.basic.spd]];
   // Ghi vào ô giá trị gốc của prefab (TextGrowth / TextAttack / TextArmor / TextHealth / TextSpeed), như PetLibrary.SetInfoPanel.
   const valueNode={TextGrowthCaption:'TextGrowth',TextAttackCaption:'TextAttack',TextArmorCaption:'TextArmor',TextHealthCaption:'TextHealth',TextSpeedCaption:'TextSpeed'};
   for(const [n,label,[lo,hi]] of rows)text(find(g,n+'/'+valueNode[n]),`${lo}-${hi}`,false);
   skillButtons(find(info,'StatInfo/Frame2/GroupSkill'),b.passives.filter(x=>x>=0).map(id=>({id,level:0})),find(info,'BoxSkillDesc'));
   text(find(info,'StatInfo/Frame2/Bar/DescInfo'),b.desc,false);text(find(info,'StatInfo/Frame2/Bar2/ReqInfo'),`Thu thập đủ ${b.shardReq} mảnh thú cưng để triệu hồi thú cưng`,false);
   onBtn(info,'SummonBtn',async()=>{if((st().shards[b.id]||0)<b.shardReq)return c.toast('Không đủ mảnh thú cưng.');const r=await act('/api/pet/combine',{setId:b.id});if(r)await summonPopup(b)});
  }
  push(el,fill);fill();onBtn(el,'Content/Header/AnchorTopLeft/ButtonClose',pop);
 }
 // ---- PetInventory (PanelInfo / PanelFoster / PanelAwaken)
 function openInventory(area,selectedUid=null){
  const el=render('PetInventory');let tab=1,foster=1,filter=-1,current=selectedUid,mats={same:[],extra:[]};
  const owned=()=>st().list.filter(p=>base(p.setId).generic===area&&(filter===-1||base(p.setId).class===filter)).sort((a,b)=>power(b)-power(a));
  const main=find(el,'Content/Main'),box=find(main,'BoxInfo'),panes=find(box,'TabContent');
  function fill(){
   const list=owned();if(!list.some(p=>p.uid===current)){current=list[0]?.uid??null;mats={same:[],extra:[]}}
   text(find(main,'FieldGold/TextGold'),c.short(have('gold')),false);text(find(main,'FieldExp/TextExp'),c.num(have(data.items.exp)),false);imgContain(find(main,'FieldExp/IconExp'),itemSrc(data.items.exp));
   const content=find(main,'PanelPetList/Scroll View/Viewport/Content');content.innerHTML='';
   list.forEach((p,i)=>{const h=render('PetHeadUI2',92,92);head(h,base(p.setId),p,{level:true,check:p.uid===current});Object.assign(h.style,{left:(5+i*97)+'px',top:'4px'});h.onclick=()=>{current=p.uid;mats={same:[],extra:[]};fill()};content.appendChild(h)});
   content.style.width=(list.length*97+10)+'px';
   const filterPanel=find(main,'PanelPetList/PanelFilter');[1,2,3].forEach(i=>{const t=find(filterPanel,'TabClass'+i);t.classList.toggle('pet-filter-on',filter===i);t.onclick=e=>{e.stopPropagation();filter=filter===i?-1:i;fill()}});
   const pet=list.find(p=>p.uid===current),idx=list.indexOf(pet);
   for(const n of ['PetBox','BoxInfo'])show(find(main,n),!!pet);show(find(main,'ButtonPrev'),idx>0);show(find(main,'ButtonNext'),pet&&idx<list.length-1);
   onBtn(main,'ButtonPrev',()=>{current=list[idx-1].uid;mats={same:[],extra:[]};fill()});onBtn(main,'ButtonNext',()=>{current=list[idx+1].uid;mats={same:[],extra:[]};fill()});
   for(const [i,n] of [[1,'TabInfo'],[2,'TabAwaken'],[3,'TabEnlight']]){const t=find(box,'Tabs/'+n);show(find(t,'ImageOn'),tab===i);show(find(t,'ImageOff'),tab!==i);t.onclick=()=>{tab=i;fill()}}
   [...panes.children].forEach((p,i)=>show(p,i===tab-1));
   if(!pet)return;const b=base(pet.setId);petBox(find(main,'PetBox'),b,pet.star);
   if(tab===1)infoPanel(find(panes,'PanelInfo'),pet,b);else if(tab===2)fosterPanel(find(panes,'PanelFoster'),pet,b);else awakenPanel(find(panes,'PanelAwaken'),pet,b);
  }
  function infoPanel(p,pet,b){
   text(find(p,'ImagePower/TextPower'),c.num(pet.stats.power),false);text(find(p,'TextLvCaption/TextLv'),`${pet.level}/${pet.maxLevel}`,false);
   text(find(p,'TextLvGrowth/TextLv'),String(pet.growth),false);text(find(p,'TextLvGrowth/GrowthName'),growthNames[pet.growthTier]);
   text(find(p,'BoxPoint/GroupClass/TextClass'),classNames[b.class],false);img(find(p,'BoxPoint/GroupClass/ImageClass'),art('images/'+b.clazz));
   for(const [n,k] of [['PointAttack/TextAttack','atk'],['PointHp/TextHp','hp'],['PointArmor/TextArmor','def'],['PointSpeed/TextSpeed','spd']])text(find(p,'BoxPoint/'+n),c.num(pet.stats[k]),false);
   const atMax=pet.level>=pet.maxLevel;show(find(p,'GroupUpgrade/BoxUpRequire'),!atMax);show(find(p,'GroupUpgrade/BoxUpMaxLevel'),atMax);
   if(!atMax){const row=data.upgrade.levels.find(r=>r.level===pet.level+1);text(find(p,'GroupUpgrade/BoxUpRequire/ImgGold/TextGold'),c.short(row.gold),false);text(find(p,'GroupUpgrade/BoxUpRequire/ImgSpirit/TextSpirit'),c.short(row.exp),false);imgContain(find(p,'GroupUpgrade/BoxUpRequire/ImgSpirit'),itemSrc(data.items.exp))}
   onBtn(p,'GroupUpgrade/BoxUpRequire/ButtonUpLevel',async()=>{const r=await act('/api/pet/level',{uid:pet.uid});if(r)boxFx(find(main,'PetBox'))});
   skillButtons(find(p,'GroupSkill'),pet.skills.map((s,i)=>({...s,unlockStar:unlockStar(i+1)})),find(p,'BoxSkillDesc'));
  }
  function fosterPanel(p,pet,b){
   for(const [i,n] of [[1,'TabGrowth'],[2,'TabErase'],[3,'TabEnlight']]){const t=find(p,'Tabs/'+n);show(find(t,'ImageOn'),foster===i);show(find(t,'ImageOff'),foster!==i);t.onclick=()=>{foster=i;fill()}}
   const fc=find(p,'FosterContent');[...fc.children].forEach((x,i)=>show(x,i===foster-1));const U=data.upgrade;
   const gameItem=(slot,fee)=>{const id='consumable:'+fee[2];slot.innerHTML=`<div class="pet-item pet-item-framed"><i style="background-image:url('${c.assetSrc(c.named('bgr_item_consumable'))}')"></i><span style="background-image:url('${itemSrc(id)}')"></span><i style="background-image:url('${c.assetSrc(c.named('border_item'))}')"></i></div>`;return{id,need:fee[3],own:have(id)}};
   if(foster===1){const g=find(fc,'PanelGrowth');const hh=find(g,'Frame1/PetHeadUI');head(hh,b,pet,{level:true});
    text(find(g,'Frame1/NameBar/NameText'),b.name,false);text(find(g,'Frame1/ImagePower/TextPower'),c.num(pet.stats.power),false);
    text(find(g,'Frame1/GrowthPanel/GrowthText'),String(pet.growth),false);text(find(g,'Frame1/GrowthPanel/GrowthName'),growthNames[pet.growthTier]);
    const bar=find(g,'Frame1/GrowthPanel/GrowthBar/Fill Area/Fill');if(bar)bar.style.width=Math.min(100,(pet.growth-b.intelligent[0])/(b.intelligent[1]-b.intelligent[0])*100)+'%';
    const it=gameItem(find(g,'Frame2/GameItem'),U.fee1);text(find(g,'Frame2/AmountBar/AmountText'),`${it.own}/${it.need}`,false);const af=find(g,'Frame2/AmountBar/Fill Area/Fill');if(af)af.style.width=Math.min(100,it.own/it.need*100)+'%';
    onBtn(g,'GrowthButton',async()=>{if(pet.growthTier>=4&&!await GameMessage.ask('Thú cưng đang ở trang thái trưởng thành cao, thuyền trưởng có muốn hoàn đồng?'))return;const r=await act('/api/pet/growth',{uid:pet.uid});if(r)boxFx(find(main,'PetBox'))})}
   else if(foster===2){const e=find(fc,'PanelErase'),pend=pet.pending,diff=(k,v)=>{const d=Math.round((pend[k]-pet.basic[k])*10)/10;return `${pend[k]}<color=${d>=0?'#B7EB6CFF':'#DB6A62FF'}>(${d>=0?'+':''}${d})</color>/${b.basic[k][1]}`};
    for(const [n,k,v] of [['TextAttackCaption','atk','TextAttack'],['TextArmorCaption','def','TextArmor'],['TextHealthCaption','hp','TextHealth'],['TextSpeedCaption','spd','TextSpeed']])text(find(e,'GroupTextStat/'+n+'/'+v),pend?diff(k):`${pet.basic[k]}/${b.basic[k][1]}`);
    const it=gameItem(find(e,'Frame/GameItem'),U.fee2);text(find(e,'Frame/AmountText'),`<color=${it.own<it.need?'#FF0000FF':'#00FF00FF'}>${it.own}/${it.need}</color>`);
    show(find(e,'GroupBtn/ChangeButton'),!!pend);onBtn(e,'GroupBtn/ChangeButton',()=>act('/api/pet/erase',{uid:pet.uid,mode:1}));onBtn(e,'GroupBtn/ResetButton',async()=>{const r=await act('/api/pet/erase',{uid:pet.uid,mode:0});if(r)boxFx(find(main,'PetBox'))})}
   else{const e=find(fc,'PanelEnlight'),cur=U.tiers.find(t=>t.level===pet.tier),next=U.tiers.find(t=>t.level===pet.tier+1);show(find(e,'FrameUpgrade'),!!next);show(find(e,'FrameMax'),!next);
    if(next){const pct=v=>Math.round(v*10)/10,cd=cur.scaleBasic>1000?`(+${pct((cur.scaleBasic-1000)/10)}%)`:'';
     for(const [n,k] of [['TextAttackCaption/TextAttack','atk'],['TextArmorCaption/TextArmor','def'],['TextHealthCaption/TextHealth','hp'],['TextSpeedCaption/TextSpeed','spd']]){
      text(find(e,`FrameUpgrade/GroupTextStat/${n}1`),pct(pet.basic[k]*cur.scaleBasic/1000)+cd,false);text(find(e,`FrameUpgrade/GroupTextStat/${n}2`),`${pct(pet.basic[k]*next.scaleBasic/1000)}(+${pct((next.scaleBasic-1000)/10)}%)`,false)}
     text(find(e,'FrameUpgrade/TextDesc'),`*Lv${pet.tier}\n*Tỉ lệ thành công ${next.percent/10}% \n*Thất bại giảm xuống Lv${next.lvlBackUp}`,false);
     const it=gameItem(find(e,'FrameUpgrade/GameItem'),U.fee3);text(find(e,'FrameUpgrade/AmountText'),`<color=${it.own<it.need?'#FF0000FF':'#00FF00FF'}>${it.own}/${it.need}</color>`);
     onBtn(e,'FrameUpgrade/UpgradeButton',async()=>{if(pet.tier>=5&&!await GameMessage.ask(`Thất bại giảm xuống Lv${next.lvlBackUp}`))return;const r=await act('/api/pet/enlight',{uid:pet.uid});if(r){c.toast(r.result.message);boxFx(find(main,'PetBox'),r.result.success)}})}}
  }
  function awakenPanel(p,pet,b){
   const req=pet.star<data.upgrade.maxstar?(()=>{const n=data.upgrade.stars.find(r=>r.star===pet.star+1);if(!n)return null;const extra=n.star>=6?[[5,n.star5pet],[6,n.star6pet],[9,n.star9pet],[10,n.star10pet]].find(([,x])=>x>0):null;return{n,same:n.star>=6&&n.samePet!=null?n.samePet:n.shard,extraStar:extra?.[0],extra:extra?.[1]||0}})():null;
   show(find(p,'FrameUpgrade'),!!req);show(find(p,'FrameMax'),!req);if(!req)return;
   const f1=find(p,'FrameUpgrade/Frame1');text(find(f1,'Bar/TextLvCaption/TextLv')||find(f1,'Bar/TextLvCaption'),find(f1,'Bar/TextLvCaption/TextLv')?String(req.n.limitLevel):`Cấp độ tối đa: ${req.n.limitLevel}`,false);
   const unlock=req.n.unlockSkill;text(find(f1,'UnlockSkillText'),unlock?((pet.skills[unlock-1]?.level||0)===0?`Mở kỹ năng thứ ${unlock}`:`Nâng cấp kỹ năng thứ ${unlock}`):'',false);
   stars(find(f1,'UnlockSkillText/HeroStars1'),pet.star);stars(find(f1,'UnlockSkillText/HeroStars2'),pet.star+1);
   const g=find(p,'FrameUpgrade/Frame2/ItemGroup'),h1=find(g,'PetHeadUI'),h2=find(g,'PetHeadUI2'),amt=(el,n,need)=>text(find(el,'AmountText'),`<color=${n<need?'#FF0000FF':'#00FF00FF'}>${n}/${need}</color>`);
   head(h1,b,pet,{level:true});amt(h1,mats.same.length,req.same);h1.onclick=()=>selectPets(pet,mats.same,req.same,null,mats.extra,sel=>{mats.same=sel;fill()});
   show(h2,req.extra>0);if(req.extra>0){head(h2,b,pet);show(find(h2,'Mask/ImageHeadPet'),false);show(find(h2,'Mask/Class'),false);show(find(h2,'Mask/HeroStars'),true);stars(find(h2,'Mask/HeroStars'),req.extraStar);
    const ok=mats.extra.length===req.extra;show(find(h2,'Mask/ImageHidden'),!ok);show(find(h2,'Mask/ImageActive'),ok);show(find(h2,'Add'),!ok);amt(h2,mats.extra.length,req.extra);
    h2.onclick=()=>selectPets(pet,mats.extra,req.extra,req.extraStar,mats.same,sel=>{mats.extra=sel;fill()})}
   const it=find(g,'PetAwakenItem'),gi=find(it,'GameItem');show(gi,false);it.querySelector('.pet-item')?.remove();it.insertAdjacentHTML('afterbegin',`<div class="pet-item pet-item-framed"><i style="background-image:url('${c.assetSrc(c.named('bgr_item_consumable'))}')"></i><span style="background-image:url('${itemSrc(data.items.awaken)}')"></span><i style="background-image:url('${c.assetSrc(c.named('border_item'))}')"></i></div>`);
   const own=have(data.items.awaken);let t=find(it,'AmountText');if(t)text(t,`<color=${own<req.n.numItem?'#FF0000FF':'#00FF00FF'}>${c.short(own)}/${req.n.numItem}</color>`);
   onBtn(p,'FrameUpgrade/AwakenButton',async()=>{if(mats.same.length<req.same||mats.extra.length<req.extra)return c.toast('Không đủ nguyên liệu');const prev=JSON.parse(JSON.stringify(pet));
    const r=await act('/api/pet/star',{uid:pet.uid,same:mats.same,extra:mats.extra});if(r){mats={same:[],extra:[]};boxFx(find(main,'PetBox'));const now=st().list.find(x=>x.uid===pet.uid);if(now)starPopup(prev,now)}});
  }
  push(el,fill);fill();
  onBtn(el,'Content/Header/AnchorTopLeft/ButtonClose',pop);onBtn(main,'PanelPetList/ButtonFilter',()=>{const f=find(main,'PanelPetList/PanelFilter');show(f,f.style.display==='none')});
 }
 // ---- PopupSelectPet2: chọn thú cưng nguyên liệu (cùng loại, hoặc đúng số sao)
 function selectPets(pet,selected,max,starReq,other,ok){
  const el=render('PopupSelectPet2');el.classList.add('pet-popup');layer().appendChild(el);let sel=[...selected];
  const list=st().list.filter(x=>x.uid!==pet.uid&&!other.includes(x.uid)&&(starReq!=null?x.star===starReq:x.setId===pet.setId)).sort((a,b)=>power(a)-power(b));
  const content=find(el,'PanelBody/GroupHeroes/BoxHeroes/Scroll View/Viewport/Content');
  const fill=()=>{content.innerHTML='';list.forEach((x,i)=>{const h=render('PetHeadUI2',92,92);head(h,base(x.setId),x,{level:true,check:sel.includes(x.uid)});Object.assign(h.style,{left:(8+(i%5)*112)+'px',top:(6+Math.floor(i/5)*100)+'px'});
   h.onclick=async()=>{if(sel.includes(x.uid))sel=sel.filter(u=>u!==x.uid);else if(sel.length<max){if(x.star>0&&starReq==null&&!await GameMessage.ask('Thú cưng này có phẩm chất cao \n thuyền trưởng có muốn sử dụng để thức tỉnh?'))return;sel.push(x.uid)}else c.toast('Đã đủ nguyên liệu');fill()};content.appendChild(h)});
   content.style.height=(Math.ceil(list.length/5)*100+12)+'px';if(!list.length)content.innerHTML='<p class="pet-empty">Không có thú cưng phù hợp.</p>'};fill();
  onBtn(el,'PanelBody/ButtonClose',()=>el.remove());onBtn(el,'PanelBody/GroupHeroes/ButtonOk',()=>{el.remove();ok(sel)});
 }
 // ---- PopupPetStarUpgrade
 function starPopup(prev,now){
  const el=render('PopupPetStarUpgrade');el.classList.add('pet-popup');layer().appendChild(el);const b=base(now.setId),bp=find(el,'Body/BoxPoint');
  head(find(el,'Body/BoxHead/PetHeadUI1'),b,prev,{level:true});head(find(el,'Body/BoxHead/PetHeadUI2'),b,now,{level:true});
  for(const [n,from,to] of [['TextLevel/TextLevelFrom',prev.maxLevel,null],['TextHp/TextHpFrom',prev.stats.hp,now.stats.hp],['TextAttack/TextAtkFrom',prev.stats.atk,now.stats.atk],['TextArmor/TextArmorFrom',prev.stats.def,now.stats.def],['TextSpeed/TextSpeedFrom',prev.stats.spd,now.stats.spd]]){text(find(bp,n),c.num(from),false);if(to!==null)text(find(bp,n.replace('From','To')),c.num(to),false)}
  text(find(bp,'TextLevel/TextLevelTo'),String(now.maxLevel),false);
  const unlock=data.upgrade.stars.find(r=>r.star===now.star)?.unlockSkill;show(find(el,'Body/BoxSkill'),!!unlock);
  if(unlock){const a=prev.skills[unlock-1],z=now.skills[unlock-1],bs=find(el,'Body/BoxSkill');
   const set=(btn,it,desc)=>{const sk=it&&skillOf(it.id);show(btn,!!sk&&it.level>0);if(!sk)return;for(const n of ['SpriteOn','SpriteOff'])img(find(btn,n),c.assetSrc(sk.icon));text(find(btn,'Image/TextLevel'),String(it.level),false);
    btn.onclick=()=>{show(desc,desc.style.display==='none');img(find(desc,'SkillTitle/SkillIcon'),c.assetSrc(sk.icon));text(find(desc,'SkillTitle/TextName'),sk.name,false);text(find(desc,'TextDesc'),sk.description,false)}};
   set(find(bs,'ButtonSkillFrom'),a,find(bs,'BoxSkillDescFrom'));set(find(bs,'ButtonSkillTo'),z,find(bs,'BoxSkillDescTo'))}
  onBtn(el,'Body/ButtonClose',()=>el.remove());
 }

 // ---- PetEquip ở thông tin tướng (LuaJobAddEquipPet) + PopupPetEquip
 function mountEquip(host,context){
  c=context;load().then(()=>{if(!host.isConnected)return;host.innerHTML='';
   const el=D.render(data.prefabs.PetEquip,150,150,opts());el.classList.add('pet-equip');host.appendChild(el);
   const heroId=c.heroId(),uid=st().equip[heroId],pet=uid&&st().list.find(x=>x.uid===uid),b=pet&&base(pet.setId);
   show(find(el,'Btn/Image'),!pet);show(find(el,'PetName'),!!pet);show(find(el,'PetTag'),!pet);
   const sk=find(el,'SpineObject/Skeleton');show(sk,!!pet);
   if(pet){text(find(el,'PetName/Text'),b.name,false);img(find(el,'PetName/Class'),art('images/'+b.clazz));spineOn(sk,data.spines['pett_'+b.id],'idling',{size:400})}
   find(el,'Btn').onclick=e=>{e.stopPropagation();equipPopup(heroId,uid||-1)}});
 }
 function equipPopup(heroId,current){
  const el=render('PopupPetEquip');el.classList.add('pet-popup');layer().appendChild(el);let tab=4,checked=current;
  const mid=find(el,'Content/LayoutGroup/PopupMid'),content=find(mid,'ScrollView/Viewport/Content');
  const fill=()=>{content.innerHTML='';
   for(const [i,n] of [[1,'ButtonTab1'],[2,'ButtonTab2'],[3,'ButtonTab3'],[4,'ButtonTab0']]){const t=find(mid,'TabFaction/'+n);show(find(t,'ImageOn'),tab===i);show(find(t,'ImageOff'),tab!==i);t.classList.toggle('pet-tab-on',tab===i);t.onclick=()=>{tab=i;fill()}}
   const all=st().list,list=all.filter(p=>tab===4||base(p.setId).class===tab).sort((a,b)=>power(b)-power(a));
   list.forEach((p,i)=>{const h=render('PetHeadUI2',92,92),owner=Object.entries(st().equip).find(([,u])=>u===p.uid)?.[0];head(h,base(p.setId),p,{level:true,check:p.uid===checked,hero:owner||null});
    Object.assign(h.style,{left:(12+(i%5)*112)+'px',top:(8+Math.floor(i/5)*104)+'px'});h.onclick=()=>{checked=checked===p.uid?-1:p.uid;fill()};content.appendChild(h)});
   content.style.height=(Math.ceil(list.length/5)*104+16)+'px';
   if(!list.length){const msg=document.createElement('p');msg.className='pet-empty';msg.textContent=all.length?'Chưa có thú cưng thuộc hệ này.':'Chưa có thú cưng. Hãy triệu hồi hoặc ghép mảnh trong mục Thú cưng.';content.appendChild(msg)}
   find(el,'Content/LayoutGroup/PopupBot/ButtonConfirm').classList.toggle('pet-disabled',!((checked>0||current>0)&&checked!==current))};fill();
  onBtn(el,'Content/LayoutGroup/PopupTop/ButtonClose',()=>el.remove());
  onBtn(el,'Content/LayoutGroup/PopupBot/ButtonConfirm',async()=>{if((checked>0||current>0)&&checked!==current){const r=await c.mutation('/api/pet/equip',{heroId,uid:checked},{close:false});if(!r)return}el.remove()});
 }
 // ======================= Vành Đai Tĩnh Lặng (lua_silentring) =======================
 let sr=null,srLoading=null;
 const srLoad=()=>sr?Promise.resolve(sr):srLoading??=fetch('silent-ring.json').then(r=>r.json()).then(d=>sr=d);
 const srRender=(name,w=W,h=H)=>{const el=D.render(sr.prefabs[name],w,h,opts());mountSpines(el);return el};
 const sv=()=>c.player().silentRing;
 const srArt=k=>sr.art[k]?c.assetSrc(sr.art[k]):'';
 const diffNames=['Dễ','Thường','Khó','Thử thách','Ác mộng'],diffTabs=['Easy','Normal','Hard','Challenge','Extreme'];
 const clock=ms=>{const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),t=[Math.floor(s/3600)%24,Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');return d?`${d} ngày ${t}`:t};
 const fmtM=n=>n>=1e9?(n/1e9).toFixed(n%1e9?1:0)+'B':n>=1e6?(n/1e6).toFixed(n%1e6?1:0)+'M':c.num(n);
 const parseReward=a=>{const out=[];for(let i=0;i+3<a.length;i+=4)out.push({itemId:'consumable:'+a[i+2],quantity:a[i+3]});return out};
 function tile(r,{count=true}={}){const t=document.createElement('div');t.className='pet-item pet-item-framed sr-tile';
  t.innerHTML=`<i style="background-image:url('${c.assetSrc(c.named('bgr_item_consumable'))}')"></i><span style="background-image:url('${itemSrc(r.itemId)}')"></span><i style="background-image:url('${c.assetSrc(c.named('border_item'))}')"></i>${count?`<b>${c.short(r.quantity)}</b>`:''}`;t.title=c.items.get(r.itemId)?.name||'';return t}
 function tiles(host,list,opts){host.innerHTML='';list.forEach((r,i)=>{const t=tile(r,opts);Object.assign(t.style,{left:(i*100+4)+'px',top:'2px'});host.appendChild(t)})}
 let srTimers=[];const srTick=(el,fn)=>{fn();const id=setInterval(()=>{if(!el.isConnected)return clearInterval(id);fn()},1000);srTimers.push(id)};
 // ---- SilentRingStart
 function openSRStart(){
  const el=srRender('SilentRingStart'),g=find(el,'Content/Main/Group');let end=0;
  const fill=()=>{const v=sv();end=Date.now()+v.endsIn;
   tiles(find(g,'Banner/ScrollReward/Viewport/Content'),parseReward(sr.diffs[4].seasonReward.at(-1)),{count:false});
   show(find(g,'BoxTime'),v.status===1);show(find(g,'BoxEnd'),v.status===2);
   const claimable=!!v.lastReward||v.status===2&&!v.seasonClaimed;
   show(find(g,'NextButton'),v.status===1);show(find(g,'ReceiveButton'),v.status===2&&claimable);show(find(g,'ButtonReceived'),v.status===2&&!claimable);
   show(find(g,'CheckBtn'),v.status===1&&!v.heroes.length);show(find(g,'AchBtn/Notify'),v.notify)};
  push(el,fill);fill();srTick(el,()=>text(find(g,'BoxTime/TextValue'),clock(end-Date.now()),false));
  onBtn(el,'Content/Header/AnchorTopLeft/ButtonClose',pop);
  onBtn(el,'Content/Header/ButtonHelp',()=>c.modal('VÀNH ĐAI TĨNH LẶNG',`<p class="item-description">Báo danh tối đa 90 thuyền viên (cấp ${50}+). Mỗi độ khó cần đánh 2 hộ vệ trước, máu hộ vệ còn càng ít thì kỹ năng đặc biệt của Lord of the Coast càng yếu. Mỗi ngày 5 lượt đánh boss, mỗi thuyền viên đánh 1 lần mỗi ngày. Sát thương mỗi trận nhận Thưởng boss, tổng sát thương cả mùa nhận Thưởng mùa khi mùa kết thúc.</p>`));
  onBtn(g,'NextButton',()=>{if(!sv().heroes.length)return c.toast('Bạn cần báo danh Thuyền viên mới có thể tiến hành khiêu chiến!');openSRHome(1)});
  onBtn(g,'ReceiveButton',()=>seasonPopup());onBtn(g,'AchBtn',achPopup);onBtn(g,'RewBtn',()=>seasonPopup());onBtn(g,'CheckBtn',()=>heroPicker('checkin'));
  // Mùa trước chưa nhận Thưởng mùa: nhận ngay khi vào (SilentRingStart gọi GetSRLastReward).
  if(sv().lastReward&&sv().status===1)act('/api/sr/season',{},{bonus:true});
 }
 // ---- SilentRingHome
 function openSRHome(diff){
  const el=srRender('SilentRingHome'),main=find(el,'Content/Main');let tab=diff,end=0;
  const fill=()=>{const v=sv();end=Date.now()+v.endsIn;text(find(el,'Content/Header/FieldResources/TextNumber'),`${v.turns}/${v.maxTurns}`,false);
   diffTabs.forEach((n,i)=>{const t=find(main,'DiffView/Viewport/Content/'+n);show(find(t,'DefeatIcon'),v.bossHp[i]<=0);t.classList.toggle('sr-tab-on',tab===i+1);t.onclick=()=>{tab=i+1;fill()}});
   const cur=v.bossHp[tab-1],max=v.bossMax[tab-1],bv=find(main,'BossView'),fillEl=find(bv,'BossHealthBar/Fill Area/Fill');
   text(find(bv,'BossName/BossNameText'),sr.units['30000'].name+` (${diffNames[tab-1]})`,false);text(find(bv,'BossHealthBar/TextProgress'),Math.floor(cur/max*100)+'%',false);if(fillEl)fillEl.style.width=(cur/max*100)+'%';
   // InfoText là HorizontalLayoutGroup co theo chữ (ContentSizeFitter): dàn bằng flex theo độ rộng chữ thật.
   {const it=[...bv.children].filter(x=>x.dataset.name==='InfoText').pop();it.classList.add('sr-inline')}
   show(find(bv,'InfoText/TextTitle'),cur>0);show(find(bv,'InfoText/TextTitle2'),cur<=0);show(find(main,'NextButton/Hide'),cur<=0)};
  push(el,fill);fill();srTick(el,()=>text(main.querySelector('.sr-inline [data-name="TextValue"]'),clock(end-Date.now()),false));
  onBtn(el,'Content/Header/AnchorTopLeft/ButtonClose',pop);onBtn(el,'Content/Header/ButtonHelp',()=>c.modal('LORD OF THE COAST','<p class="item-description">Chọn độ khó rồi khiêu chiến. Máu boss dùng chung cả mùa; boss bị hạ thì Thưởng mùa của độ khó đó được nhân đôi.</p>'));
  onBtn(main,'NextButton',()=>{if(sv().bossHp[tab-1]<=0)return c.toast('Boss đã bị đánh bại.');openSRMatch(tab)});onBtn(main,'RewBtn',()=>bossRewardPopup(tab));
 }
 // ---- SilentRingMatch: hộ vệ 1, hộ vệ 2, boss
 function openSRMatch(diff,startTab=null){
  const el=srRender('SilentRingMatch'),main=find(el,'Content/Main');let tab=startTab||Math.min(3,sv().slot[diff-1]+1);
  const fill=()=>{const v=sv(),real=v.slot[diff-1]+1,d=sr.diffs[diff-1];text(find(el,'Content/Header/FieldResources/TextNumber'),`${v.turns}/${v.maxTurns}`,false);
   ['Easy','Normal','Hard'].forEach((n,i)=>{const t=find(main,'DiffView/Viewport/Content/'+n);show(find(t,'DefeatIcon'),i<2?real>i+1:v.bossHp[diff-1]<=0);t.classList.toggle('sr-tab-on',tab===i+1);t.onclick=()=>{tab=i+1;fill()}});
   const bv=find(main,'BossView'),src=tab===3?d.boss:d.guards[tab-1],unit=sr.units[sr.monsters[src.monsterId]];
   img(find(bv,'BossImage'),srArt(tab===3?'splash-boss':'splash-miniboss'+tab));text(find(bv,'BossName/BossNameText'),unit.name,false);
   const pct=tab===3?Math.floor(v.bossHp[diff-1]/v.bossMax[diff-1]*100):v.guardHp[diff-1][tab-1];text(find(bv,'BossHealthBar/TextProgress'),pct+'%',false);const f=find(bv,'BossHealthBar/Fill Area/Fill');if(f)f.style.width=pct+'%';
   show(find(main,'NextButton/Hide'),real!==tab||tab===3&&v.bossHp[diff-1]<=0);
   const box=find(main,'BoxSkillDesc'),box2=find(main,'BoxSkillDesc2');show(box,false);show(box2,false);
   const ms=find(main,'BoxMonsterSkill');[...ms.children].forEach((b,i)=>{const sk=unit.skills[i];show(b,!!sk);if(!sk)return;for(const n of ['SpriteOn','SpriteOff'])img(find(b,n),c.assetSrc(sk.icon));b.onclick=e=>{e.stopPropagation();descBox(box,sk)}});
   const bs=find(main,'BoxBossSkill');show(bs,tab===3);if(tab===3)v.bossSkills[diff-1].forEach((sk,i)=>{const b=find(bs,'BtnSkill_'+(i+1));if(!b)return;for(const n of ['SpriteOn','SpriteOff'])img(find(b,n),c.assetSrc(sk.icon));text(find(b,'TagNum/TagNumText'),String(sk.level),false);b.onclick=e=>{e.stopPropagation();descBox(box2,sk)}})};
  push(el,fill);fill();
  onBtn(el,'Content/Header/AnchorTopLeft/ButtonClose',pop);onBtn(el,'Content/Header/ButtonHelp',()=>c.modal('HỘ VỆ','<p class="item-description">Với mỗi 20% máu bị mất, các hộ vệ làm giảm 1 cấp kỹ năng đặc biệt của Lord of the Coast. Mỗi hộ vệ chỉ khiêu chiến 1 lần mỗi mùa.</p>'));
  onBtn(main,'NextButton',()=>{const real=sv().slot[diff-1]+1;
   if(real<3&&tab===3)return c.toast('Cần tấn công hai hộ vệ trước');if(real<3&&real!==tab)return c.toast('Cần tấn công hộ vệ '+real);if(real===3&&tab!==3)return c.toast('Đã tấn công 2 hộ vệ');
   if(sv().bossHp[diff-1]<=0)return c.toast('Boss đã bị đánh bại.');heroPicker('attack',{diff,target:tab})});
 }
 function descBox(box,sk){if(!box)return;show(box,true);img(find(box,'Content/SkillTitle/SkillIcon'),c.assetSrc(sk.icon));text(find(box,'Content/SkillTitle/TextName'),sk.name+(sk.level!=null?` [${sk.level}]`:''),false);
  const td=find(box,'Content/TextDesc');text(td,sk.description,false);Object.assign(find(box,'Content').style,{height:'auto',minHeight:'134px'});Object.assign(td.style,{position:'relative',height:'auto',top:'84px',left:'18px',width:'343px'});box.onclick=()=>show(box,false)}
 // ---- SilentRingPopupCheckIn: báo danh (tối đa 90, cấp ≥ 50, Chọn nhanh) hoặc chọn đội đánh (tối đa 6 thuyền viên đã báo danh, chưa đánh hôm nay)
 function heroPicker(mode,target=null){
  const el=srRender('SilentRingPopupCheckIn');el.classList.add('pet-popup');layer().appendChild(el);const v=sv(),attack=mode==='attack',max=attack?6:90;
  let tab=0,sel=attack?[]:[...v.heroes];const factions={1:'light',2:'shadow',3:'abyss',4:'forest',5:'dark',6:'fortress'};
  text(find(el,'Content/LayoutGroup/PopupTop/TextTitle'),attack?'Đội hình tấn công':'Chọn thuyền viên',false);
  show(find(el,'Content/LayoutGroup/PopupBot/ButtonQuick'),!attack);if(attack)text(find(el,'Content/LayoutGroup/PopupBot/ButtonConfirm/Text'),'Tấn công',false);
  const pool=()=>c.player().heroes.filter(h=>h.level>=50&&(!attack||v.heroes.includes(h.id))).sort((a,b)=>(b.stats?.power||0)-(a.stats?.power||0));
  const grid=find(el,'Content/LayoutGroup/PopupMid/ScrollView/Viewport/Content');
  const fill=()=>{grid.innerHTML='';
   for(let i=0;i<=6;i++){const t=find(el,'Content/LayoutGroup/PopupMid/TabFaction/ButtonTab'+i);if(!t)continue;show(find(t,'ImageOn'),tab===i);show(find(t,'ImageOff'),tab!==i);t.onclick=()=>{tab=i;fill()}}
   const list=pool().filter(h=>!tab||c.catalog.heroes.find(d=>d.id===h.id)?.faction===factions[tab]);
   list.forEach((h,i)=>{const def=c.catalog.heroes.find(d=>d.id===h.id),used=attack&&v.used.includes(h.id),b=document.createElement('button');b.className='sr-pick'+(sel.includes(h.id)?' on':'')+(used?' used':'');
    Object.assign(b.style,{left:(10+(i%5)*110)+'px',top:(8+Math.floor(i/5)*106)+'px'});b.innerHTML=`${c.img(def.visual.head,'sr-pick-head',def.name)}${c.img(c.named('hero_head_border'),'sr-pick-border')}${c.img(c.named('faction_'+def.faction),'sr-pick-faction')}<b>${h.level}</b><span class="sr-pick-stars">${window.heroStarsHtml(h.stars)}</span>`;
    b.onclick=()=>{if(used)return c.toast('Thuyền viên đã tham chiến hôm nay.');if(sel.includes(h.id))sel=sel.filter(x=>x!==h.id);else if(sel.length<max)sel.push(h.id);else return c.toast(attack?'Đội hình tối đa 6 thuyền viên':'Đã đủ 90 Thuyền viên');fill()};grid.appendChild(b)});
   grid.style.height=(Math.ceil(list.length/5)*106+16)+'px';if(!list.length)grid.innerHTML=`<p class="pet-empty">${attack?'Chưa có thuyền viên báo danh khả dụng.':'Cần thuyền viên cấp 50 trở lên.'}</p>`};fill();
  onBtn(el,'Content/LayoutGroup/PopupTop/ButtonClose',()=>el.remove());
  onBtn(el,'Content/LayoutGroup/PopupBot/ButtonQuick',()=>{sel=pool().slice(0,90).map(h=>h.id);fill()});
  onBtn(el,'Content/LayoutGroup/PopupBot/ButtonConfirm',async()=>{if(!sel.length)return c.toast('Vui lòng chọn Thuyền viên');
   if(attack){el.remove();closeAll();await c.srBattle({diff:target.diff,target:target.target,formation:Array.from({length:6},(_,i)=>sel[i]||null)});return}
   if(sel.length<90&&!await GameMessage.ask('Chưa đủ 90 Thuyền viên, bạn có thể không tận dụng tối đa lực lượng chiến đấu'))return;
   const r=await act('/api/sr/checkin',{heroes:sel},{message:true});if(r)el.remove()});
 }
 // ---- SilentRingPopupAchievement
 function achPopup(){
  const el=srRender('SilentRingPopupAchievement');el.classList.add('pet-popup');layer().appendChild(el);const content=find(el,'Content/ImgMain/Scroll View/Viewport/Content');
  const fill=()=>{content.innerHTML='';sv().achievements.forEach((a,i)=>{const row=srRender('SilentRingAchItem',850,100);Object.assign(row.style,{left:'25px',top:(i*110+10)+'px'});
   text(find(row,'Title'),a.text,false);text(find(row,'SliderProgress/TextProgress'),`${c.num(a.progress)}/${c.num(a.target)}`,false);const f=find(row,'SliderProgress/Fill Area/Fill');if(f)f.style.width=Math.min(100,a.progress/a.target*100)+'%';
   tiles(find(row,'ScrollReward/Viewport/Content'),a.rewards);show(find(row,'ReceiveBtn'),a.status===1);show(find(row,'ReceivedIcon'),a.status===2);
   onBtn(row,'ReceiveBtn',async()=>{const r=await act('/api/sr/claim',{id:a.id},{bonus:true});if(r)fill()});content.appendChild(row)});content.style.height=(sv().achievements.length*110+20)+'px'};
  fill();onBtn(el,'Content/ImgMain/ButtonClose',()=>{el.remove();refreshTop()});
 }
 // ---- SilentRingRewItem: "Cấp n: ... đạt X" + quà; k = 1 thưởng mùa, 2 thưởng boss
 function rewRows(content,thresholds,rewards,k,{reached=-1,doubled=false}={}){
  content.innerHTML='';thresholds.forEach((dmg,i)=>{const row=srRender('SilentRingRewItem',600,115);Object.assign(row.style,{left:'10px',top:(i*125+10)+'px'});const on=reached===i+1;
   text(find(row,'Title'),`<color=${on?'#319F2A':'#82512A'}>Cấp ${i+1}: ${k===1?'Tổng sát thương gây ra cho [Lord of the Coast] đạt ':'Sát thương 1 lần tấn công [Lord of the Coast] đạt '}</color><color=red>${fmtM(dmg)}</color>`);
   const list=parseReward(rewards[i]).map(r=>({...r,quantity:r.quantity*(doubled?2:1)}));tiles(find(row,'ScrollReward/Viewport/Content'),list);if(k===1)show(find(row,'PanelBlock'),!on);content.appendChild(row)});
  content.style.height=(thresholds.length*125+20)+'px';
 }
 function bossRewardPopup(diff){
  const el=srRender('SilentRingPopupReward');el.classList.add('pet-popup');layer().appendChild(el);const d=sr.diffs[diff-1];
  rewRows(find(el,'Content/ImgMain/Panel1/Scroll View/Viewport/Content'),d.rankDmg,d.reward,2);onBtn(el,'Content/ImgMain/ButtonClose',()=>el.remove());
 }
 function seasonPopup(){
  const el=srRender('SilentRingPopupSeasonReward');el.classList.add('pet-popup');layer().appendChild(el);let tab=1;
  const fill=()=>{const v=sv(),src=v.status===2?{damage:v.damage,defeated:v.bossHp.map(h=>h<=0)}:v.lastReward||{damage:v.damage,defeated:v.bossHp.map(h=>h<=0)},d=sr.diffs[tab-1];
   diffTabs.forEach((n,i)=>{const t=find(el,'Content/ImgMain/Panel1/Scroll View/Viewport/Content/'+n);if(!t)return;t.classList.toggle('sr-tab-on',tab===i+1);t.onclick=()=>{tab=i+1;fill()}});
   rewRows(find(el,'Content/ImgMain/Panel2/Scroll View/Viewport/Content'),d.seasonRankDmg,d.seasonReward,1,{reached:d.seasonRankDmg.filter(t=>src.damage[tab-1]>=t).length,doubled:src.defeated[tab-1]});
   // Như bản gốc: chỉ hiện "Đã nhận" khi mùa đã kết thúc và đã nhận quà.
   const received=v.status===2&&!v.lastReward&&v.seasonClaimed;show(find(el,'Content/ImgMain/ButtonReceive'),!received);show(find(el,'Content/ImgMain/ButtonReceived'),received)};
  fill();onBtn(el,'Content/ImgMain/ButtonClose',()=>{el.remove();refreshTop()});
  onBtn(el,'Content/ImgMain/ButtonReceive',async()=>{if(sv().status===1&&!sv().lastReward)return c.toast('Thưởng mùa nhận sau khi sự kiện kết thúc.');const r=await act('/api/sr/season',{},{bonus:true});if(r)fill()});
 }
 async function openSilent(context,{diff=null,tab=null}={}){c=context;await Promise.all([load(),srLoad()]);closeAll();openSR();openSRStart();if(diff){openSRHome(diff);openSRMatch(diff,tab)}}
 async function open(context){c=context;await Promise.all([load(),srLoad()]);closeAll();openSR()}
 window.PetUI={open,openSilent,load,mountEquip,close:closeAll,isOpen:()=>stack.length>0,refresh:refreshTop};
})();
