/* Sprite sheet → Spine 3.8 (JSON + atlas) cho nhân vật tạo ở trang quản trị (tab "Tạo nhân vật").
 * Dùng chung: máy chủ (server/custom-heroes.mjs) sinh tệp phục vụ cho game, trang quản trị dùng để xem trước.
 * Nhờ vậy nhân vật mới chạy đúng đường Spine như tướng gốc: loadSkeleton, SkeletonRenderer, findAnimation, getBounds…
 *
 *   anim = {
 *     sheets:[{art,w,h}],                       ảnh sheet đã xoá nền (art = mã ảnh tải lên)
 *     frames:[{id,s,x,y,w,h,ax,ay}],            khung trên sheet s; (ax,ay) = điểm chân (gốc toạ độ nhân vật)
 *     scale, mirror,                            px sheet → đơn vị Spine; lật ngang nếu sheet quay mặt sang trái
 *     animations:{idling|beat|skill|damage|dead|win|run:{fps,frames:[{f,d,dx,dy}],hit}},
 *     effects:[{name,fps,scale,additive,frames:[{f,d,dx,dy}]}]
 *   }
 *   Hiệu ứng căn theo tâm khung (đặt ở mục tiêu / người ra đòn / giữa sân), thân nhân vật căn theo điểm chân.
 *   d = số nhịp (mỗi nhịp 1/fps giây), dx/dy = lệch thêm theo px màn hình (dy dương = xuống).
 */
(function(root){
 'use strict';
 const ANIMS=['idling','beat','skill','damage','dead','win','run'];
 // Hoạt ảnh thiếu: dùng hoạt ảnh gần nghĩa nhất (bị đánh / chết / thắng / chạy đều có thể bỏ trống).
 const FALLBACK={damage:['idling'],dead:['damage','idling'],win:['idling'],run:['idling'],beat:['idling'],skill:['beat','idling']};
 const r2=v=>Math.round(v*100)/100;
 function framesOf(anim,name){
  const own=anim.animations?.[name];if(own?.frames?.length)return own;
  for(const alt of FALLBACK[name]||[]){const a=anim.animations?.[alt];if(a?.frames?.length)return a}
  return null;
 }
 /** Thời lượng (giây) tới khung `index` của một hoạt ảnh. */
 function timeAt(a,index){const fps=Math.max(1,a.fps||10);let t=0;for(let i=0;i<Math.min(index,a.frames.length);i++)t+=Math.max(1,a.frames[i].d||1)/fps;return t}
 function duration(a){return timeAt(a,a.frames.length)}
 /** Spine JSON + atlas cho một chuỗi hoạt ảnh trên một slot. `pages(i)` = tên trang atlas của sheet i. */
 function build(anim,list,{slot='body',pages=i=>'sheet'+i+'.png',blend=null,scale=anim.scale||1,mirror=!!anim.mirror,center=false}={}){
  const byId=new Map(anim.frames.map(f=>[f.id,f])),used=new Set(),attachments={};
  const nameOf=(fr,dx,dy)=>{const f=byId.get(fr.f);if(!f)return null;const key=`f${f.id}_${Math.round(dx)}_${Math.round(dy)}`;used.add(f.id);
   if(!attachments[key]){const cx=center?0:f.x+f.w/2-f.ax,cy=center?0:f.y+f.h/2-f.ay,sx=mirror?-1:1;
    attachments[key]={name:'f'+f.id,x:r2(((mirror?-cx:cx)+dx)*scale),y:r2(-(cy+dy)*scale),scaleX:sx*scale,scaleY:scale,width:f.w,height:f.h}}
   return key};
  const animations={};let setup=null;
  for(const [name,a] of list){
   if(!a?.frames?.length)continue;const fps=Math.max(1,a.fps||10),keys=[];let t=0;
   for(const fr of a.frames){const n=nameOf(fr,fr.dx||0,fr.dy||0);if(!n)continue;keys.push({time:r2(t),name:n});t+=Math.max(1,fr.d||1)/fps}
   if(!keys.length)continue;setup??=keys[0].name;
   keys.push({time:r2(t),name:keys.at(-1).name});
   animations[name]={slots:{[slot]:{attachment:keys}}};
  }
  const json={skeleton:{spine:'3.8.99',width:0,height:0,fps:30,images:'',audio:''},bones:[{name:'root'}],slots:[{name:slot,bone:'root',attachment:setup,...(blend?{blend}:{})}],skins:[{name:'default',attachments:{[slot]:attachments}}],animations};
  // Atlas libgdx: mỗi sheet một trang, mỗi khung một vùng (trang mở đầu bằng dòng trống như atlas gốc).
  let atlas='';
  anim.sheets.forEach((s,i)=>{const regions=anim.frames.filter(f=>f.s===i&&used.has(f.id));if(!regions.length)return;
   atlas+=`\n${pages(i)}\nsize: ${s.w},${s.h}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n`;
   for(const f of regions)atlas+=`f${f.id}\n  rotate: false\n  xy: ${f.x}, ${f.y}\n  size: ${f.w}, ${f.h}\n  orig: ${f.w}, ${f.h}\n  offset: 0, 0\n  index: -1\n`});
  const pagesUsed=anim.sheets.map((_,i)=>i).filter(i=>anim.frames.some(f=>f.s===i&&used.has(f.id)));
  return{json,atlas,pages:pagesUsed};
 }
 /** Skeleton thân nhân vật: idling, beat, skill, damage, dead, win, run (thiếu thì mượn hoạt ảnh gần nghĩa). */
 function body(anim,opts={}){return build(anim,ANIMS.map(n=>[n,framesOf(anim,n)]),opts)}
 /** Skeleton một hiệu ứng: một hoạt ảnh "Hit", cộng sáng nếu `additive`. */
 function effect(anim,fx,opts={}){return build(anim,[['Hit',fx]],{slot:'fx',blend:fx.additive?'additive':null,scale:(fx.scale||1),mirror:!!anim.mirror,center:true,...opts})}
 /** Mốc trúng đòn (giây) của đánh thường / tuyệt kỹ: tới khung đánh dấu `hit`, mặc định 60% hoạt ảnh. */
 function hitTime(anim,name){const a=framesOf(anim,name);if(!a)return .4;const i=Number.isInteger(a.hit)&&a.hit>=0&&a.hit<a.frames.length?a.hit:Math.floor(a.frames.length*.6);return r2(Math.max(.05,timeAt(a,i)))}
 const api={ANIMS,FALLBACK,framesOf,timeAt,duration,build,body,effect,hitTime};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SpriteSpine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
