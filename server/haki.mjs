// Bảng Haki (E-skill gốc: PanelHeroESkill / PopupHeroESkill). Dữ liệu nguyên từ db_e_skill + icon skill_e_* (tools/export-haki.py).
//   - 5 bậc × 3 lựa chọn (Quan Sát / Vũ Trang / Bá Vương). Bậc n mở khi tướng thức tỉnh tới L n (hero_level gốc 10+n;
//     hệ sao web: L1-L5 = sao 15-19). Mỗi bậc kích hoạt đúng một Haki, đổi lựa chọn miễn phí.
//   - Chỉ số % Máu / % Công / Tốc cộng vào thuộc tính tướng (hiện ở lực chiến); phần còn lại là hiệu ứng trong trận
//     (team-combat.mjs đọc các trường haki* trên đơn vị).
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition} from './errors.mjs';

const data=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/haki.json',import.meta.url)),'utf8'));
export const hakiTiers=data.tiers.map(t=>({tier:t.tier,options:t.options.map(o=>o.id)}));
export const hakiUnlockStars=tier=>14+tier;
const tierOf=new Map(data.tiers.flatMap(t=>t.options.map(o=>[o.id,t.tier])));

// Hiệu ứng theo mô tả gốc. stats: cộng vào thuộc tính tướng; unit: trường trên đơn vị trận đấu.
const effects={
 1:{stats:{maxHp:.12}},                       // Tăng 12% máu
 2:{stats:{attack:.10}},                      // Tăng 10% công
 3:{stats:{speed:30}},                        // Tăng 30 tốc độ
 4:{unit:{hakiCritTaken:.15}},                // Giảm 15% sát thương khi bị đánh chí mạng
 5:{unit:{dotReduction:.15}},                 // Giảm 15% sát thương đốt, độc, chảy máu
 6:{unit:{healTaken:.15}},                    // Tăng 15% hồi máu nhận được
 7:{unit:{hakiRoundHeal:.15}},                // Cuối lượt hồi 15% máu đã mất
 8:{unit:{hakiRoundAttack:.03}},              // Cuối lượt tăng 3% công mỗi tướng còn sống (cả hai phe)
 9:{unit:{hakiRoundCleanse:.5}},              // Cuối lượt 50% loại bỏ 1 hiệu ứng bất lợi
 10:{unit:{hakiCritLeech:.15,hakiNoCrit:1}},  // Chí mạng: hồi 15% sát thương; không chí mạng: +100% sát thương
 11:{unit:{hakiLowShield:3}},                 // Máu dưới 50%: miễn 3 lần sát thương (một lần)
 12:{stats:{speed:100}},                      // Tăng 100 tốc độ
 13:{stats:{attack:.20},unit:{controlResist:.10}}, // Tăng 20% công, 10% miễn chống
 14:{stats:{maxHp:.20},unit:{damageReduction:.10}},// Tăng 20% máu, 10% giảm sát thương
 15:{unit:{hakiUltRefund:.3}},                // Dùng kỹ năng Nộ: 30% hồi lại 100 nộ
};

/** Haki đã chọn theo bậc: mảng 5 phần tử (id hoặc null). Bậc chưa mở không tính. */
export function hakiState(h){
 if(!Array.isArray(h.haki)||h.haki.length!==hakiTiers.length)h.haki=hakiTiers.map((t,i)=>Array.isArray(h.haki)&&t.options.includes(h.haki[i])?h.haki[i]:null);
 return h.haki;
}
export function activeHaki(h){
 const picked=Array.isArray(h.haki)?h.haki:[];
 return hakiTiers.map((t,i)=>h.stars>=hakiUnlockStars(t.tier)&&t.options.includes(picked[i])?picked[i]:null).filter(Boolean);
}
/** {maxHp, attack} là phần trăm, speed cộng thẳng. */
export function hakiStats(h){
 const out={maxHp:0,attack:0,speed:0};
 for(const id of activeHaki(h))for(const [k,v] of Object.entries(effects[id].stats||{}))out[k]+=v;
 return out;
}
/** Trường cộng vào đơn vị khi vào trận; `base` là chỉ số sẵn có (giảm ST, miễn chống... từ trang bị) để cộng dồn. */
export function hakiUnit(h,base={}){
 const out={};
 for(const id of activeHaki(h))for(const [k,v] of Object.entries(effects[id].unit||{}))out[k]=(out[k]??(base[k]||0))+v;
 return out;
}
export function hakiView(h){
 const picked=hakiTiers.map((t,i)=>Array.isArray(h.haki)&&t.options.includes(h.haki[i])?h.haki[i]:null);
 return{selected:picked,unlocked:hakiTiers.map(t=>h.stars>=hakiUnlockStars(t.tier)),unlockStars:hakiTiers.map(t=>hakiUnlockStars(t.tier))};
}
export function pickHaki(h,input){
 const id=Number(input.hakiId),tier=tierOf.get(id);
 requireCondition(tier,'Haki không tồn tại.',400);
 requireCondition(h.stars>=hakiUnlockStars(tier),`Cần thức tỉnh tướng tới L${tier} để mở Haki bậc ${tier}.`,409,'HAKI_LOCKED');
 const picked=hakiState(h);requireCondition(picked[tier-1]!==id,'Haki này đang được kích hoạt.',409,'HAKI_ACTIVE');
 picked[tier-1]=id;
 const option=data.tiers[tier-1].options.find(o=>o.id===id);
 return{message:`Đã kích hoạt Haki ${option.plain||option.name}.`,tier,hakiId:id};
}
