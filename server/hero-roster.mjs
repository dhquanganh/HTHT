import {definitionFor,heroDefinitions} from './catalog.mjs';

export const newHero=definition=>({id:definition.id,level:1,exp:0,stars:1,rank:0,equipment:{},skills:Object.fromEntries(definition.skills.map(s=>[s.id,1]))});
export function ensureRoster(player){
 player.reserveHeroes??={};player.mail??=[];
 // EXP tướng là quỹ chung (lá xanh ở màn hình chính). Bản trước cộng riêng vào từng tướng: gộp lại một lần.
 if(player.wallet&&player.wallet.spirit===undefined){let pool=0;for(const hero of [player.hero,...Object.values(player.reserveHeroes)]){pool+=hero.exp||0;hero.exp=0}player.wallet.spirit=pool}
 // Đá EXP trong túi trước đây là vật phẩm riêng phải bấm Dùng; giờ chính là quỹ EXP tướng (1 viên = 1 EXP).
 if(player.inventory?.['consumable:1']){player.wallet.spirit=(player.wallet.spirit||0)+player.inventory['consumable:1'];delete player.inventory['consumable:1']}
 // Đá đột phá tự tạo trước đây đổi sang Đá cường hóa của asset (promostone).
 if(player.inventory?.['material:rank-stone']){player.inventory['consumable:2']=(player.inventory['consumable:2']||0)+player.inventory['material:rank-stone'];delete player.inventory['material:rank-stone']}
 // Bản trước lưu tướng chiêu được ở collection, chỉ để xem; chuyển thành tướng thật.
 if(player.collection){for(const avatar of Object.keys(player.collection)){const definition=heroDefinitions.find(h=>h.avatar===avatar);if(definition&&player.hero.id!==definition.id&&!player.reserveHeroes[definition.id])player.reserveHeroes[definition.id]=newHero(definition)}delete player.collection}
 if(player.hero.id!=='zoro-king-of-hell'&&!player.reserveHeroes['zoro-king-of-hell']){
  player.reserveHeroes['zoro-king-of-hell']={id:'zoro-king-of-hell',level:1,exp:0,stars:1,rank:0,equipment:{},skills:{'hiryu-jigoku':3,enma:3,'conqueror-haki':3,'decisive-strike':3}};
 }
}
export function heroSkills(hero){return definitionFor(hero.id).skills}
export function heroLevels(hero){return Object.fromEntries(heroSkills(hero).map(s=>{const v=hero.skills?.[s.id]??hero.skills?.[s.legacySkillId]??1;return[s.id,Number.isSafeInteger(v)&&v>0?v:1]}))}
export function heroTier(hero,id){const s=heroSkills(hero).find(s=>s.id===id);return s.levels[Math.min(s.levels.length,heroLevels(hero)[id]||1)-1]}
export const shardFor=hero=>hero.id==='zoro-king-of-hell'?'material:zoro-shard':hero.id==='luffy-gear-2'?'material:luffy-shard':'heroshard:'+definitionFor(hero.id).avatar;
