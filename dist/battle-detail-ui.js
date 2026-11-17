/* Thống kê trận đấu — PopupBattleDetail gốc (scene 1176) dựng bằng PrefabDOM.
 *   Body: ImageTitle (Bên tấn công / Bên phòng thủ) · TabManager: TabDamage (sát thương gây ra), TabHurt (sát thương phải chịu),
 *   TabHeal (máu hồi cho đồng đội) · GroupAttacker / GroupDefender: mỗi tướng một CellDetailBattle (HeroHeadUI, TextValue, Slider).
 *   Số liệu cộng từ sự kiện trận của server: damage + execute (Trảm Sát) theo actor / target, heal theo actor.
 *   Thanh của mỗi dòng = giá trị / giá trị lớn nhất của cả hai bên ở tab đang xem.
 * Gọi: BattleDetailUI.init(ctx) một lần; BattleDetailUI.open(battle, {events}) mở popup (events mặc định là battle.events).
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640,cellH=65;
 let c=null,src=null,layer=null,tab='damage',current=null;
 const deep=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=deep(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const pic=(n,key)=>{const x=comp(n,'Image');if(x&&key){x.asset=key;x.color=[1,1,1,1]}};
 const strip=n=>{n.components=(n.components||[]).filter(x=>!['HorizontalLayoutGroup','VerticalLayoutGroup','ContentSizeFitter','LayoutElement'].includes(x.type));for(const k of n.children||[])strip(k)};
 const place=(n,{x=0,y=0,w,h})=>{n.transform={...n.transform,m_AnchorMin:{x:.5,y:.5},m_AnchorMax:{x:.5,y:.5},m_Pivot:{x:.5,y:.5},m_AnchoredPosition:{x,y},...(w?{m_SizeDelta:{x:w,y:h}}:{})}};
 const tabs=[['damage','TabDamage'],['hurt','TabHurt'],['heal','TabHeal']];

 /** Tổng theo đơn vị: damage (gây ra), hurt (phải chịu), heal (hồi cho người khác hoặc bản thân). */
 function tally(events){
  const sum={damage:{},hurt:{},heal:{}},add=(k,id,v)=>{if(id&&v>0)sum[k][id]=(sum[k][id]||0)+v};
  for(const e of events||[]){
   if(e.type==='damage'||e.type==='execute'){const v=e.miss||e.immune?0:Number(e.amount)||0;add('damage',e.actor,v);add('hurt',e.target,v)}
   else if(e.type==='heal')add('heal',e.actor,Number(e.amount)||0);
  }
  return sum;
 }
 /** Đơn vị hai bên: trận đội hình dùng battle.allies, trận một tướng dùng battle.hero. */
 function sides(b){
  const allies=b.allies?.length?b.allies:b.hero?[{...b.hero,id:'hero'}]:[];
  return{attacker:allies,defender:b.enemies||[]};
 }
 function headCell(n,u){
  const info=c.unit(u)||{},hh=deep(n,'HeroHeadUI');on(deep(n,'PetHeadUI'),false);on(deep(n,'GoHeroHead'),true);
  pic(deep(hh,'ImageHead'),info.head);txt(deep(hh,'TextLevel'),u.level||1);
  const faction=deep(hh,'ImageFaction');if(u.faction)pic(faction,c.named('faction_'+u.faction));else on(faction,false);
  for(const name of ['ImageHidden','Check','Lock','Death','SliderHp','ImageNotify'])on(deep(hh,name),false);
  // Sao: 1-5 vàng (GroupStar1), 6-9 tím (GroupStar6), từ 10 trở lên dùng huy hiệu cánh (GroupStarE) ghi số.
  const s=Math.max(0,Number(u.stars)||0),g1=deep(hh,'GroupStar1'),g6=deep(hh,'GroupStar6');
  on(g1,s>0&&s<=5);on(g6,s>=6&&s<=9);on(deep(hh,'GroupStar10'),false);on(deep(hh,'GroupStarE'),s>=10);
  (g1?.children||[]).forEach((k,i)=>on(k,i<s));(g6?.children||[]).forEach((k,i)=>on(k,i<s-5));
  if(s>=10)txt(deep(hh,'TextStarE'),s>=15?'L'+(s-14):s-9);
  n.detailName=info.name||u.name||'';
 }
 function render(){
  if(!current)return;const {battle,events}=current,sum=tally(events)[tab],{attacker,defender}=sides(battle);
  const max=Math.max(1,...[...attacker,...defender].map(u=>sum[u.id]||0));
  const n=structuredClone(src.roots[0]);strip(n);
  n.transform={...n.transform,m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0}};
  const body=deep(n,'Body');
  for(const [key,name] of tabs){const t=deep(body,name);on(deep(t,'ImageOn'),key===tab);on(deep(t,'ImageOff'),key!==tab);t.detailTab=key}
  const templates={attacker:deep(body,'CellDetailBattleAttacker'),defender:deep(body,'CellDetailBattleDefender')};
  const groups={attacker:deep(body,'GroupAttacker'),defender:deep(body,'GroupDefender')};
  body.children=body.children.filter(k=>k!==templates.attacker&&k!==templates.defender);
  for(const side of ['attacker','defender']){
   const g=groups[side],gx=g.transform.m_AnchoredPosition.x,gy=g.transform.m_AnchoredPosition.y,top=gy+g.transform.m_SizeDelta.y/2;g.children=[];
   (side==='attacker'?attacker:defender).forEach((u,i)=>{
    const cell=structuredClone(templates[side]);cell.name='Cell_'+side+'_'+i;on(cell,true);place(cell,{x:gx,y:top-cellH/2-4-i*(cellH+2),w:430,h:cellH});
    headCell(cell,u);const v=Math.round(sum[u.id]||0);txt(deep(cell,'TextValue'),c.num(v));
    // Thanh: chiều rộng phần tô = tỉ lệ so với giá trị lớn nhất; trống thì ẩn phần tô.
    const slider=deep(cell,'Slider'),fill=deep(slider,'Fill');
    if(fill){fill.transform={...fill.transform,m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:v/max,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0}};on(fill,v>0);const img=comp(fill,'Image');if(img)img.color=side==='attacker'?[1,.62,.13,1]:[.95,.3,.25,1]}
    body.children.push(cell);
   });
  }
  deep(body,'ButtonClose').detailClose=true;
  const shade={id:'bds',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.6]}],transform:{m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5}},children:[]};
  layer?.remove();
  layer=D.render({id:'bdr',name:'BattleDetailLayer',active:true,components:[],transform:shade.transform,children:[shade,n]},W,H,{assetSrc:c.assetSrc,assets:c.assets()});
  layer.classList.add('battle-detail-layer');c.layer().appendChild(layer);
  for(const el of layer.querySelectorAll('.pd-node')){
   const node=el._node;if(!node)continue;
   if(node.detailTab){el.classList.add('pd-button');el.dataset.detailTab=node.detailTab;el.onclick=e=>{e.stopPropagation();if(tab!==node.detailTab){tab=node.detailTab;render()}}}
   if(node.detailClose){el.classList.add('pd-button');el.onclick=e=>{e.stopPropagation();close()}}
   if(node.detailName){el.title=node.detailName}
  }
  D.find(layer,'Shade').onclick=close;D.find(layer,'Body').onclick=e=>e.stopPropagation();
 }
 async function open(battle,{events}={}){
  if(!battle)return;try{src??=await fetch('scenes/1176.json').then(r=>{if(!r.ok)throw Error();return r.json()})}catch{c.toast?.('Không tải được bảng thống kê.');return}
  current={battle,events:events||battle.events||[]};tab='damage';render();
 }
 function close(){layer?.remove();layer=null;current=null}
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&layer){e.stopPropagation();close()}},true);
 window.BattleDetailUI={init:ctx=>{c=ctx},open,close,tally,isOpen:()=>!!layer};
})();
