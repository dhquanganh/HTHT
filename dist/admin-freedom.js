/* Tab Đấu Trường Tự Do của trang quản trị: cấp mở, lượt mỗi tuần, vé / giá kim cương, giá làm mới đội, cấp tướng được phát,
   tỉ lệ loại trợ giúp, các ải (thêm / xóa; cấp + hệ số đối thủ, số thẻ của đối thủ, thưởng) và danh sách thẻ hỗ trợ. Server kiểm tra lại
   và lưu ở freedom_config. */
(()=>{
 'use strict';
 const {api,toast,escape,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#freedom-tab');
 let data=null,draft=null,view='common',dirty=false,picker=null;
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
 const set=(path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],draft)[last]=value;dirty=true};
 const number=(path,label,min=0,step=1)=>`<label class="ev-num">${label}<input type="number" min="${min}" step="${step}" value="${get(path)}" data-num="${path}"${step!==1?' data-float':''}></label>`;
 const chip=(path,r,removable=true)=>{const i=info(r.itemId);return `<span class="beast-chip gem-chip" title="${escape(i.name)}"><button type="button" class="ghost mini swap" data-swap="${path}" aria-label="Đổi vật phẩm ${escape(i.name)}">${icon(i.icon)}</button><span class="grow">${escape(i.name)}</span><input type="number" min="1" step="1" value="${r.quantity}" data-num="${path}.quantity" aria-label="Số lượng" title="Số lượng">${removable?`<button type="button" class="ghost mini" data-remove="${path}" aria-label="Xóa ${escape(i.name)}">×</button>`:''}</span>`};
 const views=[['common','Chung','Vé, lượt tuần, làm mới đội'],['stages','Ải',()=>draft.stages.length+' ải · đối thủ và thưởng'],['cards','Thẻ hỗ trợ',()=>data.cards.length+' thẻ']];
 const nav=()=>`<nav class="ev-list-admin">${views.map(([k,t,s])=>`<button type="button" class="ev-pick ${view===k?'on':''}" data-view="${k}"><b>${t}</b><small>${typeof s==='function'?s():s}</small></button>`).join('')}</nav>`;
 function common(){
  return `<h3>Thiết lập chung</h3><div class="row raid-common">${number('minLevel','Cấp tối thiểu',1)}${number('weeklyRuns','Lượt mỗi tuần',1)}${number('heroLevel','Cấp tướng được phát',1)}${number('diamondFee','Giá kim cương / lượt (0 = tắt)',0)}</div>
  <h3>Vé tham gia</h3><div class="beast-chips">${chip('ticket',draft.ticket,false)}</div>
  <h3>Giá làm mới đội (kim cương, theo từng lần)</h3><div class="row raid-common">${draft.resetCosts.map((v,i)=>`${number(`resetCosts.${i}`,`Lần ${i+1}`,0)}<button type="button" class="ghost mini" data-del-reset="${i}">×</button>`).join('')}<button type="button" class="ghost mini" data-add-reset>+ Thêm lần</button></div>
  <p class="muted">Hết danh sách thì không làm mới được nữa.</p>
  <h3>Tỉ lệ loại trợ giúp (‰, tự chuẩn hóa)</h3><div class="row raid-common">${number('helpWeights.0','2 tướng')}${number('helpWeights.1','1 tướng + 1 thẻ')}${number('helpWeights.2','1 thẻ bậc cao')}</div>`;
 }
 function stages(){
  return `<h3>${draft.stages.length} ải</h3><p class="muted">Mỗi trang bản đồ Thám hiểm hiện 7 ải; quá 7 ải thì người chơi chuyển trang bằng mũi tên. Lượt đang chơi giữ số ải lúc tham gia. Đối thủ: 6 tướng ngẫu nhiên ở cấp đã đặt, nhân chỉ số theo hệ số, kèm số thẻ hỗ trợ ngẫu nhiên. Thưởng cộng dồn theo số ải đã qua.</p>
  ${draft.stages.map((s,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">Ải ${i+1}</b>${number(`stages.${i}.level`,'Cấp đối thủ',1)}${number(`stages.${i}.boost`,'Hệ số chỉ số',0.1,0.05)}${number(`stages.${i}.cards`,'Thẻ của đối thủ',0)}<div class="beast-chips">${s.rewards.map((r,k)=>chip(`stages.${i}.rewards.${k}`,r)).join('')}<button type="button" class="ghost mini" data-add="stages.${i}.rewards">+ Thêm</button></div><button type="button" class="ghost mini" data-del-stage="${i}" ${draft.stages.length<=1?'disabled':''}>Xóa ải</button></div>`).join('')}
  <div class="row"><button type="button" class="ghost" data-add-stage>+ Thêm ải</button></div>`;
 }
 const cards=()=>`<h3>Thẻ hỗ trợ (thẻ Marineford gốc)</h3><p class="muted">Xuất hiện trong lựa chọn trợ giúp và trong đội đối thủ. Hiệu ứng cố định theo thẻ.</p><div class="beast-chips">${data.cards.map(k=>`<span class="beast-chip" title="${escape(k.description)}">${k.icon?icon(k.icon):''}<span class="grow"><b>${escape(k.name)}</b> · bậc ${k.rank}<br><small class="muted">${escape(k.description)}</small></span></span>`).join('')}</div>`;
 function render(){
  root.innerHTML=`<section class="card ev-admin raid-admin gem-admin">${nav()}<div class="ev-edit"><label class="ev-toggle"><input type="checkbox" data-enabled ${draft.enabled!==false?'checked':''}><span>${draft.enabled!==false?'Đang bật: toà nhà hiện trên bản đồ thế giới':'Đang tắt: ẩn toà nhà, người chơi không thao tác được'}</span></label>${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<p class="muted">${data.custom?'Đang dùng cấu hình đã sửa'+(data.updatedAt?' · cập nhật '+new Date(data.updatedAt).toLocaleString('vi-VN'):''):'Đang dùng cấu hình mặc định.'}</p>
  ${{common,stages,cards}[view]()}
  <div class="row ev-actions"><button type="button" id="freedom-save">Lưu</button><button type="button" class="ghost" id="freedom-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="freedom-reset">Về mặc định</button></div>
  ${picker?`<div class="beast-picker ev-picker"><input id="freedom-search" type="search" placeholder="Tìm vàng, kim cương, EXP tướng hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><div id="freedom-matches" class="beast-matches"></div></div>`:''}</div></section>`;
  if(picker){matches();$('#freedom-search').focus()}
 }
 function matches(){const text=fold(($('#freedom-search')?.value||'').trim()),l=pool().filter(i=>!text||fold(i.name).includes(text)||fold(i.id).includes(text)).slice(0,30);
  $('#freedom-matches').innerHTML=l.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
 const load=()=>{draft=structuredClone(data.config);dirty=false;picker=null};
 window.AdminFreedom={async show(){root.hidden=false;data=await api('/api/admin/freedom');load();render()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{const t=e.target;if(t.id==='freedom-search')return matches();
  if(t.dataset.num){const v=Number(t.value);set(t.dataset.num,t.dataset.float!==undefined?v:Math.floor(v));const b=$('#freedom-undo');if(b)b.disabled=false}});

 // Công tắc bật / tắt (lưu cùng nút Lưu).
 root.addEventListener('change',e=>{if(e.target.dataset.enabled===undefined)return;draft.enabled=e.target.checked;dirty=true;render()});
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.view!==undefined){view=t.dataset.view;picker=null;render();return}
   if(t.dataset.add){picker={mode:'add',path:t.dataset.add};render();return}
   if(t.dataset.swap){picker={mode:'swap',path:t.dataset.swap};render();return}
   if(t.dataset.pick){const id=t.dataset.pick;if(picker.mode==='add')get(picker.path).push({itemId:id,quantity:1});else set(picker.path+'.itemId',id);dirty=true;picker=null;render();return}
   if(t.dataset.remove){const keys=t.dataset.remove.split('.'),i=Number(keys.pop());get(keys.join('.')).splice(i,1);dirty=true;render();return}
   if(t.dataset.delStage!==undefined){if(!confirm(`Xóa ải ${Number(t.dataset.delStage)+1}?`))return;draft.stages.splice(Number(t.dataset.delStage),1);dirty=true;render();return}
   // Ải mới: nối tiếp ải cuối (cấp +20, hệ số +0.15, thưởng giống ải cuối).
   if(t.dataset.addStage!==undefined){const last=draft.stages.at(-1);draft.stages.push({level:last.level+20,boost:Math.round((last.boost+.15)*100)/100,cards:Math.min(10,last.cards+(draft.stages.length%2?1:0)),rewards:structuredClone(last.rewards)});dirty=true;render();return}
   if(t.dataset.delReset!==undefined){draft.resetCosts.splice(Number(t.dataset.delReset),1);dirty=true;render();return}
   if(t.dataset.addReset!==undefined){draft.resetCosts.push((draft.resetCosts.at(-1)||0)+100);dirty=true;render();return}
   if(t.id==='freedom-undo'){load();render();return}
   if(t.id==='freedom-save'){data=await api('/api/admin/freedom',{config:draft});load();render();toast('Đã lưu. Có hiệu lực ngay.');return}
   if(t.id==='freedom-reset'){if(!confirm('Trả Đấu Trường Tự Do về cấu hình mặc định?'))return;data=await api('/api/admin/freedom',{reset:true});load();render();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
})();
