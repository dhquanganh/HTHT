/* Tab Đấu Trường Tân Tinh của trang quản trị: cấp mở, bot, tướng đề xuất + buff, quà đăng ký, thưởng 4 vòng và vòng 16,
   dự đoán, thích, nhiệm vụ và cửa hàng. Server kiểm tra lại và lưu ở nova_config. */
(()=>{
 'use strict';
 const {api,toast,escape,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#nova-tab');
 let data=null,draft=null,view='common',dirty=false,picker=null;
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
 const set=(path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],draft)[last]=value;dirty=true};
 const number=(path,label,min=0,step=1)=>`<label class="ev-num">${label}<input type="number" min="${min}" step="${step}" value="${get(path)}" data-num="${path}"${step!==1?' data-float':''}></label>`;
 const chip=(path,r,removeAttr=`data-remove="${path}"`)=>{const i=info(r.itemId);return `<span class="beast-chip gem-chip" title="${escape(i.name)}"><button type="button" class="ghost mini swap" data-swap="${path}" aria-label="Đổi vật phẩm ${escape(i.name)}">${icon(i.icon)}</button><span class="grow">${escape(i.name)}</span><input type="number" min="1" step="1" value="${r.quantity}" data-num="${path}.quantity" aria-label="Số lượng" title="Số lượng"><button type="button" class="ghost mini" ${removeAttr} aria-label="Xóa ${escape(i.name)}">×</button></span>`};
 const list=(path,label)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">${label}</b><div class="beast-chips">${get(path).map((r,k)=>chip(`${path}.${k}`,r)).join('')}<button type="button" class="ghost mini" data-add="${path}">+ Thêm</button></div></div>`;
 const stageNames=['Vòng loại 1','Vòng loại 2','Vòng bảng 1','Vòng bảng 2'],finalNames=['Vô địch','Á quân','Top 4','Top 8','Top 16'];
 const buffNames={100:'Tấn công',101:'Phòng thủ',102:'Máu',103:'Tốc độ',104:'Chí mạng',105:'Né tránh'};
 const kinds={register:'Đăng ký',attack:'Khiêu chiến',win:'Thắng trận',bet:'Dự đoán',like:'Thích'};
 const views=[['common','Chung','Cấp mở, bot, tướng đề xuất'],['rewards','Phần thưởng','Đăng ký, 4 vòng, vòng 16'],['extra','Dự đoán & thích','Quà dự đoán đúng/sai, thích'],['quests','Nhiệm vụ',()=>draft.quests.length+' nhiệm vụ'],['shop','Cửa hàng',()=>draft.shop.length+' món']];
 function nav(){return `<nav class="ev-list-admin">${views.map(([k,t,s])=>`<button type="button" class="ev-pick ${view===k?'on':''}" data-view="${k}"><b>${t}</b><small>${typeof s==='function'?s():s}</small></button>`).join('')}</nav>`}
 const hero=id=>data.heroes.find(h=>h.id===id);
 function common(){
  return `<h3>Thiết lập chung</h3><div class="row raid-common">${number('minLevel','Cấp tối thiểu',1)}${number('botBoost','Hệ số lực chiến bot',0.1,0.1)}${number('recommendCount','Số tướng đề xuất / mùa',0)}</div>
  <p class="muted">Mỗi mùa chọn ngẫu nhiên tướng đề xuất từ danh sách dưới (để trống = mọi tướng). Tướng đề xuất ra trận được cộng buff (‰, 200 = +20%).</p>
  <h3>Buff tướng đề xuất</h3>
  ${draft.buff.map(([id,v],i)=>`<div class="row raid-common"><label class="ev-num">Chỉ số<select data-buff="${i}">${Object.entries(buffNames).map(([k,n])=>`<option value="${k}" ${Number(k)===id?'selected':''}>${n}</option>`).join('')}</select></label>${number(`buff.${i}.1`,'Giá trị (‰)',1)}<button type="button" class="ghost mini" data-del-buff="${i}">Xóa</button></div>`).join('')}
  <div class="row"><button type="button" class="ghost" data-add-buff>+ Thêm buff</button></div>
  <h3>Nhóm tướng đề xuất</h3><div class="beast-chips">${draft.recommendPool.map((id,k)=>`<span class="beast-chip"><span class="grow">${escape(hero(id)?.name||id)}</span><button type="button" class="ghost mini" data-del-hero="${k}" aria-label="Xóa">×</button></span>`).join('')}<button type="button" class="ghost mini" data-add-hero>+ Thêm tướng</button></div>`;
 }
 function rewards(){
  return `<h3>Quà đăng ký</h3>${list('register','Đăng ký')}
  <h3>Thưởng từng vòng (gửi qua thư khi vòng kết thúc)</h3>${draft.stageRewards.map((s,i)=>list(`stageRewards.${i}.advance`,stageNames[i]+' · đi tiếp')+list(`stageRewards.${i}.out`,stageNames[i]+' · bị loại')).join('')}
  <h3>Thưởng vòng 16 đấu loại trực tiếp</h3>${draft.finalRewards.map((r,i)=>list(`finalRewards.${i}`,finalNames[i])).join('')}`;
 }
 const extra=()=>`<h3>Dự đoán vòng 16</h3>${list('bet.correct','Đoán đúng')}${list('bet.wrong','Đoán sai')}<h3>Thích người chơi trong bảng vinh danh</h3>${list('like','Mỗi lượt thích')}`;
 function quests(){
  return `<h3>Nhiệm vụ mùa</h3>${draft.quests.map((q,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">${i+1}</b><label class="ev-num grow">Tên<input type="text" maxlength="120" value="${escape(q.title)}" data-text="quests.${i}.title"></label><label class="ev-num">Loại<select data-kind="${i}">${Object.entries(kinds).map(([k,n])=>`<option value="${k}" ${q.kind===k?'selected':''}>${n}</option>`).join('')}</select></label>${number(`quests.${i}.target`,'Mục tiêu',1)}<div class="beast-chips">${q.rewards.map((r,k)=>chip(`quests.${i}.rewards.${k}`,r)).join('')}<button type="button" class="ghost mini" data-add="quests.${i}.rewards">+ Thêm</button></div><button type="button" class="ghost mini" data-del-quest="${i}">Xóa</button></div>`).join('')}
  <div class="row"><button type="button" class="ghost" data-add-quest>+ Thêm nhiệm vụ</button></div>`;
 }
 function shop(){
  const cur=info(data.currency||'consumable:207');
  return `<h3>Cửa hàng (giá tính bằng ${escape(cur.name)})</h3>${draft.shop.map((s,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">${i+1}</b><div class="beast-chips">${chip(`shop.${i}.reward`,s.reward,`data-del-shop="${i}"`)}</div>${number(`shop.${i}.price`,'Giá',1)}${number(`shop.${i}.limit`,'Giới hạn / mùa',1)}</div>`).join('')}
  <div class="row"><button type="button" class="ghost" data-add-shop>+ Thêm món</button></div>`;
 }
 function render(){
  const body={common,rewards,extra,quests,shop}[view]();
  root.innerHTML=`<section class="card ev-admin raid-admin gem-admin">${nav()}<div class="ev-edit"><label class="ev-toggle"><input type="checkbox" data-enabled ${draft.enabled!==false?'checked':''}><span>${draft.enabled!==false?'Đang bật: toà nhà hiện trên bản đồ thế giới':'Đang tắt: ẩn toà nhà, người chơi không thao tác được'}</span></label>${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<p class="muted">${data.custom?'Đang dùng cấu hình đã sửa'+(data.updatedAt?' · cập nhật '+new Date(data.updatedAt).toLocaleString('vi-VN'):''):'Đang dùng cấu hình mặc định.'} Lịch mùa cố định theo tuần (giờ Việt Nam).</p>
  ${body}
  <div class="row ev-actions"><button type="button" id="nova-save">Lưu</button><button type="button" class="ghost" id="nova-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="nova-reset">Về mặc định</button></div>
  ${picker?`<div class="beast-picker ev-picker"><input id="nova-search" type="search" placeholder="${picker.mode==='hero'?'Tìm tướng':'Tìm vàng, kim cương, EXP tướng hoặc vật phẩm'}" aria-label="Tìm" autocomplete="off"><div id="nova-matches" class="beast-matches"></div></div>`:''}</div></section>`;
  if(picker){matches();$('#nova-search').focus()}
 }
 function matches(){const text=fold(($('#nova-search')?.value||'').trim());
  if(picker.mode==='hero'){const l=data.heroes.filter(h=>!draft.recommendPool.includes(h.id)&&(!text||fold(h.name).includes(text)||fold(h.id).includes(text))).slice(0,30);
   $('#nova-matches').innerHTML=l.map(h=>`<button type="button" data-pick-hero="${escape(h.id)}"><span class="grow">${escape(h.name)}</span><small class="muted">${escape(h.id)}</small></button>`).join('')||'<p class="muted">Không tìm thấy.</p>';return}
  const l=pool().filter(i=>!text||fold(i.name).includes(text)||fold(i.id).includes(text)).slice(0,30);
  $('#nova-matches').innerHTML=l.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
 const load=()=>{draft=structuredClone(data.config);dirty=false;picker=null};
 const touched=()=>{const b=$('#nova-undo');if(b)b.disabled=false};
 window.AdminNova={async show(){root.hidden=false;data=await api('/api/admin/nova');load();render()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{const t=e.target;if(t.id==='nova-search')return matches();
  if(t.dataset.num){const v=Number(t.value);set(t.dataset.num,t.dataset.float!==undefined?v:Math.floor(v));touched()}
  if(t.dataset.text){set(t.dataset.text,t.value);touched()}});
 root.addEventListener('change',e=>{const t=e.target;
  if(t.dataset.buff){draft.buff[Number(t.dataset.buff)][0]=Number(t.value);dirty=true;touched()}
  if(t.dataset.kind){draft.quests[Number(t.dataset.kind)].kind=t.value;dirty=true;touched()}});

 // Công tắc bật / tắt (lưu cùng nút Lưu).
 root.addEventListener('change',e=>{if(e.target.dataset.enabled===undefined)return;draft.enabled=e.target.checked;dirty=true;render()});
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.view!==undefined){view=t.dataset.view;picker=null;render();return}
   if(t.dataset.add){picker={mode:'add',path:t.dataset.add};render();return}
   if(t.dataset.swap){picker={mode:'swap',path:t.dataset.swap};render();return}
   if(t.dataset.addHero!==undefined){picker={mode:'hero'};render();return}
   if(t.dataset.addShop!==undefined){picker={mode:'shop'};render();return}
   if(t.dataset.pickHero){draft.recommendPool.push(t.dataset.pickHero);dirty=true;picker=null;render();return}
   if(t.dataset.pick){const id=t.dataset.pick;
    if(picker.mode==='add')get(picker.path).push({itemId:id,quantity:1});
    else if(picker.mode==='shop')draft.shop.push({id:0,reward:{itemId:id,quantity:1},price:100,limit:1});
    else set(picker.path+'.itemId',id);
    dirty=true;picker=null;render();return}
   if(t.dataset.remove){const keys=t.dataset.remove.split('.'),i=Number(keys.pop());get(keys.join('.')).splice(i,1);dirty=true;render();return}
   for(const [attr,arr] of [['delBuff','buff'],['delHero','recommendPool'],['delQuest','quests'],['delShop','shop']])if(t.dataset[attr]!==undefined){draft[arr].splice(Number(t.dataset[attr]),1);dirty=true;render();return}
   if(t.dataset.addBuff!==undefined){draft.buff.push([103,100]);dirty=true;render();return}
   if(t.dataset.addQuest!==undefined){draft.quests.push({id:0,title:'Khiêu chiến 10 lần',kind:'attack',target:10,rewards:[{itemId:'gold',quantity:100000}]});dirty=true;render();return}
   if(t.id==='nova-undo'){load();render();return}
   if(t.id==='nova-save'){data=await api('/api/admin/nova',{config:draft});load();render();toast('Đã lưu. Có hiệu lực ngay.');return}
   if(t.id==='nova-reset'){if(!confirm('Trả Đấu Trường Tân Tinh về cấu hình mặc định?'))return;data=await api('/api/admin/nova',{reset:true});load();render();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
})();
