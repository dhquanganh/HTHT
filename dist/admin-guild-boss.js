/* Tab "Boss hạm đội" của trang quản trị (server/guild-config.mjs): sửa đội quái và thưởng từng ải boss, thêm ải boss mới.
   Lưu xong áp ngay; ải đang đánh dở của một hạm đội giữ máu đã trừ, đội quái mới có hiệu lực đầy đủ từ lần mở ải kế. */
(()=>{
 'use strict';
 const {api,toast,escape,num,fold,icon}=window.AdminApp,$=s=>document.querySelector(s),root=$('#guildboss-tab');
 let data=null,selected=1,draft=null,dirty=false,picker=null,pickFilter='';
 const factionLabel={abyss:'Vực thẳm',shadow:'Hư ảnh',fortress:'Pháo đài',forest:'Rừng rậm',dark:'Bóng tối',light:'Ánh sáng'};
 const ranks=[['1','Top 1'],['2','Top 2'],['3','Top 3'],['10','Top 4–10'],['15','Top 11–15'],['20','Top 16–20'],['30','Top 21–30']];
 const monster=a=>data.monsters.find(m=>m.avatar===String(a));
 const stage=()=>data.stages[selected-1];
 function load(){const {power,hp,...s}=structuredClone(stage());draft=s;dirty=false;picker=null}
 const nInput=(path,label,min=0,step=1)=>{const v=path.split('.').reduce((o,k)=>o?.[k],draft);return `<label class="ev-num">${label}<input type="number" min="${min}" step="${step}" value="${v}" data-path="${path}"></label>`};
 function monsterRow(m,i){
  const pct=k=>`<label class="ev-num">${{attack:'Công',maxHp:'Máu',defense:'Thủ',speed:'Tốc'}[k]} ×%<input type="number" min="1" step="1" value="${Math.round(m.scale[k]*100)}" data-scale="${i}.${k}"></label>`;
  return `<div class="beast-rank ev-row-edit gb-mon"><button type="button" class="ghost mini swap" data-swap="${i}" title="Đổi quái">${icon(m.head||monster(m.avatar)?.head,'item-icon large')}</button>
   <span class="rw-label"><b>${escape(m.name)}</b><small class="muted">${escape(factionLabel[m.faction]||m.faction)} · ${escape(m.class||'')}</small></span>
   <label class="ev-num">Vị trí<select data-pos="${i}">${[1,2,3,4,5,6].map(p=>`<option ${p===m.position?'selected':''}>${p}</option>`).join('')}</select></label>
   ${nInput(`monsters.${i}.level`,'Cấp',1)}${nInput(`monsters.${i}.skillLevel`,'Cấp kỹ năng',1)}${nInput(`monsters.${i}.stars`,'Sao',1)}
   ${pct('maxHp')}${pct('attack')}${pct('defense')}${pct('speed')}
   ${draft.monsters.length>1?`<button type="button" class="ghost mini" data-remove="${i}" aria-label="Xoá quái">×</button>`:''}</div>`;
 }
 function editor(){
  const s=stage();
  return `<h2>Ải ${selected} ${selected>data.defaultCount?'<span class="rw-badge">Ải thêm mới</span>':''}</h2>
   <p class="muted">Sức mạnh hiện tại ${num(s.power)} · Tổng máu boss ${num(s.hp)}. Chỉ số quái = đường tăng trưởng tướng ở cấp / sao của quái × hệ số (100% = như bảng gốc); máu nhân thêm 10 vì là boss chung cả hạm đội. Cấp không giới hạn 1000.</p>
   <h3>Đội quái (${draft.monsters.length}/6)</h3>${draft.monsters.map(monsterRow).join('')}
   ${draft.monsters.length<6?'<button type="button" class="ghost mini" data-add-monster="1">+ Thêm quái</button>':''}
   <h3>Thưởng mỗi lượt đánh</h3><div class="row gb-row">${nInput('guildExp','EXP hạm đội')}${nInput('gold','Beli')}${nInput('guildCoin','Huy hiệu hạm đội')}</div>
   <h3>Thưởng người hạ boss</h3><div class="row gb-row">${nInput('killGold','Beli')}${nInput('killCoin','Huy hiệu hạm đội')}</div>
   <h3>Thưởng xếp hạng sát thương (gửi thư khi hạ boss)</h3><div class="gb-ranks">${ranks.map(([k,l])=>`<div class="row gb-row"><b>${l}</b>${nInput(`final.${k}.gold`,'Beli')}${nInput(`final.${k}.coin`,'Huy hiệu')}</div>`).join('')}</div>`;
 }
 function render(){
  if(!data||root.hidden)return;const ed=root.querySelector('.ev-edit')?.scrollTop||0,nv=root.querySelector('.ev-list-admin')?.scrollTop||0;
  const nav=data.stages.map(s=>`<button type="button" class="ev-pick ${s.stage===selected?'on':''}" data-pick-stage="${s.stage}"><b>Ải ${s.stage}${s.stage>data.defaultCount?' ★':''}</b><small>${s.monsters.length} quái · cấp ${s.monsters.map(m=>m.level).reduce((a,b)=>Math.max(a,b),0)} · ${num(s.power)}</small></button>`).join('');
  const text=fold(pickFilter.trim()),matches=picker?data.monsters.filter(m=>!text||fold(m.name+' '+(factionLabel[m.faction]||'')).includes(text)).slice(0,80):[];
  root.innerHTML=`<section class="card ev-admin rw-admin"><nav class="ev-list-admin gb-nav"><div class="row gb-tools"><button type="button" id="gb-add">+ Thêm boss mới</button><button type="button" class="ghost" id="gb-remove" ${data.stages.length>data.defaultCount?'':'disabled'}>Xoá ải cuối</button></div><p class="muted">${data.stages.length} ải (gốc ${data.defaultCount})${data.edited?' · đã sửa':''}</p>${nav}</nav>
   <div class="ev-edit">${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}${editor()}<div class="row ev-actions rw-actions"><button type="button" id="gb-save">Lưu ải ${selected}</button><button type="button" class="ghost" id="gb-undo" ${dirty?'':'disabled'}>Hoàn tác</button><button type="button" class="danger" id="gb-reset">Về mặc định (cả 60 ải gốc)</button></div></div></section>
   ${picker?`<div class="rw-picker-shade" data-close-picker="1"><div class="beast-picker rw-picker" role="dialog" aria-label="Chọn quái"><div class="row"><input id="gb-search" type="search" placeholder="Tìm quái theo tên hoặc hệ" value="${escape(pickFilter)}" autocomplete="off"><button type="button" class="ghost" data-close-picker="1">Đóng</button></div><div class="beast-matches">${matches.map(m=>`<button type="button" data-pick="${m.avatar}">${icon(m.head,'item-icon large')}<span class="grow">${escape(m.name)}</span><small class="muted">${escape(factionLabel[m.faction]||m.faction)} · bậc ${m.rank}</small></button>`).join('')||'<p class="muted">Không tìm thấy.</p>'}</div></div></div>`:''}`;
  const e=root.querySelector('.ev-edit');if(e)e.scrollTop=ed;const n=root.querySelector('.ev-list-admin');if(n)n.scrollTop=nv;
  if(picker){const s=$('#gb-search');s.focus();s.setSelectionRange(s.value.length,s.value.length)}
 }
 const mark=()=>{dirty=true;const b=$('#gb-undo');if(b)b.disabled=false};
 function setPath(path,value){const keys=path.split('.'),last=keys.pop(),o=keys.reduce((x,k)=>x[k],draft);o[last]=value}
 root.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='gb-search'){pickFilter=t.value;render();return}
  if(t.dataset.path){setPath(t.dataset.path,Number(t.value));mark();return}
  if(t.dataset.scale){const [i,k]=t.dataset.scale.split('.');draft.monsters[i].scale[k]=Number(t.value)/100;mark()}
 });
 root.addEventListener('change',e=>{const t=e.target;if(t.dataset.pos){draft.monsters[t.dataset.pos].position=Number(t.value);mark()}});
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button,[data-close-picker]');if(!t)return;
  if(t.dataset.closePicker&&(t.tagName==='BUTTON'||e.target===t)){picker=null;render();return}
  if(t.tagName!=='BUTTON')return;
  try{
   if(t.dataset.pickStage){if(dirty&&!confirm('Bỏ các thay đổi chưa lưu?'))return;selected=Number(t.dataset.pickStage);load();render();root.querySelector('.ev-edit').scrollTop=0;return}
   if(t.dataset.swap!==undefined){picker={mode:'swap',index:Number(t.dataset.swap)};pickFilter='';render();return}
   if(t.dataset.addMonster){picker={mode:'add'};pickFilter='';render();return}
   if(t.dataset.pick){const m=monster(t.dataset.pick),info={avatar:m.avatar,name:m.name,faction:m.faction,head:m.head,monsterId:'hero-'+m.avatar,heroId:m.avatar};
    if(picker.mode==='add'){const used=new Set(draft.monsters.map(x=>x.position)),pos=[1,2,3,4,5,6].find(p=>!used.has(p)),ref=draft.monsters.at(-1);draft.monsters.push({...info,class:'',level:ref?.level||1,skillLevel:ref?.skillLevel||1,stars:ref?.stars||1,position:pos,scale:{attack:1,maxHp:1,defense:1,speed:1}})}
    else Object.assign(draft.monsters[picker.index],info);
    picker=null;dirty=true;render();return}
   if(t.dataset.remove!==undefined){draft.monsters.splice(Number(t.dataset.remove),1);dirty=true;render();return}
   if(t.id==='gb-undo'){load();render();return}
   if(t.id==='gb-save'){data=await api('/api/admin/guild-boss',{op:'save',stage:selected,data:draft});load();render();toast(`Đã lưu ải ${selected}.`);return}
   if(t.id==='gb-add'){if(dirty&&!confirm('Bỏ các thay đổi chưa lưu?'))return;data=await api('/api/admin/guild-boss',{op:'add'});selected=data.stages.length;load();render();toast(`Đã thêm ải boss ${selected} (chép ải trước, cấp và thưởng +10%).`);return}
   if(t.id==='gb-remove'){if(!confirm(`Xoá ải boss ${data.stages.length}?`))return;data=await api('/api/admin/guild-boss',{op:'remove'});selected=Math.min(selected,data.stages.length);load();render();toast('Đã xoá ải cuối.');return}
   if(t.id==='gb-reset'){if(!confirm('Trả toàn bộ boss hạm đội về 60 ải gốc? Ải đã thêm sẽ bị xoá.'))return;data=await api('/api/admin/guild-boss',{op:'reset'});selected=Math.min(selected,data.stages.length);load();render();toast('Đã trả về mặc định.')}
  }catch(error){toast(error.message)}
 });
 window.AdminGuildBoss={async show(){root.hidden=false;data=await api('/api/admin/guild-boss');selected=Math.min(selected,data.stages.length);load();render()},hide(){root.hidden=true}};
})();
