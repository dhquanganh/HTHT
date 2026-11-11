/* Thông tin tài khoản gốc dựng bằng PrefabDOM (server/profile.mjs giữ luật):
 *   PopupSettings (1088) tab Thông tin = PopupAccountInfo: PlayerAvatar (viền border_avatar, tag_level, icon_edit), tên +
 *     Đổi tên, Tài khoản / ID / Hạm đội / Máy chủ, thanh EXP, Đổi máy chủ, Đăng xuất, Âm thanh / Nhạc / Ngôn ngữ.
 *   PopupChangeAvatar (1049): tab "Ảnh tướng" (đầu tướng đã sở hữu) và "Ảnh đặc biệt" (db_avatar), CellAvatar + tick, nút Đổi.
 *   PopupRename (1025): ô nhập, nút xúc xắc đặt tên ngẫu nhiên, Lưu miễn phí lần đầu, sau đó 100 kim cương.
 *   PopupLevelUp (1466): Spine Lvlup (In rồi Loop), dải bgr_show_bonus, "Cấp N", phần thưởng lên cấp, nút Đóng.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,avatars=null,levelShowing=false;const cache={};
 const scene=id=>cache[id]??=fetch(`scenes/${id}.json`).then(r=>r.json());
 const loadAvatars=()=>avatars?Promise.resolve(avatars):fetch('avatars.json').then(r=>r.json()).then(d=>avatars=d);
 const kid=(n,path)=>path.split('/').reduce((x,p)=>x&&(x.children||[]).find(k=>k.name===p),n);
 const find=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=find(k,name);if(r)return r}return null};
 const deep=(n,path)=>{const [first,...rest]=path.split('/');const x=find(n,first);return rest.length?kid(x,rest.join('/')):x};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const img=(n,key)=>{const x=comp(n,'Image');if(x){x.asset=key;x.color=[1,1,1,1]}};
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5}};
 const shell=n=>({id:'pf',name:'ProfileRoot',active:true,components:[],transform:full,children:[{id:'shade',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.6]}],transform:full,children:[]},n]});
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const mount=(n,cls)=>{n.transform={...n.transform,...full};const el=D.render(shell(n),W,H,opts());el.classList.add('pf-layer',cls);c.layer().appendChild(el);return el};
 const bind=(el,x,f)=>{if(typeof x==='string')x=D.find(el,x);if(x){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();f(e)}}return x};
 const p=()=>c.player();
 /** Ảnh đại diện hiện tại: ảnh đặc biệt, đầu tướng đã chọn, hoặc đầu tướng chính. */
 function avatarKey(player=p()){
  const a=player?.avatar;if(a?.kind==='special')return 'avatar-'+a.id;
  const id=a?.kind==='hero'&&player.heroes?.some(h=>h.id===a.id)?a.id:player?.hero?.id;
  return c.catalog().heroes.find(d=>d.id===id)?.visual?.head;
 }
 // ---------- PopupSettings / PopupAccountInfo ----------
 async function openInfo(){
  const s=await scene(1088),n=structuredClone(s.roots[0]),pl=p(),need=pl.account.level*100;close('.pf-info');
  txt(deep(n,'TextTitle'),'Thông tin');on(deep(n,'TabFeedback'),false);on(deep(n,'TabHelp'),false);on(deep(n,'TabInfo/ImageOn'),true);on(deep(n,'TabInfo/ImageOff'),false);
  const box=deep(n,'BoxAccount');img(deep(box,'ImageAvt'),avatarKey());txt(deep(box,'TextLevel'),pl.account.level);
  txt(deep(box,'TextPlayerName'),pl.displayName);txt(deep(box,'ButtonEditName/Text'),'Đổi tên');
  // Nhãn gốc co theo nội dung (ContentSizeFitter) rồi đặt giá trị ngay sau: gộp nhãn + giá trị vào một dòng.
  const line=(cap,val,text)=>{const n2=deep(box,cap);txt(n2,text);on(deep(box,val),false);const x=comp(n2,'Text');if(x){x.align=3;x.overflow=1}n2.transform={...n2.transform,m_AnchorMin:{x:.5,y:.5},m_AnchorMax:{x:.5,y:.5},m_SizeDelta:{x:340,y:30},m_Pivot:{x:0,y:.5},m_AnchoredPosition:{x:-184,y:n2.transform.m_AnchoredPosition.y}}};
  line('TextAccount','TextUsername','Tài khoản: '+(pl.profile?.username||pl.displayName));
  txt(deep(box,'TextID'),'ID: '+(pl.profile?.id?.slice(-8)||'—'));line('TextGuild','TextGuildName',I2('LBL_FLEET','Hạm đội:').trimEnd()+' '+(pl.guild?.name||'_ _ _'));
  line('TextServerCap','TextServer','Máy chủ: Máy chủ cục bộ');{const id=deep(box,'TextID'),x=comp(id,'Text');if(x)x.align=3;id.transform={...id.transform,m_AnchorMin:{x:.5,y:.5},m_AnchorMax:{x:.5,y:.5},m_SizeDelta:{x:340,y:30},m_Pivot:{x:0,y:.5},m_AnchoredPosition:{x:-184,y:id.transform.m_AnchoredPosition.y}}}
  for(const k of deep(box,'SliderExp/FillArea')?.children||[])on(k,false);txt(deep(box,'TextExp'),`${c.num(pl.account.exp)}/${c.num(need)}`);
  txt(deep(box,'ButtonChangeServer/Text'),'Đổi máy chủ');txt(deep(box,'ButtonLogOut/Text'),'Đăng xuất');
  for(const [box2,label,key] of [['BoxSound','Hiệu ứng','sound'],['BoxMusic','Nhạc nền','music'],['BoxLanguage','Ngôn ngữ',null]]){const b=deep(n,box2);txt(kid(b,'Text'),label);if(key){on(deep(b,'ImageOn'),c.audio()[key]);on(deep(b,'ImageOff'),!c.audio()[key])}}
  const el=mount(n,'pf-info');
  bind(el,'ButtonClose',()=>el.remove());bind(el,'Shade',()=>el.remove());
  const exp=D.find(el,'SliderExp');if(exp){const bar=document.createElement('span');bar.className='pf-exp-fill';bar.style.width=Math.min(100,pl.account.exp/need*100)+'%';D.find(el,'SliderExp/Background')?.appendChild(bar)}
  bind(el,'PlayerAvatar',()=>openAvatar());bind(el,'ButtonEditName',()=>openRename());
  bind(el,'ButtonChangeServer',()=>c.toast('Bản web chỉ có một máy chủ.'));bind(el,'ButtonLanguage',()=>c.toast('Bản web hiện chỉ có Tiếng Việt.'));
  bind(el,'ButtonLogOut',()=>{el.remove();c.action('logout')});
  bind(el,'ButtonSound',()=>{c.action('audio-toggle',{audio:'sound'});el.remove();openInfo()});bind(el,'ButtonMusic',()=>{c.action('audio-toggle',{audio:'music'});el.remove();openInfo()});
 }
 // ---------- PopupChangeAvatar ----------
 async function openAvatar(tab='hero'){
  const [s,av]=await Promise.all([scene(1049),loadAvatars()]),n=structuredClone(s.roots[0]),pl=p();close('.pf-avatar');
  txt(deep(n,'TextTitle'),'Ảnh đại diện');txt(deep(n,'Avatar/Text'),'Ảnh tướng');txt(deep(n,'AvatarSpecial/Text'),'Ảnh đặc biệt');txt(deep(n,'ButtonSave/Text'),'Đổi');txt(deep(n,'ButtonSaveDisable/Text'),'Đổi');
  on(deep(n,'Avatar/ImgOn'),tab==='hero');on(deep(n,'Avatar/ImgOff'),tab!=='hero');on(deep(n,'AvatarSpecial/ImgOn'),tab!=='hero');on(deep(n,'AvatarSpecial/ImgOff'),tab==='hero');
  // PanelTab gốc tự xếp bằng HorizontalLayoutGroup + LayoutElement: đặt sẵn kích thước 2 tab.
  // tab_on / tab_off có viền 9-slice 80+80 rộng hơn ảnh (156): kéo giãn nguyên ảnh để không hở giữa.
  for(const t of ['Avatar','AvatarSpecial'])for(const im of ['ImgOn','ImgOff']){const x=comp(deep(n,t+'/'+im),'Image');if(x)x.mode=0}
  {const pt=deep(n,'PanelTab');pt.transform={...pt.transform,m_SizeDelta:{x:400,y:56}};pt.components=[];['Avatar','AvatarSpecial'].forEach((name,i)=>{const t=kid(pt,name);t.transform={...t.transform,m_AnchorMin:{x:0,y:.5},m_AnchorMax:{x:0,y:.5},m_Pivot:{x:0,y:.5},m_SizeDelta:{x:190,y:56},m_AnchoredPosition:{x:i*205,y:0}}})}
  on(deep(n,'CellAvatar'),false);const el=mount(n,'pf-avatar');
  const cur=pl.avatar||{kind:'hero',id:pl.hero.id},owned=new Set(pl.avatars||[]);let pick=null;
  const list=tab==='hero'?pl.heroes.map(h=>({kind:'hero',id:h.id,key:c.catalog().heroes.find(d=>d.id===h.id)?.visual?.head,name:c.catalog().heroes.find(d=>d.id===h.id)?.name,ok:true}))
   :av.special.map(a=>({kind:'special',id:a.id,key:a.key,name:a.name,desc:a.desc,ok:owned.has(a.id)})).sort((a,b)=>b.ok-a.ok);
  const vp=D.find(el,'BoxAvatars/ScrollView/Viewport'),grid=document.createElement('div');grid.className='pf-avatar-grid';vp.appendChild(grid);
  const save=D.find(el,'ButtonSave'),dis=D.find(el,'ButtonSaveDisable');
  const paint=()=>{for(const x of grid.children)x.classList.toggle('picked',pick&&x.dataset.kind===pick.kind&&x.dataset.id===String(pick.id));const can=!!pick&&!(pick.kind===cur.kind&&String(pick.id)===String(cur.id));save.style.display=can?'':'none';dis.style.display=can?'none':''};
  for(const a of list){const b=document.createElement('button');b.type='button';b.className='pf-avatar-cell'+(a.ok?'':' locked');b.dataset.kind=a.kind;b.dataset.id=a.id;b.title=a.name||'';
   b.innerHTML=`<img class="bg" src="${c.assetSrc('791558cd9af3633458a85b4422832b12_2')}" alt=""><img class="art" src="${c.assetSrc(a.key)}" alt=""><img class="border" src="${c.assetSrc('b0665ab94675b534e994abb5f58b5f66_2')}" alt=""><img class="tick" src="${c.assetSrc('bba745a01cbc4064297dc55cc48349fb_2')}" alt="">${a.kind===cur.kind&&String(a.id)===String(cur.id)?'<span class="now">Đang dùng</span>':''}`;
   b.onclick=e=>{e.stopPropagation();if(!a.ok)return c.toast(a.desc||'Bạn chưa sở hữu ảnh đại diện này.');pick={kind:a.kind,id:a.id};paint()};grid.appendChild(b)}
  paint();
  bind(el,'ButtonClose',()=>el.remove());bind(el,'Shade',()=>el.remove());bind(el,dis,()=>c.toast('Hãy chọn ảnh đại diện khác.'));
  bind(el,'Avatar',()=>{if(tab!=='hero')openAvatar('hero')});bind(el,'AvatarSpecial',()=>{if(tab!=='special')openAvatar('special')});
  bind(el,save,async()=>{if(!pick)return;const d=await c.mutation('/api/profile',{op:'avatar',kind:pick.kind,id:pick.id},{render:false,close:false});if(d){el.remove();c.refresh();if(document.querySelector('.pf-info'))openInfo()}});
 }
 // ---------- PopupRename ----------
 const names=['Luffy','Zoro','Sanji','Nami','Usopp','Robin','Franky','Brook','Jinbe','Chopper','Ace','Sabo','Law','Kidd','Shanks','Mihawk','Buggy','Roger'];
 async function openRename(){
  const s=await scene(1025),n=structuredClone(s.roots[0]),pl=p(),free=!pl.renamed;close('.pf-rename');
  txt(deep(n,'TextTitle'),'Đổi tên');txt(deep(n,'TextCap'),'Nhập tên');txt(deep(n,'ButtonSave/Text'),'Lưu');txt(deep(n,'ButtonSaveFree/Text'),'Lưu');txt(deep(n,'TextCost'),100);
  on(deep(n,'ButtonSave'),!free);on(deep(n,'ButtonSaveFree'),free);
  const el=mount(n,'pf-rename'),field=D.find(el,'InputField');for(const t of field.querySelectorAll('.pd-text'))t.remove();
  const input=document.createElement('input');input.className='pf-name-input';input.maxLength=24;input.value=pl.displayName;input.placeholder='Tên...';input.setAttribute('aria-label','Tên thuyền trưởng');field.appendChild(input);input.focus();input.select();
  const save=async()=>{const v=input.value.trim();const d=await c.mutation('/api/profile',{op:'rename',displayName:v},{render:false,close:false});if(d){el.remove();c.refresh();if(document.querySelector('.pf-info'))openInfo()}};
  bind(el,'ButtonClose',()=>el.remove());bind(el,'Shade',()=>el.remove());bind(el,'ButtonSave',save);bind(el,'ButtonSaveFree',save);
  bind(el,'ButtonGenName',()=>{input.value=names[Math.floor(Math.random()*names.length)]+'_'+(100+Math.floor(Math.random()*900))});
  input.onkeydown=e=>{if(e.key==='Enter')save()};
 }
 // ---------- PopupLevelUp ----------
 async function levelUp(){
  const list=p()?.levelUps;if(levelShowing||!list?.length)return;
  if(document.querySelector('.bonus-popup,.login-root,.intro-layer,.battle-end,.ship-cinema'))return setTimeout(levelUp,700);
  levelShowing=true;
  try{
   const s=await scene(1466),n=structuredClone(s.roots[0]),level=Math.max(...list.map(x=>x.level)),merged=new Map();
   for(const x of list)for(const r of x.rewards)merged.set(r.itemId,(merged.get(r.itemId)||0)+r.quantity);
   txt(deep(n,'TextLevel'),I2('HC_CAP','Cấp ')+level);txt(deep(n,'ButtonClose/Text'),'Đóng');const sp=comp(deep(n,'Spine'),'SkeletonGraphic');
   const el=mount(n,'pf-levelup'),box=D.find(el,'BoxBonus'),row=document.createElement('div');row.className='pf-level-rewards';row.innerHTML=[...merged].map(([itemId,quantity])=>c.rewardTile({itemId,quantity})).join('');box.appendChild(row);
   const host=D.find(el,'EffectLevelUp');if(host&&sp?.skeleton){const cv=document.createElement('canvas');cv.width=W;cv.height=H;cv.className='pf-lvlup-spine';el.insertBefore(cv,el.children[1]);
    c.spine(cv,{skeleton:sp.skeleton,animation:'In'},{loop:false,scale:1,onEnd:()=>{if(cv.isConnected){cv.remove();const loop=document.createElement('canvas');loop.width=W;loop.height=H;loop.className='pf-lvlup-spine';el.insertBefore(loop,el.children[1]);c.spine(loop,{skeleton:sp.skeleton,animation:'Loop'},{loop:true,scale:1})}}})}
   await new Promise(resolve=>{const done=()=>{el.remove();resolve()};bind(el,'ButtonClose',done);bind(el,'Shade',done)});
   await c.post('/api/profile',{op:'level-ack'});
  }finally{levelShowing=false}
 }
 function close(sel){document.querySelector(sel)?.remove()}
 window.ProfileUI={init(ctx){c=ctx;loadAvatars().catch(()=>{})},openInfo:()=>openInfo().catch(e=>c.toast(e.message)),openAvatar,openRename,levelUp,avatarKey};
})();
