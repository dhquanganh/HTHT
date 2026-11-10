/* Màn tải game và đăng nhập gốc, dựng bằng PrefabDOM từ scene APK (dữ liệu: login.json, tools/export-login.py):
 *   SplashScene (scene 0): SplashInit (BlackBgr -> bgr_splash2, logo hiện dần và trượt lên từ Point1 tới Point2)
 *     rồi SplashTheme (bgr_cang_hai_tac, Ace bay vào từ trái, ace_title từ phải, logo góc trái). Chạy đủ một lần mỗi phiên trình duyệt.
 *   LoginScene (scene 1): nền ThemeBgr là prefab BackgroundLogin của máy chủ (Spine Kaido + logo_login), PanelInitData
 *     (thanh "Loading" mảnh ở đáy) theo tiến độ tải thật; vào game thì PanelLoadingAsset "Cập nhật dữ liệu" chạy đầy rồi mờ đi.
 *   BoxLogin (tab Grep: Tên đăng nhập / Mật khẩu, Đăng nhập / Đăng ký) và BoxRegister (Tên đăng nhập / Mật khẩu /
 *     Xác nhận mật khẩu, Quay lại / Đăng ký). Ô nhập là <input> thật đặt đúng vào khung InputField gốc; các ô hồ sơ
 *     (điện thoại, CMT, ngày sinh, email) của bản gốc không dùng vì máy chủ web không lưu thông tin cá nhân.
 *   Giữ id cũ (#auth-form, #username, #password, #password-confirm, .auth-submit, data-action auth-login/auth-register)
 *   để game.js và các script QA dùng như trước.
 */
