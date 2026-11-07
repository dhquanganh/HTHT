/* Tab Sự kiện của trang quản trị: sửa thưởng, mốc, giá đổi, tỉ lệ của từng sự kiện và quà điểm danh.
   Server kiểm tra lại toàn bộ; lưu xong game dùng ngay vì mỗi màn sự kiện tải cấu hình khi mở. */
(()=>{
 'use strict';
 const {api,toast,escape,num,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#events-tab');
 const tabs={week:'Sự kiện tuần',month:'Sự kiện tháng',sale:'Ưu đãi',special:'Lễ Hội Ẩm Thực'},types={progress:'Mốc tiến độ',exchange:'Đổi quà',pray:'Cầu nguyện',stages:'Cứ điểm',wheel:'Vòng quay',rollcall:'Điểm danh lễ hội'};
 let data=null,selected='checkin',draft=null,dirty=false,picker=null;
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const source=()=>selected==='checkin'?{rewards:data.checkin}:data.events.find(e=>e.id===selected);
 function load(){const s=source();draft=structuredClone(selected==='checkin'?{rewards:s.rewards}:{title:s.title,milestones:s.milestones,offers:s.offers,cost:s.cost,pool:s.pool,daily:s.daily,slots:s.slots,stages:s.stages,buy:s.buy,days:s.days});dirty=false;picker=null}
 const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
 function set(path,value){const keys=path.split('.'),last=keys.pop(),parent=keys.reduce((o,k)=>o[k],draft);parent[last]=value;dirty=true}
 const chip=(path,r,removable)=>{const i=info(r.itemId);return `<span class="beast-chip" title="${escape(i.name)}"><button type="button" class="ghost mini swap" data-swap="${path}" aria-label="Đổi vật phẩm ${escape(i.name)}">${icon(i.icon)}</button><span class="grow">${escape(i.name)}</span><input type="number" min="1" step="1" value="${r.quantity}" data-num="${path}.quantity" aria-label="Số lượng ${escape(i.name)}">${removable?`<button type="button" class="ghost mini" data-remove="${path}" aria-label="Xóa ${escape(i.name)}">×</button>`:''}</span>`};
 const chips=path=>`<div class="beast-chips">${get(path).map((r,i)=>chip(`${path}.${i}`,r,true)).join('')}<button type="button" class="ghost mini" data-add="${path}">+ Thêm</button></div>`;
 const number=(path,label,min=0)=>`<label class="ev-num">${label}<input type="number" min="${min}" step="1" value="${get(path)}" data-num="${path}"></label>`;
 const rows=(path,render,{add,minimum=1}={})=>`${get(path).map((row,i)=>`<div class="beast-rank ev-row-edit">${render(`${path}.${i}`,row,i)}${get(path).length>minimum&&add?`<button type="button" class="ghost mini" data-remove="${path}.${i}" aria-label="Xóa dòng">×</button>`:''}</div>`).join('')}${add?`<button type="button" class="ghost mini" data-add-row="${path}">+ Thêm dòng</button>`:''}`;
 function editor(){
  if(selected==='checkin')return `<h3>Quà điểm danh (${draft.rewards.length} ngày)</h3><div class="ev-grid">${draft.rewards.map((r,i)=>`<div class="ev-cell"><b>Ngày ${i+1}</b>${chip(`rewards.${i}`,r,draft.rewards.length>1)}</div>`).join('')}</div><button type="button" class="ghost mini" data-add-row="rewards">+ Thêm ngày</button>`;
  const e=source(),parts=[`<label class="ev-title">Tên hiển thị<input value="${escape(draft.title)}" data-text="title" maxlength="40"></label>`];
  if(draft.milestones)parts.push(`<h3>Mốc</h3>${rows('milestones',p=>`${number(p+'.target',`${escape(e.stepLabel||'')} (${escape(e.stepUnit||'')})`,1)}${chips(p+'.rewards')}`,{add:{target:1,rewards:[{itemId:'gold',quantity:1000}]}})}`);
  if(draft.offers)parts.push(`<h3>Gói đổi (giới hạn 0 = không giới hạn)</h3>${rows('offers',p=>`<span class="muted">Giá</span>${chip(p+'.cost',get(p+'.cost'))}<span class="muted">Nhận</span>${chip(p+'.reward',get(p+'.reward'))}${number(p+'.limit','Giới hạn')}`,{add:{cost:{itemId:'gold',quantity:1000},reward:{itemId:'consumable:16',quantity:1},limit:1}})}`);
  if(draft.cost)parts.push(`<h3>Giá mỗi lượt</h3>${chip('cost',draft.cost)}`);
  if(draft.daily)parts.push(`<h3>Quà ngày (ô giữa)</h3>${chip('daily',draft.daily)}`);
  if(draft.buy&&!draft.stages)parts.push(`<h3>Mua Xu vòng quay (giá 1 Xu)</h3><div class="beast-rank ev-row-edit">${chip('buy.cost',draft.buy.cost)}${number('buy.limit','Lượt mua mỗi tháng')}</div>`);
  if(draft.pool)parts.push(`<h3>Phần thưởng ngẫu nhiên</h3>${rows('pool',p=>`${number(p+'.weight','Tỉ lệ',1)}${chip(p+'.reward',get(p+'.reward'))}`,{add:{weight:1,reward:{itemId:'gold',quantity:1000}}})}`);
  if(draft.slots)parts.push(`<h3>14 ô vòng quay (theo chiều kim đồng hồ từ góc trên trái)</h3>${rows('slots',(p,row,i)=>`<b>Ô ${i+1}</b>${number(p+'.weight','Tỉ lệ',1)}${chip(p+'.reward',get(p+'.reward'))}`)}`);
  if(draft.stages)parts.push(`<h3>7 cứ điểm</h3>${rows('stages',(p,row,i)=>`<b>Cứ điểm ${i+1}</b>${number(p+'.floor','Tầng đậu thần',1)}${chips(p+'.rewards')}`)}<h3>Mua Ống nhòm</h3><div class="beast-rank ev-row-edit">${chip('buy.cost',draft.buy.cost)}${number('buy.limit','Lượt mua mỗi tháng')}</div>`);
  if(draft.days)parts.push(`<h3>Quà từng ngày</h3>${rows('days',(p,row,i)=>`<b>Ngày ${i+1}</b>${chips(p)}`,{add:[{itemId:'gold',quantity:1000}]})}`);
  return parts.join('');
 }
 function render(){
  if(!data||root.hidden)return;
  const groups=Object.entries(tabs).map(([tab,label])=>`<h3>${label}</h3>${data.events.filter(e=>e.tab===tab).map(e=>`<button type="button" class="ev-pick ${e.id===selected?'on':''}" data-pick-event="${e.id}"><b>${escape(e.title)}</b><small>${types[e.type]}</small></button>`).join('')}`).join('');
  root.innerHTML=`<section class="card ev-admin"><nav class="ev-list-admin"><button type="button" class="ev-pick ${selected==='checkin'?'on':''}" data-pick-event="checkin"><b>Điểm danh 30 ngày</b><small>Quà mỗi ngày</small></button>${groups}</nav><div class="ev-edit">${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}${editor()}<div class="row ev-actions"><button type="button" id="ev-save">Lưu</button><button type="button" class="ghost" id="ev-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="ev-reset">Về mặc định</button></div>${picker?`<div class="beast-picker ev-picker"><input id="ev-search" type="search" placeholder="Tìm vàng, kim cương, EXP tướng hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><div id="ev-matches" class="beast-matches"></div></div>`:''}</div></section>`;
  if(picker){showMatches();$('#ev-search').focus()}
 }
 function showMatches(){const text=fold(($('#ev-search')?.value||'').trim()),matches=pool().filter(i=>!text||fold(i.name).includes(text)||fold(i.id).includes(text)).slice(0,30);$('#ev-matches').innerHTML=matches.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
 window.AdminEvents={async show(){root.hidden=false;data=await api('/api/admin/events');load();render()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{
  if(e.target.id==='ev-search')return showMatches();
  if(e.target.dataset.num){set(e.target.dataset.num,Number(e.target.value));markDirty()}
  if(e.target.dataset.text){set(e.target.dataset.text,e.target.value);markDirty()}
 });
 const markDirty=()=>{const b=$('#ev-undo');if(b)b.disabled=false};
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.pickEvent){if(dirty&&!confirm('Bỏ các thay đổi chưa lưu?'))return;selected=t.dataset.pickEvent;load();render();return}
   if(t.dataset.add){picker={mode:'add',path:t.dataset.add};render();return}
   if(t.dataset.swap){picker={mode:'swap',path:t.dataset.swap};render();return}
   if(t.dataset.pick){
    const id=t.dataset.pick;if(picker.mode==='add')get(picker.path).push({itemId:id,quantity:1});else set(picker.path+'.itemId',id);
    dirty=true;picker=null;render();return;
   }
   if(t.dataset.remove){const keys=t.dataset.remove.split('.'),index=Number(keys.pop());get(keys.join('.')).splice(index,1);dirty=true;render();return}
   if(t.dataset.addRow){const list=get(t.dataset.addRow),sample=selected==='checkin'?{itemId:'gold',quantity:1000}:structuredClone(list.at(-1));list.push(sample);dirty=true;render();return}
   if(t.id==='ev-undo'){load();render();return}
   if(t.id==='ev-save'){data=await api('/api/admin/events/'+selected,{config:draft});load();render();toast('Đã lưu. Người chơi thấy cấu hình mới khi mở lại màn sự kiện.');return}
   if(t.id==='ev-reset'){if(!confirm('Trả sự kiện này về cấu hình mặc định?'))return;data=await api('/api/admin/events/'+selected,{reset:true});load();render();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
})();
