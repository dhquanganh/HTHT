// Đổ xúc xắc (SuperDice gốc: PanelDiceEvent / DiceTileUI / DiceTableUI / PanelDiceSelectCard / PanelDiceSelectNumber).
// Luật theo mã Lua gốc:
//   - Bàn 22 ô + ô xuất phát (0). Ô tài nguyên (cấp 1-3, vật phẩm hoặc sao -100) và ô kích hoạt: +1 xúc xắc thường (5),
//     +1 xúc xắc may mắn (6), lá bài Tarot (3), choáng (4: lần sau chẵn tiến, lẻ lùi), xuất phát (7).
//   - Xúc xắc thường: ra ngẫu nhiên 1-6. Xúc xắc may mắn: tự chọn số (PanelDiceSelectNumber).
//   - Đi qua ô xuất phát hết 1 vòng ("Thuyền trưởng đã hoàn thành 1 vòng phần thưởng!"), Vòng x/y.
//   - Dừng ở ô tài nguyên: nhận tài nguyên, ô lên 1 cấp (tối đa 3, hiệu ứng Lvlup). Ô sao: đi qua hay dừng đều nhận sao
//     ("Khi đi qua ô này thì nhận được số sao tương ứng"); tích sao đổi quà mốc (PanelDiceReward).
//   - Tarot chọn 1 trong 3 lá: 1 Tài nguyên, 2 X2 điểm lần sau, 5 Đi lùi lần sau, 6 Tăng cấp 1 ô, 9 Giảm cấp 1 ô,
//     7 Về điểm khởi đầu, 8 Mất tài nguyên (không nhận thưởng ở lần đi kế).
//   - Mỗi ngày nhận xúc xắc miễn phí (ButtonFree "Xúc xắc hằng ngày"); mua thêm bằng kim cương (ButtonAddDice), có giới hạn.
// Số liệu máy chủ gốc (bàn, lượng thưởng, mốc sao, giá, số vòng) không có trong client nên do bản web đặt theo testMap gốc.
import {randomInt} from 'node:crypto';
import {requireCondition,integer} from './errors.mjs';

export const STAR=-100,T={start:7,dice1:5,dice2:6,tarot:3,dizzy:4};
// testMap gốc (DiceMapUI.lua) + 2 ô cuối cho đủ 22 ô. key: 1 EXP tướng, 2 Đá cường hóa, 3 Bụi, 11 Hồn chiến hạm, 12 Đá hỗn độn.
const res=(key,amount)=>({type:1,key,amount}),trg=t=>({type:2,trigger:t});
export const board=[res(1,20000),res(2,150),res(3,150),res(STAR,5),trg(T.dice1),res(3,150),res(1,20000),res(2,150),res(3,150),trg(T.tarot),res(STAR,5),
 res(1,20000),res(11,20),res(3,150),trg(T.dizzy),res(1,20000),res(2,150),res(STAR,5),res(12,10),trg(T.dice2),res(3,150),trg(T.tarot)];
export const rewardOf={1:'spirit',2:'consumable:2',3:'consumable:3',11:'material:ship-soul',12:'material:ship-chaos'};
export const config={dailyDice:5,price:20,buyLimit:30,lapMax:10,lapStars:20,
 milestones:[[20,[{itemId:'gold',quantity:100000}]],[50,[{itemId:'consumable:16',quantity:1}]],[100,[{itemId:'diamonds',quantity:200}]],[200,[{itemId:'consumable:16',quantity:3}]],
  [350,[{itemId:'consumable:178',quantity:2}]],[500,[{itemId:'diamonds',quantity:500}]],[800,[{itemId:'consumable:37',quantity:1}]],[1200,[{itemId:'consumable:53',quantity:1}]]]};
