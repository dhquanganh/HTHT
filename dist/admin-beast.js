/* Tab Chiến Thần Thú của trang quản trị. Mọi thay đổi lưu thẳng vào MongoDB và có hiệu lực ngay trong game. */
(()=>{
 'use strict';
 const {api,toast,escape,num,fold,icon,catalogItems}=window.AdminApp,$=s=>document.querySelector(s),root=$('#beast-tab');
 const when=value=>value?new Date(value).toLocaleString('vi-VN'):'—';
 const localTime=value=>{const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
 let data=null,boss=null,tab='rewards',draft=null,dirty=false,picking=null,season=0,ranking=null;
 const current=()=>data.bosses.find(b=>b.key===boss);
 const pool=()=>[...data.rewardItems,...catalogItems()];
 const copy=rewards=>rewards.map(rank=>rank.map(r=>({...r})));
 function choose(key){boss=key;draft=copy(current().rewards);dirty=false;picking=null;ranking=null;season=data.season.id;render();if(tab==='ranking')loadRanking()}
 function apply(next){data=next;if(!boss)boss=data.bosses[0].key;draft=dirty?draft:copy(current().rewards);season=season||data.season.id;render()}
 async function loadRanking(){ranking=await api(`/api/admin/beast/ranking/${boss}?season=${season}`);render()}
 const seasonForm=()=>`<section class="card beast-season"><div class="row spread"><div><h2>Mùa ${data.season.id}</h2><p class="muted">Kết thúc ${when(data.season.endsAt)}</p></div><form id="beast-end" class="row"><label>Hạn mùa<input id="beast-ends" type="datetime-local" value="${localTime(data.season.endsAt)}" required></label><button type="submit">Lưu hạn</button><button type="button" class="danger" id="beast-finish">Kết thúc mùa ngay</button></form></div>
  <form id="beast-config" class="beast-config">${[['seasonDays','Số ngày mỗi mùa'],['turns','Lượt mỗi mùa'],['cooldownSeconds','Giây chờ giữa hai trận'],['rounds','Số vòng tối đa'],['minLevel','Cấp tướng tối thiểu']].map(([k,l])=>`<label>${l}<input name="${k}" type="number" min="0" step="1" value="${data.config[k]}" required></label>`).join('')}<button type="submit">Lưu cấu hình</button></form></section>`;
 const bossTabs=()=>`<div class="beast-bosses" role="tablist" aria-label="Chọn boss">${data.bosses.map(b=>`<button type="button" role="tab" aria-selected="${b.key===boss}" class="beast-boss ${b.key===boss?'on':''}" data-boss="${b.key}">${icon(b.head,'beast-head')}<span><b>${escape(b.name)}</b><small>${escape(b.classLabel)}</small></span></button>`).join('')}</div>`;
 const pages=()=>`<div class="beast-pages" role="tablist">${[['rewards','Phần thưởng'],['ranking','Bảng xếp hạng'],['stats','Chỉ số boss']].map(([k,l])=>`<button type="button" role="tab" aria-selected="${k===tab}" class="ghost ${k===tab?'on':''}" data-page="${k}">${l}</button>`).join('')}</div>`;
 function rewardRow(rank,i){
  const label=data.brackets[i].label;
  return `<div class="beast-rank"><strong>${escape(label==='100+'?label:'Hạng '+label)}</strong><div class="beast-chips">${rank.map((r,n)=>`<span class="beast-chip" title="${escape(r.name)}">${icon(r.icon)}<span class="grow">${escape(r.name)}</span><input type="number" min="1" step="1" value="${r.quantity}" data-rank="${i}" data-index="${n}" aria-label="Số lượng ${escape(r.name)}"><button type="button" class="ghost mini" data-remove="${i}:${n}" aria-label="Xóa ${escape(r.name)}">×</button></span>`).join('')}<button type="button" class="ghost mini add" data-add="${i}">+ Thêm</button></div>${picking===i?`<div class="beast-picker"><input id="beast-search" type="search" placeholder="Tìm vàng, kim cương hoặc vật phẩm" aria-label="Tìm vật phẩm" autocomplete="off"><div id="beast-matches" class="beast-matches"></div></div>`:''}</div>`;
 }
 const rewards=()=>`${dirty?'<p class="beast-dirty">Có thay đổi chưa lưu.</p>':''}<div class="beast-ranks">${draft.map(rewardRow).join('')}</div><div class="row"><button type="button" id="beast-save">Lưu cho ${escape(current().name)}</button><button type="button" class="ghost" id="beast-save-all">Áp dụng cho cả 5 boss</button><button type="button" class="ghost" id="beast-undo" ${dirty?'':'disabled'}>Hoàn tác</button></div>`;
 const bracketOf=rank=>data.brackets.find(b=>rank>=b.from&&(b.to===null||rank<=b.to));
 const rankPage=()=>{
  if(!ranking)return'<p class="muted">Đang tải…</p>';
  return `<div class="row spread"><p class="muted">${num(ranking.total)} người chơi</p><label class="row">Mùa<select id="beast-season-select">${data.seasons.map(s=>`<option value="${s.id}" ${s.id===ranking.season?'selected':''}>Mùa ${s.id}${s.status==='active'?' (đang chạy)':''}</option>`).join('')}</select></label></div><div class="table"><table><thead><tr><th>Hạng</th><th>Thuyền trưởng</th><th>Cấp</th><th>Tổng sát thương</th><th>Mốc thưởng</th></tr></thead><tbody>${ranking.top.map(r=>`<tr class="plain"><td>${r.rank}</td><td>${escape(r.name)}</td><td>${r.level}</td><td>${num(r.damage)}</td><td>${escape(bracketOf(r.rank)?.label||'')}</td></tr>`).join('')||'<tr class="plain"><td colspan="5" class="muted">Chưa có ai khiêu chiến boss này.</td></tr>'}</tbody></table></div>`;
 };
 const stats=()=>{const b=current();return `<form id="beast-stats" class="beast-config">${[['level','Cấp'],['attack','Tấn công'],['defense','Giáp'],['maxHp','Máu'],['speed','Tốc độ']].map(([k,l])=>`<label>${l}<input name="${k}" type="number" min="1" step="1" value="${b.stats[k]}" required><small class="muted">Asset: ${num(b.defaults[k])}</small></label>`).join('')}<button type="submit">Lưu chỉ số</button><button type="button" class="ghost" id="beast-reset">Về số gốc</button></form><h3>Kỹ năng mùa này</h3><div class="list">${b.skills.map(s=>`<div>${icon(s.icon)}<span class="grow"><b>${escape(s.name)}</b><br><small class="muted">${escape(s.description)}</small></span></div>`).join('')}</div>`};
 function render(){
  if(!data||root.hidden)return;
  root.innerHTML=`${seasonForm()}<section class="card">${bossTabs()}${pages()}<div id="beast-page">${tab==='rewards'?rewards():tab==='ranking'?rankPage():stats()}</div></section>`;
  if(picking!==null){showMatches();$('#beast-search').focus()}
 }
 function showMatches(){
  const text=fold(($('#beast-search')?.value||'').trim()),taken=new Set(draft[picking].map(r=>r.itemId)),matches=pool().filter(i=>!taken.has(i.id)&&(!text||fold(i.name).includes(text)||fold(i.id).includes(text))).slice(0,30);
  $('#beast-matches').innerHTML=matches.map(i=>`<button type="button" data-pick="${escape(i.id)}">${icon(i.icon,'item-icon large')}<span class="grow">${escape(i.name)}</span></button>`).join('')||'<p class="muted">Không tìm thấy.</p>';
 }
 window.AdminBeast={async show(){root.hidden=false;apply(await api('/api/admin/beast'));if(tab==='ranking')await loadRanking()},hide(){root.hidden=true}};
 root.addEventListener('input',e=>{
  if(e.target.id==='beast-search')showMatches();
  if(e.target.dataset.rank){draft[e.target.dataset.rank][e.target.dataset.index].quantity=Number(e.target.value);if(!dirty){dirty=true;const box=$('#beast-undo');if(box)box.disabled=false}}
 });
 root.addEventListener('change',async e=>{if(e.target.id==='beast-season-select'){season=Number(e.target.value);try{await loadRanking()}catch(error){toast(error.message)}}});
 root.addEventListener('submit',async e=>{
  e.preventDefault();const fields=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,Number(v)]));
  try{
   if(e.target.id==='beast-config'){apply(await api('/api/admin/beast/config',fields));toast('Đã lưu cấu hình.')}
   if(e.target.id==='beast-stats'){apply(await api('/api/admin/beast/boss/'+boss,fields));toast('Đã lưu chỉ số. Trận mới dùng số này ngay.')}
   if(e.target.id==='beast-end'){apply(await api('/api/admin/beast/season',{endsAt:new Date($('#beast-ends').value).toISOString()}));toast('Đã đổi hạn mùa.')}
  }catch(error){toast(error.message)}
 });
 root.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  try{
   if(t.dataset.boss)return choose(t.dataset.boss);
   if(t.dataset.page){tab=t.dataset.page;render();if(tab==='ranking')await loadRanking();return}
   if(t.dataset.add!==undefined){picking=picking===Number(t.dataset.add)?null:Number(t.dataset.add);render();return}
   if(t.dataset.remove){const [rank,index]=t.dataset.remove.split(':').map(Number);draft[rank].splice(index,1);dirty=true;render();return}
   if(t.dataset.pick){const item=pool().find(i=>i.id===t.dataset.pick);draft[picking].push({itemId:item.id,name:item.name,icon:item.icon,quantity:1});dirty=true;picking=null;render();return}
   if(t.id==='beast-undo'){draft=copy(current().rewards);dirty=false;render();return}
   if(t.id==='beast-save'||t.id==='beast-save-all'){
    const all=t.id==='beast-save-all';if(all&&!confirm('Ghi đè phần thưởng của cả 5 boss bằng bảng này?'))return;
    const body={bosses:all?data.bosses.map(b=>b.key):[boss],ranks:draft.map(rank=>rank.map(({itemId,quantity})=>({itemId,quantity})))};dirty=false;
    try{apply(await api('/api/admin/beast/rewards',body));toast('Đã lưu. Người chơi thấy phần thưởng mới ngay.')}catch(error){dirty=true;throw error}
    return;
   }
   if(t.id==='beast-reset'){if(confirm('Trả chỉ số boss về số gốc trong asset?')){apply(await api('/api/admin/beast/boss/'+boss,{reset:true}));toast('Đã trả về số gốc.')}return}
   if(t.id==='beast-finish'){if(confirm(`Kết thúc mùa ${data.season.id} ngay? Toàn bộ 5 bảng sẽ được chốt, quà gửi cho người chơi và mùa mới bắt đầu. Không hoàn tác được.`)){apply(await api('/api/admin/beast/season',{endsAt:new Date().toISOString()}));season=data.season.id;toast('Đã chốt mùa và mở mùa mới.')}}
  }catch(error){toast(error.message)}
 });
})();
