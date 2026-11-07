/* Đảo Người Cá: Vực thẳm (event_abyss) và Album (imgalbum) dựng lại bằng DOM trên lớp 1136×640.
   Vị trí, khung và ảnh lấy từ prefab gốc (MainScene, PopupAbyssEnemy, AbyssPopupBuyTurn, PopupSelectReward,
   PanelAlbumMain, PanelGridPicture, PanelRollPicture, PopupAlbumOverview). Mọi kết quả do server quyết định. */
(()=>{
'use strict';
let c=null,albumAt={album:1,image:1},albumMode='main',abyssScroll=null,timer=0,revealPiece=null;
const layer=()=>document.querySelector('#game-layer');
const A=name=>c.catalog.abyssArt.art[name],B=name=>c.catalog.albumData.art[name];
const pic=(album,image)=>c.catalog.albumData.pictures.find(p=>p.album===album&&p.image===image);
const picState=(album,image)=>c.player.albumState.pictures.find(p=>p.album===album&&p.image===image);
const pointNames={0:'Công',1:'Thủ',2:'Máu',3:'Tốc độ',97:'Lục thức'};
const effectText=points=>'*Toàn đội tăng '+points.map(([id,v])=>`${v} ${pointNames[id]||''}`.trim()).join(', ');
const bg=key=>`background-image:url('${c.assetSrc(key)}')`;
const close=()=>{clearInterval(timer);document.querySelector('.mm-screen')?.remove();document.querySelector('.mm-popup')?.remove()};
function mount(cls,html){
 document.querySelector('.mm-screen')?.remove();const el=document.createElement('div');el.className='mm-screen '+cls;el.innerHTML=html;layer().appendChild(el);return el;
}
function popup(cls,html){document.querySelector('.mm-popup')?.remove();const el=document.createElement('div');el.className='mm-popup '+cls;el.innerHTML=html;layer().appendChild(el);return el}
const tile=r=>c.eventTile(r,'mm-tile');

// ---------- Vực thẳm
function countdown(){const left=Math.max(0,c.player.abyss.endsAt-Date.now()),d=Math.floor(left/864e5),h=Math.floor(left/36e5)%24,m=Math.floor(left/6e4)%60,s=Math.floor(left/1e3)%60,p=n=>String(n).padStart(2,'0');return `Nghỉ sau: ${d} ngày ${p(h)}:${p(m)}:${p(s)}`}
function abyssPoint(stage,[x,y]){
 const st=c.player.abyss.stages[stage-1],stars=st.quests.filter(q=>q>0).length,notify=st.quests.includes(1);
 const left=568+x,top=320-y,star=i=>`<img src="${c.assetSrc(A(i<stars&&st.unlocked?'star2':'star1'))}" style="left:${[-25,0,25][i]+50-13}px;top:${[25,13,25][i]+50-13}px" alt="" draggable="false">`;
 return `<div class="abyss-point ${st.unlocked?'':'locked'}" style="left:${left-50}px;top:${top-50}px"><button data-action="mm-abyss-stage" data-stage="${stage}" aria-label="Ải ${stage}" style="${bg(A(st.unlocked?'abyss_level_pass':'abyss_level_lock'))}"></button>${stars===3?c.img(A('complete'),'abyss-complete'):''}<span class="abyss-stars">${[0,1,2].map(star).join('')}</span><b>1 - ${stage}</b>${notify?c.img(A('notify_dot'),'abyss-notify'):''}</div>`;
}
function abyssScreen(){
 const a=c.player.abyss,data=c.catalog.abyssArt,ready=a.milestones.some(m=>m.ready&&m.claimed===null);
 const dots=data.dots.map(([x,y])=>`<img class="abyss-dot" src="${c.assetSrc(A('cham'))}" style="left:${568+x-10}px;top:${320-y-10}px" alt="" draggable="false">`).join('');
 const el=mount('abyss-screen',`<div class="abyss-scroll"><div class="abyss-map"><img src="${c.assetSrc(A('abyss_background1'))}" style="left:0" alt="" draggable="false"><img src="${c.assetSrc(A('abyss_backgound2'))}" style="left:1136px" alt="" draggable="false">${dots}${data.points.map((p,i)=>abyssPoint(i+1,p)).join('')}</div></div>
  <button class="abyss-back" data-action="mm-close" aria-label="Quay lại" style="${bg(A('button_back'))}"></button>
  <p class="abyss-time">${countdown()}</p>
  <button class="abyss-help" data-action="mm-abyss-help" aria-label="Hướng dẫn" style="${bg(A('button_help'))}"></button>
  <button class="abyss-gift" data-action="mm-abyss-gift" aria-label="Rương kho báu" style="${bg(A('abyss_present'))}">${ready?c.img(A('notify_dot'),'abyss-notify'):''}</button>`);
 const scroll=el.querySelector('.abyss-scroll'),last=a.stages.filter(s=>s.unlocked).length;
 scroll.scrollLeft=abyssScroll??Math.max(0,568+data.points[last-1][0]-568);scroll.addEventListener('scroll',()=>{abyssScroll=scroll.scrollLeft});
 let drag=null;scroll.addEventListener('pointerdown',e=>{drag={x:e.clientX,left:scroll.scrollLeft,moved:false}});
 scroll.addEventListener('pointermove',e=>{if(!drag)return;const k=1136/layer().getBoundingClientRect().width,dx=(e.clientX-drag.x)*k;if(Math.abs(dx)>6)drag.moved=true;scroll.scrollLeft=drag.left-dx});
 scroll.addEventListener('pointerup',()=>{setTimeout(()=>drag=null,0)});scroll.addEventListener('click',e=>{if(drag?.moved){e.stopPropagation();e.preventDefault()}},true);
 clearInterval(timer);timer=setInterval(()=>{const t=el.querySelector('.abyss-time');if(!t?.isConnected)return clearInterval(timer);t.textContent=countdown()},1000);
}
// Đội địch của ải (MFHeroHead1..6 trong PopupAbyssEnemy): đầu tướng, hệ, cấp và sao.
function heroHead(h){
 const head=h&&c.catalog.campaign.visuals[h.avatar]?.head;if(!head)return `<span class="abyss-head empty"></span>`;
 return `<span class="abyss-head">${c.img(head,'abyss-face',h.name)}${c.img(A('hero_head_border'),'abyss-border')}${c.img(c.named('faction_'+h.faction),'abyss-faction')}<b>${h.level}</b><span class="abyss-head-stars">${window.heroStarsHtml(h.stars)}</span><i></i></span>`;
}
function abyssStage(stage){
 const st=c.player.abyss.stages[stage-1];
 if(!st.unlocked)return c.toast('Chưa đủ điều kiện mở khóa');
 const enemy=st.enemies,slots=[1,2,3,4,5,6].map(p=>enemy.heroes.find(h=>h.position===p)),power=enemy.power;
 const quest=(q,i)=>{const box=q.status===2?'taskbox2':'taskbox1';return `<button class="abyss-quest" data-action="mm-abyss-chest" data-stage="${stage}" data-quest="${i}" style="${bg(A(i?'bar0':'bar1'))}" ${q.status===1?'data-ready':''}>${c.img(A(q.status>0?'star2':'star1'),'abyss-quest-star')}<span>${c.escape(q.text)}</span>${q.status===1?'<canvas class="abyss-chest-spine" width="100" height="100"></canvas>':c.img(A(box),'abyss-chest')}</button>`};
 popup('abyss-enemy',`<section class="abyss-body" role="dialog" aria-modal="true" aria-label="Ải ${stage}" style="${bg(A('popup_body'))}"><h2>Ải ${stage}</h2><button class="mm-close" data-action="mm-popup-close" aria-label="Đóng" style="${bg(A('popup_close'))}"></button>
  <div class="abyss-fields"><span class="abyss-field" style="${bg(A('box_field_1'))}">${c.img(A('icon_power'))}<b>${c.num(power)}</b></span><span class="abyss-field turn" style="${bg(A('box_field_1'))}">${c.img(A('icon_turn_attack'))}<b>${st.turns}/${st.maxTurns}</b><button data-action="mm-abyss-buy-open" data-stage="${stage}" aria-label="Mua lượt" style="${bg(A('button_add'))}"></button></span></div>
  <div class="abyss-lineup" style="${bg(A('round_rect_5'))}"><b class="front">Hàng Trước</b><b class="back">Hàng Sau</b><b class="ship">Chiến hạm</b><div class="row front">${slots.slice(0,2).map(heroHead).join('')}</div><div class="row back">${slots.slice(2,6).map(heroHead).join('')}</div><span class="abyss-ship" style="${bg(A('border_gear'))}"></span></div>
  <h3>Nhiệm vụ</h3><div class="abyss-quests" style="${bg(A('rect'))}">${st.quests.map(quest).join('')}</div>
  <button class="abyss-attack" data-action="mm-abyss-attack" data-stage="${stage}" style="${bg(A('button_yellow'))}">Tấn công</button></section>`);
 for(const canvas of document.querySelectorAll('.abyss-chest-spine'))c.spine(canvas,c.catalog.abyssArt.chestSpine,{scale:1});
}
function abyssChest(stage,quest){
 const q=c.player.abyss.stages[stage-1].quests[quest];
 if(q.status===1)return c.mutation('/api/abyss/claim',{stage,quest},{close:false}).then(r=>{if(r){c.render();abyssScreen();abyssStage(stage)}});
 popup('abyss-reward',`<section class="abyss-reward-body" role="dialog" aria-modal="true" aria-label="Yêu cầu hoàn tất" style="border-image-source:url('${c.assetSrc(A('round_rect_8'))}')"><h2>Yêu cầu hoàn tất</h2><p>${c.escape(q.text)}</p><p class="label">Phần thưởng :</p><div class="abyss-reward-list">${q.rewards.map(tile).join('')}</div><button data-action="mm-abyss-stage" data-stage="${stage}" style="${bg(A('button_green'))}">${q.status===2?'Đã nhận':'Quay lại'}</button></section>`);
}
function buyOpen(stage){
 const a=c.player.abyss,st=a.stages[stage-1],left=a.buyLimit-st.bought;
 popup('abyss-buy',`<section class="abyss-buy-body" role="dialog" aria-modal="true" aria-label="Mua lượt đánh" style="${bg(A('popup_body'))}" data-stage="${stage}" data-max="${left}" data-price="${a.buyPrice}"><h2>Mua lượt đánh</h2><button class="mm-close" data-action="mm-abyss-stage" data-stage="${stage}" aria-label="Đóng" style="${bg(A('popup_close'))}"></button>
  <span class="abyss-buy-item" style="${bg(A('bgr_item_consumable'))}">${c.img(A('icon_turn_attack'))}${c.img(A('border_item'),'border')}</span><p>Nhận thêm lượt đánh ải</p>
  <div class="abyss-buy-count"><button data-action="mm-abyss-step" data-step="-1" aria-label="Bớt" style="${bg(A('button_minus'))}"></button><b style="${bg(A('box_field_1'))}" id="abyss-buy-n">${left?1:0}</b><button data-action="mm-abyss-step" data-step="1" aria-label="Thêm" style="${bg(A('button_plus'))}"></button></div>
  <p>Bạn đã mua ${st.bought}/${a.buyLimit} lần</p><span class="abyss-buy-price" style="${bg(A('box_field_1'))}">${c.img(A('icon_gem'))}<b id="abyss-buy-price">${left?a.buyPrice:0}/${c.short(c.player.wallet.diamonds)}</b></span>
  <button class="abyss-buy-go" data-action="mm-abyss-buy" data-stage="${stage}" ${left?'':'disabled'} style="${bg(A('button_yellow'))}">Mua</button></section>`);
}
function giftOpen(){
 const a=c.player.abyss;
 const cell=m=>`<div class="abyss-cell ${m.claimed!==null?'done':m.ready?'ready':''}"><b>${m.stars}${c.img(A('star2'))}</b><div>${m.options.map((r,i)=>`<button data-action="mm-abyss-pick" data-stars="${m.stars}" data-option="${i}" ${m.ready&&m.claimed===null?'':'disabled'} class="${m.claimed===i?'picked':''}" aria-label="Chọn quà">${tile(r)}</button>`).join('')}</div></div>`;
 popup('abyss-gift-popup',`<section class="abyss-gift-body" role="dialog" aria-modal="true" aria-label="Rương kho báu" style="${bg(A('popup_body'))}"><h2>Rương kho báu</h2><button class="mm-close" data-action="mm-popup-close" aria-label="Đóng" style="${bg(A('popup_close'))}"></button>
  <div class="abyss-gift-desc" style="${bg(A('rect_26'))}">${c.img(A('taskbox_03'))}<p>Cứ với mỗi 6 sao đạt được sẽ mở ra 1 ô phần thưởng, thu thập nhiều sao nhất có thể để nhận được tối đa phần thưởng.</p></div>
  <p class="abyss-gift-info">Chọn một phần thưởng từ Rương kho báu <b>(${a.stars}/${a.maxStars}${c.img(A('star2'))})</b></p><div class="abyss-cells">${a.milestones.map(cell).join('')}</div></section>`);
}

// ---------- Album
const albums=()=>[...new Set(c.catalog.albumData.pictures.map(p=>p.album))];
const albumPics=album=>c.catalog.albumData.pictures.filter(p=>p.album===album);
const requireText=(p,s)=>{const parts=[];if(p.requireImage)parts.push(`Sở hữu Album ${Math.floor(p.requireImage/100)}-${p.requireImage%100}`);parts.push(`Yêu cầu lv${p.requireLevel}`);return parts.join('<br>')};
function albumTop(){const count=c.player.inventory[c.catalog.albumData.material]||0;return `<button class="album-back" data-action="${albumMode==='main'?'mm-close':'mm-album-main'}" aria-label="Quay lại" style="${bg(B('btn_action'))}">${c.img(c.named('button_back'))}</button><span class="album-cards" style="${bg(B('box_field_1'))}">${c.img(B('pic_coin'))}<b>${c.num(count)}</b></span>`}
function photo(p,s,cls=''){
 if(s.locked&&!s.pieces.length)return `<div class="album-photo locked ${cls}" style="${bg(B('pic_lock'))}">${c.img(B('lock2'),'album-lock')}<b>Chưa Mở</b></div>`;
 if(s.complete)return `<div class="album-photo ${cls}">${c.img(p.art,'album-art',p.name)}</div>`;
 const cells=Array.from({length:p.rows*p.cols},(_,i)=>`<span style="${s.pieces.includes(i)?'':bg(B('pic_hiden'))}" class="${s.pieces.includes(i)?'open':''}"></span>`).join('');
 return `<div class="album-photo ${cls}">${c.img(p.art,'album-art',p.name)}<div class="album-grid" style="grid-template:repeat(${p.rows},1fr)/repeat(${p.cols},1fr)">${cells}</div></div>`;
}
function albumMain(){
 albumMode='main';const p=pic(albumAt.album,albumAt.image),s=picState(albumAt.album,albumAt.image),list=albumPics(albumAt.album),max=Math.max(...albums());
 const tab=x=>{const xs=picState(x.album,x.image),main=x.image===1,on=x.image===albumAt.image;return `<button class="album-tab ${on?'on':''}" data-action="mm-album-pick" data-album="${x.album}" data-image="${x.image}" style="${bg(B(xs.locked&&!xs.complete?'tab2':on?'tab1':'tab3'))}">${c.img(B(main?'main':'sub'),'album-kind')}<i>${main?'Chính':'Phụ'}</i><b>${x.album} - ${x.image}</b>${xs.locked&&!xs.complete?c.img(B('lock'),'album-tab-lock'):''}</button>`};
 mount('album-screen',`<div class="album-bg" style="${bg(B('bgr_album'))}"></div><img class="album-left" src="${c.assetSrc(B('album1'))}" alt="" draggable="false"><img class="album-right" src="${c.assetSrc(B('album2'))}" alt="" draggable="false">${albumTop()}
  <span class="album-name" style="${bg(B('name'))}">${c.escape(p.name)}</span>
  <div class="album-card">${c.img(B('pin'),'album-pin')}<button class="album-open" data-action="mm-album-grid" aria-label="Xem ảnh ${c.escape(p.name)}">${photo(p,s)}</button>
   <p class="album-effect">${effectText(p.points)}</p><span class="album-require">${c.img(B('yêu-cầu'))}<b>${requireText(p,s)}</b></span><span class="album-progress" style="${bg(B('progress3'))}">Tiến trình: ${s.pieces.length} / ${s.total}</span></div>
  ${albumAt.album>1?`<button class="album-arrow left" data-action="mm-album-step" data-step="-1" aria-label="Album trước" style="${bg(B('next'))}"></button>`:''}${albumAt.album<max?`<button class="album-arrow right" data-action="mm-album-step" data-step="1" aria-label="Album sau" style="${bg(B('next'))}"></button>`:''}
  <button class="album-info" data-action="mm-album-points" style="${bg(B('button_info'))}"><span>Tổng chỉ số</span></button>
  <aside class="album-side" style="${bg(B('bookmark'))}"><span class="album-title" style="${bg(B('title_alb'))}">Album ${albumAt.album}</span><div class="album-tabs">${list.map(tab).join('')}</div><button class="album-overview" data-action="mm-album-overview" style="${bg(B('btn_overview'))}"><span>Bộ sưu tập</span></button></aside>`);
}
function albumGrid(){
 albumMode='grid';const p=pic(albumAt.album,albumAt.image),s=picState(albumAt.album,albumAt.image),fee=c.catalog.albumData.fee;
 if(s.locked&&!s.pieces.length)return c.toast('Chưa đủ điều kiện mở khóa: '+s.locked.replace('lv','lv'));
 const rows=Array.from({length:p.rows},(_,i)=>`<b>${String.fromCharCode(65+i)}</b>`).join(''),cols=Array.from({length:p.cols},(_,i)=>`<b>${i+1}</b>`).join('');
 const mark=Math.ceil(s.total/2),done=s.bonus.includes(mark),pct=Math.min(100,s.pieces.length/s.total*100);
 const reveal=revealPiece;revealPiece=null;
 mount('album-screen grid',`<div class="album-bg" style="${bg(B('bgr_album'))}"></div><img class="album-left" src="${c.assetSrc(B('album1'))}" alt="" draggable="false"><img class="album-right" src="${c.assetSrc(B('album2'))}" alt="" draggable="false">${albumTop()}
  <span class="album-name" style="${bg(B('name'))}">${c.escape(p.name)}</span>
  <div class="album-card big">${c.img(B('pin'),'album-pin')}<div class="album-rows">${rows}</div>${photo(p,{...s,locked:null},'lines')}<div class="album-cols">${cols}</div></div>
  <p class="album-effect wide">${effectText(p.points)}</p>${reveal===null?'':`<canvas class="album-reveal" width="800" height="800" style="left:${232+48+((reveal%p.cols)+.5)*530/p.cols-400}px;top:${116+(Math.floor(reveal/p.cols)+.5)*400/p.rows-400}px"></canvas>`}
  <aside class="album-roll" style="${bg(B('bookmark'))}"><div class="album-bar" style="${bg(B('progress_bgr'))}"><i style="height:${pct}%"></i></div>
   <div class="album-mark" style="top:${(1-mark/s.total)*360+16}px">${c.img(B('number'),'album-mark-icon')}<b>${mark}</b><span class="album-mark-tag ${done?'done':''}" style="${bg(B('bgr_nhan'))}">${done?'Đã nhận':'Nhận'}</span>${c.img(B('pic_coin'),'album-mark-coin')}<em>${fee*2}</em></div>
   <span class="album-step">${c.img(B('icon_progress'))}<b>Tiến trình<br>${s.pieces.length}/${s.total}</b></span>
   ${s.complete?'':`<button class="album-roll-go" data-action="mm-album-roll" data-submit style="${bg(B('button_yellow'))}">${c.img(B('pic_coin'))}<em>${fee}</em><b>Rút</b></button>`}</aside>`);
}
function albumOverview(){
 const col=album=>{const list=albumPics(album);return `<div class="album-ov-col"><p>Album ${album}</p>${list.map(x=>{const s=picState(x.album,x.image);return `<button class="album-ov-card" data-action="mm-album-pick" data-album="${x.album}" data-image="${x.image}" data-overview="1"><span class="album-ov-tag ${x.image===1?'main':'sub'}" style="${bg(B(x.image===1?'main':'sub'))}">${x.image===1?'Chính':'Phụ'}</span>${photo(x,s,'small')}</button>`}).join('')}</div>`};
 popup('album-ov-popup',`<section class="album-ov" role="dialog" aria-modal="true" aria-label="Bộ sưu tập"><button class="mm-close" data-action="mm-popup-close" aria-label="Đóng" style="${bg(B('button_close'))}"></button><div class="album-ov-scroll">${albums().map(col).join('')}</div></section>`);
}
function albumPoints(){
 const totals=c.player.albumState.totals;
 popup('album-points',`<section class="album-points-body" role="dialog" aria-modal="true" aria-label="Tổng chỉ số" style="border-image-source:url('${c.assetSrc(B('round_rect_8'))}')"><button class="mm-close" data-action="mm-popup-close" aria-label="Đóng" style="${bg(B('button_close'))}"></button>${totals.length?totals.map(([id,v])=>`<p><span>${pointNames[id]||id}</span><b>${v}</b></p>`).join(''):'<p class="none">Hãy sưu tầm đủ album ảnh<br>để kích hoạt các chỉ số</p>'}</section>`);
}

async function action(name,button){
 if(name==='mm-close'){close();return}
 if(name==='mm-popup-close'){document.querySelector('.mm-popup')?.remove();return}
 if(name==='mm-abyss-stage')return abyssStage(Number(button.dataset.stage));
 if(name==='mm-abyss-chest')return abyssChest(Number(button.dataset.stage),Number(button.dataset.quest));
 if(name==='mm-abyss-buy-open')return buyOpen(Number(button.dataset.stage));
 if(name==='mm-abyss-step'){const box=document.querySelector('.abyss-buy-body'),max=Number(box.dataset.max),n=document.querySelector('#abyss-buy-n'),v=Math.max(max?1:0,Math.min(max,Number(n.textContent)+Number(button.dataset.step)));n.textContent=v;document.querySelector('#abyss-buy-price').textContent=`${v*Number(box.dataset.price)}/${c.short(c.player.wallet.diamonds)}`;return}
 if(name==='mm-abyss-buy'){const stage=Number(button.dataset.stage),count=Number(document.querySelector('#abyss-buy-n').textContent);const r=await c.mutation('/api/abyss/buy',{stage,count},{close:false});if(r){abyssScreen();abyssStage(stage)}return}
 if(name==='mm-abyss-attack'){const stage=Number(button.dataset.stage);const r=await c.mutation('/api/abyss/start',{stage,formation:c.player.formation?.slots},{close:false,render:false,message:false});if(r){close();await c.navigate(9)}return}
 if(name==='mm-abyss-gift')return giftOpen();
 if(name==='mm-abyss-pick'){const r=await c.mutation('/api/abyss/milestone',{stars:Number(button.dataset.stars),option:Number(button.dataset.option)},{close:false});if(r){abyssScreen();giftOpen()}return}
 if(name==='mm-abyss-help'){popup('abyss-help',`<section class="abyss-reward-body" role="dialog" aria-modal="true" aria-label="Vực thẳm" style="border-image-source:url('${c.assetSrc(A('round_rect_8'))}')"><h2>Vực thẳm</h2><p class="help">Có 20 ải, mỗi ải 3 nhiệm vụ ứng với 3 sao. Thắng ải để mở ải tiếp theo; thắng với nhiều tướng cùng hệ được ghi trong nhiệm vụ để lấy đủ sao. Mỗi nhiệm vụ hoàn thành mở một rương. Mỗi ải có ${c.player.abyss.stages[0].maxTurns} lượt đánh mỗi ngày, có thể mua thêm bằng kim cương. Cứ 6 sao mở một ô trong Rương kho báu. Mùa kéo dài 7 ngày rồi bắt đầu lại.</p><button data-action="mm-popup-close" style="${bg(A('button_green'))}">Đóng</button></section>`);return}
 if(name==='mm-album-main')return albumMain();
 if(name==='mm-album-pick'){albumAt={album:Number(button.dataset.album),image:Number(button.dataset.image)};document.querySelector('.mm-popup')?.remove();return albumMain()}
 if(name==='mm-album-step'){albumAt={album:albumAt.album+Number(button.dataset.step),image:1};return albumMain()}
 if(name==='mm-album-grid')return albumGrid();
 if(name==='mm-album-overview')return albumOverview();
 if(name==='mm-album-points')return albumPoints();
 if(name==='mm-album-roll'){const r=await c.mutation('/api/album/roll',{album:albumAt.album,image:albumAt.image},{close:false});if(r){revealPiece=r.result?.piece??null;albumGrid();const canvas=document.querySelector('.album-reveal');if(canvas){const p=pic(albumAt.album,albumAt.image);c.spine(canvas,c.catalog.albumData.openSpine,{loop:false,scale:1,onEnd:()=>canvas.remove()})}}return}
}
window.MermaidUI={
 openAbyss(ctx){c=ctx;abyssScroll=null;abyssScreen()},
 openAlbum(ctx){c=ctx;const first=c.player.albumState.pictures.find(p=>!p.complete&&!p.locked)||c.player.albumState.pictures[0];albumAt={album:first.album,image:first.image};albumMain()},
 action(name,button,ctx){c=ctx;return action(name,button)},
 close,
 get open(){return !!document.querySelector('.mm-screen')},
};
})();
