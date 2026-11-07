// Album ảnh ở Đảo Người Cá, theo db_album và PanelAlbumMain gốc.
// Mỗi ảnh chia split_row × split_col mảnh. "Rút" tốn Thẻ huyền bí (KEY_MATERIAL 100045) và mở một mảnh chưa có.
// Đủ mảnh thì ảnh hoàn thành và buff_data cộng cho toàn đội. Ảnh mở khi đã hoàn thành required_image_id
// (album*100+ảnh) và thuyền trưởng đạt required_level. Đạt nửa số mảnh nhận thêm thẻ (mốc thưởng của PanelRollPicture).
import {randomInt} from 'node:crypto';
import {requireCondition} from './errors.mjs';
import {albumData,equipmentData} from './catalog.mjs';

export const albumMaterial=albumData.material,albumFee=albumData.fee,pictures=albumData.pictures;
const keyOf=pic=>`${pic.album}-${pic.image}`,codeOf=pic=>pic.album*100+pic.image;
const byCode=new Map(pictures.map(pic=>[codeOf(pic),pic]));
const size=pic=>pic.rows*pic.cols;
/** Mốc thưởng của một ảnh: mở được nửa số mảnh thì nhận lại gấp đôi phí một lần rút. */
export const milestonesOf=pic=>[{at:Math.ceil(size(pic)/2),quantity:albumFee*2}];
const stateOf=p=>p.album||(p.album={pieces:{},bonus:{}});
const opened=(p,pic)=>p.album?.pieces?.[keyOf(pic)]||[];
export const isComplete=(p,pic)=>opened(p,pic).length>=size(pic);
export function lockReason(p,pic){
 const need=pic.requireImage&&byCode.get(pic.requireImage);
 if(need&&!isComplete(p,need))return `Sở hữu Album ${need.album}-${need.image}`;
 if(p.account.level<pic.requireLevel)return `Yêu cầu lv${pic.requireLevel}`;
 return null;
}
const known=new Set(Object.keys(equipmentData.points).map(Number));
/** Chỉ số của các ảnh đã hoàn thành, dạng nhóm điểm như trang bị; clazz 0 = mọi tướng. */
export function albumGroups(p){
 const groups=[];
 for(const pic of pictures)if(isComplete(p,pic)){const point=pic.points.filter(([id])=>known.has(id));if(point.length)groups.push({clazz:0,point})}
 return groups;
}
export function albumTotals(p){
 const total={};for(const pic of pictures)if(isComplete(p,pic))for(const [id,value] of pic.points)total[id]=(total[id]||0)+value;
 return Object.entries(total).map(([id,value])=>[Number(id),value]);
}
export function albumView(p){
 return{fee:albumFee,material:albumMaterial,totals:albumTotals(p),pictures:pictures.map(pic=>{
  const pieces=opened(p,pic);return{album:pic.album,image:pic.image,pieces,total:size(pic),complete:pieces.length>=size(pic),locked:lockReason(p,pic),bonus:p.album?.bonus?.[keyOf(pic)]||[]};
 })};
}
export function rollAlbum(p,input,pay,grant,random=randomInt){
 const pic=pictures.find(x=>x.album===Number(input.album)&&x.image===Number(input.image));
 requireCondition(pic,'Ảnh không tồn tại.',404,'ALBUM_MISSING');
 const locked=lockReason(p,pic);requireCondition(!locked,`Chưa đủ điều kiện mở khóa: ${locked}.`,409,'ALBUM_LOCKED');
 requireCondition(!isComplete(p,pic),'Ảnh đã đủ mảnh.',409,'ALBUM_COMPLETE');
 pay({itemId:albumMaterial,quantity:albumFee});
 const state=stateOf(p),key=keyOf(pic),pieces=state.pieces[key]||(state.pieces[key]=[]);
 const free=Array.from({length:size(pic)},(_,i)=>i).filter(i=>!pieces.includes(i)),piece=free[random(free.length)];
 pieces.push(piece);pieces.sort((a,b)=>a-b);
 const rewards=[],bonus=state.bonus[key]||(state.bonus[key]=[]);
 for(const mark of milestonesOf(pic))if(pieces.length>=mark.at&&!bonus.includes(mark.at)){bonus.push(mark.at);const reward={itemId:albumMaterial,quantity:mark.quantity};grant(reward);rewards.push(reward)}
 const complete=pieces.length>=size(pic);
 return{message:complete?`Đã hoàn thành ảnh ${pic.name} ${pic.album}-${pic.image}, toàn đội được tăng chỉ số.`:`Mở mảnh ${String.fromCharCode(65+Math.floor(piece/pic.cols))}${piece%pic.cols+1}.`,piece,complete,rewards};
}
