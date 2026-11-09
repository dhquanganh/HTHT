/* Node/MongoDB game client. All progression and combat decisions are server-side. */
(()=>{
'use strict';
const V=()=>window.GameView,$=s=>document.querySelector(s),screen=$('#screen-ui'),dialog=$('#dialog-ui');
let catalog=null,player=null,csrfToken='',authMode='login',busy=false,heroTab='stats',inventoryTab='equipment',shopTab='material',dictionary=false,search='',page=0,currentScene=1;
let heroFaction=null,heroAlbumOpen=false,heroSort=0;
let heroGainLines=[],heroGainUntil=0;
let campaignChapterId=null,campaignStageId=null,campaignSlots=null,campaignSelectedSlot=null,campaignFilter=null;
let battleActiveActorId=null,battleMenuHeroId=null;
let battleReference=null,battleMenuOpen=false,skipBattleAnimations=false;
let battleEffects=[],effectPool=[],battleShakes=[];
// shake_cams của db_battle_heroes: {delay, duration} giây tính từ lúc ra chiêu; rate là tỉ lệ nén thời gian của chiêu.
function addShakes(list,rate=1,from=battleTime){if(skipBattleAnimations||!list?.length)return;for(const s of list)battleShakes.push({start:from+s.delay/rate,end:from+(s.delay+s.duration)/rate})}
function shakeOffset(){battleShakes=battleShakes.filter(s=>s.end>battleTime);const s=battleShakes.find(s=>s.start<=battleTime);if(!s)return null;const k=1-.6*(battleTime-s.start)/Math.max(.01,s.end-s.start),amp=9*k;return{x:(Math.random()*2-1)*amp,y:(Math.random()*2-1)*amp}}
let battleTime=0,lastBattleFrame=0,battleWaitUntil=null;
// Nộ: cutscene rồi nhát chém beat (khung mạnh nhất ở giây 2,6). Beat có lớp tối toàn màn nên không dùng cho đòn thường.
const zoroTiming={cutRate:4,slashRate:2,hitTime:.50,beatHit:2.6};
// db_battle_heroes đặt Cuts_576 tại tâm camera và skill_576 tại (2.5,-1.7) đơn vị, không theo mục tiêu.
// Gốc: skeleton 0.01, cách tâm đội địch (-60,+48)px. Bố cục web rộng hơn 1,37 lần nên nhân tỉ lệ đó quanh tâm đội địch (902,385).
// Cutscene dùng .75 thay cho .64 để khung 1922×892 phủ kín màn 16:9.
const zoroStage={cutX:568,cutY:320,cutScale:.75,slashX:820,slashY:451,slashScale:.877};
// Cùng phép quy đổi cho mọi tướng: đơn vị camera gốc (64px) sang bố cục web quanh tâm đội địch.
const fxBackdrop=e=>e.layer!=='BeyondCanvas'&&(e.order<0||/^(bgr(black)?|bg|backgroud|background)$/i.test(e.animation));
const fxUsable=e=>heroEffects.effects[e.key]?.atlases.every(a=>a.textures.every(Boolean));
const fxStagePoint=(x,y)=>({x:902+1.37*(568+64*x-788),y:385+1.37*(320-64*y-381)}),fxMaxSeconds=3.4,fxImpactSlots=6;
let heroEffects=null;
let actors=[],battleBackground=null,battleBusy=false,battleSpeed=1,autoBattle=false,autoTimer=null,floaters=[],battleLines=[],displayBattle=null,bootError='';
// Bảo vật đã nâng: "artifact:<id>@<sao>:<exp>" tra theo bảo vật gốc, chỉ số là dòng effect của sao đó (như server/catalog.mjs).
class ItemMap extends Map{
 get(id){const own=super.get(id);if(own||typeof id!=='string')return own;const m=/^(artifact:\d+)@(\d+):(\d+)$/.exec(id),base=m&&super.get(m[1]);if(!base?.levels||m[2]==='1'&&m[3]==='0')return undefined;
  const level=Math.max(1,Math.min(Number(m[2]),base.levels.length)),exp=Number(m[3]);if(`${base.id}@${level}:${exp}`!==id)return undefined;
  const points=base.levels[level-1]||[],plain=points.find(g=>!g.faction&&!g.clazz)?.point||[];
  const item={...base,id,variantOf:base.id,stars:level,artifactExp:exp,points,stats:Object.fromEntries(plain.filter(([k])=>k===0||k===2).map(([k,v])=>[k===0?'attack':'maxHp',v])),sellPrice:base.sellPrices?.[level-1]||base.sellPrice,noShop:true};
  super.set(id,item);return item}
 has(id){return!!this.get(id)}
}
const ownedVariants=()=>Object.keys(player?.inventory||{}).filter(k=>k.includes('@')&&player.inventory[k]>0).map(k=>itemMap.get(k)).filter(Boolean);
const itemMap=new ItemMap(),slotNames={pants:'Quần',armor:'Áo giáp',boots:'Giày',helmet:'Mũ',accessory:'Bảo vật'};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>new Intl.NumberFormat('vi-VN').format(n||0),short=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(1)+'K':String(n||0);
const assetSrc=key=>V()?.assets()[key]?.src||'';
const named=name=>V()?.findAsset(name);
const img=(key,cls='',alt='')=>key?`<img src="${escape(assetSrc(key))}" class="${cls}" alt="${escape(alt)}" draggable="false">`:'';
// Theo prefab HeroStars: 1-5 sao vàng, 6-9 sao tím, 10 sao đỏ, 11-15 là cánh star_e_bgr với số L.
// HeroStars: 1-5 vàng (hero_star_1), 6-9 tím (hero_star_2), 10-14 là 1-5 sao đỏ (hero_star_3), 15-19 là L1-L5 (star_e_bgr).
function heroStarsHtml(count,cls=''){const n=Math.max(1,count||1);const inner=n<=5?img(named('hero_star_1')).repeat(n):n<=9?img(named('hero_star_2')).repeat(n-5):n<=14?img(named('hero_star_3')).repeat(n-9):`<span class="hero-star-e" style="background-image:url('${assetSrc(named('star_e_bgr'))}')">${img(named('hero_star_e'))}<b>${n-14}</b></span>`;return `<span class="hero-stars ${cls}">${inner}</span>`}
window.heroStarsHtml=heroStarsHtml;
const itemStars=item=>item.heroShard?img(named('icon_shard'),'item-shard-mark'):item.points&&item.stars?`<span class="item-stars">${img(named('item_star')).repeat(item.stars)}</span>`:'';
// Lấp lánh Item_effect: trang bị bậc 6 đủ 6 sao, và mọi bảo vật đỏ (SpineBoder của ItemArtifactUI).
const itemSparkle=item=>item.category==='artifact'?(window.ArtifactUI?.sparkles(item)?'<span class="item-sparkle"></span>':''):item.points&&item.tier===6&&item.stars===6?'<span class="item-sparkle"></span>':'';
window.ItemDecor={stars:itemStars,sparkle:itemSparkle};
const icon=(item,quantity=null)=>item.category==='artifact'&&window.ArtifactUI&&catalog?.artifactUpgrade?`<div class="item-icon artifact-icon">${window.ArtifactUI.cell(item,{qty:quantity})}</div>`:`<div class="item-icon ${escape(item.rarity||'green')}">${img(item.assetKey,'',item.name)}${itemStars(item)}${itemSparkle(item)}${quantity!==null?`<span class="qty">${num(quantity)}</span>`:''}</div>`;
const money=(currency,amount)=>`<span class="currency">${img(named(currency==='gold'?'icon_gold':'icon_gem'))}${num(amount)}</span>`;
async function sleep(ms){const until=battleTime+ms/1000;battleWaitUntil=until;try{while(battleTime<until&&!skipBattleAnimations)await new Promise(resolve=>setTimeout(resolve,8))}finally{if(battleWaitUntil===until)battleWaitUntil=null}}
document.addEventListener('visibilitychange',()=>{lastBattleFrame=performance.now()});
function sceneNodes(data){return V().allNodes(data)}
function patchText(data,name,value){for(const n of sceneNodes(data))if(n.name===name)V().setText(n,String(value))}
function hide(data,...names){for(const n of sceneNodes(data))if(names.includes(n.name))n.active=false}
function refreshCanvas(){const data=V().getScene();if(data)syncScene(data)}
function selectCatalogHero(){if(!catalog||!player)return;const hero=catalog.heroes?.find(h=>h.id===player.hero.id);if(hero){catalog.hero=hero;catalog.skills=hero.skills}}
// WorldScene: chỉ Chiến dịch có luật trên server; các đảo khác mới có giao diện.
function prepareWorld(data){
 const nodes=sceneNodes(data),building=name=>nodes.find(n=>n.name===name),tagOf=name=>building(name).children.find(n=>n.name==='NameTag');
 hide(data,'NotifyBraveTrial','NotifyAspenDungeon','NotifyGuild','NotifyTarven','NotifyArena');
 // LuaJobFixTanTuHoang: B_TanTuHoang vào Buildings tại (564,-116); chấm đỏ khi còn lượt đánh (TTH_ACTIVITY).
 {const td=window.TthUI?.data(),buildings=sceneNodes(data).find(n=>n.name==='Buildings');if(td&&buildings&&!buildings.children.some(n=>n.name==='B_TanTuHoang')){
  const b=structuredClone(td.prefabs.B_TanTuHoang);b.transform={...b.transform,m_AnchoredPosition:{x:564,y:-116}};
  const font=V().get(sceneNodes(data).find(n=>n.name==='TextTag'&&V().get(n,'Text')?.font),'Text')?.font;
  const walk=n=>{for(const c of n.components||[]){if(c.asset)V().loadImage(c.asset);if(c.type==='Text'&&font)c.font=font}if(n!==b&&n.components?.some(c=>c.type==='Button'))n.name='B_TanTuHoang_'+n.name;(n.children||[]).forEach(walk)};walk(b);buildings.children.push(b)}
  const tth=buildings?.children.find(n=>n.name==='B_TanTuHoang'),noti=tth&&V().allNodes({roots:[tth]}).find(n=>n.name==='Noti');if(noti)noti.active=(player.tth?.attacksLeft||0)>0}
 {const dot=sceneNodes(data).find(n=>n.name==='NotifyGuild');if(dot)dot.active=!!player.guild?.id&&!player.guild.rollCall}
 {const tag=sceneNodes(data).find(n=>n.name==='B_Guild')?.children.find(n=>n.name==='NameTag');const text=tag&&V().allNodes({roots:[tag]}).find(n=>V().get(n,'Text'));if(text)V().setText(text,'Hạm đội')}
 {const dot=sceneNodes(data).find(n=>n.name==='NotifyArena');if(dot)dot.active=player.account.level>=14&&(player.arena?.tickets||0)>0}
 {const tag=sceneNodes(data).find(n=>n.name==='B_Arena')?.children.find(n=>n.name==='NameTag');if(tag)V().setText(tag.children.find(n=>n.name==='TextTag'),'Chiến trường')}
 tagOf('B_Explore').active=false;tagOf('B_Tarven').active=false;
 const beast=building('B_PlaceHolder2').children[0].children.find(n=>n.name==='NameTag');V().get(beast.children[0],'Text').text='Chiến Thần Thú';
 building('B_PlaceHolder2').children[0].name='B_PlaceHolder2';
 // LuaJobFixImageIslandMermaid: B_PlaceHolder3 là Đảo Người Cá, ảnh fix_icon_mermaidIsland 200×200, nhãn ở y=90.
 const mermaid=building('B_PlaceHolder3').children[0];mermaid.name='B_Mermaid';mermaid.components=mermaid.components.filter(x=>x.type!=='RawImage').concat({type:'Image',asset:catalog.mermaid.art.fix_icon_mermaidisland,color:[1,1,1,1]});mermaid.transform.m_SizeDelta={x:200,y:200};V().loadImage(catalog.mermaid.art.fix_icon_mermaidisland);
 const mermaidTag=mermaid.children.find(n=>n.name==='NameTag');mermaidTag.transform.m_AnchoredPosition={x:0,y:90};V().get(mermaidTag.children[0],'Text').text='MermaidIsland';
 const back=nodes.find(n=>n.name==='ButtonBack');back.transform.m_SizeDelta={x:66,y:66};back.transform.m_AnchoredPosition={x:50,y:-45};
 // ContentSizeFitter chưa có trong renderer canvas: tự co nhãn theo chữ.
 const ctx=V().ctx;for(const tag of nodes.filter(n=>n.name==='NameTag')){const label=tag.children.find(n=>n.name==='TextTag'),text=V().get(label,'Text'),[left,right]=V().get(tag,'HorizontalLayoutGroup').padding;ctx.save();ctx.font=`${text.size}px "${text.font.family}"`;const width=Math.ceil(ctx.measureText(text.text).width)+4;ctx.restore();label.transform.m_SizeDelta.x=width;tag.transform.m_SizeDelta.x=width+left+right}
}
// TowerNewScene: dùng nguyên cây đậu gốc. Tầng hiện tại ở bên phải, tầng kế bên trái, tầng sau nữa ló ở đỉnh màn.
const towerSpots=[[261,32],[-272,287],[261,608]];
let towerNodeId=900000;
const towerNode=(name,x,y,w,h,components=[],children=[])=>({id:towerNodeId++,name,active:true,components,children,transform:{m_LocalRotation:{x:0,y:0,z:0,w:1},m_LocalScale:{x:1,y:1,z:1},m_AnchorMin:{x:.5,y:.5},m_AnchorMax:{x:.5,y:.5},m_AnchoredPosition:{x,y},m_SizeDelta:{x:w,y:h},m_Pivot:{x:.5,y:.5}}});
function towerRewardTile(x,key,quantity,textStyle){return towerNode('RewardTile',x,0,62,62,[{type:'Image',asset:'0c8c5b028d3f86f4b962f8096732f7fb_2'}],[towerNode('Icon',0,3,48,48,[{type:'Image',asset:key,preserve:true}]),towerNode('Quantity',-3,-20,52,22,[{...textStyle,text:short(quantity),size:17,align:5}])])}
async function prepareTower(data){
 const nodes=sceneNodes(data),tower=player.tower,all=nodes.filter(n=>n.name.startsWith('TowerStage')),cells=[all[2],all[3],all[0]],jobs=[];all[1].active=false;
 nodes.find(n=>n.name==='TrunkMng').transform.m_AnchoredPosition.y=-270;
 hide(data,'BeanTrunkHard','GroupBottomLeft','GroupBottomRight','ButtonBuyTurn','TextCountDown','BackgroundSwitcherHard');
 for(const n of nodes)if(n.name==='ScrollWorld')n.name='TowerScroll';
 patchText(data,'TextTurn',tower.turns+'/'+tower.maxTurns);
 const top=nodes.find(n=>n.name==='BoxTop').children.find(n=>n.name==='TextLevel');V().get(top,'Text').text='Tầng '+Math.min(tower.floor,tower.maxFloor);
 cells.forEach((cell,i)=>{
  const row=tower.floors[i];if(!row){cell.active=false;return}
  cell.transform.m_AnchoredPosition={x:towerSpots[i][0],y:towerSpots[i][1]};
  const tag=cell.children.find(n=>n.name==='TagLevel'),label=V().get(tag.children[0],'Text'),holder=cell.children.find(n=>n.name==='HeroWrapper').children[0],rewards=cell.children.find(n=>n.name==='Rewards');
  label.text='Tầng '+row.floor;
  const skeleton=catalog.campaign.visuals[row.avatar]?.skeleton;
  if(skeleton){const graphic={type:'SkeletonGraphic',skeleton,animation:'idling',loop:true};jobs.push(V().loadSkeleton(graphic));holder.components.push(graphic);holder.transform.m_AnchoredPosition.y=26}
  const tiles=[[named('icon_gold'),row.gold],[itemMap.get('consumable:2').assetKey,row.stones],...row.drops.map(d=>[itemMap.get(d.itemId)?.assetKey,d.quantity])].filter(([key,quantity])=>key&&quantity).slice(0,3);
  rewards.children=tiles.map(([key,quantity],index)=>towerRewardTile((index-(tiles.length-1)/2)*70,key,quantity,label));
  for(const [key] of tiles)jobs.push(V().loadImage(key));
 });
 jobs.push(V().loadImage('0c8c5b028d3f86f4b962f8096732f7fb_2'));
 await Promise.all(jobs);
}
function towerRankingRow(row,own=false){
 const def=catalog.heroes.find(h=>h.id===row.heroId),medal=row.rank<=3?`<span class="ranking-place">${img(named('tag_rank_'+row.rank),'ranking-medal')}<span class="ranking-number">${row.rank}</span></span>`:`<span class="ranking-number">${num(row.rank)}</span>`;
 return `<li class="ranking-row ${own?'own':''}">${medal}<span class="ranking-avatar">${img(def?.visual.head,'ranking-head',def?.name||'')}${img(named('border_avatar'),'ranking-border')}<span class="ranking-level" style="background-image:url('${assetSrc(named('tag_level'))}')">${num(row.level)}</span></span><span class="ranking-name"><strong>${escape(row.name)}</strong><small>Hạm đội:</small></span><span class="ranking-floor"><small>Tầng</small><strong>${num(row.floors)}</strong></span></li>`;
}
async function openTowerRanking(){
 if(busy)return;
 try{const data=await api('/api/tower/ranking');dialog.innerHTML=`<div class="reference-shade"><section class="reference-window tower-ranking" role="dialog" aria-modal="true" aria-label="Top leo đậu thần" style="--panel-image:url('${assetSrc(named('popup_body'))}')"><h2 class="reference-title">Top leo đậu thần</h2><button class="reference-close" data-action="close" aria-label="Đóng">${img(named('popup_close'))}</button><ol class="ranking-list">${data.top.map(row=>towerRankingRow(row)).join('')||'<li class="ranking-empty">Chưa có dữ liệu xếp hạng.</li>'}</ol>${data.me?`<ol class="ranking-self">${towerRankingRow(data.me,true)}</ol>`:''}</section></div>`}
 catch(e){V().toast(e.message)}
}
// Chiến Thần Thú: BossOfWorldScene (53) và PopupTopBoss (1600) dựng từ prefab gốc. Danh sách xếp hạng cuộn nên là DOM.
let beastStatus=null,beastDetail=null,beastKey=null,beastSkip=false,beastClock=null,beastDraft=[],beastLoad=0;
const beastTime=ms=>{const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),clock=[Math.floor(s/3600)%24,Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');return d?`${d} ngày ${clock}`:clock};
const beastBuildings=['Building_01','Building_02','Building_03','Building_04','Building_05'];
const uiIcon=name=>catalog.beastUi?.[name]?.src||'';
function setSkeleton(node,avatar,jobs,animation='idling'){const graphic=V().get(node,'SkeletonGraphic'),skeleton=catalog.campaign.visuals[avatar]?.skeleton;if(!graphic||!skeleton)return;Object.assign(graphic,{skeleton,animation,loop:true,skin:graphic.skin||'default'});jobs.push(V().loadSkeleton(graphic))}
function stopBeastClock(){clearInterval(beastClock);beastClock=null}
function startBeastClock(data,status){
 stopBeastClock();const end=Date.now()+status.remaining,text=sceneNodes(data).find(n=>n.name==='TextCountDown'&&V().get(n,'Text'));
 const tick=()=>{if(currentScene!==53)return stopBeastClock();const left=end-Date.now();if(text)V().setText(text,beastTime(left));if(left<=0){stopBeastClock();navigate(53)}};tick();beastClock=setInterval(tick,1000);
}
async function prepareBeast(data){
 const load=++beastLoad,status=await api('/api/beast');if(load!==beastLoad)return;beastStatus=status;
 const nodes=sceneNodes(data),jobs=[],node=name=>nodes.find(n=>n.name===name);
 node('Content').active=true;patchText(data,'TextDesc','Kết thúc sau:');patchText(data,'TextTurn',num(status.turns));
 beastBuildings.forEach((name,i)=>{
  const boss=status.bosses[i],building=node(name),live=building.children.find(n=>n.name==='GroupLive'),spine=live.children.find(n=>n.name==='SpineObject'),label=live.children.find(n=>n.name==='BgrName').children.find(n=>n.name==='Title');
  V().setText(label,boss.name);spine.beastKey=boss.key;building.children.find(n=>n.name==='ArenaClick').beastKey=boss.key;setSkeleton(spine.children.find(n=>n.name==='Skeleton'),boss.avatar,jobs);
 });
 await Promise.all(jobs);startBeastClock(data,status);if(status.pending.length)beastPendingDialog(status.pending);
}
function beastTile(reward,cls=''){return `<span class="bs-tile ${cls}" title="${escape(reward.name)}"><img src="${escape(reward.icon||'')}" alt="${escape(reward.name)}" draggable="false"><b>${short(reward.quantity)}</b></span>`}
function beastPendingDialog(pending){
 dialog.innerHTML=`<div class="reference-shade"><section class="reference-window beast-pending" role="dialog" aria-modal="true" aria-label="Quà tổng kết" style="--panel-image:url('${assetSrc(named('popup_body'))}')"><h2 class="reference-title">Quà tổng kết</h2><div class="beast-pending-list">${pending.map(row=>`<article><header>${escape(row.boss)} · Mùa ${row.season} · Hạng ${num(row.rank)}</header><p>Tổng sát thương: ${num(row.damage)}</p><div>${row.rewards.map(r=>beastTile(r)).join('')}</div></article>`).join('')}</div><button class="beast-yellow" data-action="beast-claim">Nhận quà</button></section></div>`;
}
function beastRow(row){
 const def=catalog.heroes.find(h=>h.id===row.heroId),medal=row.rank<=3?`<img class="beast-medal" src="${escape(uiIcon('icon_no'+row.rank))}" alt="Hạng ${row.rank}" draggable="false">`:`<span class="beast-rank-number">${row.rank>100?'100+':row.rank}</span>`;
 return `<li class="beast-row" style="background-image:url('${assetSrc(named('rect1'))}')"><span class="ranking-avatar">${img(def?.visual.head,'ranking-head',def?.name||'')}${img(named('border_avatar'),'ranking-border')}<span class="ranking-level" style="background-image:url('${assetSrc(named('tag_level'))}')">${num(row.level)}</span></span><span class="beast-row-name"><strong>${escape(row.name)}</strong><em style="background-image:url('${assetSrc(named('tag_title'))}')">${num(row.damage)}</em></span>${medal}</li>`;
}
function beastUi(){
 const d=beastDetail;if(!d){screen.innerHTML='';return}
 screen.innerHTML=`<ol class="beast-list" aria-label="Xếp hạng sát thương ${escape(d.boss.name)}">${d.ranking.top.map(beastRow).join('')||'<li class="beast-empty">Chưa có ai khiêu chiến boss này.</li>'}</ol><div class="beast-current" aria-label="Quà tổng kết">${d.current.map(r=>beastTile(r,'small')).join('')}</div>`;
}
async function prepareBeastBoss(data){
 const load=++beastLoad,detail=await api('/api/beast/boss/'+beastKey);if(load!==beastLoad)return;beastDetail=detail;
 const nodes=sceneNodes(data),jobs=[],node=name=>nodes.find(n=>n.name===name),left=node('SideLeft'),bottom=node('GroupBottom');
 const leaf=(parent,name)=>parent.children.find(n=>n.name===name);
 V().setText(leaf(left,'Title'),detail.boss.name);patchText(data,'NumberPower',num(detail.turns));
 V().setText(leaf(bottom,'NumberRank'),detail.ranking.me?num(detail.ranking.me.rank):'--');V().setText(leaf(bottom,'NumberAttack'),num(detail.ranking.me?.damage||0));
 hide(data,'ImageAvt');
 const spine=nodes.find(n=>n.name==='SpineObject'&&n.children.some(c=>c.name==='Skeleton'));setSkeleton(spine.children.find(n=>n.name==='Skeleton'),detail.boss.avatar,jobs);
 for(const [name,asset] of [['IconSkillChung',null],['IconSkillHaiQuan',null],['IconSkillNghe',named('class_'+detail.boss.class)]]){const icon=node(name),skill=name==='IconSkillChung'?detail.boss.skills[0]:name==='IconSkillHaiQuan'?detail.boss.skills[1]:null,key=asset||skill?.icon;if(key){V().get(icon,'Image').asset=key;jobs.push(V().loadImage(key))}}
 syncBeastSkip(data);await Promise.all(jobs);renderUi();
}
function syncBeastSkip(data=V().getScene()){for(const n of sceneNodes(data)){if(n.name==='IconSkipBattleOn'||n.name==='HandleSkip')n.active=n.name==='HandleSkip'||beastSkip;if(n.name==='HandleSkip'){const image=V().get(n,'Image');if(image)image.color=[1,1,1,beastSkip?1:0.01]}}}
function beastRewardsDialog(){
 const d=beastDetail;dialog.innerHTML=`<div class="reference-shade"><section class="reference-window beast-rewards" role="dialog" aria-modal="true" aria-label="Quà tặng" style="--panel-image:url('${assetSrc(named('popup_body'))}')"><h2 class="reference-title">Quà tặng</h2><button class="reference-close" data-action="close" aria-label="Đóng">${img(named('popup_close'))}</button><div class="beast-reward-list">${d.rewards.map(rank=>`<article><header>Thưởng xếp hạng</header><div><strong>${escape(rank.label)}</strong><span>${rank.rewards.map(r=>beastTile(r)).join('')}</span></div></article>`).join('')}</div></section></div>`;
}
function beastSkillDialog(skill){if(skill)modal(skill.name,`<p class="item-description">${escape(skill.description)}</p>`)}
function beastTeam(){
 return (player.heroes||[player.hero]).filter(h=>{const value=catalog.heroes.find(d=>d.id===h.id)?.class;return (value==='fighter'?'warrior':value)===beastDetail.boss.class&&h.level>=beastDetail.minLevel});
}
function beastFormationDialog(){
 const eligible=beastTeam(),d=beastDetail;
 dialog.innerHTML=`<div class="reference-shade"><section class="reference-window beast-team" role="dialog" aria-modal="true" aria-label="Đội hình tấn công" style="--panel-image:url('${assetSrc(named('popup_body'))}')"><h2 class="reference-title">Đội hình tấn công</h2><button class="reference-close" data-action="close" aria-label="Đóng">${img(named('popup_close'))}</button><p class="beast-team-note">Chỉ ${escape(d.boss.classLabel)} được tham chiến. Đã chọn ${beastDraft.length}/6.</p><div class="beast-team-grid">${eligible.map(h=>{const def=catalog.heroes.find(x=>x.id===h.id),on=beastDraft.includes(h.id);return `<button class="beast-team-hero ${on?'on':''}" data-action="beast-pick" data-hero="${escape(h.id)}" aria-pressed="${on}">${img(def.visual.head,'',def.name)}<small>${escape(def.name)}</small><b>Cấp ${h.level}</b></button>`}).join('')||'<p class="beast-team-empty">Bạn chưa có tướng nghề này. Hãy chiêu mộ thêm.</p>'}</div><div class="beast-team-actions"><button class="beast-yellow" data-action="beast-attack" ${beastDraft.length?'':'disabled'}>Tấn công</button></div></section></div>`;
}
function openBeastFormation(){
 const eligible=beastTeam(),saved=(beastDetail.formation||[]).filter(id=>id&&eligible.some(h=>h.id===id));
 beastDraft=saved.length?saved:eligible.slice(0,6).map(h=>h.id);beastFormationDialog();
}
async function attackBeast(){
 const key=beastKey,slots=Array.from({length:6},(_,i)=>beastDraft[i]||null),result=await mutation('/api/beast/start',{boss:key,formation:slots,skip:beastSkip},{render:false,message:false});if(!result)return;
 if(beastSkip&&player.battle?.status!=='active'){await navigate(1600);showBattleResult();return}
 await navigate(9);
}
function beastHit(hit){
 if(hit.node.beastKey){beastKey=hit.node.beastKey;navigate(1600);return true}
 if(currentScene===53){
  if(hit.name==='ButtonBack'){navigate(37);return true}
  if(hit.name==='ButtonHelp'){modal('Chiến Thần Thú',`<p class="item-description">Có 5 thần thú, mỗi con một bảng xếp hạng sát thương riêng và chỉ nhận đúng một nghề tướng. Mỗi mùa có ${num(beastStatus?.turns)} lượt còn lại dùng chung cho cả 5 con; hết mùa, thứ hạng được đổi thành quà tổng kết.</p>`);return true}
  return false;
 }
 if(hit.name==='Button_Close'){navigate(53);return true}
 if(hit.name==='ButtonAttack'){openBeastFormation();return true}
 if(hit.name==='ButtonReward'){beastRewardsDialog();return true}
 if(hit.name==='HandleSkip'){beastSkip=!beastSkip;syncBeastSkip();return true}
 if(hit.name==='IconSkillChung'){beastSkillDialog(beastDetail?.boss.skills[0]);return true}
 if(hit.name==='IconSkillHaiQuan'){beastSkillDialog(beastDetail?.boss.skills[1]);return true}
 if(hit.name==='IconSkillNghe'){V().toast(`Chỉ ${beastDetail?.boss.classLabel} được tham chiến`);return true}
 return false;
}
// Tiệm đồ: ForgeScene (21) dựng từ scene gốc. Lưới cuộn và hai ô vật phẩm là DOM để dùng chung khung sao, lấp lánh.
const forgeTabs=[['helmet','LBL_FORGE_SCENE_ACCESSORY','TabAccessory'],['armor','LBL_FORGE_SCENE_ARMOR','TabArmor'],['pants','LBL_FORGE_SCENE_WEAPON','TabWeapon'],['boots','LBL_FORGE_SCENE_SHOES','TabShoes']],forgeLabels={helmet:'Mũ',armor:'Áo',pants:'Quần',boots:'Giày'};
const classNames={warrior:'Chiến binh',mage:'Pháp sư',ranger:'Xạ thủ',assassin:'Sát thủ',priest:'Mục sư'},clazzNames={1:'Pháp sư',2:'Chiến binh',3:'Mục sư',4:'Xạ thủ',5:'Sát thủ'};
let forgeSlot='helmet',forgeSelected={},forgeCount=0;
const pointNames={5:'Sát thương kĩ năng',9:'Sát thương chí mạng',12:'Giảm sát thương'},artifactFactionNames={1:'Hệ Sinh Khí',2:'Hệ Bền Bỉ',3:'Hệ Nhanh Nhẹn',4:'Hệ Chính xác',5:'Hệ Thông Minh',6:'Hệ Minh Mẫn'};
function pointText([id,value]){const point=catalog.equipmentPoints[id];if(!point)return String(value);return `${point.percent?Math.round(value*point.rate*100)/100+'%':value} ${pointNames[id]||point.name}`}
const pointLine=rows=>rows.map(pointText).join(', ');
function equipmentSet(id){return catalog.equipmentSets.find(set=>set.items.includes(id))}
// Nội dung theo PopupItemInfo: dòng chỉ số, rồi GroupEquipmentSet với ba hiệu ứng của bộ.
function equipmentDetail(item){
 const set=equipmentSet(item.id),worn=set?set.items.filter(id=>Object.values(player.hero.equipment).includes(id)).length:0;
 // Bảo vật: dòng có faction chỉ tính cho tướng hệ đó (1..6 = Sinh Khí, Bền Bỉ, Nhanh Nhẹn, Chính xác, Thông Minh, Minh Mẫn); kèm bảng chỉ số theo cấp.
 const groupLine=group=>`${group.faction?`${artifactFactionNames[group.faction]}: `:''}${group.clazz?`${clazzNames[group.clazz]}: `:''}${escape(pointLine(group.point))}`;
 const levels=item.levels?.length>1?`<div class="item-popup-set artifact-levels"><h3>Chỉ số theo cấp</h3>${item.levels.map((level,i)=>`<p class="${i+1===(item.stars||1)?'on':''}">Cấp ${i+1}: ${level.map(groupLine).join(' · ')}</p>`).join('')}</div>`:'';
 return `${item.points.map(group=>`<p class="item-popup-stats">${groupLine(group)}</p>`).join('')}${levels}${set?`<div class="item-popup-set"><h3>Bộ trang bị ${escape(set.name)}</h3>${set.effects.map((effect,i)=>`<p class="${worn>=i+2?'on':''}" title="Cần ${i+2} món">${escape(pointLine(effect))}</p>`).join('')}</div>`:''}`;
}
function itemDropPanel(item){return `<aside class="item-popup-drop" hidden><h3>Cách nhận:</h3>${item.forge?'<button data-action="item-drop-forge">Tiệm đồ</button>':''}<button data-action="item-drop-world">Phụ bản</button></aside>`}
const forgeList=slot=>catalog.items.filter(item=>item.slot===slot&&item.forge).sort((a,b)=>a.tier-b.tier||a.stars-b.stars);
const forgeMax=item=>Math.min(Math.floor((player.inventory[item.forge.material]||0)/item.forge.count),Math.floor(player.wallet.gold/item.forge.gold));
const forgeItemNow=()=>itemMap.get(forgeSelected[forgeSlot])||forgeList(forgeSlot).at(-1);
function forgeCell(item,selected){return `<button class="forge-cell ${selected?'on':''}" data-action="forge-pick" data-item="${escape(item.id)}" aria-pressed="${selected}" aria-label="${escape(item.name)}">${img(item.assetKey,'',item.name)}${itemStars(item)}${itemSparkle(item)}${forgeMax(item)>0?'<span class="forge-dot"></span>':''}</button>`}
function forgeUi(){
 const item=forgeItemNow(),recipe=item.forge,material=itemMap.get(recipe.material),have=player.inventory[recipe.material]||0,max=forgeMax(item);forgeCount=Math.min(forgeCount,max);
 screen.innerHTML=`<button class="forge-slot forge-output" data-action="forge-info" data-item="${escape(item.id)}" aria-label="${escape(item.name)}">${img(item.assetKey,'',item.name)}${itemStars(item)}${itemSparkle(item)}</button><button class="forge-slot forge-input" data-action="forge-info" data-item="${escape(material.id)}" aria-label="${escape(material.name)}">${img(material.assetKey,'',material.name)}${itemStars(material)}</button><div class="forge-need ${have>=recipe.count?'':'lack'}">${num(have)}/${num(recipe.count*Math.max(1,forgeCount))}</div><div class="forge-grid" aria-label="${forgeLabels[forgeSlot]}">${forgeList(forgeSlot).map(x=>forgeCell(x,x.id===item.id)).join('')}</div>${forgeTabs.map(([slot],i)=>forgeList(slot).some(x=>forgeMax(x)>0)?`<span class="forge-tab-dot" style="top:${156+i*96}px"></span>`:'').join('')}`;
 const data=V().getScene();if(!data)return;
 patchText(data,'TextGoldCost',short(recipe.gold*Math.max(1,forgeCount)));patchText(data,'TextNumberOut',String(forgeCount));patchText(data,'TextGold',short(player.wallet.gold));
}
function syncForgeTabs(data){
 const nodes=sceneNodes(data),title=nodes.find(n=>n.name==='BoxItemForge').children.find(n=>n.name==='TextTitle');V().setText(title,forgeLabels[forgeSlot]);
 for(const [slot,,name] of forgeTabs){const tab=nodes.find(n=>n.name===name),on=slot===forgeSlot;tab.children.find(n=>n.name==='ImageOn').active=on;tab.children.find(n=>n.name==='ImageOff').active=!on}
}
function prepareForge(data){
 const nodes=sceneNodes(data);patchText(data,'TextTitle','Tiệm đồ');patchText(data,'Text','Tạo');
 hide(data,'ItemForgeOutput','ItemForgeInput','CellItemForge','TextNumberInput','EffectMerge','ScrollEquipment');syncForgeTabs(data);
 for(const n of nodes)if(n.name==='ButtonForge')n.name='ForgeCreate';
 const back=nodes.find(n=>n.name==='ButtonBack');if(back)back.name='ForgeBack';
}
function forgeHit(name){
 const tab=forgeTabs.find(row=>row[2]===name);
 if(tab){forgeSlot=tab[0];forgeCount=0;syncForgeTabs(V().getScene());renderUi();return true}
 if(name==='ForgeBack'||name==='ButtonBack'){navigate(13);return true}
 if(name==='ButtonHelp'){modal('Tiệm đồ',`<p class="item-description">Ghép 3 món cùng loại và trả vàng để tạo món phẩm cao hơn. Đủ 2, 3, 4 món cùng bộ sẽ nhận thêm chỉ số bộ. Chấm đỏ là món đang đủ nguyên liệu.</p>`);return true}
 if(name==='ButtonMinus'){forgeCount=Math.max(0,forgeCount-1);renderUi();return true}
 if(name==='ButtonPlus'){forgeCount=Math.min(forgeMax(forgeItemNow()),forgeCount+1);if(!forgeCount)V().toast('Chưa đủ nguyên liệu hoặc vàng.');renderUi();return true}
 if(name==='ForgeCreate'){doForge();return true}
 return false;
}
async function doForge(){
 const item=forgeItemNow();if(!forgeCount){V().toast(forgeMax(item)>0?'Hãy chọn số lượng cần tạo.':'Chưa đủ nguyên liệu hoặc vàng.');return}
 const result=await mutation('/api/forge',{itemId:item.id,quantity:forgeCount},{render:false});if(!result)return;forgeCount=0;renderUi();
}
// Điểm danh theo PopupCheckin, Sự kiện theo EventScene (10) với Tab_Event và PanelAccumulatedEvent.
const walletArt={gold:['icon_gold','Vàng'],diamonds:['icon_gem','Kim cương'],spirit:['icon_spirit','EXP tướng']};
function eventReward(r){const wallet=walletArt[r.itemId],item=itemMap.get(r.itemId);return{name:wallet?wallet[1]:item?.name||r.itemId,key:wallet?named(wallet[0]):item?.assetKey}}
function eventTile(r,cls=''){const art=eventReward(r),item=itemMap.get(r.itemId);return `<span class="ev-tile ${cls}" title="${escape(art.name)}">${img(art.key,'',art.name)}${item?itemStars(item):''}<b>${short(r.quantity)}</b></span>`}
const clockText=ms=>{const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),t=[Math.floor(s/3600)%24,Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');return d?`${d} ngày ${t}`:t};
let checkinClock=null,eventClock=null,eventTab='week',eventSelected=null,eventLoadedAt=0;
function checkinDialog(){
 const c=player.checkin,rewards=catalog.checkinRewards,count=c.claimedDays,loadedAt=Date.now();
 dialog.innerHTML=`<div class="reference-shade checkin-shade item-popup-shade"><section class="checkin" role="dialog" aria-modal="true" aria-label="Điểm danh" style="--checkin-paper:url('${assetSrc(named('bgr_checkin'))}')"><div class="checkin-title" style="background-image:url('${assetSrc(named('title_checkin'))}')">Điểm danh</div><div class="checkin-grid">${rewards.map((r,i)=>{const done=i<count,today=i===count&&c.canClaim,next=i===count&&!c.canClaim;return `<button class="checkin-cell ${done?'done':''} ${today?'today':''}" style="background-image:url('${assetSrc(named('round_rect_content'))}')" ${today?'data-action="checkin-claim" data-submit':'disabled'} aria-label="Ngày ${i+1}">${today?img(named('xoay'),'checkin-glow'):''}${eventTile(r,'checkin-tile')}${done?img(named('tick_green'),'checkin-tick'):''}${next?'<time class="checkin-time"></time>':''}</button>`}).join('')}</div><div class="checkin-bar" style="background-image:url('${assetSrc(named('bar_checkin'))}')">${c.canClaim?'Chạm vào ô sáng để nhận quà hôm nay.':`Đã điểm danh ${num(c.total)} ngày.`}</div></section></div>`;
 clearInterval(checkinClock);const tick=()=>{const el=dialog.querySelector('.checkin-time');if(!el)return clearInterval(checkinClock);el.textContent=clockText(c.nextIn-(Date.now()-loadedAt))};tick();checkinClock=setInterval(tick,1000);
}
const tabEvents=()=>catalog.events.filter(e=>e.tab===eventTab);
const eventTabs=[['week','ButtonTab'],['month','ButtonTab (1)'],['sale','ButtonTab (2)']];
function syncEventTabs(data){const nodes=sceneNodes(data);for(const [id,name] of eventTabs){const tab=nodes.find(n=>n.name===name),on=id===eventTab;tab.children.find(n=>n.name==='ImageOn').active=on;tab.children.find(n=>n.name==='ImageOff').active=!on}}
async function refreshEvents(){try{const data=await api('/api/events');catalog.events=data.events;catalog.checkinRewards=data.checkinRewards}catch{}}
function prepareEvents(data){
 const nodes=sceneNodes(data),labels={ButtonTab:'Sự kiện tuần','ButtonTab (1)':'Sự kiện tháng','ButtonTab (2)':'Ưu đãi'};
 for(const [name,text] of Object.entries(labels))V().setText(nodes.find(n=>n.name===name).children.find(n=>n.name==='Text'),text);
 const panel=nodes.find(n=>n.name==='bgrContent');panel.transform.m_SizeDelta={x:1120,y:523};panel.transform.m_AnchoredPosition={x:0,y:-54};
 // HorizontalLayoutGroup chưa có trong renderer canvas: đặt vị trí theo ảnh gốc.
 const place=(node,x,y,w,h)=>Object.assign(node.transform,{m_AnchorMin:{x:.5,y:.5},m_AnchorMax:{x:.5,y:.5},m_Pivot:{x:.5,y:.5},m_AnchoredPosition:{x,y},m_SizeDelta:{x:w,y:h}});
 Object.keys(labels).forEach((name,i)=>place(nodes.find(n=>n.name===name),(i-1)*187,0,180,62));
 place(nodes.find(n=>n.name==='TextFieldGold'),-132,-16,214,46);place(nodes.find(n=>n.name==='TextFieldGem'),116,-16,214,46);
 patchText(data,'TextGold',short(player.wallet.gold));patchText(data,'TextGem',short(player.wallet.diamonds));
 hide(data,'TabEventGroup','PanelContent','GroupTopRight','ButtonAddGold','ButtonAddGem');syncEventTabs(data);eventLoadedAt=Date.now();
 clearInterval(eventClock);eventClock=setInterval(()=>{if(currentScene!==10)return clearInterval(eventClock);for(const el of document.querySelectorAll('[data-event-time]'))el.textContent=clockText(Number(el.dataset.eventTime)-(Date.now()-eventLoadedAt))},1000);
}
function eventIcon(e){return e.iconItem?itemMap.get(e.iconItem)?.assetKey:named(e.icon)}
function eventRow(e,on){const state=player.events[e.id],ready=e.milestones?.some((m,i)=>state.count>=m.target&&!state.claimed.includes(i));return `<button class="ev-row ${on?'on':''}" data-action="event-pick" data-event="${e.id}" aria-pressed="${on}" style="background-image:url('${assetSrc(named(on?'tab_event_on':'tab_event_off'))}')"><span class="ev-circle" style="background-image:url('${assetSrc(named(on?'circle_on':'circle_off'))}')">${img(eventIcon(e),'',e.title)}</span><span class="ev-row-text"><strong>${escape(e.title)}</strong><time data-event-time="${state.remaining}">${clockText(state.remaining)}</time></span>${ready?'<i class="forge-dot"></i>':''}</button>`}
function milestoneCard(e,m,i,state){const done=state.claimed.includes(i),ready=state.count>=m.target&&!done,value=Math.min(state.count,m.target);return `<article class="ev-card" style="--ev-frame:url('${assetSrc(named('round_rect_7'))}')"><h3>${escape(m.title)}</h3><div class="ev-progress" style="background-image:url('${assetSrc(named('progress_bgr'))}')"><i style="width:${value/m.target*100}%;background-image:url('${assetSrc(named('progress_top_2'))}')"></i><span>${num(value)}/${num(m.target)}</span></div><div class="ev-rewards">${m.rewards.map(r=>eventTile(r)).join('')}</div>${done?img(named('tag_received'),'ev-received'):ready?`<button class="ev-action" data-action="event-claim" data-event="${e.id}" data-index="${i}" data-submit>Nhận</button>`:''}</article>`}
function offerCard(e,o,i,state){const used=state.bought[i]||0,left=o.limit-used,can=left>0&&(o.cost.itemId==='gold'||o.cost.itemId==='diamonds'?player.wallet[o.cost.itemId]>=o.cost.quantity:(player.inventory[o.cost.itemId]||0)>=o.cost.quantity);return `<article class="ev-card ev-offer" style="--ev-frame:url('${assetSrc(named('round_rect_7'))}')"><div class="ev-rewards">${eventTile(o.reward)}</div><p>Hạn đổi: ${num(left)}/${num(o.limit)}</p><button class="ev-action ev-cost" data-action="event-exchange" data-event="${e.id}" data-index="${i}" ${can?'data-submit':'disabled'}>${img(eventReward(o.cost).key)}<span>${short(o.cost.quantity)}</span></button></article>`}
function eventsUi(){
 const list=tabEvents();if(!list.some(e=>e.id===eventSelected))eventSelected=list[0]?.id;const e=list.find(x=>x.id===eventSelected),state=player.events[e.id];
 const head=e.counterLabel?`<div class="ev-counter" style="background-image:url('${assetSrc(named('bgr_turn_attack'))}')">${escape(e.counterLabel)}: ${num(state.count)}</div>`:'';
 const pray=e.type==='pray'?`<div class="ev-pray"><span>Có ${num(player.inventory[e.cost.itemId]||0)} ${escape(itemMap.get(e.cost.itemId).name)}</span>${[1,10].map(n=>`<button class="ev-action" data-action="event-pray" data-event="${e.id}" data-count="${n}" ${(player.inventory[e.cost.itemId]||0)>=n?'data-submit':'disabled'}>Cầu nguyện ×${n}</button>`).join('')}</div>`:'';
 const cards=e.type==='stages'?'':e.type==='exchange'?e.offers.map((o,i)=>offerCard(e,o,i,state)).join(''):e.milestones.map((m,i)=>milestoneCard(e,m,i,state)).join('');
 const scene=V().getScene();if(scene){patchText(scene,'TextGold',short(player.wallet.gold));patchText(scene,'TextGem',short(player.wallet.diamonds))}
 const scrollTop=$('.ev-list')?.scrollTop||0,bodyTop=$('.ev-body')?.scrollTop||0;
 screen.innerHTML=`<div class="ev-list" style="--ev-frame:url('${assetSrc(named('round_rect_17'))}')">${list.map(x=>eventRow(x,x.id===e.id)).join('')}</div><section class="ev-content">${e.type==='stages'?brokenMap(e,state):`<div class="ev-banner" style="background-image:url('${assetSrc(named(e.banner))}')">${head}</div><div class="ev-body ${e.type==='exchange'?'grid':''}">${pray}${cards}</div>`}</section>`;
 $('.ev-list').scrollTop=scrollTop;if($('.ev-body'))$('.ev-body').scrollTop=bodyTop;
}
let brokenLayout=null;
// Vị trí cứ điểm và đường nối đọc từ prefab GGBrokenSpaceEventV2.
async function loadBrokenLayout(){
 if(brokenLayout)return;const scene=await fetch('scenes/1263.json').then(r=>r.json()),nodes=V().allNodes(scene),at=n=>n.transform.m_AnchoredPosition;
 brokenLayout={stages:nodes.filter(n=>n.name.startsWith('BrokenSpaceStage')).map(n=>at(n)),lines:nodes.filter(n=>/^Line\d/.test(n.name)).map(n=>({...at(n),width:n.transform.m_SizeDelta.x,angle:2*Math.atan2(n.transform.m_LocalRotation.z,n.transform.m_LocalRotation.w)*180/Math.PI}))};
 if(currentScene===10)renderUi();
}
function brokenMap(e,state){
 if(!brokenLayout){loadBrokenLayout();return ''}
 const owned=player.inventory[e.material]||0,bought=state.bought.material||0;
 return `<div class="bs-map" style="background-image:url('${assetSrc(named(e.background))}')"><div class="bs-field" style="background-image:url('${assetSrc(named('box_gold_event'))}')">${img(itemMap.get(e.material).assetKey)}<b>${num(owned)}</b><button data-action="event-buy" data-event="${e.id}" ${bought<e.buy.limit&&player.wallet.diamonds>=e.buy.cost.quantity?'data-submit':'disabled'} aria-label="Mua Ống nhòm, ${num(e.buy.cost.quantity)} kim cương, còn ${e.buy.limit-bought} lượt">${img(named('button_add'))}</button></div><small class="bs-note">Mua 1 Ống nhòm: ${num(e.buy.cost.quantity)} kim cương (còn ${e.buy.limit-bought} lượt)</small><button class="bs-help" data-action="event-help" aria-label="Hướng dẫn">${img(named('button_help'))}</button><strong class="bs-round">Vòng ${num(state.round)}</strong>${brokenLayout.lines.map((l,i)=>`<i class="bs-line ${i<state.stage?'on':''}" style="left:${350+l.x-l.width/2}px;top:${220-l.y}px;width:${l.width}px;transform:rotate(${-l.angle}deg);background-image:url('${assetSrc(named('line_bs_inactive'))}')"></i>`).join('')}${brokenLayout.stages.map((s,i)=>{const passed=i<state.stage,current=i===state.stage;return `<button class="bs-stage" style="left:${310+s.x}px;top:${190-s.y}px" data-action="event-stage-info" data-event="${e.id}" data-index="${i}" aria-label="Cứ điểm ${i+1}">${current?'<span class="bs-attack"></span>':img(named(passed?'icon_bs_won':'icon_bs_locked'))}</button>`}).join('')}<time class="bs-time" data-event-time="${state.remaining}">${clockText(state.remaining)}</time><button class="ev-action bs-attack-button" data-action="event-stage" data-event="${e.id}" ${owned>0?'data-submit':'disabled'}>Tấn công</button></div>`;
}
// Lễ Hội Ẩm Thực theo PopupSpecialEvent2: tab lục giác bên trái, thanh tiêu đề đỏ, nội dung PanelEventFeast,
// Vòng Quay May Mắn và PanelEventRollCall. Mọi số liệu lấy từ server khi mở.
let specialTab=null,wheelBusy=false;
const specialEvents=()=>catalog.events.filter(e=>e.tab==='special');
async function openSpecial(){await refreshEvents();specialDialog()}
function itemCount(id){return id==='gold'||id==='diamonds'||id==='spirit'?player.wallet[id]||0:player.inventory[id]||0}
function coinBox(id,buyEvent){return `<span class="sp-coin ${buyEvent?'buy':''}" style="background-image:url('${assetSrc(named('box_text_1'))}')">${img(eventReward({itemId:id}).key)}<b>${num(itemCount(id))}</b>${buyEvent?`<button class="sp-plus" data-action="event-buy-open" data-event="${buyEvent}" aria-label="Mua thêm">${img(named('button_add'))}</button>`:''}</span>`}
function buyCoinDialog(id){
 const e=catalog.events.find(x=>x.id===id),s=player.events[id],left=Math.max(0,e.buy.limit-(s.bought.material||0)),price=e.buy.cost,coin=eventReward({itemId:e.cost.itemId}),max=Math.max(0,Math.min(left,Math.floor(itemCount(price.itemId)/price.quantity),99));
 document.querySelector('.coin-buy')?.remove();const el=document.createElement('div');el.className='coin-buy';
 el.innerHTML=`<section class="modal item-popup" role="dialog" aria-modal="true" aria-label="Mua ${escape(coin.name)}" style="--popup-frame:url('${assetSrc(named('round_rect_8'))}');--popup-button:url('${assetSrc('1a2d3e7dc1dbacb46b77f62100c5477a_2')}')"><h2 class="item-popup-title">Mua ${escape(coin.name)}</h2><div class="item-popup-head">${eventTile({itemId:e.cost.itemId,quantity:1},'sp-big')}<div><p>Giá: ${num(price.quantity)} ${escape(eventReward(price).name)} / 1</p><small>Còn ${num(left)} lượt mua trong tháng</small></div></div><div class="coin-qty"><button data-action="coin-step" data-step="-1" aria-label="Bớt">${img(named('button_minus'))}</button><input id="coin-count" type="number" min="1" max="${max}" value="${max?1:0}" aria-label="Số lượng"><button data-action="coin-step" data-step="1" aria-label="Thêm">${img(named('button_plus'))}</button></div><p class="coin-total">${img(eventReward(price).key)}<b id="coin-total">${num(max?price.quantity:0)}</b></p><div class="modal-actions"><button data-action="coin-cancel">Hủy</button><button data-action="coin-buy" data-event="${id}" ${max?'data-submit':'disabled'}>Mua</button></div></section>`;
 el.dataset.price=price.quantity;el.dataset.max=max;$('#game-layer').appendChild(el);
}

function specialReady(e,s){return e.milestones?.some((m,i)=>s.count>=m.target&&!s.claimed.includes(i))||e.type==='rollcall'&&!s.rolledToday&&s.days<e.days.length||e.type==='wheel'&&!s.freeToday}
function feastBody(e,s){
 return `<div class="sp-banner" style="background-image:url('${assetSrc(named(e.banner))}')"><div class="sp-coins">${e.coins.map(coinBox).join('')}</div><button class="sp-help" data-action="special-help" data-event="${e.id}" aria-label="Hướng dẫn">${img(named('button_help'))}</button><strong>${escape(e.title)}</strong></div><div class="sp-list">${e.offers.map((o,i)=>{const used=s.bought[i]||0,left=o.limit?o.limit-used:Infinity,can=left>0&&itemCount(o.cost.itemId)>=o.cost.quantity;return `<article class="sp-row" style="--sp-row:url('${assetSrc(named('round_rect_7'))}')">${eventTile(o.reward,'sp-big')}${eventTile(o.cost,'sp-cost')}<div class="sp-act">${o.limit?`<small>Còn ${num(left)}/${num(o.limit)}</small>`:''}<button class="sp-yellow" data-action="event-exchange" data-event="${e.id}" data-index="${i}" ${can?'data-submit':'disabled'}>Đổi</button></div></article>`}).join('')}</div>`;
}
// 14 ô theo chiều kim đồng hồ: 5 ô trên, 2 ô phải, 5 ô dưới, 2 ô trái.
const wheelCells=[[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2],[4,3],[3,3],[2,3],[1,3],[0,3],[0,2],[0,1]];
function wheelBody(e,s){
 const next=e.milestones.find((m,i)=>!s.claimed.includes(i))||e.milestones.at(-1),cost=e.cost;
 return `<div class="sp-wheel-top">${coinBox(cost.itemId,e.buy?e.id:null)}<button class="sp-help" data-action="special-help" data-event="${e.id}" aria-label="Hướng dẫn">${img(named('button_help'))}</button></div><div class="sp-board" style="background-image:url('${assetSrc(named(e.background))}')">${e.slots.map((slot,i)=>`<span class="sp-cell" data-cell="${i}" style="left:${wheelCells[i][0]*167+12}px;top:${wheelCells[i][1]*152+10}px">${eventTile(slot.reward,'sp-big')}</span>`).join('')}<div class="sp-daily"><h4>Quà ngày</h4>${eventTile(e.daily,'sp-big')}${s.freeToday?'<p class="sp-done">Đã hết</p>':`<button class="sp-yellow small" data-action="event-free" data-event="${e.id}" data-submit>Nhận</button>`}</div>${[1,10].map((n,k)=>`<button class="sp-yellow sp-spin" style="left:${215+k*226}px" data-action="event-spin" data-event="${e.id}" data-count="${n}" ${itemCount(cost.itemId)>=cost.quantity*n?'':'disabled'}>${img(eventReward(cost).key)}Quay ${n} lần</button>`).join('')}</div><aside class="sp-milestones" style="background-image:url('${assetSrc(named('bgr_lucky'))}')"><span class="sp-next">${escape(next.title)}</span>${[...e.milestones].map((m,i)=>[m,i]).reverse().map(([m,i])=>{const done=s.claimed.includes(i),ready=s.count>=m.target&&!done;return `<div class="sp-mile">${eventTile(m.rewards[0],'sp-big')}${done?img(named('tag_received'),'sp-received'):ready?`<button class="sp-yellow small" data-action="event-claim" data-event="${e.id}" data-index="${i}" data-submit>Nhận</button>`:`<small>${num(m.target)} lần</small>`}</div>`}).join('')}<b class="sp-spun">Đã quay: ${num(s.count)}</b></aside>`;
}
function rollcallBody(e,s){
 return `<div class="sp-roll"><div class="sp-roll-decor">${img(named('decor_rollcall_3'))}${img(named('decor_rollcall_2'))}${img(named('decor_rollcall_1'))}</div><div class="sp-banner small" style="background-image:url('${assetSrc(named(e.banner))}')"><strong>${escape(e.title)}</strong></div><div class="sp-list roll" style="--sp-row:url('${assetSrc(named('round_rect_7'))}')">${e.days.map((rewards,i)=>{const done=i<s.days,today=i===s.days&&!s.rolledToday;return `<article class="sp-row ${done?'done':''}"><span class="sp-day" style="background-image:url('${assetSrc(named('tag_item_name'))}')">Ngày ${i+1}</span><div class="sp-row-items">${rewards.map(r=>eventTile(r,'sp-big')).join('')}</div><div class="sp-act">${done?img(named('tick_green'),'sp-tick'):today?`<button class="sp-yellow" data-action="event-rollcall" data-event="${e.id}" data-submit>Nhận</button>`:''}</div></article>`}).join('')}</div></div>`;
}
function specialDialog(){
 const list=specialEvents();if(!list.length)return V().toast('Hiện chưa có sự kiện.');
 const e=list.find(x=>x.id===specialTab)||list[0];specialTab=e.id;const s=player.events[e.id],loadedAt=Date.now(),scroll=dialog.querySelector('.sp-list')?.scrollTop||0;
 const body=e.type==='wheel'?wheelBody(e,s):e.type==='rollcall'?rollcallBody(e,s):feastBody(e,s);
 dialog.innerHTML=`<div class="sp-shade"><section class="sp-popup" role="dialog" aria-modal="true" aria-label="${escape(e.title)}" style="--sp-frame:url('${assetSrc(named('bgr_popup_event_special'))}')"><header class="sp-title" style="background-image:url('${assetSrc(named('title_popup_event_special'))}')"><time class="sp-time" data-remaining="${s.remaining}" style="background-image:url('${assetSrc(named('rect_25'))}')">${clockText(s.remaining)}</time><h2>${escape(e.title)}</h2><button class="sp-close" data-action="close" aria-label="Đóng">${img(named('button_close_3'))}</button></header><nav class="sp-tabs">${list.map(x=>`<button class="sp-tab" data-action="special-tab" data-event="${x.id}" aria-pressed="${x.id===e.id}" aria-label="${escape(x.title)}" style="background-image:url('${assetSrc(named(x.id===e.id?'tab_event_active':'tab_event_inactive'))}')">${img(eventIcon(x))}${specialReady(x,player.events[x.id])?'<i class="forge-dot"></i>':''}</button>`).join('')}</nav><div class="sp-body ${e.type}">${body}</div></section></div>`;
 const list2=dialog.querySelector('.sp-list');if(list2)list2.scrollTop=scroll;
 const clock=setInterval(()=>{const el=dialog.querySelector('.sp-time');if(!el)return clearInterval(clock);el.textContent=clockText(Number(el.dataset.remaining)-(Date.now()-loadedAt))},1000);
}
async function spinWheel(id,count){
 if(wheelBusy)return;wheelBusy=true;
 try{
  const data=await mutation('/api/event/spin',{id,count},{close:false,render:false,bonus:false});if(!data)return;
  const hits=data.result.hits,last=hits.at(-1),cells=[...dialog.querySelectorAll('.sp-cell')],steps=count===1?28+last:14+last;
  // Đèn chạy vòng quanh rồi dừng ở ô trúng; quay 10 lần chỉ chạy một vòng tới ô cuối.
  for(let i=0;i<=steps;i++){cells.forEach(c=>c.classList.remove('on'));cells[i%14]?.classList.add('on');await new Promise(r=>setTimeout(r,30+Math.max(0,i-steps+10)*28))}
  await new Promise(r=>setTimeout(r,350));specialDialog();bonusPopup(data.result.rewards);
 }finally{wheelBusy=false}
}
// Đá hộ mệnh: ô khóa ở trang bị (stone_lock_1) mở ở cấp 30, popup theo PopupHeroStoneInfo và PopupUpgradeHeroStone.
const stoneRow=id=>catalog.heroStones.stones.find(s=>s.id===id);
const stoneEffectOf=stone=>stone&&stoneRow(stone.id)?.effects[stone.effect[0]]?.[stone.effect[1]];
const stoneArt=row=>catalog.heroStones.art['hero_stone_'+Math.min(6,row.type)];
function stoneTile(row,cls=''){return `<span class="stone-tile ${cls}" style="background-image:url('${assetSrc(named('frame_item'))}')">${img(stoneArt(row),'stone-art',row.name)}${img(named('border_equipment_2'),'stone-border')}<span class="item-stars">${img(named('item_star')).repeat(row.star)}</span></span>`}
function stoneSlotHtml(){
 const stone=player.hero.stone;
 if(!stone)return `<button class="empty-gear stone-locked" data-action="stone-open" aria-label="Đá hộ mệnh, mở ở cấp 30">${img(catalog.heroStones.art.stone_lock_1)}</button>`;
 return `<button class="stone-slot" data-action="stone-open" aria-label="${escape(stoneRow(stone.id).name)}">${stoneTile(stoneRow(stone.id))}</button>`;
}
window.stoneSlotHtml=stoneSlotHtml;
const effectText=effect=>effect?escape(pointLine(effect.point)):'—';
function stoneShell(title,body,cls=''){document.querySelector('.stone-popup')?.remove();const el=document.createElement('div');el.className='stone-popup';el.innerHTML=`<section class="modal item-popup ${cls}" role="dialog" aria-modal="true" aria-label="${escape(title)}" style="--popup-frame:url('${assetSrc(named('round_rect_8'))}');--popup-button:url('${assetSrc('1a2d3e7dc1dbacb46b77f62100c5477a_2')}')"><button class="stone-close" data-action="stone-close" aria-label="Đóng">${img(named('popup_close'))}</button><h2 class="item-popup-title">${escape(title)}</h2>${body}</section>`;$('#game-layer').appendChild(el)}
function stoneInfo(){
 const stone=player.hero.stone;
 if(!stone){if(player.hero.level<30)return V().toast('Cần tướng cấp 30 để mở ô Đá hộ mệnh.');return stoneAction('/api/hero/stone/unlock')}
 const row=stoneRow(stone.id);
 stoneShell(row.name,`<div class="item-popup-head">${stoneTile(row,'big')}<div><p>Đá hộ mệnh</p><small>${row.star} sao</small></div></div><p class="item-popup-stats">${effectText(stoneEffectOf(stone))}</p><div class="modal-actions"><button data-action="stone-convert-open">Hoán đổi</button><button data-action="stone-upgrade-open" ${stoneRow(stone.id+1)?'':'disabled'}>Nâng cấp</button></div>`);
}
function costField(id,need){const have=id==='gold'?player.wallet.gold:player.inventory[id]||0,key=id==='gold'?named('icon_gold'):named('icon_magic_dust');return `<span class="stone-cost ${have>=need?'':'lack'}" style="background-image:url('${assetSrc(named('box_field_1'))}')">${img(key)}<b>${short(have)}/${short(need)}</b></span>`}
function stoneUpgradeOpen(){
 const stone=player.hero.stone,row=stoneRow(stone.id),next=stoneRow(stone.id+1),kept=next.effects[stone.effect[0]]?.[stone.effect[1]];
 stoneShell('Nâng cấp Đá hộ mệnh',`<div class="stone-compare" style="background-image:url('${assetSrc(named('round_rect2'))}')"><article>${stoneTile(row)}<b>${escape(row.name)}</b><p>${effectText(stoneEffectOf(stone))}</p></article>${img(named('arrow_next'),'stone-arrow')}<article>${stoneTile(next)}<b>${escape(next.name)}</b><p>${kept?`${effectText(kept)}<small>${row.retain}% giữ dòng này, còn lại đổi ngẫu nhiên</small>`:'Dòng chỉ số ngẫu nhiên'}</p></article></div><div class="stone-costs">${costField('gold',row.upgrade.gold)}${costField('consumable:3',row.upgrade.dust)}</div><div class="modal-actions"><button data-action="stone-upgrade" data-submit>Nâng cấp</button></div>`,'wide');
}
function stoneConvertOpen(){
 const stone=player.hero.stone,row=stoneRow(stone.id),count=row.effects.flat().length;
 stoneShell('Hoán đổi',`<div class="item-popup-head">${stoneTile(row,'big')}<div><p>${escape(row.name)}</p><small>${count} dòng chỉ số có thể nhận</small></div></div><p class="item-popup-stats">${effectText(stoneEffectOf(stone))}</p><p class="item-popup-note">Đổi sang một dòng chỉ số khác của bậc này.</p><div class="stone-costs">${costField('gold',row.convert.gold)}${costField('consumable:3',row.convert.dust)}</div><div class="modal-actions"><button data-action="stone-convert" data-submit ${count>1?'':'disabled'}>Hoán đổi</button></div>`);
}
async function stoneAction(url){const data=await mutation(url,{},{close:false,render:false});if(!data)return;renderUi();stoneInfo()}
// Dùng nhiều vật phẩm một lúc theo PopupUseItemConsume.
function useManyDialog(id){
 const item=itemMap.get(id),count=player.inventory[id]||0;document.querySelector('.use-popup')?.remove();
 const el=document.createElement('div');el.className='use-popup';el.dataset.max=count;el.dataset.item=id;
 el.innerHTML=`<section class="reference-window use-window" role="dialog" aria-modal="true" aria-label="${escape(item.name)}" style="--panel-image:url('${assetSrc(named('popup_body'))}')"><h2 class="reference-title">${escape(item.name)}</h2><button class="reference-close" data-action="use-close" aria-label="Đóng">${img(named('popup_close'))}</button><div class="use-item">${icon(item,count)}</div><div class="use-qty"><button class="use-step" data-action="use-step" data-step="-1" aria-label="Bớt">−</button><input id="use-count" type="number" min="1" max="${count}" value="${count}" aria-label="Số lượng"><button class="use-step" data-action="use-step" data-step="1" aria-label="Thêm">+</button></div><button class="use-go" data-action="use-many" data-item="${escape(id)}" data-submit>Dùng</button></section>`;
 $('#game-layer').appendChild(el);
}
function eventHit(name){
 const tab=eventTabs.find(row=>row[1]===name);if(tab){eventTab=tab[0];eventSelected=null;syncEventTabs(V().getScene());renderUi();return true}
 if(name==='ButtonBack'){navigate(13);return true}
 return false;
}
// Màn nhận quà theo PopupShowBonusEffect. Nằm ngoài #dialog-ui để không mất khi hộp thoại vẽ lại hoặc đổi cảnh.
function bonusPopup(rewards){
 const merged=new Map();for(const r of rewards)merged.set(r.itemId,(merged.get(r.itemId)||0)+r.quantity);
 document.querySelector('.bonus-popup')?.remove();const el=document.createElement('div');el.className='bonus-popup';
 el.innerHTML=`<section role="dialog" aria-modal="true" aria-label="Nhận quà" style="background-image:url('${assetSrc(named('bgr_show_bonus'))}')">${img(named('line_sm'),'bonus-line top')}<div class="bonus-items">${[...merged].map(([itemId,quantity],i)=>eventTile({itemId,quantity},'bonus-tile').replace('class="ev-tile',`style="animation-delay:${i*60}ms" class="ev-tile`)).join('')}</div>${img(named('line_sm'),'bonus-line bottom')}</section><button class="bonus-close" data-action="bonus-close">Đóng</button>`;
 $('#game-layer').appendChild(el);
}
async function startTower(){
 if(busy)return;
 if(player.tower.floor>player.tower.maxFloor){V().toast('Bạn đã leo hết đậu thần.');return}
 const result=await mutation('/api/tower/start',{formation:player.formation?.slots},{render:false});if(result)await navigate(9);
}
function towerHit(name){
 if(name==='ButtonBack'){navigate(37);return true}
 if(name==='ButtonFight'){startTower();return true}
 if(name==='ButtonHelp'){modal('Leo đậu thần',`<p class="item-description">Mỗi ngày có ${player.tower.maxTurns} lượt, làm mới lúc 00:00. Thắng sẽ lên tầng, nhận thưởng và được hoàn lượt; thua hoặc rút lui mất một lượt. Đội xuất chiến là đội hình đã lưu.</p>`);return true}
 if(name==='ButtonTop'){openTowerRanking();return true}
 if(name==='ButtonLog'){V().toast('Tính năng này đang được phát triển.');return true}
 return false;
}
// SummonOrbScene: bốn thẻ hệ gốc; chiêu mộ dùng Thùng bia (consumable:16).
let summonFaction='fortress';
const summonSpots=[-243,-72,99,270],summonCount=()=>player.inventory[catalog.economy.summon.item]||0;
function syncSummon(data){
 for(const n of sceneNodes(data)){
  const index=/^SumFaction/.test(n.name)?Number(n.name.match(/\((\d)\)/)?.[1]||0):-1;
  if(index>=0&&index<4){const selected=catalog.economy.summon.factions[index]===summonFaction,content=n.children[0];n.transform.m_AnchoredPosition={x:summonSpots[index],y:selected?46:10};n.transform.m_SizeDelta={x:150,y:280};content.transform.m_LocalScale={x:.8,y:.8,z:1};content.children.find(c=>c.name==='ImageSelect').active=selected}
  if(n.name==='FieldOrb')V().setText(n.children.find(c=>c.name==='Text'),num(summonCount()))
 }
}
function prepareSummon(data){
 const nodes=sceneNodes(data);
 hide(data,'PanelBlessing','ButtonInfo');
 for(const tab of ['ButtonOrb','ButtonBless']){const on=tab==='ButtonOrb',node=nodes.find(n=>n.name===tab);node.children.find(c=>c.name==='ImageOn').active=on;node.children.find(c=>c.name==='ImageOff').active=!on}
 const field=nodes.find(n=>n.name==='FieldBlessing');V().setText(field.children.find(c=>c.name==='Text'),num(player.inventory['consumable:9']||0));
 nodes.find(n=>n.name==='FieldOrb').transform.m_AnchoredPosition.x=-150;field.transform.m_AnchoredPosition.x=150;
 nodes.find(n=>n.name==='FieldOrb').transform.m_AnchorMin={x:.5,y:1};nodes.find(n=>n.name==='FieldOrb').transform.m_AnchorMax={x:.5,y:1};field.transform.m_AnchorMin={x:.5,y:1};field.transform.m_AnchorMax={x:.5,y:1};nodes.find(n=>n.name==='FieldOrb').transform.m_AnchoredPosition.y=-50;field.transform.m_AnchoredPosition.y=-50;
 syncSummon(data);
}
function summonResultHtml(heroes){return `<div class="summon-result">${heroes.map(result=>{const h=catalog.album.heroes.find(x=>x.avatar===result.avatar);return `<button class="summon-card grade-${heroGrades[h.rank]}" data-action="album-hero" data-avatar="${escape(h.avatar)}" aria-label="${escape(h.name)}">${img(h.card,'',h.name)}${img(named('hero_quality_'+h.rank),'summon-grade')}${result.fresh?'<span class="summon-new">Mới</span>':''}<strong>${result.shardItem?`${result.shards} mảnh`:escape(h.name)}</strong></button>`}).join('')}</div>`}
async function runSummon(count){
 if(busy)return;
 if(summonCount()<count){V().toast('Không đủ Thùng bia.');return}
 const data=await mutation('/api/summon',{faction:summonFaction,count},{render:false,message:false});if(!data)return;
 syncSummon(V().getScene());modal('Kết quả chiêu mộ',summonResultHtml(data.result.heroes),'summon-modal');
}
function summonHit(name){
 const select=/^SumFaction/.test(name)?Number(name.match(/\((\d)\)/)?.[1]||0):-1;
 if(select>=0){summonFaction=catalog.economy.summon.factions[select];syncSummon(V().getScene());return true}
 if(name==='ButtonOrb')return true;
 if(name==='ButtonBless'){V().toast('Tính năng này đang được phát triển.');return true}
 if(name==='ButtonSummon1'){runSummon(1);return true}
 if(name==='ButtonSummon10'){runSummon(10);return true}
 if(name==='ButtonBack'){navigate(13);return true}
 if(name==='ButtonHelp'){const rates=catalog.economy.summon.rates.map(([rank,weight])=>`${rank>=4?heroGrades[rank]:'B trở xuống'} ${weight}%`).join(', ');modal('Chiêu mộ',`<p class="item-description">Chọn hệ rồi dùng Thùng bia để chiêu mộ. Tỉ lệ: ${rates}. Chiêu mộ x10 chắc chắn có ít nhất một tướng bậc A trở lên. Tướng mới vào danh sách tướng và ra trận được ngay; tướng đã có đổi thành mảnh để nâng sao.</p>`);return true}
 return false;
}
// Nhiệm vụ chính ở sảnh (PanelHome2Quest): chữ theo db_home_quest_template, ô bên trái là phần quà đầu tiên
// (bgr_item_consumable + icon + border_item + số lượng như ItemConsumableUI), Fx_mission sáng khi đã xong.
function syncHomeQuest(data){
 const panel=sceneNodes(data).find(n=>n.name==='PanelHomeQuest'),q=player.homeQuest;if(!panel)return;
 panel.active=!!q&&!q.finished;if(!panel.active)return;
 const all=V().allNodes({roots:[panel]}),tag=all.find(n=>n.name==='TagContent'),inTag=name=>tag.children.find(n=>n.name===name);
 V().setText(inTag('TextDesc'),q.text);V().setText(inTag('TextProgress'),`Hoàn thành: ${num(q.progress)}/${num(q.target)}`);
 // TagContent là VerticalLayoutGroup (padding trái 80, căn giữa-trái) mà renderer canvas chưa dàn: đặt tay hai dòng 190x24.
 [['TextDesc',48.5],['TextProgress',24.5]].forEach(([name,y])=>{const n=inTag(name),text=V().get(n,'Text');n.transform.m_AnchoredPosition={x:80+95,y};n.transform.m_SizeDelta={x:190,y:24};Object.assign(text,{align:3,bestFit:true,minSize:12,maxSize:18})});
 // Fx_mission (khung sáng 280x120 ôm viền hộp) đứng trước ImageBox trong prefab nên bị hộp che kín; vẽ ngay sau ImageBox.
 const fx=all.find(n=>n.name==='EffectCompleted'),content=fx&&all.find(n=>n.children.includes(fx));fx.active=q.done;
 if(content&&content.children.indexOf(fx)<content.children.findIndex(n=>n.name==='ImageBox')){content.children=content.children.filter(n=>n!==fx);content.children.splice(content.children.findIndex(n=>n.name==='ImageBox')+1,0,fx)}
 const item=all.find(n=>n.name==='GameItem'),reward=q.rewards[0];
 if(!item.questNumber){const source=V().allNodes({roots:[item]}).find(n=>n.name==='TextNumber'&&V().get(n,'Text')?.size===22);item.questNumber=source.components.map(c=>({...c}))}
 if(!reward){item.children=[];return}
 const art=eventReward(reward),keys=['791558cd9af3633458a85b4422832b12_2',art.key,'938db414d92c30c46aa481c7004a52b4_2'];
 item.children=[towerNode('QuestItemBgr',0,0,82,82,[{type:'Image',asset:keys[0],color:[1,1,1,1]}]),towerNode('QuestItemIcon',0,0,80,80,[{type:'Image',asset:art.key,color:[1,1,1,1],preserve:true}]),towerNode('QuestItemBorder',0,0,90,90,[{type:'Image',asset:keys[2],color:[1,1,1,1]}]),
  towerNode('QuestItemNumber',1.4,-26.9,72,30,item.questNumber.map(c=>c.type==='Text'?{...c,text:short(reward.quantity).replace(/\.0(?=[KMB])/,'')}:c))];
 for(const key of keys)V().loadImage(key);
}
async function homeQuestTap(){
 const q=player.homeQuest;if(!q||q.finished)return;
 if(q.done){const data=await mutation('/api/home-quest/claim',{},{close:false});if(data)refreshCanvas();return}
 const target={campaign:34,tower:40,heroes:7,hero:1156}[q.go];V().toast(q.text);if(target)navigate(target);
}
function syncScene(data){syncMailDot(data);
 if(!player)return;patchText(data,'TextGold',short(player.wallet.gold));patchText(data,'TextGem',short(player.wallet.diamonds));patchText(data,'TextSpirit',short(player.wallet.spirit||0));patchText(data,'TextPlayername',player.displayName);patchText(data,'TextLv','Lv.'+player.account.level);
 if([13,36].includes(data.id)){
  const slots=sceneNodes(data).filter(n=>/^HeroHome2 \(/.test(n.name)).sort((a,b)=>a.name.localeCompare(b.name));
  const owned=new Map((player.heroes||[player.hero]).map(h=>[h.id,h])),seen=new Set();
  const team=(player.formation?.slots||[player.hero.id]).filter(id=>owned.has(id)&&!seen.has(id)&&seen.add(id)).slice(0,6);
  const spacing=team.length<=3?230:175,scale=team.length<=3?1:.85;
  slots.forEach((slot,i)=>{const h=owned.get(team[i]),def=h&&catalog.heroes.find(d=>d.id===h.id);slot.active=!!def;if(!def)return;
   slot.homeHeroId=h.id;slot.transform.m_AnchoredPosition.x=(i-(team.length-1)/2)*spacing-15;slot.transform.m_AnchoredPosition.y=-150;slot.transform.m_LocalScale={x:scale,y:scale,z:1};
   for(const n of V().allNodes({roots:[slot]})){const text=V().get(n,'Text'),skel=V().get(n,'SkeletonGraphic');
    if(n.name==='TextName'&&text){text.text=def.name;text.bestFit=true;text.minSize=13;text.overflow=0}
    if(n.name==='TextLevel'&&text)text.text='Lv.'+h.level;
    if(n.name==='ImageFaction')V().setAsset(n,named('faction_'+def.faction));
    if(n.name==='ClickArea')n.homeHeroId=h.id;
    if(skel){const changed=skel.skeleton?.skeleton.src!==def.visual.skeleton.skeleton.src;skel.skeleton=def.visual.skeleton;skel.animation='idling';skel.loop=true;
     if(changed&&skel.instance){delete skel.instance;delete skel.state;if(data===V().getScene()){const next={skeleton:skel.skeleton,animation:'idling',loop:true};V().loadSkeleton(next).then(()=>{if(skel.skeleton===next.skeleton)Object.assign(skel,next)})}}
    }
   }
  });
  hide(data,'BoxHotChat','ButtonSkins','ButtonFirstPurchase','ButtonTiktok','ButtonTest','ButtonFriend','ButtonFuse','ButtonAltar','FrameVip');
  for(const n of sceneNodes(data))if(n.name==='ImageAvatar')V().setAsset(n,catalog.hero.visual.head);
  syncHomeQuest(data);
  syncActivity(data);
 }
 if([7,39].includes(data.id)){
  hide(data,'MiscInfo','BoxHeroes','TabFaction','ButtonDictionary');
  for(const n of sceneNodes(data))if(n.name==='ButtonHelp')n.transform.m_AnchoredPosition.x=-124;
  for(const n of sceneNodes(data)){if(n.name==='Content'&&V().get(n,'GridPoolGroup')){n.children=n.children.slice(0,1);const card=n.children[0];if(card){card.hero=catalog.hero.visual;V().setTopLeft(card,6,5,190,260);for(const ch of V().allNodes({roots:[card]})){if(ch.name==='TextName')V().setText(ch,catalog.hero.name);if(ch.name==='TextLv')V().setText(ch,player.hero.level);if(ch.name==='ImageHero')V().setAsset(ch,catalog.hero.visual.card)}}}if(n.name==='TextCapacity')V().setText(n,'1/100')}
 }
 if(data.name==='PanelHeroInfo'){
  hide(data,'PanelEquipment','PanelPoint','PanelSpecialEquip','PanelBreakthrough','PanelAwaken','PanelEnable','PanelESkill','Tabs','ButtonSkin','ButtonShare','ButtonLocked','ButtonNoLock','PanelHeroList','ButtonNext','ButtonPrev','SpineRank','HeroStars');
  for(const n of sceneNodes(data)){if(n.name==='ImageHero')V().setAsset(n,catalog.hero.visual.art);if(n.name==='TextHeroName')V().setText(n,catalog.hero.name)}
  for(const n of sceneNodes(data)){
   if(n.name==='ButtonNoLock'||n.name==='ButtonShare')n.active=true;
   if(n.name==='SpineRank'){n.active=true;loopHeroBadge(n,heroGrade())}
   if(n.name==='SpineFaction')loopHeroBadge(n,{fortress:'A',abyss:'S',forest:'D',shadow:'V',dark:'I',light:'P'}[catalog.hero.faction]||'S');
   if(n.name==='TextHeroName'){n.transform.m_SizeDelta.x=catalog.hero.id==='zoro-king-of-hell'?340:290;n.transform.m_AnchoredPosition.x=0;const text=V().get(n,'Text');if(text){text.align=4;if(catalog.hero.id==='zoro-king-of-hell')text.size=30}}
  }
 }
 if(data.id===12)hide(data,'PanelBody','ButtonDictArtifact','ButtonHeroList');
 if(data.name==='PopupShop')hide(data,'Scroll View','ButtonRefresh','ButtonRefreshFree');
}
function loopHeroBadge(node,animation){
 const c=V().get(node.children[0],'SkeletonGraphic');if(!c)return;c.animation=animation;c.loop=true;
 const track=c.state?.getCurrent(0);if(track?.animation.name===animation)track.loop=true;
 else if(c.instance?.data.findAnimation(animation))c.state.setAnimation(0,animation,true);
}
async function api(url,body){
 const options={credentials:'same-origin',headers:{Accept:'application/json'}};
 if(body!==undefined){options.method='POST';options.headers['Content-Type']='application/json';options.headers['Idempotency-Key']=crypto.randomUUID();if(csrfToken)options.headers['X-CSRF-Token']=csrfToken;options.body=JSON.stringify(body)}
 let response;try{response=await fetch(url,options)}catch{throw Error('Mất kết nối máy chủ. Hãy kiểm tra kết nối và thử lại.')}
 let data;try{data=await response.json()}catch{throw Error('Máy chủ chưa sẵn sàng. Hãy thử lại sau.')}
 if(!response.ok){const error=Error(data.error?.message||'Không thể thực hiện thao tác.');error.code=data.error?.code;if(response.status===401&&player){player=null;csrfToken='';clearTimeout(autoTimer);autoBattle=false;V().showScene(1)}throw error}
 if(data.result?.arena)arenaResult=data.result.arena;if(data.result?.guildBoss)guildResult=data.result.guildBoss;if(data.player){const profile=player?.profile;player=data.player;if(!player.profile&&profile)player.profile=profile;selectCatalogHero();refreshCanvas()}if(data.csrfToken)csrfToken=data.csrfToken;return data;
}
async function mutation(url,body={},options={}){
 if(busy)return;busy=true;setBusy(true);const beforeStats={...player?.hero.stats};
 try{const data=await api(url,body);if(url==='/api/hero/upgrade'&&currentScene===1156)showHeroGains(beforeStats);if(options.close!==false)dialog.innerHTML='';const gifts=options.bonus!==false&&data.result?.rewards?.length?data.result.rewards:null;if(gifts)setTimeout(()=>bonusPopup(gifts),0);else if(options.message!==false)V().toast(data.result?.message||'Thành công.');if(options.render!==false)renderUi();return data}catch(e){V().toast(e.message);return null}finally{busy=false;setBusy(false)}
}
function showHeroGains(before){heroGainLines=[['speed','Tốc độ'],['maxHp','Máu'],['defense','Thủ'],['attack','Công']].filter(([id])=>player.hero.stats[id]>before[id]).map(([id,label])=>`${label} +${num(player.hero.stats[id]-before[id])}`);heroGainUntil=Date.now()+2000}
function setBusy(value){for(const b of document.querySelectorAll('[data-submit]'))b.disabled=value}
// Toàn màn hình: nút nổi (ẩn khi đã toàn màn hình), xoay ngang trên điện thoại nếu trình duyệt cho phép.
async function toggleFullscreen(){
 try{if(document.fullscreenElement||document.webkitFullscreenElement){await (document.exitFullscreen||document.webkitExitFullscreen).call(document);return}
  const el=document.documentElement;await (el.requestFullscreen||el.webkitRequestFullscreen).call(el,{navigationUI:'hide'});try{await screen.orientation?.lock?.('landscape')}catch{}}
 catch{V().toast('Trình duyệt không hỗ trợ toàn màn hình')}
}
{const b=document.createElement('button');b.id='fullscreen-toggle';b.type='button';b.title='Toàn màn hình (F)';b.setAttribute('aria-label','Toàn màn hình');b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';b.onclick=toggleFullscreen;document.body.appendChild(b);
 const sync=()=>document.body.classList.toggle('is-fullscreen',!!(document.fullscreenElement||document.webkitFullscreenElement));document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);
 document.addEventListener('keydown',e=>{if((e.key==='f'||e.key==='F')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName))toggleFullscreen()})}
function scaled(){const el=$('#stage');$('#game-layer').style.transform=`scale(${el.getBoundingClientRect().width/1136})`}
new ResizeObserver(scaled).observe($('#stage'));
let mailSelection='';
const audioSettings={sound:localStorage.getItem('htps_sound')!=='off',music:localStorage.getItem('htps_music')!=='off'};
// Đảo Người Cá chạy như MerMaidEvent gốc: 1 đơn vị thế giới = 64px (camera orthographic size 5).
// Người chơi (hero 190, MermaidHero scale 1.5) chạm đất để chạy tới (4.5 đơn vị/giây, không lên quá y=-1.8),
// camera bám theo trong khoảng BgrStart..BgrEnd. NPC: hero 178, Chopper (MermaidHeroMuaKeoBong), Zoro 331 đi qua lại
// như MoveRandomHero. Ba nàng tiên cá, bong bóng, mây và rong biển là spine của MerMaidBgr.
let island=null,lastPointer=null;
document.addEventListener('pointerdown',e=>{const stage=document.querySelector('#stage');if(!stage)return;const r=stage.getBoundingClientRect();lastPointer={x:(e.clientX-r.left)/r.width*1136,y:(e.clientY-r.top)/r.height*640}},true);
const islandNode=(name,x,y,w,h,components=[],children=[])=>({id:towerNodeId++,name,active:true,components,children,transform:{m_LocalRotation:{x:0,y:0,z:0,w:1},m_LocalScale:{x:1,y:1,z:1},m_AnchorMin:{x:.5,y:.5},m_AnchorMax:{x:.5,y:.5},m_AnchoredPosition:{x,y},m_SizeDelta:{x:w,y:h},m_Pivot:{x:.5,y:.5}}});
function playSpine(c,names,loop=true){const data=c.instance?.data;if(!data)return;const name=names.map(n=>data.findAnimation(n)?.name).find(Boolean)||data.animations[0]?.name;if(name&&c.current!==name){c.current=name;c.state.setAnimation(0,name,loop)}}
async function prepareIsland(data){
 const nodes=sceneNodes(data),world=nodes.find(n=>n.name==='MermaidWorld'),ui=nodes.find(n=>n.name==='MerMaidCanvas'),m=catalog.mermaid,unit=m.unit,jobs=[];
 document.querySelector('.mm-tags')?.remove();
 const decor=[];
 for(const s of m.spines.filter(s=>s.name!=='SpineSkeleton')){
  const c={type:'SkeletonGraphic',skeleton:s.skeleton,animation:'',loop:s.loop},n=islandNode('Spine_'+s.name,s.x*unit,s.y*unit,10,10,[c]);const k=s.scale*s.dataScale*unit;n.transform.m_LocalScale={x:k,y:k,z:1};
  decor.push(n);jobs.push(V().loadSkeleton(c).then(()=>playSpine(c,['animation','Loop','bubble','Bubble','Weed','idle'],s.loop)));
 }
jobs.push(V().loadImage(m.art.shadow));
 const shadow=k=>islandNode('Shadow',0,0,100*k,56*k,[{type:'Image',asset:m.art.shadow,color:[1,1,1,1]}]);
 const hero=(avatar,x,y,scale,names,npc)=>{const visual=catalog.campaign.visuals[avatar];const c={type:'SkeletonGraphic',skeleton:visual?.skeleton,animation:'idling',loop:true},n=islandNode('IslandHero'+avatar,0,0,10,10,[c]);n.shadow=shadow(scale*unit/100);jobs.push(V().loadSkeleton(c).then(()=>playSpine(c,names.idle)));return{node:n,c,x,y,k:scale*.01*unit,names,face:1,npc,timer:{start:0,pause:1+Math.random()*29,walk:7,back:7+Math.random()*29,count:0}}};
 const chopper=m.spines.find(s=>s.name==='SpineSkeleton');
 const spread=[];const pick=()=>{for(let i=0;i<50;i++){const x=-3+Math.random()*28;if(spread.every(v=>Math.abs(v-x)>=5)&&Math.abs(x-11)>2){spread.push(x);return x}}const x=-3+spread.length*9;spread.push(x);return x};
 const say=(m.says||[])[Math.floor(Math.random()*(m.says||[]).length)]||{};
 const npcs=[hero('178',pick(),-3,1.5,{idle:['idling'],run:['run']},{say:say.bot1}),
  (()=>{const c={type:'SkeletonGraphic',skeleton:chopper.skeleton,animation:'IDLE',loop:true},n=islandNode('IslandChopper',0,0,10,10,[c]);jobs.push(V().loadSkeleton(c).then(()=>playSpine(c,['IDLE','idle'])));return{node:n,c,x:pick(),y:-3,k:chopper.scale*chopper.dataScale*unit,names:{idle:['IDLE','idle'],run:['RUN','run']},face:1,npc:{say:say.bot2},timer:{start:0,pause:1+Math.random()*29,walk:7,back:7+Math.random()*29,count:0}}})(),
  hero('331',pick(),-3,1.5,{idle:['idling'],run:['run']},{say:say.bot3,notifyY:30})];
 const me=hero(catalog.mermaid.playerAvatar||'190',11,-2,1.5,{idle:['idling'],run:['run']},null);
 const actors=[...npcs,me];
 for(const a of actors){const wrap=islandNode('Actor',0,0,10,10,[],[...(a.node.shadow?[a.node.shadow]:[]),a.node]);a.spineNode=a.node;a.node=wrap}
 const holder=islandNode('IslandActors',0,0,10,10,[],actors.map(a=>a.node));
 world.children.push(...decor,holder);
 const ground=islandNode('MermaidGround',0,0,1136,640,[{type:'Button'}]);ui.children.unshift(ground);
 const hit=nodes.find(n=>n.name==='HitMove');hit.active=false;
 await Promise.all(jobs);
 const tags=document.createElement('div');tags.className='mm-tags';
 tags.innerHTML=actors.map((a,i)=>`<div class="mm-tag" data-i="${i}">${a.npc?`<p class="mm-say" style="background-image:url('${assetSrc(m.art.rectangle)}')" hidden>${escape(a.npc.say||'')}</p>${img(m.art.icon_notify,'mm-notify')}`:`<b>${escape(player.displayName)}</b>`}</div>`).join('');
 $('#game-layer').appendChild(tags);
 island={world,holder,actors,me,npcs,cam:11,min:m.minX,max:m.maxX,unit,hit,tags,target:null,talk:null};
 island.cam=Math.max(island.min,Math.min(island.max,me.x));
 updateIsland(0);
}
function islandTap(){
 if(!island||!lastPointer)return;
 const {unit,me}=island,x=island.cam+(lastPointer.x-568)/unit,y=(320-lastPointer.y)/unit;
 let target={x,y:Math.min(y,-1.8)};if(y>-1.8)target={x:me.x,y:me.y};
 island.talk=null;for(const n of island.npcs)if(x>n.x-.8&&x<n.x+.8&&y>n.y-.2&&y<n.y+2){target={x:n.x,y:n.y};island.talk=n}
 me.face=target.x>=me.x?1:-1;island.target=target;
 const h=island.hit;h.active=true;h.transform.m_AnchoredPosition={x:lastPointer.x-568,y:320-lastPointer.y};const c=V().get(h,'SkeletonGraphic');
 const show=()=>{if(c.state){const name=c.instance.data.findAnimation('hit')?.name||c.instance.data.animations[0]?.name;c.state.setAnimation(0,name,false)}};if(c.instance)show();else V().loadSkeleton(c).then(show);
}
function wander(a,dt){
 const t=a.timer;t.count+=dt;let dir=0;
 if(t.count<t.pause)dir=0;else{t.start+=dt;if(t.start<t.walk)dir=-1;else if(t.start<t.back)dir=0;else if(t.start<t.walk+t.back)dir=1;else if(t.start<t.walk+t.back+120)dir=0;else t.start=0}
 if(dir){a.x+=dir*.75*dt;a.face=dir}
 playSpine(a.c,dir?a.names.run:a.names.idle);
}
function updateIsland(dt){
 const s=island;if(!s)return;const {me,unit}=s;
 for(const n of s.npcs)if(n!==s.talk||!s.target)wander(n,dt);
 if(s.target){const dx=s.target.x-me.x,dy=s.target.y-me.y,d=Math.hypot(dx,dy),step=4.5*dt;
  if(d<=step){me.x=s.target.x;me.y=s.target.y;s.target=null;playSpine(me.c,me.names.idle);if(s.talk){const tag=s.tags.querySelector(`[data-i="${s.actors.indexOf(s.talk)}"] .mm-say`);tag.hidden=false;clearTimeout(tag.timer);tag.timer=setTimeout(()=>tag.hidden=true,4500)}}
  else{me.x+=dx/d*step;me.y+=dy/d*step;playSpine(me.c,me.names.run)}}
 s.cam+=(Math.max(s.min,Math.min(s.max,me.x))-s.cam)*Math.min(1,3*dt);
 s.world.transform.m_AnchoredPosition.x=-s.cam*unit;
 for(const a of s.actors){a.node.transform.m_AnchoredPosition={x:a.x*unit,y:a.y*unit};a.spineNode.transform.m_LocalScale={x:a.k*a.face,y:a.k,z:1}}
 s.holder.children.sort((p,q)=>q.transform.m_AnchoredPosition.y-p.transform.m_AnchoredPosition.y);
 if(s.tags.isConnected)s.actors.forEach((a,i)=>{const el=s.tags.children[i];el.style.left=(568+(a.x-s.cam)*unit)+'px';el.style.top=(320-(a.y+2.5)*unit)+'px'});
}
async function spineCanvas(canvas,desc,{loop=true,fit=.9,scale=null,onEnd=null}={}){
 // Canvas nằm trong #game-layer (bị phóng bằng transform): giữ kích thước CSS, nhân độ phân giải vẽ theo tỉ lệ phóng × DPR
 // để hoạt ảnh không vỡ hạt khi chơi toàn màn hình.
 if(!canvas.dataset.cssSize){canvas.dataset.cssSize=canvas.width+'x'+canvas.height;canvas.style.width=canvas.width+'px';canvas.style.height=canvas.height+'px'}
 const [cssW,cssH]=canvas.dataset.cssSize.split('x').map(Number),layer=$('#game-layer'),zoom=layer?layer.getBoundingClientRect().width/1136:1,density=Math.max(1,Math.min(3,zoom*(window.devicePixelRatio||1)));
 canvas.width=Math.round(cssW*density);canvas.height=Math.round(cssH*density);if(scale!==null)scale*=density;
 const c={skeleton:desc.skeleton,animation:desc.animation,loop};await V().loadSkeleton(c);if(!canvas.isConnected||!c.instance)return;
 const data=c.instance.data,name=data.findAnimation(desc.animation)?.name||data.animations[0]?.name;c.state.setAnimation(0,name,loop);c.state.apply(c.instance);c.instance.updateWorldTransform();
 const offset=new spine.Vector2(),size=new spine.Vector2();c.instance.getBounds(offset,size,[]);const k=scale??Math.min(canvas.width/Math.max(1,size.x),canvas.height/Math.max(1,size.y))*fit;if(scale!==null){offset.x=offset.y=0;size.x=size.y=0}
 const ctx=canvas.getContext('2d'),renderer=new spine.canvas.SkeletonRenderer(ctx);renderer.triangleRendering=true;let last=performance.now(),ended=false;
 if(onEnd)c.state.addListener({complete:()=>{if(!ended){ended=true;onEnd()}}});
 const frame=at=>{if(!canvas.isConnected)return;c.state.update(Math.min(.05,(at-last)/1000));last=at;c.state.apply(c.instance);c.instance.updateWorldTransform();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(canvas.width/2-(offset.x+size.x/2)*k,canvas.height/2+(offset.y+size.y/2)*k);ctx.scale(k,-k);renderer.draw(c.instance);ctx.restore();if(!ended||loop)requestAnimationFrame(frame)};
 requestAnimationFrame(frame);
}
// Nút "Hoạt động" (LuaJobAddActivity, cấp ≥ 50): chèn ButtonFunctionActivity vào PanelHomeBottom/GroupContent/GroupButton
// ở vị trí thứ 2, nới ImageBgr thành 916x150 tại (-364,66). Chạm mở/đóng BoxSelect: Ngọc Vega (khóa dưới cấp 82),
// Thú cưng, Trái Ác Quỷ (FFMain). Tên nút lấy từ db_lua_placeholder (đã nằm sẵn trong Text của prefab).
let activityPrefab=null,activityLoading=false,activityOpen=false;const activityPending=new Set();
function cloneActivity(n){return{...n,id:towerNodeId++,components:n.components.map(c=>({...c})),transform:JSON.parse(JSON.stringify(n.transform)),children:n.children.map(cloneActivity)}}
function syncActivity(data){
 const nodes=sceneNodes(data),content=nodes.find(n=>n.name==='GroupContent'&&n.children.some(c=>c.name==='GroupButton')),group=content?.children.find(c=>c.name==='GroupButton');if(!group)return;
 const on=player.account.level>=50;group.children=group.children.filter(c=>!c.activity);if(!on)return;
 // Prefab nằm trong devil-fruit.json (tải bất đồng bộ). Màn chính có thể đang nạp ảnh (chưa là getScene()) khi tải xong,
 // nên chèn thẳng vào đúng dữ liệu màn đã gọi, không dựa vào refreshCanvas().
 if(!activityPrefab){activityPending.add(data);if(!activityLoading){activityLoading=true;window.DevilFruitUI.load().then(d=>{activityPrefab=d.prefabs.ButtonFunctionActivity;for(const s of activityPending)if(player)syncActivity(s);activityPending.clear()}).catch(e=>{console.error('activity',e);activityLoading=false})}return}
 const bgr=content.children.find(c=>c.name==='ImageBgr');if(bgr){bgr.transform.m_SizeDelta={x:916,y:150};bgr.transform.m_AnchoredPosition={x:-364,y:66}}
 const button=cloneActivity(activityPrefab);button.activity=true;
 V().allNodes({roots:[button]}).forEach(n=>{for(const c of n.components){if(c.asset)V().loadImage(c.asset);if(c.type==='Text'&&c.font)window.PrefabDOM.loadFont(c.font)}
  if(n.name==='BoxSelect')n.active=activityOpen;
  if(n.name==='ClickArea'){n.components.push({type:'Button'});n.activityAction='close'}
  if(n.name==='ButtonAct')n.activityAction='toggle'});
 const box=V().allNodes({roots:[button]}).find(n=>n.name==='ImageBox');
 for(const holder of box.children){const lua=holder.children.find(c=>c.name==='ButtonLua');if(lua)lua.activityAction=holder.name.replace('ButtonFunction','')}
 const locked=player.account.level<82;box.children.find(c=>c.name==='ButtonFunctionGemLock').active=locked;box.children.find(c=>c.name==='ButtonFunctionGem').active=!locked;
 // ImageBox: HorizontalLayoutGroup giãn đều (childForceExpandWidth, spacing -10, đệm dưới 25) mà renderer canvas không chia
 // phần dư: đặt sẵn tâm từng ô như Unity (415 rộng, 3 nút 100 → tâm 72,5 / 207,5 / 342,5).
 const shown=box.children.filter(c=>c.active),slot=(415-(shown.length*100-10*(shown.length-1)))/shown.length;box.components=box.components.filter(c=>!/LayoutGroup$/.test(c.type));
 shown.forEach((c,i)=>Object.assign(c.transform,{m_AnchorMin:{x:0,y:1},m_AnchorMax:{x:0,y:1},m_Pivot:{x:.5,y:.5},m_AnchoredPosition:{x:i*(100-10+slot)+(100+slot)/2,y:-57.5}}));
 group.children.splice(1,0,button);
}
function activityHit(hit){
 const action=hit.node.activityAction;if(!action)return false;
 if(action==='toggle'||action==='close'){activityOpen=action==='toggle'?!activityOpen:false;refreshCanvas();return true}
 activityOpen=false;refreshCanvas();
 if(action==='GemLock')V().toast('Yêu cầu cấp độ 82');
 else if(action==='FF')window.DevilFruitUI.open(fruitContext());
 else if(action==='SR')window.PetUI.open(petContext());
 else V().toast('Tính năng này đang được phát triển.');
 return true;
}
// Thú cưng (dist/pet-ui.js): SRMain -> PetHome -> khu vực; ô Pet ở thông tin tướng (LuaJobAddEquipPet).
function petContext(){return{player:()=>player,items:itemMap,assetSrc,named,assets:()=>V().assets(),num,short,mutation,toast:m=>V().toast(m),modal:(t,b)=>modal(t,b),spine:spineCanvas,
 heroId:()=>player.hero.id,heroHead:id=>catalog.heroes.find(h=>h.id===id)?.visual.head,get catalog(){return catalog},img,
 // Vành Đai Tĩnh Lặng: vào trận như Chiến Thần Thú, xong trận quay lại màn hộ vệ / boss của độ khó đó.
 srBattle:async body=>{const r=await mutation('/api/sr/start',body,{render:false,message:false});if(!r){window.PetUI.openSilent(petContext(),{diff:body.diff,tab:body.target});return}srReturn={diff:body.diff,tab:body.target};await navigate(9)}}}
let srReturn=null;
async function srBack(){dialog.innerHTML='';const back=srReturn||{diff:player.battle?.silent?.diff,tab:player.battle?.silent?.target};await navigate(13);window.PetUI.openSilent(petContext(),back)}
function fruitContext(){return{player:()=>player,get catalog(){return catalog},items:itemMap,assetSrc,assets:()=>V().assets(),named,img,short,num,mutation,toast:m=>V().toast(m),spine:spineCanvas,
 rewardArt:id=>assetSrc(rewardArt(id==='gold'||id==='diamonds'?{kind:id}:{itemId:id}).key),
 help:()=>modal('TRÁI ÁC QUỶ','<p class="item-description">Thu thập Trái Ác Quỷ từ Vòng quay Xu Ác Quỷ. Cường hóa (tối đa +20) tăng 5% chỉ số cơ bản mỗi cấp; nâng sao (tối đa 12 sao) tăng chỉ số đặc biệt. Đủ 4 trái của một bộ đạt 2/4/6 sao thì chỉ số cơ bản cả bộ tăng thêm. Tướng cấp 100 trở lên đặt vào ô Cộng hưởng sẽ nhận toàn bộ chỉ số các trái đã sở hữu.</p>')}}
function mermaidContext(){return{get player(){return player},catalog,img,assetSrc,named,escape,short,num,eventTile,mutation,navigate,toast:m=>V().toast(m),render:renderUi,spine:spineCanvas}}
function mermaidHit(name){
 if(name==='ButtonNui'){window.MermaidUI.openAbyss(mermaidContext());return true}
 if(name==='ButtonSach'){window.MermaidUI.openAlbum(mermaidContext());return true}
 if(name==='MermaidBtnBack'){navigate(37);return true}
 if(name==='MermaidGround'){islandTap();return true}
 return ['HitMove','GroupAvatar'].includes(name)?false:false;
}
function referenceContext(){return{player,catalog,itemMap,assetSrc,named,img,num,short,escape,slotNames,grade:heroGrade(),inventoryTab,dictionary,search,audio:audioSettings,day:new Date(Date.now()+7*3600000).toISOString().slice(0,10),mailSelection,deletedMail:JSON.parse(localStorage.getItem('htps_mail_'+(player?.profile?.username||player?.displayName))||'[]')}}
let seState=null;
function seDialog(){if(!seState)return;dialog.innerHTML=window.ReferenceUI.specialPopup(referenceContext(),seState)}
function sePick(slot){const s=player.hero.special?.[slot];if(!s){V().toast('Máy chủ chưa cập nhật, hãy khởi động lại server.');return false}if(s.locked){V().toast(s.lock+".");return false}return true}
// Nhiệm vụ hằng ngày: đếm ngược tới 00:00 giờ Việt Nam, tự tải lại khi sang ngày.
let dqTimer=null;
function questDialog(){
 dialog.innerHTML=window.ReferenceUI.dailyQuest(referenceContext());clearInterval(dqTimer);
 const el=dialog.querySelector('.dq-countdown');if(!el)return;const end=Date.now()+Number(el.dataset.reset)*1000;
 dqTimer=setInterval(()=>{const node=dialog.querySelector('.dq-countdown');if(!node){clearInterval(dqTimer);return}const left=Math.max(0,Math.ceil((end-Date.now())/1000));node.textContent=[Math.floor(left/3600),Math.floor(left%3600/60),left%60].map(n=>String(n).padStart(2,'0')).join(':');if(!left){clearInterval(dqTimer);refreshPlayer().then(questDialog)}},1000);
}
async function refreshPlayer(){try{const data=await api('/api/state');if(data?.player)player=data.player}catch{}}
function profileDialog(){dialog.innerHTML=window.ReferenceUI.profile(referenceContext())}
function eventsNeedAttention(){return !!catalog?.events.some(e=>e.milestones?.some((m,i)=>{const s=player?.events?.[e.id];return s&&s.count>=m.target&&!s.claimed.includes(i)}))}
function syncMailDot(data){if(!data)return;const feast=sceneNodes(data).find(n=>n.name==='ButtonLuckySpin');if(feast&&!feast.feast){feast.feast=true;V().setText(feast.children.find(c=>c.name==='TextButton'),'Lễ Hội Ẩm Thực');const image=V().get(feast,'Image'),key=itemMap.get('consumable:57')?.assetKey;if(image&&key){image.asset=key;V().loadImage(key)}}const questButton=sceneNodes(data).find(n=>n.name==='ButtonQuest'),questDot=questButton?.children?.find(c=>c.name==='NotifySummon');if(questDot)questDot.active=!!player?.dailyQuest?.ready;for(const n of sceneNodes(data)){if(n.name==='NotifyMail')n.active=!!player?.mail?.some(m=>!m.claimedAt);if(n.name==='NotifyEvent')n.active=eventsNeedAttention();if(n.name==='GoNotify')n.active=!!player?.checkin?.canClaim}}
function mailDialog(fetch=true){dialog.innerHTML=window.ReferenceUI.mail(referenceContext());syncMailDot(V().getScene());if(fetch)syncMail().then(changed=>{if(changed&&dialog.querySelector('.reference-mail'))mailDialog(false)})}
// Thư do Ban quản trị gửi được ghi thẳng vào DB: lấy lại hòm thư khi mở và định kỳ 20 giây (chỉ thay player.mail,
// không đụng phần còn lại của trạng thái), để thư mới và chấm đỏ hiện ngay không cần F5.
const mailKey=list=>(list||[]).map(m=>m.id+(m.claimedAt?'1':'0')).join();
async function syncMail(){if(!player||busy)return false;try{const response=await fetch('/api/state',{credentials:'same-origin'});if(!response.ok)return false;const data=await response.json();if(!player||busy||!data.player)return false;const changed=mailKey(data.player.mail)!==mailKey(player.mail);if(changed){player.mail=data.player.mail;syncMailDot(V().getScene())}return changed}catch{return false}}
setInterval(()=>{if(document.visibilityState==='visible'&&player)syncMail().then(changed=>{if(changed&&dialog.querySelector('.reference-mail'))mailDialog(false)})},20000);
function header(){return '<div class="account-menu"><button class="account-icon" data-action="profile" aria-label="Thông tin tài khoản">'+img(catalog.hero.visual.head)+'</button><button class="account-icon" data-action="mail" aria-label="Hòm thư">'+img(named('button_mail'))+'</button></div>'}
async function equipBatch(remove=false){
 if(busy)return;busy=true;setBusy(true);let count=0;
 try{for(const slot of catalog.equipmentSlots){const current=player.hero.equipment[slot];if(remove){if(current){await api('/api/hero/unequip',{slot});count++}continue}const score=item=>(item.tier||0)*1e6+(item.stars||0)*1e4+Object.entries(item.stats||{}).reduce((sum,[k,v])=>sum+v*({attack:2.4,hp:.13,maxHp:.13,defense:2,speed:.5}[k]||1),0);const best=[...catalog.items,...ownedVariants(),...(itemMap.get(current)&&!catalog.items.some(i=>i.id===current)?[itemMap.get(current)]:[])].filter(i=>i.slot===slot&&(player.inventory[i.id]>0||i.id===current)).sort((a,b)=>score(b)-score(a))[0];if(best&&best.id!==current){await api('/api/hero/equip',{itemId:best.id});count++}}V().toast(count?(remove?'Đã gỡ trang bị.':'Đã trang bị vật phẩm phù hợp nhất.'):'Không có trang bị cần thay đổi.');heroUi()}catch(e){V().toast(e.message);heroUi()}finally{busy=false;setBusy(false)}
}
function authUi(){
 const register=authMode==='register';screen.innerHTML=`<form class="auth panel" id="auth-form" autocomplete="on"><h2 class="title">${register?'TẠO THUYỀN TRƯỞNG':'CHÀO MỪNG TRỞ LẠI'}</h2><div class="tabs"><button type="button" data-action="auth-login" class="${!register?'active':''}">Đã có tài khoản</button><button type="button" data-action="auth-register" class="${register?'active':''}">Đăng ký</button></div><label for="username">Tên đăng nhập</label><input id="username" name="username" autocomplete="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" placeholder="Tên thuyền trưởng" required><label for="password">Mật khẩu</label><input id="password" name="password" type="password" autocomplete="${register?'new-password':'current-password'}" minlength="8" maxlength="128" placeholder="Tối thiểu 8 ký tự" required>${register?'<label for="password-confirm">Nhập lại mật khẩu</label><input id="password-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required>':''}<p class="error" id="auth-error" role="alert">${escape(bootError)}</p><button class="auth-submit green" type="submit" data-submit>${register?'Đăng ký & ra khơi':'Đăng nhập'}</button></form>`;
}
function homeUi(){screen.innerHTML=header()}
async function openHomeHero(heroId){
 if(busy)return;
 if(heroId!==player.hero.id){const result=await mutation('/api/hero/select',{heroId},{render:false});if(!result)return}
 heroTab='stats';await navigate(1156);
}
function skillIcon(index){return catalog.skills[index]?.assetKey||catalog.hero.visual.head}
function skillDescription(skill){return player.hero.skillDetails?.[skill.id]?.description||skill.description}
function heroGrade(){return catalog?.hero.grade||['A','S','SS','SSR','SSR','SSR'][Math.min(5,player?.hero.rank||0)]}
const heroFactions=[['fortress','Nhanh nhẹn'],['abyss','Bền bỉ'],['forest','Chính xác'],['shadow','Sinh khí'],['dark','Thông minh'],['light','Minh mẫn']];
const heroClasses={warrior:'Đấu Sĩ',mage:'Chỉ Huy',priest:'Hỗ Trợ',ranger:'Xạ Thủ',assassin:'Kiếm Sĩ'},heroGrades={1:'D',2:'C',3:'B',4:'A',5:'S',6:'SS'},heroSorts=[['level','Cấp'],['stars','Sao'],['power','Lực chiến']];
const heroCapacity=30,heroAlbumLevel=250;
const heroClassIcon=id=>catalog.album.classIcons[id]||named('class_'+id)||named('class_warrior');
function heroCardHtml({action,attributes,level,name,cardImage,faction,classId,rank,grade,stars,locked=false}){
 return `<button class="hero-reference-card grade-${grade} ${locked?'locked':''}" data-action="${action}" ${attributes} aria-label="${action==='hero'?'Xem thông tin':'Xem hồ sơ'} ${escape(name)}${locked?', chưa sở hữu':''}"><div class="hero-card-title" style="background-image:url('${assetSrc(named('title_'+rank))}')"><span>${level}</span><strong>${escape(name)}</strong></div>${cardImage}<div class="hero-card-badges">${img(named('faction_'+faction))}${img(heroClassIcon(classId))}</div><div class="hero-card-footer">${img(named('hero_quality_'+rank),'hero-card-grade')}<span class="hero-card-stars">${heroStarsHtml(stars)}</span></div></button>`;
}
function ownedHeroCards(){
 const sort=heroSorts[heroSort][0],value=h=>sort==='power'?h.stats.power:h[sort];
 return (player.heroes||[player.hero]).map(h=>({h,hero:catalog.heroes.find(d=>d.id===h.id)})).filter(({hero})=>hero&&(!heroFaction||heroFaction===hero.faction)).sort((a,b)=>value(b.h)-value(a.h)).map(({h,hero})=>heroCardHtml({action:'hero',attributes:`data-hero="${hero.id}"`,level:h.level,name:hero.name,cardImage:img(hero.visual.card,'hero-card-portrait',hero.name),faction:hero.faction,classId:hero.class,rank:hero.rank||(hero.grade==='SS'?6:Math.min(7,4+h.rank)),grade:hero.grade||['A','S','SS','SSR'][Math.min(3,h.rank)],stars:h.stars})).join('');
}
const ownedAvatars=()=>new Set([...(player.heroes||[player.hero]).map(h=>catalog.heroes.find(d=>d.id===h.id)?.avatar)]);
function albumHeroes(){return catalog.album.heroes.filter(h=>!heroFaction||heroFaction===h.faction)}
function albumHeroCards(){const owned=ownedAvatars();return albumHeroes().map(h=>heroCardHtml({action:'album-hero',attributes:`data-avatar="${escape(h.avatar)}"`,level:heroAlbumLevel,name:h.name,cardImage:`<img src="${escape(assetSrc(h.card))}" class="hero-card-portrait" alt="${escape(h.name)}" loading="lazy" decoding="async" draggable="false">`,faction:h.faction,classId:h.class,rank:h.rank,grade:heroGrades[h.rank],stars:1,locked:!owned.has(h.avatar)})).join('')}
function rosterUi(){
 const owned=(player.heroes||[player.hero]).length,cards=heroAlbumOpen?albumHeroCards():ownedHeroCards();
 const tools=heroAlbumOpen?'':`<div class="hero-roster-tools"><button class="ref-button" style="--button-image:url('${assetSrc(named('button_yellow'))}')" data-action="hero-sort" aria-label="Sắp xếp theo ${heroSorts[heroSort][1]}">Sắp xếp</button><span class="hero-capacity" aria-label="Đang sở hữu ${owned} trên ${heroCapacity} tướng">${owned}/${heroCapacity}</span></div><button class="hero-album-open" data-action="hero-album" aria-label="Xem tất cả tướng">${img(named('button_dictionary'))}</button>`;
 screen.innerHTML=`<nav class="hero-factions" aria-label="Hệ tướng">${heroFactions.map(([id,label])=>`<button class="hero-faction ${heroFaction===id?'selected':''}" aria-pressed="${heroFaction===id}" data-action="hero-faction" data-faction="${id}" style="--tab-on:url('${assetSrc(named('tab_hero'))}');--tab-off:url('${assetSrc(named('tab_hero_ia'))}')">${img(named('faction_'+id))}<span>${label}</span></button>`).join('')}</nav>${tools}<section class="hero-roster-grid" aria-label="${heroAlbumOpen?'Tất cả tướng':'Tướng đã sở hữu'}">${cards||`<p class="hero-roster-empty">${'Chưa có tướng thuộc hệ này.'}</p>`}</section>`;
}
let heroProfiles=null;
function heroProfileHtml(h,details,skillIndex){
 const skill=details.skills[skillIndex],owned=ownedAvatars().has(h.avatar),faction=heroFactions.find(([id])=>id===h.faction)?.[1]||'',stats=[['attack','Công'],['defense','Thủ'],['maxHp','Máu'],['speed','Tốc độ']];
 return `<div class="reference-shade"><section class="reference-window hero-profile" role="dialog" aria-modal="true" aria-label="Hồ sơ ${escape(h.name)}" style="--panel-image:url('${assetSrc(named('popup_body'))}')"><h2 class="reference-title">${escape(h.name)}</h2><button class="reference-close" data-action="close" aria-label="Đóng">${img(named('popup_close'))}</button><div class="hero-profile-side"><div class="hero-profile-art">${img(details.art,'',h.name)}</div><div class="hero-profile-tags">${img(named('hero_quality_'+h.rank),'hero-profile-grade',heroGrades[h.rank])}${img(named('faction_'+h.faction),'',faction)}${img(heroClassIcon(h.class),'',heroClasses[h.class])}<span><b>${faction} · ${heroClasses[h.class]||''}</b><small>${owned?'Đã sở hữu':'Chưa sở hữu'}</small></span></div></div><div class="hero-profile-main"><h3>Thông tin khi cấp tối đa · ${details.star} sao</h3><div class="hero-profile-stats">${stats.map(([id,label])=>`<div class="stat">${label}<strong>${num(details.stats[id])}</strong></div>`).join('')}</div><div class="hero-profile-skills">${details.skills.map((item,i)=>`<button class="${i===skillIndex?'selected':''}" data-action="profile-skill" data-avatar="${escape(h.avatar)}" data-index="${i}" aria-pressed="${i===skillIndex}" aria-label="${escape(item.name)}">${img(item.icon)}</button>`).join('')}</div><div class="hero-profile-skill"><strong>${escape(skill.name)}</strong><span>${skill.passive?'Nội tại':'Tuyệt kỹ'} · Cấp ${skill.level}</span><p>${escape(skill.description)}</p></div></div></section></div>`;
}
async function openHeroProfile(avatar,skillIndex=0){
 const h=catalog.album.heroes.find(x=>x.avatar===avatar);if(!h)return;
 if(!heroProfiles){try{heroProfiles=await fetch('hero-profiles.json').then(r=>{if(!r.ok)throw Error();return r.json()})}catch{V().toast('Không tải được hồ sơ tướng. Hãy thử lại.');return}}
 dialog.innerHTML=heroProfileHtml(h,heroProfiles[avatar],skillIndex);
}
function heroTabSprite(id){const pairs={stats:['8fd4da85aa0d7ce4884558df97df20ed_2','07963b4f9c382dd4cb228edb52f7e652_2'],equipment:['5ef10e3c6e40d444e86c7298e5f34224_2','1bbfb4c5edb956d40b9ae09f441531b8_2'],star:['535c72d764e98ed4387a59965335f3ca_2','19ddc6acc5da62544b2905162f3557b7_2'],special:['68415ab4b8abb2f4e8f946c1a9e80507_2','cc4c4f40b251e98498a316279868838d_2'],haki:['dc04a8264ac54be40a7fa15226b010b8_2','5ecb2bb61075da146b1358eafa00fbd4_2']};return(pairs[id]||pairs.star)[heroTab===id?0:1]}
// Kỹ năng Germa đã kích hoạt cho ô kỹ năng i (0 là Nộ = Skill4, 1-3 là bị động 1-3), như ReLoadIconSkill.
const germaSkillAt=i=>player.hero.germa?.skills?.find(s=>s.slot===(i===0?4:i))||null;
function heroUi(){
 const h=player.hero,c=player.costs;
 const arrow=assetSrc(named('button_up'));
 const nav=[['stats','Thuộc tính','tab_point'],['equipment','Trang bị','tab_equipment'],['star','Thức tỉnh','tab_star_up'],['special','Trang bị đặc thù','tab_accessory'],['rank','Đột phá','tab_star_up'],['haki','Haki','tab_e_skill']];
 let body='';
 if(heroTab==='stats'){
  const statIcon={attack:'53a9cd1d6da40d84292448f5f702eaa2_2',maxHp:'5d1b2d8b2defe2d449c104dc59a3cfb6_2',defense:'3646fedfb8e31d345bba676463dfcfb3_2',speed:'9578baa2d8262204fa5b81a0c6d1528d_2'};
  body='<div class="hero-ref-power">'+img(named('faction_abyss'))+'<strong>'+num(h.stats.power)+'</strong></div><div class="hero-ref-level">LV: <strong>'+h.level+'/'+c.level.maxLevel+'</strong></div>'+
   '<div class="hero-ref-tier"><strong>Phẩm</strong><div class="hero-tier-slots" title="Bậc '+h.rank+'/'+catalog.economy.maxRank+'">'+Array.from({length:4},(_,i)=>img(named(i<h.rank?'gem_tier':'slot_tier'))).join('')+'</div></div>'+
   (h.level>=c.level.maxLevel?'<div class="hero-ref-max" style="background-image:url(&quot;'+assetSrc('9b56195f12b03c44db993d62800c7dd7_2')+'&quot;)">Tối Đa</div>':'<div class="hero-ref-upgrade"><div class="hero-ref-cost">'+money('gold',c.level.gold)+'<span class="currency">'+img(named('icon_spirit'))+num(c.level.heroExp)+'</span></div><button class="hero-up-arrow" style="background-image:url(\''+arrow+'\')" data-action="upgrade" data-type="level" data-submit aria-label="Nâng cấp" title="Nâng 1 cấp"></button><div class="hero-up-ten"><span>x10</span><button class="hero-up-arrow" style="background-image:url(\''+arrow+'\')" data-action="upgrade-many" data-submit aria-label="Nâng 10 cấp" title="Nâng tối đa 10 cấp"></button></div></div>')+
   '<section class="hero-ref-attributes"><div class="hero-ref-class">'+img(heroClassIcon(catalog.hero.class))+'<strong>'+(heroClasses[catalog.hero.class]||'Đấu Sĩ')+'</strong></div><button class="hero-attribute-info" data-action="hero-info" aria-label="Chi tiết thuộc tính">'+img('2561bd35acc8ab04dbdae3eaca88b74a_2')+'</button><div class="hero-ref-stat-grid">'+[['attack','Tấn công'],['maxHp','Máu'],['defense','Phòng thủ'],['speed','Tốc độ']].map(([id,label])=>'<div class="hero-ref-stat" title="'+label+'">'+img(statIcon[id])+'<strong>'+num(h.stats[id])+'</strong></div>').join('')+'</div></section>'+
   '<div class="hero-ref-skills">'+catalog.skills.map((skill,i)=>'<button class="hero-round-skill" data-action="hero-skill" data-skill="'+skill.id+'" aria-label="'+escape(skill.name)+'" title="'+escape(skill.name)+'">'+img(skillIcon(i))+'<span class="hero-skill-level">'+(germaSkillAt(i)?4:h.skills[skill.id])+'</span></button>').join('')+'</div>';
 }else if(heroTab==='equipment'){
  body=window.ReferenceUI.equipment(referenceContext());
 }else if(heroTab==='star'){
  body=window.ReferenceUI.awakening(referenceContext());
 }else if(heroTab==='special'){
  body=window.ReferenceUI.special(referenceContext());
 }else if(heroTab==='rank'&&h.germa){
  body='';
 }else if(heroTab==='rank'){
  const star=heroTab==='star',cost=star?c.star:c.rank,count=star?h.stars:h.rank,max=star?catalog.economy.maxStars:catalog.economy.maxRank,material=star?Object.keys(c.star.items)[0]:'material:rank-stone',qty=Object.values(cost.items)[0];
  body='<section class="hero-ref-secondary hero-ref-progression"><h2>'+(star?'Nâng sao':'Đột phá')+'</h2><div class="hero-progression-emblem">'+(star?heroStarsHtml(h.stars):img(named('hero_quality_'+Math.min(7,4+h.rank))))+'</div><h3>'+(star?'Sao':'Bậc')+' '+count+' / '+max+'</h3><p>Cần tướng cấp '+cost.minLevel+'</p><div class="stat">Vàng <strong>'+num(cost.gold)+'</strong></div>'+(star?Object.entries(cost.items).map(([id,need])=>'<div class="stat">'+escape(itemMap.get(id)?.name||id)+' <strong>'+num(player.inventory[id]||0)+' / '+num(need)+'</strong></div>').join(''):'<div class="stat">Đá đột phá <strong>'+qty+' / '+(player.inventory[material]||0)+'</strong></div>')+'<button class="green" data-action="upgrade" data-type="'+heroTab+'" data-submit>'+(star?'Nâng sao':'Đột phá')+'</button></section>';
 }else{
  heroTab='haki';body='<div class="haki-host"></div>';
 }
 screen.innerHTML='<section class="hero-panel hero-ref'+(heroTab==='rank'&&h.germa?' germa-on':'')+'" aria-label="Thông tin tướng">'+body+'</section><nav class="hero-side-tabs" aria-label="Thông tin tướng">'+nav.map(([id,label,asset])=>'<button class="'+(heroTab===id?'selected':'')+'" data-action="hero-tab" data-tab="'+id+'" aria-label="'+label+'" title="'+label+'">'+img(heroTabSprite(id))+'</button>').join('')+'</nav><div class="hero-ref-stars" aria-label="'+h.stars+' sao">'+heroStarsHtml(h.stars)+'</div>'+(heroTab==='rank'&&h.germa?'<div class="germa-host"></div>':'')+(Date.now()<heroGainUntil&&heroGainLines.length?'<aside class="hero-stat-gains" aria-live="polite">'+heroGainLines.map(line=>'<div>'+escape(line)+'</div>').join('')+'</aside>':'');
 if(heroTab==='rank'&&h.germa)mountGerma();
 if(heroTab==='haki')mountHaki();else window.HakiUI?.close();
 {const entry=window.TalentUI?.entryHtml();if(entry){screen.insertAdjacentHTML('beforeend',entry);window.TalentUI.mountEntry(screen)}}
 window.ExcUI?.entry(screen);
 {const host=document.createElement('div');host.className='pet-equip-host';screen.appendChild(host);window.PetUI.mountEquip(host,petContext())}
}
// Bảng Haki ở tab Haki (dist/haki-ui.js): 5 bậc mở theo L1-L5, chọn 1/3 Haki mỗi bậc.
function mountHaki(){const host=screen.querySelector('.haki-host');if(host)window.HakiUI.mount(host,{player:()=>player,assetSrc,assets:()=>V().assets(),mutation,toast:m=>V().toast(m),rerender:()=>{renderUi()}})}
// Ép Sao / Germa ở tab Đột phá khi tướng đạt L1 (dist/germa-ui.js).
function mountGerma(){const host=screen.querySelector('.germa-host');if(host)window.GermaUI.mount(host,germaContext())}
function germaContext(){return{player:()=>player,items:itemMap,assetSrc,assets:()=>V().assets(),named,num,short,mutation,toast:m=>V().toast(m),
 avatar:()=>catalog.hero.avatar,heroHead:()=>catalog.hero.visual.head,shardId:()=>player.hero.id==='zoro-king-of-hell'?'material:zoro-shard':player.hero.id==='luffy-gear-2'?'material:luffy-shard':'heroshard:'+catalog.hero.avatar,
 rerender:()=>{renderUi()},modal:(t,b)=>modal(t,b),
 confirm:(text,title,price,ok)=>{modal(title,`<p class="item-description">${escape(text)}</p><div class="modal-actions"><button class="green" data-germa-confirm>${img(named('icon_gem'))} ${price}</button></div>`);dialog.querySelector('[data-germa-confirm]').onclick=()=>{dialog.innerHTML='';ok()}}}}
// Chiến trường (dist/arena-ui.js): Đơn đấu / Liên đấu / Võ đấu dựng từ scene gốc 8 / 20 / 33 / 5 trên bản đồ thế giới.
let arenaReturn=null,arenaResult=null,guildResult=null;
function arenaHeroCard(h,{mini=false,check=false}={}){
 const id=h.heroId||h.id,def=catalog.heroes.find(d=>d.id===id)||catalog.heroes.find(d=>d.avatar===h.avatar);if(!def)return '';
 return `<span class="arena-card${mini?' mini':''}" title="${escape(def.name)}">${img(named('frame_item'),'arena-card-frame')}${img(def.visual.head,'arena-card-head')}${img(named('faction_'+def.faction),'arena-card-faction')}<b>${h.level}</b><span class="arena-card-stars">${heroStarsHtml(h.stars)}</span>${check?img(named('tick_green'),'arena-card-check'):''}</span>`;
}
function arenaContext(){const g=germaContext();return{player:()=>player,api,post:(url,body)=>api(url,body),mutation,assetSrc,assets:()=>V().assets(),named,img,escape,short,num,toast:m=>V().toast(m),items:itemMap,
 layer:()=>document.querySelector('#game-layer'),navigate,modal:(t,b)=>modal(t,b),confirm:g.confirm,rewardTile:r=>eventTile(r,'arena-tile'),heroCard:arenaHeroCard,
 heroHead:avatar=>catalog.heroes.find(d=>d.avatar===String(avatar))?.visual.head,faction:id=>catalog.heroes.find(d=>d.id===id)?.faction||'light',
 shop:()=>{window.ArenaUI.close();navigate(1404)},setReturn:mode=>{arenaReturn=mode;arenaResult=null}}}
// Hạm đội (dist/guild-ui.js): đảo Hạm đội trên bản đồ thế giới.
function guildUiContext(){const a=arenaContext();return{...a,skeleton:avatar=>catalog.campaign.visuals[String(avatar)]?.skeleton,spine:spineCanvas,
 confirm:(text,title,price,ok)=>{modal(title,`<p class="item-description">${escape(text)}</p><div class="modal-actions"><button class="green" data-guild-confirm>${price?img(named('icon_gem'))+' '+price:'Đồng ý'}</button></div>`);dialog.querySelector('[data-guild-confirm]').onclick=()=>{dialog.innerHTML='';ok()}},
 shop:()=>{window.GuildUI.close();navigate(1404)}}}
// Tân Tứ Hoàng (dist/tth-ui.js): đảo B_TanTuHoang trên bản đồ thế giới.
function tthContext(){const a=arenaContext();return{...a,skeleton:avatar=>catalog.heroes.find(d=>d.avatar===String(avatar))?.visual?.skeleton||catalog.campaign.visuals[String(avatar)]?.skeleton,spine:spineCanvas,
 heroAvatar:()=>catalog.hero.avatar,confirm:guildUiContext().confirm}}
async function openTth(boss){if(currentScene!==37)await navigate(37);window.TthUI?.open(boss)}
async function openGuild(panel){if(currentScene!==37)await navigate(37);window.GuildUI?.open(panel)}
async function openArena(mode){if(currentScene!==37)await navigate(37);window.ArenaUI?.open(mode)}
// Thiên phú (dist/talent-ui.js): dùng chung xác nhận kim cương và mảnh tướng với Germa.
// Luyện hồn (dist/exc-ui.js): nút trên màn Thông tin tướng, sổ EXCPanelMain.
function excContext(){const g=germaContext();return{player:()=>player,items:itemMap,assetSrc,assets:()=>V().assets(),named,short,mutation,toast:m=>V().toast(m),rerender:()=>renderUi(),layer:()=>document.querySelector('#game-layer'),spine:spineCanvas,confirm:g.confirm,itemInfo:id=>itemDialog(id)}}
function talentContext(){const g=germaContext();return{player:()=>player,items:itemMap,assetSrc,assets:()=>V().assets(),named,short,escape,mutation,toast:m=>V().toast(m),rerender:()=>{renderUi()},
 layer:()=>document.querySelector('#game-layer'),spine:spineCanvas,modal:(t,b)=>modal(t,b),confirm:g.confirm,shardId:g.shardId,heroHead:g.heroHead,faction:()=>catalog.hero.faction}}
function heroInfoDialog(){const h=player.hero;modal('THÔNG TIN TƯỚNG',`<h2>${escape(catalog.hero.name)}</h2><p class="item-description">${heroClasses[catalog.hero.class]||'Đấu Sĩ'} · ${heroFactions.find(([id])=>id===catalog.hero.faction)?.[1]||''} · Cấp ${h.level}/${player.costs.level.maxLevel}<br>${h.stars} sao · Bậc ${h.rank}/${catalog.economy.maxRank}</p><div class="divider"></div>${[['Tấn công',h.stats.attack],['Máu',h.stats.maxHp],['Phòng thủ',h.stats.defense],['Tốc độ',h.stats.speed],['Lực chiến',h.stats.power]].map(([name,value])=>`<div class="stat">${name}<strong>${num(value)}</strong></div>`).join('')}<div class="modal-actions"><button class="green" data-action="hero-tab" data-tab="haki">Haki</button></div>`)}
function heroSkillDialog(id){const base=catalog.skills.find(s=>s.id===id);if(!base)return;const index=catalog.skills.indexOf(base),germa=germaSkillAt(index),skill=germa?{...base,name:germa.name}:base,level=germa?4:player.hero.skills[id],description=escape(germa?germa.description:skillDescription(skill)).replace(/(\d+%(?:Công| Giáp| Máu)?)/g,'<mark>$1</mark>').replace(/^(Nộ:|Bị động:)/,'<strong class="skill-kind '+(skill.passive?'passive':'active')+'">$1</strong>');modal(skill.name,`<div class="item-header">${img(germa?germa.icon:skillIcon(index),'hero-skill-dialog-icon')}<h2><span>[${level}]</span> ${escape(skill.name)}</h2></div><p class="item-description">${description}</p><div class="skill-upgrade-cost">${germa?'Kỹ năng Germa cấp 4':level>=4?'Đã đạt cấp tối đa (cấp 4)':'Tự động lên cấp '+(level+1)+' khi thức tỉnh tới '+({2:'3 sao',3:'5 sao',4:'sao tím (6 sao)'})[level+1]}</div><div class="modal-actions"><button class="green" data-action="hero-tab" data-tab="haki">Haki</button></div>`,'luffy-skill-tooltip')}
async function upgradeTen(){
 if(busy)return;busy=true;setBusy(true);let count=0;const beforeStats={...player.hero.stats};
 try{while(count<10){const cost=player.costs.level;if(player.hero.level>=cost.maxLevel||(player.wallet.spirit||0)<cost.heroExp||player.wallet.gold<cost.gold)break;await api('/api/hero/upgrade',{type:'level'});count++}if(count)showHeroGains(beforeStats);V().toast(count?`Đã nâng ${count} cấp.`:'Không đủ vàng, kinh nghiệm hoặc đã đạt giới hạn cấp.');heroUi()}catch(e){V().toast(e.message);heroUi()}finally{busy=false;setBusy(false)}
}
function inventoryUi(shop=false){
 if(!shop){screen.innerHTML=window.ReferenceUI.inventory(referenceContext());return}
 const category=shop?shopTab:inventoryTab;
 const categories=[['all','Tất cả'],['equipment','Trang bị'],['artifact','Bảo vật'],['consumable','Vật phẩm'],['shard','Mảnh'],['material','Nguyên liệu']];
 let list=[...catalog.items,...(shop||dictionary?[]:ownedVariants())].filter(item=>!(shop&&item.noShop)&&(shop||dictionary||player.inventory[item.id]>0)&&(category==='all'||item.category===category)&&item.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
 const size=shop?12:28,pages=Math.max(1,Math.ceil(list.length/size));page=Math.min(page,pages-1);const visible=list.slice(page*size,(page+1)*size);
 screen.innerHTML=`<section class="inventory-panel ${shop?'shop-panel':''}"><div class="tabs">${categories.map(([id,name])=>`<button class="${category===id?'active':''}" data-action="inventory-tab" data-tab="${id}" data-shop="${shop}">${name}</button>`).join('')}</div><div class="row between"><input id="item-search" aria-label="Tìm vật phẩm" placeholder="Tìm vật phẩm…" value="${escape(search)}">${shop?money('gold',player.wallet.gold):`<button class="small subtle" data-action="dictionary">${dictionary?'Về túi đồ':'Từ điển vật phẩm'}</button>`}</div><div class="inventory-grid">${visible.map(item=>`<div class="item-cell" role="button" tabindex="0" data-action="${shop?'shop-item':'item'}" data-item="${escape(item.id)}">${icon(item,shop?null:player.inventory[item.id]||0)}<span class="label">${escape(item.name)}</span></div>`).join('')||'<div class="empty">Chưa có vật phẩm trong mục này.</div>'}</div><div class="pager white"><button class="small subtle" data-action="page" data-delta="-1" ${page===0?'disabled':''}>‹ Trước</button><span>${page+1}/${pages} · ${list.length} vật phẩm</span><button class="small subtle" data-action="page" data-delta="1" ${page>=pages-1?'disabled':''}>Sau ›</button></div></section>`;
}
function stageUi(){
 const c=campaignContext();screen.innerHTML=currentScene===28?CampaignUI.map(c):CampaignUI.deck(c);CampaignUI.focus(c,currentScene===28);
}
function campaignContext(){campaignStageId??=Math.min(player.adventure.unlockedStage,catalog.stages.length);campaignChapterId??=catalog.stages[campaignStageId-1].chapter;return{...referenceContext(),chapterId:campaignChapterId,stageId:campaignStageId,draftSlots:campaignSlots||player.formation?.slots||[player.hero.id,null,null,null,null,null],selectedSlot:campaignSelectedSlot,formationFilter:campaignFilter}}
function openCampaignTeam(){campaignSlots=[...(player.formation?.slots||[player.hero.id,null,null,null,null,null])];campaignSelectedSlot=null;dialog.innerHTML=CampaignUI.formation(campaignContext())}
// Gỡ tướng khỏi đội hình: chạm thẻ trong ô thì thẻ co lại mờ dần cùng hiệu ứng chạm hit_cham_tay
// (HitMove của Đảo Người Cá), xong mới vẽ lại đội hình. Tướng mới vào ô thì thẻ bật lên.
const tapBurst={skeleton:{name:'hit_cham_tay_SkeletonData',skeleton:{name:'hit_cham_tay',src:'assets/CAB-bc91efcf534eb968cbdf072c3cf7bf88_-1423486090316652979.json'},atlases:[{atlas:{name:'hit_cham_tay.atlas',src:'assets/CAB-bc91efcf534eb968cbdf072c3cf7bf88_-7644207151409222545.atlas'},textures:['CAB-bc91efcf534eb968cbdf072c3cf7bf88_2412801438897531845']}]},animation:'hit'};
let campaignRemoving=false;
function burstAt(el){
 const layer=$('#game-layer'),box=layer.getBoundingClientRect(),r=el.getBoundingClientRect(),k=box.width/1136,size=170;
 const canvas=document.createElement('canvas');canvas.className='formation-burst';canvas.width=canvas.height=size;
 canvas.style.left=((r.left+r.width/2-box.left)/k-size/2)+'px';canvas.style.top=((r.top+r.height/2-box.top)/k-size/2)+'px';
 layer.appendChild(canvas);spineCanvas(canvas,tapBurst,{loop:false,fit:1,onEnd:()=>canvas.remove()});setTimeout(()=>canvas.remove(),1500);
}
function removeCampaignHero(position){
 if(campaignRemoving||!campaignSlots?.[position])return;
 const slot=dialog.querySelector(`.campaign-slot[data-slot="${position}"]`);
 const done=()=>{campaignRemoving=false;campaignSlots[position]=null;campaignSelectedSlot=null;dialog.innerHTML=CampaignUI.formation(campaignContext())};
 if(!slot)return done();
 campaignRemoving=true;burstAt(slot);slot.classList.add('leaving');setTimeout(done,260);
}
function popCampaignSlot(id){const i=campaignSlots.indexOf(id);if(i>=0)dialog.querySelector(`.campaign-slot[data-slot="${i}"]`)?.classList.add('entering')}
function editCampaignHero(id){
 if(!player.heroes.some(h=>h.id===id))return;const previous=campaignSlots.indexOf(id);
 if(campaignSelectedSlot!==null){const displaced=campaignSlots[campaignSelectedSlot];if(previous>=0)campaignSlots[previous]=displaced;campaignSlots[campaignSelectedSlot]=id}
 else if(previous>=0)campaignSlots[previous]=null;
 else{const empty=campaignSlots.indexOf(null);if(empty<0){V().toast('Đội hình đã đủ 6 tướng.');return}campaignSlots[empty]=id}
 campaignSelectedSlot=null;dialog.innerHTML=CampaignUI.formation(campaignContext());popCampaignSlot(id);
}
function modal(title,body,classes=''){dialog.innerHTML=`<div class="modal-shade"><section class="modal panel ${classes}" role="dialog" aria-modal="true" aria-label="${escape(title)}"><button class="close" aria-label="Đóng" data-action="close">×</button><h2 class="title">${escape(title)}</h2>${body}</section></div>`;setBusy(busy)}
let heroChoice=null,chestTables=null,chestChoice=null;
async function loadChests(){if(chestTables)return chestTables;try{chestTables=await fetch('chests.json').then(r=>{if(!r.ok)throw Error();return r.json()})}catch{V().toast('Không tải được dữ liệu rương. Hãy thử lại.')}return chestTables}
function rewardArt(reward){if(reward.kind==='gold')return{key:named('icon_gold'),name:'Vàng'};if(reward.kind==='diamonds')return{key:named('icon_gem'),name:'Kim cương'};if(reward.kind==='hero'){const def=catalog.heroes.find(d=>d.avatar===reward.avatar);return{key:def?.visual.head,name:def?.name||'Tướng'}}const item=itemMap.get(reward.itemId);return{key:item?.assetKey,name:item?.name||reward.itemId}}
function rewardTile(reward,attributes=''){const art=rewardArt(reward),label=`${art.name}${reward.quantity>1?' ×'+num(reward.quantity):''}`,inner=`${img(art.key,reward.kind==='hero'?'choice-head':'chest-icon',art.name)}${reward.quantity>1?`<span class="chest-quantity">${short(reward.quantity)}</span>`:''}${reward.kind==='hero'&&reward.fresh?'<span class="summon-new">Mới</span>':''}`;return attributes?`<button class="choice-hero" ${attributes} aria-label="${escape(label)}" title="${escape(label)}">${inner}</button>`:`<div class="choice-hero" title="${escape(label)}" aria-label="${escape(label)}">${inner}</div>`}
async function chestDialog(itemId){
 const tables=await loadChests(),chest=tables?.[itemId];if(!chest)return;const item=itemMap.get(itemId),choose=chest.mode==='choice',picked=choose&&chestChoice?.itemId===itemId?chestChoice.index:null;
 const rewards=chest.rewards.map((reward,index)=>{const tile=rewardTile(reward,choose?`data-action="chest-pick" data-item="${escape(itemId)}" data-index="${index}" aria-pressed="${index===picked}"`:'');return index===picked?tile.replace('class="choice-hero"','class="choice-hero selected"'):tile}).join('');
 const name=picked!==null?rewardArt(chest.rewards[picked]).name:'';
 modal(choose?'Có thể nhận':'Quà trong rương',`<div class="choice-grid">${rewards}</div><div class="modal-actions choice-actions"><p>${choose?(name?escape(name):'Chọn 1 phần thưởng'):`Mỗi lần mở nhận ${chest.draws||1} phần thưởng ngẫu nhiên`}</p>${choose?`<button class="green" data-action="chest-confirm" ${picked===null?'disabled':''}>Nhận</button>`:`<button class="subtle" data-action="item" data-item="${escape(itemId)}">Quay lại</button>`}</div>`,'choice-modal');
}
async function openChest(itemId,body){
 const data=await mutation('/api/items/open',{itemId,...body},{render:false,message:false,bonus:false});if(!data)return;renderUi();
 const left=player.inventory[itemId]||0,item=itemMap.get(itemId),notes=data.result.rewards.filter(r=>r.shardItem).map(r=>`${rewardArt(r).name} đã có, đổi thành ${num(r.quantity)} mảnh`);
 modal('Nhận được',`<div class="choice-grid chest-result">${data.result.rewards.map(r=>rewardTile(r.shardItem?{kind:'item',itemId:r.shardItem,quantity:r.quantity}:r)).join('')}</div>${notes.length?`<p class="muted">${escape(notes.join('. '))}</p>`:''}<div class="modal-actions choice-actions"><p>Còn ${num(left)} ${escape(item.name)}</p>${left&&item.chest==='random'?`<button class="green" data-action="chest-open" data-item="${escape(itemId)}" data-count="1">Mở tiếp</button>`:''}</div>`,'choice-modal');
}
function heroChoiceDialog(){
 const item=itemMap.get(heroChoice.itemId),owned=ownedAvatars(),heroes=catalog.album.heroes.filter(h=>h.rank===item.choice.rank&&item.choice.factions.includes(h.faction)&&catalog.heroes.some(d=>d.avatar===h.avatar)),picked=heroes.find(h=>h.avatar===heroChoice.avatar);
 const stars=Array.from({length:5},()=>img(named('hero_star_1'))).join('');
 modal('Có thể nhận',`<div class="choice-grid">${heroes.map(h=>`<button class="choice-hero ${h.avatar===heroChoice.avatar?'selected':''}" data-action="choice-hero" data-avatar="${escape(h.avatar)}" aria-pressed="${h.avatar===heroChoice.avatar}" aria-label="${escape(h.name)}${owned.has(h.avatar)?', đã sở hữu':''}" title="${escape(h.name)}">${img(catalog.heroes.find(d=>d.avatar===h.avatar).visual.head,'choice-head',h.name)}${img(named('faction_'+h.faction),'choice-faction')}<span class="choice-stars">${stars}</span>${owned.has(h.avatar)?'<span class="choice-owned">Đã có</span>':''}</button>`).join('')}</div><div class="modal-actions choice-actions"><p>${picked?`${escape(picked.name)}${owned.has(picked.avatar)?' · đã có, sẽ đổi thành mảnh':''}`:'Chọn 1 tướng'}</p><button class="green" data-action="choice-confirm" ${picked?'':'disabled'}>Nhận tướng</button></div>`,'choice-modal');
}
let lastItem=null;
function itemDialog(id,buy=false){
 const item=itemMap.get(id);if(!item)return;lastItem=id;const count=player.inventory[id]||0,equipped=Object.values(player.hero.equipment).includes(id);
 let actions='';
 if(!count&&!equipped)actions='';
 else{
  if(count>0&&(!item.noShop||item.points))actions+=`<button class="subtle" data-action="sell" data-item="${escape(id)}" data-submit>Bán 1 · ${num(item.sellPrice)} vàng</button>`;
  if(item.slot)actions+=`<button class="green" data-action="${equipped?'unequip':'equip'}" data-slot="${escape(item.slot)}" data-item="${escape(id)}" data-submit>${equipped?'Tháo trang bị':'Trang bị'}</button>`;
  else if(item.effect)actions+=count>1&&!item.stoneId?`<button class="green" data-action="use-open" data-item="${escape(id)}">Dùng</button>`:`<button class="green" data-action="use" data-item="${escape(id)}" data-submit>${item.stoneId?'Lắp':'Dùng'}</button>`;
  else if(item.choice)actions+=`<button class="green" data-action="item-choice" data-item="${escape(id)}">Dùng</button>`;
  else if(item.chest==='choice')actions+=`<button class="green" data-action="chest-view" data-item="${escape(id)}">Dùng</button>`;
  else if(item.chest)actions+=`<button class="subtle" data-action="chest-view" data-item="${escape(id)}">Xem quà</button>${count>=10?`<button class="green" data-action="chest-open" data-item="${escape(id)}" data-count="10">Mở 10</button>`:''}<button class="green" data-action="chest-open" data-item="${escape(id)}" data-count="1">Mở 1</button>`;
 }
 if(item.merge&&count>0&&!(item.heroShard&&player.heroes?.some(h=>h.id==='hero-'+item.heroShard)))actions+=`<button class="green" data-action="shard-merge" data-item="${escape(id)}" ${count<item.merge?'disabled':'data-submit'}>Ghép ${num(count)}/${num(item.merge)}</button>`;
 const kind=slotNames[item.slot]||({material:'Nguyên liệu',consumable:'Vật phẩm',shard:'Mảnh ghép'})[item.category]||'Bảo vật';
 if(item.category==='artifact'){artifactDialog(item,id,count,equipped);return}
 dialog.innerHTML=`<div class="modal-shade item-popup-shade"><section class="modal item-popup" role="dialog" aria-modal="true" aria-label="${escape(item.name)}" style="--popup-frame:url('${assetSrc(named('round_rect_8'))}');--popup-row:url('${assetSrc(named('round_rect_7'))}');--popup-button:url('${assetSrc('1a2d3e7dc1dbacb46b77f62100c5477a_2')}')"><h2 class="item-popup-title">${escape(item.name)}</h2>${item.points?`<button class="item-popup-gift" data-action="item-drop" aria-label="Cách nhận">${img(named('button_gift'))}</button>`:''}<div class="item-popup-head">${icon(item,item.points?null:count)}<div><p>${escape(kind)}</p>${count||equipped?`<small>Sở hữu: ${num(count)}${equipped?' · Đang trang bị':''}</small>`:''}</div></div>${item.points?equipmentDetail(item):`<p class="item-description">${escape(item.description||'Vật phẩm dùng trên hải trình.')}</p>${item.extra&&!item.slot&&!item.chest?'<p class="item-popup-note">Vật phẩm này chưa dùng được trong phiên bản hiện tại.</p>':''}${item.stats?Object.entries(item.stats).map(([name,value])=>`<p class="item-popup-stats">${num(value)} ${({attack:'Công',hp:'Máu',defense:'Thủ',speed:'Tốc độ'})[name]||escape(name)}</p>`).join(''):''}`}<p class="error" id="item-error"></p>${actions?`<div class="modal-actions">${actions}</div>`:''}${item.points?itemDropPanel(item):''}</section></div>`;setBusy(busy);
}
// Popup bảo vật như PopupItemInfo gốc: tên, ô ItemArtifactUI, "Bảo vật", nút nâng cấp (button_upgrade), dòng chỉ số
// của sao hiện tại; đang mặc thì Gỡ bỏ / Thay, trong túi thì Bán / Trang bị.
const artifactLine=group=>`${group.faction?`${artifactFactionNames[group.faction]}: `:''}${group.clazz?`${clazzNames[group.clazz]}: `:''}Tăng ${escape(pointLine(group.point))}`;
function artifactDialog(item,id,count,equipped){
 const max=window.ArtifactUI?.isMax(item),owned=equipped||count>0,target=equipped?'equipped':id;
 let actions='';
 if(equipped)actions=`<button class="green" data-action="unequip" data-slot="accessory" data-submit>Gỡ bỏ</button><button class="green" data-action="gear-pick" data-slot="accessory">Thay</button>`;
 else if(count>0)actions=`<button class="subtle" data-action="sell" data-item="${escape(id)}" data-submit>Bán 1 · ${num(item.sellPrice)} vàng</button><button class="green" data-action="equip" data-slot="accessory" data-item="${escape(id)}" data-submit>Trang bị</button>`;
 const upgrade=owned?`<button class="item-popup-upgrade" data-action="artifact-upgrade" data-target="${escape(target)}" ${max?'disabled':''} aria-label="${max?'Bảo vật đã đạt sao tối đa':'Nâng cấp bảo vật'}" title="${max?'Đã đạt sao tối đa':'Nâng cấp bảo vật'}">${img(named('button_upgrade'))}</button>`:'';
 dialog.innerHTML=`<div class="modal-shade item-popup-shade">${artifactInfoHtml(item,{owned:count>1||count&&equipped?count:0,upgrade,actions})}</div>`;setBusy(busy);
}
/** Khung thông tin bảo vật (PopupItemInfo): dùng cho popup từ trang bị/túi đồ và khi chạm bảo vật trong bảng nâng cấp. */
function artifactInfoHtml(item,{owned=0,upgrade='',actions=''}={}){
 return `<section class="modal item-popup artifact-popup" role="dialog" aria-modal="true" aria-label="${escape(item.name)}" style="--popup-frame:url('${assetSrc(named('round_rect_8'))}');--popup-row:url('${assetSrc(named('round_rect_7'))}');--popup-button:url('${assetSrc('1a2d3e7dc1dbacb46b77f62100c5477a_2')}')"><h2 class="item-popup-title">${escape(item.name)}</h2><div class="item-popup-head">${icon(item)}<div><p>Bảo vật</p>${owned?`<small>Sở hữu: ${num(owned)}</small>`:''}</div>${upgrade}</div>${item.points.map(group=>`<p class="item-popup-stats">${artifactLine(group)}</p>`).join('')}<p class="error" id="item-error"></p>${actions?`<div class="modal-actions">${actions}</div>`:''}</section>`;
}
function stageDialog(id){const s=catalog.stages.find(x=>x.id===id);if(!s)return;campaignStageId=s.id;campaignChapterId=s.chapter;stageUi();openCampaignTeam()}
function dailyDialog(){checkinDialog()}
// Thành tựu: PopupMasteringHero (tab Thành tựu = BoxGameChallenge, mỗi dòng là CellGameChallenge).
// Thông thạo = BoxMastering: cột tướng (BoxMasteringHeroes, ô đầu là điểm tổng), mốc điểm (BoxMasteringPoint,
// CellHeroMasteringMileStone) và nhiệm vụ của tướng đang chọn (BoxMasteringQuest, CellHeroMasteringQuest).
// Nhiều sprite trùng tên (rect, progress_bgr, round_rect_3...) nên dùng đúng key trong prefab.
const MK={select:'a8d01b9130fad1040bf1cd8f81ad2568_2',frame:'0c8c5b028d3f86f4b962f8096732f7fb_2',mask:'15f8fcc245b0ac743ae492bd2c002e60_2',border:'b0665ab94675b534e994abb5f58b5f66_2',points:'2879cf63a445cbb44a6439adf838d04f_2',dot:'dfed522853d91b64780ea3fd5654cbd7_2',field:'7c1fd54a802e4bc4290a2efba0799e8d_2',trophy:'bb678ff4451a5f447bc4f901fd8f7b1c_2',cell:'4b016a57d3bac3842ba2bb10811dfd94_2',tick:'53e513de0ac8ec04e96146830164d51b_2',tag:'a01b8746d50e6aa4a9a198bb7358c932_2',lockCell:'1bac2de97786126468cca02b23757355_2',lock:'68768a3082f0354428c3b5241bd61b1e_2',ms:'d463401fc5538a54da0e1cb573a991b5_2',ms2:'85b661f5c057d574dbbe1443cbe9e026_2',pbg:'11ea0a46b63da7849b2fe5971ff4233b_2',pfg:'dbac9473194bc6b47a3a2320b4064e64_2',knob:'1abed1f9fe84b694980c1e145d8e6505_2',rect:'50898f0907717ec458a45d7ac3127fc0_2',quest:'92728a2dca509da409a57cfb8a2b7d28_2',rect15:'0f0dbd82c5f6ea44083559c38d763845_2',green:'bd6a8ad4b068d0846ba2dcf60841fb34_2',box:'6f1a8f509a14fdb418fd09fc528039d8_2',itemBgr:'791558cd9af3633458a85b4422832b12_2'};
let achTab='ach',masterySel=null;
const mUrl=k=>`url('${assetSrc(MK[k])}')`;
function masteryHead(h,m){
 const def=catalog.heroes.find(x=>x.id===h.heroId),own=player.heroes.find(x=>x.id===h.heroId);if(!def||!own)return'';
 return `<button class="mst-hero${masterySel===h.heroId?' on':''}" data-action="mst-hero" data-hero="${escape(h.heroId)}" aria-label="${escape(def.name)}">${masterySel===h.heroId?`<i class="mst-select" style="border-image-source:${mUrl('select')}"></i>`:''}<span class="mst-head">${img(MK.frame,'mst-frame')}<span class="mst-mask">${img(MK.itemBgr)}${img(def.visual.head,'',def.name)}</span>${img(MK.border,'mst-border')}${img(named('faction_'+def.faction),'mst-faction')}<b class="mst-level">${own.level}</b><span class="mst-stars">${window.heroStarsHtml(own.stars)}</span></span>${h.ready?img(MK.dot,'mst-dot'):''}</button>`;
}
function masteryHtml(){
 const m=player.mastery;if(!m)return'';const pointsReady=m.milestones.some(x=>x.status===1);
 const left=`<div class="mst-heroes" style="border-image-source:${mUrl('box')}"><div class="mst-grid"><button class="mst-hero points${masterySel===null?' on':''}" data-action="mst-hero" data-hero="" aria-label="Điểm thông thạo">${masterySel===null?`<i class="mst-select" style="border-image-source:${mUrl('select')}"></i>`:''}${img(MK.points,'mst-points-icon')}${pointsReady?img(MK.dot,'mst-dot'):''}</button>${m.heroes.map(h=>masteryHead(h,m)).join('')}</div></div>`;
 if(masterySel===null){
  const reward=r=>achievementTile(r);
  const cell=(x,i)=>`<div class="mst-mile${x.status===0?' locked':''}"><div class="mst-mile-progress">${i?`<i class="mst-pbar" style="background-image:${mUrl(x.status?'pfg':'pbg')}"></i>`:''}${img(x.status?MK.ms:MK.ms2,'mst-circle')}${x.status?img(MK.knob,'mst-knob'):''}<b>${num(x.points)}</b></div><button class="mst-mile-rewards" data-action="mst-milestone" data-points="${x.points}" style="border-image-source:${mUrl('cell')}"><span class="mst-mile-items">${x.rewards.map(reward).join('')}</span>${x.status===2?img(MK.tick,'mst-mile-tick'):''}${x.status===1?img(MK.tag,'mst-mile-tag'):''}${x.status===0?`<i class="mst-mile-lock" style="border-image-source:${mUrl('lockCell')}"></i>${img(MK.lock,'mst-mile-lock-icon')}`:''}</button></div>`;
  return left+`<div class="mst-field" style="background-image:${mUrl('field')}">${img(MK.trophy,'mst-trophy')}<b>${num(m.points)}</b></div><div class="mst-miles" style="border-image-source:${mUrl('box')}"><div class="mst-scroll">${m.milestones.map(cell).join('')}</div></div>`;
 }
 const h=m.heroes.find(x=>x.heroId===masterySel),def=catalog.heroes.find(x=>x.id===masterySel);if(!h||!def){masterySel=null;return masteryHtml()}
 const quest=q=>`<div class="mst-quest" style="border-image-source:${mUrl('quest')}"><p class="mst-quest-title">${escape(q.text)}</p><span class="mst-quest-points" style="border-image-source:${mUrl('rect15')}">${img(MK.trophy)}<b>${q.points} điểm</b></span><div class="ach-bar mst-quest-bar" style="--track:url('${assetSrc(named('progress_mastering_quest'))}');--fill:url('${assetSrc(named('progress_mastering_quest_2'))}')"><i style="width:${Math.min(100,q.progress/q.target*100)}%"></i><b>${num(q.progress)}/${num(q.target)}</b></div><div class="mst-quest-rewards">${q.rewards.map(achievementTile).join('')}</div>${q.status===2?img(MK.tick,'mst-quest-tick'):`<button class="mst-collect${q.status===1?'':' locked'}" data-action="mst-claim" data-hero="${escape(h.heroId)}" data-quest="${q.index}" style="border-image-source:${mUrl('green')}">Nhận</button>`}</div>`;
 const body=h.done?`<p class="mst-finished">${img(MK.tick)}Đã hoàn thành mọi vòng thông thạo của ${escape(def.name)}.</p>`:h.quests.map(quest).join('');
 return left+`<div class="mst-quests" style="border-image-source:${mUrl('box')}"><p class="mst-name">${escape(def.name)}</p><span class="mst-lap" style="border-image-source:${mUrl('rect')}">Vòng: ${h.lap}/${h.laps}</span><div class="mst-scroll">${body}</div></div>`;
}
function achievementTile(r){const art=eventReward(r);return `<span class="ach-item">${img(named('bgr_item_consumable'),'ach-item-bgr')}${img(art.key,'ach-item-icon',art.name)}${img(named('border_item'),'ach-item-border')}<b>${short(r.quantity).replace(/\.0(?=[KMB])/,'')}</b></span>`}
function achievementDialog(){
 document.querySelector('.ach-popup')?.remove();const list=player.achievements||[],ready=list.some(a=>a.status===1);
 const m=player.mastery,masteryReady=!!m&&(m.milestones.some(x=>x.status===1)||m.heroes.some(h=>h.ready));
 const cell=a=>`<div class="ach-cell" style="--cell:url('${assetSrc(named('bgr_light'))}')"><p class="ach-desc">${escape(a.text)}</p><div class="ach-bar" style="--track:url('${assetSrc(named('progress_mastering_quest'))}');--fill:url('${assetSrc(named('progress_mastering_quest_2'))}')"><i style="width:${Math.min(100,a.progress/a.target*100)}%"></i><b>${num(a.progress)}/${num(a.target)}</b></div><div class="ach-rewards">${a.rewards.map(achievementTile).join('')}</div>${a.status===2?img(named('tick_green'),'ach-done'):`<button class="ach-claim${a.status===1?'':' locked'}" data-action="ach-claim" data-id="${escape(a.id)}" style="--btn:url('${assetSrc(named('button_red'))}')">Nhận thưởng</button>`}</div>`;
 const el=document.createElement('div');el.className='ach-popup';
 const tab=(id,label,dot,cls)=>`<button class="ach-tab ${cls}${achTab===id?' on':''}" data-action="ach-tab" data-tab="${id}" style="background-image:url('${assetSrc(named(achTab===id?'tab_active':'tab_inactive'))}')">${label}${dot?img(named('notify_dot'),'ach-dot'):''}</button>`;
 el.innerHTML=`<section class="ach-window" role="dialog" aria-modal="true" aria-label="${achTab==='ach'?'Thành tựu':'Thông thạo'}" style="--frame:url('${assetSrc(named('popup_notitle_2'))}')">${achTab==='ach'?`<div class="ach-scroll" style="--box:url('${assetSrc(named('round_rect_17'))}')"><div class="ach-list">${list.map(cell).join('')}</div></div>`:''}</section>${achTab==='mastery'?`<div class="mst">${masteryHtml()}</div>`:''}
 ${tab('ach','Thành tựu',ready,'first')}${tab('mastery','Thông thạo',masteryReady,'mastery')}
 <button class="ach-close" data-action="ach-close" aria-label="Đóng" style="background-image:url('${assetSrc(named('button_close_4'))}')"></button>`;
 $('#game-layer').appendChild(el);
}
function journalDialog(){modal('NHẬT KÝ HẢI TRÌNH',`<p>Cấp thuyền trưởng: ${player.account.level} · ${player.account.exp}/${player.account.level*100} EXP</p><div class="journal">${player.activity.map(a=>`<p>${escape(a.message)}<br><small>${escape(new Date(a.at).toLocaleString('vi-VN'))}</small></p>`).join('')||'<p>Hải trình của bạn bắt đầu từ đây.</p>'}</div>`)}
function renderUi(){
 if(currentScene===1||!player){authUi();return}
 if(currentScene===13){homeUi();return}
 if(currentScene===1156){heroUi();return}
 if(currentScene===12){inventoryUi();return}
 if(currentScene===1404){inventoryUi(true);return}
 if([28,34].includes(currentScene)){stageUi();return}
 if(currentScene===9){battleUi();return}
 if(currentScene===7){rosterUi();return}
 if(currentScene===1600){beastUi();return}
 if(currentScene===21){forgeUi();return}
 if(currentScene===10){eventsUi();return}
 screen.innerHTML='';
}
const battleArt={info:'1e1e4d8e62ea86241a0a704b15d78f11_2',speed1:'b41a77cbe594a4246ad0f62ec9b06998_2',speed2:'ece262d0786ceb7449c549f15bd323e0_2',skip:'21a74a23b18ebf94bbb103a017381771_2',hpBg:'79581ed4ab85c414698d3a8208392d14_2',hp:'a809372bb5691bc478cb843ce2e8f9f2_2',rage:'71d61bcd3a358334a99bad8eaf94f199_2',fortress:'78a35568f2bcb2c4da9e7bf4e316fead_2',aura:'48b097902e7796b44a5c15578869ae6c_2',empty:'13e9b23f8941b504e83c884c0751a379_2'};
const battleAllies=b=>b?.allies||[b.hero];
const battleUnits=b=>[...battleAllies(b),...b.enemies];
const definitionById=id=>catalog.heroes.find(h=>h.id===id)||catalog.hero;
function displayUnit(id){return displayBattle&&battleUnits(displayBattle).find(u=>u.id===id)}
function battleWheel(enemy=false){const current=displayBattle||player.battle,units=enemy?current.enemies:battleAllies(current);return `<div class="battle-aura ${enemy?'enemy':'ally'}" aria-label="${enemy?'Đội địch':'Đội của bạn'}">${img(battleArt.aura)}${Array.from({length:6},(_,i)=>{const unit=units.find((u,j)=>(Number.isInteger(u.position)?u.position-(enemy?1:0):j)===i);return `<span class="aura-slot ${unit?.hp===0?'fallen':''}">${img(unit?named('faction_'+(unit.faction||'abyss')):battleArt.empty)}</span>`}).join('')}${enemy?'':`<button class="aura-open" data-action="battle-menu" aria-label="Đội hình và kỹ năng" title="Đội hình và kỹ năng"></button>`}</div>`}
function battleUi(){
 const b=player?.battle;if(!b)return;const allies=battleAllies(displayBattle||b),h=allies.find(u=>u.id===battleMenuHeroId)||allies.find(u=>u.hp>0)||allies[0],def=definitionById(h.heroId||player.hero.id),active=actors.find(a=>a.id===battleActiveActorId);
 const context={...referenceContext(),catalog:{...catalog,hero:def,skills:def.skills},player:{...player,hero:{...h,skillDetails:Object.fromEntries(def.skills.map(s=>[s.id,s.levels[Math.min(s.levels.length,h.skills?.[s.id]||1)-1]]))}}};
 screen.innerHTML=`<section class="battle-hud" aria-label="Chiến đấu"><div class="battle-round">Vòng ${displayBattle?.turn||b.turn}</div>${active?'<div class="battle-turn-name">'+escape(active.name)+'</div>':''}<button class="battle-sprite battle-info" data-action="battle-menu" aria-label="Thông tin và điều khiển trận đấu" aria-expanded="${battleMenuOpen}">${img(battleArt.info)}</button><button class="battle-sprite battle-speed" data-action="speed" aria-label="Tốc độ ×${battleSpeed}">${img(battleArt['speed'+battleSpeed])}</button><button class="battle-sprite battle-skip" data-action="battle-skip" aria-label="Bỏ qua hoạt ảnh, đánh tự động đến kết quả" ${b.status!=='active'&&!battleBusy?'disabled':''}>${img(battleArt.skip)}</button>${battleWheel()}${battleWheel(true)}${autoBattle?'<div class="battle-auto-status">'+(skipBattleAnimations?'Đang hoàn tất trận…':'Tự động chiến đấu')+'</div>':''}<aside class="battle-menu" ${battleMenuOpen?'':'hidden'}><nav class="battle-party">${allies.map(u=>`<button data-action="battle-hero" data-unit="${u.id}" aria-label="${escape(u.name)}" class="${u.id===h.id?'selected':''} ${u.hp<=0?'fallen':''}">${img(definitionById(u.heroId||player.hero.id).visual.head)}<small>${Math.round(100*u.hp/u.maxHp)}%</small></button>`).join('')}</nav><header>${img(def.visual.head)}<div><strong>${escape(h.name)}</strong><small>HP ${num(h.hp)}/${num(h.maxHp)} · Nộ ${h.energy}/100</small></div></header>${window.ReferenceUI.combatSkills(context)}<div class="battle-controls"><button class="${autoBattle?'subtle':'green'}" data-action="auto" ${b.status!=='active'&&!battleBusy?'disabled':''}>${autoBattle?'Tạm dừng sau vòng này':'Tiếp tục chiến đấu'}</button></div><div class="battle-links"><button class="subtle" data-action="battle-log">Nhật ký trận</button><button class="subtle" data-action="battle-exit">Rút lui</button></div></aside></section>`;
}
function scheduleBattleTurn(delay=450/battleSpeed){
 clearTimeout(autoTimer);
 if(currentScene===9&&autoBattle&&!battleBusy&&player?.battle?.status==='active')autoTimer=setTimeout(()=>fight('auto'),skipBattleAnimations?0:delay);
}
async function setupBattle(resume=true){
 clearTimeout(autoTimer);autoBattle=false;battleMenuOpen=false;skipBattleAnimations=false;selectedTarget=null;floaters=[];battleEffects=[];battleShakes=[];battleLines=[];battleTime=0;lastBattleFrame=0;battleActiveActorId=null;battleMenuHeroId=null;const b=player.battle;if(!b)return;displayBattle=structuredClone(b);
 const bg=(b.chapter||b.stageId)===1?catalog.visuals.battleBackgrounds.find(bg=>bg.visual.key==='445ca4b1a92f9a34c9cde142ac0deb50_2')||catalog.visuals.battleBackgrounds[2]:catalog.visuals.battleBackgrounds[((b.chapter||b.stageId)-1)%12];battleBackground=await V().loadImage(bg.visual.key);
 const heroPositions=b.combatVersion===2?[[385,360],[385,555],[100,265],[100,465],[230,350],[230,565]]:[[360,500],[400,590],[165,300],[165,445],[165,570],[290,520]];
 actors=battleAllies(b).map(u=>{const def=definitionById(u.heroId||player.hero.id),pos=Number.isInteger(u.position)?heroPositions[u.position]:[205,555];return{id:u.id,side:'ally',heroId:def.id,avatar:def.avatar,faction:def.faction,x:pos[0],y:pos[1],scale:1.10,flip:1,hp:u.hp,maxHp:u.maxHp,energy:u.energy,name:u.name||def.name,level:u.level||player.hero.level,attackConfig:def.combat?.skills[0]||battleReference.combatAnimations.hero.attack,controller:{skeleton:def.visual.skeleton,animation:'idling',loop:true}}});
 const enemyPositions={1:[1015,220],2:[1015,380],3:[1015,545],4:[790,255],5:[790,410],6:[790,560]};
 b.enemies.forEach((enemy,i)=>{const position=enemyPositions[enemy.position]||[[795,335],[1015,440],[930,555],[1040,220],[810,510],[960,320]][i],visual=catalog.campaign?.visuals[enemy.avatar],heroDef=enemy.heroId?catalog.heroes.find(h=>h.id===enemy.heroId):null;actors.push({id:enemy.id,side:'enemy',avatar:enemy.avatar,...(heroDef?{heroId:heroDef.id,attackConfig:heroDef.combat?.skills[0]}:{}),faction:enemy.faction||'abyss',x:enemy.boss?850:position[0],y:enemy.boss?500:position[1],scale:enemy.boss?.62*(visual?.scale||1):1.05,bossAvatar:enemy.boss?enemy.avatar:null,flip:-1,hp:enemy.hp,maxHp:enemy.maxHp,energy:enemy.energy||0,name:enemy.name,level:enemy.level,attackConfig:visual?.combat?.skills?.[0],controller:{skeleton:visual?.skeleton||battleReference?.enemies?.find(e=>e.name==='Hero_237_SkeletonData')||catalog.visuals.enemies[i%catalog.visuals.enemies.length].skeleton,animation:'idling',loop:true}})});
 await prepareBattleEffects();await Promise.all([...actors.map(a=>V().loadSkeleton(a.controller)),...Object.values(battleArt).map(key=>V().loadImage(key)),...actors.filter(a=>a.side==='ally').flatMap(a=>definitionById(a.heroId).skills).map(s=>V().loadImage(s.assetKey)),...['fortress','abyss','forest','shadow','dark','light'].map(id=>V().loadImage(named('faction_'+id)))]);for(const a of actors){a.statusEffects=battleUnits(b).find(u=>u.id===a.id).effects||[];if(a.hp<=0)a.deathAt=-1;const c=a.controller;if(c.instance){const offset=new spine.Vector2(),size=new spine.Vector2();c.state.apply(c.instance);c.instance.updateWorldTransform();c.instance.getBounds(offset,size,[]);a.visualHeight=Math.max(100,Math.min(260,(offset.y+size.y)*a.scale));}}if(b.status!=='active')showBattleResult();else{autoBattle=resume;scheduleBattleTurn(900)}
}
function playActor(actor,name,loop=false,rate=1){if(!actor?.controller.instance)return;const {instance,state}=actor.controller;const desired=instance.data.findAnimation(name)?.name||instance.data.findAnimation(name==='win'?'idling':'beat')?.name;if(!desired)return;
 state.clearTracks();instance.setToSetupPose();const track=state.setAnimation(0,desired,loop);track.timeScale=rate;
 if(!loop&&name!=='dead'){const wait=name==='damage'?.20:0;state.addAnimation(0,'idling',true,wait)}
 state.apply(instance);instance.updateWorldTransform();
 if(name==='dead'){actor.deathAt=battleTime;actor.moveStart=null}
}
async function prepareBattleEffects(){
 effectPool=Object.entries(battleReference?.effects||{}).flatMap(([kind,config])=>Array.from({length:kind==='impact'?12:6},()=>({kind,skeleton:config.skeleton,animation:config.animation,loop:false})));
 if(actors.some(a=>a.heroId==='zoro-king-of-hell'))for(const [kind,key] of [['zoro-cutscene','cutscene'],['zoro-slash','skillEffect']])effectPool.push({kind,skeleton:definitionById('zoro-king-of-hell').visual[key],animation:'Cast',loop:false});
 const avatars=[...new Set([...actors.filter(a=>a.side==='ally'||a.heroId).map(a=>definitionById(a.heroId)).filter(d=>d?.ultimate).map(d=>d.avatar),...actors.filter(a=>a.bossAvatar).map(a=>a.bossAvatar)])];
 const attackAvatars=[...new Set(actors.map(a=>a.avatar).filter(a=>a&&a!=='576'))];
 if(avatars.length||attackAvatars.length){
  if(!heroEffects)heroEffects=await fetch('hero-effects.json').then(r=>r.ok?r.json():null).catch(()=>null);
  for(const avatar of avatars){const fx=heroEffects?.heroes[avatar];if(!fx)continue;
   fx.cast=fx.cast.filter(fxUsable);fx.impact=fx.impact.filter(fxUsable);
   for(const e of fx.cast)effectPool.push({kind:'hero-fx',key:e.key,skeleton:heroEffects.effects[e.key],animation:e.animation,loop:false});
   for(const e of fx.impact)for(let i=0;i<fxImpactSlots;i++)effectPool.push({kind:'hero-hit',key:e.key,skeleton:heroEffects.effects[e.key],animation:e.animation,loop:false});
  }
  // Đòn đánh thường (skill "beat" của db_battle_heroes): mỗi Spine một pool dùng chung cho mọi actor.
  const attackKeys=new Set();
  for(const avatar of attackAvatars){const atk=heroEffects?.heroes[avatar]?.attack;if(!atk)continue;atk.cast=atk.cast.filter(e=>fxUsable(e)&&e.layer!=='BeyondCanvas');atk.impact=atk.impact.filter(fxUsable);for(const e of [...atk.cast,...atk.impact])attackKeys.add(e.key)}
  for(const key of attackKeys)for(let i=0;i<fxImpactSlots;i++)effectPool.push({kind:'atk-fx',key,skeleton:heroEffects.effects[key],animation:'',loop:false});
 }
 await Promise.all(effectPool.map(c=>V().loadSkeleton(c)));
}
// Thiếu animation đúng tên (Sengoku: Hit gọi "animation" nhưng Skill_147 chỉ có cutsceen/hit) thì hiệu ứng trúng đòn lấy clip hit.
function fxStart(controller,name){const data=controller.instance.data,animation=data.findAnimation(name)||data.animations.find(a=>a.name.toLowerCase()===String(name).toLowerCase())||(controller.kind==='hero-hit'&&data.animations.find(a=>/hit/i.test(a.name)))||data.animations[0];controller.instance.setToSetupPose();controller.state.clearTracks();controller.state.setAnimation(0,animation.name,false);controller.state.apply(controller.instance);controller.instance.updateWorldTransform();return animation}
// Khung cắt của mỗi cutscene một cỡ: phóng cho phủ kín màn 16:9 và đặt tâm khung vào tâm màn.
function fxCover(controller,e){
 const slot=controller.instance.slots.find(s=>s.attachment instanceof spine.ClippingAttachment),base=(e.scale||1)*zoroStage.cutScale;if(!slot)return{x:zoroStage.cutX,y:zoroStage.cutY,scale:base};
 const v=[];slot.attachment.computeWorldVertices(slot,0,slot.attachment.worldVerticesLength,v,0,2);const xs=v.filter((_,i)=>i%2===0),ys=v.filter((_,i)=>i%2===1),scale=Math.max(1136/(Math.max(...xs)-Math.min(...xs)),640/(Math.max(...ys)-Math.min(...ys)))*1.06;
 return{x:568-(Math.min(...xs)+Math.max(...xs))*.5*scale,y:320+(Math.min(...ys)+Math.max(...ys))*.5*scale,scale};
}
// Tướng phe địch (Vực thẳm) ra chiêu: hiệu ứng đặt theo sân (origin 1) và hướng được lật sang phía đội ta.
function spawnHeroSkill(target,fx,animationLength,caster=null){const mirror=caster?.side==='enemy';
 if(skipBattleAnimations)return null;
 battleEffects=battleEffects.filter(f=>!['hero-fx','hero-hit'].includes(f.controller.kind));
 const taken=new Set(),cast=fx.cast.map(e=>{const controller=effectPool.find(c=>c.kind==='hero-fx'&&c.key===e.key&&c.instance&&!taken.has(c)&&!battleEffects.some(f=>f.controller===c));if(controller)taken.add(controller);return{e,controller}}).filter(x=>x.controller);if(!cast.length)return null;
 const timed=cast.map(x=>({...x,animation:fxStart(x.controller,x.e.animation)})),end=Math.max(animationLength,...timed.map(x=>x.e.delay+x.animation.duration)),firstHit=fx.hits.length?Math.min(...fx.hits):end*.85,rate=Math.max(1,end/fxMaxSeconds);
 for(const {e,controller,animation} of timed){
  const cinematic=e.layer==='BeyondCanvas',behind=fxBackdrop(e),stage=e.origin==='1'&&!behind,cover=cinematic?fxCover(controller,e):null,at=cover||(behind?{x:zoroStage.cutX,y:zoroStage.cutY}:stage?fxStagePoint(e.x,e.y):{x:target.x,y:target.y-(target.visualHeight||175)*.5}),scale=cover?cover.scale:(e.scale||1)*(behind?zoroStage.cutScale:stage?zoroStage.slashScale:.7*target.scale);
  if(mirror&&stage&&!cover)at.x=1136-at.x;
  battleEffects.push({controller,behind,x:at.x,y:at.y,scale,flip:mirror&&!cover&&!behind?-1:1,startAt:battleTime+e.delay/rate,rate,elapsed:-e.delay,duration:animation.duration,skill:true,targetId:target.id});
 }
 addShakes(fx.shake,rate);
 return{rate,hitAt:firstHit/rate,duration:end/rate};
}
function spawnHeroImpact(target,fx){
 if(skipBattleAnimations)return false;let shown=false;
 for(const e of fx.impact){const controller=effectPool.find(c=>c.kind==='hero-hit'&&c.key===e.key&&c.instance&&!battleEffects.some(f=>f.controller===c));if(!controller)continue;const animation=fxStart(controller,e.animation);battleEffects.push({controller,x:target.x,y:target.y-(target.visualHeight||175)*.5,scale:(e.scale||.6)*target.scale,flip:-1,startAt:battleTime+e.delay,rate:1,elapsed:-e.delay,duration:animation.duration,skill:true});shown=true}
 return shown;
}
// Hiệu ứng đòn đánh thường gốc. origin 0 = người ra đòn, 1 = giữa đội bị đánh, 2/'' = mục tiêu; offset tính theo đơn vị 64px.
function fxAttackPoint(e,actor,target){
 if(e.origin==='0')return{x:actor.x+actor.flip*64*e.x,y:actor.y-(actor.visualHeight||175)*.5-64*e.y};
 if(e.origin==='1'){const p=fxStagePoint(e.x,e.y);return actor.side==='ally'?p:{x:1136-p.x,y:p.y}}
 return{x:target.x-actor.flip*64*e.x,y:target.y-(target.visualHeight||175)*.5-64*e.y};
}
function spawnAttackFx(list,actor,target){
 if(skipBattleAnimations||!list?.length||!actor||!target)return false;let shown=false;
 for(const e of list){const controller=effectPool.find(c=>c.kind==='atk-fx'&&c.key===e.key&&c.instance&&!battleEffects.some(f=>f.controller===c));if(!controller)continue;const animation=fxStart(controller,e.animation),behind=fxBackdrop(e),at=behind?{x:zoroStage.cutX,y:zoroStage.cutY}:fxAttackPoint(e,actor,target);
  // offset_layer âm (Zoro Wano mượn Bgr_hit tím của Cast_74, -10000) là nền phủ màn hình, vẽ sau nhân vật như chiêu nộ.
  battleEffects.push({controller,behind,x:at.x,y:at.y,scale:behind?zoroStage.cutScale:(e.scale||.7)*(e.origin==='1'?zoroStage.slashScale/1.6:target.scale),flip:behind?1:-actor.flip,startAt:battleTime+e.delay,rate:1,elapsed:-e.delay,duration:animation.duration});shown=true}
 return shown;
}
function spawnZoroSkill(target){
 if(skipBattleAnimations)return null;
 battleEffects=battleEffects.filter(f=>!f.controller.kind.startsWith('zoro-'));
 const cut=effectPool.find(c=>c.kind==='zoro-cutscene'&&c.instance),cutDuration=(cut?.instance.data.findAnimation('Cast').duration||12.175)/zoroTiming.cutRate,beatHit=zoroTiming.beatHit/zoroTiming.slashRate,slashStart=cutDuration+beatHit-zoroTiming.hitTime/zoroTiming.slashRate;
 const hit={x:target.x,y:target.y-(target.visualHeight||175)*.5};
 for(const [kind,delay,rate] of [['zoro-cutscene',0,zoroTiming.cutRate],['zoro-slash',slashStart,zoroTiming.slashRate]]){
  const controller=effectPool.find(c=>c.kind===kind&&c.instance);if(!controller)continue;
  controller.instance.setToSetupPose();controller.state.clearTracks();controller.state.setAnimation(0,'Cast',false);controller.state.apply(controller.instance);controller.instance.updateWorldTransform();
  const slashing=kind==='zoro-slash',x=slashing?zoroStage.slashX:zoroStage.cutX,y=slashing?zoroStage.slashY:zoroStage.cutY,scale=slashing?zoroStage.slashScale:zoroStage.cutScale;
  battleEffects.push({controller,x,y,scale,flip:1,startAt:battleTime+delay,rate,elapsed:-delay*rate,duration:controller.instance.data.findAnimation('Cast').duration,skill:true,targetId:target.id,hitPoint:hit});
 }
 return{cutEnd:cutDuration,hitAt:slashStart+zoroTiming.hitTime/zoroTiming.slashRate,duration:slashStart+(effectPool.find(c=>c.kind==='zoro-slash')?.instance.data.findAnimation('Cast').duration||1.664)/zoroTiming.slashRate};
}
function spawnBattleImpact(target,source,skill=false){
 if(skipBattleAnimations)return;const config=battleReference?.effects?.impact;if(!config)return;
 for(let i=0;i<(skill?3:1);i++){
  const controller=effectPool.find(c=>c.kind==='impact'&&c.instance&&!battleEffects.some(f=>f.controller===c));if(!controller)break;
  controller.instance.setToSetupPose();controller.state.clearTracks();controller.state.setAnimation(0,config.animation,false);controller.state.apply(controller.instance);controller.instance.updateWorldTransform();
  battleEffects.push({controller,x:target.x+(i===1?-17:i===2?19:0),y:target.y-Math.min(95,(target.visualHeight||170)*.52)+(i===1?-14:i===2?13:0),flip:source?.flip||1,scale:config.scale*target.scale,startAt:battleTime+i*.12,elapsed:-i*.12,duration:controller.instance.data.findAnimation(config.animation).duration,skill});
 }
}
function drawBattleEffects(ctx,dt,behind=false){
 if(skipBattleAnimations){battleEffects=[];battleShakes=[];return}
 for(const effect of battleEffects){
  if(!!effect.behind!==behind)continue;
  const previous=effect.elapsed;effect.elapsed=(battleTime-effect.startAt)*(effect.rate||1);if(effect.elapsed<0||effect.elapsed>=effect.duration)continue;
  const c=effect.controller;c.state.update(Math.max(0,effect.elapsed-Math.max(0,previous)));c.state.apply(c.instance);c.instance.updateWorldTransform();
  const shade=['zoro-slash','hero-fx'].includes(effect.controller.kind)?c.instance.slots.find(s=>s.data.name==='images/shadowww'):null,shadeAlpha=shade?.color.a;
  if(shade){ctx.save();ctx.fillStyle='rgba(0,0,0,'+(shadeAlpha*.45)+')';ctx.fillRect(0,0,1136,640);ctx.restore();shade.color.a=0}
  ctx.save();ctx.translate(effect.x,effect.y);ctx.scale(effect.scale*effect.flip,-effect.scale);combatRenderer.draw(c.instance);ctx.restore();
  if(shade)shade.color.a=shadeAlpha;
 }
 if(!behind)battleEffects=battleEffects.filter(f=>f.elapsed<f.duration);
}
function spawnBattleHeal(target){
 const config=battleReference?.effects?.heal,controller=effectPool.find(c=>c.kind==='heal'&&c.instance&&!battleEffects.some(f=>f.controller===c));if(skipBattleAnimations||!config||!controller)return;
 controller.instance.setToSetupPose();controller.state.clearTracks();controller.state.setAnimation(0,config.animation,false);controller.state.apply(controller.instance);controller.instance.updateWorldTransform();
  battleEffects.push({controller,x:target.x,y:target.y,flip:1,scale:config.scale*target.scale,startAt:battleTime,elapsed:0,duration:controller.instance.data.findAnimation(config.animation).duration,skill:false});
}
// Chữ sát thương theo prefab gốc: TextHpLost (trắng, PoetsenOne 40), TextHpCrit (đỏ cam, 60), TextHpBuff (xanh lá, 40),
// TextHpBlock (Asap-Bold 40, "Chặn"); viền #242525 2px. Chuyển động lấy từ AnimationClip HpLost / HpCrit / Ani_HpBuff /
// Ani_Block: [thời điểm giây, giá trị] nội suy tuyến tính; y là độ cao so với điểm hiện (anchoredPosition gốc trừ mốc đầu).
const floaterFonts={number:{family:'font_ef92121f084bb95428ba536d0756f006_3',src:'assets/ef92121f084bb95428ba536d0756f006_3.ttf'},label:{family:'font_1241e6a2ad0f2e740a05308d4f5fdcd4_3',src:'assets/1241e6a2ad0f2e740a05308d4f5fdcd4_3.ttf'}};
for(const f of Object.values(floaterFonts))if(typeof FontFace!=='undefined')new FontFace(f.family,`url(${JSON.stringify(f.src)})`).load().then(face=>document.fonts.add(face)).catch(()=>{});
const floaterStyles={
 lost:{font:'number',size:40,color:'#ffffff',length:.833,sx:[[0,1.6],[.1,1],[.167,1.2],[.233,1]],sy:[[0,1.2],[.1,1],[.167,1.2],[.233,1]],y:[[0,0],[.233,0],[.533,50],[.6,50],[.833,70]],a:[[0,1],[.6,1],[.833,0]]},
 crit:{font:'number',size:60,color:'#ff2b00',length:.833,sx:[[0,1],[.033,2],[.1,2],[.217,1.017],[.283,1.2],[.383,1]],sy:[[0,1],[.033,1.8],[.1,1.8],[.217,1.017],[.283,1.2],[.383,1]],y:[[0,0],[.383,0],[.6,50],[.833,65]],a:[[0,1],[.6,1],[.833,0]]},
 heal:{font:'number',size:40,color:'#6ef23b',length:.885,y:[[0,-50],[.462,50],[.885,50]],a:[[0,0],[.154,1],[.692,1],[.885,0]]},
 block:{font:'label',size:40,color:'#ffffff',length:1.083,y:[[0,0],[.867,55],[1.083,55]],a:[[0,1],[.867,1],[1.083,0]]},
 buff:{font:'label',size:22,color:'#c8ed67',length:1.1,y:[[0,0],[1.1,55]],a:[[0,1],[.75,1],[1.1,0]]},
};
const curveAt=(keys,t)=>{if(!keys)return null;if(t<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const [t0,v0]=keys[i-1],[t1,v1]=keys[i];return v0+(v1-v0)*(t-t0)/(t1-t0||1)}return keys.at(-1)[1]};
function drawFloaters(ctx,now){
 floaters=floaters.filter(f=>now-f.at<(floaterStyles[f.kind||(f.heal?'heal':f.buff?'buff':'lost')].length*1000));
 for(const f of floaters){
  const style=floaterStyles[f.kind||(f.heal?'heal':f.buff?'buff':'lost')],t=Math.max(0,(now-f.at)/1000),font=floaterFonts[style.font];
  const sx=curveAt(style.sx,t)??1,sy=curveAt(style.sy,t)??1,alpha=curveAt(style.a,t),rise=curveAt(style.y,t);
  ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,alpha));ctx.translate(f.x,f.y-rise);ctx.scale(sx,sy);
  ctx.font=`${style.size}px ${font.family},GameFont,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  ctx.strokeStyle='#242525';ctx.lineWidth=style.size>=60?6:4;ctx.strokeText(f.text,0,0);ctx.fillStyle=style.color;ctx.fillText(f.text,0,0);ctx.restore();
 }
}
// Một "đợt" là các đòn liên tiếp của cùng một người, cùng loại (Nộ / đánh thường), mỗi mục tiêu một lần: chiêu đánh toàn
// bộ kẻ địch trúng, hiện số sát thương và ngã cùng lúc; mục tiêu bị đánh lại (chiêu nhiều đợt) mở đợt mới.
const waveSkip=new Set(['death','execute','resist','unit-state']);
function nextInWave(events,i,wave){
 for(let j=i+1;j<events.length;j++){const n=events[j];if(waveSkip.has(n.type)||n.type==='heal'&&n.skillId==='lifesteal')continue;
  return n.type==='damage'&&wave&&n.actor===wave.actor&&!!n.skill===wave.skill&&!wave.targets.has(n.target)}
 return false;
}
async function replay(events){
 let skillActor=null,skillDuration=0,skillDelay=0,skillAt=0,wave=null;
 for(let i=0;i<events.length;i++){
  const e=events[i],actor=actors.find(a=>a.id===e.actor),target=actors.find(a=>a.id===e.target);
  if(skipBattleAnimations){if(['damage','heal','execute'].includes(e.type)&&target)target.hp=e.hp;continue}
  if(e.type==='unit-turn'){battleActiveActorId=e.actor;if(actor){actor.energy=e.energy;const view=displayUnit(actor.id);if(view)view.energy=e.energy}battleUi()}
  if(e.type==='unit-state'&&actor){actor.energy=e.energy;const view=displayUnit(actor.id);if(view){view.energy=e.energy;view.hp=e.hp}battleUi()}
  if(e.energy!==undefined&&actor&&e.type==='skill'){actor.energy=e.energy;const view=displayUnit(actor.id);if(view)view.energy=e.energy}
  if(e.type==='attack'){const quick=actor?.heroId==='zoro-king-of-hell',config=quick?{animation:'run',delay_cast_eff:.36}:actor?.attackConfig||battleReference?.combatAnimations?.[actor?.id==='hero'?'hero':'enemy']?.attack;playActor(actor,config?.animation||e.animation,false,1);const atkFx=!quick&&actor?heroEffects?.heroes[actor.avatar]?.attack:null;addShakes(atkFx?.shake);if(atkFx?.cast.length)setTimeout(()=>spawnAttackFx(atkFx.cast,actor,target),Number(config?.delay_cast_eff||.36)*600);if(actor){actor.moveMode='attack';actor.moveStart=battleTime*1000;actor.moveDuration=650;actor.moveTo=target?{x:target.x-actor.flip*90,y:target.y}:null}await sleep(Number(config?.delay_cast_eff||.36)*1000)}
  if(e.type==='skill'){
   const zoro=actor?.heroId==='zoro-king-of-hell',definition=actor?.side==='ally'||actor?.heroId?definitionById(actor.heroId):null,summoned=!!definition?.ultimate,boss=actor?.bossAvatar,fx=summoned?heroEffects?.heroes[definition.avatar]:boss?heroEffects?.heroes[boss]:null,config=zoro?definition.combat.skills[1]:summoned?definition.combat.skills.find(s=>/skill/i.test(s.animation))||{animation:fx?.animation||'skill'}:boss?{animation:fx?.animation||'beat'}:battleReference?.combatAnimations?.hero?.skill;
   const animationLength=actor?.controller.instance?.data.findAnimation(config?.animation||e.animation)?.duration||1.87,scene=fx?.cast.length?spawnHeroSkill(target,fx,animationLength,actor):null,skillRate=zoro?zoroTiming.cutRate:scene?scene.rate:summoned?Math.max(1,animationLength/2.2):1;playActor(actor,config?.animation||e.animation,false,skillRate);
   skillActor=actor;skillDuration=scene?scene.duration:zoro?animationLength:animationLength/skillRate;skillDelay=scene?scene.hitAt:summoned?Math.min(Number(config?.delay_cast_eff||.73),skillDuration*.6):Number(config?.delay_cast_eff||.73);skillAt=battleTime*1000;
   const zoroScene=zoro?spawnZoroSkill(target):null;if(zoroScene){skillDelay=zoroScene.hitAt;skillDuration=zoroScene.duration;addShakes((heroEffects?.shakes?.['576']||[]).map(s=>({delay:zoroScene.hitAt,duration:s.duration})))}
   const targets=actors.filter(a=>a.side!==actor?.side&&a.hp>0);if(actor&&targets.length&&!zoro&&!scene){actor.moveMode='skill';actor.moveStart=battleTime*1000;actor.moveDuration=skillDuration*1000;actor.moveTo={x:Math.min(...targets.map(a=>a.x))-225,y:Math.max(555,actor.y,targets.reduce((sum,a)=>sum+a.y,0)/targets.length)}}
   battleLines.push(actor.name+': '+e.name);
   if(zoroScene){await sleep(zoroScene.cutEnd*1000);skillDelay-=zoroScene.cutEnd;playActor(actor,'beat',false,zoroTiming.slashRate);actor.moveMode='skill';actor.moveStart=battleTime*1000;actor.moveDuration=1550;actor.moveTo=target?{x:target.x-actor.flip*90,y:target.y}:null}
   await sleep(skillDelay*1000);
  }
  if(e.type==='turn'&&displayBattle){displayBattle.turn=e.turn;battleUi()}
  if(e.type==='defend'){battleLines.push(actor.name+' phòng thủ, tích thêm nộ.');await sleep(300)}
  if(e.type==='heal'&&target){if(e.revive&&target.deathAt!==undefined){delete target.deathAt;playActor(target,'idling',true);floaters.push({x:target.x,y:target.y-175,text:'Hồi sinh',at:battleTime*1000,buff:true})}target.hp=e.hp;const view=displayUnit(target.id);if(view)view.hp=e.hp;if(e.amount>0){spawnBattleHeal(target);floaters.push({x:target.x,y:target.y-150,text:String(e.amount),at:battleTime*1000,kind:'heal'});battleLines.push(target.name+' hồi '+num(e.amount)+' máu.');if(!(e.skillId==='lifesteal'&&nextInWave(events,i,wave)))await sleep(350)}}
  if(e.type==='buff'&&target){target.statusEffects??=[];target.statusEffects=target.statusEffects.filter(f=>f.skillId!==e.skillId);target.statusEffects.push(e);battleLines.push(e.name+': '+target.name);floaters.push({x:target.x,y:target.y-175-(events[i-1]?.type==='buff'&&events[i-1]?.target===e.target?24:0),text:e.name,at:battleTime*1000,buff:true});
   // Bị động sinh nhiều hiệu ứng cùng lúc: chỉ dừng ở hiệu ứng đầu của một chuỗi, các dòng sau hiện chồng lên nhau.
   if(events[i+1]?.type!=='buff')await sleep(events[i-1]?.type==='buff'?120:200)}
  if(e.type==='effect-expired'&&target)target.statusEffects=(target.statusEffects||[]).filter(f=>f.skillId!==e.skillId);
  if(e.type==='damage'&&target){if(!(wave&&e.actor===wave.actor&&!!e.skill===wave.skill&&!wave.targets.has(e.target)))wave={actor:e.actor,skill:!!e.skill,targets:new Set(),at:battleTime};wave.targets.add(e.target);target.hp=e.hp;target.lastHitAt=battleTime;if(e.energy!==undefined)target.energy=e.energy;const view=displayUnit(target.id);if(view){view.hp=e.hp;view.energy=target.energy}
   if(e.amount>0){playActor(target,e.hp<=0?'dead':'damage');const fx=e.skill&&actor?heroEffects?.heroes[actor.avatar]:null,atk=!e.skill&&actor?.heroId!=='zoro-king-of-hell'?heroEffects?.heroes[actor?.avatar]?.attack:null;if(!(actor?.heroId==='zoro-king-of-hell'&&e.skill)&&!(fx&&(spawnHeroImpact(target,fx)||fx.cast.some(c=>c.layer!=='BeyondCanvas')))&&!(atk&&spawnAttackFx(atk.impact,actor,target)))spawnBattleImpact(target,actor,e.skill)}
   floaters.push({x:target.x,y:target.y-140,text:e.immune?'Miễn dịch':e.miss?'Né':String(e.amount),at:wave.at*1000,kind:e.immune||e.miss?'block':e.critical?'crit':'lost'});if(e.blocked&&!e.immune&&!e.miss)floaters.push({x:target.x,y:target.y-185,text:'Chặn',at:wave.at*1000,kind:'block'});battleLines.push(`${actor?.name||catalog.hero.name} gây ${e.amount} sát thương.`);if(!nextInWave(events,i,wave))await sleep(e.skill?100:350)}
  if(!['damage','death','execute','resist','unit-state'].includes(e.type)&&!(e.type==='heal'&&e.skillId==='lifesteal'))wave=null;
  if(e.type==='execute'&&target){target.hp=0;const view=displayUnit(target.id);if(view)view.hp=0;floaters.push({x:target.x,y:target.y-160,text:'Trảm Sát',at:battleTime*1000,kind:'crit'});battleLines.push('Trảm Sát: '+target.name);await sleep(300)}
  if(e.type==='trigger'){battleLines.push(e.name);floaters.push({x:actor.x,y:actor.y-180,text:e.name,at:battleTime*1000,buff:true})}
  if(skillActor&&(!events[i+1]||!['damage','death','heal','buff','execute'].includes(events[i+1].type))){await sleep(Math.max(0,skillDuration*1000-(battleTime*1000-skillAt)));skillActor.moveStart=null;skillActor=null}
  if(e.type==='death'&&target){if(target.deathAt===undefined)playActor(target,'dead');if(!nextInWave(events,i,wave)&&events[i+1]?.type!=='death')await sleep(400)}
  if(e.type==='victory'){for(const a of actors.filter(a=>a.side==='ally'&&a.hp>0))playActor(a,'win');battleLines.push('Chiến thắng! Đã nhận thưởng.');await sleep(650)}
  if(e.type==='defeat'){battleLines.push('Thất bại. Nâng tướng và thử lại.');await sleep(500)}
 }
}
async function fight(type){
 if(currentScene!==9||battleBusy||busy||player?.battle?.status!=='active')return;clearTimeout(autoTimer);battleBusy=true;battleUi();
 try{const b=player.battle,target=actors.find(a=>a.id===selectedTarget&&a.hp>0)||actors.find(a=>a.side==='enemy'&&a.hp>0);const data=await api('/api/battle/action',{battleId:b.id,turn:b.turn,action:type,targetId:target?.id});await replay(data.result.events);displayBattle=structuredClone(player.battle);for(const a of actors){const unit=battleUnits(player.battle).find(u=>u.id===a.id);a.hp=unit.hp;a.energy=unit.energy||0;a.statusEffects=unit.effects||[];if(!a.hp&&a.deathAt===undefined)a.deathAt=battleTime-.7}if(player.battle.status!=='active'){autoBattle=false;showBattleResult()}}
 catch(e){V().toast(e.message);autoBattle=false;try{const data=await api('/api/state');if(data.player.battle?.id===displayBattle?.id)await setupBattle(false)}catch{}}
 finally{battleBusy=false;battleUi();scheduleBattleTurn()}
}
// Màn kết thúc trận theo PopupBattleEnd, chung cho mọi loại trận. Spine Win và Lose_op chạy trên canvas riêng.
const endSpine={win:{name:'Win',skeleton:{name:'Win',src:'assets/battle-win.json'},atlases:[{atlas:{name:'Win.atlas',src:'assets/battle-win.atlas'},textures:['battle-win']}]},lose:{name:'Lose_op',skeleton:{name:'Lose_op',src:'assets/battle-lose.json'},atlases:[{atlas:{name:'Lose_op.atlas',src:'assets/battle-lose.atlas'},textures:['battle-lose']}]}};
async function playEndSpine(canvas,won){
 const controller={skeleton:endSpine[won?'win':'lose'],animation:'Open',loop:false};await V().loadSkeleton(controller);if(!canvas.isConnected||!controller.instance)return;
 const zoom=$('#game-layer').getBoundingClientRect().width/1136,density=Math.max(1,Math.min(3,zoom*(window.devicePixelRatio||1)));canvas.width=Math.round(1136*density);canvas.height=Math.round(340*density);
 const ctx=canvas.getContext('2d'),renderer=new spine.canvas.SkeletonRenderer(ctx),{instance,state}=controller;renderer.triangleRendering=true;
 state.setAnimation(0,'Open',false);state.addAnimation(0,'Loop',true,0);let last=performance.now();
 const frame=at=>{if(!canvas.isConnected)return;state.update(Math.min(.05,(at-last)/1000));last=at;state.apply(instance);instance.updateWorldTransform();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.scale(density,density);ctx.translate(568,won?172:170);ctx.scale(1,-1);renderer.draw(instance);ctx.restore();requestAnimationFrame(frame)};
 requestAnimationFrame(frame);
}
function battleEndScreen(b,{rewards=[],damage,lines=[],close}){
 const won=b.status==='won',total=damage??(b.events||[]).filter(e=>e.type==='damage'&&String(e.target).startsWith('enemy')).reduce((sum,e)=>sum+(e.amount||0),0);
 const recommend=[['forge-go',named('menu_home2_forge'),'Tiệm đồ'],['summon-go',named('home2_summon'),'Chiêu mộ'],['hero-go',named('home2_hero'),'Tướng']];
 const middle=won?`<div class="battle-end-rewards" style="background-image:url('${assetSrc(named('tag_title_2'))}')">${rewards.filter(r=>r.quantity>0).map(r=>eventTile(r,'battle-end-tile')).join('')}</div>`:`<div class="battle-end-tip"><p>Hãy nâng cấp đội hình của bạn</p><div>${recommend.map(([action,key,label])=>`<button data-action="${action}" style="background-image:url('${assetSrc(named('home2_button_bgr'))}')">${img(key)}<span>${label}</span></button>`).join('')}</div></div>`;
 dialog.innerHTML=`<div class="battle-end ${won?'win':'lose'}" role="dialog" aria-modal="true" aria-label="${won?'CHIẾN THẮNG':'THẤT BẠI'}"><div class="battle-end-bg" style="background-image:url('${assetSrc(named('bgr_win_lose'))}')"></div>${img(named(won?'decor_win':'decor_lose'),'battle-end-decor top')}${img(named(won?'decor_win':'decor_lose'),'battle-end-decor bottom')}<canvas class="battle-end-art" width="1136" height="340"></canvas><button class="battle-end-detail" data-action="battle-log" aria-label="Diễn biến trận đấu">${img(named('button_info2'))}</button>${middle}<p class="battle-end-damage">Tổng sát thương: ${num(total)}</p>${lines.map(line=>`<p class="battle-end-line">${escape(line)}</p>`).join('')}<button class="battle-end-close" data-action="${close}">Đóng</button><span class="battle-end-id">Battle Id: ${escape(String(b.id).slice(0,8))}</span></div>`;
 playEndSpine(dialog.querySelector('.battle-end-art'),won);
}
function showBattleResult(){
 const b=player.battle;if(!b)return;const r=b.reward||{},won=b.status==='won';
 if(b.silent)return battleEndScreen(b,{damage:r.damage||0,rewards:r.items||[],lines:[r.target===3?`Tổng sát thương mùa: ${num(r.total||0)}`:`Máu hộ vệ còn: ${r.guardHp??100}%`,...(r.defeated?['Lord of the Coast đã bị đánh bại!']:[]),...(r.counted===false?['Mùa đã kết thúc nên trận này không được tính.']:[])],close:'sr-back'});
 if(b.beast)return battleEndScreen(b,{damage:r.damage||0,lines:[`Tích lũy: ${num(r.total||0)}`,...(r.counted===false?['Mùa đã kết thúc nên trận này không được tính.']:[])],close:'beast-back'});
 if(b.broken)return battleEndScreen(b,{rewards:r.items||[],lines:won&&!r.counted?['Tháng đã đổi nên trận này không được tính.']:[],close:'event-back'});
 if(b.tower)return battleEndScreen(b,{rewards:won?[{itemId:'gold',quantity:r.gold},...r.items]:[],close:'tower'});
 if(b.tth)return battleEndScreen(b,{damage:r.damage||0,rewards:r.items||[],lines:[`${b.tth.name} · Ngày ${b.tth.day}`+(r.counted===false?' · Ngày đã đổi, trận không được tính':` · Sát thương cao nhất hôm nay: ${num(r.best||0)}`)],close:'tth-back'});
 if(b.guildBoss)return battleEndScreen(b,{damage:r.damage||0,rewards:[{itemId:'gold',quantity:r.gold||0},{itemId:'consumable:6',quantity:r.coin||0}],lines:[`Đánh Boss hạm đội ải ${b.guildBoss.stage}`+(guildResult?.killed?' · Đã hạ boss!':'')],close:'guild-back'});
 if(b.arena)return battleEndScreen(b,{damage:(b.events||[]).filter(e=>e.type==='damage'&&String(e.target).startsWith('foe')).reduce((n,e)=>n+(e.amount||0),0),lines:[[`Đối thủ: ${b.arena.name}`,...window.ArenaUI.lines(arenaResult)].join(' · ')],close:'arena-back'});
 if(b.abyss)return battleEndScreen(b,{lines:won?[`Ải ${b.abyss.stage}: ${r.abyss?.stars||0}/3 sao`]:[],close:'abyss-back'});
 if(!won)return battleEndScreen(b,{close:'adventure'});
 battleEndScreen(b,{rewards:[{itemId:'consumable:1002',quantity:r.accountExp},{itemId:'gold',quantity:r.gold},{itemId:'spirit',quantity:r.heroExp},{itemId:'diamonds',quantity:r.diamonds},...(r.items||[])],lines:r.firstClear?['Vượt ải lần đầu!']:[],close:'adventure'});
}
let selectedTarget=null;
let combatRenderer=null;
function drawBattle(ctx,dt){const s=player?.battle?shakeOffset():null;if(!s)return drawBattleFrame(ctx,dt);ctx.save();ctx.translate(s.x,s.y);try{return drawBattleFrame(ctx,dt)}finally{ctx.restore()}}
function drawBattleFrame(ctx,dt){
 const b=player?.battle;if(!b)return false;
 const frameNow=performance.now(),elapsed=lastBattleFrame&&!V().paused&&!document.hidden?Math.max(0,(frameNow-lastBattleFrame)/1000)*battleSpeed:0;lastBattleFrame=frameNow;
 // Render the awaited impact frame before advancing to the following event,
 // even when a slow frame spans the whole short slash animation.
 const nextTime=battleWaitUntil===null?battleTime+elapsed:Math.min(battleTime+elapsed,battleWaitUntil),step=Math.max(0,nextTime-battleTime);battleTime+=step;
 if(battleBackground){if(b.stageId===1)ctx.drawImage(battleBackground,-142,-100,1420,800);else ctx.drawImage(battleBackground,0,0,1136,640)}else{ctx.fillStyle='#364c42';ctx.fillRect(0,0,1136,640)}
 const now=battleTime*1000;
 if(combatRenderer)drawBattleEffects(ctx,dt,true);
 for(const a of [...actors].sort((a,b)=>a.y-b.y)){
  let x=a.x,y=a.y;if(a.moveStart&&a.moveTo){const p=Math.min(1,(now-a.moveStart)/a.moveDuration);const k=a.moveMode==='skill'?Math.min(1,p/.15,(1-p)/.15):Math.sin(p*Math.PI);x+=(a.moveTo.x-a.x)*k;y+=(a.moveTo.y-a.y)*k;if(p>=1)a.moveStart=null}
  a.renderX=x;a.renderY=y;
  ctx.save();ctx.globalAlpha=a.deathAt===undefined?1:Math.max(0,1-Math.max(0,battleTime-a.deathAt-.25)/.35);ctx.fillStyle='#101d2050';ctx.beginPath();ctx.ellipse(x,y+5,45,12,0,0,Math.PI*2);ctx.fill();
  if(a.id===selectedTarget&&a.hp>0){ctx.strokeStyle='#ffda61';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y+5,54,17,0,0,Math.PI*2);ctx.stroke()}
  const c=a.controller;if(c.instance){c.state.update(step);c.state.apply(c.instance);c.instance.updateWorldTransform();ctx.translate(x,y);ctx.scale(a.scale*a.flip,-a.scale);if(!combatRenderer){combatRenderer=new spine.canvas.SkeletonRenderer(ctx);combatRenderer.triangleRendering=true}if(ctx.globalAlpha>0)try{combatRenderer.draw(c.instance)}catch(e){if(!c.renderError){c.renderError=e.message;V().toast('Không tải được hình nhân vật.')}}ctx.restore()}else ctx.restore();
  if(a.hp>0){
   const head=a.moveStart&&a.moveMode==='skill'?c.instance?.findBone('head_04'):null;
   const barX=x-32,barY=Math.min(y-(a.visualHeight||175)-14,head?y-head.worldY*a.scale-45:Infinity);
   ctx.save();ctx.fillStyle='#382c28';ctx.strokeStyle='#715341';ctx.lineWidth=2;
   ctx.beginPath();ctx.roundRect(barX-2,barY-2,91,19,4);ctx.fill();ctx.stroke();
   const hp=V().readyImage(battleArt.hp),rage=V().readyImage(battleArt.rage);
   if(hp)ctx.drawImage(hp,barX,barY,87*Math.max(0,a.hp/a.maxHp),8);
   else{ctx.fillStyle='#4bdf49';ctx.fillRect(barX,barY,87*Math.max(0,a.hp/a.maxHp),8)}
   const energy=a.energy||0;
   if(rage&&energy>0)ctx.drawImage(rage,barX,barY+11,87*energy/100,4);
   ctx.font='bold 20px GameFont,sans-serif';ctx.textAlign='right';ctx.strokeStyle='#251d19';ctx.lineWidth=3;ctx.strokeText(a.level,barX-27,barY+13);ctx.fillStyle='#fff';ctx.fillText(a.level,barX-27,barY+13);
   const faction=V().readyImage(named('faction_'+(a.faction||'abyss')));if(faction)ctx.drawImage(faction,barX-25,barY-5,23,23);
   (a.statusEffects||[]).filter(effect=>effect.expiresTurn>=(displayBattle?.turn||b.turn)).forEach((effect,i)=>{const key=catalog.heroes.flatMap(h=>h.skills).find(s=>s.id===effect.skillId)?.assetKey,icon=V().readyImage(key);if(icon)ctx.drawImage(icon,barX+i*25,barY-30,23,23)});
   ctx.restore();
  }
 }
 if(combatRenderer)drawBattleEffects(ctx,dt);
 drawFloaters(ctx,now);
 return true;
}
function navigate(id){dialog.innerHTML='';return V().showScene(id)}
const allowed=new Set([1,7,9,10,12,13,21,24,28,34,37,40,53,1156,1404,1600,1700]);
window.GameRuntime={
 async boot(){document.body.classList.add('playing');scaled();
  try{battleReference=await fetch('battle-reference.json').then(r=>{if(!r.ok)throw Error('Không tải được tài nguyên chiến đấu.');return r.json()});catalog=await api('/api/catalog');document.querySelector('#toast')?.style.setProperty('--toast-art',`url('${assetSrc(named('bgr_toast'))}')`);catalog.items.forEach(item=>itemMap.set(item.id,item));window.TalentUI?.init(talentContext());window.ExcUI?.init(excContext());window.ArenaUI?.init(arenaContext());window.GuildUI?.init(guildUiContext());window.TthUI?.init(tthContext());await window.TthUI?.load().catch(()=>{});window.ArtifactUI?.init({infoHtml:item=>artifactInfoHtml(item),catalog:()=>catalog,player:()=>player,itemMap,assetSrc,assets:()=>V().assets(),named,img,escape,short,num,mutation,toast:m=>V().toast(m),rerender:()=>renderUi(),layer:()=>document.querySelector('#game-layer')});const f=Object.values(V().assets()).find(a=>a.name==='SVN-Titillium bold');const fontRef=await fetch('scenes/1.json').then(r=>r.json());const fontNode=V().allNodes(fontRef).find(n=>V().get(n,'Text')?.font);if(fontNode){const source=V().get(fontNode,'Text').font;const face=new FontFace('GameFont',`url(${JSON.stringify(source.src)})`);await face.load();document.fonts.add(face)}
   const response=await fetch('/api/auth/session',{credentials:'same-origin'});if(response.ok){const s=await response.json();player=s.player;selectCatalogHero();csrfToken=s.csrfToken;return{sceneId:player.battle?.status==='active'?9:13}}return{sceneId:1};
  }catch(e){bootError=e.message;return{sceneId:1}}
 },
 beforeScene(id){id=Number(id);if(!player)return 1;if(id===1)return 13;if(player.battle?.status==='active'&&id!==9){V().toast('Hãy hoàn thành trận hoặc chọn Rút lui.');return 9}if(!allowed.has(id))return 13;if(id===9&&!player.battle)return 28;return id},
 prepareScene(data){syncScene(data)},
 async onScene(data){currentScene=data.id;if(currentScene!==1156)window.ExcUI?.close();if(currentScene!==37){window.ArenaUI?.close();window.GuildUI?.close();window.TthUI?.close()}dialog.innerHTML='';window.MermaidUI?.close();island=null;document.querySelector('.mm-tags')?.remove();if(currentScene===1700){hide(data,'IconNoti','Warning18Plus');await prepareIsland(data)}if(currentScene!==7)heroAlbumOpen=false;if(currentScene===9)await setupBattle();else{clearTimeout(autoTimer);autoBattle=false;battleEffects=[];effectPool=[]}if([28,34].includes(currentScene)&&catalog)await CampaignUI.prepare(campaignContext());if(currentScene===37)prepareWorld(data);if(currentScene!==1600)beastDetail=null;if(currentScene===40)await prepareTower(data);if(currentScene===21)prepareForge(data);if(currentScene===10){await refreshEvents();prepareEvents(data)}if(currentScene===53)await prepareBeast(data);if(currentScene===1600)await prepareBeastBoss(data);if(currentScene===24)prepareSummon(data);renderUi()},
 render(ctx,dt){if(currentScene===1700&&island)updateIsland(dt);if(currentScene===9&&player?.battle)return drawBattle(ctx,dt);if([28,34].includes(currentScene)&&catalog)return CampaignUI.draw(campaignContext(),ctx,dt,currentScene===28);return false},
 handleHit(hit){if(!player)return true;if(window.DevilFruitUI?.isOpen()||window.PetUI?.isOpen())return true;if(activityHit(hit))return true;if(hit.node.homeHeroId){openHomeHero(hit.node.homeHeroId);return true}if(hit.name==='GroupAvatar'){profileDialog();return true}if(hit.name==='ButtonMail'){mailDialog();return true}if(currentScene===40&&towerHit(hit.name))return true;if(currentScene===1700&&mermaidHit(hit.name))return true;if(hit.name==='B_Mermaid'){navigate(1700);return true}if(currentScene===37&&['B_Arena','PointHandArena'].includes(hit.name)){window.ArenaUI.open();return true}if(currentScene===37&&hit.name==='B_Guild'){window.GuildUI.open();return true}if(currentScene===37&&hit.name.startsWith('B_TanTuHoang')){window.TthUI.open();return true}if(currentScene===21&&forgeHit(hit.name))return true;if(currentScene===10&&eventHit(hit.name))return true;if([53,1600].includes(currentScene)&&beastHit(hit))return true;if(currentScene===24&&summonHit(hit.name))return true;if(currentScene===1156&&hit.name==='ButtonBack'){navigate(7);return true}if(currentScene===7&&heroAlbumOpen&&hit.name==='ButtonBack'){heroAlbumOpen=false;rosterUi();return true}if(hit.name==='ButtonHelp'){modal('TƯỚNG',`<p class="item-description">Chọn hệ ở bên trái để lọc danh sách tướng. Chạm vào thẻ tướng để xem thuộc tính, nâng cấp, trang bị và kỹ năng.</p>`);return true}if(currentScene===1156&&['ButtonShare','ButtonNoLock'].includes(hit.name)){heroInfoDialog();return true}if(hit.node.hero||hit.name==='ClickArea'){heroTab='stats';navigate(1156);return true}const names={ButtonHeroes:7,ButtonHeroList:7,ButtonBag:12,ButtonItem:12,ButtonShop:1404,ButtonWorld:37,B_EventRaid:34,B_Tower:40,B_PlaceHolder2:53,ButtonCampaign:34,ButtonShip:34,ButtonSummon:24,ButtonScroll:1156,ButtonOrb:1156,ButtonForge:21,ButtonEvents:10,ButtonFuse:1156,ButtonAltar:1156,ButtonBack:13,ButtonClose:13};if(names[hit.name]){navigate(names[hit.name]);return true}if(hit.name==='ButtonLuckySpin'){openSpecial();return true}if(['ButtonRollcall','ButtonAddGold','ButtonAddGem'].includes(hit.name)){refreshEvents().then(dailyDialog);return true}if(['ClickBox','TagContent'].includes(hit.name)&&[13,36].includes(currentScene)){homeQuestTap();return true}if(hit.name==='ButtonAchievement'){achievementDialog();return true}if(hit.name==='ButtonQuest'){questDialog();return true}if(['GroupAvatar','ButtonChat'].includes(hit.name)){journalDialog();return true}V().toast(currentScene===37?'Tính năng này đang được phát triển.':'Hãy cùng Luffy khám phá hải trình.');return true},
 get player(){return player},get catalog(){return catalog},get battleBusy(){return battleBusy},get actors(){return actors},get effects(){return battleEffects},get shakes(){return battleShakes},get battleTime(){return battleTime},get battleSpeed(){return battleSpeed},get formationDraft(){return campaignSlots},navigate,
};
document.addEventListener('submit',async e=>{if(e.target.id!=='auth-form')return;e.preventDefault();if(busy)return;const form=e.target,error=$('#auth-error'),username=form.elements.username.value,password=form.elements.password.value;if(authMode==='register'&&password!==form.elements.confirm.value){error.textContent='Mật khẩu nhập lại không khớp.';return}busy=true;setBusy(true);error.textContent='';try{await api('/api/auth/'+authMode,{username,password});form.reset();bootError='';await navigate(13)}catch(err){error.textContent=err.message}finally{busy=false;setBusy(false)}});
document.addEventListener('input',e=>{if(e.target.id==='coin-count'){const box=document.querySelector('.coin-buy'),max=Number(box.dataset.max),value=Math.max(0,Math.min(max,Math.floor(Number(e.target.value)||0)));$('#coin-total').textContent=num(value*Number(box.dataset.price));const buy=box.querySelector('[data-action=coin-buy]');buy.disabled=!value;return}if(e.target.id==='item-search'){search=e.target.value;page=0;const start=e.target.selectionStart,toolsOpen=$('.bag-tools')?.open;inventoryUi(currentScene===1404);if(toolsOpen&&$('.bag-tools'))$('.bag-tools').open=true;const input=$('#item-search');input.focus();input.setSelectionRange(start,start)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')dialog.innerHTML='';if(e.key==='Enter'&&e.target.matches('.item-cell'))e.target.click()});
document.addEventListener('dragstart',e=>{const card=e.target.closest('.campaign-hero-card');if(card)e.dataTransfer.setData('text/plain',card.dataset.hero)});
document.addEventListener('dragover',e=>{if(e.target.closest('.campaign-slot'))e.preventDefault()});
document.addEventListener('drop',e=>{const slot=e.target.closest('.campaign-slot');if(!slot||!campaignSlots)return;e.preventDefault();campaignSelectedSlot=Number(slot.dataset.slot);editCampaignHero(e.dataTransfer.getData('text/plain'))});
document.addEventListener('click',async e=>{
 if(e.target.classList?.contains('bonus-popup')||e.target.classList?.contains('coin-buy')||e.target.classList?.contains('stone-popup')||e.target.classList?.contains('use-popup')){e.target.remove();return}
 if(e.target.classList?.contains('item-popup-shade')){dialog.innerHTML='';return}
 const button=e.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action;
 if(action==='auth-login'||action==='auth-register'){authMode=action==='auth-login'?'login':'register';bootError='';authUi();return}
 if(action==='close'){dialog.innerHTML='';return}
 if(!player)return;
 if(action==='campaign-map')return navigate(28);
 if(action==='tower')return navigate(40);
 if(action==='beast-back')return navigate(1600);if(action==='tth-back'){dialog.innerHTML='';return openTth(player.tth?.bossIndex)}if(action==='guild-back'){dialog.innerHTML='';return openGuild('boss')}if(action==='arena-back'){dialog.innerHTML='';const mode=arenaReturn||player.battle?.arena?.mode||'solo';return openArena(mode)}
 if(action==='sr-back')return srBack();
 if(action==='item-drop'){const panel=dialog.querySelector('.item-popup-drop');if(panel)panel.hidden=!panel.hidden;return}
 if(action==='item-drop-forge'){if(lastItem){forgeSlot=itemMap.get(lastItem).slot;forgeSelected[forgeSlot]=lastItem}return navigate(21)}
 if(action==='item-drop-world')return navigate(37);
 if(action==='shard-merge'){await mutation('/api/items/merge',{itemId:button.dataset.item});return}
 if(action==='checkin-claim'){const data=await mutation('/api/wallet/daily',{},{render:false});if(data){checkinDialog();syncMailDot(V().getScene());renderUi()}return}
 if(action==='event-pick'){eventSelected=button.dataset.event;renderUi();return}
 if(action==='event-stage'){const result=await mutation('/api/event/stage',{id:button.dataset.event,formation:player.formation?.slots},{render:false,message:false});if(result)await navigate(9);return}
 if(action==='event-buy'){await mutation('/api/event/buy',{id:button.dataset.event});return}
 if(action==='event-stage-info'){const e=catalog.events.find(x=>x.id===button.dataset.event),stage=e.stages[Number(button.dataset.index)];modal(`Cứ điểm ${Number(button.dataset.index)+1}`,`<div class="ev-pray-result">${stage.rewards.map(r=>eventTile(r)).join('')}</div>`);return}
 if(action==='event-back')return navigate(10);
 if(action==='abyss-back'){await navigate(1700);window.MermaidUI.openAbyss(mermaidContext());return}
 if(action.startsWith('mm-'))return window.MermaidUI.action(action,button,mermaidContext());
 if(action==='event-help'){modal('Không Gian Vỡ',`<p class="item-description">Mỗi trận tốn 1 Ống nhòm, dùng đội hình đã lưu. Thắng sẽ nhận quà và mở cứ điểm kế; thua hoặc rút lui mất Ống nhòm. Vượt hết 7 cứ điểm thì sang vòng mới với kẻ địch mạnh hơn. Làm mới ngày 1 hằng tháng.</p>`);return}
 if(['event-claim','event-exchange','event-free','event-rollcall'].includes(action)){const inside=!!dialog.querySelector('.sp-popup'),url={'event-claim':'/api/event/claim','event-exchange':'/api/event/exchange','event-free':'/api/event/free','event-rollcall':'/api/event/rollcall'}[action],body={id:button.dataset.event,...(button.dataset.index!==undefined?{index:Number(button.dataset.index)}:{}),...(action==='event-exchange'?{count:1}:{})},data=await mutation(url,body,inside?{close:false,render:false}:{});if(data&&inside)specialDialog();return}
 if(action==='event-spin'){await spinWheel(button.dataset.event,Number(button.dataset.count));return}
 if(action==='event-buy-open'){buyCoinDialog(button.dataset.event);return}
 if(action==='coin-cancel'){document.querySelector('.coin-buy')?.remove();return}
 if(action==='coin-step'){const box=document.querySelector('.coin-buy'),input=$('#coin-count'),max=Number(box.dataset.max);input.value=Math.max(max?1:0,Math.min(max,Number(input.value||0)+Number(button.dataset.step)));$('#coin-total').textContent=num(Number(input.value)*Number(box.dataset.price));return}
 if(action==='coin-buy'){const count=Number($('#coin-count').value);document.querySelector('.coin-buy')?.remove();const data=await mutation('/api/event/buy',{id:button.dataset.event,count},{close:false,render:false});if(data&&dialog.querySelector('.sp-popup'))specialDialog();return}
 if(action==='special-tab'){specialTab=button.dataset.event;specialDialog();return}
 if(action==='special-help'){const e=catalog.events.find(x=>x.id===button.dataset.event);V().toast(e.type==='wheel'?'Mỗi lượt quay tốn 1 Xu vòng quay, mỗi ngày nhận 1 Xu miễn phí ở ô giữa. Quay đủ mốc để nhận thêm quà.':e.type==='rollcall'?'Mỗi ngày đăng nhập nhận quà một hàng.':'Dùng Cỏ 4 lá và Xu vòng quay để đổi quà. Làm mới ngày 1 hằng tháng.');return}
 if(action==='event-pray'){await mutation('/api/event/pray',{id:button.dataset.event,count:Number(button.dataset.count)});return}
 if(action==='bonus-close'){document.querySelector('.bonus-popup')?.remove();return}
 if(action==='ach-close'){document.querySelector('.ach-popup')?.remove();return}
 if(action==='ach-tab'){achTab=button.dataset.tab;achievementDialog();return}
 if(action==='mst-hero'){masterySel=button.dataset.hero||null;achievementDialog();return}
 if(action==='mst-claim'){if(button.classList.contains('locked')){V().toast('Chưa hoàn thành nhiệm vụ.');return}const scroll=document.querySelector('.mst-scroll')?.scrollTop||0;const data=await mutation('/api/mastery/claim',{heroId:button.dataset.hero,quest:Number(button.dataset.quest)},{close:false});if(data){achievementDialog();const s=document.querySelector('.mst-scroll');if(s)s.scrollTop=scroll}return}
 if(action==='mst-milestone'){const mark=player.mastery?.milestones.find(x=>x.points===Number(button.dataset.points));if(!mark||mark.status===2)return;if(mark.status===0){V().toast('Chưa đủ điểm thông thạo.');return}const data=await mutation('/api/mastery/milestone',{points:mark.points},{close:false});if(data)achievementDialog();return}
 if(action==='ach-claim'){if(button.classList.contains('locked')){V().toast('Chưa hoàn thành thành tựu.');return}const scroll=document.querySelector('.ach-scroll')?.scrollTop||0;const data=await mutation('/api/achievement/claim',{id:button.dataset.id},{close:false});if(data){achievementDialog();const s=document.querySelector('.ach-scroll');if(s)s.scrollTop=scroll}return}
 if(action==='forge-go')return navigate(21);
 if(action==='summon-go')return navigate(24);
 if(action==='hero-go')return navigate(7);
 if(action==='dq-claim'){const data=await mutation('/api/daily-quest/claim',{id:button.dataset.quest},{close:false});if(data)questDialog();return}
 if(action==='dq-item'){const item=itemMap.get(button.dataset.item);if(item)V().toast(item.name+': '+(item.description||''));return}
 if(action==='dq-go'){dialog.innerHTML='';const go=button.dataset.go;
  if(go==='summon')return navigate(24);if(go==='arena')return openArena('solo');if(go==='forge')return navigate(21);if(go==='tower')return navigate(40);if(go==='beast')return navigate(1600);
  if(go==='mastery'){achievementDialog();return}if(go==='events'){openSpecial();return}
  if(go==='afk'){await navigate(28);V().toast('Bấm rương treo máy để thu thập thưởng.');return}return}
 if(action==='se-open'){if(sePick(button.dataset.slot)){seState={slot:button.dataset.slot,tab:'level'};seDialog()}return}
 if(action==='se-slot'){if(sePick(button.dataset.slot)){seState.slot=button.dataset.slot;seDialog()}return}
 if(action==='se-tab'){seState.tab=button.dataset.tab;seDialog();return}
 if(action==='se-close'){seState=null;dialog.innerHTML='';renderUi();return}
 if(action==='se-item'){const item=itemMap.get(button.dataset.item);if(item)V().toast(item.name+': '+(item.description||''));return}
 if(action==='se-upgrade'){const data=await mutation('/api/hero/special',{slot:button.dataset.slot,kind:button.dataset.kind},{close:false});if(data)seDialog();return}
 if(action==='stone-open'){stoneInfo();return}
 if(action==='use-open'){dialog.innerHTML='';useManyDialog(button.dataset.item);return}
 if(action==='stone-close'){document.querySelector('.stone-popup')?.remove();return}
 if(action==='stone-upgrade-open'){stoneUpgradeOpen();return}
 if(action==='stone-convert-open'){stoneConvertOpen();return}
 if(action==='stone-upgrade'){await stoneAction('/api/hero/stone/upgrade');return}
 if(action==='stone-convert'){await stoneAction('/api/hero/stone/convert');return}
 if(action==='use-close'){document.querySelector('.use-popup')?.remove();return}
 if(action==='use-step'){const box=document.querySelector('.use-popup'),input=$('#use-count'),max=Number(box.dataset.max);input.value=Math.max(1,Math.min(max,Number(input.value||0)+Number(button.dataset.step)));return}
 if(action==='use-many'){const box=document.querySelector('.use-popup'),max=Number(box.dataset.max),quantity=Math.max(1,Math.min(max,Math.floor(Number($('#use-count').value)||1)));box.remove();await mutation('/api/items/use',{itemId:button.dataset.item,quantity});return}
 if(action==='forge-pick'){forgeSelected[forgeSlot]=button.dataset.item;forgeCount=0;renderUi();return}
 if(action==='forge-info'){return itemDialog(button.dataset.item)}
 if(action==='beast-pick'){const id=button.dataset.hero,at=beastDraft.indexOf(id);if(at>=0)beastDraft.splice(at,1);else if(beastDraft.length<6)beastDraft.push(id);beastFormationDialog();return}
 if(action==='beast-attack')return attackBeast();
 if(action==='beast-claim'){await mutation('/api/beast/claim',{},{render:false});if(currentScene===53)navigate(53);return}
 if(action==='campaign-chapter'){const chapter=catalog.campaign.chapters.find(ch=>ch.id===Number(button.dataset.chapter));if(!chapter)return;campaignChapterId=chapter.id;campaignStageId=chapter.stageIds.includes(player.adventure.unlockedStage)?player.adventure.unlockedStage:chapter.stageIds[0];return navigate(34)}
 if(action==='campaign-locate'){campaignStageId=Math.min(player.adventure.unlockedStage,catalog.stages.length);campaignChapterId=catalog.stages[campaignStageId-1].chapter;CampaignUI.focus(campaignContext(),true);return}
 if(action==='campaign-team'){openCampaignTeam();return}
 if(action==='campaign-hero'){editCampaignHero(button.dataset.hero);return}
 if(action==='campaign-slot'){const position=Number(button.dataset.slot);if(campaignSlots?.[position]){removeCampaignHero(position);return}campaignSelectedSlot=campaignSelectedSlot===position?null:position;dialog.innerHTML=CampaignUI.formation(campaignContext());return}
 if(action==='campaign-save'){const result=await mutation('/api/formation',{slots:campaignSlots},{render:false});if(result){await CampaignUI.prepare(campaignContext());renderUi()}return}
 if(action==='campaign-filter'){campaignFilter=campaignFilter?null:catalog.hero.faction;dialog.innerHTML=CampaignUI.formation(campaignContext());return}
 if(action==='campaign-rewards'){modal('Phần thưởng',CampaignUI.rewards(campaignContext()));return}
 if(action==='campaign-afk'){if(!player.afk||!catalog.economy.afk){V().toast('Rương chưa sẵn sàng. Hãy khởi động lại server.');return}dialog.innerHTML=CampaignUI.afk(campaignContext());return}
 if(action==='campaign-afk-claim'){if(await mutation('/api/adventure/afk-claim'))CampaignUI.openChest();return}
 if(action==='campaign-help'){modal('Chiến dịch','<p class="item-description">Chọn đảo trên bản đồ, chọn ải rồi bấm Vượt ải. Trong bảng Đội hình, chọn tướng đang sở hữu và vị trí hàng trước hoặc hàng sau trước khi Chiến đấu. Thắng ải sẽ nhận phần thưởng và mở ải tiếp theo; các ải khóa hiển thị cấp yêu cầu. Sau khi qua ải, thuyền viên tự động đánh và tích vàng, kinh nghiệm, Đá EXP vào rương trên boong theo ải cao nhất đã qua. Rương đầy sau 10 tiếng nên hãy ghé nhận định kỳ.</p>');return}
 if(action==='campaign-ship'){V().toast('Bạn chưa sở hữu chiến hạm.');return}
 if(action==='profile'){profileDialog();return}
 if(action==='mail'){mailDialog();return}
 if(action==='profile-edit'){modal('SỬA TÊN THUYỀN TRƯỞNG','<label for="profile-name">Tên hiển thị</label><input id="profile-name" maxlength="24" minlength="3" value="'+escape(player.displayName)+'"><div class="modal-actions"><button data-action="profile">Trở lại</button><button class="green" data-action="profile-save" data-submit>Lưu</button></div>');return}
 if(action==='profile-save'){const profile=player.profile;const data=await mutation('/api/profile',{displayName:$('#profile-name').value},{render:false});if(data){player.profile=data.player.profile||profile;profileDialog();refreshCanvas()}return}
 if(action==='server-info'){modal('MÁY CHỦ','<p class="item-description">Máy chủ cục bộ đang hoạt động. Tài khoản và tiến trình được lưu tại máy chủ này.</p><div class="modal-actions"><button data-action="profile">Trở lại</button></div>');return}
 if(action==='audio-toggle'){const id=button.dataset.audio;if(!['sound','music'].includes(id))return;audioSettings[id]=!audioSettings[id];localStorage.setItem('htps_'+id,audioSettings[id]?'on':'off');for(const audio of document.querySelectorAll('audio[data-channel="'+id+'"]'))audio.muted=!audioSettings[id];profileDialog();return}
 if(action==='equip-best'){await equipBatch();return}
 if(action==='unequip-all'){await equipBatch(true);return}
 if(action==='gear-pick'){inventoryTab=button.dataset.slot==='accessory'?'artifact':'equipment';dictionary=false;search='';return navigate(12)}
 if(action==='star-material'){itemDialog(Object.keys(player.costs.star.items)[0]);return}
 if(action==='mail-select'){mailSelection=button.dataset.mail;mailDialog();return}
 if(action==='mail-open'){const data=await mutation('/api/mail/claim',{id:button.dataset.mail},{render:false});if(data)mailDialog();return}
 if(action==='mail-claim-all'){if(player.mail?.some(m=>!m.claimedAt))await mutation('/api/mail/claim',{all:true},{render:false});mailDialog();return}
 if(action==='mail-delete'&&button.dataset.mail?.startsWith('m:')){const id=button.dataset.mail.slice(2),data=await mutation('/api/mail/delete',{id},{render:false});if(data)mailDialog();return}
 if(action==='mail-delete-all'&&player.mail?.some(m=>m.claimedAt))await mutation('/api/mail/delete',{all:true},{render:false});
 if(action==='mail-delete'||action==='mail-delete-all'){const context=referenceContext(),claimed=player.adventure.lastDaily===context.day,ids=action==='mail-delete-all'?['journey',...(claimed?['daily:'+context.day]:[])]:[button.dataset.mail==='daily'?'daily:'+context.day:button.dataset.mail];if(ids.includes('daily:'+context.day)&&!claimed){V().toast('Hãy nhận quà trước khi xóa thư.');return}localStorage.setItem('htps_mail_'+(player.profile?.username||player.displayName),JSON.stringify([...new Set([...context.deletedMail,...ids])]));mailDialog();return}
 if(action==='mail-reward')return;
 if(action==='home')return navigate(currentScene===28?37:13);
 if(action==='hero'){if(button.dataset.hero&&button.dataset.hero!==player.hero.id){const result=await mutation('/api/hero/select',{heroId:button.dataset.hero},{render:false});if(!result)return}heroTab='stats';return navigate(1156)}
 if(action==='inventory'){dictionary=false;inventoryTab='equipment';page=0;search='';return navigate(12)}
 if(action==='shop'){page=0;search='';return navigate(1404)}
 if(action==='adventure'){campaignStageId=Math.min(player.adventure.unlockedStage,catalog.stages.length);campaignChapterId=catalog.stages[campaignStageId-1].chapter;return navigate(34)}
 if(action==='hero-tab'){dialog.innerHTML='';heroTab=button.dataset.tab;heroUi();return}
 if(action==='hero-sort'){heroSort=(heroSort+1)%heroSorts.length;V().toast('Sắp xếp theo '+heroSorts[heroSort][1]+'.');rosterUi();return}
 if(action==='hero-album'){heroAlbumOpen=true;rosterUi();return}
 if(action==='chest-view'){chestChoice=null;await chestDialog(button.dataset.item);return}
 if(action==='chest-pick'){const list=dialog.querySelector('.choice-grid'),top=list?.scrollTop||0;chestChoice={itemId:button.dataset.item,index:Number(button.dataset.index)};await chestDialog(button.dataset.item);const next=dialog.querySelector('.choice-grid');if(next)next.scrollTop=top;return}
 if(action==='chest-confirm'){await openChest(chestChoice.itemId,{index:chestChoice.index});return}
 if(action==='chest-open'){await openChest(button.dataset.item,{count:Number(button.dataset.count)});return}
 if(action==='item-choice'){heroChoice={itemId:button.dataset.item,avatar:null};heroChoiceDialog();return}
 if(action==='choice-hero'){const list=dialog.querySelector('.choice-grid'),top=list?.scrollTop||0;heroChoice.avatar=button.dataset.avatar;heroChoiceDialog();const next=dialog.querySelector('.choice-grid');if(next)next.scrollTop=top;return}
 if(action==='choice-confirm'){await mutation('/api/items/choose',{itemId:heroChoice.itemId,avatar:heroChoice.avatar});return}
 if(action==='album-hero'){await openHeroProfile(button.dataset.avatar);return}
 if(action==='profile-skill'){await openHeroProfile(button.dataset.avatar,Number(button.dataset.index));return}
 if(action==='hero-faction'){heroFaction=heroFaction===button.dataset.faction?null:button.dataset.faction;rosterUi();return}
 if(action==='hero-info'){heroInfoDialog();return}
 if(action==='hero-skill'){heroSkillDialog(button.dataset.skill);return}
 if(action==='upgrade-many'){await upgradeTen();return}
 if(action==='inventory-tab'){if(button.dataset.shop==='true')shopTab=button.dataset.tab;else inventoryTab=button.dataset.tab;page=0;inventoryUi(currentScene===1404);return}
 if(action==='dictionary'){dictionary=!dictionary;page=0;inventoryUi();return}
 if(action==='page'){page=Math.max(0,page+Number(button.dataset.delta));inventoryUi(currentScene===1404);return}
 if(action==='item'||action==='shop-item'){itemDialog(button.dataset.item,action==='shop-item');return}
 if(action==='stage'){stageDialog(Number(button.dataset.id));return}
 if(action==='journal'){journalDialog();return}
 if(action==='use'){await mutation('/api/items/use',{itemId:button.dataset.item,quantity:1});return}
 if(action==='sell'){await mutation('/api/items/sell',{itemId:button.dataset.item,quantity:1});return}
 if(action==='equip'){await mutation('/api/hero/equip',{itemId:button.dataset.item});return}
 if(action==='unequip'){await mutation('/api/hero/unequip',{slot:button.dataset.slot});return}
 if(action==='talent-open'){window.TalentUI.open();return}
 if(action==='artifact-upgrade'){dialog.innerHTML='';window.ArtifactUI.open(button.dataset.target);return}
 if(action==='upgrade'){const result=await mutation('/api/hero/upgrade',{type:button.dataset.type,...(button.dataset.skill?{skillId:button.dataset.skill}:{})});if(result&&currentScene===1156)heroUi();return}
 if(action==='battle-start'){const result=await mutation('/api/adventure/start',{stageId:Number(button.dataset.id),formation:campaignSlots||player.formation.slots},{render:false});if(result)await navigate(9);return}
 if(action==='battle-hero'){battleMenuHeroId=button.dataset.unit;battleUi();return}
 if(action==='battle-menu'){battleMenuOpen=!battleMenuOpen;battleUi();return}
 if(action==='battle-skip'){if(!battleBusy&&player.battle.status!=='active')return;skipBattleAnimations=true;autoBattle=true;battleMenuOpen=false;clearTimeout(autoTimer);battleUi();if(!battleBusy)fight('auto');return}
 if(action==='auto'||action==='battle-resume'){dialog.innerHTML='';skipBattleAnimations=false;autoBattle=action==='battle-resume'||!autoBattle;battleUi();scheduleBattleTurn(0);return}
 if(action==='speed'){battleSpeed=battleSpeed===1?2:1;battleUi();return}
 if(action==='battle-log'){modal('DIỄN BIẾN TRẬN ĐẤU',`<div class="journal">${battleLines.map(line=>`<p>${escape(line)}</p>`).join('')||'<p>Trận đấu vừa bắt đầu.</p>'}</div>`);return}
 if(action==='battle-exit'){clearTimeout(autoTimer);autoBattle=false;battleUi();while(battleBusy)await new Promise(resolve=>setTimeout(resolve,50));if(player.battle.status!=='active')return;modal('RÚT LUI?',`<p class="item-description">Rút khỏi trận sẽ không nhận thưởng.</p><div class="modal-actions"><button data-action="battle-resume">Tiếp tục chiến đấu</button><button class="red" data-action="battle-leave" data-submit>Rút lui</button></div>`);return}
 if(action==='battle-leave'){clearTimeout(autoTimer);autoBattle=false;const fought=player.battle,result=await mutation('/api/battle/leave');if(result&&fought?.silent){srReturn={diff:fought.silent.diff,tab:fought.silent.target};await srBack();return}if(result)await navigate(fought?.abyss?1700:fought?.broken?10:fought?.tower?40:fought?.beast?1600:34);return}
 if(action==='logout'){if(busy||battleBusy)return;busy=true;try{await api('/api/auth/logout',{});player=null;csrfToken='';authMode='login';clearTimeout(autoTimer);autoBattle=false;dialog.innerHTML='';await navigate(1)}catch(err){V().toast(err.message)}finally{busy=false}return}
});
V().canvas.addEventListener('click',e=>{if(currentScene!==9)return;const r=V().canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1136,y=(e.clientY-r.top)/r.height*640;const target=actors.find(a=>a.side==='enemy'&&a.hp>0&&Math.abs(a.x-x)<70&&y>a.y-210&&y<a.y+30);if(target){selectedTarget=target.id;V().toast('Mục tiêu: '+target.name)}});
})();
