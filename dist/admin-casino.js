/* Tab Vòng quay của trang quản trị (Casino thường / Casino VIP): giá mua 1 xu bằng kim cương, số xu cho 1 / 10 / 100 lượt,
   lượt miễn phí mỗi ngày (vòng thường), giá làm mới 8 ô quà, điều kiện mở VIP và bể quà (quà + trọng số). Server kiểm tra lại
   và lưu ở casino_config. Xu của "Vòng Quay May Mắn" (sự kiện) chỉnh ở tab Sự kiện. */
(()=>{
 'use strict';
 const {api,toast,escape,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#casino-tab');
 let data=null,draft=null,view='normal',dirty=false,picker=null;
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
 const set=(path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],draft)[last]=value;dirty=true};
 const number=(path,label,min=0)=>`<label class="ev-num">${label}<input type="number" min="${min}" step="1" value="${get(path)}" data-num="${path}"></label>`;
 function wheel(id){
  const w=draft[id],chip=info(w.chip),total=w.pool.reduce((n,x)=>n+(Number(x.weight)||0),0);
  return `<h3>${escape(w.name)}</h3>
   <h3>Mua xu</h3><div class="row raid-common"><span class="beast-chip gem-chip">${icon(chip.icon)}<span class="grow">${escape(chip.name)}</span></span>${number(`${id}.price`,'Giá 1 xu (kim cương)',1)}</div>
   <p class="muted">Người chơi hết xu bấm Mua để đổi kim cương lấy xu (mua 10 xu một lần: ${(w.price||0)*10} kim cương).</p>
   <h3>Số xu mỗi lần quay</h3><div class="row raid-common">${number(`${id}.costs.1`,'1 lượt',1)}${number(`${id}.costs.10`,'10 lượt',1)}${number(`${id}.costs.100`,'100 lượt',1)}</div>
   <h3>Khác</h3><div class="row raid-common">${id==='normal'?number(`${id}.dailyFree`,'Lượt miễn phí mỗi ngày'):''}${number(`${id}.refreshPrice`,'Giá làm mới (kim cương)')}${id==='super'?number(`${id}.minLevel`,'Mở ở cấp')+number(`${id}.minVip`,'hoặc VIP'):''}</div>
   <h3>Bể quà (đĩa rút 8 ô từ bể)</h3>${w.pool.map((x,i)=>{const it=info(x.reward.itemId);return `<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">${i+1}</b><span class="beast-chip gem-chip"><button type="button" class="ghost mini swap" data-swap="${id}.pool.${i}.reward" aria-label="Đổi vật phẩm">${icon(it.icon)}</button><span class="grow">${escape(it.name)}</span><input type="number" min="1" step="1" value="${x.reward.quantity}" data-num="${id}.pool.${i}.reward.quantity" aria-label="Số lượng"></span>${number(`${id}.pool.${i}.weight`,'Trọng số',1)}<small class="muted">${total?((x.weight/total)*100).toFixed(1):0}%</small><button type="button" class="ghost mini" data-del="${id}.${i}">Xóa</button></div>`}).join('')}
   <div class="row"><button type="button" class="ghost" data-addpool="${id}">+ Thêm quà</button></div>`;
 }
 function render(){
  root.innerHTML=`<section class="card ev-admin raid-admin gem-admin"><nav class="ev-list-admin">${['normal','super'].map(k=>`<button type="button" class="ev-pick ${view===k?'on':''}" data-view="${k}"><b>${escape(draft[k].name)}</b><small>${draft[k].price} kim cương / xu · ${draft[k].pool.length} quà</small></button>`).join('')}</nav>
   <div class="ev-edit">${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<p class="muted">${data.custom?'Đang dùng cấu hình đã sửa'+(data.updatedAt?' · cập nhật '+new Date(data.updatedAt).toLocaleString('vi-VN'):''):'Đang dùng cấu hình mặc định.'} Xu của Vòng Quay May Mắn (sự kiện) chỉnh ở tab Sự kiện.</p>
   ${wheel(view)}
   <div class="row ev-actions"><button type="button" id="casino-save">Lưu</button><button type="button" class="ghost" id="casino-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="casino-reset">Về mặc định</button></div>
   ${picker?`<div class="beast-picker ev-picker"><input id="casino-search" type="search" placeholder="Tìm vàng, kim cương hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><div id="casino-matches" class="beast-matches"></div></div>`:''}</div></section>`;
  if(picker){matches();$('#casino-search').focus()}
 }
 function matches(){const t=fold(($('#casino-search')?.value||'').trim()),l=pool().filter(i=>!t||fold(i.name).includes(t)||fold(i.id).includes(t)).slice(0,30);
  $('#casino-matches').innerHTML=l.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
 const load=()=>{draft=structuredClone(data.config);dirty=false;picker=null};
 window.AdminCasino={async show(){root.hidden=false;data=await api('/api/admin/casino');load();render()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{const t=e.target;if(t.id==='casino-search')return matches();if(t.dataset.num){set(t.dataset.num,Math.floor(Number(t.value)));const b=$('#casino-undo');if(b)b.disabled=false}});
 root.addEventListener('change',e=>{if(e.target.dataset.num&&/weight$/.test(e.target.dataset.num))render()});
 root.addEventListener('click',async e=>{const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.view){view=t.dataset.view;picker=null;return render()}
   if(t.dataset.swap){picker={mode:'swap',path:t.dataset.swap};return render()}
   if(t.dataset.addpool){picker={mode:'add',wheel:t.dataset.addpool};return render()}
   if(t.dataset.pick){const id=t.dataset.pick;if(picker.mode==='add')draft[picker.wheel].pool.push({reward:{itemId:id,quantity:1},weight:10});else set(picker.path+'.itemId',id);dirty=true;picker=null;return render()}
   if(t.dataset.del){const [w,i]=t.dataset.del.split('.');if(draft[w].pool.length<=8)return toast('Bể quà cần ít nhất 8 món (đĩa có 8 ô).');draft[w].pool.splice(Number(i),1);dirty=true;return render()}
   if(t.id==='casino-undo'){load();return render()}
   if(t.id==='casino-save'){data=await api('/api/admin/casino',{config:draft});load();render();return toast('Đã lưu. Có hiệu lực ngay.')}
   if(t.id==='casino-reset'){if(!confirm('Trả Vòng quay về cấu hình mặc định?'))return;data=await api('/api/admin/casino',{reset:true});load();render();return toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}});
})();
