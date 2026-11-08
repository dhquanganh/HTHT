// Minimal UnityFS reader: decompresses all blocks (LZ4/LZ4HC/none) and writes raw data.
const fs=require('fs');
function lz4(src,size){const out=Buffer.alloc(size);let i=0,o=0;while(i<src.length){const t=src[i++];let l=t>>4;if(l===15){let b;do{b=src[i++];l+=b}while(b===255)}src.copy(out,o,i,i+l);i+=l;o+=l;if(i>=src.length)break;const off=src[i]|(src[i+1]<<8);i+=2;let m=t&15;if(m===15){let b;do{b=src[i++];m+=b}while(b===255)}m+=4;for(let k=0;k<m;k++,o++)out[o]=out[o-off]}return out}
function read(file){
 const b=fs.readFileSync(file);let p=0;const str=()=>{const e=b.indexOf(0,p);const s=b.toString('utf8',p,e);p=e+1;return s};
 str();const ver=b.readUInt32BE(p);p+=4;str();str();
 const size=Number(b.readBigUInt64BE(p));p+=8;const csz=b.readUInt32BE(p),usz=b.readUInt32BE(p+4),flags=b.readUInt32BE(p+8);p+=12;
 if(ver>=7)p=Math.ceil(p/16)*16;
 let infoStart=(flags&0x80)?b.length-csz:p;let info=b.subarray(infoStart,infoStart+csz);
 if((flags&0x3f)>=2)info=lz4(info,usz);
 if(!(flags&0x80))p+=csz;
 if(flags&0x200)p=Math.ceil(p/16)*16;
 let q=16;const n=info.readUInt32BE(q);q+=4;const blocks=[];for(let k=0;k<n;k++){blocks.push([info.readUInt32BE(q),info.readUInt32BE(q+4),info.readUInt16BE(q+8)]);q+=10}
 const parts=[];for(const [u,c,f] of blocks){const d=b.subarray(p,p+c);p+=c;parts.push((f&0x3f)>=2?lz4(d,u):d)}
 return Buffer.concat(parts);
}
module.exports=read;
if(require.main===module){fs.writeFileSync(process.argv[3],read(process.argv[2]))}
