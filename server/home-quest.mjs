// Nhiệm vụ chính ở sảnh (PanelHome2Quest trong Home2Scene): một chuỗi 1333 nhiệm vụ lấy nguyên từ db_home_quest,
// chữ hiển thị theo db_home_quest_template ("Vượt ải {0}", "Đạt cấp {0}"...), dòng dưới "Hoàn thành: x/y".
// Ô vật phẩm bên trái là phần quà đầu tiên; xong nhiệm vụ thì hiệu ứng Fx_mission bật lên, chạm vào để nhận quà và
// sang nhiệm vụ kế tiếp. Chưa xong thì chạm để đi tới tính năng liên quan.
// Loại 6 (kỹ năng băng của Hạm đội) và 7 (Viễn chinh đảo trời) cần tính năng bản web chưa có nên được bỏ qua tự động.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {requireCondition} from './errors.mjs';
import {stages} from './catalog.mjs';

const source=JSON.parse(readFileSync(fileURLToPath(new URL('../dist/home-quest.json',import.meta.url)),'utf8'));
export const homeQuests=source.quests,homeQuestTemplates=source.templates;
export const unsupportedTypes=new Set([6,7]);
const stageCode=id=>stages.find(s=>s.id===id)?.code||String(id);
const go={1:'tower',2:'heroes',3:'campaign',4:'campaign',5:'hero'};

const state=p=>p.homeQuest||(p.homeQuest={index:0,count:0});
/** Bỏ qua các nhiệm vụ cần tính năng chưa có để chuỗi không bị kẹt. */
function current(p){
 const s=state(p);
 while(s.index<homeQuests.length&&unsupportedTypes.has(homeQuests[s.index].type)){s.index++;s.count=0}
 return homeQuests[s.index]||null;
}
const heroesOf=p=>[p.hero,...Object.values(p.reserveHeroes||{})].filter(Boolean);
function progressOf(p,q){
 const [a,b]=q.data;
 if(q.type===1)return{progress:Math.max(0,(p.tower?.floor||1)-1),target:a};
 if(q.type===2)return{progress:heroesOf(p).filter(h=>h.level>=b).length,target:a};
 if(q.type===3)return{progress:Math.max(0,...(p.adventure?.cleared||[])),target:a};
 if(q.type===4)return{progress:p.account.level,target:a};
 return{progress:state(p).count,target:a};
}
export function questText(q){
 const args=q.type===3?[stageCode(q.data[0])]:q.data;
 return homeQuestTemplates[String(q.type)].replace(/\{(\d)\}/g,(_,i)=>args[Number(i)]);
}
export function homeQuestView(p){
 const q=current(p);if(!q)return{finished:true};
 const {progress,target}=progressOf(p,q);
 return{id:q.id,title:q.title,text:questText(q),progress:Math.min(progress,target),target,done:progress>=target,rewards:q.rewards,go:go[q.type]};
}
/** Sự kiện cho nhiệm vụ đếm số lần (loại 5: nâng đá hộ mệnh), chỉ tính khi nhiệm vụ đó đang là nhiệm vụ hiện tại. */
export function homeQuestEvent(p,type,value=1){const q=current(p);if(q?.type===type)state(p).count+=value}
export function claimHomeQuest(p,grant){
 const q=current(p);requireCondition(q,'Đã hoàn thành mọi nhiệm vụ.',409,'HOME_QUEST_DONE');
 const {progress,target}=progressOf(p,q);requireCondition(progress>=target,'Chưa hoàn thành nhiệm vụ.',409,'HOME_QUEST_NOT_DONE');
 const s=state(p);s.index++;s.count=0;q.rewards.forEach(grant);current(p);
 return{message:'Hoàn thành nhiệm vụ.',rewards:q.rewards};
}
