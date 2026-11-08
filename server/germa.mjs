// Ép Sao / Germa (EventEpSao "Void" của bản gốc). Dữ liệu nguyên từ Db/UpgradeVoid, UpgradeVoidSkillData_vi,
// Language_Void và db_hero_skill (tools/export-germa.py). Luật theo PanelEpSao / PopupLevelVoid / PopupSkillVoid:
//   - 16 nút: 1-3, 5-7, 9-11, 13-15 là nút chỉ số (Công Kích 30 cấp, Phòng Hộ 30 cấp, Uy Lực 10 cấp; nút 15 là Tốc 10 cấp),
//     4, 8, 12, 16 là nút kỹ năng (bị động 1, 2, 3 và Nộ thành bản Germa cấp 4).
//   - Trạng thái mỗi nút: -1 khóa, còn lại là cấp. Mở sẵn 3 nút đầu. Ba nút chỉ số trước một nút kỹ năng đều tối đa thì mở
//     nút kỹ năng đó; nút kỹ năng kích hoạt thì mở 3 nút chỉ số kế tiếp (SetNewListLevelDataActive).
//   - Nút chỉ số: cấp n cần cost[n-1] Nước mắt Mansherry (200019); chỉ số là buff[cấp-1] (mã 0 Công, 2 Máu, 3 Tốc, cộng thẳng).
//   - Nút kỹ năng: costHero tướng 10 sao (5/10/15/20) + costItem (Công nghệ Germa số 1/2/3 ×6), trả costItemBonus.
//     Bản web mỗi tướng là duy nhất nên không có tướng 10 sao trùng để hiến: mỗi tướng nguyên liệu đổi thành
//     heroShardPerHero mảnh của chính tướng đó.
//   - Thiết lập lại: 100 kim cương, hoàn toàn bộ nguyên liệu đã dùng.
// Bản gốc mở Ép Sao ở sao tối đa; bản web mở từ L1 (sao 15) theo yêu cầu.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition} from './errors.mjs';

const data=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/germa.json',import.meta.url)),'utf8'));
export const germaData=data;
export const germaUnlockStar=15,heroShardPerHero=10;
const nodes=data.nodes,levelNodes=nodes.filter(n=>n.type==='level');
const initial=()=>nodes.map((n,i)=>i<3?0:-1);
const pointField={0:'attack',2:'maxHp',3:'speed'};

export function germaState(h){
 if(!Array.isArray(h.germa)||h.germa.length!==nodes.length)h.germa=initial();
 h.germaSpent??={};return h.germa;
}
const maxOf=n=>n.type==='level'?n.cost.length:1;
/** Mở nút kế tiếp như SetNewListLevelDataActive. */
function unlockNext(levels){
 const first=levels.indexOf(-1);if(first<1)return;
 const prev=nodes[first-1];
 if(prev.type==='level'){if([0,1,2].every(k=>levels[first-1-k]===maxOf(nodes[first-1-k])))levels[first]=0}
 else if(levels[first-1]===1)for(let k=0;k<3&&first+k<levels.length;k++)levels[first+k]=0;
}
export const germaSkills=h=>data.heroes[h.avatar]||null;
/** Kỹ năng Germa đã kích hoạt: [{slot:1..4, skill}] (slot 1-3 bị động, 4 là Nộ). */
export function activeGermaSkills(h,avatar){
 const levels=Array.isArray(h.germa)?h.germa:[],set=data.heroes[avatar];if(!set)return[];
 return nodes.map((n,i)=>n.type==='skill'&&levels[i]===1?{slot:n.skill,skill:set.skills[n.skill-1]}:null).filter(Boolean);
}
/** Chỉ số cộng thẳng từ các nút chỉ số. */
export function germaStats(h){
 const out={attack:0,maxHp:0,speed:0};if(!Array.isArray(h.germa))return out;
 nodes.forEach((n,i)=>{const lv=h.germa[i];if(n.type!=='level'||!(lv>0))return;for(const [id,v] of Object.entries(n.buff[lv-1]))if(pointField[id])out[pointField[id]]+=v});
 return out;
}
export function germaView(h,avatar){
 if(h.stars<germaUnlockStar||!data.heroes[avatar])return null;
 return{levels:germaState(h),skills:activeGermaSkills(h,avatar).map(x=>({slot:x.slot,...x.skill})),stats:germaStats(h)};
}
const addSpent=(h,id,q)=>{h.germaSpent[id]=(h.germaSpent[id]||0)+q};
export function upgradeGerma(p,h,input,{pay,grant,shard,avatar}){
 requireCondition(h.stars>=germaUnlockStar,'Cần thức tỉnh tướng tới L1 để mở Ép Sao.',409,'GERMA_LOCKED');
 // Như checkHeroHaveEpSao: chỉ tướng có trong UpgradeVoidSkillData mới có Ép Sao.
 requireCondition(data.heroes[avatar],'Tướng này chưa có Ép Sao.',409,'GERMA_NO_SKILL');
 const levels=germaState(h),i=Number(input.node)-1,n=nodes[i];requireCondition(n,'Nút Germa không hợp lệ.',400);
 requireCondition(levels[i]>=0,'Hãy nâng cấp tối đa các nút trước để mở nút này.',409,'GERMA_NODE_LOCKED');
 requireCondition(levels[i]<maxOf(n),n.type==='level'?'Nút đã đạt cấp tối đa.':'Kỹ năng đã kích hoạt.',409,'GERMA_MAX');
 let bonus=null;
 if(n.type==='level'){const need=n.cost[levels[i]];pay({itemId:data.unlockItem,quantity:need});addSpent(h,data.unlockItem,need)}
 else{
   const shards=n.heroes*heroShardPerHero;pay({itemId:shard,quantity:shards});addSpent(h,shard,shards);
  if(n.item){pay(n.item);addSpent(h,n.item.itemId,n.item.quantity)}
  if(n.bonus){grant(n.bonus);bonus=n.bonus}
 }
 levels[i]++;unlockNext(levels);
 const message=n.type==='level'?`${n.name} ${levels[i]}/${maxOf(n)}`:`Kích hoạt ${data.heroes[avatar].skills[n.skill-1].name} cấp 4`;
 return{message,node:i+1,level:levels[i],rewards:bonus?[bonus]:[]};
}
export function resetGerma(p,h,{pay,grant}){
 const levels=germaState(h);requireCondition(levels.some(l=>l>0),'Germa chưa được nâng cấp.',409);
 pay({itemId:'diamonds',quantity:data.resetPrice});
 const rewards=Object.entries(h.germaSpent).filter(([,q])=>q>0).map(([itemId,quantity])=>({itemId,quantity}));
 for(const r of rewards)grant(r);
 h.germa=initial();h.germaSpent={};
 return{message:'Đã thiết lập lại Germa, hoàn trả toàn bộ nguyên liệu.',rewards};
}
