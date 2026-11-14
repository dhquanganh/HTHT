/* Tab "Tạo nhân vật" của trang quản trị (server/custom-heroes.mjs).
 * Bảy bước: Thông tin · Sprite sheet · Hoạt ảnh · Hiệu ứng · Kỹ năng · Ảnh · Xem trước.
 *  - Sprite sheet: tải ảnh lên, tự xoá nền (loang từ mép ảnh qua các màu nền, giữ màu trắng nằm trong viền nhân vật),
 *    bỏ đường kẻ / khung trang trí, tìm khung hình theo vùng liền nhau rồi gộp các mảnh gần nhau (hào quang, khói...).
 *    Sửa tay được: kéo để vẽ khung, chọn nhiều khung để gộp, xoá khung, hút thêm màu nền.
 *  - Hoạt ảnh / Hiệu ứng: bấm khung trên sheet để nối vào chuỗi (Shift+bấm: cả hàng), chỉnh nhịp từng khung, khung trúng
 *    đòn, kéo trong ô xem để căn vị trí (có bóng mờ khung trước / tư thế đứng).
 *  - Kỹ năng: viết mô tả như tướng gốc; máy chủ đọc bằng cùng bộ đọc kỹ năng và hiện ngay cách game hiểu từng câu.
 *  - Xem trước: dựng skeleton Spine thật (dist/sprite-spine.js, giống tệp máy chủ phục vụ cho game) cạnh một tướng gốc.
 * Ảnh (sheet đã xoá nền, chân dung, biểu tượng) chỉ được tải lên khi bấm Lưu.
 */
