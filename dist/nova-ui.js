/* Đấu Trường Tân Tinh (bundle `lua_novaarena`): dựng nguyên prefab NovaRoot / NovaBattle / NovaBracket / NovaTop và các
 * popup bằng PrefabDOM, đổ dữ liệu theo NovaBanner / NovaBottomBar / NovaBattleCell / NovaBracketCell / NovaPopupPredict /
 * NovaPopupRank / NovaPopupRecord / NovaPopupReward / NovaPopupSchedule / NovaPopupQuest / NovaPopupShop / NovaBuffPopup.
 * Luật ở server/nova.mjs + server/nova-store.mjs. */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let c=null,data=null,st=null,screen=null,screenName='',popups=[],timer=null,busy=false;
 const W=1136,H=640;
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets(),onSkeleton:(el,comp)=>{el._skeleton=comp}});
 const render=(name,w=W,h=H)=>D.render(data.prefabs[name],w,h,opts());
 const find=(el,p)=>el&&D.find(el,p),show=(el,on)=>D.show(el,on),text=(el,s,rich=false)=>D.setText(el,String(s??''),rich);
 const img=(el,src)=>{if(!el)return;el.querySelector(':scope>.pd-image')?.remove();el.style.backgroundImage=src?`url('${src}')`:'none';el.style.backgroundSize='100% 100%'};
 const layer=()=>document.querySelector('#game-layer');
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
 const clock=sec=>{sec=Math.max(0,Math.floor(sec));const d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60),s=sec%60,p=n=>String(n).padStart(2,'0');return(d?d+'d ':'')+`${p(h)}:${p(m)}:${p(s)}`};
 const stageText=k=>st.stageNames[k]||'';
 const stateText=()=>st.status>=1&&st.status<=4?['','Chuẩn bị','Đánh tự do','Đánh tự động'][st.state]:st.status===5?['','Chuẩn bị','Đặt cược','Đang đánh','Kết thúc'][st.state]:'';
 const tiles=list=>(list||[]).map(r=>c.eventTile(r,'nv-tile')).join('');
 const html=(host,markup,cls='nv-html')=>{if(!host)return null;host.querySelector(':scope>.'+cls)?.remove();const box=document.createElement('div');box.className=cls;box.innerHTML=markup;host.appendChild(box);return box};
 // Đồng hồ máy chủ (đếm ngược theo giờ server, không theo giờ máy người chơi).
 let skew=0;const now=()=>Date.now()+skew;
 async function refresh(){st=await c.api('/api/nova');if(st.now)skew=st.now-Date.now();return st}
 async function post(url,body){if(busy)return null;busy=true;try{return await c.mutation(url,body,{close:false,render:false,bonus:true,message:false})}finally{busy=false}}

 // ---- PlayerAvatar / NameBar / PowerBar (NovaPlayerInfo)
 function avatar(el,e){
  if(!el)return;const pa=el.dataset?.name==='PlayerAvatar'?el:find(el,'PlayerAvatar');
  if(pa){show(pa,!!e);if(e){img(find(pa,'Mask/ImageAvt'),c.head(e.avatar));text(find(pa,'TagLevel/TextLevel'),e.level??'');show(find(pa,'EffectSpecial'),false)}}
  text(find(el,'NameBar/TextName'),e?.name||'');text(find(el,'PowerBar/TextPower'),e?c.short(e.power||0):'');
 }
 function spineHero(holder,avatarId,{scale=.8}={}){
  if(!holder)return;holder.querySelector('canvas')?.remove();const sk=c.skeleton(avatarId);if(!sk)return;
  const cv=document.createElement('canvas');cv.width=260;cv.height=360;cv.className='nv-spine';holder.appendChild(cv);c.spine(cv,{skeleton:sk,animation:'idling'},{loop:true,scale});
 }

 // ---- Màn lớn + popup
 function mount(name,cls){
  for(const p of popups)p.remove();popups=[];screen?.remove();clearInterval(timer);
  screen=render(name);screen.classList.add('nv-root',cls);screenName=name;layer().appendChild(screen);screen.addEventListener('click',onClick);
  const started=Date.now(),base=st.countdown;timer=setInterval(()=>{if(!screen?.isConnected)return clearInterval(timer);const left=base-(Date.now()-started)/1000;for(const t of screen.querySelectorAll('[data-countdown]'))text(t,clock(Number(t.dataset.countdown)-(Date.now()-started)/1000));if(left<=0){clearInterval(timer);reopen()}},1000);
  return screen;
 }
 function popup(name,cls){const el=render(name);el.classList.add('nv-popup',cls);el.style.zIndex=String(46+popups.length);layer().appendChild(el);popups.push(el);el.addEventListener('click',onClick);return el}
 const closePopup=el=>{el.remove();popups=popups.filter(p=>p!==el)};
 const countdown=(el,sec)=>{if(!el)return;el.dataset.countdown=String(sec);text(el,clock(sec))};

 // ---- NovaBanner (dùng chung NovaRoot / NovaBattle)
 function banner(root,{main=true}={}){
  const b=find(root,'Content/Body/NovaBanner');if(!b)return;
  text(find(b,'AboveText'),st.status===-1?'Mùa mới':stageText(st.status));
  const bd=st.board,detail=find(b,'DetailGroup');
  for(const n of ['RankBar','PowerBar','MidNum','MidText','DetailGroup'])show(find(b,n),false);
  let main1='ĐĂNG KÝ',sub='';
  if(st.status===0||st.status===-1){sub=st.registered?'Đã đăng ký':'Chưa đăng ký';show(find(b,'PowerBar'),st.registered);text(find(b,'PowerBar/PowerText'),c.short(st.power||0));main1='ĐĂNG KÝ'}
  else if(st.status>=1&&st.status<=4){sub=stateText();main1=stateText().toUpperCase();
   if(bd?.group>0){show(find(b,'RankBar'),true);show(find(b,'MidNum'),true);text(find(b,'MidNum'),bd.rank);show(find(b,'PowerBar'),true);text(find(b,'PowerBar/PowerText'),c.short(st.power||0));
    show(detail,true);text(find(detail,'EliminationBar/Info'),bd.group);text(find(detail,'TurnBar/Info'),bd.matches);text(find(detail,'RecordBar/Info'),`<color=#7DE837>${bd.wins}</color> : <color=#E84737>${bd.losses}</color>`,true)}
   else{show(find(b,'MidText'),true);text(find(b,'MidText'),st.power?'Không đủ điều kiện tham gia':'Không đăng kí tham gia')}}
  else if(st.status===5){sub=stateText();main1=stateText().toUpperCase();
   if(st.top16){show(find(b,'RankBar'),true);show(find(b,'MidNum'),true);text(find(b,'MidNum'),'TOP 16');show(find(b,'PowerBar'),true);text(find(b,'PowerBar/PowerText'),c.short(st.power||0))}
   else{show(find(b,'MidText'),true);text(find(b,'MidText'),'Không đủ điều kiện tham gia')}}
  text(find(b,'AboveText2'),sub);text(find(b,'MainBar/TitleText'),main1);countdown(find(b,'MainBar/BoxTime/TextValue'),st.countdown);
  show(find(b,'MainBar'),main);
  show(find(b,'MainBar/Notify'),(st.status===0||st.status===-1)&&!st.registered||st.status>=1&&st.status<=4&&st.state===2&&bd?.group>0&&bd.matches>0);
 }
 function bottomBar(root){
  const bar=find(root,'Content/NovaBottomBar');if(!bar)return;show(find(bar,'GroupBtn/ButtonTop'),false);
  show(find(bar,'GroupBtn/ButtonPredict/Noti'),st.status===5&&st.state<=2&&!!st.bracket);
 }
 // ---- NovaRoot
 async function openRoot(){
  await refresh();const el=mount('NovaRoot','nv-main');
  text(find(el,'Content/Body/Title/TitleText'),'ĐẤU TRƯỜNG TÂN TINH MÙA '+st.textMain);text(find(el,'Content/Body/Title/TimeBar/Text'),st.textSub);
  banner(el);bottomBar(el);
  const now=st.status===0||st.status===-1?st.rewards.register:st.status>=1&&st.status<=4?st.rewards.stages[st.status-1].advance:st.rewards.final[0];
  html(find(el,'Content/Body/RewardBar/ScrollViewReward/Viewport'),`<div class="nv-row">${tiles(now)}</div>`);
  html(find(el,'Content/Body/RecBar/ScrollViewRect/Viewport'),`<div class="nv-row">${st.recommend.map(id=>{const d=c.def(id);return d?`<span class="nv-head" title="${esc(d.name)}">${c.img(d.visual.head,'',d.name)}</span>`:''}).join('')}</div>`);
  show(find(el,'Content/Header/AnchorTopRight/GroupBtn/ButtonQuest/Notify'),st.quests.some(q=>q.status===1));
  show(find(el,'Content/Header/AnchorTopRight/GroupBtn/ButtonGlory/Notify'),false);
 }
 // ---- NovaBattle: bảng thách đấu trong nhóm
 async function openBattle(){
  await refresh();const el=mount('NovaBattle','nv-battle');banner(el,{main:false});bottomBar(el);
  const k=st.status,bd=st.board||{opponents:[]};
  text(find(el,'Content/Body/BattlePanel/Text'),`Chọn đối thủ để tham gia thách đấu. Top ${k<=2?4:2} người chơi trong vòng sẽ được đi tiếp vào vòng sau`);
  text(find(el,'Content/Body/BattlePanel/TextTimeB'),['','Thời gian chuẩn bị còn lại:','Thời gian thách đấu còn lại:','Thời gian tự động đánh còn lại:'][st.state]||'');
  text(find(el,'Content/Body/BattlePanel/TextTimeBr'),k<=2?'Thời gian vòng loại còn lại:':'Thời gian vòng bảng còn lại:');
  countdown(find(el,'Content/Body/BattlePanel/TextTimeB/TextTimeB'),st.countdown);countdown(find(el,'Content/Body/BattlePanel/TextTimeBr/TextTimeBr'),st.stageLeft??st.countdown);
  avatar(find(el,'Content/Body/Self/PlayerGroup'),{name:c.player().displayName,avatar:c.def(c.player().hero.id)?.avatar,level:c.player().account.level,power:st.power});
  const best=(st.team||[]).flat().filter(Boolean).map(id=>c.player().heroes.find(h=>h.id===id)).filter(Boolean).sort((a,b)=>(b.stats?.power||0)-(a.stats?.power||0))[0];
  if(best)spineHero(find(el,'Content/Body/Self'),c.def(best.id)?.avatar,{scale:.9});
  const content=find(el,'Content/Body/BattlePanel/ScrollBattle/Viewport/Content');content.innerHTML='';
  bd.opponents.forEach(o=>{const cell=render('NovaBattleCell',445,97);cell.classList.add('nv-cell');cell.dataset.opp=o.id;
   show(find(cell,'ChallengeCell'),!o.attacked);show(find(cell,'ResultCell'),o.attacked);
   if(o.attacked){avatar(find(cell,'ResultCell/PlayerGroup'),o);show(find(cell,'ResultCell/FrameWin'),o.win);show(find(cell,'ResultCell/FrameLost'),!o.win);text(find(cell,'ResultCell/TextResult'),`${o.win?'Thắng':'Thua'}\n${o.score?.[0]}:${o.score?.[1]}`)}
   else{avatar(find(cell,'ChallengeCell/PlayerGroup'),o);show(find(cell,'ChallengeCell/ButtonAttack'),st.state===2);show(find(cell,'ChallengeCell/ButtonAttackDisabled'),st.state!==2)}
   content.appendChild(cell)});
  if(!bd.opponents.length)content.innerHTML='<p class="nv-empty">Không có đối thủ.</p>';
 }
 // ---- NovaBracket: vòng 16
 async function openBracket(){
  await refresh();const el=mount('NovaBracket','nv-bracket');bottomBar(el);const br=st.bracket||{r16:[],qf:[],sf:[],final:[]};
  const cell=(node,m)=>{if(!node)return;for(const [side,e] of [['OppLeft',m?.a],['OppRight',m?.b]]){const s=find(node,side);show(find(s,'PlayerUnknown'),!e);avatar(find(s,'PlayerAvatar'),e);text(find(s,'TextName'),e?.name||'');
    show(find(s,'IconWin'),!!m?.winner&&m.winner===e?.id);show(find(s,'IconLose'),!!m?.winner&&!!e&&m.winner!==e.id)}show(find(node,'ButtonReplay'),false)};
  for(let i=0;i<4;i++){cell(find(el,`Content/Body/GroupLeft/NovaBracketCell${i+1}`),br.r16[i]);cell(find(el,`Content/Body/GroupRight/NovaBracketCell${i+1}`),br.r16[i+4])}
  for(let i=0;i<2;i++){cell(find(el,`Content/Body/GroupLeft/NovaBracketCell${i+5}`),br.qf[i]);cell(find(el,`Content/Body/GroupRight/NovaBracketCell${i+5}`),br.qf[i+2])}
  cell(find(el,'Content/Body/GroupLeft/NovaBracketCell7'),br.sf[0]);cell(find(el,'Content/Body/GroupRight/NovaBracketCell7'),br.sf[1]);cell(find(el,'Content/Body/GroupFinal/NovaBracketCellFinal'),br.final[0]);
  const champ=br.final[0]?.winner&&[br.final[0].a,br.final[0].b].find(e=>e?.id===br.final[0].winner);avatar(find(el,'Content/Body/GroupFinal/FinalOne'),champ||null);
  const next=['r16','qf','sf','final'].map(id=>br[id]?.[0]).find(m=>m&&!m.winner);
  text(find(el,'Content/Body/Broadcast/TextAnnounce'),next?`${stageText(5+['r16','qf','sf','final'].indexOf(next.round))} bắt đầu sau`:'Kết thúc mùa giải');
  countdown(find(el,'Content/Body/Broadcast/TextTime'),next?Math.max(0,(next.at-now())/1000):0);
  text(find(el,'Content/Body/Broadcast/TextInfo'),st.state===2?'Đang mở dự đoán':st.state===1?'Đang trong thời gian chuẩn bị':'');
 }
 // ---- Popup danh sách có tab bên trái (NovaSeasonCell)
 function tabsInto(host,list,active,act){const vp=find(host,'Viewport');if(!vp)return;vp.innerHTML='';const box=document.createElement('div');box.className='nv-tabs';
  for(const t of list){const cell=render('NovaSeasonCell',140,62);cell.dataset[act]=t.id;cell.classList.add('nv-tab');for(const s of ['ImageOff/Text','ImageOn/Text'])text(find(cell,s),t.label);show(find(cell,'ImageOn'),t.id===active);show(find(cell,'ImageOff'),t.id!==active);box.appendChild(cell)}vp.appendChild(box)}
 function rowsInto(host,name,w,h,items,fill){const vp=find(host,'Viewport');if(!vp)return;vp.innerHTML='';const box=document.createElement('div');box.className='nv-list';
  for(const x of items){const cell=render(name,w,h);cell.classList.add('nv-cell');fill(cell,x);box.appendChild(cell)}vp.appendChild(box);return box}
 // Xếp hạng
 let rankStage=1,rankGroup=null;
 async function openRank(stage=rankStage,group=null){
  const v=await c.api(`/api/nova/ranks?stage=${stage}${group?'&group='+group:''}`);rankStage=v.stage;rankGroup=v.group;
  popups.find(p=>p.classList.contains('nv-rank'))?.remove();popups=popups.filter(p=>p.isConnected);
  const el=popup('NovaPopupRank','nv-rank'),mid=find(el,'Content/LayoutGroup/PopupMid');
  tabsInto(find(mid,'BracketScrollView'),[1,2,3,4].map(k=>({id:k,label:stageText(k)})),v.stage,'rankStage');
  const dd=find(mid,'DropdownSelect');dd.innerHTML=`<select class="nv-select" aria-label="Nhóm">${Array.from({length:v.groups},(_,i)=>`<option value="${i+1}" ${i+1===v.group?'selected':''}>${v.stage<=2?'Nhóm đấu':'Bảng'} ${i+1}${i+1===v.myGroup?' (của bạn)':''}</option>`).join('')}</select>`;
  dd.querySelector('select').addEventListener('change',e=>openRank(v.stage,Number(e.target.value)));
  text(find(mid,'Label'),`Top ${v.advance} người chơi sẽ được đi tiếp vào vòng sau`);
  const fillRow=(cell,r)=>{const n=find(cell,'Normal');for(let i=1;i<=3;i++)show(find(n,'Rank'+i),r.rank===i);show(find(n,'Rank4+'),r.rank>3);text(find(n,'Rank4+/Text'),r.rank);avatar(find(n,'PlayerGroup'),r);
   const g=find(n,'GroupInfo');[[`Thắng: ${r.wins}`],[`Thua: ${r.losses}`],[`Hiệp thắng: ${r.teamWins}`]].forEach(([t],i)=>{const row=find(g,'G'+(i+1));if(row)html(row,`<span>${esc(t)}</span>`,'nv-ginfo')});
   show(find(cell,'TextNone'),false);if(r.rank<=v.advance)cell.classList.add('nv-adv');if(r.me)cell.classList.add('nv-me')};
  rowsInto(find(mid,'ScrollView'),'NovaRankCell',684,125,v.rows,fillRow);
  const me=v.rows.find(r=>r.me),meCell=find(mid,'NovaRankCellMe');show(find(meCell,'Normal'),!!me);show(find(meCell,'TextNone'),!me);if(me)fillRow(meCell,me);
 }
 // Kết quả trận đánh
 async function openRecord(stage=null){
  const v=await c.api('/api/nova/history');popups.find(p=>p.classList.contains('nv-record'))?.remove();popups=popups.filter(p=>p.isConnected);
  const el=popup('NovaPopupRecord','nv-record'),mid=find(el,'Content/LayoutGroup/PopupMid'),k=stage||v.rounds.at(-1)?.stage;
  tabsInto(find(mid,'BracketScrollView'),v.rounds.map(r=>({id:r.stage,label:r.name})),k,'recordStage');
  const rows=v.rounds.find(r=>r.stage===k)?.rows||[];show(find(mid,'TextNone'),!rows.length);
  rowsInto(find(mid,'ScrollView'),'NovaRecordCell',825,100,rows,(cell,r)=>{for(const n of ['IconAttLose','IconDefLose','IconDefWin'])show(find(cell,n),false);show(find(cell,'IconAttWin'),r.win);show(find(cell,'IconAttLose'),!r.win);
   text(find(cell,'TextWinLose'),r.win?'Thắng':'Thua');text(find(cell,'TextInfo'),`${r.score?.[0]} : ${r.score?.[1]}`);avatar(find(cell,'AvatarGroup'),r.opponent);text(find(cell,'TextServer'),r.auto?'Tự động':'Khiêu chiến');
   const d=new Date(r.at);text(find(cell,'TextTime'),d.toLocaleDateString('vi-VN'));text(find(cell,'TextTime2'),d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}));show(find(cell,'ButtonPlay'),false)});
 }
 // Phần thưởng
 function openReward(tab=null){
  popups.find(p=>p.classList.contains('nv-reward'))?.remove();popups=popups.filter(p=>p.isConnected);
  const el=popup('NovaPopupReward','nv-reward'),mid=find(el,'Content/LayoutGroup/PopupMid'),r=st.rewards;
  const groups=[{id:0,label:'Đăng ký',rows:[['Đăng ký',r.register]]},...r.stages.map((s,i)=>({id:i+1,label:stageText(i+1),rows:[['Đi tiếp',s.advance],['Bị loại',s.out]]})),
   {id:5,label:'Vòng 16',rows:r.final.map((x,i)=>[['Vô địch','Á quân','Top 4','Top 8','Top 16'][i],x])},{id:9,label:'Dự đoán',rows:[['Đoán đúng',r.bet.correct],['Đoán sai',r.bet.wrong]]}];
  const t=tab??(st.status>=1&&st.status<=5?Math.min(5,st.status):0),g=groups.find(x=>x.id===t)||groups[0];
  tabsInto(find(mid,'BracketScrollView'),groups.map(x=>({id:x.id,label:x.label})),g.id,'rewardTab');
  const fill=(cell,[label,list],i)=>{for(let k=1;k<=3;k++)show(find(cell,'TagRank'+k),false);if(g.id===5&&i<3)show(find(cell,'TagRank'+(i+1)),true);text(find(cell,'TextRank'),g.id===5&&i<3?'':label);show(find(cell,'TextDetail'),false);html(find(cell,'ScrollViewReward/Viewport'),`<div class="nv-row">${tiles(list)}</div>`)};
  let i=0;rowsInto(find(mid,'ScrollView'),'NovaRewardCell',725,100,g.rows,(cell,x)=>fill(cell,x,i++));show(find(mid,'NovaRewardCellMe'),false);
 }
 // Lịch trình
 async function openSchedule(){
  const v=await c.api('/api/nova/schedule'),el=popup('NovaPopupSchedule','nv-schedule'),mid=find(el,'Content/LayoutGroup/PopupMid');
  text(find(el,'Content/LayoutGroup/PopupTop/Title'),'Lịch trình');text(find(mid,'TimeLabel'),'Mùa giải:');text(find(mid,'TextTime2'),v.textSub);
  const vp=find(mid,'ScrollStageInfo/Viewport');vp.innerHTML='';const box=document.createElement('div');box.className='nv-schedule-row';
  const cols=new Map();for(const r of v.rows){const key=r.roundId>=5?5:r.roundId;if(!cols.has(key))cols.set(key,[]);cols.get(key).push(r)}
  for(const [k,rows] of cols){const col=document.createElement('div');col.className='nv-col';const tag=render('NovaScheduleTag',276,44);text(find(tag,'TextTag'),stageText(k));const info=render('NovaScheduleInfo2',276,432);
   text(find(info,'TextDate'),`(${rows[0].textDay})`);for(let i=rows.length+1;i<=3;i++)show(find(info,'Rect'+i),false);rows.slice(0,3).forEach((r,i)=>{const rect=find(info,'Rect'+(i+1));show(rect,true);text(find(rect,'TextTime'),r.textTime);const a=find(rect,'TextAssign');show(a,true);text(a,r.subStatus||stageText(r.roundId));
    show(find(rect,'ResultGroup/TextEnd'),r.status===2);show(find(rect,'ResultGroup/TextGoing'),r.status===1);show(find(rect,'ResultGroup/TextNotStarted'),r.status===0)});
   show(find(info,'Block'),rows.every(r=>r.status===2));col.append(tag,info);box.appendChild(col)}
  vp.appendChild(box);
 }
 // Nhiệm vụ
 function openQuest(){
  popups.find(p=>p.classList.contains('nv-quest'))?.remove();popups=popups.filter(p=>p.isConnected);
  const el=popup('NovaPopupQuest','nv-quest'),list=[...st.quests].sort((a,b)=>(a.status===1?-1:a.status===2?1:0)-(b.status===1?-1:b.status===2?1:0));
  rowsInto(find(el,'Content/LayoutGroup/PopupMid/ScrollView'),'NovaQuestCell',740,100,list,(cell,q)=>{text(find(cell,'TextDesc'),q.title);text(find(cell,'SliderProgress/TextProgress'),`${q.number}/${q.target}`);
   const fill=find(cell,'SliderProgress/Fill Area/Fill');if(fill)fill.style.width=Math.min(100,q.number/q.target*100)+'%';
   html(find(cell,'ScrollViewReward/Viewport'),`<div class="nv-row">${tiles(q.rewards)}</div>`);const b=find(cell,'ButtonClaim');show(b,q.status===1);b.dataset.quest=q.id;show(find(cell,'CheckCompleted'),q.status===2)});
 }
 // Cửa hàng (MARKET 19): đổi bằng Huy hiệu Siêu Tân Tinh
 function openShop(){
  popups.find(p=>p.classList.contains('nv-shop'))?.remove();popups=popups.filter(p=>p.isConnected);
  const el=popup('NovaPopupShop','nv-shop'),have=c.player().inventory?.[st.currency]||0;
  text(find(el,'Content/GroupAsset/FieldFee/TextValue'),c.short(have));img(find(el,'Content/GroupAsset/FieldFee/IconAsset'),c.assetSrc(c.items.get(st.currency)?.assetKey));
  show(find(el,'Content/GroupRefresh'),false);show(find(el,'Content/ButtonRefresh'),false);
  const vp=find(el,'Content/ScrollView/Viewport');vp.innerHTML=`<div class="nv-shop-list">${st.shop.map(s=>{const left=s.limit-s.bought;return `<div class="nv-shop-row">${c.eventTile(s.reward,'nv-tile')}<div><b>${esc(c.items.get(s.reward.itemId)?.name||{gold:'Vàng',diamonds:'Kim cương'}[s.reward.itemId]||s.reward.itemId)}</b><small>Còn ${left}/${s.limit} lần</small></div><button type="button" class="nv-buy" data-shop="${s.id}" ${left>0?'':'disabled'}>${c.img(c.items.get(st.currency)?.assetKey,'','')}${c.short(s.price)}</button></div>`}).join('')}</div>`;
 }
 // Dự đoán vòng 16 (NovaPopupPredict / NovaPredictCell)
 let predictTab='r16';
 function openPredict(tab=null){
  popups.find(p=>p.classList.contains('nv-predict'))?.remove();popups=popups.filter(p=>p.isConnected);
  const br=st.bracket;if(!br)return c.toast('Chưa có bảng đấu vòng 16.');
  const el=popup('NovaPopupPredict','nv-predict'),mid=find(el,'Content/LayoutGroup/PopupMid'),rounds=['r16','qf','sf','final'].filter(r=>br[r]?.some(m=>m.a&&m.b));predictTab=tab||rounds.find(r=>br[r].some(m=>!m.winner))||rounds.at(-1)||'r16';
  tabsInto(find(mid,'BracketScrollView'),rounds.map(r=>({id:r,label:stageText(5+['r16','qf','sf','final'].indexOf(r))})),predictTab,'predictTab');
  const list=(br[predictTab]||[]).filter(m=>m.a&&m.b),first=list.find(m=>!m.winner);
  text(find(mid,'Label/Title'),first?'Đóng dự đoán sau:':'Đã kết thúc');countdown(find(mid,'Label/TextTime'),first?Math.max(0,(first.at-now())/1000):0);
  rowsInto(find(mid,'ScrollView'),'NovaPredictCell',684,130,list,(cell,m)=>{cell.dataset.match=m.id;
   for(const [side,e,n] of [['OppLeft',m.a,m.betsA],['OppRight',m.b,m.betsB]]){const s=find(cell,side);avatar(s,e);text(find(s,'FrameLike/TextRate'),n);show(find(s,'WinIcon'),!!m.winner&&m.winner===e.id);show(find(s,'LoseIcon'),!!m.winner&&m.winner!==e.id);
    s.dataset.pick=e.id;s.classList.add('nv-pick');if(m.mine===e.id)s.classList.add('on')}
   const b=find(cell,'ButtonChange');show(b,!m.mine&&!m.winner&&st.state<=2);});
  html(find(mid,'GroupReward/GCorrect'),tiles(st.rewards.bet.correct),'nv-greward');html(find(mid,'GroupReward/GWrong'),tiles(st.rewards.bet.wrong),'nv-greward');
 }
 // Buff tướng đề xuất
 function openBuff(){
  const el=popup('NovaBuffPopup','nv-buff'),holder=find(el,'Content/BuffInfo'),line=find(holder,'NovaBuffLine'),names={100:'Công',101:'Thủ',102:'Máu',103:'Tốc độ'};
  for(const [id,v] of st.buff){const l=line.cloneNode(true);l.style.display='';text(find(l,'Text'),names[id]||('Chỉ số '+id));text(find(l,'Label'),'+'+v/10+'%');holder.appendChild(l)}
 }
 // Vinh danh (NovaTop)
 let topData=null,topSeason=0;
 async function openTop(){
  topData=await c.api('/api/nova/top');if(!topData.length)return c.toast('Chưa có xếp hạng');topSeason=topData[0].season;fillTop();
 }
 function fillTop(){
  const el=mount('NovaTop','nv-top'),s=topData.find(x=>x.season===topSeason)||topData[0];
  tabsInto(find(el,'Content/Body/SeasonScrollView'),topData.map(x=>({id:x.season,label:'Mùa '+x.season})),s.season,'topSeason');
  show(find(el,'Content/Body/TextBar'),true);show(find(el,'Content/Header/AnchorTopRight/GroupBtn'),false);show(find(el,'Content/Header/BoxTime'),false);
  s.players.forEach((p,i)=>{const t=find(el,'Content/Body/T'+(i+1));show(t,true);avatar(find(t,'PlayerGroup'),p);text(find(t,'BarLike/TextLike'),p.likes);
   const like=find(t,'LikeBtn');like.dataset.like=p.id;show(find(like,'Liked'),st.likes.includes(p.id));spineHero(t,p.heads?.[0]?.avatar||p.avatar,{scale:.75})});
 }

 // ---- Click
 async function onClick(e){
  const b=e.target.closest('.nv-pick')||e.target.closest('[data-name="ButtonChange"]')||e.target.closest('.pd-button,[data-rank-stage],[data-record-stage],[data-reward-tab],[data-predict-tab],[data-top-season],[data-shop]');if(!b)return;
  if(e.target.closest('.ev-tile')&&!b.dataset.shop)return;e.stopPropagation();
  const name=b.dataset.name,host=b.closest('.nv-popup,.nv-root');
  try{
   if(b.dataset.rankStage)return openRank(Number(b.dataset.rankStage));
   if(b.dataset.recordStage)return openRecord(Number(b.dataset.recordStage));
   if(b.dataset.rewardTab!==undefined)return openReward(Number(b.dataset.rewardTab));
   if(b.dataset.predictTab)return openPredict(b.dataset.predictTab);
   if(b.dataset.topSeason){topSeason=Number(b.dataset.topSeason);return fillTop()}
   if(b.dataset.shop){const s=st.shop.find(x=>x.id===Number(b.dataset.shop));if(await window.GameMessage.ask(`Đổi ${s.price} Huy hiệu Siêu Tân Tinh lấy vật phẩm này?`,'Cửa hàng Tân Tinh')){const r=await post('/api/nova/shop',{id:s.id,count:1});if(r){await refresh();openShop()}}return}
   // Dự đoán: bấm người chơi để chọn, bấm "Dự đoán" (ButtonChange) để xác nhận.
   if(b.classList.contains('nv-pick')||name==='ButtonChange'){const cell=b.closest('[data-match]');if(!cell)return;const m=Object.values(st.bracket).flat().find(x=>x.id===cell.dataset.match);if(!m||m.mine||m.winner||st.state>2&&now()>=m.at)return;
    if(b.classList.contains('nv-pick')){for(const x of cell.querySelectorAll('.nv-pick'))x.classList.toggle('on',x===b);cell.dataset.pending=b.dataset.pick;return}
    const who=[m.a,m.b].find(x=>x.id===cell.dataset.pending);if(!who)return c.toast('Chọn người chơi bạn dự đoán sẽ thắng.');
    if(await window.GameMessage.ask(`Dự đoán ${who.name} thắng trận này?`,'Dự đoán')){const r=await post('/api/nova/bet',{matchId:m.id,pick:who.id});if(r){c.toast('Dự đoán thành công');await refresh();openPredict(predictTab)}}return}
   if(name==='ButtonClose'&&host?.classList.contains('nv-popup'))return closePopup(host);
   if(name==='BackGroundBlur'||name==='Close'){if(host?.classList.contains('nv-popup'))closePopup(host);return}
   if(name==='ButtonBack'&&host?.classList.contains('nv-shop'))return closePopup(host);
   if(name==='ButtonClose'){if(screenName==='NovaRoot')return close();return openRoot()}
   if(name==='ButtonHelp')return c.help();
   if(name==='MainBar'){
    if(st.status===0||st.status===-1)return teamPicker();
    if(st.status>=1&&st.status<=4){if(!st.board?.group)return c.toast(st.power?'Không đủ điều kiện tham gia':'Không đăng kí tham gia');return openBattle()}
    if(st.status===5)return openBracket();return}
   if(name==='ButtonFOM')return teamPicker();
   if(name==='ButtonAttack'){const id=b.closest('[data-opp]').dataset.opp,r=await post('/api/nova/attack',{opponentId:id});if(r){const n=r.result.nova;c.toast(`${n.win?'Thắng':'Thua'} ${n.score[0]}:${n.score[1]} · `+n.bouts.map(x=>`Đội ${x.team}: ${x.win?'thắng':'thua'}`).join(', '));return openBattle()}return}
   if(name==='ButtonAttackDisabled')return c.toast(st.state===1?'Đang trong thời gian chuẩn bị':'Đang trong thời gian đánh tự động');
   if(name==='ButtonClaim'){const r=await post('/api/nova/quest',{id:Number(b.dataset.quest)});if(r){await refresh();openQuest()}return}
   if(name==='LikeBtn'){const id=b.dataset.like;if(st.likes.includes(id))return c.toast('Bạn đã thích người chơi này.');const r=await post('/api/nova/like',{entryId:id});if(r){await refresh();topData=await c.api('/api/nova/top');fillTop()}return}
   if(name==='ButtonRank')return openRank();
   if(name==='ButtonSchedule')return openSchedule();
   if(name==='ButtonHistory')return openRecord();
   if(name==='ButtonReward')return openReward();
   if(name==='ButtonPredict')return st.bracket?openPredict():c.toast('Chưa tới vòng 16.');
   if(name==='ButtonGlory')return openTop();
   if(name==='ButtonShop')return openShop();
   if(name==='ButtonQuest')return openQuest();
   if(name==='BtnInfo')return openBuff();
  }catch(err){c.toast(err.message)}
 }
 // Đội hình 3 đội (PopupFormation3 của Chiến trường): lưu = đăng ký.
 function teamPicker(){
  if(c.player().account.level<st.minLevel)return c.toast(`Yêu cầu cấp ${st.minLevel} trở lên.`);
  window.ArenaUI.pickThree(st.team,'Đội hình Tân Tinh',async teams=>{const r=await post('/api/nova/team',{teams});if(!r)return false;c.toast(r.result.message);await reopen();return true});
 }
 async function reopen(){if(!screen)return;const name=screenName;await refresh();if(name==='NovaBattle'&&st.status>=1&&st.status<=4)return openBattle();if(name==='NovaBracket'&&st.status===5)return openBracket();if(name==='NovaTop')return openTop();return openRoot()}
 function close(){clearInterval(timer);for(const p of popups)p.remove();popups=[];screen?.remove();screen=null}
 async function open(context){
  c=context;await load();
  try{await refresh()}catch(e){return c.toast(e.message)}
  if(st.status===-1){const top=await c.api('/api/nova/top');if(top.length&&top[0].players.length){topData=top;topSeason=top[0].season;return fillTop()}}
  return openRoot();
 }
 let loading=null;
 function load(){return data?Promise.resolve(data):loading??=fetch('nova.json').then(r=>r.json()).then(d=>data=d)}
 window.NovaUI={open,close,load,isOpen:()=>!!screen,data:()=>data};
})();
