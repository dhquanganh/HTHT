// Điểm danh và Sự kiện. Asset chỉ có giao diện; danh sách sự kiện và phần thưởng do server gốc giữ.
// Bộ mặc định dưới đây được nạp vào MongoDB (event_config) lần đầu; trang quản trị sửa bản trong database.
// Số có ghi "theo ảnh" lấy từ ảnh màn hình gốc, còn lại là số tự đặt.
import {randomInt} from 'node:crypto';
import {requireCondition,integer} from './errors.mjs';

const item=(itemId,quantity)=>({itemId,quantity});
const gold=quantity=>item('gold',quantity),diamonds=quantity=>item('diamonds',quantity);
const spyglass='consumable:20',clover='consumable:22',wood='consumable:11',xuSpin='consumable:10',xuSuper='consumable:13',peach='consumable:34',barrel='consumable:16',enhance='consumable:2',mug='consumable:15',ticket='consumable:4',potion='consumable:9',soul='consumable:7',dust='consumable:3',stone='consumable:1',rankS='consumable:2026',rankSS='consumable:2027',gearStone='consumable:2028',merit='consumable:47',meat='consumable:57';

// Ô 1-10 theo ảnh; ô 11-15 có ảnh nhưng bị che số lượng; ô 16-30 đặt thêm cho đủ 30 ngày.
const defaultCheckin=[
 item(clover,50),item(potion,50),item(soul,50),item(dust,2000),item('consumable:60',1),
 item(enhance,300),item('consumable:65',1),item('consumable:66',1),item(ticket,5),item(mug,5),
 item(wood,50),item('consumable:61',1),item(xuSpin,5),diamonds(100),item(clover,100),
 item(potion,100),item(soul,100),item(dust,3000),item('consumable:62',1),item(enhance,400),
 item('consumable:67',1),item(ticket,10),item(mug,10),item(barrel,2),item(xuSpin,10),
 item(clover,150),item('consumable:63',1),item(dust,5000),diamonds(200),item(barrel,5),
];
const steps=(label,unit,rows)=>({stepLabel:label,stepUnit:unit,milestones:rows.map(([target,...rewards])=>({target,rewards}))});
const progress=(id,tab,counter,title,art,counterLabel,label,unit,rows)=>({id,tab,type:'progress',counter,title,...art,counterLabel,...steps(label,unit,rows)});
const defaultEvents=[
 // 20 và 50 lượt theo ảnh.
 progress('lucky-summon','week','summon','Quay Tướng May Mắn',{icon:'icon_skchieumo',banner:'event_vong_quay_big'},'Lượt quay đã dùng','Quay','lượt',[[20,item(xuSuper,2)],[50,item(clover,500)],[100,item(barrel,5),gold(200000)],[200,item(xuSuper,10),diamonds(300)]]),
 progress('summon-four','week','summon4','Chiêu Mộ Thuyền Viên 4 Sao',{icon:'icon_event_recruit',banner:'event_chieu_mo_dac_biet_big'},'Thuyền viên 4 sao đã chiêu mộ','Chiêu mộ','thuyền viên 4 sao',[[1,gold(50000)],[5,item(barrel,2)],[10,diamonds(200)],[20,item(rankS,1)]]),
 progress('tower-climb','week','tower','Khiêu Chiến Tháp',{icon:'icon_dauthan',banner:'banner_dauthan'},'Tầng đã vượt','Vượt','tầng',[[3,gold(50000),item(spyglass,3)],[10,item(enhance,100)],[20,item(barrel,2)],[30,diamonds(200)]]),
 progress('beast-hunt','week','beast','Đánh Boss Máy Chủ',{icon:'icon_boss_2',banner:'banner_chienthanthu'},'Lượt khiêu chiến','Khiêu chiến','lượt',[[5,gold(50000)],[20,item(peach,20)],[50,item(barrel,3)],[100,diamonds(300)]]),
 progress('forge-festival','week','forge','Lễ Hội Trang Bị',{icon:'icon_lehoitrangbi',banner:'lehoi_banner1_88'},'Trang bị đã tạo','Tạo','món',[[3,gold(30000)],[10,item(peach,10)],[30,item(enhance,200)]]),
 progress('stage-march','month','stage','Chiến Trường',{icon:'icon_chieumodacbiet',banner:'event_chien_truong_big'},'Trận thắng','Thắng','trận',[[10,gold(50000),item(spyglass,5)],[30,item(peach,30)],[60,item(barrel,5)],[100,diamonds(500)]]),
 // Mốc 1.000 và 5.000 theo ảnh.
 progress('diamond-spend','month','diamondSpend','Tiêu Kim Cương Tháng',{icon:'icon_tichtieu',banner:'event_tich_tieu_kim_cuong_big'},'Kim cương đã tiêu','Tiêu','KC',[[1000,item('consumable:60',1),item('consumable:66',1)],[5000,item(clover,1000)],[10000,item(barrel,5)],[30000,item(rankS,1)]]),
 progress('merge-five','month','merge5','Ghép Thuyền Viên 5 Sao',{iconItem:enhance,banner:'event_luyen_tuong_big'},'Thuyền viên 5 sao đã ghép','Ghép','thuyền viên 5 sao',[[1,gold(100000)],[3,item(barrel,3)],[5,diamonds(300)]]),
 {id:'clover-exchange',tab:'month',type:'exchange',title:'Đổi Cỏ 4 Lá',icon:'icon_hoandoi',banner:'banner_co4la',
  offers:[{cost:item(clover,100),reward:item(barrel,1),limit:10},{cost:item(clover,200),reward:item(xuSuper,2),limit:5},{cost:item(clover,50),reward:item(enhance,50),limit:20},{cost:item(clover,30),reward:gold(30000),limit:30},{cost:item(clover,500),reward:diamonds(100),limit:5},{cost:item(clover,20),reward:item(peach,2),limit:30}]},
 {id:'statue-prayer',tab:'month',type:'pray',title:'Cầu Nguyện Tượng Thần',iconItem:peach,banner:'event_than_khi_big',counterLabel:'Lượt cầu nguyện',cost:item(peach,1),
  pool:[{weight:40,reward:gold(5000)},{weight:25,reward:item(stone,5)},{weight:15,reward:item(dust,200)},{weight:10,reward:item(clover,20)},{weight:7,reward:item(enhance,20)},{weight:3,reward:item(barrel,1)}],
  ...steps('Cầu nguyện','lượt',[[10,item(clover,50)],[30,item(barrel,2)],[60,diamonds(200)]])},
 // Không Gian Vỡ theo GGBrokenSpaceEventV2: 7 cứ điểm, mỗi trận tốn 1 Ống nhòm. Hết 7 cứ điểm thì sang vòng mới, địch mạnh hơn.
 {id:'broken-space',tab:'month',type:'stages',title:'Không Gian Vỡ',iconItem:'consumable:12',background:'event_46_big',material:spyglass,buy:{cost:diamonds(50),limit:10},roundFloors:40,
  stages:[{floor:10,rewards:[gold(50000)]},{floor:15,rewards:[item(enhance,50)]},{floor:20,rewards:[item(clover,100)]},{floor:25,rewards:[item(peach,10)]},{floor:30,rewards:[gold(100000)]},{floor:40,rewards:[item(barrel,1)]},{floor:50,rewards:[diamonds(100),item(barrel,1)]}]},
 {id:'gem-sale',tab:'sale',type:'exchange',title:'Gói Ưu Đãi',icon:'icon_tichluyvipexp',banner:'inform_goiuudai_big',
  offers:[{cost:diamonds(100),reward:item(barrel,2),limit:3},{cost:diamonds(50),reward:item(clover,100),limit:5},{cost:diamonds(200),reward:item(xuSuper,3),limit:2},{cost:diamonds(30),reward:gold(50000),limit:10}]},
 {id:'time-shop',tab:'sale',type:'exchange',title:'Shop Hạn Giờ',icon:'icon_shophangio',banner:'banner_shophangio',
  offers:[{cost:gold(100000),reward:item(enhance,50),limit:5},{cost:gold(200000),reward:item(peach,10),limit:5},{cost:gold(50000),reward:item(wood,50),limit:10},{cost:gold(500000),reward:item(barrel,1),limit:2}]},
 // Lễ Hội Ẩm Thực theo PopupSpecialEvent2 và PanelEventFeast. Ba hàng đầu của cửa hàng theo ảnh; limit 0 là không giới hạn.
 {id:'feast',tab:'special',type:'exchange',title:'Lễ Hội Ẩm Thực',iconItem:meat,banner:'banner_event',coins:[clover,xuSpin],
  offers:[{cost:item(clover,30),reward:item(enhance,600),limit:0},{cost:item(clover,80),reward:item(gearStone,200),limit:10},{cost:item(xuSpin,5),reward:item(soul,100),limit:5},{cost:item(clover,150),reward:item(barrel,1),limit:10},{cost:item(xuSpin,20),reward:item(xuSuper,2),limit:5},{cost:item(clover,500),reward:item(rankS,1),limit:1}]},
 // Vòng Quay May Mắn: 14 ô và 4 mốc theo ảnh, tỉ lệ tự đặt. Mỗi lượt tốn 1 Xu vòng quay, mỗi ngày tặng 1 Xu.
 {id:'lucky-wheel',tab:'special',type:'wheel',title:'Vòng Quay May Mắn',iconItem:xuSpin,background:'bg_gem',cost:item(xuSpin,1),daily:item(xuSpin,1),buy:{cost:diamonds(20),limit:100},
  // Ô xếp theo chiều kim đồng hồ từ góc trên trái, đúng vị trí trong ảnh.
  slots:[{weight:1,reward:item(rankS,1)},{weight:1,reward:item(rankSS,1)},{weight:10,reward:gold(50000)},{weight:12,reward:item(clover,5)},{weight:8,reward:item(enhance,200)},{weight:6,reward:gold(100000)},{weight:8,reward:item(dust,800)},{weight:12,reward:item(clover,15)},{weight:10,reward:diamonds(20)},{weight:8,reward:item(gearStone,50)},{weight:8,reward:item(soul,100)},{weight:8,reward:diamonds(50)},{weight:10,reward:item(xuSpin,2)},{weight:5,reward:diamonds(200)}],
  ...steps('Quay','lần',[[10,item(clover,20)],[30,diamonds(200)],[60,item(rankS,1)],[100,item(rankSS,1)]])},
 // Điểm danh lễ hội theo PanelEventRollCall: mỗi ngày đăng nhập nhận một hàng. Cột trả phí của prefab không làm.
 {id:'feast-rollcall',tab:'special',type:'rollcall',title:'Điểm Danh Lễ Hội',iconItem:merit,banner:'banner_event',
  days:[[item(meat,10),gold(20000)],[item(xuSpin,2)],[item(clover,50)],[diamonds(50)],[item(xuSpin,3),item(meat,20)],[item(barrel,1)],[item(rankS,1)]]},
];
export const eventList=structuredClone(defaultEvents);
export const checkinRewards=structuredClone(defaultCheckin);
const eventById=new Map();

