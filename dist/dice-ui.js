/* Đổ xúc xắc — PanelEventDice gốc dựng bằng PrefabDOM (dice.json, tools/export-dice.py), luật ở server/dice.mjs.
 *   Bàn 22 ô + ô xuất phát (DiceTile: ô tài nguyên Lv / số lượng, ô kích hoạt nền xanh / đỏ), Fujitora (Spine chibi_fuji)
 *   đi từng ô, xúc xắc lăn (Spine dice_rolling GreenRoll / RedRoll) rồi hiện mặt dice_green_N / dice_red_N,
 *   PanelDiceSelectNumber (xúc xắc may mắn chọn số), PanelDiceSelectCard (3 lá bài, lật card2), PanelDiceReward (mốc sao),
 *   nút Xúc xắc hằng ngày, mua thêm xúc xắc bằng kim cương, ô "Bỏ qua hiệu ứng".
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640;
 let c=null,data=null,root=null,busy=false,skip=false;
 try{skip=localStorage.getItem('htps_dice_skip')==='1'}catch{}
 const find=(n,name)=>{if(!n)return null;if(n.name===name)return n;for(const k of n.children||[]){const r=find(k,name);if(r)return r}return null};
 const comp=(n,type)=>n?.components?.find(x=>x.type===type);
 const txt=(n,t)=>{const x=comp(n,'Text');if(x)x.text=String(t)};
 const on=(n,v=true)=>{if(n)n.active=!!v;return n};
 const full={m_AnchorMin:{x:0,y:0},m_AnchorMax:{x:1,y:1},m_SizeDelta:{x:0,y:0},m_AnchoredPosition:{x:0,y:0},m_Pivot:{x:.5,y:.5}};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const p=()=>c.player(),st=()=>p().dice;
 const img=k=>c.assetSrc(data.images[k]);
 const opts=()=>({assetSrc:c.assetSrc,assets:c.assets()});
 const shade=n=>({id:'dd',name:'DiceRoot',active:true,components:[],transform:full,children:[{id:'sh',name:'Shade',active:true,components:[{type:'Image',color:[0,0,0,.6]}],transform:full,children:[]},n]});
 const bind=(el,x,f)=>{if(typeof x==='string')x=D.find(el,x);if(x){x.classList.add('pd-button');x.onclick=e=>{e.stopPropagation();f(e)}}return x};
 const triggerImg={7:'dice_trigger_start',5:'dice_trigger_more_dice_1',6:'dice_trigger_more_dice_2',3:'dice_trigger_tarot',4:'dice_trigger_dizzy'};
 const help={7:I2('HC_DIEM_XUAT_PHAT','Điểm xuất phát'),5:'Đi vào để nhận thêm 1 xúc xắc thường',6:'Đi vào để nhận thêm 1 xúc xắc may mắn',3:'Chọn 1 trong 3 lá bài ngẫu nhiên. Lá bài có thể: May mắn hoặc Xui Xẻo!',4:'Đi vào ô này bạn sẽ bị choáng. Nếu lần xúc xắc kế tiếp là chẵn thì được đi tiến, lẻ thì bị đi lùi'};
 const effects={2:'x2 điểm lần quay tiếp',4:'Chẵn tiến, lẻ lùi',5:'Đi lùi lần quay tiếp',8:'Không nhận thưởng lần đi kế'};
 const cards={1:['Tài nguyên','Nhận tài nguyên ngẫu nhiên','tarot_1'],2:['X2','X2 điểm xúc xắc lần quay sau','tarot_2'],5:['Đi lùi','Đi lùi lần quay sau','tarot_5'],6:['Tăng cấp','Tăng cấp độ 1 ô bất kì','tarot_6'],
  9:['Giảm cấp',I2('HC_GIAM_CAP_DO_1_O_BAT_KI','Giảm cấp độ 1 ô bất kì'),'tarot_9'],7:['Về điểm khởi đầu',I2('HC_BI_QUAY_VE_DIEM_KHOI_DAU','Bị quay về điểm khởi đầu'),'tarot_7'],8:['Mất tài nguyên','Không nhận được phần thưởng ở lần đi kế tiếp','tarot_8']};
 // Toạ độ ô (DiceMap gốc, tâm bảng): 0 là xuất phát.
 let tilePos=[];
 async function open(){
  data??=await fetch('dice.json').then(r=>{if(!r.ok)throw Error('Không tải được sự kiện.');return r.json()});render();
  if(st().tarot)setTimeout(tarot,400);
 }
 function render(){
  const n=structuredClone(data.prefabs.PanelEventDice),s=st();n.transform={...full};
  on(find(n,'ViewBlock'),false);on(find(n,'FieldCountdown'),false);
  txt(find(n,'TextStar'),c.num(s.stars));txt(find(n,'TextLap'),`Vòng ${s.lap}/${s.lapMax}`);
  txt(find(n,'TextNumDice1'),s.normal);txt(find(n,'TextNumDice2'),s.lucky);txt(find(n,'TextEffect'),effects[s.effect]||'');
  on(find(n,'ButtonFree'),s.freeToday);on(find(n,'DiceRollingSpine'),false);on(find(n,'DiceNumberGreen'),false);on(find(n,'DiceNumberRed'),false);
  const tiles=[find(n,'DiceTileStart'),...Array.from({length:22},(_,i)=>find(n,'DiceTile'+(i+1)))];
  tilePos=tiles.map(t=>t.transform.m_AnchoredPosition);
  tiles.forEach((t,i)=>{
   const info=i?s.tiles[i-1]:{type:2,trigger:7},resource=info.type===1;t.tileIndex=i;
   on(find(t,'TileResource'),resource);on(find(t,'TileTrigger'),!resource);
   if(resource){on(find(t,'ImageMap'),info.key===-100);const item=find(t,'ImageItem');on(item,info.key!==-100);if(info.key!==-100){const im=comp(item,'Image'),key=c.items.get(info.itemId)?.assetKey||(info.itemId==='spirit'?c.named('icon_spirit'):null);if(im&&key)im.asset=key}
    txt(find(t,'TextLevel'),'Lv.'+info.level);txt(find(t,'TextNumber'),c.short(info.amount))}
   else{const green=[5,6,7].includes(info.trigger);on(find(t,'ImageGreen'),green);on(find(t,'ImageRed'),!green);for(const [name,tr] of [['Start',7],['Dice1',5],['Dice2',6],['Tarot',3],['Dizzy',4]])on(find(t,name),info.trigger===tr)}
  });
  const el=D.render(n,W,H,opts());el.classList.add('dice-layer');
  root?.remove();root=el;c.layer().appendChild(el);
  bind(el,'ButtonBack',close);bind(el,'ButtonInfo',()=>c.modal('Đổ xúc xắc',`<p class="item-description">Đổ xúc xắc để đi trên bàn 22 ô. Dừng ở ô tài nguyên nhận thưởng và ô lên cấp (tối đa 3). Ô sao: đi qua hay dừng đều nhận sao, tích sao đổi quà ở bảng Phần thưởng. Hết 1 vòng nhận thêm sao.\n\nXúc xắc thường ra số ngẫu nhiên, xúc xắc may mắn tự chọn số. Ô xanh: thêm xúc xắc. Ô đỏ: lá bài (may hoặc xui) và choáng (lần sau chẵn tiến, lẻ lùi).\n\nMỗi ngày nhận ${s.dailyDice} xúc xắc miễn phí; mua thêm ${s.price} kim cương / xúc xắc (còn ${s.buyLeft} lượt hôm nay). Sự kiện làm mới mỗi tuần.</p>`));
  bind(el,'ButtonReward',rewards);bind(el,'ButtonFree',async()=>{if(await c.mutation('/api/dice',{op:'free'},{render:false,close:false}))render()});
  bind(el,'ButtonRoll1',()=>roll(false));bind(el,'ButtonRoll2',()=>{if(st().lucky<=0)return c.toast(I2('HC_HET_XUC_XAC','Hết xúc xắc!!!'));pickNumber()});bind(el,'ButtonAddDice',buy);
  for(const t of el.querySelectorAll('.pd-node')){const i=t._node?.tileIndex;if(i===undefined)continue;bind(el,t,()=>{const info=i?st().tiles[i-1]:{type:2,trigger:7};c.toast(info.type===2?help[info.trigger]:info.key===-100?'Khi đi qua ô này thì nhận được số sao tương ứng. Tích luỹ sao để đổi các phần quà rất giá trị':`Lv.${info.level}: nhận ${c.short(info.amount)} khi dừng ở ô này`)})}
  const toggle=D.find(el,'ToggleSkip');if(toggle){toggle.classList.toggle('on',skip);bind(el,toggle,()=>{skip=!skip;try{localStorage.setItem('htps_dice_skip',skip?'1':'0')}catch{}toggle.classList.toggle('on',skip)})}
  // Fujitora trên ô hiện tại.
  const hero=document.createElement('div');hero.className='dice-hero';D.find(el,'GroupPlayer').appendChild(hero);
  const cv=document.createElement('canvas');cv.width=140;cv.height=160;hero.appendChild(cv);c.spine(cv,{skeleton:data.spines.chibi_fuji,animation:'Idle'},{loop:true,fit:.95});place(hero,s.tile);
 }
 const place=(hero,i)=>{const q=tilePos[i]||{x:0,y:0};hero.style.left=q.x+'px';hero.style.top=(-q.y)+'px'};
 function buy(){const s=st();if(s.buyLeft<=0)return c.toast('Đã hết lượt mua hôm nay.');c.confirm(`Mua 5 xúc xắc với ${s.price*5} kim cương?`,'Mua xúc xắc',s.price*5,async()=>{if(await c.mutation('/api/dice',{op:'buy',count:Math.min(5,s.buyLeft)},{render:false,close:false}))render()})}
 function pickNumber(){
  const n=structuredClone(data.prefabs.PanelDiceSelectNumber);on(find(n,'ButtonSelect'),true);
  for(let i=1;i<=6;i++){const d=find(n,'ImageDice'+i);d.diceNumber=i;on(find(d,'ImageTick'),false)}
  const el=D.render(shade(n),W,H,opts());el.classList.add('dice-layer','dice-popup');c.layer().appendChild(el);let pick=0;
  const close=()=>el.remove();bind(el,'ButtonClose',close);bind(el,'Shade',close);
  for(const d of el.querySelectorAll('.pd-node')){const i=d._node?.diceNumber;if(!i)continue;bind(el,d,()=>{pick=i;for(const x of el.querySelectorAll('.pd-node'))if(x._node?.diceNumber)x.classList.toggle('dice-picked',x._node.diceNumber===i)})}
  bind(el,'ButtonSelect',()=>{if(!pick)return c.toast('Hãy chọn một số');close();roll(true,pick)});
 }
 async function roll(lucky,number){
  if(busy)return;const s=st();if(!lucky&&s.normal<=0)return c.toast(I2('HC_HET_XUC_XAC','Hết xúc xắc!!!'));busy=true;
  try{
   const d=await c.mutation('/api/dice',{op:'roll',lucky,...(lucky?{number}:{})},{render:false,close:false,message:false,bonus:false});if(!d)return;
   const r=d.result,group=D.find(root,'GroupAction');group.style.visibility='hidden';
   const face=document.createElement('img');face.className='dice-face';
   if(!skip){const box=document.createElement('canvas');box.width=300;box.height=300;box.className='dice-roll';D.find(root,'GroupRolling').appendChild(box);c.spine(box,{skeleton:data.spines.dice_rolling,animation:lucky?'RedRoll':'GreenRoll'},{loop:false,fit:.9});await wait(1500);box.remove()}
   face.src=img((lucky?'dice_red_':'dice_green_')+r.point);D.find(root,'GroupRolling').appendChild(face);
   const hero=root.querySelector('.dice-hero');const dir=Math.sign(r.move);let at=r.from;
   if(!skip&&r.move){for(let k=0;k<Math.abs(r.move);k++){at+=dir;if(at>22)at-=23;if(at<0)at+=23;place(hero,at);await wait(230)}}else place(hero,r.to);
   await wait(skip?150:400);
   const stars=r.gains.filter(g=>g.itemId==='diceStar').reduce((n,g)=>n+g.quantity,0),items=r.gains.filter(g=>g.itemId!=='diceStar');
   if(stars)c.toast(`+${stars} sao`);if(r.message)c.toast(r.message);
   render();if(items.length)c.bonusPopup(items);if(r.tarot)setTimeout(tarot,items.length?900:200);
  }finally{busy=false}
 }
 function tarot(){
  const n=structuredClone(data.prefabs.PanelDiceSelectCard);on(find(n,'ButtonClose'),false);
  for(let i=1;i<=3;i++){const card=find(n,'DiceTarotCard'+i);card.cardIndex=i;on(find(card,'CardContent'),false)}
  const el=D.render(shade(n),W,H,opts());el.classList.add('dice-layer','dice-popup','dice-tarot');c.layer().appendChild(el);let done=false;
  const back=img('tarot_1');for(const x of el.querySelectorAll('.pd-node'))if(x._node?.cardIndex){const b=document.createElement('div');b.className='dice-card-back';x.appendChild(b)}
  for(const x of el.querySelectorAll('.pd-node')){const i=x._node?.cardIndex;if(!i)continue;bind(el,x,async()=>{
   if(done)return;done=true;const d=await c.mutation('/api/dice',{op:'tarot'},{render:false,close:false,message:false,bonus:false});if(!d){done=false;return}
   const t=d.result.tarot,[name,desc,art]=cards[t.effect]||['?','',''];x.classList.add('flipped');x.querySelector('.dice-card-back')?.remove();
   const face=document.createElement('div');face.className='dice-card-face';face.innerHTML=`<img src="${img(art)}" alt=""><b>${c.escape(name)}</b><p>${c.escape(desc)}</p>`;x.appendChild(face);
   const btn=D.find(el,'ButtonClose');btn.style.display='';bind(el,btn,()=>{el.remove();render();if(d.result.rewards?.length)c.bonusPopup(d.result.rewards)})})}
  void back;
 }
 function rewards(){
  const n=structuredClone(data.prefabs.PanelDiceReward);on(find(n,'DiceCellReward'),false);
  const el=D.render(shade(n),W,H,opts());el.classList.add('dice-layer','dice-popup');c.layer().appendChild(el);
  const close=()=>el.remove();bind(el,'ButtonClose',close);bind(el,'Shade',close);
  const vp=D.find(el,'ScrollRewards/Viewport'),list=document.createElement('div');list.className='dice-rewards';const s=st();
  list.innerHTML=s.milestones.map((m,i)=>`<div class="dice-reward-row"><span class="dice-star"><img src="${img('icon_dice_star')}" alt=""><b>${m.stars}</b></span><img class="arrow" src="${img('arrow_2')}" alt=""><span class="tiles">${m.rewards.map(r=>c.rewardTile(r)).join('')}</span>${m.claimed?`<img class="tick" src="${img('tick_green_2')}" alt="Đã nhận">`:`<button class="green" data-dice-claim="${i}" ${s.stars>=m.stars?'':'disabled'}>Nhận</button>`}</div>`).join('');
  vp.appendChild(list);
  for(const b of list.querySelectorAll('[data-dice-claim]'))b.onclick=async e=>{e.stopPropagation();const d=await c.mutation('/api/dice',{op:'claim',index:Number(b.dataset.diceClaim)},{render:false,close:false});if(d){el.remove();render();rewards()}};
 }
 function close(){root?.remove();root=null;for(const x of document.querySelectorAll('.dice-popup'))x.remove()}
 window.DiceUI={init(ctx){c=ctx},open:()=>open().catch(e=>c.toast(e.message)),close,isOpen:()=>!!root};
})();
