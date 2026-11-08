/* Dựng prefab gốc (cây node xuất từ Unity: RectTransform + Image / Text / Outline / layout group / ScrollRect...)
 * thành DOM đặt tuyệt đối, đúng anchor, pivot, kích thước và tỉ lệ như Unity. Dùng cho các màn Lua có danh sách cuộn
 * và chữ nhiều dòng (Trái Ác Quỷ). Mỗi phần tử có data-name; PrefabDOM.find(el,'A/B/C') tìm theo đường tên con.
 */
(()=>{
 'use strict';
 const fonts=new Set();
 const loadFont=f=>{if(!f?.family||fonts.has(f.family)||typeof FontFace==='undefined')return;fonts.add(f.family);new FontFace(f.family,`url(${JSON.stringify(f.src)})`).load().then(face=>document.fonts.add(face)).catch(()=>{})};
 const css=c=>`rgba(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)},${c[3]??1})`;
 const get=(n,type)=>n.components?.find(c=>c.type===type);
 const escapeHtml=s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[ch]);
 /** Rich text Unity: <color=#xxxxxx>, <b>, <i>, <size=n> và xuống dòng. */
 function richText(text,rich){
  const safe=escapeHtml(text??'');
  if(!rich)return safe.replace(/\n/g,'<br>');
  return safe.replace(/&lt;color=(#?[0-9a-zA-Z]+)&gt;/g,'<span style="color:$1">').replace(/&lt;\/color&gt;/g,'</span>')
   .replace(/&lt;b&gt;/g,'<b>').replace(/&lt;\/b&gt;/g,'</b>').replace(/&lt;i&gt;/g,'<i>').replace(/&lt;\/i&gt;/g,'</i>')
   .replace(/&lt;size=(\d+)&gt;/g,'<span style="font-size:$1px">').replace(/&lt;\/size&gt;/g,'</span>').replace(/\n/g,'<br>');
 }
 /** Khung của node trong cha (pw × ph), gốc trên-trái như CSS. */
 function rect(t,pw,ph){
  const a0=t.m_AnchorMin||{x:.5,y:.5},a1=t.m_AnchorMax||{x:.5,y:.5},pv=t.m_Pivot||{x:.5,y:.5},pos=t.m_AnchoredPosition||{x:0,y:0},sd=t.m_SizeDelta||{x:0,y:0};
  const w=(a1.x-a0.x)*pw+sd.x,h=(a1.y-a0.y)*ph+sd.y;
  const px=(a0.x+(a1.x-a0.x)*pv.x)*pw+pos.x,py=(a0.y+(a1.y-a0.y)*pv.y)*ph+pos.y;
  return{x:px-pv.x*w,y:ph-(py-pv.y*h)-h,w,h,pivot:pv};
 }
 const alignment=a=>({h:['flex-start','center','flex-end'][a%3],v:['flex-start','center','flex-end'][Math.floor(a/3)],text:['left','center','right'][a%3]});
 /** Layout group: trả khung mới cho từng con đang bật (theo thứ tự). */
 function layoutChildren(n,w,h){
  const g=n.components?.find(c=>/LayoutGroup$/.test(c.type));if(!g)return null;
  const kids=n.children.filter(c=>c.active),[pl,pr,pt,pb]=g.padding||[0,0,0,0],al=alignment(g.align||0),out=new Map();
  if(g.type==='GridLayoutGroup'){
   const [cw,ch]=g.cell,[sx,sy]=g.spacing,cols=g.constraint===1?g.constraintCount:g.constraint===2?Math.ceil(kids.length/Math.max(1,g.constraintCount)):Math.max(1,Math.floor((w-pl-pr+sx)/(cw+sx)));
   const rows=Math.ceil(kids.length/cols),usedW=Math.min(cols,kids.length)*(cw+sx)-sx,usedH=rows*(ch+sy)-sy;
   const ox=pl+(al.h==='center'?(w-pl-pr-usedW)/2:al.h==='flex-end'?w-pl-pr-usedW:0),oy=pt+(al.v==='center'?(h-pt-pb-usedH)/2:al.v==='flex-end'?h-pt-pb-usedH:0);
   kids.forEach((c,i)=>out.set(c,{x:ox+(i%cols)*(cw+sx),y:oy+Math.floor(i/cols)*(ch+sy),w:cw,h:ch}));
   return{map:out,contentH:usedH+pt+pb};
  }
  // Horizontal / Vertical như Unity: LayoutElement.ignoreLayout bỏ qua; kích thước ưu tiên = LayoutElement.preferred (hoặc min)
  // rồi sizeDelta; childControl* thì đặt kích thước, childForceExpand* thì chia phần dư (khi không điều khiển: chỉ giãn khoảng).
  const vertical=g.type==='VerticalLayoutGroup',sp=g.spacing||0,lay=kids.filter(c=>!get(c,'LayoutElement')?.ignore);
  const pref=(c,axis)=>{const le=get(c,'LayoutElement'),k=axis==='x'?'Width':'Height';for(const v of [le?.['preferred'+k],le?.['min'+k]])if(v>=0)return v;return (fitted(c).m_SizeDelta||{x:0,y:0})[axis]};
  const flex=(c,axis)=>Math.max(0,get(c,'LayoutElement')?.[axis==='x'?'flexibleWidth':'flexibleHeight']||0);
  const mainAxis=vertical?'y':'x',crossAxis=vertical?'x':'y',controlMain=vertical?g.controlHeight:g.controlWidth,forceMain=vertical?g.forceHeight:g.forceWidth,
   controlCross=vertical?g.controlWidth:g.controlHeight,forceCross=vertical?g.forceWidth:g.forceHeight,room=vertical?h-pt-pb:w-pl-pr,roomCross=vertical?w-pl-pr:h-pt-pb;
  const sizes=lay.map(c=>{const sd=fitted(c).m_SizeDelta||{x:0,y:0},main=controlMain?pref(c,mainAxis):sd[mainAxis],cross=controlCross?(forceCross?roomCross:pref(c,crossAxis)):sd[crossAxis];return vertical?{w:cross,h:main}:{w:main,h:cross}});
  let total=sizes.reduce((sum,s)=>sum+(vertical?s.h:s.w),0)+sp*Math.max(0,lay.length-1);
  if(room>total&&lay.length){
   if(controlMain){const weights=lay.map(c=>forceMain?Math.max(1,flex(c,mainAxis)):flex(c,mainAxis)),sum=weights.reduce((a,b)=>a+b,0);
    if(sum>0){const left=room-total;sizes.forEach((s,i)=>{const add=left*weights[i]/sum;if(vertical)s.h+=add;else s.w+=add});total=room}}
   else if(forceMain){const extra=(room-total)/lay.length;total=room;sizes.forEach(s=>{s.slot=(vertical?s.h:s.w)+extra})}
  }
  let cursor=vertical?pt+(al.v==='center'?(h-pt-pb-total)/2:al.v==='flex-end'?h-pt-pb-total:0):pl+(al.h==='center'?(w-pl-pr-total)/2:al.h==='flex-end'?w-pl-pr-total:0);
  lay.forEach((c,i)=>{const s=sizes[i];
   const inSlot=s.slot?(vertical?(al.v==='center'?(s.slot-s.h)/2:al.v==='flex-end'?s.slot-s.h:0):(al.h==='center'?(s.slot-s.w)/2:al.h==='flex-end'?s.slot-s.w:0)):0;
   if(vertical){const x=pl+(al.h==='center'?(w-pl-pr-s.w)/2:al.h==='flex-end'?w-pl-pr-s.w:0);out.set(c,{x,y:cursor+inSlot,w:s.w,h:s.h});cursor+=(s.slot||s.h)+sp}
   else{const y=pt+(al.v==='center'?(h-pt-pb-s.h)/2:al.v==='flex-end'?h-pt-pb-s.h:0);out.set(c,{x:cursor+inSlot,y,w:s.w,h:s.h});cursor+=(s.slot||s.w)+sp}});
  return{map:out,contentH:vertical?total+pt+pb:h};
 }
 function paintImage(host,c,assetSrc,assets){
  const color=c.color||[1,1,1,1],info=c.asset?assets?.[c.asset]:null;
  if(!c.asset){if(color[3]>0&&!c.noFill)host.style.background=css(color);return}
  // Màu nhân / alpha của Image chỉ áp lên chính ảnh, không lên các node con: vẽ ảnh ở một lớp nền riêng.
  // Ảnh 9-slice (border-image) cũng ở lớp riêng, nếu không viền CSS sẽ đẩy các node con lệch theo độ dày viền.
  const sliced=c.mode===1&&info?.border?.some(v=>v>0);
  let el=host;if(sliced||color[3]<1||color[0]<.99||color[1]<.99||color[2]<.99){el=document.createElement('div');el.className='pd-image';Object.assign(el.style,{position:'absolute',inset:'0',pointerEvents:'none'});host.prepend(el)}
  const url=`url('${assetSrc(c.asset)}')`,border=info?.border;
  const tinted=color[0]<.99||color[1]<.99||color[2]<.99;
  if(c.mode===1&&border&&border.some(v=>v>0)&&!tinted){
   const [l,b,r,t]=border;el.style.borderStyle='solid';el.style.borderColor='transparent';el.style.borderWidth=`${t}px ${r}px ${b}px ${l}px`;el.style.borderImage=`${url} ${t} ${r} ${b} ${l} fill stretch`;el.style.boxSizing='border-box';
  }else{
   el.style.backgroundImage=url;el.style.backgroundRepeat='no-repeat';el.style.backgroundPosition='center';el.style.backgroundSize=c.preserve?'contain':'100% 100%';
   if(tinted){el.style.backgroundColor=css([color[0],color[1],color[2],1]);el.style.backgroundBlendMode='multiply';el.style.webkitMaskImage=url;el.style.maskImage=url;el.style.webkitMaskSize=el.style.maskSize=c.preserve?'contain':'100% 100%';el.style.webkitMaskRepeat=el.style.maskRepeat='no-repeat';el.style.webkitMaskPosition=el.style.maskPosition='center'}
  }
  if(color[3]<1)el.style.opacity=String(color[3]);
 }
 function paintText(el,n,c){
  loadFont(c.font);const al=alignment(c.align||0),outline=get(n,'Outline')||get(n,'Shadow');
  const span=document.createElement('span');span.className='pd-text';span.innerHTML=richText(c.text,c.rich);
  Object.assign(el.style,{display:'flex',justifyContent:al.h,alignItems:al.v,textAlign:al.text,color:css(c.color||[0,0,0,1]),fontFamily:`${c.font?.family||'GameFont'},GameFont,sans-serif`,fontSize:(c.size||14)+'px',lineHeight:String(c.lineSpacing||1.15),whiteSpace:c.overflow===1?'nowrap':'normal',fontWeight:c.style===1||c.style===3?'bold':'normal',fontStyle:c.style>=2?'italic':'normal'});
  if(outline){const o=css(outline.color||[0,0,0,1]),d=Math.max(1,Math.abs(outline.distance?.[0]||1));el.style.textShadow=outline.type==='Shadow'?`${d}px ${d}px 0 ${o}`:`${d}px 0 0 ${o},-${d}px 0 0 ${o},0 ${d}px 0 ${o},0 -${d}px 0 ${o},${d}px ${d}px 0 ${o},-${d}px -${d}px 0 ${o},${d}px -${d}px 0 ${o},-${d}px ${d}px 0 ${o}`}
  // Tràn ngang (Overflow): chữ rộng theo nội dung, căn theo neo nên chữ căn phải tràn sang trái như Unity.
  if(c.overflow===1)Object.assign(span.style,{width:'max-content',flexShrink:'0',whiteSpace:'nowrap'});
  el.appendChild(span);
 }
 /** ContentSizeFitter (PreferredSize = 2) với Horizontal/Vertical layout: kích thước = tổng con + khoảng cách + đệm. */
 function fitted(n){
  const f=get(n,'ContentSizeFitter'),g=n.components?.find(c=>c.type==='HorizontalLayoutGroup'||c.type==='VerticalLayoutGroup');
  if(!f||!g||!(f.horizontal===2||f.vertical===2))return n.transform||{};
  const kids=n.children.filter(c=>c.active&&!get(c,'LayoutElement')?.ignore),sz=kids.map(c=>{const le=get(c,'LayoutElement'),s=c.transform?.m_SizeDelta||{x:0,y:0};return{x:le?.preferredWidth>=0?le.preferredWidth:s.x,y:le?.preferredHeight>=0?le.preferredHeight:s.y}}),[pl,pr,pt,pb]=g.padding||[0,0,0,0],sp=g.spacing||0,h=g.type==='HorizontalLayoutGroup';
  const along=sz.reduce((t,s)=>t+(h?s.x:s.y),0)+sp*Math.max(0,kids.length-1),across=Math.max(0,...sz.map(s=>h?s.y:s.x));
  const w=h?along+pl+pr:across+pl+pr,hh=h?across+pt+pb:along+pt+pb,sd={...(n.transform.m_SizeDelta||{x:0,y:0})};
  if(f.horizontal===2)sd.x=w;if(f.vertical===2)sd.y=hh;return{...n.transform,m_SizeDelta:sd};
 }
 /** Dựng node (và con) vào khung `box` trong cha. options: {assetSrc, assets, onSkeleton(el,component)} */
 function build(n,box,options){
  const el=document.createElement('div');el.className='pd-node';el.dataset.name=n.name;el._node=n;
  Object.assign(el.style,{position:'absolute',left:box.x+'px',top:box.y+'px',width:box.w+'px',height:box.h+'px'});
  const t=n.transform||{},s=t.m_LocalScale||{x:1,y:1},q=t.m_LocalRotation||{z:0,w:1},angle=-2*Math.atan2(q.z||0,q.w??1)*180/Math.PI;
  if(Math.abs(s.x-1)>.001||Math.abs(s.y-1)>.001||Math.abs(angle)>.01){const pv=box.pivot||{x:.5,y:.5};el.style.transformOrigin=`${pv.x*100}% ${(1-pv.y)*100}%`;el.style.transform=`${Math.abs(angle)>.01?`rotate(${angle}deg) `:''}scale(${s.x},${s.y})`}
  for(const c of n.components||[]){
   // Image không có sprite làm Mask (Viewport) chỉ để cắt, không vẽ nền trắng.
   if(c.type==='Image'||c.type==='RawImage')paintImage(el,get(n,'Mask')&&!c.asset?{...c,noFill:true}:c,options.assetSrc,options.assets);
   else if(c.type==='Text')paintText(el,n,c);
   else if(c.type==='Button'||c.type==='Toggle'){el.classList.add('pd-button')}
   else if(c.type==='Mask'||c.type==='RectMask2D'){el.style.overflow='hidden';
    // Mask của Unity cắt theo alpha của Image (vd. khung tròn): dùng chính ảnh đó làm CSS mask.
    const im=c.type==='Mask'&&get(n,'Image');if(im?.asset&&!im.mode&&!options.assets?.[im.asset]?.border?.some(v=>v>0)&&n.name!=='Viewport'){const u=`url('${options.assetSrc(im.asset)}')`;Object.assign(el.style,{webkitMaskImage:u,maskImage:u,webkitMaskSize:'100% 100%',maskSize:'100% 100%',webkitMaskRepeat:'no-repeat',maskRepeat:'no-repeat'})}}
   else if(c.type==='SkeletonGraphic'&&c.skeleton&&options.onSkeleton)options.onSkeleton(el,c);
  }
  // Như raycast của Unity: chỉ node có Image/RawImage (hoặc nút) nhận chạm; node rỗng không che các nút bên dưới.
  el.style.pointerEvents=(n.components||[]).some(c=>c.type==='Image'||c.type==='RawImage'||c.type==='Button'||c.type==='Toggle'||c.type==='ScrollRect')?'auto':'none';
  // Ẩn sau khi vẽ component (paintText đặt display:flex).
  if(!n.active)el.style.display='none';
  if(get(n,'CanvasGroup')?.alpha<1)el.style.opacity=String(get(n,'CanvasGroup').alpha);
  // ScrollRect: Viewport cuộn được (chuột, chạm), Content cao theo nội dung.
  if(get(n,'ScrollRect'))el.classList.add('pd-scroll');
  const lay=layoutChildren(n,box.w,box.h);
  for(const child of n.children||[]){
   const r=lay?.map.get(child)||rect(fitted(child),box.w,box.h);
   el.appendChild(build(child,r,options));
  }
  if(n.name==='Viewport'&&el.parentElement===null){/* gắn ở dưới */}
  return el;
 }
 function render(node,width,height,options){
  const root=build(node,{...rect(node.transform||{},width,height),pivot:node.transform?.m_Pivot},options);
  for(const vp of root.querySelectorAll('.pd-scroll [data-name="Viewport"]')){vp.style.overflowY='auto';vp.style.overflowX='hidden';vp.style.scrollbarWidth='none';vp.classList.add('pd-viewport')}
  return root;
 }
 /** Tìm phần tử theo đường tên con: find(el,'Content/Body/TabManager/Tab1'). */
 function find(el,path){
  let cur=el;
  for(const part of path.split('/')){if(!cur)return null;cur=[...cur.children].find(c=>c.dataset?.name===part)||[...cur.querySelectorAll(`[data-name="${CSS.escape(part)}"]`)][0]||null}
  return cur;
 }
 const show=(el,on)=>{if(el)el.style.display=on?'':'none'};
 const setText=(el,text,rich=true)=>{const span=el?.querySelector(':scope>.pd-text');if(span)span.innerHTML=richText(text,rich)};
 const setImage=(el,src)=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();el.style.backgroundImage=src?`url('${src}')`:'none';el.style.borderImage='none';el.style.borderWidth='0'};
 window.PrefabDOM={render,find,show,setText,setImage,richText,loadFont};
})();