// ---- Cấu hình trong database
const titled=event=>{for(const m of event.milestones||[])m.title=`${event.stepLabel} ${new Intl.NumberFormat('vi-VN').format(m.target)} ${event.stepUnit}`;return event};
/** Áp các bản ghi event_config lên bộ mặc định. Gọi lúc khởi động và sau mỗi lần quản trị lưu. */
export function applyEventConfig(docs){
 const stored=new Map(docs.map(doc=>[doc._id,doc.config]));
 eventList.splice(0,eventList.length,...defaultEvents.map(event=>titled({...structuredClone(event),...(stored.get(event.id)||{})})));
 checkinRewards.splice(0,checkinRewards.length,...structuredClone(stored.get('checkin')?.rewards||defaultCheckin));
 eventById.clear();for(const event of eventList)eventById.set(event.id,event);
}
applyEventConfig([]);
export const editableEvents=()=>({events:eventList,checkin:checkinRewards,defaults:{events:defaultEvents,checkin:defaultCheckin}});

const amount=(value,label)=>integer(value,1,1000000000000,label);
function reward(input,isItem){
 const id=input?.itemId;requireCondition(typeof id==='string'&&isItem(id),'Vật phẩm không tồn tại.',404);
 return item(id,amount(input.quantity,'Số lượng'));
}
const list=(input,max,label)=>{requireCondition(Array.isArray(input)&&input.length>=1&&input.length<=max,`${label} cần từ 1 đến ${max} dòng.`);return input};
const rewards=(input,isItem)=>list(input,8,'Phần thưởng').map(r=>reward(r,isItem));
const milestones=(input,isItem)=>{
 const rows=list(input,20,'Mốc').map(m=>({target:amount(m?.target,'Mốc'),rewards:rewards(m?.rewards,isItem)}));
 for(let i=1;i<rows.length;i++)requireCondition(rows[i].target>rows[i-1].target,'Các mốc phải tăng dần.');
 return rows;
};
const weighted=(input,isItem,max)=>list(input,max,'Ô').map(row=>({weight:integer(row?.weight,1,1000000,'Tỉ lệ'),reward:reward(row?.reward,isItem)}));
/** Chỉ nhận các trường được sửa của từng loại; id, loại, tab, bộ đếm và ảnh luôn lấy từ bộ mặc định. */
export function validateEventConfig(id,input,isItem){
 requireCondition(input&&typeof input==='object','Dữ liệu không hợp lệ.');
 if(id==='checkin'){const rows=list(input.rewards,60,'Ngày điểm danh').map(r=>reward(r,isItem));return{rewards:rows}}
 const base=defaultEvents.find(event=>event.id===id);requireCondition(base,'Sự kiện không tồn tại.',404);
 const title=typeof input.title==='string'&&input.title.trim()?input.title.trim().slice(0,40):base.title,out={title};
 if(['progress','pray','wheel'].includes(base.type))out.milestones=milestones(input.milestones,isItem);
 if(base.type==='exchange')out.offers=list(input.offers,20,'Gói').map(o=>({cost:reward(o?.cost,isItem),reward:reward(o?.reward,isItem),limit:integer(o?.limit,0,100000,'Giới hạn')}));
 if(base.type==='pray'){out.cost=reward(input.cost,isItem);out.pool=weighted(input.pool,isItem,20)}
 if(base.type==='wheel'){out.cost=reward(input.cost,isItem);out.daily=reward(input.daily,isItem);out.buy={cost:reward(input.buy?.cost,isItem),limit:integer(input.buy?.limit,0,100000,'Lượt mua')};out.slots=weighted(input.slots,isItem,14);requireCondition(out.slots.length===14,'Vòng quay cần đủ 14 ô.')}
 if(base.type==='stages'){out.stages=list(input.stages,7,'Cứ điểm').map(s=>({floor:integer(s?.floor,1,2301,'Tầng'),rewards:rewards(s?.rewards,isItem)}));requireCondition(out.stages.length===7,'Cần đủ 7 cứ điểm.');out.buy={cost:reward(input.buy?.cost,isItem),limit:integer(input.buy?.limit,0,1000,'Lượt mua')}}
 if(base.type==='rollcall')out.days=list(input.days,31,'Ngày').map(day=>rewards(day,isItem));
 return out;
}

