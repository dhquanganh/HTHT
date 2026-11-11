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
import {requireCondition} from './errors.mjs';

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
 const s=state(p,now);return{tile:s.tile,lap:s.lap,lapMax:config.lapMax,stars:s.stars,normal:s.normal,lucky:s.lucky,effect:s.effect,tarot:s.tarot,
  freeToday:s.freeDay!==dayKey(now),dailyDice:config.dailyDice,price:config.price,buyLeft:config.buyLimit-s.bought,tiles:board.map((_,i)=>tileView(s,i)),
  milestones:config.milestones.map(([stars,rewards],i)=>({stars,rewards,claimed:s.claimed.includes(i)}))};
}
const pick=(pool,rand)=>{const total=pool.reduce((n,x)=>n+x[1],0);let r=rand()*total;for(const [v,w] of pool){if(r<w)return v;r-=w}return pool.at(-1)[0]};
/** ctx: {grant(reward), payDiamonds(n), random?} */
export function diceAction(p,input,ctx,now=Date.now()){
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
