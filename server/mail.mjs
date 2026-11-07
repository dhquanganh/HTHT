// Hòm thư: admin gửi quà vào đây, người chơi bấm nhận mới vào túi. Thư nằm trong player nên ghi cùng lượt có khóa phiên bản.
import {randomUUID} from 'node:crypto';
import {requireCondition} from './errors.mjs';

const maxPending=100,maxStored=150;
const clean=(value,fallback,max)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback;
export function sendMail(p,{title,text,rewards},now=Date.now()){
 p.mail??=[];
 requireCondition(p.mail.filter(m=>!m.claimedAt).length<maxPending,'Hòm thư của người chơi đã đầy.',409,'MAIL_FULL');
 p.mail.unshift({id:randomUUID(),title:clean(title,'Quà từ Ban quản trị',60),text:clean(text,'Thuyền trưởng nhận quà trong thư này nhé.',300),rewards,sentAt:new Date(now).toISOString(),claimedAt:null});
 // Thư đã nhận bị bỏ trước; thư còn quà không bao giờ mất.
 while(p.mail.length>maxStored){const at=p.mail.findLastIndex(m=>m.claimedAt);if(at<0)break;p.mail.splice(at,1)}
}
export function claimMail(p,input,grant,now=Date.now()){
 const list=p.mail||[],targets=input.all===true?list.filter(m=>!m.claimedAt):list.filter(m=>m.id===input.id);
 requireCondition(targets.length,'Không có thư để nhận.',404,'MAIL_NOT_FOUND');
 requireCondition(targets.every(m=>!m.claimedAt),'Thư này đã nhận rồi.',409,'MAIL_CLAIMED');
 for(const mail of targets){for(const reward of mail.rewards)grant(reward);mail.claimedAt=new Date(now).toISOString()}
 return{message:targets.length>1?`Đã nhận quà từ ${targets.length} thư.`:'Đã nhận quà trong thư.',claimed:targets.map(m=>m.id),rewards:targets.flatMap(m=>m.rewards)};
}
export function deleteMail(p,input){
 const list=p.mail||[],gone=input.all===true?list.filter(m=>m.claimedAt):list.filter(m=>m.id===input.id);
 requireCondition(gone.length,'Không có thư để xóa.',404,'MAIL_NOT_FOUND');
 requireCondition(gone.every(m=>m.claimedAt),'Hãy nhận quà trước khi xóa thư.',409,'MAIL_UNCLAIMED');
 p.mail=list.filter(m=>!gone.includes(m));
 return{message:'Đã xóa thư.'};
}
