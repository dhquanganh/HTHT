// Nội dung phụ bản do trang quản trị chỉnh (tab "Phụ bản" và "Quái").
//   monsters: {avatar: {hp, atk, def, spd (phần trăm, mặc định 100), disabled}} — áp cho mọi quái của Luyện tập, Mê cung,
//             Đảo Bánh; quái bị tắt không được chọn vào đội hình ngẫu nhiên.
//   stages:   {mode: {key: {enemies: [avatar...] (1–6, thứ tự = vị trí 1..6), scale (phần trăm sức mạnh, mặc định 100)}}}
//             key: Luyện tập / Đảo Bánh = số ải; Mê cung = "<hệ>-<ải>".
//   level:    cấp quái — đặt ở ải (stages[mode][key].level, cho cả ải) hoặc ở quái (monsters[avatar].level); ải ưu tiên.
//             Chỉ số nhân theo đường cong tăng trưởng của tướng (server/game.mjs heroStats) giữa cấp mới và cấp gốc
//             (cấp trung bình các tướng làm chuẩn chỉ số của phụ bản).
//   counts:   {sealed, dungeon} — số ải (thêm ải mới). Luyện tập cố định 15 ải vì bản đồ gốc có 15 điểm.
// Module này không phụ thuộc tính năng nào để brave / sealed / dungeon đều import được.
export const content={monsters:{},stages:{brave:{},sealed:{},dungeon:{}},counts:{}};
const listeners=[];
/** Tính năng đăng ký hàm chạy lại khi cấu hình đổi (vd. nới bảng thưởng khi thêm ải). */
export const onContentChange=fn=>{listeners.push(fn);fn(content)};
export function setContent(next){
 content.monsters=next.monsters||{};content.stages={brave:{},sealed:{},dungeon:{},...(next.stages||{})};content.counts=next.counts||{};
 for(const fn of listeners)fn(content);
}
export const monsterAllowed=avatar=>!content.monsters[avatar]?.disabled;
/** Lọc bể quái theo quái đang bật; nếu tắt hết thì giữ nguyên bể gốc để không vỡ đội hình. */
export const allowedPool=pool=>{const out=pool.filter(monsterAllowed);return out.length?out:pool};
export const stageOverride=(mode,key)=>content.stages[mode]?.[String(key)]||null;
/** Đội hình ghi đè của ải (mảng avatar) hoặc null. */
export const overrideLineup=(mode,key)=>{const o=stageOverride(mode,key);return o?.enemies?.length?o.enemies:null};
// Đường cong tăng trưởng theo cấp, cùng công thức với heroStats: grow = L·(1 + L/150).
const grow=L=>L*(1+L/150);
export const levelCurve={maxHp:L=>800+grow(L)*82,attack:L=>100+grow(L)*14,defense:L=>25+grow(L)*4,speed:L=>100+L*(1+L/600)};
/** Cấp đặt cho quái ở ải này (ải ưu tiên hơn quái) hoặc null. */
export const fixedLevel=(mode,key,avatar)=>stageOverride(mode,key)?.level??content.monsters[avatar]?.level??null;
/**
 * Nhân chỉ số với hệ số ải (scale %), chỉnh riêng của quái (hp/atk/def/spd %) và cấp quái.
 * baseLevel: cấp mà `stats` đang ứng với (cấp trung bình đội chuẩn). Trả thêm `level` để hiển thị trong trận.
 */
export function adjustStats(stats,mode,key,avatar,baseLevel=null){
 const k=(stageOverride(mode,key)?.scale??100)/100,m=content.monsters[avatar]||{},lv=fixedLevel(mode,key,avatar),base=Math.max(1,Math.round(baseLevel||lv||1));
 const byLevel=f=>lv&&baseLevel?levelCurve[f](lv)/levelCurve[f](base):1;
 const pct=(f,p)=>Math.max(1,Math.round(stats[f]*k*byLevel(f)*(p??100)/100));
 return{...stats,maxHp:pct('maxHp',m.hp),attack:pct('attack',m.atk),defense:pct('defense',m.def),speed:Math.max(1,Math.round(stats.speed*byLevel('speed')*(m.spd??100)/100)),level:lv||(baseLevel?base:null)};
}