(()=>{
 'use strict';
 const {api,upload,toast,escape,num}=window.AdminApp,$=s=>document.querySelector(s),root=$('#heroes-tab');
 const S=()=>window.SpriteSpine;
 const FACTIONS=[['fortress','Nhanh nhẹn'],['abyss','Bền bỉ'],['forest','Chính xác'],['shadow','Sinh khí'],['dark','Thông minh'],['light','Minh mẫn']];
 const CLASSES=[['warrior','Đấu Sĩ'],['mage','Chỉ Huy'],['assassin','Kiếm Sĩ'],['ranger','Xạ Thủ'],['priest','Hỗ Trợ']];
 const GRADES={1:'D',2:'C',3:'B',4:'A',5:'S',6:'SS'},gradeScale={1:.65,2:.75,3:.85,4:1,5:1.1,6:1.25};
 const classScale={warrior:{attack:.9,maxHp:1.2},mage:{attack:1.15,maxHp:.9},assassin:{attack:1.2,maxHp:.85},ranger:{attack:1.1,maxHp:.95},priest:{attack:.9,maxHp:1.05}};
 const FCOLOR={fortress:['#2f7dd1','#0b2b52'],abyss:['#d14b2f','#4a120b'],forest:['#3aa64a','#0d3313'],shadow:['#9a4fd1','#2a0d42'],dark:['#444b6e','#0e0f1c'],light:['#e2b840','#5a3d07']};
 const ANIMS=[['idling','Đứng yên',true,'Lặp liên tục khi đứng chờ.'],['beat','Đánh thường',true,'Đánh dấu ★ khung trúng đòn: số sát thương hiện đúng lúc đó.'],['skill','Tuyệt kỹ (Nộ)',false,'Bỏ trống thì dùng Đánh thường.'],['damage','Bị đánh',false,'Bỏ trống thì dùng Đứng yên.'],['dead','Chết',false,'Giữ khung cuối. Bỏ trống thì dùng Bị đánh.'],['win','Chiến thắng',false,'Bỏ trống thì dùng Đứng yên.'],['run','Chạy',false,'Bỏ trống thì dùng Đứng yên.']];
 const STEPS=[['info','1. Thông tin'],['sheet','2. Sprite sheet'],['anim','3. Hoạt ảnh'],['fx','4. Hiệu ứng'],['skills','5. Kỹ năng'],['images','6. Ảnh'],['preview','7. Xem trước']];
 const IMG={art:[576,432,'Chân dung (hồ sơ)'],thumb:[180,239,'Thẻ tướng'],head:[100,100,'Ảnh đầu']};
 let list=null,draft=null,step='info',dirty=false,assets=null,visuals=null,rt=[],curSheet=0,zoom=0,sel=new Set(),eyedrop=false,curAnim='idling',curFx=0,curFrame=-1,playing=true,port=null,busy=false;
 let nextFrame=1,gridRows=4,gridCols=8;
 // Chiều cao trung bình (đơn vị Spine) khi đứng của tướng gốc, đo bằng getBounds: phần lớn 180–250, giữa ~210 nhưng gồm cả hào quang / khói; thân nhân vật ~165.
 const HERO_H=165;
 const mark=()=>{dirty=true;const n=$('#hc-dirty');if(n)n.hidden=false};
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const loadImg=src=>new Promise((ok,no)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>ok(im);im.onerror=()=>no(Error('Không đọc được ảnh.'));im.src=src});
 const loadScript=src=>new Promise((ok,no)=>{if(document.querySelector(`script[src="${src}"]`))return ok();const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(Error('Không tải được '+src));document.head.appendChild(s)});
 const assetSrc=key=>assets?.[key]?.src||'';
 const blank=()=>({name:'Nhân vật mới',faction:'fortress',class:'warrior',rank:5,summon:false,statScale:{...defScale(5,'warrior')},stats:{attack:30000,defense:1500,maxHp:900000,speed:1200},images:{head:null,thumb:null,art:null},
  skills:[{name:'Tuyệt kỹ',icon:'skillicon-660',levels:['Nộ: Tấn công 3 kẻ địch hàng sau gây sát thương 150% Công.','Nộ: Tấn công 3 kẻ địch hàng sau gây sát thương 200% Công.','Nộ: Tấn công 3 kẻ địch hàng sau gây sát thương 250% Công.','Nộ: Tấn công 3 kẻ địch hàng sau gây sát thương 300% Công.']}],
  anim:{sheets:[],frames:[],scale:1,mirror:false,animations:{},effects:[],attack:{cast:null,impact:null,castX:1,castY:0,shake:false},skill:{cast:null,impact:null,castAt:'target',castDelay:0,shake:true}}});
 function defScale(rank,cls){const g=gradeScale[rank]||1,c=classScale[cls]||{attack:1,maxHp:1};return{attack:Math.round(g*c.attack*1000)/1000,maxHp:Math.round(g*c.maxHp*1000)/1000}}

 // ================= Xử lý sprite sheet =================
 // Màu nền: màu phủ ≥ 8% dải 12 px quanh mép ảnh, cộng màu chiếm ≥ 20% cả ảnh. Ảnh có sẵn nền trong suốt thì bỏ qua.
 function autoOpts(im){
  const {width:w,height:h,data:d}=im,band=12,hist=new Map(),all=new Map();let edge=0,clear=0;const q=i=>((d[i]>>3)<<10)|((d[i+1]>>3)<<5)|(d[i+2]>>3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4;if(d[i+3]<16){clear++;continue}
   const k=q(i);all.set(k,(all.get(k)||0)+1);
   if(x<band||y<band||x>=w-band||y>=h-band){edge++;hist.set(k,(hist.get(k)||0)+1)}}
  const total=w*h,transparent=clear>total*.05,keys=[],add=k=>{const c=[(k>>10&31)*8+4,(k>>5&31)*8+4,(k&31)*8+4];if(!keys.some(o=>Math.max(...o.map((v,j)=>Math.abs(v-c[j])))<24))keys.push(c)};
  [...hist.entries()].filter(([,n])=>n>=edge*.08).sort((a,b)=>b[1]-a[1]).slice(0,4).forEach(([k])=>add(k));
  [...all.entries()].filter(([,n])=>n>=total*.2).forEach(([k])=>add(k));
  return{transparent,keys,tol:40,gap:8,min:16};
 }
 // Xoá nền + tìm vùng liền nhau. Trả về ảnh đã xoá nền (r.canvas / r.data) và các vùng (r.comps).
 function processSheet(r){
  const {width:w,height:h,data:src}=r.original,o=r.opts,n=w*h;let out;
  // Lượt 1: nền loang từ dải mép ảnh. Nếu vẫn còn một vùng phủ gần hết sheet (nền bị viền / lưới ô bao kín),
  // lượt 2 xoá thêm mọi mảng màu nền đủ lớn dù không chạm mép.
  for(const deep of [false,true]){
   out=new Uint8ClampedArray(src);if(o.keys.length)removeBg(r,out,deep);
   findComps(r,out);if(deep||!o.keys.length)break;
   const big=r.comps.some(c=>c.w*c.h>n*.45);o.deep=big;if(!big)break;
  }
  r.data=new ImageData(out,w,h);r.canvas??=document.createElement('canvas');r.canvas.width=w;r.canvas.height=h;r.canvas.getContext('2d').putImageData(r.data,0,0);r.dirty=true;
 }
 function removeBg(r,out,deep){
  const {width:w,height:h,data:src}=r.original,o=r.opts,n=w*h;
  {
   const keys=o.keys,tol=o.tol,dist=i=>{let best=999;for(const k of keys){const v=Math.max(Math.abs(src[i]-k[0]),Math.abs(src[i+1]-k[1]),Math.abs(src[i+2]-k[2]));if(v<best)best=v}return best};
   const bg=new Uint8Array(n),queue=new Int32Array(n),isBg=p=>src[p*4+3]<16||dist(p*4)<=tol;let head=0,tail=0;
   const push=p=>{if(!bg[p]&&isBg(p)){bg[p]=1;queue[tail++]=p}};
   const flood=()=>{while(head<tail){const p=queue[head++],x=p%w;if(x>0)push(p-1);if(x<w-1)push(p+1);if(p>=w)push(p-w);if(p<n-w)push(p+w)}};
   // Gieo từ cả dải 12 px quanh mép, để viền mảnh khác màu ở mép ảnh không chặn đường loang.
   const band=Math.min(12,w>>2,h>>2);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(x>=band&&y>=band&&x<w-band&&y<h-band)continue;push(y*w+x)}
   flood();
   if(deep){
    // Mảng màu nền khép kín (ô lưới, khung bao): xoá nếu đủ lớn (≥ 0.25% sheet, ≥ 1500 px) để không ăn mảng trắng nhỏ trên người nhân vật.
    const seen=new Uint8Array(n),stack=new Int32Array(n),minArea=Math.max(1500,n*.0025);
    for(let s=0;s<n;s++){if(bg[s]||seen[s]||!isBg(s))continue;let top=0,size=0;const list=[];stack[top++]=s;seen[s]=1;
     while(top){const p=stack[--top],x=p%w;size++;list.push(p);for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,p>=w?p-w:-1,p<n-w?p+w:-1])if(q>=0&&!seen[q]&&!bg[q]&&isBg(q)){seen[q]=1;stack[top++]=q}}
     if(size>=minArea)for(const p of list)bg[p]=1}
   }
   for(let p=0;p<n;p++)if(bg[p])out[p*4+3]=0;
   // Viền khử răng cưa trộn với màu nền: tách lại màu và độ trong theo khoảng cách tới màu nền gần nhất.
   for(let p=0;p<n;p++){if(bg[p])continue;const x=p%w;if(!((x>0&&bg[p-1])||(x<w-1&&bg[p+1])||(p>=w&&bg[p-w])||(p<n-w&&bg[p+w])))continue;
    const i=p*4,dd=dist(i);if(dd>=tol*3)continue;let k=keys[0],b=999;for(const c of keys){const v=Math.max(Math.abs(src[i]-c[0]),Math.abs(src[i+1]-c[1]),Math.abs(src[i+2]-c[2]));if(v<b){b=v;k=c}}
    const a=clamp((dd-tol)/(tol*2),.12,1);for(let j=0;j<3;j++)out[i+j]=clamp((src[i+j]-(1-a)*k[j])/a,0,255);out[i+3]=Math.round(src[i+3]*a)}
  }
 }
 // Vùng liền nhau (8 hướng) trên điểm còn đủ đậm; bỏ rác.
 function findComps(r,out){
  const {width:w,height:h}=r.original,n=w*h;
  const labels=new Int32Array(n),stack=new Int32Array(n),comps=[];
  for(let p=0;p<n;p++){if(labels[p]||out[p*4+3]<=24)continue;
   const id=comps.length+1,c={x0:w,y0:h,x1:0,y1:0,count:0};let top=0;stack[top++]=p;labels[p]=id;
   while(top){const q=stack[--top],x=q%w,y=(q-x)/w;c.count++;if(x<c.x0)c.x0=x;if(x>c.x1)c.x1=x;if(y<c.y0)c.y0=y;if(y>c.y1)c.y1=y;
    for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const t=yy*w+xx;if(!labels[t]&&out[t*4+3]>24){labels[t]=id;stack[top++]=t}}}}
   comps.push(c)}
  // Rác: chấm lẻ, đường kẻ mảnh (gạch đỏ, vạch chia), khung viền trang trí rỗng ruột.
  const junk=new Uint8Array(comps.length+1);
  comps.forEach((c,i)=>{const bw=c.x1-c.x0+1,bh=c.y1-c.y0+1;if(c.count<6||(bw<=4&&bh>=10)||(bh<=4&&bw>=10)||(c.count/(bw*bh)<.03&&Math.max(bw,bh)>160))junk[i+1]=1});
  for(let p=0;p<n;p++)if(junk[labels[p]])out[p*4+3]=0;
  r.comps=comps.filter((_,i)=>!junk[i+1]).map(c=>({x:c.x0,y:c.y0,w:c.x1-c.x0+1,h:c.y1-c.y0+1}));
 }
 // Chia lưới: mỗi ô hàng × cột thành một khung, cắt sát phần có hình (dự phòng khi tự tìm khung không đúng).
 function gridSplit(s,rows,cols){
  const r=rt[s],sh=draft.anim.sheets[s];if(!r?.data)return 0;const {data,width}=r.data,cw=sh.w/cols,ch=sh.h/rows,next=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const X0=Math.round(i*cw),Y0=Math.round(j*ch),X1=Math.round((i+1)*cw),Y1=Math.round((j+1)*ch);let x0=X1,y0=Y1,x1=-1,y1=-1;
   for(let y=Y0;y<Y1;y++)for(let x=X0;x<X1;x++)if(data[(y*width+x)*4+3]>40){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
   if(x1<0||x1-x0<3||y1-y0<3)continue;const f={id:nextFrame++,s,x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};next.push({...f,...footOf(s,f)})}
  draft.anim.frames=[...draft.anim.frames.filter(f=>f.s!==s),...next];prune();sel.clear();return next.length;
 }
 // Gộp vùng gần nhau (≤ gap px) thành khung, bỏ khung quá nhỏ, xếp theo hàng từ trái sang phải.
 function boxesOf(comps,gap,min){
  let boxes=comps.map(c=>({...c})),changed=true;
  const near=(a,b)=>a.x-gap<=b.x+b.w&&b.x-gap<=a.x+a.w&&a.y-gap<=b.y+b.h&&b.y-gap<=a.y+a.h;
  while(changed){changed=false;for(let i=0;i<boxes.length;i++)for(let j=boxes.length-1;j>i;j--)if(near(boxes[i],boxes[j])){const a=boxes[i],b=boxes[j],x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);boxes[i]={x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y};boxes.splice(j,1);changed=true}}
  return sortRows(boxes.filter(b=>b.w>=min||b.h>=min));
 }
 function sortRows(boxes){
  const rows=[];for(const b of [...boxes].sort((a,b)=>a.y-b.y)){const row=rows.find(r=>b.y<r.bottom-Math.min(b.h,r.h)*.4&&b.y+b.h>r.top+Math.min(b.h,r.h)*.4);if(row){row.items.push(b);row.top=Math.min(row.top,b.y);row.bottom=Math.max(row.bottom,b.y+b.h);row.h=row.bottom-row.top}else rows.push({top:b.y,bottom:b.y+b.h,h:b.h,items:[b]})}
  return rows.sort((a,b)=>a.top-b.top).flatMap(r=>r.items.sort((a,b)=>a.x-b.x));
 }
 // Điểm chân: trọng tâm ngang của 10% hàng điểm đậm thấp nhất trong khung; đáy là hàng thấp nhất.
 function footOf(s,f){
  const r=rt[s];if(!r?.data)return{ax:f.x+f.w/2,ay:f.y+f.h};const {data,width}=r.data;let bottom=-1;
  for(let y=f.y+f.h-1;y>=f.y&&bottom<0;y--)for(let x=f.x;x<f.x+f.w;x++)if(data[(y*width+x)*4+3]>40){bottom=y;break}
  if(bottom<0)return{ax:f.x+f.w/2,ay:f.y+f.h};const band=Math.max(2,Math.round(f.h*.1));let sum=0,count=0;
  for(let y=Math.max(f.y,bottom-band);y<=bottom;y++)for(let x=f.x;x<f.x+f.w;x++)if(data[(y*width+x)*4+3]>40){sum+=x;count++}
  return{ax:Math.round(count?sum/count:f.x+f.w/2),ay:bottom+1};
 }
 const framesOn=s=>draft.anim.frames.filter(f=>f.s===s);
 const frameById=id=>draft.anim.frames.find(f=>f.id===id);
 // Tìm lại khung: khung mới trùng phần lớn khung cũ (IoU ≥ 0.5) giữ mã cũ để hoạt ảnh đã ghép không mất.
 function detect(s,keepManual=true){
  const r=rt[s],boxes=boxesOf(r.comps,r.opts.gap,r.opts.min),old=framesOn(s),iou=(a,b)=>{const x=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),y=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)),i=x*y;return i/(a.w*a.h+b.w*b.h-i)};
  const taken=new Set(),next=boxes.map(b=>{const match=old.filter(o=>!taken.has(o.id)).map(o=>[o,iou(o,b)]).sort((a,b)=>b[1]-a[1])[0];const id=match&&match[1]>=.5?match[0].id:nextFrame++;taken.add(id);const f={id,s,...b};return{...f,...footOf(s,f)}});
  const manual=keepManual?old.filter(o=>o.manual&&!taken.has(o.id)):[];
  draft.anim.frames=[...draft.anim.frames.filter(f=>f.s!==s),...next,...manual];prune();sel.clear();
 }
 // Bỏ khỏi hoạt ảnh / hiệu ứng các khung không còn tồn tại.
 function prune(){const ids=new Set(draft.anim.frames.map(f=>f.id));for(const seq of allSeqs()){seq.frames=seq.frames.filter(x=>ids.has(x.f));if(seq.hit!==undefined&&seq.hit>=seq.frames.length)delete seq.hit}}
 const allSeqs=()=>[...Object.values(draft.anim.animations),...draft.anim.effects];
 async function addSheetFile(file){
  const url=URL.createObjectURL(file);let im;try{im=await loadImg(url)}finally{URL.revokeObjectURL(url)}
  if(im.naturalWidth>8192||im.naturalHeight>8192)throw Error('Sheet tối đa 8192×8192 px.');
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);
  const original=ctx.getImageData(0,0,c.width,c.height),r={original,opts:autoOpts(original),name:file.name};processSheet(r);
  rt.push(r);draft.anim.sheets.push({art:null,w:c.width,h:c.height});curSheet=rt.length-1;detect(curSheet,false);
  if(draft.anim.sheets.length===1){const hs=framesOn(curSheet).map(f=>f.h).filter(h=>h>40).sort((a,b)=>a-b),mid=hs[Math.floor(hs.length/2)]||200;draft.anim.scale=Math.round(clamp(HERO_H/mid,.2,4)*100)/100}
  zoom=0;mark();
 }
 // Sheet đã lưu: ảnh đã xoá nền sẵn, không còn ảnh gốc để xử lý lại.
 async function loadSavedSheet(s){const im=await loadImg(`/hero-art/${s.art}.webp`),c=document.createElement('canvas');c.width=s.w;c.height=s.h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);return{canvas:c,data:ctx.getImageData(0,0,s.w,s.h),original:null,opts:null,comps:[],dirty:false,saved:true}}

 // ================= Bố cục =================
 function layout(){
  const steps=!draft?"":STEPS.map(([id,label])=>`<button type="button" class="ghost mini ${step===id?'on':''}" data-step="${id}">${label}${badge(id)}</button>`).join('');
  return `<div class="hc"><aside class="card hc-list"><h2>Nhân vật tự tạo</h2><button type="button" data-new="1">+ Tạo nhân vật mới</button>
   <div class="hc-heroes">${list.heroes.map(h=>`<button type="button" class="ghost hc-hero ${draft?.avatar===h.avatar?'on':''}" data-open="${h.avatar}"><img src="${escape(h.head)}" alt=""><span><b>${escape(h.name)}</b><small>${GRADES[h.rank]} · ${escape(FACTIONS.find(f=>f[0]===h.faction)?.[1]||'')} · ${h.summon?'Chiêu mộ được':'Ẩn khỏi chiêu mộ'}</small></span></button>`).join('')||'<p class="muted">Chưa có nhân vật nào.</p>'}</div>
   <p class="muted small">Nhân vật lưu xong có ngay trong game (không cần khởi động lại). Tặng cho tài khoản bằng ${escape('Mảnh <tên>')} ×50 ở tab Tài khoản.</p></aside>
   <section class="hc-main">${draft?`<div class="card hc-top"><div class="row spread"><h2>${escape(draft.name)} ${draft.avatar?`<span class="muted">#${draft.avatar}</span>`:'<span class="rw-badge">Mới</span>'} <span id="hc-dirty" class="rw-badge" ${dirty?'':'hidden'}>Chưa lưu</span></h2>
    <div class="row">${draft.avatar?'<button type="button" class="danger mini" data-delete="1">Xoá</button>':''}<button type="button" data-save="1" ${busy?'disabled':''}>${busy?'Đang lưu…':'Lưu nhân vật'}</button></div></div><nav class="hc-steps">${steps}</nav></div>
    <div class="hc-body">${body()}</div>`:'<div class="card"><p class="muted">Chọn một nhân vật bên trái hoặc bấm “Tạo nhân vật mới”.</p></div>'}</section></div>`;
 }
 function badge(id){
  const a=draft.anim;let ok=null;
  if(id==='sheet')ok=a.sheets.length>0;if(id==='anim')ok=!!(a.animations.idling?.frames.length&&a.animations.beat?.frames.length);
  if(id==='skills')ok=draft.skills.length>0;if(id==='images')ok=!!(draft.images.head&&draft.images.thumb)||!!port;
  return ok===null?'':ok?' <span class="hc-ok">✓</span>':' <span class="hc-need">!</span>';
 }
 function body(){
  if(step==='info')return infoView();if(step==='sheet')return sheetView();if(step==='anim')return animView();if(step==='fx')return fxView();
  if(step==='skills')return skillsView();if(step==='images')return imagesView();return previewView();
 }
 // ---- 1. Thông tin
 function infoView(){
  const d=draft,def=defScale(d.rank,d.class),opt=(list,v)=>list.map(([id,label])=>`<option value="${id}" ${id===v?'selected':''}>${label}</option>`).join('');
  return `<div class="card"><h3>Thông tin tướng</h3><div class="hc-grid">
   <label>Tên nhân vật<input data-f="name" value="${escape(d.name)}" maxlength="30"></label>
   <label>Hệ<select data-f="faction">${opt(FACTIONS,d.faction)}</select></label>
   <label>Lớp<select data-f="class">${opt(CLASSES,d.class)}</select></label>
   <label>Bậc<select data-f="rank" data-num="1">${opt(Object.entries(GRADES).map(([k,v])=>[Number(k),v]),d.rank)}</select></label></div>
   <label class="hc-check"><input type="checkbox" data-f="summon" ${d.summon?'checked':''}> Cho chiêu mộ (xuất hiện ở Thùng bia / thẻ chọn tướng theo hệ và bậc)</label>
   <h3>Sức mạnh trong trận</h3><p class="muted small">Chỉ số trận đấu tính bằng công thức chung của game nhân hệ số dưới đây (mặc định theo bậc × lớp: Công ×${def.attack}, Máu ×${def.maxHp}).</p>
   <div class="hc-grid"><label>Hệ số Công<input type="number" step="0.01" min="0.1" max="10" data-scale="attack" value="${d.statScale.attack}"></label><label>Hệ số Máu<input type="number" step="0.01" min="0.1" max="10" data-scale="maxHp" value="${d.statScale.maxHp}"></label><button type="button" class="ghost mini" data-default-scale="1">Về mặc định</button></div>
   <h3>Chỉ số hiển thị ở hồ sơ (khi cấp tối đa)</h3><div class="hc-grid">${[['attack','Công'],['defense','Thủ'],['maxHp','Máu'],['speed','Tốc độ']].map(([k,l])=>`<label>${l}<input type="number" min="0" data-stat="${k}" value="${d.stats[k]}"></label>`).join('')}</div>
   <h3>Sao chép từ tướng gốc</h3><div class="row"><select id="hc-template"><option value="">— Chọn tướng —</option>${list.templates.map(t=>`<option value="${t.avatar}">${escape(t.name)} (${GRADES[t.rank]})</option>`).join('')}</select><button type="button" class="ghost mini" data-template="1">Chép kỹ năng + chỉ số</button></div>
   <p class="muted small">Chép mô tả kỹ năng 4 cấp, biểu tượng, chỉ số hồ sơ, hệ, lớp, bậc. Hoạt ảnh và ảnh giữ nguyên.</p></div>`;
 }
 // ---- 2. Sprite sheet
 function sheetTabs(){return `<div class="row hc-sheettabs">${draft.anim.sheets.map((s,i)=>`<button type="button" class="ghost mini ${i===curSheet?'on':''}" data-sheet="${i}">Sheet ${i+1} <small>${framesOn(i).length} khung</small></button>`).join('')}</div>`}
 function sheetView(){
  const a=draft.anim,r=rt[curSheet];
  const head=`<div class="card"><div class="row spread"><h3>Sprite sheet</h3><label class="hc-file">+ Thêm sprite sheet<input type="file" accept="image/png,image/webp,image/jpeg,image/gif" data-add-sheet="1" multiple hidden></label></div>
   <p class="muted small">Tải ảnh sprite sheet (PNG nền trong suốt hoặc nền màu như ảnh tổng hợp). Hệ thống tự xoá nền, bỏ khung trang trí / vạch kẻ và tìm từng khung hình. Bấm khung để chọn (Shift: chọn thêm), kéo trên vùng trống để vẽ khung mới, phím Delete để xoá khung chọn.</p>${sheetTabs()}</div>`;
  if(!a.sheets.length)return head;
  const o=r?.opts,keys=o?o.keys.map((k,i)=>`<span class="hc-key" style="--c:rgb(${k.join(',')})">rgb(${k.join(', ')})<button type="button" data-key-remove="${i}" aria-label="Bỏ màu">×</button></span>`).join(''):'';
  const tools=r?.original?`<div class="hc-tools"><div class="row wrap"><b>Xoá nền</b>${keys||'<span class="muted">Chưa có màu nền.</span>'}<button type="button" class="ghost mini ${eyedrop?'on':''}" data-eyedrop="1">${eyedrop?'Bấm vào sheet để hút màu…':'+ Hút màu nền'}</button>${o.transparent?'<span class="muted small">Sheet có sẵn nền trong suốt.</span>':''}</div>
   <div class="row wrap"><label class="hc-range">Độ lệch màu ${o.tol}<input type="range" min="0" max="140" value="${o.tol}" data-opt="tol"></label><label class="hc-range">Gộp mảnh cách ≤ ${o.gap}px<input type="range" min="0" max="60" value="${o.gap}" data-opt="gap"></label><label class="hc-range">Bỏ khung nhỏ hơn ${o.min}px<input type="range" min="2" max="120" value="${o.min}" data-opt="min"></label><button type="button" class="ghost mini" data-redetect="1">Tìm lại khung</button></div>${o.deep?'<p class="muted small">Nền bị viền / lưới ô bao kín: đã xoá thêm các mảng màu nền bên trong.</p>':''}</div>`:`<p class="muted small">Sheet đã lưu: nền đã xoá. Muốn xử lý lại thì tải lại ảnh gốc làm sheet mới.</p>`;
  return head+`<div class="card">${tools}<div class="row wrap hc-actions"><span class="muted">${framesOn(curSheet).length} khung · đã chọn ${sel.size}</span><button type="button" class="ghost mini" data-merge="1" ${sel.size<2?'disabled':''}>Gộp khung đã chọn</button><button type="button" class="ghost mini" data-del-frames="1" ${sel.size?'':'disabled'}>Xoá khung đã chọn</button><span class="hc-inline small" title="Sheet xếp đều theo ô: chia thành hàng × cột, mỗi ô một khung">Chia lưới <input type="number" min="1" max="40" value="${gridRows}" data-grid="rows" aria-label="Số hàng"> × <input type="number" min="1" max="40" value="${gridCols}" data-grid="cols" aria-label="Số cột"><button type="button" class="ghost mini" data-grid-split="1">Chia</button></span><span class="grow"></span>${zoomBar()}<button type="button" class="danger mini" data-remove-sheet="${curSheet}">Bỏ sheet này</button></div>${viewer('sheet')}</div>`;
 }
 function zoomBar(){return `<span class="row hc-zoom"><button type="button" class="ghost mini" data-zoom="-1">−</button><span>${Math.round(curZoom()*100)}%</span><button type="button" class="ghost mini" data-zoom="1">+</button><button type="button" class="ghost mini" data-zoom="0">Vừa</button></span>`}
 const curZoom=()=>{const s=draft.anim.sheets[curSheet];if(!s)return 1;if(!zoom){const box=root.querySelector('.hc-main')?.clientWidth||900;return clamp(Math.floor((box-60)/s.w*20)/20,.1,2)}return zoom};
 // Khung trên sheet: ô vuông tuyệt đối; ở bước Hoạt ảnh / Hiệu ứng hiện thứ tự trong chuỗi đang sửa.
 function viewer(mode){
  const s=draft.anim.sheets[curSheet];if(!s)return'<p class="muted">Chưa có sheet. Thêm ở bước 2.</p>';const z=curZoom(),seq=mode==='sheet'?null:currentSeq();
  const order=new Map();seq?.frames.forEach((x,i)=>{order.set(x.f,[...(order.get(x.f)||[]),i+1])});
  const boxes=framesOn(curSheet).map(f=>{const o=order.get(f.id);return `<div class="hc-box ${sel.has(f.id)?'sel':''} ${o?'used':''} ${mode!=='sheet'?'pick':''}" data-frame="${f.id}" style="left:${f.x*z}px;top:${f.y*z}px;width:${f.w*z}px;height:${f.h*z}px">${o?`<b>${o.join(',')}</b>`:''}${mode==='sheet'?`<i>${f.id}</i>`:''}</div>`}).join('');
  return `<div class="hc-viewer ${eyedrop&&mode==='sheet'?'eyedrop':''}" data-mode="${mode}"><div class="hc-stage" style="width:${s.w*z}px;height:${s.h*z}px"><div class="hc-sheet-slot"></div>${boxes}<div class="hc-draw" hidden></div></div></div>`;
 }
 // ---- 3. Hoạt ảnh / 4. Hiệu ứng: chuỗi khung
 function currentSeq(){if(step==='fx')return draft.anim.effects[curFx]||null;return draft.anim.animations[curAnim]??=({fps:curAnim==='idling'?8:12,frames:[]})}
 function animView(){
  const a=draft.anim,items=ANIMS.map(([id,label,req])=>{const n=a.animations[id]?.frames.length||0;return `<button type="button" class="ghost hc-anim ${curAnim===id?'on':''}" data-anim="${id}"><b>${label}${req?' *':''}</b><small>${n?n+' khung':'trống'}</small></button>`}).join('');
  const info=ANIMS.find(x=>x[0]===curAnim);
  return `<div class="hc-seqlayout"><div class="card hc-animlist">${items}<hr><label>Tỉ lệ nhân vật<input type="number" step="0.05" min="0.05" max="10" data-global="scale" value="${a.scale}"></label><label class="hc-check"><input type="checkbox" data-global="mirror" ${a.mirror?'checked':''}> Lật ngang (sheet quay mặt sang trái)</label><p class="muted small">Đội ta quay mặt sang phải. Vạch xanh trong ô xem là chiều cao tướng gốc trung bình.</p></div>
   <div class="card hc-seqmain"><div class="row spread"><h3>${info[1]}</h3><span class="muted small">${info[3]}</span></div>${seqEditor(currentSeq(),'body')}</div>
   <div class="card hc-pick"><div class="row spread"><b>Bấm khung để thêm vào chuỗi</b>${zoomBar()}</div><p class="muted small">Shift + bấm: thêm cả hàng từ khung đó. Số trên khung là vị trí trong chuỗi.</p>${sheetTabs()}${viewer('pick')}</div></div>`;
 }
 function fxView(){
  const a=draft.anim,fx=a.effects[curFx],opt=v=>`<option value="">Không</option>${a.effects.map((e,i)=>`<option value="${i}" ${v===i?'selected':''}>${escape(e.name)}</option>`).join('')}`;
  const tabs=a.effects.map((e,i)=>`<button type="button" class="ghost mini ${i===curFx?'on':''}" data-fx="${i}">${escape(e.name)} <small>${e.frames.length}</small></button>`).join('');
  const assign=`<div class="card"><h3>Gán hiệu ứng vào chiêu</h3><div class="hc-grid">
   <label>Đánh thường · tại người ra đòn<select data-assign="attack.cast">${opt(a.attack.cast)}</select></label><label>Vị trí X / Y (ô 64px)<span class="row"><input type="number" step="0.25" data-assign-num="attack.castX" value="${a.attack.castX}"><input type="number" step="0.25" data-assign-num="attack.castY" value="${a.attack.castY}"></span></label>
   <label>Đánh thường · trúng mục tiêu<select data-assign="attack.impact">${opt(a.attack.impact)}</select></label><label class="hc-check"><input type="checkbox" data-assign-bool="attack.shake" ${a.attack.shake?'checked':''}> Rung màn khi trúng</label>
   <label>Tuyệt kỹ · hiệu ứng chiêu<select data-assign="skill.cast">${opt(a.skill.cast)}</select></label><label>Đặt tại<select data-assign="skill.castAt"><option value="target" ${a.skill.castAt==='target'?'selected':''}>Mục tiêu</option><option value="stage" ${a.skill.castAt==='stage'?'selected':''}>Giữa đội địch</option></select></label>
   <label>Bắt đầu sau (giây)<input type="number" step="0.05" min="0" max="5" data-assign-num="skill.castDelay" value="${a.skill.castDelay}"></label><label>Tuyệt kỹ · trúng từng mục tiêu<select data-assign="skill.impact">${opt(a.skill.impact)}</select></label>
   <label class="hc-check"><input type="checkbox" data-assign-bool="skill.shake" ${a.skill.shake?'checked':''}> Rung màn khi Tuyệt kỹ trúng</label></div>
   <p class="muted small">Có “hiệu ứng chiêu” thì tướng đứng tại chỗ tung chiêu (như chiêu tầm xa của tướng gốc); không có thì lao tới đánh. Không gán hiệu ứng trúng đòn thì dùng tia đánh chung của game.</p></div>`;
  return `<div class="card"><div class="row spread"><h3>Hiệu ứng</h3><button type="button" class="ghost mini" data-fx-add="1">+ Thêm hiệu ứng</button></div><div class="row wrap">${tabs||'<span class="muted">Chưa có hiệu ứng (tuỳ chọn): nổ, tia sét, chém... cắt từ sheet.</span>'}</div></div>`+
   (fx?`<div class="hc-seqlayout fx"><div class="card hc-animlist"><label>Tên<input data-fxf="name" value="${escape(fx.name)}" maxlength="30"></label><label>Tỉ lệ<input type="number" step="0.05" min="0.05" max="10" data-fxf="scale" value="${fx.scale}"></label><label class="hc-check"><input type="checkbox" data-fxf="additive" ${fx.additive?'checked':''}> Cộng sáng (tia lửa, sét, hào quang)</label><button type="button" class="danger mini" data-fx-remove="1">Xoá hiệu ứng</button></div>
    <div class="card hc-seqmain">${seqEditor(fx,'effect')}</div><div class="card hc-pick"><div class="row spread"><b>Bấm khung để thêm</b>${zoomBar()}</div>${sheetTabs()}${viewer('pick')}</div></div>`:'')+assign;
 }
 function seqEditor(seq,kind){
  if(!seq)return'';const hitable=kind==='body'&&(curAnim==='beat'||curAnim==='skill');
  const strip=seq.frames.map((x,i)=>`<div class="hc-cell ${i===curFrame?'on':''} ${seq.hit===i?'hit':''}" data-cell="${i}"><canvas width="72" height="72" data-thumb="${x.f}"></canvas><span class="hc-cellno">${i+1}${seq.hit===i?' ★':''}</span>
   <div class="hc-cellbar"><button type="button" data-move="-1" title="Lên trước">‹</button><input type="number" min="1" max="60" value="${x.d||1}" data-dur="${i}" title="Số nhịp (1 nhịp = 1/FPS giây)"><button type="button" data-move="1" title="Ra sau">›</button></div>
   <div class="hc-cellbar">${hitable?`<button type="button" data-hit="${i}" title="Khung trúng đòn">★</button>`:''}<button type="button" data-dup="${i}" title="Nhân đôi">⧉</button><button type="button" data-cut="${i}" title="Bỏ khung">×</button></div></div>`).join('');
  const len=seq.frames.length?S().duration(seq):0;
  return `<div class="hc-seq"><div class="hc-play"><canvas class="hc-prev" width="340" height="300" tabindex="0" data-kind="${kind}"></canvas>
   <div class="row wrap"><button type="button" class="ghost mini" data-playtoggle="1">${playing?'❚❚ Dừng':'▶ Chạy'}</button><label class="hc-inline">FPS<input type="number" min="1" max="60" value="${seq.fps}" data-fps="1"></label><span class="muted small">${seq.frames.length} khung · ${len.toFixed(2)} giây</span></div>
   ${kind==='body'?`<div class="row wrap"><button type="button" class="ghost mini" data-refoot="1">Căn chân tự động</button><button type="button" class="ghost mini" data-zero="1">Bỏ lệch</button><button type="button" class="ghost mini" data-reverse="1">Đảo chiều</button><button type="button" class="ghost mini" data-clear="1">Xoá chuỗi</button></div>`:`<div class="row wrap"><button type="button" class="ghost mini" data-zero="1">Bỏ lệch</button><button type="button" class="ghost mini" data-clear="1">Xoá chuỗi</button></div>`}
   <p class="muted small">${curFrame>=0?`Khung ${curFrame+1}: kéo trong ô xem hoặc dùng phím mũi tên (Shift ×10) để căn. Lệch ${seq.frames[curFrame]?.dx||0}, ${seq.frames[curFrame]?.dy||0}.`:'Bấm một khung bên dưới để dừng ở khung đó và căn vị trí.'}</p></div>
   <div class="hc-strip">${strip||'<p class="muted">Chưa có khung. Bấm khung trên sheet bên phải để thêm.</p>'}</div></div>`;
 }
 // ---- 5. Kỹ năng
 const SAMPLES={ult:['Tấn công 3 kẻ địch hàng sau gây sát thương 300% Công.','Tấn công toàn bộ kẻ địch gây sát thương 200% Công, 50% tỉ lệ gây Choáng duy trì 2 lượt.','Tấn công 1 kẻ địch máu thấp nhất gây sát thương 500% Công, chắc chắn Chí Mạng.','Tấn công 2 kẻ địch ngẫu nhiên gây sát thương 250% Công 3 lần.','Hồi máu toàn đội bằng 150% Công.','Tăng toàn đội 30% Công duy trì 2 lượt.','Tấn công toàn bộ kẻ địch gây sát thương 180% Công, gây Thiêu Đốt (60% Công) duy trì 2 lượt.','Tấn công 1 kẻ địch hàng trước gây sát thương 400% Công, giảm 50 Nộ của mục tiêu.'],
  passive:['Tăng bản thân 30% Công, 30% Máu, 100 Tốc Độ.','Khi đánh thường, 30% tỉ lệ gây Choáng duy trì 1 lượt.','Khi bị đánh, hồi máu bằng 5% Máu tối đa.','Đầu mỗi lượt, tăng bản thân 20 Nộ.','Đầu trận đấu, tạo lá chắn bằng 20% Máu cho toàn đội duy trì 2 lượt.','Khi máu dưới 30%, tăng bản thân 50% Giảm ST duy trì 2 lượt.','Khi chết, hồi sinh với 30% Máu.','Đánh thường tấn công toàn bộ kẻ địch, gây sát thương 120% Công.']};
 let skillLevel=[3,3,3,3];const compiled=new Map();
 function skillsView(){
  const cards=draft.skills.map((s,i)=>{const lv=skillLevel[i],samples=SAMPLES[i?'passive':'ult'],iconSrc=s._iconSrc||(/^[a-f0-9]{24}$/.test(s.icon)?`/hero-art/${s.icon}.webp`:assetSrc(s.icon));
   return `<div class="card hc-skill" data-skill="${i}"><div class="row spread"><h3>${i?'Bị động '+i:'Kỹ năng Nộ'}</h3>${i?`<button type="button" class="danger mini" data-skill-remove="${i}">Xoá</button>`:''}</div>
    <div class="row"><button type="button" class="ghost hc-icon" data-icon="${i}" title="Đổi biểu tượng">${iconSrc?`<img src="${escape(iconSrc)}" alt="">`:'?'}</button><label class="grow">Tên kỹ năng<input data-skill-name="${i}" value="${escape(s.name)}" maxlength="40"></label></div>
    <div class="row hc-levels">${[0,1,2,3].map(k=>`<button type="button" class="ghost mini ${k===lv?'on':''}" data-level="${i}:${k}">Cấp ${k+1}</button>`).join('')}<span class="grow"></span><button type="button" class="ghost mini" data-autolevel="${i}" title="Lấy mô tả cấp 4, giảm các con số còn 50% / 67% / 83%">Tự điền cấp 1–3 từ cấp 4</button></div>
    <textarea rows="4" data-desc="${i}:${lv}" spellcheck="false">${escape(s.levels[lv]||'')}</textarea>
    <div class="row"><select data-sample="${i}"><option value="">+ Chèn câu mẫu…</option>${samples.map((t,k)=>`<option value="${k}">${escape(t)}</option>`).join('')}</select></div>
    <div class="hc-parse" id="hc-parse-${i}">${parseView(compiled.get(i+':'+(s.levels[lv]||'')))}</div></div>`}).join('');
  return `<div class="card"><p class="muted small">Viết mô tả như tướng gốc. Ô đầu là Nộ (tung khi đầy 100 Nộ), các ô sau là Bị động. Khung bên dưới mỗi ô cho biết game đọc được gì từ mô tả; câu báo đỏ là câu game chưa hiểu, hãy viết lại theo câu mẫu. Kỹ năng tự lên cấp theo sao (1–2 sao cấp 1, 3–4 sao cấp 2, 5 sao cấp 3, từ 6 sao cấp 4).</p>${draft.skills.length<4?'<button type="button" class="ghost mini" data-skill-add="1">+ Thêm bị động</button>':''}</div><div class="hc-skills">${cards}</div>`;
 }
 const STAT={critResist:'Giảm ST chí mạng',critDamage:'ST chí mạng',critChance:'Chí mạng',penResist:'Kháng xuyên thủ',controlPierce:'Xuyên miễn chống',penetration:'Xuyên thủ',trueDamage:'ST chuẩn',skillDamage:'ST Nộ',directReduction:'Miễn ST trực tiếp',damageReduction:'Giảm ST',controlResist:'Miễn chống',dodgeChance:'Né',block:'Chặn',accuracy:'Chính xác',lifesteal:'Hút máu',healTaken:'Nhận hồi máu',healPower:'Hiệu quả hồi máu',speed:'Tốc độ',energy:'Nộ',maxHp:'Máu',attack:'Công',defense:'Thủ'};
 const STATUS={stun:'Choáng',freeze:'Đóng băng',silence:'Câm lặng',fear:'Uy hiếp',petrify:'Hóa đá',panic:'Hoảng loạn',burn:'Thiêu đốt',poison:'Trúng độc',bleed:'Chảy máu'};
 const PICK={front:'hàng trước',back:'hàng sau',lowest:'máu thấp nhất',rage:'Nộ cao nhất',attack:'Công cao nhất',highestHp:'Máu cao nhất',random:'ngẫu nhiên'};
 const TRIG={attack:'Khi đánh thường',hurt:'Khi bị đánh',battleStart:'Đầu trận',roundStart:'Đầu mỗi lượt',roundEnd:'Cuối mỗi lượt',allyUlt:'Khi đồng đội dùng Nộ',selfUlt:'Khi bản thân dùng Nộ',lowHp:'Khi máu thấp',death:'Khi chết',kill:'Khi hạ gục địch'};
 const ON={self:'bản thân',team:'toàn đội',target:'mục tiêu',enemies:'toàn bộ địch',lowest:'đồng minh máu thấp nhất',some:'vài đồng minh'};
 const pct=v=>Math.round(v*1000)/10+'%';
 function effectText(e){
  const tgt=s=>s?(s.count>=6?'toàn bộ địch':`${s.count} địch ${PICK[s.pick]||''}`)+(s.row&&s.count>=6?` hàng ${s.row==='back'?'sau':'trước'}`:''):'';const ch=e.chance!==undefined&&e.chance<1?` (${pct(e.chance)} tỉ lệ)`:'';
  switch(e.type){
   case'damage':return `Sát thương ${e.mult?'≈'+Math.round(e.mult/.6*100)+'% Công':''}${e.hpMult?` ${pct(e.hpMult/.6)} Máu bản thân`:''}${e.foeHp?` ${pct(e.foeHp/.6)} Máu mục tiêu`:''}${e.defMult?` Thủ ×${e.defMult*1000/1000}`:''}${e.hits>1?` × ${e.hits} lần`:''} lên ${tgt(e.select)}${e.pierce?', bỏ qua thủ':''}${e.critical?', chắc chắn chí mạng':''}${ch}`;
   case'status':return `${STATUS[e.kind]||e.kind} ${e.turns} lượt${ch}${e.select?' lên '+tgt(e.select):''}`;
   case'dot':return `${STATUS[e.kind]||e.kind} ≈${Math.round(e.mult/.36*100)}% Công mỗi lượt, ${e.turns} lượt${ch}`;
   case'stat':return `${e.value>0?'Tăng':'Giảm'} ${e.flat?Math.abs(e.value):pct(Math.abs(e.value))} ${STAT[e.attr]||e.attr} cho ${ON[e.on]||e.on}${e.turns>=99?' vĩnh viễn':` ${e.turns} lượt`}`;
   case'heal':return `Hồi máu ${e.attack?pct(e.attack)+' Công':pct(e.maxHp)+' Máu tối đa'} cho ${ON[e.on]||e.on}`;
   case'shield':return e.block?`Khiên chặn ${e.block} đợt, ${e.turns} lượt`:`Lá chắn ${e.maxHp?pct(e.maxHp)+' Máu':pct(e.attack)+' Công'} cho ${ON[e.on]||e.on}, ${e.turns} lượt`;
   case'energy':return `${e.value>0?'Tăng':'Giảm'} ${Math.abs(e.value)} Nộ ${ON[e.on]||e.on}${e.steal?' (hấp thụ)':''}${ch}`;
   case'cleanse':return `Xoá ${e.count} hiệu ứng xấu (${ON[e.on]||e.on})`;case'dispel':return `Xoá ${e.count} hiệu ứng tốt của mục tiêu${ch}`;
   case'counter':return `Phản đòn${ch}`;case'revive':return `Hồi sinh với ${pct(e.maxHp)} Máu`;case'castUlt':return `Tung thêm Nộ${ch}`;case'extraAction':return `Thêm 1 lượt hành động${ch}`;
   case'resist':return `Kháng ${STATUS[e.kind]||e.kind} ${pct(e.value)}`;default:return e.type;
  }
 }
 function parseView(r){
  if(!r)return'<p class="muted small">Đang đọc mô tả…</p>';if(r.error)return `<p class="hc-bad">${escape(r.error)}</p>`;
  const rows=[];
  for(const [k,v] of Object.entries(r.stats||{}))rows.push(`Chỉ số: +${k.endsWith('Flat')||k==='energy'?v:pct(v)} ${STAT[k.replace(/Flat$/,'')]||k}`);
  for(const e of r.effects||[])rows.push(effectText(e));
  for(const t of r.triggers||[])rows.push(`<b>${TRIG[t.on]||t.on}${t.threshold?` dưới ${pct(t.threshold)}`:''}${t.chance<1?` (${pct(t.chance)})`:''}:</b> ${t.effects.map(effectText).join('; ')||'—'}${t.replace?' (thay đòn đánh thường)':''}`);
  return `<ul class="hc-ok-list">${rows.map(x=>`<li>${x}</li>`).join('')||'<li class="hc-bad">Không đọc được hiệu ứng nào.</li>'}</ul>${(r.notes||[]).map(n=>`<p class="hc-bad">Chưa hiểu: “${escape(n)}”</p>`).join('')}`;
 }
 let compileTimer=0;
 function compileSoon(i){clearTimeout(compileTimer);compileTimer=setTimeout(()=>compile(i),350)}
 async function compile(i){
  const s=draft.skills[i];if(!s)return;const text=s.levels[skillLevel[i]]||'',key=i+':'+text;
  if(!compiled.has(key)){try{compiled.set(key,await api('/api/admin/heroes/compile',{description:text.slice(0,1500)||' ',passive:i>0}))}catch(e){compiled.set(key,{error:e.message})}}
  const el=$('#hc-parse-'+i);if(el&&(draft.skills[i].levels[skillLevel[i]]||'')===text)el.innerHTML=parseView(compiled.get(key));
 }
 function autoLevels(i){
  const s=draft.skills[i],top=s.levels[3]||s.levels.at(-1)||'';
  s.levels=[.5,.67,.83].map(f=>top.replace(/(\d+(?:[.,]\d+)?)(\s*(?:%|Tốc|Nộ|Máu|Công|Thủ|điểm))/gi,(m,v,u)=>{const n=Number(v.replace(',','.'));const x=n*f;return(n>=10?Math.max(1,Math.round(x/5)*5):Math.max(1,Math.round(x)))+u})).concat([top]);
 }
 // ---- 6. Ảnh: chân dung tải lên (tuỳ chọn) hoặc ghép từ khung Đứng yên trên nền màu hệ; cắt ra 3 cỡ ảnh của game.
 function imagesView(){
  const p=port,boxes=Object.entries(IMG).map(([k,[w,h,label]])=>`<div class="hc-imgbox"><b>${label} <small class="muted">${w}×${h}</small></b>${p?`<canvas width="${w}" height="${h}" data-crop="${k}" style="aspect-ratio:${w}/${h}"></canvas><label class="hc-range">Phóng to<input type="range" min="1" max="4" step="0.05" value="${p.crops[k].zoom}" data-zoomcrop="${k}"></label>`:draft.images[k]?`<img src="/hero-art/${draft.images[k]}.webp" alt="" style="aspect-ratio:${w}/${h}">`:'<p class="muted">Chưa có.</p>'}</div>`).join('');
  return `<div class="card"><h3>Ảnh tướng</h3><p class="muted small">Ảnh đầu dùng ở danh sách tướng / đội hình, thẻ tướng ở chiêu mộ / album, chân dung ở hồ sơ. Tải ảnh chân dung (tuỳ chọn) rồi kéo trong từng ô để chọn vùng cắt; không có thì dùng khung Đứng yên đầu tiên trên nền màu của hệ.</p>
   <div class="row wrap"><label class="hc-file">Tải ảnh chân dung…<input type="file" accept="image/*" data-portrait="1" hidden></label><button type="button" class="ghost mini" data-from-sprite="1">Tạo từ khung Đứng yên</button>${p?'<span class="rw-badge">Ảnh mới, lưu để áp dụng</span>':''}</div><div class="hc-images">${boxes}</div></div>`;
 }
 function idleCanvas(){
  const a=draft.anim.animations.idling?.frames[0],f=a&&frameById(a.f),r=f&&rt[f.s];if(!r)return null;
  const c=document.createElement('canvas');c.width=576;c.height=432;const ctx=c.getContext('2d'),[c1,c2]=FCOLOR[draft.faction]||FCOLOR.fortress,g=ctx.createRadialGradient(288,190,30,288,216,360);g.addColorStop(0,c1);g.addColorStop(1,c2);ctx.fillStyle=g;ctx.fillRect(0,0,576,432);
  const k=Math.min(400/f.h,520/f.w);ctx.save();ctx.translate(288,420);if(draft.anim.mirror)ctx.scale(-1,1);ctx.drawImage(r.canvas,f.x,f.y,f.w,f.h,-f.w*k/2,-f.h*k,f.w*k,f.h*k);ctx.restore();return c;
 }
 function setPortrait(src){const base=Math.min(1,1);port={src,crops:{art:{zoom:1,cx:.5,cy:.5},thumb:{zoom:1.15,cx:.5,cy:.45},head:{zoom:2.2,cx:.5,cy:.3}},base};mark()}
 function drawCrop(canvas,k){
  const p=port,c=p.crops[k],[w,h]=IMG[k],sw=p.src.width||p.src.naturalWidth,sh=p.src.height||p.src.naturalHeight,cover=Math.max(w/sw,h/sh)*c.zoom,vw=w/cover,vh=h/cover;
  c.cx=clamp(c.cx,vw/2/sw,1-vw/2/sw);c.cy=clamp(c.cy,vh/2/sh,1-vh/2/sh);const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.drawImage(p.src,c.cx*sw-vw/2,c.cy*sh-vh/2,vw,vh,0,0,w,h);
 }
 // ---- 7. Xem trước bằng Spine thật
 function previewView(){
  const a=draft.anim,ready=a.animations.idling?.frames.length;
  return `<div class="card"><h3>Xem trước trong trận (Spine)</h3><p class="muted small">Dựng skeleton Spine giống hệt tệp game sẽ tải, đặt cạnh tướng gốc (Robin Egghead) để so kích cỡ và nhịp. Hiệu ứng đặt theo cách trận đấu đặt.</p>
   ${ready?`<div class="row wrap">${ANIMS.map(([id,l])=>`<button type="button" class="ghost mini" data-pv="${id}">${l}</button>`).join('')}<button type="button" data-pv="attack-full">▶ Đánh thường + hiệu ứng</button><button type="button" data-pv="skill-full">▶ Tuyệt kỹ + hiệu ứng</button></div><canvas class="hc-battle" width="1136" height="640"></canvas>`:'<p class="hc-bad">Cần hoạt ảnh Đứng yên trước.</p>'}</div>`;
 }

 // ================= Vẽ sau khi dựng HTML =================
 function after(){
  const slot=root.querySelector('.hc-sheet-slot');if(slot&&rt[curSheet]?.canvas){const c=rt[curSheet].canvas;c.className='hc-sheet';slot.replaceWith(c);const s=draft.anim.sheets[curSheet],z=curZoom();c.style.width=s.w*z+'px';c.style.height=s.h*z+'px'}
  for(const c of root.querySelectorAll('canvas[data-thumb]'))thumb(c,frameById(Number(c.dataset.thumb)));
  const prev=root.querySelector('.hc-prev');if(prev)startPreview(prev);
  for(const c of root.querySelectorAll('canvas[data-crop]'))drawCrop(c,c.dataset.crop);
  if(step==='skills')draft.skills.forEach((_,i)=>compile(i));
  const battle=root.querySelector('.hc-battle');if(battle)startBattle(battle).catch(e=>toast(e.message));
 }
 function thumb(c,f){const r=f&&rt[f.s];if(!r?.canvas)return;const ctx=c.getContext('2d'),k=Math.min(68/f.w,68/f.h);ctx.clearRect(0,0,72,72);ctx.save();ctx.translate(36,36);if(draft.anim.mirror&&step!=='fx')ctx.scale(-1,1);ctx.drawImage(r.canvas,f.x,f.y,f.w,f.h,-f.w*k/2,-f.h*k/2,f.w*k,f.h*k);ctx.restore()}
 // Thay innerHTML làm ô đang gõ mất focus → 'change' bắn lại giữa chừng: dồn lần vẽ lồng nhau ra sau.
 let rendering=false;
 function render(){if(!list)return;if(rendering){queueMicrotask(render);return}rendering=true;try{root.innerHTML=layout();after()}finally{rendering=false}}
 // Ô xem chuỗi khung: vẽ đúng phép đặt khung của sprite-spine (điểm chân ở gốc, lệch dx/dy, lật ngang).
 let previewToken=0;
 function startPreview(canvas){
  const token=++previewToken,kind=canvas.dataset.kind,start=performance.now(),ctx=canvas.getContext('2d');let drag=null;
  const idle=draft.anim.animations.idling?.frames[0],idleF=idle&&frameById(idle.f);
  const fit=()=>{const seq=currentSeq();if(kind==='effect'){const m=Math.max(1,...seq.frames.map(x=>{const f=frameById(x.f);return f?Math.max(f.w,f.h):1}));return Math.min(2,240/m)}const h=idleF?idleF.h:Math.max(1,...(seq.frames.map(x=>frameById(x.f)?.h||1)));return clamp(200/h,.1,3)};
  const origin=()=>kind==='effect'?{x:170,y:150}:{x:170,y:262};
  function drawFrame(x,k,o,alpha=1){const f=frameById(x.f),r=f&&rt[f.s];if(!r?.canvas)return;const mirror=draft.anim.mirror;ctx.save();ctx.globalAlpha=alpha;
   if(kind==='effect'){ctx.translate(o.x+(x.dx||0)*k,o.y+(x.dy||0)*k);ctx.scale(mirror?-k:k,k);ctx.drawImage(r.canvas,f.x,f.y,f.w,f.h,-f.w/2,-f.h/2,f.w,f.h)}
   else{ctx.translate(o.x+(x.dx||0)*k,o.y+(x.dy||0)*k);ctx.scale(mirror?-k:k,k);ctx.drawImage(r.canvas,f.x,f.y,f.w,f.h,f.x-f.ax,f.y-f.ay,f.w,f.h)}ctx.restore()}
  function frameAt(seq,t){const fps=Math.max(1,seq.fps||10);let total=0;for(const x of seq.frames)total+=Math.max(1,x.d||1)/fps;if(!total)return-1;let u=t%total;for(let i=0;i<seq.frames.length;i++){u-=Math.max(1,seq.frames[i].d||1)/fps;if(u<0)return i}return seq.frames.length-1}
  function loop(now){
   if(token!==previewToken||!canvas.isConnected)return;const seq=currentSeq();ctx.clearRect(0,0,canvas.width,canvas.height);
   const k=fit(),o=origin();
   // Nền: ô cờ, mặt đất, vạch chiều cao tướng gốc (~230 đơn vị Spine × tỉ lệ ô xem).
   if(kind==='body'){const unit=k/(draft.anim.scale||1);ctx.strokeStyle='#5fbf7799';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(20,o.y-HERO_H*unit);ctx.lineTo(320,o.y-HERO_H*unit);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#e0a93a';ctx.beginPath();ctx.moveTo(10,o.y);ctx.lineTo(330,o.y);ctx.stroke();ctx.fillStyle='#e0a93a';ctx.beginPath();ctx.arc(o.x,o.y,3,0,7);ctx.fill()}
   else{ctx.strokeStyle='#e0a93a55';ctx.beginPath();ctx.moveTo(o.x-8,o.y);ctx.lineTo(o.x+8,o.y);ctx.moveTo(o.x,o.y-8);ctx.lineTo(o.x,o.y+8);ctx.stroke()}
   if(seq?.frames.length){
    const i=!playing&&curFrame>=0?Math.min(curFrame,seq.frames.length-1):frameAt(seq,(now-start)/1000);
    if(!playing&&curFrame>=0){if(kind==='body'&&idle&&curAnim!=='idling')drawFrame(idle,k,o,.22);if(i>0)drawFrame(seq.frames[i-1],k,o,.28)}
    drawFrame(seq.frames[i],k,o);
    ctx.fillStyle='#93a4b5';ctx.font='12px system-ui';ctx.fillText(`Khung ${i+1}/${seq.frames.length}${seq.hit===i?' ★ trúng đòn':''}`,8,16);
   }
   requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  const k=()=>fit();
  canvas.onpointerdown=e=>{const seq=currentSeq();if(curFrame<0||!seq?.frames[curFrame])return;playing=false;drag={x:e.clientX,y:e.clientY,dx:seq.frames[curFrame].dx||0,dy:seq.frames[curFrame].dy||0};canvas.setPointerCapture(e.pointerId)};
  canvas.onpointermove=e=>{if(!drag)return;const seq=currentSeq(),fr=seq.frames[curFrame],scale=canvas.clientWidth/canvas.width;fr.dx=Math.round(drag.dx+(e.clientX-drag.x)/scale/k());fr.dy=Math.round(drag.dy+(e.clientY-drag.y)/scale/k());if(!fr.dx)delete fr.dx;if(!fr.dy)delete fr.dy;mark()};
  canvas.onpointerup=()=>{if(drag){drag=null;render()}};
  canvas.onkeydown=e=>{const seq=currentSeq(),fr=seq?.frames[curFrame];if(!fr)return;const m={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!m)return;e.preventDefault();const step=e.shiftKey?10:1;fr.dx=(fr.dx||0)+m[0]*step;fr.dy=(fr.dy||0)+m[1]*step;if(!fr.dx)delete fr.dx;if(!fr.dy)delete fr.dy;mark();const p=root.querySelector('.hc-play p.muted');if(p)p.textContent=`Khung ${curFrame+1}: kéo trong ô xem hoặc dùng phím mũi tên (Shift ×10) để căn. Lệch ${fr.dx||0}, ${fr.dy||0}.`};
 }

 // ================= Xem trước Spine =================
 let spineReady=null,battleToken=0;
 async function ensureSpine(){spineReady??=(async()=>{await loadScript('vendor/spine-canvas.js');await loadScript('spine-clipping.js')})();return spineReady}
 function spineFrom(built,pageCanvas){
  const atlas=new spine.TextureAtlas(built.atlas,name=>new spine.canvas.CanvasTexture(pageCanvas(name)));
  const data=new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(structuredClone(built.json));
  const sk=new spine.Skeleton(data),state=new spine.AnimationState(new spine.AnimationStateData(data));sk.setToSetupPose();return{data,sk,state};
 }
 async function referenceHero(){
  // Tướng so cỡ: Robin Egghead (cao ~215 đơn vị, đúng giữa tướng gốc); thiếu thì dùng Luffy.
  const d=(await fetch('hero-visuals.json').then(r=>r.json()).catch(()=>({})))['630']?.skeleton||visuals.luffy.skeleton,atlasText=await fetch(d.atlases[0].atlas.src).then(r=>r.text()),page=await loadImg(assetSrc(d.atlases[0].textures[0]));
  const atlas=new spine.TextureAtlas(atlasText,()=>new spine.canvas.CanvasTexture(page)),loader=new spine.AtlasAttachmentLoader(atlas);let data;
  if(d.skeleton.src.endsWith('.json')){const json=await fetch(d.skeleton.src).then(r=>r.json());if(json.skeleton?.spine==='3.8.75')json.skeleton.spine='3.8.99';data=new spine.SkeletonJson(loader).readSkeletonData(json)}
  else data=new spine.SkeletonBinary(loader).readSkeletonData(new Uint8Array(await fetch(d.skeleton.src).then(r=>r.arrayBuffer())));
  const sk=new spine.Skeleton(data),state=new spine.AnimationState(new spine.AnimationStateData(data));state.setAnimation(0,'idling',true);return{data,sk,state};
 }
 let refCache=null,bgCache=null;
 async function startBattle(canvas){
  const token=++battleToken;await ensureSpine();if(!assets)throw Error('Chưa tải được kho ảnh.');
  const a=draft.anim,pages=new Map(a.sheets.map((s,i)=>[`sheet${i}.png`,rt[i].canvas])),pageCanvas=name=>pages.get(name)||rt[0].canvas,opts={pages:i=>`sheet${i}.png`};
  const hero=spineFrom(S().body(a,opts),pageCanvas),fxs=a.effects.map(e=>({def:e,...spineFrom(S().effect(a,e,opts),pageCanvas)}));
  refCache??=await referenceHero().catch(()=>null);bgCache??=await loadImg(assetSrc(visuals.battleBackgrounds[2].visual.key)).catch(()=>null);
  if(token!==battleToken)return;
  const ctx=canvas.getContext('2d'),renderer=new spine.canvas.SkeletonRenderer(ctx);renderer.triangleRendering=true;
  const H={x:300,y:500,flip:1,scale:1.1},T={x:820,y:500,flip:-1,scale:1.05};let effects=[],shake=0,last=performance.now(),move=null;
  hero.state.setAnimation(0,'idling',true);
  const play=(who,name,loop=false)=>{const d=who.data.findAnimation(name)?.name||'idling';who.state.clearTracks();who.sk.setToSetupPose();who.state.setAnimation(0,d,loop);if(!loop&&name!=='dead')who.state.addAnimation(0,'idling',true,0);return who.data.findAnimation(d)?.duration||1};
  const spawn=(i,x,y,flip=1,delay=0)=>{const f=fxs[i];if(!f)return;setTimeout(()=>{f.sk.setToSetupPose();f.state.clearTracks();f.state.setAnimation(0,'Hit',false);effects=effects.filter(e=>e.f!==f);effects.push({f,x,y,flip,end:performance.now()+f.data.findAnimation('Hit').duration*1000})},delay*1000)};
  const hitRef=delay=>setTimeout(()=>{if(refCache)play(refCache,'damage');shake=Math.max(shake,0)},delay*1000);
  canvas.parentElement.onclick=e=>{const b=e.target.closest('[data-pv]');if(!b)return;const n=b.dataset.pv;
   if(n==='attack-full'){const len=play(hero,'beat'),hit=S().hitTime(a,'beat');move={from:H.x,to:T.x-90,start:performance.now(),dur:650};if(a.attack.cast!==null)spawn(a.attack.cast,H.x+64*a.attack.castX,H.y-120-64*a.attack.castY);if(a.attack.impact!==null)spawn(a.attack.impact,T.x,T.y-120,-1,hit);hitRef(hit);if(a.attack.shake)setTimeout(()=>shake=.25,hit*1000);return}
   if(n==='skill-full'){const len=play(hero,'skill'),rate=Math.max(1,len/2.2),hit=S().hitTime(a,'skill');hero.state.getCurrent(0).timeScale=rate;if(a.skill.cast!==null)spawn(a.skill.cast,a.skill.castAt==='stage'?820:T.x,a.skill.castAt==='stage'?420:T.y-120,1,a.skill.castDelay);else move={from:H.x,to:T.x-225,start:performance.now(),dur:len/rate*1000,skill:true};if(a.skill.impact!==null)spawn(a.skill.impact,T.x,T.y-120,-1,hit/rate);hitRef(hit/rate);if(a.skill.shake)setTimeout(()=>shake=.4,hit/rate*1000);return}
   play(hero,n,n==='idling')};
  function frame(now){
   if(token!==battleToken||!canvas.isConnected)return;const dt=Math.min(.05,(now-last)/1000);last=now;shake=Math.max(0,shake-dt);
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,1136,640);if(bgCache)ctx.drawImage(bgCache,0,0,1136,640);
   if(shake>0)ctx.translate((Math.random()-.5)*10,(Math.random()-.5)*10);
   let hx=H.x;if(move){const t=(now-move.start)/move.dur;if(t>=1)move=null;else hx=move.from+(move.to-move.from)*(move.skill?Math.min(1,t/.15,(1-t)/.15):Math.sin(Math.PI*t))}
   const draw=(o,x,y,flip,scale)=>{o.state.update(dt);o.state.apply(o.sk);o.sk.updateWorldTransform();ctx.save();ctx.translate(x,y);ctx.scale(scale*flip,-scale);renderer.draw(o.sk);ctx.restore()};
   if(refCache)draw(refCache,T.x,T.y,T.flip,T.scale);draw(hero,hx,H.y,H.flip,H.scale);
   effects=effects.filter(e=>now<e.end+50);for(const e of effects)draw(e.f,e.x,e.y,e.flip,T.scale);
   requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
 }

 // ================= Lưu =================
 const toBlob=(canvas,q=.95)=>new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(Error('Trình duyệt không xuất được WebP.')),'image/webp',q));
 async function save(){
  if(busy)return;const a=draft.anim;
  if(!a.sheets.length)throw Error('Cần ít nhất 1 sprite sheet (bước 2).');if(!a.animations.idling?.frames.length||!a.animations.beat?.frames.length)throw Error('Cần hoạt ảnh Đứng yên và Đánh thường (bước 3).');
  if(!port&&!(draft.images.head&&draft.images.thumb)){const c=idleCanvas();if(!c)throw Error('Cần ảnh tướng (bước 6).');setPortrait(c)}
  busy=true;render();
  try{
   for(const [i,s] of a.sheets.entries()){const r=rt[i];if(s.art&&!r.dirty)continue;toast(`Đang tải sheet ${i+1}/${a.sheets.length}…`);const blob=await toBlob(r.canvas,.96);s.art=(await upload('/api/admin/heroes/art',blob)).id;r.dirty=false}
   if(port){for(const k of Object.keys(IMG)){const [w,h]=IMG[k],c=document.createElement('canvas');c.width=w;c.height=h;drawCrop(c,k);draft.images[k]=(await upload('/api/admin/heroes/art',await toBlob(c,.92))).id}port=null}
   for(const s of draft.skills)if(s._iconBlob){s.icon=(await upload('/api/admin/heroes/art',s._iconBlob)).id;delete s._iconBlob;delete s._iconSrc}
   const payload=JSON.parse(JSON.stringify(draft,(k,v)=>k.startsWith('_')?undefined:v));payload.anim.frames=payload.anim.frames.map(({manual,...f})=>f);
   for(const n of Object.keys(payload.anim.animations))if(!payload.anim.animations[n].frames.length)delete payload.anim.animations[n];
   const res=await api('/api/admin/heroes/save',payload);list={heroes:res.heroes,templates:res.templates};draft.avatar=res.avatar;dirty=false;toast('Đã lưu nhân vật. Mở lại game để thấy.');
  }finally{busy=false;render()}
 }
 async function open(avatar){
  const c=await api('/api/admin/heroes/'+avatar);
  draft={avatar:c.avatar||String(c._id),name:c.name,faction:c.faction,class:c.class,rank:c.rank,summon:c.summon,statScale:c.statScale,stats:c.stats,images:c.images,skills:c.skills.map(s=>({name:s.name,icon:s.icon,levels:[...s.levels]})),anim:c.anim};
  rt=await Promise.all(c.anim.sheets.map(loadSavedSheet));nextFrame=Math.max(0,...c.anim.frames.map(f=>f.id))+1;
  Object.assign(draft.anim,{attack:{cast:null,impact:null,castX:1,castY:0,shake:false,...c.anim.attack},skill:{cast:null,impact:null,castAt:'target',castDelay:0,shake:true,...c.anim.skill}});
  for(const n of Object.keys(draft.anim.animations))if(draft.anim.animations[n].hit===undefined)delete draft.anim.animations[n].hit;
  curSheet=0;curAnim='idling';curFx=0;curFrame=-1;sel.clear();port=null;dirty=false;step='info';zoom=0;skillLevel=[3,3,3,3];
 }
 function confirmLeave(){return!dirty||confirm('Nhân vật đang sửa chưa lưu. Bỏ thay đổi?')}

 // ================= Sự kiện =================
 function at(path,value){const [a,b]=path.split('.');if(value===undefined)return draft.anim[a][b];draft.anim[a][b]=value}
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button,[data-frame],[data-cell]');if(!t||!root.contains(t))return;const d=t.dataset;
  try{
   if(d.new){if(!confirmLeave())return;draft=blank();rt=[];nextFrame=1;curSheet=0;curAnim='idling';curFx=0;curFrame=-1;sel.clear();port=null;dirty=false;step='info';skillLevel=[3,3,3,3];render();return}
   if(d.open){if(!confirmLeave())return;await open(d.open);render();return}
   if(d.step){step=d.step;curFrame=-1;playing=true;eyedrop=false;render();return}
   if(d.save){await save();return}
   if(d.delete){if(!confirm(`Xoá hẳn ${draft.name}? Không xoá được nếu đã có tài khoản sở hữu.`))return;const res=await api('/api/admin/heroes/delete',{avatar:draft.avatar});list=res;draft=null;dirty=false;render();toast('Đã xoá.');return}
   if(d.defaultScale){draft.statScale=defScale(draft.rank,draft.class);mark();render();return}
   if(d.template){const v=$('#hc-template').value;if(!v)return;const t=await api('/api/admin/heroes/template/'+v),src=list.templates.find(x=>x.avatar===v);
    draft.skills=t.profile.skills.slice(0,4).map((s,i)=>({name:s.name,icon:s.icon,_iconSrc:t.icon[s.icon],levels:[0,1,2,3].map(k=>t.levels?.[i]?.[k]?.description||s.description)}));
    Object.assign(draft,{faction:src.faction,class:src.class,rank:src.rank,stats:{...t.profile.stats},statScale:defScale(src.rank,src.class)});compiled.clear();mark();render();toast('Đã chép kỹ năng và chỉ số của '+src.name+'.');return}
   if(d.sheet!==undefined&&t.matches('button')){curSheet=Number(d.sheet);sel.clear();zoom=0;render();return}
   if(d.zoom!==undefined){const z=curZoom(),v=Number(d.zoom);zoom=v===0?0:clamp(Math.round((z+v*(z<.5?.05:.1))*100)/100,.05,3);render();return}
   if(d.eyedrop){eyedrop=!eyedrop;render();return}
   if(d.keyRemove!==undefined){rt[curSheet].opts.keys.splice(Number(d.keyRemove),1);await reprocess();return}
   if(d.redetect){detect(curSheet);mark();render();return}
   if(d.gridSplit){const n=gridSplit(curSheet,gridRows,gridCols);mark();render();window.AdminApp?.toast?.(`Đã chia thành ${n} khung.`);return}
   if(d.merge){const fs=[...sel].map(frameById).filter(Boolean),x=Math.min(...fs.map(f=>f.x)),y=Math.min(...fs.map(f=>f.y)),w=Math.max(...fs.map(f=>f.x+f.w))-x,h=Math.max(...fs.map(f=>f.y+f.h))-y,keep=fs[0];
    Object.assign(keep,{x,y,w,h,manual:true},footOf(keep.s,{x,y,w,h}));draft.anim.frames=draft.anim.frames.filter(f=>f===keep||!sel.has(f.id));prune();sel.clear();mark();render();return}
   if(d.delFrames){draft.anim.frames=draft.anim.frames.filter(f=>!sel.has(f.id));prune();sel.clear();mark();render();return}
   if(d.removeSheet!==undefined){const s=Number(d.removeSheet);if(!confirm('Bỏ sheet này và mọi khung trên nó?'))return;draft.anim.frames=draft.anim.frames.filter(f=>f.s!==s).map(f=>f.s>s?{...f,s:f.s-1}:f);draft.anim.sheets.splice(s,1);rt.splice(s,1);prune();curSheet=Math.max(0,s-1);mark();render();return}
   if(d.anim){curAnim=d.anim;curFrame=-1;playing=true;render();return}
   if(d.fx!==undefined){curFx=Number(d.fx);curFrame=-1;playing=true;render();return}
   if(d.fxAdd){draft.anim.effects.push({name:'Hiệu ứng '+(draft.anim.effects.length+1),fps:15,scale:1,additive:false,frames:[]});curFx=draft.anim.effects.length-1;curFrame=-1;mark();render();return}
   if(d.fxRemove){const i=curFx;draft.anim.effects.splice(i,1);for(const k of ['attack','skill'])for(const f of ['cast','impact']){const v=draft.anim[k][f];if(v===i)draft.anim[k][f]=null;else if(v>i)draft.anim[k][f]=v-1}curFx=0;mark();render();return}
   if(d.playtoggle){playing=!playing;if(playing)curFrame=-1;render();return}
   const seq=currentSeq();
   if(d.frame&&t.closest('.hc-viewer')){const id=Number(d.frame);
    if(t.closest('.hc-viewer').dataset.mode==='sheet'){if(eyedrop)return;if(e.shiftKey||e.ctrlKey){sel.has(id)?sel.delete(id):sel.add(id)}else{sel.clear();sel.add(id)}render();return}
    if(!seq)return;const f=frameById(id);
    if(e.shiftKey){const row=sortRows(framesOn(f.s)),start=row.indexOf(f),same=row.filter(o=>Math.abs((o.y+o.h/2)-(f.y+f.h/2))<f.h*.5&&o.x>=f.x);for(const o of same)seq.frames.push({f:o.id})}else seq.frames.push({f:id});
    if(seq.fps===undefined)seq.fps=12;mark();render();return}
   if(d.cell!==undefined&&!e.target.closest('button,input')){curFrame=Number(d.cell)===curFrame?-1:Number(d.cell);playing=curFrame<0;render();return}
   const cell=t.closest('[data-cell]');
   if(d.move&&cell){const i=Number(cell.dataset.cell),j=i+Number(d.move);if(j<0||j>=seq.frames.length)return;[seq.frames[i],seq.frames[j]]=[seq.frames[j],seq.frames[i]];if(seq.hit===i)seq.hit=j;else if(seq.hit===j)seq.hit=i;if(curFrame===i)curFrame=j;mark();render();return}
   if(d.hit!==undefined){const i=Number(d.hit);seq.hit=seq.hit===i?undefined:i;if(seq.hit===undefined)delete seq.hit;mark();render();return}
   if(d.dup!==undefined){const i=Number(d.dup);seq.frames.splice(i+1,0,{...seq.frames[i]});if(seq.hit>i)seq.hit++;mark();render();return}
   if(d.cut!==undefined){const i=Number(d.cut);seq.frames.splice(i,1);if(seq.hit===i)delete seq.hit;else if(seq.hit>i)seq.hit--;curFrame=-1;mark();render();return}
   if(d.refoot){for(const x of seq.frames){const f=frameById(x.f);Object.assign(f,footOf(f.s,f))}mark();render();return}
   if(d.zero){for(const x of seq.frames){delete x.dx;delete x.dy}mark();render();return}
   if(d.reverse){seq.frames.reverse();delete seq.hit;mark();render();return}
   if(d.clear){if(!confirm('Xoá mọi khung của chuỗi này?'))return;seq.frames=[];delete seq.hit;curFrame=-1;mark();render();return}
   if(d.skillAdd){draft.skills.push({name:'Bị động '+draft.skills.length,icon:'skillicon-661',levels:['Bị động: Tăng bản thân 10% Công.','Bị động: Tăng bản thân 15% Công.','Bị động: Tăng bản thân 20% Công.','Bị động: Tăng bản thân 25% Công.']});mark();render();return}
   if(d.skillRemove){draft.skills.splice(Number(d.skillRemove),1);mark();render();return}
   if(d.level){const [i,k]=d.level.split(':').map(Number);skillLevel[i]=k;render();return}
   if(d.autolevel!==undefined){autoLevels(Number(d.autolevel));mark();render();return}
   if(d.icon!==undefined){openIconPicker(Number(d.icon));return}
   if(d.fromSprite){const c=idleCanvas();if(!c)throw Error('Cần hoạt ảnh Đứng yên trước.');setPortrait(c);render();return}
  }catch(error){toast(error.message)}
 });
 async function reprocess(){const r=rt[curSheet];processSheet(r);detect(curSheet);mark();render()}
 root.addEventListener('change',async e=>{
  const t=e.target,d=t.dataset;
  try{
   if(d.addSheet){for(const file of t.files)await addSheetFile(file);step='sheet';render();return}
   if(d.f){draft[d.f]=t.type==='checkbox'?t.checked:d.num?Number(t.value):t.value;if(d.f==='rank'||d.f==='class')draft.statScale=defScale(draft.rank,draft.class);mark();render();return}
   if(d.scale){draft.statScale[d.scale]=Number(t.value);mark();return}
   if(d.stat){draft.stats[d.stat]=Math.max(0,Math.round(Number(t.value)||0));mark();return}
   if(d.grid){const v=clamp(Math.round(Number(t.value)||1),1,40);if(d.grid==='rows')gridRows=v;else gridCols=v;return}
   if(d.opt){const o=rt[curSheet].opts;if(d.opt==='transparent'){o.transparent=t.checked;if(!t.checked&&!o.keys.length)o.keys=autoOpts(rt[curSheet].original).keys}else o[d.opt]=Number(t.value);
    if(d.opt==='gap'||d.opt==='min'){detect(curSheet);mark();render()}else await reprocess();return}
   if(d.global){draft.anim[d.global]=t.type==='checkbox'?t.checked:clamp(Number(t.value)||1,.05,10);mark();render();return}
   if(d.fps){const seq=currentSeq();seq.fps=clamp(Math.round(Number(t.value)||10),1,60);mark();render();return}
   if(d.dur!==undefined){const seq=currentSeq();const v=clamp(Math.round(Number(t.value)||1),1,60);if(v===1)delete seq.frames[Number(d.dur)].d;else seq.frames[Number(d.dur)].d=v;mark();render();return}
   if(d.fxf){const fx=draft.anim.effects[curFx];fx[d.fxf]=t.type==='checkbox'?t.checked:d.fxf==='scale'?clamp(Number(t.value)||1,.05,10):t.value.slice(0,30);mark();render();return}
   if(d.assign){at(d.assign,t.value===''?null:d.assign==='skill.castAt'?t.value:Number(t.value));mark();return}
   if(d.assignNum){at(d.assignNum,Number(t.value)||0);mark();return}
   if(d.assignBool){at(d.assignBool,t.checked);mark();return}
   if(d.skillName!==undefined){draft.skills[Number(d.skillName)].name=t.value.slice(0,40);mark();return}
   if(d.sample!==undefined&&t.value!==''){const i=Number(d.sample),s=draft.skills[i],lv=skillLevel[i],text=SAMPLES[i?'passive':'ult'][Number(t.value)],cur=(s.levels[lv]||'').replace(/^(Nộ|Bị động)\s*:\s*/i,'').trim();s.levels[lv]=(i?'Bị động: ':'Nộ: ')+(cur?cur.replace(/\.?$/,'. '):'')+text;mark();render();return}
   if(d.portrait){const file=t.files[0];if(!file)return;const url=URL.createObjectURL(file);setPortrait(await loadImg(url));render();return}
   if(d.zoomcrop){port.crops[d.zoomcrop].zoom=Number(t.value);drawCrop(root.querySelector(`canvas[data-crop="${d.zoomcrop}"]`),d.zoomcrop);mark();return}
  }catch(error){toast(error.message)}
 });
 root.addEventListener('input',e=>{const t=e.target,d=t.dataset;
  if(d.desc){const [i,k]=d.desc.split(':').map(Number);draft.skills[i].levels[k]=t.value;mark();compileSoon(i)}
  if(d.zoomcrop&&port){port.crops[d.zoomcrop].zoom=Number(t.value);drawCrop(root.querySelector(`canvas[data-crop="${d.zoomcrop}"]`),d.zoomcrop);mark()}
 });
 // Kéo trên sheet: vẽ khung mới (bước 2) hoặc hút màu nền. Kéo trong ô ảnh: dời vùng cắt.
 root.addEventListener('pointerdown',e=>{
  const crop=e.target.closest('canvas[data-crop]');
  if(crop&&port){const k=crop.dataset.crop,c=port.crops[k],sx=e.clientX,sy=e.clientY,cx=c.cx,cy=c.cy,src=port.src,sw=src.width||src.naturalWidth,sh=src.height||src.naturalHeight,[w,h]=IMG[k],cover=Math.max(w/sw,h/sh)*c.zoom,scale=crop.clientWidth/w;
   const move=ev=>{c.cx=cx-(ev.clientX-sx)/scale/cover/sw;c.cy=cy-(ev.clientY-sy)/scale/cover/sh;drawCrop(crop,k);mark()};const up=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up)};addEventListener('pointermove',move);addEventListener('pointerup',up);return}
  const stage=e.target.closest('.hc-viewer[data-mode="sheet"] .hc-stage');if(!stage)return;const z=curZoom(),box=stage.getBoundingClientRect(),px=(e.clientX-box.left)/z,py=(e.clientY-box.top)/z;
  if(eyedrop){const r=rt[curSheet];if(!r.original)return;const x=Math.floor(px),y=Math.floor(py),i=(y*r.original.width+x)*4,c=[...r.original.data.slice(i,i+3)];r.opts.keys.push(c);r.opts.transparent=false;eyedrop=false;reprocess();return}
  if(e.target.closest('.hc-box'))return;
  const draw=stage.querySelector('.hc-draw'),sx=px,sy=py;let rect=null;
  const move=ev=>{const x=(ev.clientX-box.left)/z,y=(ev.clientY-box.top)/z,s=draft.anim.sheets[curSheet];rect={x:Math.round(clamp(Math.min(sx,x),0,s.w-1)),y:Math.round(clamp(Math.min(sy,y),0,s.h-1))};rect.w=Math.round(clamp(Math.abs(x-sx),1,s.w-rect.x));rect.h=Math.round(clamp(Math.abs(y-sy),1,s.h-rect.y));Object.assign(draw.style,{left:rect.x*z+'px',top:rect.y*z+'px',width:rect.w*z+'px',height:rect.h*z+'px'});draw.hidden=false};
  const up=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);draw.hidden=true;
   if(rect&&rect.w>=4&&rect.h>=4){const f={id:nextFrame++,s:curSheet,...rect,manual:true};Object.assign(f,footOf(curSheet,f));draft.anim.frames.push(f);sel.clear();sel.add(f.id);mark()}else sel.clear();render()};
  addEventListener('pointermove',move);addEventListener('pointerup',up);
 });
 document.addEventListener('keydown',e=>{if(root.hidden||step!=='sheet'||!sel.size||!['Delete','Backspace'].includes(e.key)||e.target.closest('input,textarea,select'))return;draft.anim.frames=draft.anim.frames.filter(f=>!sel.has(f.id));prune();sel.clear();mark();render()});
 // Biểu tượng kỹ năng: chọn từ biểu tượng gốc hoặc tải ảnh (cắt vuông 100×100).
 function openIconPicker(i){
  const keys=Object.keys(assets||{}).filter(k=>k.startsWith('skillicon-')),shade=document.createElement('div');shade.className='rw-picker-shade';
  shade.innerHTML=`<div class="beast-picker rw-picker hc-iconpicker" role="dialog" aria-label="Chọn biểu tượng"><div class="row spread"><h3>Biểu tượng kỹ năng</h3><button type="button" class="ghost mini" data-x="1">Đóng</button></div><div class="row"><input type="search" placeholder="Lọc theo số" data-q="1"><label class="hc-file">Tải ảnh…<input type="file" accept="image/*" hidden data-up="1"></label></div><div class="hc-icons">${keys.map(k=>`<button type="button" class="ghost" data-k="${k}" title="${k}"><img loading="lazy" src="${escape(assetSrc(k))}" alt=""></button>`).join('')}</div></div>`;
  document.body.appendChild(shade);const close=()=>shade.remove();
  shade.addEventListener('click',e=>{if(e.target===shade||e.target.closest('[data-x]'))return close();const b=e.target.closest('[data-k]');if(b){const s=draft.skills[i];s.icon=b.dataset.k;delete s._iconBlob;delete s._iconSrc;mark();close();render()}});
  shade.querySelector('[data-q]').oninput=e=>{for(const b of shade.querySelectorAll('[data-k]'))b.hidden=!b.dataset.k.includes(e.target.value.trim())};
  shade.querySelector('[data-up]').onchange=async e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f),im=await loadImg(url),c=document.createElement('canvas');c.width=c.height=100;const k=Math.max(100/im.naturalWidth,100/im.naturalHeight);c.getContext('2d').drawImage(im,(100-im.naturalWidth*k)/2,(100-im.naturalHeight*k)/2,im.naturalWidth*k,im.naturalHeight*k);
   const s=draft.skills[i];s._iconBlob=await toBlob(c,.92);s._iconSrc=c.toDataURL('image/webp');s.icon=s.icon&&!/^[a-f0-9]{24}$/.test(s.icon)?s.icon:'skillicon-660';mark();close();render()};
 }
 async function show(){
  root.hidden=false;
  if(!assets)[assets,visuals]=await Promise.all([fetch('assets.json').then(r=>r.json()),fetch('game-visuals.json').then(r=>r.json())]);
  list=await api('/api/admin/heroes');render();
 }
 function hide(){root.hidden=true;previewToken++;battleToken++}
 window.addEventListener('beforeunload',e=>{if(dirty&&!root.hidden){e.preventDefault();e.returnValue=''}});
 window.AdminHeroes={show,hide,get draft(){return draft},get rt(){return rt}};
})();
