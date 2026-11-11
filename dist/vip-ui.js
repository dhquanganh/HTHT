/* VIP gốc: PopupStoreAndBenefit (1187) — PanelTop (huy hiệu VIP hiện tại, thanh EXP VIP, kim cương) và PanelBenefit
 * (Quyền Lợi từng cấp VIP, lật bằng ButtonPrev / ButtonNext, quà đạt cấp). Dữ liệu vip.json (db_vip), luật ở server/vip.mjs.
 * Bản web không có nạp tiền nên PanelStore (gói IAP) ẩn; EXP VIP nhận từ nhiệm vụ hằng ngày.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,root=null,data=null,page=1,scene=null;
 const find=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=find(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5}};
 const p=()=>c.player(),info=()=>p().vipInfo||{level:0,exp:0,next:100,max:20};
 function tile(b){
  if(b.kind==='hero'){const d=c.catalog().heroes.find(h=>String(h.avatar)===String(b.avatar));return `<span class="ev-tile" title="${c.escape(d?.name||b.name||'Thuyền viên')}"><img src="${c.assetSrc(d?.visual?.head)}" alt=""><b>${b.stars||1}★</b></span>`}
  if(b.kind==='avatar')return `<span class="ev-tile" title="Ảnh đại diện"><img src="${c.assetSrc('avatar-'+b.id)}" alt=""></span>`;
  const id=b.cat===2?(c.items.has('shard:'+b.id)?'shard:'+b.id:'heroshard:'+b.heroAvatar):'consumable:'+b.id;return c.items.has(id)?c.rewardTile({itemId:id,quantity:b.quantity}):'';
 }
 async function open(level){
  data??=await fetch('vip.json').then(r=>r.json());scene??=await fetch('scenes/1187.json').then(r=>r.json());
  page=Math.max(1,Math.min(data.levels.length,level||Math.min(data.levels.length,info().level+1)));render();
 }
 function render(){
  const n=structuredClone(scene.roots[0]),v=info(),row=data.levels[page-1];n.transform={...full};
  on(find(n,'PanelStore'),false);on(find(n,'PanelBenefit'),true);
  txt(find(n,'TextCurrVIP'),v.level);txt(find(n,'TextPercent'),v.next?`${c.num(v.exp)}/${c.num(v.next)}`:c.num(v.exp));
  const title=find(n,'TextTitle');txt(title,v.next?`Còn ${c.num(v.next-v.exp)} EXP VIP lên VIP ${v.level+1}`:'');on(find(title,'Image'),false);title.transform={...title.transform,m_SizeDelta:{x:420,y:40},m_Pivot:{x:0,y:.5},m_AnchoredPosition:{x:-175,y:-7}};{const x=comp(title,'Text');if(x){x.align=3;x.overflow=1;x.size=24}}on(find(n,'TextFieldGemWallet'),false);
  on(find(n,'TextTitleMax'),!v.next);txt(find(n,'TextTitleMax'),'Đã đạt VIP tối đa!');
  txt(find(n,'TextGemWallet'),c.num(p().wallet.diamonds));on(find(n,'ButtonAddGemWallet'),false);
  txt(find(n,'TextLevelVIP'),page);txt(find(n,'TitleBemefit'),'Quyền Lợi');
  on(find(n,'ContentText'),false);on(find(n,'ContentReward'),false);on(find(n,'ContentDailyReward'),false);
  root?.remove();root=D.render(n,W,H,{assetSrc:c.assetSrc,assets:c.assets()});root.classList.add('vip-layer');c.layer().appendChild(root);
  const bind=(x,f)=>{if(typeof x==='string')x=D.find(root,x);if(x){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();f(e)}}return x};
  bind('PanelTop/ButtonClose',close);bind('ButtonPrev',()=>{if(page>1){page--;render()}});bind('ButtonNext',()=>{if(page<data.levels.length){page++;render()}});
  const fill=D.find(root,'fillProgress');if(fill){fill.style.right='auto';fill.style.width=(v.next?Math.min(100,v.exp/v.next*100):100)+'%'}
  // Danh sách quyền lợi (ScrollRect gốc): dòng chữ MSG_MISC_BENEFIT_* và quà đạt cấp.
  const vp=D.find(root,'Scrollrect/Viewport'),list=document.createElement('div');list.className='vip-benefits';
  const lines=[['* Phần thưởng beli, kinh nghiệm, đá Exp khi tự động đánh: ',`+${row.autoBattle}%`],['* Mua beli tăng thêm: ',`+${row.midas}%`],['* Ô chứa thuyền viên: ',`+${row.heroStorage}`],
   ['* Số lần làm nhiệm vụ tổng bộ: ',row.tavern],['* Số lần mua hoạt động chiến dịch: ',`+${row.raidBuy}`]];
  list.innerHTML=`<p class="vip-need">Cần ${c.num(row.point)} EXP VIP${page<=v.level?' · <b>Đã đạt</b>':''}</p>${lines.map(([a,b])=>`<p>${a}<b>${b}</b></p>`).join('')}
   <p>* Đạt được cấp VIP này sẽ nhận được:</p><div class="vip-bonus">${row.bonus.map(tile).join('')||'—'}</div><p class="vip-note">EXP VIP nhận từ quà nhiệm vụ hằng ngày. Quà đạt cấp gửi vào hòm thư.</p>`;
  vp.appendChild(list);
 }
 function close(){root?.remove();root=null}
 window.VipUI={init(ctx){c=ctx},open:l=>open(l).catch(e=>c.toast(e.message)),close};
})();
