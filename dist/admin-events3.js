/* Tab quản trị Bữa tiệc Sanji / Trang trí tàu / Giáng Sinh - Sinh Nhật. Mỗi tab sửa cấu hình của sự kiện (server kiểm tra lại
   và lưu ở sanji_config / decor_config / xmas_config). Dùng chung một bộ dựng giao diện: số, chữ, danh sách thưởng, bảng dòng. */
(()=>{
 'use strict';
 const {api,toast,escape,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s);
 function editor({tab,url,views,label}){
  const root=$('#'+tab);let data=null,draft=null,view=views[0][0],dirty=false,picker=null;
  const pool=()=>[...(data.rewardItems||[]),...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
  const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
  const set=(path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],draft)[last]=value;dirty=true};
  const h={
   num:(path,lab,min=0,step=1)=>`<label class="ev-num">${lab}<input type="number" min="${min}" step="${step}" value="${get(path)??''}" data-num="${path}"${step!==1?' data-float':''}></label>`,
   txt:(path,lab,max=60)=>`<label class="ev-num grow">${lab}<input type="text" maxlength="${max}" value="${escape(get(path)??'')}" data-text="${path}"></label>`,
   sel:(path,lab,opts)=>`<label class="ev-num">${lab}<select data-sel="${path}">${opts.map(([v,t])=>`<option value="${v}" ${String(get(path))===String(v)?'selected':''}>${t}</option>`).join('')}</select></label>`,
   chip:(path,r,removable=true)=>{const i=info(r.itemId);return `<span class="beast-chip gem-chip" title="${escape(i.name)}"><button type="button" class="ghost mini swap" data-swap="${path}" aria-label="Đổi vật phẩm">${icon(i.icon)}</button><span class="grow">${escape(i.name)}</span><input type="number" min="1" step="1" value="${r.quantity}" data-num="${path}.quantity" aria-label="Số lượng">${removable?`<button type="button" class="ghost mini" data-remove="${path}" aria-label="Xóa">×</button>`:''}</span>`},
   list:(path,lab)=>`<div class="row"><b class="raid-index">${lab}</b><div class="beast-chips">${(get(path)||[]).map((r,k)=>h.chip(`${path}.${k}`,r)).join('')}<button type="button" class="ghost mini" data-add="${path}">+ Thêm</button></div></div>`,
   one:(path,lab,optional=false)=>{const r=get(path);return `<div class="row"><b class="raid-index">${lab}</b><div class="beast-chips">${r?h.chip(path,r,optional):''}${!r?`<button type="button" class="ghost mini" data-setone="${path}">+ Chọn</button>`:''}${r&&optional?'':''}</div></div>`},
   rows:(path,lab,row,make)=>`<h3>${lab}</h3>${(get(path)||[]).map((x,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">${i+1}</b>${row(`${path}.${i}`,x,i)}<button type="button" class="ghost mini" data-delrow="${path}.${i}">Xóa</button></div>`).join('')}${make?`<div class="row"><button type="button" class="ghost" data-addrow="${path}">+ Thêm</button></div>`:''}`,
  };
  const makers={};
  function render(){
   const v=views.find(x=>x[0]===view);
   root.innerHTML=`<section class="card ev-admin raid-admin gem-admin"><nav class="ev-list-admin">${views.map(([k,t,s])=>`<button type="button" class="ev-pick ${view===k?'on':''}" data-view="${k}"><b>${t}</b><small>${typeof s==='function'?s(draft):s}</small></button>`).join('')}</nav>
    <div class="ev-edit"><label class="ev-toggle"><input type="checkbox" data-enabled ${draft.enabled!==false?'checked':''}><span>${draft.enabled!==false?'Đang bật: hiện trong cửa sổ Sự kiện đặc biệt':'Đang tắt: ẩn khỏi game, người chơi không thao tác được'}</span></label>${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<p class="muted">${data.custom?'Đang dùng cấu hình đã sửa'+(data.updatedAt?' · cập nhật '+new Date(data.updatedAt).toLocaleString('vi-VN'):''):'Đang dùng cấu hình mặc định.'}</p>
    ${v[3](h,draft,makers)}
    <div class="row ev-actions"><button type="button" data-save="1">Lưu</button><button type="button" class="ghost" data-undo="1" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" data-reset="1">Về mặc định</button></div>
    ${picker?`<div class="beast-picker ev-picker"><input data-search="1" type="search" placeholder="Tìm vàng, kim cương hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><div class="beast-matches" data-matches="1"></div></div>`:''}</div></section>`;
   if(picker){matches();root.querySelector('[data-search]').focus()}
  }
  function matches(){const t=fold((root.querySelector('[data-search]')?.value||'').trim()),l=pool().filter(i=>!t||fold(i.name).includes(t)||fold(i.id).includes(t)).slice(0,30);
   root.querySelector('[data-matches]').innerHTML=l.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
  const load=()=>{draft=structuredClone(data.config);dirty=false;picker=null};
  const touched=()=>{const b=root.querySelector('[data-undo]');if(b)b.disabled=false};

 // Công tắc bật / tắt sự kiện (lưu cùng nút Lưu).
  root.addEventListener('change',e=>{if(e.target.dataset.enabled===undefined)return;draft.enabled=e.target.checked;dirty=true;render()});
  root.addEventListener('input',e=>{const t=e.target;if(t.dataset.search)return matches();
   if(t.dataset.num){const v=t.value===''?null:Number(t.value);set(t.dataset.num,v===null?null:t.dataset.float!==undefined?v:Math.floor(v));touched()}
   if(t.dataset.text){set(t.dataset.text,t.value);touched()}});
  root.addEventListener('change',e=>{const t=e.target;if(t.dataset.sel){const v=t.value;set(t.dataset.sel,/^-?\d+$/.test(v)?Number(v):v);touched()}});
  root.addEventListener('click',async e=>{const t=e.target.closest('button');if(!t)return;
   try{
    if(t.dataset.view){view=t.dataset.view;picker=null;return render()}
    if(t.dataset.add){picker={mode:'add',path:t.dataset.add};return render()}
    if(t.dataset.swap){picker={mode:'swap',path:t.dataset.swap};return render()}
    if(t.dataset.setone){picker={mode:'one',path:t.dataset.setone};return render()}
    if(t.dataset.pick){const id=t.dataset.pick;if(picker.mode==='add')get(picker.path).push({itemId:id,quantity:1});else if(picker.mode==='one')set(picker.path,{itemId:id,quantity:1});else set(picker.path+'.itemId',id);dirty=true;picker=null;return render()}
    if(t.dataset.remove){const keys=t.dataset.remove.split('.'),last=keys.pop(),parent=get(keys.join('.'));if(Array.isArray(parent))parent.splice(Number(last),1);else parent[last]=null;dirty=true;return render()}
    if(t.dataset.delrow){const keys=t.dataset.delrow.split('.'),i=Number(keys.pop());get(keys.join('.')).splice(i,1);dirty=true;return render()}
    if(t.dataset.addrow){const p=t.dataset.addrow,list=get(p);list.push(makers[p]?makers[p](list):structuredClone(list.at(-1)));dirty=true;return render()}
    if(t.dataset.undo){load();return render()}
    if(t.dataset.save){data=await api(url,{config:draft});load();render();return toast('Đã lưu. Có hiệu lực ngay.')}
    if(t.dataset.reset){if(!confirm(`Trả ${label} về cấu hình mặc định?`))return;data=await api(url,{reset:true});load();render();return toast('Đã trả về mặc định.')}
   }catch(error){toast(error.message)}});
  return{async show(){root.hidden=false;data=await api(url);load();render()},hide(){root.hidden=true}};
 }
 const it=(itemId,quantity)=>({itemId,quantity});
 window.AdminSanji=editor({tab:'sanji-tab',url:'/api/admin/sanji',label:'Bữa tiệc Sanji',views:[
  ['common','Chung & món ăn','Cấp mở, tăng tốc, 3 món',(h,d)=>`<h3>Thiết lập chung</h3><div class="row raid-common">${h.num('minLevel','Cấp tối thiểu',1)}${h.num('skipPerHour','Kim cương tăng tốc / giờ hồi',0)}</div>
   <p class="muted">Mùa theo tuần (giờ Việt Nam). Tim (điểm vui vẻ) và lượt mua trong cửa hàng làm lại mỗi tuần; cuối tuần gửi thưởng top qua thư.</p>
   <h3>3 món ăn</h3><p class="muted">Bỏ phí tặng (×) để món đó miễn phí.</p>${d.dishes.map((x,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">${i+1}</b>${h.txt(`dishes.${i}.name`,'Tên',40)}${h.num(`dishes.${i}.spoons`,'Mì Ý Sanji nhận',0)}${h.num(`dishes.${i}.hearts`,'Tim nhận',1)}${h.num(`dishes.${i}.cooldownHours`,'Giờ hồi',0)}<div class="grow">${h.one(`dishes.${i}.fee`,'Phí tặng',true)}</div></div>`).join('')}`],
  ['milestones','Quà mốc Tim',d=>d.milestones.length+' mốc',(h,d,mk)=>{mk.milestones=l=>({point:(l.at(-1)?.point||0)+100,rewards:[it('gold',100000)]});return h.rows('milestones','Quà mốc theo Tim',(p)=>`${h.num(p+'.point','Tim cần',1)}<div class="grow">${h.list(p+'.rewards','Quà')}</div>`,true)}],
  ['top','Thưởng top',d=>d.top.length+' mức',(h,d,mk)=>{mk.top=l=>{const last=l.at(-1);return{from:(last?.to||0)+1,to:(last?.to||0)+10,minPoint:50,rewards:[it('diamonds',100)]}};return h.rows('top','Thưởng top cuối tuần (gửi qua thư)',(p)=>`${h.num(p+'.from','Từ hạng',1)}${h.num(p+'.to','Đến hạng',1)}${h.num(p+'.minPoint','Tim tối thiểu',0)}<div class="grow">${h.list(p+'.rewards','Quà')}</div>`,true)}],
  ['shop','Cửa hàng Đầu Bếp',d=>d.shop.length+' món',(h,d,mk)=>{mk.shop=()=>({id:0,reward:it('gold',100000),price:50,limit:5});return h.rows('shop','Cửa hàng Đầu Bếp (giá bằng Mì Ý Sanji)',(p)=>`<div class="grow">${h.one(p+'.reward','Món')}</div>${h.num(p+'.price','Giá',1)}${h.num(p+'.limit','Giới hạn / tuần',1)}`,true)}],
 ]});
 window.AdminDecor=editor({tab:'decor-tab',url:'/api/admin/decor',label:'Trang trí tàu',views:[
  ['common','Chung','Xưởng, kho, tái chế',(h)=>`<h3>Thiết lập chung</h3><div class="row raid-common">${h.num('minLevel','Cấp tối thiểu',1)}${h.num('floors','Số tầng tàu',1)}${h.num('maxItems','Sức chứa kho',10)}${h.num('dailyHammers','Búa gỗ mỗi ngày',0)}</div>
   <h3>Xưởng</h3><div class="row raid-common">${h.num('price','Giá chế tạo (Búa gỗ / món)',1)}${h.num('cardEvery','Chế tạo bao nhiêu lần nhận 1 Thẻ vàng (0 = tắt)',0)}${h.num('rates.0','Tỉ lệ phẩm Tím (‰)',0)}${h.num('rates.1','Tỉ lệ phẩm Vàng (‰)',0)}</div>
   <h3>Tái chế (Búa gỗ nhận mỗi món)</h3><div class="row raid-common">${h.num('recycle.0','Tím',0)}${h.num('recycle.1','Vàng',0)}${h.num('recycle.2','Đỏ',0)}</div>
   <p class="muted">Danh sách nội thất, chỉ số và bộ riêng của thuyền viên lấy nguyên từ dữ liệu gốc (db_furniture*). Thẻ đỏ (consumable:2140) phát qua quà / cửa hàng khác.</p>`],
 ]});
 const kinds=[['sock','Nhận quà tất'],['bag','Mở Túi kì diệu'],['wish','Mở hộp điều ước'],['snow','Thu thập Bông Tuyết']];
 window.AdminXmas=editor({tab:'xmas-tab',url:'/api/admin/xmas',label:'Giáng Sinh - Sinh Nhật',views:[
  ['common','Chung & quà tất','Tên, Bánh Gừng, 4 chiếc tất',(h,d)=>`<h3>Thiết lập chung</h3><div class="row raid-common">${h.txt('title','Tên sự kiện')}${h.num('minLevel','Cấp tối thiểu',1)}${h.num('dailyGinger','Bánh Gừng mỗi ngày',0)}${h.num('gingerPrice','Giá Bánh Gừng (kim cương)',1)}${h.num('gingerBuyLimit','Mua Bánh Gừng / ngày',0)}</div>
   <p class="muted">Mùa theo tháng (giờ Việt Nam): mọi tiến độ làm lại vào ngày 1 hằng tháng.</p>
   <h3>4 chiếc tất</h3><p class="muted">Bỏ giá (×) để chiếc tất đó miễn phí.</p>${d.socks.map((x,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">${i+1}</b>${h.txt(`socks.${i}.name`,'Tên',30)}${h.num(`socks.${i}.days`,'Số ngày',1)}<div class="grow">${h.one(`socks.${i}.price`,'Giá',true)}${h.list(`socks.${i}.daily`,'Quà mỗi ngày')}</div></div>`).join('')}`],
  ['bag','Túi kì diệu',d=>d.bag.length+' món',(h,d,mk)=>{mk.bag=()=>({reward:it('gold',10000),weight:100});return h.rows('bag','Quà Túi kì diệu (tỉ lệ theo trọng số)',(p)=>`<div class="grow">${h.one(p+'.reward','Quà')}</div>${h.num(p+'.weight','Trọng số',0)}`,true)}],
  ['wish','Điều ước',d=>d.wishes.length+' món ước',(h,d,mk)=>{mk.wishPool=()=>({reward:it('gold',10000),weight:100});return `<h3>Điều ước</h3><div class="row raid-common">${h.num('wishCost','Bông Tuyết / lần ước',1)}${h.num('wishRate','Tỉ lệ ra món đã ước (‰)',0)}${h.num('wishLimit','Số lần ước / tháng',1)}</div>
   ${h.list('wishes','Món có thể ước (4 món đầu hiện trên bánh)')}${h.rows('wishPool','Quà khi không trúng món ước',(p)=>`<div class="grow">${h.one(p+'.reward','Quà')}</div>${h.num(p+'.weight','Trọng số',0)}`,true)}`}],
  ['milestones','Tích lũy',d=>d.milestones.length+' mốc',(h,d,mk)=>{mk.milestones=()=>({id:0,kind:'bag',need:10,rewards:[it('gold',100000)]});return h.rows('milestones','Quà tích lũy',(p)=>`${h.sel(p+'.kind','Loại',kinds)}${h.num(p+'.need','Mục tiêu',1)}<div class="grow">${h.list(p+'.rewards','Quà')}</div>`,true)}],
  ['shop','Đổi quà',d=>d.shop.length+' món',(h,d,mk)=>{mk.shop=()=>({id:0,reward:it('gold',100000),price:20,limit:5});return h.rows('shop','Đổi quà bằng Bông Tuyết',(p)=>`<div class="grow">${h.one(p+'.reward','Món')}</div>${h.num(p+'.price','Giá',1)}${h.num(p+'.limit','Giới hạn / tháng',1)}`,true)}],
 ]});
})();
