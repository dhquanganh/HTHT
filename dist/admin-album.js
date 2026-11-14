/* Tab "Tranh Người Cá" của trang quản trị (server/album-config.mjs): phí rút, tỉ lệ thành công, tỉ lệ trùng mảnh,
   chỉ số / điều kiện từng tranh, thêm tranh mới. Ảnh tải lên được cắt ngay trong trình duyệt về khung tranh gốc
   516×388 (4:3, phủ kín, chỉnh được vị trí cắt), xem trước lưới mảnh rows × cols, xuất WebP rồi mới gửi lên máy chủ. */
(()=>{
 'use strict';
 const {api,upload,toast,escape,num}=window.AdminApp,$=s=>document.querySelector(s),root=$('#album-tab');
 let data=null,draft=null,selected=0,dirty=false,crop=null;
 const W=516,H=388;
 function load(){draft={fee:data.fee,successRate:data.successRate,duplicateRate:data.duplicateRate,lucThucPerPercent:data.lucThucPerPercent,pictures:structuredClone(data.pictures)};dirty=false;selected=Math.min(selected,draft.pictures.length-1);crop=null}
 const pic=()=>draft.pictures[selected];
 const pointName=id=>data.points.find(p=>p.id===id)?.name||(id===97?'Lục thức':'Chỉ số '+id);
 const mark=()=>{dirty=true;const b=$('#al-undo');if(b)b.disabled=false;const n=$('#al-dirty');if(n)n.hidden=false};
 function grid(p,src){const cells=Array.from({length:p.rows*p.cols},(_,i)=>`<span>${String.fromCharCode(65+Math.floor(i/p.cols))}${i%p.cols+1}</span>`).join('');
  return `<div class="al-art"><img src="${escape(src)}" alt=""><div class="al-grid" style="grid-template:repeat(${p.rows},1fr)/repeat(${p.cols},1fr)">${cells}</div></div>`}
 // Kỳ vọng số lượt rút để đủ tranh n mảnh: mỗi lượt mở mảnh mới với xác suất s·(1−d) (d chỉ áp khi đã có mảnh).
 function expected(n){const s=draft.successRate/100,d=draft.duplicateRate/100;if(!s)return Infinity;let t=1/s;for(let k=1;k<n;k++){const q=s*(1-d);if(!q)return Infinity;t+=1/q}return t}
 function rates(){
  const n=pic()?.rows*pic()?.cols||4,e=expected(n);
  return `<section class="card al-rates"><h2>Tỉ lệ nâng tranh <span id="al-dirty" class="rw-badge" ${dirty?'':'hidden'}>Chưa lưu</span>${data.edited?'<span class="rw-badge">Đã sửa</span>':''}</h2>
   <div class="row gb-row"><label class="ev-num">Phí 1 lượt (Thẻ huyền bí)<input type="number" min="1" value="${draft.fee}" data-top="fee"></label>
   <label class="ev-num">Tỉ lệ thành công %<input type="number" min="0" max="100" step="0.1" value="${draft.successRate}" data-top="successRate"></label>
   <label class="ev-num">Tỉ lệ trùng mảnh %<input type="number" min="0" max="100" step="0.1" value="${draft.duplicateRate}" data-top="duplicateRate"></label><label class="ev-num">Lục thức chênh lệch = giảm 1% ST<input type="number" min="1" value="${draft.lucThucPerPercent}" data-top="lucThucPerPercent"></label></div>
   <p class="muted">Mỗi lượt rút: thất bại theo (100 − tỉ lệ thành công)% thì mất phí, không ra mảnh. Thành công thì có tỉ lệ trùng mảnh ra lại một mảnh đã có (chỉ khi đã có ít nhất 1 mảnh); còn lại mở một mảnh mới. Gốc: 100% / 0%. Lục thức (PvP Chiến trường): đội có tổng Lục thức cao hơn giảm sát thương nhận theo chênh lệch ÷ ô trên, tối đa 70%.
   Tranh đang chọn (${n} mảnh) cần trung bình <b>${Number.isFinite(e)?num(Math.ceil(e)):'∞'}</b> lượt ≈ <b>${Number.isFinite(e)?num(Math.ceil(e*draft.fee)):'∞'}</b> thẻ.</p></section>`;
 }
 function editor(){
  const p=pic();if(!p)return'<p class="muted">Chưa có tranh.</p>';
  const others=draft.pictures.filter(x=>x!==p);
  const points=p.points.map(([id,v],i)=>`<div class="row gb-row al-point"><select data-point-id="${i}">${data.points.map(o=>`<option value="${o.id}" ${o.id===id?'selected':''}>${escape(o.name)}</option>`).join('')}${id===97?'<option value="97" selected>Lục thức</option>':''}</select><input type="number" min="1" value="${v}" data-point-value="${i}" aria-label="Giá trị">${p.points.length>1?`<button type="button" class="ghost mini" data-point-remove="${i}">×</button>`:''}</div>`).join('');
  return `<h2>Tranh ${p.album}-${p.image} · ${escape(p.name)} ${p.custom?'<span class="rw-badge">Tranh thêm mới</span>':''}</h2>
   <div class="al-edit">${grid(p,p.preview)}
   <div class="al-fields"><div class="row gb-row"><label class="ev-num">Tên<input value="${escape(p.name)}" maxlength="40" data-field="name"></label><label class="ev-num">Album<input type="number" min="1" value="${p.album}" data-num="album"></label><label class="ev-num">Ảnh<input type="number" min="1" max="99" value="${p.image}" data-num="image"></label></div>
   <div class="row gb-row"><label class="ev-num">Số hàng<input type="number" min="1" max="10" value="${p.rows}" data-num="rows"></label><label class="ev-num">Số cột<input type="number" min="1" max="10" value="${p.cols}" data-num="cols"></label><span class="muted">${p.rows*p.cols} mảnh</span></div>
   <div class="row gb-row"><label class="ev-num">Cấp yêu cầu<input type="number" min="1" value="${p.requireLevel}" data-num="requireLevel"></label><label class="ev-num">Tranh phải xong trước<select data-num="requireImage"><option value="0">Không</option>${others.map(o=>{const code=o.album*100+o.image;return `<option value="${code}" ${code===p.requireImage?'selected':''}>${o.album}-${o.image} ${escape(o.name)}</option>`}).join('')}</select></label></div>
   <h3>Chỉ số cộng cho toàn đội khi đủ mảnh</h3>${points}${p.points.length<6?'<button type="button" class="ghost mini" data-point-add="1">+ Thêm chỉ số</button>':''}
   <div class="row"><label class="ghost mini al-file">Đổi ảnh…<input type="file" accept="image/*" data-replace="1" hidden></label>${p.custom?'<button type="button" class="danger mini" data-delete="1">Xoá tranh</button>':''}</div></div></div>`;
 }
 function cropper(){
  if(!crop)return'';
  return `<div class="rw-picker-shade"><div class="beast-picker rw-picker al-crop" role="dialog" aria-label="Cắt ảnh tranh"><h3>${crop.replace?'Đổi ảnh tranh':'Tranh mới'} · cắt về khung ${W}×${H}</h3>
   <canvas id="al-canvas" width="${W}" height="${H}"></canvas>
   <div class="row gb-row"><label class="ev-num">Phóng to %<input type="range" min="100" max="300" value="${crop.zoom}" data-crop="zoom"></label><label class="ev-num">Ngang<input type="range" min="0" max="100" value="${crop.x}" data-crop="x"></label><label class="ev-num">Dọc<input type="range" min="0" max="100" value="${crop.y}" data-crop="y"></label></div>
   ${crop.replace?'':`<div class="row gb-row"><label class="ev-num">Tên<input id="al-new-name" maxlength="40" value="${escape(crop.name)}"></label><label class="ev-num">Số hàng<input id="al-new-rows" type="number" min="1" max="10" value="${crop.rows}"></label><label class="ev-num">Số cột<input id="al-new-cols" type="number" min="1" max="10" value="${crop.cols}"></label></div>`}
   <p class="muted">Ảnh gốc ${crop.img.naturalWidth}×${crop.img.naturalHeight}. Ảnh được cắt phủ kín khung 4:3 như tranh gốc rồi chia lưới mảnh để xem trước.</p>
   <div class="al-pieces" id="al-pieces"></div>
   <div class="row"><button type="button" id="al-crop-ok">${crop.replace?'Dùng ảnh này':'Tạo tranh'}</button><button type="button" class="ghost" id="al-crop-cancel">Hủy</button></div></div></div>`;
 }
 function render(){
  if(!data||root.hidden)return;const sc=root.querySelector('.ev-list-admin')?.scrollTop||0,ed=root.querySelector('.ev-edit')?.scrollTop||0;
  const nav=draft.pictures.map((p,i)=>`<button type="button" class="ev-pick al-pick ${i===selected?'on':''}" data-pick="${i}"><img src="${escape(p.preview)}" alt=""><span><b>${p.album}-${p.image} ${escape(p.name)}</b><small>${p.rows}×${p.cols} · ${p.points.map(([id,v])=>num(v)+' '+escape(pointName(id))).join(', ')}</small></span></button>`).join('');
  root.innerHTML=`${rates()}<section class="card ev-admin rw-admin"><nav class="ev-list-admin gb-nav"><div class="row gb-tools"><label class="al-file al-add">+ Thêm tranh mới (tải ảnh)<input type="file" accept="image/*" data-new="1" hidden></label></div><p class="muted">${draft.pictures.length} tranh (gốc ${data.defaultCount})</p>${nav}</nav>
   <div class="ev-edit">${editor()}<div class="row ev-actions rw-actions"><button type="button" id="al-save">Lưu tất cả</button><button type="button" class="ghost" id="al-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="al-reset">Về mặc định</button></div></div></section>${cropper()}`;
  const n=root.querySelector('.ev-list-admin');if(n)n.scrollTop=sc;const e=root.querySelector('.ev-edit');if(e)e.scrollTop=ed;if(crop)drawCrop();
 }
 // ---- Cắt ảnh: phủ kín 516×388, phóng to và dời vị trí cắt.
 function cropRect(){const {img,zoom,x,y}=crop,iw=img.naturalWidth,ih=img.naturalHeight,base=Math.min(iw/W,ih/H),sw=W*base*100/zoom,sh=H*base*100/zoom;return{sx:(iw-sw)*x/100,sy:(ih-sh)*y/100,sw,sh}}
 function drawCrop(){
  const cv=$('#al-canvas');if(!cv)return;const ctx=cv.getContext('2d'),r=cropRect();ctx.drawImage(crop.img,r.sx,r.sy,r.sw,r.sh,0,0,W,H);
  const rows=crop.replace?pic().rows:Number($('#al-new-rows')?.value)||crop.rows,cols=crop.replace?pic().cols:Number($('#al-new-cols')?.value)||crop.cols;
  ctx.strokeStyle='rgba(255,230,109,.9)';ctx.lineWidth=2;for(let i=1;i<cols;i++){ctx.beginPath();ctx.moveTo(i*W/cols,0);ctx.lineTo(i*W/cols,H);ctx.stroke()}for(let i=1;i<rows;i++){ctx.beginPath();ctx.moveTo(0,i*H/rows);ctx.lineTo(W,i*H/rows);ctx.stroke()}
  // Các mảnh tách riêng (xem trước từng ô của lưới).
  const box=$('#al-pieces');if(!box)return;box.style.gridTemplateColumns=`repeat(${cols},1fr)`;box.innerHTML='';
  for(let i=0;i<rows*cols;i++){const c=document.createElement('canvas'),pw=Math.round(W/cols),ph=Math.round(H/rows);c.width=pw;c.height=ph;c.getContext('2d').drawImage(crop.img,r.sx+r.sw*(i%cols)/cols,r.sy+r.sh*Math.floor(i/cols)/rows,r.sw/cols,r.sh/rows,0,0,pw,ph);c.title=String.fromCharCode(65+Math.floor(i/cols))+(i%cols+1);box.appendChild(c)}
 }
 async function exportArt(){const cv=document.createElement('canvas');cv.width=W;cv.height=H;const r=cropRect();cv.getContext('2d').drawImage(crop.img,r.sx,r.sy,r.sw,r.sh,0,0,W,H);
  let blob=await new Promise(res=>cv.toBlob(res,'image/webp',.9));if(!blob||blob.type!=='image/webp')throw Error('Trình duyệt không xuất được WebP.');return blob}
 async function openFile(file,replace){
  if(!file)return;if(!file.type.startsWith('image/'))return toast('Hãy chọn tệp ảnh.');if(file.size>25e6)return toast('Ảnh quá lớn (tối đa 25 MB).');
  const url=URL.createObjectURL(file),img=new Image();img.src=url;await img.decode().catch(()=>{throw Error('Không đọc được ảnh.')});
  const last=draft.pictures.reduce((m,p)=>p.album>m.album||p.album===m.album&&p.image>m.image?p:m,draft.pictures[0]);
  crop={img,url,replace,zoom:100,x:50,y:50,name:file.name.replace(/\.[^.]+$/,'').slice(0,40)||'Tranh mới',rows:3,cols:3,last};render();
 }
 root.addEventListener('change',async e=>{
  const t=e.target;
  try{
   if(t.dataset.new){await openFile(t.files[0],false);return}
   if(t.dataset.replace){await openFile(t.files[0],true);return}
   if(t.dataset.num==='requireImage'){pic().requireImage=Number(t.value);mark();return}
   if(t.dataset.pointId!==undefined){pic().points[t.dataset.pointId][0]=Number(t.value);mark();render();return}
   if(t.dataset.num==='rows'||t.dataset.num==='cols')render();
  }catch(error){toast(error.message)}
 });
 root.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.top){draft[t.dataset.top]=Number(t.value);mark();const box=root.querySelector('.al-rates');if(box){const pos=t.selectionStart;box.outerHTML=rates();const f=root.querySelector(`[data-top="${t.dataset.top}"]`);f.focus();try{f.setSelectionRange(pos,pos)}catch{}}return}
  if(t.dataset.field){pic()[t.dataset.field]=t.value;mark();return}
  if(t.dataset.num&&t.dataset.num!=='requireImage'){pic()[t.dataset.num]=Number(t.value);mark();return}
  if(t.dataset.pointValue!==undefined){pic().points[t.dataset.pointValue][1]=Number(t.value);mark();return}
  if(t.dataset.crop){crop[t.dataset.crop]=Number(t.value);drawCrop();return}
  if(t.id==='al-new-rows'||t.id==='al-new-cols'){crop[t.id==='al-new-rows'?'rows':'cols']=Number(t.value)||1;drawCrop()}
 });
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.pick){selected=Number(t.dataset.pick);render();root.querySelector('.ev-edit').scrollTop=0;return}
   if(t.dataset.pointAdd){pic().points.push([0,100]);mark();render();return}
   if(t.dataset.pointRemove){pic().points.splice(Number(t.dataset.pointRemove),1);mark();render();return}
   if(t.dataset.delete){if(!confirm(`Xoá tranh ${pic().name}? Người chơi mất tiến độ tranh này sau khi lưu.`))return;draft.pictures.splice(selected,1);for(const p of draft.pictures)if(p.requireImage&&!draft.pictures.some(o=>o.album*100+o.image===p.requireImage))p.requireImage=0;selected=Math.max(0,selected-1);mark();render();return}
   if(t.id==='al-crop-cancel'){URL.revokeObjectURL(crop.url);crop=null;render();return}
   if(t.id==='al-crop-ok'){
    t.disabled=true;const blob=await exportArt(),saved=await upload('/api/admin/album/art',blob);
    if(crop.replace)Object.assign(pic(),{art:saved.art,artSrc:saved.src,preview:saved.src,custom:true});
    else{const l=crop.last,sameAlbum=l.image<99;draft.pictures.push({album:sameAlbum?l.album:l.album+1,image:sameAlbum?l.image+1:1,name:($('#al-new-name').value||'Tranh mới').trim().slice(0,40),rows:crop.rows,cols:crop.cols,points:[[2,10000]],requireImage:0,requireLevel:1,art:saved.art,artSrc:saved.src,preview:saved.src,custom:true});selected=draft.pictures.length-1}
    URL.revokeObjectURL(crop.url);crop=null;mark();render();toast('Đã tải ảnh. Bấm "Lưu tất cả" để áp vào game.');return}
   if(t.id==='al-undo'){load();render();return}
   if(t.id==='al-save'){data=await api('/api/admin/album',{fee:draft.fee,successRate:draft.successRate,duplicateRate:draft.duplicateRate,lucThucPerPercent:draft.lucThucPerPercent,pictures:draft.pictures.map(({custom,preview,...p})=>p)});load();render();toast('Đã lưu. Người chơi thấy tranh mới khi tải lại game.');return}
   if(t.id==='al-reset'){if(!confirm('Trả Tranh Người Cá về mặc định (tỉ lệ gốc, 120 tranh gốc)? Tranh thêm mới sẽ bị gỡ.'))return;data=await api('/api/admin/album',{reset:true});load();render();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message);t.disabled=false}
 });
 window.AdminAlbum={async show(){root.hidden=false;data=await api('/api/admin/album');load();render()},hide(){root.hidden=true}};
})();
