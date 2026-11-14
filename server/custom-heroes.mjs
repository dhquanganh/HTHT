// Nhân vật tạo ở trang quản trị (tab "Tạo nhân vật"): dữ liệu tướng, kỹ năng (mô tả tiếng Việt như hero-profiles,
// biên dịch bằng skill-kit giống tướng gốc) và hoạt ảnh từ sprite sheet.
// Sprite sheet được trang quản trị xoá nền, tìm khung rồi tải lên (custom_hero_art). Máy chủ sinh skeleton Spine 3.8
// (JSON + atlas, dist/sprite-spine.js) cho thân và từng hiệu ứng, phục vụ ở /custom-hero/<avatar>/<rev>/<tệp>.
// Game nạp chúng bằng đúng loadSkeleton / SkeletonRenderer của tướng gốc nên đứng, đánh, tuyệt kỹ, bị đánh, chết đều
// đi chung đường với các nhân vật hiện có; hiệu ứng chiêu đi qua hero-effects (cast / impact / attack) như bản gốc.
// Lưu ở custom_heroes ({_id: avatar, rev, ...}); áp vào catalog lúc khởi động và mỗi lần lưu (không cần khởi động lại).
import {createRequire} from 'node:module';
import {requireCondition,integer} from './errors.mjs';
import {registerCustomHero,unregisterCustomHeroes,ultimateFrom,gradeOf,defaultStatScale,hasAsset,heroAlbum} from './catalog.mjs';
import {compileSkill} from './skill-kit.mjs';
const SpriteSpine=createRequire(import.meta.url)('../dist/sprite-spine.js');

export const factions=['fortress','abyss','forest','shadow','dark','light'],classes=['warrior','mage','assassin','ranger','priest'];
export const firstAvatar=90001,maxArtBytes=6000000,maxHeroes=200;
export const artKey=id=>'custom-art-'+id,artSrc=id=>`/hero-art/${id}.webp`;
const ART=/^[a-f0-9]{24}$/;
const sizes={art:[576,432],thumb:[180,239],head:[100,100],icon:[100,100]};
let configs=new Map();

const text=(v,max,label,min=1)=>{const s=String(v??'').replace(/\s+/g,' ').trim().slice(0,max);requireCondition(s.length>=min,`${label}: chưa nhập.`);return s};
const num=(v,lo,hi,label)=>{const n=Number(v);requireCondition(Number.isFinite(n)&&n>=lo&&n<=hi,`${label} phải từ ${lo} đến ${hi}.`);return Math.round(n*1000)/1000};
const int=(v,lo,hi,label)=>integer(Number(v),lo,hi,label);
const artId=(v,label,known,optional=false)=>{if(optional&&(v===null||v===undefined||v===''))return null;requireCondition(typeof v==='string'&&ART.test(v)&&known.has(v),`${label}: ảnh chưa tải lên.`);return v};

