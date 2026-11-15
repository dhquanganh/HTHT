/* Hiệu ứng chiêu mộ theo asset gốc:
 *   1. SummonScrollScene/EffectBeer: Spine Fx_beer, hoạt ảnh "Cast" (thùng bia bật nắp) phủ giữa màn hình.
 *   2. PopupSummonHeroes: lần lượt từng tướng nhận được — ảnh lớn của tướng (Hero/Image, heroart), Spine bậc "Ranking"
 *      (D / C / B / A / S / SS), Spine hệ "Class" (D rừng xanh, I hắc ám, P ánh sáng, S vực thẳm, V bóng tối, A pháo đài),
 *      sao, tên, hạt sáng "Summoning_partical". Chạm để xem tướng tiếp theo; nút quay lại bỏ qua phần còn lại.
 * Gọi: await window.SummonFx.play(heroes, ctx) rồi mới hiện bảng kết quả. */
(()=>{
 'use strict';
 const D=window.PrefabDOM;let scenes=null;
 const rankAnim={1:'D',2:'C',3:'B',4:'A',5:'S',6:'SS',7:'SSR'};
 const factionAnim={forest:'D',dark:'I',light:'P',abyss:'S',shadow:'V',fortress:'A'};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 async function load(){return scenes??=Promise.all([26,1256].map(id=>fetch(`scenes/${id}.json`).then(r=>r.json())))}
 function findNode(root,name){if(root.name===name)return root;for(const c of root.children||[]){const f=findNode(c,name);if(f)return f}return null}
 const skeletonOf=(node)=>(node?.components||[]).find(c=>c.type==='SkeletonGraphic')?.skeleton;
 function spineAt(host,ctx,skeleton,anim,{w=400,h=400,scale=1,loop=true,onEnd=null,cls='sfx-spine'}={}){
  if(!host||!skeleton)return null;const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.className=cls;host.appendChild(cv);ctx.spine(cv,{skeleton,animation:anim},{loop,scale,onEnd});return cv;
 }
 /** 1. Thùng bia bật nắp. */
 async function beer(ctx,layer){
  const [scroll]=await load(),node=findNode(scroll.roots?.[0]||scroll,'EffectBeer')||(scroll.roots||[]).map(r=>findNode(r,'EffectBeer')).find(Boolean),sk=skeletonOf(findNode(node,'Spine'));
  if(!sk)return;const box=document.createElement('div');box.className='sfx-beer';layer.appendChild(box);
  await new Promise(res=>{spineAt(box,ctx,sk,'Cast',{w:1136,h:640,scale:1,loop:false,onEnd:res,cls:'sfx-beer-spine'});setTimeout(res,1600)});
  box.classList.add('out');await wait(180);box.remove();
 }
 /** 2. Lần lượt từng tướng. Trả về khi xem hết hoặc bỏ qua. */
 async function reveal(heroes,ctx,layer){
  const [,popup]=await load(),prefab=popup.roots?.[0]||popup;
  const sk={rank:skeletonOf(findNode(prefab,'SpineRank')?.children?.[0]),faction:skeletonOf(findNode(prefab,'SpineFaction')?.children?.[0]),particle:skeletonOf(findNode(prefab,'Partical'))};
  for(let i=0;i<heroes.length;i++){
   const r=heroes[i],h=ctx.album(r.avatar),def=ctx.def(r.avatar);if(!h)continue;
   const el=D.render(prefab,1136,640,{assetSrc:ctx.assetSrc,assets:ctx.assets()});el.classList.add('sfx-popup');layer.appendChild(el);
   const f=p=>D.find(el,p);
   D.show(f('Hero2'),false);
   const art=f('Hero/Image');if(art){art.querySelector(':scope>.pd-image')?.remove();art.innerHTML=`<img class="sfx-art" src="${ctx.assetSrc(def?.visual?.art||h.card)}" alt="">`;art.style.backgroundImage='none'}
   D.setText(f('Image/TextHeroName'),h.name,false);
   // Sao: tướng mới chiêu mộ (1 sao với bậc thấp, số sao khởi điểm theo bậc như thẻ tướng).
   const stars=r.stars||Math.max(1,Math.min(5,h.rank-1));const g=f('Image/HeroStars/GroupStar1');if(g)[...g.children].forEach((s,k)=>D.show(s,k<stars));
   for(const [name,key,anim,opts] of [['Image/SpineRank/Skeleton','rank',rankAnim[h.rank]||'A',{w:360,h:220,scale:.9}],['Image/SpineFaction/Skeleton','faction',factionAnim[h.faction]||'A',{w:220,h:220,scale:.8}]])
    spineAt(f(name),ctx,sk[key],anim,{...opts,cls:'sfx-spine'});
   spineAt(f('Partical'),ctx,sk.particle,'Partical1',{w:900,h:700,scale:1,cls:'sfx-particle'});
   if(r.fresh||r.shardItem){const tag=document.createElement('span');tag.className='sfx-tag';tag.textContent=r.shardItem?`${r.shards} mảnh`:'Mới';(f('Image')||el).appendChild(tag)}
   const count=document.createElement('span');count.className='sfx-count';count.textContent=`${i+1}/${heroes.length}`;el.appendChild(count);
   const hint=document.createElement('span');hint.className='sfx-hint';hint.textContent=i<heroes.length-1?'Chạm để xem tiếp':'Chạm để xem kết quả';el.appendChild(hint);
   const action=await new Promise(res=>{el.addEventListener('click',e=>{e.stopPropagation();res(e.target.closest('[data-name="ButtonBack"]')?'skip':'next')})});
   el.classList.add('out');await wait(150);el.remove();if(action==='skip')break;
  }
 }
 async function play(heroes,ctx){
  const layer=ctx.layer();const cover=document.createElement('div');cover.className='sfx-root';layer.appendChild(cover);
  try{await beer(ctx,cover);await reveal(heroes,ctx,cover)}catch(e){console.warn('summon fx',e)}finally{cover.remove()}
 }
 window.SummonFx={play,load};
})();