const tarotPool=[[1,30],[2,20],[5,10],[6,15],[9,10],[7,5],[8,10]];
// ---- Cấu hình quản trị (dice_config): bật / tắt, xúc xắc mỗi ngày, giá, giới hạn mua, vòng, sao mỗi vòng, mốc sao, 22 ô bàn,
// tỉ lệ lá Tarot. `board`, `config`, `tarotPool` được sửa tại chỗ để mọi chỗ đang dùng thấy ngay giá trị mới.
export const tileKeys=[1,2,3,11,12,STAR],triggers=[T.dice1,T.dice2,T.tarot,T.dizzy],tarotEffects=[1,2,5,6,7,8,9];
const original={board:structuredClone(board),config:structuredClone(config),tarot:structuredClone(tarotPool)};
export function defaultDiceConfig(){
 return{enabled:true,dailyDice:original.config.dailyDice,price:original.config.price,buyLimit:original.config.buyLimit,lapMax:original.config.lapMax,lapStars:original.config.lapStars,
  milestones:original.config.milestones.map(([stars,rewards])=>({stars,rewards:structuredClone(rewards)})),
  board:original.board.map(t=>t.type===1?{type:1,key:t.key,amount:t.amount}:{type:2,trigger:t.trigger}),tarot:original.tarot.map(([effect,weight])=>({effect,weight}))};
}
export const diceConfig=()=>({enabled:config.enabled!==false,dailyDice:config.dailyDice,price:config.price,buyLimit:config.buyLimit,lapMax:config.lapMax,lapStars:config.lapStars,
 milestones:config.milestones.map(([stars,rewards])=>({stars,rewards})),board:board.map(t=>t.type===1?{type:1,key:t.key,amount:t.amount}:{type:2,trigger:t.trigger}),tarot:tarotPool.map(([effect,weight])=>({effect,weight}))});