function validateFrames(list,frameIds,label,{hit=false}={}){
 requireCondition(Array.isArray(list)&&list.length<=200,`${label}: tối đa 200 khung.`);
 return list.map((f,i)=>{const id=int(f?.f,0,1e6,`${label} khung ${i+1}`);requireCondition(frameIds.has(id),`${label}: khung ${i+1} không còn trên sheet.`);
  const out={f:id};const d=int(f.d??1,1,60,`${label} khung ${i+1}: số nhịp`);if(d!==1)out.d=d;
  const dx=int(Math.round(Number(f.dx)||0),-2000,2000,`${label}: lệch ngang`),dy=int(Math.round(Number(f.dy)||0),-2000,2000,`${label}: lệch dọc`);if(dx)out.dx=dx;if(dy)out.dy=dy;return out});
}
export function validateAnim(a,known){
 requireCondition(a&&typeof a==='object','Thiếu dữ liệu hoạt ảnh.');
 requireCondition(Array.isArray(a.sheets)&&a.sheets.length>=1&&a.sheets.length<=10,'Cần 1–10 sprite sheet.');
 const sheets=a.sheets.map((s,i)=>({art:artId(s?.art,`Sheet ${i+1}`,known),w:int(s.w,1,8192,`Sheet ${i+1}: rộng`),h:int(s.h,1,8192,`Sheet ${i+1}: cao`)}));
 requireCondition(Array.isArray(a.frames)&&a.frames.length>=1&&a.frames.length<=800,'Cần 1–800 khung hình.');
 const seen=new Set();
 const frames=a.frames.map((f,i)=>{const id=int(f?.id,0,1e6,`Khung ${i+1}`);requireCondition(!seen.has(id),'Trùng mã khung.');seen.add(id);
  const s=int(f.s,0,sheets.length-1,`Khung ${id}: sheet`),sh=sheets[s],x=int(f.x,0,sh.w-1,`Khung ${id}: x`),y=int(f.y,0,sh.h-1,`Khung ${id}: y`),w=int(f.w,1,sh.w-x,`Khung ${id}: rộng`),h=int(f.h,1,sh.h-y,`Khung ${id}: cao`);
  return{id,s,x,y,w,h,ax:num(f.ax??x+w/2,-1e4,2e4,`Khung ${id}: điểm chân`),ay:num(f.ay??y+h,-1e4,2e4,`Khung ${id}: điểm chân`)}});
 const animations={};
 for(const name of SpriteSpine.ANIMS){const src=a.animations?.[name];if(!src?.frames?.length)continue;
  const list=validateFrames(src.frames,seen,'Hoạt ảnh '+name);animations[name]={fps:int(src.fps??10,1,60,'FPS'),frames:list};
  if(src.hit!==undefined&&src.hit!==null)animations[name].hit=int(src.hit,0,list.length-1,'Khung trúng đòn')}
 requireCondition(animations.idling?.frames.length,'Hoạt ảnh Đứng yên cần ít nhất 1 khung.');
 requireCondition(animations.beat?.frames.length,'Hoạt ảnh Đánh thường cần ít nhất 1 khung.');
 requireCondition(!a.effects||Array.isArray(a.effects)&&a.effects.length<=10,'Tối đa 10 hiệu ứng.');
 const effects=(a.effects||[]).map((e,i)=>({name:text(e?.name||`Hiệu ứng ${i+1}`,30,'Tên hiệu ứng'),fps:int(e.fps??12,1,60,'FPS hiệu ứng'),scale:num(e.scale??1,.05,10,'Tỉ lệ hiệu ứng'),additive:!!e.additive,frames:validateFrames(e.frames||[],seen,'Hiệu ứng '+(i+1))}));
 for(const [i,e] of effects.entries())requireCondition(e.frames.length,`Hiệu ứng ${i+1} chưa có khung.`);
 const fx=v=>v===null||v===undefined||v===''?null:int(Number(v),0,effects.length-1,'Hiệu ứng được gán');
 const attack={cast:fx(a.attack?.cast),impact:fx(a.attack?.impact),castX:num(a.attack?.castX??1,-20,20,'Vị trí hiệu ứng'),castY:num(a.attack?.castY??0,-20,20,'Vị trí hiệu ứng'),shake:!!a.attack?.shake};
 const skill={cast:fx(a.skill?.cast),impact:fx(a.skill?.impact),castAt:a.skill?.castAt==='stage'?'stage':'target',castDelay:num(a.skill?.castDelay??0,0,5,'Thời điểm hiệu ứng'),shake:a.skill?.shake!==false};
 return{sheets,frames,scale:num(a.scale??1,.05,10,'Tỉ lệ nhân vật'),mirror:!!a.mirror,animations,effects,attack,skill};
}
export function validateSkills(list,known){
 requireCondition(Array.isArray(list)&&list.length>=1&&list.length<=4,'Cần 1 kỹ năng Nộ và tối đa 3 bị động.');
 return list.map((s,i)=>{const label=i?`Bị động ${i}`:'Kỹ năng Nộ',name=text(s?.name,40,label+': tên');
  requireCondition(Array.isArray(s.levels)&&s.levels.length>=1&&s.levels.length<=4,`${label}: cần mô tả cấp 1–4.`);
  const levels=s.levels.map((d,k)=>text(d,1500,`${label} cấp ${k+1}`));while(levels.length<4)levels.push(levels.at(-1));
  let icon=String(s.icon||'');if(ART.test(icon))artId(icon,label+': biểu tượng',known);else requireCondition(hasAsset(icon),`${label}: chọn biểu tượng kỹ năng.`);
  // Ô 0 luôn là Nộ (mô tả bắt đầu "Nộ:"), các ô sau là bị động ("Bị động:") như hero-profiles gốc.
  const prefix=i?'Bị động: ':'Nộ: ',fix=d=>/^(Nộ|Bị động)\s*:/i.test(d)?d.replace(/^(Nộ|Bị động)\s*:\s*/i,prefix):prefix+d;
  return{name,icon,levels:levels.map(fix)}});
}
export function validateHero(input,known,avatar){
 requireCondition(input&&typeof input==='object','Dữ liệu không hợp lệ.');
 requireCondition(factions.includes(input.faction),'Chọn hệ của tướng.');requireCondition(classes.includes(input.class),'Chọn lớp của tướng.');
 const rank=int(input.rank,1,6,'Bậc'),scale=defaultStatScale(rank,input.class);
 return{avatar,name:text(input.name,30,'Tên nhân vật'),faction:input.faction,class:input.class,rank,summon:input.summon!==false,
  statScale:{attack:num(input.statScale?.attack??scale.attack,.1,10,'Hệ số Công'),maxHp:num(input.statScale?.maxHp??scale.maxHp,.1,10,'Hệ số Máu')},
  stats:Object.fromEntries(['attack','defense','maxHp','speed'].map(k=>[k,int(Math.round(Number(input.stats?.[k])||0),0,1e10,'Chỉ số hồ sơ')])),
  images:{head:artId(input.images?.head,'Ảnh đầu',known),thumb:artId(input.images?.thumb,'Ảnh thẻ',known),art:artId(input.images?.art,'Ảnh chân dung',known,true)},
  skills:validateSkills(input.skills,known),anim:validateAnim(input.anim,known)};
}
/** Mọi ảnh một nhân vật dùng (để kiểm tra đã tải lên và để đăng ký vào kho ảnh). */
export const artIds=c=>[c.images.head,c.images.thumb,c.images.art,...c.skills.map(s=>s.icon).filter(i=>ART.test(i)),...c.anim.sheets.map(s=>s.art)].filter(Boolean);

