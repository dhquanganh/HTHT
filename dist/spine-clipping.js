/* Canvas support for the clipping attachments used by cached cinematic skills.
 * Also applies slot blend modes. Original Spine assets are kept intact; the bundled runtime has one
 * local UTF-8 fix in readString.
 */
(()=>{
 'use strict';
 const prototype=spine.canvas.SkeletonRenderer.prototype,baseDraw=prototype.drawTriangles,triangle=prototype.drawTriangle;
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
 prototype.drawTriangle=function(texture,x0,y0,u0,v0,x1,y1,u1,v1,x2,y2,u2,v2){
  if(Math.abs((x1-x0)*(y2-y0)-(y1-y0)*(x2-x0))<.00001||Math.abs((u1-u0)*(v2-v0)-(v1-v0)*(u2-u0))<1e-12)return;
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
