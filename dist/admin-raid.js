/* Tab Chiến dịch của trang quản trị: phần thưởng, lực chiến, cấp mở từng mức của 3 loại (Beli / Nguyên liệu / Mảnh hải tặc),
   lượt miễn phí, giá và số lần mua lượt. Server kiểm tra lại toàn bộ và lưu ở raid_config; người chơi thấy ngay khi mở lại Chiến dịch. */
(()=>{
 'use strict';
 const {api,toast,escape,num,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#raid-tab');
 const names={gold:'Beli (Cướp Xu)',spirit:'Nguyên liệu',hero:'Mảnh hải tặc (Anh Hùng)'};
 let data=null,draft=null,mode='gold',dirty=false,picker=null;
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
 const set=(path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],draft)[last]=value;dirty=true};
 const number=(path,label,min=0)=>`<label class="ev-num">${label}<input type="number" min="${min}" step="1" value="${get(path)}" data-num="${path}"></label>`;
 const chip=(path,r)=>{const i=info(r.itemId);return `<span class="beast-chip" title="${escape(i.name)}"><button type="button" class="ghost mini swap" data-swap="${path}" aria-label="Đổi vật phẩm ${escape(i.name)}">${icon(i.icon)}</button><span class="grow">${escape(i.name)}</span><input type="number" min="1" step="1" value="${r.quantity}" data-num="${path}.quantity" aria-label="Số lượng ${escape(i.name)}"><button type="button" class="ghost mini" data-remove="${path}" aria-label="Xóa ${escape(i.name)}">×</button></span>`};
 function render(){
  const levels=draft.modes[mode].levels,base=`modes.${mode}.levels`;
  root.innerHTML=`<section class="card ev-admin raid-admin"><nav class="ev-list-admin">${Object.entries(names).map(([id,n])=>`<button type="button" class="ev-pick ${id===mode?'on':''}" data-mode="${id}"><b>${escape(n)}</b><small>${draft.modes[id].levels.length} mức</small></button>`).join('')}</nav>
  <div class="ev-edit">${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<p class="muted">${data.custom?'Đang dùng cấu hình đã sửa'+(data.updatedAt?' · cập nhật '+new Date(data.updatedAt).toLocaleString('vi-VN'):''):'Đang dùng bảng mặc định (khớp ảnh gốc).'}</p>
  <div class="row raid-common">${number('freeTurns','Lượt miễn phí / ngày')}${number('buyPrice','Giá mua 1 lượt (kim cương)')}${number('buyLimit','Số lần mua / ngày')}</div>
  <h3>${escape(names[mode])}</h3>
  ${levels.map((l,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">Mức ${i+1}</b>${number(`${base}.${i}.unlock`,'Cấp mở',1)}${number(`${base}.${i}.power`,'Lực chiến',1)}<div class="beast-chips">${l.rewards.map((r,k)=>chip(`${base}.${i}.rewards.${k}`,r)).join('')}<button type="button" class="ghost mini" data-add="${base}.${i}.rewards">+ Thêm</button></div><button type="button" class="ghost mini" data-del-level="${i}" ${levels.length<=1?'disabled':''} aria-label="Xóa mức ${i+1}">Xóa mức</button></div>`).join('')}
  <div class="row"><button type="button" class="ghost" data-add-level>+ Thêm mức</button></div>
  <div class="row ev-actions"><button type="button" id="raid-save">Lưu</button><button type="button" class="ghost" id="raid-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="raid-reset">Về mặc định</button></div>
  ${picker?`<div class="beast-picker ev-picker"><input id="raid-search" type="search" placeholder="Tìm vàng, kim cương, EXP tướng hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><div id="raid-matches" class="beast-matches"></div></div>`:''}</div></section>`;
  if(picker){matches();$('#raid-search').focus()}
 }
 function matches(){const text=fold(($('#raid-search')?.value||'').trim()),list=pool().filter(i=>!text||fold(i.name).includes(text)||fold(i.id).includes(text)).slice(0,30);
  $('#raid-matches').innerHTML=list.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
 const load=()=>{draft=structuredClone(data.config);dirty=false;picker=null};
 window.AdminRaid={async show(){root.hidden=false;data=await api('/api/admin/raid');load();render()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{if(e.target.id==='raid-search')return matches();if(e.target.dataset.num){set(e.target.dataset.num,Math.floor(Number(e.target.value)));const b=$('#raid-undo');if(b)b.disabled=false}});
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.mode){mode=t.dataset.mode;picker=null;render();return}
   if(t.dataset.add){picker={mode:'add',path:t.dataset.add};render();return}
   if(t.dataset.swap){picker={mode:'swap',path:t.dataset.swap};render();return}
   if(t.dataset.pick){if(picker.mode==='add')get(picker.path).push({itemId:t.dataset.pick,quantity:1});else set(picker.path+'.itemId',t.dataset.pick);dirty=true;picker=null;render();return}
   if(t.dataset.remove){const keys=t.dataset.remove.split('.'),i=Number(keys.pop()),listRef=get(keys.join('.'));if(listRef.length<=1)return toast('Mỗi mức cần ít nhất 1 phần thưởng.');listRef.splice(i,1);dirty=true;render();return}
   if(t.dataset.delLevel!==undefined){draft.modes[mode].levels.splice(Number(t.dataset.delLevel),1);dirty=true;render();return}
   if(t.dataset.addLevel!==undefined){const l=draft.modes[mode].levels,last=structuredClone(l.at(-1));last.unlock+=10;last.power+=40000;l.push(last);dirty=true;render();return}
   if(t.id==='raid-undo'){load();render();return}
   if(t.id==='raid-save'){data=await api('/api/admin/raid',{config:draft});load();render();toast('Đã lưu. Người chơi thấy cấu hình mới khi mở lại Chiến dịch.');return}
   if(t.id==='raid-reset'){if(!confirm('Trả Chiến dịch về bảng mặc định?'))return;data=await api('/api/admin/raid',{reset:true});load();render();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
})();
