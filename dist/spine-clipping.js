/* Canvas support for the clipping attachments used by cached cinematic skills.
 * Also applies slot blend modes. Original Spine assets are kept intact; the bundled runtime has one
 * local UTF-8 fix in readString.
 */
(()=>{
 'use strict';
 const prototype=spine.canvas.SkeletonRenderer.prototype,baseDraw=prototype.drawTriangles;
 // Canvas 2D khử răng cưa từng vùng clip tam giác nên giữa các tam giác của mesh lộ đường kẻ mảnh (thấy rõ ở ảnh lớn như
 // "pet chieu mo"). Nới vùng clip ra ~0,6 px màn hình quanh trọng tâm, vẫn ánh xạ ảnh theo đỉnh gốc, để các tam giác phủ khít.
 const triangle=function(img,x0,y0,u0,v0,x1,y1,u1,v1,x2,y2,u2,v2){
  const ctx=this.ctx,m=ctx.getTransform(),scale=Math.sqrt(Math.abs(m.a*m.d-m.b*m.c))||1,grow=.6/scale;
  const cx=(x0+x1+x2)/3,cy=(y0+y1+y2)/3,out=(x,y)=>{const dx=x-cx,dy=y-cy,l=Math.hypot(dx,dy)||1;return[x+dx/l*grow,y+dy/l*grow]};
  const [p0,q0]=out(x0,y0),[p1,q1]=out(x1,y1),[p2,q2]=out(x2,y2);
  u0*=img.width;v0*=img.height;u1*=img.width;v1*=img.height;u2*=img.width;v2*=img.height;
  ctx.beginPath();ctx.moveTo(p0,q0);ctx.lineTo(p1,q1);ctx.lineTo(p2,q2);ctx.closePath();
  x1-=x0;y1-=y0;x2-=x0;y2-=y0;u1-=u0;v1-=v0;u2-=u0;v2-=v0;
  const det=1/(u1*v2-u2*v1),a=(v2*x1-v1*x2)*det,b=(v2*y1-v1*y2)*det,c=(u1*x2-u2*x1)*det,d=(u1*y2-u2*y1)*det,e=x0-a*u0-c*v0,f=y0-b*u0-d*v0;
  ctx.save();ctx.transform(a,b,c,d,e,f);ctx.clip();ctx.drawImage(img,0,0);ctx.restore();
 };
 // The canvas runtime reads each slot's blend mode but never applies it, so additive art shows its black box.
 const composite=new Map([[spine.BlendMode.Additive,'lighter'],[spine.BlendMode.Multiply,'multiply'],[spine.BlendMode.Screen,'screen']]);
 const draw=function(skeleton){
  const ctx=this.ctx,order=skeleton.drawOrder,previous=ctx.globalCompositeOperation;let start=0;
  try{
   while(start<order.length){
    const mode=order[start].data.blendMode;let end=start+1;while(end<order.length&&order[end].data.blendMode===mode)end++;
    ctx.globalCompositeOperation=composite.get(mode)||previous;skeleton.drawOrder=order.slice(start,end);baseDraw.call(this,skeleton);start=end;
   }
  }finally{skeleton.drawOrder=order;ctx.globalCompositeOperation=previous}
 };
 const visible=slot=>slot.bone.active&&slot.getAttachment()&&slot.color.a>0&&slot.getAttachment().color?.a!==0;
 // The canvas runtime only applies alpha; slot/attachment RGB tint is ignored, so effects tinted in Spine (Zoro Wano's
 // magenta roam_* sprites, for example) came out white. drawTriangles has already put skeleton*slot*attachment colour
 // in this.tempColor, so draw from a copy of the atlas page multiplied by that colour (alpha kept). Copies are cached
 // per page and colour (1/16 steps) in an LRU capped by pixels (~24M, about 96MB) so animated tints do not pile up.
 const tints=new Map(),pixelLimit=24e6,step=16,tintStats=spine.canvas.SkeletonRenderer.tintStats={created:0,ms:0};let pixels=0;
 const tinted=(img,r,g,b)=>{
  const q=v=>Math.round(Math.max(0,Math.min(1,v))*step);
  if(!img.width||!img.height)return img;
  let byImage=img.__tintId;if(!byImage)byImage=img.__tintId=Math.random().toString(36).slice(2);
  const key=byImage+':'+q(r)+','+q(g)+','+q(b);let canvas=tints.get(key);
  if(canvas){tints.delete(key);tints.set(key,canvas);return canvas}
  const started=performance.now();canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const c=canvas.getContext('2d');
  c.drawImage(img,0,0);c.globalCompositeOperation='multiply';c.fillStyle=`rgb(${q(r)/step*255},${q(g)/step*255},${q(b)/step*255})`;c.fillRect(0,0,canvas.width,canvas.height);
  c.globalCompositeOperation='destination-in';c.drawImage(img,0,0);
  tintStats.created++;tintStats.ms+=performance.now()-started;tints.set(key,canvas);pixels+=canvas.width*canvas.height;
  while(pixels>pixelLimit&&tints.size>1){const [oldest,old]=tints.entries().next().value;tints.delete(oldest);pixels-=old.width*old.height;old.width=old.height=0}
  return canvas;
 };
 prototype.drawTriangle=function(texture,x0,y0,u0,v0,x1,y1,u1,v1,x2,y2,u2,v2){
  if(Math.abs((x1-x0)*(y2-y0)-(y1-y0)*(x2-x0))<.00001||Math.abs((u1-u0)*(v2-v0)-(v1-v0)*(u2-u0))<1e-12)return;
  const tint=this.tempColor;
  if(tint&&(tint.r<.97||tint.g<.97||tint.b<.97)){const args=[...arguments];args[0]=tinted(texture,tint.r,tint.g,tint.b);return triangle.apply(this,args)}
  return triangle.apply(this,arguments);
 };
 prototype.drawTriangles=function(skeleton){
  const ctx=this.ctx,order=skeleton.drawOrder;
  if(!order.some(s=>s.getAttachment() instanceof spine.ClippingAttachment)){
   try{skeleton.drawOrder=order.filter(visible);return draw.call(this,skeleton)}finally{skeleton.drawOrder=order}
  }
  let batch=[],clip=null,clipBounds=null;
  const overlapsClip=slot=>{
   if(!clipBounds)return true;const attachment=slot.getAttachment(),v=[];
   if(attachment instanceof spine.RegionAttachment)attachment.computeWorldVertices(slot.bone,v,0,2);
   else if(attachment instanceof spine.MeshAttachment)attachment.computeWorldVertices(slot,0,attachment.worldVerticesLength,v,0,2);else return false;
   const xs=v.filter((_,i)=>i%2===0),ys=v.filter((_,i)=>i%2===1);
   return Math.max(...xs)>=clipBounds.left&&Math.min(...xs)<=clipBounds.right&&Math.max(...ys)>=clipBounds.bottom&&Math.min(...ys)<=clipBounds.top;
  };
  const flush=()=>{if(!batch.length)return;try{skeleton.drawOrder=batch;draw.call(this,skeleton)}finally{skeleton.drawOrder=order;batch=[]}};
  try{
   for(const slot of order){
    const attachment=slot.getAttachment();
    if(slot.bone.active&&attachment instanceof spine.ClippingAttachment&&!clip){
     flush();const vertices=[];attachment.computeWorldVertices(slot,0,attachment.worldVerticesLength,vertices,0,2);
     const xs=vertices.filter((_,i)=>i%2===0),ys=vertices.filter((_,i)=>i%2===1);clipBounds={left:Math.min(...xs),right:Math.max(...xs),bottom:Math.min(...ys),top:Math.max(...ys)};
     ctx.save();ctx.beginPath();ctx.moveTo(vertices[0],vertices[1]);for(let i=2;i<vertices.length;i+=2)ctx.lineTo(vertices[i],vertices[i+1]);ctx.closePath();ctx.clip();clip=attachment;
     continue;
    }
    if(visible(slot)&&overlapsClip(slot))batch.push(slot);
    if(clip?.endSlot===slot.data){flush();ctx.restore();clip=null;clipBounds=null}
   }
   flush();
  }finally{if(clip)ctx.restore();skeleton.drawOrder=order}
 };
 const clippedDraw=prototype.drawTriangles;
 prototype.drawTriangles=function(skeleton){
  const alpha=skeleton.color.a;
  try{skeleton.color.a*=this.ctx.globalAlpha;return clippedDraw.call(this,skeleton)}finally{skeleton.color.a=alpha}
 };
})();
