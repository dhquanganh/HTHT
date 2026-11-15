// Đấu Trường Tân Tinh / Siêu Tân Tinh (bundle `lua_novaarena`, NovaRoot). Luật theo client Lua gốc:
//   - NovaField: Đăng ký (0) → Vòng loại 1 (1) → Vòng loại 2 (2) → Vòng bảng 1 (3) → Vòng bảng 2 (4) → Vòng 16 (5:
//     tứ kết 6 / bán kết 7 / chung kết 8); -1 = đóng (kết thúc mùa giải, vinh danh top 4).
//   - Mỗi vòng có trạng thái Chuẩn bị (1) / Đánh tự do (2) / Đánh tự động (3); vòng 16: Chuẩn bị / Đặt cược / Đang đánh /
//     Kết thúc (NovaBanner). Đội hình 3 đội (PopupFormation3, ToListServerHeroId3LineUp); mỗi trận là loạt 3 hiệp.
//   - Vòng loại: "Top 4 người chơi trong vòng sẽ được đi tiếp"; vòng bảng: top 2 (NovaBattle.setView2).
//   - Bảng thách đấu (NovaBattleCell): mỗi đối thủ trong nhóm đánh 1 lần, kết quả Thắng/Thua kèm tỉ số.
//   - Tướng đề xuất (RecBar) + chỉ số buff (NovaBuffPopup: mã db_point_view, giá trị × num_rate).
//   - Dự đoán vòng 16 (NovaPopupPredict): chọn người thắng từng trận, thưởng đoán đúng / sai.
//   - Vinh danh top 4 mùa trước (NovaTop) + thích nhận quà; nhiệm vụ (QUEST nhóm 5); cửa hàng (MARKET 19).
// Server gốc giữ lịch, thưởng, nhiệm vụ, cửa hàng: bản web đặt mặc định dưới đây, quản trị sửa ở tab "Tân Tinh".
import {requireCondition,integer} from './errors.mjs';

export const stages={1:{name:'Vòng loại 1',field:256,group:8,advance:4},2:{name:'Vòng loại 2',field:128,group:8,advance:4},3:{name:'Vòng bảng 1',field:64,group:4,advance:2},4:{name:'Vòng bảng 2',field:32,group:4,advance:2}};
export const finalRounds=[{id:'r16',name:'Vòng 16',at:20*60},{id:'qf',name:'Vòng tứ kết',at:20*60+30},{id:'sf',name:'Vòng bán kết',at:21*60},{id:'final',name:'Chung kết',at:21*60+30}];
export const stageNames={0:'Đăng Ký',1:'Vòng loại 1',2:'Vòng loại 2',3:'Vòng bảng 1',4:'Vòng bảng 2',5:'Vòng 16',6:'Vòng tứ kết',7:'Vòng bán kết',8:'Chung kết'};
export const currency='consumable:207';
const DAY=86400000,HOUR=3600000,VN=7*HOUR;
// Mùa = tuần theo giờ Việt Nam, bắt đầu thứ Hai 00:00. Mùa 1 = tuần chứa 03/11/2025.
const epoch=Date.UTC(2025,10,3)-VN;
export function schedule(now=Date.now()){
 const season=Math.floor((now-epoch)/(7*DAY))+1,start=epoch+(season-1)*7*DAY,day=Math.floor((now-start)/DAY),min=Math.floor((now-start-day*DAY)/60000);
 const at=(d,m)=>start+d*DAY+m*60000;let status,state,until;
 if(day===0){status=0;state=0;until=at(1,0)}
 else if(day<=4){status=day;state=min<8*60?1:min<22*60?2:3;until=state===1?at(day,8*60):state===2?at(day,22*60):at(day+1,0)}
 else if(day===5){status=5;state=min<12*60?1:min<20*60?2:min<22*60?3:4;until=state===1?at(5,12*60):state===2?at(5,20*60):state===3?at(5,22*60):at(6,0)}
 else{status=-1;state=0;until=at(7,0)}
 const date=t=>new Date(t+VN).toISOString().slice(5,10).split('-').reverse().join('/');
 return{season,start,end:at(7,0),status,state,until,countdown:Math.max(0,Math.ceil((until-now)/1000)),textSub:`${date(start)} - ${date(at(6,0))}`,
  stageEnd:day>=1&&day<=4?at(day+1,0):null,roundAt:id=>at(5,finalRounds.find(r=>r.id===id).at)};
}
/** Lịch trình (NovaPopupSchedule): mỗi giai đoạn một dòng ngày / giờ / trạng thái 0 chưa / 1 đang / 2 đã kết thúc. */
export function scheduleRows(now=Date.now()){
 const s=schedule(now),day=d=>new Date(s.start+d*DAY+VN).toISOString().slice(5,10).split('-').reverse().join('/');
 const rows=[{roundId:0,day:0,time:'00:00 - 24:00'},...[1,2,3,4].flatMap(r=>[{roundId:r,day:r,time:'08:00 - 22:00',sub:'Đánh tự do'},{roundId:r,day:r,time:'22:00 - 24:00',sub:'Đánh tự động'}]),
  {roundId:5,day:5,time:'12:00 - 20:00',sub:'Đặt cược'},...finalRounds.map((r,i)=>({roundId:5+i,day:5,time:`${String(Math.floor(r.at/60)).padStart(2,'0')}:${String(r.at%60).padStart(2,'0')}`}))];
 return rows.map(r=>{const begin=s.start+r.day*DAY,finish=begin+DAY;const st=now<begin?0:now<finish?1:2;return{roundId:r.roundId,status:st,textDay:day(r.day),textTime:r.time,subStatus:r.sub||''}});
}

