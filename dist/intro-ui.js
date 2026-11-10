/* Phần mở đầu cho tài khoản mới (TutorialStory gốc), dữ liệu ở intro.json (tools/export-intro.py):
 *   1. TutorialStory (scene 1207): 3 tranh trượt ngang, mỗi tranh hiện dần, 5 dòng chữ hiện lần lượt ở đáy, nhạc theme_story,
 *      nút battle_skip góc phải dưới để bỏ qua.
 *   2. PanelTutorial (1164): Luffy (help_1) dẫn chuyện trong khung rect_13, chữ chạy, mũi tên arrow_next để sang câu.
 *   3. Màn Chiêu mộ (scene 24): bàn tay HandTutorial (Spine Hand) chỉ vào nút chiêu mộ x10 dùng 10 Thùng bia được tặng.
 *   4. Có thuyền viên rồi: "Rất tốt! ..." rồi vào màn chính. Tiến độ lưu ở server (player.intro: story -> summon -> done),
 *      tải lại trang giữa chừng thì tiếp tục đúng bước.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,data=null,music=null,layer=null,guide=null,hand=null,running=false;const scenes={};
 const scene=id=>scenes[id]??=fetch(`scenes/${id}.json`).then(r=>{if(!r.ok)throw Error('Không tải được phần mở đầu.');return r.json()});
 const load=()=>data?Promise.resolve(data):fetch('intro.json').then(r=>{if(!r.ok)throw Error('Không tải được phần mở đầu.');return r.json()}).then(d=>data=d);
 const deep=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=deep(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const pending=()=>{const p=c?.player();return!!p&&(!p.hero||(!!p.intro&&p.intro!=='done'))};

 // Nhạc theme_story: trình duyệt có thể chặn tự phát trước khi người chơi chạm; thử lại ở lần chạm kế tiếp.
 function playMusic(){
  if(!music){music=new Audio(data.music);music.loop=true;music.volume=.55}
  const go=()=>music.play().catch(()=>document.addEventListener('pointerdown',()=>music?.play().catch(()=>{}),{once:true}));go();
 }
 function stopMusic(){if(!music)return;const m=music;music=null;const step=()=>{m.volume=Math.max(0,m.volume-.05);if(m.volume>0)setTimeout(step,60);else m.pause()};step()}

 // 1. TutorialStory: dải 3 tranh (padding 88, cách 200 -> mỗi bước dịch 1160 để tranh nằm giữa khung).
 async function story(){
  const s=await scene(data.story.scene),n=structuredClone(s.roots[0]);
  for(const [name,text] of Object.entries(data.story.lines)){const t=deep(n,name);t.active=true;comp(t,'Text').text=text}
  // Tranh trong prefab có màu alpha 0 (script gốc làm hiện dần): đặt alpha 1, độ mờ do CSS điều khiển.
  for(const p of data.story.panels){const img=comp(deep(n,p.image),'Image');if(img)img.color=[1,1,1,1]}
  const el=D.render(n,W,H,opts());el.classList.add('intro-layer','intro-story');layer=el;c.layer().appendChild(el);
  const strip=D.find(el,'GameObject'),images=data.story.panels.map(p=>D.find(el,p.image)),texts=Object.keys(data.story.lines).map(k=>D.find(el,k));
  strip.classList.add('intro-strip');images.forEach((img,i)=>{img.classList.add('intro-panel');img.style.left=(88+i*data.story.step)+'px';img.style.top=(H/2-320)+'px'});
  for(const t of texts)t.classList.add('intro-line');
  let skipped=false;const skip=D.find(el,'Button');skip.classList.add('intro-skip');
  const done=new Promise(resolve=>{skip.onclick=e=>{e.stopPropagation();skipped=true;resolve()};
   (async()=>{
    for(const [i,panel] of data.story.panels.entries()){
     if(skipped)return;strip.style.transform=`translateX(${-i*data.story.step}px)`;await wait(i?900:300);if(skipped)return;images[i].classList.add('on');await wait(900);
     for(const name of panel.texts){if(skipped)return;const t=D.find(el,name);t.classList.add('on');await wait(Math.max(2600,data.story.lines[name].length*55));t.classList.remove('on');await wait(350)}
    }
    await wait(500);resolve();
   })();
  });
  await done;el.classList.add('out');await wait(450);el.remove();layer=null;
 }

 // 2. PanelTutorial: chữ chạy, chạm mũi tên (hoặc bất kỳ đâu) để hiện hết / sang câu tiếp.
 async function say(lines,{dim=true}={}){
  const s=await scene(data.guide.scene),n=structuredClone(s.roots[0]);comp(deep(n,'TextTutorial'),'Text').text='';
  guide?.remove();const el=D.render(n,W,H,opts());el.classList.add('intro-layer','intro-guide');if(!dim)el.classList.add('clear');guide=el;c.layer().appendChild(el);
  const box=D.find(el,'TextTutorial');box.classList.add('intro-say');
  for(const line of lines){
   await new Promise(resolve=>{let i=0,full=false;const tick=setInterval(()=>{i+=1;box.textContent=line.slice(0,i);if(i>=line.length){full=true;clearInterval(tick)}},28);
    el.onclick=e=>{e.stopPropagation();if(!full){clearInterval(tick);box.textContent=line;full=true;return}resolve()}});
  }
  el.remove();if(guide===el)guide=null;
 }

 // 3. Bàn tay chỉ vào nút trên canvas: vị trí lấy từ vùng chạm của nút (GameView.hitBox).
 async function point(name){
  clearHand();let box=null;for(let i=0;i<60&&!box;i++){box=window.GameView.hitBox?.(name);if(!box)await wait(50)}
  if(!box)return;const s=await scene(data.guide.hand),sk=comp(deep(s.roots[0],'Skeleton'),'SkeletonGraphic');
  const wrap=document.createElement('div');wrap.className='intro-hand';wrap.style.left=(box.x+box.w/2)+'px';wrap.style.top=(box.y+box.h/2)+'px';
  // Gốc skeleton Hand là đầu ngón tay (vòng target): vẽ tỉ lệ 1, gốc ở giữa canvas = tâm nút.
  const cv=document.createElement('canvas');cv.width=260;cv.height=260;wrap.appendChild(cv);c.layer().appendChild(wrap);hand=wrap;
  c.spine(cv,{skeleton:sk.skeleton,animation:sk.animation||'Hand'},{loop:true,scale:1});
 }
 const clearHand=()=>{hand?.remove();hand=null};

 async function summonStep(){
  if(c.currentScene()!==24)await c.navigate(24);
  const p=c.player();if(p.hero)return finish();
  const s=data.guide.summon;await say([s[0]],{dim:false});await say([s[1]],{dim:false});
  const barrels=c.player().inventory['consumable:16']||0;point(barrels>=10?'ButtonSummon10':'ButtonSummon1');
 }
 async function finish(){
  clearHand();await wait(400);await say([data.guide.done]);
  await c.post('/api/intro',{step:'done'});stopMusic();running=false;c.closeDialog();await c.navigate(13);
 }
 async function run(){
  if(running)return;running=true;
  try{
   await load();await window.LoginUI?.whenHidden();playMusic();let p=c.player();
   if(p.intro==='story'||!p.intro){await story();await c.post('/api/intro',{step:'summon'});await say(data.guide.welcome);p=c.player()}
   await summonStep();
  }catch(e){running=false;c.toast(e.message)}
 }
 window.IntroUI={
  init(ctx){c=ctx},pending,active:()=>running,
  start(){if(pending())run()},
  // Gọi sau mỗi lần chiêu mộ trong phần mở đầu: có tướng rồi thì kết thúc, không thì chỉ lại nút còn dùng được.
  afterSummon(){if(!running)return;if(c.player().hero){clearHand();setTimeout(()=>finish(),900)}else point('ButtonSummon1')},
  blockBack(){if(!running)return false;c.toast('Hãy chiêu mộ thuyền viên đầu tiên bằng Thùng bia.');return true},
 };
})();