(()=>{
 'use strict';
 const W=1136,H=640,D=()=>window.PrefabDOM;
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5}};
 const shell=(children,name='Root')=>({id:name,name,active:true,components:[],transform:full,children});
 const deep=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=deep(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const scenes={};const scene=id=>scenes[id]??=fetch(`scenes/${id}.json`).then(r=>{if(!r.ok)throw Error('scene '+id);return r.json()});
 let data=null,root=null,stage=null,bar=null,progress=0,target=.08,splashDone=null,hidden=false,mode=null,form=null,kaidoResume=null;
 const loaded=fetch('login.json').then(r=>r.json()).then(d=>data=d);
 const opts=()=>({assetSrc:k=>data.assets[k]?.src||window.GameView?.assets()?.[k]?.src||'',assets:{...(window.GameView?.assets()||{}),...data.assets}});
 const canvasOf=s=>structuredClone(s.roots.find(r=>r.name==='Canvas'));
 const layer=()=>document.querySelector('#game-layer');
 const render=(node,cls)=>{const el=D().render(node,W,H,opts());el.classList.add(...cls.split(' '));return el};

 // ---------- SplashScene ----------
 async function splash(){
  const s=canvasOf(await scene(data.splash)),init=deep(s,'SplashInit'),theme=deep(s,'SplashTheme');
  deep(init,'ImageLogo').active=true;theme.active=true;deep(theme,'LogoEn').active=false;
  const a=render(shell([deep(s,'BlackBgr'),init]),'splash-init'),b=render(shell([theme]),'splash-theme');
  root.append(a,b);await images(root);a.classList.add('play');await wait(2300);b.classList.add('play');await wait(2500);
  a.remove();b.classList.add('out');setTimeout(()=>b.remove(),600);
 }
 const images=el=>Promise.race([wait(2500),Promise.all([...el.querySelectorAll('.pd-image,[style*="background-image"]')].map(x=>{const m=(x.style.backgroundImage||'').match(/url\("?(.*?)"?\)/);if(!m)return null;const i=new Image();i.src=m[1];return i.decode().catch(()=>{})}))]);

 // ---------- LoginScene ----------
 async function loginStage(){
  const s=canvasOf(await scene(data.login));
  // ThemeBgr: nền máy chủ (BackgroundLogin). Logo của nền thay logo mặc định ở góc trái trên.
  const bgr=deep(s,'BgrContainer'),themeNode=structuredClone(data.theme);themeNode.transform={...full};
  deep(bgr,'DefaultBgr').active=false;deep(bgr,'Logo').active=false;deep(bgr,'ThemeBgr').children=[themeNode];
  const logo=deep(themeNode,'ImageLogo');logo.transform={...logo.transform,m_AnchorMin:{x:0,y:1},m_AnchorMax:{x:0,y:1},m_Pivot:{x:0,y:1},m_AnchoredPosition:{x:14,y:-96},m_SizeDelta:{x:270,y:184}};
  const keep=['BgrContainer','PanelInitData','PanelLoadingAsset','PanelTopRight','logo_18'];
  deep(s,'ButtonClearAsset').active=false;deep(s,'ButtonInfo').active=false;
  const el=render(shell(s.children.filter(n=>keep.includes(n.name))),'login-stage');stage=el;root.appendChild(el);
  bar=D().find(el,'PanelInitData');setBar(bar,progress);
  const loading=D().find(el,'PanelLoadingAsset/SliderProgress');if(loading){loading.style.display='none';D().setText(D().find(loading,'TextTitle'),'Cập nhật dữ liệu')}
  startKaido(el,deep(themeNode,'Skeleton'));
 }
 function setBar(panel,value){
  if(!panel)return;const v=Math.max(0,Math.min(1,value)),fill=D().find(panel,'Fill'),handle=D().find(panel,'Handle'),text=D().find(panel,'TextProgress');
  if(fill){fill.style.right='auto';fill.style.width=`calc(${v*100}% + 0px)`}if(handle){handle.style.left=`calc(${v*100}% - 5px)`}if(text)D().setText(text,`Loading ${Math.round(v*100)}%`);
 }
 // Spine splash_kaido: gốc skeleton đặt ở node Skeleton (-572,373 trong SpineSplash), 1 đơn vị = 1 px như SkeletonGraphic.
 async function startKaido(el,node){
  const host=D().find(el,'Skeleton'),graphic=comp(node,'SkeletonGraphic');if(!host||!graphic?.skeleton)return;
  for(let i=0;i<100&&!window.GameView?.loadSkeleton;i++)await wait(50);
  const c={skeleton:graphic.skeleton,animation:graphic.animation||'animation',loop:true};await window.GameView.loadSkeleton(c);if(!c.instance||!el.isConnected)return;
  const cv=document.createElement('canvas'),zoomOf=()=>Math.max(1,Math.min(3,(layer()?.getBoundingClientRect().width||W)/W*(window.devicePixelRatio||1)));
  cv.className='login-kaido';const bg=D().find(el,'Background');bg.insertBefore(cv,bg.firstChild.nextSibling);
  const name=c.instance.data.findAnimation(c.animation)?.name||c.instance.data.animations[0]?.name;c.state.setAnimation(0,name,true);
  const renderer=new spine.canvas.SkeletonRenderer(cv.getContext('2d'));renderer.triangleRendering=true;let last=performance.now(),running=true;
  // Rời màn đăng nhập thì dừng vẽ; đăng xuất quay lại thì chạy tiếp (kaidoResume).
  kaidoResume=()=>{if(!running){running=true;last=performance.now();requestAnimationFrame(frame)}};
  const frame=at=>{if(!cv.isConnected){running=false;return}const z=zoomOf(),w=bg.offsetWidth,h=bg.offsetHeight;if(cv.width!==Math.round(w*z)){cv.width=Math.round(w*z);cv.height=Math.round(h*z)}
   c.state.update(Math.min(.05,(at-last)/1000));last=at;c.state.apply(c.instance);c.instance.updateWorldTransform();
   const ctx=cv.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
   // Vị trí gốc: tâm Background + SpineSplash (0,0) + Skeleton (x,y) theo hệ y lên của Unity.
   const p=node.transform.m_AnchoredPosition;ctx.setTransform(z,0,0,-z,(w/2+p.x)*z,(h/2-p.y)*z);renderer.draw(c.instance);requestAnimationFrame(frame)};
  requestAnimationFrame(frame);
 }
 // Thanh "Loading" tiến dần theo các mốc tải; chạm 100% khi game hiện scene đầu tiên.
 function tick(){if(hidden)return;progress+=(target-progress)*.08;if(target<.9)target=Math.min(.9,target+.0025);setBar(bar,progress);requestAnimationFrame(tick)}

 async function start(){
  root=document.createElement('div');root.className='login-root';document.body.classList.add('login-open');
  for(let i=0;i<100&&!layer();i++)await wait(20);layer().appendChild(root);
  await loaded;let seen=false;try{seen=sessionStorage.getItem('htps-splash')==='1'}catch{}
  splashDone=(async()=>{await loginStage();if(!seen){await splash();try{sessionStorage.setItem('htps-splash','1')}catch{}}})();
  requestAnimationFrame(tick);await splashDone;
 }

 // ---------- BoxLogin / BoxRegister ----------
 const inputs={FieldUsername:{id:'username',name:'username',autocomplete:'username',placeholder:'Tên thuyền trưởng',minlength:3,maxlength:24,pattern:'[A-Za-z0-9_]{3,24}'},
  FieldPassword:{id:'password',name:'password',type:'password',autocomplete:'current-password',placeholder:'Tối thiểu 8 ký tự',minlength:8,maxlength:128},
  FieldPassword1:{id:'password',name:'password',type:'password',autocomplete:'new-password',placeholder:'Tối thiểu 8 ký tự',minlength:8,maxlength:128},
  FieldPassword2:{id:'password-confirm',name:'confirm',type:'password',autocomplete:'new-password',placeholder:'Nhập lại mật khẩu',minlength:8,maxlength:128}};
 async function buildBox(next,error){
  const s=canvasOf(await scene(data.login)),register=next==='register',box=deep(s,register?'BoxRegister':'BoxLogin');box.active=true;
  if(register){for(const f of ['FieldPhone','FieldFullName','FieldCMT','FieldBirth','FieldEmail'])deep(box,f).active=false;const l=deep(box,'Layout');l.transform={...l.transform,m_SizeDelta:{...l.transform.m_SizeDelta,y:270}}}
  else{deep(box,'BoxGosu').active=false;deep(box,'BoxGrep').active=true;const gosu=deep(box,'ButtonTabGosu');deep(gosu,'ImageOn').active=false;deep(gosu,'ImageOff').active=true}
  const mark=n=>{if(comp(n,'InputField')&&inputs[n.name])n.loginInput=inputs[n.name];for(const k of n.children||[])mark(k)};mark(box);
  const el=render(shell([box]),'login-box '+(register?'register':'login'));
  for(const host of el.querySelectorAll('.pd-node')){const spec=host._node?.loginInput;if(!spec)continue;for(const t of host.querySelectorAll(':scope>.pd-text'))t.remove();
   const input=document.createElement('input');input.className='login-input';input.required=true;for(const [k,v] of Object.entries(spec))input.setAttribute(k,v);input.setAttribute('aria-label',spec.placeholder);host.appendChild(input)}
  const button=(path,attrs,label)=>{const host=D().find(el,path);if(!host)return null;const b=document.createElement('button');b.className='login-hit';for(const [k,v] of Object.entries(attrs))b.setAttribute(k,v);b.setAttribute('aria-label',label);host.appendChild(b);return b};
  if(register){button('ButtonBack',{type:'button','data-action':'auth-login'},'Quay lại');button('ButtonRegister',{type:'submit',class:'login-hit auth-submit','data-submit':''},'Đăng ký')}
  else{button('BoxGrep/ButtonLogin',{type:'submit',class:'login-hit auth-submit','data-submit':''},'Đăng nhập');button('BoxGrep/ButtonRegister',{type:'button','data-action':'auth-register'},'Đăng ký');
   button('ButtonTabGrep',{type:'button'},'Grep');button('ButtonTabGosu',{type:'button','data-login-gosu':''},'Gosu')}
  const err=document.createElement('p');err.id='auth-error';err.className='login-error';err.setAttribute('role','alert');err.textContent=error||'';
  const f=document.createElement('form');f.id='auth-form';f.className='login-form';f.setAttribute('autocomplete','on');f.noValidate=false;f.append(el,err);
  f.addEventListener('click',e=>{if(e.target.closest('[data-login-gosu]')){e.preventDefault();window.GameView?.toast('Đăng nhập Gosu chưa hỗ trợ trên bản web. Hãy dùng tài khoản Grep.')}});
  return f;
 }
 window.LoginUI={
  /** Gọi từ game.js mỗi lần vẽ lại màn đăng nhập. Giữ nguyên ô đang nhập nếu không đổi chế độ. */
  async showAuth(next,error=''){
   await splashDone;if(!root)return;
   if(hidden){hidden=false;root.classList.remove('out');layer().appendChild(root);document.body.classList.add('login-open');kaidoResume?.()}
   setBar(bar,1);if(bar)bar.style.display='none';
   if(mode===next&&form?.isConnected){if(error)form.querySelector('#auth-error').textContent=error;return}
   mode=next;const f=await buildBox(next,error);form?.remove();form=f;root.appendChild(f);f.querySelector('#username')?.focus({preventScroll:true});
  },
  /** Game đã hiện một scene trong game: chạy "Cập nhật dữ liệu" rồi mờ đi, không chặn thao tác. */
  async enterGame(){
   if(hidden||!root)return;await splashDone;target=1;root.classList.add('leaving');form?.remove();form=null;mode=null;
   if(bar)bar.style.display='none';const loading=D().find(stage,'PanelLoadingAsset/SliderProgress');
   if(loading){loading.style.display='';const fill=D().find(loading,'Fill');for(let i=0;i<=10;i++){if(fill){fill.style.right='auto';fill.style.width=i*10+'%'}D().setText(D().find(loading,'TextProgress'),i*10+'%');await wait(45)}}
   hidden=true;root.classList.add('out');document.body.classList.remove('login-open');await wait(450);root.remove();root.classList.remove('leaving');if(loading)loading.style.display='none';if(bar){bar.style.display=''}
  },
  whenHidden:async()=>{while(!hidden)await wait(100)},
  get open(){return!hidden},
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
