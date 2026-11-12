/* Mê cung — SealedLand gốc (scene 38) dựng bằng PrefabDOM, luật ở server/sealed.mjs.
 *   PanelSelectFaction: vòng 6 hệ (FramesAbyss..FramesLight, "đã qua/20"), hệ đang chọn quay lên đỉnh (CircleFrames +
 *   Eff_select1), nền giữa Eff_bgr1 đổi màu theo hệ; ButtonNext / ButtonBack xoay vòng; ButtonBatlle "Bắt đầu" mở danh sách ải.
 *   PanelFactionLevels: mỗi ải một CellSealedLand (số ải, thưởng, sức mạnh thủ vệ, Khiêu chiến / Càn quét / khóa).
 *   HUD: lượt càn quét (IndexSmash) và khiêu chiến (IndexAttack), nút + mua thêm. Shop: Cửa hàng Mê cung. Help: luật.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,root=null,src=null,current=0,levels=null,busy=false;
 const factions=['abyss','shadow','fortress','forest','dark','light'];
 const nodeName={abyss:'Abyss',shadow:'Shadow',fortress:'Fortress',forest:'Forest',dark:'Dark',light:'Light'};
 const label={abyss:'Vực thẳm',shadow:'Hư ảnh',fortress:'Pháo đài',forest:'Rừng rậm',dark:'Bóng tối',light:'Ánh sáng'};
 const color={abyss:'Red',shadow:'Blue',fortress:'Brown',forest:'Green',dark:'Purple',light:'Yellow'};
 // Vị trí 6 khung trên vòng (theo prefab gốc), ô 0 là đỉnh.
 const slots=[[0,315],[273,158],[272,-158],[0,-316],[-274,-158],[-274,159]];
 const deep=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=deep(k,name);if(r)return r}return null};
 const kid=(n,path)=>path.split('/').reduce((x,p)=>x&&(x.children||[]).find(k=>k.name===p),n);
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const pic=(n,key)=>{const x=comp(n,'Image');if(x&&key)x.asset=key};
 const tag=(n,v)=>{if(n)n.seal=v;return n};
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5},m_LocalScale:{x:1,y:1,z:1}};
 const p=()=>c.player(),v=()=>p().sealed;
 async function open(faction,showLevels=false){
  try{src??=await fetch('scenes/38.json').then(r=>r.json());if(!v()?.unlocked)return c.toast(`Yêu cầu cấp độ ${v()?.minLevel||25}`);
   if(faction)current=factions.indexOf(faction);levels=showLevels?factions[current]:null;render()}catch(e){c.toast(e.message)}
 }
 function render(){
  const n=structuredClone(src.roots.find(r=>r.name==='Canvas')),s=v(),f=factions[current];n.transform={...full};n.components=[];
  tag(deep(n,'GroupTopLeft')?.children[0],{act:'back'});tag(deep(n,'Help'),{act:'help'});tag(deep(n,'Shop'),{act:'shop'});
  // HUD
  txt(deep(n,'TextSmash'),s.smash);txt(deep(deep(n,'IndexAttack'),'TextAttack'),s.attack);tag(deep(n,'ButtonBuySmash'),{act:'buy',kind:'smash'});tag(deep(n,'ButtonBuyAttack'),{act:'buy',kind:'attack'});
  // Vòng chọn hệ
  const sel=deep(n,'PanelSelectFaction'),wheel=kid(sel,'ImageSelec');on(sel,!levels);
  for(const [i,fx] of factions.entries()){const fr=kid(wheel,'Frames'+nodeName[fx]),slot=slots[(i-current+6)%6];fr.transform={...fr.transform,m_AnchoredPosition:{x:slot[0],y:slot[1]}};
   txt(deep(fr,'textLevel'+nodeName[fx]),`${s.cleared[fx]}/${s.levels}`);tag(fr,{act:'pick',i});fr.sealPick=fx===f}
  txt(deep(sel,'TextBattle'),`${label[f]}`);tag(deep(sel,'ButtonBatlle'),{act:'levels'});
  tag(kid(sel,'NextBack/ButtonNext'),{act:'rotate',d:1});tag(kid(sel,'NextBack/ButtonBack'),{act:'rotate',d:-1});
  for(const name of ['SpineEffectCenter','SpineEffectGlow']){const sp=deep(sel,name),m=kid(sp,'Mesh');on(m,true);const sk=comp(kid(m,'Skeleton'),'SkeletonGraphic');if(sk)sk.animation=name==='SpineEffectCenter'?color[f]:'Idle'}
  // Danh sách ải
  const panel=deep(n,'PanelFactionLevels');on(panel,!!levels);
  if(levels){const tpl=deep(panel,'CellSealedLand'),content=kid(deep(panel,'ScrollCenter'),'ViewPort/Content');panel.children=panel.children.filter(k=>k!==tpl);
   const list=s.factions[levels].map(l=>cell(tpl,l)),height=list.length*121+12;
   content.transform={...content.transform,m_AnchorMin:{x:0,y:1},m_AnchorMax:{x:1,y:1},m_Pivot:{x:.5,y:1},m_AnchoredPosition:{x:0,y:0},m_SizeDelta:{x:0,y:height}};
   content.components=[{type:'VerticalLayoutGroup',spacing:6,padding:[0,0,6,6],align:1,controlWidth:false,forceWidth:false}];content.children=list}
  const old=root?.querySelector('[data-name="ViewPort"]')?.scrollTop;root?.remove();const spines=[];
  root=D.render(n,W,H,{assetSrc:c.assetSrc,assets:c.assets(),onSkeleton:(e,sk)=>spines.push({e,sk})});root.classList.add('sealed-layer');if(levels)root.classList.add('sealed-levels');c.layer().appendChild(root);
  // Eff_select1 (vòng sáng ở đỉnh) dùng blend additive mà trình vẽ Spine chưa hỗ trợ (lộ khung nền) nên không vẽ; hệ đang chọn có viền sáng CSS.
  for(const {e,sk} of spines){if(!sk.skeleton||e.closest('[style*="display: none"]'))continue;if(e.closest('[data-name="SpineEffectGlow"]'))continue;const big=e.closest('[data-name="SpineEffectCenter"]'),cv=document.createElement('canvas');cv.width=cv.height=big?520:220;cv.className='sealed-spine';e.appendChild(cv);c.spine(cv,{skeleton:sk.skeleton,animation:sk.animation},{loop:true,fit:big?1:.95})}
  for(const x of root.querySelectorAll('.pd-node')){const t=x._node?.seal;if(t){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();handle(t)}}
   if(x._node?.sealPick)x.classList.add('sealed-picked');
   const r=x._node?.sealRewards;if(r){const box=document.createElement('div');box.className='sealed-rewards';box.innerHTML=r.map(c.rewardTile).join('');x.appendChild(box)}
   const st=x._node?.sealState;if(st)x.classList.add('sealed-'+st)}
  if(levels){const vp=root.querySelector('[data-name="ViewPort"]');if(vp){if(old!==undefined)vp.scrollTop=old;else{const cur=root.querySelector('.sealed-challenge');if(cur)vp.scrollTop=Math.max(0,cur.offsetTop-120)}}
   const head=document.createElement('div');head.className='sealed-title';head.innerHTML=`<img src="${c.assetSrc(c.named('faction_'+levels))}" alt="">${c.escape(I2('LBL_SEALAND','Mê cung'))} · ${c.escape(label[levels])} <b>${s.cleared[levels]}/${s.levels}</b>`;root.appendChild(head)}
 }
 function cell(tpl,l){
  const n=structuredClone(tpl);on(n,true);n.sealState=l.state;txt(kid(n,'IndexMap'),l.level);txt(deep(n,'TextPower'),c.num(l.power));
  n.sealRewards=l.state==='smash'?l.smash:l.challenge;const g=kid(n,'GroupRewards');g.children=[];g.components=[];g.sealRewards=n.sealRewards;delete n.sealRewards;
  const btn=kid(n,'ButtonAttack');on(btn,l.state!=='locked');on(kid(n,'Lock'),l.state==='locked');
  txt(kid(btn,'TextAttack'),l.state==='smash'?I2('LBL_SMASH','Càn quét'):I2('LBL_CHALLENGE','Khiêu chiến'));pic(kid(btn,'IconRes'),c.named(l.state==='smash'?'icon_seal_smash':'icon_seal_challenge'));txt(deep(btn,'TextIndexChallenge'),1);
  if(l.state==='smash')pic(btn,c.named('button_green'));tag(btn,{act:l.state,level:l.level});tag(kid(n,'Lock'),{act:'locked',level:l.level});
  return n;
 }
 async function act(body){if(busy)return null;busy=true;try{return await c.mutation('/api/sealed',body,{render:false,close:false,message:false})}finally{busy=false;if(root)render()}}
 async function handle(t){
  const s=v(),f=factions[current];
  if(t.act==='back'){if(levels){levels=null;return render()}close();return}
  if(t.act==='rotate'){current=(current+t.d+6)%6;return render()}
  if(t.act==='pick'){if(t.i===current){levels=f;return render()}current=t.i;return render()}
  if(t.act==='levels'){levels=f;return render()}
  if(t.act==='locked')return c.toast(`Hãy vượt qua ải ${t.level-1} trước.`);
  if(t.act==='help')return c.modal(I2('LBL_SEALAND','Mê cung'),`<p class="item-description">${c.escape(I2('MSG_TUTORIAL_ACTION_SEALAND','Mau mau đánh bại thủ vệ để nhận kho báu trong mê cung'))}.</p>
   <p class="item-description">• Mê cung có 6 vùng theo hệ, mỗi vùng ${s.levels} ải. Chỉ thuyền viên cùng hệ với vùng mới được ra trận.</p>
   <p class="item-description">• Khiêu chiến ải kế tiếp tốn 1 lượt khiêu chiến; thắng sẽ mở ải sau và nhận thưởng khiêu chiến.</p>
   <p class="item-description">• Ải đã vượt qua có thể Càn quét (tốn 1 lượt càn quét) để nhận thưởng ngay không cần đánh.</p>
   <p class="item-description">• Mỗi ngày có 5 lượt khiêu chiến và 5 lượt càn quét, mua thêm bằng kim cương. Sách phong ấn dùng để đổi vật phẩm ở Cửa hàng Mê cung.</p>`);
  if(t.act==='shop'){close();await c.navigate(1404);window.ShopUI?.open('sealed');return}
  if(t.act==='buy'){const smash=t.kind==='smash',left=smash?s.buySmashLeft:s.buyAttackLeft,fee=smash?s.feeSmash:s.feeAttack;if(left<=0)return c.toast('Đã hết lượt mua hôm nay.');
   return c.confirm(`Mua 1 lượt ${smash?'càn quét':'khiêu chiến'} với ${fee} kim cương? (còn ${left} lượt mua)`,smash?'Càn quét':'Khiêu chiến',fee,()=>act({op:'buy',kind:t.kind}))}
  if(t.act==='smash'){if(s.smash<=0)return handle({act:'buy',kind:'smash'});const r=await act({op:'smash',faction:levels,level:t.level});if(r)c.bonusPopup(r.result?.rewards||[]);return}
  if(t.act==='challenge')return challenge(levels,t.level);
 }
 function challenge(f,level){
  const s=v();if(s.attack<=0)return handle({act:'buy',kind:'attack'});
  const allow=p().heroes.filter(h=>c.faction(h.id)===f).map(h=>h.id);if(!allow.length)return c.toast(`Chưa có thuyền viên hệ ${label[f]}.`);
  const saved=(s.lineups[f]||[]).map(id=>allow.includes(id)?id:null),slots=saved.some(Boolean)?saved:[...allow.slice(0,6),null,null,null,null,null,null].slice(0,6);
  c.pickTeam(`${I2('LBL_SEALAND','Mê cung')} · ${label[f]} · Ải ${level}`,async team=>{
   const r=await c.mutation('/api/sealed/fight',{faction:f,level,formation:team},{close:false,render:false,message:false});if(r){close();await c.navigate(9)}
  },{allow,slots,note:`Chỉ thuyền viên hệ ${label[f]} được ra trận. Mỗi trận tốn 1 lượt khiêu chiến.`});
 }
 function close(){root?.remove();root=null}
 window.SealedUI={init(ctx){c=ctx},open,close,isOpen:()=>!!root};
})();
