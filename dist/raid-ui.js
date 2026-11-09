/* Chiến dịch (Event Raid gốc) dựng nguyên prefab bằng PrefabDOM:
 *   PopupEventRaid (1444): 3 thẻ Beli / Nguyên liệu / Mảnh hải tặc, nút Vào, nút ? (trợ giúp từng loại).
 *   PopupListRaidChallenge (1421): "Lượt đánh x/y" + mua lượt, danh sách CellRaidChallenge (1069): số mức, phần thưởng,
 *   lực chiến, Đánh / Càn quét (mức đã thắng) hoặc nút xám "Cấp N mở".
 *   Tiêu đề danh sách theo ảnh gốc: Cướp Xu / Nguyên liệu / Anh Hùng.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,state=null,root=null,list=null,mode=null;const cache={};
 const scene=id=>cache[id]??=fetch(`scenes/${id}.json`).then(r=>{if(!r.ok)throw Error('Không tải được giao diện.');return r.json()});
 const kid=(n,path)=>path.split('/').reduce((x,p)=>x&&(x.children||[]).find(k=>k.name===p),n);
 const find=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=find(k,name);if(r)return r}return null};
 // 'ButtonLocked/Text': tìm nút ở bất kỳ độ sâu nào rồi đi tiếp theo đường dẫn con.
 const deep=(n,path)=>{const [first,...rest]=path.split('/');const x=find(n,first);return rest.length?kid(x,rest.join('/')):x};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const clone=n=>structuredClone(n);
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const shell=n=>({id:'raid',name:'RaidPopup',active:true,components:[],transform:{m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0}},
  children:[{id:'shade',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.55]}],transform:{m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0}},children:[]},n]});
 const mount=(n,cls)=>{const el=D.render(shell(n),W,H,opts());el.classList.add('raid-layer',cls);c.layer().appendChild(el);return el};
 const bind=(el,path,f)=>{const x=typeof path==='string'?D.find(el,path):path;if(x){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();f(e)}}return x};
 async function refresh(){state=await c.api('/api/raid');return state}
 const help=m=>c.modal(m.name,`<p class="item-description">${c.escape(m.help+'\n'+state.help)}</p>`);

 async function openHub(){
  const [s]=await Promise.all([scene(1444),refresh()]);close();const n=clone(s.roots[0]);txt(deep(n,'TextTitle'),'Chiến dịch');on(deep(n,'ImageBox'),false);
  const cards=[['ImageGold','gold'],['ImageSpirit','spirit'],['ImageHero','hero']];
  for(const [name,id] of cards){const card=deep(n,name),m=state.modes.find(x=>x.id===id);txt(kid(card,'TextName'),m.name);txt(deep(card,'ButtonEnter/Text'),m.open?'Vào':`Cấp ${m.minLevel} mở`);card.raidMode=id}
  root=mount(n,'raid-hub');bind(root,D.find(root,'ButtonClose'),close);bind(root,'Shade',close);
  for(const [name,id] of cards){const card=D.find(root,name),m=state.modes.find(x=>x.id===id);if(!m.open)card.classList.add('raid-locked');
   bind(card,D.find(card,'ButtonEnter'),()=>m.open?openList(id):c.toast(`Cấp ${m.minLevel} sẽ được mở khiêu chiến ${m.name}.`));bind(card,D.find(card,'ButtonHelp'),()=>help(m))}
 }
 async function openList(id,keep){
  mode=id;const [s]=await Promise.all([scene(1421),scene(1069),keep?state:refresh()]),cellScene=await scene(1069),m=state.modes.find(x=>x.id===id);
  const n=clone(s.roots[0]);txt(deep(n,'TextTitle'),m.title);const cap=deep(n,'TextTurnCap');txt(cap,'Lượt đánh');if(cap)cap.transform={...cap.transform,m_SizeDelta:{...cap.transform.m_SizeDelta,x:112}};txt(deep(n,'TextTurn'),`${m.turns}/${m.maxTurns}`);
  const tpl=cellScene.roots[0],content=deep(deep(n,'ScrollView'),'Content');
  content.children=m.levels.map(l=>{const cell=on(clone(tpl));cell.transform={...cell.transform,m_AnchoredPosition:{x:0,y:0}};txt(kid(cell,'TextIndex'),l.index);txt(deep(cell,'TextPower'),c.short(l.power));
   const group=kid(cell,'GroupReward');group.children=[];cell.raidLevel=l;
   on(kid(cell,'GroupBattle'),l.open);on(kid(cell,'GroupLocked'),!l.open);txt(deep(cell,'ButtonLocked/Text'),`Cấp ${l.unlock} mở`);
   txt(deep(cell,'ButtonBattle/Text'),'Đánh');txt(deep(cell,'ButtonSmash/Text'),'Càn quét');on(deep(cell,'ButtonSmash'),l.open&&l.index<=m.cleared);return cell});
  content.transform={...content.transform,m_AnchorMin:{x:0,y:1},m_AnchorMax:{x:1,y:1},m_Pivot:{x:.5,y:1},m_SizeDelta:{x:0,y:m.levels.length*120+10}};
  content.components=[{type:'VerticalLayoutGroup',spacing:10,padding:[0,0,6,6],align:1}];
  const old=list,scroll=old?.querySelector('[data-name="Viewport"]')?.scrollTop||0;list=mount(n,'raid-list');old?.remove();
  const vp=list.querySelector('[data-name="Viewport"]');if(vp&&keep)vp.scrollTop=scroll;
  const back=()=>{list.remove();list=null;openHub()};bind(list,D.find(list,'ButtonClose'),back);bind(list,'Shade',back);
  bind(list,D.find(list,'ButtonBuyTurn'),()=>buy(m));
  for(const x of list.querySelectorAll('.pd-node')){const l=x._node?.raidLevel;if(!l)continue;
   const g=D.find(x,'GroupReward'),box=document.createElement('div');box.className='raid-rewards';box.innerHTML=l.rewards.map(r=>c.rewardTile(r)).join('');g.appendChild(box);
   bind(x,D.find(x,'ButtonBattle'),()=>fight(m,l));bind(x,D.find(x,'ButtonSmash'),()=>smash(m,l));bind(x,D.find(x,'ButtonLocked'),()=>c.toast(`Cấp ${l.unlock} mở`))}
 }
 function buy(m){
  if(m.boughtToday>=state.buyLimit)return c.toast('Đã hết lượt mua hôm nay.');
  c.confirm(`Mua thêm 1 lượt khiêu chiến ${m.name}? (Đã mua hôm nay: ${m.boughtToday}/${state.buyLimit})`,'Mua lượt đánh',state.buyPrice,async()=>{
   const d=await c.mutation('/api/raid/buy',{mode:m.id},{render:false});if(d)openList(m.id)});
 }
 async function fight(m,l){
  if(m.turns<=0)return buy(m);
  const d=await c.mutation('/api/raid/start',{mode:m.id,level:l.index},{render:false,message:false,bonus:false});if(!d)return;
  if(d.player.battle?.status==='active'){close();c.navigate(9)}
 }
 async function smash(m,l){if(m.turns<=0)return buy(m);const d=await c.mutation('/api/raid/smash',{mode:m.id,level:l.index},{render:false});if(d)openList(m.id)}
 function close(){root?.remove();root=null;list?.remove();list=null}
 window.RaidUI={init(ctx){c=ctx},async open(m){try{if(m){await refresh();await openList(m,true)}else await openHub()}catch(e){c.toast(e.message)}},close,mode:()=>mode};
})();
