/* Chiến trường (ArenaScene gốc) dựng nguyên scene / prefab bằng PrefabDOM:
 *   ArenaScene (8)            sảnh: Đơn đấu / Liên đấu / Võ đấu, thời gian, yêu cầu cấp, chấm đỏ còn vé.
 *   CrystalCrownScene (20)    Đơn đấu - Giải thách đấu; TrialOfChampionScene (33) Liên đấu - Giải liên đấu;
 *   AllStarsLeagueScene (5)   Võ đấu - Đấu trường Corrida (tab Hạng / Điểm, Vô song, Lịch sử cược, lượt đánh).
 *   PopupArenaRival (1329) Đối thủ, PopupArenaBattleRecord (1374) Chiến sử, PopupArenaReward (1333) Phần thưởng,
 *   PopupRewardTrailOfChampion (1396) thưởng Liên đấu, PopupAllStarsReward (1014) thưởng Võ đấu,
 *   PopupFormation (1112) / PopupFormation3 (1104) Đội hình thủ, PopupPlayerInfo (1007) thông tin đối thủ,
 *   PopupAllStarsResult (1450) / PopupAllStarsTop8 (1434) Vô song, PopupAllStarBet (1051) cược, PopupAllStarBetHistory (1432).
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,data=null,root=null,layers=[],mode=null,scene=null,timer=null,tab='rank',draft=null,selectedRow=0;
 const cache={};
 const load=()=>data?Promise.resolve(data):fetch('arena.json').then(r=>r.json()).then(d=>data=d);
 const sceneJson=id=>cache[id]??=fetch(`scenes/${id}.json`).then(r=>{if(!r.ok)throw Error('Không tải được giao diện.');return r.json()});
 // ---- Cây prefab
 const kid=(n,path)=>path.split('/').reduce((x,p)=>x&&(x.children||[]).find(k=>k.name===p),n);
 const deep=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=deep(k,name);if(r)return r}return null};
 const all=(n,name,out=[])=>{if(!n)return out;if(n.name===name)out.push(n);for(const k of n.children||[])all(k,name,out);return out};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const pic=(n,key)=>{const x=comp(n,'Image');if(x&&key)x.asset=key};
 const clone=n=>structuredClone(n);
 const tag=(n,value)=>{if(n)n.arena=value;return n};
 // Danh sách cuộn: Content kéo theo bề ngang Viewport, ô giãn đủ rộng (VerticalPoolGroup của bản gốc), cao theo số ô.
 const rows=(content,list,{spacing=6,padding=[0,0,4,4]}={})=>{
  const height=list.reduce((n,x)=>n+(x.transform?.m_SizeDelta?.y||0),0)+spacing*Math.max(0,list.length-1)+padding[2]+padding[3];
  content.transform={...content.transform,m_AnchorMin:{x:0,y:1},m_AnchorMax:{x:1,y:1},m_Pivot:{x:.5,y:1},m_AnchoredPosition:{x:0,y:0},m_SizeDelta:{x:0,y:height}};
  content.components=[{type:'VerticalLayoutGroup',spacing,padding,align:1,controlWidth:true,forceWidth:true}];content.children=list;
 };
 const head=avatar=>c.heroHead(avatar)||c.named('item_transparent');
 const fmt=ms=>{ms=Math.max(0,ms);const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=String(Math.floor(s%86400/3600)).padStart(2,'0'),m=String(Math.floor(s%3600/60)).padStart(2,'0'),x=String(s%60).padStart(2,'0');return(d?d+' ngày ':'')+`${h}:${m}:${x}`};
 const ago=at=>{const s=Math.max(0,(Date.now()-new Date(at).getTime())/1000);return s<60?'Vừa xong':s<3600?Math.floor(s/60)+' phút trước':s<86400?Math.floor(s/3600)+' giờ trước':Math.floor(s/86400)+' ngày trước'};
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const sprite=name=>data.sprites[name]||c.named(name);
 // Canvas của scene có scale 0 / size 0 (CanvasScaler co giãn lúc chạy): đặt lại phủ khung 1136×640.
 const canvasOf=s=>{const n=clone(s.roots.find(r=>r.name==='Canvas'));n.transform={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5},m_LocalScale:{x:1,y:1,z:1}};n.components=[];return n};
 function avatar(n,e){if(!n)return;pic(deep(n,'ImageAvt'),head(e.avatar));txt(deep(n,'TextLevel'),e.level??'');on(deep(n,'EffectSpecial'),false)}

 // ---- Lớp hiển thị: màn chính (root) và các popup chồng lên.
 function mount(node,cls,{popup=false}={}){
  const el=D.render(node,W,H,opts());el.classList.add('arena-layer',...cls.split(' '));if(popup)el.classList.add('arena-popup');
  el.addEventListener('click',e=>onClick(e,el));c.layer().appendChild(el);
  if(popup)layers.push(el);else{root?.remove();root=el}
  return el;
 }
 const closeTop=()=>{layers.pop()?.remove()};
 const closeAll=()=>{for(const l of layers)l.remove();layers=[];root?.remove();root=null;clearInterval(timer);timer=null;mode=null;scene=null};
 function popupShell(n){const shade={id:'shade',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.6]},{type:'Button'}],transform:{m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0}},children:[]};tag(shade,{act:'close'});return{id:'popup',name:'ArenaPopup',active:true,components:[],transform:{m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0}},children:[shade,n]}}
 const html=(el,path,markup)=>{const host=typeof path==='string'?D.find(el,path):path;if(host){const box=document.createElement('div');box.className='arena-html';box.innerHTML=markup;host.appendChild(box);return box}return null};
 const tiles=list=>list.map(r=>c.rewardTile(r)).join('');

 // ---- Sảnh Chiến trường
 const boxes=[['BoxCrystalCrown','solo',1,'NotifyCrystal'],['BoxTrialChampion','league',2,'NotifyTrial'],['BoxAllStarsLeague','allstars',3,null]];
 const descs={solo:'Yêu cầu cấp độ 14',league:'Yêu cầu người chơi cấp độ 55\ntrở lên.',allstars:'Thiên hạ võ đấu liên server.\nYêu cầu cấp 80 để tham dự.'};
 async function openHub(){
  const [s,hub]=await Promise.all([sceneJson(8),c.api('/api/arena'),load()]);const n=canvasOf(s),skew=Date.now()-hub.now;
  tag(deep(n,'ButtonBack'),{act:'leave'});tag(deep(n,'ButtonShop'),{act:'shop'});on(deep(n,'NotifyShop'),false);
  for(const [name,id,i,notify] of boxes){
   const box=deep(n,name),m=hub.modes.find(x=>x.id===id);tag(box,{act:'mode',mode:id});comp(box,'Button')||box.components.push({type:'Button'});
   txt(deep(box,'TextTitle'),m.name);txt(deep(box,'TextTimeCap'+i),m.label+(id==='allstars'?'':''));txt(deep(box,'TextDesc'+i),descs[id]);
   const time=deep(box,'TextTime'+i);time.arenaTime=m.endsAt+skew;txt(time,fmt(m.endsAt-hub.now));
   on(kid(box,'ButtonJoin'),false);tag(deep(box,'ButtonTopLast'+({solo:'Crystal',league:'Trial',allstars:''})[id]),{act:'last',mode:id});
   if(notify)on(deep(box,notify),m.open&&(c.player().arena?.tickets||0)>0);
  }
  const el=mount(n,'arena-hub');scene='hub';tick(el);
 }
 function tick(el){clearInterval(timer);const update=()=>{for(const t of el.querySelectorAll('.pd-node')){const at=t._node?.arenaTime;if(at)D.setText(t,fmt(at-Date.now()))}};update();timer=setInterval(()=>{if(!root?.isConnected){clearInterval(timer);return}update()},1000)}

 // ---- Màn từng chế độ
 const sceneIds={solo:20,league:33,allstars:5},titles={solo:'Giải thách đấu',league:'Giải liên đấu',allstars:'Đấu trường Corrida'};
 async function openMode(m){
  mode=m;const [s,v]=await Promise.all([sceneJson(sceneIds[m]),c.api(`/api/arena/${m}${m==='allstars'?'?by='+(tab==='rank'?'rank':'points'):''}`),load()]);
  if(v.locked){c.toast(`Yêu cầu người chơi cấp độ ${v.minLevel} trở lên.`);if(!root)await openHub();return}
  const n=canvasOf(s),skew=Date.now()-v.now,me=v.me,a=c.player().arena||{};
  txt(deep(n,'TextArena'),titles[m]);
  if(m==='allstars'){txt(deep(n,'TextCaption'),v.phase.label);const t=deep(n,'TextCoutdown');t.arenaTime=v.phase.next+skew;txt(t,fmt(v.phase.next-v.now))}
  else{txt(deep(n,'TextRemain'),'Thời gian còn lại');const t=deep(n,'TextCoutdown');t.arenaTime=v.endsAt+skew;txt(t,fmt(v.endsAt-v.now))}
  // Danh sách xếp hạng
  const tpl=deep(n,'CellTopArena'),content=kid(deep(n,'ScrollTop'),'Viewport/Content');on(tpl,false);
  rows(content,v.top.map(e=>{const cell=on(clone(tpl));tag(cell,{act:'player',id:e.id});
   const rank=m==='allstars'&&tab==='rank'?e.ladder:e.rank;pic(cell,sprite(rank===1?'cell_arena_1':rank===2?'cell_arena_2':'cell_arena_3'));
   on(kid(cell,'TagRank'),rank<=3);if(rank<=3)pic(kid(cell,'TagRank'),sprite('tag_'+rank));txt(kid(cell,'TextRank'),rank);
   avatar(kid(cell,'PlayerAvatar'),e);txt(kid(cell,'TextPlayername'),e.name);txt(deep(cell,'TextPower'),c.num(e.power));
   txt(kid(cell,'TextPointCap'),'Điểm');txt(deep(cell,'TextPoint'),m==='allstars'?c.num(e.apoints):c.num(e.points));
   return cell}),{spacing:6,padding:[0,0,6,6]});
  if(m==='allstars'){
   const tabs=deep(n,'TabTop');for(const [b,id] of [['ButtonTabRank','rank'],['ButtonTabPoint','points']]){const btn=kid(tabs,b);tag(btn,{act:'tab',tab:id});on(kid(btn,'ImageOn'),tab===id);on(kid(btn,'ImageOff'),tab!==id);for(const x of ['ImageOn','ImageOff'])txt(kid(btn,x+'/Text'),id==='rank'?'Hạng':'Điểm')}
  }
  // Ô thông tin bản thân
  const box=deep(n,'BoxInside');txt(deep(box,'TextName'),me.name);avatar(deep(box,'PlayerAvatar'),me);txt(deep(box,'TextPower'),c.num(me.power||0));
  txt(kid(box,'Ranking'),'Hạng:');txt(deep(box,'TextRanking'),(m==='allstars'?me.ladder:me.rank)||'-');txt(kid(box,'Point'),'Điểm:');txt(deep(box,'TextPoint'),c.num(m==='allstars'?me.apoints:me.points));
  const battle=deep(n,'ButtonBattle');tag(battle,{act:'rivals'});txt(kid(battle,'Text'),'Chiến đấu');
  if(m==='allstars'){
   txt(deep(n,'TextNumAttack'),Math.max(0,a.attacksLeft??0));tag(deep(deep(n,'FieldNumAtk'),'ButtonBuy'),{act:'buy',kind:'attack'});
   const ko=deep(n,'ButtonKnockout');tag(ko,{act:'knockout'});txt(kid(ko,'Text'),'Vô song');const bh=deep(n,'ButtonBetHistory');tag(bh,{act:'bets'});txt(kid(bh,'Text'),'Lịch sử cược');
   // Như bản gốc: vòng bảng có Chiến đấu + lượt đánh; tới Vô song đổi thành nút Vô song + Lịch sử cược ở cùng chỗ.
   const group=v.phase.phase==='group';on(ko,!group);on(bh,!group);on(battle,group);on(deep(n,'FieldNumAtk'),group);
  }else{txt(deep(n,'TextTicket'),a.tickets??0);tag(deep(deep(n,'FieldTicket'),'ButtonBuy'),{act:'buy',kind:'ticket'})}
  tag(deep(n,'ButtonDefensive'),{act:'defense'});tag(deep(n,'ButtonRecord'),{act:'records'});tag(deep(n,'ButtonReward'),{act:'rewards'});
  tag(deep(n,'ButtonBack'),{act:'hub'});tag(deep(n,'ButtonHelp'),{act:'help'});
  scene=v;const el=mount(n,'arena-mode');el.dataset.mode=m;tick(el);
 }

 // ---- Đối thủ
 async function openRivals(refresh=false){
  if(mode==='allstars'&&scene?.phase?.phase!=='group')return c.toast('Vòng bảng đã kết thúc');
  const [s,v]=await Promise.all([sceneJson(1329),refresh?c.post(`/api/arena/${mode}/rivals`,{}):c.api(`/api/arena/${mode}/rivals`)]);
  const n=clone(s.roots[0]);txt(deep(n,'TextTitle'),'Đối thủ');tag(deep(n,'ButtonClose'),{act:'close'});
  const refreshBtn=deep(n,'ButtonRefresh');tag(refreshBtn,{act:'refresh'});txt(kid(refreshBtn,'Text'),'Làm mới');txt(deep(kid(n,'PanelBody/BoxInfo'),'TextPower'),c.num(v.power));
  const tpl=deep(n,'CellArenaRival'),content=deep(deep(n,'ScrollView'),'Content');on(tpl,false);
  rows(content,v.rivals.map(e=>{const cell=on(clone(tpl));avatar(kid(cell,'PlayerAvatar'),e);tag(kid(cell,'PlayerAvatar'),{act:'player',id:e.id});txt(kid(cell,'TextPlayerName'),e.name);
   txt(kid(cell,'TextPointCap'),mode==='allstars'?'Hạng':'Điểm');txt(deep(cell,'TextPoint'),mode==='allstars'?e.ladder:c.num(e.points));txt(deep(cell,'TextPower'),c.num(e.power));
   const b=kid(cell,'ButtonBattle');tag(b,{act:'fight',id:e.id});txt(kid(b,'Text'),'Chiến đấu');txt(deep(b,'TextCost'),1);return cell}),{spacing:8,padding:[0,0,8,8]});
  if(refresh)closeTop();mount(popupShell(n),'arena-rivals',{popup:true});
 }
 async function fight(opponentId,{revenge=false}={}){
  const data=await c.mutation(`/api/arena/${mode}/fight`,{opponentId,revenge},{message:false,bonus:false,render:false});if(!data)return;
  if(mode==='league'){closeTop();const r=data.result.arena;await leagueResult(r);return openMode(mode)}
  if(data.player.battle?.status==='active'){const m=mode;closeAll();c.setReturn(m);c.navigate(9)}
 }
 function leagueResult(r){
  const lines=r.bouts.map(b=>`<li class="${b.win?'win':'lose'}"><span>Đội ${b.team}</span><b>${b.win?'Thắng':'Thua'}</b></li>`).join('');
  c.modal(r.win?'CHIẾN THẮNG':'THẤT BẠI',`<div class="arena-league-result ${r.win?'win':'lose'}"><p class="arena-score">${r.score[0]} - ${r.score[1]}</p><ol>${lines}</ol><p>Điểm: <b>${r.delta>0?'+':''}${r.delta??0}</b></p></div>`);
 }

 // ---- Chiến sử
 async function openRecords(){
  const [s,v]=await Promise.all([sceneJson(1374),c.api(`/api/arena/${mode}/records`)]);
  const n=clone(s.roots[0]);txt(deep(n,'TextTitle'),'Chiến sử');tag(deep(n,'ButtonClose'),{act:'close'});
  const tpl=deep(n,'CellArenaBattleRecord'),content=deep(deep(n,'ScrollView'),'Content');on(tpl,false);
  rows(content,v.records.map(r=>{const cell=on(clone(tpl));pic(kid(cell,'IconDefenderAttacker'),sprite((r.attack?'attack_':'defend_')+(r.win?'win':'lose')));
   txt(kid(cell,'TextWinLose'),r.win?'Thắng':'Thua');comp(kid(cell,'TextWinLose'),'Text').color=r.win?[.2,.75,.2,1]:[.9,.25,.2,1];
   avatar(deep(cell,'PlayerAvatar'),r.opponent);txt(kid(cell,'TextPlayerName'),r.opponent.name);txt(kid(cell,'TextTime'),ago(r.at));on(kid(cell,'ButtonPlay'),false);
   const rv=kid(cell,'ButtonRevenge');on(rv,r.revenge&&mode!=='allstars');tag(rv,{act:'revenge',id:r.opponent.id});txt(kid(rv,'Text'),'Báo thù');
   txt(kid(cell,'TextPointCap'),'Điểm');txt(deep(cell,'TextPoint'),(r.delta>0?'+':'')+r.delta);pic(deep(cell,'IconPoint'),sprite(r.delta>0?'rank_up':r.delta<0?'rank_down':'rank_same'));
   return cell}),{spacing:8,padding:[0,0,8,8]});
  const el=mount(popupShell(n),'arena-records',{popup:true});
  if(!v.records.length)html(el,'ScrollView','<p class="arena-empty">Chưa có trận đấu nào.</p>');
 }

 // ---- Phần thưởng
 let rewardTab='daily';
 async function openRewards(){
  await load();
  if(mode==='league')return leagueRewards();
  if(mode==='allstars')return allstarRewards();
  const s=await sceneJson(1333),n=clone(s.roots[0]);txt(deep(n,'TextTitle'),'Phần thưởng');tag(deep(n,'ButtonClose'),{act:'close'});
  const tabs=deep(n,'TabCrystalCrown');for(const [b,id,label] of [['ButtonTabDaily','daily','Thưởng ngày'],['ButtonTabSeason','season','Thưởng mùa']]){const btn=kid(tabs,b);tag(btn,{act:'rewardTab',tab:id});on(kid(btn,'ImageOn'),true);for(const x of ['ImageOn','ImageOff'])txt(kid(btn,x+'/Text'),label);btn.arenaOn=rewardTab===id}
  const detail=deep(n,'RewardDetail'),possible=on(clone(deep(detail,'CellArenaPossibleReward'))),tpl=deep(detail,'CellArenaReward'),content=deep(detail,'Content');
  on(deep(detail,'CellArenaPossibleReward'),false);on(tpl,false);const rank=scene.me.rank||0;
  txt(kid(possible,'TextReward'),`Hạng hiện tại ${rank}. Giữ hạng này để nhận phần thưởng vào cuối ${rewardTab==='daily'?'ngày':'mùa'}`);possible.arenaRewards=scene.rewards[rewardTab];
  const list=data.solo[rewardTab].map(r=>{const cell=on(clone(tpl));const top=r.from<=3&&r.from===r.to;on(kid(cell,'TagRank'),top);if(top)pic(kid(cell,'TagRank'),sprite('tag_'+r.from));txt(kid(cell,'TextRank'),top?r.from:r.rank.replace('3001-999999','3001+'));cell.arenaRewards=r.rewards;return cell});
  rows(content,[possible,...list],{spacing:10,padding:[0,0,6,6]});
  const el=mount(popupShell(n),'arena-rewards',{popup:true});fillRewards(el);markTabs(el);
 }
 function fillRewards(el){for(const node of el.querySelectorAll('.pd-node')){const list=node._node?.arenaRewards;if(!list)continue;const host=node.querySelector('[data-name="RewardContainer"]')||node.querySelector('[data-name="GroupReward"]')||node;html(host,host,`<div class="arena-reward-row">${tiles(list)}</div>`)}}
 function markTabs(el){for(const node of el.querySelectorAll('.pd-node')){if(node._node?.arenaOn===undefined)continue;const on=node._node.arenaOn;D.show(D.find(node,'ImageOn'),on);D.show(D.find(node,'ImageOff'),!on);node.classList.toggle('arena-tab-off',!on)}}
 async function leagueRewards(){
  const s=await sceneJson(1396),n=clone(s.roots[0]);txt(deep(n,'Title'),'Phần thưởng');tag(deep(n,'ButtonClose'),{act:'close'});
  const rank=scene.me.rank||0,preview=deep(n,'ItemRewardPreview');txt(kid(preview,'TextRank'),`Hạng ${rank}`);preview.arenaRewards=scene.rewards.season;
  txt(deep(n,'TextRankSeason'),`Hạng hiện tại: ${rank}`);txt(deep(n,'TitleReward'),'Phần thưởng sẽ được trao dựa trên thứ hạng của bạn khi mùa giải kết thúc.');
  const group=deep(n,'GroupReward');group.children=[];
  const el=mount(popupShell(n),'arena-rewards league',{popup:true});fillRewards(el);
  html(el,'GroupReward',`<div class="arena-reward-table">${data.league.season.map(r=>`<div class="arena-reward-line"><span class="arena-rank">${r.from<=3&&r.from===r.to?c.img(sprite('tag_'+r.from)):escapeRank(r.rank)}</span><div class="arena-reward-row">${tiles(r.rewards)}</div></div>`).join('')}</div>`);
 }
 const escapeRank=r=>c.escape(String(r).replace('3001-999999','3001+'));
 let allstarTab='season';
 async function allstarRewards(){
  const s=await sceneJson(1014),n=clone(s.roots[0]);txt(deep(n,'TextTitle'),'Phần thưởng');tag(deep(n,'ButtonClose'),{act:'close'});
  const tabs=deep(n,'TabCrystalCrown');for(const [b,id,label] of [['ButtonTabPointPerHour','points','Tính điểm'],['ButtonTabKnockOut','knockout','Vô song'],['ButtonTabSeason','season','Thưởng mùa']]){const btn=kid(tabs,b);tag(btn,{act:'allstarTab',tab:id});on(kid(btn,'ImageOn'),true);on(kid(btn,'ImageOff'),true);for(const x of ['ImageOn','ImageOff'])txt(kid(btn,x+'/Text'),label);btn.arenaOn=allstarTab===id}
  const detail=deep(n,'RewardDetail'),content=deep(detail,'Content'),cells={points:deep(detail,'CellPointPerHour'),season:deep(detail,'CellSeasonRewards'),knockout:deep(detail,'CellKnockOutRewards')};for(const x of Object.values(cells))on(x,false);
  let list;
  if(allstarTab==='points')list=data.allstars.points.map(r=>{const cell=on(clone(cells.points));const top=r.from<=3&&r.from===r.to;on(kid(cell,'TagRank'),top);if(top)pic(kid(cell,'TagRank'),sprite('tag_'+r.from));txt(kid(cell,'TextRank'),top?r.from:r.rank.replace('3001 - 999999','3001+'));txt(kid(cell,'TextPointPerHour'),`${r.perHour} điểm mỗi giờ`);return cell});
  else if(allstarTab==='knockout')list=data.allstars.knockout.map(r=>{const cell=on(clone(cells.knockout));txt(kid(cell,'TextTitle'),r.label);cell.arenaRewards=r.rewards;return cell});
  else list=data.allstars.season.map(r=>{const cell=on(clone(cells.season));txt(kid(cell,'TextPoint'),r.label);cell.arenaRewards=r.rewards;return cell});
  rows(content,list,{spacing:8,padding:[0,0,6,6]});
  const el=mount(popupShell(n),'arena-rewards allstars',{popup:true});fillRewards(el);markTabs(el);
 }

 // ---- Đội hình thủ: PopupFormation (1 đội) / PopupFormation3 (Liên đấu 3 đội).
 async function openDefense(){
  const three=mode==='league',s=await sceneJson(three?1104:1112),n=clone(s.roots[0]);
  draft??=structuredClone(c.player().arena.defense[mode]);selectedRow=Math.min(selectedRow,draft.length-1);
  const body=deep(n,'ImageBody');let title=kid(body,'TextTitle');txt(title,'Đội hình thủ');tag(deep(n,'ButtonClose'),{act:'defense-close'});
  txt(deep(n,'TextFront'),'Hàng trước');txt(deep(n,'TextBack'),'Hàng sau');txt(deep(n,'TextPet'),'Chiến hạm');
  const heroes=new Map(c.player().heroes.map(h=>[h.id,h]));let power=0;
  draft.forEach((slots,row)=>slots.forEach((id,i)=>{const node=deep(n,'SlotHero'+(i+1)+(row?row+1:''));if(!node)return;tag(node,{act:'slot',row,index:i});comp(node,'Button')||node.components.push({type:'Button'});const h=heroes.get(id);if(h){power+=h.stats.power;node.arenaHero=h}}));
  txt(deep(kid(body,'IconPower'),'TextPower'),c.num(power));
  // Nút hành động của prefab (Tấn công / Attack) là nút Lưu của đội hình thủ; danh sách tướng nằm trong PanelHeroList.
  const action=deep(n,'ButtonAction');tag(action,{act:'defense-save'});txt(deep(action,'Text'),'Lưu');on(deep(n,'PanelFilter'),false);on(deep(n,'ButtonFilter'),false);on(deep(n,'ToggleSkip'),false);
  if(three){for(const [name,from,to] of [['Button1Down',0,1],['Button2Up',1,0],['Button2Down',1,2],['Button3Up',2,1]])tag(deep(n,name),{act:'swap',from,to})}
  else{on(deep(n,'BoxAura'),false);const aura=deep(n,'BoxAuraNew');if(aura){on(deep(aura,'GroupContent'),false);const team=draft[0].map(id=>heroes.get(id)).filter(Boolean);all(aura,'GroupFaction').forEach(g=>g.children.forEach((f,i)=>{const h=team[i];if(h)pic(f,c.named('faction_'+c.faction(h.id)));on(f,!!h)}))}}
  const el=mount(popupShell(n),'arena-defense'+(three?' three':''),{popup:true});
  for(const node of el.querySelectorAll('.pd-node')){const h=node._node?.arenaHero;if(h)html(node,node,c.heroCard(h,{mini:true}));if(node._node?.arena?.act==='slot'&&node._node.arena.row===selectedRow&&three)node.classList.add('arena-row-on')}
  const used=new Set(draft.flat().filter(Boolean)),list=c.player().heroes.slice().sort((a,b)=>b.stats.power-a.stats.power);
  const strip=`<div class="arena-hero-strip">${list.map(h=>`<button class="arena-hero-pick ${used.has(h.id)?'used':''}" data-hero="${c.escape(h.id)}">${c.heroCard(h,{check:used.has(h.id)})}</button>`).join('')}</div>`;
  const host=D.find(el,'PanelHeroList/ScrollView')||D.find(el,'PanelHeroList');const box=html(host,host,strip);box.classList.add('in-list');
  box.addEventListener('click',e=>{const b=e.target.closest('[data-hero]');if(b){e.stopPropagation();pickHero(b.dataset.hero)}});
 }
 function pickHero(id){
  const at=draft.findIndex(r=>r.includes(id));
  if(at>=0)draft[at][draft[at].indexOf(id)]=null;
  else{let row=selectedRow,i=draft[row].indexOf(null);if(i<0){row=draft.findIndex(r=>r.includes(null));i=row<0?-1:draft[row].indexOf(null)}if(i<0)return c.toast('Đội hình đã đủ 6 tướng.');draft[row][i]=id}
  closeTop();openDefense();
 }
 async function saveDefense(){
  if(draft.some(r=>!r.some(Boolean)))return c.toast(mode==='league'?'Mỗi đội cần ít nhất một tướng.':'Hãy chọn ít nhất một tướng.');
  const d=await c.mutation('/api/arena/defense',{mode,teams:draft},{render:false});if(!d)return;draft=null;closeTop();openMode(mode);
 }

 // ---- Thông tin người chơi
 async function openPlayer(id){
  const [s,v]=await Promise.all([sceneJson(1007),c.api('/api/arena-player/'+encodeURIComponent(id))]);const n=clone(s.roots[0]);
  tag(deep(n,'ButtonClose'),{act:'close'});avatar(deep(n,'PlayerAvatar'),v);txt(deep(n,'TextPlayerName'),v.name);const idText=deep(n,'TextID');on(idText,true);txt(idText,v.shortId?'ID: '+v.shortId:'ID: ---');
  txt(deep(n,'TextGuildCap'),'Hạm đội: ---');on(deep(n,'TextGuildName'),false);
  // Mỗi đội một khối Lineup (Liên đấu 3 đội): ô 1-2 hàng trước (HeroHeadClickable1-2), ô 3-6 hàng sau (3-6).
  const body=deep(n,'Body'),tpl=deep(n,'Lineup'),at=body.children.indexOf(tpl);
  const lineups=v.teams.map((team,i)=>{const L=i?clone(tpl):tpl;txt(deep(L,'TextLineup'),v.teams.length>1?`Đội hình ${i+1}`:'Đội hình');txt(deep(kid(L,'IconPower'),'TextPower'),c.num(team.power));
   const heads=[...team.heads].sort((a,b)=>a.slot-b.slot),front=heads.filter(h=>h.slot<2),back=heads.filter(h=>h.slot>=2);
   for(let k=1;k<=6;k++){const cell=deep(L,'HeroHeadClickable'+k);if(!cell)continue;const h=k<=2?front[k-1]:back[k-3];on(cell,!!h);cell.arenaHero=h||null}
   return L});
  body.children.splice(at,1,...lineups);
  const actions=on(deep(n,'Actions')),mail=kid(actions,'Button1');tag(mail,{act:'mail'});txt(deep(mail,'TextAction1'),'Gửi thư');on(kid(actions,'Button2'),false);on(kid(actions,'Button3'),false);
  const el=mount(popupShell(n),'arena-player',{popup:true});
  for(const node of el.querySelectorAll('.pd-node')){const h=node._node?.arenaHero;if(h){node.innerHTML='';html(node,node,c.heroCard(h,{mini:true}))}}
 }

 // ---- Võ đấu: Vô song, cược
 async function openKnockout(){
  const [s,v]=await Promise.all([sceneJson(1450),c.api('/api/allstars/bracket')]);const n=clone(s.roots[0]);txt(deep(n,'TextTitle'),'Kết quả');tag(deep(n,'ButtonClose'),{act:'close'});
  for(const [b,id,label] of [['ButtonTop8','r16','Vòng 1/16'],['ButtonQuaterFinal','qf','Tứ Kết'],['ButtonSemiFinal','sf','Bán Kết'],['ButtonFinal','final','Chung Kết']]){
   const btn=deep(n,b),r=v.rounds.find(x=>x.id===id);tag(btn,{act:'round',round:id});txt(kid(btn,'Text'),label);
   const cap=deep(btn,'TextNextRefresh');txt(cap,'Đã kết thúc');on(cap,r.resolved);const t=deep(btn,'TextCountDownRefresh');if(!r.resolved){t.arenaTime=r.at+(Date.now()-v.now);txt(t,fmt(r.at-v.now))}else txt(t,'');
  }
  bracket=v;const el=mount(popupShell(n),'arena-knockout',{popup:true});tickPopup(el);
 }
 let bracket=null;
 function tickPopup(el){const t=setInterval(()=>{if(!el.isConnected)return clearInterval(t);for(const x of el.querySelectorAll('.pd-node')){const at=x._node?.arenaTime;if(at)D.setText(x,fmt(at-Date.now()))}},1000)}
 async function openRound(id){
  const s=await sceneJson(1434),n=clone(s.roots[0]),r=bracket.rounds.find(x=>x.id===id);txt(deep(n,'TextTitle'),r.name);tag(deep(n,'ButtonClose'),{act:'close'});
  const tpl=deep(n,'CellAllStarsTop8'),content=deep(deep(n,'ScrollView'),'Content');on(tpl,false);
  rows(content,r.matches.map(m=>{const cell=on(clone(tpl));for(const [k,e] of [['1',m.a],['2',m.b]]){avatar(kid(cell,'PlayerAvatar'+k),e||{avatar:null,level:''});txt(kid(cell,'TextPlayer'+k),e?.name||'---');txt(kid(cell,'TextGuild'+k),e?`Lực chiến ${c.num(e.power)}`:'')}
   const mid=kid(cell,'GroupMid');on(mid,!!m.winner);if(m.winner){const aWin=m.winner===m.a?.id;txt(kid(mid,'TextStatus1'),aWin?'Thắng':'Thua');txt(kid(mid,'TextStatus2'),aWin?'Thua':'Thắng')}
   on(kid(cell,'ButtonPlay'),false);const bet=kid(cell,'ButtonBet');on(bet,!m.winner&&m.a&&m.b);tag(bet,{act:'bet',match:m.id});return cell}),{spacing:8,padding:[0,0,8,8]});
  const el=mount(popupShell(n),'arena-round',{popup:true});
  if(!r.matches.length)html(el,'ScrollView','<p class="arena-empty">Chưa có danh sách thi đấu. Vô song bắt đầu khi vòng bảng kết thúc.</p>');
  for(const m of r.matches)if(m.bet||m.parity){const node=[...el.querySelectorAll('.pd-node')].find(x=>x._node?.arena?.match===m.id);if(node)html(node.parentElement,node.parentElement,`<span class="arena-bet-tag">${m.bet?'Cược: '+(m.bet==='even'?'Chẵn':'Lẻ'):''}${m.parity?' · Kết quả: '+(m.parity==='even'?'Chẵn':'Lẻ'):''}</span>`)}
 }
 let betPick='even',lastBet=null;
 async function openBet(matchId){
  lastBet=matchId;const s=await sceneJson(1051),n=clone(s.roots[0]),m=bracket.rounds.flatMap(r=>r.matches).find(x=>x.id===matchId);if(!m)return;
  txt(deep(n,'TextTile'),'Trận đấu');tag(deep(n,'ButtonClose'),{act:'close'});txt(deep(n,'TextGuildCoin'),c.num(c.player().inventory[c.player().arena.betItem]||0));pic(deep(n,'IconGuildCoin'),c.items.get(c.player().arena.betItem)?.assetKey);
  const place=deep(n,'PlaceABet');txt(kid(place,'TextTile'),'Tổng sát thương của tướng có sát thương cao nhất trong trận cuối là chẵn hay lẻ?');on(kid(place,'TextNote'),true);txt(kid(place,'TextNote'),'(*) Trận cuối là trận kết thúc của loạt đấu 3 trận');
  for(const [b,id,label] of [['ButtonEven','even','Chẵn'],['ButtonOdd','odd','Lẻ']]){const btn=deep(place,b);tag(btn,{act:'pick',pick:id});txt(kid(btn,'Text'),label);on(kid(btn,'ImageOn'),betPick===id);on(kid(btn,'ImageOff'),betPick!==id);txt(deep(btn,'TextCoin'),c.num(c.player().arena.betAmount*2));pic(deep(btn,'ImageCoin'),c.items.get(c.player().arena.betItem)?.assetKey)}
  const ok=deep(place,'ButtonOk');tag(ok,{act:'bet-ok',match:matchId});txt(kid(ok,'Text'),'Đặt cược');
  for(const [k,e] of [['1',m.a],['2',m.b]]){avatar(deep(n,'BoxAvatar'+k),e);txt(deep(deep(n,'Player'+k),'TextNamePlayer'),e.name);txt(deep(deep(n,'Player'+k),'TextGuild'),`Lực chiến ${c.num(e.power)}`)}
  mount(popupShell(n),'arena-bet',{popup:true});
 }
 async function openBets(){
  const [s,v]=await Promise.all([sceneJson(1432),c.api('/api/allstars/bracket')]);const n=clone(s.roots[0]);bracket=v;
  txt(deep(n,'TextTile'),'Lịch sử cược');txt(deep(n,'TextMatch'),'Trận đấu');on(deep(n,'Bet'),true);txt(deep(n,'Bet'),'Cược');txt(deep(n,'Result'),'Kết quả');tag(deep(n,'ButtonClose'),{act:'close'});
  const tpl=deep(n,'CellBetHistory'),content=deep(n,'Content'),matches=new Map(v.rounds.flatMap(r=>r.matches).map(m=>[m.id,m]));on(tpl,false);
  rows(content,v.bets.map(b=>{const m=matches.get(b.matchId)||{},cell=on(clone(tpl));for(const [k,e] of [['1',m.a],['2',m.b]]){avatar(kid(cell,'PlayerAvatar'+k),e||{});txt(kid(cell,'TextPlayer'+k),e?.name||'---');txt(kid(cell,'TextGuild'+k),'')}
   txt(deep(cell,'TextBet'),b.pick==='even'?'Chẵn':'Lẻ');txt(deep(cell,'TextResult'),b.settled?(b.result?(b.result===b.pick?'Thắng':'Thua'):'Hoàn cược'):'Chờ');txt(deep(cell,'TextNumberBet'),c.num(b.amount));return cell}),{spacing:6,padding:[0,0,6,6]});
  const el=mount(popupShell(n),'arena-bets',{popup:true});if(!v.bets.length)html(el,'PanelBetHistory','<p class="arena-empty">Bạn chưa đặt cược trận nào.</p>');
 }

 // ---- Trợ giúp / mua vé / top mùa trước
 const helps={
  solo:['Đơn đấu - Giải thách đấu','Mỗi lần khiêu chiến tốn 1 Giấy Thách Đấu. Mỗi ngày lúc 21:00 (UTC/GMT 0) được bổ sung đủ 10 giấy.','Thắng được cộng điểm, thua bị trừ điểm. Thắng người có điểm cao hơn được nhiều điểm hơn. Đội hình thủ là đội người khác gặp khi khiêu chiến bạn.','Phần thưởng ngày trao lúc 21:00 (UTC/GMT 0) theo hạng hiện tại, phần thưởng mùa trao khi mùa giải kết thúc (Chủ nhật 21:00 UTC).'],
  league:['Liên đấu - Giải liên đấu','Xếp 3 đội hình thủ, mỗi tướng chỉ ở một đội. Khi khiêu chiến, 3 đội của bạn lần lượt đấu với 3 đội của đối thủ; thắng 2 trận là thắng.','Mỗi lần khiêu chiến tốn 1 Giấy Thách Đấu. Phần thưởng trao theo thứ hạng khi mùa giải kết thúc.'],
  allstars:['Võ đấu - Đấu trường Corrida','Vòng bảng: khiêu chiến người có hạng cao hơn, thắng thì đổi hạng. Mỗi giờ được cộng điểm theo hạng hiện tại.','Hết vòng bảng (thứ Sáu 21:00 UTC), 16 người hạng cao nhất vào Vô song: Vòng 1/16, Tứ Kết, Bán Kết, Chung Kết, mỗi cặp đánh loạt 3 trận.','Đặt cược trận Vô song: đoán tổng sát thương của tướng có sát thương cao nhất trong trận cuối là chẵn hay lẻ. Đoán đúng nhận gấp đôi.','Thưởng mùa theo điểm tích lũy, thưởng Vô song theo vòng đạt được.'],
 };
 function help(){const [title,...lines]=helps[mode];c.modal(title,lines.map(l=>`<p class="item-description">${c.escape(l)}</p>`).join(''))}
 function buy(kind){const a=c.player().arena,price=kind==='attack'?a.attackPrice:a.ticketPrice,left=kind==='attack'?a.attackBuyLeft:a.ticketBuyLeft;
  if(left<=0)return c.toast('Đã hết lượt mua hôm nay.');
  c.confirm(kind==='attack'?`Mua thêm 1 lượt đánh Võ đấu? (Còn ${left} lượt mua hôm nay)`:`Mua 1 Giấy Thách Đấu? (Còn ${left} lượt mua hôm nay)`,kind==='attack'?'Mua lượt đánh':'Mua Giấy Thách Đấu',price,async()=>{const d=await c.mutation('/api/arena/buy',{kind,count:1},{render:false,bonus:false});if(d)openMode(mode)})}
 async function lastTop(m){const v=await c.api(`/api/arena/${m}/last`);c.modal(m==='solo'?'Top thách đấu mùa trước':m==='league'?'Top liên đấu mùa trước':'Top võ đấu mùa trước',v.top.length?`<ol class="arena-last">${v.top.map(e=>`<li><b>${e.rank}</b>${c.img(head(e.avatar))}<span>${c.escape(e.name)}</span><em>${c.num(m==='allstars'?e.apoints:e.points)}</em></li>`).join('')}</ol>`:'<p class="item-description">Chưa có dữ liệu mùa trước.</p>')}

 // ---- Click
 async function onClick(e,layer){
  const el=e.target.closest('.pd-node');let node=null;for(let x=el;x&&x!==layer.parentElement;x=x.parentElement)if(x._node?.arena){node=x._node;break}
  if(!node)return;e.stopPropagation();const a=node.arena;
  try{
   if(a.act==='close'){if(layer.classList.contains('arena-defense'))draft=null;layer===layers.at(-1)&&closeTop();return}
   if(a.act==='leave'){closeAll();return}
   if(a.act==='hub'){closeAll();return openHub()}
   if(a.act==='mode'){const m=c.player().account.level;const need={solo:14,league:55,allstars:80}[a.mode];if(m<need)return c.toast(`Yêu cầu người chơi cấp độ ${need} trở lên.`);for(const l of layers)l.remove();layers=[];return openMode(a.mode)}
   if(a.act==='shop')return c.shop();
   if(a.act==='last')return lastTop(a.mode);
   if(a.act==='tab'){tab=a.tab;return openMode(mode)}
   if(a.act==='rivals')return openRivals();
   if(a.act==='refresh')return openRivals(true);
   if(a.act==='fight')return fight(a.id);
   if(a.act==='revenge'){closeTop();return fight(a.id,{revenge:true})}
   if(a.act==='player')return openPlayer(a.id);
   if(a.act==='records')return openRecords();
   if(a.act==='rewards')return openRewards();
   if(a.act==='rewardTab'){rewardTab=a.tab;closeTop();return openRewards()}
   if(a.act==='allstarTab'){allstarTab=a.tab;closeTop();return openRewards()}
   if(a.act==='defense'){draft=null;selectedRow=0;return openDefense()}
   if(a.act==='defense-close'){draft=null;return closeTop()}
   if(a.act==='defense-save')return saveDefense();
   if(a.act==='slot'){selectedRow=a.row;const id=draft[a.row][a.index];if(id)draft[a.row][a.index]=null;closeTop();return openDefense()}
   if(a.act==='swap'){[draft[a.from],draft[a.to]]=[draft[a.to],draft[a.from]];closeTop();return openDefense()}
   if(a.act==='buy')return buy(a.kind);
   if(a.act==='mail')return c.toast('Tính năng gửi thư cho người chơi chưa mở.');
   if(a.act==='help')return help();
   if(a.act==='knockout')return openKnockout();
   if(a.act==='round')return openRound(a.round);
   if(a.act==='bets')return openBets();
   if(a.act==='bet')return openBet(a.match);
   if(a.act==='pick'){betPick=a.pick;closeTop();return openBet(lastBet)}
   if(a.act==='bet-ok'){const d=await c.post('/api/allstars/bet',{matchId:a.match,pick:betPick});if(d){c.toast('Bạn đã đặt cược thành công');closeTop();closeTop();bracket=await c.api('/api/allstars/bracket');return openKnockout()}}
  }catch(err){c.toast(err.message)}
 }
 window.ArenaUI={
  init(ctx){c=ctx},
  /** Mở sảnh, một chế độ, hoặc thẳng một bảng trong chế độ (knockout / bets / rewards / records / defense / rivals). */
  async open(m,panel){try{closeAll();if(m)await openMode(m);else await openHub();
   const go={knockout:openKnockout,bets:openBets,rewards:openRewards,records:openRecords,defense:()=>{draft=null;selectedRow=0;return openDefense()},rivals:()=>openRivals()}[panel];if(m&&go)await go()}catch(e){c.toast(e.message)}},
  close:closeAll,
  isOpen:()=>!!root,
  /** Sau trận Đơn đấu / Võ đấu: điểm cộng trừ hiện ở màn kết thúc. */
  lines(result){if(!result)return[];return result.delta!==undefined&&result.delta!==0?[`Điểm ${result.delta>0?'+':''}${result.delta}`]:result.rankChanged?[`Lên hạng ${result.rankChanged}`]:[]},
 };
})();
