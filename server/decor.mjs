// Trang trí tàu / Nội Thất (bundle `shipdecor` + `ship_furniture`, DECOR_* gốc). Dữ liệu gốc: dist/decor.json.
//   * Xưởng (PanelShopFurniture): chế tạo nội thất bằng Búa gỗ (consumable:2138), x1 / x10. Mỗi món là một phiên bản trong
//     db_furniture_point: phẩm 1 tím (theo hệ), 2 vàng (hệ + nghề), 3 đỏ (hệ + nghề + tướng riêng). Mỗi 30 lần chế tạo
//     nhận 1 Thẻ vàng (consumable:2139). Đặt hàng vàng (PanelLegendaryOrder): Thẻ vàng + chọn nghề, hệ → món phẩm vàng.
//     Đặt hàng đỏ (PanelMythicOrder): Thẻ đỏ (consumable:2140) + chọn tướng → món phẩm đỏ riêng của tướng.
//   * Tàu (ShipDecorFloor): mỗi tầng giao cho 1 thuyền viên, 18 ô (1-9 trên: đồ treo tường / trần, 10-18 dưới: đồ đặt sàn).
//     Nội thất đã đặt cộng chỉ số cho mọi tướng đúng hệ / nghề / tướng (mã 0 Công, 2 Máu, 3 Tốc, 97 Lục thức).
//     Bộ nội thất riêng của thuyền viên (db_furniture_hero_collection): đặt 6 / 12 / 18 món của bộ trên tầng của tướng đó.
//   * Kho (StoreRoom), tái chế (PanelRecyleFurniture) ra Búa gỗ theo phẩm, nhận Búa gỗ miễn phí mỗi ngày.
// Số liệu gốc của server (giá, tỉ lệ, số tầng, quà) đặt mặc định ở đây, quản trị sửa được (decor_config).
import {readFileSync} from 'node:fs';
import {requireCondition,integer} from './errors.mjs';
import {heroDefinitions,definitionFor} from './catalog.mjs';
import {fightsAs} from './equipment.mjs';

const data=JSON.parse(readFileSync(new URL('../dist/decor.json',import.meta.url),'utf8'));
export const hammer='consumable:2138',goldCard='consumable:2139',redCard='consumable:2140';
const byAvatar=new Map(heroDefinitions.map(d=>[String(d.avatar),d.id]));
const heroOf=avatar=>avatar?byAvatar.get(String(avatar))||null:null;
export const furniture=new Map(data.furniture.map(f=>[f.id,f]));
export const points=new Map(data.points.map(p=>[p.id,{...p,hero:heroOf(p.hero),effect:p.effect.map(e=>({...e,hero:heroOf(e.hero)}))}]));
export const heroSets=new Map(data.heroSets.map(s=>[heroOf(s.hero),{...s,hero:heroOf(s.hero),items:new Set(s.items)}]).filter(([k])=>k));
export const rooms=data.rooms;
const byItemQuality=new Map();for(const p of points.values()){const k=p.item+':'+p.quality;if(!byItemQuality.has(k))byItemQuality.set(k,[]);byItemQuality.get(k).push(p)}
export const mythicHeroes=[...new Set([...points.values()].filter(p=>p.quality===3&&p.hero).map(p=>p.hero))];
export const slotAccepts=(slot,place)=>slot<=9?place!==1:place===1;
const DAY=86400000,VN=7*3600000,dayKey=now=>Math.floor((now+VN)/DAY);

// Bật / tắt sự kiện (quản trị): tắt thì ẩn khỏi giao diện và từ chối mọi thao tác.
export const defaultDecorConfig=()=>({enabled:true,...baseDecorConfig()});
function baseDecorConfig(){
 return{minLevel:30,floors:3,price:10,maxItems:300,dailyHammers:20,cardEvery:30,rates:[900,100],recycle:[2,8,30]};
}
let config=defaultDecorConfig();
export const decorConfig=()=>config;
export function applyDecorConfig(c){config=c||defaultDecorConfig();return config}
export const validateDecorConfig=(input,...rest)=>({enabled:input?.enabled!==false,...checkDecorConfig(input,...rest)});
function checkDecorConfig(input){
 requireCondition(input&&typeof input==='object','Thiếu cấu hình.');const n=(v,l,a,b)=>integer(v,a,b,l);
 requireCondition(Array.isArray(input.rates)&&input.rates.length===2,'Tỉ lệ chế tạo: cần 2 giá trị (tím, vàng).');
 requireCondition(Array.isArray(input.recycle)&&input.recycle.length===3,'Tái chế: cần 3 giá trị (tím, vàng, đỏ).');
 const rates=input.rates.map((v,i)=>n(v,`Tỉ lệ ${['tím','vàng'][i]}`,0,1000));requireCondition(rates[0]+rates[1]>0,'Tỉ lệ chế tạo phải lớn hơn 0.');
 return{minLevel:n(input.minLevel,'Cấp tối thiểu',1,1000),floors:n(input.floors,'Số tầng',1,10),price:n(input.price,'Giá chế tạo (Búa gỗ)',1,1e6),maxItems:n(input.maxItems,'Sức chứa kho',10,5000),
  dailyHammers:n(input.dailyHammers,'Búa gỗ mỗi ngày',0,1e6),cardEvery:n(input.cardEvery,'Số lần chế tạo nhận Thẻ vàng',0,1000),rates,recycle:input.recycle.map((v,i)=>n(v,`Tái chế ${['tím','vàng','đỏ'][i]}`,0,1e6))};
}

