// Bộ kỹ năng của tướng triệu hồi, đọc từ mô tả gốc (hero-profiles.json): 1 kỹ năng Nộ + các kỹ năng Bị động.
// Mỗi câu được tách thành "hiệu ứng" có cấu trúc để team-combat.mjs mô phỏng:
//   damage  {mult|hpMult|defMult, hits, select:{count,pick,row}}
//   status  {kind: stun|freeze|silence|fear|petrify|panic, chance, turns, on:'target'}
//   dot     {kind: burn|poison|bleed, mult, turns}
//   stat    {attr, value, turns, on:'self'|'team'|'target'|'enemies'}   (value âm = giảm)
//   heal    {attack|maxHp, on:'self'|'team'|'lowest'}
//   shield  {maxHp|attack, turns, on:'self'|'team'}
//   energy  {value, on:'self'|'team'|'target'}
//   cleanse {count, on:'team'} / dispel {count, on:'target'}
// Bị động có thêm `stats` (chỉ số cộng thẳng khi vào trận) và trigger: attack (đánh thường), hurt (bị đánh),
// roundStart, roundEnd, allyUlt (đồng đội/bất kỳ ai dùng Nộ), lowHp, death.
// Số % Công được nén về thang của bản thử nghiệm (×0,6 như Tuyệt kỹ cũ); % chỉ số, lượt, cơ hội giữ nguyên.

const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const num=s=>Number(String(s).replace(',','.'));
export const damageScale=pct=>clamp(pct/100*.6,.4,6);

// Tên chỉ số trong mô tả → thuộc tính trận đấu. `pct` = phần trăm, `flat` = số cộng thẳng.
const STATS=[
 [/giảm\s*(?:ST|sát thương)\s*chí\s*mạng/i,'critResist'],
 [/(?:ST|sát thương)\s*chí\s*mạng/i,'critDamage'],
 [/chí\s*mạng/i,'critChance'],
 [/kháng\s*xuyên\s*(?:thủ|giáp)/i,'penResist'],
 [/xuyên\s*miễn\s*chống/i,'controlPierce'],
 [/xuyên\s*(?:thủ|giáp)/i,'penetration'],
 [/(?:ST|sát thương)\s*chuẩn/i,'trueDamage'],
 [/(?:ST|sát thương)\s*(?:nộ|kỹ năng|kĩ năng)/i,'skillDamage'],
 [/(?:miễn|giảm)\s*(?:ST|sát thương)\s*(?:trực tiếp|chuẩn)/i,'directReduction'],
 [/giảm\s*(?:ST|sát thương)/i,'damageReduction'],
 [/miễn\s*(?:chống|khống chế)|kháng\s*khống\s*chế/i,'controlResist'],
 [/né(?:\s*(?:tránh|sát thương|ST))?/i,'dodgeChance'],
 [/chặn/i,'block'],
 [/chính\s*xác/i,'accuracy'],
 [/hút\s*máu/i,'lifesteal'],
 [/(?:khả năng\s*)?nhận\s*hồi\s*máu/i,'healTaken'],
 [/hiệu\s*quả\s*hồi\s*máu/i,'healPower'],
 [/tốc(?:\s*độ)?/i,'speed'],
 [/nộ/i,'energy'],
 [/máu/i,'maxHp'],
 [/công/i,'attack'],
 [/thủ|giáp/i,'defense'],
];
export const statOf=text=>{for(const [re,attr] of STATS)if(re.test(text))return attr;return null};

const STATUS=[[/choáng|ngưng\s*động|trói\s*buộc|áp\s*chế/i,'stun'],[/đóng\s*băng|băng\s*phong|băng\s*giá/i,'freeze'],[/câm\s*lặng|trầm\s*mặc|im\s*lặng/i,'silence'],[/uy\s*hiếp|sợ\s*hãi/i,'fear'],[/hóa\s*đá/i,'petrify'],[/hoảng\s*loạn/i,'panic']];
const DOT=[[/thiêu\s*đốt|viêm\s*hỏa|bỏng(?!\s*điện)|cháy|\bđốt/i,'burn'],[/trúng\s*độc|\bđộc\b/i,'poison'],[/chảy\s*máu/i,'bleed']];
export const statusNames={stun:'Choáng',freeze:'Đóng băng',silence:'Câm lặng',fear:'Uy hiếp',petrify:'Hóa đá',panic:'Hoảng loạn',burn:'Thiêu đốt',poison:'Trúng độc',bleed:'Chảy máu'};

