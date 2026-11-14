/* Tab Ngọc Vega của trang quản trị: Boss ngọc (ngày mở, chỉ số, debuff có sẵn và phần thưởng rơi của từng bậc
   cho từng boss), lượt mỗi ngày, số hiệp, số debuff tối đa và các mốc điểm debuff (bậc Địa Ngục).
   Server kiểm tra lại toàn bộ và lưu ở gem_config; có hiệu lực ngay, người chơi thấy khi mở lại Boss ngọc. */
(()=>{
 'use strict';
 const {api,toast,escape,num,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#gem-tab');
 const days=[[2,'T2'],[3,'T3'],[4,'T4'],[5,'T5'],[6,'T6'],[7,'T7'],[1,'CN']];
 let data=null,draft=null,view='common',dirty=false,picker=null,autoScale=true,scaleBase=null;
 // Chỉ số theo cấp: Công / Thủ / Máu tỉ lệ thuận với cấp, Tốc độ tăng 20% mức thay đổi. Tính từ mốc lúc bắt đầu sửa cấp
 // (không cộng dồn làm tròn khi gõ từng chữ số).
 function scaleTier(path,level){
  const tier=get(path);if(!scaleBase||scaleBase.path!==path)scaleBase={path,level:tier.level,attack:tier.attack,defense:tier.defense,hp:tier.hp,speed:tier.speed};
  const b=scaleBase,r=level/Math.max(1,b.level);if(!(level>=1))return;
  Object.assign(tier,{level,attack:Math.max(1,Math.round(b.attack*r)),defense:Math.max(0,Math.round(b.defense*r)),hp:Math.max(1,Math.round(b.hp*r)),speed:Math.max(1,Math.round(b.speed*(1+(r-1)*.2)))});
  for(const k of ['attack','defense','hp','speed']){const input=root.querySelector(`[data-num="${path}.${k}"]`);if(input)input.value=tier[k]}
 }
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const get=path=>path.split('.').reduce((o,k)=>o?.[k],draft);
 const set=(path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],draft)[last]=value;dirty=true};
 const number=(path,label,min=0)=>`<label class="ev-num">${label}<input type="number" min="${min}" step="1" value="${get(path)}" data-num="${path}"></label>`;
 const chip=(path,r,rate)=>{const i=info(r.itemId);return `<span class="beast-chip gem-chip" title="${escape(i.name)}"><button type="button" class="ghost mini swap" data-swap="${path}" aria-label="Đổi vật phẩm ${escape(i.name)}">${icon(i.icon)}</button><span class="grow">${escape(i.name)}</span><input type="number" min="1" step="1" value="${r.quantity}" data-num="${path}.quantity" aria-label="Số lượng ${escape(i.name)}" title="Số lượng">${rate?`<input class="gem-rate" type="number" min="0.1" max="100" step="0.1" value="${r.rate/10}" data-rate="${path}.rate" aria-label="Tỉ lệ rơi % ${escape(i.name)}" title="Tỉ lệ rơi (%)"><small>%</small>`:''}<button type="button" class="ghost mini" data-remove="${path}" aria-label="Xóa ${escape(i.name)}">×</button></span>`};
 const debuffSelect=(path,value)=>`<label class="ev-num">Debuff có sẵn<select data-select="${path}"><option value="0">Không có</option>${data.debuffs.map(d=>`<option value="${d.id}" ${d.id===value?'selected':''}>${escape(d.name)} (${d.point} điểm)</option>`).join('')}</select></label>`;
 function nav(){
  return `<nav class="ev-list-admin"><button type="button" class="ev-pick ${view==='common'?'on':''}" data-view="common"><b>Chung</b><small>Lượt, hiệp, mốc debuff</small></button>${data.bosses.map((b,i)=>{const c=draft.bosses[i];return `<button type="button" class="ev-pick gem-pick ${view===String(i)?'on':''}" data-view="${i}">${icon(b.head,'item-icon')}<span><b>${escape(b.name)}</b><small>${c.days.length?days.filter(([d])=>c.days.includes(d)).map(x=>x[1]).join(' '):'Tạm đóng'}</small></span></button>`}).join('')}</nav>`;
 }
 function common(){
  const ms=draft.milestones;
  return `<h3>Thiết lập chung</h3><div class="row raid-common">${number('turns','Lượt miễn phí / boss / ngày')}${number('rounds','Số hiệp tối đa mỗi trận',1)}${number('maxDebuffs','Số debuff được chọn tối đa',1)}</div>
  <p class="muted">Hết lượt miễn phí thì mỗi trận tốn 1 Vé Đánh Boss Ngọc. Lượt hồi lúc 0 giờ (giờ Việt Nam).</p>
  <h3>Mốc điểm debuff (bậc Địa Ngục)</h3><p class="muted">Thắng bậc Địa Ngục nhận thêm phần thưởng của mốc cao nhất đạt được. Tổng điểm của tất cả debuff: ${data.debuffs.reduce((n,d)=>n+d.point,0)}.</p>
  ${ms.map((m,i)=>`<div class="beast-rank ev-row-edit raid-level"><b class="raid-index">Mốc ${i+1}</b>${number(`milestones.${i}.point`,'Điểm cần',1)}<div class="beast-chips">${m.rewards.map((r,k)=>chip(`milestones.${i}.rewards.${k}`,r,false)).join('')}<button type="button" class="ghost mini" data-add="milestones.${i}.rewards">+ Thêm</button></div><button type="button" class="ghost mini" data-del-milestone="${i}">Xóa mốc</button></div>`).join('')}
  <div class="row"><button type="button" class="ghost" data-add-milestone>+ Thêm mốc</button></div>`;
 }
 function boss(i){
  const b=data.bosses[i],c=draft.bosses[i],base=`bosses.${i}`;
  return `<div class="gem-boss-head">${b.card?`<img src="${escape(b.card)}" alt="">`:''}<div><h3>${escape(b.name)}</h3><p class="muted">Ngày mở (giờ Việt Nam). Bỏ hết để tạm đóng boss.</p><div class="row gem-days">${days.map(([d,l])=>`<label class="gem-day"><input type="checkbox" data-day="${d}" ${c.days.includes(d)?'checked':''}> ${l}</label>`).join('')}</div>
   <div class="row"><button type="button" class="ghost mini" data-copy-rewards="${i}">Chép phần thưởng của boss này sang 2 boss kia</button><button type="button" class="ghost mini" data-default-stats="${i}">Chỉ số về mặc định</button><label class="gem-day" title="Đổi Cấp thì Công / Thủ / Máu đổi theo tỉ lệ, Tốc độ đổi 20% mức đó"><input type="checkbox" data-autoscale ${autoScale?'checked':''}> Chỉ số theo cấp</label></div></div></div>
  ${c.tiers.map((t,k)=>{const p=`${base}.tiers.${k}`,total=t.rewards.length;return `<div class="beast-rank ev-row-edit gem-tier"><div class="gem-tier-title"><b>${escape(data.tierNames[k])}</b><span>${escape(b.tiers[k].name)}</span><small class="muted">${b.tiers[k].skills.map(escape).join(' · ')}</small></div>
   <div class="row gem-stats">${number(p+'.level','Cấp',1)}${number(p+'.attack','Công',1)}${number(p+'.defense','Thủ')}${number(p+'.hp','Máu',1)}${number(p+'.speed','Tốc độ',1)}${k<5?debuffSelect(p+'.debuff',t.debuff):'<p class="muted gem-note">Địa Ngục: người chơi tự chọn debuff.</p>'}</div>
   <div class="beast-chips">${t.rewards.map((r,x)=>chip(`${p}.rewards.${x}`,r,true)).join('')}${total<12?`<button type="button" class="ghost mini" data-add="${p}.rewards" data-rate="1">+ Thêm</button>`:''}</div></div>`}).join('')}`;
 }
 function render(){
  root.innerHTML=`<section class="card ev-admin raid-admin gem-admin">${nav()}<div class="ev-edit">${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<p class="muted">${data.custom?'Đang dùng cấu hình đã sửa'+(data.updatedAt?' · cập nhật '+new Date(data.updatedAt).toLocaleString('vi-VN'):''):'Đang dùng cấu hình mặc định.'}</p>
  ${view==='common'?common():boss(Number(view))}
  <div class="row ev-actions"><button type="button" id="gem-save">Lưu</button><button type="button" class="ghost" id="gem-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="gem-reset">Về mặc định</button></div>
  ${picker?`<div class="beast-picker ev-picker"><input id="gem-search" type="search" placeholder="Tìm vàng, kim cương, EXP tướng hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><div id="gem-matches" class="beast-matches"></div></div>`:''}</div></section>`;
  if(picker){matches();$('#gem-search').focus()}
 }
 function matches(){const text=fold(($('#gem-search')?.value||'').trim()),list=pool().filter(i=>!text||fold(i.name).includes(text)||fold(i.id).includes(text)).slice(0,30);
  $('#gem-matches').innerHTML=list.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}
 const load=()=>{draft=structuredClone(data.config);dirty=false;picker=null;scaleBase=null};
 const mark=()=>{const b=$('#gem-undo');if(b)b.disabled=false;dirty=true};
 window.AdminGem={async show(){root.hidden=false;data=await api('/api/admin/gem');load();render()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{const t=e.target;if(t.id==='gem-search')return matches();
  if(t.dataset.num){const v=Math.floor(Number(t.value));if(autoScale&&/\.tiers\.\d+\.level$/.test(t.dataset.num)){scaleTier(t.dataset.num.replace(/\.level$/,''),v);mark();return}set(t.dataset.num,v);mark()}
  if(t.dataset.rate){set(t.dataset.rate,Math.round(Number(t.value)*10));mark()}});
 root.addEventListener('change',e=>{const t=e.target;
  if(t.dataset.autoscale!==undefined){autoScale=t.checked;return}
  if(/\.level$/.test(t.dataset.num||''))scaleBase=null;
  if(t.dataset.select){set(t.dataset.select,Number(t.value));mark();return}
  if(t.dataset.day){const c=draft.bosses[Number(view)],d=Number(t.dataset.day);c.days=t.checked?[...new Set([...c.days,d])].sort():c.days.filter(x=>x!==d);dirty=true;render()}});
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.view!==undefined){view=t.dataset.view;picker=null;render();return}
   if(t.dataset.add){picker={mode:'add',path:t.dataset.add,rate:!!t.dataset.rate};render();return}
   if(t.dataset.swap){picker={mode:'swap',path:t.dataset.swap};render();return}
   if(t.dataset.pick){
    if(picker.mode==='add'){const list=get(picker.path);if(list.some(r=>r.itemId===t.dataset.pick))return toast('Vật phẩm này đã có trong danh sách.');list.push({itemId:t.dataset.pick,quantity:1,...(picker.rate?{rate:1000}:{})})}
    else{const keys=picker.path.split('.'),i=Number(keys.pop()),list=get(keys.join('.'));if(list.some((r,k)=>k!==i&&r.itemId===t.dataset.pick))return toast('Vật phẩm này đã có trong danh sách.');set(picker.path+'.itemId',t.dataset.pick)}
    dirty=true;picker=null;render();return}
   if(t.dataset.remove){const keys=t.dataset.remove.split('.'),i=Number(keys.pop());get(keys.join('.')).splice(i,1);dirty=true;render();return}
   if(t.dataset.delMilestone!==undefined){draft.milestones.splice(Number(t.dataset.delMilestone),1);dirty=true;render();return}
   if(t.dataset.addMilestone!==undefined){const last=draft.milestones.at(-1);draft.milestones.push({point:(last?.point||0)+10,rewards:structuredClone(last?.rewards||[{itemId:'diamonds',quantity:10}])});dirty=true;render();return}
   if(t.dataset.copyRewards!==undefined){const from=Number(t.dataset.copyRewards);if(!confirm(`Chép phần thưởng 6 bậc của ${data.bosses[from].name} sang 2 boss còn lại?`))return;draft.bosses.forEach((b,i)=>{if(i!==from)b.tiers.forEach((tier,k)=>tier.rewards=structuredClone(draft.bosses[from].tiers[k].rewards))});dirty=true;render();toast('Đã chép. Nhớ bấm Lưu.');return}
   if(t.dataset.defaultStats!==undefined){const i=Number(t.dataset.defaultStats);draft.bosses[i].tiers.forEach((tier,k)=>{const d=data.defaults.bosses[i].tiers[k];Object.assign(tier,{attack:d.attack,defense:d.defense,hp:d.hp,speed:d.speed,level:d.level})});dirty=true;render();return}
   if(t.id==='gem-undo'){load();render();return}
   if(t.id==='gem-save'){data=await api('/api/admin/gem',{config:draft});load();render();toast('Đã lưu. Có hiệu lực ngay cho các trận mới.');return}
   if(t.id==='gem-reset'){if(!confirm('Trả Ngọc Vega về cấu hình mặc định?'))return;data=await api('/api/admin/gem',{reset:true});load();render();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
})();
