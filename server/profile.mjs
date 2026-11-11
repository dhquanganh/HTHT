// Thông tin tài khoản (PopupSettings > PopupAccountInfo gốc), ảnh đại diện (PopupChangeAvatar), đổi tên (PopupRename) và
// phần thưởng lên cấp thuyền trưởng (PopupLevelUp).
//   - Ảnh đại diện tách khỏi tướng chính: tab "Ảnh tướng" chọn đầu của tướng đã sở hữu, tab "Ảnh đặc biệt" là ảnh db_avatar
//     (avatars.json) chỉ dùng được khi đã có (nhận từ sự kiện / cửa hàng đặc biệt như mô tả gốc).
//   - Đổi tên: lần đầu miễn phí (ButtonSaveFree), sau đó 100 kim cương (IconGem / TextCost 100 của PopupRename).
//   - Lên cấp: mỗi cấp được 20 kim cương như ảnh gốc; mốc cấp chia hết cho 10 thêm Beli. Bảng thưởng gốc nằm ở máy chủ.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition} from './errors.mjs';

const avatars=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/avatars.json',import.meta.url)),'utf8'));
const special=new Map(avatars.special.map(a=>[a.id,a]));
export const renamePrice=100;
export const levelRewards=level=>[{itemId:'diamonds',quantity:20},...(level%10===0?[{itemId:'gold',quantity:level*2000}]:[])];

/** Ghi nhận lên cấp: thưởng đã cộng ở accountExp; client hiện PopupLevelUp rồi xác nhận (level-ack). */
export function noteLevelUp(p,level,rewards){(p.levelUps??=[]).push({level,rewards});if(p.levelUps.length>20)p.levelUps=p.levelUps.slice(-20)}
export function avatarView(p){return{avatar:p.avatar||null,avatars:p.avatars||[],renamed:!!p.renamed,renamePrice}}
export function profileAction(p,input,{owned,pay}){
 if(input.op==='avatar'){
  const kind=input.kind,id=input.id;
  if(kind==='hero'){requireCondition(typeof id==='string'&&owned.has(id),'Bạn chưa sở hữu tướng này.');p.avatar={kind,id};return{message:'Đã đổi ảnh đại diện.'}}
  requireCondition(kind==='special'&&special.has(Number(id)),'Ảnh đại diện không hợp lệ.');
  requireCondition((p.avatars||[]).includes(Number(id)),special.get(Number(id)).desc||'Bạn chưa sở hữu ảnh đại diện này.');
  p.avatar={kind,id:Number(id)};return{message:'Đã đổi ảnh đại diện.'};
 }
 if(input.op==='rename'){
  requireCondition(typeof input.displayName==='string','Tên thuyền trưởng không hợp lệ.');const name=input.displayName.trim();
  requireCondition(name.length>=3&&name.length<=24&&!/[<>\u0000-\u001f]/.test(name),'Tên thuyền trưởng cần 3–24 ký tự.');
  requireCondition(name!==p.displayName,'Tên mới trùng tên hiện tại.');
  if(p.renamed)pay(renamePrice);p.renamed=true;p.displayName=name;return{message:'Đã đổi tên thuyền trưởng.'};
 }
 if(input.op==='level-ack'){p.levelUps=[];return{message:''}}
 requireCondition(false,'Thao tác không hợp lệ.');
}
