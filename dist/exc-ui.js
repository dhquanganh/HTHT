/* Luyện hồn (EXC gốc, lua_ex/eventlua2/exclusive): dựng nguyên prefab EXCButton / EXCPanelMain / EXCPointView /
 * EXCConsumeCostView / EXCSkillDesc bằng PrefabDOM, hành vi theo LuaJobAddEXC + EXCPanelMain + EXCResourceHelper:
 *   - Nút trên màn Thông tin tướng (anchoredPosition (-100,-125)): Spine Anim_thienphu "Button" (khóa / cấp 0) hoặc
 *     "Button2" (đã luyện); ngọn lửa Fire_eff "Level<bậc>" ở (0,37) khi đã có cấp; ổ khóa khi chưa đủ điều kiện.
 *   - Sổ: trang trái quả cầu (hiện khi cấp > 0), "Cấp: x/40", thanh chỉ số, Nâng cấp + chấm đỏ khi đủ nguyên liệu,
 *     thanh Hải hồn, nút cài lại (kim cương fee_decay); trang phải kỹ năng (đã mở chữ đậm, chưa mở chữ xám);
 *     Trợ giúp (PopupHelp).
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,data=null,loading=null,panel=null,thienphu=null;
 const load=()=>data?Promise.resolve(data):loading??=Promise.all([fetch('exc.json').then(r=>r.json()),fetch('talent.json').then(r=>r.json())]).then(([d,t])=>{
  data=d;const walk=n=>{for(const x of n.components||[])if(x.type==='SkeletonGraphic'&&x.skeleton)thienphu??=x.skeleton;(n.children||[]).forEach(walk)};walk(t.prefabs.HLBPanelMain);return d},e=>{loading=null;throw e});
 const kid=(n,path)=>path.split('/').reduce((x,p)=>x&&(x.children||[]).find(k=>k.name===p),n);
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t,rich=false)=>{const x=comp(n,'Text');if(x){x.text=String(t);if(rich)x.rich=true}};
 const clone=n=>structuredClone(n);
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const state=()=>c.player().hero.exc||{eligible:false,open:false,level:0,maxLevel:40,skills:[]};
 const pct=v=>(Math.round(v*1000)/10).toString().replace(/\.0$/,'')+'%';
 const rich=t=>String(t||'').replace(/<color="(#[0-9a-fA-F]+)">/g,'<color=$1>');
 const have=id=>id==='gold'||id==='diamonds'?c.player().wallet[id]||0:c.player().inventory[id]||0;
 function spineIn(host,skeleton,animation,{fit=.9,scale=null}={}){
  if(!host||!skeleton)return;host.querySelector(':scope>canvas.exc-spine')?.remove();
  // SkeletonGraphic: 1 đơn vị Spine = 1px thiết kế; canvas rộng hơn node, đặt giữa node để hiệu ứng không bị cắt.
  const size=scale?260:Math.max(1,Math.round(host.offsetWidth)),cv=document.createElement('canvas');cv.className='exc-spine';cv.width=cv.height=size;
  if(scale)Object.assign(cv.style,{inset:'auto',left:(host.offsetWidth-size)/2+'px',top:(host.offsetHeight-size)/2+'px'});host.appendChild(cv);
  c.spine(cv,{skeleton,animation},{loop:true,fit,scale});
 }

 // ---- Nút trên màn Thông tin tướng
 function entry(screen){
  if(!data){load().then(()=>c?.rerender()).catch(()=>{});return}
  screen.querySelector('.exc-entry')?.remove();
  const s=state(),n=clone(data.prefabs.EXCButton),locked=!s.eligible||!s.open,tier=s.tier||0;
  on(kid(n,'Lock'),locked);on(kid(n,'Level'),!locked&&s.level>0);txt(kid(n,'Text'),'Luyện hồn');
  const lv=kid(n,'Level');if(lv)lv.transform={...lv.transform,m_AnchoredPosition:{x:0,y:37}};txt(kid(n,'Level/TextLevel'),s.level);
  const el=D.render(n,W,H,opts()),wrap=document.createElement('div');wrap.className='exc-entry'+(locked?' locked':'');wrap.style.transform='translate(-100px,125px)';
  wrap.appendChild(el);screen.appendChild(wrap);
  const root=D.find(wrap,'EXCButton')||el;root.classList.add('exc-button');root.setAttribute('role','button');root.setAttribute('aria-label','Luyện hồn');
  root.addEventListener('click',e=>{e.stopPropagation();
   if(!s.eligible)return c.toast('Thuyền viên chưa mở khóa Luyện Hồn');
   if(!s.open)return c.toast(`Thuyền viên đạt ${s.unlockStar} sao trở lên để mở khóa Luyện Hồn`);open()});
  requestAnimationFrame(()=>{
   spineIn(D.find(wrap,'Spine/Mesh'),thienphu,!locked&&s.level>0?'Button2':'Button',{scale:1});
   // Ngọn lửa Fire_eff "Level<bậc>" như EXCResourceHelper.playLevel; chạy được thì ẩn nhãn số dự phòng.
   if(!locked&&s.level>0){spineIn(D.find(wrap,'Level/Mesh'),data.fire,'Level'+Math.min(4,tier),{scale:1});D.show(D.find(wrap,'Level/TextLevel'),false)}
  });
 }

 // ---- Sổ Luyện hồn
 function build(){
  const s=state(),n=clone(data.prefabs.EXCPanelMain),left=kid(n,'Content/PageLeft'),right=kid(n,'Content/PageRight');
  on(kid(left,'Orb'),s.level>0);on(kid(left,'ButtonReset'),s.level>0);txt(kid(left,'TextLevel'),`Cấp: ${s.level}/${s.maxLevel}`);
  const tplPoint=data.prefabs.EXCPointView,points=s.level>0?[['Công','+'+pct(s.points.attackPct)],['Máu','+'+pct(s.points.maxHpPct)],['Tốc độ','+'+s.points.speed]]:[];
  kid(left,'PointContainer').children=points.map(([k,v])=>{const p=on(clone(tplPoint));txt(kid(p,'TextValue'),`${k} : ${v}`);return p});
  const isMax=!s.cost||!Object.keys(s.cost).length;on(kid(left,'BarConsumeMaterial'),!isMax);on(kid(left,'ButtonLvUp'),!isMax);on(kid(left,'TextMax'),isMax);txt(kid(left,'TextMax'),I2('HC_DA_DAT_CAP_TOI_DA','Đã đạt cấp tối đa'));
  let enough=true;
  kid(left,'BarConsumeMaterial/CostContainer').children=isMax?[]:Object.entries(s.cost).map(([id,need])=>{const v=on(clone(data.prefabs.EXCConsumeCostView)),own=have(id);if(own<need)enough=false;
   const icon=kid(v,'IconItem'),im=comp(icon,'Image');if(im)im.asset=id==='gold'?c.named('icon_gold'):id==='diamonds'?c.named('icon_gem'):c.items.get(id)?.assetKey;
   txt(kid(v,'TextValue'),`<color=${own>=need?'#7DE837':'#E84737'}>${c.short(own)}</color>/${c.short(need)}`,true);v.excItem=id;return v});
  on(kid(left,'ButtonLvUp/GoNotify'),!isMax&&enough);
  const tplSkill=data.prefabs.EXCSkillDesc;
  kid(right,'ScrollSkill/Viewport/Content').children=s.skills.map(k=>{const v=on(clone(tplSkill)),title=`Lv.${k.tier} (cấp ${k.unlock} để mở khóa)`;
   txt(kid(v,'TextTitle'),k.unlocked?`Lv.${k.tier}`:title);txt(kid(v,'TextDesc'),k.unlocked?rich(k.text):String(k.text||'').replace(/<\/?color[^>]*>/g,''),true);
   comp(kid(v,'TextDesc'),'Text').color=k.unlocked?[.24,.16,.09,1]:[.62,.58,.53,1];v.excSkill=k;return v});
  return n;
 }
 // Content của trang Kỹ năng: dòng cao theo độ dài chữ (ContentSizeFitter gốc).
 function fitSkills(el){
  const content=D.find(el,'PageRight/ScrollSkill/Viewport/Content');if(!content)return;let y=14;
  for(const row of [...content.children].filter(x=>x._node?.excSkill)){const desc=D.find(row,'TextDesc'),span=desc?.querySelector('.pd-text');
   if(span){span.style.whiteSpace='normal';desc.style.height='auto';span.style.position='static'}
   const h=30+(span?.scrollHeight||40)+4;Object.assign(row.style,{top:y+'px',height:h+'px'});if(desc)Object.assign(desc.style,{top:'28px',height:(h-30)+'px'});y+=h+14}
  content.style.height=y+'px';
 }
 function render(){
  panel?.remove();const s=state(),n=build(),el=D.render(n,W,H,opts());el.classList.add('exc-panel');c.layer().appendChild(el);panel=el;fitSkills(el);
  const q=p=>D.find(el,p),click=(p,f)=>{const x=q(p);if(x){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();f()}}};
  click('Content/ButtonClose',close);click('Close2',close);
  click('Content/ButtonHelp',()=>{D.setText(q('PopupHelp/Panel/TextBody'),helpText());D.show(q('PopupHelp'),true)});
  click('PopupHelp/Panel/ButtonClose',()=>D.show(q('PopupHelp'),false));click('PopupHelp/Dim',()=>D.show(q('PopupHelp'),false));
  click('Content/PageLeft/ButtonLvUp',levelUp);click('Content/PageLeft/ButtonReset',reset);
  for(const x of el.querySelectorAll('.pd-node'))if(x._node?.excItem){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();c.itemInfo(x._node.excItem)}}
  return el;
 }
 async function levelUp(){
  if(panel?.dataset.busy)return;panel&&(panel.dataset.busy='1');
  const before=state().level,d=await c.mutation('/api/exc',{op:'level'},{render:false,bonus:false,message:false,close:false});
  if(panel)delete panel.dataset.busy;if(!d)return;
  const el=render(),orb=D.find(el,'Content/PageLeft/Orb');
  // Hiệu ứng nâng cấp: quả cầu bùng sáng, chỉ số và cấp nảy lên; mở bậc kỹ năng thì dòng kỹ năng đó sáng lên.
  orb?.classList.add('exc-burst');D.find(el,'Content/PageLeft/TextLevel')?.classList.add('exc-bump');D.find(el,'Content/PageLeft/PointContainer')?.classList.add('exc-bump');
  if(before===0)orb?.classList.add('exc-appear');
  const tier=d.result?.unlockedTier;if(tier){const row=[...el.querySelectorAll('.pd-node')].find(x=>x._node?.excSkill?.tier===tier);row?.classList.add('exc-unlock');row?.scrollIntoView({block:'nearest'})}
  c.toast(d.result.message);c.rerender();
 }
 function reset(){
  const s=state();if(s.level<=0)return;
  c.confirm('Thiết lập lại Luyện hồn của thuyền viên. Toàn bộ nguyên liệu đã sử dụng để nâng cấp trả lại','Hoàn trả Luyện hồn',s.feeDecay,async()=>{
   const d=await c.mutation('/api/exc',{op:'reset'},{render:false,close:false});if(d){render();c.rerender()}});
 }
 // Trợ giúp như EXCDbManager:getHelpText gốc.
 function helpText(){const unlocks=[...new Set(data.heroes[0]?.skills.map(s=>s.unlock))].join(', ');return[`Thuyền viên đạt ${data.unlockStar} sao mở khóa Luyện Hồn (chỉ một số thuyền viên).`,`Luyện Hồn có ${data.maxLevel} cấp độ, mỗi giai đoạn nâng cấp cần có nguyên liệu tương ứng.`,`Khi đạt cấp ${unlocks} sẽ mở khóa kỹ năng tương ứng.`,'Thuyền viên đã nâng cấp Luyện Hồn không thể sử dụng làm nguyên liệu, Hoàn trả, Huyết tế, phân rã...','Có thể sử dụng Kim Cương để cài lại Luyện Hồn, toàn bộ nguyên liệu đã dùng được trả lại; cấp càng cao yêu cầu kim cương càng lớn.'].join('\n')}
 async function open(){try{await load();render()}catch(e){c.toast(e.message)}}
 function close(){panel?.remove();panel=null}
 window.ExcUI={init(ctx){c=ctx},load,entry,open,close,isOpen:()=>!!panel};
})();