// ---- Kỳ sự kiện
const vn=now=>new Date(now+7*3600000);
export const dayKey=now=>vn(now).toISOString().slice(0,10);
const monthKey=now=>vn(now).toISOString().slice(0,7);
// Tuần bắt đầu thứ Hai 00:00 giờ Việt Nam; các tab khác làm mới ngày 1 hằng tháng.
const mondayKey=now=>{const d=vn(now);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)};
const periodKey=(event,now)=>event.tab==='week'?'w'+mondayKey(now):'m'+monthKey(now);
function periodEnd(event,now){
 const d=vn(now);
 if(event.tab==='week'){d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7+7);d.setUTCHours(0,0,0,0)}
 else{d.setUTCMonth(d.getUTCMonth()+1,1);d.setUTCHours(0,0,0,0)}
 return d.getTime()-7*3600000;
}
function eventState(p,event,now){
 const store=p.events??={},period=periodKey(event,now);
 if(store[event.id]?.period!==period)store[event.id]={period,count:0,claimed:[],bought:{},stage:0,round:1,days:0,lastDay:null,freeDay:null};
 return store[event.id];
}
/** Cộng tiến độ cho mọi sự kiện đếm `counter`. Gọi ngay trong lượt ghi của hành động gốc. */
export function trackEvent(p,counter,value,now=Date.now()){
 if(!(value>0))return;
 for(const event of eventList)if(event.counter===counter)eventState(p,event,now).count+=value;
}
function requireEvent(id,type){
 const event=eventById.get(id);requireCondition(event,'Sự kiện không tồn tại.',404);
 if(type)requireCondition(event.type===type,'Sự kiện không hỗ trợ thao tác này.');
 return event;
}
const roll=(rows,random)=>{let left=random(rows.reduce((sum,row)=>sum+row.weight,0));return rows.findIndex(row=>(left-=row.weight)<0)};
export function claimEvent(p,input,grant,now=Date.now()){
 const event=requireEvent(input.id),state=eventState(p,event,now),index=integer(input.index,0,99,'Mốc'),milestone=event.milestones?.[index];
 requireCondition(milestone,'Mốc không tồn tại.',404);
 requireCondition(state.count>=milestone.target,'Chưa đạt mốc này.',409,'EVENT_NOT_REACHED');
 requireCondition(!state.claimed.includes(index),'Đã nhận mốc này.',409,'EVENT_CLAIMED');
 state.claimed.push(index);milestone.rewards.forEach(grant);
 return{message:'Đã nhận quà sự kiện.',rewards:milestone.rewards};
}
export function exchangeEvent(p,input,pay,grant,now=Date.now()){
 const event=requireEvent(input.id,'exchange'),state=eventState(p,event,now),index=integer(input.index,0,99,'Gói'),offer=event.offers[index],count=integer(input.count??1,1,99,'Số lượng');
 requireCondition(offer,'Gói không tồn tại.',404);
 requireCondition(!offer.limit||(state.bought[index]||0)+count<=offer.limit,'Đã hết lượt đổi gói này.',409,'EVENT_LIMIT');
 pay({itemId:offer.cost.itemId,quantity:offer.cost.quantity*count});
 grant({itemId:offer.reward.itemId,quantity:offer.reward.quantity*count});state.bought[index]=(state.bought[index]||0)+count;
 return{message:'Đổi thành công.',rewards:[{...offer.reward,quantity:offer.reward.quantity*count}]};
}
export function prayEvent(p,input,pay,grant,now=Date.now(),random=max=>randomInt(max)){
 const event=requireEvent(input.id,'pray'),state=eventState(p,event,now),count=Number(input.count);
 requireCondition(count===1||count===10,'Số lượt không hợp lệ.');
 pay({itemId:event.cost.itemId,quantity:event.cost.quantity*count});
 const rewards=[];for(let i=0;i<count;i++){const won=event.pool[roll(event.pool,random)].reward;rewards.push(won);grant(won)}
 state.count+=count;
 return{message:`Đã cầu nguyện ${count} lượt.`,rewards};
}
export function spinEvent(p,input,pay,grant,now=Date.now(),random=max=>randomInt(max)){
 const event=requireEvent(input.id,'wheel'),state=eventState(p,event,now),count=Number(input.count);
 requireCondition(count===1||count===10,'Số lượt không hợp lệ.');
 pay({itemId:event.cost.itemId,quantity:event.cost.quantity*count});
 const hits=[];for(let i=0;i<count;i++){const index=roll(event.slots,random);hits.push(index);grant(event.slots[index].reward)}
 state.count+=count;
 return{message:`Đã quay ${count} lần.`,hits,rewards:hits.map(i=>event.slots[i].reward)};
}
export function freeEventGift(p,input,grant,now=Date.now()){
 const event=requireEvent(input.id,'wheel'),state=eventState(p,event,now),today=dayKey(now);
 requireCondition(state.freeDay!==today,'Hôm nay đã nhận quà ngày.',409,'EVENT_FREE_USED');
 state.freeDay=today;grant(event.daily);return{message:'Đã nhận quà ngày.',rewards:[event.daily]};
}
export function rollcallEvent(p,input,grant,now=Date.now()){
 const event=requireEvent(input.id,'rollcall'),state=eventState(p,event,now),today=dayKey(now);
 requireCondition(state.lastDay!==today,'Hôm nay đã điểm danh.',409,'ALREADY_CLAIMED');
 requireCondition(state.days<event.days.length,'Đã nhận hết quà điểm danh.',409,'EVENT_DONE');
 const rewards=event.days[state.days];state.days++;state.lastDay=today;rewards.forEach(grant);
 return{message:'Điểm danh thành công.',rewards};
}
/** Mua nguyên liệu của sự kiện (Ống nhòm, Xu vòng quay) bằng giá `buy.cost`, có giới hạn lượt mỗi kỳ. */
export function buyEventMaterial(p,input,pay,grant,now=Date.now()){
 const event=requireEvent(input.id);requireCondition(event.buy,'Sự kiện không bán nguyên liệu.');
 const state=eventState(p,event,now),used=state.bought.material||0,count=integer(input.count??1,1,99,'Số lượng'),material=event.material||event.cost.itemId;
 requireCondition(used+count<=event.buy.limit,'Đã hết lượt mua trong tháng.',409,'EVENT_LIMIT');
 pay({itemId:event.buy.cost.itemId,quantity:event.buy.cost.quantity*count});grant({itemId:material,quantity:count});state.bought.material=used+count;
 return{message:`Đã mua ${count} nguyên liệu.`,rewards:[{itemId:material,quantity:count}]};
}
/** Tốn nguyên liệu và trả về tầng đậu thần làm đội địch. Thua hoặc rút lui mất nguyên liệu, cứ điểm giữ nguyên. */
export function startEventStage(p,input,pay,now=Date.now()){
 const event=requireEvent(input.id,'stages'),state=eventState(p,event,now),stage=event.stages[state.stage];
 pay({itemId:event.material,quantity:1});
 return{floor:stage.floor+(state.round-1)*event.roundFloors,meta:{id:event.id,stage:state.stage,round:state.round,period:state.period,title:event.title}};
}
/** Trận đã lưu kỳ và cứ điểm lúc bắt đầu nên không nhận thưởng hai lần; trận kéo sang tháng mới không tính. */
export function finishEventStage(p,meta,grant,now=Date.now()){
 const event=requireEvent(meta.id,'stages'),state=eventState(p,event,now);
 if(state.period!==meta.period||state.stage!==meta.stage||state.round!==meta.round)return{items:[],counted:false};
 const stage=event.stages[state.stage];stage.rewards.forEach(grant);state.stage++;
 if(state.stage>=event.stages.length){state.stage=0;state.round++}
 return{items:stage.rewards,counted:true};
}
export function eventsView(p,now=Date.now()){
 const view={},today=dayKey(now);
 for(const event of eventList){
  const saved=p.events?.[event.id],live=saved?.period===periodKey(event,now);
  view[event.id]={count:live?saved.count:0,claimed:live?saved.claimed:[],bought:live?saved.bought:{},stage:live?saved.stage||0:0,round:live?saved.round||1:1,days:live?saved.days||0:0,rolledToday:live&&saved.lastDay===today,freeToday:live&&saved.freeDay===today,remaining:periodEnd(event,now)-now};
 }
 return view;
}

// ---- Điểm danh: mỗi ngày một ô, đủ số ô thì quay lại ô đầu. Không có ô bị bỏ lỡ.
export function checkinView(p,now=Date.now()){
 const c=p.checkin||{days:0,last:null},today=dayKey(now),done=c.last===today,next=vn(now),size=checkinRewards.length;next.setUTCHours(24,0,0,0);
 return{claimedDays:c.days%size===0&&done?size:c.days%size,total:c.days,canClaim:!done,nextIn:next.getTime()-vn(now).getTime()};
}
export function claimCheckin(p,grant,now=Date.now()){
 const c=p.checkin??={days:0,last:null},today=dayKey(now);
 requireCondition(c.last!==today,'Hôm nay đã nhận quà điểm danh.',409,'ALREADY_CLAIMED');
 const reward=checkinRewards[c.days%checkinRewards.length];c.days++;c.last=today;p.adventure.lastDaily=today;grant(reward);
 return{message:'Điểm danh thành công.',reward,rewards:[reward]};
}
