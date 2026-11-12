/* Tab Phần thưởng của trang quản trị: sửa bảng thưởng / giá / giới hạn / tỉ lệ của mọi tính năng (server/reward-config.mjs).
   Server kiểm tra lại toàn bộ; lưu xong áp ngay vào game (lượt chơi tiếp theo dùng số mới). */
(()=>{
 'use strict';
 const {api,toast,escape,num,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#rewards-tab');
 let data=null,selected=null,draft=null,dirty=false,picker=null,filter='';
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const table=()=>data.tables.find(t=>t.id===selected);
 function load(){draft=structuredClone(table().rows);dirty=false;picker=null}
 const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
 function set(path,value){const keys=path.split('.'),last=keys.pop(),parent=keys.reduce((o,k)=>o[k],draft);parent[last]=value;dirty=true}
 const chip=(path,r,{removable=false,fixed=false}={})=>{const i=info(r.itemId);return `<span class="beast-chip" title="${escape(i.name)}">${fixed?icon(i.icon):`<button type="button" class="ghost mini swap" data-swap="${path}" aria-label="Đổi vật phẩm ${escape(i.name)}">${icon(i.icon)}</button>`}<span class="grow">${escape(i.name)}</span><input type="number" min="1" step="1" value="${r.quantity}" data-num="${path}.quantity" aria-label="Số lượng ${escape(i.name)}">${removable?`<button type="button" class="ghost mini" data-remove="${path}" aria-label="Xóa ${escape(i.name)}">×</button>`:''}</span>`};
 const number=(path,label,min=1)=>`<label class="ev-num">${label}<input type="number" min="${min}" step="1" value="${get(path)}" data-num="${path}"></label>`;
 function editor(){
  const t=table(),total=t.weight?draft.reduce((n,r)=>n+(Number(r.weight)||0),0):0;
  const head=`<h2>${escape(t.group)} · ${escape(t.title)} ${t.edited?'<span class="rw-badge">Đã sửa</span>':''}</h2>${t.note?`<p class="muted">${escape(t.note)}</p>`:''}`;
  const rows=draft.map((row,i)=>{const p=String(i);
   const rewards=`<div class="beast-chips">${row.rewards.map((r,j)=>chip(`${p}.rewards.${j}`,r,{removable:t.list&&row.rewards.length>1})).join('')}${t.list&&row.rewards.length<10?`<button type="button" class="ghost mini" data-add="${p}.rewards">+ Thêm</button>`:''}</div>`;
   const price=t.price?`<div class="rw-field"><span class="muted">Giá</span>${chip(p+'.price',row.price,{fixed:!!t.priceItem})}</div>`:'';
   const limit=t.limit?number(p+'.limit','Giới hạn/ngày'):'';
   const weight=t.weight?`${number(p+'.weight','Tỉ lệ')}<small class="muted">${total?((Number(row.weight)||0)/total*100).toFixed(1):0}%</small>`:'';
   return `<div class="beast-rank ev-row-edit rw-row"><b class="rw-label">${escape(row.label)}</b>${rewards}${price}${limit}${weight}</div>`}).join('');
  return head+rows;
 }
 function nav(){
  const text=fold(filter.trim()),groups=[...new Set(data.tables.map(t=>t.group))];
  return groups.map(g=>{const list=data.tables.filter(t=>t.group===g&&(!text||fold(g+' '+t.title).includes(text)));if(!list.length)return'';
   return `<h3>${escape(g)}</h3>${list.map(t=>`<button type="button" class="ev-pick ${t.id===selected?'on':''}" data-pick-table="${t.id}"><b>${escape(t.title)}</b><small>${t.rows.length} dòng${t.edited?' · đã sửa':''}</small></button>`).join('')}`}).join('');
 }
 function render(){
  if(!data||root.hidden)return;const scroll=root.querySelector('.ev-edit')?.scrollTop||0;
  root.innerHTML=`<section class="card ev-admin rw-admin"><nav class="ev-list-admin"><input id="rw-filter" type="search" placeholder="Lọc tính năng" value="${escape(filter)}" aria-label="Lọc bảng thưởng">${nav()}</nav><div class="ev-edit">${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}${editor()}<div class="row ev-actions rw-actions"><button type="button" id="rw-save">Lưu</button><button type="button" class="ghost" id="rw-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="rw-reset">Về mặc định</button></div></div></section>${picker?`<div class="rw-picker-shade" data-close-picker="1"><div class="beast-picker rw-picker" role="dialog" aria-label="Chọn vật phẩm"><div class="row"><input id="rw-search" type="search" placeholder="Tìm vàng, kim cương, EXP tướng hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><button type="button" class="ghost" data-close-picker="1">Đóng</button></div><div id="rw-matches" class="beast-matches"></div></div></div>`:''}`;
  const ed=root.querySelector('.ev-edit');if(ed)ed.scrollTop=scroll;
  if(picker){showMatches();$('#rw-search').focus()}
 }
 function showMatches(){const text=fold(($('#rw-search')?.value||'').trim()),matches=pool().filter(i=>!text||fold(i.name).includes(text)||fold(i.id).includes(text)).slice(0,40);$('#rw-matches').innerHTML=matches.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span><small class="muted">${escape(i.id)}</small></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
 window.AdminRewards={async show(){root.hidden=false;data=await api('/api/admin/rewards');selected??=data.tables[0].id;load();render()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{
  if(e.target.id==='rw-search')return showMatches();
  if(e.target.id==='rw-filter'){filter=e.target.value;const pos=e.target.selectionStart;render();const f=$('#rw-filter');f.focus();f.setSelectionRange(pos,pos);return}
  if(e.target.dataset.num){set(e.target.dataset.num,Number(e.target.value));const b=$('#rw-undo');if(b)b.disabled=false;if(table().weight&&e.target.dataset.num.endsWith('.weight'))render()}
 });
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button,[data-close-picker]');if(!t)return;
  if(t.dataset.closePicker&&(t.tagName==='BUTTON'||e.target===t)){picker=null;render();return}
  if(t.tagName!=='BUTTON')return;
  try{
   if(t.dataset.pickTable){if(dirty&&!confirm('Bỏ các thay đổi chưa lưu?'))return;selected=t.dataset.pickTable;load();render();root.querySelector('.ev-edit').scrollTop=0;return}
   if(t.dataset.add){picker={mode:'add',path:t.dataset.add};render();return}
   if(t.dataset.swap){picker={mode:'swap',path:t.dataset.swap};render();return}
   if(t.dataset.pick){const id=t.dataset.pick;if(picker.mode==='add')get(picker.path).push({itemId:id,quantity:1});else set(picker.path+'.itemId',id);dirty=true;picker=null;render();return}
   if(t.dataset.remove){const keys=t.dataset.remove.split('.'),index=Number(keys.pop());get(keys.join('.')).splice(index,1);dirty=true;render();return}
   if(t.id==='rw-undo'){load();render();return}
   if(t.id==='rw-save'){data=await api('/api/admin/rewards/'+selected,{rows:draft.map(({label,group,...r})=>r)});load();render();toast('Đã lưu. Game dùng bảng thưởng mới ngay.');return}
   if(t.id==='rw-reset'){if(!confirm('Trả bảng thưởng này về mặc định?'))return;data=await api('/api/admin/rewards/'+selected,{reset:true});load();render();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
})();
