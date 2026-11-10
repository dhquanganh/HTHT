import {definitionFor,heroDefinitions} from './catalog.mjs';

export const newHero=definition=>({id:definition.id,level:1,exp:0,stars:1,rank:0,equipment:{},skills:Object.fromEntries(definition.skills.map(s=>[s.id,1]))});
export function ensureRoster(player){
 player.reserveHeroes??={};player.mail??=[];
 // Hệ sao cũ: 10 là sao đỏ duy nhất, 11-15 là L1-L5. Hệ mới thêm 5 sao đỏ (10-14) nên L1-L5 dời lên 15-19.
 if(player.starScheme!==2){for(const hero of [player.hero,...Object.values(player.reserveHeroes)].filter(Boolean))if(hero.stars>=11)hero.stars+=4;player.starScheme=2}
 // EXP tướng là quỹ chung (lá xanh ở màn hình chính). Bản trước cộng riêng vào từng tướng: gộp lại một lần.
 if(player.wallet&&player.wallet.spirit===undefined){let pool=0;for(const hero of [player.hero,...Object.values(player.reserveHeroes)].filter(Boolean)){pool+=hero.exp||0;hero.exp=0}player.wallet.spirit=pool}
 // Đá EXP trong túi trước đây là vật phẩm riêng phải bấm Dùng; giờ chính là quỹ EXP tướng (1 viên = 1 EXP).
 if(player.inventory?.['consumable:1']){player.wallet.spirit=(player.wallet.spirit||0)+player.inventory['consumable:1'];delete player.inventory['consumable:1']}
 // Đá đột phá tự tạo trước đây đổi sang Đá cường hóa của asset (promostone).
 if(player.inventory?.['material:rank-stone']){player.inventory['consumable:2']=(player.inventory['consumable:2']||0)+player.inventory['material:rank-stone'];delete player.inventory['material:rank-stone']}
 // Bản trước lưu tướng chiêu được ở collection, chỉ để xem; chuyển thành tướng thật.
 if(player.collection){for(const avatar of Object.keys(player.collection)){const definition=heroDefinitions.find(h=>h.avatar===avatar);if(definition&&player.hero?.id!==definition.id&&!player.reserveHeroes[definition.id])player.reserveHeroes[definition.id]=newHero(definition)}delete player.collection}
 if(player.hero&&player.intro===undefined&&player.hero.id!=='zoro-king-of-hell'&&!player.reserveHeroes['zoro-king-of-hell']){
  player.reserveHeroes['zoro-king-of-hell']={id:'zoro-king-of-hell',level:1,exp:0,stars:1,rank:0,equipment:{},skills:{'hiryu-jigoku':3,enma:3,'conqueror-haki':3,'decisive-strike':3}};
 }
}
export function heroSkills(hero){return definitionFor(hero.id).skills}
// Kỹ năng tự nâng khi thức tỉnh, như bản gốc (mỗi mức sao của tướng dùng một bản kỹ năng [1]-[4] trong db_heroes),
// rút gọn để mọi tướng max cấp 4 khi tới sao tím: 1-2 sao cấp 1, 3-4 sao cấp 2, 5 sao cấp 3, từ 6 sao (sao tím) cấp 4.
// Không còn nâng bằng sách nên cấp chỉ phụ thuộc số sao; skills đã lưu từ bản trước bị bỏ qua.
export const maxSkillLevel=4;
export const starSkillLevel=stars=>stars>=6?4:stars>=5?3:stars>=3?2:1;
export function heroLevels(hero){
 // Đơn vị trong trận (không có sao) giữ cấp đã chụp lúc vào trận.
 if(hero.stars===undefined)return Object.fromEntries(heroSkills(hero).map(s=>{const v=hero.skills?.[s.id]??hero.skills?.[s.legacySkillId]??1;return[s.id,Math.min(maxSkillLevel,Number.isSafeInteger(v)&&v>0?v:1)]}));
 const level=starSkillLevel(hero.stars);return Object.fromEntries(heroSkills(hero).map(s=>[s.id,level]));
}
export function heroTier(hero,id){const s=heroSkills(hero).find(s=>s.id===id);return s.levels[Math.min(s.levels.length,heroLevels(hero)[id]||1)-1]}
export const shardFor=hero=>hero.id==='zoro-king-of-hell'?'material:zoro-shard':hero.id==='luffy-gear-2'?'material:luffy-shard':'heroshard:'+definitionFor(hero.id).avatar;
