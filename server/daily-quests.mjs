// Nhiệm vụ hằng ngày (PopupDailyQuest / CellDailyQuest, scene 1288 và 1163 trong cache HTTH).
// Tên 10 nhiệm vụ lấy nguyên văn từ bảng dịch của database_ex; thưởng theo ảnh gốc: nhiệm vụ thứ n cho
// 20.000×n vàng và 500×n EXP tướng, hoàn thành cả 10 nhận 100 kim cương + 15 Bụi ma thuật.
// Danh sách định nghĩa và bảng thưởng đầy đủ do server gốc gửi nên phần còn lại là số tự đặt theo quy luật đó.
// Tính năng bản gốc chưa có ở bản này được gắn vào tính năng gần nghĩa nhất (cột `source`).
import {requireCondition} from './errors.mjs';
import {dayKey} from './events.mjs';

export const dailyQuests=[
 {id:'summon-basic',name:'Chiêu mộ thường 1 lần',target:1,go:'summon',source:'Chiêu mộ 1 lượt'},
 {id:'summon-premium',name:'Chiêu mộ cao cấp 1 lần',target:1,go:'summon',source:'Chiêu mộ 10 lượt'},
 {id:'trade',name:'Dùng Khu giao dịch 1 lần',target:1,go:'events',source:'Đổi/mua vật phẩm ở sự kiện'},
 {id:'tavern',name:'Hoàn thành 1 nhiệm vụ Tửu quán',target:1,go:'mastery',source:'Nhận thưởng nhiệm vụ Thông thạo'},
 {id:'wine',name:'Tặng bình rượu cho bạn bè 1 lần',target:1,go:'events',source:'Điểm danh Lễ Hội Ẩm Thực'},
 {id:'spin',name:'Quay vòng quay may mắn 1 lần',target:1,go:'events',source:'Vòng Quay May Mắn'},
 {id:'forge',name:'Rèn trang bị 1 lần',target:1,go:'forge',source:'Tiệm rèn'},
 {id:'arena',name:'Khiêu chiến Đơn đấu 2 lần',target:2,go:'arena',source:'Đơn đấu ở Chiến trường'},
 {id:'afk',name:'Thu thập thưởng treo máy 2 lần',target:2,go:'afk',source:'Nhận thưởng treo máy'},
 {id:'raid',name:'Đánh thắng Event Raid 1 lần',target:1,go:'beast',source:'Đánh xong Boss Máy Chủ'},
].map((q,i)=>({...q,rewards:[{itemId:'gold',quantity:20000*(i+1)},{itemId:'spirit',quantity:500*(i+1)},{itemId:'vipExp',quantity:10}]}));
// EXP VIP: mỗi nhiệm vụ ngày 10, hoàn thành cả 10 thêm 100 (ItemVipExpUI của CellDailyQuest gốc; số do bản web đặt).
export const dailyFinal={name:'Hoàn thành tất cả nhiệm vụ hàng ngày',rewards:[{itemId:'diamonds',quantity:100},{itemId:'consumable:3',quantity:15},{itemId:'vipExp',quantity:100}]};
const byId=new Map(dailyQuests.map(q=>[q.id,q]));

function state(p,now){
 const day=dayKey(now);
 if(p.dailyQuests?.day!==day)p.dailyQuests={day,progress:{},claimed:[],final:false};
 return p.dailyQuests;
}
const done=(s,q)=>(s.progress[q.id]||0)>=q.target;
/** Ghi tiến độ sau một thao tác thành công. */
export function trackDaily(p,{action,input={},beastWon=false},now=Date.now()){
 const keys=[];
 if(action==='summon')keys.push(Number(input.count)>=10?'summon-premium':'summon-basic');
 if(action==='event-exchange'||action==='event-buy')keys.push('trade');
 if(action==='mastery-claim')keys.push('tavern');
 if(action==='event-rollcall')keys.push('wine');
 if(action==='event-spin'||action==='casino'&&!['buy','refresh'].includes(input.op))keys.push('spin');
 if(action==='forge')keys.push('forge');
 if(action==='arena-start'&&input.mode==='solo')keys.push('arena');
 if(action==='afk-claim')keys.push('afk');
 if(beastWon)keys.push('raid');
 if(!keys.length)return;
 const s=state(p,now);for(const id of keys){const q=byId.get(id);s.progress[id]=Math.min(q.target,(s.progress[id]||0)+1)}
}
/** Thời gian tới 00:00 giờ Việt Nam kế tiếp, tính bằng giây. */
export const dailyResetIn=now=>{const vn=now+7*3600000;return Math.ceil((86400000-vn%86400000)/1000)};
export function dailyQuestView(p,now=Date.now()){
 const s=p.dailyQuests?.day===dayKey(now)?p.dailyQuests:{progress:{},claimed:[],final:false};
 const quests=dailyQuests.map(q=>({id:q.id,name:q.name,target:q.target,progress:s.progress[q.id]||0,claimed:s.claimed.includes(q.id),rewards:q.rewards,go:q.go,source:q.source}));
 const claimed=quests.filter(q=>q.claimed).length;
 return{resetIn:dailyResetIn(now),quests,final:{...dailyFinal,progress:claimed,target:dailyQuests.length,claimed:!!s.final},ready:quests.some(q=>!q.claimed&&q.progress>=q.target)||(claimed===dailyQuests.length&&!s.final)};
}
export function claimDaily(p,input,grant,now=Date.now()){
 const s=state(p,now);
 if(input.id==='final'){
  requireCondition(!s.final,'Đã nhận thưởng hoàn thành tất cả nhiệm vụ.',409,'DAILY_CLAIMED');
  requireCondition(s.claimed.length===dailyQuests.length,`Cần hoàn thành ${dailyQuests.length} nhiệm vụ hằng ngày.`,409,'DAILY_INCOMPLETE');
  s.final=true;dailyFinal.rewards.forEach(grant);return{message:'Đã nhận thưởng hoàn thành tất cả nhiệm vụ.',rewards:dailyFinal.rewards};
 }
 const q=byId.get(input.id);requireCondition(q,'Nhiệm vụ không tồn tại.',404);
 requireCondition(!s.claimed.includes(q.id),'Đã nhận thưởng nhiệm vụ này.',409,'DAILY_CLAIMED');
 requireCondition(done(s,q),'Nhiệm vụ chưa hoàn thành.',409,'DAILY_INCOMPLETE');
 s.claimed.push(q.id);q.rewards.forEach(grant);return{message:`Hoàn thành: ${q.name}.`,rewards:q.rewards};
}