const it=(itemId,quantity)=>({itemId,quantity});
// Bật / tắt (quản trị): tắt thì ẩn toà nhà khỏi bản đồ và từ chối mọi thao tác.
export const defaultNovaConfig=()=>({enabled:true,...baseNovaConfig()});
function baseNovaConfig(){
 return{minLevel:60,botBoost:1,
  // Tướng đề xuất: buff mã db_point_view (‰). Danh sách tướng đổi theo mùa từ nhóm này (để trống = chọn ngẫu nhiên).
  recommendCount:5,recommendPool:[],buff:[[100,200],[102,200],[101,150]],
  register:[it(currency,20)],
  stageRewards:[1,2,3,4].map(s=>({stage:s,advance:[it(currency,20*s),it('gold',100000*s)],out:[it(currency,10*s),it('gold',50000*s)]})),
  finalRewards:[[it(currency,1000),it('diamonds',1000),it('consumable:208',5)],[it(currency,700),it('diamonds',600),it('consumable:208',3)],[it(currency,500),it('diamonds',400),it('consumable:208',2)],[it(currency,300),it('diamonds',200),it('consumable:208',1)],[it(currency,200),it('diamonds',100)]],
  bet:{correct:[it(currency,30),it('gold',100000)],wrong:[it(currency,10)]},
  like:[it('gold',50000),it(currency,5)],
  quests:[{id:1,title:'Đăng ký tham gia Đấu Trường Tân Tinh',kind:'register',target:1,rewards:[it(currency,20)]},
   {id:2,title:'Khiêu chiến 5 lần',kind:'attack',target:5,rewards:[it(currency,30)]},{id:3,title:'Khiêu chiến 20 lần',kind:'attack',target:20,rewards:[it(currency,60),it('diamonds',100)]},
   {id:4,title:'Thắng 10 trận',kind:'win',target:10,rewards:[it(currency,50)]},{id:5,title:'Dự đoán 5 trận vòng 16',kind:'bet',target:5,rewards:[it(currency,40)]},
   {id:6,title:'Thích 1 người chơi trong bảng vinh danh',kind:'like',target:1,rewards:[it(currency,10)]}],
  shop:[{id:1,reward:it('consumable:208',1),price:200,limit:5},{id:2,reward:it('diamonds',100),price:150,limit:10},{id:3,reward:it('consumable:16',1),price:80,limit:10},
   {id:4,reward:it('consumable:2027',1),price:1500,limit:1},{id:5,reward:it('consumable:2026',1),price:600,limit:2},{id:6,reward:it('gold',500000),price:50,limit:20}]};
}
let config=defaultNovaConfig();
export const novaConfig=()=>config;
export function applyNovaConfig(c){config=c||defaultNovaConfig();return config}
export const validateNovaConfig=(input,...rest)=>({enabled:input?.enabled!==false,...checkNovaConfig(input,...rest)});
function checkNovaConfig(input,isRewardId,isHero=()=>true){
 requireCondition(input&&typeof input==='object','Thiếu cấu hình.');
 const n=(v,label,min,max)=>integer(v,min,max,label);
 const rewards=(list,label,min=0)=>{requireCondition(Array.isArray(list)&&list.length>=min&&list.length<=10,`${label}: cần ${min}-10 phần thưởng.`);return list.map(x=>{requireCondition(typeof x?.itemId==='string'&&isRewardId(x.itemId),`${label}: vật phẩm không tồn tại.`,404);return it(x.itemId,n(x.quantity,`${label}: số lượng`,1,1e12))})};
 requireCondition(Array.isArray(input.buff)&&input.buff.length<=10,'Buff: tối đa 10 dòng.');
 const buff=input.buff.map(([id,v],i)=>[n(id,`Buff ${i+1}: mã chỉ số`,0,100000),n(v,`Buff ${i+1}: giá trị`,1,100000)]);
 const pool=(Array.isArray(input.recommendPool)?input.recommendPool:[]).map(String);for(const h of pool)requireCondition(isHero(h),'Tướng đề xuất không tồn tại.',404);
 requireCondition(Array.isArray(input.stageRewards)&&input.stageRewards.length===4,'Cần thưởng cho 4 vòng.');
 requireCondition(Array.isArray(input.finalRewards)&&input.finalRewards.length===5,'Cần thưởng: vô địch, á quân, top 4, top 8, top 16.');
 requireCondition(Array.isArray(input.quests)&&input.quests.length<=30,'Tối đa 30 nhiệm vụ.');requireCondition(Array.isArray(input.shop)&&input.shop.length<=40,'Tối đa 40 món trong cửa hàng.');
 const kinds=['register','attack','win','bet','like'];
 return{minLevel:n(input.minLevel,'Cấp tối thiểu',1,1000),botBoost:Math.max(.1,Math.min(10,Number(input.botBoost)||1)),recommendCount:n(input.recommendCount,'Số tướng đề xuất',0,10),recommendPool:[...new Set(pool)],buff,
  register:rewards(input.register,'Quà đăng ký'),
  stageRewards:input.stageRewards.map((s,i)=>({stage:i+1,advance:rewards(s.advance,`${stages[i+1].name}: đi tiếp`),out:rewards(s.out,`${stages[i+1].name}: bị loại`)})),
  finalRewards:input.finalRewards.map((r,i)=>rewards(r,['Vô địch','Á quân','Top 4','Top 8','Top 16'][i])),
  bet:{correct:rewards(input.bet?.correct,'Dự đoán đúng'),wrong:rewards(input.bet?.wrong,'Dự đoán sai')},like:rewards(input.like,'Quà thích'),
  quests:input.quests.map((q,i)=>{requireCondition(kinds.includes(q.kind),`Nhiệm vụ ${i+1}: loại không hợp lệ.`);requireCondition(typeof q.title==='string'&&q.title.trim()&&q.title.length<=120,`Nhiệm vụ ${i+1}: thiếu tên.`);return{id:i+1,title:q.title.trim(),kind:q.kind,target:n(q.target,`Nhiệm vụ ${i+1}: mục tiêu`,1,100000),rewards:rewards(q.rewards,`Nhiệm vụ ${i+1}`,1)}}),
  shop:input.shop.map((s,i)=>({id:i+1,reward:rewards([s.reward],`Cửa hàng ${i+1}`,1)[0],price:n(s.price,`Cửa hàng ${i+1}: giá`,1,1e9),limit:n(s.limit,`Cửa hàng ${i+1}: giới hạn`,1,1e6)}))};
}