const turnsIn=t=>{const m=/(\d+)\s*(?:lượt|hiệp|lươt)/i.exec(t);if(m)return Number(m[1]);if(/vĩnh viễn|đến chết/i.test(t))return 99;return null};
const chanceIn=t=>{const m=/(\d+(?:[.,]\d+)?)\s*%\s*(?:cơ hội|xác suất|tỉ lệ|tỷ lệ|khả năng)|(?:có|với)\s*(\d+(?:[.,]\d+)?)\s*%(?!\s*(?:Công|Máu|Thủ))/i.exec(t);return m?clamp(num(m[1]||m[2])/100,0,1):1};

/** Chọn mục tiêu theo mô tả: số lượng, cách chọn và hàng. */
export function selectOf(t){
 const all=/những kẻ địch|các kẻ địch|(toàn bộ|tất cả|toàn thể)\s*(?:phe\s*|kẻ\s*|quân\s*|đội\s*)?(?:địch|kẻ thù)|toàn\s*địch|(?:^|[^\d]\s)đội\s*địch|cả\s*đội\s*địch|phe\s*địch/i.test(t);
 const back=/hàng\s*sau/i.test(t),front=/hàng\s*(?:trước|đầu)/i.test(t)&&!/vai trò hàng đầu/i.test(t);
 const pick=/(?:thấp\s*máu|máu\s*(?:hiện tại\s*)?thấp)\s*nhất|ít máu nhất/i.test(t)?'lowest':/nộ\s*cao\s*nhất/i.test(t)?'rage':/công\s*cao\s*nhất/i.test(t)?'attack':/máu\s*(?:tối đa\s*)?cao\s*nhất/i.test(t)?'highestHp':/ngẫu\s*nhiên|bất\s*k[ìỳ]/i.test(t)?'random':back?'back':'front';
 const n=/(\d+)\s*(?:kẻ\s*|mục tiêu\s*)?(?:địch|kẻ thù|mục tiêu)/i.exec(t);
 if(/(?:hàng\s*sau|hàng\s*(?:trước|đầu))\s*(?:của\s*)?(?:đội|quân|phe)\s*địch|(?:toàn bộ|tất cả)\s*(?:kẻ\s*)?địch\s*hàng/i.test(t))return{count:6,pick,row:back?'back':'front'};
 if(all)return{count:6,pick,row:null};
 return{count:n?clamp(Number(n[1]),1,6):1,pick,row:back?'back':front?'front':null};
}

