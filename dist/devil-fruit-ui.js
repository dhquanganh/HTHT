/* Trái Ác Quỷ (FFMain / FFRoot của lua_forbiddenfruit): dựng nguyên prefab gốc bằng PrefabDOM rồi đổ dữ liệu theo
 * đúng các lớp Lua gốc: FFFruitList / FFFruitGroup / FFFruitInfo / FFCard / FFStarGroup / FFUpgrade / FFPanelWheel /
 * FFPopupHeroView / FFPopupCheckIn / FFTotalInfo / FFSetInfo / FFFruitView / FFPopupSummon / FFPopupShowBonusEffectFruit.
 * Số liệu hiển thị tính như FFDataItem.CalculateScale: cơ bản × (1 + 0,05 × cấp) × hệ số bộ, đặc biệt × scalestar[sao].
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,root=null,state={tab:1,selected:{1:null,2:null,3:null},wheel:1,spinning:false};
 const W=1136,H=640,GREEN='#B1F144';
 const fruitById=id=>data.fruits.find(f=>f.id===id);
 const setOfFruit=id=>data.sets.find(s=>s.fruits.includes(id));
 const fruitsState=()=>c.player().devilFruit||{owned:{},shards:{},slots:3,heroes:[],history:{1:[],2:[]},maxSlots:50};
 const owned=id=>fruitsState().owned[id];
 const realRank=r=>r===4?3:r;
 const shardsFor=rank=>data.config.shard.find(s=>s.rank===rank)?.amount??9999;
 const art=key=>data.art[key]?c.assetSrc(data.art[key]):'';
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets(),onSkeleton:(el,comp)=>{el._skeleton=comp}});
 const render=(name,w=W,h=H)=>D.render(data.prefabs[name],w,h,opts());
 const find=(el,path)=>D.find(el,path),show=D.show,text=D.setText;
 const img=(el,src)=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();el.style.backgroundImage=src?`url('${src}')`:'none';el.style.backgroundSize=el.style.backgroundSize||'100% 100%'};
 const layer=()=>document.querySelector('#game-layer');

 // ---- Công thức (FFDataItem)
 function setScale(set){
  if(!set)return{scale:1,steps:0};const st=fruitsState(),stars=set.fruits.map(id=>st.owned[id]?.star??-1);let add=0,steps=0;
  [2,4,6].forEach((need,i)=>{if(stars.every(x=>x>=need)){add+=set.buff[i];steps++}});return{scale:1+add,steps};
 }
 const scaleOf=(fruit,level,star)=>({base:(1+data.config.scaleupgrade*level)*setScale(setOfFruit(fruit.id)).scale,special:data.config.scalestar[Math.min(star,data.config.scalestar.length-1)]});
 // FFGenPoints.getPointDesc: giá trị / hệ số chia (10 với chỉ số %), làm tròn 1 chữ số thập phân.
 const pointInfo=(id,value)=>{const p=data.points[String(id)]||{text:'{0} ?',attribute:'?',div:1,percent:false};const v=Math.round(value/p.div*10)/10;return{...p,value:v}};
 const csNumber=v=>Number.isInteger(v)?String(v):String(v).replace('.',',');// C# vi-VN: dấu phẩy thập phân
 const basicLine=(id,value)=>{const p=pointInfo(id,value);return`${p.attribute.replace(/^%\s*/,'% ')}: <color=${GREEN}>${p.value.toFixed(1)}${p.percent?'%':''}</color>`};
 const specialLine=(id,value,color=true)=>{const p=pointInfo(id,value),num=csNumber(p.value)+(p.percent?'%':'');return p.text.replace(p.percent?'{0}%':'{0}',color?`<color=${GREEN}>${num}</color>`:num)};
 const maxLevel=()=>data.config.maxupgrade,maxStar=()=>data.config.scalestar.length-1;

 // ---- FFStarGroup: 6 ô, sao 7-12 là lớp StarOn2; setStarUpgrade bật thêm ô đang nâng.
 function stars(group,star,upgrade=false){for(let i=1;i<=6;i++){const s=find(group,'Star'+i);show(find(s,'StarOn'),i<=star);show(find(s,'StarOn2'),i<=star-6)}if(upgrade)group.dataset.upgrade=star}

 // ---- FFCard
 function card(el,f,mode){
  const st=fruitsState(),o=st.owned[f.id],lv=mode===3?maxLevel():o?.level??0,sr=mode===3?maxStar():o?.star??0,current=st.shards[f.id]||0,req=shardsFor(f.rank);
  text(find(el,'LevelText'),'+'+lv);text(find(el,'FruitName'),f.name,false);stars(find(el,'FFStarGroup'),sr);show(find(el,'FFStarGroup'),mode!==3);
  img(find(el,'BG'),art('ui/rank-'+realRank(f.rank)));img(find(el,'FruitIcon'),art('fruitsmall/'+f.id));show(find(el,'Rare'),f.rank>=4);
  show(find(el,'Disable'),!o||mode===3);show(find(el,'Disable/Block'),mode!==3||!o);
  const slider=find(el,'Disable/AmountSlider');show(slider,mode===3);const fill=find(slider,'Fill');if(fill)fill.style.width=Math.min(100,current/req*100)+'%';
  text(find(slider,'AText'),`${current}/${req}`);show(find(el,'Disable/Combine'),current>=req&&!o&&mode===3);
  el.classList.add('ff-card');el.dataset.fruit=f.id;show(find(el,'Selected'),state.selected[mode]===f.id);
 }

 // ---- FFFruitInfo
 function info(panel,f,mode){
  const fi=find(panel,'BG/FruitInfo');if(!f){show(fi,false);return}show(fi,true);
  const o=owned(f.id),lv=mode===3?maxLevel():o?.level??0,sr=mode===3?maxStar():o?.star??0,sc=scaleOf(f,lv,sr),st=fruitsState(),current=st.shards[f.id]||0,req=shardsFor(f.rank);
  img(find(fi,'FruitIcon'),art('fruitlarge/'+f.id));show(find(fi,'Rare'),f.rank>=4);stars(find(fi,'FFStarGroup'),sr);
  text(find(fi,'FruitTitle/Text'),`${f.name} +${lv}`,false);img(find(fi,'Rect/Rank'),c.assetSrc(c.named('hero_quality_'+(realRank(f.rank)+3)))||art('hero_quality_'+(realRank(f.rank)+3)));
  const basics=[...find(fi,'InfoFrameBasic').children];f.base.forEach(([id,v],i)=>{if(basics[i])text(basics[i],basicLine(id,v*sc.base))});
  text(find(fi,'InfoFrame/InfoText'),f.special.map(([id,v])=>specialLine(id,v*sc.special)).join('\n'));
  const lib=mode===3;
  show(find(fi,'BtnCombineDis'),lib&&!o&&current<req);show(find(fi,'BtnCombine'),lib&&!o&&current>=req);show(find(fi,'BtnCombineOff'),lib&&!!o);
  show(find(fi,'BtnStarOff'),!lib&&!!o&&sr>=maxStar());show(find(fi,'BtnStarUp'),!lib&&!!o&&sr<maxStar());show(find(fi,'BtnStarUpOff'),!lib&&!!o&&sr>=maxStar());
  show(find(fi,'BtnUpgradeOff'),!lib&&!!o&&lv>=maxLevel());show(find(fi,'BtnUpgrade'),!lib&&!!o&&lv<maxLevel());
  fi.dataset.fruit=f.id;
 }

 // ---- Tab 1/3 (FFFruitList) và Tab 2 (FFFruitGroup)
 const tabNames={1:'TabFruitList',2:'TabFruitGroup',3:'TabFruitLibrary',4:'TabFruitWheel'};
 function listTab(mode){
  const panel=find(root,'Content/Body/TabContent/'+tabNames[mode]),content=find(panel,'BG/FruitScrollView/Viewport/Content'),st=fruitsState();
  const list=mode===3?data.fruits:data.fruits.filter(f=>st.owned[f.id]);
  content.innerHTML='';const cellW=108,cellH=136,sp=5,cols=4;
  list.forEach((f,i)=>{const el=render('FFCard',cellW,cellH);Object.assign(el.style,{left:(4+(i%cols)*(cellW+sp))+'px',top:(4+Math.floor(i/cols)*(cellH+sp))+'px',width:cellW+'px',height:cellH+'px'});card(el,f,mode);content.appendChild(el)});
  content.style.height=(8+Math.ceil(list.length/cols)*(cellH+sp))+'px';
  const ownedCount=Object.keys(st.owned).length;
  text(find(panel,'BG/TextAmount'),mode===3?`Số lượng: ${data.fruits.length}`:`Số lượng: ${ownedCount}/${data.fruits.length}`,false);
  show(find(panel,'BG/None'),!list.length);show(find(panel,'BG/PowerButton'),mode===1&&list.length>0);
  if(!list.some(f=>f.id===state.selected[mode]))state.selected[mode]=list[0]?.id??null;
  for(const el of content.querySelectorAll('.ff-card'))show(find(el,'Selected'),Number(el.dataset.fruit)===state.selected[mode]);
  info(panel,state.selected[mode]?fruitById(state.selected[mode]):null,mode);
 }
 function groupTab(){
  const panel=find(root,'Content/Body/TabContent/TabFruitGroup'),content=find(panel,'BG/FruitScrollView/Viewport/Content'),st=fruitsState();
  content.innerHTML='';let y=4;
  for(const set of data.sets){
   const name=render('FFSetName',450,50);Object.assign(name.style,{left:'8px',top:y+'px'});text(find(name,'Panel/Text'),set.name,false);find(name,'Button').dataset.set=set.id;find(name,'Button').classList.add('ff-set-info');content.appendChild(name);y+=54;
   const row=render('FFSetContent',450,136);Object.assign(row.style,{left:'8px',top:y+'px'});
   set.fruits.forEach((id,i)=>{const el=find(row,'FFCard'+(i+1));if(el)card(el,fruitById(id),2)});content.appendChild(row);y+=142;
  }
  content.style.height=y+'px';
  const inSet=data.fruits.filter(f=>setOfFruit(f.id));text(find(panel,'BG/TextAmount'),`Số lượng: ${inSet.filter(f=>st.owned[f.id]).length}/${inSet.length}`,false);
  if(!state.selected[2])state.selected[2]=data.sets[0].fruits[0];
  for(const el of content.querySelectorAll('.ff-card'))show(find(el,'Selected'),Number(el.dataset.fruit)===state.selected[2]);
  info(panel,fruitById(state.selected[2]),2);
 }

 // ---- Vòng quay (FFFruitWheel / FFPanelWheel)
 const wheelRows=mode=>mode===1?data.config.summonNormal:data.config.summonSpecial;
 const wheelFee=mode=>mode===1?data.config.feeNormal:data.config.feeSpecial;
 function itemTile(itemId,amount,{fruit=null,need=null}={}){
  const tile=document.createElement('div');tile.className='ff-item';if(!fruit){tile.dataset.infoItem=itemId;tile.dataset.infoQty=amount||1}const item=c.items.get(itemId),src=fruit?art('fruitsmall/'+fruit.id):item?c.assetSrc(item.assetKey):c.rewardArt(itemId);
  tile.innerHTML=`<span class="ff-item-bg" style="background-image:url('${art('bgr_item_consumable')||c.assetSrc(c.named('bgr_item_consumable'))}')"></span><span class="ff-item-icon" style="background-image:url('${src}')"></span><span class="ff-item-border" style="background-image:url('${art('border_item')||c.assetSrc(c.named('border_item'))}')"></span>${need!==null?`<b class="${amount<need?'short':''}">${c.short(amount)}/${c.short(need)}</b>`:amount>1?`<b>${c.short(amount)}</b>`:''}`;
  if(item||fruit)tile.title=fruit?fruit.name:item.name;return tile;
 }
 function wheelPanel(mode){
  const panel=find(root,`Content/Body/TabContent/TabFruitWheel/TabContent/${mode===1?'WheelNormal':'WheelSpecial'}`);if(!panel)return;
  const rows=wheelRows(mode),cells=[...find(panel,'BG/Grid').children];
  rows.forEach((row,i)=>{const cell=cells[i];if(!cell)return;show(find(cell,'GameItem'),false);cell.querySelector('.ff-item')?.remove();
   const tile=row.type===3?itemTile('consumable:'+row.values[2],row.amount):itemTile('consumable:'+row.fakeitem,1);cell.appendChild(tile);text(find(cell,'AmountText'),'',false)});
  const [ticket,per]=wheelFee(mode),ticketItem=c.items.get('consumable:'+ticket),have=c.player().inventory['consumable:'+ticket]||0;
  for(const b of ['BtnRoll1/Icon','BtnRoll10/Icon','TextFieldItem/IconItem'])img(find(panel,b),ticketItem?c.assetSrc(ticketItem.assetKey):'');
  text(find(panel,'BtnRoll1/Icon/Amount'),String(per),false);text(find(panel,'BtnRoll10/Icon/Amount'),String(per*10),false);text(find(panel,'TextFieldItem/TextItem'),c.num(have),false);
  find(panel,'BtnRoll1').dataset.roll=1;find(panel,'BtnRoll10').dataset.roll=10;
  text(find(panel,'BG/Panel/TextView/Viewport/Content/Text'),(fruitsState().history?.[mode]||[]).join('\n'),false);
 }
 function wheelTab(){
  const tab=find(root,'Content/Body/TabContent/TabFruitWheel');
  for(const [i,name] of [[1,'WheelNormal'],[2,'WheelSpecial']]){show(find(tab,'TabContent/'+name),state.wheel===i);const t=find(tab,'TabManager/Tab'+i);show(find(t,'ImageOn'),state.wheel===i)}
  let skip=false;try{skip=localStorage.getItem('KEY_SKIP_FRUIT_WHEEL')==='1'}catch{}show(find(tab,'SkipAnimBox/Checkmark'),skip);
  wheelPanel(state.wheel);
 }
 // Đèn chạy quanh 16 ô rồi dừng ở ô trúng (FFPanelWheel.spinEffect: chạy đều, chậm dần 3 lần, chậm 5 lần).
 async function spin(mode,slot){
  const panel=find(root,`Content/Body/TabContent/TabFruitWheel/TabContent/${mode===1?'WheelNormal':'WheelSpecial'}`),cells=[...find(panel,'BG/Grid').children];
  const light=i=>cells.forEach((cell,k)=>show(find(cell,'MaskSpineBorder'),k===i));
  const r3=4+Math.floor(Math.random()*4),r2=4+Math.floor(Math.random()*4),steps=16+(slot-1-r3-r2+32)%16+r2+r3;let at=(slot-1-steps+16*4)%16;
  for(let i=0;i<steps;i++){at=(at+1)%16;light(at);const left=steps-i;await new Promise(r=>setTimeout(r,left<=r3?500:left<=r3+r2?300:100))}
  light(slot-1);await new Promise(r=>setTimeout(r,400));
 }
 function bonusPopup(results,mode){
  return new Promise(resolve=>{
   const el=render('FFPopupShowBonusEffectFruit');el.classList.add('ff-popup');layer().appendChild(el);const box=find(el,'Body/Container');box.innerHTML='';
   const cw=100,ch=100,sx=46,sy=46,cols=5;let queue=Promise.resolve();
   results.forEach((r,i)=>{const fruit=r.fruitId?fruitById(r.fruitId):null,tile=r.type===3?itemTile(r.reward.itemId,r.reward.quantity):itemTile(null,r.newFruit?1:r.shards,{fruit});
    if(fruit&&!r.newFruit)tile.insertAdjacentHTML('beforeend',`<i class="ff-shard" style="background-image:url('${c.assetSrc(c.named('icon_shard'))}')"></i>`);
    const rowCount=Math.min(cols,results.length-Math.floor(i/cols)*cols),x=(860-(rowCount*(cw+sx)-sx))/2+(i%cols)*(cw+sx),y=(300-(Math.ceil(results.length/cols)*(ch+sy)-sy))/2+Math.floor(i/cols)*(ch+sy);
    Object.assign(tile.style,{left:x+'px',top:y+'px',transform:'scale(0)'});box.appendChild(tile);
    if(fruit)tile.addEventListener('click',()=>fruitView(fruit));
    queue=queue.then(async()=>{tile.style.transition='transform .3s cubic-bezier(.3,1.6,.5,1)';tile.style.transform='scale(1)';await new Promise(r=>setTimeout(r,200));if(r.newFruit)await summonPopup(fruit)})});
   const close=find(el,'ButtonClose');show(close,false);queue.then(()=>show(close,true));
   close.addEventListener('click',()=>{el.remove();resolve()});
  });
 }
 // FFPopupSummon: trái mới quay được, chạm để tiếp tục.
 function summonPopup(f){
  return new Promise(resolve=>{const el=render('FFPopupSummon');el.classList.add('ff-popup');layer().appendChild(el);
   img(find(el,'Bgr/FruitIcon'),art('fruitlarge/'+f.id));text(find(el,'Bgr/Bar/Name'),f.name,false);img(find(el,'Bgr/Bar/RankIcon'),c.assetSrc(c.named('hero_quality_'+(realRank(f.rank)+3)))||art('hero_quality_'+(realRank(f.rank)+3)));
   const fx=find(el,'Bgr/Effect');if(fx?._skeleton){const cv=document.createElement('canvas');cv.width=cv.height=420;cv.className='ff-spine';fx.appendChild(cv);c.spine(cv,{skeleton:fx._skeleton.skeleton,animation:fx._skeleton.animation||'animation'},{loop:true,fit:1})}
   find(el,'Bgr').addEventListener('click',()=>{el.remove();resolve()})});
 }
 // FFFruitView: xem trái (sau khi hợp thành, hoặc chạm trái trong bảng thưởng) kèm các trái cùng bộ.
 function fruitView(f){
  const el=render('FFFruitView');el.classList.add('ff-popup');layer().appendChild(el);
  const o=owned(f.id),lv=o?.level??0,sr=o?.star??0,sc=scaleOf(f,lv,sr),basic=find(el,'Content/Panel/ScrollView/Viewport/Content/GroupBasic');
  img(find(basic,'FruitIcon'),art('fruitlarge/'+f.id));stars(find(basic,'FFStarGroup'),sr);text(find(basic,'FruitTitle/Text'),`${f.name} +${lv}`,false);show(find(basic,'Frame/Rare'),f.rank>=4);
  img(find(basic,'Rect/Rank'),c.assetSrc(c.named('hero_quality_'+(realRank(f.rank)+3))));
  [...find(basic,'InfoFrameBasic').children].forEach((t,i)=>{if(f.base[i])text(t,basicLine(f.base[i][0],f.base[i][1]*sc.base))});
  text(find(basic,'InfoFrame/InfoText'),f.special.map(([id,v])=>specialLine(id,v*sc.special)).join('\n'));
  const set=setOfFruit(f.id),group=find(el,'Content/Panel/ScrollView/Viewport/Content/GroupSet');show(group,!!set);
  if(set){const holder=find(group,'SetFrame'),others=set.fruits.filter(id=>id!==f.id);[...holder.children].forEach((cardEl,i)=>{show(cardEl,!!others[i]);if(others[i])card(cardEl,fruitById(others[i]),1)})}
  find(el,'Content/Panel/ButtonClose').addEventListener('click',()=>el.remove());
 }

 // ---- FFUpgrade (mode 1 cường hóa, mode 2 nâng sao)
 function upgradePopup(f,mode){
  document.querySelector('.ff-upgrade')?.remove();const el=render('FFUpgradePopup');el.classList.add('ff-popup','ff-upgrade');layer().appendChild(el);el.dataset.fruit=f.id;el.dataset.mode=mode;
  fillUpgrade(el);find(el,'Content/ImgMain/ButtonClose').addEventListener('click',()=>el.remove());
 }
 function fillUpgrade(el){
  const f=fruitById(Number(el.dataset.fruit)),mode=Number(el.dataset.mode),o=owned(f.id),lv=o.level,sr=o.star,main=find(el,'Content/ImgMain');
  text(find(main,'Title'),mode===1?'Cường hóa':'Nâng sao',false);text(find(main,'UpgradeBox/BtnUpgrade/Text'),mode===1?'Cường hóa':'Nâng sao',false);
  text(find(main,'Frame/LevelText'),'+'+lv,false);img(find(main,'Frame/FruitIcon'),art('fruitlarge/'+f.id));stars(find(main,'Frame/FFStarGroup'),sr);text(find(main,'Frame/FruitNameTag/Text'),f.name,false);
  img(find(main,'Frame'),art('ui/nang-'+realRank(f.rank)));
  const cur=scaleOf(f,lv,sr),next=scaleOf(f,lv+(mode===1?1:0),sr+(mode===2?1:0)),done=mode===1?lv>=maxLevel():sr>=maxStar();
  show(find(main,'UpgradeBox'),!done);show(find(main,'MaxBox'),done);text(find(main,'MaxBox/MaxText'),mode===1?'Trái ác quỷ đã đạt cấp độ tối đa':I2('HC_TRAI_AC_QUY_DA_DAT_SAO_TOI_DA','Trái ác quỷ đã đạt sao tối đa'),false);
  const box=find(main,'UpgradeBox');
  show(find(box,'UpgradeLevelBox'),mode===1);show(find(box,'FFStarGroupIn'),mode===2);show(find(box,'GroupTextStat'),mode===1);show(find(box,'InfoBox'),mode===1);show(find(box,'InfoBox2'),mode===2);
  text(find(box,'UpgradeLevelBox/TextLevel1'),`${f.name} +${lv}`,false);text(find(box,'UpgradeLevelBox/TextLevel2'),`${f.name} +${lv+1}`,false);
  if(mode===2)stars(find(box,'FFStarGroupIn'),sr+1,true);
  const captions=[['TextAttackCaption','TextAttack'],['TextArmorCaption','TextArmor'],['TextHealthCaption','TextHealth'],['TextSpeedCaption','TextSpeed']];
  f.base.forEach(([id,v],i)=>{const [cap,val]=captions[i]||[];if(!cap)return;const p=pointInfo(id,v),a=pointInfo(id,v*cur.base),b=pointInfo(id,v*next.base);
   text(find(box,`GroupTextStat/${cap}`),p.attribute,false);text(find(box,`GroupTextStat/${cap}/${val}1`),a.value.toFixed(1)+(p.percent?'%':''),false);text(find(box,`GroupTextStat/${cap}/${val}2`),b.value.toFixed(1)+(p.percent?'%':''),false)});
  const now=f.special.map(([id,v])=>specialLine(id,v*cur.special,false)).join('\n');
  text(find(box,'InfoBox/InfoText'),now,false);text(find(box,'InfoBox2/InfoText1'),now,false);text(find(box,'InfoBox2/InfoText2'),f.special.map(([id,v])=>specialLine(id,v*next.special)).join('\n'));
  const costs=find(box,'CostItems');costs.innerHTML='';const inv=c.player().inventory,wallet=c.player().wallet;
  if(!done){
   if(mode===1){const fee=data.config.upgrade.find(u=>u.rank===f.rank).feeupgrade.find(x=>x.level===lv+1);costs.appendChild(itemTile('consumable:'+fee.item[2],inv['consumable:'+fee.item[2]]||0,{need:fee.item[3]}));costs.appendChild(itemTile('gold',wallet.gold,{need:fee.gold[1]}))}
   else{const fee=data.config.awaken.find(a=>a.rank===f.rank).fee.find(x=>x.star===sr+1);if(fee.item[3]>0)costs.appendChild(itemTile('consumable:'+fee.item[2],inv['consumable:'+fee.item[2]]||0,{need:fee.item[3]}));if(fee.sameshard>0){const t=itemTile(null,fruitsState().shards[f.id]||0,{fruit:f,need:fee.sameshard});t.insertAdjacentHTML('beforeend',`<i class="ff-shard" style="background-image:url('${c.assetSrc(c.named('icon_shard'))}')"></i>`);costs.appendChild(t)}}
   const tiles=[...costs.children];tiles.forEach((t,i)=>Object.assign(t.style,{left:(380-(tiles.length*110-18))/2+i*110+'px',top:'4px'}));
  }
 }
 async function playUpgradeFx(el){
  const fx=find(el,'Content/ImgMain/Frame/EffectHeroUp/Spine');if(!fx?._skeleton)return;show(fx,true);fx.querySelector('canvas')?.remove();
  const cv=document.createElement('canvas');cv.width=cv.height=400;cv.className='ff-spine';fx.appendChild(cv);c.spine(cv,{skeleton:fx._skeleton.skeleton,animation:'Cast'},{loop:false,fit:1.2,onEnd:()=>cv.remove()});
 }

 // ---- Popup thông tin bộ / tổng chỉ số
 function setInfoPopup(set){
  const el=render('FFSetInfo');el.classList.add('ff-popup');layer().appendChild(el);const steps=setScale(set).steps;
  ['B1','B2','B3'].forEach((b,i)=>{const line=`[Bộ ${[2,4,6][i]} sao] Thuộc tính cơ bản của quả trong bộ tăng ${Math.round(set.buff[i]*100)}%`;text(find(el,`Content/Panel/Group/${b}/Text`),steps>i?`<color=${GREEN}>${line}</color>`:line)});
  find(el,'Content/Panel/ButtonClose').addEventListener('click',()=>el.remove());
 }
 function totalPopup(){
  const el=render('FFTotalInfo');el.classList.add('ff-popup');layer().appendChild(el);
  const rows=(fruitsState().total||[]).map(([id,v])=>{const p=pointInfo(id,v);return[p.attribute,csNumber(p.value)+(p.percent?'%':'')]});
  text(find(el,'Content/Panel/ScrollView/Viewport/Content/T1'),rows.map(r=>r[0]).join('\n'),false);text(find(el,'Content/Panel/ScrollView/Viewport/Content/T2'),rows.map(r=>r[1]).join('\n'),false);
  find(el,'Content/Panel/ButtonClose').addEventListener('click',()=>el.remove());
 }

 // ---- Tướng cộng hưởng (FFPopupHeroView + FFPopupCheckIn)
 let heroDraft=null;
 function heroView(){
  document.querySelector('.ff-heroes')?.remove();const st=fruitsState(),el=render('FFPopupHeroView');el.classList.add('ff-popup','ff-heroes');layer().appendChild(el);
  heroDraft=Array.from({length:st.slots},(_,i)=>st.heroes?.[i]||null);
  const content=find(el,'Content/LayoutGroup/PopupMid/ScrollView/Viewport/Content'),fill=()=>{content.innerHTML='';
   for(let i=0;i<(st.maxSlots||50);i++){const cell=render('FFHeroViewCell',105,105);Object.assign(cell.style,{left:(5+(i%5)*110)+'px',top:(5+Math.floor(i/5)*110)+'px'});
    const lock=i>=st.slots,hero=heroDraft[i],def=hero&&c.catalog.heroes.find(h=>h.id===hero);show(find(cell,'Mask/Lock'),lock);show(find(cell,'Mask/Plus'),!lock&&!hero);show(find(cell,'Mask/HeroImg'),!lock&&!!def);if(def)img(find(cell,'Mask/HeroImg'),c.assetSrc(def.visual.head));
    cell.dataset.slot=i;cell.classList.add('ff-hero-cell');content.appendChild(cell)}
   content.style.height=(10+Math.ceil((st.maxSlots||50)/5)*110)+'px'};
  fill();el._fill=fill;
  find(el,'Content/LayoutGroup/PopupTop/ButtonClose').addEventListener('click',()=>el.remove());
 }
 function checkIn(slot){
  const el=render('FFPopupCheckIn');el.classList.add('ff-popup','ff-checkin');layer().appendChild(el);let tab=7,chosen=heroDraft[slot];
  const tabs={1:'light',2:'shadow',3:'abyss',4:'forest',5:'dark',6:'fortress'},icons={1:'light',2:'shadow',3:'abyss',4:'forest',5:'dark',6:'fortress'};
  for(let i=1;i<=6;i++){const t=find(el,'Content/LayoutGroup/PopupMid/TabFaction/Tab'+i);if(t&&!t.style.backgroundImage)img(t,c.assetSrc(c.named('faction_'+icons[i])))}
  const grid=find(el,'Content/LayoutGroup/PopupMid/ScrollView/Viewport/Content'),fill=()=>{grid.innerHTML='';
   for(let i=1;i<=7;i++){const t=find(el,'Content/LayoutGroup/PopupMid/TabFaction/Tab'+i);if(t){t.dataset.tab=i;t.classList.toggle('ff-on',i===tab)}}
   const list=c.player().heroes.filter(h=>h.level>=100&&(tab===7||c.catalog.heroes.find(d=>d.id===h.id)?.faction===tabs[tab])&&(!heroDraft.includes(h.id)||h.id===heroDraft[slot]));
   list.forEach((h,i)=>{const def=c.catalog.heroes.find(d=>d.id===h.id);const cell=document.createElement('button');cell.className='ff-pick'+(h.id===chosen?' on':'');cell.dataset.hero=h.id;
    Object.assign(cell.style,{left:(10+(i%6)*106)+'px',top:(8+Math.floor(i/6)*106)+'px'});cell.innerHTML=`${c.img(def.visual.head,'ff-pick-head',def.name)}${c.img(c.named('hero_head_border'),'ff-pick-border')}${c.img(c.named('faction_'+def.faction),'ff-pick-faction')}<b>${h.level}</b><span class="ff-pick-stars">${window.heroStarsHtml(h.stars)}</span>`;grid.appendChild(cell)});
   grid.style.height=(16+Math.ceil(list.length/6)*106)+'px';
   if(!list.length)grid.innerHTML='<p class="ff-empty">Chưa có tướng cấp 100 trở lên.</p>'};
  fill();
  el.addEventListener('click',e=>{const t=e.target.closest('[data-tab]');if(t&&el.contains(t)){tab=Number(t.dataset.tab);fill();return}const p=e.target.closest('.ff-pick');if(p){chosen=chosen===p.dataset.hero?null:p.dataset.hero;fill();return}});
  find(el,'Content/LayoutGroup/PopupTop/ButtonClose').addEventListener('click',()=>el.remove());
  find(el,'Content/LayoutGroup/PopupBot/ButtonConfirm').addEventListener('click',()=>{heroDraft[slot]=chosen||null;el.remove();document.querySelector('.ff-heroes')?._fill?.()});
 }

 // ---- Gốc
 function refresh(){
  if(!root?.isConnected)return;
  for(let i=1;i<=4;i++){show(find(root,'Content/Body/TabContent/'+tabNames[i]),state.tab===i);show(find(root,`Content/Body/TabManager/Tab${i}/ImageOn`),state.tab===i)}
  if(state.tab===1||state.tab===3)listTab(state.tab);else if(state.tab===2)groupTab();else wheelTab();
  const st=fruitsState();show(find(root,'Content/Body/AnchorBottomLeft/ActionButton/Notify'),Array.from({length:st.slots},(_,i)=>st.heroes?.[i]).some(h=>!h)&&c.player().heroes.some(h=>h.level>=100));
  for(const u of document.querySelectorAll('.ff-upgrade'))fillUpgrade(u);
 }
 async function act(url,body){const r=await c.mutation(url,body,{close:false,render:false,bonus:false,message:false});if(r)refresh();return r}
 async function onClick(e){
  const b=e.target.closest('.pd-button,.ff-card,.ff-hero-cell');if(!b||!root)return;const name=b.dataset.name;
  const tab=b.closest('[data-name^="Tab"][data-name$="List"],[data-name="TabFruitGroup"],[data-name="TabFruitLibrary"]');
  if(b.classList.contains('ff-card')&&!b.closest('.ff-popup')){const mode=b.closest('[data-name="TabFruitGroup"]')?2:b.closest('[data-name="TabFruitLibrary"]')?3:1;state.selected[mode]=Number(b.dataset.fruit);refresh();return}
  if(b.classList.contains('ff-hero-cell')){const slot=Number(b.dataset.slot),st=fruitsState();
   if(slot>=st.slots){const fee=st.unlockFee;if(fee===null)return c.toast('Đã mở tối đa ô cộng hưởng.');if(await GameMessage.ask(`Mở khóa tướng cộng hưởng với giá ${fee} kim cương?`,'Mở khóa',{price:fee})){const r=await act('/api/fruit/unlock',{});if(r)heroView()}return}
   checkIn(slot);return}
  if(b.closest('.ff-heroes')&&name==='ButtonConfirm'){const r=await act('/api/fruit/heroes',{heroes:heroDraft});if(r){document.querySelector('.ff-heroes')?.remove();c.toast('Đã lưu tướng cộng hưởng.')}return}
  if(b.closest('.ff-upgrade')&&name==='BtnUpgrade'){const u=b.closest('.ff-upgrade'),mode=Number(u.dataset.mode),r=await act(mode===1?'/api/fruit/level':'/api/fruit/star',{fruitId:Number(u.dataset.fruit)});if(r)playUpgradeFx(u);return}
  if(b.closest('.ff-popup'))return;
  if(name==='ButtonClose'&&b.closest('[data-name="Header"]')){close();return}
  const tabBtn=/^Tab(\d)$/.exec(name);
  if(tabBtn&&b.parentElement?.dataset.name==='TabManager'){if(b.closest('[data-name="TabFruitWheel"]')){state.wheel=Number(tabBtn[1]);wheelTab()}else{state.tab=Number(tabBtn[1]);refresh()}return}
  if(name==='ButtonHelp'){c.help();return}
  if(name==='PowerButton'){totalPopup();return}
  if(name==='ActionButton'){heroView();return}
  if(b.classList.contains('ff-set-info')){setInfoPopup(data.sets.find(s=>s.id===Number(b.dataset.set)));return}
  if(name==='SkipAnimBox'){let on=false;try{on=localStorage.getItem('KEY_SKIP_FRUIT_WHEEL')!=='1';localStorage.setItem('KEY_SKIP_FRUIT_WHEEL',on?'1':'0')}catch{}wheelTab();return}
  if(b.dataset.roll){if(state.spinning)return;state.spinning=true;try{const mode=state.wheel,r=await c.mutation('/api/fruit/roll',{mode,count:Number(b.dataset.roll)},{close:false,render:false,bonus:false,message:false});
   if(r){let skip=false;try{skip=localStorage.getItem('KEY_SKIP_FRUIT_WHEEL')==='1'}catch{}const results=r.result.results;if(!skip)await spin(mode,results[0].slot);refresh();state.spinning=false;bonusPopup(results,mode).then(refresh)}}finally{state.spinning=false}return}
  const fi=b.closest('[data-name="FruitInfo"]'),fruit=fi?fruitById(Number(fi.dataset.fruit)):null;if(!fruit)return;
  if(name==='HowToReceive'){state.tab=4;state.wheel=fruit.rank===3?2:1;refresh();return}
  if(name==='BtnUpgrade')return upgradePopup(fruit,1);
  if(name==='BtnStarUp')return upgradePopup(fruit,2);
  if(name==='BtnUpgradeOff')return c.toast('Trái đã nâng cấp độ tối đa!');
  if(name==='BtnStarUpOff')return c.toast('Trái đã nâng sao tối đa!');
  if(name==='BtnCombineDis')return c.toast('Chưa đủ mảnh để hợp thành!');
  if(name==='BtnCombineOff')return c.toast(I2('HC_TRAI_DA_SO_HUU','Trái đã sở hữu!'));
  if(name==='BtnCombine'){const r=await act('/api/fruit/combine',{fruitId:fruit.id});if(r)fruitView(fruit)}
 }
 function close(){root?.remove();root=null;for(const p of document.querySelectorAll('.ff-popup'))p.remove()}
 async function open(context){
  c=context;await load();
  close();root=render('FFRoot');root.classList.add('ff-root');layer().appendChild(root);
  root.addEventListener('click',onClick);state.tab=1;refresh();
 }
 let loading=null;
 function load(){return data?Promise.resolve(data):loading??=fetch('devil-fruit.json').then(r=>r.json()).then(d=>data=d)}
 document.addEventListener('click',e=>{if(root&&e.target.closest('.ff-popup'))onClick(e)});
 window.DevilFruitUI={open,close,refresh,load,isOpen:()=>!!root};
})();