/** Xếp hạng nhóm: thắng nhiều hơn, rồi tổng hiệp thắng, rồi thắng sớm hơn (NovaRankData: numberWin, numberTeamWin, timeWinPass). */
export const rankGroup=members=>[...members].sort((a,b)=>(b.wins||0)-(a.wins||0)||(b.teamWins||0)-(a.teamWins||0)||(a.lastWin||0)-(b.lastWin||0)||String(a.id).localeCompare(String(b.id)));
/** Kết quả nhanh khi không có người chơi thật (bot gặp bot): theo lực chiến có ngẫu nhiên. */
export function quickSeries(powerA,powerB,rand){
 const pa=Math.max(1,powerA),pb=Math.max(1,powerB),p=pa*pa/(pa*pa+pb*pb);let a=0,b=0;
 while(a<2&&b<2){if(rand()<p)a++;else b++}
 return{win:a>b,score:[a,b]};
}
export function seeded(seed){let x=(seed>>>0)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}}
/** Thứ tự hạt giống 16 người (hạng 1 gặp 16, 8 gặp 9...). */
export const bracketSeeds=[1,16,8,9,5,12,4,13,3,14,6,11,7,10,2,15];
/** Nhóm nhiệm vụ theo loại để cộng tiến độ. */
export function questView(q){const progress=q?.progress||{},claimed=q?.claimed||[];return config.quests.map(x=>{const v=Math.min(x.target,progress[x.kind]||0);return{...x,number:v,status:claimed.includes(x.id)?2:v>=x.target?1:0}})}
/** Buff tướng đề xuất (lstPointBuff, ‰): 100 % Công, 101 % Thủ, 102 % Máu, 103 % Tốc độ. Áp lên bản sao đơn vị trận đấu. */
export function applyNovaBuff(units,heroes,buff=config.buff){
 const set=new Set(heroes);
 for(const u of units){if(!set.has(u.heroId))continue;
  for(const [id,v] of buff){const k=1+v/1000;
   if(id===100){u.attack=Math.round(u.attack*k);if(u.baseAttack)u.baseAttack=Math.round(u.baseAttack*k)}
   else if(id===101){u.defense=Math.round(u.defense*k);if(u.baseDefense)u.baseDefense=Math.round(u.baseDefense*k)}
   else if(id===102){u.maxHp=Math.round(u.maxHp*k);u.hp=u.maxHp}
   else if(id===103){u.speed=Math.round(u.speed*k);if(u.baseSpeed)u.baseSpeed=Math.round(u.baseSpeed*k)}}
  u.novaBuff=true}
 return units;
}
/** Trạng thái nhiệm vụ / cửa hàng / thích của người chơi trong mùa (mùa mới thì làm lại). */
export function novaPlayerState(p,season){
 if(!p.nova||p.nova.season!==season)p.nova={season,team:p.nova?.team||null,quests:{progress:{},claimed:[]},shop:{},likes:[]};
 const s=p.nova;s.quests??={progress:{},claimed:[]};s.quests.progress??={};s.quests.claimed??=[];s.shop??={};s.likes??=[];return s;
}
export const questTrack=(s,kind,n=1)=>{s.quests.progress[kind]=(s.quests.progress[kind]||0)+n};
