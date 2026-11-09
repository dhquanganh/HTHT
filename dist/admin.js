/* Trang quản trị. Mọi kiểm tra quyền nằm ở server; trang này chỉ hiển thị. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s),num=n=>new Intl.NumberFormat('vi-VN').format(n||0);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const when=value=>value?new Date(value).toLocaleString('vi-VN'):'—';
 const categories={equipment:'Trang bị',artifact:'Bảo vật',consumable:'Vật phẩm',shard:'Mảnh',material:'Nguyên liệu',cosmetic:'Trang trí'};
 const fold=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
 const icon=(src,cls='item-icon')=>src?`<img class="${cls}" src="${escape(src)}" alt="" loading="lazy">`:`<span class="${cls} empty" aria-hidden="true"></span>`;
 let csrf='',page=0,pages=1,query='',selected=null,items=[],chosen=null,matches=[],active=-1;
 const toast=text=>{const el=$('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2600)};
 async function api(url,body){
  const options={credentials:'same-origin',headers:{Accept:'application/json'}};
  if(body!==undefined){options.method='POST';options.headers['Content-Type']='application/json';options.headers['X-Admin-CSRF']=csrf;options.body=JSON.stringify(body)}
  const response=await fetch(url,options);let data={};try{data=await response.json()}catch{}
  if(!response.ok){if(response.status===401&&!url.endsWith('/login'))showLogin();throw Error(data.error?.message||'Không thực hiện được thao tác.')}
  return data;
 }
 function showLogin(){$('#app').hidden=true;$('#login').hidden=false;$('#password').focus()}
 async function showApp(){
  $('#login').hidden=true;$('#app').hidden=false;
  ({items}=await api('/api/admin/items'));
  await loadPlayers();
 }
 async function loadPlayers(){
  const data=await api(`/api/admin/players?page=${page}&q=${encodeURIComponent(query)}`);pages=Math.max(1,Math.ceil(data.total/data.pageSize));
  $('#result-count').textContent=`${num(data.total)} tài khoản`;$('#page').textContent=`Trang ${page+1}/${pages}`;$('#previous').disabled=page<=0;$('#next').disabled=page+1>=pages;
  $('#players').innerHTML=data.players.map(p=>`<tr data-id="${p.id}" tabindex="0" class="${p.id===selected?'selected':''}"><td>${escape(p.username)}${p.locked?'<span class="tag">Khóa</span>':''}</td><td>${p.level}</td><td>${num(p.gold)}</td><td>${num(p.diamonds)}</td><td>${p.stage}</td><td>${p.towerFloor}</td><td>${p.heroes}</td><td>${when(p.updatedAt)}</td></tr>`).join('')||'<tr><td colspan="8" class="muted">Không có tài khoản phù hợp.</td></tr>';
 }
 const letter=()=>({title:$('#mail-title').value,text:$('#mail-text').value});
 function renderDetail(p){
  selected=p.id;const el=$('#detail');el.hidden=false;
  el.innerHTML=`<h2>${escape(p.displayName)}${p.locked?'<span class="tag">Khóa</span>':''}</h2><p class="muted">${escape(p.username)} · tạo ${when(p.createdAt)}</p>
  <div class="stats">${[['Cấp',p.level],['Vàng',num(p.gold)],['Kim cương',num(p.diamonds)],['Ải đã mở',p.stage],['Đậu thần',p.towerFloor],['Tướng',p.heroes]].map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
  <h3>Gửi thư</h3><p class="muted">Phần cộng được gửi vào hòm thư, người chơi bấm nhận mới vào túi. Số âm trừ ngay.</p><div class="mail-fields"><label>Tiêu đề thư<input id="mail-title" maxlength="60" placeholder="Quà từ Ban quản trị"></label><label>Nội dung<input id="mail-text" maxlength="300" placeholder="Thuyền trưởng nhận quà trong thư này nhé."></label></div><h3>Vật phẩm</h3><form id="grant-item" class="grant"><label class="picker">Vật phẩm<span class="picker-input"><span id="chosen-icon"></span><input id="grant-id" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="item-results" placeholder="Gõ tên hoặc mã" autocomplete="off"></span><div id="item-results" class="item-results" role="listbox" hidden></div></label><label>Số lượng<input id="grant-quantity" type="number" value="1" step="1" required></label><button type="submit">Gửi</button></form>
  <h3>Vàng và kim cương</h3><form id="grant-wallet" class="wallet"><label>Vàng (+/−)<input id="grant-gold" type="number" step="1"></label><label>Kim cương (+/−)<input id="grant-diamonds" type="number" step="1"></label><button type="submit">Cập nhật</button></form>
  <h3>Thư chờ nhận</h3><div class="list">${p.mail.map(m=>`<div><span class="grow"><b>${escape(m.title)}</b><br><small class="muted">${when(m.sentAt)}</small></span>${m.rewards.map(r=>`${icon(r.icon)}<strong>${num(r.quantity)}</strong>`).join('')}</div>`).join('')||'<div class="muted">Không có thư chờ nhận</div>'}</div><h3>Túi đồ</h3><div class="list">${p.inventory.map(i=>`<div>${icon(i.icon)}<span class="grow">${escape(i.name)}</span><strong>${num(i.quantity)}</strong></div>`).join('')||'<div class="muted">Túi đồ trống</div>'}</div>
  <h3>Lịch sử quản trị</h3><div class="list log">${p.log.map(l=>`<div><time>${when(l.at)}</time>${escape(l.detail)}</div>`).join('')||'<div class="muted">Chưa có thao tác</div>'}</div>
  <h3>Mật khẩu</h3><p class="muted">Đặt mật khẩu mới sẽ ghi đè mật khẩu cũ và đăng xuất người chơi khỏi mọi thiết bị.</p><form id="set-password" class="wallet"><label>Mật khẩu mới<input id="new-password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><label>Nhập lại<input id="confirm-password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><button type="submit">Đặt mật khẩu</button></form>
  <h3>Trạng thái</h3><button id="lock" class="danger" type="button" data-locked="${p.locked}">${p.locked?'Mở khóa tài khoản':'Khóa tài khoản'}</button>`;
 }
 async function refresh(p,message){renderDetail(p);await loadPlayers();toast(message)}
 function showMatches(){
  const box=$('#item-results'),input=$('#grant-id'),text=fold(input.value.trim());
  matches=(text?items.filter(i=>fold(i.name).includes(text)||fold(i.id).includes(text)):items).slice(0,40);active=-1;
  box.innerHTML=matches.map((i,n)=>`<button type="button" role="option" id="item-option-${n}" data-item="${escape(i.id)}" tabindex="-1">${icon(i.icon,'item-icon large')}<span class="grow"><b>${escape(i.name)}</b><small>${escape(categories[i.category]||i.category)} · ${escape(i.id)}</small></span></button>`).join('')||'<p class="muted">Không tìm thấy vật phẩm.</p>';
  box.hidden=false;input.setAttribute('aria-expanded','true');
 }
 function hideMatches(){const box=$('#item-results');if(box){box.hidden=true;$('#grant-id').setAttribute('aria-expanded','false')}}
 function choose(item){chosen=item;$('#grant-id').value=item.name;$('#chosen-icon').innerHTML=icon(item.icon);hideMatches();$('#grant-quantity').focus();$('#grant-quantity').select()}
 function mark(index){const options=[...$('#item-results').querySelectorAll('[role=option]')];if(!options.length)return;active=(index+options.length)%options.length;options.forEach((o,n)=>o.classList.toggle('active',n===active));options[active].scrollIntoView({block:'nearest'});$('#grant-id').setAttribute('aria-activedescendant',options[active].id)}
 document.addEventListener('submit',async e=>{
  e.preventDefault();const form=e.target.id;
  try{
   if(form==='login-form'){$('#login-error').textContent='';({csrfToken:csrf}=await api('/api/admin/login',{password:$('#password').value}));$('#password').value='';await showApp()}
   if(form==='search-form'){query=$('#search').value.trim();page=0;await loadPlayers()}
   if(form==='grant-item'){if(!chosen)throw Error('Hãy chọn vật phẩm trong danh sách.');const name=chosen.name;await refresh(await api(`/api/admin/players/${selected}/grant`,{itemId:chosen.id,quantity:Number($('#grant-quantity').value),...letter()}),`Đã gửi ${name}.`);chosen=null}
   if(form==='set-password'){const password=$('#new-password').value;if(password.length<8||password.length>128)throw Error('Mật khẩu phải có 8–128 ký tự.');if(password!==$('#confirm-password').value)throw Error('Hai mật khẩu không khớp.');if(!confirm('Ghi đè mật khẩu của tài khoản này? Người chơi sẽ bị đăng xuất ngay.'))return;await refresh(await api(`/api/admin/players/${selected}/password`,{password}),'Đã đặt mật khẩu mới.')}
   if(form==='grant-wallet'){const value=id=>$(id).value===''?undefined:Number($(id).value);await refresh(await api(`/api/admin/players/${selected}/grant`,{gold:value('#grant-gold'),diamonds:value('#grant-diamonds'),...letter()}),'Đã gửi. Số âm đã trừ ngay.')}
  }catch(error){if(form==='login-form')$('#login-error').textContent=error.message;else toast(error.message)}
 });
 document.addEventListener('input',e=>{if(e.target.id==='grant-id'){chosen=null;$('#chosen-icon').innerHTML='';showMatches()}});
 document.addEventListener('focusin',e=>{if(e.target.id==='grant-id')showMatches()});
 async function openRow(row){if(!row?.dataset.id)return;try{renderDetail(await api('/api/admin/players/'+row.dataset.id));await loadPlayers()}catch(error){toast(error.message)}}
 document.addEventListener('keydown',e=>{
  if(e.target.id==='grant-id'&&!$('#item-results').hidden){
   if(e.key==='ArrowDown'){e.preventDefault();mark(active+1)}
   if(e.key==='ArrowUp'){e.preventDefault();mark(active-1)}
   if(e.key==='Enter'&&matches.length){e.preventDefault();choose(matches[Math.max(0,active)])}
   if(e.key==='Escape')hideMatches();
  }
  if(e.key==='Enter'&&e.target.matches?.('tbody tr'))openRow(e.target);
 });
 document.addEventListener('click',async e=>{
  const option=e.target.closest('[data-item]');if(option){e.preventDefault();choose(items.find(i=>i.id===option.dataset.item));return}
  if(e.target.id!=='grant-id')hideMatches();
  const id=e.target.id;
  try{
   if(['tab-players','tab-beast','tab-events'].includes(id)){$('#players-tab').hidden=id!=='tab-players';for(const tab of ['#tab-players','#tab-beast','#tab-events']){const on=tab==='#'+id;$(tab).classList.toggle('on',on);$(tab).setAttribute('aria-selected',on)}if(id==='tab-beast')await window.AdminBeast.show();else window.AdminBeast.hide();if(id==='tab-events')await window.AdminEvents.show();else window.AdminEvents.hide();return}
   if(e.target.closest('#beast-tab,#events-tab'))return;
   if(id==='logout'){await api('/api/admin/logout',{});csrf='';$('#detail').hidden=true;showLogin()}
   if(id==='previous'&&page>0){page--;await loadPlayers()}
   if(id==='next'&&page+1<pages){page++;await loadPlayers()}
   if(id==='lock'){const locked=e.target.dataset.locked!=='true';if(!confirm(locked?'Khóa tài khoản này? Người chơi sẽ bị đăng xuất ngay.':'Mở khóa tài khoản này?'))return;await refresh(await api(`/api/admin/players/${selected}/lock`,{locked}),locked?'Đã khóa tài khoản.':'Đã mở khóa tài khoản.')}
   openRow(e.target.closest('tbody tr'));
  }catch(error){toast(error.message)}
 });
 window.AdminApp={api,toast,escape,num,fold,icon,catalogItems:()=>items};
 api('/api/admin/session').then(async data=>{csrf=data.csrfToken;await showApp()}).catch(showLogin);
})();
