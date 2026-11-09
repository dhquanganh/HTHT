// Chiến dịch (Event Raid gốc: PopupEventRaid -> PopupListRaidChallenge -> CellRaidChallenge). Luật theo chữ gốc:
//   - 3 loại: Beli (Cướp Xu, mở cấp 20), Nguyên liệu (cấp 25: Đá EXP / Đá đột phá), Mảnh hải tặc (cấp 30).
//   - Mỗi ngày 2 lượt khiêu chiến miễn phí mỗi loại; thắng mới bị trừ lượt, thua không bị trừ; mua thêm lượt bằng kim cương.
//   - Cấp người chơi càng cao mở mức khó hơn, mức càng khó thưởng càng nhiều (mức n mở ở cấp 20 + 10 × (n - 1)).
// Bảng mức (thưởng, lực chiến, cấp mở) nằm ở máy chủ gốc (EventRaidStatus) nên bản web dựng bảng mặc định khớp ảnh gốc
// (Beli mức 1-3: 20K/35K/50K vàng, lực chiến 20K/60K/100K; Nguyên liệu mức 4: 50K EXP tướng, 25 Đá cường hóa, 10 Bụi ma thuật;
// Mảnh hải tặc mức 4: 7 / 3 / 2 Mảnh 3 / 4 / 5 sao) và cho admin sửa (collection raid_config).
import {requireCondition,GameError} from './errors.mjs';

