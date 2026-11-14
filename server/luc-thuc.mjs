// Lục thức (HC_LUC_THUC_1_TONG_LUC_THUC_CA_DOI_CAO_HON gốc):
//   1. Tổng Lục thức cả đội cao hơn kẻ địch sẽ giảm sát thương nhận phải tương đương với độ chênh lệch lục thức,
//      tối đa 70% sát thương ban đầu.
//   2. Lục thức chỉ có tác dụng trong PvP: Đơn đấu, Liên đấu, Võ đấu (Hạm chiến, Khiêu chiến bạn bè chưa có ở bản web).
// Nguồn: tranh Album Đảo Người Cá (mã chỉ số 97, "Toàn đội tăng X Lục thức": mỗi tướng ra trận nhận X).
// Bản gốc không ghi tỉ lệ quy đổi; bản web dùng `perPercent` Lục thức chênh lệch = giảm 1% (chỉnh ở trang quản trị).
export const lucThucId=97,lucThucCap=.7;
export const lucThucConfig={perPercent:1000000};
/** Tổng Lục thức của một đội: cộng Lục thức của từng tướng. */
export const teamLucThuc=units=>units.reduce((n,u)=>n+(Number(u.lucThuc)||0),0);
/** Giảm sát thương (0..0.7) cho đội có tổng `mine` khi đối thủ có `other`. */
export const lucThucReduction=(mine,other)=>Math.min(lucThucCap,Math.max(0,mine-other)/Math.max(1,lucThucConfig.perPercent)/100);
/** Gắn vào trận PvP lúc khởi tạo: tổng hai bên và mức giảm của từng bên. */
export function setupLucThuc(b){
 const ally=teamLucThuc(b.allies),enemy=teamLucThuc(b.enemies);
 b.lucThuc={ally,enemy,reduce:{ally:lucThucReduction(ally,enemy),enemy:lucThucReduction(enemy,ally)}};
 return b.lucThuc;
}
