/* Tab Đỉnh Thời Gian (Peaks of Time) của trang quản trị: cấp mở, sát thương tháp pháo, % hồi của Cơm Sanji / Bình hồi sinh,
   số thẻ để chọn, hệ số quái / boss và danh sách ải (thêm / xóa; bản đồ gốc 1 / 2, cấp quái, hệ số, thưởng rương thường / quý,
   thưởng qua ải lần đầu). Server kiểm tra lại và lưu ở pot_config. */
(()=>{
 'use strict';
 const {api,toast,escape,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#pot-tab');
 let data=null,draft=null,view='common',dirty=false,picker=null;
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
 const set=(path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],draft)[last]=value;dirty=true};
 const number=(path,label,min=0,step=1)=>`<label class="ev-num">${label}<input type="number" min="${min}" step="${step}" value="${get(path)}" data-num="${path}"${step!==1?' data-float':''}></label>`;
 const chip=(path,r)=>{const i=info(r.itemId);return `<span class="beast-chip gem-chip" title="${escape(i.name)}"><button type="button" class="ghost mini swap" data-swap="${path}" aria-label="Đổi vật phẩm ${escape(i.name)}">${icon(i.icon)}</button><span class="grow">${escape(i.name)}</span><input type="number" min="1" step="1" value="${r.quantity}" data-num="${path}.quantity" aria-label="Số lượng" title="Số lượng"><button type="button" class="ghost mini" data-remove="${path}" aria-label="Xóa ${escape(i.name)}">×</button></span>`};
 const list=(path,label)=>`<div class="row"><b class="raid-index">${label}</b><div class="beast-chips">${get(path).map((r,k)=>chip(`${path}.${k}`,r)).join('')}<button type="button" class="ghost mini" data-add="${path}">+ Thêm</button></div></div>`;
 const views=[['common','Chung','Pháo, hồi máu, hệ số quái'],['stages','Ải',()=>draft.stages.length+' ải']];
 const nav=()=>`<nav class="ev-list-admin">${views.map(([k,t,s])=>`<button type="button" class="ev-pick ${view===k?'on':''}" data-view="${k}"><b>${t}</b><small>${typeof s==='function'?s():s}</small></button>`).join('')}</nav>`;
 const mapInfo=id=>{const m=data.maps.find(x=>x.id===id);return m?`${m.cells} ô · `+Object.entries(m.objects).map(([k,v])=>`${v} ${k}`).join(', '):''};
 function common(){
  return `<h3>Thiết lập chung</h3><div class="row raid-common">${number('minLevel','Cấp tối thiểu',1)}${number('turretDamage','Sát thương pháo (% máu)',0)}${number('healPercent','Cơm Sanji hồi (%)',1)}${number('revivePercent','Bình hồi sinh (%)',1)}${number('relicChoices','Số thẻ để chọn',1)}</div>
  <h3>Hệ số chỉ số đối thủ (nhân với hệ số của ải)</h3><div class="row raid-common">${number('monsterBoost.0','Quái bậc 1',0.1,0.05)}${number('monsterBoost.1','Quái bậc 2',0.1,0.05)}${number('bossBoost','Boss',0.1,0.05)}</div>
  <h3>Bản đồ gốc</h3>${data.maps.map(m=>`<p class="muted">Bản đồ ${m.id}: ${escape(mapInfo(m.id))}</p>`).join('')}`;
 }
 function stages(){
  return `<h3>${draft.stages.length} ải</h3><p class="muted">Ải mở lần lượt: hạ boss ải trước mới mở ải sau. Thưởng rương chỉ nhận một lần cho mỗi rương của mỗi ải; thưởng qua ải nhận ở lần vượt đầu tiên.</p>
  ${draft.stages.map((s,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">Ải ${i+1}</b>
   <label class="ev-num">Bản đồ<select data-map="${i}">${data.maps.map(m=>`<option value="${m.id}" ${m.id===s.map?'selected':''}>Bản đồ ${m.id}</option>`).join('')}</select></label>${number(`stages.${i}.level`,'Cấp quái',1)}${number(`stages.${i}.boost`,'Hệ số chỉ số',0.1,0.05)}
   <div class="grow">${list(`stages.${i}.chest.0`,'Rương thường')}${list(`stages.${i}.chest.1`,'Rương quý')}${list(`stages.${i}.clear`,'Qua ải')}</div>
   <button type="button" class="ghost mini" data-del-stage="${i}" ${draft.stages.length<=1?'disabled':''}>Xóa ải</button></div>`).join('')}
  <div class="row"><button type="button" class="ghost" data-add-stage>+ Thêm ải</button></div>`;
 }
 function render(){
  root.innerHTML=`<section class="card ev-admin raid-admin gem-admin">${nav()}<div class="ev-edit"><label class="ev-toggle"><input type="checkbox" data-enabled ${draft.enabled!==false?'checked':''}><span>${draft.enabled!==false?'Đang bật: hiện trong cửa sổ Sự kiện đặc biệt':'Đang tắt: ẩn khỏi game, người chơi không thao tác được'}</span></label>${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<p class="muted">${data.custom?'Đang dùng cấu hình đã sửa'+(data.updatedAt?' · cập nhật '+new Date(data.updatedAt).toLocaleString('vi-VN'):''):'Đang dùng cấu hình mặc định.'}</p>
  ${{common,stages}[view]()}
  <div class="row ev-actions"><button type="button" id="pot-save">Lưu</button><button type="button" class="ghost" id="pot-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="pot-reset">Về mặc định</button></div>
  ${picker?`<div class="beast-picker ev-picker"><input id="pot-search" type="search" placeholder="Tìm vàng, kim cương, EXP tướng hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><div id="pot-matches" class="beast-matches"></div></div>`:''}</div></section>`;
  if(picker){matches();$('#pot-search').focus()}
 }
 function matches(){const text=fold(($('#pot-search')?.value||'').trim()),l=pool().filter(i=>!text||fold(i.name).includes(text)||fold(i.id).includes(text)).slice(0,30);
  $('#pot-matches').innerHTML=l.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
 const load=()=>{draft=structuredClone(data.config);dirty=false;picker=null};
 window.AdminPot={async show(){root.hidden=false;data=await api('/api/admin/pot');load();render()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{const t=e.target;if(t.id==='pot-search')return matches();
  if(t.dataset.num){const v=Number(t.value);set(t.dataset.num,t.dataset.float!==undefined?v:Math.floor(v));const b=$('#pot-undo');if(b)b.disabled=false}});
 root.addEventListener('change',e=>{const t=e.target;if(t.dataset.map){draft.stages[Number(t.dataset.map)].map=Number(t.value);dirty=true;const b=$('#pot-undo');if(b)b.disabled=false}});

 // Công tắc bật / tắt sự kiện (lưu cùng nút Lưu).
 root.addEventListener('change',e=>{if(e.target.dataset.enabled===undefined)return;draft.enabled=e.target.checked;dirty=true;render()});
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.view!==undefined){view=t.dataset.view;picker=null;render();return}
   if(t.dataset.add){picker={path:t.dataset.add,mode:'add'};render();return}
   if(t.dataset.swap){picker={path:t.dataset.swap,mode:'swap'};render();return}
   if(t.dataset.pick){const id=t.dataset.pick;if(picker.mode==='add')get(picker.path).push({itemId:id,quantity:1});else set(picker.path+'.itemId',id);dirty=true;picker=null;render();return}
   if(t.dataset.remove){const keys=t.dataset.remove.split('.'),i=Number(keys.pop());get(keys.join('.')).splice(i,1);dirty=true;render();return}
   if(t.dataset.delStage!==undefined){if(!confirm(`Xóa ải ${Number(t.dataset.delStage)+1}?`))return;draft.stages.splice(Number(t.dataset.delStage),1);dirty=true;render();return}
   // Ải mới: nối tiếp ải cuối, đổi bản đồ, cấp +20, hệ số +0.08, thưởng giống ải cuối.
   if(t.dataset.addStage!==undefined){const last=draft.stages.at(-1);draft.stages.push({...structuredClone(last),map:last.map===1?2:1,level:last.level+20,boost:Math.round((last.boost+.08)*100)/100});dirty=true;render();return}
   if(t.id==='pot-undo'){load();render();return}
   if(t.id==='pot-save'){data=await api('/api/admin/pot',{config:draft});load();render();toast('Đã lưu. Có hiệu lực ngay.');return}
   if(t.id==='pot-reset'){if(!confirm('Trả Đỉnh Thời Gian về cấu hình mặc định?'))return;data=await api('/api/admin/pot',{reset:true});load();render();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
})();