const base=c=>`/custom-hero/${c.avatar}/${c.rev||1}/`;
const pageName=c=>i=>`sheet-${c.anim.sheets[i].art}.png`;
const skeletonDesc=(c,file,pages,name)=>({name,skeleton:{name:file+'.json',src:base(c)+file+'.json'},atlases:[{atlas:{name:file+'.atlas',src:base(c)+file+'.atlas'},textures:pages.map(i=>artKey(c.anim.sheets[i].art))}]});
/** Đăng ký một nhân vật vào catalog (định nghĩa tướng, hồ sơ, bộ kỹ năng, mảnh, hiệu ứng chiêu, ảnh). */
function register(c){
 const id='hero-'+c.avatar,a=c.anim,key=k=>k&&artKey(k);
 const assets={};const add=(art,[w,h])=>{if(art)assets[artKey(art)]={name:c.name,src:artSrc(art),width:w,height:h}};
 add(c.images.head,sizes.head);add(c.images.thumb,sizes.thumb);add(c.images.art,sizes.art);for(const s of c.skills)if(ART.test(s.icon))add(s.icon,sizes.icon);
 for(const s of a.sheets)assets[artKey(s.art)]={name:'sheet-'+s.art,src:artSrc(s.art),width:s.w,height:s.h};
 const icon=s=>ART.test(s.icon)?artKey(s.icon):s.icon;
 const profile={art:key(c.images.art)||key(c.images.thumb),star:10,stats:c.stats,custom:true,skills:c.skills.map((s,i)=>({name:s.name,level:4,passive:i>0,icon:icon(s),description:s.levels[3]}))};
 const levels=c.skills.map(s=>s.levels.map((d,k)=>({level:k+1,name:s.name,description:d})));
 const skills=profile.skills.map((s,i)=>({id:`${id}-${i}`,name:s.name,assetKey:s.icon,passive:s.passive,energy:s.passive?0:100,cooldown:0,animation:'skill',description:s.description,levels:levels[i].map(l=>({level:l.level,description:l.description}))}));
 const body=SpriteSpine.body(a,{pages:pageName(c)}),skeleton=skeletonDesc(c,'body',body.pages,`Custom_${c.avatar}_SkeletonData`);
 // Chiêu kéo dài hơn 2,2 giây được game tua nhanh (Math.max(1, dài/2.2)): bù trước để số sát thương khớp khung trúng đòn.
 const skillAnim=SpriteSpine.framesOf(a,'skill'),skillLen=skillAnim?SpriteSpine.duration(skillAnim):1,skillRate=Math.max(1,skillLen/2.2);
 const beatHit=SpriteSpine.hitTime(a,'beat'),skillHit=SpriteSpine.hitTime(a,'skill');
 const fxKey=i=>`custom/${c.avatar}/fx${i}`,effects={};
 a.effects.forEach((e,i)=>{const built=SpriteSpine.effect(a,e,{pages:pageName(c)});effects[fxKey(i)]=skeletonDesc(c,'fx'+i,built.pages,`CustomFx_${c.avatar}_${i}`)});
 const entry=(i,extra={})=>({key:fxKey(i),animation:'Hit',delay:0,x:0,y:0,scale:1,origin:'2',target:'1',layer:'',order:1,...extra});
 const hero={animation:'skill',delay:0,hits:a.skill.cast!==null?[skillHit]:[],
  // Trận đấu thu hiệu ứng chiêu ×0,7 ở mục tiêu và ×0,877 giữa sân: bù để cùng cỡ với hiệu ứng trúng đòn (×1).
  cast:a.skill.cast!==null?[entry(a.skill.cast,{delay:a.skill.castDelay,origin:a.skill.castAt==='stage'?'1':'2',scale:a.skill.castAt==='stage'?1.2:1.43})]:[],
  impact:a.skill.impact!==null?[entry(a.skill.impact)]:[],shake:a.skill.shake?[{delay:skillHit,duration:.4}]:[],
  attack:{animation:'beat',delay:beatHit,shake:a.attack.shake?[{delay:beatHit,duration:.25}]:[],cast:a.attack.cast!==null?[entry(a.attack.cast,{origin:'0',x:a.attack.castX,y:a.attack.castY})]:[],impact:a.attack.impact!==null?[entry(a.attack.impact)]:[]}};
 const definition={id,name:c.name,avatar:c.avatar,faction:c.faction,class:c.class,grade:gradeOf(c.rank),rank:c.rank,custom:true,summon:c.summon,
  visual:{card:key(c.images.thumb),head:key(c.images.head),art:profile.art,skeleton},skills,
  combat:{skills:[{animation:'beat',delay_cast_eff:String(beatHit)},{animation:'skill',delay_cast_eff:String(Math.round(skillHit/skillRate*100)/100)}]},statScale:c.statScale,
  ultimate:ultimateFrom(profile.skills[0],skills[0].id),ultimates:[1,2,3,4].map(l=>ultimateFrom({...profile.skills[0],description:levels[0][l-1].description},skills[0].id))};
 const album={id:Number(c.avatar),avatar:c.avatar,name:c.name,faction:c.faction,class:c.class,rank:c.rank,card:key(c.images.thumb),custom:true};
 // Kẻ địch / ô chọn quái đọc campaign.visuals[avatar]: cùng skeleton, đầu, đòn đánh thường.
 const visual={head:key(c.images.head),skeleton,combat:{key:c.avatar,name:c.name,scale:'1',skills:definition.combat.skills}};
 registerCustomHero({definition,profile,levels,album,assets,effects:{effects,hero},visual});
}
/** Áp toàn bộ nhân vật đã lưu (lúc khởi động và sau mỗi lần lưu / xoá). Nhân vật lỗi bị bỏ qua, không làm hỏng game. */
export function applyCustomHeroes(docs){
 unregisterCustomHeroes();configs=new Map();const errors=[];
 for(const d of [...docs].sort((a,b)=>Number(a._id)-Number(b._id))){
  const c={...d,avatar:String(d._id)};
  try{register(c);configs.set(c.avatar,c)}catch(e){errors.push(`${c.avatar}: ${e.message}`)}
 }
 return errors;
}
export const nextAvatar=docs=>String(Math.max(firstAvatar-1,...docs.map(d=>Number(d._id)))+1);
/** Tệp Spine sinh từ dữ liệu: body.json / body.atlas / fx<i>.json / fx<i>.atlas. */
export function customHeroFile(avatar,rev,file){
 const c=configs.get(String(avatar));if(!c||Number(rev)!==(c.rev||1))return null;
 const m=/^(body|fx(\d+))\.(json|atlas)$/.exec(file);if(!m)return null;
 let built;if(m[1]==='body')built=SpriteSpine.body(c.anim,{pages:pageName(c)});else{const e=c.anim.effects[Number(m[2])];if(!e)return null;built=SpriteSpine.effect(c.anim,e,{pages:pageName(c)})}
 return m[3]==='json'?{type:'application/json',body:JSON.stringify(built.json)}:{type:'text/plain; charset=utf-8',body:built.atlas};
}
/** Xem trước cách game đọc mô tả kỹ năng (cùng compileSkill của tướng gốc). */
export function compilePreview(input){
 const description=text(input?.description,1500,'Mô tả'),passive=!!input?.passive;
 return compileSkill({name:'preview',passive,description:(passive?'Bị động: ':'Nộ: ')+description.replace(/^(Nộ|Bị động)\s*:\s*/i,'')});
}
export function customHeroList(){return[...configs.values()].map(c=>({avatar:c.avatar,name:c.name,rank:c.rank,faction:c.faction,class:c.class,summon:c.summon,rev:c.rev||1,head:artSrc(c.images.head),updatedAt:c.updatedAt}))}
export const customHeroConfig=avatar=>configs.get(String(avatar))||null;
/** Danh sách tướng gốc để sao chép kỹ năng / chỉ số khi tạo nhân vật mới. */
export const templateHeroes=()=>heroAlbum.heroes.filter(h=>!h.custom).map(h=>({avatar:h.avatar,name:h.name,rank:h.rank,faction:h.faction,class:h.class}));
