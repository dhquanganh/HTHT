/* Bảo vật theo prefab gốc:
 *   - ItemArtifactUI: ImageFrame (frame_item), Mask (mask_item) chứa ImageBgr bgr_equipment_<phẩm> và ImageItem, ImageBorder
 *     border_equipment_<phẩm>, cột ItemStar (item_star) bên trái, TextNumber góc dưới. Bảo vật đỏ bật SpineBoder
 *     (Spine Item_effect "Loop", đã nướng thành dải ảnh item-effect-strip.webp như trang bị).
 *   - PopupUpgradeArtifact (scene 1264) dựng nguyên prefab bằng PrefabDOM: hai ô bảo vật hiện tại -> sau khi nâng,
 *     thanh EXP "a/b" theo db_artifact_upgrade_data, 8 ô SlotArtifactMaterial, danh sách bảo vật trong túi bên phải.
 *     Chạm bảo vật bên phải để thêm nguyên liệu, chạm ô nguyên liệu để bỏ, Nâng cấp gọi /api/artifact/upgrade.
 */
(()=>{
 'use strict';
 const D=window.PrefabDOM,W=1136,H=640,variant=/^(artifact:\d+)@(\d+):(\d+)$/;
 let c=null,scene=null,loading=null,root=null,target=null,picked=[];
 const cfg=()=>c.catalog().artifactUpgrade;
 const quality=item=>Math.max(1,Math.min(6,item.tier||1));
 const find=(el,p)=>el&&D.find(el,p);
 const text=(el,t)=>D.setText(el,t,false);

 /** Ô ItemArtifactUI. */
 function cell(item,{qty=null,cls='',attrs=''}={}){
  const q=quality(item),f=cfg()?.frames||{},stars=Math.max(1,item.stars||1);
  return `<span class="aui q${q} ${cls}" ${attrs}>${c.img(c.named('frame_item'),'aui-frame')}<span class="aui-mask" style="--mask:url('${c.assetSrc(c.named('mask_item'))}')">${c.img(f.bgr_equipment?.[q],'aui-bgr')}${c.img(item.assetKey,'aui-item',item.name)}</span>${c.img(f.border_equipment?.[q],'aui-border')}<span class="aui-stars">${c.img(c.named('item_star')).repeat(stars)}</span>${sparkles(item)?'<span class="item-sparkle aui-sparkle"></span>':''}${qty!==null?`<span class="aui-qty">${c.short(qty)}</span>`:''}</span>`;
 }
 const sparkles=item=>item.category==='artifact'&&quality(item)>=6;

 // ---- Luật nâng cấp (cùng server/artifact-upgrade.mjs) để xem trước.
 const row=item=>cfg().upgrade[String(item.tier)]||cfg().upgrade['1'];
 const baseOf=item=>item.variantOf?c.itemMap.get(item.variantOf):item;
 const maxStars=item=>Math.min(row(item).maxStar,baseOf(item).levels?.length||1);
 const materialValue=item=>row(item).baseValue+((item.stars||1)-1)*row(item).upgradeCost+(item.artifactExp||0);
 function preview(item,gain){
  const r=row(item),max=maxStars(item);let stars=item.stars||1,exp=(item.artifactExp||0)+gain;
  while(stars<max&&exp>=r.upgradeCost){exp-=r.upgradeCost;stars++}
  if(stars>=max)exp=0;
  const base=baseOf(item);return stars<=1&&!exp?base:c.itemMap.get(`${base.id}@${stars}:${exp}`);
 }

 // ---- Popup nâng cấp
 const load=()=>scene?Promise.resolve(scene):loading??=fetch('scenes/1264.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(s=>scene=s,e=>{loading=null;throw e});
 const currentKey=()=>target==='equipped'?c.player().hero.equipment.accessory:target;
 const owned=()=>{const inv=c.player().inventory,key=currentKey(),out=[];
  for(const [id,count] of Object.entries(inv)){const item=c.itemMap.get(id);if(item?.category!=='artifact')continue;const left=count-(target!=='equipped'&&id===key?1:0)-picked.filter(x=>x===id).length;if(count-(target!=='equipped'&&id===key?1:0)>0)out.push({id,item,left})}
  return out.sort((a,b)=>(b.item.tier||0)-(a.item.tier||0)||(b.item.stars||1)-(a.item.stars||1)||a.item.name.localeCompare(b.item.name))};
 function fill(){
  if(!root?.isConnected)return;const item=c.itemMap.get(currentKey());if(!item){close();return}
  const gain=picked.reduce((n,id)=>n+materialValue(c.itemMap.get(id)),0),next=preview(item,gain),max=(item.stars||1)>=maxStars(item),cost=row(item).upgradeCost;
  const up=find(root,'BoxUpgrade');
  text(find(up,'BoardTitle/TextTitle'),'Nâng cấp bảo vật');
  find(up,'ItemArtifactUI1').innerHTML=cell(item);find(up,'ItemArtifactUI2').innerHTML=cell(max?item:next||item);
  const have=(item.artifactExp||0)+gain,slider=find(up,'SliderMaterial'),bar=find(slider,'Background'),area=find(slider,'Fill Area'),fillEl=find(area,'Fill');
  // Slider của Unity tự co Fill theo giá trị; ở đây Fill Area trùng nền thanh và Fill rộng theo % EXP.
  Object.assign(area.style,{left:bar.style.left,top:bar.style.top,width:bar.style.width,height:bar.style.height});
  Object.assign(fillEl.style,{left:'0',top:'0',height:'100%',width:(max?100:Math.min(100,have/cost*100))+'%'});
  text(find(up,'SliderMaterial/TextMatterialFill'),max?'Tối đa':`${have}/${cost}`);
  text(find(up,'ButtonUpgrade/Text'),'Nâng cấp');find(up,'ButtonUpgrade').classList.toggle('aui-disabled',max);
  text(find(up,'BoxMaterialSlots/TextMaterial'),'Nguyên liệu');
  for(let i=1;i<=cfg().materialSlots;i++){const slot=find(up,'BoxMaterialSlots/SlotArtifactMaterial'+i);if(!slot)continue;const host=find(slot,'ItemArtifactUI'),id=picked[i-1];
   D.show(host,!!id);host.innerHTML=id?cell(c.itemMap.get(id)):'';slot.dataset.slot=i-1}
  const box=find(root,'BoxArtifacts');text(find(box,'TextTitle'),'Nguyên liệu');
  const content=find(box,'ScrollArtifact/Viewport/Content'),list=owned();
  content.classList.add('aui-grid');content.innerHTML=list.length?list.map(({id,item,left})=>`<button class="artifact-material ${left<=0?'used':''}" data-item="${c.escape(id)}" aria-label="${c.escape(item.name)} ${item.stars||1} sao, còn ${left}">${cell(item,{qty:left})}</button>`).join(''):'<p class="aui-empty">Túi không còn bảo vật để làm nguyên liệu.</p>';
 }
 // Chạm bảo vật (ô hiện tại / sau khi nâng / ô nguyên liệu đã chọn) mở PopupItemInfo chỉ đọc, bật lên như bản gốc.
 function info(item){
  root.querySelector('.aui-info')?.remove();if(!item)return;
  const el=document.createElement('div');el.className='aui-info';el.innerHTML=`<div class="aui-info-shade"></div>${c.infoHtml(item)}`;root.appendChild(el);
  el.addEventListener('click',ev=>{ev.stopPropagation();el.classList.add('closing');setTimeout(()=>el.remove(),140)});
 }
 async function onClick(e){
  if(e.target.closest('[data-name="ButtonClose"]'))return close();
  const shown=e.target.closest('[data-name="ItemArtifactUI1"],[data-name="ItemArtifactUI2"]');
  if(shown){const item=c.itemMap.get(currentKey()),gain=picked.reduce((n,id)=>n+materialValue(c.itemMap.get(id)),0);
   return info(shown.dataset.name==='ItemArtifactUI1'||(item.stars||1)>=maxStars(item)?item:preview(item,gain)||item)}
  const material=e.target.closest('.artifact-material');
  if(material){const item=c.itemMap.get(currentKey()),id=material.dataset.item,left=owned().find(x=>x.id===id)?.left||0;
   if((item.stars||1)>=maxStars(item))return c.toast('Bảo vật đã đạt sao tối đa.');
   if(left<=0)return;if(picked.length>=cfg().materialSlots)return c.toast(`Tối đa ${cfg().materialSlots} nguyên liệu.`);
   picked.push(id);return fill()}
  const slot=e.target.closest('[data-name^="SlotArtifactMaterial"]');if(slot&&picked[Number(slot.dataset.slot)]){picked.splice(Number(slot.dataset.slot),1);return fill()}
  if(e.target.closest('[data-name="ButtonUpgrade"]')){
   const item=c.itemMap.get(currentKey());if((item.stars||1)>=maxStars(item))return c.toast('Bảo vật đã đạt sao tối đa.');
   if(!picked.length)return c.toast('Hãy chọn bảo vật làm nguyên liệu.');
   const materials={};for(const id of picked)materials[id]=(materials[id]||0)+1;
   const before=item.stars||1,r=await c.mutation('/api/artifact/upgrade',{target,materials},{close:false,render:false});
   if(!r)return;if(target!=='equipped')target=r.result.itemId;picked=[];c.rerender();fill();
   if((r.result.stars||1)>before){const cellEl=find(root,'BoxUpgrade/ItemArtifactUI1');cellEl.classList.remove('aui-flash');void cellEl.offsetWidth;cellEl.classList.add('aui-flash')}
  }
 }
 async function open(key){
  close();target=key;picked=[];try{await load()}catch{c.toast('Không tải được giao diện nâng cấp bảo vật.');return}
  root=D.render(scene.roots[0],W,H,{assetSrc:c.assetSrc,assets:c.assets()});root.classList.add('artifact-upgrade');c.layer().appendChild(root);
  root.addEventListener('click',onClick);fill();
 }
 function close(){root?.remove();root=null}
 window.ArtifactUI={init:ctx=>{c=ctx},cell,sparkles,open,close,refresh:fill,maxStars:item=>maxStars(item),isMax:item=>(item.stars||1)>=maxStars(item)};
})();
