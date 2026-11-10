/* Hướng dẫn sau phần mở đầu (TutorialManager gốc), lời thoại MSG_TUTORIAL_* / MISC_2_MSG_FEATURE_* trong intro.json.
 * Mỗi bước: Luffy nói (PanelTutorial 1164, chữ chạy) rồi bàn tay HandTutorial (Spine Hand, 1131) chỉ đúng nút như các điểm
 * PointHand* trong prefab gốc (ButtonCampaign, cổng ải, PopupFormation PointHandBattle, ButtonHeroes, ButtonUpLevel,
 * ButtonQuickEquip, nhiệm vụ chính...). Bước chỉ qua khi người chơi làm đúng việc; tiến độ lưu ở server (player.tutorial).
 * Chuỗi chính: đặt tên (SET_NAME) → vượt ải 1-1 (CAMP_1, cổng ải, CAMP_3 đội hình, CAMP_4 tốc độ, CAMP_5 thắng, CAMP_2)
 * → rương treo máy (CAMP_2_2 / 2_3) → nâng tướng (UP_HERO, UP_HERO_2 lên cấp, UP_HERO_3 trang bị, UP_HERO_4) → nhiệm vụ
 * (COMPLETE_QUEST) → đánh tiếp (CAMP_2_1). Sau đó mỗi tính năng mở theo cấp có một lần giới thiệu (MISC_2_MSG_FEATURE_* +
 * MSG_TUTORIAL_ACTION_*). Có nút "Bỏ qua" (SkipTutorial gốc).
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,data=null,guide=null,hand=null,handKey='',busy=false,doneSaid=new Set(),base={},timer=null,clickSeen=new Set();const scenes={};
 const scene=id=>scenes[id]??=fetch(`scenes/${id}.json`).then(r=>r.json());
 const load=()=>data?Promise.resolve(data):fetch('intro.json').then(r=>r.json()).then(d=>data=d);
 const T=k=>data.tutorial[k]||k;
 const find=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=find(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const p=()=>c.player(),sc=()=>c.currentScene(),$=s=>document.querySelector(s);
 const visible=sel=>{const e=$(sel);return e&&e.offsetParent!==null?e:null};
 const inCampaign=()=>[28,34].includes(sc());
 // Bước chính: scene nào, nói gì, chỉ vào đâu, khi nào qua.
 const core=[
  {id:'name',scene:[13],say:['MSG_TUTORIAL_ACTION_SET_NAME'],run:askName},
  {id:'camp1',scene:[13],say:['MSG_TUTORIAL_ACTION_CAMP_1'],hand:{canvas:'ButtonCampaign'},until:inCampaign},
  {id:'stage',scene:[28,34],hand:{dom:()=>visible('[data-action="stage"].current,[data-action="stage"]:not([disabled])')||visible('[data-action="campaign-chapter"]:not(.locked)')},until:()=>!!visible('[data-action="battle-start"]')},
  {id:'formation',scene:[28,34],say:['MSG_TUTORIAL_ACTION_CAMP_3'],hand:{dom:()=>visible('[data-action="battle-start"]')},until:()=>sc()===9},
  {id:'battle',scene:[9],say:['MSG_TUTORIAL_ACTION_CAMP_4'],until:()=>(p().adventure?.cleared||[]).length>0||p().battle?.status==='won'},
  {id:'win',scene:[9,13,28,34],ready:()=>!(sc()===9&&p().battle?.status==='active')&&!visible('.battle-end'),say:['MSG_TUTORIAL_ACTION_CAMP_5','MSG_TUTORIAL_ACTION_CAMP_2']},
  {id:'afk',scene:[28,34,13],say:['MSG_TUTORIAL_ACTION_CAMP_2_2','MSG_TUTORIAL_ACTION_CAMP_2_3','MSG_TUTORIAL_ACTION_CAMP_2_4'],hand:{dom:()=>visible('[data-action="campaign-afk"]')}},
  {id:'hero',scene:[13,28,34],say:['MSG_TUTORIALACTION_UP_HERO'],hand:{canvas:'ButtonHeroes',dom:()=>inCampaign()?visible('.campaign-back'):null},until:()=>sc()===7||sc()===1156},
  {id:'pick',scene:[7,1156],hand:{dom:()=>visible('.hero-reference-card')},until:()=>sc()===1156},
  {id:'level',scene:[1156],say:['MSG_TUTORIAL_ACTION_UP_HERO_2'],start:()=>{base.level=p().hero.level},hand:{dom:()=>visible('[data-action="upgrade"][data-type="level"]')||visible('[data-action="hero-tab"][data-tab="stats"]')},until:()=>p().hero.level>(base.level??p().hero.level)},
  {id:'equip',scene:[1156],say:['MSG_TUTORIAL_ACTION_UP_HERO_3'],start:()=>{base.gear=Object.keys(p().hero.equipment||{}).length;clickSeen.delete('equip-best')},hand:{dom:()=>visible('[data-action="equip-best"]')||visible('[data-action="hero-tab"][data-tab="equipment"]')},until:()=>clickSeen.has('equip-best')||Object.keys(p().hero.equipment||{}).length>(base.gear??99)},
  {id:'quest',scene:[13,7,1156],say:['MSG_TUTORIAL_ACTION_UP_HERO_4','MSG_TUTORIAL_ACTION_COMPLETE_QUEST'],start:()=>{base.quest=JSON.stringify(p().homeQuest?.id??p().homeQuest?.index??'')},hand:{canvas:()=>sc()===13?'ClickBox':'ButtonBack'},until:()=>!p().homeQuest?.done||JSON.stringify(p().homeQuest?.id??p().homeQuest?.index??'')!==base.quest},
  {id:'again',scene:[13],say:['MSG_TUTORIAL_ACTION_CAMP_2_1'],hand:{canvas:'ButtonCampaign'},until:inCampaign},
 ];
 // Giới thiệu tính năng khi đủ cấp (màn chính), mỗi cái một lần.
 const tips=[
  {id:'checkin',level:2,say:['MSG_TUTORIAL_ACTION_CHECK_IN'],canvas:'ButtonRollcall'},
  {id:'event',level:3,say:['MSG_TUTORIAL_ACTION_EVENT'],canvas:'ButtonEvents'},
  {id:'mission',level:3,say:['MSG_TUTORIAL_ACTION_MISSION'],canvas:'ButtonQuest'},
  {id:'achievement',level:4,say:['MSG_TUTORIAL_ACTION_ARCHIEVEMENT'],canvas:'ButtonAchievement'},
  {id:'shop',level:4,say:['MSG_TUTORIAL_ACTION_SHOP_1','MSG_TUTORIAL_ACTION_SHOP_2','MSG_TUTORIAL_ACTION_SHOP_3'],canvas:'ButtonShop'},
  {id:'bag',level:5,say:['MSG_TUTORIAL_ACTION_COLLECT_SHARD_HERO'],canvas:'ButtonBag'},
  {id:'summon',level:5,say:['MSG_TUTORIAL_ACTION_SHOP_4'],canvas:'ButtonSummon'},
  {id:'forge',level:6,say:['MSG_TUTORIAL_ACTION_FORGE'],canvas:'ButtonForge'},
  {id:'lucky',level:7,say:['MSG_TUTORIAL_ACTION_LUCKY'],canvas:'ButtonLuckySpin'},
  {id:'guild',level:10,say:['MISC_2_MSG_FEATURE_GUILD','MSG_TUTORIAL_ACTION_GUILD'],canvas:'ButtonWorld'},
  {id:'arena',level:14,say:['MISC_2_MSG_FEATURE_ARENA','MSG_TUTORIAL_ACTION_ARENA'],canvas:'ButtonWorld'},
  {id:'tower',level:15,say:['MISC_2_MSG_FEATURE_TOWER','MSG_TUTORIAL_ACTION_TOWER'],canvas:'ButtonWorld'},
  {id:'pet',level:20,say:['MISC_2_MSG_FEATURE_PET','MSG_TUTORIAL_ACTION_PET'],canvas:'ButtonShip'},
  {id:'raid',level:20,say:['MISC_2_MSG_FEATURE_EVENT_RAID'],canvas:'ButtonWorld'},
 ];
 // Màn có cửa sổ khác đang mở (popup, thư, lớp PrefabDOM của tính năng): chờ.
 const overlay=(dialogs=true)=>!!$('.login-root,.intro-layer:not(.tut-guide)')||dialogs&&!!$('#dialog-ui:not(:empty)')||[...document.querySelectorAll('#game-layer>*')].some(e=>!['screen-ui','dialog-ui'].includes(e.id)&&!e.classList.contains('tut-hand')&&!e.classList.contains('tut-guide')&&e.offsetParent!==null&&!e.classList.contains('ship-cast')&&!e.classList.contains('ship-hit'));

 async function say(keys,{skip=true}={}){
  const s=await scene(data.guide.scene),n=structuredClone(s.roots[0]);comp(find(n,'TextTutorial'),'Text').text='';
  guide?.remove();const el=D.render(n,W,H,{assetSrc:c.assetSrc,assets:c.assets()});el.classList.add('intro-layer','intro-guide','tut-guide');guide=el;c.layer().appendChild(el);
  const box=D.find(el,'TextTutorial');box.classList.add('intro-say');
  let skipped=false;
  if(skip){const b=document.createElement('button');b.type='button';b.className='tut-skip';b.textContent='Bỏ qua hướng dẫn';b.onclick=async e=>{e.stopPropagation();skipped=true;await c.post('/api/tutorial',{skip:true});el.click()};el.appendChild(b)}
  for(const key of keys){
   if(skipped)break;const line=T(key);
   await new Promise(resolve=>{let i=0,full=false;const tick=setInterval(()=>{i+=1;box.textContent=line.slice(0,i);if(i>=line.length){full=true;clearInterval(tick)}},26);
    el.onclick=e=>{e.stopPropagation();if(skipped){clearInterval(tick);return resolve()}if(!full){clearInterval(tick);box.textContent=line;full=true;return}resolve()}});
  }
  el.remove();if(guide===el)guide=null;return!skipped;
 }
 // Bàn tay: nút trên canvas (vùng chạm) hoặc phần tử DOM, quy về tọa độ 1136x640 của #game-layer.
 function targetBox(h){
  if(!h)return null;const el=h.dom?.();
  if(el){const L=c.layer().getBoundingClientRect(),k=L.width/W,r=el.getBoundingClientRect();return{x:(r.left-L.left)/k,y:(r.top-L.top)/k,w:r.width/k,h:r.height/k}}
  const name=typeof h.canvas==='function'?h.canvas():h.canvas;return name&&!inCampaign()?window.GameView.hitBox?.(name):null;
 }
 async function pointAt(box,key){
  if(!box){clearHand();return}
  const x=Math.round(box.x+box.w/2),y=Math.round(box.y+box.h/2);
  if(hand&&handKey===key){hand.style.left=x+'px';hand.style.top=y+'px';return}
  clearHand();const s=await scene(data.guide.hand),sk=comp(find(s.roots[0],'Skeleton'),'SkeletonGraphic');
  const wrap=document.createElement('div');wrap.className='intro-hand tut-hand';wrap.style.left=x+'px';wrap.style.top=y+'px';
  const cv=document.createElement('canvas');cv.width=260;cv.height=260;wrap.appendChild(cv);c.layer().appendChild(wrap);hand=wrap;handKey=key;
  c.spine(cv,{skeleton:sk.skeleton,animation:sk.animation||'Hand'},{loop:true,scale:1});
 }
 function clearHand(){hand?.remove();hand=null;handKey=''}
 async function askName(){
  const name=p().profile?.displayName||p().displayName||'';
  c.modal('Xin hãy cho biết quý danh!',`<label class="tut-name-label" for="tut-name">Tên thuyền trưởng</label><input id="tut-name" maxlength="24" value="${c.escape(name)}" autocomplete="off"><div class="modal-actions"><button class="green" data-tut-name>Xác nhận</button></div>`);
  await new Promise(resolve=>{const b=$('[data-tut-name]');if(!b)return resolve();b.onclick=async()=>{const v=$('#tut-name').value.trim();if(v&&v!==name){const d=await c.mutation('/api/profile',{displayName:v},{render:false});if(!d)return}c.closeDialog();resolve()}});
 }
 async function advance(i){clearHand();base={};await c.post('/api/tutorial',{index:i})}
 async function tick(){
  if(busy||!c)return;const t=p()?.tutorial;if(!t||!p().hero||window.IntroUI?.pending()){clearHand();return}
  busy=true;
  try{
   await load();
   if(t.core<core.length){
    const i=t.core,step=core[i];
    // Đã làm xong việc của bước (kể cả khi đang ở màn khác, hoặc vừa tải lại trang): qua bước.
    if(step.until&&(doneSaid.has(i)||!step.start)&&step.until())return advance(i);
    if(!step.scene.includes(sc())||(step.ready&&!step.ready())){clearHand();return}
    const blocking=overlay(false);if(blocking&&!step.hand){clearHand();return}
    if(!doneSaid.has(i)){
     if(blocking)return;step.start?.();doneSaid.add(i);
     if(step.say&&!(await say(step.say)))return clearHand();
     if(step.run){await step.run();return advance(i)}
     if(!step.until){return advance(i)}
    }
    if(step.until?.())return advance(i);
    if(!blocking)await pointAt(targetBox(step.hand),step.id);else clearHand();
    return;
   }
   if(sc()!==13||overlay()){clearHand();return}
   const tip=tips.find(x=>p().account.level>=x.level&&!t.tips.includes(x.id));if(!tip){clearHand();return}
   await c.post('/api/tutorial',{tip:tip.id});if(!(await say(tip.say)))return;
   const box=window.GameView.hitBox?.(tip.canvas);if(box){await pointAt(box,'tip-'+tip.id);setTimeout(()=>{if(handKey==='tip-'+tip.id)clearHand()},5000)}
  }catch(e){console.warn('tutorial',e)}finally{busy=false}
 }
 document.addEventListener('click',e=>{const a=e.target.closest?.('[data-action]')?.dataset.action;if(a)clickSeen.add(a);if(handKey.startsWith('tip-'))clearHand()},true);
 window.TutorialUI={init(ctx){c=ctx;clearInterval(timer);timer=setInterval(tick,450)},active:()=>!!p()?.tutorial&&p().tutorial.core<core.length,steps:core.map(s=>s.id),clear:clearHand};
})();