/** Tách các hiệu ứng trong một câu / mệnh đề. `kind` = 'ult' | 'attack' | 'trigger'. */
export function effectsOf(sentence,{actorDamage=true}={}){
 const t=sentence,out=[];
 // Sát thương
 const atk=/(?:gây|tấn công|đánh)(?:(?!tăng|giảm|hồi)[^.;])*?\(?\s*(\d+(?:[.,]\d+)?)\s*%\s*Công\)?|\(?\s*(\d+(?:[.,]\d+)?)\s*%\s*Công\)?\s*(?:lên|cho|vào)\s*[^.;]*(?:địch|kẻ thù|mục tiêu)|(?:^|\s)(?:sát thương|ST)\s*\(\s*(\d+(?:[.,]\d+)?)\s*%\s*Công/i.exec(t);
 // "% Máu tối đa bản thân" (có cả lỗi gõ "máu tối ta"); "chia đều cho số mục tiêu" chia theo số địch.
 const hpDmg=/(?:gây|tấn công)[^.;]*?(?:sát thương|ST)[^.;]*?(\d+)\s*%\s*(?:lượng\s*)?máu\s*tối\s*[đt]a\s*(?:của\s*)?bản thân/i.exec(t);
 // "% Máu tối đa của kẻ địch / mục tiêu" (Karasu): tính theo máu mục tiêu, có trần.
 const foeHp=/(?:gây|tấn công)[^.;]*?(?:sát thương|ST)\s*(?:bằng\s*)?(\d+)\s*%\s*Máu\s*tối\s*đa\s*của\s*(?:kẻ địch|mục tiêu|địch)/i.exec(t);
 const defDmg=/(?:sát thương|ST)\s*(?:bằng\s*)?Thủ\s*[x*×]\s*(\d+)/i.exec(t);
 // Câu chỉ có % Công đi sau chữ DoT ("gây chảy máu (115% Công)") là DoT, không phải đòn đánh.
 const dotAt=Math.min(...DOT.map(([re])=>{const i=t.search(re);return i<0?Infinity:i}));
 if(actorDamage&&(atk||hpDmg||defDmg||foeHp)&&!(!hpDmg&&!defDmg&&!foeHp&&atk&&atk.index>dotAt&&!/(?:gây|tấn công)[^.;]{0,30}(?:sát thương|ST)/i.test(t.slice(0,dotAt)))){
  const hits=Number(/(\d+)\s*(?:lần|đợt)(?!\s*(?:chiêu|kỹ năng))/i.exec(t)?.[1]||1);
  const e={type:'damage',hits:clamp(hits,1,5),select:selectOf(t)};
  if(atk)e.mult=damageScale(num(atk[1]||atk[2]||atk[3]));
  if(foeHp){e.foeHp=clamp(Number(foeHp[1])/100*.6,.02,.6);e.cap=4}
  if(hpDmg)e.hpMult=clamp(Number(hpDmg[1])/100*.6,.05,.8)/(/chia đều/i.test(t)?Math.max(1,e.select.count):1);
  if(defDmg)e.defMult=clamp(Number(defDmg[1])/1000,1,6);
  if(/sát thương\s*(?:trực tiếp|chuẩn)|bỏ qua (?:thủ|giáp)/i.test(t))e.pierce=true;
  if(/(?:chắc chắn|luôn)\s*chí\s*mạng/i.test(t))e.critical=true;
  out.push(e);
 }
 // Khống chế
 for(const [re,kind] of STATUS)if(re.test(t)&&!/kháng|miễn|giải|xóa|loại bỏ/i.test(t.slice(Math.max(0,t.search(re)-14),t.search(re))))out.push({type:'status',kind,chance:chanceIn(t),turns:turnsIn(t)||1});
 // Sát thương theo lượt
 for(const [re,kind] of DOT){
  if(!re.test(t))continue;const after=t.slice(t.search(re)),m=/\(?\s*(\d+(?:[.,]\d+)?)\s*%\s*Công/i.exec(after)||/\(?\s*(\d+(?:[.,]\d+)?)\s*%\s*Công/i.exec(t);
  if(/xóa|loại bỏ|kháng|miễn/i.test(t.slice(Math.max(0,t.search(re)-16),t.search(re))))continue;
  out.push({type:'dot',kind,mult:damageScale(m?num(m[1]):60)*.6,turns:turnsIn(after)||turnsIn(t)||2,chance:chanceIn(t)});
 }
 // Hồi máu
 const healAtk=/hồi\s*(?:phục\s*)?(?:máu\s*)?(?:bằng\s*)?\(?\s*(\d+(?:[.,]\d+)?)\s*%\s*Công/i.exec(t)||/hồi\s*máu[^.;]{0,20}?\(?\s*(\d+(?:[.,]\d+)?)\s*%\s*Công/i.exec(t);
 const healHp=/hồi\s*(?:phục\s*)?(?:máu\s*)?(?:bằng\s*)?(\d+(?:[.,]\d+)?)\s*%\s*(?:lượng\s*)?Máu/i.exec(t)||(!healAtk&&/hồi\s*máu[^.;]{0,48}?(\d+(?:[.,]\d+)?)\s*%\s*(?:lượng\s*)?Máu/i.exec(t));
 if(healAtk||healHp){const on=/toàn đội|toàn bộ đồng minh|tất cả đồng minh|cả đội|phe ta/i.test(t)?'team':/thấp máu nhất|máu thấp nhất|đồng minh/i.test(t)&&!/bản thân|tự/i.test(t)?'lowest':'self';
  const many=/(\d+)\s*đồng\s*(?:đội|minh)/i.exec(t);
  out.push({type:'heal',...(healAtk?{attack:clamp(num(healAtk[1])/100,.1,3)}:{maxHp:clamp(num(healHp[1])/100,.02,.6)}),on:many&&/đồng\s*(?:đội|minh)/i.test(t)?'some':on,...(many?{count:Number(many[1])}:{})})}
 // Khiên
 const shield=/(?:khiên|lá chắn)[^.;]*?(\d+(?:[.,]\d+)?)\s*%\s*(Máu|Công)|(\d+(?:[.,]\d+)?)\s*%\s*(Máu|Công)[^.;]{0,40}(?:khiên|lá chắn)/i.exec(t);
 if(shield){const pct=num(shield[1]||shield[3])/100,base=(shield[2]||shield[4]).toLowerCase();out.push({type:'shield',...(base==='máu'?{maxHp:clamp(pct,.03,.6)}:{attack:clamp(pct,.1,4)}),turns:turnsIn(t)||2,on:/toàn đội|đồng minh|cả đội/i.test(t)?'team':'self'})}
 else if(/khiên\s*chặn\s*(\d+)?\s*đợt|chặn\s*\d*\s*đợt\s*sát thương/i.test(t))out.push({type:'shield',block:Number(/chặn\s*(\d+)\s*đợt/i.exec(t)?.[1]||1),turns:turnsIn(t)||1,on:'self'});
 // Nộ
 const gain=/(?:tăng|hồi|nhận|hồi phục)\s*(?:thêm\s*)?(?:cho\s*)?(?:bản thân\s*|toàn đội\s*)?(\d+)\s*(?:điểm\s*)?Nộ/i.exec(t);
 const drain=/(?:giảm|hấp thụ|đốt|xóa)\s*(\d+)\s*(?:điểm\s*)?Nộ/i.exec(t);
 if(drain)out.push({type:'energy',value:-Number(drain[1]),on:'target',chance:chanceIn(t.slice(0,drain.index+drain[0].length)),steal:/hấp thụ/i.test(drain[0])});
 if(gain&&!(drain&&drain.index===gain.index))out.push({type:'energy',value:Number(gain[1]),on:/toàn đội|cả đội|đồng minh/i.test(gain[0]+t.slice(Math.max(0,gain.index-20),gain.index))?'team':'self'});
 // Xóa hiệu ứng
 const cleanse=/xóa\s*(\d+)?\s*(?:hiệu\s*(?:ứng|quả)|trạng\s*thái)\s*(?:bất lợi|xấu|có hại|khống chế)/i.exec(t);
 if(cleanse)out.push({type:'cleanse',count:Number(cleanse[1]||2),on:/toàn đội|cả đội|đồng minh/i.test(t)?'team':'self'});
 const dispel=/xóa\s*(\d+)?\s*(?:hiệu\s*(?:ứng|quả)|trạng\s*thái)\s*(?:tốt|có lợi|tăng)/i.exec(t);
 if(dispel)out.push({type:'dispel',count:Number(dispel[1]||1),chance:chanceIn(t)});
 if(/phản\s*(?:công|đòn|kích)(?!\s*sát thương)/i.test(t))out.push({type:'counter',chance:chanceIn(t)});
 // Hồi sinh khi chết; tung lại Nộ; thêm lượt hành động; kháng / miễn dịch khống chế.
 const revive=/hồi\s*sinh[^.;]*?(\d+)\s*%\s*Máu/i.exec(t);if(revive)out.push({type:'revive',maxHp:Number(revive[1])/100});
 if(/kích hoạt\s*(?:thêm\s*\d*\s*lần\s*)?(?:kỹ năng|kĩ năng)\s*Nộ/i.test(t))out.push({type:'castUlt',chance:chanceIn(t)});
 if(/thêm\s*1?\s*(?:lần|lượt)\s*hành động|hành động ngay lập tức/i.test(t))out.push({type:'extraAction',chance:chanceIn(t)});
 for(const [re,kind] of STATUS){const m=new RegExp('(?:(\\d+)\\s*%\\s*)?(?:kháng|miễn\\s*dịch|miễn\\s*nhiễm)\\s*(?:các hiệu ứng\\s*)?(?:'+re.source+')','i').exec(t);if(m)out.push({type:'resist',kind,value:m[1]?Number(m[1])/100:1})}
 if(/miễn\s*dịch[^.;]{0,30}(?:mất kiểm soát|khống chế)/i.test(t))for(const [,kind] of STATUS)out.push({type:'resist',kind,value:1});
 if(/chí\s*mạng[^.;]{0,40}gấp\s*(?:ba|3)\s*lần/i.test(t))out.push({type:'stat',attr:'critDamage',value:1.5,flat:false,turns:99,on:'self'});
 // Tăng / giảm chỉ số có thời hạn: "tăng bản thân 35% Công, 50% ST Chuẩn duy trì 4 lượt", "Giảm 25% chí mạng của toàn
 // thể phe địch duy trì 1 lượt", "tăng vĩnh viễn 70 Tốc Độ". Đoạn tính từ động từ tới động từ kế tiếp.
 const verbs=[...t.matchAll(/\b(tăng|giảm|gây|hồi|tạo|xóa|tấn công)\b/gi)].filter(m=>!/\d\s*%?\s*$/.test(t.slice(Math.max(0,m.index-6),m.index)));
 verbs.forEach((m,i)=>{
  const verb=m[1].toLowerCase();if(verb!=='tăng'&&verb!=='giảm')return;
  const segment=t.slice(m.index,verbs[i+1]?.index??t.length),before=t.slice(Math.max(0,m.index-40),m.index),turns=turnsIn(segment)||turnsIn(t.slice(m.index));
  if(/lần này|mỗi\s*(?:1\s*)?(?:điểm|tầng|hiệu)|chỉ số cơ bản|tối đa tăng/i.test(segment)||/(?:sát thương|ST)\s*(?:gây ra\s*)?(?:lần này\s*)?$/i.test(before))return;
  const on=/toàn đội|tất cả đồng minh|đồng minh|cả đội|phe ta/i.test(segment+before)?'team':verb==='giảm'?(/bản thân/i.test(segment)?'self':/toàn bộ|tất cả|toàn thể|đội địch|phe địch|những kẻ địch/i.test(segment+before)?'enemies':'target'):'self';
  for(const v of segment.matchAll(/(\d+(?:[.,]\d+)?)\s*(%)?\s*((?:[A-Za-zÀ-ỹ]+\s*){1,4})/g)){
   const attr=statOf(v[3].replace(/\b(?:của|cho|lên|địch|kẻ|toàn|thể|phe|bản|thân|duy|trì|trong|mục|tiêu).*$/i,'')||v[3]);if(!attr||attr==='energy'||/lượt|hiệp|cơ hội|lần/i.test(v[3].slice(0,8)))continue;
   if(attr==='damageReduction'&&verb==='giảm'&&!v[2])continue;
   const value=(v[2]?num(v[1])/100:num(v[1]))*(verb==='giảm'?-1:1);
   out.push({type:'stat',attr,value,flat:!v[2],turns:turns||(verb==='giảm'?2:3),on,...(/tốc độ thấp hơn/i.test(segment)?{cond:'slower'}:{})});
  }
 });
 // "Mục tiêu có 75% nhận thêm sát thương bằng 350% Công": đòn phụ có xác suất lên mục tiêu chính.
 const extra=/(?:mục tiêu|kẻ địch)\s*(?:có\s*)?(\d+)\s*%\s*(?:cơ hội\s*)?nhận thêm\s*(?:sát thương|ST)\s*(?:bằng\s*)?\(?(\d+(?:[.,]\d+)?)\s*%\s*Công/i.exec(t);
 if(extra)out.push({type:'damage',hits:1,select:{count:1,pick:'front',row:null},mult:damageScale(num(extra[2])),chance:Number(extra[1])/100,followUp:true});
 // Khống chế / DoT không có đòn đánh trong câu: áp lên kẻ địch theo cách chọn của câu (vd đầu hiệp gây Uy Hiếp).
 if(!out.some(e=>e.type==='damage'))for(const e of out)if(e.type==='status'||e.type==='dot'){e.select=selectOf(t);if(/tốc độ thấp hơn/i.test(t))e.cond='slower'}
 return out;
}
// Bỏ ngoặc giải thích (Uy Hiếp: ..., tối đa ..., không bao gồm ...) để không nhầm thành trigger hay số liệu chính.
const stripNotes=s=>s.replace(/\(([^()]*)\)/g,(m,inner)=>/:|tối đa|không bao gồm|trừ|nhiều hơn|ít hơn/i.test(inner)?' ':m);

/** Chỉ số cộng thẳng của bị động: "Bị động: Tăng bản thân 35% Máu, 45% Công, 150 Tốc Độ, 50 Nộ". */
// Đọc lần lượt "N% Tên" từ đầu danh sách, dừng ở mục đầu tiên không phải chỉ số; phần còn lại trả về để đọc tiếp.
function staticStats(sentence){
 const m=/^\s*(?:Bị động:\s*)?(?:Bản thân\s+)?(?:Tăng|tăng)\s+(?:bản thân\s+)?(.*)$/i.exec(sentence);if(!m)return null;
 const parts=m[1].split(/,|\s+và\s+/),stats={};let used=0;
 for(const part of parts){
  const v=/^\s*(\d+(?:[.,]\d+)?)\s*(%)?\s*([^\d%]+)$/.exec(part);const attr=v&&statOf(v[3]);
  if(!attr||/khi|nếu|mỗi|duy trì|lượt|cơ hội/i.test(v[3])){if(used)break;return null}
  const key=attr+(v[2]||attr==='energy'?'':'Flat'),value=v[2]?num(v[1])/100:num(v[1]);stats[key]=(stats[key]||0)+value;used++;
 }
 return used?{stats,rest:parts.slice(used).join(', ')}:null;
}

const TRIGGERS=[
 // Thứ tự quan trọng: "Khi bị Đánh Thường hoặc Nộ..." là bị đánh, không phải đánh thường.
 [/^(?:Bị động:\s*)?(?:khi|mỗi khi|mỗi lần)\s*(?:bản thân\s*)?bị\s*(?:đánh|tấn công)|^(?:Bị động:\s*)?(?:khi|mỗi khi|mỗi lần)?\s*(?:bản thân\s*)?nhận\s*(?:sát thương|ST)|^(?:Bị động:\s*)?bị\s*(?:đánh|tấn công)/i,'hurt'],
 [/^(?:Bị động:\s*)?(?:khi\s*)?(?:đánh|tấn công)\s*thường|^(?:Bị động:\s*)?(?:khi|mỗi khi|mỗi lần)\s*(?:bản thân\s*)?(?:tấn công|đánh)(?:\s*thường)?(?![^,]{0,12}nộ)/i,'attack'],
 [/(?:đầu|bắt đầu|khi bắt đầu)\s*trận(?:\s*đấu)?|khi vào trận/i,'battleStart'],
 [/đầu\s*(?:mỗi\s*)?(?:hiệp|lượt)|bắt đầu\s*(?:mỗi\s*)?(?:hiệp|lượt)/i,'roundStart'],
 [/cuối\s*(?:mỗi\s*)?(?:hiệp|lượt)/i,'roundEnd'],
 [/(?:khi|mỗi khi|bất cứ|bất kỳ|bất kì)[^.;]{0,30}(?:đồng đội|đồng minh|tướng nào|ai|có tướng)[^.;]{0,20}(?:dùng|sử dụng|tung)\s*(?:kỹ năng\s*)?nộ/i,'allyUlt'],
 [/(?:khi|mỗi khi)\s*(?:bản thân\s*)?(?:dùng|sử dụng|tung)\s*(?:kỹ năng\s*)?nộ/i,'selfUlt'],
 [/(?:máu|HP)\s*(?:bản thân\s*)?(?:dưới|thấp hơn)\s*(\d+)\s*%|dưới\s*(\d+)\s*%\s*máu/i,'lowHp'],
 [/khi\s*(?:bản thân\s*)?(?:chết|tử vong|bị hạ|bị tiêu diệt)/i,'death'],
 [/(?:khi|mỗi khi)\s*(?:tiêu diệt|hạ gục)/i,'kill'],
];

/** Một kỹ năng → {passive, stats, triggers:[{on, effects, ...}], ult:{effects}}; `notes` ghi câu chưa mô phỏng. */
export function compileSkill(skill){
 const text=String(skill.description||'').replace(/\s+/g,' ').replace(/thuờng/gi,'thường').replace(/tần\s*công/gi,'tấn công').replace(/lươt/gi,'lượt').trim(),passive=!!skill.passive;
 const body=text.replace(/^(?:Bị động|Nộ)\s*:\s*/i,'');
 // Tách câu nhưng giữ số thập phân (12.5%) và ngoặc giải thích (Uy Hiếp: ...).
 const sentences=stripNotes(body).split(/(?<!\d)\.(?!\d)|;/).map(s=>s.trim()).filter(Boolean);
 const result={name:skill.name,passive,stats:{},triggers:[],effects:[],notes:[]};
 const addStats=st=>{for(const [k,v] of Object.entries(st))result.stats[k]=(result.stats[k]||0)+v};
 let current=null;
 for(let s of sentences){
  if(passive){
   const st=staticStats(s);
   if(st){addStats(st.stats);s=st.rest.trim();if(!s)continue;
    // Phần còn lại cùng câu: "có 80% tỉ lệ Né Sát Thương", "các đòn tấn công của bản thân chắc chắn Chí Mạng".
    if(!TRIGGERS.some(([re])=>re.test(s))){let found=false;
     if(/chắc chắn\s*chí\s*mạng|luôn\s*chí\s*mạng/i.test(s)){addStats({critChance:1});found=true}
     for(const v of s.matchAll(/(\d+(?:[.,]\d+)?)\s*%\s*(?:tỉ lệ|tỷ lệ|cơ hội)?\s*((?:[A-Za-zÀ-ỹ]+\s*){1,4})/g)){const attr=statOf(v[2]);if(attr&&!/bỏ qua|giới hạn/i.test(v[2])){addStats({[attr]:num(v[1])/100});found=true}}
     if(/bỏ qua\s*(?:sát thương|ST)\s*và\s*hiệu ứng/i.test(s)){const v=/(\d+)\s*%/.exec(s);if(v){addStats({dodgeChance:Number(v[1])/100});found=true}}
     if(!found)result.notes.push(s);continue}
   }
   const trig=TRIGGERS.find(([re])=>re.test(s));
   if(trig){const effects=effectsOf(s);const low=trig[1]==='lowHp'?Number((/(\d+)\s*%/.exec(s)||[])[1]||30)/100:undefined;
    current={on:trig[1],effects,...(trig[1]==='hurt'&&/phản\s*(?:công|đòn|kích)/i.test(s)&&!effects.some(e=>e.type==='counter')?{}:{}),...(trig[1]==='allyUlt'&&/bất cứ|bất kỳ|bất kì|có tướng|ai\s/i.test(s)?{scope:'any'}:{}),...(low?{threshold:low}:{}),...(trig[1]==='attack'&&effects.some(e=>e.type==='damage')?{replace:true}:{}),...(trig[1]==='hurt'?{from:/chí mạng/i.test(s)?'critical':/nộ/i.test(s)&&!/đánh thường/i.test(s)?'ultimate':'any'}:{}),chance:chanceIn(s.split(/gây|tăng|hồi|giảm/i)[0]||'')};
    result.triggers.push(current);if(!effects.length)result.notes.push(s);continue}
   // Câu nối tiếp ("Đồng thời ...", "Sau đó ...") thuộc trigger đứng trước.
   const effects=effectsOf(s,{actorDamage:!!current});
   if(current&&effects.length){current.effects.push(...effects);continue}
   if(effects.length){result.triggers.push({on:'battleStart',effects:effects.filter(e=>e.type!=='damage')});continue}
   result.notes.push(s);
  }else{
   let effects=effectsOf(s).filter(e=>e.type!=='resist');
   // "Sát thương thiêu đốt từ (150%Công)..." bổ sung lượng cho DoT đã nêu ở câu trước: gộp, không tạo DoT thứ hai.
   effects=effects.filter(e=>{if(e.type!=='dot')return true;const prev=result.effects.find(x=>x.type==='dot'&&x.kind===e.kind);if(prev&&!/gây|tấn công/i.test(s)){prev.mult=e.mult;return false}return true});
   if(effects.length)result.effects.push(...effects);else result.notes.push(s);
  }
 }
 if(!passive&&!result.effects.some(e=>e.type==='damage')&&/gây|tấn công/i.test(body))result.notes.push('(không đọc được sát thương)');
 return result;
}

/** Bộ kỹ năng đầy đủ của một tướng từ hero-profiles: ultimate = kỹ năng không bị động đầu tiên. */
export function kitFromProfile(profile){
 const skills=profile.skills||[],ult=skills.find(s=>!s.passive),passives=skills.filter(s=>s.passive);
 const compiled=passives.map(compileSkill),stats={};
 for(const p of compiled)for(const [k,v] of Object.entries(p.stats))stats[k]=(stats[k]||0)+v;
 return{ultimate:ult?compileSkill(ult):null,passives:compiled,stats,triggers:compiled.flatMap(p=>p.triggers.map(t=>({...t,skill:p.name})))};
}
