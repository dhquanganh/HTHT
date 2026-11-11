/* Vòng quay gốc: PopupChooseSpin (1489: casino_normal / casino_vip) -> PopupLuckySpin (Nami + ếch, đĩa vàng) hoặc
 * PopupSuperLuckySpin (bạch tuộc + heo, đĩa tím), xuất từ bundle lua_ex vào casino.json (tools/export-casino.py).
 *   - Đĩa SpinDisk quay (kim RouletteCenter đứng yên chỉ lên trên); quà nằm ở Items/Text1..8/GameItemN, xoay theo đĩa.
 *   - GroupBtnSpin: 1 lượt / 10 lượt / 100 lượt (HotFix100Spins); ô FieldGem / FieldChip (+ ButtonBuyChip);
 *     ButtonRefresh "Làm mới" (giá kim cương), TextNextRefresh "Bắt buộc làm mới" + TextCountDownRefresh.
 * Luật ở server/casino.mjs.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,choose=null,wheel=null,current='normal',busy=false,timer=0,angles=[],turn=0,data=null;const cache={};
 const scene=id=>cache[id]??=fetch(`scenes/${id}.json`).then(r=>r.json());
 const find=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=find(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5}};
 const shade=n=>({id:'cs',name:'CasinoRoot',active:true,components:[],transform:full,children:[{id:'sh',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.6]}],transform:full,children:[]},n]});
 const p=()=>c.player(),view=()=>p().casino;
 const mount=(n,cls,{withShade=true,onSkeleton}={})=>{n.transform={...n.transform,...full};const el=D.render(withShade?shade(n):n,W,H,{assetSrc:c.assetSrc,assets:c.assets(),onSkeleton});el.classList.add('casino-layer',...cls.split(' '));c.layer().appendChild(el);return el};
 const bind=(el,x,f)=>{if(typeof x==='string')x=D.find(el,x);if(x){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();f(e)}}return x};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const clock=ms=>{const s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return[h,m,s%60].map(x=>String(x).padStart(2,'0')).join(':')};
 async function open(){
  const s=await scene(1489),n=structuredClone(s.roots[0]);closeAll();
  choose=mount(n,'casino-choose');
  const close=()=>{choose?.remove();choose=null};bind(choose,'ButtonClose',close);bind(choose,'Shade',close);
  bind(choose,'ButtonCasino',()=>openWheel('normal'));
  const vip=view().wheels.super;const sb=bind(choose,'ButtonSuperCasino',()=>vip.open?openWheel('super'):c.toast(I2('MSG_REQUIRE_VIP_OR_LEVEL','Yêu cầu cấp độ {0} hoặc VIP cấp độ {1}',vip.minLevel,vip.minVip)));if(!vip.open)sb?.classList.add('casino-locked');
 }
 async function openWheel(id){
  current=id;data??=await fetch('casino.json').then(r=>r.json());
  const n=structuredClone(data.prefabs[id==='super'?'PopupSuperLuckySpin':'PopupLuckySpin']),w=view().wheels[id],chip=c.items.get(w.chip)?.assetKey;
  // Góc (độ, CSS theo chiều kim đồng hồ) của từng ô: quaternion z của Text1..8.
  angles=[];for(let i=1;i<=8;i++){const t=find(n,'Text'+i),q=t.transform.m_LocalRotation||{z:0,w:1};angles.push(-2*Math.atan2(q.z||0,q.w??1)*180/Math.PI);txt(t,'')}
  on(find(n,'SpineEffect'),false);on(find(n,'ButtonShop'),false);on(find(n,'HotFix100Spins'),false);
  // Chữ nút như LuckySpinScene / HotFix100Spins gốc: MISC_2_LBL_1_TURN, MISC_2_LBL_10_TURN, "100 " + MISC_2_LBL_SPIN.
  const labels=[I2('MISC_2_LBL_1_TURN','1 lượt'),I2('MISC_2_LBL_10_TURN','10 lượt'),'100 '+I2('MISC_2_LBL_SPIN','Lượt')];
  [1,10,100].forEach((k,i)=>{const b=find(n,'ButtonSpin'+k);if(!b)return;const label=b.children.find(x=>/^TextSpin/.test(x.name));txt(label,labels[i]);if(label){label.transform.m_AnchoredPosition={x:24,y:0};const t=comp(label,'Text');if(t)t.size=24}
   for(const icon of b.children.filter(x=>/^Icon/.test(x.name))){const im=comp(icon,'Image');if(im&&chip)im.asset=chip;for(const t of icon.children)txt(t,w.costs[k])}});
  txt(find(n,'TextNextRefresh'),I2('MISC_2_LBL_FORCE_REFRESH','Bắt buộc làm mới'));txt(find(n,'TextRefresh'),I2('LBL_REFRESH','Làm mới'));
  {const im=comp(find(find(n,'FieldChip'),'IconChip'),'Image');if(im&&chip)im.asset=chip}
  const skeletons=[];wheel?.remove();clearInterval(timer);turn=0;
  wheel=mount(n,'casino-wheel '+id,{withShade:false,onSkeleton:(el,sk)=>skeletons.push({el,sk})});
  for(const {el,sk} of skeletons){if(!sk.skeleton||el.closest('[style*="display: none"]'))continue;const cv=document.createElement('canvas');cv.width=1400;cv.height=2000;cv.className='casino-spine';el.appendChild(cv);c.spine(cv,{skeleton:sk.skeleton,animation:sk.animation||'animation'},{loop:true,scale:1})}
  bind(wheel,'ButtonBack',closeWheel);
  bind(wheel,'ButtonHelp',help);
  bind(wheel,'ButtonBuyChip',buy);if(id==='super')bind(wheel,'FieldChip',buy);
  bind(wheel,'ButtonSpin1',()=>spin(1));bind(wheel,'ButtonSpin10',()=>spin(10));bind(wheel,'ButtonSpin100',()=>spin(100));
  bind(wheel,'ButtonRefresh',refresh);
  render();timer=setInterval(tick,1000);
 }
 const wheelName=()=>current==='super'?I2('MISC_2LBL_SUPER_CASINO','Vòng quay siêu cấp'):I2('MISC_2_LBL_CASINO','Vòng quay thường');
 function help(){
  const w=view().wheels[current];
  c.modal(wheelName(),`<p class="item-description">${current==='normal'?'1 lượt tốn 1 Xu vòng quay, 10 lượt tốn 8 Xu, 100 lượt tốn 80 Xu. Mỗi ngày được quay miễn phí 1 lượt.':`1 / 10 / 100 lượt tốn 1 / 10 / 100 Xu quay siêu cấp. Mở ở cấp ${w.minLevel} hoặc VIP ${w.minVip}.`}
   Hết xu có thể mua bằng kim cương (${w.price} kim cương / xu). "Làm mới" đổi 8 ô quà; cứ 8 giờ vòng quay bắt buộc làm mới và lần làm mới đầu tiên sau đó miễn phí.</p><div class="reward-items casino-help">${w.slots.map(r=>c.rewardTile(r)).join('')}</div>`);
 }
 function playRefresh(){
  const host=D.find(wheel,'RouletteBorder'),sk=data.spines?.refresh;if(!host||!sk)return;host.querySelector('.casino-refresh')?.remove();
  const cv=document.createElement('canvas');cv.width=cv.height=760;cv.className='casino-spine casino-refresh';host.appendChild(cv);
  c.spine(cv,{skeleton:sk,animation:'Cast'},{loop:false,scale:1.3,onEnd:()=>cv.remove()});setTimeout(()=>cv.remove(),3000);
 }
 function tick(){
  if(!wheel||!wheel.isConnected)return clearInterval(timer);
  const left=view().wheels[current].refreshAt-Date.now();D.setText(D.find(wheel,'TextCountDownRefresh'),clock(left));
 }
 function render(){renderSlots();renderCounts()}
 function renderSlots(){
  if(!wheel)return;const w=view().wheels[current];
  w.slots.forEach((r,i)=>{const host=D.find(wheel,`Text${i+1}/GameItem${i+1}`);if(!host)return;host.querySelector('.casino-slot')?.remove();
   const el=document.createElement('span');el.className='casino-slot';el.dataset.i=i;el.innerHTML=c.rewardTile(r);host.appendChild(el)});
 }
 function renderCounts(){
  if(!wheel)return;const w=view().wheels[current],free=current==='normal'?view().freeLeft:0;
  D.setText(D.find(wheel,'FieldGem/TextGem'),c.num(p().wallet.diamonds));D.setText(D.find(wheel,'FieldChip/TextChip'),c.num(p().inventory[w.chip]||0));
  const one=D.find(wheel,'ButtonSpin1/IconChip/TextChip1');if(one)D.setText(one,free?'0':String(w.costs[1]));D.find(wheel,'ButtonSpin1')?.classList.toggle('casino-free',!!free);
  D.setText(D.find(wheel,'TextGemRefresh'),String(w.refreshCost));tick();
 }
 const disk=()=>D.find(wheel,'SpinDisk');
 function buy(){
  const w=view().wheels[current];
  c.confirm(`Mua 10 xu với ${w.price*10} kim cương?`,'Mua xu',w.price*10,async()=>{if(await c.mutation('/api/casino',{wheel:current,op:'buy',count:10},{render:false,close:false}))render()});
 }
 async function refresh(){
  if(busy)return c.toast(I2('MISC_2_WAIT_LUCKY_END','Hãy đợi vòng quay kết thúc'));const w=view().wheels[current];
  const go=async()=>{busy=true;try{if(await c.mutation('/api/casino',{wheel:current,op:'refresh'},{render:false,close:false,message:false})){
   // Hiệu ứng gốc Refresh_spin (Cast: vòng sáng quét quanh đĩa), đổi ô quà giữa hiệu ứng.
   playRefresh();wheel.querySelectorAll('.casino-slot').forEach(x=>x.classList.add('out'));await wait(450);renderSlots();renderCounts();
   wheel.querySelectorAll('.casino-slot').forEach(x=>x.classList.add('in'));await wait(600)}}finally{busy=false}};
  if(w.refreshCost)c.confirm(I2('MSG_DESC_REFRESH','Bạn chắc chắn muốn làm mới?'),I2('LBL_REFRESH','Làm mới'),w.refreshCost,go);else go();
 }
 async function spin(times){
  if(busy)return c.toast(I2('MISC_2_WAIT_LUCKY_END','Hãy đợi vòng quay kết thúc'));const w=view().wheels[current],free=current==='normal'&&times===1&&view().freeLeft>0;
  if(!free&&(p().inventory[w.chip]||0)<w.costs[times])return buy();
  busy=true;wheel.classList.add('casino-spinning');
  try{
   const d=await c.mutation('/api/casino',{wheel:current,times},{render:false,close:false,message:false,bonus:false});if(!d)return;
   wheel.querySelectorAll('.casino-slot.hit').forEach(x=>x.classList.remove('hit'));render();
   const last=d.result.hits.at(-1),el=disk();
   // Đĩa quay ít nhất 5 vòng rồi dừng sao cho ô trúng nằm dưới kim (góc 0 ở trên cùng).
   const want=((-angles[last])%360+360)%360,base=turn-((turn%360)+360)%360;turn=base+360*(5+(times>1?1:0))+want;
   el.style.transition=`rotate ${times>1?3.6:3.2}s cubic-bezier(.17,.67,.21,1)`;el.style.rotate=turn+'deg';
   await wait(times>1?3700:3300);
   for(const i of new Set(d.result.hits))wheel.querySelector(`.casino-slot[data-i="${i}"]`)?.classList.add('hit');
   await wait(450);
   c.bonusPopup(d.result.rewards);renderCounts();
  }finally{busy=false;wheel?.classList.remove('casino-spinning')}
 }
 function closeWheel(){clearInterval(timer);wheel?.remove();wheel=null}
 function closeAll(){choose?.remove();choose=null;closeWheel()}
 window.CasinoUI={init(ctx){c=ctx},open:()=>open().catch(e=>c.toast(e.message)),openWheel:id=>openWheel(id).catch(e=>c.toast(e.message)),close:closeAll};
})();