export function decorState(p){
 const s=p.decor??={items:[],nextUid:1,created:0,floors:[],day:0};
 while(s.floors.length<config.floors)s.floors.push({hero:null,slots:{}});
 return s;
}
const pick=(list,random)=>list[Math.floor(random()*list.length)];
function newItem(s,point){const it={uid:s.nextUid++,point:point.id};s.items.push(it);return it}
const itemView=it=>{const p=points.get(it.point),f=furniture.get(p.item);return{uid:it.uid,point:p.id,item:f.id,name:f.name,desc:f.desc,place:f.place,image:f.image,quality:p.quality,hero:p.hero,clazz:p.clazz,faction:p.faction,effect:p.effect}};
const placedUids=s=>new Set(s.floors.flatMap(f=>Object.values(f.slots)));

/** Chỉ số nội thất cho một tướng: {groups (Công / Máu / Tốc), lucThuc}. */
export function decorBonus(p,heroId){
 const s=p.decor;if(!s?.items?.length)return{groups:[],lucThuc:0};
 const def=definitionFor(heroId);if(!def)return{groups:[],lucThuc:0};
 const cls=fightsAs(def.class),items=new Map(s.items.map(i=>[i.uid,i])),pts=[];
 for(const f of s.floors)for(const uid of Object.values(f.slots)){const it=items.get(uid);const p=it&&points.get(it.point);if(!p)continue;
  for(const e of p.effect)if((!e.hero||e.hero===heroId)&&(!e.clazz||e.clazz===cls)&&(!e.faction||e.faction===def.faction))pts.push(...e.point)}
 // Bộ riêng của thuyền viên trên tầng của chính tướng đó.
 const set=heroSets.get(heroId),floor=s.floors.find(f=>f.hero===heroId);
 if(set&&floor){const n=Object.values(floor.slots).filter(uid=>set.items.has(items.get(uid)?.point)).length;for(const k of [6,12,18])if(n>=k)pts.push(...set.bonus[k])}
 let lucThuc=0;const groups=[];for(const [id,v] of pts){if(id===97)lucThuc+=v;else groups.push({clazz:0,faction:0,point:[[id,v]]})}
 return{groups,lucThuc};
}

export function decorView(p,now){
 const s=decorState(p),c=config,placed=placedUids(s);
 return{minLevel:c.minLevel,price:c.price,maxItems:c.maxItems,dailyHammers:c.dailyHammers,dailyReady:s.day!==dayKey(now)&&c.dailyHammers>0,cardEvery:c.cardEvery,created:s.created,recycle:c.recycle,
  items:s.items.map(it=>({...itemView(it),placed:placed.has(it.uid)})),floors:s.floors.slice(0,c.floors).map(f=>{const set=heroSets.get(f.hero);
   return{hero:f.hero,slots:f.slots,set:set?{name:set.name,items:[...set.items],have:Object.values(f.slots).filter(uid=>set.items.has(s.items.find(i=>i.uid===uid)?.point)).length,bonus:set.bonus}:null}}),
  mythicHeroes};
}

