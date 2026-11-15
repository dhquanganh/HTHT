/* Tab Vượt Ngục (Impel Down) của trang quản trị: mùa, nguồn chìa (tặng mỗi ngày, giá, giới hạn mua), 7 tầng (số chìa mở ô,
   kho quà 35 ô, quà cửa) và quà đạt mốc. Server kiểm tra lại và lưu ở impeldown_config; tăng "Mùa" để mọi người chơi làm lại. */
(()=>{
 'use strict';
 const {api,toast,escape,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#impel-tab');
 let data=null,draft=null,view='common',dirty=false,picker=null;
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
 const set=(path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],draft)[last]=value;dirty=true};
 const number=(path,label,min=0)=>`<label class="ev-num">${label}<input type="number" min="${min}" step="1" value="${get(path)}" data-num="${path}"></label>`;
 const chip=(path,r,extra='')=>{const i=info(r.itemId);return `<span class="beast-chip gem-chip" title="${escape(i.name)}"><button type="button" class="ghost mini swap" data-swap="${path}" aria-label="Đổi vật phẩm ${escape(i.name)}">${icon(i.icon)}</button><span class="grow">${escape(i.name)}</span><input type="number" min="1" step="1" value="${r.quantity}" data-num="${path}.quantity" aria-label="Số lượng" title="Số lượng">${extra}<button type="button" class="ghost mini" data-remove="${path}" aria-label="Xóa ${escape(i.name)}">×</button></span>`};
 const total=f=>f.prizes.reduce((n,p)=>n+(Number(p.count)||0),0);
 function nav(){return `<nav class="ev-list-admin"><button type="button" class="ev-pick ${view==='common'?'on':''}" data-view="common"><b>Chung</b><small>Mùa, chìa, quà đạt mốc</small></button>${draft.floors.map((f,i)=>`<button type="button" class="ev-pick ${view===String(i)?'on':''}" data-view="${i}"><b>Tầng ${i+1}</b><small class="${total(f)===35?'':'beast-dirty'}">${f.keyCost} chìa / ô · ${total(f)}/35 ô quà</small></button>`).join('')}</nav>`}
 function common(){
  return `<h3>Thiết lập chung</h3><div class="row raid-common">${number('season','Mùa',1)}${number('dailyKeys','Chìa tặng mỗi ngày')}${number('keyPrice','Giá 1 chìa (kim cương)')}${number('buyLimit','Số chìa mua tối đa / ngày')}</div>
  <p class="muted">Tăng "Mùa" thì mọi người chơi làm lại từ tầng 1 (ô, tầng, mốc đã nhận về 0). Chìa đang có trong túi giữ nguyên.</p>
  <h3>Quà đạt mốc (tổng số ô đã lật)</h3>
  ${draft.achievements.map((a,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">Mốc ${i+1}</b>${number(`achievements.${i}.need`,'Số ô cần lật',1)}<div class="beast-chips">${a.rewards.map((r,k)=>chip(`achievements.${i}.rewards.${k}`,r)).join('')}<button type="button" class="ghost mini" data-add="achievements.${i}.rewards">+ Thêm</button></div><button type="button" class="ghost mini" data-del-ach="${i}">Xóa mốc</button></div>`).join('')}
  <div class="row"><button type="button" class="ghost" data-add-ach>+ Thêm mốc</button></div>`;
 }
 function floor(i){
  const f=draft.floors[i],t=total(f);
  return `<h3>Tầng ${i+1}</h3><div class="row raid-common">${number(`floors.${i}.keyCost`,'Số chìa để mở 1 ô',1)}</div>
  <p class="${t===35?'muted':'beast-dirty'}">Kho quà: ${t}/35 ô (36 ô trừ 1 cửa). Mỗi lần lật rút ngẫu nhiên trong phần còn lại của kho quà và cửa.</p>
  <div class="beast-chips gem-tier impel-prizes">${f.prizes.map((p,k)=>chip(`floors.${i}.prizes.${k}.reward`,p.reward,`<input class="gem-rate" type="number" min="1" max="35" step="1" value="${p.count}" data-num="floors.${i}.prizes.${k}.count" aria-label="Số ô" title="Số ô"><small>ô</small>`).replace(`data-remove="floors.${i}.prizes.${k}.reward"`,`data-remove-prize="${i}.${k}"`)).join('')}<button type="button" class="ghost mini" data-add-prize="${i}">+ Thêm quà</button></div>
  <h3>Quà khi tìm thấy cửa</h3><div class="beast-chips">${f.door.map((r,k)=>chip(`floors.${i}.door.${k}`,r)).join('')}<button type="button" class="ghost mini" data-add="floors.${i}.door">+ Thêm</button></div>`;
 }
 function render(){
  root.innerHTML=`<section class="card ev-admin raid-admin gem-admin">${nav()}<div class="ev-edit"><label class="ev-toggle"><input type="checkbox" data-enabled ${draft.enabled!==false?'checked':''}><span>${draft.enabled!==false?'Đang bật: hiện trong cửa sổ Sự kiện đặc biệt':'Đang tắt: ẩn khỏi game, người chơi không thao tác được'}</span></label>${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<p class="muted">${data.custom?'Đang dùng cấu hình đã sửa'+(data.updatedAt?' · cập nhật '+new Date(data.updatedAt).toLocaleString('vi-VN'):''):'Đang dùng cấu hình mặc định.'}</p>
  ${view==='common'?common():floor(Number(view))}
  <div class="row ev-actions"><button type="button" id="impel-save">Lưu</button><button type="button" class="ghost" id="impel-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="impel-reset">Về mặc định</button></div>
  ${picker?`<div class="beast-picker ev-picker"><input id="impel-search" type="search" placeholder="Tìm vàng, kim cương, EXP tướng hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><div id="impel-matches" class="beast-matches"></div></div>`:''}</div></section>`;
  if(picker){matches();$('#impel-search').focus()}
 }
 function matches(){const text=fold(($('#impel-search')?.value||'').trim()),list=pool().filter(i=>!text||fold(i.name).includes(text)||fold(i.id).includes(text)).slice(0,30);
  $('#impel-matches').innerHTML=list.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
 const load=()=>{draft=structuredClone(data.config);dirty=false;picker=null};
 window.AdminImpel={async show(){root.hidden=false;data=await api('/api/admin/impeldown');load();render()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{const t=e.target;if(t.id==='impel-search')return matches();if(t.dataset.num){set(t.dataset.num,Math.floor(Number(t.value)));const b=$('#impel-undo');if(b)b.disabled=false}});
 root.addEventListener('change',e=>{if(e.target.dataset.num&&/\.count$/.test(e.target.dataset.num))render()});

 // Công tắc bật / tắt sự kiện (lưu cùng nút Lưu).
 root.addEventListener('change',e=>{if(e.target.dataset.enabled===undefined)return;draft.enabled=e.target.checked;dirty=true;render()});
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.view!==undefined){view=t.dataset.view;picker=null;render();return}
   if(t.dataset.add){picker={mode:'add',path:t.dataset.add};render();return}
   if(t.dataset.addPrize!==undefined){picker={mode:'prize',floor:Number(t.dataset.addPrize)};render();return}
   if(t.dataset.swap){picker={mode:'swap',path:t.dataset.swap};render();return}
   if(t.dataset.pick){const id=t.dataset.pick;
    if(picker.mode==='add')get(picker.path).push({itemId:id,quantity:1});
    else if(picker.mode==='prize')draft.floors[picker.floor].prizes.push({reward:{itemId:id,quantity:1},count:1});
    else set(picker.path+'.itemId',id);
    dirty=true;picker=null;render();return}
   if(t.dataset.remove){const keys=t.dataset.remove.split('.'),i=Number(keys.pop());get(keys.join('.')).splice(i,1);dirty=true;render();return}
   if(t.dataset.removePrize){const [f,k]=t.dataset.removePrize.split('.').map(Number);draft.floors[f].prizes.splice(k,1);dirty=true;render();return}
   if(t.dataset.delAch!==undefined){draft.achievements.splice(Number(t.dataset.delAch),1);dirty=true;render();return}
   if(t.dataset.addAch!==undefined){const last=draft.achievements.at(-1);draft.achievements.push({id:0,need:(last?.need||0)+20,rewards:structuredClone(last?.rewards||[{itemId:'diamonds',quantity:100}])});dirty=true;render();return}
   if(t.id==='impel-undo'){load();render();return}
   if(t.id==='impel-save'){data=await api('/api/admin/impeldown',{config:draft});load();render();toast('Đã lưu. Có hiệu lực ngay.');return}
   if(t.id==='impel-reset'){if(!confirm('Trả Vượt Ngục về cấu hình mặc định?'))return;data=await api('/api/admin/impeldown',{reset:true});load();render();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
})();
