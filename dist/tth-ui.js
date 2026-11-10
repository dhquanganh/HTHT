/* Tân Tứ Hoàng (TTHMain gốc, lua_bossserver/eventlua2/tantuhoang) dựng nguyên prefab bằng PrefabDOM, hành vi theo
 * TTHHub / TTHLobby / TTHRanking / TTHPopups:
 *   - Đảo B_TanTuHoang trên bản đồ thế giới (564,-116), chấm đỏ khi còn lượt đánh.
 *   - TTHHub: 4 đảo (trái-trên, phải-trên, trái-dưới, phải-dưới) với chibi Spine boss, "Khiêu chiến" chỉ ở đảo hôm nay,
 *     "Lượt đánh: N" + mua thêm, trợ giúp.
 *   - TTHLobby: bảng boss (tên, chibi, "Ngày d · Cấp L · Kháng x%", 4 kỹ năng, Tấn công, Quà hạng) và bảng
 *     "XẾP HẠNG SÁT THƯƠNG" (lượt miễn phí, Quà sát thương, 50 hạng đầu với huy chương 1-3, dòng của mình ghim dưới).
 *     Mỗi boss một bảng xếp hạng: bấm đảo boss khác xem bảng của boss đó (ngày gần nhất boss trực), không tấn công được.
 *   - TTHPopupReward (mốc sát thương / thưởng hạng), TTHPopupChest (Có thể nhận của rương Hải Hồn).
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,data=null,loading=null,hub=null,lobby=null,popups=[],viewBoss=null;
 const load=()=>data?Promise.resolve(data):loading??=fetch('tth.json').then(r=>r.json()).then(d=>data=d,e=>{loading=null;throw e});
 const kid=(n,path)=>path.split('/').reduce((x,p)=>x&&(x.children||[]).find(k=>k.name===p),n);
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const pic=(n,key)=>{const x=comp(n,'Image');if(x&&key)x.asset=key};
 const clone=n=>structuredClone(n);
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const st=()=>c.player().tth;
 const HELP=['*Tính năng chia cụm liên máy chủ','-Mỗi ngày được khiêu chiến với 1 Tứ Hoàng, cứ qua 1 ngày, sức mạnh của Tứ Hoàng sẽ được tăng cường.','-Mỗi Tứ hoàng có bộ kỹ năng và khả năng để kháng sát thương khác nhau.','-Mỗi ngày được khiêu chiến boss miễn phí 10 lần, có thể sử dụng kim cương để mua thêm lượt.','-Thưởng sát thương: mỗi ngày, căn cứ vào sát thương gây ra trong 1 lần tấn công, nhận thưởng mốc tương ứng, mỗi mốc quà chỉ được nhận tối đa 1 lần mỗi ngày.','-Thưởng xếp hạng: mỗi ngày, sát thương cao nhất trong 1 lần tấn công ngày hôm đó sử dụng làm căn cứ xếp hạng và phần thưởng tổng kết.'].join('\n');
 // "100000 K", "5000 M", "2500 B" như TTHDb.formatDamage.
 const fmtDamage=v=>{v=Number(v)||0;if(v>=1e12)return Math.floor(v/1e9)+' B';if(v>=1e9)return Math.floor(v/1e6)+' M';if(v>=1e6)return Math.floor(v/1e3)+' K';return String(Math.floor(v))};
 const fmtTime=s=>{s=Math.max(0,Math.floor(s));return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(x=>String(x).padStart(2,'0')).join(':')};
 function mount(node,cls,list){const el=D.render(node,W,H,opts());el.classList.add('tth-layer',...cls.split(' '));c.layer().appendChild(el);if(list)popups.push(el);return el}
 function chibi(host,avatar){
  if(!host)return;host.querySelector(':scope>canvas.tth-spine')?.remove();const skeleton=c.skeleton(avatar);if(!skeleton)return;
  // Canvas 1,5 lần node (đặt giữa) để chibi to như bản gốc mà không bị cắt hiệu ứng.
  const w=Math.round(host.offsetWidth)||200,size=Math.round(w*1.5),cv=document.createElement('canvas');cv.className='tth-spine';cv.width=cv.height=size;Object.assign(cv.style,{inset:'auto',left:(w-size)/2+'px',top:(w-size)/2-w*.12+'px'});host.appendChild(cv);c.spine(cv,{skeleton,animation:'idling'},{loop:true,fit:.95});
 }
 const bind=(el,path,f)=>{const x=D.find(el,path);if(x){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();f(e)}}return x};
 function askBuy(){
  const s=st();if(s.buyPrice<0)return c.toast('Đã hết lượt mua hôm nay');
  c.confirm(`Dùng ${s.buyPrice} kim cương để mua thêm 1 lượt đánh?\n(Đã mua hôm nay: ${s.boughtToday}/${s.maxBuy})`,'Mua lượt đánh',s.buyPrice,async()=>{
   const d=await c.mutation('/api/tth/buy',{},{render:false,message:false});if(d){c.toast('Mua lượt đánh thành công');refresh()}});
 }
 function refresh(){if(hub)fillHub();if(lobby)openLobby(viewBoss,true)}

 // ---- Hub
 function fillHub(){
  const s=st();D.setText(D.find(hub,'Top/TurnBox/TextTurn'),String(s.attacksLeft));
  for(let i=1;i<=4;i++)D.show(D.find(hub,`Islands/Island${i}/ButtonFight`),s.bossIndex===i-1);
 }
 async function openHub(){
  await load();close();const n=clone(data.prefabs.TTHHub);txt(kid(n,'Top/TurnBox/Label'),'Lượt đánh:');on(kid(n,'TextLock'),false);
  hub=mount(n,'tth-hub');fillHub();
  bind(hub,'Top/ButtonBack',close);bind(hub,'Top/ButtonHelp',()=>c.modal('Trợ giúp',`<p class="item-description">${c.escape(HELP)}</p>`));bind(hub,'Top/TurnBox/ButtonBuy',askBuy);
  for(let i=1;i<=4;i++){const b=data.bosses[i-1],isl=D.find(hub,`Islands/Island${i}`);chibi(D.find(isl,'Spine'),b.avatar);
   bind(isl,'ButtonFight',()=>openLobby(i-1));bind(isl,'ButtonIsland',()=>{const s=st();if(s.bossIndex===i-1)openLobby(i-1);else{c.toast('Hôm nay chỉ được khiêu chiến '+s.bossName);openLobby(i-1)}})}
 }

 // ---- Lobby
 async function openLobby(index,keepScroll){
  const s=st(),b=data.bosses[index],today=s.bossIndex===index;viewBoss=index;
  const rank=await c.api('/api/tth/ranking?boss='+index);
  const old=lobby;const n=clone(data.prefabs.TTHLobby);
  txt(kid(n,'Left/Title/TextName'),b.name);on(kid(n,'Top/TurnBox'),false);txt(kid(n,'Top/TurnBox/Label'),'Lượt đánh:');txt(kid(n,'Top/TurnBox/TextTurn'),s.attacksLeft);
  const day=today?s.day:rank.day,level=day?day*10:0,resist=today?s.resist:null;
  txt(kid(n,'Left/TextInfo'),day?`Ngày ${day} · Cấp ${level}`+(resist?` · Kháng ${Math.floor(resist/10)}%`:''):'Chưa tới lượt');
  b.skills.forEach((sk,i)=>{const btn=kid(n,`Left/GroupSkill/ButtonSkill${i+1}`);if(!btn)return;for(const k of ['SpriteOn','SpriteOff'])pic(kid(btn,k),sk.icon);on(kid(btn,'SpriteOff'),false);on(kid(btn,'Image'),false);btn.tthSkill=i});
  const atk=kid(n,'Left/ButtonAttack'),needBuy=today&&s.attacksLeft<=0&&s.buyPrice>=0;on(kid(atk,'Cost'),needBuy);txt(kid(atk,'Cost/TextCost'),s.buyPrice);txt(kid(atk,'Text'),today?'Tấn công':'Chưa tới lượt');
  txt(kid(n,'Left/ButtonRankReward/Label'),'Quà hạng');txt(kid(n,'Right/ButtonDamageReward/Label'),'Quà sát thương');
  for(const [p,id] of [['Left/ButtonRankReward/Icon',2206],['Right/ButtonDamageReward/Icon',2205]])pic(kid(n,p),c.items.get('consumable:'+id)?.assetKey);
  txt(kid(n,'Right/FreePill/TextFree'),today?`Lượt đánh miễn phí: ${s.freeLeft}`:`${b.name} · Ngày ${rank.day??'--'}`);
  // Hạng 1-3 huy chương icon_NO1..3, từ 4 hiện số (TTHRanking.setCell).
  const tpl=data.prefabs.TTHRankCell,content=kid(n,'Right/ScrollRank/Viewport/Content');
  content.children=rank.top.map(r=>{const cell=on(clone(tpl));txt(kid(cell,'TextName'),r.name);txt(kid(cell,'TextDamage'),fmtDamage(r.damage));
   const medal=data.medals['icon_NO'+r.rank];on(kid(cell,'Medal'),!!medal);if(medal)pic(kid(cell,'Medal'),medal);on(kid(cell,'TextRank'),!medal);txt(kid(cell,'TextRank'),r.rank);
   pic(kid(cell,'PlayerAvatar/Mask/ImageAvt'),c.heroHead(r.avatar));txt(kid(cell,'PlayerAvatar/TagLevel/TextLevel'),r.level);if(r.me)cell.tthMe=true;return cell});
  content.transform={...content.transform,m_SizeDelta:{x:0,y:Math.max(360,rank.top.length*80)}};content.components=[{type:'VerticalLayoutGroup',spacing:4,padding:[0,0,2,2],align:1}];
  on(kid(n,'Right/TextEmpty'),!rank.top.length);txt(kid(n,'Right/TextEmpty'),'Chưa có ai khiêu chiến');
  const me=kid(n,'Right/Me'),p=c.player();txt(kid(me,'TextName'),rank.me?.name||p.displayName);txt(kid(me,'LabelRank'),'XH hiện tại');txt(kid(me,'TextRank'),rank.me?.rank||'--');
  txt(kid(me,'LabelDamage'),'Tổng sát thương:');txt(kid(me,'TextDamage'),rank.me?fmtDamage(rank.me.damage):'--');pic(kid(me,'PlayerAvatar/Mask/ImageAvt'),c.heroHead(c.heroAvatar()));txt(kid(me,'PlayerAvatar/TagLevel/TextLevel'),p.account.level);
  lobby=mount(n,'tth-lobby'+(today?'':' tth-view'));
  if(keepScroll&&old){const a=old.querySelector('[data-name="Viewport"]'),z=lobby.querySelector('[data-name="Viewport"]');if(a&&z)z.scrollTop=a.scrollTop}
  old?.remove();
  for(const x of lobby.querySelectorAll('.pd-node'))if(x._node?.tthMe)x.classList.add('tth-me');
  chibi(D.find(lobby,'Left/Spine'),b.avatar);
  bind(lobby,'Top/ButtonBack',()=>{lobby.remove();lobby=null;fillHub()});bind(lobby,'Top/ButtonHelp',()=>c.modal('Trợ giúp',`<p class="item-description">${c.escape(HELP)}</p>`));bind(lobby,'Top/TurnBox/ButtonBuy',askBuy);
  bind(lobby,'Left/ButtonAttack',()=>{if(!today)return c.toast('Hôm nay chỉ được khiêu chiến '+s.bossName);attack()});
  bind(lobby,'Left/ButtonRankReward',()=>openReward('rank'));bind(lobby,'Right/ButtonDamageReward',()=>openReward('milestone'));
  // Kỹ năng: giữ hiện BoxSkillDesc (icon, tên, mô tả) như ButtonSkillInfo.
  const box=D.find(lobby,'Left/BoxSkillDesc');
  b.skills.forEach((sk,i)=>{const btn=D.find(lobby,`Left/GroupSkill/ButtonSkill${i+1}`);if(!btn)return;btn.classList.add('pd-button');btn.onclick=e=>{e.stopPropagation();
   D.setImage(D.find(box,'IconSkill'),c.assetSrc(sk.icon));D.setText(D.find(box,'TextSkillName'),(sk.active?'Nộ: ':'Bị động: ')+sk.name);D.setText(D.find(box,'TextSkillDesc'),sk.description);D.show(box,true)}});
  if(box){box.classList.add('pd-button');box.onclick=e=>{e.stopPropagation();D.show(box,false)}}
 }
 async function attack(){
  const s=st();if(s.attacksLeft<=0)return s.buyPrice>=0?askBuy():c.toast('Đã hết lượt khiêu chiến hôm nay');
  c.pickTeam('Tân Tứ Hoàng · '+(st().bossName||''),async slots=>{const d=await c.mutation('/api/tth/attack',{formation:slots},{render:false,message:false,bonus:false});if(!d)return;
  if(d.player.battle?.status==='active'){close();c.navigate(9)}})
 }

 // ---- Popup phần thưởng
 function openReward(mode){
  const s=st(),n=clone(data.prefabs.TTHPopupReward),tpl=data.prefabs.TTHRewardCell,content=kid(n,'Panel/Scroll/Viewport/Content');
  txt(kid(n,'Panel/TextTitle'),mode==='rank'?'Quà tặng':'Quà XH sát thương');
  const rows=mode==='rank'?s.rankTiers.map(t=>({label:'Thưởng xếp hạng',value:t.from===t.to?String(t.from):t.to>99999?t.from+'+':`${t.from}-${t.to}`,rewards:t.rewards,done:false}))
   :s.milestones.map(m=>({label:'Sát thương',value:fmtDamage(m.threshold),rewards:m.rewards,done:m.claimed}));
  content.children=rows.map(r=>{const cell=on(clone(tpl));txt(kid(cell,'Label'),r.label);txt(kid(cell,'TextValue'),r.value);on(kid(cell,'Done'),r.done);if(r.done)comp(kid(cell,'TextValue'),'Text').color=[126/255,203/255,38/255,1];cell.tthRewards=r.rewards;return cell});
  content.transform={...content.transform,m_SizeDelta:{x:0,y:rows.length*110}};content.components=[{type:'VerticalLayoutGroup',spacing:6,padding:[0,0,4,4],align:1}];
  txt(kid(n,'Panel/TextFooter'),mode==='rank'?'Thưởng gửi qua thư sau 00:00':`Sát thương cao nhất 1 lần hôm nay: ${s.myBest>0?fmtDamage(s.myBest):'--'}`);
  const el=mount(n,'tth-popup',true),close=()=>{el.remove();popups=popups.filter(x=>x!==el)};bind(el,'Panel/ButtonClose',close);bind(el,'Dim',close);
  for(const x of el.querySelectorAll('.pd-node')){const list=x._node?.tthRewards;if(!list)continue;const items=D.find(x,'Items'),box=document.createElement('div');box.className='tth-items';
   box.innerHTML=list.map(r=>`<span class="tth-item${/2205|2206/.test(r.itemId)?' chest':''}" data-item="${c.escape(r.itemId)}">${c.rewardTile(r)}</span>`).join('');items.appendChild(box);
   box.onclick=e=>{const t=e.target.closest('.tth-item.chest');if(t){e.stopPropagation();openChest(Number(t.dataset.item.split(':')[1]))}}}
 }
 // Có thể nhận: nội dung rương Hải Hồn đọc từ khung gốc (TTHDb.CHEST_OPTIONS).
 const CHEST={2205:[[2201,8],[2202,4],[2203,2],[2204,1]],2206:[[2201,1],[2201,2],[2201,4],[2201,8],[2202,1],[2202,2],[2202,4],[2203,1],[2203,2],[2204,1]]};
 function openChest(id){
  const n=clone(data.prefabs.TTHPopupChest);txt(kid(n,'Panel/TextTitle'),'Có thể nhận');txt(kid(n,'Panel/TextName'),id===2206?'Rương Hải Hồn Tùy Chọn Lớn':'Rương Hải Hồn Tùy Chọn');
  const el=mount(n,'tth-popup',true),close=()=>{el.remove();popups=popups.filter(x=>x!==el)};bind(el,'Panel/ButtonClose',close);bind(el,'Dim',close);
  const grid=D.find(el,'Panel/Grid'),box=document.createElement('div');box.className='tth-grid';box.innerHTML=(CHEST[id]||[]).map(([i,q])=>c.rewardTile({itemId:'consumable:'+i,quantity:q})).join('');grid.appendChild(box);
 }
 function close(){for(const p of popups)p.remove();popups=[];lobby?.remove();lobby=null;hub?.remove();hub=null}
 window.TthUI={init(ctx){c=ctx},load,open:async(boss)=>{try{await openHub();if(boss!==undefined)await openLobby(boss)}catch(e){c.toast(e.message)}},close,isOpen:()=>!!hub,data:()=>data,fmtDamage};
})();
