/* Hạm đội (GuildScene gốc) dựng nguyên scene / prefab bằng PrefabDOM:
 *   PopupCreateGuild (1078) Tìm đội / Lập đội, PopupSelectGuildAvatar (1377) chọn cờ;
 *   GuildScene (11): Hội trường, Kỹ năng, Đánh Boss, Nhiệm vụ, Chiến trường hạm đội, Cửa hàng;
 *   PopupGuildHall (1086) + PopupEditGuild (1456) + PopupGuildManageMember (1317) + PopupGuildApplication (1202) + PopupGuildActivities (1067);
 *   PopupGuildSkill (1464) 5 nghề × 8 kỹ năng; PopupGuildRaid (1122) thẻ boss 60 ải; PopupGuildBossAttack (1179);
 *   PopupGuildBossRewards (1126); PopupGuildMill (1409) Nhiệm vụ / Cống hiến / Top.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,data=null,root=null,layers=[],state=null,boss=null,techClass='warrior',techIndex=0,raidPage=0,millTab='donate',createTab='search',flagPick=1,searchText='';
 const cache={};
 const load=()=>data?Promise.resolve(data):fetch('guild.json').then(r=>r.json()).then(d=>data=d);
 const sceneJson=id=>cache[id]??=fetch(`scenes/${id}.json`).then(r=>{if(!r.ok)throw Error('Không tải được giao diện.');return r.json()});
 const kid=(n,path)=>path.split('/').reduce((x,p)=>x&&(x.children||[]).find(k=>k.name===p),n);
 const deep=(n,name)=>{if(!n)return null;if(n.name.trim()===name)return n;for(const k of n.children||[]){const r=deep(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const pic=(n,key)=>{const x=comp(n,'Image');if(x&&key)x.asset=key};
 const clone=n=>structuredClone(n);
 const tag=(n,value)=>{if(n){n.guild=value;if(!comp(n,'Button'))n.components=[...(n.components||[]),{type:'Button'}]}return n};
 const rows=(content,list,{spacing=6,padding=[0,0,4,4]}={})=>{const height=list.reduce((n,x)=>n+(x.transform?.m_SizeDelta?.y||0),0)+spacing*Math.max(0,list.length-1)+padding[2]+padding[3];
  content.transform={...content.transform,m_AnchorMin:{x:0,y:1},m_AnchorMax:{x:1,y:1},m_Pivot:{x:.5,y:1},m_AnchoredPosition:{x:0,y:0},m_SizeDelta:{x:0,y:height}};
  content.components=[{type:'VerticalLayoutGroup',spacing,padding,align:1,controlWidth:true,forceWidth:true}];content.children=list};
 const techIcon=(cls,id)=>data.icons[cls+'_'+id]||data.icons['tech_'+id];
 // Slider của Unity: Fill kéo theo anchorMax.x = giá trị.
 const slider=(n,value)=>{const f=n&&deep(n,'Fill');if(f)on(f,value>0.001);if(f)f.transform={...f.transform,m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:Math.max(0,Math.min(1,value)),y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0}}};
 const flag=n=>data.flags[Math.max(1,Math.min(data.flags.length,n||1))-1];
 const head=avatar=>c.heroHead(avatar)||c.named('item_transparent');
 const fmt=ms=>{ms=Math.max(0,ms);const s=Math.floor(ms/1000),h=String(Math.floor(s/3600)).padStart(2,'0'),m=String(Math.floor(s%3600/60)).padStart(2,'0'),x=String(s%60).padStart(2,'0');return `${h}:${m}:${x}`};
 const ago=at=>{if(!at)return 'Ngoại tuyến';const s=Math.max(0,(Date.now()-new Date(at).getTime())/1000);return s<3600?Math.max(1,Math.floor(s/60))+' phút trước':s<86400?Math.floor(s/3600)+' giờ trước':Math.floor(s/86400)+' ngày trước'};
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets(),onSkeleton:(el,sk)=>spines.push({el,sk})});
 const spines=[];
 function avatar(n,e){if(!n)return;pic(deep(n,'ImageAvt'),head(e.avatar));txt(deep(n,'TextLevel'),e.level??'');on(deep(n,'EffectSpecial'),false)}
 const canvasOf=s=>{const n=clone(s.roots.find(r=>r.name==='Canvas'));n.transform={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5},m_LocalScale:{x:1,y:1,z:1}};n.components=[];return n};
 function popupShell(n){const shade={id:'shade',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.6]}],transform:{m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0}},children:[]};tag(shade,{act:'close'});return{id:'popup',name:'GuildPopup',active:true,components:[],transform:{m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0}},children:[shade,n]}}
 function mount(node,cls,{popup=false}={}){
  spines.length=0;const el=D.render(node,W,H,opts());el.classList.add('guild-layer',...cls.split(' '));if(popup)el.classList.add('guild-popup');
  el.addEventListener('click',e=>onClick(e,el));c.layer().appendChild(el);if(popup)layers.push(el);else{root?.remove();root=el}
  // Skeleton của thẻ boss trong prefab không có dữ liệu: vẽ Spine tướng gốc của quái theo avatar.
  for(const host of el.querySelectorAll('.pd-node')){const av=host._node?.guildAvatar;if(!av||host.offsetParent===null)continue;const skel=c.skeleton(av);if(!skel)continue;
   const w=Math.round(host.offsetWidth),h=Math.round(host.offsetHeight),cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.className='guild-spine';host.classList.add('guild-portrait');host.appendChild(cv);c.spine(cv,{skeleton:skel,animation:'idling'},{loop:true,fit:.8})}
  return el;
 }
 const closeTop=()=>{layers.pop()?.remove()};
 const closeAll=()=>{for(const l of layers)l.remove();layers=[];root?.remove();root=null};
 const html=(host,markup,cls='')=>{if(!host)return null;const box=document.createElement('div');box.className='guild-html '+cls;box.innerHTML=markup;host.appendChild(box);return box};
 const nodeEl=(el,name)=>D.find(el,name);
 async function refresh(){state=await c.api('/api/guild');return state}

 // ---- Tìm đội / Lập đội
 async function openCreate(){
  const [s,list]=await Promise.all([sceneJson(1078),c.api('/api/guild/search?q='+encodeURIComponent(searchText)),load()]);const n=clone(s.roots[0]);
  txt(deep(n,'TextTitle'),'Hạm đội');tag(deep(n,'ButtonClose'),{act:'leave'});
  for(const [b,id,label] of [['ButtonTabSearch','search','Tìm đội'],['ButtonTabCreate','create','Lập đội']]){const t=deep(n,b);tag(t,{act:'createTab',tab:id});txt(kid(t,'Text'),label);on(kid(t,'ImageOn'),createTab===id);on(kid(t,'ImageOff'),createTab!==id)}
  on(deep(n,'BoxSearch'),createTab==='search');on(deep(n,'BoxCreate'),createTab==='create');
  const search=deep(n,'BoxSearch');tag(deep(search,'ButtonSearch'),{act:'search'});txt(deep(deep(search,'ButtonSearch'),'Text'),'Tìm kiếm');
  const tpl=deep(search,'CellGuild'),content=deep(search,'Content');on(tpl,false);
  rows(content,list.guilds.map(g=>{const cell=on(clone(tpl));pic(kid(cell,'ImageAvatar'),flag(g.flag));txt(kid(cell,'TextGuildName'),g.name);txt(kid(cell,'TextMember'),`${g.members}/${g.limit}`);txt(kid(cell,'TextLevelCap'),'Cấp');txt(deep(cell,'TextLevel'),g.level);
   const b=kid(cell,'ButtonApply');tag(b,{act:'apply',id:g.id});txt(kid(b,'Text'),g.applied?'Đã xin':'Xin vào');return cell}),{spacing:8,padding:[0,0,6,6]});
  const box=deep(n,'BoxCreate');txt(deep(box,'TextNameCap'),'Tên đội');txt(deep(box,'TextAvatarCap'),'Cờ đội');pic(deep(box,'ButtonAvatar'),flag(flagPick));tag(deep(box,'ButtonAvatar'),{act:'flags',mode:'create'});
  const create=deep(box,'ButtonCreate');tag(create,{act:'create'});txt(kid(create,'Text'),'Lập đội');txt(deep(create,'TextCost'),c.player().guild.createCost);
  const el=mount(n,'guild-create');
  if(createTab==='search'){const input=html(nodeEl(el,'InputSearch'),`<input class="guild-input" maxlength="30" placeholder="Nhập..." value="${c.escape(searchText)}" aria-label="Tên hoặc ID hạm đội">`);input.querySelector('input').addEventListener('keydown',e=>{if(e.key==='Enter'){searchText=e.target.value;openCreate()}});
   if(!list.guilds.length)html(nodeEl(el,'ScrollView'),'<p class="guild-empty">Không tìm được hạm đội. Hãy thử với từ khóa khác</p>')}
  else html(nodeEl(el,'InputName'),`<input class="guild-input" id="guild-name" minlength="6" maxlength="20" placeholder="Nhập..." aria-label="Tên đội">`);
 }
 async function openFlags(mode){
  const s=await sceneJson(1377),n=clone(s.roots[0]);tag(deep(n,'ButtonClose'),{act:'close'});const tpl=deep(n,'ButtonGuildAvatar'),content=deep(n,'Content');on(tpl,false);
  content.components=[{type:'GridLayoutGroup',cell:[110,130],spacing:[14,14],padding:[16,16,16,16],constraint:1,constraintCount:5,align:1}];
  content.transform={...content.transform,m_AnchorMin:{x:0,y:1},m_AnchorMax:{x:1,y:1},m_Pivot:{x:.5,y:1},m_SizeDelta:{x:0,y:Math.ceil(data.flags.length/5)*144+32}};
  content.children=data.flags.map((key,i)=>{const b=on(clone(tpl));pic(b,key);tag(b,{act:'flag',flag:i+1,mode});return b});
  mount(popupShell(n),'guild-flags',{popup:true});
 }

 // ---- GuildScene
 async function openScene(){
  const [s]=await Promise.all([sceneJson(11),load(),refresh()]);if(!state.guild)return openCreate();
  const n=canvasOf(s),g=state.guild,me=c.player().guild;
  txt(deep(n,'TextGem'),c.short(c.player().wallet.diamonds));txt(deep(n,'TextGuildCoin'),c.short(me.coin));
  const labels=[['BuidingWar','Chiến trường','war'],['ButtonTech','Kỹ năng','tech'],['ButtonHall','Hội trường','hall'],['BuidingBoss','Đánh Boss','boss'],['ButtonMill','Nhiệm vụ','mill']];
  for(const [name,label,act] of labels){const b=deep(n,name);tag(b,{act});txt(deep(b,'TextTag'),label);for(const k of b.children)if(k.name!=='NameTag')tag(k,{act})}
  on(deep(n,'GoNotifyWar'),false);on(deep(n,'GoNotifyHall'),!me.rollCall||g.applications.length>0);on(deep(n,'GoNotifyBoss'),me.bossLeft>0);on(deep(n,'GoNotifyMill'),me.donated<me.donateLimit);
  tag(deep(n,'ButtonBack'),{act:'leave'});tag(deep(n,'ButtonShop'),{act:'shop'});
  mount(n,'guild-scene');
 }

 // ---- Hội trường
 async function openHall(){
  const s=await sceneJson(1086);await refresh();const g=state.guild,me=c.player().guild,n=clone(s.roots[0]),boss=['leader','vice'].includes(g.role);
  txt(deep(n,'TextTitle'),'Hạm đội');pic(deep(n,'ButtonAvatarGuild'),flag(g.flag));txt(deep(n,'TextGuildName'),g.name);txt(deep(n,'TextId'),'ID: '+g.shortId);
  txt(deep(n,'TextNumMember'),`${g.members.length}/${g.memberLimit}`);txt(deep(n,'TextLevelCap'),'Lv');txt(deep(n,'TextLevel'),g.level);
  txt(deep(n,'TextProgress'),g.expNext?`${c.num(g.exp)}/${c.num(g.expNext)}`:'Tối đa');slider(deep(n,'SliderLevel'),g.expNext?g.exp/g.expNext:1);
  txt(deep(n,'TextMotto'),g.notice||'');on(deep(n,'ButtonSetting'),boss);tag(deep(n,'ButtonSetting'),{act:'edit'});on(deep(n,'BoxEditMember'),boss);tag(deep(n,'ButtonManageMember'),{act:'members'});
  const roll=deep(n,'ButtonRollCall'),done=me.rollCall;on(roll,!done);on(deep(n,'ButtonRollCallIa'),done);tag(roll,{act:'rollcall'});txt(kid(roll,'Text'),'Điểm danh');on(deep(roll,'NotifyRollCall'),!done);txt(kid(deep(n,'ButtonRollCallIa'),'Text'),'Đã điểm danh');
  const quit=deep(n,'ButtonQuitGuild');tag(quit,{act:'quit'});txt(kid(quit,'Text'),'Rời đội');
  const tpl=deep(n,'CellGuildMember'),content=deep(deep(n,'ScrollMember'),'Content');on(tpl,false);
  rows(content,g.members.map(m=>{const cell=on(clone(tpl));avatar(deep(cell,'PlayerAvatar'),m);txt(kid(cell,'TextPlayername'),m.name);txt(kid(cell,'TextRole'),m.roleName);comp(kid(cell,'TextRole'),'Text').color=m.role==='leader'?[.86,.2,.2,1]:m.role==='vice'?[.2,.45,.85,1]:[.4,.27,.15,1];txt(kid(cell,'TextOnline'),m.online?'Đang Online':ago(m.lastSeen));return cell}),{spacing:8,padding:[0,0,6,6]});
  const menu=deep(n,'ButtonShowActionMenu');tag(menu,{act:'menu'});txt(kid(menu,'Text'),'Quản lí hạm đội');on(deep(menu,'NotifyApplication'),g.applications.length>0);on(menu,boss);
  const log=deep(n,'ButtonLogActivity');tag(log,{act:'log'});txt(kid(log,'Text'),'Hoạt động');tag(deep(kid(deep(n,'BoxMember'),'ButtonClose'),'ButtonClose')||kid(deep(n,'BoxMember'),'ButtonClose'),{act:'close'});
  const pm=deep(n,'PanelManagerMenu');for(const [b,act,label] of [['ButtonProcessApplication','applications','Duyệt đăng ký'],['ButtonRecruit','recruit','Tuyển mộ'],['ButtonSendMail','mail','Gửi thư'],['ButtonMember','members','Thành viên']]){const x=deep(pm,b);tag(x,{act});const t=x.children.find(k=>comp(k,'Text'));if(t)txt(t,label)}
  on(deep(pm,'GoNotifyApplication'),g.applications.length>0);tag(deep(n,'ButtonHelp'),{act:'help'});
  mount(popupShell(n),'guild-hall',{popup:true})
 }
 async function openEdit(){
  const s=await sceneJson(1456),g=state.guild,n=clone(s.roots[0]);txt(deep(n,'TextTitle'),'Hạm đội');tag(deep(n,'ButtonClose'),{act:'close'});
  txt(deep(n,'TextNameCap'),'Tên hạm đội');txt(deep(n,'TextName'),g.name);txt(deep(n,'TextAvatarCap'),'Cờ đội');pic(deep(n,'ButtonAvatar'),flag(flagPick=g.flag));tag(deep(n,'ButtonAvatar'),{act:'flags',mode:'edit'});
  txt(deep(n,'TextMottoCap'),'Thông tin hạm đội');const save=deep(n,'ButtonSave');tag(save,{act:'save'});txt(kid(save,'Text'),'Lưu thay đổi');on(deep(n,'ButtonRename'),false);
  const el=mount(popupShell(n),'guild-edit',{popup:true});html(nodeEl(el,'InputMotto'),`<textarea class="guild-input" id="guild-notice" maxlength="200" aria-label="Thông tin hạm đội">${c.escape(g.notice||'')}</textarea>`);
 }
 async function openMembers(){
  const s=await sceneJson(1317),g=state.guild,n=clone(s.roots[0]);txt(deep(n,'TextTitle'),'Quản lí hạm đội');tag(deep(n,'ButtonClose'),{act:'close'});
  const tpl=deep(n,'CellGuildMember'),content=deep(n,'Content');on(tpl,false);
  rows(content,g.members.map((m,i)=>{const cell=on(clone(tpl));txt(kid(cell,'TextRank'),i+1);avatar(deep(cell,'PlayerAvatar'),m);txt(kid(cell,'TextPlayername'),m.name);txt(kid(cell,'TextRole'),m.roleName);
   const can=!m.me&&(g.role==='leader'||(g.role==='vice'&&m.role==='member')),pr=deep(cell,'ButtonPromote'),kick=deep(cell,'ButtonKick');
   on(pr,!m.me&&g.role==='leader');tag(pr,{act:'promote',id:m.id});txt(kid(pr,'Text'),m.role==='vice'?'Bãi nhiệm':'Bổ nhiệm');on(kick,can);tag(kick,{act:'kick',id:m.id,name:m.name});txt(kid(kick,'Text'),'Khai trừ');return cell}),{spacing:8,padding:[0,0,6,6]});
  const el=mount(popupShell(n),'guild-members',{popup:true});
  if(g.role==='leader'&&g.members.some(m=>m.role==='vice')){const vice=g.members.find(m=>m.role==='vice');html(el.querySelector('[data-name="Body"]'),`<button class="guild-transfer" data-transfer="${c.escape(vice.id)}">Nhường Thuyền trưởng cho ${c.escape(vice.name)}</button>`).addEventListener('click',e=>{if(e.target.closest('[data-transfer]'))manage({op:'transfer',userId:vice.id})})}
 }
 async function openApplications(){
  const s=await sceneJson(1202),g=state.guild,n=clone(s.roots[0]);txt(deep(n,'TextTitle'),'Duyệt đăng ký');tag(deep(n,'ButtonClose'),{act:'close'});
  const tpl=deep(n,'CellGuildApplication'),content=deep(n,'Content');on(tpl,false);
  rows(content,g.applications.map(a=>{const cell=on(clone(tpl));avatar(deep(cell,'PlayerAvatar'),a);txt(kid(cell,'TextPlayername'),a.name);txt(kid(cell,'TextLevelCap'),'Cấp');txt(deep(cell,'TextLevel'),a.level);
   const r=kid(cell,'ButtonReject'),ok=kid(cell,'ButtonApprove');tag(r,{act:'reject',id:a.id});txt(kid(r,'Text'),'Từ chối');tag(ok,{act:'approve',id:a.id});txt(kid(ok,'Text'),'Đồng ý');return cell}),{spacing:8,padding:[0,0,6,6]});
  const el=mount(popupShell(n),'guild-applications',{popup:true});if(!g.applications.length)html(nodeEl(el,'BgrMember'),'<p class="guild-empty">Chưa có đơn xin vào.</p>');
 }
 async function openLog(){
  const s=await sceneJson(1067),g=state.guild,n=clone(s.roots[0]);txt(deep(n,'TextTitle'),'Hoạt động');tag(deep(n,'ButtonClose'),{act:'close'});
  const tpl=deep(n,'CellGuildActivity'),content=deep(n,'Content');
  rows(content,g.log.map(l=>{const cell=on(clone(tpl));const d=new Date(l.at);txt(kid(cell,'TextDate'),d.toLocaleDateString('vi-VN')+' '+d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}));txt(kid(cell,'TextLog'),l.text);return cell}),{spacing:6,padding:[0,0,6,6]});
  mount(popupShell(n),'guild-log',{popup:true});
 }

 // ---- Kỹ năng hạm đội
 const techTabs=[['TabWarrior','warrior'],['TabMage','mage'],['TabRanger','ranger'],['TabAssassin','assassin'],['TabPriest','priest']],classNames={warrior:'Đấu Sĩ',mage:'Chỉ Huy',ranger:'Xạ Thủ',assassin:'Kiếm Sĩ',priest:'Hỗ Trợ'};
 const effectText=(e,level)=>e.map(([field,per])=>{const label={attackPct:'Công',maxHpPct:'Máu',speed:'Tốc độ',penetration:'Xuyên giáp',critChance:'Chí mạng',critDamage:'ST chí mạng',block:'Chặn',accuracy:'Chính xác',skillDamage:'ST kỹ năng'}[field]||({'resist.stun':'Kháng Choáng','resist.freeze':'Kháng Đóng băng','resist.petrify':'Kháng Hóa đá','resist.silence':'Kháng Câm lặng'})[field]||(field.startsWith('vs.')?'ST lên '+classNames[field.slice(3)]:field);
  const v=x=>field==='speed'?String(+(x).toFixed(1)):(+(x*100).toFixed(1))+'%';return `${label} ${v(per*level)} -> ${v(per*(level+1))}`}).join('\n');
 async function openTech(){
  const s=await sceneJson(1464),n=clone(s.roots[0]),me=c.player().guild,t=me.tech[techClass],skill=t.skills[techIndex];
  txt(deep(n,'TextTitle'),classNames[techClass]);tag(deep(n,'ButtonClose'),{act:'close'});txt(deep(n,'TextGuildCoin'),c.short(me.coin));txt(deep(n,'TextGold'),c.short(c.player().wallet.gold));tag(deep(n,'ButtonHelp'),{act:'techHelp'});
  for(const [b,cls] of techTabs){const x=deep(n,b);tag(x,{act:'techTab',cls});on(kid(x,'ImageOn'),cls===techClass);on(kid(x,'ImageOff'),cls!==techClass)}
  const box=deep(n,'BoxTech');pic(deep(box,'IconTechClass'),data.icons['tech_'+techClass]);txt(deep(box,'LevelTechClass'),'Cấp độ '+t.tier);tag(deep(box,'ButtonRetset'),{act:'reset'});
  t.skills.forEach((sk,i)=>{const b=deep(box,'ButtonTechSkill'+(i+1));tag(b,{act:'techPick',index:i});const icon=techIcon(techClass,sk.id);for(const k of ['ImageOn','ImageOff'])pic(kid(b,k),icon);on(kid(b,'ImageOn'),!sk.locked);on(kid(b,'ImageOff'),sk.locked);txt(kid(b,'TextLevel'),`${sk.level}/${sk.max}`);b.guildLocked=sk.locked;if(i===techIndex)b.guildSelected=true});
  const d=deep(n,'BoxDetail');pic(deep(d,'IconTech'),techIcon(techClass,skill.id));txt(deep(d,'TextTechName'),skill.name);txt(deep(d,'TextUpgradeDesc'),skill.level<skill.max?effectText(skill.effects,skill.level):effectText(skill.effects,skill.level-1).replace(/-> .*$/gm,'(tối đa)'));
  txt(deep(d,'TextRequire'),skill.locked?'Yêu cầu kĩ năng trước đạt cấp 10':'');
  const maxed=skill.level>=skill.max,allMax=t.skills.every(x=>x.level>=x.max);on(deep(d,'GroupUpgrade'),!maxed||allMax&&t.tier<t.maxTier);on(deep(d,'GroupMaxed'),maxed&&!(allMax&&t.tier<t.maxTier));txt(deep(d,'TextMaxed'),'Cấp tối đa');
  const up=deep(d,'ButtonUpgrade');
  if(allMax&&t.tier<t.maxTier){tag(up,{act:'tier'});txt(kid(up,'Text'),'Cấp độ '+(t.tier+1));txt(deep(d,'TextGoldCost'),'-');txt(deep(d,'TextGuildCoinCost'),'-');txt(deep(d,'TextRequire'),t.nextTierGuildLevel?`Yêu cầu bang đạt cấp độ ${t.nextTierGuildLevel}`:'')}
  else{tag(up,{act:'techUp'});txt(kid(up,'Text'),'Nâng cấp');if(skill.cost){txt(deep(d,'TextGoldCost'),c.short(skill.cost.gold));txt(deep(d,'TextGuildCoinCost'),c.short(skill.cost.coin))}}
  const el=mount(popupShell(n),'guild-tech',{popup:true});
  for(const x of el.querySelectorAll('.pd-node')){if(x._node?.guildLocked)x.classList.add('guild-locked');if(x._node?.guildSelected){const sel=D.find(el,'GoSkillSelected');if(sel){sel.style.left=x.style.left;sel.style.top=x.style.top;sel.style.width=x.style.width;sel.style.height=x.style.height}}}
 }

 // ---- Đánh Boss
 async function openRaid(){
  const [s]=await Promise.all([sceneJson(1122),load()]);boss=await c.api('/api/guild/boss');raidPage=Math.max(0,Math.min(19,raidPage));
  const n=clone(s.roots[0]);txt(deep(n,'TextTitle'),'Đánh Boss');tag(deep(n,'ButtonClose'),{act:'close'});tag(deep(n,'ButtonLeft'),{act:'page',dir:-1});tag(deep(n,'ButtonRight'),{act:'page',dir:1});tag(deep(n,'ButtonHelp'),{act:'bossHelp'});
  // GroupBoss giữ GridLayoutGroup gốc (3 thẻ 250×336); mỗi thẻ là GuildBossUI gốc.
  const tpl=deep(n,'GuildBossUI'),group=deep(n,'GroupBoss');on(tpl,false);
  group.children=[0,1,2].map(k=>{const st=boss.stages[raidPage*3+k],card=on(clone(tpl));card.name='GuildBossUI';const normal=deep(card,'GroupNormalBoss');on(deep(card,'GroupPrayBoss'),false);
   txt(deep(normal,'TextNormalBossId'),st.stage);const dead=st.stage<boss.current||boss.cleared&&st.stage===boss.current,cur=st.stage===boss.current&&!boss.cleared,unknown=st.stage>boss.current;
   const bg=deep(normal,'ImageBgr');pic(bg,c.named(st.stage%2?'bgr_boss_1':'bgr_boss_2'));if(!unknown)bg.guildAvatar=st.monsters[0].avatar;
   on(deep(normal,'GroupDeath'),dead);on(deep(normal,'GoUnknown'),unknown);on(deep(normal,'CanvasHero'),false);
   on(deep(normal,'SliderHealth'),cur||dead);txt(deep(normal,'TextHp'),cur?boss.hpPercent+'%':'0%');slider(deep(normal,'SliderHealth'),cur?boss.hpPercent/100:0);
   const cd=deep(normal,'BoxCountDown');on(cd,cur);if(cur){const t=deep(cd,'TextCountdown');t.guildTime=boss.resetAt+(Date.now()-boss.now);txt(t,fmt(boss.resetAt-boss.now))}
   if(dead)card.guildClass='guild-card-dead';if(cur)card.guildClass='guild-card-current';if(unknown)card.guildClass='guild-card-locked';
   tag(card,{act:'stage',stage:st.stage,cur,dead,unknown});return card});
  const dots=deep(n,'DotIndicator'),dot=deep(dots,'Dot');dots.components=[{type:'HorizontalLayoutGroup',spacing:14,align:4}];dots.children=Array.from({length:20},(_,i)=>{const d=on(clone(dot));on(kid(d,'ImageOn'),i===raidPage);on(kid(d,'ImageOff'),i!==raidPage);tag(d,{act:'dot',page:i});return d});
  const el=mount(popupShell(n),'guild-raid',{popup:true});tick(el);
  for(const x of el.querySelectorAll('.pd-node'))if(x._node?.guildClass)x.classList.add(x._node.guildClass);
 }
 async function openAttack(stage){
  const [s,info]=await Promise.all([sceneJson(1179),c.api('/api/guild/boss?stage='+stage)]);boss=info;
  const n=clone(s.roots[0]),st=boss.stages[stage-1],me=c.player().guild,rank=info.ranking,cur=rank.state==='current',dead=rank.state==='dead';
  txt(deep(n,'TextTitle'),'Ải '+stage);tag(deep(n,'ButtonClose'),{act:'close'});txt(deep(n,'TextPower'),c.num(st.power));
  const hp=cur?boss.hpPercent:dead?0:100;txt(deep(n,'TextHp'),hp+'%');slider(deep(n,'SliderHp'),hp/100);
  // Spine boss trong vùng Clip (Mask gốc) của khung boss.
  const clip=deep(n,'Clip');clip.guildAvatar=st.monsters[0].avatar;on(deep(clip,'CanvasHero'),false);
  const cd=deep(n,'TextCountDown');on(cd,cur);cd.guildTime=boss.resetAt+(Date.now()-boss.now);txt(cd,fmt(boss.resetAt-boss.now));
  const atk=deep(n,'ButtonAttack');tag(atk,{act:'attack',stage});txt(kid(atk,'Text'),me.bossLeft>0?`Tấn công (${me.bossLeft})`:'Tấn công');on(deep(atk,'IconGem'),me.bossLeft<=0);txt(deep(atk,'TextGemCost'),me.bossBuyPrice);on(atk,cur);
  tag(deep(n,'ButtonInfo'),{act:'rewards',stage});txt(deep(n,'TextTop'),'Bảng xếp hạng sát thương');
  const tpl=deep(n,'CellGuildBossDmg'),content=deep(deep(n,'BoxTopDmg'),'Content');on(tpl,false);
  const top=rank.top,best=Math.max(1,top[0]?.damage||1);
  rows(content,top.map(r=>{const cell=on(clone(tpl));on(kid(cell,'TagRank'),r.rank<=3);if(r.rank<=3)pic(kid(cell,'TagRank'),c.named('tag_rank_'+r.rank));txt(kid(cell,'TextRank'),r.rank);
   avatar(deep(cell,'PlayerAvatar'),r);txt(kid(cell,'TextPlayername'),r.name);txt(deep(cell,'TextDamage'),`${c.short(r.damage)} (${Math.round(r.share*100)}%)`);slider(deep(cell,'Slider'),r.damage/best);
   cell.guildRow=r;if(r.me)cell.guildClass='guild-row-me';return cell}),{spacing:6,padding:[0,0,4,4]});
  const el=mount(popupShell(n),'guild-attack'+(dead?' dead':''),{popup:true});tick(el);
  for(const x of el.querySelectorAll('.pd-node')){if(x._node?.guildClass)x.classList.add(x._node.guildClass);const r=x._node?.guildRow;
   if(r)html(x,`<div class="guild-row-extra"><span>${r.hits} lượt</span>${r.reward?`<span class="guild-row-reward">${c.img(c.named('icon_gold'))}${c.short(r.reward.gold)} ${c.img(c.items.get('consumable:6')?.assetKey)}${c.short(r.reward.coin)}</span>`:''}</div>`)}
  html(el.querySelector('[data-name="BossFrame"]'),`<div class="guild-team">${st.monsters.map(m=>`<span title="${c.escape(m.name)} · cấp ${m.level}">${c.img(head(m.avatar))}<b>${m.level}</b></span>`).join('')}</div>${dead?`<div class="guild-dead-stamp">${c.img(c.named('mark_death'))}<b>Đã hạ</b>${rank.killer?`<small>bởi ${c.escape(rank.killer.name)}</small>`:''}</div>`:''}`);
  const box=nodeEl(el,'BoxTopDmg');
  if(!top.length)html(box,`<p class="guild-empty small">${cur?'Chưa có ai đánh boss này. Hãy là người đầu tiên!':'Ải này chưa có dữ liệu sát thương.'}</p>`);
  html(box,`<div class="guild-rank-foot"><span>Tổng: <b>${c.short(rank.totalDamage)}</b> · ${top.length} người</span><span>${rank.me?`Hạng của bạn: <b>${rank.me.rank}</b> · ${c.short(rank.me.damage)}`:'Bạn chưa đánh ải này'}</span></div>`);
 }
 function tick(el){const t=setInterval(()=>{if(!el.isConnected)return clearInterval(t);for(const x of el.querySelectorAll('.pd-node')){const at=x._node?.guildTime;if(at)D.setText(x,fmt(at-Date.now()))}},1000)}
 async function openBossRewards(stage){
  const s=await sceneJson(1126),n=clone(s.roots[0]),st=boss.stages[stage-1];txt(deep(n,'TextRank'),'Hạng');txt(deep(n,'TextReward'),'Thưởng');tag(deep(n,'ButtonClose'),{act:'close'});
  const tpl=deep(n,'CellGuildBossReward'),content=deep(n,'Content');on(tpl,false);
  const list=[['Mỗi lượt',{gold:st.gold,coin:st.guildCoin}],['Hạ boss',{gold:st.killGold,coin:st.killCoin}],['1',st.final['1']],['2',st.final['2']],['3',st.final['3']],['4-10',st.final['10']],['11-15',st.final['15']],['16-20',st.final['20']],['21-30',st.final['30']]];
  rows(content,list.map(([rank,r])=>{const cell=on(clone(tpl));txt(kid(cell,'TextRank'),rank);on(deep(cell,'GameItemContainer1'),false);cell.guildRewards=[{itemId:'gold',quantity:r.gold},{itemId:'consumable:6',quantity:r.coin}];return cell}),{spacing:6,padding:[0,0,6,6]});
  const el=mount(popupShell(n),'guild-boss-rewards',{popup:true});
  for(const x of el.querySelectorAll('.pd-node'))if(x._node?.guildRewards)html(x,`<div class="guild-reward-row">${x._node.guildRewards.map(r=>c.rewardTile(r)).join('')}</div>`);
 }
 async function attack(stage){
  const me=c.player().guild;
  if(me.bossLeft<=0){if(me.bossBuyLeft<=0)return c.toast('Đã hết lượt đánh hôm nay.');return c.confirm(`Mua thêm 1 lượt đánh boss? (Còn ${me.bossBuyLeft} lượt mua hôm nay)`,'Đánh Boss',me.bossBuyPrice,async()=>{const d=await c.mutation('/api/guild/boss/buy',{},{render:false,bonus:false});if(d)attack(stage)})}
  c.pickTeam('Boss Hạm đội',async slots=>{const d=await c.mutation('/api/guild/boss/attack',{formation:slots},{render:false,bonus:false,message:false});if(!d)return;
  if(d.player.battle?.status==='active'){closeAll();c.navigate(9)}})
 }

 // ---- Nhiệm vụ (Cống hiến / Top)
 async function openMill(){
  const s=await sceneJson(1409);await refresh();const n=clone(s.roots[0]),me=c.player().guild,g=state.guild;
  txt(deep(n,'TextTitle'),{order:'Nhiệm vụ',donate:'Cống hiến',top:'Bảng cống hiến'}[millTab]);tag(deep(n,'ButtonClose'),{act:'close'});
  for(const [b,id] of [['TabOrder','order'],['TabDontate','donate'],['TabTop','top']]){const x=deep(n,b);tag(x,{act:'millTab',tab:id});on(kid(x,'ImageOn'),millTab===id);on(kid(x,'ImageOff'),millTab!==id)}
  const order=deep(n,'BoxOrder');on(order,true);on(deep(order,'CellMillOrder'),false);on(deep(order,'ButtonRequestOrder'),false);on(deep(order,'TextCountCap'),false);on(deep(order,'ScrollOrder'),false);
  txt(deep(order,'TextNote'),millTab==='order'?'Không có nhiệm vụ đang thực thi.':'');
  const el=mount(popupShell(n),'guild-mill',{popup:true}),host=nodeEl(el,'BgrImage');
  if(millTab==='donate'){
   const box=html(host,`<div class="guild-donate"><p>Beli hiện có: <b>${c.num(c.player().wallet.gold)}</b> · Lượt cống hiến hôm nay: <b>${me.donateLimit-me.donated}/${me.donateLimit}</b></p>${me.donations.map((d,i)=>`<div class="guild-donate-row"><span class="guild-donate-gold">${c.img(c.named('icon_gold'))}${c.num(d.gold)}</span><span>EXP hạm đội +${d.guildExp}</span><span>${c.img(c.items.get('consumable:6')?.assetKey)} +${d.coin}</span><button data-donate="${i}" ${me.donated>=me.donateLimit?'disabled':''}>Cống hiến</button></div>`).join('')}</div>`);
   box.addEventListener('click',async e=>{const b=e.target.closest('[data-donate]');if(!b)return;const d=await c.mutation('/api/guild/donate',{tier:Number(b.dataset.donate)},{render:false});if(d){closeTop();openMill()}});
  }else if(millTab==='top')html(host,`<ol class="guild-top">${[...g.members].sort((a,b)=>b.dedication-a.dedication).map((m,i)=>`<li><b>${i+1}</b>${c.img(head(m.avatar))}<span>${c.escape(m.name)}</span><em>${c.num(m.dedication)}</em></li>`).join('')}</ol>`);
  else html(host,'<p class="guild-empty">Không có nhiệm vụ đang thực thi.</p>');
 }

 async function manage(body){try{state=await c.post('/api/guild/manage',body);closeTop();return true}catch(e){c.toast(e.message);return false}}
 async function onClick(e,layer){
  if(e.target.closest('.guild-html'))return;
  const el=e.target.closest('.pd-node');let node=null;for(let x=el;x&&x!==layer.parentElement;x=x.parentElement)if(x._node?.guild){node=x._node;break}
  if(!node)return;e.stopPropagation();const a=node.guild;
  try{
   if(a.act==='close'){layer===layers.at(-1)&&closeTop();return}
   if(a.act==='leave'){closeAll();return}
   if(a.act==='createTab'){createTab=a.tab;return openCreate()}
   if(a.act==='search'){searchText=layer.querySelector('.guild-input')?.value||'';return openCreate()}
   if(a.act==='apply'){const d=await c.post('/api/guild/apply',{guildId:a.id});c.toast(d.message);return openCreate()}
   if(a.act==='flags')return openFlags(a.mode);
   if(a.act==='flag'){flagPick=a.flag;closeTop();if(a.mode==='edit'){state=await c.post('/api/guild/edit',{flag:a.flag});closeTop();return openEdit()}return openCreate()}
   if(a.act==='create'){const name=layer.querySelector('#guild-name')?.value||'';const d=await c.mutation('/api/guild/create',{name,flag:flagPick},{render:false});if(d)return openScene();return}
   if(a.act==='hall')return openHall();
   if(a.act==='tech'){techIndex=0;return openTech()}
   if(a.act==='boss')return openRaid();
   if(a.act==='mill')return openMill();
   if(a.act==='war')return c.toast('Hạm đội chiến hiện không diễn ra.');
   if(a.act==='shop')return c.shop();
   if(a.act==='edit')return openEdit();
   if(a.act==='save'){const notice=layer.querySelector('#guild-notice')?.value??'';state=await c.post('/api/guild/edit',{notice});closeTop();closeTop();return openHall()}
   if(a.act==='members')return openMembers();
   if(a.act==='applications')return openApplications();
   if(a.act==='menu'){const pm=D.find(layer,'PanelManagerMenu');if(pm)D.show(pm,pm.style.display==='none');return}
   if(a.act==='recruit')return c.toast('Đã gửi tin tuyển mộ tới kênh thế giới.');
   if(a.act==='mail')return c.toast('Tính năng gửi thư cho thành viên chưa mở.');
   if(a.act==='log')return openLog();
   if(a.act==='rollcall'){const d=await c.mutation('/api/guild/rollcall',{},{render:false});if(d){closeTop();openHall()}return}
   if(a.act==='quit'){const g=state.guild;return c.confirm(g.members.length<=1?'Bạn là thành viên cuối cùng, rời đội sẽ giải tán hạm đội.':'Bạn chắc chắn rời khỏi liên minh?','Rời đội',null,async()=>{const d=await c.mutation('/api/guild/leave',{},{render:false});if(d){closeAll();openCreate()}})}
   if(a.act==='approve'||a.act==='reject'){if(await manage({op:a.act,userId:a.id})){closeTop();return openHall().then(openApplications)}return}
   if(a.act==='promote'){if(await manage({op:'promote',userId:a.id})){closeTop();return openHall().then(openMembers)}return}
   if(a.act==='kick')return c.confirm(`Bạn chắc chắn khai trừ ${a.name} ?`,'Khai trừ',null,async()=>{if(await manage({op:'kick',userId:a.id})){closeTop();await openHall();openMembers()}});
   if(a.act==='help')return c.modal('HẠM ĐỘI','<p class="item-description">Điểm danh mỗi ngày nhận beli, Huy hiệu hạm đội và EXP hạm đội. Hạm đội lên cấp mở thêm chỗ cho thành viên và Cấp độ kỹ năng mới. Thuyền trưởng và Thuyền phó duyệt đơn xin vào, khai trừ thành viên.</p>');
   if(a.act==='techTab'){techClass=a.cls;techIndex=0;closeTop();return openTech()}
   if(a.act==='techPick'){techIndex=a.index;closeTop();return openTech()}
   if(a.act==='techUp'){const d=await c.mutation('/api/guild/tech',{op:'upgrade',cls:techClass,index:techIndex},{render:false,message:false,bonus:false});if(d){closeTop();await openTech();layers.at(-1)?.classList.add('guild-upped')}return}
   if(a.act==='tier'){const d=await c.mutation('/api/guild/tech',{op:'tier',cls:techClass},{render:false});if(d){closeTop();techIndex=0;return openTech()}return}
   if(a.act==='reset'){const t=c.player().guild.tech[techClass];return c.confirm('Thiết lập lại hệ kỹ năng. Toàn bộ beli và huy hiệu bang sẽ được hoàn trả (Lần đầu thiết lập lại không mất phí)','Thiết lập lại',t.resets>0?100:null,async()=>{const d=await c.mutation('/api/guild/tech',{op:'reset',cls:techClass},{render:false});if(d){closeTop();openTech()}})}
   if(a.act==='techHelp')return c.modal('KỸ NĂNG HẠM ĐỘI','<p class="item-description">Kỹ năng tăng chỉ số cho tướng cùng nghề khi bạn ở trong hạm đội. Mỗi kỹ năng 20 cấp; kỹ năng sau mở khi kỹ năng trước đạt cấp 10. Nâng tối đa 8 kỹ năng để lên Cấp độ kế (cần hạm đội đạt cấp yêu cầu). Thiết lập lại hoàn toàn bộ beli và Huy hiệu hạm đội, lần đầu miễn phí.</p>');
   if(a.act==='page'){raidPage=(raidPage+a.dir+20)%20;closeTop();return openRaid()}
   if(a.act==='dot'){raidPage=a.page;closeTop();return openRaid()}
   if(a.act==='stage'){if(a.unknown)return c.toast('Hạ boss các ải trước để mở ải này.');return openAttack(a.stage)}
   if(a.act==='rewards')return openBossRewards(a.stage);
   if(a.act==='attack')return attack(a.stage);
   if(a.act==='bossHelp')return c.modal('ĐÁNH BOSS','<p class="item-description">Cả hạm đội dùng chung máu boss. Mỗi ngày mỗi thành viên có 3 lượt đánh (mua thêm 40 kim cương). Mỗi lượt nhận beli và Huy hiệu hạm đội, hạm đội nhận EXP. Người hạ boss và top sát thương nhận thưởng qua thư, rồi mở ải kế tiếp.</p>');
   if(a.act==='millTab'){millTab=a.tab;closeTop();return openMill()}
  }catch(err){c.toast(err.message)}
 }
 window.GuildUI={
  init(ctx){c=ctx},
  async open(panel){try{closeAll();await load();await refresh();if(!state.guild)return openCreate();await openScene();if(panel==='boss')await openRaid()}catch(e){c.toast(e.message)}},
  close:closeAll,isOpen:()=>!!root,
 };
})();
