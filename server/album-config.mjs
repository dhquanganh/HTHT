// Nâng tranh Đảo Người Cá cho trang quản trị (tab "Tranh Người Cá"): phí rút, tỉ lệ thành công, tỉ lệ trùng mảnh,
// chỉ số / điều kiện từng tranh, thêm tranh mới từ ảnh tải lên.
// Bản sửa lưu ở album_config ({_id:'album', fee, successRate, duplicateRate, pictures}) và áp thẳng vào albumData
// (server/album.mjs đọc từ đó). Ảnh tải lên lưu ở album_art ({_id, data, type}) và phục vụ qua /album-art/<id>.webp.
// Ảnh được trang quản trị cắt về đúng khung tranh gốc 516×388 (4:3) và xuất WebP trước khi gửi; game chia lưới
// rows × cols mảnh lúc hiển thị (PanelGridPicture: mỗi ô chưa mở phủ pic_hiden).
import {requireCondition,integer} from './errors.mjs';
import {albumData,equipmentData,itemIcon} from './catalog.mjs';
import {albumRates} from './album.mjs';
import {lucThucConfig} from './luc-thuc.mjs';

const defaults={fee:albumData.fee,successRate:100,duplicateRate:0,pictures:structuredClone(albumData.pictures)};
export const artWidth=516,artHeight=388,maxArtBytes=1500000,maxPictures=400;
export const artUrl=id=>`/album-art/${id}.webp`;
const pointIds=new Set(Object.keys(equipmentData.points).map(Number));
let edited=false;

/** Ảnh tranh tải lên: thêm key vào bảng picture.artSrc để game đăng ký vào kho ảnh lúc khởi động. */
export function applyAlbumConfig(doc){
 edited=!!doc;const c=doc||defaults;
 albumData.fee=c.fee??defaults.fee;albumRates.successRate=c.successRate??100;albumRates.duplicateRate=c.duplicateRate??0;lucThucConfig.perPercent=c.lucThucPerPercent??1000000;
 albumData.pictures.splice(0,albumData.pictures.length,...structuredClone(c.pictures?.length?c.pictures:defaults.pictures));
}
export function albumAdminView(){
 return{edited,lucThucPerPercent:lucThucConfig.perPercent,fee:albumData.fee,successRate:albumRates.successRate,duplicateRate:albumRates.duplicateRate,defaultCount:defaults.pictures.length,artWidth,artHeight,
  points:Object.entries(equipmentData.points).map(([id,p])=>({id:Number(id),name:p.name+(p.percent?' %':''),percent:p.percent,rate:p.rate})),
  pictures:albumData.pictures.map(p=>({...p,custom:!!p.artSrc,preview:p.artSrc||itemIcon({assetKey:p.art})}))};
}
const pct=(v,label)=>{const n=Number(v);requireCondition(Number.isFinite(n)&&n>=0&&n<=100,`${label} phải từ 0 đến 100.`);return Math.round(n*100)/100};
/** Kiểm tra danh sách tranh gửi lên: mã (album, ảnh) không trùng, điều kiện tranh trước phải tồn tại. */
export function validatePictures(input,knownArt){
 requireCondition(Array.isArray(input)&&input.length>=1&&input.length<=maxPictures,`Cần 1–${maxPictures} tranh.`);
 const seen=new Set();
 const out=input.map((p,i)=>{
  const label=`Tranh ${i+1}`,album=integer(p?.album,1,999,`${label}: album`),image=integer(p?.image,1,99,`${label}: ảnh`),code=album*100+image;
  requireCondition(!seen.has(code),`Trùng mã tranh ${album}-${image}.`);seen.add(code);
  const name=String(p.name??'').trim().slice(0,40);requireCondition(name,`${label}: cần tên tranh.`);
  const rows=integer(p.rows,1,10,`${label}: số hàng`),cols=integer(p.cols,1,10,`${label}: số cột`);
  requireCondition(Array.isArray(p.points)&&p.points.length>=1&&p.points.length<=6,`${label}: cần 1–6 chỉ số.`);
  const points=p.points.map(([id,value])=>{requireCondition(pointIds.has(Number(id))||Number(id)===97,`${label}: chỉ số không hợp lệ.`);return[Number(id),integer(value,1,1e12,`${label}: giá trị chỉ số`)]});
  const art=String(p.art||'');requireCondition(knownArt(art,p.artSrc),`${label}: ảnh tranh không hợp lệ.`);
  const row={album,image,name,rows,cols,points,requireImage:integer(p.requireImage??0,0,99999,`${label}: tranh yêu cầu`),requireLevel:integer(p.requireLevel??1,1,100000,`${label}: cấp yêu cầu`),art};
  if(p.artSrc)row.artSrc=String(p.artSrc);
  return row;
 });
 for(const p of out)requireCondition(!p.requireImage||seen.has(p.requireImage),`Tranh ${p.album}-${p.image}: tranh yêu cầu ${p.requireImage} không tồn tại.`);
 return out;
}
/** Ảnh gốc (khóa trong bảng mặc định) hoặc ảnh tải lên đã lưu (/album-art/<id>.webp). */
export const artChecker=uploaded=>(art,src)=>defaults.pictures.some(p=>p.art===art)&&!src||(typeof src==='string'&&/^\/album-art\/[a-f0-9]{24}\.webp$/.test(src)&&art==='album-upload-'+src.slice(11,35)&&uploaded.has(src.slice(11,35)));
export function validateAlbumConfig(input,uploaded){
 requireCondition(input&&typeof input==='object','Dữ liệu không hợp lệ.');
 return{fee:integer(input.fee,1,1e9,'Phí rút'),successRate:pct(input.successRate,'Tỉ lệ thành công'),duplicateRate:pct(input.duplicateRate,'Tỉ lệ trùng mảnh'),lucThucPerPercent:integer(input.lucThucPerPercent??1000000,1,1e12,'Lục thức cho 1% giảm sát thương'),pictures:validatePictures(input.pictures,artChecker(uploaded))};
}
/** Ảnh WebP hợp lệ (RIFF....WEBP) và không quá lớn. */
export function checkArt(buffer){
 requireCondition(Buffer.isBuffer(buffer)&&buffer.length>=30,'Không đọc được ảnh tải lên.');
 requireCondition(buffer.length<=maxArtBytes,'Ảnh quá lớn (tối đa 1,5 MB).');
 requireCondition(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP','Ảnh phải là WebP (trang quản trị tự chuyển đổi).');
 return buffer;
}
