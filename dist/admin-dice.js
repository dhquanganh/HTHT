/* Tab Đổ xúc xắc của trang quản trị: bật / tắt, xúc xắc miễn phí mỗi ngày, giá / giới hạn mua, số vòng, sao mỗi vòng,
   mốc sao (thêm / xóa), 22 ô của bàn (ô tài nguyên: loại + số lượng cấp 1; ô kích hoạt: +xúc xắc, xúc xắc may mắn, Tarot,
   choáng) và tỉ lệ 7 lá Tarot. Server kiểm tra lại và lưu ở dice_config. Tiến độ người chơi làm lại mỗi tuần. */
(()=>{
 'use strict';
 const {api,toast,escape,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#dice-tab');
 let data=null,draft=null,view='common',dirty=false,picker=null;
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
 const set=(path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],draft)[last]=value;dirty=true};
 const number=(path,label,min=0)=>`<label class="ev-num">${label}<input type="number" min="${min}" step="1" value="${get(path)}" data-num="${path}"></label>`;
 const chip=(path,r)=>{const i=info(r.itemId);return `<span class="beast-chip gem-chip" title="${escape(i.name)}"><button type="button" class="ghost mini swap" data-swap="${path}" aria-label="Đổi vật phẩm">${icon(i.icon)}</button><span class="grow">${escape(i.name)}</span><input type="number" min="1" step="1" value="${r.quantity}" data-num="${path}.quantity" aria-label="Số lượng"><button type="button" class="ghost mini" data-remove="${path}" aria-label="Xóa">×</button></span>`};
 const keyName={1:'EXP tướng',2:'Đá cường hóa',3:'Bụi',11:'Hồn chiến hạm',12:'Đá hỗn độn','-100':'Sao (tính điểm mốc)'};
 const trigName={5:'+1 xúc xắc thường',6:'+1 xúc xắc may mắn',3:'Lá bài Tarot',4:'Choáng (lần sau chẵn tiến, lẻ lùi)'};
 const tarotName={1:'Tài nguyên',2:'X2 điểm lần sau',5:'Đi lùi lần sau',6:'Tăng cấp 1 ô',9:'Giảm cấp 1 ô',7:'Về điểm khởi đầu',8:'Mất tài nguyên lần đi kế'};
 const views=[['common','Chung','Xúc xắc, giá, vòng'],['milestones','Mốc sao',()=>draft.milestones.length+' mốc'],['board','Bàn 22 ô','Ô tài nguyên / kích hoạt'],['tarot','Lá Tarot','Tỉ lệ 7 lá']];
 const nav=()=>`<nav class="ev-list-admin">${views.map(([k,t,s])=>`<button type="button" class="ev-pick ${view===k?'on':''}" data-view="${k}"><b>${t}</b><small>${typeof s==='function'?s():s}</small></button>`).join('')}</nav>`;
 const common=()=>`<h3>Thiết lập chung</h3><div class="row raid-common">${number('dailyDice','Xúc xắc miễn phí mỗi ngày')}${number('price','Giá 1 xúc xắc (kim cương)',1)}${number('buyLimit','Mua tối đa / ngày')}${number('lapMax','Số vòng tối đa / tuần',1)}${number('lapStars','Sao mỗi vòng')}</div>
  <p class="muted">Tiến độ (vị trí, vòng, sao, cấp ô, mốc đã nhận) làm lại mỗi tuần (thứ Hai, giờ Việt Nam).</p>`;
 const milestones=()=>`<h3>Mốc sao</h3>${draft.milestones.map((m,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">${i+1}</b>${number(`milestones.${i}.stars`,'Số sao',1)}<div class="beast-chips">${m.rewards.map((r,k)=>chip(`milestones.${i}.rewards.${k}`,r)).join('')}<button type="button" class="ghost mini" data-add="milestones.${i}.rewards">+ Thêm</button></div><button type="button" class="ghost mini" data-del="${i}">Xóa mốc</button></div>`).join('')}
  <div class="row"><button type="button" class="ghost" data-addm>+ Thêm mốc</button></div>`;
 const board=()=>`<h3>Bàn 22 ô</h3><p class="muted">Ô tài nguyên lên cấp mỗi lần dừng (tối đa 3): cấp 2 nhận ×1.5, cấp 3 nhận ×2 (ô Sao: ×cấp). Đi qua ô Sao cũng nhận sao.</p>
  <div class="dice-board-admin">${draft.board.map((t,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">Ô ${i+1}</b>
   <label class="ev-num">Loại<select data-kind="${i}"><option value="1" ${t.type===1?'selected':''}>Tài nguyên</option><option value="2" ${t.type===2?'selected':''}>Kích hoạt</option></select></label>
   ${t.type===1?`<label class="ev-num">Tài nguyên<select data-key="${i}">${data.keys.map(k=>`<option value="${k.key}" ${k.key===t.key?'selected':''}>${keyName[k.key]}</option>`).join('')}</select></label>${number(`board.${i}.amount`,'Số lượng cấp 1',1)}`
    :`<label class="ev-num">Hiệu ứng<select data-trig="${i}">${Object.entries(trigName).map(([k,v])=>`<option value="${k}" ${Number(k)===t.trigger?'selected':''}>${v}</option>`).join('')}</select></label>`}</div>`).join('')}</div>`;
 const tarot=()=>`<h3>Tỉ lệ lá Tarot (trọng số)</h3>${draft.tarot.map((t,i)=>`<div class="row raid-common"><span class="grow">${tarotName[t.effect]}</span>${number(`tarot.${i}.weight`,'Trọng số')}</div>`).join('')}`;
 function render(){
  root.innerHTML=`<section class="card ev-admin raid-admin gem-admin">${nav()}<div class="ev-edit"><label class="ev-toggle"><input type="checkbox" data-enabled ${draft.enabled!==false?'checked':''}><span>${draft.enabled!==false?'Đang bật: hiện trong cửa sổ Sự kiện đặc biệt':'Đang tắt: ẩn khỏi game, người chơi không thao tác được'}</span></label>
   ${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<p class="muted">${data.custom?'Đang dùng cấu hình đã sửa'+(data.updatedAt?' · cập nhật '+new Date(data.updatedAt).toLocaleString('vi-VN'):''):'Đang dùng cấu hình mặc định.'}</p>
   ${{common,milestones,board,tarot}[view]()}
   <div class="row ev-actions"><button type="button" id="dice-save">Lưu</button><button type="button" class="ghost" id="dice-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="dice-reset">Về mặc định</button></div>
   ${picker?`<div class="beast-picker ev-picker"><input id="dice-search" type="search" placeholder="Tìm vàng, kim cương hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><div id="dice-matches" class="beast-matches"></div></div>`:''}</div></section>`;
  if(picker){matches();$('#dice-search').focus()}
 }
 function matches(){const t=fold(($('#dice-search')?.value||'').trim()),l=pool().filter(i=>!t||fold(i.name).includes(t)||fold(i.id).includes(t)).slice(0,30);
  $('#dice-matches').innerHTML=l.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
 const load=()=>{draft=structuredClone(data.config);dirty=false;picker=null};
 window.AdminDice={async show(){root.hidden=false;data=await api('/api/admin/dice');load();render()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{const t=e.target;if(t.id==='dice-search')return matches();if(t.dataset.num){set(t.dataset.num,Math.floor(Number(t.value)));const b=$('#dice-undo');if(b)b.disabled=false}});
 root.addEventListener('change',e=>{const t=e.target;
  if(t.dataset.enabled!==undefined){draft.enabled=t.checked;dirty=true;return render()}
  if(t.dataset.kind){const i=Number(t.dataset.kind);draft.board[i]=t.value==='1'?{type:1,key:1,amount:20000}:{type:2,trigger:5};dirty=true;return render()}
  if(t.dataset.key){draft.board[Number(t.dataset.key)].key=Number(t.value);dirty=true;return render()}
  if(t.dataset.trig){draft.board[Number(t.dataset.trig)].trigger=Number(t.value);dirty=true;return render()}});
 root.addEventListener('click',async e=>{const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.view){view=t.dataset.view;picker=null;return render()}
   if(t.dataset.add){picker={mode:'add',path:t.dataset.add};return render()}
   if(t.dataset.swap){picker={mode:'swap',path:t.dataset.swap};return render()}
   if(t.dataset.pick){const id=t.dataset.pick;if(picker.mode==='add')get(picker.path).push({itemId:id,quantity:1});else set(picker.path+'.itemId',id);dirty=true;picker=null;return render()}
   if(t.dataset.remove){const keys=t.dataset.remove.split('.'),i=Number(keys.pop());get(keys.join('.')).splice(i,1);dirty=true;return render()}
   if(t.dataset.del!==undefined){draft.milestones.splice(Number(t.dataset.del),1);dirty=true;return render()}
   if(t.dataset.addm!==undefined){const last=draft.milestones.at(-1);draft.milestones.push({stars:(last?.stars||0)+100,rewards:structuredClone(last?.rewards||[{itemId:'gold',quantity:100000}])});dirty=true;return render()}
   if(t.id==='dice-undo'){load();return render()}
   if(t.id==='dice-save'){data=await api('/api/admin/dice',{config:draft});load();render();return toast('Đã lưu. Có hiệu lực ngay.')}
   if(t.id==='dice-reset'){if(!confirm('Trả Đổ xúc xắc về cấu hình mặc định?'))return;data=await api('/api/admin/dice',{reset:true});load();render();return toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}});
})();