export function applyDiceConfig(c){
 c=c||defaultDiceConfig();
 Object.assign(config,{enabled:c.enabled!==false,dailyDice:c.dailyDice,price:c.price,buyLimit:c.buyLimit,lapMax:c.lapMax,lapStars:c.lapStars,milestones:c.milestones.map(m=>[m.stars,m.rewards])});
 board.splice(0,board.length,...c.board.map(t=>t.type===1?res(t.key,t.amount):trg(t.trigger)));tarotPool.splice(0,tarotPool.length,...c.tarot.map(t=>[t.effect,t.weight]));
 return c;
}
export function validateDiceConfig(input,isRewardId){
 requireCondition(input&&typeof input==='object','Thiếu cấu hình.');const n=(v,l,a,b)=>integer(v,a,b,l);
 const rewards=(list,label)=>{requireCondition(Array.isArray(list)&&list.length>=1&&list.length<=10,`${label}: cần 1-10 phần thưởng.`);return list.map(x=>{requireCondition(typeof x?.itemId==='string'&&isRewardId(x.itemId),`${label}: vật phẩm không tồn tại.`,404);return{itemId:x.itemId,quantity:n(x.quantity,`${label}: số lượng`,1,1e12)}})};
 requireCondition(Array.isArray(input.board)&&input.board.length===22,'Bàn cần đúng 22 ô.');
 requireCondition(Array.isArray(input.milestones)&&input.milestones.length<=30,'Tối đa 30 mốc sao.');
 requireCondition(Array.isArray(input.tarot)&&input.tarot.length===tarotEffects.length,'Cần tỉ lệ cho đủ 7 lá Tarot.');
 const tarot=input.tarot.map((t,i)=>{requireCondition(tarotEffects.includes(Number(t?.effect)),`Lá Tarot ${i+1}: không hợp lệ.`);return{effect:Number(t.effect),weight:n(t.weight,`Lá Tarot ${i+1}: tỉ lệ`,0,1e6)}});
 requireCondition(new Set(tarot.map(t=>t.effect)).size===tarot.length&&tarot.some(t=>t.weight>0),'Tỉ lệ Tarot không hợp lệ.');
 const milestones=input.milestones.map((m,i)=>({stars:n(m?.stars,`Mốc ${i+1}: số sao`,1,1e9),rewards:rewards(m?.rewards,`Mốc ${i+1}`)})).sort((a,b)=>a.stars-b.stars);
 requireCondition(new Set(milestones.map(m=>m.stars)).size===milestones.length,'Hai mốc sao trùng nhau.');
 const tiles=input.board.map((t,i)=>{
  if(Number(t?.type)===2){requireCondition(triggers.includes(Number(t.trigger)),`Ô ${i+1}: loại ô kích hoạt không hợp lệ.`);return{type:2,trigger:Number(t.trigger)}}
  requireCondition(tileKeys.includes(Number(t?.key)),`Ô ${i+1}: tài nguyên không hợp lệ.`);return{type:1,key:Number(t.key),amount:n(t.amount,`Ô ${i+1}: số lượng`,1,1e9)}});
 return{enabled:input.enabled!==false,dailyDice:n(input.dailyDice,'Xúc xắc mỗi ngày',0,1000),price:n(input.price,'Giá 1 xúc xắc',1,1e6),buyLimit:n(input.buyLimit,'Mua tối đa / ngày',0,1e4),
  lapMax:n(input.lapMax,'Số vòng tối đa',1,1000),lapStars:n(input.lapStars,'Sao mỗi vòng',0,1e6),milestones,board:tiles,tarot};
}
const weekKey=now=>{const d=new Date(now+7*3600000),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);return d.toISOString().slice(0,10)};
const dayKey=now=>new Date(now+7*3600000).toISOString().slice(0,10);
function state(p,now){
 const week=weekKey(now);
 if(p.dice?.week!==week)p.dice={week,tile:0,lap:0,stars:0,normal:0,lucky:0,levels:board.map(()=>1),effect:0,tarot:false,claimed:[],bought:0,freeDay:null,boughtDay:null};
 const s=p.dice,day=dayKey(now);if(s.boughtDay!==day){s.boughtDay=day;s.bought=0}return s;
}
export const tileAmount=(i,level)=>Math.round(board[i].amount*(board[i].key===STAR?level:1+(level-1)*.5));
function tileView(s,i){const t=board[i];return t.type===1?{type:1,key:t.key,level:s.levels[i],amount:tileAmount(i,s.levels[i]),itemId:rewardOf[t.key]||null}:{type:2,trigger:t.trigger}}
export function diceView(p,now=Date.now()){
 const s=state(p,now);return{enabled:config.enabled!==false,tile:s.tile,lap:s.lap,lapMax:config.lapMax,stars:s.stars,normal:s.normal,lucky:s.lucky,effect:s.effect,tarot:s.tarot,
  freeToday:s.freeDay!==dayKey(now),dailyDice:config.dailyDice,price:config.price,buyLeft:config.buyLimit-s.bought,tiles:board.map((_,i)=>tileView(s,i)),
  milestones:config.milestones.map(([stars,rewards],i)=>({stars,rewards,claimed:s.claimed.includes(i)}))};
}
const pick=(pool,rand)=>{const total=pool.reduce((n,x)=>n+x[1],0);let r=rand()*total;for(const [v,w] of pool){if(r<w)return v;r-=w}return pool.at(-1)[0]};
/** ctx: {grant(reward), payDiamonds(n), random?} */
export function diceAction(p,input,ctx,now=Date.now()){
 requireCondition(config.enabled!==false,'Đổ xúc xắc đang tạm đóng.',403,'EVENT_OFF');
 const s=state(p,now),rand=ctx.random||(()=>randomInt(1e9)/1e9),gains=[];
 const give=(itemId,quantity)=>{if(!itemId||quantity<=0)return;ctx.grant({itemId,quantity});gains.push({itemId,quantity})};
 if(input.op==='free'){requireCondition(s.freeDay!==dayKey(now),'Hôm nay đã nhận xúc xắc miễn phí.');s.freeDay=dayKey(now);s.normal+=config.dailyDice;return{message:`Nhận ${config.dailyDice} xúc xắc.`}}
 if(input.op==='buy'){const n=Number(input.count)||1;requireCondition(Number.isInteger(n)&&n>0&&n<=config.buyLimit-s.bought,'Đã hết lượt mua hôm nay.');ctx.payDiamonds(n*config.price);s.bought+=n;s.normal+=n;return{message:`Đã mua ${n} xúc xắc.`}}
 if(input.op==='claim'){
  const i=Number(input.index),m=config.milestones[i];requireCondition(m,'Mốc không hợp lệ.');requireCondition(!s.claimed.includes(i),'Đã nhận phần thưởng này.');
  requireCondition(s.stars>=m[0],`Cần ${m[0]} sao.`);s.claimed.push(i);for(const r of m[1])ctx.grant(r);return{message:'Đã nhận thưởng.',rewards:m[1]};
 }
 if(input.op==='tarot'){
  requireCondition(s.tarot,'Không có lá bài để mở.');s.tarot=false;const effect=pick(tarotPool,rand),out={effect};
  if(effect===1){const opts=Object.values(rewardOf),itemId=opts[Math.floor(rand()*opts.length)],q=itemId==='spirit'?40000:itemId==='material:ship-chaos'?20:300;give(itemId,q);out.reward={itemId,quantity:q}}
  else if(effect===2||effect===5||effect===8)s.effect=effect;
  else if(effect===7){s.tile=0}
  else{const list=board.map((t,i)=>i).filter(i=>board[i].type===1&&(effect===6?s.levels[i]<3:s.levels[i]>1));
   if(list.length){const i=list[Math.floor(rand()*list.length)];s.levels[i]+=effect===6?1:-1;out.tileId=i+1;out.tile=tileView(s,i)}}
  return{message:'',tarot:out,rewards:gains};
 }
 requireCondition(input.op==='roll','Thao tác không hợp lệ.');requireCondition(!s.tarot,'Hãy mở lá bài trước.');
 const lucky=input.lucky===true;
 if(lucky){requireCondition(s.lucky>0,'Hết xúc xắc!!!');const n=Number(input.number);requireCondition(Number.isInteger(n)&&n>=1&&n<=6,'Hãy chọn số.');s.lucky--}
 else{requireCondition(s.normal>0,'Hết xúc xắc!!!');s.normal--}
 const point=lucky?Number(input.number):1+Math.floor(rand()*6);
 let move=point;const eff=s.effect;s.effect=0;
 if(eff===2)move=point*2;else if(eff===5)move=-point;else if(eff===4)move=point%2===0?point:-point;
 const start=s.tile,dir=Math.sign(move),passed=[];let tile=start,laps=0;
 for(let k=0;k<Math.abs(move);k++){tile+=dir;if(tile>22){tile-=23;laps++}if(tile<0)tile+=23;passed.push(tile)}
 // Dùng 0..22: 0 là ô xuất phát, 1..22 là DiceTile1..22. Đi tiến qua ô 0 là xong vòng.
 s.tile=tile;
 for(let i=0;i<laps&&s.lap<config.lapMax;i++){s.lap++;s.stars+=config.lapStars;gains.push({itemId:'diceStar',quantity:config.lapStars})}
 const noReward=eff===8;
 for(const t of passed){if(t===0||noReward)continue;const b=board[t-1];if(b.type===1&&b.key===STAR&&(t!==tile)){const q=tileAmount(t-1,s.levels[t-1]);s.stars+=q;gains.push({itemId:'diceStar',quantity:q})}}
 let landed=null;
 if(tile>0){
  const i=tile-1,b=board[i];
  if(b.type===1){if(!noReward){const q=tileAmount(i,s.levels[i]);if(b.key===STAR){s.stars+=q;gains.push({itemId:'diceStar',quantity:q})}else give(rewardOf[b.key],q)}if(s.levels[i]<3)s.levels[i]++;landed=tileView(s,i)}
  else if(b.trigger===T.dice1)s.normal++;else if(b.trigger===T.dice2)s.lucky++;else if(b.trigger===T.tarot)s.tarot=true;else if(b.trigger===T.dizzy)s.effect=4;
 }
 return{message:laps?'Thuyền trưởng đã hoàn thành 1 vòng phần thưởng!':'',point,move,from:start,to:tile,laps,landed,gains,tarot:s.tarot,effect:s.effect};
}
