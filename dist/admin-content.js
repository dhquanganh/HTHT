/* Tab "Phụ bản" và "Quái" của trang quản trị (server/content.mjs, server/content-admin.mjs).
   Phụ bản: đội hình quái và sức mạnh từng ải của Luyện tập / Mê cung / Đảo Bánh, thêm ải cho Mê cung và Đảo Bánh.
   Quái: chỉnh % Máu / Công / Thủ / Tốc độ của từng quái, tắt quái khỏi đội hình ngẫu nhiên. Lưu xong áp ngay vào game. */
(()=>{
 'use strict';
 const {api,toast,escape,num,fold,icon}=window.AdminApp,$=s=>document.querySelector(s);
 const stagesRoot=$('#stages-tab'),monstersRoot=$('#monsters-tab');
 let data=null,mode='brave',faction='abyss',draft=null,dirty=false,editing=null,pickFilter='',mDraft=null,mDirty=false,mFilter='',mFaction='';
 const monster=a=>data.monsters.find(m=>m.avatar===String(a));
 const head=(a,cls='')=>{const m=monster(a);return m?`<span class="ct-head ${cls}" title="${escape(m.name)} · ${escape(m.factionLabel)}">${icon(m.head)}</span>`:''};
 async function load(){data=await api('/api/admin/content');resetStages();resetMonsters()}
 function resetStages(){const m=data.modes[mode];draft={count:m.count,stages:Object.fromEntries(m.stages.filter(s=>s.override).map(s=>[s.key,structuredClone(s.override)]))};dirty=false;editing=null}
 function resetMonsters(){mDraft=Object.fromEntries(data.monsters.map(m=>[m.avatar,{hp:m.mod?.hp??100,atk:m.mod?.atk??100,def:m.mod?.def??100,spd:m.mod?.spd??100,disabled:!!m.mod?.disabled,level:m.mod?.level??''}]));mDirty=false}
 // ---------------- Phụ bản
 function stageRow(s){
  const o=draft.stages[s.key]||{},custom=o.enemies?.length,lineup=custom?o.enemies:s.lineup;
  return `<div class="beast-rank ev-row-edit ct-stage ${custom||o.scale?'custom':''}"><b class="rw-label">${escape(s.label)}</b><div class="ct-lineup ${custom?'':'default'}">${lineup.map(a=>head(a)).join('')}<small class="muted">${custom?'Đội hình tùy chỉnh':'Mặc định'}</small></div>
   <button type="button" class="ghost mini" data-edit="${s.key}">Sửa đội hình</button>${custom?`<button type="button" class="ghost mini" data-clear="${s.key}">Về mặc định</button>`:''}
   <label class="ev-num">Sức mạnh %<input type="number" min="10" max="1000" step="5" value="${o.scale??100}" data-scale="${s.key}"></label><label class="ev-num">Cấp quái<input type="number" min="1" step="1" placeholder="Tự động" value="${o.level??''}" data-level="${s.key}"></label></div>`;
 }
 function stagesHtml(){
  const m=data.modes[mode],list=m.stages.filter(s=>mode!=='sealed'||s.key.startsWith(faction+'-')).filter(s=>Number(s.key.split('-').pop())<=draft.count);
  const nav=Object.entries(data.modes).map(([id,x])=>`<button type="button" class="ev-pick ${id===mode?'on':''}" data-mode="${id}"><b>${escape(x.title)}</b><small>${x.count} ải${x.stages.some(s=>s.override)?' · đã sửa':''}</small></button>`).join('');
  const facs=m.factions?`<div class="row ct-factions">${m.factions.map(f=>`<button type="button" class="ghost mini ${f.id===faction?'on':''}" data-faction="${f.id}">${escape(f.label)}</button>`).join('')}</div>`:'';
  const count=m.fixed?`<p class="muted">Số ải: ${m.count} (cố định)</p>`:`<label class="ev-num ct-count">Số ải${mode==='sealed'?' mỗi vùng':''}<input type="number" min="1" max="${mode==='sealed'?60:200}" value="${draft.count}" data-count="1"></label><small class="muted">Mặc định ${m.defaultCount}. Ải thêm mới dùng công thức đội hình / sức mạnh / thưởng mặc định; sửa thưởng ở tab Phần thưởng.</small>`;
  return `<section class="card ev-admin rw-admin"><nav class="ev-list-admin">${nav}</nav><div class="ev-edit">${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<h2>${escape(m.title)}</h2><p class="muted">${escape(m.note)} Sức mạnh % nhân lên chỉ số mặc định của ải (100 = giữ nguyên). Cấp quái: để trống thì quái theo cấp trung bình đội của người chơi; đặt cấp thì chỉ số tăng / giảm theo đường cong lên cấp của tướng (cấp ải ưu tiên hơn cấp đặt ở tab Quái).</p><div class="row">${count}</div>${facs}
   ${list.map(stageRow).join('')}
   <div class="row ev-actions rw-actions"><button type="button" id="ct-save">Lưu</button><button type="button" class="ghost" id="ct-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="ct-reset">Về mặc định</button></div></div></section>${editing?editorHtml():''}`;
 }
 function editorHtml(){
  const s=data.modes[mode].stages.find(x=>x.key===editing.key),text=fold(pickFilter.trim());
  const matches=data.monsters.filter(m=>!text||fold(m.name+' '+m.factionLabel).includes(text)).slice(0,80);
  return `<div class="rw-picker-shade" data-close-editor="1"><div class="beast-picker rw-picker ct-editor" role="dialog" aria-label="Sửa đội hình"><h3>${escape(s?.label||editing.key)} · đội hình (${editing.enemies.length}/6)</h3>
   <div class="ct-slots">${Array.from({length:6},(_,i)=>{const a=editing.enemies[i];return a?`<button type="button" class="ct-slot" data-unpick="${i}" title="Bỏ">${head(a)}<small>Vị trí ${i+1}</small></button>`:`<span class="ct-slot empty"><small>Vị trí ${i+1}</small></span>`}).join('')}</div>
   <div class="row"><input id="ct-search" type="search" placeholder="Tìm quái theo tên hoặc hệ" value="${escape(pickFilter)}" autocomplete="off"><button type="button" class="ghost" data-fill-default="1">Lấy đội mặc định</button></div>
   <div class="beast-matches ct-matches">${matches.map(m=>`<button type="button" data-pick-monster="${m.avatar}" ${editing.enemies.length>=6?'disabled':''}>${icon(m.head,'item-icon large')}<span class="grow">${escape(m.name)}</span><small class="muted">${escape(m.factionLabel)} · bậc ${m.rank}${m.mod?.disabled?' · đang tắt':''}</small></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}</div>
   <div class="row"><button type="button" data-apply-editor="1">Xong</button><button type="button" class="ghost" data-close-editor="1">Hủy</button></div></div></div>`;
 }
 function renderStages(){if(!data||stagesRoot.hidden)return;const sc=stagesRoot.querySelector('.ev-edit')?.scrollTop||0,ms=stagesRoot.querySelector('.ct-matches')?.scrollTop||0;stagesRoot.innerHTML=stagesHtml();const e=stagesRoot.querySelector('.ev-edit');if(e)e.scrollTop=sc;const mm=stagesRoot.querySelector('.ct-matches');if(mm)mm.scrollTop=ms}
 stagesRoot.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='ct-search'){pickFilter=t.value;const pos=t.selectionStart;renderStages();const s=$('#ct-search');s.focus();s.setSelectionRange(pos,pos);return}
  if(t.dataset.scale){const k=t.dataset.scale,v=Number(t.value);draft.stages[k]??={};if(v===100)delete draft.stages[k].scale;else draft.stages[k].scale=v;if(!Object.keys(draft.stages[k]).length)delete draft.stages[k];dirty=true;const b=$('#ct-undo');if(b)b.disabled=false;return}
  if(t.dataset.level){const k=t.dataset.level,v=t.value===''?null:Number(t.value);draft.stages[k]??={};if(v)draft.stages[k].level=v;else delete draft.stages[k].level;if(!Object.keys(draft.stages[k]).length)delete draft.stages[k];dirty=true;const b=$('#ct-undo');if(b)b.disabled=false;return}
  if(t.dataset.count){draft.count=Number(t.value)||1;dirty=true}
 });
 // Vẽ lại sau sự kiện (change cũng chạy khi rời ô lúc bấm nút khác; vẽ ngay sẽ xoá ô đang rời).
 stagesRoot.addEventListener('change',e=>{if(e.target.dataset.count)setTimeout(renderStages,0)});
 stagesRoot.addEventListener('click',async e=>{
  const t=e.target.closest('button,[data-close-editor]');if(!t)return;
  if(t.dataset.closeEditor&&(t.tagName==='BUTTON'||e.target===t)){editing=null;renderStages();return}
  if(t.tagName!=='BUTTON')return;
  try{
   if(t.dataset.mode){if(dirty&&!confirm('Bỏ các thay đổi chưa lưu?'))return;mode=t.dataset.mode;resetStages();renderStages();return}
   if(t.dataset.faction){faction=t.dataset.faction;renderStages();return}
   if(t.dataset.edit){const s=data.modes[mode].stages.find(x=>x.key===t.dataset.edit);editing={key:t.dataset.edit,enemies:[...(draft.stages[t.dataset.edit]?.enemies||s?.lineup||[])]};pickFilter='';renderStages();return}
   if(t.dataset.clear){const o=draft.stages[t.dataset.clear];if(o){delete o.enemies;if(!Object.keys(o).length)delete draft.stages[t.dataset.clear]}dirty=true;renderStages();return}
   if(t.dataset.pickMonster){if(editing.enemies.length<6)editing.enemies.push(t.dataset.pickMonster);renderStages();return}
   if(t.dataset.unpick){editing.enemies.splice(Number(t.dataset.unpick),1);renderStages();return}
   if(t.dataset.fillDefault){editing.enemies=[...(data.modes[mode].stages.find(x=>x.key===editing.key)?.lineup||[])];renderStages();return}
   if(t.dataset.applyEditor){if(!editing.enemies.length)return toast('Cần ít nhất 1 quái.');draft.stages[editing.key]={...(draft.stages[editing.key]||{}),enemies:editing.enemies};editing=null;dirty=true;renderStages();return}
   if(t.id==='ct-undo'){resetStages();renderStages();return}
   if(t.id==='ct-save'){data=await api('/api/admin/content/stages/'+mode,{count:draft.count,stages:draft.stages});resetStages();resetMonsters();renderStages();toast('Đã lưu. Game dùng đội hình / số ải mới ngay (ải đang đánh dở giữ đội cũ tới khi qua ải).');return}
   if(t.id==='ct-reset'){if(!confirm('Trả toàn bộ ải của phụ bản này về mặc định (kể cả số ải)?'))return;data=await api('/api/admin/content/stages/'+mode,{reset:true});resetStages();renderStages();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
 // ---------------- Quái
 function monstersHtml(){
  const text=fold(mFilter.trim()),facs=[...new Set(data.monsters.map(m=>m.faction))];
  const list=data.monsters.filter(m=>(!mFaction||m.faction===mFaction)&&(!text||fold(m.name).includes(text)));
  const edited=Object.values(mDraft).filter(r=>r.disabled||r.level||r.hp!==100||r.atk!==100||r.def!==100||r.spd!==100).length;
  const field=(a,k,label)=>`<label class="ev-num">${label}<input type="number" min="10" max="1000" step="5" value="${mDraft[a][k]}" data-mon="${a}" data-key="${k}"></label>`;
  return `<section class="card ct-monsters">${mDirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<h2>Quái phụ bản <small class="muted">${data.monsters.length} quái · ${edited} đã chỉnh</small></h2>
   <p class="muted">Áp cho quái của Luyện tập, Mê cung và Đảo Bánh. % nhân lên chỉ số ải (100 = giữ nguyên). Cấp: để trống = theo cấp trung bình đội người chơi; đặt cấp thì chỉ số theo đường cong lên cấp của tướng. Quái bị tắt không được chọn vào đội hình ngẫu nhiên (đội hình tùy chỉnh ở tab Phụ bản vẫn dùng được).</p>
   <div class="row"><input id="ct-mfilter" type="search" placeholder="Tìm quái" value="${escape(mFilter)}"><select id="ct-mfaction"><option value="">Mọi hệ</option>${facs.map(f=>`<option value="${f}" ${f===mFaction?'selected':''}>${escape(data.monsters.find(m=>m.faction===f).factionLabel)}</option>`).join('')}</select></div>
   <div class="ct-mlist">${list.map(m=>`<div class="beast-rank ev-row-edit ct-mrow ${mDraft[m.avatar].disabled?'off':''}">${icon(m.head,'item-icon large')}<span class="rw-label"><b>${escape(m.name)}</b><small class="muted">${escape(m.factionLabel)} · bậc ${m.rank}</small></span>${field(m.avatar,'hp','Máu %')}${field(m.avatar,'atk','Công %')}${field(m.avatar,'def','Thủ %')}${field(m.avatar,'spd','Tốc %')}<label class="ev-num">Cấp<input type="number" min="1" step="1" placeholder="Tự động" value="${mDraft[m.avatar].level}" data-mon="${m.avatar}" data-key="level"></label><label class="ct-off"><input type="checkbox" data-off="${m.avatar}" ${mDraft[m.avatar].disabled?'checked':''}> Tắt</label></div>`).join('')}</div>
   <div class="row ev-actions rw-actions"><button type="button" id="ct-msave">Lưu</button><button type="button" class="ghost" id="ct-mundo" ${mDirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="ct-mreset">Về mặc định</button></div></section>`;
 }
 function renderMonsters(){if(!data||monstersRoot.hidden)return;const sc=monstersRoot.querySelector('.ct-mlist')?.scrollTop||0;monstersRoot.innerHTML=monstersHtml();const l=monstersRoot.querySelector('.ct-mlist');if(l)l.scrollTop=sc}
 monstersRoot.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='ct-mfilter'){mFilter=t.value;const pos=t.selectionStart;renderMonsters();const f=$('#ct-mfilter');f.focus();f.setSelectionRange(pos,pos);return}
  if(t.dataset.mon){mDraft[t.dataset.mon][t.dataset.key]=t.dataset.key==='level'?(t.value===''?'':Number(t.value)):Number(t.value)||100;mDirty=true;const b=$('#ct-mundo');if(b)b.disabled=false}
 });
 monstersRoot.addEventListener('change',e=>{const t=e.target;if(t.id==='ct-mfaction'){mFaction=t.value;renderMonsters()}if(t.dataset.off){mDraft[t.dataset.off].disabled=t.checked;mDirty=true;renderMonsters()}});
 monstersRoot.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  try{
   if(t.id==='ct-mundo'){resetMonsters();renderMonsters();return}
   if(t.id==='ct-msave'){data=await api('/api/admin/content/monsters',{monsters:mDraft});resetMonsters();resetStages();renderMonsters();toast('Đã lưu chỉ số quái.');return}
   if(t.id==='ct-mreset'){if(!confirm('Trả mọi quái về mặc định?'))return;data=await api('/api/admin/content/monsters',{reset:true});resetMonsters();renderMonsters();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
 window.AdminStages={async show(){stagesRoot.hidden=false;await load();renderStages()},hide(){stagesRoot.hidden=true}};
 window.AdminMonsters={async show(){monstersRoot.hidden=false;await load();renderMonsters()},hide(){monstersRoot.hidden=true}};
})();