/** ctx: {now, level, random, spendItems(cost), grant(reward), owned(heroId)} */
export function decorAction(p,action,input,ctx){
 const s=decorState(p),c=config,random=ctx.random||Math.random;
 requireCondition(ctx.level>=c.minLevel,`Yêu cầu người chơi cấp độ ${c.minLevel} trở lên.`,403,'DECOR_LEVEL');
 const room=n=>requireCondition(s.items.length+n<=c.maxItems,`Kho nội thất đã đầy (${c.maxItems}). Hãy tái chế bớt.`,409,'DECOR_FULL');
 if(action==='decor-daily'){requireCondition(c.dailyHammers>0&&s.day!==dayKey(ctx.now),'Hôm nay đã nhận.',409);s.day=dayKey(ctx.now);const r={itemId:hammer,quantity:c.dailyHammers};ctx.grant(r);return{message:'Nhận Búa gỗ.',rewards:[r]}}
 if(action==='decor-create'){
  const count=[1,10].includes(Number(input?.count))?Number(input.count):1;room(count);ctx.spendItems({[hammer]:c.price*count});
  const made=[],total=c.rates[0]+c.rates[1];let cards=0;
  for(let i=0;i<count;i++){const f=pick([...furniture.values()],random),q=random()*total<c.rates[0]?1:2,list=byItemQuality.get(f.id+':'+q)||byItemQuality.get(f.id+':1');
   made.push(itemView(newItem(s,pick(list,random))));s.created++;if(c.cardEvery&&s.created%c.cardEvery===0)cards++}
  if(cards){const r={itemId:goldCard,quantity:cards};ctx.grant(r)}
  return{message:`Chế tạo ${count} nội thất.`,items:made,cards};
 }
 if(action==='decor-legend'){
  const clazz=String(input?.clazz||''),faction=String(input?.faction||'');requireCondition(['mage','warrior','priest','ranger','assassin'].includes(clazz),'Cần lựa chọn nghề và hệ.',400);
  requireCondition(['shadow','abyss','fortress','forest','dark','light'].includes(faction),'Cần lựa chọn nghề và hệ.',400);room(1);ctx.spendItems({[goldCard]:1});
  const list=[...points.values()].filter(x=>x.quality===2&&x.clazz===clazz&&x.faction===faction);requireCondition(list.length,'Không có nội thất phù hợp.',404);
  const it=newItem(s,pick(list,random));return{message:'Đặt hàng thành công.',items:[itemView(it)]};
 }
 if(action==='decor-mythic'){
  const hero=String(input?.hero||'');requireCondition(mythicHeroes.includes(hero),'Tướng này chưa có nội thất riêng.',404);room(1);ctx.spendItems({[redCard]:1});
  const list=[...points.values()].filter(x=>x.quality===3&&x.hero===hero);const it=newItem(s,pick(list,random));return{message:'Đặt hàng thành công.',items:[itemView(it)]};
 }
 if(action==='decor-hero'){
  const fi=integer(input?.floor,0,c.floors-1,'Tầng'),hero=input?.hero==null?null:String(input.hero);
  if(hero){requireCondition(ctx.owned(hero),'Bạn chưa sở hữu tướng này.',404);requireCondition(!s.floors.some((f,i)=>i!==fi&&f.hero===hero),'Tướng đã có phòng ở tầng khác.',409)}
  s.floors[fi].hero=hero;return{message:hero?'Đã giao phòng cho thuyền viên.':'Đã rời phòng.'};
 }
 if(action==='decor-place'){
  const fi=integer(input?.floor,0,c.floors-1,'Tầng'),slot=integer(input?.slot,1,18,'Ô'),f=s.floors[fi];
  if(input?.uid==null){delete f.slots[slot];return{message:'Đã tháo nội thất.'}}
  const it=s.items.find(i=>i.uid===Number(input.uid));requireCondition(it,'Nội thất không có trong kho.',404);
  const place=furniture.get(points.get(it.point).item).place;requireCondition(slotAccepts(slot,place),place===1?'Đồ đặt sàn chỉ đặt ở hàng dưới.':'Đồ treo chỉ đặt ở hàng trên.',409,'DECOR_PLACE');
  for(const x of s.floors)for(const [k,v] of Object.entries(x.slots))if(v===it.uid)delete x.slots[k];
  f.slots[slot]=it.uid;return{message:'Đã đặt nội thất.'};
 }
 if(action==='decor-auto'){
  // Tự động đặt: điền ô trống bằng món chưa đặt có phẩm cao nhất, ưu tiên bộ riêng của thuyền viên.
  const fi=integer(input?.floor,0,c.floors-1,'Tầng'),f=s.floors[fi],placed=placedUids(s),set=heroSets.get(f.hero);
  const free=s.items.filter(i=>!placed.has(i.uid)).map(i=>({i,p:points.get(i.point)})).sort((a,b)=>(set?.items.has(b.i.point)?1:0)-(set?.items.has(a.i.point)?1:0)||b.p.quality-a.p.quality);
  let n=0;for(let slot=1;slot<=18;slot++){if(f.slots[slot])continue;const k=free.findIndex(x=>slotAccepts(slot,furniture.get(x.p.item).place));if(k<0)continue;f.slots[slot]=free[k].i.uid;free.splice(k,1);n++}
  return{message:n?`Đã đặt ${n} nội thất.`:'Không còn nội thất phù hợp.'};
 }
 if(action==='decor-clear'){const fi=integer(input?.floor,0,c.floors-1,'Tầng');s.floors[fi].slots={};return{message:'Đã tháo toàn bộ.'}}
 if(action==='decor-recycle'){
  const uids=new Set((Array.isArray(input?.uids)?input.uids:[]).map(Number));requireCondition(uids.size>0,'Chưa có đồ nào được lựa chọn.',400);
  const placed=placedUids(s);let gain=0;
  for(const uid of uids){const it=s.items.find(i=>i.uid===uid);requireCondition(it,'Nội thất không có trong kho.',404);requireCondition(!placed.has(uid),'Hãy tháo nội thất khỏi tàu trước khi tái chế.',409);gain+=c.recycle[points.get(it.point).quality-1]}
  s.items=s.items.filter(i=>!uids.has(i.uid));const r={itemId:hammer,quantity:gain};if(gain)ctx.grant(r);return{message:`Nhận ${gain} Búa gỗ.`,rewards:gain?[r]:[]};
 }
 requireCondition(false,'Hành động Nội Thất không hợp lệ.');
}
