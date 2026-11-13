/* Tab "Leo tháp" của trang quản trị (server/tower-config.mjs): 2.301 tầng đậu thần gốc, chọn quái từng tầng, cấp quái,
   sức mạnh %, sao, thưởng Beli / Đá đột phá / vật phẩm rơi; thêm / xoá tầng mới. Lưu xong áp ngay. */
(()=>{
 'use strict';
 const {api,toast,escape,num,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#tower-tab');
 let data=null,selected=1,draft=null,dirty=false,picker=null,pickFilter='';
 const factionLabel={abyss:'Vực thẳm',shadow:'Hư ảnh',fortress:'Pháo đài',forest:'Rừng rậm',dark:'Bóng tối',light:'Ánh sáng'};
 const pool=()=>[...data.rewardItems,...catalogItems()],info=id=>pool().find(i=>i.id===id)||{name:id,icon:null};
 const floor=()=>data.floors.find(f=>f.floor===selected);
 const monster=a=>data.monsters.find(m=>m.avatar===String(a));
 async function fetchPage(page){data=await api('/api/admin/tower?page='+page)}
 async function go(n){n=Math.max(1,Math.min(data.total,n));const page=Math.floor((n-1)/data.size);if(page!==data.page)await fetchPage(page);selected=n;load();render()}
 function load(){const f=floor();draft={enemies:null,level:f.level,scale:f.scale,stars:f.stars??'',gold:f.gold,stones:f.stones,drops:structuredClone(f.drops)};dirty=false;picker=null}
 const lineup=()=>draft.enemies||floor().enemies.map(e=>({avatar:e.avatar,position:e.position}));
 const headOf=a=>monster(a)?.head||floor().enemies.find(e=>e.avatar===a)?.head;
 function editor(){
  const f=floor(),list=lineup();
  const slots=[1,2,3,4,5,6].map(p=>{const e=list.find(x=>x.position===p);return e?`<button type="button" class="ct-slot" data-unpick="${p}" title="Bỏ quái">${icon(headOf(e.avatar),'item-icon large')}<small>${escape(monster(e.avatar)?.name||f.enemies.find(x=>x.avatar===e.avatar)?.name||e.avatar)}</small><small class="muted">Vị trí ${p}</small></button>`:`<button type="button" class="ct-slot empty" data-pick-slot="${p}"><small>+ Vị trí ${p}</small></button>`}).join('');
  const drops=`<div class="beast-chips">${draft.drops.map((r,i)=>{const it=info(r.itemId);return `<span class="beast-chip"><button type="button" class="ghost mini swap" data-swap="${i}">${icon(it.icon)}</button><span class="grow">${escape(it.name)}</span><input type="number" min="1" value="${r.quantity}" data-drop="${i}"><button type="button" class="ghost mini" data-remove-drop="${i}">×</button></span>`}).join('')}${draft.drops.length<8?'<button type="button" class="ghost mini" data-add-drop="1">+ Thêm</button>':''}</div>`;
  const n=(k,label,extra='')=>`<label class="ev-num">${label}<input type="number" min="0" step="1" value="${draft[k]}" data-field="${k}" ${extra}></label>`;
  return `<h2>Tầng ${f.floor} ${f.added?'<span class="rw-badge">Tầng thêm mới</span>':''}${f.edited?'<span class="rw-badge">Đã sửa</span>':''}</h2>
   <p class="muted">Cấp gốc ${num(f.baseLevel)} · sức mạnh tầng ${num(f.power)}. Đổi cấp thì chỉ số quái nhân theo đường cong lên cấp của tướng (so với cấp gốc); Sức mạnh % nhân thêm. Cấp không giới hạn 1000.</p>
   <h3>Đội quái ${draft.enemies?'<small class="muted">(tùy chỉnh)</small>':'<small class="muted">(gốc)</small>'}</h3><div class="ct-slots">${slots}</div>
   <div class="row"><button type="button" class="ghost mini" data-original="1">Dùng lại đội gốc</button></div>
   <h3>Cấp & sức mạnh</h3><div class="row gb-row">${n('level','Cấp quái','min="1"')}${n('scale','Sức mạnh %','min="10"')}<label class="ev-num">Sao quái (khi đổi đội)<input type="number" min="1" max="15" value="${draft.stars}" placeholder="Như gốc" data-field="stars"></label></div>
   <h3>Thưởng qua tầng</h3><div class="row gb-row">${n('gold','Beli')}${n('stones','Đá đột phá')}</div><span class="muted">Vật phẩm rơi</span>${drops}`;
 }
 function render(){
  if(!data||root.hidden)return;const ed=root.querySelector('.ev-edit')?.scrollTop||0;
  const list=data.floors.map(f=>`<button type="button" class="ev-pick tw-floor ${f.floor===selected?'on':''}" data-floor="${f.floor}"><b>Tầng ${f.floor}${f.added?' ★':''}${f.edited?' ✎':''}</b><small>Cấp ${num(f.level)} · ${num(f.power)}</small><span class="tw-heads">${f.enemies.slice(0,6).map(e=>icon(e.head)).join('')}</span></button>`).join('');
  const text=fold(pickFilter.trim()),matches=picker?.kind==='monster'?data.monsters.filter(m=>!text||fold(m.name+' '+(factionLabel[m.faction]||'')).includes(text)).slice(0,80):picker?.kind==='item'?pool().filter(i=>!text||fold(i.name).includes(text)||fold(i.id).includes(text)).slice(0,40):[];
  root.innerHTML=`<section class="card ev-admin rw-admin"><nav class="ev-list-admin gb-nav">
    <div class="row gb-tools"><input id="tw-jump" type="number" min="1" max="${data.total}" placeholder="Đến tầng…" aria-label="Đến tầng"><button type="button" class="ghost" id="tw-go">Đi</button></div>
    <div class="row gb-tools"><button type="button" id="tw-add">+ Thêm tầng</button><button type="button" class="ghost" id="tw-remove" ${data.added?'':'disabled'}>Xoá tầng cuối</button></div>
    <p class="muted">${num(data.total)} tầng (gốc ${num(data.defaultCount)}) · ${data.edited.length} tầng đã sửa</p>
    ${data.edited.length?`<div class="tw-edited">${data.edited.slice(0,40).map(f=>`<button type="button" class="ghost mini" data-floor="${f}">${f}</button>`).join('')}</div>`:''}
    <div class="row gb-tools"><button type="button" class="ghost mini" data-page="-1" ${data.page?'':'disabled'}>‹ Trước</button><span class="muted">Trang ${data.page+1}/${data.pages}</span><button type="button" class="ghost mini" data-page="1" ${data.page<data.pages-1?'':'disabled'}>Sau ›</button></div>${list}</nav>
   <div class="ev-edit">${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}${editor()}
    <div class="row ev-actions rw-actions"><button type="button" id="tw-save">Lưu tầng ${selected}</button><button type="button" class="ghost" id="tw-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="ghost" id="tw-clear" ${floor().edited?'':'disabled'}>Tầng này về gốc</button><button type="button" class="danger" id="tw-reset">Về mặc định (cả tháp)</button></div></div></section>
   ${picker?`<div class="rw-picker-shade" data-close-picker="1"><div class="beast-picker rw-picker" role="dialog"><div class="row"><input id="tw-search" type="search" placeholder="${picker.kind==='monster'?'Tìm quái theo tên hoặc hệ':'Tìm vàng, kim cương hoặc vật phẩm'}" value="${escape(pickFilter)}" autocomplete="off"><button type="button" class="ghost" data-close-picker="1">Đóng</button></div><div class="beast-matches">${matches.map(m=>picker.kind==='monster'?`<button type="button" data-pick-monster="${m.avatar}">${icon(m.head,'item-icon large')}<span class="grow">${escape(m.name)}</span><small class="muted">${escape(factionLabel[m.faction]||m.faction)} · bậc ${m.rank}</small></button>`:`<button type="button" data-pick-item="${escape(m.id)}">${icon(m.icon,'item-icon large')}<span class="grow">${escape(m.name)}</span><small class="muted">${escape(m.id)}</small></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}</div></div></div>`:''}`;
  const e=root.querySelector('.ev-edit');if(e)e.scrollTop=ed;if(picker){const s=$('#tw-search');s.focus();s.setSelectionRange(s.value.length,s.value.length)}
 }
 const mark=()=>{dirty=true;const b=$('#tw-undo');if(b)b.disabled=false};
 root.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='tw-search'){pickFilter=t.value;render();return}
  if(t.dataset.field){draft[t.dataset.field]=t.value===''?'':Number(t.value);mark();return}
  if(t.dataset.drop){draft.drops[t.dataset.drop].quantity=Number(t.value);mark()}
 });
 root.addEventListener('keydown',e=>{if(e.target.id==='tw-jump'&&e.key==='Enter')$('#tw-go').click()});
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button,[data-close-picker]');if(!t)return;
  if(t.dataset.closePicker&&(t.tagName==='BUTTON'||e.target===t)){picker=null;render();return}
  if(t.tagName!=='BUTTON')return;
  try{
   const leave=()=>!dirty||confirm('Bỏ các thay đổi chưa lưu?');
   if(t.dataset.floor){if(!leave())return;await go(Number(t.dataset.floor));root.querySelector('.ev-edit').scrollTop=0;return}
   if(t.dataset.page){if(!leave())return;await fetchPage(data.page+Number(t.dataset.page));selected=data.floors[0].floor;load();render();return}
   if(t.id==='tw-go'){const n=Number($('#tw-jump').value);if(n&&leave())await go(n);return}
   if(t.dataset.unpick){draft.enemies=lineup().filter(x=>x.position!==Number(t.dataset.unpick));if(!draft.enemies.length){draft.enemies=null;toast('Tầng cần ít nhất 1 quái — đã dùng lại đội gốc.')}mark();render();return}
   if(t.dataset.pickSlot){picker={kind:'monster',slot:Number(t.dataset.pickSlot)};pickFilter='';render();return}
   if(t.dataset.pickMonster){draft.enemies=[...lineup().filter(x=>x.position!==picker.slot),{avatar:t.dataset.pickMonster,position:picker.slot}].sort((a,b)=>a.position-b.position);picker=null;mark();render();return}
   if(t.dataset.original){draft.enemies=null;mark();render();return}
   if(t.dataset.addDrop){picker={kind:'item',mode:'add'};pickFilter='';render();return}
   if(t.dataset.swap!==undefined){picker={kind:'item',mode:'swap',index:Number(t.dataset.swap)};pickFilter='';render();return}
   if(t.dataset.pickItem){if(picker.mode==='add')draft.drops.push({itemId:t.dataset.pickItem,quantity:1});else draft.drops[picker.index].itemId=t.dataset.pickItem;picker=null;mark();render();return}
   if(t.dataset.removeDrop!==undefined){draft.drops.splice(Number(t.dataset.removeDrop),1);mark();render();return}
   if(t.id==='tw-undo'){load();render();return}
   const send=async body=>{data=await api('/api/admin/tower',{...body,page:data.page})};
   if(t.id==='tw-save'){const f=floor(),body={};if(draft.enemies)body.enemies=draft.enemies;if(draft.level!==f.baseLevel)body.level=draft.level;if(draft.scale!==100)body.scale=draft.scale;if(draft.stars!=='')body.stars=draft.stars;body.gold=draft.gold;body.stones=draft.stones;body.drops=draft.drops;
    await send({op:'save',floor:selected,data:body});load();render();toast(`Đã lưu tầng ${selected}.`);return}
   if(t.id==='tw-clear'){await send({op:'clear',floor:selected});load();render();toast(`Tầng ${selected} đã về gốc.`);return}
   if(t.id==='tw-add'){if(!leave())return;await send({op:'add'});await go(data.total);toast(`Đã thêm tầng ${data.total} (chép tầng trước, cấp +1, sức mạnh / thưởng +2%).`);return}
   if(t.id==='tw-remove'){if(!confirm(`Xoá tầng ${data.total}?`))return;await send({op:'remove'});await go(Math.min(selected,data.total));toast('Đã xoá tầng cuối.');return}
   if(t.id==='tw-reset'){if(!confirm('Trả cả tháp về 2.301 tầng gốc? Mọi tầng đã sửa / thêm sẽ mất.'))return;await send({op:'reset'});await go(Math.min(selected,data.total));toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
 window.AdminTower={async show(){root.hidden=false;if(!data)await fetchPage(0);else await fetchPage(data.page);if(!data.floors.some(f=>f.floor===selected))selected=data.floors[0].floor;load();render()},hide(){root.hidden=true}};
})();
