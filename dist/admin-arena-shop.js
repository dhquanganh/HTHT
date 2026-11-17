/* Tab "Shop Đấu trường" của trang quản trị: cửa hàng đổi Lệnh bài võ đấu (tab Đấu trường trong Cửa hàng của game).
   Bật / tắt, kỳ làm mới lượt đổi (ngày / tuần / không làm mới), danh mục: vật phẩm + số lượng, giá (lệnh bài), giới hạn lượt đổi
   (0 = không giới hạn), thêm / xóa / đổi thứ tự. Server kiểm tra lại và lưu ở arena_shop_config. */
(()=>{
 'use strict';
 const {api,toast,escape,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#arena-shop-tab');
 const token='consumable:40';
 let data=null,draft=null,dirty=false,picker=null;
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
 const set=(path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],draft)[last]=value;dirty=true};
 const number=(path,label,min=0)=>`<label class="ev-num">${label}<input type="number" min="${min}" step="1" value="${get(path)}" data-num="${path}"></label>`;
 const resetName={day:'Mỗi ngày (0:00)',week:'Mỗi tuần (0:00 thứ Hai)',never:'Không làm mới (giới hạn trọn đời)'};
 function row(o,i){const it=info(o.reward.itemId);
  return `<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">${i+1}</b>
   <span class="beast-chip gem-chip"><button type="button" class="ghost mini swap" data-swap="offers.${i}.reward" aria-label="Đổi vật phẩm">${icon(it.icon)}</button><span class="grow">${escape(it.name)}</span><input type="number" min="1" step="1" value="${o.reward.quantity}" data-num="offers.${i}.reward.quantity" aria-label="Số lượng"></span>
   ${number(`offers.${i}.price`,'Giá (lệnh bài)',1)}${number(`offers.${i}.limit`,'Giới hạn / kỳ')}
   <span class="row"><button type="button" class="ghost mini" data-move="${i}:-1" ${i?'':'disabled'} aria-label="Lên">↑</button><button type="button" class="ghost mini" data-move="${i}:1" ${i<draft.offers.length-1?'':'disabled'} aria-label="Xuống">↓</button><button type="button" class="ghost mini" data-del="${i}">Xóa</button></span></div>`}
 function render(){
  const t=info(token);
  root.innerHTML=`<section class="card ev-admin raid-admin gem-admin" style="grid-template-columns:minmax(0,1fr)"><div class="ev-edit">
   <label class="ev-toggle"><input type="checkbox" data-enabled ${draft.enabled!==false?'checked':''}><span>${draft.enabled!==false?'Đang bật: tab Đấu trường hiện trong Cửa hàng':'Đang tắt: ẩn tab Đấu trường, người chơi không đổi được'}</span></label>
   ${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<p class="muted">${data.custom?'Đang dùng cấu hình đã sửa'+(data.updatedAt?' · cập nhật '+new Date(data.updatedAt).toLocaleString('vi-VN'):''):'Đang dùng cấu hình mặc định.'}</p>
   <h3>Tiền tệ</h3><div class="row raid-common"><span class="beast-chip gem-chip">${icon(t.icon)}<span class="grow">${escape(t.name)}</span></span>
    <label class="ev-num">Làm mới lượt đổi<select data-reset>${Object.entries(resetName).map(([k,v])=>`<option value="${k}" ${draft.reset===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
   <h3>Danh mục (${draft.offers.length} món · giới hạn 0 = không giới hạn)</h3>${draft.offers.map(row).join('')}
   <div class="row"><button type="button" class="ghost" data-add>+ Thêm món</button></div>
   <div class="row ev-actions"><button type="button" id="arena-shop-save">Lưu</button><button type="button" class="ghost" id="arena-shop-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="arena-shop-reset">Về mặc định</button></div>
   ${picker?`<div class="beast-picker ev-picker"><input id="arena-shop-search" type="search" placeholder="Tìm vàng, kim cương hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><div id="arena-shop-matches" class="beast-matches"></div></div>`:''}</div></section>`;
  if(picker){matches();$('#arena-shop-search').focus()}
 }
 function matches(){const t=fold(($('#arena-shop-search')?.value||'').trim()),l=pool().filter(i=>!t||fold(i.name).includes(t)||fold(i.id).includes(t)).slice(0,30);
  $('#arena-shop-matches').innerHTML=l.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
 const load=()=>{draft=structuredClone(data.config);dirty=false;picker=null};
 const newId=()=>{let n=draft.offers.length+1;while(draft.offers.some(o=>o.id==='item-'+n))n++;return 'item-'+n};
 window.AdminArenaShop={async show(){root.hidden=false;data=await api('/api/admin/arena-shop');load();render()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{const t=e.target;if(t.id==='arena-shop-search')return matches();if(t.dataset.num){set(t.dataset.num,Math.floor(Number(t.value)));const b=$('#arena-shop-undo');if(b)b.disabled=false}});
 root.addEventListener('change',e=>{const t=e.target;
  if(t.dataset.enabled!==undefined){draft.enabled=t.checked;dirty=true;return render()}
  if(t.dataset.reset!==undefined){draft.reset=t.value;dirty=true;return render()}});
 root.addEventListener('click',async e=>{const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.swap){picker={mode:'swap',path:t.dataset.swap};return render()}
   if(t.dataset.add!==undefined){picker={mode:'add'};return render()}
   if(t.dataset.pick){const id=t.dataset.pick;if(picker.mode==='add')draft.offers.push({id:newId(),reward:{itemId:id,quantity:1},price:500,limit:1});else set(picker.path+'.itemId',id);dirty=true;picker=null;return render()}
   if(t.dataset.move){const [i,d]=t.dataset.move.split(':').map(Number),j=i+d;[draft.offers[i],draft.offers[j]]=[draft.offers[j],draft.offers[i]];dirty=true;return render()}
   if(t.dataset.del!==undefined){if(draft.offers.length<=1)return toast('Cửa hàng cần ít nhất 1 món.');draft.offers.splice(Number(t.dataset.del),1);dirty=true;return render()}
   if(t.id==='arena-shop-undo'){load();return render()}
   if(t.id==='arena-shop-save'){data=await api('/api/admin/arena-shop',{config:draft});load();render();return toast('Đã lưu. Có hiệu lực ngay.')}
   if(t.id==='arena-shop-reset'){if(!confirm('Trả Shop Đấu trường về cấu hình mặc định?'))return;data=await api('/api/admin/arena-shop',{reset:true});load();render();return toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}});
})();
