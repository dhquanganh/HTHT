"""Thú cưng (lua_pet, SRMain) -> dist/pet.json.

Đọc nguyên từ cache HTTH:
  db_pet_2 (64 thú cưng, chỉ lấy release = 1), db_pet_2_upgrade (cấp, bậc khai sáng, sao, phí bồi dưỡng),
  db_hero_skill (kỹ năng bị động 5000+ của thú cưng: tên, mô tả, icon trong skillicon_ex),
  mọi sprite của lua_pet (Images/, PetResources/ đầu + Art_, BG1/BG2) và SRMain,
  SkeletonData của từng thú cưng (Pett_<id>) và hiệu ứng triệu hồi,
  các prefab PetHome, PetMain, PMBG1, PMBG2, PetGO, PetSummon, PetLibrary, PetInventory, PetHeadUI2, PetBox, PetEquip,
  PopupPetEquip, PopupSelectPet2, PopupPetStarUpgrade, PopupShowBonusEffectPet, PopupSummonPet, PetCheckBox, SRMain.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, re, sys, runpy, UnityPy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']
cache=web.parent/'HTTH'

def container(bundle):
    out={}
    for f in files[bundle]:
        for path,obj in getattr(f,'container',{}).items():out[path.lower()]=obj.deref() if hasattr(obj,'deref') else obj
    return out
pet=container('lua_pet')
def text(suffix):
    o=next(o for p,o in pet.items() if p.endswith(suffix) and o.type.name=='TextAsset')
    s=o.read().m_Script
    return (s if isinstance(s,str) else bytes(s).decode('utf-8')).lstrip('﻿')

num=lambda v:float(v) if '.' in str(v) else int(v)
rows=json.loads(text('/db_pet_2.txt'))
upgrade=json.loads(text('/db_pet_2_upgrade.txt'))
klass={'atk':1,'hp':2,'spd':3}
pets=[]
for r in rows:
    if str(r['release'])!='1':continue
    up=json.loads('['+r['upgrade_skill'].replace('\\','').strip()[1:-1]+']') if r.get('upgrade_skill') else []
    pets.append({'id':int(r['id']),'name':r['name'].strip(),'desc':r['desc'],'clazz':r['clazz'],'class':klass[r['clazz']],'rank':int(r['rank']),
        'generic':int(r['generic']),'line':int(r['line']),'speed':int(r['loop']),'shardReq':int(r['shard']),
        'passives':[int(r[k]) for k in ('passive1','passive2','passive3')],'upgradeSkill':up,
        'basic':{s:[num(r[f'basic_{f}_min']),num(r[f'basic_{f}_max'])] for s,f in (('atk','attack'),('def','def'),('hp','hp'),('spd','spd'))},
        'intelligent':[num(r['intelligent_min']),num(r['intelligent_max'])]})

# ---- Kỹ năng thú cưng (db_hero_skill)
database=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
def table(name):
    p=next(p for n,p in database.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    if not isinstance(raw,str):raw=raw.decode('utf-8')
    return json.loads(raw[raw.index('[{'):])
skill_db={str(r['id']):r for r in table('db_hero_skill')}
icons={}
for name,ptr in UnityPy.load(str(next(cache.rglob('skillicon_ex/**/__data')))).container.items():
    if ptr.deref().type.name=='Sprite':icons[name.rsplit('/',1)[-1].split('.')[0]]=ptr
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
def icon(number):
    name='skill_'+str(number)
    if name not in icons:return None
    key='skillicon-'+str(number)
    if key not in merged:
        image=icons[name].read().image;path=web/'dist/assets'/(key+'.webp')
        if not path.exists():image.convert('RGBA').save(path,'WEBP',quality=88,method=6)
        merged[key]={'name':name,'src':'assets/'+key+'.webp','width':image.width,'height':image.height}
    return key
plain=lambda t:re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',t or '')).strip()
skills={}
for p in pets:
    for sid in p['passives']+[x for row in p['upgradeSkill'] for x in row]:
        if sid is None or int(sid)<0 or str(sid) in skills:continue
        r=skill_db.get(str(sid))
        if not r:continue
        name=plain(r['name']);lv=re.search(r'\[(\d+)\]',name)
        skills[str(sid)]={'name':re.sub(r'\s*\[\d+\]\s*','',name),'level':int(lv.group(1)) if lv else 1,'icon':icon(r.get('icon') or sid),'description':plain(r['description'])}

# ---- Ảnh: khóa theo thư mục + tên ("images/atk", "petresources/1", "petresources/art_1", "bg1/bgr island")
art={}
for path,obj in pet.items():
    if obj.type.name!='Sprite':continue
    parts=path.split('/');folder=parts[-2];stem=Path(parts[-1]).stem
    art[(folder+'/'+stem).replace('images/','images/')]=scope['save_image'](obj)
# ---- Spine: SkeletonDataAsset của từng thú cưng và hiệu ứng
class Ptr:
    def __init__(s,o):s.o=o;s.m_PathID=o.path_id
    def deref(s):return s.o
spines={}
for f in files['lua_pet']:
    for o in f.objects.values():
        if o.type.name!='MonoBehaviour':continue
        try:raw=o.get_raw_data();name,_=scope['string'](raw,28)
        except Exception:continue
        if not name.lower().endswith('_skeletondata'):continue
        try:spines[name[:-len('_SkeletonData')].lower()]=scope['skeleton'](Ptr(o))
        except Exception as ex:print('spine',name,ex,flush=True)

names=['PetHome','PetMain','PMBG1','PMBG2','PetGO','PetSummon','PetLibrary','PetInventory','PetHeadUI2','PetBox','PetEquip','PopupPetEquip','PopupSelectPet2','PopupPetStarUpgrade','PopupShowBonusEffectPet','PopupSummonPet','PetCheckBox']
prefabs={}
for n in names:
    try:prefabs[n]=prefab('lua_pet',n)
    except StopIteration:print('missing prefab',n,flush=True)
prefabs['SRMain']=prefab('lua_ex','SRMain')

result={'pets':pets,'upgrade':upgrade,'skills':skills,'art':art,'spines':spines,'prefabs':prefabs,
        'items':{'summon':'consumable:3002','exp':'consumable:3004','growth':'consumable:3003','cleanse':'consumable:3001','enlight':'consumable:3000','awaken':'consumable:2'}}
(web/'dist/pet.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('pets',len(pets),'skills',len(skills),'art',len(art),'spines',len(spines),'prefabs',list(prefabs),flush=True)
