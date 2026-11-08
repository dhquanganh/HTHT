/* Ép Sao / Germa (EventEpSao): PanelEpSao, PopupEpSaoUpgradeLevel, PopupEpSaoUpgradeSkill dựng nguyên prefab gốc bằng
 * PrefabDOM, đổ dữ liệu như PanelEpSao.SetVoidStatus / PopupLevelVoid / PopupSkillVoid.
 *   - Nút chỉ số Void{n}: "cấp/tối đa", icon theo UpgradeVoidIconMap; nút sau nút đang mở cuối cùng phủ Shadow + BoderShadow.
 *   - Nút kỹ năng Skill{k}: icon kỹ năng Germa; chưa kích hoạt thì phủ Shadow (ImgLock chỉ khi còn khóa).
 *   - Popup chỉ số: "Hiện tại" / "Tiếp theo" (Công + / Máu + / Tốc +), nút Kích hoạt có giá Nước mắt Mansherry.
 *   - Popup kỹ năng: tên + mô tả kỹ năng cấp 4, nguyên liệu tướng (bản web: mảnh tướng) và Công nghệ Germa.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,loading=null,root=null,host=null;
 const W=1136,H=640;
 const load=()=>data?Promise.resolve(data):loading??=fetch('germa.json').then(r=>r.json()).then(d=>data=d);
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const find=(el,p)=>D.find(el,p),show=D.show,text=D.setText;
 const img=(el,src)=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();el.style.backgroundImage=src?`url('${src}')`:'none';el.style.borderImage='none';el.style.borderWidth='0';el.style.backgroundSize='100% 100%';el.style.backgroundRepeat='no-repeat'};
 const art=name=>data.art[name]?c.assetSrc(data.art[name]):'';
 const hero=()=>c.player().hero;
 const germa=()=>hero().germa;
 const have=id=>id==='diamonds'?c.player().wallet.diamonds:c.player().inventory[id]||0;
 const itemSrc=id=>c.assetSrc(c.items.get(id)?.assetKey);
 const skillsOf=()=>data.heroes[c.avatar()]?.skills||[];
 const indexActive=levels=>{let i=0;for(;i<levels.length;i++)if(levels[i]<=-1)break;return i};// số nút đầu đã mở (1-based: nút <= giá trị này đang mở)
 const buffText=b=>{const out=[];if(b[0]!==undefined)out.push('Công +'+b[0]);if(b[2]!==undefined)out.push('Máu +'+b[2]);if(b[3]!==undefined)out.push('Tốc +'+b[3]);return out.join('\n')};
 const zeroBuff=n=>Object.fromEntries(Object.keys(n.buff[0]).map(k=>[k,0]));

 function fill(){
  if(!root?.isConnected)return;const levels=germa().levels,active=indexActive(levels),skills=skillsOf();
  img(find(root,'Bgr/Content/FieldItemEpSaoUpLevel/Icon'),itemSrc(data.unlockItem));text(find(root,'Bgr/Content/FieldItemEpSaoUpLevel/Text'),c.num(have(data.unlockItem)),false);
  data.nodes.forEach((n,i)=>{
   const lv=levels[i],open=i+1<=active;
   if(n.type==='level'){
    const v=find(root,'Bgr/Content/GroupVoid/Void'+n.node);if(!v)return;
    text(find(v,'Number'),`${Math.max(0,lv)}/${n.cost.length}`,false);{const num=find(v,'Number');num.dataset.color??=num.style.color;num.style.color=lv<0?'#fff':num.dataset.color}
    img(find(v,'Mask/IconSkill'),art(n.icon));show(find(v,'Mask/Shadow'),!open);show(find(v,'BoderShadow'),!open);
    v.querySelector(':scope>.pd-image')&&(v.querySelector(':scope>.pd-image').style.visibility=open?'':'hidden');
    v.dataset.node=n.node;v.classList.add('germa-node');
   }else{
    const s=find(root,'Bgr/Content/GroupSkill/Skill'+n.skill);if(!s)return;const skill=skills[n.skill-1];
    if(skill)img(s,c.assetSrc(skill.icon));
    const shadow=find(s,'Shadow');show(shadow,!open||lv!==1);show(find(shadow,'ImgLock'),!open);
    s.dataset.node=n.node;s.classList.add('germa-node');
   }
  });
 }

 // ---- Popup chỉ số (PopupLevelVoid)
 function levelPopup(node){
  close('.germa-popup');const n=data.nodes[node-1],levels=germa().levels,lv=Math.max(0,levels[node-1]),max=n.cost.length,isActive=node<=indexActive(levels);
  const el=D.render(data.prefabs.PopupEpSaoUpgradeLevel,W,H,opts());el.classList.add('germa-popup');layer().appendChild(el);el.dataset.node=node;
  const bgr=find(el,'Body/Bgr');
  text(find(bgr,'BgrTitle/Title'),n.name,false);text(find(bgr,'Content'),n.desc,false);text(find(bgr,'bgrIconSkill/NumberSkill'),`${lv}/${max}`,false);
  img(find(bgr,'bgrIconSkill/Mask/IconSkill'),art(n.icon));
  for(const p of ['bgrIconSkill','bgrIconSkill/Mask/IconSkill','bgrIconSkill/Border'])find(bgr,p)?.classList.toggle('germa-gray',!isActive);
  const cur=lv>0?n.buff[lv-1]:zeroBuff(n),atMax=lv>=max,next=atMax?zeroBuff(n):n.buff[lv];
  text(find(bgr,'BoxInfoSkill/Desc'),buffText(cur),false);text(find(bgr,'BoxInfoSkillNext/Desc'),buffText(next),false);
  show(find(bgr,'BoxInfoSkillNext'),!atMax);show(find(bgr,'ImgNext'),!atMax);
  if(atMax){const box=find(bgr,'BoxInfoSkill');box.style.transform='translateX(110px)'}
  const btn=find(bgr,'ButtonUpgrade');show(btn,isActive&&!atMax);
  if(!atMax){const cost=n.cost[lv],enough=have(data.unlockItem)>=cost;img(find(btn,'Coin'),itemSrc(data.unlockItem));text(find(btn,'Coin/Number'),String(cost),false);
   btn.classList.toggle('germa-btn-gray',!enough);find(btn,'Text').style.color=enough?'rgb(130,81,42)':'rgb(72,71,71)';
   btn.onclick=async e=>{e.stopPropagation();if(have(data.unlockItem)<cost)return c.toast('Không đủ nguyên liệu');const r=await c.mutation('/api/germa/upgrade',{node},{close:false,render:false,message:false});if(r){floatGains(cur,n.buff[lv]);c.rerender();levelPopup(node)}}}
  find(el,'Body/ArenaClickClose').onclick=()=>el.remove();
 }
 // Chữ chỉ số bay lên (ShowPointSlideUp): "Công +x", "Máu +y".
 function floatGains(cur,next){
  const lines=Object.keys(next).map(k=>({0:'Công +',2:'Máu +',3:'Tốc +'})[k]+(next[k]-(cur[k]||0)));
  lines.forEach((t,i)=>{const d=document.createElement('div');d.className='germa-gain';d.textContent=t;d.style.top=(330-i*25)+'px';layer().appendChild(d);setTimeout(()=>d.remove(),1400)});
 }

 // ---- Popup kỹ năng (PopupSkillVoid)
 function skillPopup(node){
  close('.germa-popup');const n=data.nodes[node-1],levels=germa().levels,lv=levels[node-1],isActive=node<=indexActive(levels),skill=skillsOf()[n.skill-1];if(!skill)return;
  const el=D.render(data.prefabs.PopupEpSaoUpgradeSkill,W,H,opts());el.classList.add('germa-popup');layer().appendChild(el);
  const bgr=find(el,'Body/bgr');
  text(find(bgr,'BgrTitle/Title'),skill.name,false);text(find(bgr,'NotifyContent/Viewport/Content/Status'),skill.description,false);
  const status=find(bgr,'NotifyContent/Viewport/Content/Status');Object.assign(status.style,{position:'relative',height:'auto',left:'0',top:'0'});
  text(find(bgr,'bgrIconSkill/NumberSkill'),`${Math.max(0,lv)}/1`,false);find(bgr,'bgrIconSkill/NumberSkill').style.color=lv===-1?'#fff':'rgb(247,255,132)';
  img(find(bgr,'bgrIconSkill/Mask/IconSkill'),c.assetSrc(skill.icon));show(find(bgr,'bgrIconSkill/Mask/IconShadow'),!isActive);
  const done=lv===1,btn=find(bgr,'BtnActive'),box=find(bgr,'BoxHeroUp'),fee=find(bgr,'ItemFee');
  show(btn,!done&&lv!==-1&&isActive);show(box,!done);show(fee,!done&&!!n.item);show(find(bgr,'TextNoti'),!done&&lv===-1);
  if(done){const content=find(bgr,'NotifyContent');Object.assign(content.style,{top:(content.offsetTop-45)+'px',height:'227px'})}
  // Nguyên liệu tướng: costHero tướng 10 sao -> mảnh của chính tướng (heroShardPerHero mỗi tướng).
  const shardId=c.shardId(),needShards=n.heroes*10,shards=have(shardId),slot=find(box,'HeroMaterialForLua');
  const head=find(slot,'HeroHead/Mask');head.innerHTML=`<img class="germa-head" src="${c.assetSrc(c.heroHead())}" alt="">`;
  show(find(slot,'HeroHead/TextHeroKey'),false);show(find(slot,'HeroStar'),false);show(find(slot,'IconPlus'),false);
  text(find(slot,'TextNumber'),`${c.short(shards)}/${needShards}`,false);find(slot,'TextNumber').style.color=shards<needShards?'rgb(236,57,57)':'';
  if(!n.item)slot.style.transform='translateX(65px)';
  if(n.item){const ui=find(fee,'GameItemEpSao/ItemConsumableUI');find(ui,'Mask').innerHTML=`<img class="germa-head" src="${itemSrc(n.item.itemId)}" alt="">`;const owned=have(n.item.itemId);
   text(find(fee,'TextNumber'),`${c.short(owned)}/${n.item.quantity}`,false);find(fee,'TextNumber').style.color=owned<n.item.quantity?'rgb(236,57,57)':'';
   img(find(btn,'Coin'),itemSrc(n.item.itemId));text(find(btn,'Coin/Number'),String(n.item.quantity),false)}
  else{show(find(btn,'Coin'),false);find(btn,'Text').style.transform='translateX(-24px)'}
  btn.onclick=async e=>{e.stopPropagation();if(shards<needShards||n.item&&have(n.item.itemId)<n.item.quantity)return c.toast('Không đủ nguyên liệu');
   const r=await c.mutation('/api/germa/upgrade',{node},{close:false,render:false});if(r){c.rerender();skillPopup(node)}};
  find(el,'Body/ArenaClickClose').onclick=()=>el.remove();
 }

 const layer=()=>document.querySelector('#game-layer');
 const close=sel=>{for(const e of document.querySelectorAll(sel))e.remove()};
 function onClick(e){
  const node=e.target.closest('.germa-node');if(node){const n=data.nodes[Number(node.dataset.node)-1],levels=germa().levels;
   if(n.type==='level'){if(levels[n.node-1]<0)return;levelPopup(n.node)}else skillPopup(n.node);return}
  const b=e.target.closest('.pd-button');if(!b)return;
  if(b.dataset.name==='BtnHelp')return c.modal('ÉP SAO',`<p class="item-description">Tướng đạt L1 mở Ép Sao (công nghệ Germa). Nâng các dấu ấn bằng Nước mắt Mansherry để tăng Công, Máu, Tốc. Khi cả ba dấu ấn của một nhánh đạt tối đa sẽ mở kỹ năng Germa: kích hoạt để nâng kỹ năng của tướng lên cấp 4 và mở nhánh kế tiếp. Có thể thiết lập lại Germa với 100 kim cương, hoàn trả toàn bộ nguyên liệu.</p>`);
  if(b.dataset.name==='ButtonRefresh'){if(!germa().levels.some(l=>l>0))return c.toast('Germa chưa được nâng cấp.');
   return c.confirm('Thiết lập lại Germa của thuyền viên. Toàn bộ nguyên liệu đã sử dụng để nâng cấp Germa trả lại','Hoàn trả Germa',100,async()=>{const r=await c.mutation('/api/germa/reset',{},{close:false,render:false});if(r)c.rerender()})}
  if(b.dataset.name==='ButtonSwitchUpgrade'){const l=germa().levels;if(l[0]>0||l[1]>0||l[2]>0)return c.toast('Hãy thiết lập lại kỹ năng Germa trước khi đổi thuyền viên này');return c.toast('Chọn thuyền viên khác ở danh sách tướng.')}
 }
 async function mount(target,context){
  c=context;host=target;await load();if(host!==target||!target.isConnected)return;
  root=D.render(data.prefabs.PanelEpSao,W,H,opts());root.classList.add('germa-root');target.appendChild(root);
  root.addEventListener('click',onClick);fill();
 }
 window.GermaUI={mount,load,refresh:fill,close:()=>{root?.remove();root=null;close('.germa-popup')}};
})();