export const raidModes={
 gold:{id:'gold',name:'Beli',title:'Cướp Xu',minLevel:20,help:'1. Cấp 20 sẽ được mở khiêu chiến Beli, chiến thắng sẽ được nhiều Beli.'},
 spirit:{id:'spirit',name:'Nguyên liệu',title:'Nguyên liệu',minLevel:25,help:'1. Cấp 25 sẽ được mở khiêu chiến Nguyên Liệu, chiến thắng sẽ được nhiều Đá EXP, Đá đột phá'},
 hero:{id:'hero',name:'Mảnh hải tặc',title:'Anh Hùng',minLevel:30,help:'1. Cấp 30 sẽ được mở khiêu chiến Mảnh Hải Tặc, chiến thắng sẽ được nhiều Mảnh Hải Tặc.'},
};
export const raidCommonHelp='2. Mỗi ngày có 2 lượt khiêu chiến miễn phí, chiến thắng sẽ bị trừ, thua không bị trừ.\n3. Tăng cấp độ người chơi có thể tăng mức khiêu chiến khó hơn, mức khó càng cao thì thưởng nhận được càng nhiều.\n4. Mua thêm lượt khiêu chiến bằng kim cương, mỗi ngày có giới hạn số lần mua.';
const levelsCount=10,r=(itemId,quantity)=>({itemId,quantity});
export function defaultRaidConfig(){
 const unlock=(mode,i)=>Math.max(raidModes[mode].minLevel,20+10*i),power=i=>20000+40000*i;
 return{freeTurns:2,buyPrice:50,buyLimit:5,modes:{
  gold:{levels:Array.from({length:levelsCount},(_,i)=>({unlock:unlock('gold',i),power:power(i),rewards:[r('gold',20000+15000*i)]}))},
  spirit:{levels:Array.from({length:levelsCount},(_,i)=>({unlock:unlock('spirit',i),power:power(i),rewards:[r('spirit',20000+10000*i),r('consumable:2',10+5*i),r('consumable:3',4+2*i)]}))},
  hero:{levels:Array.from({length:levelsCount},(_,i)=>({unlock:unlock('hero',i),power:power(i),rewards:[r('shard:10000',i+4),r('shard:20000',Math.ceil((i+1)/2)+1),r('shard:30000',1+Math.floor((i+1)/4))]}))},
 }};
}
/** Kiểm tra cấu hình admin gửi lên (số nguyên dương, vật phẩm tồn tại, 1-30 mức mỗi loại, 1-6 phần thưởng mỗi mức). */
export function validateRaidConfig(input,isRewardId){
 requireCondition(input&&typeof input==='object','Cấu hình không hợp lệ.');
 const int=(v,label,min,max)=>{requireCondition(Number.isSafeInteger(v)&&v>=min&&v<=max,`${label} phải là số nguyên từ ${min} đến ${max}.`);return v};
 const out={freeTurns:int(input.freeTurns,'Lượt miễn phí',0,100),buyPrice:int(input.buyPrice,'Giá mua lượt',0,1000000),buyLimit:int(input.buyLimit,'Số lần mua',0,100),modes:{}};
 for(const mode of Object.keys(raidModes)){
  const levels=input.modes?.[mode]?.levels;requireCondition(Array.isArray(levels)&&levels.length>=1&&levels.length<=30,`${raidModes[mode].name}: cần 1-30 mức.`);
  out.modes[mode]={levels:levels.map((l,i)=>{const label=`${raidModes[mode].name} mức ${i+1}`;
   requireCondition(Array.isArray(l?.rewards)&&l.rewards.length>=1&&l.rewards.length<=6,`${label}: cần 1-6 phần thưởng.`);
   return{unlock:int(l.unlock,`${label}: cấp mở`,1,1000),power:int(l.power,`${label}: lực chiến`,1,1e12),
    rewards:l.rewards.map(x=>{requireCondition(isRewardId(x?.itemId),`${label}: vật phẩm không tồn tại.`);return{itemId:x.itemId,quantity:int(x.quantity,`${label}: số lượng`,1,1e12)}})}})};
 }
 return out;
}
export const vnDay=(now=Date.now())=>Math.floor((now+7*3600000)/86400000);
export function raidState(p,now=Date.now()){
 const s=p.raid&&typeof p.raid==='object'?p.raid:{};const day=vnDay(now);
 if(s.day!==day){s.day=day;s.used={gold:0,spirit:0,hero:0};s.bought={gold:0,spirit:0,hero:0}}
 s.cleared??={gold:0,spirit:0,hero:0};p.raid=s;return s;
}
export function raidView(p,config,now=Date.now()){
 const s=raidState(structuredClone(p),now),level=p.account.level;
 return{freeTurns:config.freeTurns,buyPrice:config.buyPrice,buyLimit:config.buyLimit,help:raidCommonHelp,
  modes:Object.values(raidModes).map(m=>({id:m.id,name:m.name,title:m.title,minLevel:m.minLevel,open:level>=m.minLevel,help:m.help,
   turns:Math.max(0,config.freeTurns+s.bought[m.id]-s.used[m.id]),maxTurns:config.freeTurns+s.bought[m.id],boughtToday:s.bought[m.id],cleared:s.cleared[m.id]||0,
   levels:config.modes[m.id].levels.map((l,i)=>({index:i+1,unlock:l.unlock,power:l.power,rewards:l.rewards,open:level>=l.unlock}))}))};
}
const mode=id=>{requireCondition(Object.hasOwn(raidModes,id),'Loại khiêu chiến không hợp lệ.');return id};
export function raidBuy(p,input,config,spendDiamonds,now=Date.now()){
 const m=mode(input.mode),s=raidState(p,now);requireCondition(s.bought[m]<config.buyLimit,'Đã hết lượt mua hôm nay.',409,'BUY_LIMIT');
 spendDiamonds(config.buyPrice);s.bought[m]++;return{message:'Đã mua thêm 1 lượt khiêu chiến.'};
}
/** Kiểm tra trước khi đánh (cấp mở loại / mức, còn lượt) và trả mức đã chọn. */
export function raidPrepare(p,input,config,now=Date.now()){
 const m=mode(input.mode),info=raidModes[m],s=raidState(p,now),levels=config.modes[m].levels,index=Number(input.level);
 requireCondition(p.account.level>=info.minLevel,`Cấp ${info.minLevel} sẽ được mở khiêu chiến ${info.name}.`,403,'LEVEL_REQUIRED');
 requireCondition(Number.isInteger(index)&&index>=1&&index<=levels.length,'Mức khiêu chiến không hợp lệ.');
 const lv=levels[index-1];requireCondition(p.account.level>=lv.unlock,`Cấp ${lv.unlock} mở`,403,'LEVEL_REQUIRED');
 requireCondition(config.freeTurns+s.bought[m]-s.used[m]>0,'Đã hết lượt khiêu chiến hôm nay.',409,'NO_TURNS');
 return{mode:m,index,level:lv};
}
/** Càn quét (ButtonSmash): mức đã từng thắng thì nhận thưởng ngay, trừ 1 lượt, không cần đánh. */
export function raidSmash(p,input,config,grant,now=Date.now()){
 const {mode,index,level}=raidPrepare(p,input,config,now),s=raidState(p,now);
 requireCondition(index<=(s.cleared[mode]||0),'Hãy đánh thắng mức này trước khi càn quét.',409,'NOT_CLEARED');
 s.used[mode]++;for(const x of level.rewards)grant(x);return{message:`Càn quét ${raidModes[mode].title} mức ${index}.`,rewards:level.rewards};
}
/** Thắng: trừ 1 lượt và nhận thưởng của mức (thua không trừ lượt). */
export function raidFinish(p,b,grant,now=Date.now()){
 const s=raidState(p,now),m=b.raid.mode;
 if(b.status!=='won'){b.reward={won:false,items:[]};return b.reward}
 if(s.day!==b.raid.day){b.reward={won:true,items:[],counted:false};return b.reward}
 s.used[m]++;s.cleared[m]=Math.max(s.cleared[m]||0,b.raid.index);for(const x of b.raid.rewards)grant(x);
 b.reward={won:true,items:b.raid.rewards,counted:true};return b.reward;
}
// Đội địch: chia đều lực chiến của mức cho 3-6 tướng (mức càng cao càng đông), tỉ lệ Công / Máu / Thủ như tướng thường
// (lực chiến = Công × 2,4 + Máu × 0,13 + Thủ × 2, Máu ≈ 5,5 × Công, Thủ ≈ 0,25 × Công).
export function raidEnemyStats(power,count){
 const per=power/count,attack=Math.max(10,Math.round(per/(2.4+5.5*.13+.25*2)));
 return{attack,maxHp:Math.round(attack*5.5),defense:Math.round(attack*.25)};
}
export function raidError(msg){throw new GameError(msg)}
